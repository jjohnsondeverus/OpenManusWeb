/**
 * i18n模块 - 处理国际化和多语言支持
 */

// 支持的语言选项
const supportedLanguages = {
    'en-US': 'English',
    'zh-CN': '中文'
};

// 翻译字典
const translations = {
    'en-US': {
        'chat_with_manus': 'Chat with Manus',
        'thinking_process': 'AI Thinking Process',
        'clear_thinking': 'Clear Thinking',
        'records_count': '{{count}} records',
        'user_input_placeholder': 'Enter a message...',
        'send': 'Send',
        'stop': 'Stop',
        'clear': 'Clear',
        'workspaces': 'Workspaces',
        'refresh_files': 'Refresh Files',
        'refresh_countdown': 'Refreshing in {{seconds}}s',
        'no_workspaces': 'No workspaces available',
        'terminal_output': 'Terminal Output',
        'processing_request': 'Processing request...',
        'processing_stopped': 'Processing stopped',
        'error_occurred': 'Error: {{message}}',
        'api_error': 'API error: {{status}}',
        'send_message_error': 'Error sending message: {{message}}',
        'stop_processing_error': 'Error stopping processing: {{message}}',
        'load_workspace_error': 'Error loading workspace: {{message}}',
        'load_file_error': 'Error loading file: {{message}}',
        'moments_ago': 'moments ago',
        'minutes_ago': '{{minutes}} minutes ago',
        'hours_ago': '{{hours}} hours ago',
        'days_ago': '{{days}} days ago',
        'chat_with_manus_description': 'Ask me to help you with coding tasks'
    },
    'zh-CN': {
        'chat_with_manus': '与 Manus 聊天',
        'thinking_process': 'AI 思考过程',
        'clear_thinking': '清除思考记录',
        'records_count': '{{count}} 条记录',
        'user_input_placeholder': '输入消息...',
        'send': '发送',
        'stop': '停止',
        'clear': '清除',
        'workspaces': '工作区',
        'refresh_files': '刷新文件',
        'refresh_countdown': '{{seconds}}秒后刷新',
        'no_workspaces': '没有可用的工作区',
        'terminal_output': '终端输出',
        'processing_request': '正在处理请求...',
        'processing_stopped': '处理已停止',
        'error_occurred': '错误: {{message}}',
        'api_error': 'API错误: {{status}}',
        'send_message_error': '发送消息错误: {{message}}',
        'stop_processing_error': '停止处理错误: {{message}}',
        'load_workspace_error': '加载工作区错误: {{message}}',
        'load_file_error': '加载文件错误: {{message}}',
        'moments_ago': '刚刚',
        'minutes_ago': '{{minutes}}分钟前',
        'hours_ago': '{{hours}}小时前',
        'days_ago': '{{days}}天前',
        'chat_with_manus_description': '请我帮你解决编程任务'
    }
};

// 当前语言
let currentLanguage = 'en-US';

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
export function getCurrentLanguage() {
    return currentLanguage;
}

/**
 * 设置语言
 * @param {string} lang - 语言代码
 */
export function setLanguage(lang) {
    if (supportedLanguages[lang]) {
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        updatePageTexts();
        return true;
    }
    return false;
}

/**
 * 初始化语言设置
 * @returns {string} 当前语言代码
 */
export function initLanguage() {
    // 尝试从localStorage获取语言设置
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && supportedLanguages[savedLanguage]) {
        currentLanguage = savedLanguage;
    } else {
        // 默认使用英语
        currentLanguage = 'en-US';
        localStorage.setItem('language', currentLanguage);
    }
    
    // 设置语言选择器的值
    const langSelector = document.getElementById('language-selector');
    if (langSelector) {
        langSelector.value = currentLanguage;
    }
    
    updatePageTexts();
    return currentLanguage;
}

/**
 * 更新页面上的所有文本
 */
export function updatePageTexts() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            el.textContent = translations[currentLanguage][key];
        }
    });
    
    // 更新页面标题
    if (translations[currentLanguage]['app_title']) {
        document.title = translations[currentLanguage]['app_title'];
    }
    
    // Update placeholders
    const inputElements = document.querySelectorAll('[data-i18n-placeholder]');
    inputElements.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLanguage][key]) {
            el.setAttribute('placeholder', translations[currentLanguage][key]);
        }
    });
}

/**
 * 获取指定键的翻译文本
 * @param {string} key - 翻译键
 * @param {Object} params - 替换参数
 * @returns {string} 翻译文本
 */
export function t(key, params = {}) {
    const translation = translations[currentLanguage][key] || key;
    
    // 替换参数
    return translation.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : `{{${paramKey}}}`;
    });
}

/**
 * 获取可用语言列表
 * @returns {Array} 可用语言列表
 */
export function getAvailableLanguages() {
    return Object.keys(translations);
}
