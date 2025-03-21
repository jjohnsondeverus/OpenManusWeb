// connected_fileViewerManager.js - Handles file content viewing

export class FileViewerManager {
    constructor() {
        this.fileViewer = null;
        this.fileName = null;
        this.fileContent = null;
        this.closeButton = null;
        this.isVisible = false;
    }

    // Initialize the file viewer
    init() {
        console.log('Initializing FileViewerManager...');
        
        // Initialize DOM elements
        this.fileViewer = document.getElementById('file-viewer');
        this.fileName = document.getElementById('file-name');
        this.fileContent = document.getElementById('file-content');
        this.closeButton = document.getElementById('close-file-viewer');
        
        // Check if elements exist
        if (!this.fileViewer) {
            console.warn('File viewer element not found');
        }
        
        if (!this.fileName) {
            console.warn('File name element not found');
        }
        
        if (!this.fileContent) {
            console.warn('File content element not found');
        }
        
        // Set up close button if it exists
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => {
                this.hideFile();
            });
        } else {
            console.warn('Close file viewer button not found');
        }

        // Initially hide the file viewer
        this.hideFile();
    }

    // Show file content
    showFile(name, content) {
        if (!this.fileViewer) {
            console.error('Cannot show file: File viewer element not found');
            return;
        }
        
        // Update file name
        if (this.fileName) {
            this.fileName.textContent = name || 'Unnamed File';
        }
        
        // Update file content with syntax highlighting
        if (this.fileContent) {
            this.applySyntaxHighlighting(name, content);
        }
        
        // Show file viewer
        this.fileViewer.style.display = 'block';
        this.isVisible = true;
    }

    // Hide file viewer
    hideFile() {
        if (this.fileViewer) {
            this.fileViewer.style.display = 'none';
            this.isVisible = false;
        }
    }

    // Get file type
    getFileType(fileName) {
        if (!fileName) return 'plaintext';
        
        const ext = fileName.split('.').pop().toLowerCase();
        
        switch (ext) {
            case 'js':
                return 'javascript';
            case 'py':
                return 'python';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'txt':
                return 'plaintext';
            default:
                return 'plaintext';
        }
    }

    // Apply syntax highlighting
    applySyntaxHighlighting(fileName, content) {
        if (!this.fileContent) {
            console.error('Cannot apply syntax highlighting: File content element not found');
            return;
        }
        
        // Clear existing content
        this.fileContent.innerHTML = '';
        
        // Fallback for empty content
        if (!content) {
            this.fileContent.textContent = 'Empty file or content unavailable';
            return;
        }
        
        // Determine file type
        const fileType = this.getFileType(fileName);
        
        // Create pre and code elements
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        
        // Add appropriate class for syntax highlighting
        code.className = `language-${fileType}`;
        
        // Format content based on file type
        code.textContent = this.formatCode(content, fileType);
        
        // Add to DOM
        pre.appendChild(code);
        this.fileContent.appendChild(pre);
        
        // Apply highlighting if highlight.js is available
        if (window.hljs) {
            try {
                window.hljs.highlightElement(code);
            } catch (e) {
                console.error('Error applying syntax highlighting:', e);
            }
        }
    }

    // Format code
    formatCode(content, fileType) {
        if (!content) return '';
        
        try {
            // Handle special formatting for certain file types
            if (fileType === 'json') {
                // Try to parse and format JSON
                try {
                    const parsed = JSON.parse(content);
                    return JSON.stringify(parsed, null, 2);
                } catch (e) {
                    console.warn('Failed to parse JSON, showing as-is');
                    return content;
                }
            }
            
            if (fileType === 'html') {
                // We could add HTML formatting here if needed
                return content;
            }
            
            // Default: return content as-is
            return content;
            
        } catch (e) {
            console.error('Error formatting code:', e);
            return content;
        }
    }
}
