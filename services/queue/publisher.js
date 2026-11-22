import { randomUUID } from 'node:crypto';
import logger from '../../utils/logger.js';
import { recordAuditEvent } from '../audit.js';
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
// A caller that needs the id (to dedupe its own fallback against the worker) passes messageId.
export const publish = async (exchange, routingKey, data, { messageId = randomUUID(), occurredAt = new Date().toISOString() } = {}) =>
{
    if (!isQueueEnabled()) return false;

    // Set on timeout. A slow connect (cold start, remote broker) must not publish late,
    // since the caller has already done the work inline by then.
    let abandoned = false;
    try
    {
        const confirmed = (async () =>
        {
            const channel = await getPublishChannel();
            if (abandoned) throw new Error('connected after the publish timeout, not sent');
            const body = Buffer.from(JSON.stringify({ type: routingKey, data, occurredAt }));
            await new Promise((resolve, reject) =>
            {
                channel.publish(exchange, routingKey, body, {
                    persistent: true,
                    contentType: 'application/json',
                    messageId,
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
        abandoned = true;
        logger.warn(`Queue publish of ${routingKey} failed, falling back to inline: ${error.message}`);
        // The audit consumer will not see this event, so record it here. Same messageId: if the broker
        // did store the message (late confirm), the consumer's upsert finds this row and adds nothing.
        if (exchange === EXCHANGES.events)
        {
            await recordAuditEvent({ messageId, type: routingKey, occurredAt, data })
                .catch((auditError) => logger.error(`Audit fallback for ${routingKey} failed: ${auditError.message}`));
        }
        return false;
    }
};

export const publishEvent = (routingKey, data, options) => publish(EXCHANGES.events, routingKey, data, options);

export const publishMediaJob = (routingKey, data, options) => publish(EXCHANGES.media, routingKey, data, options);
