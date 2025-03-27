// connected_interface.js - Main JavaScript file for coordinating modules

export class App {
    constructor() {
        this.websocketManager = null;
        this.chatManager = null;
        this.thinkingManager = null;
        this.fileViewerManager = null;
        this.terminal = null;
        this.terminalFitAddon = null;
        this.activeTab = 'terminal';
        
        // Bind methods
        this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
        this.switchTab = this.switchTab.bind(this);
    }

    async init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // Initialize managers
        this.websocketManager = new WebSocketManager(this.handleWebSocketMessage);
        this.chatManager = new ChatManager();
        this.thinkingManager = new ThinkingManager();
        this.fileViewerManager = new FileViewerManager();

        // Initialize terminal
        this.initTerminal();

        // Initialize tab switching
        this.initTabs();

        // Add event listeners
        this.addEventListeners();
    }

    initTerminal() {
        try {
            // Create terminal instance
            this.terminal = new Terminal({
                cursorBlink: true,
                theme: {
                    background: '#1a1a1a',
                    foreground: '#f0f0f0'
                }
            });

            // Add fit addon
            this.terminalFitAddon = new window.FitAddon.FitAddon();
            this.terminal.loadAddon(this.terminalFitAddon);

            // Open terminal in container
            const terminalContainer = document.getElementById('terminal-container');
            this.terminal.open(terminalContainer);
            this.terminalFitAddon.fit();

            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.activeTab === 'terminal') {
                    this.terminalFitAddon.fit();
                }
            });

            // Add welcome message
            this.terminal.writeln('Welcome to Manus AI Terminal');
            this.terminal.writeln('--------------------------------');
            this.terminal.writeln('Terminal ready. Waiting for commands...\n');
        } catch (error) {
            console.error('Failed to initialize terminal:', error);
        }
    }

    initTabs() {
        const tabs = document.querySelectorAll('.computer-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update active tab
        this.activeTab = tabName;

        // Update tab buttons
        const tabs = document.querySelectorAll('.computer-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        // Update container visibility
        const containers = document.querySelectorAll('.computer-container');
        containers.forEach(container => {
            container.style.display = 'none';
        });
        document.getElementById(`${tabName}-container`).style.display = 'block';

        // Special handling for terminal
        if (tabName === 'terminal' && this.terminal) {
            this.terminalFitAddon.fit();
        }
    }

    addEventListeners() {
        // Send button
        document.getElementById('send-btn').addEventListener('click', () => {
            const input = document.getElementById('user-input');
            if (input.value.trim()) {
                this.sendMessage(input.value);
                input.value = '';
            }
        });

        // Input enter key
        document.getElementById('user-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('send-btn').click();
            }
        });

        // Stop button
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.websocketManager.sendStop();
            document.getElementById('stop-btn').disabled = true;
        });

        // Clear buttons
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.chatManager.clearMessages();
        });

        document.getElementById('clear-thinking').addEventListener('click', () => {
            this.thinkingManager.clearThinking();
        });

        // Language selector
        document.getElementById('language-select').addEventListener('change', (e) => {
            this.i18n.setLanguage(e.target.value);
        });
    }

    async sendMessage(message) {
        try {
            // Disable send button and enable stop button
            document.getElementById('stop-btn').disabled = false;

            // Clear previous thinking steps
            this.thinkingManager.clearThinking();

            // Add user message to chat
            this.chatManager.addUserMessage(message);

            // Send message to server
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: message }),
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Connect to WebSocket with session ID
            if (data.session_id) {
                this.websocketManager.connect(data.session_id);
            } else {
                throw new Error('No session ID received from server');
            }

        } catch (error) {
            console.error('Error:', error);
            this.chatManager.addSystemMessage(`Error: ${error.message}`);
            document.getElementById('send-btn').disabled = false;
            document.getElementById('stop-btn').disabled = true;
        }
    }

    handleWebSocketMessage(data) {
        try {
            console.log('App handling WebSocket message:', JSON.stringify(data));
            
            // Handle thinking steps - check for different property names
            const thinkingSteps = data.thinking_steps || data.thinkingSteps || [];
            if (thinkingSteps && Array.isArray(thinkingSteps) && thinkingSteps.length > 0) {
                console.log(`Received ${thinkingSteps.length} thinking steps from WebSocket`);
                
                // Check if this is an update to existing steps
                if (data.updated) {
                    console.log('This is an update to existing steps');
                    this.thinkingManager.addThinkingSteps(thinkingSteps, false, true);
                } else {
                    // Detect if this is a full update with all steps (initial load or large batch)
                    // or just an incremental update with new steps
                    const isFullUpdate = thinkingSteps.length > 5;
                    
                    // For full updates, replace the entire array; for small updates, just append
                    this.thinkingManager.addThinkingSteps(thinkingSteps, isFullUpdate, false);
                }
            } else {
                console.warn('No valid thinking steps found in the message');
            }

            // Handle terminal output
            if (data.terminal_output) {
                data.terminal_output.forEach(output => {
                    if (output.output) {
                        this.terminal.writeln(output.output);
                    }
                });
            }

            // Handle status changes
            if (data.status === 'completed' || data.status === 'error') {
                document.getElementById('stop-btn').disabled = true;
                document.getElementById('send-btn').disabled = false;
                if (data.result) {
                    this.chatManager.addAssistantMessage(data.result);
                }
            }

            // Handle logs
            if (data.logs) {
                data.logs.forEach(log => {
                    if (log.level === 'error') {
                        console.error(log.message);
                    } else {
                        console.log(log.message);
                    }
                });
            }

            // Handle user input request messages
            if (data.type === 'user_input_request') {
                const question = data.question;
                console.log('Received user input request from agent:', question);
                this.chatManager.addAgentQuestion(question);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
            this.chatManager.addSystemMessage(`Error: ${error.message}`);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
