// llmApi.js - Handles communication with the FastAPI LLM backend
class LLMApi {
    constructor() {
        this.apiUrl = null;
        this.timeout = 30000;
    }

    async init() {
        this.apiUrl = await config.getApiUrl();
        this.timeout = await config.get('requestTimeout');
    }

    async sendFormToLLM(fields, metadata = {}) {
        try {
            if (!this.apiUrl) {
                await this.init();
            }

            console.log('Sending form fields to LLM...');
            console.log('API URL:', this.apiUrl);
            console.log('Detected fields:', fields);

            const payload = {
                fields: fields,
                url: metadata.url || window.location.href,
                title: metadata.title || document.title,
                timestamp: new Date().toISOString()
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();
            console.log('LLM Response:', responseData);

            return {
                success: true,
                data: responseData
            };
        } catch (error) {
            console.error('Error sending to LLM:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateApiUrl(newUrl) {
        await config.setApiUrl(newUrl);
        this.apiUrl = newUrl;
    }

    async getApiUrl() {
        if (!this.apiUrl) {
            await this.init();
        }
        return this.apiUrl;
    }

    async testConnection() {
        try {
            const testPayload = {
                fields: { "test_field": "" },
                url: "test",
                title: "Connection Test"
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testPayload),
                signal: AbortSignal.timeout(5000)
            });

            return {
                success: response.ok,
                status: response.status
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

const llmApi = new LLMApi();