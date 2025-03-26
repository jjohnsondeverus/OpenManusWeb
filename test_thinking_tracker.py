#!/usr/bin/env python
import sys
from app.web.thinking_tracker import ThinkingTracker

def test_terminal_output_capture():
    session_id = "test_session"
    # Start tracking for the session
    ThinkingTracker.start_tracking(session_id)
    # Add a couple of terminal outputs
    ThinkingTracker.add_terminal_output(session_id, "Test output 1", thinking_step_id="123", tool_name="dummy_tool")
    ThinkingTracker.add_terminal_output(session_id, "Test output 2", thinking_step_id="456", tool_name="dummy_tool")
    # Retrieve and print outputs
    outputs = ThinkingTracker.get_terminal_output(session_id)
    print("Terminal outputs:", outputs)
    # Check that the outputs list has the expected number of entries (should be 2)
    if len(outputs) != 2:
        print("Test failed: Expected 2 outputs, found", len(outputs))
        sys.exit(1)
    else:
        print("Test succeeded.")

if __name__ == "__main__":
    test_terminal_output_capture()