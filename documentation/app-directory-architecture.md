# OpenManusWeb: Application Package Architecture Deep Dive

This document provides an in-depth technical analysis of the `app/` directory in OpenManusWeb, explaining the architecture, component interactions, and key implementation details.

## Architecture Overview

The `app/` directory follows a modular design with several key components:

```
app/
├── agent/                 # Agent implementations
├── flow/                  # Flow controllers for orchestration
├── prompt/                # Prompt templates for LLM guidance
├── tool/                  # Tool implementations for agent actions
├── web/                   # Web interface integration
├── config.py              # Configuration management
├── exceptions.py          # Custom exception definitions
├── llm.py                 # LLM interface
├── logger.py              # Logging utilities
└── schema.py              # Data models and schemas
```

## Component Interactions

The system flow follows this general pattern:

1. **User Input** → Web interface receives prompt
2. **Web Server** → Creates session and initializes flow
3. **Flow Controller** → Orchestrates execution using agents
4. **Agent** → Plans and executes using tools
5. **Tools** → Perform actions and return results
6. **Web Server** → Streams results back to interface

![Architecture Flow](https://i.imgur.com/TRu7qfJ.png)

## 1. Agent System (agent/)

The Agent system follows a class hierarchy that builds up capabilities through inheritance:

```
BaseAgent
└── ReActAgent
    └── ToolCallAgent
        └── Manus
```

### BaseAgent (`agent/base.py`)

The foundation of all agents, providing the core interface and memory management:

```python
class BaseAgent(BaseModel, ABC):
    """Base class for all agents."""
    
    name: str = "base"
    description: str = "Base agent class."
    
    messages: List[Message] = Field(default_factory=list)
    memory: Memory = Field(default_factory=Memory)
    state: AgentState = AgentState.IDLE
    
    @abstractmethod
    async def run(self, query: str) -> str:
        """Main entry point to run the agent with a query."""
        pass
        
    @abstractmethod
    async def think(self) -> bool:
        """Agent thinking process."""
        pass
        
    @abstractmethod
    async def act(self) -> str:
        """Agent action execution."""
        pass
```

Key functionality:
- Abstract methods for `run`, `think`, and `act` that all agents must implement
- Memory management via `messages` list and `memory` object
- State tracking via the `state` enum

### ReActAgent (`agent/react.py`)

Implements the ReAct (Reasoning and Acting) loop:

```python
class ReActAgent(BaseAgent):
    """Agent implementing the ReAct (Reasoning + Acting) loop."""
    
    name: str = "react"
    description: str = "Agent using ReAct thinking pattern."
    
    system_prompt: str = ""
    next_step_prompt: str = ""
    
    llm: LLM = Field(default_factory=lambda: LLM())
    max_steps: int = 10
    
    async def run(self, query: str) -> str:
        """Run the agent with the given query."""
        self.state = AgentState.RUNNING
        
        # Initialize with user query
        user_msg = Message.user_message(query)
        self.messages = [user_msg]
        self.memory.add_message(user_msg)
        
        step_count = 0
        final_result = ""
        
        while self.state == AgentState.RUNNING and step_count < self.max_steps:
            # Thinking phase
            should_continue = await self.think()
            
            if not should_continue:
                break
                
            # Acting phase
            result = await self.act()
            final_result += result + "\n"
            
            step_count += 1
            
        # Set state to finished if not already in error state
        if self.state == AgentState.RUNNING:
            self.state = AgentState.FINISHED
            
        return final_result.strip()
```

Key functionality:
- Implements the `run` method with a loop of thinking and acting
- Uses `think` to generate reasoning and `act` to execute actions
- Manages conversation steps and maximum iterations

### ToolCallAgent (`agent/toolcall.py`)

Extends ReActAgent to add structured tool/function calling abilities:

```python
class ToolCallAgent(ReActAgent):
    """Base agent class for handling tool/function calls with enhanced abstraction"""

    name: str = "toolcall"
    description: str = "an agent that can execute tool calls."

    system_prompt: str = SYSTEM_PROMPT  # From prompt/toolcall.py
    next_step_prompt: str = NEXT_STEP_PROMPT  # From prompt/toolcall.py

    available_tools: ToolCollection = ToolCollection(
        CreateChatCompletion(), Terminate()
    )
    tool_choices: Literal["none", "auto", "required"] = "auto"
    special_tool_names: List[str] = Field(default_factory=lambda: [Terminate().name])

    tool_calls: List[ToolCall] = Field(default_factory=list)

    max_steps: int = 30

    async def think(self) -> bool:
        """Process current state and decide next actions using tools"""
        if self.next_step_prompt:
            user_msg = Message.user_message(self.next_step_prompt)
            self.messages += [user_msg]

        # Get response with tool options
        response = await self.llm.ask_tool(
            messages=self.messages,
            system_msgs=[Message.system_message(self.system_prompt)]
            if self.system_prompt
            else None,
            tools=self.available_tools.to_params(),
            tool_choice=self.tool_choices,
        )
        self.tool_calls = response.tool_calls

        # Process response and determine next steps
        # [Implementation abbreviated for brevity]
        return bool(self.tool_calls)

    async def act(self) -> str:
        """Execute tool calls and handle their results"""
        if not self.tool_calls:
            if self.tool_choices == "required":
                raise ValueError(TOOL_CALL_REQUIRED)
            return self.messages[-1].content or "No content or commands to execute"

        results = []
        for command in self.tool_calls:
            result = await self.execute_tool(command)
            tool_msg = Message.tool_message(
                content=result, tool_call_id=command.id, name=command.function.name
            )
            self.memory.add_message(tool_msg)
            results.append(result)

        return "\n\n".join(results)

    async def execute_tool(self, command: ToolCall) -> str:
        """Execute a single tool call with robust error handling"""
        # [Implementation abbreviated for brevity]
        result = await self.available_tools.execute(name=name, tool_input=args)
        return result
```

Key functionality:
- Specialized version of `think` that generates structured tool calls
- Implementation of `act` that executes tools and captures results
- Error handling and response formatting for tool execution

### Manus Agent (`agent/manus.py`)

The main agent class with a comprehensive set of tools:

```python
class Manus(ToolCallAgent):
    """
    A versatile general-purpose agent that uses planning to solve various tasks.

    This agent extends PlanningAgent with a comprehensive set of tools and capabilities,
    including Python execution, web browsing, file operations, and information retrieval
    to handle a wide range of user requests.
    """

    name: str = "Manus"
    description: str = (
        "A versatile agent that can solve various tasks using multiple tools"
    )

    system_prompt: str = SYSTEM_PROMPT  # From prompt/manus.py
    next_step_prompt: str = NEXT_STEP_PROMPT  # From prompt/manus.py

    # Add general-purpose tools to the tool collection
    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            PythonExecute(), GoogleSearch(), BrowserUseTool(), FileSaver(), Terminate()
        )
    )
```

Key functionality:
- Builds on the ToolCallAgent for planning and tool execution
- Includes a comprehensive set of tools for various capabilities
- Uses specialized prompts tailored for the Manus assistant

## 2. Tool System (tool/)

The Tool system allows agents to perform actions in the world:

### BaseTool (`tool/base.py`)

The foundation for all tools, defining the interface and basic functionality:

```python
class BaseTool(BaseModel):
    """Base class for all tools."""
    
    name: str = "base_tool"
    description: str = "Base tool with no functionality."
    
    # Parameters accepted by the tool
    parameters: Dict[str, Any] = Field(default_factory=dict)

    @abstractmethod
    async def _run(self, **kwargs) -> Any:
        """Run the tool with the given keyword arguments."""
        pass
        
    async def run(self, **kwargs) -> Any:
        """Public method to run the tool after argument validation."""
        # Validate input
        validated_input = self._validate_input(kwargs)
        
        # Run the tool with validated input
        try:
            return await self._run(**validated_input)
        except Exception as e:
            logger.exception(f"Error running tool {self.name}: {e}")
            raise
```

### ToolCollection (`tool/__init__.py`)

Manages a set of tools and provides interfaces for usage:

```python
class ToolCollection:
    """A collection of tools that can be used by agents."""

    def __init__(self, *tools: BaseTool):
        """Initialize with a set of tools."""
        self.tools = list(tools)
        self.tool_map = {tool.name: tool for tool in self.tools}

    def add_tool(self, tool: BaseTool) -> None:
        """Add a tool to the collection."""
        self.tools.append(tool)
        self.tool_map[tool.name] = tool

    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Get a tool by name."""
        return self.tool_map.get(name)

    def to_params(self) -> List[Dict[str, Any]]:
        """Convert tools to parameters format for LLM API."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": {
                        "type": "object",
                        "properties": tool.parameters,
                        "required": list(tool.parameters.keys()),
                    },
                },
            }
            for tool in self.tools
        ]

    async def execute(self, name: str, tool_input: Dict[str, Any]) -> Any:
        """Execute a tool by name with the given input."""
        tool = self.get_tool(name)
        if not tool:
            raise ValueError(f"Tool not found: {name}")
        return await tool.run(**tool_input)
```

### Example Tools

#### PythonExecute (`tool/python_execute.py`)

```python
class PythonExecute(BaseTool):
    """Tool for executing Python code."""

    name: str = "python_execute"
    description: str = "Execute Python code and return the result."
    parameters: Dict[str, Any] = {
        "code": {
            "type": "string",
            "description": "Python code to execute.",
        }
    }

    async def _run(self, code: str) -> str:
        """Execute Python code in a sandbox."""
        # Create a sandbox with restricted globals
        sandbox_globals = {
            "__builtins__": {
                name: getattr(__builtins__, name)
                for name in ALLOWED_BUILTINS
            },
        }
        
        # Add allowed modules
        for module_name in ALLOWED_MODULES:
            try:
                module = importlib.import_module(module_name)
                sandbox_globals[module_name] = module
            except ImportError:
                pass
        
        # Capture stdout and stderr
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        
        result = None
        error = None
        
        try:
            # Execute code in sandbox
            exec(code, sandbox_globals)
            output = sys.stdout.getvalue()
        except Exception as e:
            error = str(e)
            output = sys.stderr.getvalue()
        finally:
            # Restore stdout and stderr
            sys.stdout = old_stdout
            sys.stderr = old_stderr
        
        if error:
            return f"Error: {error}\n{output}"
        return output or "Code executed successfully with no output."
```

#### BrowserUseTool (`tool/browser_use_tool.py`)

```python
class BrowserUseTool(BaseTool):
    """Tool for browser automation using browser-use library."""

    name: str = "browser_use"
    description: str = "Automate web browser to navigate and interact with websites."
    parameters: Dict[str, Any] = {
        "url": {
            "type": "string",
            "description": "URL to navigate to.",
        },
        "actions": {
            "type": "array",
            "description": "List of actions to perform on the webpage.",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["click", "type", "navigate", "extract"],
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for the element to interact with.",
                    },
                    "value": {
                        "type": "string",
                        "description": "Value to type or data to extract.",
                    },
                },
            },
        },
    }

    async def _run(self, url: str, actions: List[Dict[str, Any]]) -> str:
        """Run browser automation with the specified URL and actions."""
        browser = await browser_use.launch()
        page = await browser.new_page()
        
        try:
            await page.goto(url)
            results = []
            
            for action in actions:
                action_type = action.get("type")
                selector = action.get("selector")
                value = action.get("value")
                
                if action_type == "click" and selector:
                    await page.click(selector)
                    results.append(f"Clicked on {selector}")
                    
                elif action_type == "type" and selector and value:
                    await page.fill(selector, value)
                    results.append(f"Typed '{value}' into {selector}")
                    
                elif action_type == "navigate" and value:
                    await page.goto(value)
                    results.append(f"Navigated to {value}")
                    
                elif action_type == "extract" and selector:
                    content = await page.text_content(selector)
                    results.append(f"Extracted from {selector}: {content}")
            
            # Get final page content
            page_content = await page.content()
            
            # Convert HTML to text for better readability
            text_content = html2text.html2text(page_content)
            
            return "\n".join(results) + "\n\nPage Content:\n" + text_content
            
        finally:
            await browser.close()
```

## 3. Flow System (flow/)

The Flow system orchestrates tasks and manages multi-step execution:

### BaseFlow (`flow/base.py`)

```python
class BaseFlow(BaseModel, ABC):
    """Base class for execution flows supporting multiple agents"""

    agents: Dict[str, BaseAgent]
    tools: Optional[List] = None
    primary_agent_key: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True

    def __init__(
        self, agents: Union[BaseAgent, List[BaseAgent], Dict[str, BaseAgent]], **data
    ):
        # Handle different ways of providing agents
        if isinstance(agents, BaseAgent):
            agents_dict = {"default": agents}
        elif isinstance(agents, list):
            agents_dict = {f"agent_{i}": agent for i, agent in enumerate(agents)}
        else:
            agents_dict = agents

        # If primary agent not specified, use first agent
        primary_key = data.get("primary_agent_key")
        if not primary_key and agents_dict:
            primary_key = next(iter(agents_dict))
            data["primary_agent_key"] = primary_key

        # Set the agents dictionary
        data["agents"] = agents_dict

        # Initialize using BaseModel's init
        super().__init__(**data)

    @property
    def primary_agent(self) -> Optional[BaseAgent]:
        """Get the primary agent for the flow"""
        return self.agents.get(self.primary_agent_key)

    @abstractmethod
    async def execute(
        self, input_text: str, job_id: str = None, cancel_event: asyncio.Event = None
    ) -> str:
        """Execute the flow with the given input text."""
        raise NotImplementedError("Subclasses must implement execute method")
```

### PlanningFlow (`flow/planning.py`)

The PlanningFlow class handles planning and step-by-step execution:

```python
class PlanningFlow(BaseFlow):
    """A flow that manages planning and execution of tasks using agents."""

    llm: LLM = Field(default_factory=lambda: LLM())
    planning_tool: PlanningTool = Field(default_factory=PlanningTool)
    executor_keys: List[str] = Field(default_factory=list)
    active_plan_id: str = Field(default_factory=lambda: f"plan_{int(time.time())}")
    current_step_index: Optional[int] = None

    async def execute(
        self, input_text: str, job_id: str = None, cancel_event: asyncio.Event = None
    ) -> str:
        """Execute the planning flow with agents."""
        try:
            if not self.primary_agent:
                raise ValueError("No primary agent available")

            # Create initial plan if input provided
            if input_text:
                await self._create_initial_plan(input_text, job_id)

            result = ""
            while True:
                # Check for cancellation
                if cancel_event and cancel_event.is_set():
                    logger.warning("Execution cancelled by user")
                    return result + "\n执行已被用户取消"

                # Get current step to execute
                self.current_step_index, step_info = await self._get_current_step_info()

                # Exit if no more steps or plan completed
                if self.current_step_index is None:
                    result += await self._finalize_plan()
                    break

                # Execute current step with appropriate agent
                step_type = step_info.get("type") if step_info else None
                executor = self.get_executor(step_type)
                step_result = await self._execute_step(executor, step_info)
                result += step_result + "\n"

                # Check if agent wants to terminate
                if hasattr(executor, "state") and executor.state == AgentState.FINISHED:
                    break

            return result
        except Exception as e:
            logger.error(f"Error in PlanningFlow: {str(e)}")
            return f"Execution failed: {str(e)}"

    async def _create_initial_plan(self, request: str, job_id: str = None) -> None:
        """Create an initial plan based on the request."""
        # Create system and user messages for planning
        system_message = Message.system_message(
            "You are a planning assistant. Create a concise, actionable plan with clear steps."
        )
        user_message = Message.user_message(
            f"Create a reasonable plan with clear steps to accomplish the task: {request}"
        )

        # Call LLM with PlanningTool
        response = await self.llm.ask_tool(
            messages=[user_message],
            system_msgs=[system_message],
            tools=[self.planning_tool.to_param()],
            tool_choice="required",
        )

        # Process tool calls to create plan
        if response.tool_calls:
            for tool_call in response.tool_calls:
                if tool_call.function.name == "planning":
                    args = json.loads(tool_call.function.arguments)
                    args["plan_id"] = self.active_plan_id
                    await self.planning_tool.execute(**args)
                    return

        # Create default plan if no valid response
        await self.planning_tool.execute(
            command="create",
            plan_id=self.active_plan_id,
            title=f"Plan for: {request[:50]}{'...' if len(request) > 50 else ''}",
            steps=["Analyze request", "Execute task", "Verify results"],
        )

    async def _execute_step(self, executor: BaseAgent, step_info: dict) -> str:
        """Execute the current step with the specified agent."""
        # Get plan status and create step prompt
        plan_status = await self._get_plan_text()
        step_text = step_info.get("text", f"Step {self.current_step_index}")

        step_prompt = f"""
        CURRENT PLAN STATUS:
        {plan_status}

        YOUR CURRENT TASK:
        You are now working on step {self.current_step_index}: "{step_text}"

        Please execute this step using the appropriate tools. When you're done, provide a summary of what you accomplished.
        """

        # Execute step and mark as completed
        step_result = await executor.run(step_prompt)
        await self._mark_step_completed()
        return step_result
```

### FlowFactory (`flow/flow_factory.py`)

The factory class for creating different flow types:

```python
class FlowFactory:
    """Factory for creating different types of flows with support for multiple agents"""

    @staticmethod
    def create_flow(
        flow_type: FlowType,
        agents: Union[BaseAgent, List[BaseAgent], Dict[str, BaseAgent]],
        **kwargs,
    ) -> BaseFlow:
        """Create a flow of the specified type with the provided agents."""
        if flow_type == FlowType.PLANNING:
            from app.flow.planning import PlanningFlow
            return PlanningFlow(agents, **kwargs)
        else:
            raise ValueError(f"Unknown flow type: {flow_type}")
```

## 4. LLM System (llm.py)

The LLM class provides a unified interface to language models:

```python
class LLM:
    """Interface to large language models with support for different providers."""

    def __init__(self, config_dict=None):
        """Initialize with optional config override."""
        self.config = config_dict or load_llm_config()
        self.client = self._create_client()

    def _create_client(self):
        """Create appropriate client based on configuration."""
        base_url = self.config.get("base_url")
        api_key = self.config.get("api_key")
        
        if not api_key:
            raise ValueError("API key is required for LLM access")
            
        # Create OpenAI client with appropriate configuration
        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
        )
        return client

    async def ask(
        self,
        messages: List[Message],
        system_msgs: Optional[List[Message]] = None,
        model: Optional[str] = None,
        **kwargs,
    ) -> str:
        """Send prompt to the LLM and get text response."""
        # Prepare messages list with system messages first
        formatted_messages = []
        
        # Add system messages if provided
        if system_msgs:
            for msg in system_msgs:
                formatted_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        # Add conversation messages
        for msg in messages:
            formatted_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Get model from config or parameter
        model_name = model or self.config.get("model", "gpt-4o")
        
        # Set parameters from config with overrides from kwargs
        params = {
            "temperature": self.config.get("temperature", 0.0),
            "max_tokens": self.config.get("max_tokens", 4096),
            **kwargs
        }
        
        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=model_name,
            messages=formatted_messages,
            **params
        )
        
        # Return content from first response choice
        return response.choices[0].message.content

    async def ask_tool(
        self,
        messages: List[Message],
        tools: List[Dict],
        system_msgs: Optional[List[Message]] = None,
        model: Optional[str] = None,
        tool_choice: Literal["none", "auto", "required"] = "auto",
        **kwargs,
    ) -> "ToolResponse":
        """Send prompt to LLM with tools and get response with optional tool calls."""
        # Prepare messages list
        formatted_messages = []
        
        # Add system messages
        if system_msgs:
            for msg in system_msgs:
                formatted_messages.append(msg.to_dict())
        
        # Add conversation messages
        for msg in messages:
            formatted_messages.append(msg.to_dict())
        
        # Get model from config or parameter
        model_name = model or self.config.get("model", "gpt-4o")
        
        # Set parameters from config with overrides from kwargs
        params = {
            "temperature": self.config.get("temperature", 0.0),
            "max_tokens": self.config.get("max_tokens", 4096),
            **kwargs
        }
        
        # Convert tool_choice to API format
        if tool_choice == "none":
            api_tool_choice = "none"
        elif tool_choice == "auto":
            api_tool_choice = "auto"
        elif tool_choice == "required":
            api_tool_choice = {"type": "function"}
        else:
            api_tool_choice = "auto"
        
        # Call OpenAI API with tools
        response = await self.client.chat.completions.create(
            model=model_name,
            messages=formatted_messages,
            tools=tools,
            tool_choice=api_tool_choice,
            **params
        )
        
        # Extract response content and tool calls
        assist_msg = response.choices[0].message
        content = assist_msg.content
        
        # Parse tool calls if present
        tool_calls = []
        if hasattr(assist_msg, "tool_calls") and assist_msg.tool_calls:
            for call in assist_msg.tool_calls:
                tool_calls.append(
                    ToolCall(
                        id=call.id,
                        type=call.type,
                        function=FunctionCall(
                            name=call.function.name,
                            arguments=call.function.arguments,
                        ),
                    )
                )
        
        # Return a structured response with content and tool calls
        return ToolResponse(content=content, tool_calls=tool_calls)
```

## 5. Schema System (schema.py)

Defines the data structures used throughout the application:

```python
class AgentState(str, Enum):
    """Possible states of an agent."""
    IDLE = "idle"
    RUNNING = "running"
    FINISHED = "finished"
    ERROR = "error"

class Message(BaseModel):
    """Represents a message in a conversation."""
    role: str
    content: Optional[str] = None
    name: Optional[str] = None
    tool_calls: Optional[List["ToolCall"]] = None
    tool_call_id: Optional[str] = None
    
    @classmethod
    def system_message(cls, content: str) -> "Message":
        """Create a system message."""
        return cls(role="system", content=content)
    
    @classmethod
    def user_message(cls, content: str) -> "Message":
        """Create a user message."""
        return cls(role="user", content=content)
    
    @classmethod
    def assistant_message(cls, content: str) -> "Message":
        """Create an assistant message."""
        return cls(role="assistant", content=content)
    
    @classmethod
    def tool_message(cls, content: str, tool_call_id: str, name: str = None) -> "Message":
        """Create a tool message."""
        return cls(
            role="tool",
            content=content,
            tool_call_id=tool_call_id,
            name=name
        )
    
    @classmethod
    def from_tool_calls(cls, content: Optional[str], tool_calls: List["ToolCall"]) -> "Message":
        """Create an assistant message with tool calls."""
        return cls(
            role="assistant",
            content=content,
            tool_calls=tool_calls
        )

class FunctionCall(BaseModel):
    """Represents a function call within a tool call."""
    name: str
    arguments: str

class ToolCall(BaseModel):
    """Represents a tool call in a conversation."""
    id: str
    type: str = "function"
    function: FunctionCall

class ToolResponse(BaseModel):
    """Response from LLM with optional tool calls."""
    content: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None

class Memory(BaseModel):
    """Memory for an agent to store and access past messages."""
    messages: List[Message] = Field(default_factory=list)
    
    def add_message(self, message: Message) -> None:
        """Add a message to memory."""
        self.messages.append(message)
    
    def clear(self) -> None:
        """Clear all messages from memory."""
        self.messages = []
    
    def get_last_n_messages(self, n: int) -> List[Message]:
        """Get the last n messages from memory."""
        return self.messages[-n:]
```

## 6. Web Integration (web/)

### Main Web App (`web/app.py`)

The FastAPI application that serves the web interface:

```python
# Core application setup
app = FastAPI(title="OpenManus Web")

# Static files and templates setup
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=current_dir / "static"), name="static")
templates = Jinja2Templates(directory=current_dir / "templates")

# Storage for active sessions and cancellation events
active_sessions: Dict[str, dict] = {}
cancel_events: Dict[str, asyncio.Event] = {}

# API endpoints
@app.post("/api/chat")
async def create_chat_session(
    session_req: SessionRequest, background_tasks: BackgroundTasks
):
    """Create a new chat session with the given prompt."""
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {
        "status": "processing",
        "result": None,
        "log": [],
        "workspace": None,
    }

    # Create cancel event
    cancel_events[session_id] = asyncio.Event()

    # Create workspace directory
    workspace_dir = create_workspace(session_id)
    active_sessions[session_id]["workspace"] = str(
        workspace_dir.relative_to(WORKSPACE_ROOT)
    )

    # Process prompt in background
    background_tasks.add_task(process_prompt, session_id, session_req.prompt)
    
    return {
        "session_id": session_id,
        "workspace": active_sessions[session_id]["workspace"],
    }

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()

    if session_id not in active_sessions:
        await websocket.send_text(json.dumps({"error": "Session not found"}))
        await websocket.close()
        return

    session = active_sessions[session_id]

    # Register WebSocket callbacks for real-time updates
    ThinkingTracker.register_ws_send_callback(session_id, 
        async def ws_send(message: str):
            try:
                await websocket.send_text(message)
            except Exception as e:
                print(f"WebSocket send failed: {str(e)}")
    )

    # Send initial state
    await websocket.send_text(
        json.dumps({
            "status": session["status"],
            "log": session["log"],
            "thinking_steps": ThinkingTracker.get_thinking_steps(session_id),
            "logs": ThinkingTracker.get_logs(session_id),
        })
    )

    # Monitor for updates (logs, thinking steps, etc.)
    while session["status"] == "processing":
        await asyncio.sleep(0.2)
        
        # Check for updates and send them to the client
        # [Implementation abbreviated for brevity]

    # Final update with results
    await websocket.send_text(
        json.dumps({
            "status": session["status"],
            "result": session["result"],
            "log": session["log"],
            "thinking_steps": ThinkingTracker.get_thinking_steps(session_id),
            "logs": ThinkingTracker.get_logs(session_id),
        })
    )

    # Clean up
    ThinkingTracker.unregister_ws_send_callback(session_id)
    await websocket.close()

# Process prompt function
async def process_prompt(session_id: str, prompt: str):
    """Process a user prompt using the agent system."""
    # Set up workspace and logging
    workspace_dir = WORKSPACE_ROOT / active_sessions[session_id]["workspace"]
    job_id = workspace_dir.name
    
    # Switch working directory to workspace
    original_cwd = os.getcwd()
    os.chdir(workspace_dir)
    
    try:
        # Initialize thinking tracker
        ThinkingTracker.start_tracking(session_id)
        
        # Initialize agent and flow
        agent = Manus()
        flow = FlowFactory.create_flow(
            flow_type=FlowType.PLANNING,
            agents=agent,
        )
        
        # Execute flow with prompt
        result = await flow.execute(prompt, job_id, cancel_events.get(session_id))
        
        # Update session with results
        active_sessions[session_id]["status"] = "completed"
        active_sessions[session_id]["result"] = result
        
    except asyncio.CancelledError:
        # Handle cancellation
        active_sessions[session_id]["status"] = "stopped"
        active_sessions[session_id]["result"] = "Processing was cancelled"
        
    except Exception as e:
        # Handle errors
        active_sessions[session_id]["status"] = "error"
        active_sessions[session_id]["result"] = f"Error: {str(e)}"
        
    finally:
        # Clean up
        os.chdir(original_cwd)
        if session_id in cancel_events:
            del cancel_events[session_id]
```

### ThinkingTracker (`web/thinking_tracker.py`)

Tracks the agent's thinking process for the web interface:

```python
class ThinkingTracker:
    """Tracks and manages AI thinking processes."""

    # Class variables for storage
    _session_steps: Dict[str, List[ThinkingStep]] = {}
    _session_status: Dict[str, TaskStatus] = {}
    _session_progress: Dict[str, Dict[str, Any]] = {}
    _session_logs: Dict[str, List[Dict]] = {}
    _ws_send_callbacks: Dict[str, Any] = {}
    _lock = threading.Lock()

    @classmethod
    def start_tracking(cls, session_id: str) -> None:
        """Start tracking for a session."""
        with cls._lock:
            cls._session_steps[session_id] = []
            cls._session_status[session_id] = TaskStatus.THINKING
            cls._session_progress[session_id] = {
                "current_step": "Initializing",
                "total_steps": 0,
                "completed_steps": 0,
                "percentage": 0,
            }
            cls._session_logs[session_id] = []

    @classmethod
    def add_thinking_step(
        cls, session_id: str, message: str, details: Optional[str] = None
    ) -> None:
        """Add a thinking step for the session."""
        step = ThinkingStep(message, "thinking", details)
        with cls._lock:
            if session_id in cls._session_steps:
                cls._session_steps[session_id].append(step)
                
                # Update progress information
                if session_id in cls._session_progress:
                    progress = cls._session_progress[session_id]
                    progress["current_step"] = message
                    
                    # Extract step numbers if present
                    match = re.search(r"Executing step (\d+)/(\d+)", message)
                    if match:
                        current_step_num = int(match.group(1))
                        total_steps = int(match.group(2))
                        progress["total_steps"] = total_steps
                        progress["completed_steps"] = current_step_num - 1
                        
                    # Calculate percentage
                    if progress["total_steps"] > 0:
                        progress["percentage"] = min(
                            int(100 * progress["completed_steps"] / progress["total_steps"]),
                            99,
                        )

    @classmethod
    def get_thinking_steps(cls, session_id: str, start_index: int = 0) -> List[Dict]:
        """Get thinking steps for a session."""
        with cls._lock:
            if session_id not in cls._session_steps:
                return []
                
            steps = cls._session_steps[session_id][start_index:]
            return [
                {
                    "message": step.message,
                    "type": step.step_type,
                    "details": step.details,
                    "timestamp": step.timestamp,
                }
                for step in steps
            ]

    @classmethod
    def add_communication(cls, session_id: str, direction: str, content: str) -> None:
        """Record LLM communication."""
        message = f"{direction} communication"
        step = ThinkingStep(message, "communication", content)
        with cls._lock:
            if session_id in cls._session_steps:
                cls._session_steps[session_id].append(step)
```

## Running the Application

### Web Server Entry Point (`web_run.py`)

```python
import argparse
import os
import sys
from pathlib import Path

import uvicorn

def ensure_directories():
    """Ensure required directories exist."""
    templates_dir = Path("app/web/templates")
    templates_dir.mkdir(parents=True, exist_ok=True)

    static_dir = Path("app/web/static")
    static_dir.mkdir(parents=True, exist_ok=True)

    init_file = Path("app/web/__init__.py")
    if not init_file.exists():
        init_file.touch()

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="OpenManus Web Application Server")
    parser.add_argument("--no-browser", action="store_true", help="Don't auto-open browser")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default: 8000)")

    args = parser.parse_args()
    ensure_directories()

    # Set environment variables
    if args.no_browser:
        os.environ["AUTO_OPEN_BROWSER"] = "0"
    else:
        os.environ["AUTO_OPEN_BROWSER"] = "1"

    port = args.port

    print(f"🚀 OpenManus Web starting up...")
    print(f"Visit http://localhost:{port} to begin")

    uvicorn.run("app.web.app:app", host="0.0.0.0", port=port, reload=True)
```

## Execution Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Web UI    │◄────┤  FastAPI App  │◄────┤ ThinkingTracker│
└─────┬───────┘     └───────┬──────┘     └───────┬───────┘
      │                     │                    │
      │  1. Submit Prompt   │                    │
      ├────────────────────►│                    │
      │                     │                    │
      │                     │  2. Create Session │
      │                     ├───────────────────►│
      │                     │                    │
      │                     │  3. Initialize Flow│
      │                     │─────────┐          │
      │                     │         │          │
      │                     │         ▼          │
      │                     │    ┌──────────┐    │
      │                     │    │Planning  │    │
      │                     │    │  Flow    │    │
      │                     │    └────┬─────┘    │
      │                     │         │          │
      │                     │         ▼          │
      │                     │    ┌──────────┐    │
      │                     │    │  Manus   │    │
      │                     │    │  Agent   │    │
      │                     │    └────┬─────┘    │
      │                     │         │          │
      │                     │         ▼          │
      │                     │    ┌──────────┐    │
      │                     │    │  Tools   │    │
      │                     │    └────┬─────┘    │
      │                     │         │          │
      │                     │         │          │
      │                     │  4. Log Actions    │
      │                     │         ├──────────┘
      │                     │         │
      │  5. Stream Updates  │         │
      │◄────────────────────┤         │
      │  (via WebSocket)    │         │
      │                     │         │
      │                     │  6. Complete Task  │
      │                     │◄────────┘          │
      │                     │                    │
      │  7. Return Results  │                    │
      │◄────────────────────┤                    │
      │                     │                    │
```

## Key Design Patterns

### 1. Dependency Injection
The application uses dependency injection extensively:
- Agents can be configured with different sets of tools
- Flows can be configured with different agents
- LLM clients are injected into agents

### 2. Command Pattern
Tools implement a command pattern:
- Each tool encapsulates a specific action
- Tools have a consistent interface (run method)
- Tools are executed by name with arguments

### 3. Strategy Pattern
Different agent types implement different strategies:
- ReActAgent implements a think-act loop
- ToolCallAgent implements a tool-based strategy
- Manus combines these strategies with a rich set of tools

### 4. Observer Pattern
ThinkingTracker implements an observer pattern:
- Components register for updates
- WebSockets receive push notifications
- UI components react to state changes

### 5. Factory Pattern
FlowFactory creates appropriate flow instances:
- Centralizes flow creation logic
- Allows for different flow types
- Can be extended for new flow types

## Architectural Considerations

### Thread Safety
- The application uses threading locks to protect shared data
- WebSocket callbacks are managed carefully to avoid race conditions
- Session data is protected with locks

### Error Handling
- Exception handling at multiple levels
- Graceful degradation when components fail
- Detailed logging for debugging

### Performance
- Asynchronous processing with asyncio
- Background tasks for long-running operations
- WebSockets for efficient real-time updates

### Security
- Tool sandboxing (especially for Python execution)
- Input validation for all API endpoints
- Path traversal protection for file operations

## Future Enhancements

1. **Containerization**: Docker integration for isolated environments
2. **Database Storage**: Persistent storage for sessions and results
3. **Advanced Tool Execution**: Enhanced visualization of tool execution
4. **Session Replay**: Recording and replaying of agent actions
5. **User Authentication**: Access control for multi-user scenarios
6. **Advanced UI**: Terminal emulation and timeline visualization
