import winston from 'winston';
import path from 'path';

// Simple console format
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }),
    winston.format.printf(({ level, message, timestamp, stack }) =>
    {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (stack)
        {
            msg += `\n${stack}`;
        }
        return msg;
    })
);

// Simple file format
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }),
    winston.format.json()
);

// Create logger with simple configuration
const logger = winston.createLogger({
    level: 'debug', // Show all logs in development
    format: fileFormat,
    transports: [
        // Console transport - always show logs
        new winston.transports.Console({
            format: consoleFormat,
            level: 'debug'
        }),

        // File transport for errors only
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            format: fileFormat
        }),

        // File transport for all logs
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            format: fileFormat
        })
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        new winston.transports.File({
            filename: path.join('logs', 'exceptions.log'),
            format: fileFormat
        })
    ],

    // Handle unhandled rejections
    rejectionHandlers: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        new winston.transports.File({
            filename: path.join('logs', 'rejections.log'),
            format: fileFormat
        })
    ]
});

// Stream for Morgan integration
logger.stream = {
    write: (message) => logger.http(message.trim())
};

export default logger;
