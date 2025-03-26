// WebSocket Manager - Handles WebSocket connections and messages

export class WebSocketManager {
    constructor(messageHandler) {
        this.socket = null;
        this.messageHandler = messageHandler;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second delay
        this.sessionId = null;
    }

    // 连接WebSocket
    connect(sessionId) {
        this.sessionId = sessionId;
        
        // Close existing connection if any
        if (this.socket) {
            this.socket.close();
        }

        // Create new WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;
        
        this.socket = new WebSocket(wsUrl);
        
        // Set up event handlers
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
    }

    // Handle connection open
    handleOpen() {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
    }

    // Handle received messages
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Enhanced logging for debugging
            console.log('WebSocket message received:', JSON.stringify(data));
            
            // Create a message object to pass to the handler
            let messageToHandle = {
                status: data.status || 'processing',
                updated: data.updated || false  // Add flag to track if this is an update
            };
            
            // Handle thinking steps - ensuring we catch the data regardless of case
            const thinkingSteps = data.thinking_steps || data.thinkingSteps || [];
            if (Array.isArray(thinkingSteps) && thinkingSteps.length > 0) {
                messageToHandle.thinking_steps = thinkingSteps.map(step => {
                    if (typeof step === 'string') {
                        return {
                            message: step,
                            type: 'thought',
                            timestamp: Math.floor(Date.now() / 1000)
                        };
                    }
                    return {
                        message: step.message || step.content || 'No message',
                        type: step.type || 'thought',
                        details: step.details || null,
                        timestamp: step.timestamp || Math.floor(Date.now() / 1000)
                    };
                });
            }
            
            // Handle terminal output
            if (data.terminal_output) {
                messageToHandle.terminal_output = data.terminal_output;
            }
            
            // Handle logs
            if (data.logs) {
                messageToHandle.logs = data.logs;
            }
            
            // Handle errors
            if (data.type === 'error' || data.error) {
                messageToHandle.status = 'error';
                messageToHandle.result = `Error: ${data.message || data.error}`;
            }
            
            // Handle completion
            if (data.status === 'completed') {
                messageToHandle.result = data.result || data.message;
            }
            
            // Pass the formatted message to the handler
            this.messageHandler(messageToHandle);
            
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.messageHandler({
                status: 'error',
                result: 'Error processing server response'
            });
        }
    }

    // Handle connection close
    handleClose(event) {
        console.log('WebSocket connection closed:', event.code, event.reason);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                this.reconnectDelay *= 2; // Exponential backoff
                this.connect(this.sessionId);
            }, this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.messageHandler({
                status: 'error',
                result: 'Connection lost. Please refresh the page.'
            });
        }
    }

    // Handle connection error
    handleError(error) {
        console.error('WebSocket error:', error);
        this.messageHandler({
            status: 'error',
            result: 'Connection error occurred'
        });
    }

    // Send message
    send(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected, cannot send message');
        }
    }

    // 关闭连接
    close() {
        if (this.socket) {
            this.socket.close(1000, 'Normal closure');
            this.socket = null;
        }
    }

    sendStop() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'stop',
                session_id: this.sessionId
            }));
        }
    }
}
