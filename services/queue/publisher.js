import { randomUUID } from 'node:crypto';
import logger from '../../utils/logger.js';
import { isQueueEnabled, getPublishChannel } from './connection.js';
import { EXCHANGES } from './topology.js';

const publishTimeoutMs = () => Number(process.env.QUEUE_PUBLISH_TIMEOUT_MS) || 3000;

const withTimeout = (promise, ms) =>
{
    let timer;
    const timeout = new Promise((_, reject) =>
    {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Resolves true once the broker confirmed the message, false when the queue is off or publishing failed.
// Never throws: on false the caller does the work inline.
// Awaiting the confirm matters on Vercel: a frozen function would drop an unconfirmed publish.
export const publish = async (exchange, routingKey, data) =>
{
    if (!isQueueEnabled()) return false;

    try
    {
        const confirmed = (async () =>
        {
            const channel = await getPublishChannel();
            const body = Buffer.from(JSON.stringify({ type: routingKey, data, occurredAt: new Date().toISOString() }));
            await new Promise((resolve, reject) =>
            {
                channel.publish(exchange, routingKey, body, {
                    persistent: true,
                    contentType: 'application/json',
                    messageId: randomUUID(),
                    type: routingKey,
                    timestamp: Math.floor(Date.now() / 1000),
                    headers: { 'x-attempt': 1 },
                }, (err) => (err ? reject(err) : resolve()));
            });
        })();
        await withTimeout(confirmed, publishTimeoutMs());
        return true;
    }
    catch (error)
    {
        logger.warn(`Queue publish of ${routingKey} failed, falling back to inline: ${error.message}`);
        return false;
    }
};

export const publishEvent = (routingKey, data) => publish(EXCHANGES.events, routingKey, data);

export const publishMediaJob = (routingKey, data) => publish(EXCHANGES.media, routingKey, data);
