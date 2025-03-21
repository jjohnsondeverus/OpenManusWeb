/**
 * WebSocket管理器 - 处理与服务器的WebSocket通信
 */
class WebSocketManager {
    /**
     * 构造函数
     * @param {Function} messageHandler - 处理接收消息的回调函数
     */
    constructor(messageHandler) {
        this.socket = null;
        this.messageHandler = messageHandler;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 初始重连延迟，以毫秒为单位
        this.sessionId = null;
    }

    /**
     * 连接到WebSocket服务器
     * @param {string} sessionId - 会话ID
     */
    connect(sessionId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket已连接，先关闭现有连接');
            this.socket.close();
        }

        this.sessionId = sessionId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;
        
        console.log(`正在连接到WebSocket: ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
    }

    /**
     * 断开WebSocket连接
     */
    disconnect() {
        if (this.socket) {
            console.log('主动断开WebSocket连接');
            this.socket.close();
            this.socket = null;
        }
    }

    /**
     * 发送消息到服务器
     * @param {Object} data - 要发送的数据对象
     */
    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.error('WebSocket未连接，无法发送消息');
        }
    }

    /**
     * 处理WebSocket连接成功事件
     */
    handleOpen() {
        console.log('WebSocket连接已建立');
        this.reconnectAttempts = 0; // 重置重连计数器
    }

    /**
     * 处理接收到的WebSocket消息
     * @param {MessageEvent} event - WebSocket消息事件
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (this.messageHandler) {
                this.messageHandler(data);
            }
        } catch (error) {
            console.error('解析WebSocket消息时出错:', error);
        }
    }

    /**
     * 处理WebSocket连接关闭事件
     * @param {CloseEvent} event - WebSocket关闭事件
     */
    handleClose(event) {
        console.log(`WebSocket连接已关闭: ${event.code} ${event.reason}`);
        this.socket = null;

        // 自动重连逻辑
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避策略
            console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts}), 延迟: ${delay}ms`);
            
            setTimeout(() => {
                if (this.sessionId) {
                    this.connect(this.sessionId);
                }
            }, delay);
        } else {
            console.error('达到最大重连次数，不再尝试重连');
        }
    }

    /**
     * 处理WebSocket错误事件
     * @param {Event} event - WebSocket错误事件
     */
    handleError(event) {
        console.error('WebSocket发生错误:', event);
    }
} 