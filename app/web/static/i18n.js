// i18n.js - 国际化模块，管理中英文翻译

export class I18N {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {
            en: {
                // Chat interface
                send_message: 'Send',
                stop_processing: 'Stop',
                clear_chat: 'Clear Chat',
                clear_thinking: 'Clear Timeline',
                user_input_placeholder: 'Type your message here...',
                welcome_message: 'Welcome to Manus AI! How can I help you today?',
                
                // Computer interface
                terminal_tab: 'Terminal',
                browser_tab: 'Browser',
                editor_tab: 'Editor',
                
                // Status messages
                connecting: 'Connecting...',
                connected: 'Connected',
                disconnected: 'Disconnected',
                processing: 'Processing...',
                error_occurred: 'An error occurred: {message}',
                connection_lost: 'Connection lost. Please refresh the page.',
                
                // Thinking timeline
                thinking: 'Thinking...',
                executing: 'Executing...',
                completed: 'Completed',
                error: 'Error',
                
                // Editor
                editor_welcome: 'Welcome to Manus AI Editor',
                editor_description: 'This editor will display files that are being viewed or modified during the conversation.',
                
                // Terminal
                terminal_welcome: 'Welcome to Manus AI Terminal',
                terminal_ready: 'Terminal ready. Waiting for commands...',
                
                // Browser
                browser_welcome: 'Welcome to Manus AI Browser',
                browser_ready: 'Browser ready for navigation.',
                
                // Errors
                websocket_error: 'WebSocket connection error',
                api_error: 'API error: {status}',
                parse_error: 'Error parsing response',
                network_error: 'Network error occurred'
            },
            zh: {
                // 聊天界面
                send_message: '发送',
                stop_processing: '停止',
                clear_chat: '清除聊天',
                clear_thinking: '清除时间线',
                user_input_placeholder: '在此输入消息...',
                welcome_message: '欢迎使用 Manus AI！我能为您做些什么？',
                
                // 计算机界面
                terminal_tab: '终端',
                browser_tab: '浏览器',
                editor_tab: '编辑器',
                
                // 状态消息
                connecting: '正在连接...',
                connected: '已连接',
                disconnected: '已断开连接',
                processing: '正在处理...',
                error_occurred: '发生错误：{message}',
                connection_lost: '连接已断开。请刷新页面。',
                
                // 思考时间线
                thinking: '思考中...',
                executing: '执行中...',
                completed: '已完成',
                error: '错误',
                
                // 编辑器
                editor_welcome: '欢迎使用 Manus AI 编辑器',
                editor_description: '此编辑器将显示在对话过程中查看或修改的文件。',
                
                // 终端
                terminal_welcome: '欢迎使用 Manus AI 终端',
                terminal_ready: '终端就绪。等待命令...',
                
                // 浏览器
                browser_welcome: '欢迎使用 Manus AI 浏览器',
                browser_ready: '浏览器已准备就绪。',
                
                // 错误
                websocket_error: 'WebSocket 连接错误',
                api_error: 'API 错误：{status}',
                parse_error: '解析响应时出错',
                network_error: '网络错误'
            }
        };
    }

    async init() {
        // Try to load language from localStorage
        const savedLang = localStorage.getItem('manus_language');
        if (savedLang && this.translations[savedLang]) {
            this.currentLanguage = savedLang;
        } else {
            // Try to detect browser language
            const browserLang = navigator.language.split('-')[0];
            if (this.translations[browserLang]) {
                this.currentLanguage = browserLang;
            }
        }

        // Update page texts
        this.updatePageTexts();
    }

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('manus_language', lang);
            this.updatePageTexts();
        }
    }

    t(key, params = {}) {
        const text = this.translations[this.currentLanguage]?.[key] || this.translations['en'][key] || key;
        
        return text.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    updatePageTexts() {
        // Update static text elements
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.getAttribute('placeholder')) {
                        element.setAttribute('placeholder', this.t(key));
                    } else {
                        element.value = this.t(key);
                    }
                } else {
                    element.textContent = this.t(key);
                }
            }
        });

        // Update button texts
        document.getElementById('send-btn').textContent = this.t('send_message');
        document.getElementById('stop-btn').textContent = this.t('stop_processing');
        document.getElementById('clear-btn').textContent = this.t('clear_chat');
        document.getElementById('clear-thinking').textContent = this.t('clear_thinking');

        // Update input placeholder
        document.getElementById('user-input').setAttribute('placeholder', this.t('user_input_placeholder'));

        // Update tab texts
        document.querySelectorAll('.computer-tab').forEach(tab => {
            const tabType = tab.getAttribute('data-tab');
            tab.textContent = this.t(`${tabType}_tab`);
        });
    }
}
