// connected_chatManager.js - 处理聊天界面和消息

export class ChatManager {
    constructor() {
        this.messageContainer = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-btn');
        this.stopButton = document.getElementById('stop-btn');
        this.clearButton = document.getElementById('clear-btn');
        
        // Initialize message container
        this.initMessageContainer();
    }

    initMessageContainer() {
        // Clear any existing messages
        this.messageContainer.innerHTML = '';
        
        // Add welcome message
        this.addSystemMessage('Welcome to Manus AI! How can I help you today?');
    }

    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        this.messageContainer.appendChild(messageDiv);
        
        this.scrollToBottom();
    }

    addAssistantMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = this.formatMessage(message);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        this.messageContainer.appendChild(messageDiv);
        
        this.scrollToBottom();
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message;
        
        messageDiv.appendChild(content);
        this.messageContainer.appendChild(messageDiv);
        
        this.scrollToBottom();
    }

    formatMessage(message) {
        // Convert markdown-style code blocks
        message = message.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || '';
            return `<pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
        });

        // Convert inline code
        message = message.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert links
        message = message.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Convert bold text
        message = message.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Convert italic text
        message = message.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Convert line breaks
        message = message.replace(/\n/g, '<br>');

        return message;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    clearMessages() {
        this.messageContainer.innerHTML = '';
        this.addSystemMessage('Chat cleared.');
    }
}
