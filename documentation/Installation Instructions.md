Method 2: Using uv (Recommended)
Install uv (A fast Python package installer and resolver):
curl -LsSf https://astral.sh/uv/install.sh | sh
Clone the repository:
git clone @https://github.com/YunQiAI/OpenManusWeb.git (we already cloned did this; the dir is /Users/aimluser/OpenManusWebFork)
cd OpenManus
Create a new virtual environment and activate it:
uv venv
source .venv/bin/activate  # On Unix/macOS
# Or on Windows:
# .venv\Scripts\activate
Install dependencies:
uv pip install -r requirements.txt

Configuration
OpenManus requires configuration for the LLM APIs it uses. Follow these steps to set up your configuration:

Create a config.toml file in the config directory (you can copy from the example):
cp config/config.example.toml config/config.toml
Edit config/config.toml to add your API keys and customize settings:
# Global LLM configuration
[llm]
model = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key = "sk-..."  # Replace with your actual API key
max_tokens = 4096
temperature = 0.0

# Optional configuration for specific LLM models
[llm.vision]
model = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key = "sk-..."  # Replace with your actual API key
Quick Start
One line for run OpenManus:

python main.py --web
Then input your idea via terminal!

Web Interface
You can also use OpenManus through a user-friendly web interface:

uvicorn app.web.app:app --reload
or

python web_run.py
Then open your browser and navigate to http://localhost:8000 to access the web interface. The web UI allows you to:

Interact with OpenManus using a chat-like interface
Monitor AI thinking process in real-time
View and access workspace files
See execution progress visually
For unstable version, you also can run:

python run_flow.py