// connected_websocketManager.js - Handles WebSocket connections and messages

export class WebSocketManager {
    constructor(messageHandler) {
        this.socket = null;
        this.messageHandler = messageHandler;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Initial reconnect delay (1 second)
        this.sessionId = null;
    }

    // Initialize WebSocket manager
    init() {
        console.log('Initializing WebSocketManager...');
        
        // Generate a session ID if not already set
        if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
        }
        
        // Connect to WebSocket with the session ID
        this.connect(this.sessionId);
        
        // Set up message handler callback
        this.messageHandlers = [];
        this.statusChangeHandlers = [];
    }
    
    // Generate a random session ID
    generateSessionId() {
        return crypto.randomUUID ? crypto.randomUUID() : 
               Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    // Register message handler
    onMessage(callback) {
        if (typeof callback === 'function') {
            this.messageHandlers.push(callback);
        }
    }
    
    // Register status change handler
    onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.statusChangeHandlers.push(callback);
        }
    }

    // Send message through WebSocket
    sendMessage(message) {
        if (!message.type) {
            message.type = 'command';
        }
        
        console.log('Sending message:', message);
        this.send(message);
    }

    // Connect to WebSocket
    connect(sessionId) {
        // Save session ID
        this.sessionId = sessionId;

        // Close existing connection if any
        if (this.socket) {
            this.socket.close();
        }

        // Reset reconnect attempts
        this.reconnectAttempts = 0;

        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;

        console.log(`Connecting to WebSocket: ${wsUrl}`);

        this.socket = new WebSocket(wsUrl);

        // Set event handlers
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
    }

    // Handle connection open
    handleOpen(event) {
        console.log('WebSocket connection established');
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) {
            statusIndicator.textContent = 'Connected to server...';
            statusIndicator.className = 'connected';
        }
        
        // Reset reconnect attempts
        this.reconnectAttempts = 0;
        
        // Notify status change handlers
        if (this.statusChangeHandlers && this.statusChangeHandlers.length > 0) {
            this.statusChangeHandlers.forEach(handler => {
                try {
                    handler(true); // true = connected
                } catch (error) {
                    console.error('Error in status change handler:', error);
                }
            });
        }
    }

    // Handle received messages
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);

            // Call all registered message handlers
            if (this.messageHandlers && this.messageHandlers.length > 0) {
                this.messageHandlers.forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error('Error in message handler:', error);
                    }
                });
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    // Handle connection close
    handleClose(event) {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        
        // Notify status change handlers
        if (this.statusChangeHandlers && this.statusChangeHandlers.length > 0) {
            this.statusChangeHandlers.forEach(handler => {
                try {
                    handler(false); // false = disconnected
                } catch (error) {
                    console.error('Error in status change handler:', error);
                }
            });
        }

        // Try reconnecting
        this.attemptReconnect();
    }

    // Handle connection errors
    handleError(error) {
        console.error('WebSocket error:', error);
    }

    // Attempt to reconnect
    attemptReconnect() {
        if (!this.sessionId) {
            console.log('No session ID, cannot reconnect');
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Maximum reconnection attempts reached, stopping reconnect');
            const statusIndicator = document.getElementById('status-indicator');
            if (statusIndicator) {
                statusIndicator.textContent = 'Connection lost, please refresh page to retry';
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

        console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}), delay ${delay}ms`);
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) {
            statusIndicator.textContent = `Connection lost, attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`;
        }

        setTimeout(() => {
            if (this.sessionId) {
                this.connect(this.sessionId);
            }
        }, delay);
    }

    // Send message
    send(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected, cannot send message');
        }
    }

    // Close connection
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
