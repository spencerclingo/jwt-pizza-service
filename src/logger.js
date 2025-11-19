const fetch = require('node-fetch'); // Assuming a Node.js environment

class Logger {
    constructor(config) {
        this.config = config;
    }

    // --- Core Logging Method (Decoupled from Transport) ---
    /**
     * Formats and sends the log data to the transport layer.
     * @param {string} level - Log level (e.g., 'info', 'error')
     * @param {string} type - Log category (e.g., 'http', 'db')
     * @param {object} logData - The data to log
     */
    log(level, type, logData) {
        const labels = { component: this.config.logging.source, level: level, type: type };

        // Sanitize the object before serialization
        const safeLogData = this.sanitize(logData);

        // Prepare the log event in the Grafana/Loki format
        // Use a standard timestamp format (milliseconds * 1,000,000)
        const timestampNano = (Date.now() * 1000000).toString();

        const logEvent = {
            streams: [{
                stream: labels,
                values: [[timestampNano, JSON.stringify(safeLogData)]]
            }]
        };

        // Asynchronously call the transport layer
        this.sendLogToGrafana(logEvent);
    }

    // httpLogger = (req, res, next) => {
    //     let send = res.send;
    //     res.send = (resBody) => {
    //         const logData = {
    //             authorized: !!req.headers.authorization,
    //             path: req.path,
    //             method: req.method,
    //             statusCode: res.statusCode,
    //             reqBody: JSON.stringify(req.body),
    //             resBody: JSON.stringify(resBody),
    //         };
    //         const level = this.statusToLogLevel(res.statusCode);
    //         this.log(level, 'http', logData);
    //         res.send = send;
    //         return res.send(resBody);
    //     };
    //     next();
    // };

    httpLogger = (req, res, next) => {
        const originalSend = res.send;
        const originalJson = res.json;
        let capturedBody = null;

        res.send = function (body) {
            if (body !== undefined) {
                capturedBody = body;
            }

            res.send = originalSend;
            return originalSend.apply(res, arguments);
        };

        res.json = function (body) {
            capturedBody = body;

            res.json = originalJson;
            return originalJson.apply(res, arguments);
        };

        res.on('finish', () => {
            const level = this.statusToLogLevel(res.statusCode);

            const safeReqBody = this.sanitize(req.body);

            const logData = {
                log: "http",
                authorized: !!req.headers.authorization,
                path: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                reqBody: JSON.stringify(safeReqBody),
                resBody: JSON.stringify(capturedBody),
            };
            this.log(level, 'http', logData);
        });

        next();
    };

    dbLogger(query, params, password_index) {
        if (password_index !== -1) {
            params[password_index] = "******* REDACTED";
        }
        const log = {
            log: "db",
            query: query,
            params: params
        }
        this.log('info', 'db', log);
    }

    factoryLogger(orderInfo) {
        orderInfo.log = "factory";
        this.log('info', 'factory', orderInfo);
    }

    unhandledErrorLogger(err) {
        this.log('error', 'unhandledError', { message: err.message, statusCode: err.statusCode });
    }

    // --- Utility Methods ---

    statusToLogLevel(statusCode) {
        if (statusCode >= 500) return 'error';
        if (statusCode >= 400) return 'warn';
        return 'info';
    }

    /**
     * SAFELY removes sensitive fields from the log object BEFORE stringification.
     * Operates on the object, not the string.
     */
    sanitize(logData) {
        // Create a deep copy to avoid modifying the original request/response objects
        const safeData = JSON.parse(JSON.stringify(logData));

        // List common sensitive keys to remove
        const sensitiveKeys = ['password', 'apiKey', 'secret', 'token', 'auth', 'authorization'];

        // Recursive function to strip sensitive data
        const stripSensitiveData = (obj) => {
            if (typeof obj !== 'object' || obj === null) {
                return;
            }

            for (const key in obj) {
                if (Object.hasOwn(obj, key)) {
                    if (sensitiveKeys.includes(key.toLowerCase())) {
                        obj[key] = '***** (REDACTED)';
                    } else if (typeof obj[key] === 'object') {
                        stripSensitiveData(obj[key]);
                    }
                }
            }
        };

        stripSensitiveData(safeData);
        return safeData;
    }

    // --- Transport Layer ---

    async sendLogToGrafana(event) {
        const body = JSON.stringify(event);
        try {
            const res = await fetch(`https://logs-prod-036.grafana.net/loki/api/v1/push`, {
                method: 'post',
                body: body,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.logging.apiKey}`,
                },
                timeout: 5000 // Added a timeout to prevent network hang from blocking resources
            });

            if (!res.ok) {
                // Log failure without affecting the main application logic
                console.error(`Failed to send log (HTTP ${res.status}): ${await res.text()}`);
            }
        } catch (error) {
            // Log networking errors without affecting the main application logic
            console.error('Error sending log to Grafana:', error.message);
        }
    }
}

module.exports = Logger;