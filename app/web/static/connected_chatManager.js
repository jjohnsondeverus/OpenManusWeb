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

    addMessage(message, senderClass) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', senderClass);

        const textElement = document.createElement('p');
        textElement.textContent = message;
        messageElement.appendChild(textElement);

        this.messageContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    addUserMessage(message) {
        this.addMessage(message, 'user-message');
    }

    addAssistantMessage(message) {
        this.addMessage(message, 'assistant-message');
    }

    addSystemMessage(message) {
        this.addMessage(message, 'system-message');
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

    addAgentQuestion(question) {
        this.addMessage(question, 'agent-question');
    }
}
