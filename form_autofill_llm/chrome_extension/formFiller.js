// formFiller.js - Orchestrates the form filling process (Robust Version)
class FormFiller {
    constructor() {
        this.fieldDetector = new FieldDetector();
        this.fillingInProgress = false;
    }

    async autoFillFields(responseData) {
        if (this.fillingInProgress) {
            console.log('Form filling already in progress');
            return { success: false, error: 'Already filling form' };
        }

        this.fillingInProgress = true;

        try {
            console.log('Starting auto-fill with response data:', responseData);
            
            const fieldsToFill = responseData.fields || responseData;
            
            let filledCount = 0;
            let errorCount = 0;
            const results = [];

            for (const [fieldKey, value] of Object.entries(fieldsToFill)) {
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    console.log(`Skipping empty value for field: ${fieldKey}`);
                    continue;
                }

                const fieldData = this.fieldDetector.getFieldElement(fieldKey);
                if (!fieldData) {
                    console.warn(`No element found for field key: ${fieldKey}`);
                    errorCount++;
                    results.push({ field: fieldKey, success: false, error: 'Element not found' });
                    continue;
                }

                try {
                    const success = await this.fillSingleField(fieldData, value);
                    if (success) {
                        filledCount++;
                        results.push({ field: fieldKey, success: true });
                        console.log(`✓ Filled field: ${fieldKey} = ${value}`);
                    } else {
                        errorCount++;
                        results.push({ field: fieldKey, success: false, error: 'Fill failed' });
                        console.warn(`✗ Failed to fill field: ${fieldKey}`);
                    }
                } catch (error) {
                    console.error(`Error filling field ${fieldKey}:`, error);
                    errorCount++;
                    results.push({ field: fieldKey, success: false, error: error.message });
                }

                await this.sleep(300);
            }

            console.log(`Auto-fill completed: ${filledCount} filled, ${errorCount} errors`);
            
            return {
                success: true,
                filled: filledCount,
                errors: errorCount,
                results: results
            };
        } catch (error) {
            console.error('Error during auto-fill:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.fillingInProgress = false;
        }
    }

    async fillSingleField(fieldData, value) {
        const { element, type, customDropdown } = fieldData;
        
        try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(200);

            switch (type) {
                case 'custom-select':
                    return await this.fillCustomSelect(element, customDropdown, value);

                case 'text':
                case 'email':
                case 'password':
                case 'tel':
                case 'url':
                case 'number':
                case 'search':
                    return await this.fillTextInput(element, value);

                case 'textarea':
                    return await this.fillTextarea(element, value);

                case 'select':
                    return await this.fillSelect(element, value);

                case 'combobox':
                case 'button':
                    return await this.fillCombobox(element, value);

                case 'checkbox':
                    return await this.fillCheckbox(element, value);

                case 'radio':
                    return await this.fillRadio(element, value);

                case 'date':
                case 'datetime-local':
                case 'time':
                case 'month':
                case 'week':
                    return await this.fillDateInput(element, value);

                case 'multiselect':
                    return await this.fillMultiselect(element, value);

                default:
                    console.warn(`Unsupported field type: ${type}`);
                    return false;
            }
        } catch (error) {
            console.error(`Error filling field of type ${type}:`, error);
            return false;
        }
    }

    async fillCustomSelect(hiddenSelect, dropdownAnchor, value) {
        try {
            console.log(`Filling custom select: ${hiddenSelect.id} with value: ${value}`);
            
            // Click the dropdown anchor to open options
            dropdownAnchor.focus();
            dropdownAnchor.click();
            await this.sleep(500);

            // Find the dropdown results container
            const dropdownResultsId = `${hiddenSelect.id}_dropdown-results`;
            const resultsContainer = document.querySelector(`#${dropdownResultsId}`);
            
            if (!resultsContainer) {
                console.warn('Dropdown results container not found');
                return false;
            }

            // Find matching option
            const options = resultsContainer.querySelectorAll('li[role="option"]');
            let matchedOption = null;
            
            const normalizedValue = this.normalizeText(value);
            
            for (const option of options) {
                const optionText = this.normalizeText(option.textContent);
                const optionLabel = this.normalizeText(option.getAttribute('aria-label') || '');
                const optionTitle = this.normalizeText(option.getAttribute('title') || '');
                
                // Skip "Make a Selection" options
                if (optionText.includes('make a selection')) continue;
                
                // Try exact match first
                if (optionText === normalizedValue || 
                    optionLabel === normalizedValue || 
                    optionTitle === normalizedValue) {
                    matchedOption = option;
                    break;
                }
                
                // Try contains match
                if (optionText.includes(normalizedValue) || 
                    normalizedValue.includes(optionText) ||
                    optionLabel.includes(normalizedValue) || 
                    normalizedValue.includes(optionLabel)) {
                    matchedOption = option;
                    // Don't break, continue looking for exact match
                }
            }

            if (matchedOption) {
                console.log(`Found matching option: ${matchedOption.textContent.trim()}`);
                matchedOption.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.sleep(200);
                matchedOption.click();
                await this.sleep(300);
                
                // Verify selection
                const selectedText = dropdownAnchor.querySelector('.dropdown-text, .dropdown-placeholder');
                if (selectedText) {
                    const currentValue = selectedText.textContent.trim();
                    console.log(`Selected value: ${currentValue}`);
                }
                
                return true;
            } else {
                console.warn(`No matching option found for: ${value}`);
                // Close dropdown
                dropdownAnchor.click();
                return false;
            }
        } catch (error) {
            console.error('Error filling custom select:', error);
            return false;
        }
    }

    async fillTextInput(element, value) {
        element.focus();
        await this.sleep(100);
        
        element.select();
        element.value = '';
        
        const methods = [
            () => this.setValueByProperty(element, value),
            () => this.setValueByTyping(element, value),
            () => this.setValueByEvents(element, value)
        ];

        for (const method of methods) {
            try {
                await method();
                if (element.value === value) {
                    return true;
                }
            } catch (error) {
                console.debug('Fill method failed:', error);
            }
        }
        
        return element.value === value;
    }

    async fillTextarea(element, value) {
        return await this.fillTextInput(element, value);
    }

    async fillSelect(element, value) {
        const options = Array.from(element.options);
        
        const matchingOption = options.find(option => 
            this.normalizeText(option.textContent) === this.normalizeText(value) ||
            this.normalizeText(option.value) === this.normalizeText(value) ||
            this.normalizeText(option.textContent).includes(this.normalizeText(value)) ||
            this.normalizeText(value).includes(this.normalizeText(option.textContent))
        );

        if (matchingOption) {
            element.value = matchingOption.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        console.warn(`No matching option found for value: ${value}`);
        return false;
    }

    async fillCombobox(element, value) {
        element.focus();
        element.click();
        await this.sleep(500);

        const options = document.querySelectorAll('[role="option"]:not([aria-hidden="true"])');
        
        for (const option of options) {
            const optionText = this.normalizeText(option.textContent);
            const searchValue = this.normalizeText(value);
            
            if (optionText === searchValue || 
                optionText.includes(searchValue) || 
                searchValue.includes(optionText)) {
                
                option.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.sleep(200);
                option.click();
                await this.sleep(300);
                return true;
            }
        }

        return false;
    }

    async fillCheckbox(element, value) {
        const shouldCheck = this.parseBoolean(value);
        const isChecked = element.checked;

        if (isChecked !== shouldCheck) {
            element.focus();
            element.click();
            await this.sleep(200);
        }

        return element.checked === shouldCheck;
    }

    async fillRadio(element, value) {
        const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
        
        for (const radio of radioGroup) {
            const label = this.getElementLabel(radio);
            if (this.normalizeText(label).includes(this.normalizeText(value)) ||
                this.normalizeText(radio.value) === this.normalizeText(value)) {
                
                radio.focus();
                radio.click();
                await this.sleep(200);
                return radio.checked;
            }
        }

        return false;
    }

    async fillDateInput(element, value) {
        element.focus();
        await this.sleep(100);
        
        let dateValue = value;
        
        if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [month, day, year] = value.split('/');
            dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        element.value = dateValue;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        
        return element.value === dateValue;
    }

    async fillMultiselect(element, value) {
        const values = Array.isArray(value) ? value : [value];
        let successCount = 0;

        for (const val of values) {
            const input = element.querySelector('input[type="text"]');
            if (input) {
                input.focus();
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await this.sleep(500);

                const options = document.querySelectorAll('[role="option"]:not([aria-hidden="true"])');
                for (const option of options) {
                    if (this.normalizeText(option.textContent).includes(this.normalizeText(val))) {
                        option.click();
                        successCount++;
                        await this.sleep(300);
                        break;
                    }
                }
            }
        }

        return successCount > 0;
    }

    async setValueByProperty(element, value) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    async setValueByEvents(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        valueSetter.call(element, value);
        
        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });
        const blurEvent = new Event('blur', { bubbles: true });
        element.dispatchEvent(inputEvent);
        element.dispatchEvent(changeEvent);
        element.dispatchEvent(blurEvent);
    }

    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on';
        }
        return Boolean(value);
    }

    normalizeText(text) {
        return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
    }

    getElementLabel(element) {
        return element.getAttribute('aria-label') ||
               element.placeholder ||
               (element.id && document.querySelector(`label[for="${element.id}"]`)?.textContent) ||
               element.closest('label')?.textContent ||
               '';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}