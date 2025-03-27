---
description: System architecture, key technical decisions, design patterns
globs: memory-bank/systemPatterns.md
alwaysApply: true
---
# System Patterns: OpenManus Web - AI Agent Platform

**System Architecture:**

The OpenManus Web platform follows a layered architecture:

1.  **Frontend (Web UI):**
    *   Built with HTML, CSS, and JavaScript.
    *   Provides the user interface for interacting with the AI agent platform.
    *   Uses WebSockets for real-time communication with the backend to receive updates on task progress and agent thinking steps.
    *   Located in `app/web/static` and `app/web/templates`.

2.  **Backend (API Server):**
    *   Built with FastAPI (Python).
    *   Provides REST API endpoints for handling user requests (e.g., starting sessions, getting thinking steps, progress updates).
    *   Manages AI agent sessions, workflow execution, and tool orchestration.
    *   Handles WebSocket connections for real-time updates to the frontend.
    *   Located in `app/web/app.py` and related files in `app/web/`.

3.  **AI Agent Core:**
    *   Contains the core logic for AI agents, including agent classes (e.g., `Manus`), planning flows (`PlanningFlow`), and tool management (`ToolCollection`).
    *   Responsible for interpreting user prompts, creating plans, executing steps, and interacting with LLMs and tools.
    *   Located in `app/agent/`, `app/flow/`, and `app/tool/`.

4.  **Large Language Model (LLM) Abstraction Layer:**
    *   Provides an abstraction layer for interacting with different LLM providers (currently Anthropic).
    *   Handles API calls to the LLM, manages rate limits, and formats requests and responses.
    *   Located in `app/llm.py`.

5.  **Tools:**
    *   A collection of tools that extend the capabilities of AI agents (e.g., `file_saver`, `python_execute`, `web_search`, `planning`).
    *   Tools are modular and can be added or modified to enhance agent functionality.
    *   Located in `app/tool/`.

6.  **Session Storage:**
    *   Uses a SQLite database (`sessions.db`) to persist session data, thinking steps, and logs.
    *   Provides session management and replay capabilities.
    *   Located in `app/web/session_storage.py`.

**Key Technical Decisions and Patterns:**

*   **Asynchronous Architecture:**  Utilizes `asyncio` throughout the backend for handling concurrent requests and non-blocking operations, crucial for efficient LLM interactions and real-time updates.
*   **FastAPI for Backend:**  Chosen for its performance, ease of use, automatic data validation, and built-in support for asynchronous operations and WebSockets.
*   **Modular Tool Design:** Tools are designed as independent modules, making it easy to add, modify, and manage agent capabilities.
*   **Planning Flow for Complex Tasks:**  Employs a `PlanningFlow` to break down complex user prompts into manageable steps, enabling agents to handle more sophisticated tasks.
*   **Thinking Step Tracking:** Implemented a "thinking step" tracking system to provide transparency into the agent's reasoning process and task execution.
*   **Rate Limit Handling Strategy:**  Adopted a multi-pronged approach to rate limit mitigation, including switching to Anthropic, increasing retries with exponential backoff, and adding delays between steps.
*   **Configuration via `config.toml`:**  Uses a `config.toml` file for centralized configuration of LLM settings, browser options, and other application parameters.

**Design Patterns:**

*   **Factory Pattern:**  `FlowFactory` is used to create different types of execution flows (currently only `PlanningFlow`).
*   **Strategy Pattern:**  Agents can be seen as strategies for executing different types of steps within a plan.
*   **Observer Pattern (Implicit):**  The WebSocket communication for real-time updates can be seen as an implicit observer pattern, where the frontend observes changes in the backend session state.
