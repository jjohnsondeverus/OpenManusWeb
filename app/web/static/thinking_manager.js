/**
 * 思考管理器 - 处理AI思考过程的显示
 */
class ThinkingManager {
    /**
     * 构造函数
     */
    constructor() {
        this.thinkingTimeline = null;
        this.steps = [];
        this.maxSteps = 100; // 最大显示步骤数
    }

    /**
     * 初始化思考管理器
     */
    init() {
        this.thinkingTimeline = document.getElementById('thinking-timeline');
        console.log('思考管理器已初始化');
    }

    /**
     * 添加思考步骤
     * @param {Array} steps - 思考步骤数组
     */
    addThinkingSteps(steps) {
        if (!steps || !steps.length) return;
        
        // 创建文档片段，提高性能
        const fragment = document.createDocumentFragment();
        
        steps.forEach(step => {
            // 将步骤添加到数据数组中
            this.steps.push(step);
            
            // 如果超过最大显示数量，从DOM中移除最旧的步骤
            if (this.steps.length > this.maxSteps && this.thinkingTimeline.firstChild) {
                this.thinkingTimeline.removeChild(this.thinkingTimeline.firstChild);
            }
            
            // 创建步骤元素并添加到片段
            const stepElement = this.createStepElement(step);
            fragment.appendChild(stepElement);
        });
        
        // 将片段添加到时间线
        this.thinkingTimeline.appendChild(fragment);
        
        // 滚动到最新步骤
        this.scrollToBottom();
    }

    /**
     * 创建单个思考步骤的DOM元素
     * @param {Object} step - 思考步骤数据
     * @returns {HTMLElement} 步骤DOM元素
     */
    createStepElement(step) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'thinking-step';
        
        // 步骤图标
        const iconDiv = document.createElement('div');
        iconDiv.className = 'step-icon';
        
        // 根据步骤类型设置图标
        let iconClass = 'fa-circle-info';
        switch (step.type) {
            case 'thinking':
                iconClass = 'fa-brain';
                break;
            case 'tool_start':
                iconClass = 'fa-tools';
                break;
            case 'tool_end':
                iconClass = 'fa-check-circle';
                break;
            case 'error':
                iconClass = 'fa-exclamation-triangle';
                break;
            case 'system_log':
                iconClass = 'fa-terminal';
                break;
        }
        
        iconDiv.innerHTML = `<i class="fas ${iconClass}"></i>`;
        
        // 步骤内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'step-content';
        
        // 步骤头部（类型和时间）
        const headerDiv = document.createElement('div');
        headerDiv.className = 'step-header';
        
        // 步骤类型
        const typeSpan = document.createElement('span');
        typeSpan.className = 'step-type';
        typeSpan.textContent = this.getTypeDisplayText(step.type);
        
        // 时间戳
        const timeSpan = document.createElement('span');
        timeSpan.className = 'step-time';
        timeSpan.textContent = this.formatTimestamp(step.timestamp);
        
        headerDiv.appendChild(typeSpan);
        headerDiv.appendChild(timeSpan);
        
        // 步骤消息
        const messageDiv = document.createElement('div');
        messageDiv.className = 'step-message';
        messageDiv.textContent = step.message || '';
        
        // 步骤详情（如果有）
        let detailsDiv = null;
        if (step.details) {
            detailsDiv = document.createElement('div');
            detailsDiv.className = 'step-details';
            
            if (typeof step.details === 'object') {
                detailsDiv.textContent = JSON.stringify(step.details, null, 2);
            } else {
                detailsDiv.textContent = step.details;
            }
        }
        
        // 组装内容
        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(messageDiv);
        if (detailsDiv) {
            contentDiv.appendChild(detailsDiv);
        }
        
        // 组装步骤
        stepDiv.appendChild(iconDiv);
        stepDiv.appendChild(contentDiv);
        
        return stepDiv;
    }

    /**
     * 根据步骤类型获取显示文本
     * @param {string} type - 步骤类型
     * @returns {string} 显示文本
     */
    getTypeDisplayText(type) {
        switch (type) {
            case 'thinking':
                return '思考';
            case 'tool_start':
                return '工具开始';
            case 'tool_end':
                return '工具完成';
            case 'error':
                return '错误';
            case 'system_log':
                return '系统日志';
            default:
                return type || '未知';
        }
    }

    /**
     * 格式化时间戳为可读格式
     * @param {number} timestamp - 时间戳（秒）
     * @returns {string} 格式化的时间
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        return `${hours}:${minutes}:${seconds}`;
    }

    /**
     * 滚动到最新步骤
     */
    scrollToBottom() {
        if (this.thinkingTimeline) {
            this.thinkingTimeline.parentElement.scrollTop = this.thinkingTimeline.parentElement.scrollHeight;
        }
    }

    /**
     * 清空思考时间线
     */
    clear() {
        if (this.thinkingTimeline) {
            this.thinkingTimeline.innerHTML = '';
        }
        this.steps = [];
    }
} 