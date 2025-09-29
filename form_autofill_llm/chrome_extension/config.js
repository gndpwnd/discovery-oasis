// config.js - Configuration and settings management
class Config {
    constructor() {
        this.defaults = {
            apiUrl: 'http://localhost:8000/fill-form',
            autoFillEnabled: true,
            debugMode: false,
            requestTimeout: 30000
        };
    }

    async load() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(this.defaults, (settings) => {
                resolve(settings);
            });
        });
    }

    async save(settings) {
        return new Promise((resolve) => {
            chrome.storage.sync.set(settings, () => {
                resolve();
            });
        });
    }

    async getApiUrl() {
        const settings = await this.load();
        return settings.apiUrl;
    }

    async setApiUrl(url) {
        const settings = await this.load();
        settings.apiUrl = url;
        await this.save(settings);
    }

    async get(key) {
        const settings = await this.load();
        return settings[key];
    }

    async set(key, value) {
        const settings = await this.load();
        settings[key] = value;
        await this.save(settings);
    }
}

const config = new Config();