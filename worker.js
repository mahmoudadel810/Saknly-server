import './utils/loadEnv.js'; // must stay the first import: loads env before other modules read it
import os from 'node:os';
import mongoose from 'mongoose';
import connectDB from './DB/connection.js';
import ProcessedMessage from './Model/ProcessedMessageModel.js';
import logger from './utils/logger.js';
import { isQueueEnabled, getConnection, closeQueueConnection } from './services/queue/connection.js';
import { consume } from './services/queue/consumer.js';
import { consumers } from './workers/index.js';

// Long-running queue consumer. Runs next to the API (Docker, Render, Railway, Fly), never on Vercel.
const running = [];
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) =>
{
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Worker ${os.hostname()} stopping (${signal}): finishing in-flight messages`);

    // Unacked messages that never finish are redelivered by the broker to another worker
    await Promise.allSettled(running.map(c => c.stop()));
    await closeQueueConnection();
    await mongoose.disconnect().catch(() => { });
    process.exit(exitCode);
};

const start = async () =>
{
    if (!isQueueEnabled())
    {
        logger.error('RABBITMQ_URL is not set; the worker has nothing to consume');
        process.exit(1);
    }

    await connectDB();
    // The duplicate guard relies on the unique index: build it before the first message
    await ProcessedMessage.init();
    const connection = await getConnection();

    // A dropped broker connection kills the consumers; exit and let the process manager restart us
    connection.on('close', () =>
    {
        if (!shuttingDown)
        {
            logger.error('RabbitMQ connection closed, exiting so the worker restarts');
            process.exit(1);
        }
    });

    for (const { queue, handler, prefetch } of consumers)
    {
        running.push(await consume(connection, queue, handler, { prefetch }));
    }
    logger.info(`Worker ${os.hostname()} started with ${running.length} consumer(s)`);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) =>
{
    logger.error(`Worker failed to start: ${error.message}`);
    shutdown('startup failure', 1);
});
