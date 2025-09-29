// popup-controller.js - Controls popup UI and interactions
class PopupController {
    constructor() {
        this.currentTab = null;
        this.detectedFields = {};
        this.isDetecting = false;
        this.autoFillInProgress = false;
    }

    async init() {
        await this.getCurrentTab();
        await this.loadSettings();
        this.setupEventListeners();
        this.initializePopup();
    }

    async getCurrentTab() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tabs[0];
    }

    setupEventListeners() {
        // FIXED: Changed from 'autoFillBtn' to 'sendToLLMBtn'
        document.getElementById('sendToLLMBtn').addEventListener('click', () => this.startAutoFill());
        document.getElementById('detectBtn').addEventListener('click', () => this.detectFields());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadJSON());
        document.getElementById('refreshBtn').addEventListener('click', () => this.detectFields());
        document.getElementById('toggleSettings').addEventListener('click', () => this.toggleSettings());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
    }

    async loadSettings() {
        const settings = await config.load();
        document.getElementById('apiUrl').value = settings.apiUrl;
        document.getElementById('maxIterations').value = settings.maxIterations || 5;
        document.getElementById('iterationDelay').value = settings.iterationDelay || 2000;
    }

    initializePopup() {
        const statusDiv = document.getElementById('status');
        
        if (!this.currentTab) {
            this.showError('No active tab found');
            return;
        }

        statusDiv.innerHTML = `
            <div class="field-count">Ready to detect fields</div>
            <div>Current page: ${new URL(this.currentTab.url).hostname}</div>
        `;
        statusDiv.className = 'status ready';
    }

    async startAutoFill() {
        if (this.autoFillInProgress) {
            this.showError('Auto-fill already in progress');
            return;
        }

        this.autoFillInProgress = true;
        const sendToLLMBtn = document.getElementById('sendToLLMBtn');
        const statusDiv = document.getElementById('status');
        
        sendToLLMBtn.disabled = true;
        sendToLLMBtn.innerHTML = '<div class="loading"></div>Auto-filling...';
        
        statusDiv.className = 'status detecting';
        statusDiv.innerHTML = `
            <div class="field-count">Starting intelligent auto-fill...</div>
            <div>This may take a few moments</div>
        `;

        try {
            const response = await this.sendMessageToTab('startAutoFill', { 
                progressCallback: true 
            });
            
            if (response && response.success) {
                const { totalIterations, totalFieldsFilled, totalErrors } = response;
                
                this.showSuccess(
                    `Auto-fill complete! ${totalFieldsFilled} fields filled across ${totalIterations} iterations. ${totalErrors} errors.`
                );
                
                document.getElementById('downloadBtn').disabled = false;
                
                setTimeout(() => this.detectFields(), 1000);
            } else {
                this.showError(response?.error || 'Auto-fill failed');
            }
        } catch (error) {
            this.showError('Error: ' + error.message);
        } finally {
            this.autoFillInProgress = false;
            sendToLLMBtn.disabled = false;
            sendToLLMBtn.innerHTML = 'Send to LLM & Auto-Fill';
        }
    }

    async detectFields() {
        if (this.isDetecting) return;
        
        this.isDetecting = true;
        const detectBtn = document.getElementById('detectBtn');
        const detectText = document.getElementById('detectText');
        const statusDiv = document.getElementById('status');
        
        detectBtn.disabled = true;
        detectText.innerHTML = '<div class="loading"></div>Detecting...';
        statusDiv.className = 'status detecting';
        statusDiv.innerHTML = `
            <div class="field-count">Scanning page...</div>
            <div>Looking for all form inputs</div>
        `;

        try {
            const response = await this.sendMessageToTab('detectFields');
            
            if (response && response.success) {
                this.detectedFields = response.fields;
                this.updateStatus(response.fieldCount, this.detectedFields);
                this.showFieldPreview(this.detectedFields);
                
                // FIXED: Enable the buttons after successful detection
                document.getElementById('sendToLLMBtn').disabled = false;
                document.getElementById('downloadBtn').disabled = false;
            } else {
                this.showError('Failed to detect fields. Make sure the page is fully loaded.');
            }
        } catch (error) {
            this.showError('Error communicating with page: ' + error.message);
        } finally {
            this.isDetecting = false;
            detectBtn.disabled = false;
            detectText.textContent = 'Detect Form Fields';
        }
    }

    async downloadJSON() {
        try {
            const response = await this.sendMessageToTab('downloadJSON');
            
            if (response && response.success) {
                this.showSuccess('JSON file downloaded successfully!');
            } else {
                this.showError('Failed to download JSON file');
            }
        } catch (error) {
            this.showError('Error downloading file: ' + error.message);
        }
    }

    toggleSettings() {
        const settingsDiv = document.getElementById('settings');
        settingsDiv.classList.toggle('hidden');
    }

    async saveSettings() {
        const apiUrl = document.getElementById('apiUrl').value.trim();
        const maxIterations = parseInt(document.getElementById('maxIterations').value);
        const iterationDelay = parseInt(document.getElementById('iterationDelay').value);
        
        if (!apiUrl) {
            this.showError('API URL cannot be empty');
            return;
        }

        if (maxIterations < 1 || maxIterations > 20) {
            this.showError('Max iterations must be between 1 and 20');
            return;
        }

        if (iterationDelay < 500 || iterationDelay > 10000) {
            this.showError('Iteration delay must be between 500 and 10000ms');
            return;
        }

        try {
            await config.setApiUrl(apiUrl);
            await config.set('maxIterations', maxIterations);
            await config.set('iterationDelay', iterationDelay);
            await this.sendMessageToTab('setApiUrl', { url: apiUrl });
            this.showSuccess('Settings saved successfully!');
        } catch (error) {
            this.showError('Error saving settings: ' + error.message);
        }
    }

    async testConnection() {
        const testBtn = document.getElementById('testConnectionBtn');
        const originalText = testBtn.textContent;
        
        testBtn.disabled = true;
        testBtn.innerHTML = '<div class="loading"></div>Testing...';
        
        try {
            const response = await this.sendMessageToTab('testConnection');
            
            if (response && response.success) {
                this.showSuccess('Connection successful!');
            } else {
                this.showError('Connection failed: ' + (response?.error || 'Unknown error'));
            }
        } catch (error) {
            this.showError('Connection test failed: ' + error.message);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }

    sendMessageToTab(action, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.currentTab) {
                reject(new Error('No active tab'));
                return;
            }

            chrome.tabs.sendMessage(
                this.currentTab.id,
                { action, ...data },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }

    updateStatus(fieldCount, fields) {
        const statusDiv = document.getElementById('status');
        statusDiv.className = 'status ready';
        statusDiv.innerHTML = `
            <div class="field-count">${fieldCount} fields detected</div>
            <div>Ready to auto-fill or download</div>
        `;
    }

    showFieldPreview(fields) {
        const previewDiv = document.getElementById('field-preview');
        const fieldEntries = Object.entries(fields);
        
        if (fieldEntries.length === 0) {
            previewDiv.innerHTML = '<div class="field-item">No fields detected</div>';
        } else {
            const previewHTML = fieldEntries
                .slice(0, 10)
                .map(([key, value]) => `<div class="field-item"><strong>"${key}":</strong> "${value}"</div>`)
                .join('');
            
            previewDiv.innerHTML = previewHTML;
            
            if (fieldEntries.length > 10) {
                previewDiv.innerHTML += `<div class="field-item"><em>... and ${fieldEntries.length - 10} more fields</em></div>`;
            }
        }
        
        previewDiv.classList.remove('hidden');
    }

    showError(message) {
        const statusDiv = document.getElementById('status');
        statusDiv.className = 'status error';
        statusDiv.innerHTML = `
            <div class="field-count">Error</div>
            <div>${message}</div>
        `;
    }

    showSuccess(message) {
        const statusDiv = document.getElementById('status');
        const originalContent = statusDiv.innerHTML;
        const originalClass = statusDiv.className;
        
        statusDiv.className = 'status ready';
        statusDiv.innerHTML = `
            <div class="field-count">Success!</div>
            <div>${message}</div>
        `;
        
        setTimeout(() => {
            statusDiv.className = originalClass;
            statusDiv.innerHTML = originalContent;
        }, 3000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupController();
    popup.init();
});