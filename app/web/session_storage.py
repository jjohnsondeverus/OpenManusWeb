import sqlite3
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

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
    
    def save_session(self, session_id: str, session_data: Dict[str, Any]):
        """Save session metadata."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Extract data from session_data dict
        prompt = session_data.get("prompt")
        title = session_data.get("title", f"Session {session_id[:8]}")
        workspace = session_data.get("workspace")
        status = session_data.get("status", "completed")

        cursor.execute(
            "INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)",
            (
                session_id, 
                title,
                prompt,
                workspace,
                time.time(), # created_at
                status,
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
    
    def load_thinking_steps(self, session_id: str) -> List[Dict[str, Any]]:
        """Load all thinking steps for a given session ID from the database."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            with conn:
                cursor = conn.execute(
                    "SELECT message, type, details, timestamp FROM thinking_steps WHERE session_id = ? ORDER BY timestamp ASC",
                    (session_id,)
                )
                steps = cursor.fetchall()
                # Convert rows to dictionaries
                return [dict(step) for step in steps]
        except sqlite3.Error as e:
            logger.error(f"Database error loading thinking steps for session {session_id}: {e}")
            return []
        finally:
            conn.close() 