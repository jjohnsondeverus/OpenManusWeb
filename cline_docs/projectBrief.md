# **OpenManusWeb Project Handoff Document \- Mar 26, 2025**

## **1\. Project Purpose and Core Functionality**

The OpenManusWeb project is a web interface component for the OpenManus AI agent system. Its primary goal is to replicate the user experience of the commercial Manus AI product, providing a modern, interactive interface where users can:

* Communicate with the AI assistant through a chat interface  
* Visualize the AI's thinking process in real-time via a timeline  
* Monitor terminal outputs and command execution  
* View and interact with files being modified by the AI  
* Track progress of AI operations with detailed steps

The central feature is the AI thinking timeline, which displays each step of the AI's reasoning and tool usage in a chronological interface, allowing users to understand exactly how the AI arrives at its solutions.

## **2\. Key Technologies, Frameworks, and Libraries**

### **Backend**

* **FastAPI**: Web server framework for API endpoints and WebSocket support  
* **Python 3.12**: Core programming language  
* **WebSocket**: For real-time communication between server and client  
* **SQLite**: For session storage and persistence  
* **Asyncio**: For handling concurrent operations

### **Frontend**

* **HTML/CSS/JavaScript**: Pure frontend implementation (no framework)  
* **xterm.js**: Terminal emulation (v5.1.0)  
* **xterm-addon-fit**: Terminal sizing addon (v0.7.0)

### **Agent System**

* **OpenAI API**: For LLM interactions  
* **ThinkingTracker**: Custom component for tracking AI thinking steps  
* **PlanningFlow**: Flow-based execution system for AI agents

## **3\. Current Architecture and Component Structure**

### **Backend Components**

* **app.py**: Main FastAPI application with routes and WebSocket handlers  
* **thinking\_tracker.py**: Core component for tracking and managing AI thinking steps  
* **session\_storage.py**: Handles persistence of sessions  
* **log\_handler.py**: Manages logging and log retrieval  
* **Agent System**:  
  * **base.py**: Base agent class  
  * **manus.py**: Manus agent implementation  
  * **toolcall.py**: Tool-calling agent implementation  
* **Flow Controllers**:  
  * **planning.py**: Planning-based execution flow

### **Frontend Components**

* **connected\_interface.js**: Main interface coordination  
* **connected\_thinkingManager.js**: Manages timeline visualization  
* **connected\_websocketManager.js**: Handles WebSocket communication  
* **connected\_chatManager.js**: Manages chat interface  
* **connected\_fileViewerManager.js**: Handles file viewing/editing

### **Communication Flow**

1. User sends message through chat interface  
2. Message processed by backend through WebSocket  
3. Agent executes thinking steps and tools  
4. Thinking steps captured by ThinkingTracker  
5. Steps sent to frontend via WebSocket in real-time  
6. Frontend renders updates in timeline and terminal

## **4\. Implementation Details of Major Features**

### **AI Thinking Timeline Visualization**

* **ThinkingTracker**: Backend class that captures thinking steps during agent execution  
* Hooks into the agent pipeline using a step ID system for deduplication  
* WebSocket communication for real-time updates to the frontend  
* Frontend visualization with expandable details and toggle buttons  
* Support for both creating new steps and updating existing ones

### **WebSocket Communication**

* Real-time bidirectional communication using WebSockets  
* Incremental updates for efficiency and reduced payload size  
* Support for step updates vs. new steps through an "updated" flag  
* Reconnection handling for lost connections

### **Two-Pane Layout**

* Left panel contains chat interface and AI thinking timeline  
* Right panel shows terminal output and command execution  
* Matches the commercial Manus AI product layout  
* Tab-based interface on the right panel for terminal, browser, editor

### **Terminal Integration**

* Integration with xterm.js for terminal emulation  
* Capture and display of agent command outputs  
* Real-time updating during execution

## **5\. Known Issues, Limitations, and Technical Debt**

### **Current Issues**

* **Execution Loop Issue**: Planning execution appears to get stuck after creating a plan (steps don't go beyond 4\)  
* **Rate Limit Handling**: Rate limit errors from OpenAI API needed better handling (partially fixed)  
* **Detail Display**: Step details weren't showing properly in the timeline (fixed)  
* **Step Deduplication**: Issues with duplicate steps in the timeline (fixed)

### **Technical Debt**

* Lack of comprehensive error handling in various components  
* Limited test coverage (minimal automated tests)  
* No TypeScript for better type safety  
* CSS organization needs improvement  
* No proper build system or module bundling

### **Performance Limitations**

* Potential memory issues with very long sessions  
* JSON serialization overhead for large WebSocket messages  
* SQLite scaling limitations for multiple concurrent users

## **6\. Immediate Next Steps and Future Development Plans**

### **Immediate Priorities**

1. **Fix Execution Loop Issue**: Resolve the issue where execution gets stuck after plan creation  
2. **Improve Error Handling**: Add more comprehensive error handling and logging  
3. **Enhance Terminal Integration**: Improve terminal emulation and command visualization  
4. **Implement Session Replay**: Add functionality to record and replay sessions  
5. **UI Polish**: Improve visual design and responsiveness

### **Medium-term Goals**

* **Containerized Task Execution**: Implement Docker-based isolation for tools  
* **Authentication System**: Add user accounts and access control  
* **Collaboration Features**: Enable sharing sessions between users  
* **File Management**: Better file upload/download capabilities  
* **Visualization Improvements**: Enhanced visualization of complex operations

### **Long-term Vision**

* **Plugin System**: Extensible tool ecosystem for community contributions  
* **Analytics Dashboard**: Usage statistics and performance metrics  
* **Mobile Support**: Responsive design for mobile devices  
* **Multi-Agent Collaboration**: Support for multiple agents working together

## **7\. Critical Design Decisions and Tradeoffs**

### **Step Deduplication System**

* **Decision**: Implement a step ID-based deduplication system to track and update steps  
* **Rationale**: Reduces duplicate steps and provides more accurate timeline  
* **Tradeoff**: Added complexity in tracking and updating steps vs. simpler append-only approach

### **Incremental WebSocket Updates**

* **Decision**: Send incremental updates instead of full state dumps  
* **Rationale**: Reduces network traffic and prevents duplicate steps  
* **Tradeoff**: More complex state management but better performance

### **SQLite for Session Storage**

* **Decision**: Use SQLite rather than a more scalable database  
* **Rationale**: Simplifies deployment with no external dependencies  
* **Tradeoff**: Limited scalability but easier setup and maintenance

### **Vanilla JavaScript Frontend**

* **Decision**: Use pure JavaScript without a framework  
* **Rationale**: Reduces complexity for initial implementation  
* **Tradeoff**: Less structured code but faster development

### **Two-Pane Layout**

* **Decision**: Adopt the commercial Manus AI product's two-pane layout  
* **Rationale**: Provides clear separation between input/thinking and execution results  
* **Tradeoff**: Limited screen real estate but clearer organization

## **8\. Additional Implementation Notes**

### **Rate Limit Handling**

The project now includes enhanced rate limit handling for OpenAI API calls:

* Adaptive retry mechanism based on OpenAI's recommended wait times  
* Jitter to help distribute requests more evenly  
* Improved error logging for rate limit issues

### **Debugging Infrastructure**

We've added comprehensive debugging infrastructure:

* Detailed logging throughout the execution pipeline  
* Better exception handling with full stack traces  
* Step-by-step tracking of execution flow

This handoff document should provide all essential context needed for another AI assistant to continue development work on the OpenManusWeb project seamlessly. The most pressing issue to address is the execution loop issue where the planning flow appears to get stuck after creating a plan.

