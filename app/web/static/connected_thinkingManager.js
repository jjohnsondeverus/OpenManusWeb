// connected_thinkingManager.js - Manages the display of AI thinking process

export class ThinkingManager {
    constructor() {
        this.container = null;
        this.recordCount = null;
        this.timelineContainer = null;
        this.autoScrollCheckbox = null;
        this.records = [];
    }

    // Initialize thinking manager
    init() {
        console.log('Initializing ThinkingManager...');
        
        // Initialize containers
        this.container = document.getElementById('thinking-container');
        this.recordCount = document.getElementById('record-count');
        this.timelineContainer = document.getElementById('thinking-timeline');
        this.autoScrollCheckbox = document.getElementById('auto-scroll');
        
        // Check if elements exist
        if (!this.container) {
            console.warn('Thinking container not found');
        }
        
        if (!this.timelineContainer) {
            console.warn('Timeline container not found');
        }
        
        if (!this.recordCount) {
            console.warn('Record count element not found');
        }

        // Check for auto-scroll checkbox
        if (!this.autoScrollCheckbox) {
            console.warn('Auto-scroll checkbox not found');
        }
        
        // Initial record count
        this.updateRecordCount();
    }

    // Add a thinking step
    addThinkingStep(step) {
        if (!this.timelineContainer) return;
        
        // Add to records array
        this.records.push(step);
        
        // Create and append step element
        const stepElement = this.createStepElement(step);
        this.timelineContainer.appendChild(stepElement);
        
        // Update record count
        this.updateRecordCount();
        
        // Auto-scroll if enabled
        // Check if checkbox exists and is checked, or assume true if no checkbox
        const shouldAutoScroll = this.autoScrollCheckbox ? this.autoScrollCheckbox.checked : true;
        if (shouldAutoScroll) {
            this.scrollToBottom();
        }
    }

    // Add multiple thinking steps
    addThinkingSteps(steps) {
        if (!Array.isArray(steps) || !this.timelineContainer) return;
        
        steps.forEach(step => {
            this.addThinkingStep(step);
        });
    }

    // Create step element
    createStepElement(step) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'timeline-item';
        
        // Step content depends on type
        if (step.type === 'communication') {
            stepDiv.className += ' communication';
            stepDiv.innerHTML = `
                <div class="timeline-icon">💬</div>
                <div class="timeline-content">
                    <h4>${step.message || 'Communication'}</h4>
                    <p>${step.details || ''}</p>
                </div>
            `;
        } else if (step.type === 'conclusion') {
            stepDiv.className += ' conclusion';
            stepDiv.innerHTML = `
                <div class="timeline-icon">✓</div>
                <div class="timeline-content">
                    <h4>${step.message || 'Conclusion'}</h4>
                    <p>${step.details || ''}</p>
                </div>
            `;
        } else if (step.type === 'error') {
            stepDiv.className += ' error';
            stepDiv.innerHTML = `
                <div class="timeline-icon">❌</div>
                <div class="timeline-content">
                    <h4>${step.message || 'Error'}</h4>
                    <p>${step.details || ''}</p>
                </div>
            `;
        } else {
            // Default thinking step
            stepDiv.innerHTML = `
                <div class="timeline-icon">🤔</div>
                <div class="timeline-content">
                    <h4>${step.message || 'Thinking'}</h4>
                    <p>${step.details || ''}</p>
                </div>
            `;
        }
        
        return stepDiv;
    }

    // Update record count
    updateRecordCount() {
        if (this.recordCount) {
            this.recordCount.textContent = this.records.length;
        }
    }

    // Clear thinking records
    clearThinking() {
        this.records = [];
        
        if (this.timelineContainer) {
            this.timelineContainer.innerHTML = '';
        }
        
        this.updateRecordCount();
    }
    
    // Clear method (alias for clearThinking)
    clear() {
        this.clearThinking();
    }

    // Scroll to bottom of container
    scrollToBottom() {
        if (this.timelineContainer) {
            const container = this.timelineContainer.parentElement || this.timelineContainer;
            container.scrollTop = container.scrollHeight;
        }
    }
}
