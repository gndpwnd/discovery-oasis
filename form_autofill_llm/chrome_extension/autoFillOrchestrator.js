// autoFillOrchestrator.js - Manages intelligent iterative form filling
class AutoFillOrchestrator {
    constructor(fieldDetector, formFiller, llmApi) {
        this.fieldDetector = fieldDetector;
        this.formFiller = formFiller;
        this.llmApi = llmApi;
        this.isRunning = false;
        this.currentIteration = 0;
        this.maxIterations = 5;
        this.iterationDelay = 2000;
        this.filledFieldsHistory = new Set();
        this.progressCallback = null;
    }

    async initialize() {
        const settings = await config.load();
        this.maxIterations = settings.maxIterations || 5;
        this.iterationDelay = settings.iterationDelay || 2000;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    reportProgress(status, data = {}) {
        if (this.progressCallback) {
            this.progressCallback({
                iteration: this.currentIteration,
                maxIterations: this.maxIterations,
                status: status,
                ...data
            });
        }
        console.log(`[AutoFill] ${status}`, data);
    }

    async startAutoFill() {
        if (this.isRunning) {
            return {
                success: false,
                error: 'Auto-fill already in progress'
            };
        }

        this.isRunning = true;
        this.currentIteration = 0;
        this.filledFieldsHistory.clear();

        await this.initialize();

        this.reportProgress('Starting intelligent auto-fill process');

        try {
            let totalFieldsFilled = 0;
            let totalErrors = 0;
            const iterationResults = [];

            for (this.currentIteration = 1; this.currentIteration <= this.maxIterations; this.currentIteration++) {
                this.reportProgress(`Starting iteration ${this.currentIteration}/${this.maxIterations}`);

                // Detect current visible/enabled fields
                const detectedFields = await this.detectNewFields();
                
                if (Object.keys(detectedFields).length === 0) {
                    this.reportProgress('No new fields detected, stopping', {
                        reason: 'no_new_fields'
                    });
                    break;
                }

                this.reportProgress(`Detected ${Object.keys(detectedFields).length} new fields`);

                // Send to LLM
                const llmResponse = await this.sendFieldsToLLM(detectedFields);
                
                if (!llmResponse.success) {
                    this.reportProgress('LLM request failed', { error: llmResponse.error });
                    totalErrors++;
                    continue;
                }

                // Fill the fields
                const fillResult = await this.fillFields(llmResponse.data);
                
                if (fillResult.success) {
                    totalFieldsFilled += fillResult.filled;
                    totalErrors += fillResult.errors;
                    
                    iterationResults.push({
                        iteration: this.currentIteration,
                        fieldsDetected: Object.keys(detectedFields).length,
                        fieldsFilled: fillResult.filled,
                        errors: fillResult.errors
                    });

                    this.reportProgress(`Iteration ${this.currentIteration} complete`, {
                        filled: fillResult.filled,
                        errors: fillResult.errors
                    });

                    // Mark these fields as processed
                    Object.keys(detectedFields).forEach(key => {
                        this.filledFieldsHistory.add(key);
                    });
                }

                // Wait before next iteration to allow dynamic content to load
                if (this.currentIteration < this.maxIterations) {
                    this.reportProgress(`Waiting ${this.iterationDelay}ms for dynamic content...`);
                    await this.sleep(this.iterationDelay);
                    
                    // Trigger any change events that might unlock new fields
                    await this.triggerPageUpdates();
                }
            }

            this.isRunning = false;

            const summary = {
                success: true,
                totalIterations: iterationResults.length,
                totalFieldsFilled: totalFieldsFilled,
                totalErrors: totalErrors,
                iterationResults: iterationResults
            };

            this.reportProgress('Auto-fill complete', summary);
            
            return summary;

        } catch (error) {
            this.isRunning = false;
            this.reportProgress('Auto-fill failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    async detectNewFields() {
        // Detect all current fields
        const allFields = this.fieldDetector.detectAllInputs();
        
        // Filter out fields we've already processed
        const newFields = {};
        for (const [key, value] of Object.entries(allFields)) {
            if (!this.filledFieldsHistory.has(key)) {
                // Only include empty or unfilled fields
                const fieldData = this.fieldDetector.getFieldElement(key);
                if (fieldData) {
                    // FIXED: Use fieldDetector's getCurrentValue method
                    const currentValue = this.fieldDetector.getCurrentValue(fieldData.element);
                    // Only add if field is empty or if it's a checkbox/radio that's unchecked
                    if (!currentValue || 
                        currentValue === '' || 
                        currentValue === false ||
                        (typeof currentValue === 'string' && currentValue.trim() === '')) {
                        newFields[key] = value;
                    }
                }
            }
        }

        return newFields;
    }

    async sendFieldsToLLM(fields) {
        try {
            const metadata = {
                url: window.location.href,
                title: document.title,
                iteration: this.currentIteration
            };

            return await this.llmApi.sendFormToLLM(fields, metadata);
        } catch (error) {
            console.error('Error sending to LLM:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async fillFields(responseData) {
        try {
            return await this.formFiller.autoFillFields(responseData);
        } catch (error) {
            console.error('Error filling fields:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async triggerPageUpdates() {
        // Trigger events that might cause the page to reveal new fields
        const filledElements = document.querySelectorAll('input:not([value=""]), select:not([value=""]), textarea:not([value=""])');
        
        filledElements.forEach(element => {
            // Dispatch various events that might trigger validation/reveal new fields
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Click any "Next" or "Continue" buttons if configured
        // (This is optional and could be dangerous, so we leave it commented)
        /*
        const continueButtons = document.querySelectorAll('button[type="submit"]:not(:disabled)');
        if (continueButtons.length > 0 && this.autoClickContinue) {
            continueButtons[0].click();
        }
        */
    }

    stop() {
        this.isRunning = false;
        this.reportProgress('Auto-fill stopped by user');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            currentIteration: this.currentIteration,
            maxIterations: this.maxIterations,
            filledFieldsCount: this.filledFieldsHistory.size
        };
    }
}