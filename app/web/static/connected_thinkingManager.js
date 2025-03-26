// connected_thinkingManager.js - 处理AI思考过程显示

export class ThinkingManager {
    constructor() {
        this.timelineContainer = document.getElementById('thinking-timeline');
        if (!this.timelineContainer) {
            console.error('Thinking timeline container not found');
            return;
        }
        
        this.clearButton = document.getElementById('clear-thinking');
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearThinking());
        }

        // Make timeline scrollable
        this.timelineContainer.style.overflowY = 'auto';
        this.timelineContainer.style.maxHeight = 'calc(100vh - 400px)';
        this.timelineContainer.style.padding = '10px';
        
        // Keep track of steps
        this.steps = [];
    }

    addThinkingSteps(steps, replace = false, updated = false) {
        if (!this.timelineContainer) {
            console.error('Timeline container not found');
            return;
        }
        
        if (!steps || !Array.isArray(steps)) {
            console.warn('Invalid thinking steps received:', JSON.stringify(steps));
            return;
        }
        
        // Debug log to see what's being added
        console.log('Adding thinking steps:', JSON.stringify(steps).substring(0, 200) + '...');

        // If this is an update to existing steps, find and update them
        if (updated) {
            steps.forEach(updatedStep => {
                if (!updatedStep.id) return; // Skip steps without ID
                
                // Find existing step in our array
                const existingStepIndex = this.steps.findIndex(s => s.id === updatedStep.id);
                if (existingStepIndex >= 0) {
                    // Update the step in our internal array
                    this.steps[existingStepIndex] = updatedStep;
                    
                    // Find corresponding DOM element and update it
                    const stepElements = this.timelineContainer.querySelectorAll('.timeline-item');
                    if (existingStepIndex < stepElements.length) {
                        const stepElement = stepElements[existingStepIndex];
                        
                        // Update message
                        const header = stepElement.querySelector('.timeline-header');
                        if (header) header.textContent = updatedStep.message;
                        
                        // Update details if they exist
                        if (updatedStep.details) {
                            let details = stepElement.querySelector('.timeline-details');
                            if (!details) {
                                // Create details element if it doesn't exist
                                details = document.createElement('div');
                                details.className = 'timeline-details';
                                details.style.display = 'none';
                                
                                // Add toggle button for details
                                const toggleBtn = document.createElement('button');
                                toggleBtn.className = 'btn-details';
                                toggleBtn.textContent = 'Show Details';
                                toggleBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    details.style.display = details.style.display === 'none' ? 'block' : 'none';
                                    toggleBtn.textContent = details.style.display === 'none' ? 'Show Details' : 'Hide Details';
                                };
                                
                                // Find where to insert the elements
                                const timestamp = stepElement.querySelector('.timeline-timestamp');
                                if (timestamp) {
                                    const content = timestamp.parentElement;
                                    content.insertBefore(toggleBtn, timestamp);
                                    content.insertBefore(details, timestamp);
                                }
                            }
                            
                            // Update details content
                            details.innerHTML = this.formatDetails(updatedStep.details);
                        }
                    }
                    
                    console.log(`Updated existing step ${updatedStep.id}`);
                    return; // Skip adding this step since we updated it
                }
            });
            
            // Update the record count (though it shouldn't change for updates)
            this.updateRecordCount();
            return; // Exit after handling updates
        }

        // Store steps - either replace all or filter and add only new ones
        if (replace) {
            console.log(`Replacing all steps with ${steps.length} new steps`);
            this.steps = steps;
            // Clear existing timeline to rebuild
            this.timelineContainer.innerHTML = '';
        } else {
            // Filter out steps that already exist based on ID
            const existingIds = new Set(this.steps.map(step => step.id));
            const newSteps = steps.filter(step => !step.id || !existingIds.has(step.id));
            
            console.log(`Adding ${newSteps.length} new steps (filtered from ${steps.length} received)`);
            if (newSteps.length === 0) {
                console.log('No new steps to add, skipping update');
                return; // Skip if no new steps
            }
            
            this.steps = this.steps.concat(newSteps);
        }

        // Create a document fragment to batch DOM updates
        const fragment = document.createDocumentFragment();
        
        steps.forEach(step => {
            // Ensure step is properly formatted
            const formattedStep = {
                message: typeof step === 'string' ? step : (step.message || 'No message'),
                type: step.type || 'thought',
                details: step.details || null,
                timestamp: step.timestamp || Math.floor(Date.now() / 1000)
            };

            const stepElement = this.createStepElement(formattedStep);
            
            // Set initial opacity to 0 for fade-in effect
            stepElement.style.opacity = '0';
            stepElement.style.transition = 'opacity 0.3s ease-in-out';
            
            fragment.appendChild(stepElement);
        });
        
        // Append all steps at once
        this.timelineContainer.appendChild(fragment);
        
        // Force reflow and trigger animations
        this.timelineContainer.offsetHeight;
        
        // Make all new steps visible
        const newSteps = this.timelineContainer.querySelectorAll('.timeline-item[style*="opacity: 0"]');
        newSteps.forEach(step => {
            step.style.opacity = '1';
        });
        
        // Update the record count
        this.updateRecordCount();
        
        // Scroll to bottom if auto-scroll is enabled
        const autoScroll = document.getElementById('auto-scroll');
        if (!autoScroll || autoScroll.checked) {
            this.scrollToBottom();
        }
    }

    updateRecordCount() {
        const recordCount = document.getElementById('record-count');
        if (recordCount) {
            recordCount.textContent = `${this.steps.length} records`;
            console.log(`Updated record count to ${this.steps.length}`);
        } else {
            console.error('Record count element not found');
        }
    }

    createStepElement(step) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'timeline-item';
        
        // Make step clickable
        stepDiv.style.cursor = 'pointer';
        stepDiv.addEventListener('click', () => this.handleStepClick(step));
        
        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        stepDiv.appendChild(marker);
        
        const content = document.createElement('div');
        content.className = 'timeline-content';
        
        const header = document.createElement('div');
        header.className = 'timeline-header';
        header.textContent = step.message;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'timeline-timestamp';
        timestamp.textContent = this.formatTimestamp(step.timestamp);
        
        content.appendChild(header);
        if (step.details) {
            const details = document.createElement('div');
            details.className = 'timeline-details';
            details.innerHTML = this.formatDetails(step.details);
            content.appendChild(details);
            
            // Add toggle button for details
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn-details';
            toggleBtn.textContent = 'Show Details';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                details.style.display = details.style.display === 'none' ? 'block' : 'none';
                toggleBtn.textContent = details.style.display === 'none' ? 'Show Details' : 'Hide Details';
            };
            content.insertBefore(toggleBtn, details);
            details.style.display = 'none';
        }
        
        content.appendChild(timestamp);
        stepDiv.appendChild(content);
        return stepDiv;
    }

    handleStepClick(step) {
        // Emit event for computer panel to show relevant content
        const event = new CustomEvent('timeline-step-clicked', {
            detail: {
                step: step,
                timestamp: step.timestamp
            }
        });
        window.dispatchEvent(event);
    }

    getTypeIcon(type) {
        const icons = {
            'thought': '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm1.61-9.96c-2.06-.3-3.88.97-4.43 2.79-.18.58.26 1.17.87 1.17h.2c.41 0 .74-.29.88-.67.32-.89 1.27-1.5 2.3-1.28.95.2 1.65 1.13 1.57 2.1-.1 1.34-1.62 1.63-2.45 2.88 0 .01-.01.01-.01.02-.01.02-.02.03-.03.05-.09.15-.18.32-.25.5-.01.03-.03.05-.04.08-.01.02-.01.04-.02.07-.12.34-.2.75-.2 1.25h2c0-.42.11-.77.28-1.07.02-.03.03-.06.05-.09.08-.14.18-.27.28-.39.01-.01.02-.03.03-.04.1-.12.21-.23.33-.34.96-.91 2.26-1.65 1.99-3.56-.24-1.74-1.61-3.21-3.35-3.47z"/></svg>',
            'action': '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-11h2v6h-2zm0 8h2v2h-2z"/></svg>',
            'result': '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
            'error': '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>'
        };
        
        return icons[type] || icons['thought'];
    }

    formatDetails(details) {
        if (typeof details === 'string') {
            return this.formatCode(details);
        } else if (Array.isArray(details)) {
            return details.map(detail => this.formatCode(detail)).join('<br>');
        } else if (typeof details === 'object' && details !== null) {
            // If details has a 'result' field, extract and display it
            if (details.result) {
                return this.formatCode(details.result);
            }
            return this.formatCode(JSON.stringify(details, null, 2));
        }
        return '';
    }

    formatCode(text) {
        return `<pre><code>${this.escapeHtml(text)}</code></pre>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString();
    }

    scrollToBottom() {
        this.timelineContainer.scrollTop = this.timelineContainer.scrollHeight;
    }

    clearThinking() {
        if (this.timelineContainer) {
            this.timelineContainer.innerHTML = '';
            this.steps = [];
            this.updateRecordCount();
        }
    }
}
