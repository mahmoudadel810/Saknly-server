import logger from '../../utils/logger.js';
import { assertTopology, retryDelays, retryQueueName } from './topology.js';

// Throw this from a handler when retrying cannot help (bad payload, missing recipient):
// the message goes straight to the dead-letter queue
export class PermanentJobError extends Error
{
    constructor(message)
    {
        super(message);
        this.name = 'PermanentJobError';
    }
}

const sendToQueueConfirmed = (channel, queue, content, options) =>
    new Promise((resolve, reject) =>
    {
        channel.sendToQueue(queue, content, options, (err) => (err ? reject(err) : resolve()));
    });

// Manual ack: success -> ack. Failure -> republish to the next retry queue (then ack),
// or, when retries are used up or the error is permanent, nack without requeue -> DLQ.
export const handleMessage = async (channel, queue, msg, handler) =>
{
    const attempt = Number(msg.properties.headers?.['x-attempt']) || 1;
    const context = { messageId: msg.properties.messageId, routingKey: msg.fields.routingKey, attempt, queue };

    let payload;
    try
    {
        payload = JSON.parse(msg.content.toString());
    }
    catch
    {
        logger.error(`[${queue}] unparseable message ${context.messageId}, sent to DLQ`);
        channel.nack(msg, false, false);
        return 'dead-lettered';
    }

    try
    {
        await handler(payload, context);
        channel.ack(msg);
        return 'acked';
    }
    catch (error)
    {
        const delays = retryDelays();
        if (!(error instanceof PermanentJobError) && attempt <= delays.length)
        {
            try
            {
                await sendToQueueConfirmed(channel, retryQueueName(queue, attempt), msg.content, {
                    ...msg.properties,
                    headers: {
                        ...msg.properties.headers,
                        'x-attempt': attempt + 1,
                        'x-last-error': String(error.message).slice(0, 200),
                    },
                });
                channel.ack(msg);
                logger.warn(`[${queue}] ${context.routingKey} attempt ${attempt} failed (${error.message}), retry in ${delays[attempt - 1]}ms`);
                return 'retried';
            }
            catch (retryError)
            {
                // Could not park it for a retry: let the broker redeliver it instead of losing it
                channel.nack(msg, false, true);
                logger.error(`[${queue}] retry publish failed (${retryError.message}), requeued`);
                return 'requeued';
            }
        }

        channel.nack(msg, false, false);
        logger.error(`[${queue}] ${context.routingKey} ${context.messageId} failed after ${attempt} attempt(s), sent to DLQ: ${error.message}`);
        return 'dead-lettered';
    }
};

// Starts a consumer on its own confirm channel. prefetch caps unacked messages per consumer,
// so several worker replicas on one queue share the load (competing consumers).
export const consume = async (connection, queue, handler, { prefetch = 10 } = {}) =>
{
    const channel = await connection.createConfirmChannel();
    await assertTopology(channel);
    await channel.prefetch(prefetch);

    const inFlight = new Set();
    const { consumerTag } = await channel.consume(queue, (msg) =>
    {
        if (!msg) return; // cancelled by the broker (queue deleted)
        const job = handleMessage(channel, queue, msg, handler)
            .catch((error) => logger.error(`[${queue}] handler crashed: ${error.message}`))
            .finally(() => inFlight.delete(job));
        inFlight.add(job);
    }, { noAck: false });

    logger.info(`[${queue}] consuming (prefetch ${prefetch})`);

    return {
        queue,
        // Stop taking new messages, let the in-flight ones finish and ack, then close
        stop: async () =>
        {
            await channel.cancel(consumerTag).catch(() => { });
            await Promise.allSettled([...inFlight]);
            await channel.close().catch(() => { });
        },
    };
};
