// popup.js
class PopupController {
    constructor() {
        this.updateInterval = null;
        this.logs = [];
        this.maxLogs = 50;
    }
    
    async init() {
        try {
            // Get elements
            this.elements = {
                loading: document.getElementById('loading'),
                content: document.getElementById('content'),
                status: document.getElementById('status'),
                statusText: document.getElementById('status-text'),
                fieldsCount: document.getElementById('fields-count'),
                attemptsCount: document.getElementById('attempts-count'),
                currentUrl: document.getElementById('current-url'),
                startBtn: document.getElementById('start-btn'),
                stopBtn: document.getElementById('stop-btn'),
                restartBtn: document.getElementById('restart-btn'),
                autoNavigate: document.getElementById('auto-navigate'),
                showLogs: document.getElementById('show-logs'),
                logs: document.getElementById('logs'),
                logsContent: document.getElementById('logs-content')
            };
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load settings
            this.loadSettings();
            
            // Get current tab and update status
            await this.updateStatus();
            
            // Show content
            this.elements.loading.style.display = 'none';
            this.elements.content.style.display = 'block';
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showError('Failed to initialize popup');
        }
    }
    
    setupEventListeners() {
        // Button event listeners
        this.elements.startBtn.addEventListener('click', () => this.sendMessage('start'));
        this.elements.stopBtn.addEventListener('click', () => this.sendMessage('stop'));
        this.elements.restartBtn.addEventListener('click', () => this.sendMessage('restart'));
        
        // Settings event listeners
        this.elements.autoNavigate.addEventListener('change', () => this.saveSettings());
        this.elements.showLogs.addEventListener('change', () => {
            this.saveSettings();
            this.toggleLogs();
        });
    }
    
    async updateStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError('No active tab found');
                return;
            }
            
            // Update URL
            this.elements.currentUrl.textContent = tab.url;
            
            // Check if it's a Workday page
            const isWorkdayPage = tab.url.includes('myworkdayjobs.com') && tab.url.includes('/job/');
            
            if (!isWorkdayPage) {
                this.showInactive('Not a Workday job application page');
                return;
            }
            
            // Get status from content script
            const response = await this.sendMessageToTab(tab.id, { action: 'getStatus' });
            
            if (response) {
                this.updateStatusDisplay(response);
            } else {
                this.showError('Cannot communicate with page. Try refreshing.');
            }
            
        } catch (error) {
            console.error('Error updating status:', error);
            this.showError('Error updating status');
        }
    }
    
    updateStatusDisplay(status) {
        // Update status indicator
        this.elements.status.className = `status ${status.isRunning ? 'active' : 'inactive'}`;
        this.elements.statusText.textContent = status.isRunning ? 'Active' : 'Inactive';
        
        // Update info
        this.elements.fieldsCount.textContent = status.fieldsDetected || 0;
        this.elements.attemptsCount.textContent = `${status.fillAttempts || 0} / ${status.maxAttempts || 3}`;
        
        // Update button states
        this.elements.startBtn.disabled = status.isRunning;
        this.elements.stopBtn.disabled = !status.isRunning;
        this.elements.restartBtn.disabled = false;
    }
    
    showError(message) {
        this.elements.status.className = 'status error';
        this.elements.statusText.textContent = message;
        this.elements.startBtn.disabled = true;
        this.elements.stopBtn.disabled = true;
        this.elements.restartBtn.disabled = false;
    }
    
    showInactive(message) {
        this.elements.status.className = 'status inactive';
        this.elements.statusText.textContent = message;
        this.elements.startBtn.disabled = true;
        this.elements.stopBtn.disabled = true;
        this.elements.restartBtn.disabled = true;
    }
    
    async sendMessage(action) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError('No active tab found');
                return;
            }
            
            const response = await this.sendMessageToTab(tab.id, { action });
            
            if (response && response.success) {
                this.addLog(`Action '${action}' executed successfully`);
                // Update status after a short delay
                setTimeout(() => this.updateStatus(), 500);
            } else {
                this.addLog(`Action '${action}' failed: ${response?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`Error sending ${action} message:`, error);
            this.addLog(`Error sending '${action}' message: ${error.message}`);
        }
    }
    
    sendMessageToTab(tabId, message) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Runtime error:', chrome.runtime.lastError.message);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    startPeriodicUpdates() {
        // Update status every 3 seconds
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 3000);
    }
    
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    loadSettings() {
        // Load settings from Chrome storage
        chrome.storage.sync.get({
            autoNavigate: true,
            showLogs: false
        }, (settings) => {
            this.elements.autoNavigate.checked = settings.autoNavigate;
            this.elements.showLogs.checked = settings.showLogs;
            this.toggleLogs();
        });
    }
    
    saveSettings() {
        const settings = {
            autoNavigate: this.elements.autoNavigate.checked,
            showLogs: this.elements.showLogs.checked
        };
        
        chrome.storage.sync.set(settings);
        this.addLog(`Settings saved: ${JSON.stringify(settings)}`);
    }
    
    toggleLogs() {
        if (this.elements.showLogs.checked) {
            this.elements.logs.style.display = 'block';
        } else {
            this.elements.logs.style.display = 'none';
        }
    }
    
    addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        
        this.logs.push(logEntry);
        
        // Keep only the last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // Update logs display
        if (this.elements.showLogs.checked) {
            this.elements.logsContent.textContent = this.logs.join('\n');
            this.elements.logsContent.scrollTop = this.elements.logsContent.scrollHeight;
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupController();
    popup.init();
    
    // Cleanup when popup closes
    window.addEventListener('beforeunload', () => {
        popup.stopPeriodicUpdates();
    });
});