// connected_interface.js - Main JavaScript file, responsible for initializing and coordinating other modules

// Import manager classes
import { WebSocketManager } from './connected_websocketManager.js';
import { ChatManager } from './connected_chatManager.js';
import { ThinkingManager } from './connected_thinkingManager.js';
import { WorkspaceManager } from './connected_workspaceManager.js';
import { FileViewerManager } from './connected_fileViewerManager.js';
import { TerminalManager } from './connected_terminalManager.js';
import { t, updatePageTexts as updateLanguageElements, setLanguage } from './i18n.js';

// Main App class
class App {
    constructor() {
        console.log("Initializing App...");
        
        // Create manager instances
        this.wsManager = new WebSocketManager();
        this.chatManager = new ChatManager();
        this.thinkingManager = new ThinkingManager();
        this.workspaceManager = new WorkspaceManager();
        this.fileViewerManager = new FileViewerManager();
        this.terminalManager = new TerminalManager();
        
        // Initialize application
        this.init();
    }
    
    // Initialize app
    init() {
        try {
            // Initialize all managers
            console.log("Initializing managers...");
            
            // Initialize terminal manager first (for logging)
            this.terminalManager.init();
            this.terminalManager.addLine("Initializing application...", "system");
            
            // Initialize other managers
            this.wsManager.init();
            this.chatManager.init();
            this.thinkingManager.init();
            
            // Initialize file-related managers
            this.fileViewerManager.init();
            this.workspaceManager.init((file) => {
                // File click callback
                if (file && file.path) {
                    this.fileViewerManager.showFile(file.path, file.name);
                }
            });
            
            // Bind events
            this.bindEvents();
            
            // Update all language elements
            updateLanguageElements();
            
            console.log("App initialization complete");
            this.terminalManager.addLine("Application initialized successfully", "system");
            
            // Load workspace files
            this.loadWorkspace();
        } catch (error) {
            console.error("Error during app initialization:", error);
            this.terminalManager.addLine(`Error initializing application: ${error.message}`, "error");
        }
    }
    
    // Bind UI events
    bindEvents() {
        // Message sending
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        
        // Check if elements exist before binding
        if (messageInput && sendButton) {
            // Send button click
            sendButton.addEventListener('click', () => {
                this.sendMessage();
            });
            
            // Enter key in input
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        } else {
            console.error("Could not find message input or send button elements");
        }
        
        // Workspace refresh
        const refreshButton = document.getElementById('refresh-workspace');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.loadWorkspace();
            });
        } else {
            console.warn("Refresh workspace button not found");
        }
        
        // WebSocket message handling
        this.wsManager.onMessage((data) => {
            this.handleWebSocketMessage(data);
        });
        
        // WebSocket connection status
        this.wsManager.onStatusChange((isConnected) => {
            const statusElement = document.getElementById('status-indicator');
            if (statusElement) {
                statusElement.className = isConnected ? 'connected' : 'disconnected';
                statusElement.title = isConnected ? 'Connected' : 'Disconnected';
            }
        });
        
        // Language selector
        const languageSelector = document.getElementById('language-selector');
        if (languageSelector) {
            languageSelector.addEventListener('change', (e) => {
                const selectedLanguage = e.target.value;
                this.changeLanguage(selectedLanguage);
            });
        }
    }
    
    // Send message to backend
    sendMessage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (message) {
            // Add user message to chat
            this.chatManager.addUserMessage(message);
            
            // Clear input
            messageInput.value = '';
            
            // Add to terminal
            this.terminalManager.addLine(message, 'command');
            
            // Send to backend
            this.wsManager.sendMessage({
                type: 'user_message',
                content: message
            });
            
            // Show thinking indicator
            this.chatManager.showThinking();
        }
    }
    
    // Handle WebSocket messages
    handleWebSocketMessage(data) {
        try {
            if (!data || !data.type) {
                console.error("Invalid WebSocket message received:", data);
                return;
            }
            
            console.log(`Received ${data.type} message from backend`);
            
            switch (data.type) {
                case 'assistant_message':
                    this.chatManager.addAssistantMessage(data.content);
                    break;
                    
                case 'thinking_step':
                    if (data.steps) {
                        this.thinkingManager.addThinkingSteps(data.steps);
                    }
                    break;
                    
                case 'terminal_output':
                    this.terminalManager.addOutput(data.content);
                    break;
                    
                case 'workspace_update':
                    if (data.workspaces) {
                        this.workspaceManager.updateWorkspaces(data.workspaces);
                    }
                    break;
                    
                case 'error':
                    console.error("Error from backend:", data.content);
                    this.chatManager.addErrorMessage(data.content);
                    this.terminalManager.addLine(data.content, 'error');
                    break;
                    
                default:
                    console.warn("Unknown message type:", data.type);
            }
        } catch (error) {
            console.error("Error handling WebSocket message:", error);
            this.terminalManager.addLine(`Error handling message: ${error.message}`, "error");
        }
    }
    
    // Load workspace files
    loadWorkspace() {
        console.log("Loading workspace files...");
        this.terminalManager.addLine("Loading workspace files...", "system");
        
        this.wsManager.sendMessage({
            type: 'get_workspace'
        });
    }
    
    // Change interface language
    changeLanguage(language) {
        console.log(`Changing language to ${language}`);
        
        // Update language
        setLanguage(language);
        
        // Update all text elements
        updateLanguageElements();
        
        // Add to terminal
        this.terminalManager.addLine(`Language changed to ${language}`, "system");
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM loaded, starting application");
        window.app = new App();
    } catch (error) {
        console.error("Error starting application:", error);
        
        // Try to show error in terminal if possible
        const terminalContainer = document.getElementById('terminal-output');
        if (terminalContainer) {
            const errorLine = document.createElement('div');
            errorLine.className = 'terminal-line error';
            errorLine.innerHTML = `<span class="error-prefix">CRITICAL ERROR:</span> ${error.message}`;
            terminalContainer.appendChild(errorLine);
        }
        
        // Show alert as fallback
        alert(`Error starting application: ${error.message}`);
    }
});
