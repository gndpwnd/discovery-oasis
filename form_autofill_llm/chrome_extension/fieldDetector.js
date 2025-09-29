// fieldDetector.js - Detects and extracts form fields from the page
class FieldDetector {
    constructor() {
        this.detectedFields = {};
        this.fieldElements = new Map();
        this.fieldCounter = 0;
    }

    detectAllInputs() {
        console.log('Starting form detection...');
        this.detectedFields = {};
        this.fieldElements.clear();
        this.fieldCounter = 0;

        const inputSelectors = [
            'input[type="text"]',
            'input[type="email"]',
            'input[type="password"]',
            'input[type="tel"]',
            'input[type="url"]',
            'input[type="number"]',
            'input[type="search"]',
            'input[type="date"]',
            'input[type="datetime-local"]',
            'input[type="time"]',
            'input[type="month"]',
            'input[type="week"]',
            'input[type="checkbox"]',
            'input[type="radio"]',
            'textarea',
            'select',
            '[contenteditable="true"]',
            '[role="textbox"]',
            '[role="combobox"]',
            'button[role="combobox"]',
            'button[aria-haspopup="listbox"]'
        ];

        const allElements = [];
        inputSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (!this.shouldIgnoreElement(element)) {
                    allElements.push(element);
                }
            });
        });

        allElements.forEach(element => {
            this.processElement(element);
        });

        console.log(`Detected ${Object.keys(this.detectedFields).length} form fields`);
        return this.detectedFields;
    }

    shouldIgnoreElement(element) {
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            return true;
        }

        if (element.disabled) {
            return true;
        }

        const systemPatterns = ['csrf', 'token', '_token', '__', 'honeypot', 'captcha'];
        const id = (element.id || '').toLowerCase();
        const name = (element.name || '').toLowerCase();
        const className = (element.className || '').toLowerCase();
        
        if (systemPatterns.some(pattern => 
            id.includes(pattern) || name.includes(pattern) || className.includes(pattern)
        )) {
            return true;
        }

        return false;
    }

    processElement(element) {
        const fieldInfo = this.extractFieldInfo(element);
        
        if (fieldInfo.label || fieldInfo.placeholder || fieldInfo.id || fieldInfo.name) {
            const fieldKey = this.generateFieldKey(fieldInfo);
            this.detectedFields[fieldKey] = '';
            
            this.fieldElements.set(fieldKey, {
                element: element,
                type: fieldInfo.type,
                info: fieldInfo
            });
        }
    }

    extractFieldInfo(element) {
        const info = {
            type: this.getElementType(element),
            id: element.id,
            name: element.name,
            className: element.className,
            placeholder: element.placeholder,
            value: this.getCurrentValue(element),
            label: this.findLabel(element),
            ariaLabel: element.getAttribute('aria-label'),
            ariaLabelledBy: element.getAttribute('aria-labelledby'),
            title: element.title,
            required: element.hasAttribute('required') || element.getAttribute('aria-required') === 'true'
        };

        if (element.tagName.toLowerCase() === 'select') {
            info.options = Array.from(element.options).map(option => ({
                value: option.value,
                text: option.textContent.trim()
            }));
        }

        if (element.type === 'radio' || element.type === 'checkbox') {
            info.options = this.getRadioCheckboxOptions(element);
        }

        return info;
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'input') {
            return element.type || 'text';
        } else if (tagName === 'textarea') {
            return 'textarea';
        } else if (tagName === 'select') {
            return element.multiple ? 'multiselect' : 'select';
        } else if (element.contentEditable === 'true') {
            return 'contenteditable';
        } else if (element.role === 'textbox') {
            return 'textbox';
        } else if (element.role === 'combobox' || element.getAttribute('aria-haspopup') === 'listbox') {
            return 'combobox';
        }
        
        return tagName;
    }

    getCurrentValue(element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked;
        } else if (element.tagName.toLowerCase() === 'select') {
            return element.value;
        } else if (element.contentEditable === 'true') {
            return element.textContent.trim();
        }
        return element.value || '';
    }

    findLabel(element) {
        if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label').trim();
        }

        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) {
                return labelElement.textContent.trim();
            }
        }

        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) {
                return label.textContent.trim();
            }
        }

        const parentLabel = element.closest('label');
        if (parentLabel) {
            const labelText = Array.from(parentLabel.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE || 
                        (node.nodeType === Node.ELEMENT_NODE && node !== element))
                .map(node => node.textContent || '')
                .join(' ')
                .trim();
            if (labelText) {
                return labelText;
            }
        }

        const parent = element.parentElement;
        if (parent) {
            const possibleLabels = parent.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
            for (const labelCandidate of possibleLabels) {
                const text = labelCandidate.textContent.trim();
                if (text && text.length > 1 && text.length < 200 && !text.match(/^\d+$/) && labelCandidate !== element) {
                    return text;
                }
            }
        }

        return null;
    }

    getRadioCheckboxOptions(element) {
        const options = [];
        const name = element.name;
        
        if (name) {
            const similarElements = document.querySelectorAll(`input[name="${name}"]`);
            similarElements.forEach(el => {
                const label = this.findLabel(el);
                options.push({
                    value: el.value,
                    label: label || el.value,
                    checked: el.checked
                });
            });
        }
        
        return options;
    }

    generateFieldKey(fieldInfo) {
        let key = '';
        
        if (fieldInfo.label) {
            key = fieldInfo.label;
        } else if (fieldInfo.placeholder) {
            key = fieldInfo.placeholder;
        } else if (fieldInfo.ariaLabel) {
            key = fieldInfo.ariaLabel;
        } else if (fieldInfo.id) {
            key = fieldInfo.id.replace(/[_-]/g, ' ');
        } else if (fieldInfo.name) {
            key = fieldInfo.name.replace(/[_-]/g, ' ');
        } else {
            key = `${fieldInfo.type}_field_${++this.fieldCounter}`;
        }

        key = key.replace(/\*/g, '').replace(/\s*required\s*/gi, '').trim();
        
        if (fieldInfo.type !== 'text' && fieldInfo.type !== 'input') {
            key = `${key} (${fieldInfo.type})`;
        }

        let originalKey = key;
        let counter = 1;
        while (this.detectedFields.hasOwnProperty(key)) {
            key = `${originalKey}_${counter}`;
            counter++;
        }

        return key;
    }

    getDetectedFields() {
        return this.detectedFields;
    }

    getFieldElement(fieldKey) {
        return this.fieldElements.get(fieldKey);
    }

    getAllFieldElements() {
        return this.fieldElements;
    }
}