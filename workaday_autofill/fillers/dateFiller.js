// fillers/dateFiller.js
class DateFiller {
    constructor() {
        this.maxRetries = 5;
    }
    
    async fillDateField(field, retryCount = 0) {
        try {
            const element = field.element;
            const value = dataStorage.getValue('date', field.id, field.label);
            
            if (!value) {
                logger.warning(`No value found for date field: ${field.label || field.id}`);
                return false;
            }
            
            logger.debug(`Filling date field ${field.label || field.id} with: ${value}`);
            
            // Parse the date value
            const dateComponents = this.parseDateValue(value);
            if (!dateComponents) {
                logger.error(`Invalid date format: ${value}`);
                return false;
            }
            
            // Fill the date components
            const success = await this.fillDateComponents(element, dateComponents);
            
            if (success) {
                await this.sleep(500);
                const isVerified = await this.verifyDateFill(element, dateComponents);
                
                if (isVerified) {
                    logger.info(`Successfully filled date field: ${field.label || field.id}`);
                    return true;
                } else if (retryCount < this.maxRetries) {
                    logger.stuck(`Date field not filled properly, retrying...`, retryCount);
                    await this.sleep(3000);
                    return await this.fillDateField(field, retryCount + 1);
                }
            }
            
            logger.error(`Failed to fill date field after ${retryCount + 1} attempts: ${field.label || field.id}`);
            return false;
            
        } catch (error) {
            logger.error(`Error filling date field: ${field.label || field.id}`, error);
            return false;
        }
    }
    
    parseDateValue(value) {
        if (typeof value === 'string') {
            if (value.toLowerCase() === 'today') {
                const today = dataStorage.getTodayDate();
                return {
                    month: today.month,
                    day: today.day,
                    year: today.year
                };
            }
            
            // Try different date formats
            const formats = [
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
                /^(\d{1,2})-(\d{1,2})-(\d{4})$/,  // MM-DD-YYYY
                /^(\d{1,2})\/(\d{4})$/,           // MM/YYYY
                /^(\d{4})$/                       // YYYY only
            ];
            
            for (const format of formats) {
                const match = value.match(format);
                if (match) {
                    if (match.length === 4) { // MM/DD/YYYY or MM-DD-YYYY
                        return {
                            month: match[1],
                            day: match[2],
                            year: match[3]
                        };
                    } else if (match.length === 3) { // MM/YYYY
                        return {
                            month: match[1],
                            day: '1', // Default to 1st
                            year: match[2]
                        };
                    } else if (match.length === 2) { // YYYY only
                        return {
                            month: '1', // Default to January
                            day: '1',
                            year: match[1]
                        };
                    }
                }
            }
        } else if (typeof value === 'object' && value.month && value.year) {
            return {
                month: value.month.toString(),
                day: (value.day || '1').toString(),
                year: value.year.toString()
            };
        }
        
        logger.error(`Unable to parse date value: ${value}`);
        return null;
    }
    
    async fillDateComponents(container, dateComponents) {
        try {
            // Find month, day, and year input fields
            const monthInput = container.querySelector('[aria-label*="Month"], [id*="Month"]');
            const dayInput = container.querySelector('[aria-label*="Day"], [id*="Day"]');
            const yearInput = container.querySelector('[aria-label*="Year"], [id*="Year"]');
            
            const results = [];
            
            // Fill month
            if (monthInput && dateComponents.month) {
                results.push(await this.fillDateInput(monthInput, dateComponents.month, 1, 12));
            }
            
            // Fill day
            if (dayInput && dateComponents.day) {
                results.push(await this.fillDateInput(dayInput, dateComponents.day, 1, 31));
            }
            
            // Fill year
            if (yearInput && dateComponents.year) {
                results.push(await this.fillDateInput(yearInput, dateComponents.year, 1900, 2100));
            }
            
            return results.every(result => result);
        } catch (error) {
            logger.error('Error filling date components:', error);
            return false;
        }
    }
    
    async fillDateInput(input, value, min, max) {
        try {
            // Focus the input
            input.focus();
            await this.sleep(200);
            
            // Clear and set value
            input.select();
            input.value = '';
            
            // Try multiple methods to set value
            const methods = [
                () => this.setByTyping(input, value),
                () => this.setBySpinButton(input, value, min, max),
                () => this.setByDirectValue(input, value)
            ];
            
            for (const method of methods) {
                try {
                    await method();
                    await this.sleep(300);
                    
                    if (input.value === value.toString()) {
                        logger.debug(`Successfully set date input: ${value}`);
                        return true;
                    }
                } catch (error) {
                    logger.debug('Date input method failed:', error);
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error filling date input:', error);
            return false;
        }
    }
    
    async setByTyping(input, value) {
        // Type the value character by character
        for (let char of value.toString()) {
            const keydownEvent = new KeyboardEvent('keydown', {
                key: char,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(keydownEvent);
            
            input.value += char;
            
            const inputEvent = new Event('input', { bubbles: true });
            input.dispatchEvent(inputEvent);
            
            const keyupEvent = new KeyboardEvent('keyup', {
                key: char,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(keyupEvent);
            
            await this.sleep(50);
        }
        
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
    }
    
    async setBySpinButton(input, value, min, max) {
        const targetValue = parseInt(value);
        const currentValue = parseInt(input.value) || min;
        const difference = targetValue - currentValue;
        
        if (difference === 0) return;
        
        const key = difference > 0 ? 'ArrowUp' : 'ArrowDown';
        const steps = Math.abs(difference);
        
        for (let i = 0; i < steps && i < 50; i++) { // Limit to 50 steps to prevent infinite loops
            const keyEvent = new KeyboardEvent('keydown', {
                key: key,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(keyEvent);
            
            await this.sleep(100);
            
            if (parseInt(input.value) === targetValue) {
                break;
            }
        }
    }
    
    async setByDirectValue(input, value) {
        // Set value directly and trigger events
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        valueSetter.call(input, value.toString());
        
        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
    }
    
    async verifyDateFill(container, dateComponents) {
        const monthInput = container.querySelector('[aria-label*="Month"], [id*="Month"]');
        const dayInput = container.querySelector('[aria-label*="Day"], [id*="Day"]');
        const yearInput = container.querySelector('[aria-label*="Year"], [id*="Year"]');
        
        const checks = [];
        
        if (monthInput && dateComponents.month) {
            checks.push(monthInput.value === dateComponents.month.toString());
        }
        
        if (dayInput && dateComponents.day) {
            checks.push(dayInput.value === dateComponents.day.toString());
        }
        
        if (yearInput && dateComponents.year) {
            checks.push(yearInput.value === dateComponents.year.toString());
        }
        
        return checks.every(check => check);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const dateFiller = new DateFiller();