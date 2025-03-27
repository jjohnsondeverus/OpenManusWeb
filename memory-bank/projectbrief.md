---
description: Foundation document defining core project goals and scope
globs: memory-bank/projectbrief.md
alwaysApply: true
---
# Project Brief: OpenManus Web - AI Agent Platform

**Project Goal:** To develop a robust and user-friendly web application for interacting with and managing AI agents. This platform will serve as a foundation for building and deploying various AI agent-based applications and workflows.

**Core Requirements:**

1.  **Web Interface:** Provide a web-based user interface for interacting with AI agents, submitting prompts, and viewing results in real-time.
2.  **Agent Management:** Implement a system for creating, configuring, and managing different types of AI agents.
3.  **Workflow Orchestration:** Enable the creation and execution of complex workflows involving multiple AI agents and tools.
4.  **Tool Integration:**  Support integration with a variety of tools (e.g., file system access, web search, code execution) to enhance agent capabilities.
5.  **LLM Abstraction:** Abstract the underlying Large Language Model (LLM) provider to allow for flexibility and easy switching between different models (e.g., OpenAI, Anthropic, local models).
6.  **Session Management:** Manage user sessions, track conversation history, and persist task progress.
7.  **Logging and Monitoring:** Implement comprehensive logging and monitoring to track agent activities, debug issues, and analyze performance.
8.  **Rate Limit Handling:** Implement robust mechanisms to handle and mitigate rate limits from LLM providers.
9.  **Extensibility:** Design the platform to be extensible and adaptable to future features and integrations.

**Current Project Focus:** Establishing the basic infrastructure for the web application and core agent interaction, including addressing initial challenges with LLM rate limits.

**Source of Truth:** This document serves as the primary source of truth for the project's scope and objectives. All other memory bank files should align with and expand upon the definitions set forth in this document. 