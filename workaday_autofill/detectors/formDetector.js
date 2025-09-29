// detectors/formDetector.js
class FormDetector {
    constructor() {
        this.detectedFields = new Map();
        this.retryCount = 0;
        this.maxRetries = 5;
        this.checkInterval = 3000;
        
        // Enhanced selectors for Workday forms
        this.fieldSelectors = {
            text: [
                'input[type="text"]:not([readonly])',
                'input[data-automation-id*="textInput"]',
                'input[aria-label]:not([type="radio"]):not([type="checkbox"]):not([type="file"])',
                'input[id*="firstName"], input[id*="lastName"], input[id*="middleName"]',
                'input[name*="name"], input[name*="email"], input[name*="phone"]'
            ],
            textarea: [
                'textarea',
                '[data-automation-id*="textarea"]',
                'textarea[aria-label]'
            ],
            dropdown: [
                'button[aria-haspopup="listbox"]',
                'button[data-automation-id*="dropdown"]',
                'select',
                'button[role="combobox"]',
                '.css-f400d4', // Workday dropdown button class
                'button[aria-label*="Required"]'
            ],
            checkbox: [
                'input[type="checkbox"]',
                '[data-automation-id*="checkbox"]',
                'input[aria-checked]'
            ],
            radio: [
                'input[type="radio"]',
                '[data-automation-id*="radio"]'
            ],
            date: [
                '[data-automation-id="dateInputWrapper"]',
                '[data-automation-id*="dateInput"]',
                '.date-input-container',
                'input[type="date"]',
                '[id*="dateSectionMonth"], [id*="dateSectionDay"], [id*="dateSectionYear"]'
            ],
            multiselect: [
                '[data-automation-id="multiSelectContainer"]',
                '[data-uxi-widget-type="multiselect"]',
                '.multiselect-container'
            ],
            file: [
                'input[type="file"]',
                '[data-automation-id*="fileUpload"]',
                '[data-automation-id*="attachment"]'
            ]
        };
    }
    
    isWorkdayJobPage() {
        const url = window.location.href;
        const isWorkday = url.includes('myworkdayjobs.com');
        
        logger.info(`URL Detection: ${url}`);
        logger.info(`Is Workday Job Page: ${isWorkday}`);
        
        return isWorkday;
    }
    
    async detectAllFields() {
        logger.info('Starting comprehensive field detection...');
        this.detectedFields.clear();
        
        // Wait for page to fully load and dynamic content
        await this.waitForPageLoad();
        await this.waitForDynamicContent();
        
        // Detect all field types
        await this.detectFieldsByType();
        
        // Post-process detected fields
        this.groupRadioButtons();
        this.identifyDateComponents();
        this.detectImportantButtons();
        
        logger.info(`Detected ${this.detectedFields.size} form fields`);
        
        // Log detected fields for debugging
        this.logDetectedFields();
        
        return Array.from(this.detectedFields.values());
    }
    
    async waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                setTimeout(resolve, 2000);
            } else {
                window.addEventListener('load', () => {
                    setTimeout(resolve, 2000);
                });
            }
        });
    }
    
    async waitForDynamicContent() {
        // Wait for Workday's dynamic content to load
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            const formElements = document.querySelectorAll('input, button, textarea, select');
            if (formElements.length > 5) { // Reasonable threshold
                logger.debug('Dynamic content appears to be loaded');
                break;
            }
            
            logger.debug(`Waiting for dynamic content... attempt ${attempts + 1}`);
            await this.sleep(1000);
            attempts++;
        }
        
        // Additional wait for any remaining async operations
        await this.sleep(2000);
    }
    
    async detectFieldsByType() {
        for (const [fieldType, selectors] of Object.entries(this.fieldSelectors)) {
            logger.debug(`Detecting ${fieldType} fields...`);
            
            for (const selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    
                    for (const element of elements) {
                        if (this.shouldIgnoreElement(element)) continue;
                        if (this.isFieldAlreadyDetected(element)) continue;
                        
                        const fieldInfo = await this.extractFieldInfo(element, fieldType);
                        if (fieldInfo && this.isValidField(fieldInfo)) {
                            const fieldId = this.generateFieldId(element, fieldInfo);
                            
                            this.detectedFields.set(fieldId, {
                                ...fieldInfo,
                                element: element,
                                type: fieldType,
                                selector: selector
                            });
                            
                            logger.debug(`Detected ${fieldType}: ${fieldInfo.label || fieldInfo.id || 'unnamed'}`);
                        }
                    }
                } catch (error) {
                    logger.debug(`Error with selector ${selector}:`, error);
                }
            }
        }
    }
    
    shouldIgnoreElement(element) {
        // Skip hidden, disabled, or system elements
        if (!element.offsetParent && element.style.display === 'none') return true;
        if (element.disabled) return true;
        if (element.readonly && element.type !== 'text') return true;
        
        // Skip system/internal fields
        const ignoredIds = ['csrf', 'token', '__', 'hidden'];
        const id = (element.id || '').toLowerCase();
        const name = (element.name || '').toLowerCase();
        
        return ignoredIds.some(ignored => id.includes(ignored) || name.includes(ignored));
    }
    
    async extractFieldInfo(element, fieldType) {
        const info = {
            id: element.id,
            name: element.name || element.getAttribute('name'),
            automationId: element.getAttribute('data-automation-id'),
            uxi: element.getAttribute('data-uxi-element-id'),
            label: null,
            placeholder: element.placeholder,
            required: this.isFieldRequired(element),
            value: this.getCurrentValue(element),
            ariaLabel: element.getAttribute('aria-label'),
            classes: element.className
        };
        
        // Find label using multiple strategies
        info.label = await this.findFieldLabel(element);
        
        // Additional processing based on field type
        if (fieldType === 'dropdown') {
            info.options = await this.getDropdownOptions(element);
        } else if (fieldType === 'radio') {
            info.groupName = element.name || this.findRadioGroupName(element);
        } else if (fieldType === 'date') {
            info.dateComponents = this.identifyDateComponent(element);
        }
        
        return info;
    }
    
    findFieldLabel(element) {
        // Comprehensive label detection strategies
        const strategies = [
            () => element.getAttribute('aria-label'),
            () => this.getLabelByLabelledBy(element),
            () => this.getLabelByForAttribute(element),
            () => this.getLabelByParent(element),
            () => this.getLabelByFieldset(element),
            () => this.getLabelByWorkdayStructure(element),
            () => this.getLabelByProximity(element),
            () => element.placeholder
        ];
        
        for (const strategy of strategies) {
            try {
                const label = strategy();
                if (label && typeof label === 'string' && label.trim().length > 0) {
                    return this.cleanLabel(label.trim());
                }
            } catch (error) {
                logger.debug('Label detection strategy failed:', error);
            }
        }
        
        return null;
    }
    
    getLabelByLabelledBy(element) {
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            return labelElement?.textContent;
        }
    }
    
    getLabelByForAttribute(element) {
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            return label?.textContent;
        }
    }
    
    getLabelByParent(element) {
        const parentLabel = element.closest('label');
        return parentLabel?.textContent;
    }
    
    getLabelByFieldset(element) {
        const fieldset = element.closest('fieldset');
        if (fieldset) {
            const legend = fieldset.querySelector('legend');
            return legend?.textContent;
        }
    }
    
    getLabelByWorkdayStructure(element) {
        // Workday-specific label detection
        const workdaySelectors = [
            '.css-1ud5i8o span',      // Common Workday label class
            '.css-f6y8ld',           // Rich text labels
            '[data-automation-id*="label"]',
            '.form-label',
            '.field-label'
        ];
        
        // Look in parent containers
        const containers = [
            element.closest('[data-automation-id*="formField"]'),
            element.closest('.form-field'),
            element.closest('.field-container'),
            element.closest('[data-fkit-id]'),
            element.parentElement,
            element.parentElement?.parentElement
        ].filter(Boolean);
        
        for (const container of containers) {
            for (const selector of workdaySelectors) {
                const labelElement = container.querySelector(selector);
                if (labelElement?.textContent?.trim()) {
                    return labelElement.textContent;
                }
            }
        }
    }
    
    getLabelByProximity(element) {
        // Look for text content in nearby elements
        const searchDistance = 3;
        let current = element.previousElementSibling;
        let distance = 0;
        
        while (current && distance < searchDistance) {
            const text = current.textContent?.trim();
            if (text && text.length > 2 && text.length < 100) {
                // Filter out common non-label text
                const excludePatterns = ['*', 'required', 'optional', ':', 'select'];
                if (!excludePatterns.some(pattern => text.toLowerCase().includes(pattern))) {
                    return text;
                }
            }
            current = current.previousElementSibling;
            distance++;
        }
    }
    
    cleanLabel(label) {
        return label
            .replace(/\*/g, '')           // Remove asterisks
            .replace(/\s*required\s*/gi, '') // Remove "required" text
            .replace(/\s*:\s*$/, '')      // Remove trailing colons
            .trim();
    }
    
    isFieldRequired(element) {
        return element.hasAttribute('required') ||
               element.getAttribute('aria-required') === 'true' ||
               element.closest('[data-automation-id*="formField"]')?.textContent?.includes('*');
    }
    
    getCurrentValue(element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked;
        }
        return element.value || element.textContent?.trim() || null;
    }
    
    async getDropdownOptions(element) {
        // Try to get dropdown options if available
        try {
            element.click();
            await this.sleep(500);
            
            const options = document.querySelectorAll('[role="option"]');
            const optionTexts = Array.from(options).map(opt => opt.textContent.trim());
            
            // Close dropdown
            element.click();
            
            return optionTexts;
        } catch (error) {
            return [];
        }
    }
    
    findRadioGroupName(element) {
        // Try to determine radio group name from context
        const fieldset = element.closest('fieldset');
        if (fieldset) {
            const legend = fieldset.querySelector('legend');
            if (legend) {
                return legend.textContent.trim();
            }
        }
        
        return element.getAttribute('data-automation-id') || 'unknown-group';
    }
    
    identifyDateComponent(element) {
        const id = element.id || '';
        if (id.includes('Month')) return 'month';
        if (id.includes('Day')) return 'day';
        if (id.includes('Year')) return 'year';
        
        const ariaLabel = element.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Month')) return 'month';
        if (ariaLabel.includes('Day')) return 'day';
        if (ariaLabel.includes('Year')) return 'year';
        
        return null;
    }
    
    groupRadioButtons() {
        // Group radio buttons by name attribute
        const radioGroups = new Map();
        
        for (const [fieldId, field] of this.detectedFields) {
            if (field.type === 'radio' && field.element.name) {
                const groupName = field.element.name;
                if (!radioGroups.has(groupName)) {
                    radioGroups.set(groupName, []);
                }
                radioGroups.get(groupName).push(field);
                this.detectedFields.delete(fieldId); // Remove individual radio
            }
        }
        
        // Create grouped radio field entries
        for (const [groupName, radioFields] of radioGroups) {
            const firstRadio = radioFields[0];
            this.detectedFields.set(groupName, {
                ...firstRadio,
                type: 'radio',
                element: radioFields.map(r => r.element),
                groupName: groupName,
                options: radioFields.map(r => ({
                    element: r.element,
                    value: r.element.value,
                    label: this.getRadioOptionLabel(r.element)
                }))
            });
            
            logger.debug(`Grouped ${radioFields.length} radio buttons under: ${groupName}`);
        }
    }
    
    getRadioOptionLabel(radioElement) {
        // Get label for individual radio option
        if (radioElement.id) {
            const label = document.querySelector(`label[for="${radioElement.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        const parentLabel = radioElement.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        
        const nextSibling = radioElement.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'LABEL') {
            return nextSibling.textContent.trim();
        }
        
        return radioElement.value || 'Unknown';
    }
    
    identifyDateComponents() {
        // Link date components together
        const dateContainers = new Map();
        
        for (const [fieldId, field] of this.detectedFields) {
            if (field.type === 'date' && field.dateComponents) {
                const containerId = field.element.closest('[data-automation-id="dateInputWrapper"]')?.id ||
                                  field.element.closest('[role="group"]')?.id ||
                                  'date-container';
                
                if (!dateContainers.has(containerId)) {
                    dateContainers.set(containerId, {});
                }
                
                dateContainers.get(containerId)[field.dateComponents] = field;
                this.detectedFields.delete(fieldId);
            }
        }
        
        // Create composite date fields
        for (const [containerId, components] of dateContainers) {
            if (Object.keys(components).length > 0) {
                const firstComponent = Object.values(components)[0];
                this.detectedFields.set(containerId, {
                    ...firstComponent,
                    type: 'date',
                    element: firstComponent.element.closest('[data-automation-id="dateInputWrapper"]') ||
                            firstComponent.element.parentElement,
                    dateComponents: components
                });
            }
        }
    }
    
    detectImportantButtons() {
        const buttons = document.querySelectorAll('button');
        const importantButtons = [];
        
        const importantKeywords = [
            'save', 'continue', 'next', 'add', 'submit', 'apply', 'finish', 'complete'
        ];
        
        for (const button of buttons) {
            const text = button.textContent.trim().toLowerCase();
            const automationId = (button.getAttribute('data-automation-id') || '').toLowerCase();
            
            if (importantKeywords.some(keyword => 
                text.includes(keyword) || automationId.includes(keyword)
            )) {
                importantButtons.push({
                    element: button,
                    text: button.textContent.trim(),
                    automationId: button.getAttribute('data-automation-id'),
                    type: 'button'
                });
                logger.debug(`Detected important button: ${button.textContent.trim()}`);
            }
        }
        
        if (importantButtons.length > 0) {
            this.detectedFields.set('_buttons', {
                elements: importantButtons,
                type: 'buttons'
            });
        }
    }
    
    isValidField(fieldInfo) {
        // Field must have some way to identify it
        return fieldInfo.label || fieldInfo.id || fieldInfo.name || 
               fieldInfo.automationId || fieldInfo.placeholder;
    }
    
    generateFieldId(element, fieldInfo) {
        // Generate unique field ID
        return fieldInfo.id || 
               fieldInfo.automationId || 
               fieldInfo.name ||
               `field_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    isFieldAlreadyDetected(element) {
        for (const [key, field] of this.detectedFields) {
            if (field.element === element || 
                (Array.isArray(field.element) && field.element.includes(element))) {
                return true;
            }
        }
        return false;
    }
    
    logDetectedFields() {
        logger.info('=== DETECTED FORM FIELDS ===');
        for (const [fieldId, field] of this.detectedFields) {
            logger.info(`${field.type.toUpperCase()}: ${field.label || fieldId} (${field.automationId || 'no-automation-id'})`);
        }
        logger.info('=== END DETECTED FIELDS ===');
    }
    
    // Utility methods for form filling
    getFieldByIdentifier(identifier) {
        // Find field by various identifiers
        for (const [fieldId, field] of this.detectedFields) {
            if (fieldId === identifier ||
                field.id === identifier ||
                field.name === identifier ||
                field.automationId === identifier ||
                (field.label && field.label.toLowerCase().includes(identifier.toLowerCase()))) {
                return field;
            }
        }
        return null;
    }
    
    async waitForFieldValue(element, expectedValue, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const currentValue = this.getCurrentValue(element);
            
            if (this.valuesMatch(currentValue, expectedValue)) {
                logger.debug(`Field value confirmed: ${currentValue}`);
                return true;
            }
            
            await this.sleep(500);
        }
        
        logger.warning(`Field value not confirmed after ${timeout}ms`);
        return false;
    }
    
    valuesMatch(current, expected) {
        if (current === expected) return true;
        
        if (typeof current === 'string' && typeof expected === 'string') {
            const normalize = str => str.toLowerCase().trim();
            return normalize(current) === normalize(expected) ||
                   normalize(current).includes(normalize(expected)) ||
                   normalize(expected).includes(normalize(current));
        }
        
        return false;
    }
    
    async waitForElement(selector, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                return element;
            }
            await this.sleep(500);
        }
        
        return null;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create global instance
const formDetector = new FormDetector();