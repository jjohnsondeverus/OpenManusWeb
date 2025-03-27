import asyncio
import json
import os
import threading
import time
import uuid
import webbrowser
import logging
from pathlib import Path
from typing import Dict, Optional

from fastapi import (
    BackgroundTasks,
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.agent.manus import Manus
from app.flow.base import FlowType
from app.flow.flow_factory import FlowFactory
from app.web.log_handler import capture_session_logs, get_logs
from app.web.log_parser import get_all_logs_info, get_latest_log_info, parse_log_file
from app.web.thinking_tracker import ThinkingTracker, ThinkingStep
from app.web.session_storage import SessionStorage
from app.llm import LLM
from app.tool import ToolCollection, PlanningTool


# 控制是否自动打开浏览器 (读取环境变量，默认为True)
AUTO_OPEN_BROWSER = os.environ.get("AUTO_OPEN_BROWSER", "1") == "1"
last_opened = False  # 跟踪浏览器是否已打开

app = FastAPI(title="OpenManus Web")

# 获取当前文件所在目录
current_dir = Path(__file__).parent
# 设置静态文件目录
app.mount("/static", StaticFiles(directory=current_dir / "static"), name="static")
# 设置模板目录
templates = Jinja2Templates(directory=current_dir / "templates")

# 存储活跃的会话及其结果
active_sessions: Dict[str, dict] = {}

# 存储任务取消事件
cancel_events: Dict[str, asyncio.Event] = {}

# 创建工作区根目录
WORKSPACE_ROOT = Path(__file__).parent.parent.parent / "workspace"
WORKSPACE_ROOT.mkdir(exist_ok=True)

# 日志目录
LOGS_DIR = Path(__file__).parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# 导入日志监视器
from app.utils.log_monitor import LogFileMonitor


# 存储活跃的日志监视器
active_log_monitors: Dict[str, LogFileMonitor] = {}

# Initialize session storage
storage = SessionStorage()


# 创建工作区目录的函数
def create_workspace(session_id: str) -> Path:
    """为会话创建工作区目录"""
    # 简化session_id作为目录名
    job_id = f"job_{session_id[:8]}"
    workspace_dir = WORKSPACE_ROOT / job_id
    workspace_dir.mkdir(exist_ok=True)
    return workspace_dir


@app.on_event("startup")
async def startup_event():
    """启动事件：应用启动时自动打开浏览器"""
    global last_opened
    if AUTO_OPEN_BROWSER and not last_opened:
        # 延迟1秒以确保服务已经启动
        threading.Timer(1.0, lambda: webbrowser.open("http://localhost:8000")).start()
        print("🌐 自动打开浏览器...")
        last_opened = True


class SessionRequest(BaseModel):
    prompt: str


@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    """主页入口 - 使用connected界面"""
    return HTMLResponse(
        content=open(
            current_dir / "static" / "connected_interface.html", encoding="utf-8"
        ).read()
    )


@app.get("/original", response_class=HTMLResponse)
async def get_original_interface(request: Request):
    """原始界面入口"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/connected", response_class=HTMLResponse)
async def get_connected_interface(request: Request):
    """连接后端的新界面入口 (与主页相同)"""
    return HTMLResponse(
        content=open(
            current_dir / "static" / "connected_interface.html", encoding="utf-8"
        ).read()
    )


@app.post("/api/chat")
async def create_chat_session(
    session_req: SessionRequest, background_tasks: BackgroundTasks
):
    print(f"[/api/chat] Received request.") # API Request Log (General)
    """Create a new chat session with the given prompt."""
    session_id = str(uuid.uuid4())
    print(f"[/api/chat] Generated session ID: {session_id}") # API Session ID Log
    active_sessions[session_id] = {
        "status": "processing",
        "result": None,
        "log": [],
        "workspace": None,
        "prompt": session_req.prompt # Store prompt in session
    }

    # Create cancel event
    cancel_events[session_id] = asyncio.Event()

    # Start tracking with prompt
    ThinkingTracker.start_tracking(session_id, prompt=session_req.prompt)
    print(f"[/api/chat] Started thinking tracking for session {session_id}") # API Tracking Log

    # Process prompt in background
    print(f"[/api/chat] Adding background task 'process_prompt' for session {session_id}") # Log adding task
    background_tasks.add_task(process_prompt, session_id, session_req.prompt)
    print(f"[/api/chat] Background task added for session {session_id}") # Log task added
    print(f"[/api/chat] Returning initial response for session {session_id}") # Log returning response
    return {
        "session_id": session_id,
        "workspace": active_sessions[session_id]["workspace"],
    }


@app.get("/api/sessions")
async def get_sessions(limit: int = 10, offset: int = 0):
    """Get list of saved sessions."""
    try:
        sessions = storage.get_sessions(limit=limit, offset=offset)
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving sessions: {str(e)}")


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get complete session data for replay."""
    try:
        session_data = storage.get_session_data(session_id)
        
        if "error" in session_data:
            raise HTTPException(status_code=404, detail=session_data["error"])
        
        return session_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving session: {str(e)}")


@app.post("/api/sessions/{session_id}/replay")
async def start_session_replay(session_id: str, background_tasks: BackgroundTasks):
    """Start replaying a session."""
    try:
        session_data = storage.get_session_data(session_id)
        
        if "error" in session_data:
            raise HTTPException(status_code=404, detail=session_data["error"])
        
        # Create a new session for the replay
        replay_session_id = str(uuid.uuid4())
        active_sessions[replay_session_id] = {
            "status": "replaying",
            "result": None,
            "log": [],
            "workspace": session_data.get("workspace"),
            "original_session_id": session_id
        }
        
        # Start replay in background
        background_tasks.add_task(replay_session, replay_session_id, session_data)
        
        return {
            "replay_session_id": replay_session_id,
            "status": "started"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting replay: {str(e)}")


async def replay_session(replay_session_id: str, session_data: Dict):
    """Replay a session from saved data."""
    try:
        # Initialize thinking tracker for the replay
        ThinkingTracker.start_tracking(replay_session_id)
        
        # Get thinking steps and terminal outputs
        thinking_steps = session_data.get("thinking_steps", [])
        terminal_outputs = session_data.get("terminal_outputs", [])
        
        # Group terminal outputs by thinking step
        terminal_by_step = {}
        for output in terminal_outputs:
            step_id = output.get("thinking_step_id")
            if step_id:
                if step_id not in terminal_by_step:
                    terminal_by_step[step_id] = []
                terminal_by_step[step_id].append(output)
        
        # Replay thinking steps and terminal outputs with timing
        for step in thinking_steps:
            # Add thinking step
            ThinkingTracker.add_thinking_step(
                replay_session_id,
                step.get("message", ""),
                step.get("details", "")
            )
            
            # Add terminal outputs for this step
            step_id = step.get("id")
            if step_id in terminal_by_step:
                for output in terminal_by_step[step_id]:
                    ThinkingTracker.add_log_entry(
                        replay_session_id,
                        {
                            "output": output.get("output", ""),
                            "thinking_step_id": step_id,
                            "tool_name": output.get("tool_name", ""),
                            "timestamp": output.get("timestamp", time.time())
                        }
                    )
            
            # Slow down replay for visibility
            await asyncio.sleep(0.5)
        
        # Update session status
        active_sessions[replay_session_id]["status"] = "completed"
        active_sessions[replay_session_id]["result"] = session_data.get("prompt", "Session replay completed")
        
    except Exception as e:
        active_sessions[replay_session_id]["status"] = "error"
        active_sessions[replay_session_id]["result"] = f"Error during replay: {str(e)}"
        raise


@app.get("/api/chat/{session_id}")
async def get_chat_result(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # 使用新的日志处理模块获取日志
    session = active_sessions[session_id]
    session["log"] = get_logs(session_id)

    return session


@app.post("/api/chat/{session_id}/stop")
async def stop_processing(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if session_id in cancel_events:
        cancel_events[session_id].set()

    active_sessions[session_id]["status"] = "stopped"
    active_sessions[session_id]["result"] = "处理已被用户停止"

    return {"status": "stopped"}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """Handles WebSocket connections for real-time updates."""
    print(f"--- WebSocket connection attempt for session {session_id} (in app.py) ---") # Log connection attempt
    await websocket.accept()
    print(f"--- WebSocket accepted for session {session_id} (in app.py) ---") # Log acceptance

    # Register the WebSocket send callback for this session
    print(f"Registering WebSocket callback for session {session_id} (in app.py)...") # Log before registration
    ThinkingTracker.register_ws_send_callback(session_id, websocket.send_text)
    print(f"WebSocket callback registered for session {session_id} (in app.py).") # Log after registration

    try:
        # Send initial state immediately upon connection
        initial_state = ThinkingTracker.get_full_state(session_id)
        print(f"Sending initial WebSocket state for session {session_id} (in app.py): {json.dumps(initial_state)[:100]}...") # Log initial state send
        print(f"Initial WebSocket state: {json.dumps(initial_state)}") # Log full initial state for debugging
        await websocket.send_text(json.dumps(initial_state))
        print(f"Initial WebSocket state sent for session {session_id} (in app.py).") # Log after initial state send

        # Keep the connection alive
        while True:
            # Wait for a message (or timeout, keepalive)
            # Receiving data is important to detect disconnects properly
            data = await websocket.receive_text()
            print(f"Received message from client {session_id}: {data}") # Log received message
            # Handle client messages if necessary
            if data.get("type") == "cancel":
                if session_id in cancel_events:
                    cancel_events[session_id].set()
                    ThinkingTracker.mark_stopped(session_id)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session {session_id} (in app.py).") # Log disconnect
    except Exception as e:
        print(f"Error in WebSocket endpoint for session {session_id} (in app.py): {e}") # Log error
        logging.error(f"WebSocket error for session {session_id} (in app.py): {e}", exc_info=True) # Use logging.error
    finally:
        # Unregister the callback when the connection closes
        print(f"Unregistering WebSocket callback for session {session_id} (in app.py)...") # Log before unregistration
        ThinkingTracker.unregister_ws_send_callback(session_id)
        print(f"WebSocket callback unregistered for session {session_id} (in app.py).") # Log after unregistration
        print(f"--- WebSocket connection closed for session {session_id} (in app.py) ---") # Log connection close


# 在适当位置添加LLM通信钩子
# ThinkingTracker已经在上面导入


# 修改通信跟踪器的实现方式
class LLMCommunicationTracker:
    """跟踪与LLM的通信内容，使用monkey patching代替回调"""

    def __init__(self, session_id: str, agent=None):
        self.session_id = session_id
        self.agent = agent
        self.original_completion = None

        # 如果提供了agent，安装钩子
        if agent and hasattr(agent, "llm") and hasattr(agent.llm, "completion"):
            self.install_hooks()

    def install_hooks(self):
        """安装钩子以捕获LLM通信内容"""
        if not self.agent or not hasattr(self.agent, "llm"):
            return False

        # 保存原始方法
        llm = self.agent.llm
        if hasattr(llm, "completion"):
            self.original_completion = llm.completion
            # 替换为我们的包装方法
            llm.completion = self._wrap_completion(self.original_completion)
            return True
        return False

    def uninstall_hooks(self):
        """卸载钩子，恢复原始方法"""
        if (self.agent and hasattr(self.agent, "llm") and 
            self.original_completion and hasattr(self.agent.llm, "completion")):
            self.agent.llm.completion = self.original_completion

    def _wrap_completion(self, original_method):
        """包装LLM的completion方法以捕获输入和输出"""
        session_id = self.session_id

        async def wrapped_completion(*args, **kwargs):
            # 记录输入
            prompt = kwargs.get("prompt", "")
            if not prompt and args:
                prompt = args[0]
            if prompt:
                ThinkingTracker.add_communication(
                    session_id,
                    "发送到LLM",
                    prompt[:500] + ("..." if len(prompt) > 500 else ""),
                )

            # 调用原始方法
            result = await original_method(*args, **kwargs)

            # 记录输出
            if result:
                content = result
                if isinstance(result, dict) and "content" in result:
                    content = result["content"]
                elif hasattr(result, "content"):
                    content = result.content

                if isinstance(content, str):
                    ThinkingTracker.add_communication(
                        session_id,
                        "从LLM接收",
                        content[:500] + ("..." if len(content) > 500 else ""),
                    )

            return result

        return wrapped_completion


# 导入新创建的LLM包装器
from app.agent.llm_wrapper import LLMCallbackWrapper


# 修改文件API，支持工作区目录
@app.get("/api/files")
async def get_generated_files():
    """获取所有工作区目录和文件"""
    result = []

    # 获取所有工作区目录
    workspaces = list(WORKSPACE_ROOT.glob("job_*"))
    workspaces.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    for workspace in workspaces:
        workspace_name = workspace.name
        # 获取工作区内所有文件并按修改时间排序
        files = []
        with os.scandir(workspace) as it:
            for entry in it:
                if entry.is_file() and entry.name.split(".")[-1] in [
                    "txt",
                    "md",
                    "html",
                    "css",
                    "js",
                    "py",
                    "json",
                ]:
                    files.append(entry)
        # 按修改时间倒序排序
        files.sort(key=lambda x: x.stat().st_mtime, reverse=True)

        # 如果有文件，添加该工作区
        if files:
            workspace_item = {
                "name": workspace_name,
                "path": str(workspace.relative_to(Path(__file__).parent.parent.parent)),
                "modified": workspace.stat().st_mtime,
                "files": [],
            }

            # 添加工作区下的文件
            for file in sorted(files, key=lambda p: p.name):
                workspace_item["files"].append(
                    {
                        "name": file.name,
                        "path": str(
                            Path(file.path).relative_to(
                                Path(__file__).parent.parent.parent
                            )
                        ),
                        "type": Path(file.path).suffix[1:],  # 去掉.的扩展名
                        "size": file.stat().st_size,
                        "modified": file.stat().st_mtime,
                    }
                )

            result.append(workspace_item)

    return {"workspaces": result}


# 新增日志文件接口
@app.get("/api/logs")
async def get_system_logs(limit: int = 10):
    """获取系统日志列表"""
    log_files = []
    for entry in os.scandir(LOGS_DIR):
        if entry.is_file() and entry.name.endswith(".log"):
            log_files.append(
                {
                    "name": entry.name,
                    "size": entry.stat().st_size,
                    "modified": entry.stat().st_mtime,
                }
            )
    # 按修改时间倒序排序并限制数量
    log_files.sort(key=lambda x: x["modified"], reverse=True)
    return {"logs": log_files[:limit]}


@app.get("/api/logs/{log_name}")
async def get_log_content(log_name: str, parsed: bool = False):
    """获取特定日志文件内容"""
    log_path = LOGS_DIR / log_name
    # 安全检查
    if not log_path.exists() or not log_path.is_file():
        raise HTTPException(status_code=404, detail="Log file not found")

    # 如果请求解析后的日志信息
    if parsed:
        log_info = parse_log_file(str(log_path))
        log_info["name"] = log_name
        return log_info

    # 否则返回原始内容
    with open(log_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {"name": log_name, "content": content}


@app.get("/api/logs_parsed")
async def get_parsed_logs(limit: int = 10):
    """获取解析后的日志信息列表"""
    return {"logs": get_all_logs_info(str(LOGS_DIR), limit)}


@app.get("/api/logs_parsed/{log_name}")
async def get_parsed_log(log_name: str):
    """获取特定日志文件的解析信息"""
    log_path = LOGS_DIR / log_name
    # 安全检查
    if not log_path.exists() or not log_path.is_file():
        raise HTTPException(status_code=404, detail="Log file not found")

    log_info = parse_log_file(str(log_path))
    log_info["name"] = log_name
    return log_info


@app.get("/api/latest_log")
async def get_latest_log():
    """获取最新日志文件的解析信息"""
    return get_latest_log_info(str(LOGS_DIR))


@app.get("/api/files/{file_path:path}")
async def get_file_content(file_path: str):
    """获取特定文件的内容"""
    # 安全检查，防止目录遍历攻击
    root_dir = Path(__file__).parent.parent.parent
    full_path = root_dir / file_path

    # 确保文件在项目目录内
    try:
        full_path.relative_to(root_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # 读取文件内容
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 确定文件类型
        file_type = full_path.suffix[1:] if full_path.suffix else "text"

        return {
            "name": full_path.name,
            "path": file_path,
            "type": file_type,
            "content": content,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


# 修改process_prompt函数，处理工作区
async def process_prompt(session_id: str, prompt: str):
    """Process the prompt using the appropriate flow."""
    print(f"[BG Task {session_id}] Starting background task.") # BG Task Start Log
    workspace_dir = create_workspace(session_id)
    active_sessions[session_id]["workspace"] = str(workspace_dir)
    os.environ["OPENMANUS_WORKSPACE"] = str(workspace_dir)
    os.environ["OPENMANUS_TASK_ID"] = session_id # Set task ID for logging

    # Use capture_session_logs as a context manager
    with capture_session_logs(session_id):
        print(f"[BG Task {session_id}] Workspace and logging setup complete.") # BG Task Setup Log
        try:
            # --- Agent and Flow Creation ---
            # Create necessary components for the agent/flow
            llm = LLM()
            planning_tool = PlanningTool()
            # Pass tool instances directly to ToolCollection, not in a list
            tools = ToolCollection(planning_tool)
            # Create the agent (e.g., Manus or a specific planner agent)
            agent = Manus(llm=llm, tools=tools) # Assuming Manus is the primary agent
            agents_dict = {"planner": agent} # Pass agents as a dictionary

            # Determine flow type (default to PLANNING for now)
            flow_type = FlowType.PLANNING
            flow = FlowFactory.create_flow(flow_type, agents=agents_dict, session_id=session_id) # Pass agents

            # Get cancel event
            cancel_event = cancel_events.get(session_id)

            # Execute the flow
            print(f"[BG Task {session_id}] BEFORE flow.execute()") # Log before execute
            result = await flow.execute(prompt, job_id=session_id, cancel_event=cancel_event)
            print(f"[BG Task {session_id}] AFTER flow.execute()") # Log after execute
            print(f"[BG Task {session_id}] Flow execution completed. Result length: {len(result) if result else 'N/A'}") # BG Task Result Log

            # Update session status and result
            active_sessions[session_id]["status"] = "completed"
            active_sessions[session_id]["result"] = result
            print(f"[BG Task {session_id}] Flow marked as completed.") # BG Task Status Log
            ThinkingTracker.add_thinking_step(session_id, f"Flow execution completed successfully. Result length: {len(result) if result else 'N/A'}")

            # Save session data
            session_data = {
                "session_id": session_id,
                "prompt": prompt,
                "result": result,
                "thinking_steps": ThinkingTracker.get_all_thinking_steps(session_id),
                "logs": get_logs(session_id),
                "workspace": str(workspace_dir),
                "timestamp": time.time()
            }
            storage.save_session(session_id, session_data)
            print(f"[BG Task {session_id}] Session data saved.") # BG Task Save Log

        except Exception as e:
            # Update session status on error
            active_sessions[session_id]["status"] = "error"
            active_sessions[session_id]["result"] = f"Error: {str(e)}"
            print(f"[BG Task {session_id}] !!! Exception in background task: {e}") # Log exception
            ThinkingTracker.add_thinking_step(session_id, f"Error during flow execution: {str(e)}")
            # Log the full traceback
            import traceback
            traceback_str = traceback.format_exc()
            print(f"[BG Task {session_id}] Traceback:\n{traceback_str}") # Log traceback
            ThinkingTracker.add_thinking_step(session_id, f"Traceback:\n{traceback_str}")
            # Consider saving error state to storage here if needed

        finally:
            # Cleanup within the 'with' block if needed, but log handler stop is automatic
            pass # log_handler.stop() is removed as 'with' handles it

        # Remove cancel event (outside the 'with' block)
        if session_id in cancel_events:
            del cancel_events[session_id]
        print(f"[BG Task {session_id}] Background task finished.") # BG Task End Log


# 添加一个新的API端点来获取思考步骤
@app.get("/api/thinking/{session_id}")
async def get_thinking_steps(session_id: str, start_index: int = 0):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    thinking_steps = ThinkingTracker.get_thinking_steps(session_id, start_index)
    print(f"API retrieved {len(thinking_steps)} thinking steps for session {session_id}")
    
    return {
        "status": ThinkingTracker.get_status(session_id),
        "thinking_steps": thinking_steps,
    }


@app.post("/api/debug/thinking/{session_id}")
async def add_debug_thinking_step(session_id: str):
    """Debug endpoint to add a test thinking step"""
    if session_id not in active_sessions:
        # Create the session if it doesn't exist
        active_sessions[session_id] = {
            "status": "processing",
            "result": None,
            "log": [],
            "workspace": None,
        }
        ThinkingTracker.start_tracking(session_id)
    
    # Add a test thinking step
    step_message = f"Debug thinking step at {time.strftime('%H:%M:%S')}"    
    ThinkingTracker.add_thinking_step(session_id, step_message)
    
    return {
        "status": "added",
        "message": step_message,
        "session_id": session_id,
        "thinking_steps": ThinkingTracker.get_thinking_steps(session_id)
    }


# 添加获取进度信息的API端点
@app.get("/api/progress/{session_id}")
async def get_progress(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    return ThinkingTracker.get_progress(session_id)


# 添加API端点获取指定会话的系统日志
@app.get("/api/systemlogs/{session_id}")
async def get_system_logs(session_id: str):
    """获取指定会话的系统日志"""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    job_id = None
    if "workspace" in active_sessions[session_id]:
        workspace_path = active_sessions[session_id]["workspace"]
        job_id = workspace_path

    if not job_id:
        return {"logs": []}

    # 如果有监控器使用监控器
    if session_id in active_log_monitors:
        logs = active_log_monitors[session_id].get_log_entries()
        return {"logs": logs}

    # 否则直接读取日志文件
    log_path = LOGS_DIR / f"{job_id}.log"
    if not log_path.exists():
        return {"logs": []}

    try:
        with open(log_path, "r", encoding="utf-8") as f:
            logs = [line.strip() for line in f.readlines()]
        return {"logs": logs}
    except Exception as e:
        return {"error": f"Error reading log file: {str(e)}"}
