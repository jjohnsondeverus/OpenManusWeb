// connected_terminalManager.js - Terminal output manager

export class TerminalManager {
    constructor() {
        this.terminalContainer = document.getElementById('terminal-output');
        this.maxLines = 1000; // Maximum number of lines to keep in the terminal
        this.lineCount = 0;
    }

    // Initialize terminal manager
    init() {
        console.log('Initializing TerminalManager...');
        
        // Create terminal container if it doesn't exist
        if (!this.terminalContainer) {
            console.warn('Terminal container not found, creating one');
            this.terminalContainer = document.createElement('div');
            this.terminalContainer.id = 'terminal-output';
            this.terminalContainer.className = 'terminal-output';
            
            // Find terminal section to append to
            const terminalSection = document.querySelector('.terminal-section .section-content');
            if (terminalSection) {
                terminalSection.appendChild(this.terminalContainer);
            } else {
                console.error('Terminal section not found, cannot create terminal output container');
                return;
            }
        }
        
        // Initial welcome message
        this.addLine('Terminal ready', 'system');
    }

    // Add a single line to the terminal
    addLine(text, type = 'output') {
        if (!this.terminalContainer) return;
        
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        // Escape HTML characters
        const safeText = this.escapeHtml(text);
        
        // Format based on line type
        switch (type) {
            case 'command':
                line.innerHTML = `<span class="prompt">$</span> ${safeText}`;
                break;
            case 'error':
                line.innerHTML = `<span class="error-prefix">ERROR:</span> ${safeText}`;
                break;
            case 'system':
                line.innerHTML = `<span class="system-prefix">SYSTEM:</span> ${safeText}`;
                break;
            default:
                line.textContent = text;
        }
        
        this.terminalContainer.appendChild(line);
        this.lineCount++;
        
        // Trim old lines if exceeding max
        this.trimLines();
        
        // Auto-scroll to bottom
        this.scrollToBottom();
    }

    // Add multiple lines at once
    addOutput(output) {
        if (!output) return;
        
        // Handle array of outputs
        if (Array.isArray(output)) {
            output.forEach(line => this.addLine(line));
            return;
        }
        
        // Handle string output - split by newlines
        if (typeof output === 'string') {
            const lines = output.split('\n');
            lines.forEach(line => this.addLine(line));
            return;
        }
        
        // Handle object output
        if (typeof output === 'object') {
            // If it has a command property, add it as a command
            if (output.command) {
                this.addLine(output.command, 'command');
            }
            
            // If it has output property, add it as normal output
            if (output.output) {
                if (Array.isArray(output.output)) {
                    output.output.forEach(line => this.addLine(line));
                } else {
                    this.addLine(output.output);
                }
            }
            
            // If it has error property, add it as an error
            if (output.error) {
                this.addLine(output.error, 'error');
            }
        }
    }

    // Clear all terminal output
    clear() {
        if (this.terminalContainer) {
            this.terminalContainer.innerHTML = '';
            this.lineCount = 0;
            this.addLine('Terminal cleared', 'system');
        }
    }

    // Trim old lines if exceeding maximum
    trimLines() {
        if (!this.terminalContainer || this.lineCount <= this.maxLines) return;
        
        const linesToRemove = this.lineCount - this.maxLines;
        const lines = this.terminalContainer.querySelectorAll('.terminal-line');
        
        for (let i = 0; i < linesToRemove && i < lines.length; i++) {
            lines[i].remove();
        }
        
        this.lineCount = Math.min(this.lineCount, this.maxLines);
    }

    // Scroll terminal to bottom
    scrollToBottom() {
        if (this.terminalContainer) {
            this.terminalContainer.scrollTop = this.terminalContainer.scrollHeight;
        }
    }
    
    // HTML escape utility
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
} 