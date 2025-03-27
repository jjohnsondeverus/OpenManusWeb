---
description: Explains why the project exists, problems it solves, and user experience goals
globs: memory-bank/productContext.md
alwaysApply: true
---
# Product Context: OpenManus Web - AI Agent Platform

**Why This Project Exists:**

The OpenManus Web project aims to democratize access to powerful AI agent technologies.  Currently, interacting with and building applications using AI agents often requires significant technical expertise and complex setups. This project seeks to simplify this process by providing a user-friendly web platform that makes AI agents accessible to a wider audience, including developers, researchers, and even non-technical users.

**Problems Solved:**

*   **Complexity of AI Agent Interaction:**  Abstracts away the complexities of directly interacting with LLMs and managing agent workflows through a web interface.
*   **Lack of User-Friendly Interface:** Provides an intuitive web UI for prompt submission, real-time progress tracking, and result visualization, improving user experience compared to command-line or code-based interactions.
*   **LLM Provider Lock-in:**  Offers flexibility by abstracting the LLM provider, allowing users to switch between different models and APIs without significant code changes.
*   **Rate Limit Challenges:** Addresses the practical challenges of LLM rate limits by implementing robust retry mechanisms and strategies to minimize disruptions.
*   **Collaboration and Accessibility:**  Facilitates collaboration by providing a centralized web platform accessible to multiple users, making AI agent technology more readily available within teams and organizations.

**How It Should Work (User Experience Goals):**

*   **Intuitive and Easy to Use:** The web interface should be clean, straightforward, and require minimal learning to start interacting with AI agents.
*   **Real-time Feedback:** Users should receive real-time updates on task progress, thinking steps, and agent communications through the web interface.
*   **Session Persistence:** User sessions and conversation history should be saved and easily accessible for review and continuation.
*   **Customizable and Extensible:** The platform should be designed to be customizable and extensible, allowing for the addition of new agents, tools, and features as needed.
*   **Stable and Reliable:** The platform should be stable and reliable, providing consistent performance and robust error handling, especially in dealing with external API dependencies like LLMs.
*   **Clear Workflow Visualization:**  For complex tasks, the platform should visualize the agent's planning and execution steps, making the AI's reasoning process more transparent to the user.

**Target Users:**

*   **Developers:** To rapidly prototype and build AI-powered applications and workflows.
*   **Researchers:** To experiment with different AI agent configurations and conduct research on agent behavior and capabilities.
*   **Technical Users:**  To leverage AI agents for various tasks, such as content generation, data analysis, and automation, without needing deep coding skills.
*   **Organizations:** To deploy and manage AI agent-based solutions for internal use and potentially external services.
