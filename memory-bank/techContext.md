---
description: Technologies used, development setup, technical constraints, dependencies
globs: memory-bank/techContext.md
alwaysApply: true
---
# Tech Context: OpenManus Web - AI Agent Platform

**Technologies Used:**

*   **Backend Framework:** FastAPI (Python) - for building the REST API and WebSocket server.
*   **Frontend:** HTML, CSS, JavaScript - for the web user interface.
*   **LLM Provider:** Anthropic (Claude models) - for language model capabilities.
*   **Python Libraries:**
    *   `uvicorn` - ASGI server for running the FastAPI application.
    *   `openai` (initially), `anthropic` (currently) - Python SDKs for interacting with LLM APIs.
    *   `pydantic` - for data validation and settings management.
    *   `Jinja2` - for HTML templating (though currently minimal usage).
    *   `loguru` - for logging.
    *   `asyncio` - for asynchronous programming.
    *   `sqlite3` - for session data storage.
    *   `python-dotenv` - for environment variable management (if used).
    *   `matplotlib` (optional) - for potential visualization tools.
    *   `fpdf` (optional) - for PDF report generation.
    *   `browser-use` - for browser automation (if needed for web browsing tools).
*   **Database:** SQLite - for simple session persistence.
*   **Configuration:** TOML (`config.toml`) - for application configuration.
*   **Version Control:** Git

**Development Setup:**

*   **Python Version:** 3.12+ recommended.
*   **Virtual Environment:**  Use `venv` or `conda` to create a virtual environment for project dependencies.
*   **Dependency Management:** `pip` to install Python packages from `requirements.txt` or `pyproject.toml` (if used).
*   **Running the Application:**  Run `web_run.py` to start the FastAPI server.
*   **Frontend Access:** Access the web interface at `http://localhost:8000` (default port).
*   **Environment Variables:** API keys for LLM providers are typically configured via environment variables or in `config.toml`.

**Technical Constraints and Considerations:**

*   **LLM Rate Limits:**  Rate limits from LLM providers (Anthropic, OpenAI, etc.) are a significant constraint. The application needs to be robust in handling these limits. Current mitigations are in place, but ongoing monitoring and adjustments may be needed.
*   **Asynchronous Programming Complexity:**  The asynchronous nature of the application (due to FastAPI and LLM interactions) adds complexity to development and debugging.
*   **State Management:** Managing session state and real-time updates via WebSockets requires careful consideration of concurrency and data consistency.
*   **Tool Security:**  If integrating tools that interact with the local file system or execute code (e.g., `python_execute`, `bash`), security considerations are paramount. Sandboxing or careful permission management may be necessary for production deployments.
*   **Scalability:**  The current architecture is suitable for development and moderate usage. For high-scale deployments, consider database scalability, load balancing, and optimizing LLM API interactions.
*   **Error Handling and Resilience:**  Robust error handling is crucial, especially when interacting with external APIs and tools. The application should gracefully handle API errors, network issues, and unexpected tool failures.

**Dependencies:**

*   **Python Packages:**  Listed above in "Technologies Used - Python Libraries."  Dependencies are managed via `pip` and should be installed using a virtual environment.
*   **LLM API Keys:**  Requires API keys for the chosen LLM provider (Anthropic in the current setup). These keys need to be properly configured in environment variables or `config.toml`.
*   **Optional Browser (for browser-based tools):**  If using tools that require browser automation, a Chromium-based browser (like Google Chrome or Chromium) needs to be installed on the system.
