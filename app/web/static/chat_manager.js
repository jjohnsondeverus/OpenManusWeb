/**
 * 聊天管理器 - 处理聊天消息和用户交互
 */
class ChatManager {
    /**
     * 构造函数
     * @param {Function} sendHandler - 处理发送消息的回调函数
     */
    constructor(sendHandler) {
        this.sendHandler = sendHandler;
        this.chatContainer = null;
        this.chatInput = null;
        this.sendButton = null;
        this.stopButton = null;
        this.clearButton = null;
    }

    /**
     * 初始化聊天界面元素和事件
     */
    init() {
        // 获取DOM元素
        this.chatContainer = document.getElementById('chat-container');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-btn');
        this.stopButton = document.getElementById('stop-btn');
        this.clearButton = document.getElementById('clear-btn');

        // 绑定事件
        this.sendButton.addEventListener('click', this.handleSend.bind(this));
        this.stopButton.addEventListener('click', this.handleStop.bind(this));
        this.clearButton.addEventListener('click', this.handleClear.bind(this));
        
        // 绑定键盘事件
        this.chatInput.addEventListener('keydown', (event) => {
            // 按下Enter键发送消息，但如果同时按下Shift键则换行
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.handleSend();
            }
            
            // 自动调整输入框高度
            setTimeout(() => {
                this.adjustInputHeight();
            }, 0);
        });
        
        // 监听输入变化以自动调整高度
        this.chatInput.addEventListener('input', this.adjustInputHeight.bind(this));
    }

    /**
     * 处理发送消息
     */
    handleSend() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // 添加用户消息到界面
        this.addUserMessage(message);
        
        // 清空输入框并重置高度
        this.chatInput.value = '';
        this.adjustInputHeight();
        
        // 禁用输入和发送按钮，启用停止按钮
        this.chatInput.disabled = true;
        this.sendButton.disabled = true;
        this.stopButton.disabled = false;
        
        // 调用发送处理函数
        if (this.sendHandler) {
            this.sendHandler(message);
        }
    }

    /**
     * 处理停止按钮点击
     */
    handleStop() {
        console.log('用户请求停止处理');
        // 调用外部停止处理函数
        if (window.app && window.app.stopProcessing) {
            window.app.stopProcessing();
        }
    }

    /**
     * 处理清空按钮点击
     */
    handleClear() {
        // 清空聊天容器
        this.chatContainer.innerHTML = '';
        
        // 清空输入框
        this.chatInput.value = '';
        this.adjustInputHeight();
        
        console.log('聊天历史已清空');
    }

    /**
     * 自动调整输入框高度
     */
    adjustInputHeight() {
        const input = this.chatInput;
        input.style.height = 'auto';
        
        // 计算新高度，但最大高度限制为10rem
        const newHeight = Math.min(input.scrollHeight, 160); // 10rem = 160px (假设1rem = 16px)
        input.style.height = `${newHeight}px`;
    }

    /**
     * 添加用户消息到聊天界面
     * @param {string} message - 用户消息内容
     */
    addUserMessage(message) {
        const messageElement = this.createMessageElement(message, 'user');
        this.chatContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    /**
     * 添加机器人(AI)消息到聊天界面
     * @param {string} message - 机器人消息内容
     */
    addBotMessage(message) {
        const messageElement = this.createMessageElement(message, 'bot');
        this.chatContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // 恢复输入和发送按钮状态
        this.chatInput.disabled = false;
        this.sendButton.disabled = false;
        this.stopButton.disabled = true;
        this.chatInput.focus();
    }

    /**
     * 添加错误消息到聊天界面
     * @param {string} error - 错误消息内容
     */
    addErrorMessage(error) {
        const messageElement = this.createMessageElement(error, 'error');
        this.chatContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // 恢复输入和发送按钮状态
        this.chatInput.disabled = false;
        this.sendButton.disabled = false;
        this.stopButton.disabled = true;
    }

    /**
     * 创建消息元素
     * @param {string} content - 消息内容
     * @param {string} type - 消息类型 ('user', 'bot', 'error')
     * @returns {HTMLElement} 消息DOM元素
     */
    createMessageElement(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // 创建头像元素
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        
        if (type === 'user') {
            avatarDiv.textContent = 'U';
        } else if (type === 'bot') {
            avatarDiv.textContent = 'AI';
        } else if (type === 'error') {
            avatarDiv.textContent = '!';
        }
        
        // 创建内容元素
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 处理Markdown格式
        if (type === 'bot' || type === 'error') {
            // 简单处理代码块和其他格式
            let formatted = content
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            
            contentDiv.innerHTML = formatted;
        } else {
            contentDiv.textContent = content;
        }
        
        // 组装消息元素
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        return messageDiv;
    }

    /**
     * 将聊天窗口滚动到底部
     */
    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    /**
     * 批量添加消息
     * @param {Array} messages - 消息数组
     */
    addMessages(messages) {
        if (!messages || !messages.length) return;
        
        // 创建文档片段，提高性能
        const fragment = document.createDocumentFragment();
        
        messages.forEach(msg => {
            const type = msg.role === 'user' ? 'user' : 'bot';
            const messageElement = this.createMessageElement(msg.content, type);
            fragment.appendChild(messageElement);
        });
        
        this.chatContainer.appendChild(fragment);
        this.scrollToBottom();
    }

    /**
     * 更新状态显示
     * @param {string} status - 当前状态
     */
    updateStatus(status) {
        // 创建或更新状态消息
        let statusElement = document.getElementById('status-message');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'status-message';
            statusElement.className = 'status-message';
            this.chatContainer.appendChild(statusElement);
        }
        
        // 设置状态文本
        let statusText = '';
        switch (status) {
            case 'thinking':
                statusText = '思考中...';
                break;
            case 'processing':
                statusText = '处理中...';
                break;
            case 'completed':
                statusText = '已完成';
                statusElement.remove();
                return;
            case 'error':
                statusText = '出错了';
                statusElement.remove();
                return;
            case 'stopped':
                statusText = '已停止';
                statusElement.remove();
                return;
            default:
                statusText = status;
        }
        
        statusElement.textContent = statusText;
        this.scrollToBottom();
    }
} 