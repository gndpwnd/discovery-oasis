// content.js - Main content script
class WorkdayAutoFiller {
    constructor() {
        this.isRunning = false;
        this.currentFields = [];
        this.formDetector = new FormDetector();
        this.fillAttempts = 0;
        this.maxAttempts = 3;
        this.checkInterval = 3000; // 3 seconds
        this.statusUpdateInterval = null;
    }
    
    async init() {
        try {
            logger.info('Workday AutoFiller initialized');
            logger.info(`Current URL: ${window.location.href}`);
            
            // Check if we're on a Workday job application page
            if (!this.formDetector.isWorkdayJobPage()) {
                logger.info('Not a Workday job application page, extension not activated');
                return;
            }
            
            logger.success('Workday job application page detected!');
            
            // Wait a bit for the page to fully load
            await this.sleep(2000);
            
            // Start the auto-fill process
            await this.startAutoFill();
            
        } catch (error) {
            logger.error('Error initializing AutoFiller:', error);
        }
    }
    
    async startAutoFill() {
        if (this.isRunning) {
            logger.warning('AutoFill is already running');
            return;
        }
        
        this.isRunning = true;
        logger.info('Starting auto-fill process...');
        
        try {
            // Start periodic checking
            this.statusUpdateInterval = setInterval(() => {
                this.checkAndFillFields();
            }, this.checkInterval);
            
            // Initial fill attempt
            await this.checkAndFillFields();
            
        } catch (error) {
            logger.error('Error starting auto-fill:', error);
            this.isRunning = false;
        }
    }
    
    async checkAndFillFields() {
        try {
            if (this.fillAttempts >= this.maxAttempts) {
                logger.info('Maximum fill attempts reached, stopping auto-fill');
                this.stopAutoFill();
                return;
            }
            
            logger.debug(`Checking for fields (attempt ${this.fillAttempts + 1}/${this.maxAttempts})`);
            
            // Detect all form fields
            const fields = await this.formDetector.detectAllFields();
            
            if (fields.length === 0) {
                logger.debug('No fillable fields detected');
                return;
            }
            
            logger.info(`Found ${fields.length} fillable fields`);
            this.currentFields = fields;
            
            // Fill the fields
            let filledCount = 0;
            let errorCount = 0;
            
            for (const field of fields) {
                if (!this.isRunning) break; // Stop if user disabled
                
                try {
                    const success = await this.fillField(field);
                    if (success) {
                        filledCount++;
                    } else {
                        errorCount++;
                    }
                    
                    // Small delay between fields
                    await this.sleep(500);
                    
                } catch (error) {
                    logger.error(`Error filling field ${field.label || field.id}:`, error);
                    errorCount++;
                }
            }
            
            this.fillAttempts++;
            logger.info(`Fill attempt ${this.fillAttempts} completed: ${filledCount} filled, ${errorCount} errors`);
            
            // Check if we should continue or stop
            if (filledCount === 0 && errorCount === 0) {
                logger.info('No fields needed filling, checking for navigation buttons');
                await this.checkForNavigationButtons();
            } else if (filledCount > 0) {
                logger.success(`Successfully filled ${filledCount} fields`);
                // Reset attempts counter on successful fills
                if (filledCount > errorCount) {
                    this.fillAttempts = 0;
                }
            }
            
        } catch (error) {
            logger.error('Error in checkAndFillFields:', error);
        }
    }
    
    async fillField(field) {
        try {
            logger.debug(`Attempting to fill field: ${field.label || field.id} (${field.type})`);
            
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
                    logger.warning(`Unknown field type: ${field.type}`);
                    return false;
            }
            
        } catch (error) {
            logger.error(`Error filling field ${field.label || field.id}:`, error);
            return false;
        }
    }
    
    async checkForNavigationButtons() {
        try {
            // Look for "Save and Continue", "Next", "Continue" buttons
            const buttonSelectors = [
                'button[data-automation-id*="pageFooterNextButton"]',
                'button[data-automation-id*="continueButton"]',
                'button:contains("Save and Continue")',
                'button:contains("Continue")',
                'button:contains("Next")',
                'button[type="submit"]'
            ];
            
            for (const selector of buttonSelectors) {
                const button = document.querySelector(selector);
                if (button && !button.disabled && button.offsetParent !== null) {
                    logger.info(`Found navigation button: ${button.textContent.trim()}`);
                    
                    // Check if all required fields are filled before clicking
                    const hasUnfilledRequired = await this.checkForUnfilledRequiredFields();
                    
                    if (!hasUnfilledRequired) {
                        logger.info('All required fields appear to be filled, clicking navigation button');
                        button.click();
                        
                        // Stop auto-fill after clicking navigation
                        this.stopAutoFill();
                        
                        // Reinitialize after page change
                        setTimeout(() => {
                            this.init();
                        }, 3000);
                        
                        return true;
                    } else {
                        logger.warning('Some required fields may not be filled, not clicking navigation button yet');
                    }
                    
                    break;
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error checking for navigation buttons:', error);
            return false;
        }
    }
    
    async checkForUnfilledRequiredFields() {
        try {
            // Look for required fields that are empty or in error state
            const requiredFields = document.querySelectorAll('[aria-required="true"]');
            let unfilledCount = 0;
            
            for (const field of requiredFields) {
                let isEmpty = false;
                
                if (field.tagName === 'INPUT') {
                    isEmpty = !field.value || field.value.trim() === '';
                } else if (field.tagName === 'TEXTAREA') {
                    isEmpty = !field.value || field.value.trim() === '';
                } else if (field.tagName === 'BUTTON') {
                    // For dropdown buttons, check if they have a selected value
                    const hiddenInput = field.parentNode?.querySelector('input[type="text"]');
                    isEmpty = !hiddenInput?.value;
                } else {
                    // For custom elements, try to determine if they have a value
                    const input = field.querySelector('input');
                    if (input) {
                        isEmpty = !input.value || input.value.trim() === '';
                    }
                }
                
                if (isEmpty) {
                    unfilledCount++;
                    logger.debug(`Found unfilled required field: ${field.id || field.name || 'unknown'}`);
                }
            }
            
            logger.debug(`Found ${unfilledCount} unfilled required fields`);
            return unfilledCount > 0;
            
        } catch (error) {
            logger.error('Error checking for unfilled required fields:', error);
            return true; // Assume there are unfilled fields on error
        }
    }
    
    stopAutoFill() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
        this.isRunning = false;
        logger.info('Auto-fill stopped');
    }
    
    // Public methods for extension popup
    getStatus() {
        return {
            isRunning: this.isRunning,
            fieldsDetected: this.currentFields.length,
            fillAttempts: this.fillAttempts,
            maxAttempts: this.maxAttempts,
            url: window.location.href
        };
    }
    
    restart() {
        this.stopAutoFill();
        this.fillAttempts = 0;
        setTimeout(() => {
            this.init();
        }, 1000);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the extension
const autoFiller = new WorkdayAutoFiller();

// Start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoFiller.init());
} else {
    autoFiller.init();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'getStatus':
            sendResponse(autoFiller.getStatus());
            break;
        
        case 'start':
            autoFiller.startAutoFill();
            sendResponse({ success: true });
            break;
        
        case 'stop':
            autoFiller.stopAutoFill();
            sendResponse({ success: true });
            break;
        
        case 'restart':
            autoFiller.restart();
            sendResponse({ success: true });
            break;
        
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Export for global access
window.workdayAutoFiller = autoFiller;