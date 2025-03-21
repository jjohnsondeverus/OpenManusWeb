// connected_fileViewerManager.js - Handles file content viewing

export class FileViewerManager {
    constructor() {
        this.fileViewer = document.getElementById('file-viewer');
        this.fileName = document.getElementById('file-name');
        this.fileContent = document.getElementById('file-content');
        this.closeButton = document.getElementById('close-file-viewer');
    }

    // Initialize file viewer
    init() {
        // Initially hide file viewer
        this.hideFileViewer();

        // Bind close button event if it exists
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => {
                this.hideFileViewer();
            });
        } else {
            console.error("Close file viewer button not found!");
        }
    }

    // Show file content
    showFile(name, content) {
        // Set file name if element exists
        if (this.fileName) {
            this.fileName.textContent = name || "Unnamed File";
        }

        // Set file content, format based on file type
        if (this.fileContent) {
            const formattedContent = this.formatCode(content, this.getFileType(name || ""));
            this.fileContent.textContent = formattedContent;

            // Apply syntax highlighting based on file type
            this.applySyntaxHighlighting(name || "");
        }

        // Show file viewer
        if (this.fileViewer) {
            this.fileViewer.style.display = 'block';
        }
    }

    // Hide file viewer
    hideFileViewer() {
        if (this.fileViewer) {
            this.fileViewer.style.display = 'none';
        }
    }

    // Get file type
    getFileType(fileName) {
        if (!fileName) return '';
        const extension = fileName.split('.').pop().toLowerCase();
        return extension;
    }

    // Apply syntax highlighting
    applySyntaxHighlighting(fileName) {
        // Get file extension
        const extension = this.getFileType(fileName);

        if (!this.fileContent) {
            console.error("File content element not found!");
            return;
        }

        // Set class name based on file type
        this.fileContent.className = 'file-content';

        // Add language-specific class name
        switch (extension) {
            case 'html':
                this.fileContent.classList.add('language-html');
                break;
            case 'css':
                this.fileContent.classList.add('language-css');
                break;
            case 'js':
                this.fileContent.classList.add('language-javascript');
                break;
            case 'py':
                this.fileContent.classList.add('language-python');
                break;
            case 'json':
                this.fileContent.classList.add('language-json');
                break;
            case 'md':
                this.fileContent.classList.add('language-markdown');
                break;
            default:
                this.fileContent.classList.add('language-plaintext');
                break;
        }

        // If Prism.js is available, trigger syntax highlighting
        if (window.Prism && this.fileContent) {
            window.Prism.highlightElement(this.fileContent);
        }
    }

    // Format code
    formatCode(code, language) {
        // Simple code formatting, can be extended as needed
        if (!code) return '';

        // Simple HTML formatting
        if (language === 'html') {
            return this.formatHTML(code);
        }

        // JSON formatting
        if (language === 'json') {
            try {
                const obj = JSON.parse(code);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return code;
            }
        }

        return code;
    }

    // Format HTML
    formatHTML(html) {
        // Simple HTML formatting
        let formatted = '';
        let indent = 0;

        // Split HTML tags into an array
        const tags = html.split(/(<\/?[^>]+>)/g);

        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];

            // If it's a closing tag, reduce indent
            if (tag.match(/^<\//)) {
                indent--;
            }

            // Add appropriate indent
            if (tag.match(/^</) && !tag.match(/^<\//) && !tag.match(/\/>/)) {
                formatted += '  '.repeat(indent) + tag + '\n';
                indent++;
            } else if (tag.match(/^</) && tag.match(/\/>/)) {
                // Self-closing tag
                formatted += '  '.repeat(indent) + tag + '\n';
            } else if (tag.match(/^<\//)) {
                // Closing tag
                formatted += '  '.repeat(indent) + tag + '\n';
            } else if (tag.trim() !== '') {
                // Text content
                formatted += '  '.repeat(indent) + tag + '\n';
            }
        }

        return formatted;
    }
}
