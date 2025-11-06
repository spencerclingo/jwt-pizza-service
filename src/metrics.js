const config = require('./config');
const os = require('os');
const url = require("node:url");

// Metrics stored in memory
let requestMethods = {
    all: 0
};
let authenticationAttempts = {};
let activeUsers = new Map();
let pizzasSold = {
    all: 0
};
let revenue = 0;
let pizzasFailed = 0;
let totalRequestLatency = 0;
let requestCount = 0;
let pizzaRequestLatency = 0;
let pizzaRequestCount = 0;
let chaosUrls = {};

// Middleware to track requests
function requestTracker(req, res, next) {
    const start = process.hrtime.bigint();

    const method = req.method;
    requestMethods[method] = (requestMethods[method] || 0) + 1;
    requestMethods.all += 1;

    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationInMs = Number(end - start) / 1_000_000;

        totalRequestLatency += durationInMs;
        requestCount += 1;
    });
    next();
}

function pizzaCreationTimer(req, res, next) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationInMs = Number(end - start) / 1_000_000;

        pizzaRequestLatency += durationInMs;
        pizzaRequestCount += 1;
    });
    next();
}

function addActiveUser(req, res, next) {
    activeUsers.set(req.user.name, Date.now());
    next();
}

function authenticationAttempt(outcome) {
    authenticationAttempts[outcome] = (authenticationAttempts[outcome] || 0) + 1;
}

function getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return Number(cpuUsage.toFixed(2) * 100);
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return Number(memoryUsage.toFixed(2));
}

function incrementPizzasSold(pizza) {
    pizzasSold[pizza] = (pizzasSold[pizza] || 0) + 1;
    pizzasSold.all += 1
}

function increaseRevenue(newMoney) {
    revenue += newMoney;
}

function incrementFailedPizzas(failures) {
    pizzasFailed += failures;
}

function urlToEndChaos(url) {
    chaosUrls[url] = (chaosUrls[url] || 0) + 1;
}


// This will periodically send metrics to Grafana
setInterval(() => {
    const metrics = [];
    Object.keys(requestMethods).forEach((method) => {
        metrics.push(createMetric('requestMethods per Minute', requestMethods[method], '1', 'sum', 'asInt', { method }));
    });
    Object.keys(authenticationAttempts).forEach((outcome) => {
        metrics.push(createMetric('authentications', authenticationAttempts[outcome], '1', 'sum', 'asInt', { outcome }));
    })
    Object.keys(pizzasSold).forEach((pizzaType) => {
        metrics.push(createMetric('pizzasSold', pizzasSold[pizzaType], '1', 'sum', 'asInt', { pizzaType }));
    });
    Object.keys(chaosUrls).forEach((url) => {
        metrics.push(createMetric('chaosUrl', chaosUrls[url], '1', 'sum', 'asInt', { url }));
    })
    metrics.push(createMetric('activeUsers', activeUsers.size, '1', 'gauge', 'asInt'));
    metrics.push(createMetric('cpuUsage', getCpuUsagePercentage(), '%', 'gauge', 'asDouble'));
    metrics.push(createMetric('memoryUsage', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble'));
    metrics.push(createMetric('revenue', revenue, '1', 'sum', 'asDouble'));
    metrics.push(createMetric('failedPizzas', pizzasFailed, '1', 'sum', 'asInt'));
    if (requestCount > 0) {
        const avgLatency = totalRequestLatency / requestCount;
        metrics.push(createMetric('request_latency_avg_ms', avgLatency, 'ms', 'gauge', 'asDouble'));
    }
    if (pizzaRequestCount > 0) {
        const avgLatency = pizzaRequestLatency / pizzaRequestCount;
        metrics.push(createMetric('request_latency_avg_ms', avgLatency, 'ms', 'gauge', 'asDouble'));
    }

    sendMetricToGrafana(metrics);
}, 1000 * 10); // Update grafana every 10 seconds

const USER_TIMEOUT_MS = 1000 * 60 * 15; // 15 minutes
setInterval(() => {
    const now = Date.now();

    for (const [username, lastSeen] of activeUsers.entries()) {
        if (now - lastSeen > USER_TIMEOUT_MS) {
            activeUsers.delete(username);
        }
    }
}, 1000 * 60); // Every minute, active users who haven't hit an endpoint in 15 minutes are removed from active list

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
    attributes = { ...attributes, source: config.metrics.source };

    const metric = {
        name: metricName,
        unit: metricUnit,
        [metricType]: {
            dataPoints: [
                {
                    [valueType]: metricValue,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [],
                },
            ],
        },
    };

    Object.keys(attributes).forEach((key) => {
        metric[metricType].dataPoints[0].attributes.push({
            key: key,
            value: { stringValue: attributes[key] },
        });
    });

    if (metricType === 'sum') {
        metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[metricType].isMonotonic = true;
    }

    return metric;
}

async function sendMetricToGrafana(metrics) {
    const body = {
        resourceMetrics: [
            {
                scopeMetrics: [
                    {
                        metrics,
                    },
                ],
            },
        ],
    };

    await fetch(`${config.metrics.url}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP status: ${response.status}`);
            }
        })
        .catch((error) => {
            console.error('Error pushing metrics:', error);
        });
}

module.exports = { requestTracker, addActiveUser, authenticationAttempt, increaseRevenue, incrementPizzasSold, incrementFailedPizzas, pizzaCreationTimer };