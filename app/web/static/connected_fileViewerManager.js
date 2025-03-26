// connected_fileViewerManager.js - 处理文件内容查看

export class FileViewerManager {
    constructor() {
        this.editorContainer = document.getElementById('editor-container');
        this.editor = null;
        this.currentFile = null;
        
        // Initialize Monaco editor
        this.initEditor();
    }

    async initEditor() {
        try {
            // Wait for Monaco to be loaded
            await this.loadMonacoEditor();
            
            // Create editor instance
            this.editor = monaco.editor.create(this.editorContainer, {
                value: '',
                language: 'plaintext',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: {
                    enabled: true
                },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                tabSize: 4,
                insertSpaces: true,
                wordWrap: 'on'
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.editor) {
                    this.editor.layout();
                }
            });

            // Add welcome message
            this.showWelcomeMessage();
        } catch (error) {
            console.error('Failed to initialize Monaco editor:', error);
        }
    }

    loadMonacoEditor() {
        return new Promise((resolve, reject) => {
            if (window.monaco) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs/loader.js';
            script.onload = () => {
                window.require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs' }});
                window.require(['vs/editor/editor.main'], resolve);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    showWelcomeMessage() {
        const welcomeMessage = 
`// Welcome to Manus AI Editor
// This editor will display files that are being viewed or modified
// during the conversation with the AI assistant.

// Features:
// - Syntax highlighting for multiple languages
// - Line numbers and minimap
// - Code folding
// - Search and replace
// - Multiple cursors
// - And more...

// The editor will update automatically when files are opened or modified.`;

        this.editor.setValue(welcomeMessage);
        this.editor.updateOptions({ readOnly: true });
    }

    showFile(filename, content) {
        if (!this.editor) {
            console.error('Editor not initialized');
            return;
        }

        this.currentFile = filename;

        // Detect language based on file extension
        const language = this.detectLanguage(filename);
        
        // Update editor model
        const model = monaco.editor.createModel(content, language);
        this.editor.setModel(model);
        
        // Update editor options
        this.editor.updateOptions({
            readOnly: true,
            language: language
        });

        // Reveal first line
        this.editor.revealLine(1);
    }

    detectLanguage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'sh': 'shell',
            'bash': 'shell',
            'txt': 'plaintext'
        };

        return languageMap[ext] || 'plaintext';
    }

    updateFile(filename, content) {
        if (filename === this.currentFile) {
            this.showFile(filename, content);
        }
    }

    clearEditor() {
        if (this.editor) {
            this.editor.setValue('');
            this.currentFile = null;
        }
    }
}
