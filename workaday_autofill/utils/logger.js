// utils/logger.js
class Logger {
    constructor() {
        this.prefix = '[Workday AutoFill]';
        this.colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336',
            debug: '#9E9E9E',
            stuck: '#FF5722'
        };
    }

    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const style = `color: ${this.colors[level]}; font-weight: bold;`;
        
        console.log(
            `%c${this.prefix} [${level.toUpperCase()}] ${timestamp}: ${message}`,
            style
        );
        
        if (data) {
            console.log(data);
        }
    }

    info(message, data) {
        this.log('info', message, data);
    }

    success(message, data) {
        this.log('success', message, data);
    }

    warning(message, data) {
        this.log('warning', message, data);
    }

    error(message, data) {
        this.log('error', message, data);
    }

    debug(message, data) {
        this.log('debug', message, data);
    }

    stuck(message, retryCount = 0) {
        this.log('stuck', `${message} (Attempt ${retryCount + 1})`, null);
    }
}

const logger = new Logger();