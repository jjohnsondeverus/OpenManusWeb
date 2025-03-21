/**
 * 语言支持模块 - 处理界面多语言
 */

// 默认语言
const DEFAULT_LANGUAGE = 'zh';

// 语言文本映射
const translations = {
    'zh': {
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
        'clear': '清空',
        'thinking_process': 'AI思考过程',
        'terminal_output': '终端输出',
        'workspace_files': '工作区文件',
        'select_file_to_view': '选择一个文件以查看内容',
        'loading_file': '加载文件内容...',
        'loading_file_error': '加载文件内容时出错',
        
        // 状态
        'thinking': '思考中...',
        'processing': '处理中...',
        'completed': '已完成',
        'stopped': '已停止',
        
        // 提示
        'input_placeholder': '输入消息...',
        'no_files': '没有文件',
    },
    'en': {
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
        'select_file_to_view': 'Select a file to view content',
        'loading_file': 'Loading file content...',
        'loading_file_error': 'Error loading file content',
        
        // Status
        'thinking': 'Thinking...',
        'processing': 'Processing...',
        'completed': 'Completed',
        'stopped': 'Stopped',
        
        // Prompts
        'input_placeholder': 'Type a message...',
        'no_files': 'No files',
    }
};

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
function getCurrentLanguage() {
    return localStorage.getItem('language') || DEFAULT_LANGUAGE;
}

/**
 * 设置语言
 * @param {string} lang - 语言代码
 */
function setLanguage(lang) {
    if (!translations[lang]) {
        console.error(`不支持的语言: ${lang}`);
        return;
    }
    
    localStorage.setItem('language', lang);
    updatePageTexts();
}

/**
 * 初始化语言设置
 * @returns {string} 当前语言代码
 */
function initLanguage() {
    const lang = getCurrentLanguage();
    
    // 设置语言选择器的值
    const langSelector = document.getElementById('language-selector');
    if (langSelector) {
        langSelector.value = lang;
        
        // 添加切换语言的事件监听器
        langSelector.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    }
    
    return lang;
}

/**
 * 更新页面上的所有文本
 */
function updatePageTexts() {
    const lang = getCurrentLanguage();
    const texts = translations[lang] || translations[DEFAULT_LANGUAGE];
    
    // 更新所有带有data-i18n属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (texts[key]) {
            // 对于输入框，设置placeholder
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = texts[key];
            } else {
                element.textContent = texts[key];
            }
        }
    });
    
    // 更新按钮文本
    updateButtonTexts(texts);
    
    // 更新页面标题
    if (texts['app_title']) {
        document.title = texts['app_title'];
    }
}

/**
 * 更新按钮文本
 * @param {Object} texts - 翻译文本对象
 */
function updateButtonTexts(texts) {
    // 发送按钮
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn && texts['send']) {
        sendBtn.textContent = texts['send'];
    }
    
    // 停止按钮
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn && texts['stop']) {
        stopBtn.textContent = texts['stop'];
    }
    
    // 清空按钮
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn && texts['clear']) {
        clearBtn.textContent = texts['clear'];
    }
}

/**
 * 获取指定键的翻译文本
 * @param {string} key - 翻译键
 * @returns {string} 翻译文本
 */
function getText(key) {
    const lang = getCurrentLanguage();
    const texts = translations[lang] || translations[DEFAULT_LANGUAGE];
    return texts[key] || key;
}

// 导出函数
window.initLanguage = initLanguage;
window.setLanguage = setLanguage;
window.getText = getText;
window.updatePageTexts = updatePageTexts; 