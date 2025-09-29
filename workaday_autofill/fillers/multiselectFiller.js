// fillers/multiselectFiller.js
class MultiselectFiller {
    constructor() {
        this.maxRetries = 5;
    }
    
    async fillMultiselectField(field, retryCount = 0) {
        try {
            const element = field.element;
            const values = dataStorage.getValue('multiselect', field.id, field.label);
            
            if (!values || (Array.isArray(values) && values.length === 0)) {
                logger.warning(`No values found for multiselect field: ${field.label || field.id}`);
                return false;
            }
            
            // Ensure values is an array
            const valueArray = Array.isArray(values) ? values : [values];
            logger.debug(`Filling multiselect field ${field.label || field.id} with: ${valueArray.join(', ')}`);
            
            // Handle skills field specially
            if (field.label && field.label.toLowerCase().includes('skill')) {
                return await this.fillSkillsField(element, valueArray, retryCount);
            }
            
            // Handle regular multiselect
            const success = await this.fillRegularMultiselect(element, valueArray);
            
            if (success) {
                await this.sleep(500);
                const isVerified = await this.verifyMultiselectFill(element, valueArray);
                
                if (isVerified) {
                    logger.info(`Successfully filled multiselect field: ${field.label || field.id}`);
                    return true;
                } else if (retryCount < this.maxRetries) {
                    logger.stuck(`Multiselect field not filled properly, retrying...`, retryCount);
                    await this.sleep(3000);
                    return await this.fillMultiselectField(field, retryCount + 1);
                }
            }
            
            logger.error(`Failed to fill multiselect field after ${retryCount + 1} attempts: ${field.label || field.id}`);
            return false;
            
        } catch (error) {
            logger.error(`Error filling multiselect field: ${field.label || field.id}`, error);
            return false;
        }
    }
    
    async fillSkillsField(element, skills, retryCount) {
        try {
            // Find the input field within the multiselect container
            const input = element.querySelector('input[type="text"], input[placeholder*="search" i]');
            if (!input) {
                logger.error('Could not find input field in skills multiselect');
                return false;
            }
            
            // Add skills one by one
            let addedCount = 0;
            const maxSkillsToAdd = Math.min(skills.length, 10); // Limit to 10 skills to avoid overwhelming
            
            for (let i = 0; i < maxSkillsToAdd; i++) {
                const skill = skills[i];
                const success = await this.addSingleSkill(input, skill);
                
                if (success) {
                    addedCount++;
                    await this.sleep(1000); // Wait between additions
                } else {
                    logger.debug(`Failed to add skill: ${skill}`);
                }
            }
            
            logger.info(`Added ${addedCount} out of ${maxSkillsToAdd} skills`);
            return addedCount > 0;
            
        } catch (error) {
            logger.error('Error filling skills field:', error);
            return false;
        }
    }
    
    async addSingleSkill(input, skill) {
        try {
            // Focus and clear the input
            input.focus();
            input.value = '';
            await this.sleep(200);
            
            // Type the skill name
            await this.typeSkill(input, skill);
            await this.sleep(500);
            
            // Look for dropdown options or suggestions
            const success = await this.selectSkillFromDropdown(skill) || await this.addSkillByEnter(input);
            
            if (success) {
                logger.debug(`Successfully added skill: ${skill}`);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Error adding skill ${skill}:`, error);
            return false;
        }
    }
    
    async typeSkill(input, skill) {
        // Type character by character
        for (let char of skill) {
            const keydownEvent = new KeyboardEvent('keydown', {
                key: char,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(keydownEvent);
            
            input.value += char;
            
            const inputEvent = new Event('input', { bubbles: true });
            input.dispatchEvent(inputEvent);
            
            await this.sleep(50);
        }
    }
    
    async selectSkillFromDropdown(skill) {
        // Wait for dropdown to appear
        await this.sleep(500);
        
        const dropdownOptions = document.querySelectorAll(
            '[role="option"], [data-automation-id*="option"], .multiselect-option'
        );
        
        for (const option of dropdownOptions) {
            const optionText = option.textContent.trim().toLowerCase();
            const skillLower = skill.toLowerCase();
            
            if (optionText === skillLower || optionText.includes(skillLower) || skillLower.includes(optionText)) {
                try {
                    option.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.sleep(200);
                    option.click();
                    await this.sleep(300);
                    logger.debug(`Selected skill from dropdown: ${skill}`);
                    return true;
                } catch (error) {
                    logger.debug('Error clicking dropdown option:', error);
                }
            }
        }
        
        return false;
    }
    
    async addSkillByEnter(input) {
        // Try pressing Enter to add the skill
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true
        });
        
        input.dispatchEvent(enterEvent);
        await this.sleep(300);
        
        // Check if skill was added by looking for pills/tags
        const pills = document.querySelectorAll('[data-automation-id="selectedItem"], .skill-pill, .multiselect-tag');
        return pills.length > 0;
    }
    
    async fillRegularMultiselect(element, values) {
        try {
            // Click to open multiselect
            const input = element.querySelector('input[type="text"]');
            if (input) {
                input.focus();
                input.click();
                await this.sleep(500);
            }
            
            let successCount = 0;
            
            for (const value of values) {
                // Look for options
                const options = document.querySelectorAll('[role="option"]');
                let optionFound = false;
                
                for (const option of options) {
                    const optionText = option.textContent.trim().toLowerCase();
                    const valueLower = value.toLowerCase();
                    
                    if (optionText.includes(valueLower) || valueLower.includes(optionText)) {
                        try {
                            option.click();
                            await this.sleep(300);
                            successCount++;
                            optionFound = true;
                            break;
                        } catch (error) {
                            logger.debug('Error clicking multiselect option:', error);
                        }
                    }
                }
                
                if (!optionFound && input) {
                    // Try typing to search
                    input.value = value;
                    const inputEvent = new Event('input', { bubbles: true });
                    input.dispatchEvent(inputEvent);
                    await this.sleep(500);
                    
                    // Try selecting first option
                    const newOptions = document.querySelectorAll('[role="option"]');
                    if (newOptions.length > 0) {
                        try {
                            newOptions[0].click();
                            await this.sleep(300);
                            successCount++;
                        } catch (error) {
                            logger.debug('Error clicking first search result:', error);
                        }
                    }
                }
            }
            
            logger.debug(`Successfully selected ${successCount} out of ${values.length} multiselect values`);
            return successCount > 0;
            
        } catch (error) {
            logger.error('Error filling regular multiselect:', error);
            return false;
        }
    }
    
    async verifyMultiselectFill(element, expectedValues) {
        try {
            // Look for selected items/pills
            const selectedItems = element.querySelectorAll(
                '[data-automation-id="selectedItem"], .multiselect-tag, .skill-pill'
            );
            
            if (selectedItems.length === 0) {
                return false;
            }
            
            // For skills field, just check that some items were selected
            if (expectedValues.length > 5) { // Assuming skills have many items
                return selectedItems.length > 0;
            }
            
            // For regular multiselect, try to match values
            const selectedTexts = Array.from(selectedItems).map(item => 
                item.textContent.trim().toLowerCase()
            );
            
            const expectedTexts = expectedValues.map(value => value.toLowerCase());
            
            return expectedTexts.some(expected => 
                selectedTexts.some(selected => 
                    selected.includes(expected) || expected.includes(selected)
                )
            );
            
        } catch (error) {
            logger.error('Error verifying multiselect fill:', error);
            return false;
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const multiselectFiller = new MultiselectFiller();