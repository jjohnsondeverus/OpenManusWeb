/**
 * 文件查看器管理器 - 处理文件内容的显示
 */
class FileViewerManager {
    /**
     * 构造函数
     */
    constructor() {
        this.fileViewerElement = null;
        this.currentFile = null;
    }

    /**
     * 初始化文件查看器
     */
    init() {
        this.fileViewerElement = document.getElementById('file-viewer');
        console.log('文件查看器已初始化');
    }

    /**
     * 显示文件内容
     * @param {Object} file - 文件信息对象
     */
    showFile(file) {
        if (!this.fileViewerElement) return;
        
        this.currentFile = file;
        
        if (!file) {
            this.showEmptyState();
            return;
        }
        
        // 显示加载状态
        this.showLoadingState();
        
        // 获取文件内容
        this.fetchFileContent(file.path)
            .then(content => {
                this.renderFileContent(file.path, content);
            })
            .catch(error => {
                this.showErrorState(error);
            });
    }

    /**
     * 获取文件内容
     * @param {string} path - 文件路径
     * @returns {Promise<string>} 文件内容
     */
    fetchFileContent(path) {
        return fetch(`/api/file?path=${encodeURIComponent(path)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`获取文件内容失败: ${response.statusText}`);
                }
                return response.text();
            });
    }

    /**
     * 渲染文件内容
     * @param {string} path - 文件路径
     * @param {string} content - 文件内容
     */
    renderFileContent(path, content) {
        if (!this.fileViewerElement) return;
        
        this.fileViewerElement.innerHTML = '';
        
        // 文件头部信息
        const headerDiv = document.createElement('div');
        headerDiv.className = 'file-header';
        headerDiv.textContent = path;
        
        // 文件内容
        const contentPre = document.createElement('pre');
        contentPre.className = 'file-content';
        const codeElement = document.createElement('code');
        
        // 添加简单的语法高亮（基础实现，实际项目中可以使用highlight.js等库）
        const fileExt = path.split('.').pop().toLowerCase();
        codeElement.className = this.getLanguageClass(fileExt);
        codeElement.textContent = content;
        
        contentPre.appendChild(codeElement);
        
        this.fileViewerElement.appendChild(headerDiv);
        this.fileViewerElement.appendChild(contentPre);
    }

    /**
     * 获取语言对应的CSS类名
     * @param {string} fileExt - 文件扩展名
     * @returns {string} 语言CSS类名
     */
    getLanguageClass(fileExt) {
        const langMap = {
            'py': 'language-python',
            'js': 'language-javascript',
            'ts': 'language-typescript',
            'jsx': 'language-javascript',
            'tsx': 'language-typescript',
            'html': 'language-html',
            'htm': 'language-html',
            'css': 'language-css',
            'scss': 'language-scss',
            'sass': 'language-sass',
            'json': 'language-json',
            'md': 'language-markdown',
            'txt': 'language-text'
        };
        
        return langMap[fileExt] || 'language-text';
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        if (!this.fileViewerElement) return;
        
        this.fileViewerElement.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-file"></i></div>
                <div class="empty-text">选择一个文件以查看内容</div>
            </div>
        `;
    }

    /**
     * 显示加载状态
     */
    showLoadingState() {
        if (!this.fileViewerElement) return;
        
        this.fileViewerElement.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">加载文件内容...</div>
            </div>
        `;
    }

    /**
     * 显示错误状态
     * @param {Error} error - 错误对象
     */
    showErrorState(error) {
        if (!this.fileViewerElement) return;
        
        this.fileViewerElement.innerHTML = `
            <div class="error-state">
                <div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="error-text">加载文件内容时出错:</div>
                <div class="error-message">${error.message}</div>
            </div>
        `;
    }

    /**
     * 清空查看器
     */
    clear() {
        if (this.fileViewerElement) {
            this.fileViewerElement.innerHTML = '';
        }
        this.currentFile = null;
    }
} 