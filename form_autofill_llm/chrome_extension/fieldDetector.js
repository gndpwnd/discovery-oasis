// fieldDetector.js - Detects and extracts form fields from the page (Robust Version)
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

        const allElements = [];
        const processedElements = new Set();
        
        // Standard input selectors
        const inputSelectors = [
            'input[type="text"]', 'input[type="email"]', 'input[type="password"]',
            'input[type="tel"]', 'input[type="url"]', 'input[type="number"]',
            'input[type="search"]', 'input[type="date"]', 'input[type="datetime-local"]',
            'input[type="time"]', 'input[type="month"]', 'input[type="week"]',
            'input[type="checkbox"]', 'input[type="radio"]',
            'input:not([type])', 'input[type=""]',
            'textarea',
            'input[type="file"]', 'input[type="range"]', 'input[type="color"]'
        ];

        // Detect standard inputs
        inputSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                console.log(`Selector "${selector}" found ${elements.length} elements`);
                
                elements.forEach(element => {
                    if (!processedElements.has(element) && !this.shouldIgnoreElement(element)) {
                        allElements.push(element);
                        processedElements.add(element);
                    }
                });
            } catch (e) {
                console.warn(`Invalid selector: ${selector}`, e);
            }
        });

        // Detect visible native select elements
        document.querySelectorAll('select').forEach(select => {
            if (!processedElements.has(select) && !this.shouldIgnoreElement(select)) {
                // Check if it's a hidden select with a custom dropdown
                const hasCustomDropdown = select.classList.contains('dropdown-hide') || 
                                         select.style.display === 'none' ||
                                         window.getComputedStyle(select).display === 'none';
                
                if (!hasCustomDropdown) {
                    allElements.push(select);
                    processedElements.add(select);
                }
            }
        });

        // Detect custom dropdowns (iCIMS pattern: hidden select + visible anchor)
        document.querySelectorAll('select.dropdown-hide, select[icimsdropdown-enabled="1"]').forEach(hiddenSelect => {
            if (processedElements.has(hiddenSelect)) return;
            
            const selectId = hiddenSelect.id;
            const dropdownAnchor = document.querySelector(`a#${selectId}_icimsDropdown`);
            
            if (dropdownAnchor) {
                console.log(`Found custom dropdown pair: ${selectId}`);
                allElements.push({
                    element: hiddenSelect,
                    customDropdown: dropdownAnchor,
                    type: 'custom-dropdown'
                });
                processedElements.add(hiddenSelect);
            } else if (!this.shouldIgnoreElement(hiddenSelect)) {
                // Hidden select without custom dropdown - still include it
                allElements.push(hiddenSelect);
                processedElements.add(hiddenSelect);
            }
        });

        // Detect date dropdowns (iCIMS pattern: Month/Day/Year selects)
        document.querySelectorAll('select[id*="_Month"], select[id*="_Date"], select[id*="_Year"]').forEach(dateSelect => {
            if (!processedElements.has(dateSelect) && !this.shouldIgnoreElement(dateSelect)) {
                allElements.push(dateSelect);
                processedElements.add(dateSelect);
            }
        });

        // Detect ARIA-based interactive elements
        const ariaSelectors = [
            '[role="textbox"]', '[role="combobox"]', '[role="listbox"]',
            '[role="searchbox"]', '[role="spinbutton"]',
            '[contenteditable="true"]', '[contenteditable=""]',
            'button[role="combobox"]', 'button[aria-haspopup="listbox"]',
            'button[aria-haspopup="menu"]', 'input[role="combobox"]',
            'div[role="combobox"]', '[aria-haspopup="listbox"]',
            '[aria-haspopup="menu"]'
        ];

        ariaSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(element => {
                    if (!processedElements.has(element) && !this.shouldIgnoreElement(element)) {
                        allElements.push(element);
                        processedElements.add(element);
                    }
                });
            } catch (e) {
                console.warn(`Invalid ARIA selector: ${selector}`, e);
            }
        });

        // Detect framework-specific inputs
        const frameworkSelectors = [
            '[class*="select"][class*="input"]',
            '[class*="dropdown"] input',
            '[id*="react-select"]',
            '[class*="MuiInput"]', '[class*="MuiTextField"]', '[class*="MuiSelect"]',
            '[class*="ant-input"]', '[class*="ant-select"]',
            '[class*="date"][class*="picker"] input', '[class*="DatePicker"] input'
        ];

        frameworkSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(element => {
                    if (!processedElements.has(element) && !this.shouldIgnoreElement(element)) {
                        allElements.push(element);
                        processedElements.add(element);
                    }
                });
            } catch (e) {
                console.warn(`Invalid framework selector: ${selector}`, e);
            }
        });

        console.log(`Total elements to process: ${allElements.length}`);
        
        allElements.forEach(item => {
            if (item && item.type === 'custom-dropdown') {
                this.processCustomDropdown(item.element, item.customDropdown);
            } else if (item) {
                this.processElement(item);
            }
        });

        console.log(`Detected ${Object.keys(this.detectedFields).length} form fields`);
        console.log('Detected fields:', this.detectedFields);
        return this.detectedFields;
    }

    shouldIgnoreElement(element) {
        if (!element || !element.getBoundingClientRect) return true;

        const computedStyle = window.getComputedStyle(element);
        
        // Don't ignore if it's a hidden select with a custom dropdown
        const isCustomDropdownSelect = element.tagName === 'SELECT' && 
            (element.classList.contains('dropdown-hide') || 
             element.getAttribute('icimsdropdown-enabled') === '1');
        
        if (isCustomDropdownSelect) {
            return false; // Don't ignore these, we'll process them specially
        }

        // Ignore truly hidden elements
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            return true;
        }
        
        // Ignore disabled elements
        if (element.disabled && element.getAttribute('aria-disabled') === 'true') {
            return true;
        }

        // Ignore system fields
        const systemPatterns = ['csrf', 'token', '_token', '__', 'honeypot', 'captcha'];
        const id = (element.id || '').toLowerCase();
        const name = (element.name || '').toLowerCase();
        const className = (element.className || '').toLowerCase();
        
        if (systemPatterns.some(pattern => 
            id.includes(pattern) || name.includes(pattern) || className.includes(pattern)
        )) {
            return true;
        }

        // Ignore hidden inputs (but not hidden selects with custom dropdowns)
        if (element.type === 'hidden') {
            return true;
        }

        return false;
    }

    processCustomDropdown(hiddenSelect, dropdownAnchor) {
        const fieldInfo = this.extractFieldInfo(hiddenSelect);
        fieldInfo.type = 'custom-select';
        fieldInfo.customDropdown = dropdownAnchor;
        
        // Extract options from the dropdown results list
        const dropdownResultsId = `${hiddenSelect.id}_dropdown-results`;
        const resultsContainer = document.querySelector(`#${dropdownResultsId}`);
        
        if (resultsContainer) {
            const options = [];
            resultsContainer.querySelectorAll('li[role="option"]').forEach(option => {
                const value = option.getAttribute('dropdown-index');
                const text = option.getAttribute('aria-label') || option.textContent.trim();
                if (value !== '-1' && text && !text.includes('Make a Selection')) {
                    options.push({ value, text });
                }
            });
            fieldInfo.options = options;
        }
        
        if (fieldInfo.label || fieldInfo.placeholder || fieldInfo.id || fieldInfo.name) {
            const fieldKey = this.generateFieldKey(fieldInfo);
            this.detectedFields[fieldKey] = '';
            
            this.fieldElements.set(fieldKey, {
                element: hiddenSelect,
                customDropdown: dropdownAnchor,
                type: 'custom-select',
                info: fieldInfo
            });
        }
    }

    processElement(element) {
        const fieldInfo = this.extractFieldInfo(element);
        
        if (fieldInfo.label || fieldInfo.placeholder || fieldInfo.id || fieldInfo.name) {
            const fieldKey = this.generateFieldKey(fieldInfo);
            
            // Get current value if field is already filled
            const currentValue = this.getCurrentValue(element);
            this.detectedFields[fieldKey] = currentValue || '';
            
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
            required: element.hasAttribute('required') || 
                     element.getAttribute('aria-required') === 'true' ||
                     element.getAttribute('i_required') === 'true'
        };

        if (element.tagName.toLowerCase() === 'select') {
            info.options = Array.from(element.options).map(option => ({
                value: option.value,
                text: option.textContent.trim()
            })).filter(opt => opt.value && opt.value !== '' && !opt.text.includes('Make a Selection'));
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
            const selectedOption = element.options[element.selectedIndex];
            if (selectedOption && selectedOption.value && selectedOption.value !== '' && 
                !selectedOption.textContent.includes('Make a Selection')) {
                return selectedOption.value;
            }
            return '';
        } else if (element.contentEditable === 'true') {
            return element.textContent.trim();
        }
        return element.value || '';
    }

    findLabel(element) {
        // Try aria-label first
        if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label').trim();
        }

        // Try aria-labelledby
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labels = labelledBy.split(' ').map(id => {
                const labelElement = document.getElementById(id);
                return labelElement ? labelElement.textContent.trim() : '';
            }).filter(text => text);
            
            if (labels.length > 0) {
                return labels.join(' ');
            }
        }

        // Try label[for]
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) {
                return this.cleanLabelText(label.textContent);
            }
        }

        // Try parent label
        const parentLabel = element.closest('label');
        if (parentLabel) {
            const labelText = Array.from(parentLabel.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE || 
                        (node.nodeType === Node.ELEMENT_NODE && node !== element && 
                         !node.classList.contains('Field_RequiredStar')))
                .map(node => node.textContent || '')
                .join(' ')
                .trim();
            if (labelText) {
                return this.cleanLabelText(labelText);
            }
        }

        // Try data-label attribute (iCIMS uses this)
        const dataLabel = element.getAttribute('data-label');
        if (dataLabel) {
            return this.cleanLabelText(dataLabel);
        }

        // Try nearby text in parent container
        const parent = element.closest('.iCIMS_TableRow, .iCIMS_FieldRow, .form-group, .field, [class*="field"]');
        if (parent) {
            const labelField = parent.querySelector('.iCIMS_InfoField, .iCIMS_LabelText, label, [class*="label"]');
            if (labelField) {
                return this.cleanLabelText(labelField.textContent);
            }
        }

        return null;
    }

    cleanLabelText(text) {
        return text
            .replace(/\*/g, '')
            .replace(/\s*required\s*/gi, '')
            .replace(/\s*\(Format.*?\)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
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

        key = this.cleanLabelText(key);
        
        if (fieldInfo.type !== 'text' && fieldInfo.type !== 'input' && fieldInfo.type !== 'custom-select' && fieldInfo.type !== 'select') {
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