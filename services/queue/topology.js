// RabbitMQ topology shared by the API (publisher) and the worker (consumers).
// Every assert is idempotent, so both sides declare it on connect.

export const EXCHANGES = Object.freeze({
    events: 'saknly.events', // topic: domain events (user.*, property.*, inquiry.*)
    media: 'saknly.media',   // direct: Cloudinary jobs
    dlx: 'saknly.dlx',       // direct: dead letters, routed by queue name
});

export const QUEUES = Object.freeze({
    email: {
        name: 'email.notifications',
        exchange: EXCHANGES.events,
        bindings: ['user.*', 'property.approved', 'property.denied', 'inquiry.created'],
    },
    audit: {
        name: 'audit.log',
        exchange: EXCHANGES.events,
        bindings: ['#'],
    },
    media: {
        name: 'media.cleanup',
        exchange: EXCHANGES.media,
        bindings: ['media.delete'],
    },
});

// One retry queue per delay: a single queue with per-message TTLs would let a long delay block shorter ones.
// Changing these values on a running broker requires deleting the existing *.retry.N queues first.
export const retryDelays = () =>
{
    const fromEnv = String(process.env.QUEUE_RETRY_DELAYS_MS || '')
        .split(',')
        .map(Number)
        .filter(ms => Number.isInteger(ms) && ms > 0);
    return fromEnv.length > 0 ? fromEnv : [10_000, 30_000, 60_000];
};

export const retryQueueName = (queue, attempt) => `${queue}.retry.${attempt}`;
export const deadLetterQueueName = (queue) => `${queue}.dlq`;

const assertWorkQueue = async (channel, { name, exchange, bindings }) =>
{
    await channel.assertQueue(name, {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': EXCHANGES.dlx,
            'x-dead-letter-routing-key': name,
        },
    });
    for (const pattern of bindings) await channel.bindQueue(name, exchange, pattern);

    // Expired retry messages go back to the work queue through the default exchange
    const delays = retryDelays();
    for (let i = 0; i < delays.length; i++)
    {
        await channel.assertQueue(retryQueueName(name, i + 1), {
            durable: true,
            arguments: {
                'x-message-ttl': delays[i],
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': name,
            },
        });
    }

    const dlq = deadLetterQueueName(name);
    await channel.assertQueue(dlq, { durable: true });
    await channel.bindQueue(dlq, EXCHANGES.dlx, name);
};

export const assertTopology = async (channel) =>
{
    await channel.assertExchange(EXCHANGES.events, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.media, 'direct', { durable: true });
    await channel.assertExchange(EXCHANGES.dlx, 'direct', { durable: true });
    for (const queue of Object.values(QUEUES)) await assertWorkQueue(channel, queue);
};
