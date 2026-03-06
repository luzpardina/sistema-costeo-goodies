const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
try { if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true }); } catch(e) { /* Railway may not allow */ }

const transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                return `${timestamp} [${level}] ${message}${metaStr}`;
            })
        )
    })
];

// Only add file transports if logs dir is writable
try {
    fs.accessSync(logsDir, fs.constants.W_OK);
    transports.push(
        new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 3 }),
        new winston.transports.File({ filename: path.join(logsDir, 'combined.log'), maxsize: 10485760, maxFiles: 5 })
    );
} catch(e) { /* No file logging on this environment */ }

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'sistema-costeo' },
    transports
});

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        if (!req.path.includes('/health') && !req.path.includes('.js') && !req.path.includes('.css')) {
            logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
                user: req.usuario ? req.usuario.email : 'anon',
                ip: req.ip
            });
        }
    });
    next();
};

module.exports = { logger, requestLogger };
