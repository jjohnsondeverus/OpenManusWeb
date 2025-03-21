// connected_workspaceManager.js - Workspace and files manager

export class WorkspaceManager {
    constructor(fileClickCallback) {
        this.workspaces = [];
        this.workspaceContainer = document.getElementById('workspace-container');
        this.refreshCountdown = document.getElementById('refresh-countdown');
        this.fileClickCallback = fileClickCallback || (() => {});
        this.refreshTimer = null;
        this.refreshInterval = 5000; // 5 seconds
    }

    // Initialize workspace manager
    init() {
        console.log('Initializing WorkspaceManager...');
        this.startRefreshTimer();
    }

    // Update workspace data
    updateWorkspaces(workspaces) {
        if (!Array.isArray(workspaces)) {
            console.error('Invalid workspaces data, expected array:', workspaces);
            return;
        }

        this.workspaces = workspaces;
        this.renderWorkspaces();
    }

    // Render workspaces and files
    renderWorkspaces() {
        // Clear current content
        if (this.workspaceContainer) {
            this.workspaceContainer.innerHTML = '';

            // Show message if no workspaces
            if (this.workspaces.length === 0) {
                const noWorkspacesMsg = document.createElement('div');
                noWorkspacesMsg.className = 'no-workspaces';
                noWorkspacesMsg.textContent = 'No workspace files';
                this.workspaceContainer.appendChild(noWorkspacesMsg);
                return;
            }

            // Create workspace items
            this.workspaces.forEach(workspace => {
                const workspaceItem = this.createWorkspaceItem(workspace);
                this.workspaceContainer.appendChild(workspaceItem);
            });
        } else {
            console.error('Workspace container not found');
        }
    }

    // Create workspace item element
    createWorkspaceItem(workspace) {
        const workspaceItem = document.createElement('div');
        workspaceItem.className = 'workspace-item';

        // Workspace title
        const workspaceTitle = document.createElement('div');
        workspaceTitle.className = 'workspace-title';
        workspaceTitle.textContent = workspace.name || 'Unnamed Workspace';
        workspaceItem.appendChild(workspaceTitle);

        // File list
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        
        if (workspace.files && workspace.files.length > 0) {
            workspace.files.forEach(file => {
                const fileItem = this.createFileItem(file, workspace.path);
                fileList.appendChild(fileItem);
            });
        } else {
            const noFilesMsg = document.createElement('div');
            noFilesMsg.className = 'no-files';
            noFilesMsg.textContent = 'No files in this workspace';
            fileList.appendChild(noFilesMsg);
        }
        
        workspaceItem.appendChild(fileList);
        return workspaceItem;
    }

    // Create file item element
    createFileItem(file, workspacePath) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.path = file.path || '';
        
        // File icon - based on file type
        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon';
        
        // Set icon based on file extension
        const fileExt = this.getFileExtension(file.name || '');
        let iconClass = 'file-default';
        
        if (fileExt === 'py') iconClass = 'file-python';
        else if (fileExt === 'js') iconClass = 'file-js';
        else if (fileExt === 'html' || fileExt === 'htm') iconClass = 'file-html';
        else if (fileExt === 'css') iconClass = 'file-css';
        else if (fileExt === 'json') iconClass = 'file-json';
        else if (fileExt === 'md') iconClass = 'file-markdown';
        else if (fileExt === 'png' || fileExt === 'jpg' || fileExt === 'jpeg' || fileExt === 'gif') iconClass = 'file-image';
        
        fileIcon.classList.add(iconClass);
        fileItem.appendChild(fileIcon);
        
        // File name
        const fileName = document.createElement('span');
        fileName.className = 'file-name';
        fileName.textContent = file.name || 'Unnamed File';
        fileItem.appendChild(fileName);
        
        // File info (size, modified date)
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        if (file.size) {
            const fileSize = document.createElement('span');
            fileSize.className = 'file-size';
            fileSize.textContent = this.formatFileSize(file.size);
            fileInfo.appendChild(fileSize);
        }
        
        if (file.modified) {
            const fileDate = document.createElement('span');
            fileDate.className = 'file-date';
            fileDate.textContent = this.formatDate(file.modified);
            fileInfo.appendChild(fileDate);
        }
        
        fileItem.appendChild(fileInfo);
        
        // Add click event
        fileItem.addEventListener('click', () => {
            console.log('File clicked:', file.path);
            if (this.fileClickCallback) {
                this.fileClickCallback(file.path);
            }
        });
        
        return fileItem;
    }

    // Format file size to human-readable format
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format date to human-readable format
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } catch (e) {
            console.error('Error formatting date:', e);
            return dateString;
        }
    }

    // Get file extension
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // Start the refresh timer
    startRefreshTimer() {
        let countdown = 5; // 5 seconds countdown
        
        // Update countdown display
        const updateCountdown = () => {
            if (this.refreshCountdown) {
                this.refreshCountdown.textContent = `Refreshing in ${countdown}s`;
            }
            countdown--;
            
            if (countdown < 0) {
                countdown = 5;
                this.refreshWorkspaces();
            }
        };
        
        // Initial update
        updateCountdown();
        
        // Set interval for countdown
        this.refreshTimer = setInterval(updateCountdown, 1000);
    }

    // Refresh workspaces data
    refreshWorkspaces() {
        console.log('Refreshing workspace files...');
        
        fetch('/api/files')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.workspaces) {
                    this.updateWorkspaces(data.workspaces);
                }
            })
            .catch(error => {
                console.error('Error refreshing workspaces:', error);
            });
    }

    // Stop refresh timer
    stopRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // Clean up resources
    destroy() {
        this.stopRefreshTimer();
    }
}
