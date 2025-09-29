// fillers/radioFiller.js
class RadioFiller {
    constructor() {
        this.maxRetries = 5;
    }
    
    async fillRadioField(field, retryCount = 0) {
        try {
            const radioButtons = Array.isArray(field.element) ? field.element : [field.element];
            const value = dataStorage.getValue('radio', field.groupName || field.id, field.label);
            
            if (!value) {
                logger.warning(`No value found for radio field: ${field.label || field.groupName}`);
                return false;
            }
            
            logger.debug(`Filling radio field ${field.label || field.groupName} with: ${value}`);
            
            // Find the matching radio button
            const targetRadio = this.findMatchingRadio(radioButtons, value);
            
            if (!targetRadio) {
                logger.error(`No matching radio button found for value: ${value}`);
                return false;
            }
            
            // Select the radio button
            const success = await this.selectRadio(targetRadio, value);
            
            if (success) {
                await this.sleep(500);
                const isVerified = await this.verifyRadioSelection(targetRadio);
                
                if (isVerified) {
                    logger.info(`Successfully filled radio field: ${field.label || field.groupName}`);
                    return true;
                } else if (retryCount < this.maxRetries) {
                    logger.stuck(`Radio field not selected properly, retrying...`, retryCount);
                    await this.sleep(3000);
                    return await this.fillRadioField(field, retryCount + 1);
                }
            }
            
            logger.error(`Failed to fill radio field after ${retryCount + 1} attempts: ${field.label || field.groupName}`);
            return false;
            
        } catch (error) {
            logger.error(`Error filling radio field: ${field.label || field.groupName}`, error);
            return false;
        }
    }
    
    findMatchingRadio(radioButtons, targetValue) {
        const normalizeText = (text) => text.toLowerCase().trim().replace(/\s+/g, ' ');
        const normalizedTarget = normalizeText(targetValue);
        
        // First try exact value match
        for (const radio of radioButtons) {
            if (radio.value && normalizeText(radio.value) === normalizedTarget) {
                logger.debug(`Found radio by value match: ${radio.value}`);
                return radio;
            }
        }
        
        // Then try label matching
        for (const radio of radioButtons) {
            const label = this.getRadioLabel(radio);
            if (label && normalizeText(label) === normalizedTarget) {
                logger.debug(`Found radio by exact label match: ${label}`);
                return radio;
            }
        }
        
        // Try partial matching
        for (const radio of radioButtons) {
            const label = this.getRadioLabel(radio);
            if (label) {
                const normalizedLabel = normalizeText(label);
                if (normalizedLabel.includes(normalizedTarget) || normalizedTarget.includes(normalizedLabel)) {
                    logger.debug(`Found radio by partial label match: ${label}`);
                    return radio;
                }
            }
        }
        
        // Try common value mappings
        const mappings = {
            'yes': ['yes', 'true', '1', 'accept'],
            'no': ['no', 'false', '0', 'decline'],
            'male': ['male', 'm'],
            'female': ['female', 'f'],
            'other': ['other', 'prefer not to say', 'not specified']
        };
        
        for (const [key, synonyms] of Object.entries(mappings)) {
            if (synonyms.includes(normalizedTarget)) {
                for (const radio of radioButtons) {
                    const label = this.getRadioLabel(radio);
                    const value = radio.value;
                    
                    if ((label && synonyms.some(synonym => normalizeText(label).includes(synonym))) ||
                        (value && synonyms.some(synonym => normalizeText(value).includes(synonym)))) {
                        logger.debug(`Found radio by synonym mapping: ${label || value}`);
                        return radio;
                    }
                }
            }
        }
        
        return null;
    }
    
    getRadioLabel(radio) {
        // Try different methods to get the label
        
        // Method 1: Associated label element
        if (radio.id) {
            const label = document.querySelector(`label[for="${radio.id}"]`);
            if (label) {
                return label.textContent.trim();
            }
        }
        
        // Method 2: Parent label
        const parentLabel = radio.closest('label');
        if (parentLabel) {
            return parentLabel.textContent.trim();
        }
        
        // Method 3: Next sibling label
        const nextLabel = radio.nextElementSibling;
        if (nextLabel && nextLabel.tagName === 'LABEL') {
            return nextLabel.textContent.trim();
        }
        
        // Method 4: Look for nearby text
        const parent = radio.closest('.css-1utp272, .radio-option, .form-field');
        if (parent) {
            const labelElement = parent.querySelector('label');
            if (labelElement) {
                return labelElement.textContent.trim();
            }
        }
        
        // Method 5: aria-label
        if (radio.getAttribute('aria-label')) {
            return radio.getAttribute('aria-label');
        }
        
        return null;
    }
    
    async selectRadio(radio, targetValue) {
        try {
            // Scroll into view
            radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(300);
            
            // Try different selection methods
            const methods = [
                () => this.clickRadio(radio),
                () => this.clickRadioLabel(radio),
                () => this.useKeyboard(radio),
                () => this.directSelection(radio)
            ];
            
            for (const method of methods) {
                try {
                    await method();
                    await this.sleep(300);
                    
                    if (radio.checked || radio.getAttribute('aria-checked') === 'true') {
                        logger.debug('Radio selection successful');
                        return true;
                    }
                } catch (error) {
                    logger.debug('Radio selection method failed:', error);
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error selecting radio:', error);
            return false;
        }
    }
    
    async clickRadio(radio) {
        radio.focus();
        radio.click();
    }
    
    async clickRadioLabel(radio) {
        // Find and click the associated label
        if (radio.id) {
            const label = document.querySelector(`label[for="${radio.id}"]`);
            if (label) {
                label.click();
                return;
            }
        }
        
        const parentLabel = radio.closest('label');
        if (parentLabel) {
            parentLabel.click();
            return;
        }
        
        // Try clicking parent container
        const container = radio.closest('.css-1utp272, .radio-option');
        if (container) {
            container.click();
        }
    }
    
    async useKeyboard(radio) {
        radio.focus();
        
        const spaceEvent = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true
        });
        
        radio.dispatchEvent(spaceEvent);
    }
    
    async directSelection(radio) {
        // Directly set properties and dispatch events
        radio.checked = true;
        radio.setAttribute('aria-checked', 'true');
        
        // Uncheck other radios in the same group
        const groupName = radio.name;
        if (groupName) {
            const otherRadios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
            otherRadios.forEach(otherRadio => {
                if (otherRadio !== radio) {
                    otherRadio.checked = false;
                    otherRadio.setAttribute('aria-checked', 'false');
                }
            });
        }
        
        // Dispatch events
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        radio.dispatchEvent(changeEvent);
        
        const clickEvent = new Event('click', { bubbles: true, cancelable: true });
        radio.dispatchEvent(clickEvent);
    }
    
    async verifyRadioSelection(radio) {
        return radio.checked || radio.getAttribute('aria-checked') === 'true';
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const radioFiller = new RadioFiller();