import amqp from 'amqplib';
import logger from '../../utils/logger.js';
import { assertTopology } from './topology.js';

// Without RABBITMQ_URL the queue is off and callers do the work inline
export const isQueueEnabled = () => Boolean(process.env.RABBITMQ_URL);

// Cached like DB/connection.js so warm serverless invocations reuse one connection.
// Reset on failure or close so the next call reconnects.
let connectionPromise = null;

const reset = () => { connectionPromise = null; };

const connect = async () =>
{
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    connection.on('error', (err) => logger.warn(`RabbitMQ connection error: ${err.message}`));
    connection.on('close', reset);

    // Confirm channel: publish callbacks fire only once the broker has stored the message
    const channel = await connection.createConfirmChannel();
    channel.on('error', (err) => logger.warn(`RabbitMQ channel error: ${err.message}`));
    channel.on('close', () =>
    {
        reset();
        connection.close().catch(() => { });
    });

    await assertTopology(channel);
    return { connection, channel };
};

const getConnected = () =>
{
    if (!isQueueEnabled()) return Promise.reject(new Error('RABBITMQ_URL is not set'));
    if (!connectionPromise)
    {
        connectionPromise = connect().catch((error) =>
        {
            reset();
            throw error;
        });
    }
    return connectionPromise;
};

export const getConnection = async () => (await getConnected()).connection;

export const getPublishChannel = async () => (await getConnected()).channel;

export const closeQueueConnection = async () =>
{
    const pending = connectionPromise;
    reset();
    const connected = await pending?.catch(() => null);
    await connected?.connection.close().catch(() => { });
};
