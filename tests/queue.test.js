import { describe, it, expect, vi, afterEach } from 'vitest';
import amqp from 'amqplib';
import { publishEvent } from '../services/queue/publisher.js';
import { handleMessage, PermanentJobError } from '../services/queue/consumer.js';
import { closeQueueConnection } from '../services/queue/connection.js';

const fakeChannel = () => ({
    ack: vi.fn(),
    nack: vi.fn(),
    sendToQueue: vi.fn((queue, content, options, cb) => cb(null)),
});

const message = ({ attempt = 1, content = JSON.stringify({ type: 'user.registered', data: { to: 'a@b.test' } }) } = {}) => ({
    content: Buffer.from(content),
    // after a retry the routing key is the queue name; the type property keeps the event name
    fields: { routingKey: attempt > 1 ? 'email.notifications' : 'user.registered' },
    properties: { messageId: 'm-1', type: 'user.registered', headers: { 'x-attempt': attempt } },
});

describe('queue publisher', () =>
{
    afterEach(async () =>
    {
        delete process.env.RABBITMQ_URL;
        await closeQueueConnection();
    });

    it('is a no-op without RABBITMQ_URL and never connects', async () =>
    {
        const connect = vi.spyOn(amqp, 'connect');
        await expect(publishEvent('user.registered', { to: 'a@b.test' })).resolves.toBe(false);
        expect(connect).not.toHaveBeenCalled();
        connect.mockRestore();
    });

    it('returns false instead of throwing when the broker is unreachable', async () =>
    {
        process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
        await expect(publishEvent('user.registered', { to: 'a@b.test' })).resolves.toBe(false);
    });
});

describe('queue consumer', () =>
{
    it('acks after the handler succeeds', async () =>
    {
        const channel = fakeChannel();
        const handler = vi.fn(async () => { });
        await expect(handleMessage(channel, 'email.notifications', message(), handler)).resolves.toBe('acked');
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'user.registered' }),
            expect.objectContaining({ messageId: 'm-1', attempt: 1 })
        );
        expect(channel.ack).toHaveBeenCalledTimes(1);
        expect(channel.nack).not.toHaveBeenCalled();
    });

    it('parks a failed message in the next retry queue with the attempt counter raised', async () =>
    {
        const channel = fakeChannel();
        const handler = vi.fn(async () => { throw new Error('smtp down'); });
        const result = await handleMessage(channel, 'email.notifications', message({ attempt: 2 }), handler);
        expect(result).toBe('retried');
        expect(handler.mock.calls[0][1].type).toBe('user.registered');
        const [queue, , options] = channel.sendToQueue.mock.calls[0];
        expect(queue).toBe('email.notifications.retry.2');
        expect(options.headers['x-attempt']).toBe(3);
        expect(channel.ack).toHaveBeenCalledTimes(1);
    });

    it('keeps re-parking a message that waits on another worker without using up attempts', async () =>
    {
        const channel = fakeChannel();
        const waiting = Object.assign(new Error('in progress'), { countsAsAttempt: false });
        const result = await handleMessage(channel, 'email.notifications', message({ attempt: 4 }), async () => { throw waiting; });
        expect(result).toBe('retried');
        const [queue, , options] = channel.sendToQueue.mock.calls[0];
        expect(queue).toBe('email.notifications.retry.3');
        expect(options.headers['x-attempt']).toBe(4);
        expect(channel.nack).not.toHaveBeenCalled();
    });

    it('dead-letters once every retry is used up', async () =>
    {
        const channel = fakeChannel();
        const result = await handleMessage(channel, 'email.notifications', message({ attempt: 4 }), async () => { throw new Error('smtp down'); });
        expect(result).toBe('dead-lettered');
        expect(channel.sendToQueue).not.toHaveBeenCalled();
        expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    });

    it('dead-letters permanent errors and unparseable bodies without retrying', async () =>
    {
        const channel = fakeChannel();
        await handleMessage(channel, 'q', message(), async () => { throw new PermanentJobError('no recipient'); });
        await handleMessage(channel, 'q', message({ content: '{not json' }), async () => { });
        expect(channel.sendToQueue).not.toHaveBeenCalled();
        expect(channel.nack).toHaveBeenCalledTimes(2);
    });

    it('requeues instead of losing the message when the retry publish fails', async () =>
    {
        const channel = fakeChannel();
        channel.sendToQueue.mockImplementation((queue, content, options, cb) => cb(new Error('channel closed')));
        const result = await handleMessage(channel, 'q', message(), async () => { throw new Error('boom'); });
        expect(result).toBe('requeued');
        expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
        expect(channel.ack).not.toHaveBeenCalled();
    });
});
