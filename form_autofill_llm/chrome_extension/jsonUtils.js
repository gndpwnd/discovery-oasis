// jsonUtils.js - Utilities for JSON export and import
class JsonUtils {
    constructor() {
        this.dateFormat = 'YYYY-MM-DD';
    }

    downloadJSON(data, filename = null) {
        try {
            if (!filename) {
                const hostname = window.location.hostname.replace(/\./g, '-');
                const date = new Date().toISOString().slice(0, 10);
                filename = `form-fields-${hostname}-${date}.json`;
            }

            const jsonData = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log('JSON downloaded:', filename);
            return { success: true, filename: filename };
        } catch (error) {
            console.error('Error downloading JSON:', error);
            return { success: false, error: error.message };
        }
    }

    async loadJSONFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    resolve({ success: true, data: data });
                } catch (error) {
                    reject({ success: false, error: 'Invalid JSON file' });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Error reading file' });
            };
            
            reader.readAsText(file);
        });
    }

    validateResponseJSON(responseData) {
        if (!responseData || typeof responseData !== 'object') {
            return { valid: false, error: 'Response must be an object' };
        }

        const fields = responseData.fields || responseData;
        
        if (typeof fields !== 'object') {
            return { valid: false, error: 'Fields must be an object' };
        }

        const fieldCount = Object.keys(fields).length;
        if (fieldCount === 0) {
            return { valid: false, error: 'No fields in response' };
        }

        return { valid: true, fieldCount: fieldCount };
    }

    formatForExport(detectedFields, metadata = {}) {
        return {
            timestamp: new Date().toISOString(),
            url: metadata.url || window.location.href,
            title: metadata.title || document.title,
            fieldCount: Object.keys(detectedFields).length,
            fields: detectedFields,
            metadata: {
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            }
        };
    }

    compareFieldSets(detectedFields, responseFields) {
        const detected = Object.keys(detectedFields);
        const response = Object.keys(responseFields);
        
        const matched = detected.filter(key => response.includes(key));
        const missing = detected.filter(key => !response.includes(key));
        const extra = response.filter(key => !detected.includes(key));
        
        return {
            matched: matched.length,
            missing: missing.length,
            extra: extra.length,
            matchedKeys: matched,
            missingKeys: missing,
            extraKeys: extra,
            matchPercentage: detected.length > 0 ? (matched.length / detected.length * 100).toFixed(2) : 0
        };
    }

    sanitizeFieldKey(key) {
        return key
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 255);
    }

    parseFieldValue(value, type) {
        if (value === null || value === undefined) {
            return '';
        }

        switch (type) {
            case 'checkbox':
                return this.parseBoolean(value);
            case 'number':
                return this.parseNumber(value);
            case 'date':
                return this.parseDate(value);
            case 'multiselect':
                return Array.isArray(value) ? value : [value];
            default:
                return String(value);
        }
    }

    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            return lower === 'true' || lower === 'yes' || lower === '1';
        }
        return Boolean(value);
    }

    parseNumber(value) {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    parseDate(value) {
        if (!value) return null;
        
        if (value.toLowerCase() === 'today') {
            return new Date().toISOString().split('T')[0];
        }
        
        // Try to parse various date formats
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        return value;
    }
}

const jsonUtils = new JsonUtils();