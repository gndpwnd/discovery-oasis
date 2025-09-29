// fillers/dropdownFiller.js
class DropdownFiller {
    constructor() {
        this.maxRetries = 5;
    }
    
    async fillDropdownField(field, retryCount = 0) {
        try {
            const element = field.element;
            const value = dataStorage.getValue('dropdown', field.id, field.label);
            
            if (!value) {
                logger.warning(`No value found for dropdown field: ${field.label || field.id}`);
                return false;
            }
            
            logger.debug(`Filling dropdown field ${field.label || field.id} with: ${value}`);
            
            // Click to open dropdown
            await this.openDropdown(element);
            await this.sleep(1000);
            
            // Try to find and select the option
            const success = await this.selectOption(element, value);
            
            if (success) {
                // Verify the selection
                await this.sleep(500);
                const isSelected = await this.verifySelection(element, value);
                
                if (isSelected) {
                    logger.info(`Successfully filled dropdown field: ${field.label || field.id}`);
                    return true;
                } else if (retryCount < this.maxRetries) {
                    logger.stuck(`Dropdown not selected properly, retrying...`, retryCount);
                    await this.sleep(3000);
                    return await this.fillDropdownField(field, retryCount + 1);
                }
            }
            
            logger.error(`Failed to fill dropdown field after ${retryCount + 1} attempts: ${field.label || field.id}`);
            return false;
            
        } catch (error) {
            logger.error(`Error filling dropdown field: ${field.label || field.id}`, error);
            return false;
        }
    }
    
    async openDropdown(element) {
        // Focus and click the dropdown button
        element.focus();
        await this.sleep(200);
        
        // Try different click methods
        const clickMethods = [
            () => element.click(),
            () => this.simulateClick(element),
            () => this.dispatchClickEvents(element)
        ];
        
        for (const clickMethod of clickMethods) {
            try {
                clickMethod();
                await this.sleep(500);
                
                // Check if dropdown opened (look for listbox or options)
                const listbox = document.querySelector('[role="listbox"]');
                const options = document.querySelectorAll('[role="option"]');
                
                if (listbox || options.length > 0) {
                    logger.debug('Dropdown opened successfully');
                    return true;
                }
            } catch (error) {
                logger.debug('Click method failed, trying next:', error);
            }
        }
        
        logger.warning('Failed to open dropdown');
        return false;
    }
    
    async selectOption(element, targetValue) {
        // Wait a moment for options to load
        await this.sleep(500);
        
        // Look for options in different ways
        const optionSelectors = [
            '[role="option"]',
            '[data-automation-id*="option"]',
            '.css-option', // Common CSS class pattern
            'li[role="presentation"]',
            'button[role="option"]'
        ];
        
        for (const selector of optionSelectors) {
            const options = document.querySelectorAll(selector);
            
            if (options.length > 0) {
                const matchingOption = await this.findMatchingOption(options, targetValue);
                if (matchingOption) {
                    return await this.clickOption(matchingOption, targetValue);
                }
            }
        }
        
        // Try typing to search/filter
        return await this.tryTypeToSelect(targetValue);
    }
    
    async findMatchingOption(options, targetValue) {
        const normalizeText = (text) => text.toLowerCase().trim().replace(/\s+/g, ' ');
        const normalizedTarget = normalizeText(targetValue);
        
        // Exact match first
        for (const option of options) {
            const optionText = normalizeText(option.textContent);
            if (optionText === normalizedTarget) {
                logger.debug(`Found exact match: ${optionText}`);
                return option;
            }
        }
        
        // Partial match
        for (const option of options) {
            const optionText = normalizeText(option.textContent);
            if (optionText.includes(normalizedTarget) || normalizedTarget.includes(optionText)) {
                logger.debug(`Found partial match: ${optionText}`);
                return option;
            }
        }
        
        // Special mappings for common values
        const mappings = {
            'yes': ['yes', 'true', 'accept', 'i accept'],
            'no': ['no', 'false', 'decline'],
            'english': ['english', 'en', 'en-us'],
            'united states': ['united states', 'usa', 'us', 'america'],
            'bachelor': ['bachelor', 'bachelors', "bachelor's", 'bs', 'b.s.'],
            'male': ['male', 'm'],
            'female': ['female', 'f'],
            'not declared': ['not declared', 'prefer not to say', 'decline to state']
        };
        
        const lowerTarget = normalizedTarget.toLowerCase();
        for (const [key, synonyms] of Object.entries(mappings)) {
            if (synonyms.some(synonym => lowerTarget.includes(synonym))) {
                for (const option of options) {
                    const optionText = normalizeText(option.textContent).toLowerCase();
                    if (synonyms.some(synonym => optionText.includes(synonym))) {
                        logger.debug(`Found synonym match: ${optionText} for ${targetValue}`);
                        return option;
                    }
                }
            }
        }
        
        return null;
    }
    
    async clickOption(option, targetValue) {
        try {
            // Scroll option into view
            option.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(300);
            
            // Try different click methods
            const clickMethods = [
                () => option.click(),
                () => this.simulateClick(option),
                () => this.dispatchClickEvents(option)
            ];
            
            for (const clickMethod of clickMethods) {
                try {
                    clickMethod();
                    await this.sleep(500);
                    
                    // Check if option was selected (dropdown closed)
                    const listbox = document.querySelector('[role="listbox"]');
                    if (!listbox) {
                        logger.debug(`Successfully selected option: ${targetValue}`);
                        return true;
                    }
                } catch (error) {
                    logger.debug('Option click method failed:', error);
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error clicking option:', error);
            return false;
        }
    }
    
    async tryTypeToSearch(targetValue) {
        // Find search input in dropdown
        const searchInputs = document.querySelectorAll('input[placeholder*="search" i], input[placeholder*="type" i]');
        
        for (const input of searchInputs) {
            if (input.offsetParent !== null) { // Check if visible
                try {
                    input.focus();
                    input.value = '';
                    
                    // Type the search term
                    await textFiller.fillByTyping(input, targetValue);
                    await this.sleep(1000);
                    
                    // Look for filtered options
                    const options = document.querySelectorAll('[role="option"]');
                    if (options.length > 0) {
                        const firstOption = options[0];
                        return await this.clickOption(firstOption, targetValue);
                    }
                } catch (error) {
                    logger.debug('Type to search failed:', error);
                }
            }
        }
        
        return false;
    }
    
    async verifySelection(element, expectedValue) {
        // Check button text
        const buttonText = element.textContent.trim();
        const normalizedButton = buttonText.toLowerCase();
        const normalizedExpected = expectedValue.toLowerCase();
        
        if (normalizedButton === normalizedExpected || 
            normalizedButton.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedButton)) {
            return true;
        }
        
        // Check hidden input value
        const hiddenInput = element.parentNode?.querySelector('input[type="text"]');
        if (hiddenInput && hiddenInput.value) {
            return true;
        }
        
        return false;
    }
    
    simulateClick(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const mouseDown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        });
        
        const mouseUp = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        });
        
        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        });
        
        element.dispatchEvent(mouseDown);
        element.dispatchEvent(mouseUp);
        element.dispatchEvent(click);
    }
    
    dispatchClickEvents(element) {
        const events = ['mousedown', 'mouseup', 'click'];
        events.forEach(eventType => {
            const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(event);
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const dropdownFiller = new DropdownFiller();