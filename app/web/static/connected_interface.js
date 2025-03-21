// connected_interface.js - Main JavaScript file, responsible for initializing and coordinating other modules

// Import manager classes
import { WebSocketManager } from '/static/connected_websocketManager.js';
import { ChatManager } from '/static/connected_chatManager.js';
import { ThinkingManager } from '/static/connected_thinkingManager.js';
import { WorkspaceManager } from '/static/connected_workspaceManager.js';
import { FileViewerManager } from '/static/connected_fileViewerManager.js';
import { TerminalManager } from '/static/connected_terminalManager.js';
import { initLanguage, setLanguage, updatePageTexts, t } from '/static/i18n.js';

// Main application class
class App {
    constructor() {
        this.sessionId = null;
        this.isProcessing = false;

        // Initialize managers
        this.websocketManager = new WebSocketManager(this.handleWebSocketMessage.bind(this));
        this.chatManager = new ChatManager(this.handleSendMessage.bind(this));
        this.thinkingManager = new ThinkingManager();
        this.workspaceManager = new WorkspaceManager(this.handleFileClick.bind(this));
        this.fileViewerManager = new FileViewerManager();
        this.terminalManager = new TerminalManager();
        
        // Bind UI events
        this.bindEvents();
    }

    // Initialize application
    init() {
        console.log('OpenManus Web application initializing...');

        // Initialize language settings
        const currentLang = initLanguage();
        const langSelector = document.getElementById('language-selector');
        if (langSelector) {
            langSelector.value = currentLang;
        }
        updatePageTexts();

        // Initialize managers
        this.chatManager.init();
        this.thinkingManager.init();
        this.workspaceManager.init();
        this.fileViewerManager.init();
        this.terminalManager.init();

        // Load workspace files
        this.loadWorkspaceFiles();
    }

    // Bind UI events
    bindEvents() {
        // Stop button
        document.getElementById('stop-btn').addEventListener('click', () => {
            if (this.sessionId && this.isProcessing) {
                this.stopProcessing();
            }
        });

        // Clear button
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.chatManager.clearMessages();
        });

        // Clear thinking records button
        document.getElementById('clear-thinking').addEventListener('click', () => {
            this.thinkingManager.clear();
        });

        // Refresh files button
        document.getElementById('refresh-files').addEventListener('click', () => {
            this.loadWorkspaceFiles();
        });

        // Language selector
        document.getElementById('language-selector').addEventListener('change', (event) => {
            const selectedLang = event.target.value;
            setLanguage(selectedLang);
            updatePageTexts();
            this.updateDynamicTexts();
        });
    }

    // Update dynamically generated text
    updateDynamicTexts() {
        // Update status indicator
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator && statusIndicator.textContent.includes('Processing')) {
            statusIndicator.textContent = t('processing_request');
        } else if (statusIndicator && statusIndicator.textContent.includes('stopped')) {
            statusIndicator.textContent = t('processing_stopped');
        }

        // Update record count
        const recordCount = document.getElementById('record-count');
        if (recordCount) {
            const count = parseInt(recordCount.textContent);
            if (!isNaN(count)) {
                recordCount.textContent = t('records_count', { count });
            }
        }

        // Update refresh countdown
        const refreshCountdown = document.getElementById('refresh-countdown');
        if (refreshCountdown) {
            const seconds = refreshCountdown.textContent.match(/\d+/);
            if (seconds) {
                refreshCountdown.textContent = t('refresh_countdown', { seconds: seconds[0] });
            }
        }
    }

    // Handle send message
    async handleSendMessage(message) {
        if (this.isProcessing) {
            console.log('Already processing, please wait...');
            return;
        }

        this.isProcessing = true;
        
        // Get buttons and check if they exist
        const sendBtn = document.getElementById('send-btn');
        const stopBtn = document.getElementById('stop-btn');
        
        if (sendBtn) sendBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        
        // Check if status indicator exists, create if not
        let statusIndicator = document.getElementById('status-indicator');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'status-indicator';
            statusIndicator.className = 'status-indicator';
            
            // Add status indicator below input container
            const inputContainer = document.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.parentNode.insertBefore(statusIndicator, inputContainer.nextSibling);
            } else {
                console.warn('Could not find suitable location for status indicator');
            }
        }
        
        if (statusIndicator) {
            statusIndicator.textContent = t('processing_request');
        }

        try {
            // Send API request to create new session
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: message }),
            });

            if (!response.ok) {
                throw new Error(t('api_error', { status: response.status }));
            }

            const data = await response.json();
            this.sessionId = data.session_id;

            // Add user message to chat
            this.chatManager.addUserMessage(message);

            // Connect WebSocket
            this.websocketManager.connect(this.sessionId);

            // Reset thinking records
            this.thinkingManager.clear();
            
            // Clear terminal output
            this.clearTerminalOutput();

        } catch (error) {
            console.error(t('send_message_error', { message: error.message }), error);
            this.chatManager.addSystemMessage(t('error_occurred', { message: error.message }));
            this.isProcessing = false;
            document.getElementById('send-btn').disabled = false;
            document.getElementById('stop-btn').disabled = true;
            document.getElementById('status-indicator').textContent = '';
        }
    }

    // Handle WebSocket messages
    handleWebSocketMessage(data) {
        console.log('Received WebSocket message:', data);

        // Update processing status
        if (data.status) {
            this.isProcessing = data.status === 'processing' || data.status === 'thinking';

            // Update UI status
            document.getElementById('stop-btn').disabled = !this.isProcessing;
            document.getElementById('send-btn').disabled = this.isProcessing;
            
            // Display status
            this.chatManager.updateStatus(data.status);
            
            // Update progress bar
            if (data.progress) {
                this.updateProgressBar(data.progress.percentage || 0);
            }
        }

        // Handle thinking steps
        if (data.thinking_steps && data.thinking_steps.length > 0) {
            this.thinkingManager.addThinkingSteps(data.thinking_steps);
        }

        // Handle chat messages
        if (data.log && data.log.length > 0) {
            this.chatManager.addMessages(data.log);
        }
        
        // Handle terminal output
        if (data.terminal_output && data.terminal_output.length > 0) {
            this.terminalManager.addOutput(data.terminal_output);
        }

        // Handle final result
        if (data.result && !this.isProcessing) {
            console.log('Processing complete, result:', data.result);
            this.chatManager.addBotMessage(data.result);
        }

        // Handle error messages
        if (data.error) {
            console.error('WebSocket error:', data.error);
            this.chatManager.addErrorMessage(data.error);
        }
    }

    // Stop processing
    async stopProcessing() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/chat/${this.sessionId}/stop`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error(t('api_error', { status: response.status }));
            }

            console.log('Processing stopped');
            this.chatManager.addSystemMessage(t('processing_stopped'));
            document.getElementById('status-indicator').textContent = t('processing_stopped');
            document.getElementById('send-btn').disabled = false;
            document.getElementById('stop-btn').disabled = true;
            this.isProcessing = false;

        } catch (error) {
            console.error(t('stop_processing_error', { message: error.message }), error);
            this.chatManager.addSystemMessage(t('error_occurred', { message: error.message }));
        }
    }

    // Load workspace files
    async loadWorkspaceFiles() {
        try {
            const response = await fetch('/api/files');
            if (!response.ok) {
                throw new Error(t('api_error', { status: response.status }));
            }

            const data = await response.json();
            this.workspaceManager.updateWorkspaces(data.workspaces);

        } catch (error) {
            console.error(t('load_workspace_error', { message: error.message }), error);
            this.terminalManager.addLine(`Error loading workspace files: ${error.message}`, 'error');
        }
    }

    // Handle file click
    async handleFileClick(filePath) {
        try {
            const response = await fetch(`/api/files/${encodeURIComponent(filePath)}`);
            if (!response.ok) {
                throw new Error(t('api_error', { status: response.status }));
            }

            const data = await response.json();
            this.fileViewerManager.showFile(data.name, data.content);

        } catch (error) {
            console.error(t('load_file_error', { message: error.message }), error);
            this.chatManager.addSystemMessage(t('error_occurred', { message: error.message }));
        }
    }

    // Clear terminal output
    clearTerminalOutput() {
        this.terminalManager.clear();
    }
    
    // Handle terminal output - Deprecated, use TerminalManager instead
    handleTerminalOutput(output) {
        this.terminalManager.addOutput(output);
    }
    
    // Update progress bar
    updateProgressBar(percentage) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }
    
    // HTML escape
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();

    // Expose app instance globally for debugging
    window.app = app;
});
