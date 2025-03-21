// connected_interface.js - 主要JavaScript文件，负责初始化和协调其他模块

// 导入各个管理器类
import { WebSocketManager } from '/static/connected_websocketManager.js';
import { ChatManager } from '/static/connected_chatManager.js';
import { ThinkingManager } from '/static/connected_thinkingManager.js';
import { WorkspaceManager } from '/static/connected_workspaceManager.js';
import { FileViewerManager } from '/static/connected_fileViewerManager.js';
import { initLanguage, setLanguage, updatePageTexts, t } from '/static/i18n.js';

// 主应用类
class App {
    constructor() {
        this.sessionId = null;
        this.isProcessing = false;

        // 初始化各个管理器
        this.websocketManager = new WebSocketManager(this.handleWebSocketMessage.bind(this));
        this.chatManager = new ChatManager(this.handleSendMessage.bind(this));
        this.thinkingManager = new ThinkingManager();
        this.workspaceManager = new WorkspaceManager(this.handleFileClick.bind(this));
        this.fileViewerManager = new FileViewerManager();
        
        // 终端相关
        this.terminal = null;
        this.terminalOutputBuffer = [];

        // 绑定UI事件
        this.bindEvents();
    }

    // 初始化应用
    init() {
        console.log('OpenManus Web应用初始化...');

        // 初始化语言设置
        const currentLang = initLanguage();
        document.getElementById('language-selector').value = currentLang;
        updatePageTexts();

        // 初始化各个管理器
        this.chatManager.init();
        this.thinkingManager.init();
        this.workspaceManager.init();
        this.fileViewerManager.init();
        
        // 初始化终端（占位符，Phase2中将使用xterm.js实现）
        this.initTerminal();

        // 加载工作区文件
        this.loadWorkspaceFiles();
    }

    // 绑定UI事件
    bindEvents() {
        // 停止按钮
        document.getElementById('stop-btn').addEventListener('click', () => {
            if (this.sessionId && this.isProcessing) {
                this.stopProcessing();
            }
        });

        // 清除按钮
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.chatManager.clearMessages();
        });

        // 清除思考记录按钮
        document.getElementById('clear-thinking').addEventListener('click', () => {
            this.thinkingManager.clear();
        });

        // 刷新文件按钮
        document.getElementById('refresh-files').addEventListener('click', () => {
            this.loadWorkspaceFiles();
        });

        // 语言选择器
        document.getElementById('language-selector').addEventListener('change', (event) => {
            const selectedLang = event.target.value;
            setLanguage(selectedLang);
            updatePageTexts();
            this.updateDynamicTexts();
        });
    }

    // 更新动态生成的文本
    updateDynamicTexts() {
        // 更新状态指示器
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator && statusIndicator.textContent.includes('正在处理')) {
            statusIndicator.textContent = t('processing_request');
        } else if (statusIndicator && statusIndicator.textContent.includes('处理已停止')) {
            statusIndicator.textContent = t('processing_stopped');
        }

        // 更新记录计数
        const recordCount = document.getElementById('record-count');
        if (recordCount) {
            const count = parseInt(recordCount.textContent);
            if (!isNaN(count)) {
                recordCount.textContent = t('records_count', { count });
            }
        }

        // 更新刷新倒计时
        const refreshCountdown = document.getElementById('refresh-countdown');
        if (refreshCountdown) {
            const seconds = refreshCountdown.textContent.match(/\d+/);
            if (seconds) {
                refreshCountdown.textContent = t('refresh_countdown', { seconds: seconds[0] });
            }
        }
    }

    // 处理发送消息
    async handleSendMessage(message) {
        if (this.isProcessing) {
            console.log('正在处理中，请等待...');
            return;
        }

        this.isProcessing = true;
        
        // 获取按钮并检查它们是否存在
        const sendBtn = document.getElementById('send-btn');
        const stopBtn = document.getElementById('stop-btn');
        
        if (sendBtn) sendBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        
        // 检查状态指示器是否存在，不存在则创建
        let statusIndicator = document.getElementById('status-indicator');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'status-indicator';
            statusIndicator.className = 'status-indicator';
            
            // 将状态指示器添加到输入容器下方
            const inputContainer = document.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.parentNode.insertBefore(statusIndicator, inputContainer.nextSibling);
            } else {
                console.warn('未找到合适的位置放置状态指示器');
            }
        }
        
        if (statusIndicator) {
            statusIndicator.textContent = t('processing_request');
        }

        try {
            // 发送API请求创建新会话
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

            // 添加用户消息到聊天
            this.chatManager.addUserMessage(message);

            // 连接WebSocket
            this.websocketManager.connect(this.sessionId);

            // 重置思考记录
            this.thinkingManager.clear();
            
            // 清空终端输出
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

    // 处理WebSocket消息
    handleWebSocketMessage(data) {
        console.log('收到WebSocket消息:', data);

        // 更新处理状态
        if (data.status) {
            this.isProcessing = data.status === 'processing' || data.status === 'thinking';

            // 更新UI状态
            document.getElementById('stop-btn').disabled = !this.isProcessing;
            document.getElementById('send-btn').disabled = this.isProcessing;
            
            // 显示状态
            this.chatManager.updateStatus(data.status);
            
            // 更新进度条
            if (data.progress) {
                this.updateProgressBar(data.progress.percentage || 0);
            }
        }

        // 处理思考步骤
        if (data.thinking_steps && data.thinking_steps.length > 0) {
            this.thinkingManager.addThinkingSteps(data.thinking_steps);
        }

        // 处理聊天消息
        if (data.log && data.log.length > 0) {
            this.chatManager.addMessages(data.log);
        }
        
        // 处理终端输出
        if (data.terminal_output && data.terminal_output.length > 0) {
            this.handleTerminalOutput(data.terminal_output);
        }

        // 处理最终结果
        if (data.result && !this.isProcessing) {
            console.log('处理完成，结果:', data.result);
            this.chatManager.addBotMessage(data.result);
        }

        // 处理错误消息
        if (data.error) {
            console.error('WebSocket错误:', data.error);
            this.chatManager.addErrorMessage(data.error);
        }
    }

    // 停止处理
    async stopProcessing() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/chat/${this.sessionId}/stop`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error(t('api_error', { status: response.status }));
            }

            console.log('处理已停止');
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

    // 加载工作区文件
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
        }
    }

    // 处理文件点击
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

    // 初始化终端（占位符实现）
    initTerminal() {
        const terminalContainer = document.getElementById('terminal-container');
        if (!terminalContainer) {
            console.warn('终端容器元素不存在，跳过终端初始化');
            return;
        }
        
        terminalContainer.innerHTML = '<div class="terminal-placeholder">' + 
            '<div class="terminal-content">' +
            '<div class="terminal-header">OpenManus Terminal</div>' +
            '<div class="terminal-output" id="terminal-output"></div>' +
            '</div></div>';
        
        // 添加简单样式
        const style = document.createElement('style');
        style.textContent = `
            .terminal-placeholder {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                background-color: #1e293b;
                color: #e2e8f0;
                font-family: 'JetBrains Mono', monospace;
                overflow: auto;
            }
            .terminal-content {
                flex: 1;
                padding: 0.5rem;
                display: flex;
                flex-direction: column;
            }
            .terminal-header {
                color: #94a3b8;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid #334155;
                margin-bottom: 0.5rem;
                font-size: 0.9rem;
            }
            .terminal-output {
                flex: 1;
                overflow-y: auto;
                white-space: pre-wrap;
                font-size: 0.8rem;
                line-height: 1.5;
            }
            .terminal-line {
                margin-bottom: 0.25rem;
            }
        `;
        document.head.appendChild(style);
        
        // 设置终端输出元素引用
        this.terminalOutput = document.getElementById('terminal-output');
        
        // 添加一些初始信息
        this.handleTerminalOutput("Terminal initialized. Ready for commands.");
    }
    
    // 清空终端输出
    clearTerminalOutput() {
        this.terminalOutputBuffer = [];
        const terminalOutput = document.querySelector('.terminal-output');
        if (terminalOutput) {
            terminalOutput.innerHTML = '';
        }
    }
    
    // 处理终端输出
    handleTerminalOutput(output) {
        // 如果是数组，对每个元素调用处理函数
        if (Array.isArray(output)) {
            output.forEach(item => this.handleTerminalOutput(item));
            return;
        }
        
        // 确保terminalOutput元素存在
        if (!this.terminalOutput) {
            this.terminalOutput = document.getElementById('terminal-output');
            if (!this.terminalOutput) {
                console.warn('终端输出元素不存在，无法显示输出');
                this.terminalOutputBuffer.push(output); // 将输出保存在缓冲区
                return;
            }
        }
        
        // 创建新的终端行
        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        // 处理不同类型的输出
        if (typeof output === 'string') {
            line.textContent = output;
        } else if (output && typeof output === 'object') {
            // 如果是对象，尝试提取有用的信息
            if (output.message) {
                line.textContent = output.message;
            } else if (output.output) {
                line.textContent = output.output;
            } else {
                try {
                    line.textContent = JSON.stringify(output);
                } catch (e) {
                    line.textContent = '[Object]';
                }
            }
        } else {
            line.textContent = String(output);
        }
        
        // 添加到终端
        this.terminalOutput.appendChild(line);
        
        // 滚动到底部
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
    }
    
    // 更新进度条
    updateProgressBar(percentage) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }
    
    // HTML转义
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();

    // 将app实例暴露到全局，方便调试
    window.app = app;
});
