/**
 * i18n模块 - 处理国际化和多语言支持
 */

// 默认语言
let currentLanguage = 'zh-CN';

// 语言文本映射
const translations = {
    'zh-CN': {
        // 通用
        'app_title': 'OpenManus Web',
        'loading': '加载中...',
        'error': '错误',
        'success': '成功',
        'cancel': '取消',
        'save': '保存',
        'delete': '删除',
        'edit': '编辑',
        'confirm': '确认',
        
        // 主界面
        'send': '发送',
        'stop': '停止',
        'clear': '清除',
        'thinking_process': 'AI思考过程',
        'terminal_output': '终端输出',
        'workspace_files': '工作区文件',
        'refresh': '刷新',
        'select_file_to_view': '选择一个文件以查看内容',
        'loading_file': '加载文件内容...',
        'loading_file_error': '加载文件内容时出错',
        
        // 状态
        'thinking': '思考中...',
        'processing': '处理中...',
        'processing_request': '正在处理请求...',
        'processing_stopped': '处理已停止',
        'completed': '已完成',
        'stopped': '已停止',
        
        // 提示
        'input_placeholder': '输入消息...',
        'no_files': '没有文件',
        
        // 错误消息
        'api_error': '接口错误: {status}',
        'send_message_error': '发送消息错误: {message}',
        'error_occurred': '发生错误: {message}',
        'stop_processing_error': '停止处理错误: {message}',
        'load_workspace_error': '加载工作区错误: {message}',
        'load_file_error': '加载文件错误: {message}',
        
        // 格式化消息
        'records_count': '{count} 条记录',
        'refresh_countdown': '{seconds} 秒后刷新',
        'system_welcome': '欢迎使用 OpenManus！我可以帮您完成各种任务。',
        'ai_thinking': 'AI 思考过程',
        'chat': '对话',
        'progress': '进度'
    },
    'en-US': {
        // General
        'app_title': 'OpenManus Web',
        'loading': 'Loading...',
        'error': 'Error',
        'success': 'Success',
        'cancel': 'Cancel',
        'save': 'Save',
        'delete': 'Delete',
        'edit': 'Edit',
        'confirm': 'Confirm',
        
        // Main interface
        'send': 'Send',
        'stop': 'Stop',
        'clear': 'Clear',
        'thinking_process': 'AI Thinking Process',
        'terminal_output': 'Terminal Output',
        'workspace_files': 'Workspace Files',
        'refresh': 'Refresh',
        'select_file_to_view': 'Select a file to view content',
        'loading_file': 'Loading file content...',
        'loading_file_error': 'Error loading file content',
        
        // Status
        'thinking': 'Thinking...',
        'processing': 'Processing...',
        'processing_request': 'Processing request...',
        'processing_stopped': 'Processing stopped',
        'completed': 'Completed',
        'stopped': 'Stopped',
        
        // Prompts
        'input_placeholder': 'Type a message...',
        'no_files': 'No files',
        
        // Error messages
        'api_error': 'API error: {status}',
        'send_message_error': 'Error sending message: {message}',
        'error_occurred': 'An error occurred: {message}',
        'stop_processing_error': 'Error stopping process: {message}',
        'load_workspace_error': 'Error loading workspace: {message}',
        'load_file_error': 'Error loading file: {message}',
        
        // Formatted messages
        'records_count': '{count} records',
        'refresh_countdown': 'Refresh in {seconds} seconds',
        'system_welcome': 'Welcome to OpenManus! I can help you with various tasks.',
        'ai_thinking': 'AI Thinking Process',
        'chat': 'Chat',
        'progress': 'Progress'
    }
};

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
    if (translations[lang]) {
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
    // Try to get language from localStorage
    const savedLang = localStorage.getItem('language');
    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
    } else {
        // Try to get browser language
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang && translations[browserLang]) {
            currentLanguage = browserLang;
        }
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
    let text = translations[currentLanguage][key] || key;
    
    // 替换参数
    if (params) {
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
    }
    
    return text;
}

/**
 * 获取可用语言列表
 * @returns {Array} 可用语言列表
 */
export function getAvailableLanguages() {
    return Object.keys(translations);
}
