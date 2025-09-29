// popup-controller.js - Controls popup UI and interactions
class PopupController {
    constructor() {
        this.currentTab = null;
        this.detectedFields = {};
        this.isDetecting = false;
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
        document.getElementById('detectBtn').addEventListener('click', () => this.detectFields());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadJSON());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshDetection());
        document.getElementById('sendToLLMBtn').addEventListener('click', () => this.sendToLLMAndFill());
        document.getElementById('toggleSettings').addEventListener('click', () => this.toggleSettings());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
    }

    async loadSettings() {
        const settings = await config.load();
        document.getElementById('apiUrl').value = settings.apiUrl;
    }

    initializePopup() {
        const statusDiv = document.getElementById('status');
        
        if (!this.currentTab) {
            this.showError('No active tab found');
            return;
        }

        statusDiv.innerHTML = `
            <div class="field-count">Ready to detect</div>
            <div>Current page: ${new URL(this.currentTab.url).hostname}</div>
        `;
        statusDiv.className = 'status ready';
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
                document.getElementById('downloadBtn').disabled = false;
                document.getElementById('sendToLLMBtn').disabled = false;
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

    async sendToLLMAndFill() {
        const sendBtn = document.getElementById('sendToLLMBtn');
        const originalText = sendBtn.textContent;
        
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div class="loading"></div>Sending to LLM...';
        
        try {
            const response = await this.sendMessageToTab('sendToLLMAndFill');
            
            if (response && response.success) {
                const { fillResult } = response;
                this.showSuccess(
                    `Form filled! ${fillResult.filled} fields completed, ${fillResult.errors} errors`
                );
                
                // Refresh field preview to show filled values
                setTimeout(() => this.detectFields(), 2000);
            } else {
                this.showError(response?.error || 'Failed to send to LLM');
            }
        } catch (error) {
            this.showError('Error: ' + error.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
        }
    }

    async refreshDetection() {
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('sendToLLMBtn').disabled = true;
        document.getElementById('field-preview').classList.add('hidden');
        this.detectedFields = {};
        await this.detectFields();
    }

    toggleSettings() {
        const settingsDiv = document.getElementById('settings');
        settingsDiv.classList.toggle('hidden');
    }

    async saveSettings() {
        const apiUrl = document.getElementById('apiUrl').value.trim();
        
        if (!apiUrl) {
            this.showError('API URL cannot be empty');
            return;
        }

        try {
            await config.setApiUrl(apiUrl);
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
            <div>Ready to send to LLM or download</div>
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