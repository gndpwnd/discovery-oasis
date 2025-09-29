// content.js - Main content script that ties everything together
class UniversalFormFiller {
    constructor() {
        this.fieldDetector = new FieldDetector();
        this.formFiller = new FormFiller();
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        await config.load();
        await llmApi.init();
        
        this.isInitialized = true;
        console.log('Universal Form Filler initialized');
    }

    async detectFields() {
        const fields = this.fieldDetector.detectAllInputs();
        this.formFiller.fieldDetector = this.fieldDetector;
        return fields;
    }

    async downloadJSON() {
        const fields = this.fieldDetector.getDetectedFields();
        const exportData = jsonUtils.formatForExport(fields);
        return jsonUtils.downloadJSON(exportData);
    }

    async sendToLLM() {
        try {
            const fields = this.fieldDetector.getDetectedFields();
            
            if (Object.keys(fields).length === 0) {
                return {
                    success: false,
                    error: 'No fields detected. Please detect fields first.'
                };
            }

            const response = await llmApi.sendFormToLLM(fields);
            
            if (!response.success) {
                return response;
            }

            const validation = jsonUtils.validateResponseJSON(response.data);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Invalid response: ${validation.error}`
                };
            }

            return {
                success: true,
                data: response.data,
                fieldCount: validation.fieldCount
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async autoFill(responseData) {
        return await this.formFiller.autoFillFields(responseData);
    }

    async sendToLLMAndFill() {
        try {
            const llmResponse = await this.sendToLLM();
            
            if (!llmResponse.success) {
                return llmResponse;
            }

            const fillResult = await this.autoFill(llmResponse.data);
            
            return {
                success: true,
                llmResponse: llmResponse,
                fillResult: fillResult
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async setApiUrl(url) {
        await llmApi.updateApiUrl(url);
    }

    async getApiUrl() {
        return await llmApi.getApiUrl();
    }

    async testConnection() {
        return await llmApi.testConnection();
    }
}

// Create global instance
const universalFormFiller = new UniversalFormFiller();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleAsync = async () => {
        await universalFormFiller.init();

        switch (message.action) {
            case 'detectFields':
                const fields = await universalFormFiller.detectFields();
                return {
                    success: true,
                    fieldCount: Object.keys(fields).length,
                    fields: fields
                };

            case 'downloadJSON':
                const downloadResult = await universalFormFiller.downloadJSON();
                return downloadResult;

            case 'sendToLLM':
                const llmResult = await universalFormFiller.sendToLLM();
                return llmResult;

            case 'autoFillFields':
                const fillResult = await universalFormFiller.autoFill(message.data);
                return fillResult;

            case 'sendToLLMAndFill':
                const combinedResult = await universalFormFiller.sendToLLMAndFill();
                return combinedResult;

            case 'setApiUrl':
                await universalFormFiller.setApiUrl(message.url);
                return { success: true, message: 'API URL updated' };

            case 'getApiUrl':
                const url = await universalFormFiller.getApiUrl();
                return { success: true, url: url };

            case 'testConnection':
                const testResult = await universalFormFiller.testConnection();
                return testResult;

            default:
                return { success: false, error: 'Unknown action' };
        }
    };

    handleAsync()
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
});

// Auto-detect fields on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(async () => {
            await universalFormFiller.init();
            universalFormFiller.detectFields();
        }, 1000);
    });
} else {
    setTimeout(async () => {
        await universalFormFiller.init();
        universalFormFiller.detectFields();
    }, 1000);
}

console.log('Universal Form Filler content script loaded');