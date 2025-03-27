import asyncio  # 添加导入
import json
import os  # 添加导入os模块
import time
from typing import Dict, List, Optional, Union, Any, Tuple

from pydantic import Field

from app.agent.base import BaseAgent
from app.flow.base import BaseFlow, FlowType
from app.llm import LLM
from app.logger import logger
from app.schema import AgentState, Message
from app.tool import PlanningTool
from app.tool.base import ToolResult
from app.web.thinking_tracker import ThinkingTracker  # Import ThinkingTracker


class PlanningFlow(BaseFlow):
    """A flow that manages planning and execution of tasks using agents."""

    llm: LLM = Field(default_factory=lambda: LLM())
    planning_tool: PlanningTool = Field(default_factory=PlanningTool)
    executor_keys: List[str] = Field(default_factory=list)
    active_plan_id: str = Field(default_factory=lambda: f"plan_{int(time.time())}")
    current_step_index: Optional[int] = None
    auto_step_index: int = Field(default=0)
    session_id: str = Field(default_factory=lambda: f"session_{int(time.time())}")
    max_steps: int = Field(default=20)

    def __init__(
        self, agents: Union[BaseAgent, List[BaseAgent], Dict[str, BaseAgent]], **data
    ):
        # Set executor keys before super().__init__
        if "executors" in data:
            data["executor_keys"] = data.pop("executors")

        # Set plan ID if provided
        if "plan_id" in data:
            data["active_plan_id"] = data.pop("plan_id")

        # Initialize the planning tool if not provided
        if "planning_tool" not in data:
            planning_tool = PlanningTool()
            data["planning_tool"] = planning_tool

        # Call parent's init with the processed data
        super().__init__(agents, **data)

        # Store session_id
        self.session_id = self.session_id

        # Set executor_keys to all agent keys if not specified
        if not self.executor_keys:
            self.executor_keys = list(self.agents.keys())

        # Set max_steps to the provided value or default to 20
        self.max_steps = data.get("max_steps", 20)
        self.auto_step_index = data.get("auto_step_index", 0)

    def get_executor(self, step_type: Optional[str] = None) -> BaseAgent:
        """
        Get an appropriate executor agent for the current step.
        Can be extended to select agents based on step type/requirements.
        """
        # If step type is provided and matches an agent key, use that agent
        if step_type and step_type in self.agents:
            return self.agents[step_type]

        # Otherwise use the first available executor or fall back to primary agent
        for key in self.executor_keys:
            if key in self.agents:
                return self.agents[key]

        # Fallback to primary agent
        return self.primary_agent

    async def execute(
        self,
        input_text: str,
        context: Optional[dict] = None,
        job_id: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> str:
        """Execute the flow with the given input text."""
        # Add a delay at the very start of execution to mitigate initial rate limits
        await asyncio.sleep(5)  # Try a 5-second initial delay (adjust as needed)

        print("Entering PlanningFlow.execute method") # Entry log
        print(f"Input text received: {input_text[:50]}...") # Log input text

        session_id = job_id or self.active_plan_id
        try:
            if not self.primary_agent:
                raise ValueError("No primary agent available")

            # Add initial thinking step for the whole execution
            ThinkingTracker.add_thinking_step(
                session_id, 
                f"Beginning execution of plan for: {input_text[:100]}{'...' if len(input_text) > 100 else ''}",
                "thinking"
            )

            # Create initial plan if input provided
            if input_text:
                print("Input text is present, creating initial plan.")
                try:
                    print("Before calling _create_initial_plan")
                    plan_result = await self._create_initial_plan(input_text, job_id)
                    print(f"After _create_initial_plan - plan ID: {self.active_plan_id}")
                    
                    # Check if plan creation actually succeeded and returned a result
                    if not plan_result:
                        logger.error(f"Plan creation method returned None or False for session {session_id}.")
                        ThinkingTracker.add_thinking_step(session_id, "Failed to create initial plan (internal error).", "error")
                        return "Error: Could not create an initial plan."

                    # Verify plan exists in the tool's storage (redundant if plan_result is valid, but safe)
                    if self.active_plan_id in self.planning_tool.plans:
                        print(f"Plan verified in planning_tool.plans")
                        # Debug the actual plan object
                        plan_data = self.planning_tool.plans[self.active_plan_id]
                        print(f"Plan steps count: {len(plan_data.get('steps', []))}")
                    else:
                        logger.error(
                            f"Plan creation failed. Plan ID {self.active_plan_id} not found in planning tool."
                        )
                        ThinkingTracker.add_thinking_step(session_id, f"Failed to create initial plan (plan ID {self.active_plan_id} not found).", "error")
                        return f"Failed to create plan for: {input_text}"
                except Exception as e:
                    print(f"Exception in plan creation: {str(e)}")
                    logger.error(f"Exception in plan creation: {str(e)}")
                    print("Raising exception from _create_initial_plan block.") # Log before raising
                    raise

            result = ""
            print("Plan creation block finished.") # Log right after the block
            print("About to enter plan execution loop.") # Before loop log
            print(f"Current result variable value: '{result}'") # Log current result value

            # Try-except block around the execution loop to catch any errors preventing loop entry
            try:
                print(f"Starting plan execution loop for {self.active_plan_id}")
                loop_iterations = 0
                print("Entering plan execution loop.") # Loop entry log
                while True:
                    loop_iterations += 1
                    print(f"\n--- Plan execution loop iteration {loop_iterations} ---") # Added newline for clarity

                    # Log current step statuses at the beginning of the loop
                    if self.active_plan_id in self.planning_tool.plans:
                        print("Fetching current step statuses from planning tool.") # Status fetch log
                        current_statuses = self.planning_tool.plans[self.active_plan_id].get("step_statuses", [])
                        print(f"Loop Start: Current step statuses for plan {self.active_plan_id}: {current_statuses}")
                    else:
                        print(f"Loop Start: Plan {self.active_plan_id} not found in planning_tool.")

                    # 检查是否被要求取消执行
                    if cancel_event and cancel_event.is_set():
                        logger.warning("Execution cancelled by user")
                        return result + "\n执行已被用户取消"

                    # Get current step to execute
                    print("Getting current step info using _get_current_step_info...") # Step info log
                    print("BEFORE _get_current_step_info()") # Log before _get_current_step_info
                    self.current_step_index, step_info = await self._get_current_step_info()
                    print(f"Current step index: {self.current_step_index}, Step info: {step_info}")
                    print("AFTER _get_current_step_info()") # Log after _get_current_step_info

                    # Exit if no more steps or plan completed
                    if self.current_step_index is None:
                        print("No more steps to execute, finalizing plan")
                        result += await self._finalize_plan()
                        print(f"Exiting PlanningFlow.execute normally. Final result length: {len(result)}") # Log normal exit
                        print("--- EXECUTE METHOD END (NORMAL) ---") # Explicit end marker
                        return result

                    # Execute current step with appropriate agent
                    step_type = step_info.get("type") if step_info else None
                    print(f"Getting executor for step {self.current_step_index}, step_type: {step_type}") # Executor log
                    executor = self.get_executor(step_type)
                    print(f"Executing step {self.current_step_index} with {executor.name}")
                    print("BEFORE _execute_step()") # Log before _execute_step
                    step_result = await self._execute_step(executor, step_info)
                    result += step_result + "\n"

                    # Check if agent wants to terminate
                    if hasattr(executor, "state") and executor.state == AgentState.FINISHED:
                        print("Executor requested termination")
                        break
                    print("AFTER _execute_step()") # Log after _execute_step

                    # Add a delay between steps
                    await asyncio.sleep(2)
            except Exception as loop_e: # Capture loop exceptions separately
                print(f"Exception INSIDE execution loop: {str(loop_e)}")
                logger.error(f"Exception INSIDE execution loop: {str(loop_e)}")
                raise

            print("Plan execution completed")
            return result
        except Exception as e:
            logger.error(f"Error in PlanningFlow: {str(e)}")
            print(f"!!! Caught exception in OUTER try-except block of PlanningFlow.execute: {str(e)}") # Log in outer except
            print(f"Error in PlanningFlow execute: {str(e)}")
            import traceback
            traceback.print_exc()
            return f"Execution failed: {str(e)}"

    async def _create_initial_plan(self, request: str, job_id: str = None) -> Optional[ToolResult]:
        """Create an initial plan based on the request using the flow's LLM and PlanningTool."""
        # 如果提供了job_id，则使用它；否则生成一个基于请求的job_id
        if not job_id:
            job_id = f"job_{request[:8].replace(' ', '_')}"
            if len(job_id) < 10:  # 如果太短，加上时间戳
                job_id = f"job_{int(time.time())}"

        session_id = job_id or self.active_plan_id
        log_file_path = f"logs/{job_id}.log"
        os.environ["OPENMANUS_TASK_ID"] = job_id
        os.environ["OPENMANUS_LOG_FILE"] = log_file_path

        # 设置日志文件名为job_id
        logger.add(log_file_path, rotation="100 MB")

        logger.info(f"Creating initial plan with ID: {self.active_plan_id}")
        
        # Add thinking step for plan creation
        ThinkingTracker.add_thinking_step(
            session_id,
            f"Creating a plan for: {request[:100]}{'...' if len(request) > 100 else ''}",
            "thinking"
        )

        # 原有代码继续执行
        # Create a system message for plan creation
        system_message = Message.system_message(
            "You are a planning assistant. Create a concise, actionable plan with clear steps. "
            "Focus on key milestones rather than detailed sub-steps. "
            "Optimize for clarity and efficiency."
        )

        # Create a user message with the request
        user_message = Message.user_message(
            f"Create a reasonable plan with clear steps to accomplish the task: {request}"
        )

        # Try to execute the LLM call
        try:
            # Call LLM with PlanningTool
            print(f"Calling LLM to create plan for '{request[:50]}...'")  # Debug log
            response = await self.llm.ask_tool(
                messages=[user_message],
                system_msgs=[system_message],
                tools=[self.planning_tool.to_param()],
                tool_choice="required",
            )
            
            print(f"LLM response received. Tool calls present: {bool(response.tool_calls)}")  # Debug log
            
        except Exception as e:
            print(f"Error creating plan with LLM: {str(e)}")  # Debug log
            logger.error(f"Error creating plan with LLM: {str(e)}")
            # Continue with fallback logic

        # Process tool calls if present
        if response.tool_calls:
            for tool_call in response.tool_calls:
                if tool_call.function.name == "planning":
                    # Parse the arguments
                    args = tool_call.function.arguments
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except json.JSONDecodeError:
                            logger.error(f"Failed to parse tool arguments: {args}")
                            continue

                    # Ensure plan_id is set correctly and execute the tool
                    args["plan_id"] = self.active_plan_id

                    # Execute the tool via ToolCollection instead of directly
                    result = await self.planning_tool.execute(**args)
                    print(f"DEBUG: planning_tool.execute returned: {result!r}") # Log the raw result
                    print(f"DEBUG: Type of result: {type(result)}") # Log the type

                    try: # Add try-except around the rest of the block
                        # Add created plan to thinking steps
                        if result:
                            session_id = job_id or self.active_plan_id
                            plan_steps = self.planning_tool.plans[self.active_plan_id].get("steps", [])
                            steps_text = "\n".join([f"- {step}" for step in plan_steps[:10]])
                            if len(plan_steps) > 10:
                                steps_text += f"\n...and {len(plan_steps) - 10} more steps"

                            print("DEBUG: Before adding 'Created plan' thinking step") # Debug log
                            ThinkingTracker.add_thinking_step(
                                session_id,
                                f"Created plan: {self.planning_tool.plans[self.active_plan_id].get('title', 'Untitled Plan')}",
                                "thinking",
                                {"plan": steps_text}
                            )
                            print("DEBUG: After adding 'Created plan' thinking step") # Debug log
                        else:
                            print("DEBUG: 'result' from planning_tool.execute was falsy.") # Debug log

                        print("DEBUG: Before logging plan creation result") # Debug log
                        logger.info(f"Plan creation result: {str(result)}")
                        print("DEBUG: After logging plan creation result") # Debug log

                        print("DEBUG: Before logging return message") # Debug log
                        logger.info(f"Session {session_id} - Returning plan_result from _create_initial_plan.") # Log before successful return
                        print("DEBUG: After logging return message") # Debug log

                        return result
                    except Exception as inner_e:
                        print(f"!!!!! EXCEPTION after planning_tool.execute: {inner_e}")
                        logger.error(f"!!!!! EXCEPTION after planning_tool.execute in session {session_id}: {inner_e}", exc_info=True)
                        return None # Return None to indicate failure within this block

        # If execution reached here, create a default plan
        logger.warning("Creating default plan")

        # Create default plan using the ToolCollection
        await self.planning_tool.execute(
            **{
                "command": "create",
                "plan_id": self.active_plan_id,
                "title": f"Plan for: {request[:50]}{'...' if len(request) > 50 else ''}",
                "steps": ["Analyze request", "Execute task", "Verify results"],
            }
        )

    async def _get_current_step_info(self) -> tuple[Optional[int], Optional[dict]]:
        """
        Parse the current plan to identify the first non-completed step's index and info.
        Returns (None, None) if no active step is found.
        """
        if (
            not self.active_plan_id
            or self.active_plan_id not in self.planning_tool.plans
        ):
            logger.error(f"Plan with ID {self.active_plan_id} not found")
            return None, None

        try:
            # Direct access to plan data from planning tool storage
            plan_data = self.planning_tool.plans[self.active_plan_id]
            steps = plan_data.get("steps", [])
            step_statuses = plan_data.get("step_statuses", [])

            # Add debug logs for plan data
            print(f"Plan data: {self.active_plan_id}, Steps: {len(steps)}, Statuses: {len(step_statuses)}")
            
            # Find first non-completed step
            for i, step in enumerate(steps):
                if i >= len(step_statuses):
                    status = "not_started"
                else:
                    status = step_statuses[i]
                    
                print(f"Step {i}: '{step[:30]}...' Status: {status}")

                if status in ["not_started", "in_progress"]:
                    # Extract step type/category if available
                    step_info = {"text": step}

                    # Try to extract step type from the text (e.g., [SEARCH] or [CODE])
                    import re

                    type_match = re.search(r"\[([A-Z_]+)\]", step)
                    if type_match:
                        step_info["type"] = type_match.group(1).lower()
                        
                    print(f"Found active step {i}: {step[:50]}")

                    # Mark current step as in_progress
                    try:
                        await self.planning_tool.execute(
                            command="mark_step",
                            plan_id=self.active_plan_id,
                            step_index=i,
                            step_status="in_progress",
                        )
                        print(f"Successfully marked step {i} as in_progress")
                    except Exception as e:
                        logger.warning(f"Error marking step as in_progress: {e}")
                        print(f"Error marking step as in_progress: {e}")
                        # Update step status directly if needed
                        if i < len(step_statuses):
                            step_statuses[i] = "in_progress"
                        else:
                            while len(step_statuses) < i:
                                step_statuses.append("not_started")
                            step_statuses.append("in_progress")

                        plan_data["step_statuses"] = step_statuses

                    return i, step_info

            print("No active step found in plan")
            return None, None  # No active step found

        except Exception as e:
            logger.warning(f"Error finding current step index: {e}")
            print(f"Error in _get_current_step_info: {e}")
            return None, None

    async def _execute_step(self, executor: BaseAgent, step_info: dict) -> str:
        """Execute the current step with the specified agent using agent.run()."""
        # Prepare context for the agent with current plan status
        plan_status = await self._get_plan_text()
        step_text = step_info.get("text", f"Step {self.current_step_index}")
        session_id = os.environ.get("OPENMANUS_TASK_ID", self.active_plan_id)

        # Generate a unique step ID only for plan steps that need to be tracked/updated
        if self.current_step_index is not None:
            step_id = f"plan_step_{self.current_step_index + 1}"
        else:
            step_id = None

        # Add thinking step for the current task
        # Use detailed step information rather than just the text
        step_details = None
        if step_id:
            step_details = {
                "step_id": step_id,
                "step_index": self.current_step_index + 1 if self.current_step_index is not None else 0,
                "step_text": step_text,
                "status": "in_progress"
            }

        ThinkingTracker.add_thinking_step(
            session_id,
            f"Working on step {self.current_step_index + 1 if self.current_step_index is not None else '?'} (index: {self.current_step_index}): {step_text}", # Added index to log
            "thinking",
            step_details
        )

        # Create a prompt for the agent to execute the current step
        step_prompt = f"""
        CURRENT PLAN STATUS:
        {plan_status}

        YOUR CURRENT TASK:
        You are now working on step {self.current_step_index}: "{step_text}"

        Please execute this step using the appropriate tools. When you're done, provide a summary of what you accomplished.
        """

        # Use agent.run() to execute the step
        try:
            print(f"Starting execution of step {self.current_step_index + 1 if self.current_step_index is not None else '?'} (index: {self.current_step_index}): {step_text}") # Added index to log
            print(f"BEFORE executor.run() - Step Index: {self.current_step_index}") # Added log before executor.run
            step_result = await executor.run(step_prompt)
            print(f"AFTER executor.run() - Step Index: {self.current_step_index}") # Added log after executor.run
            print(f"Successfully completed executor.run for step {self.current_step_index + 1 if self.current_step_index is not None else '?'}") # Clarified log

            # Mark the step as completed after successful execution
            print(f"Attempting to mark step {self.current_step_index} as completed...") # Log before calling mark_step_completed
            print(f"BEFORE _mark_step_completed() - Step Index: {self.current_step_index}") # Added log before _mark_step_completed
            await self._mark_step_completed(self.current_step_index, self.active_plan_id)
            print(f"AFTER _mark_step_completed() - Step Index: {self.current_step_index}") # Added log after _mark_step_completed

            # Add a delay after each step to mitigate rate limits
            await asyncio.sleep(2)  # 2-second delay between steps (adjust as needed)

            # Add completion thinking step with more detailed information
            completion_step_details = None
            if self.current_step_index is not None:
                completion_step_id = f"plan_step_{self.current_step_index + 1}"
                completion_step_details = {
                    "step_id": completion_step_id,
                    "step_index": self.current_step_index + 1,
                    "step_text": step_text,
                    "status": "completed",
                    "result": step_result
                }

            ThinkingTracker.add_thinking_step(
                os.environ.get("OPENMANUS_TASK_ID", self.active_plan_id),
                f"Completed step {self.current_step_index + 1 if self.current_step_index is not None else '?'} (index: {self.current_step_index}): {step_text}", # Added index to log
                "thinking",
                completion_step_details
            )

            return step_result
        except Exception as e:
            print(f"Error in _execute_step for step index {self.current_step_index}: {e}") # Log error with step index
            ThinkingTracker.add_thinking_step(
                session_id,
                f"Error executing step {self.current_step_index + 1 if self.current_step_index is not None else '?'}: {step_text}. Error: {e}",
                "error",
                {"error": str(e), "step_text": step_text}
            )
            return f"Error executing step: {e}"

    async def _get_plan_text(self) -> str:
        """Retrieve the text representation of the current plan."""
        if (
            not self.active_plan_id
            or self.active_plan_id not in self.planning_tool.plans
        ):
            logger.error(f"Plan with ID {self.active_plan_id} not found")
            return f"Error: Unable to retrieve plan with ID {self.active_plan_id}"

        try:
            # Direct access to plan data from planning tool storage
            plan_data = self.planning_tool.plans[self.active_plan_id]
            steps = plan_data.get("steps", [])
            step_statuses = plan_data.get("step_statuses", [])
            step_notes = plan_data.get("step_notes", [])

            # Add debug logs for plan data
            print(f"Plan data: {self.active_plan_id}, Steps: {len(steps)}, Statuses: {len(step_statuses)}, Notes: {len(step_notes)}")
            
            plan_text = ""
            for i, (step, status, notes) in enumerate(
                zip(steps, step_statuses, step_notes)
             ):
                 if status == "completed":
                     status_mark = "[✓]"
                 elif status == "in_progress":
                     status_mark = "[→]"
                 elif status == "blocked":
                     status_mark = "[!]"
                 else: # "not_started" or unknown
                     status_mark = "[ ]"

                 plan_text += f"{i}. {status_mark} {step}\n"
                 if notes:
                     plan_text += f"   Notes: {notes}\n"

            return plan_text
        except Exception as e:
            logger.error(f"Error generating plan text from storage: {e}")
            return f"Error: Unable to retrieve plan with ID {self.active_plan_id}"

    async def _mark_step_completed(self, step_index: int, plan_id: str):
        """Mark a step as completed using the planning tool."""
        logger.debug(f"Attempting to mark step {step_index} as completed for plan {plan_id} using flow's planning_tool...")
        try:
            # Use the flow's planning_tool instance directly
            planning_tool = self.planning_tool
            if not planning_tool:
                logger.error("Flow's planning_tool instance is missing.")
                return

            # Call the tool's method to mark the step completed
            await planning_tool.mark_step_completed(plan_id=plan_id, step_index=step_index)
            logger.info(f"Called mark_step_completed on flow's planning_tool for step {step_index}, plan {plan_id}.")
        except Exception as e:
            logger.error(f"Error calling mark_step_completed on flow's planning_tool for plan {plan_id}: {e}", exc_info=True)
            # Optionally add a thinking step for this error
            ThinkingTracker.add_thinking_step(self.session_id, f"Internal error: Failed to mark step {step_index+1} as completed. Error: {e}", details={"error": str(e)})

    async def _finalize_plan(self) -> str:
        """Finalize the plan execution and return a summary."""
        final_message = "Plan execution completed successfully.\n\n"
        # Optionally, you can add more details here, like a summary of the plan,
        # or aggregate results from steps if needed.
        ThinkingTracker.add_thinking_step(self.session_id, "Plan finalized and completed.", "conclusion")
        logger.info("Plan execution finalized.")
        return final_message
