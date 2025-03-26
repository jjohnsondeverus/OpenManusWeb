# System Patterns for OpenManusWeb

## 1. System Architecture

OpenManusWeb employs a client-server architecture:
- **Backend**: A Python-based server built with FastAPI handles API requests, WebSocket communication, and agent execution logic.
- **Frontend**: A vanilla HTML/CSS/JavaScript client provides the user interface, interacting with the backend via WebSockets.

## 2. Key Backend Components

- **`app.py`**: The main FastAPI application entry point, defining routes and WebSocket handlers.
- **`thinking_tracker.py`**: A core component responsible for capturing, managing, and transmitting AI thinking steps. Uses a step ID system for deduplication and updates.
- **`session_storage.py`**: Manages session persistence, currently using SQLite.
- **`log_handler.py`**: Handles application logging.
- **Agent System (`app/agent/`)**: Contains base agent classes and specific implementations (e.g., `manus.py`, `toolcall.py`).
- **Flow Controllers (`app/flow/`)**: Manages the execution flow of agents (e.g., `planning.py`).

## 3. Key Frontend Components (`app/web/static/`)

- **`connected_interface.js`**: Coordinates the overall frontend interface logic.
- **`connected_websocketManager.js`**: Manages the WebSocket connection and message handling.
- **`connected_thinkingManager.js`**: Renders the AI thinking timeline based on WebSocket updates.
- **`connected_chatManager.js`**: Handles the chat interface logic.
- **`connected_fileViewerManager.js`**: Manages the display of files.
- **`xterm.js`**: Used for terminal emulation in the right panel.

## 4. Communication Flow

- User interaction (e.g., sending a chat message) triggers a WebSocket message to the backend.
- The backend processes the request, potentially invoking an AI agent.
- The agent executes, using tools and generating thinking steps.
- `ThinkingTracker` captures these steps.
- Incremental updates (new steps or updates to existing steps) are sent to the frontend via WebSocket.
- The frontend (`connected_websocketManager.js`) receives updates and delegates rendering to relevant managers (e.g., `connected_thinkingManager.js`, terminal display).

## 5. Critical Design Decisions

- **Step Deduplication**: Uses step IDs to avoid duplicate entries in the timeline and allow for updates to existing steps. Adds complexity but improves timeline accuracy.
- **Incremental WebSocket Updates**: Sends only changes rather than the full state to reduce network traffic and improve performance. Requires more complex state management.
- **SQLite for Session Storage**: Chosen for simplicity and zero external dependencies, sacrificing scalability.
- **Vanilla JavaScript Frontend**: Selected to reduce initial complexity and dependencies, potentially leading to less structured code compared to using a framework.
- **Two-Pane Layout**: Adopted from the commercial Manus AI product for clear separation of concerns (chat/thinking vs. execution output).
