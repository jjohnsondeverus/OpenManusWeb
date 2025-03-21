/**
 * 工作区管理器 - 处理工作区文件的显示和交互
 */
class WorkspaceManager {
    /**
     * 构造函数
     * @param {Function} fileClickHandler - 文件点击处理函数
     */
    constructor(fileClickHandler) {
        this.files = [];
        this.filesListElement = null;
        this.fileClickHandler = fileClickHandler;
        this.selectedFile = null;
    }

    /**
     * 初始化工作区管理器
     */
    init() {
        this.filesListElement = document.getElementById('files-list');
        console.log('工作区管理器已初始化');
    }

    /**
     * 加载工作区文件列表
     * @param {Array} files - 文件信息数组
     */
    loadFiles(files) {
        if (!files || !Array.isArray(files)) {
            console.error('无效的文件列表');
            return;
        }
        
        this.files = files;
        this.renderFilesList();
    }

    /**
     * 渲染文件列表
     */
    renderFilesList() {
        if (!this.filesListElement) return;
        
        // 清空当前列表
        this.filesListElement.innerHTML = '';
        
        if (!this.files.length) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = '没有文件';
            this.filesListElement.appendChild(emptyMessage);
            return;
        }
        
        // 创建文档片段，提高性能
        const fragment = document.createDocumentFragment();
        
        // 按文件路径排序
        const sortedFiles = [...this.files].sort((a, b) => {
            return a.path.localeCompare(b.path);
        });
        
        // 创建文件项
        sortedFiles.forEach(file => {
            const fileElement = this.createFileElement(file);
            fragment.appendChild(fileElement);
        });
        
        this.filesListElement.appendChild(fragment);
    }

    /**
     * 创建单个文件的DOM元素
     * @param {Object} file - 文件信息对象
     * @returns {HTMLElement} 文件DOM元素
     */
    createFileElement(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.path = file.path;
        
        // 如果是当前选中的文件，添加选中类
        if (this.selectedFile && this.selectedFile.path === file.path) {
            fileItem.classList.add('selected');
        }
        
        // 文件图标
        const iconSpan = document.createElement('span');
        iconSpan.className = 'file-icon';
        iconSpan.innerHTML = this.getFileIcon(file.path);
        
        // 文件名
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = this.getFileName(file.path);
        
        fileItem.appendChild(iconSpan);
        fileItem.appendChild(nameSpan);
        
        // 添加点击事件
        fileItem.addEventListener('click', () => {
            this.selectFile(file);
        });
        
        return fileItem;
    }

    /**
     * 获取文件名（不包含路径）
     * @param {string} path - 文件路径
     * @returns {string} 文件名
     */
    getFileName(path) {
        if (!path) return '';
        const parts = path.split('/');
        return parts[parts.length - 1];
    }

    /**
     * 获取文件图标HTML
     * @param {string} path - 文件路径
     * @returns {string} 图标HTML
     */
    getFileIcon(path) {
        if (!path) return '<i class="fas fa-file"></i>';
        
        // 根据文件扩展名设置图标
        const ext = path.split('.').pop().toLowerCase();
        let iconClass = 'fa-file';
        
        switch (ext) {
            case 'py':
                iconClass = 'fa-file-code';
                break;
            case 'js':
            case 'ts':
            case 'jsx':
            case 'tsx':
                iconClass = 'fa-file-code';
                break;
            case 'html':
            case 'htm':
                iconClass = 'fa-file-code';
                break;
            case 'css':
            case 'scss':
            case 'sass':
                iconClass = 'fa-file-code';
                break;
            case 'json':
                iconClass = 'fa-file-code';
                break;
            case 'md':
                iconClass = 'fa-file-alt';
                break;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'svg':
                iconClass = 'fa-file-image';
                break;
            case 'pdf':
                iconClass = 'fa-file-pdf';
                break;
            case 'doc':
            case 'docx':
                iconClass = 'fa-file-word';
                break;
            case 'xls':
            case 'xlsx':
                iconClass = 'fa-file-excel';
                break;
            case 'ppt':
            case 'pptx':
                iconClass = 'fa-file-powerpoint';
                break;
            case 'zip':
            case 'rar':
            case 'tar':
            case 'gz':
                iconClass = 'fa-file-archive';
                break;
        }
        
        return `<i class="fas ${iconClass}"></i>`;
    }

    /**
     * 选择文件并触发回调
     * @param {Object} file - 文件信息对象
     */
    selectFile(file) {
        // 更新选中状态
        this.selectedFile = file;
        
        // 更新UI选中状态
        const fileItems = this.filesListElement.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            if (item.dataset.path === file.path) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // 调用回调函数
        if (this.fileClickHandler) {
            this.fileClickHandler(file);
        }
    }

    /**
     * 刷新文件列表
     */
    refresh() {
        // 在实际应用中，这里会发起API请求获取最新的文件列表
        console.log('刷新文件列表');
        // 示例：保持当前选择
        const selectedPath = this.selectedFile ? this.selectedFile.path : null;
        
        // 暂时使用API获取文件列表的示例代码
        fetch('/api/files')
            .then(response => response.json())
            .then(data => {
                this.loadFiles(data.files);
                
                // 恢复选择
                if (selectedPath) {
                    const selectedFile = this.files.find(f => f.path === selectedPath);
                    if (selectedFile) {
                        this.selectFile(selectedFile);
                    }
                }
            })
            .catch(error => {
                console.error('获取文件列表失败:', error);
            });
    }
} 