import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Detect if running on Vercel (serverless)
const isServerless = !!process.env.VERCEL;

// Only create logs directory if not serverless
const logDir = 'logs';
if (!isServerless) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
}

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

// Define transports based on environment
const transports = [
    new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    })
];

if (!isServerless) {
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: fileFormat
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: fileFormat
        })
    );
}

// Exception and rejection handlers
const exceptionHandlers = [
    new winston.transports.Console({
        format: consoleFormat
    })
];
const rejectionHandlers = [
    new winston.transports.Console({
        format: consoleFormat
    })
];

if (!isServerless) {
    exceptionHandlers.push(
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log'),
            format: fileFormat
        })
    );
    rejectionHandlers.push(
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log'),
            format: fileFormat
        })
    );
}

// Create logger with configuration
const logger = winston.createLogger({
    level: 'debug',
    format: fileFormat,
    transports,
    exceptionHandlers,
    rejectionHandlers
});

// Stream for Morgan integration
logger.stream = {
    write: (message) => logger.http(message.trim())
};

export default logger;
