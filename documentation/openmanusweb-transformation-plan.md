# OpenManusWeb to Manus AI: Optimized Implementation Plan

## Overview

This document outlines the optimized approach for transforming the open-source OpenManusWeb project to match the commercial Manus AI's user experience. Based on a deep analysis of the existing codebase, we've developed a plan that extends current systems rather than building parallel ones, resulting in better integration and maintainability.

## Current vs. Target Architecture

| Panel | Current OpenManusWeb | Target Manus AI-Like |
|-------|----------------------|----------------------|
| Left Panel | AI thinking timeline, workspace files (clickable) | User interaction (dialogue), agent thoughts timeline |
| Right Panel | Dialogue history, input area | Real-time terminal output, progress tracking, session replay |

## Implementation Details

### 1. Terminal Output Capture Enhancement

#### A. Extend ThinkingTracker

```python
# Add to app/web/thinking_tracker.py

class ThinkingTracker:
    # Add new class variables
    _terminal_outputs: Dict[str, List[Dict]] = {}
    
    @classmethod
    def add_terminal_output(cls, session_id: str, output: str, 
                           thinking_step_id: Optional[str] = None, 
                           tool_name: Optional[str] = None) -> None:
        """Add terminal output for a session, optionally linked to a thinking step."""
        with cls._lock:
            if session_id not in cls._terminal_outputs:
                cls._terminal_outputs[session_id] = []
                
            # Create output entry with timestamp and metadata
            terminal_entry = {
                "output": output,
                "timestamp": time.time(),
                "thinking_step_id": thinking_step_id,
                "tool_name": tool_name
            }
            
            cls._terminal_outputs[session_id].append(terminal_entry)
            
            # Notify WebSocket clients if callback is registered
            cls._notify_ws_terminal_update(session_id, terminal_entry)
    
    @classmethod
    def _notify_ws_terminal_update(cls, session_id: str, terminal_entry: Dict) -> None:
        """Notify WebSocket clients about new terminal output."""
        with cls._lock:
            if session_id in cls._ws_send_callbacks:
                callback = cls._ws_send_callbacks[session_id]
                try:
                    # Use asyncio.create_task to ensure non-blocking
                    asyncio.create_task(
                        callback(
                            json.dumps({
                                "status": cls.get_status(session_id),
                                "terminal_output": [terminal_entry]
                            })
                        )
                    )
                except Exception as e:
                    print(f"WebSocket send callback failed: {str(e)}")
    
    @classmethod
    def get_terminal_output(cls, session_id: str, start_index: int = 0) -> List[Dict]:
        """Get terminal output for a session."""
        with cls._lock:
            if session_id not in cls._terminal_outputs:
                return []
                
            return cls._terminal_outputs[session_id][start_index:]
    
    @classmethod
    def get_terminal_output_for_step(cls, session_id: str, 
                                    thinking_step_id: str) -> List[Dict]:
        """Get terminal output associated with a specific thinking step."""
        with cls._lock:
            if session_id not in cls._terminal_outputs:
                return []
                
            return [
                entry for entry in cls._terminal_outputs[session_id]
                if entry.get("thinking_step_id") == thinking_step_id
            ]
    
    @classmethod
    def clear_session(cls, session_id: str) -> None:
        """Clear all session data (override existing method)"""
        with cls._lock:
            # Existing code...
            if session_id in cls._session_steps:
                del cls._session_steps[session_id]
            if session_id in cls._session_status:
                del cls._session_status[session_id]
            if session_id in cls._session_progress:
                del cls._session_progress[session_id]
            if session_id in cls._session_logs:
                del cls._session_logs[session_id]
                
            # Add terminal outputs cleanup
            if session_id in cls._terminal_outputs:
                del cls._terminal_outputs[session_id]
```

#### B. Modify ToolCallAgent for Terminal Capture

```python
# Modify app/agent/toolcall.py

class ToolCallAgent(ReActAgent):
    # Add session_id field
    session_id: str = ""
    current_thinking_step_id: Optional[str] = None

    async def execute_tool(self, command: ToolCall) -> str:
        """Execute a single tool call with robust error handling and terminal capture"""
        if not command or not command.function or not command.function.name:
            return "Error: Invalid command format"

        name = command.function.name
        if name not in self.available_tools.tool_map:
            return f"Error: Unknown tool '{name}'"

        try:
            # Parse arguments
            args = json.loads(command.function.arguments or "{}")
            
            # Format command for terminal display
            formatted_command = f"$ {name} {json.dumps(args, indent=2)}"
            
            # Capture command in terminal output
            if hasattr(ThinkingTracker, "add_terminal_output") and self.session_id:
                ThinkingTracker.add_terminal_output(
                    self.session_id,
                    formatted_command,
                    self.current_thinking_step_id,
                    name
                )

            # Execute the tool
            logger.info(f"🔧 Activating tool: '{name}'...")
            result = await self.available_tools.execute(name=name, tool_input=args)
            
            # Capture result in terminal output
            if hasattr(ThinkingTracker, "add_terminal_output") and self.session_id:
                ThinkingTracker.add_terminal_output(
                    self.session_id,
                    str(result),
                    self.current_thinking_step_id,
                    name
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
            
            # Capture error in terminal output
            if hasattr(ThinkingTracker, "add_terminal_output") and self.session_id:
                ThinkingTracker.add_terminal_output(
                    self.session_id,
                    error_msg,
                    self.current_thinking_step_id,
                    name
                )
                
            logger.error(error_msg)
            return f"Error: {error_msg}"
```

#### C. Modify the Process Prompt Function

```python
# Modify app/web/app.py - process_prompt function

async def process_prompt(session_id: str, prompt: str):
    # ... existing code ...
    
    try:
        # Initialize thinking tracker
        ThinkingTracker.start_tracking(session_id)
        
        # Initialize agent and set session_id
        agent = Manus()
        agent.session_id = session_id  # Pass session_id to the agent
        
        # Create thinking step and store ID for linking
        thinking_step = ThinkingTracker.add_thinking_step(
            session_id, 
            "Initializing agent",
            return_step=True  # Add this parameter to return the created step
        )
        
        if thinking_step:
            agent.current_thinking_step_id = getattr(thinking_step, "id", None)
        
        # Initialize flow
        flow = FlowFactory.create_flow(
            flow_type=FlowType.PLANNING,
            agents=agent,
        )
        
        # Execute flow
        result = await flow.execute(prompt, job_id, cancel_events.get(session_id))
        
        # ... rest of existing code ...
    
    # ... exception handling ...
```

### 2. WebSocket Enhancement for Terminal Output

```python
# Modify app/web/app.py - websocket_endpoint function

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    # ... existing code ...
    
    # Initial state with terminal output
    await websocket.send_text(
        json.dumps({
            "status": session["status"],
            "log": session["log"],
            "thinking_steps": ThinkingTracker.get_thinking_steps(session_id),
            "logs": ThinkingTracker.get_logs(session_id),
            "terminal_output": ThinkingTracker.get_terminal_output(session_id),  # Add terminal output
        })
    )
    
    # Track last sent index
    last_terminal_output_count = len(ThinkingTracker.get_terminal_output(session_id))
    
    # Monitor for updates
    while session["status"] == "processing":
        await asyncio.sleep(0.2)
        
        # ... existing code for other updates ...
        
        # Check for terminal output updates
        current_terminal_output_count = len(ThinkingTracker.get_terminal_output(session_id))
        if current_terminal_output_count > last_terminal_output_count:
            await websocket.send_text(
                json.dumps({
                    "status": session["status"],
                    "terminal_output": ThinkingTracker.get_terminal_output(
                        session_id, last_terminal_output_count
                    ),
                })
            )
            last_terminal_output_count = current_terminal_output_count
    
    # ... rest of existing code ...
```

### 3. Frontend Panel Swap and Terminal Integration

#### A. Modify HTML Structure

```html
<!-- Modify app/web/static/connected_interface.html -->

<!-- Before: Left panel = thinking, Right panel = chat -->
<div class="panel-container">
  <!-- Swap the order and content of the panels -->
  <div class="panel left-panel">
    <h2 data-i18n="conversation">Conversation</h2>
    
    <!-- Chat section -->
    <div id="chat-messages" class="chat-messages">
      <!-- Chat messages will be dynamically generated -->
    </div>
    
    <div class="input-area">
      <textarea id="user-input" placeholder="Ask Manus anything..." data-i18n="input_placeholder"></textarea>
      <div class="button-group">
        <button id="send-btn" class="btn-send" data-i18n="send">Send</button>
        <button id="stop-btn" class="btn-stop" disabled data-i18n="stop">Stop</button>
        <button id="clear-btn" class="btn-clear" data-i18n="clear">Clear</button>
      </div>
    </div>
    
    <!-- Thinking section -->
    <div class="thinking-section">
      <div class="section-header">
        <h3 data-i18n="ai_thinking_process">Agent Thoughts</h3>
        <div class="record-count" id="record-count" data-i18n="records_count">0 records</div>
      </div>
      
      <div class="controls">
        <label class="auto-scroll">
          <input type="checkbox" id="auto-scroll" checked>
          <span data-i18n="auto_scroll">Auto-scroll</span>
        </label>
        <button id="clear-thinking" class="btn-clear" data-i18n="clear">Clear</button>
      </div>
      
      <div id="thinking-timeline" class="thinking-timeline">
        <!-- Thinking steps will be dynamically generated -->
      </div>
    </div>
  </div>
  
  <div class="panel right-panel">
    <h2 data-i18n="terminal_output">Terminal Output</h2>
    
    <!-- Terminal section -->
    <div id="terminal-container" class="terminal-container">
      <!-- Terminal will be rendered here by xterm.js -->
    </div>
    
    <!-- Add session controls -->
    <div class="session-controls">
      <h3 data-i18n="session_playback">Session Playback</h3>
      <div class="progress-container">
        <div id="session-progress" class="progress-bar"></div>
      </div>
      <div class="button-group">
        <button id="play-btn" class="btn-play" data-i18n="play">Play</button>
        <button id="pause-btn" class="btn-pause" disabled data-i18n="pause">Pause</button>
        <button id="save-btn" class="btn-save" data-i18n="save_session">Save Session</button>
      </div>
    </div>
    
    <!-- Keep the file viewer -->
    <div id="file-viewer" class="file-viewer">
      <!-- File viewer content -->
    </div>
  </div>
</div>
```

#### B. Add Terminal Integration in JavaScript

```javascript
// Modify app/web/static/connected_interface.js

// Import xterm.js
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

// Add terminal to the App class
class App {
    constructor() {
        // ... existing code ...
        
        // Initialize terminal
        this.terminal = null;
        this.terminalOutputBuffer = [];
    }
    
    init() {
        // ... existing code ...
        
        // Initialize terminal
        this.initTerminal();
    }
    
    initTerminal() {
        // Create terminal instance
        this.terminal = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1a1a1a',
                foreground: '#f0f0f0'
            }
        });
        
        // Add fit addon
        const fitAddon = new FitAddon();
        this.terminal.loadAddon(fitAddon);
        
        // Open terminal in container
        this.terminal.open(document.getElementById('terminal-container'));
        fitAddon.fit();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            fitAddon.fit();
        });
        
        // Add welcome message
        this.terminal.writeln('Welcome to Manus AI Terminal');
        this.terminal.writeln('--------------------------------');
        this.terminal.writeln('Terminal ready. Waiting for commands...\n');
    }
    
    // Modify handleWebSocketMessage to process terminal output
    handleWebSocketMessage(data) {
        // ... existing code ...
        
        // Handle terminal output
        if (data.terminal_output && data.terminal_output.length > 0) {
            console.log('Received terminal output:', data.terminal_output);
            
            // Add to output buffer and display
            this.terminalOutputBuffer.push(...data.terminal_output);
            
            // Display each new output
            data.terminal_output.forEach(entry => {
                this.terminal.writeln(entry.output);
            });
        }
        
        // ... rest of existing code ...
    }
    
    // Add method to display terminal output for a specific thinking step
    displayTerminalForThinkingStep(stepId) {
        // Clear terminal
        this.terminal.clear();
        
        // Filter terminal output for this step
        const stepOutput = this.terminalOutputBuffer.filter(
            entry => entry.thinking_step_id === stepId
        );
        
        if (stepOutput.length === 0) {
            this.terminal.writeln('No terminal output available for this step.');
            return;
        }
        
        // Display all output for this step
        stepOutput.forEach(entry => {
            this.terminal.writeln(entry.output);
        });
    }
}
```

#### C. Modify ThinkingManager to Link Terminal Output

```javascript
// Modify app/web/static/connected_thinkingManager.js

class ThinkingManager {
    // ... existing code ...
    
    addThinkingSteps(steps) {
        // ... existing code ...
        
        steps.forEach(step => {
            const element = this.createThinkingStepElement(step);
            this.thinkingTimeline.appendChild(element);
            
            // Add click handler to show terminal output
            element.addEventListener('click', () => {
                // Highlight selected step
                this.highlightStep(step.id);
                
                // Display terminal output for this step
                window.app.displayTerminalForThinkingStep(step.id);
            });
        });
        
        // ... rest of existing code ...
    }
    
    highlightStep(stepId) {
        // Remove highlight from all steps
        const allSteps = this.thinkingTimeline.querySelectorAll('.timeline-item');
        allSteps.forEach(el => el.classList.remove('active'));
        
        // Add highlight to selected step
        const selectedStep = this.thinkingTimeline.querySelector(`[data-step-id="${stepId}"]`);
        if (selectedStep) {
            selectedStep.classList.add('active');
            selectedStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    createThinkingStepElement(step) {
        // ... existing code ...
        
        // Add step ID to the element
        element.setAttribute('data-step-id', step.id);
        
        // ... rest of existing code ...
        
        return element;
    }
}
```

### 4. Session Storage and Replay

#### A. Add a Simple SQLite Database for Session Storage

```python
# New file: app/web/session_storage.py

import sqlite3
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

class SessionStorage:
    """Manages session storage and replay functionality."""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize with optional db path."""
        if db_path:
            self.db_path = Path(db_path)
        else:
            self.db_path = Path(__file__).parent.parent.parent / "data" / "sessions.db"
            
        # Create parent directory if it doesn't exist
        self.db_path.parent.mkdir(exist_ok=True)
        
        # Initialize database
        self._init_db()
    
    def _init_db(self):
        """Initialize the database with required tables."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Create sessions table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            prompt TEXT,
            workspace TEXT,
            created_at REAL,
            status TEXT
        )
        ''')
        
        # Create thinking steps table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS thinking_steps (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            message TEXT,
            type TEXT,
            timestamp REAL,
            details TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions (id)
        )
        ''')
        
        # Create terminal output table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS terminal_outputs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            thinking_step_id TEXT,
            output TEXT,
            tool_name TEXT,
            timestamp REAL,
            FOREIGN KEY (session_id) REFERENCES sessions (id),
            FOREIGN KEY (thinking_step_id) REFERENCES thinking_steps (id)
        )
        ''')
        
        conn.commit()
        conn.close()
    
    def save_session(self, session_id: str, prompt: str, title: Optional[str] = None, 
                    workspace: Optional[str] = None, status: str = "completed"):
        """Save session metadata."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)",
            (
                session_id, 
                title or f"Session {session_id[:8]}", 
                prompt,
                workspace,
                time.time(),
                status
            )
        )
        
        conn.commit()
        conn.close()
    
    def save_thinking_steps(self, session_id: str, steps: List[Dict[str, Any]]):
        """Save thinking steps for a session."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        for step in steps:
            cursor.execute(
                "INSERT OR REPLACE INTO thinking_steps VALUES (?, ?, ?, ?, ?, ?)",
                (
                    step.get("id", f"step_{int(time.time())}_{id(step)}"),
                    session_id,
                    step.get("message", ""),
                    step.get("type", "thinking"),
                    step.get("timestamp", time.time()),
                    json.dumps(step.get("details", {}))
                )
            )
        
        conn.commit()
        conn.close()
    
    def save_terminal_outputs(self, session_id: str, outputs: List[Dict[str, Any]]):
        """Save terminal outputs for a session."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        for output in outputs:
            cursor.execute(
                "INSERT INTO terminal_outputs (session_id, thinking_step_id, output, tool_name, timestamp) VALUES (?, ?, ?, ?, ?)",
                (
                    session_id,
                    output.get("thinking_step_id"),
                    output.get("output", ""),
                    output.get("tool_name", ""),
                    output.get("timestamp", time.time())
                )
            )
        
        conn.commit()
        conn.close()
    
    def get_sessions(self, limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        """Get list of sessions ordered by creation time."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        )
        
        sessions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return sessions
    
    def get_session_data(self, session_id: str) -> Dict[str, Any]:
        """Get complete session data including steps and terminal output."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get session metadata
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        session = dict(cursor.fetchone() or {})
        
        if not session:
            conn.close()
            return {"error": "Session not found"}
        
        # Get thinking steps
        cursor.execute(
            "SELECT * FROM thinking_steps WHERE session_id = ? ORDER BY timestamp",
            (session_id,)
        )
        thinking_steps = [dict(row) for row in cursor.fetchall()]
        
        # Get terminal outputs
        cursor.execute(
            "SELECT * FROM terminal_outputs WHERE session_id = ? ORDER BY timestamp",
            (session_id,)
        )
        terminal_outputs = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        # Add steps and outputs to session data
        session["thinking_steps"] = thinking_steps
        session["terminal_outputs"] = terminal_outputs
        
        return session
```

#### B. Add Session Saving to Process Prompt

```python
# Modify app/web/app.py - process_prompt function

async def process_prompt(session_id: str, prompt: str):
    # ... existing code ...
    
    try:
        # ... existing code ...
        
        # Execute flow
        result = await flow.execute(prompt, job_id, cancel_events.get(session_id))
        
        # Update session with results
        active_sessions[session_id]["status"] = "completed"
        active_sessions[session_id]["result"] = result
        
        # Save session data for replay
        try:
            from app.web.session_storage import SessionStorage
            
            storage = SessionStorage()
            
            # Save session metadata
            storage.save_session(
                session_id=session_id,
                prompt=prompt,
                title=f"Session {time.strftime('%Y-%m-%d %H:%M:%S')}",
                workspace=active_sessions[session_id].get("workspace"),
                status="completed"
            )
            
            # Save thinking steps
            storage.save_thinking_steps(
                session_id=session_id,
                steps=ThinkingTracker.get_thinking_steps(session_id)
            )
            
            # Save terminal output
            storage.save_terminal_outputs(
                session_id=session_id,
                outputs=ThinkingTracker.get_terminal_output(session_id)
            )
            
            logger.info(f"Session {session_id} saved for replay")
        except Exception as e:
            logger.error(f"Error saving session for replay: {str(e)}")
        
    # ... exception handling ...
```

#### C. Add API Endpoints for Session Replay

```python
# Add to app/web/app.py

@app.get("/api/sessions")
async def get_sessions(limit: int = 10, offset: int = 0):
    """Get list of saved sessions."""
    try:
        from app.web.session_storage import SessionStorage
        
        storage = SessionStorage()
        sessions = storage.get_sessions(limit=limit, offset=offset)
        
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving sessions: {str(e)}")

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get complete session data for replay."""
    try:
        from app.web.session_storage import SessionStorage
        
        storage = SessionStorage()
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
        from app.web.session_storage import SessionStorage
        
        storage = SessionStorage()
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

async def replay_session(replay_session_id: str, session_data: Dict[str, Any]):
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
                    ThinkingTracker.add_terminal_output(
                        replay_session_id,
                        output.get("output", ""),
                        step_id,
                        output.get("tool_name", "")
                    )
            
            # Slow down replay for visibility
            await asyncio.sleep(0.5)
        
        # Update session status
        active_sessions[replay_session_id]["status"] = "completed"
        active_sessions[replay_session_id]["result"] = session_data.get("prompt", "Session replay completed")
        
    except Exception as e:
        logger.error(f"Error in session replay: {str(e)}")
        active_sessions[replay_session_id]["status"] = "error"
        active_sessions[replay_session_id]["result"] = f"Replay error: {str(e)}"
```

### 5. Frontend Session Replay Controls

```javascript
// Add to app/web/static/connected_interface.js

// Extend App class with session replay
class App {
    // ... existing code ...
    
    constructor() {
        // ... existing code ...
        
        // Session management
        this.sessions = [];
        this.currentReplaySessionId = null;
        this.isReplaying = false;
    }
    
    init() {
        // ... existing code ...
        
        // Load available sessions
        this.loadSessions();
        
        // Add session replay UI elements
        this.initSessionControls();
    }
    
    initSessionControls() {
        // Add session selector dropdown to UI
        const sessionControls = document.querySelector('.session-controls');
        
        const sessionSelector = document.createElement('select');
        sessionSelector.id = 'session-selector';
        sessionSelector.classList.add('session-selector');
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a session to replay';
        sessionSelector.appendChild(defaultOption);
        
        // Add event listener
        sessionSelector.addEventListener('change', (e) => {
            const sessionId = e.target.value;
            if (sessionId) {
                this.prepareSessionReplay(sessionId);
            }
        });
        
        // Add to UI
        sessionControls.insertBefore(sessionSelector, sessionControls.firstChild);
        
        // Play/pause button event listeners
        document.getElementById('play-btn').addEventListener('click', () => {
            if (this.currentReplaySessionId) {
                this.startSessionReplay(this.currentReplaySessionId);
            }
        });
        
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.pauseSessionReplay();
        });
        
        document.getElementById('save-btn').addEventListener('click', () => {
            if (this.sessionId) {
                this.saveCurrentSession();
            } else {
                console.log('No active session to save');
            }
        });
    }
    
    async loadSessions() {
        try {
            const response = await fetch('/api/sessions');
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            this.sessions = data.sessions || [];
            
            // Update session selector
            this.updateSessionSelector();
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    }
    
    updateSessionSelector() {
        const selector = document.getElementById('session-selector');
        if (!selector) return;
        
        // Clear existing options except default
        while (selector.options.length > 1) {
            selector.remove(1);
        }
        
        // Add sessions as options
        this.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = session.title || `Session ${session.id.slice(0, 8)}`;
            selector.appendChild(option);
        });
    }
    
    async prepareSessionReplay(sessionId) {
        try {
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const sessionData = await response.json();
            
            // Store session ID for replay
            this.currentReplaySessionId = sessionId;
            
            // Enable play button
            document.getElementById('play-btn').disabled = false;
            
            // Show session info
            console.log('Session ready for replay:', sessionData);
            
            // Clear current display
            this.chatManager.clearMessages();
            this.thinkingManager.clearThinking();
            this.terminal.clear();
            
            // Show the original prompt
            this.chatManager.addUserMessage(sessionData.prompt || 'Session replay');
            
            // Update UI to show ready for replay
            document.getElementById('status-indicator').textContent = 'Ready to replay session';
        } catch (error) {
            console.error('Error preparing session replay:', error);
        }
    }
    
    async startSessionReplay(sessionId) {
        if (this.isReplaying) {
            console.log('Replay already in progress');
            return;
        }
        
        try {
            const response = await fetch(`/api/sessions/${sessionId}/replay`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            const replaySessionId = data.replay_session_id;
            
            // Connect to WebSocket for replay updates
            this.isReplaying = true;
            document.getElementById('play-btn').disabled = true;
            document.getElementById('pause-btn').disabled = false;
            document.getElementById('status-indicator').textContent = 'Replaying session...';
            
            // Connect to WebSocket
            this.websocketManager.connect(replaySessionId);
        } catch (error) {
            console.error('Error starting session replay:', error);
            this.isReplaying = false;
        }
    }
    
    pauseSessionReplay() {
        // Close WebSocket connection to pause replay
        if (this.isReplaying) {
            this.websocketManager.disconnect();
            this.isReplaying = false;
            document.getElementById('play-btn').disabled = false;
            document.getElementById('pause-btn').disabled = true;
            document.getElementById('status-indicator').textContent = 'Replay paused';
        }
    }
    
    async saveCurrentSession() {
        if (!this.sessionId) {
            console.log('No active session to save');
            return;
        }
        
        try {
            // Session is already saved automatically, just notify user
            document.getElementById('status-indicator').textContent = 'Session saved';
            
            // Refresh sessions list
            await this.loadSessions();
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }
}
```

### 6. CSS Styling for Terminal

```css
/* Add to app/web/static/styles.css */

:root {
    --terminal-bg: #1A1A1A;
    --terminal-text: #F0F0F0;
    --terminal-border: #333333;
    --terminal-cursor: #FFFFFF;
    --active-step-bg: rgba(59, 130, 246, 0.1);
    --active-step-border: #3B82F6;
}

.terminal-container {
    width: 100%;
    height: 400px;
    background-color: var(--terminal-bg);
    border: 1px solid var(--terminal-border);
    border-radius: 4px;
    padding: 0;
    overflow: hidden;
    margin-bottom: 20px;
}

.session-controls {
    margin-top: 20px;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
}

.session-selector {
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: white;
}

.progress-container {
    width: 100%;
    height: 8px;
    background-color: #E0E0E0;
    border-radius: 4px;
    margin: 10px 0;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background-color: var(--primary-color);
    width: 0%;
    transition: width 0.3s ease;
}

.timeline-item.active {
    background-color: var(--active-step-bg);
    border-left: 3px solid var(--active-step-border);
}

.thinking-timeline {
    max-height: 250px;
}
```

### 7. Additional Dependencies

#### Package.json for Frontend Dependencies

```json
{
  "name": "openmanusweb",
  "version": "1.0.0",
  "description": "OpenManus Web Interface",
  "main": "index.js",
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch"
  },
  "dependencies": {
    "xterm": "^5.1.0",
    "xterm-addon-fit": "^0.7.0"
  },
  "devDependencies": {
    "webpack": "^5.80.0",
    "webpack-cli": "^5.0.2"
  }
}
```

#### Updated requirements.txt

```
# Add to requirements.txt
docker~=6.1.3  # Docker SDK for Python
```

## Implementation Plan

Our optimized approach can be implemented in the following phases:

### Phase 1: Basic Infrastructure (1 week)
1. Extend ThinkingTracker for terminal output
2. Modify WebSocket for terminal streaming
3. Basic HTML/CSS panel swap

### Phase 2: Terminal Integration (1 week)
1. Add xterm.js integration
2. Modify ToolCallAgent for output capture
3. Implement timeline-terminal linkage

### Phase 3: Session Replay (1 week)
1. Implement SessionStorage
2. Add session replay API endpoints
3. Add frontend replay controls

### Phase 4: Polish and Testing (1 week)
1. UI refinements
2. Performance optimizations
3. Comprehensive testing

## Advantages of This Approach

1. **Extends Existing Systems**: By extending the ThinkingTracker and WebSocket systems rather than building parallel ones, we maintain better code cohesion.

2. **Leverages Robust Infrastructure**: The existing session and workspace management provides a strong foundation.

3. **Incremental Implementation**: Each component can be implemented and tested independently.

4. **Efficient Code Reuse**: Minimizes duplication and keeps the codebase maintainable.

5. **Natural Integration**: The terminal output is naturally tied to thinking steps, creating an intuitive user experience.

## Next Steps

1. Create development branches for each phase
2. Implement and test each phase incrementally
3. Gather feedback and refine the implementation
4. Prepare documentation for the new features

## Conclusion

This optimized approach transforms the OpenManusWeb interface to match the commercial Manus AI experience by extending existing systems rather than building parallel ones. The result will be a more maintainable, integrated, and efficient solution that provides all the target functionality while minimizing technical debt.
