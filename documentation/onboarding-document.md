# OpenManusWeb to Manus AI: Engineer Onboarding Guide

## Project Overview

We're enhancing the open-source OpenManusWeb project to match the commercial Manus AI's user experience and capabilities, focusing specifically on creating a more professional, two-pane interface with real-time terminal output and session replay functionality.

### Current vs. Target Interface
| Panel | Current OpenManusWeb | Target Manus AI-Like |
|-------|----------------------|----------------------|
| Left Panel | AI thinking timeline, workspace files (clickable) | User interaction (dialogue), agent thoughts timeline |
| Right Panel | Dialogue history, input area | Real-time terminal output, progress tracking, session replay |

## Project Location
- Local Repository: `/Users/aimluser/OpenManusWeb`

## System Architecture

### Current Architecture
OpenManusWeb is a web interface for the OpenManus AI assistant project with:

1. **Backend**:
   - **FastAPI** application handling HTTP and WebSocket requests
   - **ThinkingTracker**: Tracks AI's thinking steps and progress
   - **LogHandler/LogParser**: Manages and parses system logs
   - **Manus Agent**: Core AI agent with tool-calling capabilities
   - **PlanningFlow**: Execution flow managing task planning and execution

2. **Frontend**:
   - HTML/CSS interface with dual-panel layout
   - WebSocket communication with backend
   - ThinkingManager displaying AI thinking steps
   - ChatManager handling chat interface
   - WorkspaceManager displaying generated files

### Target Architecture
We're transforming the interface to match Manus AI's experience:

1. **Frontend**:
   - Swapped panel layout (left: user chat + agent thoughts; right: terminal output)
   - xterm.js for terminal emulation in the right panel
   - Click-to-explore timeline for agent thoughts
   - Session replay controls

2. **Backend**:
   - Docker-based containerization for task execution
   - Enhanced WebSocket streams for terminal output
   - Database storage for session replay
   - Extended tool execution capture

## Key Files and Components

### Frontend Files
- `app/web/static/connected_interface.html` - Main HTML structure
- `app/web/static/connected_interface.js` - Main JavaScript controlling UI behavior
- `app/web/static/connected_websocketManager.js` - WebSocket communication
- `app/web/static/connected_chatManager.js` - Chat interface management
- `app/web/static/connected_thinkingManager.js` - Thinking timeline management
- `app/web/static/connected_workspaceManager.js` - Workspace files management
- `app/web/static/connected_fileViewerManager.js` - File viewer component

### Backend Files
- `app/web/app.py` - FastAPI application and endpoints
- `app/web/thinking_tracker.py` - Tracks AI thinking processes
- `app/web/log_handler.py` - Handles log management
- `app/web/log_parser.py` - Parses log information
- `app/agent/manus.py` - Main Manus agent implementation
- `app/agent/toolcall.py` - Tool calling agent functionality
- `app/flow/planning.py` - Planning flow implementation
- `web_run.py` - Web server entry point

## Implementation Plan

### Phase 1: Panel Layout Adjustment (2 weeks)
1. **Swap panels** to match Manus AI layout:
   - Left panel: User interaction + agent thoughts timeline
   - Right panel: Terminal output + progress tracking
2. **Fix localization** by auditing i18n implementation

### Phase 2: Terminal Integration (concurrent with Phase 1)
1. **Integrate xterm.js** for terminal rendering
2. **Setup Docker SDK** for containerized task execution:
   ```python
   import docker
   client = docker.from_env()
   container = client.containers.run("ubuntu", "echo 'Task started'", detach=True)
   # Stream logs via WebSocket to xterm.js
   ```
3. **Add new API endpoints**:
   - `/api/execute` for triggering tasks
   - `/ws/terminal/{container_id}` WebSocket for streaming logs

### Phase 3: Session Replay Functionality (1 week)
1. **Database implementation** for session storage (SQLite/PostgreSQL)
2. **API endpoints** for session listing and retrieval
3. **UI controls** for session replay

### Phase 4: UI/UX Polish (1 week)
1. **Apply Tailwind CSS** for consistent styling
2. **Add progress indicators** and loading states
3. **Performance optimization** for WebSocket handling

## Technologies and Dependencies

### Current Dependencies
```
pydantic~=2.10.4
openai~=1.58.1
tenacity~=9.0.0
pyyaml~=6.0.2
loguru~=0.7.3
numpy
datasets~=3.2.0
html2text~=2024.2.26
gymnasium~=1.0.0
pillow~=10.4.0
browsergym~=0.13.3
uvicorn[standard]>=0.24.0
unidiff~=0.7.5
browser-use~=0.1.40
googlesearch-python~=1.3.0
aiofiles>=22.1.0
pydantic_core~=2.27.2
colorama~=0.4.6
playwright~=1.49.1
fastapi>=0.95.0
jinja2>=3.1.2
websockets>=10.4
python-multipart>=0.0.6
watchdog>=2.1.6
```

### Additional Technologies To Add
- **xterm.js**: Terminal emulation in the browser
- **Docker SDK for Python**: Containerized execution
- **Tailwind CSS**: Modern styling framework
- **Alpine.js**: Lightweight JS framework for interactivity
- **SQLite/PostgreSQL**: Session storage

## Development Setup

### Environment Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/YunQiAI/OpenManusWeb.git
   cd OpenManusWeb
   ```

2. Setup virtual environment (using uv, recommended):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   uv venv
   source .venv/bin/activate  # On Unix/macOS
   # .venv\Scripts\activate    # On Windows
   uv pip install -r requirements.txt
   ```

3. Install additional dependencies:
   ```bash
   uv pip install docker xterm tailwindcss alpinejs sqlalchemy
   ```

4. Configure API keys in `config/config.toml` (copy from example):
   ```bash
   cp config/config.example.toml config/config.toml
   # Edit config/config.toml to add your API keys
   ```

### Running the Application
1. Start the web server:
   ```bash
   python web_run.py
   ```
   Or
   ```bash
   uvicorn app.web.app:app --reload
   ```

2. Open your browser and navigate to `http://localhost:8000`

## Implementation Specifics

### Panel Swap Implementation
The HTML structure change required:

```html
<!-- Before: Left panel = thinking, Right panel = chat -->
<div class="panel-container">
  <div class="panel left-panel">
    <!-- AI thinking, workspace files -->
  </div>
  <div class="panel right-panel">
    <!-- Chat dialog, input -->
  </div>
</div>

<!-- After: Left panel = chat+thoughts, Right panel = terminal -->
<div class="panel-container">
  <div class="panel left-panel">
    <div class="chat-section">
      <!-- Chat dialog, input -->
    </div>
    <div class="thinking-section">
      <!-- AI thinking timeline -->
    </div>
  </div>
  <div class="panel right-panel">
    <div class="terminal-section">
      <!-- Terminal emulation -->
    </div>
  </div>
</div>
```

### Terminal Integration
We'll use xterm.js for terminal emulation:

```javascript
// Terminal initialization
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const term = new Terminal({
  cursorBlink: true,
  theme: {
    background: '#1a1a1a',
    foreground: '#f0f0f0'
  }
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

// Connect to WebSocket for terminal output
const terminalSocket = new WebSocket(`ws://${window.location.host}/ws/terminal/${sessionId}`);
terminalSocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  term.write(data.output);
};
```

### Docker Integration
Docker SDK integration for containerized task execution:

```python
import docker
import asyncio
from fastapi import WebSocket

async def run_in_container(cmd: str, websocket: WebSocket):
    """Run a command in a Docker container and stream output to WebSocket."""
    client = docker.from_env()
    container = client.containers.run(
        "ubuntu:latest",
        cmd,
        detach=True,
        remove=True,
        volumes={'/tmp': {'bind': '/workspace', 'mode': 'rw'}}
    )
    
    # Stream logs to WebSocket
    while container.status != 'exited':
        try:
            for line in container.logs(stream=True, follow=True):
                await websocket.send_json({"output": line.decode('utf-8')})
            await asyncio.sleep(0.1)
            container.reload()
        except Exception as e:
            await websocket.send_json({"error": str(e)})
            break
```

### Session Replay Database Schema
SQLite schema for session storage:

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    timestamp REAL,
    prompt TEXT
);

CREATE TABLE steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    index INTEGER,
    thinking_step_id TEXT,
    terminal_output TEXT,
    timestamp REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

## Next Steps to Implement

1. **Panel Swap**: Rearrange HTML/CSS for new layout
2. **Terminal Integration**: Add xterm.js and WebSocket streaming
3. **Tool Output Capture**: Modify agent to capture detailed output
4. **Session Database**: Implement storage for replay functionality

## Key Resources

- [Commercial Manus AI Interface](https://manus.im/share/brWKUSp51ItvVMBpcXNCZ1?replay=1) - Reference for target interface
- [OpenManusWeb Repository](https://github.com/YunQiAI/OpenManusWeb) - Current codebase
- [FastAPI Documentation](https://fastapi.tiangolo.com/) - Backend framework
- [xterm.js Documentation](https://xtermjs.org/) - Terminal emulation
- [Docker SDK for Python](https://docker-py.readthedocs.io/) - Container management

## Potential Challenges

1. **WebSocket Performance**: With terminal streaming, ensure proper rate limiting and reconnection logic
2. **Container Security**: Apply proper isolation and resource limits to Docker containers
3. **UI Responsiveness**: Ensure the interface remains responsive with heavy terminal output
4. **Session Storage Size**: Consider pagination and efficient storage for large sessions

## Contact for Questions

If you have questions or need clarification about this project, please reach out to the project lead.

---

## Appendix: Technical Deep Dive

### Understanding the WebSocket Implementation

The current WebSocket implementation in `app/web/app.py` handles multiple message types:

```python
await websocket.send_text(
    json.dumps({
        "status": session["status"],
        "log": session["log"][last_log_count:],
        "thinking_steps": ThinkingTracker.get_thinking_steps(
            session_id, last_thinking_step_count
        ),
        "system_logs": last_log_entries,
        "logs": ThinkingTracker.get_logs(
            session_id, last_tracker_log_count
        ),
    })
)
```

We'll need to extend this to include terminal output:

```python
await websocket.send_text(
    json.dumps({
        "status": session["status"],
        "log": session["log"][last_log_count:],
        "thinking_steps": ThinkingTracker.get_thinking_steps(
            session_id, last_thinking_step_count
        ),
        "system_logs": last_log_entries,
        "logs": ThinkingTracker.get_logs(
            session_id, last_tracker_log_count
        ),
        "terminal_output": TerminalOutputCapture.get_output(
            session_id, last_terminal_output_count
        ),
    })
)
```

### ThinkingTracker Extension for Timeline Interactivity

The current `ThinkingTracker` class needs to be extended to support clickable timeline entries:

```python
@classmethod
def get_thinking_step_detail(cls, session_id: str, step_id: str) -> Dict:
    """Get detailed information about a specific thinking step."""
    with cls._lock:
        if session_id not in cls._session_steps:
            return {"error": "Session not found"}
            
        for step in cls._session_steps[session_id]:
            if getattr(step, "id", None) == step_id:
                # Find associated terminal output at this timestamp
                terminal_output = TerminalOutputCapture.get_output_at_time(
                    session_id, step.timestamp
                )
                
                return {
                    "message": step.message,
                    "type": step.step_type,
                    "details": step.details,
                    "timestamp": step.timestamp,
                    "terminal_output": terminal_output,
                }
                
        return {"error": "Step not found"}
```

### Tool Execution with Output Capture

Modifying `app/agent/toolcall.py` to capture detailed output:

```python
async def execute_tool(self, command: ToolCall) -> str:
    """Execute a single tool call with robust error handling"""
    if not command or not command.function or not command.function.name:
        return "Error: Invalid command format"

    name = command.function.name
    if name not in self.available_tools.tool_map:
        return f"Error: Unknown tool '{name}'"

    try:
        # Parse arguments
        args = json.loads(command.function.arguments or "{}")

        # Record command execution start
        TerminalOutputCapture.add_output(
            self.session_id, 
            f"$ {name} {json.dumps(args, indent=2)}"
        )

        # Execute the tool
        logger.info(f"🔧 Activating tool: '{name}'...")
        result = await self.available_tools.execute(name=name, tool_input=args)

        # Capture the result
        TerminalOutputCapture.add_output(
            self.session_id,
            str(result)
        )

        # Format result for display
        observation = (
            f"Observed output of cmd `{name}` executed:\n{str(result)}"
            if result
            else f"Cmd `{name}` completed with no output"
        )

        # Handle special tools like `finish`
        await self._handle_special_tool(name=name, result=result)

        return observation
    except Exception as e:
        error_msg = f"⚠️ Tool '{name}' encountered a problem: {str(e)}"
        TerminalOutputCapture.add_output(
            self.session_id,
            error_msg
        )
        logger.error(error_msg)
        return f"Error: {error_msg}"
```
