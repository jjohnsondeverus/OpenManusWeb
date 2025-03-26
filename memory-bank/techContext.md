# Technical Context for OpenManusWeb

## 1. Backend Technologies

- **Core Language**: Python 3.12
- **Web Framework**: FastAPI
- **Real-time Communication**: WebSockets (via FastAPI)
- **Concurrency**: Asyncio
- **Database**: SQLite (for session storage)
- **LLM Interaction**: OpenAI API

## 2. Frontend Technologies

- **Core Languages**: HTML, CSS, JavaScript (Vanilla - no frameworks)
- **Terminal Emulation**:
    - `xterm.js` (v5.1.0)
    - `xterm-addon-fit` (v0.7.0)

## 3. Development Environment & Setup

- The project brief does not specify detailed setup instructions beyond the technologies used. Assumed standard Python environment setup (`requirements.txt` likely exists).
- No specific build system or module bundler is currently in use for the frontend.

## 4. Dependencies

- Key Python dependencies include FastAPI, Uvicorn (implied for FastAPI), websockets, OpenAI client library, and potentially an SQLite library.
- Frontend dependencies include `xterm.js` and its addons.

## 5. Technical Constraints & Considerations

- Relies on vanilla JavaScript, limiting access to framework-specific features and potentially impacting code structure.
- SQLite usage limits scalability for concurrent users.
- Requires careful management of asynchronous operations due to `asyncio`.
- Needs robust handling for external dependencies like the OpenAI API (e.g., rate limits).
