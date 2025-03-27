"""
思考跟踪器模块，实现Manus风格的任务进展日志系统
"""
import asyncio
import json
import threading
import time
from enum import Enum
from typing import Any, Dict, List, Optional
import re

from app.web.session_storage import SessionStorage


# 全局思考步骤存储
class ThinkingStep:
    """表示一个思考步骤"""

    def __init__(
        self, message: str, step_type: str = "thinking", details: Optional[str] = None
    ):
        self.id = f"step_{int(time.time())}_{id(self)}"
        self.message = message
        self.step_type = step_type  # thinking, conclusion, error, communication
        self.details = details  # 用于存储通信内容或详细信息
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """Convert step to dictionary."""
        return {
            "id": self.id,
            "message": self.message,
            "type": self.step_type,
            "details": self.details,
            "timestamp": self.timestamp
        }


class TaskStatus(str, Enum):
    PENDING = "pending"
    THINKING = "thinking"
    COMPLETED = "completed"
    ERROR = "error"
    STOPPED = "stopped"


class ThinkingTracker:
    """思考跟踪器，用于记录和管理AI思考过程"""

    # 类变量，存储所有会话的思考步骤
    _session_steps: Dict[str, List[ThinkingStep]] = {}
    _session_status: Dict[str, TaskStatus] = {}
    _session_progress: Dict[str, Dict[str, Any]] = {}  # 存储进度信息
    _session_logs: Dict[str, List[Dict]] = {}  # 存储日志内容
    _ws_send_callbacks: Dict[str, Any] = {}  # 存储WebSocket发送回调函数
    _lock = threading.RLock()
    _storage = SessionStorage()  # Initialize database storage

    @classmethod
    def register_ws_send_callback(cls, session_id: str, callback: Any) -> None:
        """注册WebSocket发送回调函数"""
        with cls._lock:
            cls._ws_send_callbacks[session_id] = callback

    @classmethod
    def unregister_ws_send_callback(cls, session_id: str) -> None:
        """取消注册WebSocket发送回调函数"""
        with cls._lock:
            if session_id in cls._ws_send_callbacks:
                del cls._ws_send_callbacks[session_id]

    @classmethod
    def start_tracking(cls, session_id: str, prompt: Optional[str] = None) -> None:
        """开始追踪一个会话的思考过程"""
        with cls._lock:
            cls._session_steps[session_id] = []
            cls._session_status[session_id] = TaskStatus.THINKING
            cls._session_progress[session_id] = {
                "current_step": "初始化",
                "total_steps": 0,
                "completed_steps": 0,
                "percentage": 0,
            }
            cls._session_logs[session_id] = []

            # Save initial session to database
            if prompt is not None:
                session_data = {"prompt": prompt, "status": TaskStatus.THINKING.value}
                cls._storage.save_session(
                    session_id=session_id,
                    session_data=session_data
                )

    @classmethod
    def add_thinking_step(
        cls, session_id: str, message: str, step_type: str = "thinking", details: dict = None
    ) -> None:
        """Add a thinking step to the session."""
        print(f"--- ENTERING add_thinking_step for session {session_id} ---") # Entry log
        print(f"Adding thinking step to session {session_id}: {message}")
        print(f"Details received: {details!r}") # Log details
        
        if session_id not in cls._session_steps:
            print(f"Starting tracking for session {session_id} (it wasn't tracked before)")
            cls.start_tracking(session_id)
            
        # Check for duplicates to avoid redundant steps
        step_id = None
        if details and isinstance(details, dict) and 'step_id' in details:
            step_id = details['step_id']
            print(f"Step has ID: {step_id}")
            
            # Only try to find existing steps if we have a step_id
            print(f"Attempting to find existing step with ID: {step_id}")
            if step_id:
                with cls._lock:
                    # Find and update existing step instead of adding a new one
                    existing_step_index = None
                    for i, step in enumerate(cls._session_steps[session_id]):
                        if (hasattr(step, 'details') and step.details and 
                            isinstance(step.details, dict) and 
                            'step_id' in step.details and 
                            step.details['step_id'] == step_id):
                            
                            existing_step_index = i
                            print(f"Found existing step with ID {step_id} at index {i}")
                            break
                    
                    if existing_step_index is not None:
                        # Update existing step instead of adding a new one
                        existing_step = cls._session_steps[session_id][existing_step_index]
                        existing_step.message = message
                        existing_step.details = details
                        existing_step.timestamp = time.time()  # Update timestamp
                        
                        print(f"Updated existing step with ID {step_id} instead of adding a new one")
                        print("Before checking for WebSocket callback (update path)")
                        
                        # Send update via WebSocket if callback registered
                        if session_id in cls._ws_send_callbacks:
                            try:
                                message_data = {
                                    "status": cls.get_status(session_id),
                                    "thinking_steps": [existing_step.to_dict()],
                                    "progress": cls.get_progress(session_id),
                                    "logs": cls.get_logs(session_id),
                                    "updated": True  # Flag to indicate this is an update
                                }
                                print(f"Attempting to send incremental update for existing step via WebSocket")
                                asyncio.create_task(cls._ws_send_callbacks[session_id](json.dumps(message_data)))
                                print(f"WebSocket task created for existing step update")
                            except Exception as e:
                                print(f"Error sending WebSocket update: {str(e)}")
                        print("After checking for WebSocket callback (update path)")
                        
                        print(f"--- EXITING add_thinking_step (updated existing step) for session {session_id} ---") # Exit log (update path)
                        return
        
        # If we reach here, it's a new step or doesn't have a step_id for deduplication
        print(f"Creating new step for message: {message[:50]}...")
        step = ThinkingStep(message, step_type, details)
        
        # Add step to the in-memory storage
        print("Acquiring lock for new step...")
        with cls._lock:
            print("Lock acquired for new step.")
            if session_id not in cls._session_steps:
                cls._session_steps[session_id] = []
                
            cls._session_steps[session_id].append(step)
            print(f"Session {session_id} now has {len(cls._session_steps[session_id])} thinking steps")
            print("Releasing lock after adding new step.")
            
            # Save to database
            try:
                cls._storage.save_thinking_steps(session_id, [
                    {
                        "message": step.message,
                        "type": step.step_type,
                        "details": step.details,
                        "timestamp": step.timestamp
                    }
                ])
                print("Successfully saved thinking step to database.")
            except Exception as e:
                print(f"Error saving thinking step to database: {str(e)}")
            
            # Try to extract step numbers from message for progress
            print("Attempting to update progress from message...")
            try:
                match = re.search(r'Step (\d+)/(\d+):', message)
                if match:
                    current_step = int(match.group(1))
                    total_steps = int(match.group(2))
                    progress = (current_step / total_steps) * 100
                    cls._session_progress[session_id] = progress
            except Exception as e:
                print(f"Non-critical error updating progress: {str(e)}")
            print("Finished attempting progress update.")
            
            # Send update via WebSocket if callback registered
            print("Before checking for WebSocket callback (new step path)")
            ws_sent = False # Flag to track if WS send was attempted
            if session_id in cls._ws_send_callbacks:
                try:
                    # Only send the new step, not all steps
                    # This prevents duplicate data and reduces network traffic
                    message_data = {
                        "status": cls.get_status(session_id),
                        "thinking_steps": [step.to_dict()],  # Just send the latest step
                        "progress": cls.get_progress(session_id),
                        "logs": cls.get_logs(session_id),
                        "updated": False  # Flag to indicate this is a new step
                    }
                    
                    # Log the message type for debugging
                    callback_func = cls._ws_send_callbacks[session_id] # Get the callback
                    print(f"Callback function found: {callback_func!r}") # Log the callback
                    print(f"Attempting to send incremental update with latest step via WebSocket")
                    
                    # Send the message
                    # Add specific try/except around create_task
                    try:
                        task = asyncio.create_task(callback_func(json.dumps(message_data)))
                        print(f"WebSocket task created: {task!r}") # Log the created task object
                        ws_sent = True
                    except Exception as task_creation_error:
                        print(f"!!!!! EXCEPTION during asyncio.create_task for WebSocket: {task_creation_error}")
                        logger.error(f"!!!!! EXCEPTION during asyncio.create_task for WebSocket in session {session_id}: {task_creation_error}", exc_info=True)

                except Exception as e:
                    print(f"Error sending WebSocket update: {str(e)}")
            print(f"After checking for WebSocket callback (new step path). WS sent: {ws_sent}")
        print(f"--- EXITING add_thinking_step (added new step) for session {session_id} ---") # Exit log (new step path)

    @classmethod
    def add_communication(cls, session_id: str, direction: str, content: str) -> None:
        """添加一个通信记录

        Args:
            session_id: 会话ID
            direction: 通信方向，如 "发送到LLM"、"从LLM接收"
            content: 通信内容
        """
        message = f"{direction}通信"
        step = ThinkingStep(message, "communication", content)
        with cls._lock:
            if session_id in cls._session_steps:
                cls._session_steps[session_id].append(step)
                
                # Save step to database
                cls._storage.save_thinking_steps(session_id, [step.to_dict()])

                # Send update through WebSocket if callback is registered
                if session_id in cls._ws_send_callbacks:
                    try:
                        callback = cls._ws_send_callbacks[session_id]
                        # Only send the new communication step
                        asyncio.create_task(callback(json.dumps({
                            "status": cls.get_status(session_id),
                            "thinking_steps": [step.to_dict()],  # Just send the latest step
                            "progress": cls.get_progress(session_id),
                            "logs": cls.get_logs(session_id)
                        })))
                        print(f"Sending incremental update with communication step via WebSocket")
                    except Exception as e:
                        print(f"Error sending WebSocket update: {str(e)}")

    @classmethod
    def update_progress(
        cls, session_id: str, total_steps: int = None, current_step: str = None
    ):
        """更新任务进度信息"""
        with cls._lock:
            if session_id in cls._session_progress:
                progress = cls._session_progress[session_id]

                if total_steps is not None:
                    progress["total_steps"] = total_steps

                if current_step is not None:
                    progress["current_step"] = current_step

                # 重新计算百分比
                if progress["total_steps"] > 0:
                    progress["percentage"] = min(
                        int(
                            100 * progress["completed_steps"] / progress["total_steps"]
                        ),
                        99,  # 最多到99%，完成时才到100%
                    )

    @classmethod
    def add_conclusion(
        cls, session_id: str, message: str, details: Optional[str] = None
    ) -> None:
        """添加一个结论"""
        step = ThinkingStep(message, "conclusion", details)
        with cls._lock:
            if session_id in cls._session_steps:
                cls._session_steps[session_id].append(step)
                cls._session_status[session_id] = TaskStatus.COMPLETED

                # 更新进度为100%
                if session_id in cls._session_progress:
                    progress = cls._session_progress[session_id]
                    progress["percentage"] = 100
                    progress["current_step"] = "已完成"

                # Save conclusion to database
                cls._storage.save_thinking_steps(session_id, [step.to_dict()])
                cls._storage.save_session(
                    session_id=session_id,
                    session_data={
                        "status": TaskStatus.COMPLETED.value,
                        "thinking_steps": [],
                        "progress": cls.get_progress(session_id),
                        "logs": cls.get_logs(session_id),
                    }
                )

                # Send update through WebSocket if callback is registered
                if session_id in cls._ws_send_callbacks:
                    try:
                        callback = cls._ws_send_callbacks[session_id]
                        # Only send the conclusion step
                        asyncio.create_task(callback(json.dumps({
                            "status": cls.get_status(session_id),
                            "thinking_steps": [step.to_dict()],  # Just send the conclusion
                            "progress": cls.get_progress(session_id),
                            "logs": cls.get_logs(session_id)
                        })))
                        print(f"Sending incremental update with conclusion step via WebSocket")
                    except Exception as e:
                        print(f"Error sending WebSocket update: {str(e)}")

    @classmethod
    def add_error(cls, session_id: str, message: str) -> None:
        """添加一个错误信息"""
        step = ThinkingStep(message, "error")
        with cls._lock:
            if session_id in cls._session_steps:
                cls._session_steps[session_id].append(step)
                cls._session_status[session_id] = TaskStatus.ERROR

                # Save error to database
                cls._storage.save_thinking_steps(session_id, [step.to_dict()])
                cls._storage.save_session(
                    session_id=session_id,
                    session_data={
                        "status": TaskStatus.ERROR.value,
                        "thinking_steps": [],
                        "progress": cls.get_progress(session_id),
                        "logs": cls.get_logs(session_id),
                    }
                )

    @classmethod
    def mark_stopped(cls, session_id: str) -> None:
        """标记任务已停止"""
        with cls._lock:
            if session_id in cls._session_status:
                cls._session_status[session_id] = TaskStatus.STOPPED
                # Update status in database
                cls._storage.save_session(
                    session_id=session_id,
                    session_data={
                        "status": TaskStatus.STOPPED.value,
                        "thinking_steps": [],
                        "progress": cls.get_progress(session_id),
                        "logs": cls.get_logs(session_id),
                    }
                )

    @classmethod
    def get_thinking_steps(cls, session_id: str, start_index: int = 0) -> List[Dict]:
        """获取指定会话的思考步骤"""
        with cls._lock:
            if session_id not in cls._session_steps:
                # Try to load from database
                session_data = cls._storage.get_session_data(session_id)
                return session_data.get("thinking_steps", [])

            steps = cls._session_steps[session_id][start_index:]
            return [step.to_dict() for step in steps]

    @classmethod
    def get_progress(cls, session_id: str) -> Dict[str, Any]:
        """获取任务进度信息"""
        with cls._lock:
            if session_id not in cls._session_progress:
                return {
                    "current_step": "未开始",
                    "total_steps": 0,
                    "completed_steps": 0,
                    "percentage": 0,
                }
            return cls._session_progress[session_id].copy()

    @classmethod
    def get_status(cls, session_id: str) -> str:
        """获取任务状态"""
        with cls._lock:
            if session_id not in cls._session_status:
                return TaskStatus.PENDING.value
            return cls._session_status[session_id].value

    @classmethod
    def clear_session(cls, session_id: str) -> None:
        """清除指定会话的记录"""
        with cls._lock:
            if session_id in cls._session_steps:
                del cls._session_steps[session_id]
            if session_id in cls._session_status:
                del cls._session_status[session_id]
            if session_id in cls._session_progress:
                del cls._session_progress[session_id]
            if session_id in cls._session_logs:
                del cls._session_logs[session_id]

    @classmethod
    def add_log_entry(cls, session_id: str, entry: Dict) -> None:
        """添加一条日志条目"""
        with cls._lock:
            if session_id not in cls._session_logs:
                cls._session_logs[session_id] = []

            # Add timestamp if not present
            if "timestamp" not in entry:
                entry["timestamp"] = time.time()

            cls._session_logs[session_id].append(entry)

            # Save terminal output to database if it's a terminal output
            if "output" in entry:
                cls._storage.save_terminal_outputs(session_id, [entry])

    @classmethod
    def add_log_entries(cls, session_id: str, entries: List[Dict]) -> None:
        """批量添加日志条目"""
        for entry in entries:
            cls.add_log_entry(session_id, entry)

    @classmethod
    def get_logs(cls, session_id: str, start_index: int = 0) -> List[Dict]:
        """获取指定会话的日志条目"""
        with cls._lock:
            if session_id not in cls._session_logs:
                return []
            return cls._session_logs[session_id][start_index:]

    @classmethod
    def get_full_state(cls, session_id: str) -> Dict[str, Any]:
        """Get the complete current state for a session."""
        print(f"--- Getting full state for session {session_id} ---")
        with cls._lock:
            # Ensure steps are loaded if not already in memory (e.g., on reconnect)
            cls._load_steps_if_needed(session_id)
            
            state = {
                "status": cls.get_status(session_id),
                "thinking_steps": cls.get_thinking_steps(session_id), # Send all steps initially
                "progress": cls.get_progress(session_id),
                "logs": cls.get_logs(session_id),
            }
        print(f"--- Full state retrieved for session {session_id} ---")
        return state

    @classmethod
    def _load_steps_if_needed(cls, session_id: str) -> None:
        """Load thinking steps from storage if not already in memory."""
        # Check if steps are already loaded or if storage is not configured
        if session_id in cls._session_steps or not hasattr(cls, '_storage') or cls._storage is None:
            return

        print(f"--- Steps for session {session_id} not in memory. Attempting to load from storage. ---")
        try:
            loaded_steps_data = cls._storage.load_thinking_steps(session_id)
            if loaded_steps_data:
                # Convert loaded data back to ThinkingStep objects
                cls._session_steps[session_id] = [
                    ThinkingStep(step_data['message'], step_data['type'], step_data.get('details'), step_data['timestamp'])
                    for step_data in loaded_steps_data
                ]
                print(f"--- Successfully loaded {len(cls._session_steps[session_id])} steps for session {session_id} from storage. ---")
            else:
                print(f"--- No steps found in storage for session {session_id}. ---")
        except Exception as e:
            print(f"!!!!! EXCEPTION during _load_steps_if_needed for session {session_id}: {e}")
            # Optionally initialize empty list to prevent repeated load attempts
            cls._session_steps[session_id] = []


# 预定义的思考步骤模板
RESEARCH_STEPS = [
    "分析问题需求和上下文",
    "确定搜索关键词",
    "检索相关知识库和资料",
    "分析和整理检索到的信息",
    "评估可行的解决方案",
    "整合信息并构建解决框架",
    "生成最终回答",
]

CODING_STEPS = [
    "分析代码需求和功能规格",
    "设计代码结构和接口",
    "开发核心算法逻辑",
    "编写主要功能模块",
    "实现边界情况和错误处理",
    "进行代码测试和调试",
    "优化代码性能和可读性",
    "完成代码和文档",
]

WRITING_STEPS = [
    "收集写作主题的相关资料...",
    "构思内容大纲和关键点...",
    "撰写初稿内容...",
    "完善论述和事实核查...",
    "润色语言和格式...",
]

# 任务类型到预定义步骤的映射
TASK_TYPE_STEPS = {
    "research": RESEARCH_STEPS,
    "coding": CODING_STEPS,
    "writing": WRITING_STEPS,
}


def generate_thinking_steps(
    session_id: str,
    task_type: str = "research",
    task_description: str = "",
    show_communication: bool = True,
) -> None:
    """生成一系列思考步骤，用于模拟AI思考过程"""
    steps = TASK_TYPE_STEPS.get(task_type, RESEARCH_STEPS)

    # 如果有描述，添加更具体的步骤
    if task_description:
        specific_steps = [
            f"研究{task_description}的相关信息",
            f"分析{task_description}的关键点",
            f"整理{task_description}的解决方案",
        ]
        steps = specific_steps + steps

    ThinkingTracker.start_tracking(session_id)
    ThinkingTracker.update_progress(
        session_id, total_steps=len(steps) + 2
    )  # +2为开始和结束步骤

    # 添加初始步骤
    ThinkingTracker.add_thinking_step(
        session_id, f"开始处理任务: {task_description if task_description else '新请求'}"
    )

    # 模拟每隔一段时间添加一个思考步骤
    for step in steps:
        ThinkingTracker.add_thinking_step(session_id, step)

        # 模拟与LLM的通信
        if show_communication:
            # 模拟向LLM发送请求
            ThinkingTracker.add_communication(session_id, "发送到LLM", f"请帮我{step}...")

            # 模拟接收LLM回复
            ThinkingTracker.add_communication(
                session_id, "从LLM接收", f"我已完成{step}。这是相关结果: [详细信息]"
            )

    # 添加结论
    ThinkingTracker.add_conclusion(session_id, "任务处理完成！已生成结果。")
