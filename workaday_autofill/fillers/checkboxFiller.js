// fillers/checkboxFiller.js
class CheckboxFiller {
    constructor() {
        this.maxRetries = 5;
    }
    
    async fillCheckboxField(field, retryCount = 0) {
        try {
            const element = field.element;
            const value = dataStorage.getValue('checkbox', field.id, field.label);
            
            if (value === null || value === undefined) {
                logger.warning(`No value found for checkbox field: ${field.label || field.id}`);
                return false;
            }
            
            // Convert value to boolean
            const shouldCheck = this.convertToBoolean(value);
            const isCurrentlyChecked = element.checked || element.getAttribute('aria-checked') === 'true';
            
            logger.debug(`Checkbox ${field.label || field.id}: current=${isCurrentlyChecked}, target=${shouldCheck}`);
            
            // If already in correct state, no action needed
            if (isCurrentlyChecked === shouldCheck) {
                logger.info(`Checkbox already in correct state: ${field.label || field.id}`);
                return true;
            }
            
            // Click to toggle checkbox
            const success = await this.toggleCheckbox(element, shouldCheck);
            
            if (success) {
                // Verify the state change
                await this.sleep(500);
                const newState = element.checked || element.getAttribute('aria-checked') === 'true';
                
                if (newState === shouldCheck) {
                    logger.info(`Successfully set checkbox field: ${field.label || field.id} = ${shouldCheck}`);
                    return true;
                } else if (retryCount < this.maxRetries) {
                    logger.stuck(`Checkbox state not changed properly, retrying...`, retryCount);
                    await this.sleep(3000);
                    return await this.fillCheckboxField(field, retryCount + 1);
                }
            }
            
            logger.error(`Failed to set checkbox field after ${retryCount + 1} attempts: ${field.label || field.id}`);
            return false;
            
        } catch (error) {
            logger.error(`Error filling checkbox field: ${field.label || field.id}`, error);
            return false;
        }
    }
    
    async toggleCheckbox(element, shouldCheck) {
        try {
            // Scroll into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(300);
            
            // Focus the element
            element.focus();
            await this.sleep(200);
            
            // Try different click methods
            const clickMethods = [
                () => this.clickCheckbox(element),
                () => this.clickLabel(element),
                () => this.simulateKeyPress(element),
                () => this.directStateChange(element, shouldCheck)
            ];
            
            for (const clickMethod of clickMethods) {
                try {
                    await clickMethod();
                    await this.sleep(300);
                    
                    const newState = element.checked || element.getAttribute('aria-checked') === 'true';
                    if (newState === shouldCheck) {
                        logger.debug('Checkbox toggle successful');
                        return true;
                    }
                } catch (error) {
                    logger.debug('Checkbox toggle method failed:', error);
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error toggling checkbox:', error);
            return false;
        }
    }
    
    async clickCheckbox(element) {
        // Direct click on checkbox
        element.click();
    }
    
    async clickLabel(element) {
        // Find associated label and click it
        const label = element.id ? document.querySelector(`label[for="${element.id}"]`) : 
                     element.closest('label') || 
                     element.parentNode.querySelector('label');
        
        if (label) {
            label.click();
        } else {
            // Try clicking parent container
            const container = element.closest('.css-1utp272, .checkbox-container');
            if (container) {
                container.click();
            }
        }
    }
    
    async simulateKeyPress(element) {
        // Use space bar to toggle
        element.focus();
        
        const keydownEvent = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true
        });
        
        const keyupEvent = new KeyboardEvent('keyup', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true
        });
        
        element.dispatchEvent(keydownEvent);
        element.dispatchEvent(keyupEvent);
    }
    
    async directStateChange(element, shouldCheck) {
        // Directly set properties and dispatch events
        element.checked = shouldCheck;
        element.setAttribute('aria-checked', shouldCheck.toString());
        
        // Dispatch change events
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        element.dispatchEvent(changeEvent);
        
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent);
    }
    
    convertToBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        
        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase().trim();
            return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'on';
        }
        
        if (typeof value === 'number') {
            return value !== 0;
        }
        
        return Boolean(value);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const checkboxFiller = new CheckboxFiller();