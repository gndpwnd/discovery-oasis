// main.js - Main orchestration script
class WorkdayAutoFiller {
    constructor() {
        this.isRunning = false;
        this.currentPage = null;
        this.detectedFields = [];
        this.fillResults = new Map();
        this.config = {
            fillDelay: 1000,        // Delay between field fills
            retryAttempts: 3,       // Retries for failed fields
            waitTimeout: 10000,     // Timeout for element waits
            autoAdvance: false      // Whether to auto-click next buttons
        };
    }
    
    async initialize() {
        try {
            logger.info('Initializing Workday AutoFiller...');
            
            // Check if we're on a Workday page
            if (!formDetector.isWorkdayJobPage()) {
                logger.info('Not a Workday job page, exiting');
                return false;
            }
            
            // Wait for data to load
            await this.waitForDataLoad();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Add UI indicator
            this.addUIIndicator();
            
            logger.info('AutoFiller initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('Failed to initialize AutoFiller:', error);
            return false;
        }
    }
    
    async waitForDataLoad() {
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds
        
        while (!dataStorage.loaded && attempts < maxAttempts) {
            logger.debug('Waiting for data to load...');
            await this.sleep(500);
            attempts++;
        }
        
        if (!dataStorage.loaded) {
            throw new Error('Data failed to load within timeout period');
        }
        
        logger.info('Data loaded successfully');
    }
    
    setupEventListeners() {
        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl+Shift+F to start auto-filling
            if (event.ctrlKey && event.shiftKey && event.key === 'F') {
                event.preventDefault();
                this.startAutoFill();
            }
            
            // Ctrl+Shift+D for debug info
            if (event.ctrlKey && event.shiftKey && event.key === 'D') {
                event.preventDefault();
                this.showDebugInfo();
            }
        });
        
        // Listen for page changes
        let lastUrl = window.location.href;
        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                this.handlePageChange();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    addUIIndicator() {
        // Add a small indicator showing the extension is active
        const indicator = document.createElement('div');
        indicator.id = 'workday-autofill-indicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 10000;
                background: #2196F3;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                cursor: pointer;
            ">
                AutoFill Ready
                <div style="font-size: 10px; opacity: 0.8;">Ctrl+Shift+F</div>
            </div>
        `;
        
        indicator.addEventListener('click', () => this.startAutoFill());
        document.body.appendChild(indicator);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0.3';
                indicator.style.transition = 'opacity 0.5s';
            }
        }, 5000);
    }
    
    async startAutoFill() {
        if (this.isRunning) {
            logger.warning('AutoFill already running');
            return;
        }
        
        try {
            this.isRunning = true;
            this.updateStatus('Detecting form fields...');
            
            // Detect all form fields
            this.detectedFields = await formDetector.detectAllFields();
            
            if (this.detectedFields.length === 0) {
                throw new Error('No form fields detected on this page');
            }
            
            logger.info(`Found ${this.detectedFields.length} form fields to process`);
            
            // Fill all detected fields
            await this.fillAllFields();
            
            // Show results
            this.showFillResults();
            
            // Auto-advance if configured
            if (this.config.autoAdvance) {
                await this.tryAdvanceToNextPage();
            }
            
        } catch (error) {
            logger.error('AutoFill process failed:', error);
            this.showError(error.message);
        } finally {
            this.isRunning = false;
            this.updateStatus('Ready');
        }
    }
    
    async fillAllFields() {
        logger.info('Starting to fill all fields...');
        this.fillResults.clear();
        
        // Group fields by type for better processing order
        const fieldGroups = this.groupFieldsByType(this.detectedFields);
        
        // Process field types in optimal order
        const processingOrder = ['text', 'textarea', 'dropdown', 'checkbox', 'radio', 'date', 'multiselect'];
        
        for (const fieldType of processingOrder) {
            const fields = fieldGroups[fieldType] || [];
            
            if (fields.length > 0) {
                logger.info(`Processing ${fields.length} ${fieldType} field(s)`);
                await this.fillFieldsByType(fields, fieldType);
            }
        }
        
        logger.info('Field filling completed');
    }
    
    groupFieldsByType(fields) {
        const groups = {};
        
        for (const field of fields) {
            if (!groups[field.type]) {
                groups[field.type] = [];
            }
            groups[field.type].push(field);
        }
        
        return groups;
    }
    
    async fillFieldsByType(fields, fieldType) {
        for (const field of fields) {
            if (field.type === 'buttons') continue; // Skip button fields
            
            try {
                this.updateStatus(`Filling ${fieldType}: ${field.label || field.id || 'unnamed'}`);
                
                // Add delay between fields to avoid overwhelming the page
                await this.sleep(this.config.fillDelay);
                
                // Fill the field using appropriate filler
                const success = await this.fillSingleField(field);
                
                this.fillResults.set(field.id || field.label, {
                    success: success,
                    field: field,
                    type: fieldType
                });
                
                if (success) {
                    logger.info(`✓ Successfully filled: ${field.label || field.id}`);
                } else {
                    logger.warning(`✗ Failed to fill: ${field.label || field.id}`);
                }
                
            } catch (error) {
                logger.error(`Error filling field ${field.label || field.id}:`, error);
                this.fillResults.set(field.id || field.label, {
                    success: false,
                    field: field,
                    error: error.message
                });
            }
        }
    }
    
    async fillSingleField(field) {
        // Route to appropriate filler based on field type
        switch (field.type) {
            case 'text':
                return await textFiller.fillTextField(field);
            
            case 'textarea':
                return await textFiller.fillTextareaField(field);
            
            case 'dropdown':
                return await dropdownFiller.fillDropdownField(field);
            
            case 'checkbox':
                return await checkboxFiller.fillCheckboxField(field);
            
            case 'radio':
                return await radioFiller.fillRadioField(field);
            
            case 'date':
                return await dateFiller.fillDateField(field);
            
            case 'multiselect':
                return await multiselectFiller.fillMultiselectField(field);
            
            default:
                logger.warning(`Unsupported field type: ${field.type}`);
                return false;
        }
    }
    
    showFillResults() {
        const successful = Array.from(this.fillResults.values()).filter(r => r.success).length;
        const total = this.fillResults.size;
        
        logger.info(`Fill Results: ${successful}/${total} fields completed successfully`);
        
        // Show detailed results
        for (const [fieldId, result] of this.fillResults) {
            const status = result.success ? '✓' : '✗';
            const fieldName = result.field.label || fieldId || 'unnamed';
            logger.info(`${status} ${fieldName} (${result.field.type})`);
        }
        
        // Show user-friendly notification
        this.showNotification(`Filled ${successful} out of ${total} fields`, successful === total ? 'success' : 'warning');
    }
    
    async tryAdvanceToNextPage() {
        logger.info('Looking for navigation buttons...');
        
        const buttonField = this.detectedFields.find(f => f.type === 'buttons');
        if (!buttonField || !buttonField.elements) {
            logger.info('No navigation buttons found');
            return;
        }
        
        // Look for next/continue/save buttons
        const nextButton = buttonField.elements.find(btn => {
            const text = btn.text.toLowerCase();
            return text.includes('next') || text.includes('continue') || 
                   text.includes('save') || text.includes('submit');
        });
        
        if (nextButton) {
            logger.info(`Found navigation button: ${nextButton.text}`);
            
            // Ask user confirmation
            if (confirm(`Auto-advance to next page using "${nextButton.text}" button?`)) {
                await this.sleep(2000); // Give user time to review
                nextButton.element.click();
                logger.info('Clicked navigation button');
            }
        }
    }
    
    handlePageChange() {
        logger.info('Page changed, resetting state');
        this.isRunning = false;
        this.detectedFields = [];
        this.fillResults.clear();
        
        // Re-initialize after page load
        setTimeout(() => {
            if (formDetector.isWorkdayJobPage()) {
                this.initialize();
            }
        }, 2000);
    }
    
    showDebugInfo() {
        logger.info('=== DEBUG INFORMATION ===');
        logger.info(`Current URL: ${window.location.href}`);
        logger.info(`Is Workday Page: ${formDetector.isWorkdayJobPage()}`);
        logger.info(`Data Loaded: ${dataStorage.loaded}`);
        logger.info(`Detected Fields: ${this.detectedFields.length}`);
        
        // Show field mappings
        if (dataStorage.loaded) {
            dataStorage.debugMappings();
        }
        
        // Show detected fields
        if (this.detectedFields.length > 0) {
            logger.info('=== DETECTED FIELDS ===');
            this.detectedFields.forEach(field => {
                logger.info(`${field.type}: ${field.label || field.id || 'unnamed'} (${field.automationId || 'no-automation-id'})`);
            });
        }
        
        logger.info('=== END DEBUG INFO ===');
    }
    
    updateStatus(message) {
        const indicator = document.getElementById('workday-autofill-indicator');
        if (indicator) {
            const statusDiv = indicator.querySelector('div');
            if (statusDiv) {
                statusDiv.innerHTML = `${message}<div style="font-size: 10px; opacity: 0.8;">Ctrl+Shift+F</div>`;
            }
        }
        
        logger.info(`Status: ${message}`);
    }
    
    showNotification(message, type = 'info') {
        const colors = {
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336',
            info: '#2196F3'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            z-index: 10001;
            background: ${colors[type]};
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            transition: all 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    showError(message) {
        logger.error(message);
        this.showNotification(`Error: ${message}`, 'error');
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the extension when the page loads
let autoFiller;

// Message handler for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!autoFiller) {
        sendResponse({ success: false, error: 'AutoFiller not initialized' });
        return;
    }
    
    switch (request.action) {
        case 'startAutoFill':
            autoFiller.startAutoFill().then(() => {
                sendResponse({ 
                    success: true, 
                    message: 'Auto-fill completed',
                    results: Object.fromEntries(autoFiller.fillResults)
                });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Indicates async response
            
        case 'detectFields':
            formDetector.detectAllFields().then(fields => {
                sendResponse({ 
                    success: true, 
                    message: `Detected ${fields.length} fields`,
                    fieldCount: fields.length
                });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'showDebugInfo':
            autoFiller.showDebugInfo();
            sendResponse({ success: true, message: 'Debug info logged to console' });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Wait for all dependencies to load
const initializeWhenReady = async () => {
    // Check if all required components are loaded
    if (typeof logger !== 'undefined' && 
        typeof dataStorage !== 'undefined' && 
        typeof formDetector !== 'undefined' &&
        typeof textFiller !== 'undefined' &&
        typeof dropdownFiller !== 'undefined' &&
        typeof checkboxFiller !== 'undefined' &&
        typeof radioFiller !== 'undefined' &&
        typeof dateFiller !== 'undefined' &&
        typeof multiselectFiller !== 'undefined') {
        
        logger.info('All dependencies loaded, initializing AutoFiller...');
        
        autoFiller = new WorkdayAutoFiller();
        const initialized = await autoFiller.initialize();
        
        if (initialized) {
            logger.success('Workday AutoFiller is ready!');
            logger.info('Press Ctrl+Shift+F to start auto-filling');
            logger.info('Press Ctrl+Shift+D for debug information');
        }
    } else {
        // Retry after a short delay
        setTimeout(initializeWhenReady, 500);
    }
};

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWhenReady);
} else {
    initializeWhenReady();
}