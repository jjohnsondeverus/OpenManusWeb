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
        }
        // Reset reconnect attempts
        this.reconnectAttempts = 0;
    }

    // Handle received messages
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);

            // Call message handler callback
            if (this.messageHandler) {
                this.messageHandler(data);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    // Handle connection close
    handleClose(event) {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);

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
