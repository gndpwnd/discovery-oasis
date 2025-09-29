// content.js - Main content script that ties everything together
class UniversalFormFiller {
    constructor() {
        this.fieldDetector = new FieldDetector();
        this.formFiller = new FormFiller();
        this.autoFillOrchestrator = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        await config.load();
        await llmApi.init();
        
        this.formFiller.fieldDetector = this.fieldDetector;
        this.autoFillOrchestrator = new AutoFillOrchestrator(
            this.fieldDetector,
            this.formFiller,
            llmApi
        );
        
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

    async startAutoFill(progressCallback) {
        if (this.autoFillOrchestrator) {
            this.autoFillOrchestrator.setProgressCallback(progressCallback);
            return await this.autoFillOrchestrator.startAutoFill();
        }
        return {
            success: false,
            error: 'Auto-fill orchestrator not initialized'
        };
    }

    async stopAutoFill() {
        if (this.autoFillOrchestrator) {
            this.autoFillOrchestrator.stop();
        }
    }

    getAutoFillStatus() {
        if (this.autoFillOrchestrator) {
            return this.autoFillOrchestrator.getStatus();
        }
        return { isRunning: false };
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

            case 'startAutoFill':
                const autoFillResult = await universalFormFiller.startAutoFill(
                    message.progressCallback ? (progress) => {
                        chrome.runtime.sendMessage({
                            action: 'autoFillProgress',
                            progress: progress
                        });
                    } : null
                );
                return autoFillResult;

            case 'stopAutoFill':
                await universalFormFiller.stopAutoFill();
                return { success: true, message: 'Auto-fill stopped' };

            case 'getAutoFillStatus':
                const status = universalFormFiller.getAutoFillStatus();
                return { success: true, status: status };

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
            console.log('Page loaded, detecting fields...');
            const fields = universalFormFiller.detectFields();
            console.log('Initial detection complete:', fields);
        }, 2000);
    });
} else {
    setTimeout(async () => {
        await universalFormFiller.init();
        console.log('Page already loaded, detecting fields...');
        const fields = universalFormFiller.detectFields();
        console.log('Initial detection complete:', fields);
    }, 2000);
}

// Add mutation observer to detect dynamic forms
const observePageChanges = () => {
    const observer = new MutationObserver((mutations) => {
        const hasFormChanges = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeType === 1) {
                    return node.matches('form, input, select, textarea, [role="combobox"]') ||
                           node.querySelector('form, input, select, textarea, [role="combobox"]');
                }
                return false;
            });
        });
        
        if (hasFormChanges) {
            console.log('Form changes detected, re-running detection...');
            setTimeout(() => {
                universalFormFiller.detectFields();
            }, 1000);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('Mutation observer started for dynamic form detection');
};

// Start observing after initialization
setTimeout(() => {
    observePageChanges();
}, 3000);

console.log('Universal Form Filler content script loaded');