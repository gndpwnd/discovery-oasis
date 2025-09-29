// fillers/textFiller.js
class TextFiller {
    constructor() {
        this.retryAttempts = 0;
        this.maxRetries = 5;
    }
    
    async fillTextField(field, retryCount = 0) {
        try {
            const element = field.element;
            const value = dataStorage.getValue('text', field.id, field.label);
            
            if (!value) {
                logger.warning(`No value found for text field: ${field.label || field.id}`);
                return false;
            }
            
            logger.debug(`Filling text field ${field.label || field.id} with: ${value}`);
            
            // Focus the element first
            element.focus();
            await this.sleep(200);
            
            // Clear existing content
            element.select();
            element.value = '';
            
            // Use different methods to set value
            const success = await this.tryMultipleFillMethods(element, value);
            
            if (success) {
                // Verify the value was set
                await this.sleep(500);
                const isSet = await formDetector.waitForFieldValue(element, value, 3000);
                
                if (isSet) {
                    logger.info(`Successfully filled text field: ${field.label || field.id}`);
                    return true;
                } else if (retryCount < this.maxRetries) {
                    logger.stuck(`Text field not filled properly, retrying...`, retryCount);
                    await this.sleep(3000);
                    return await this.fillTextField(field, retryCount + 1);
                }
            }
            
            logger.error(`Failed to fill text field after ${retryCount + 1} attempts: ${field.label || field.id}`);
            return false;
            
        } catch (error) {
            logger.error(`Error filling text field: ${field.label || field.id}`, error);
            return false;
        }
    }
    
    async tryMultipleFillMethods(element, value) {
        const methods = [
            () => this.fillByTyping(element, value),
            () => this.fillByValueProperty(element, value),
            () => this.fillByDispatchEvent(element, value),
            () => this.fillByClipboard(element, value)
        ];
        
        for (let i = 0; i < methods.length; i++) {
            try {
                await methods[i]();
                await this.sleep(200);
                
                if (element.value === value) {
                    logger.debug(`Fill method ${i + 1} successful`);
                    return true;
                }
            } catch (error) {
                logger.debug(`Fill method ${i + 1} failed:`, error);
            }
        }
        
        return false;
    }
    
    async fillByTyping(element, value) {
        // Simulate typing character by character
        element.value = '';
        element.focus();
        
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            
            // Create and dispatch keydown event
            const keydownEvent = new KeyboardEvent('keydown', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(keydownEvent);
            
            // Create and dispatch input event
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            element.value += char;
            element.dispatchEvent(inputEvent);
            
            // Create and dispatch keyup event
            const keyupEvent = new KeyboardEvent('keyup', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(keyupEvent);
            
            await this.sleep(50); // Small delay between characters
        }
        
        // Dispatch change event
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        element.dispatchEvent(changeEvent);
    }
    
    async fillByValueProperty(element, value) {
        element.focus();
        element.value = value;
        
        // Trigger various events
        const events = ['input', 'change', 'blur'];
        for (const eventType of events) {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            element.dispatchEvent(event);
        }
    }
    
    async fillByDispatchEvent(element, value) {
        element.focus();
        
        // Set value using Object.getOwnPropertyDescriptor
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valueSetter.call(element, value);
        
        // Dispatch React-style events
        const inputEvent = new Event('input', { bubbles: true });
        Object.defineProperty(inputEvent, 'target', { writable: false, value: element });
        element.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
    }
    
    async fillByClipboard(element, value) {
        // Try using clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value);
            element.focus();
            
            // Simulate Ctrl+V
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: new DataTransfer(),
                bubbles: true,
                cancelable: true
            });
            
            pasteEvent.clipboardData.setData('text/plain', value);
            element.dispatchEvent(pasteEvent);
            
            // Also set value directly
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    async fillTextareaField(field, retryCount = 0) {
        // Textarea fields use similar logic to text fields
        return await this.fillTextField(field, retryCount);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const textFiller = new TextFiller();