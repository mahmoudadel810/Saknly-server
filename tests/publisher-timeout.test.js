import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPublishChannel } from '../services/queue/connection.js';
import { publishEvent } from '../services/queue/publisher.js';

vi.mock('../services/queue/connection.js', () => ({
    isQueueEnabled: () => true,
    getPublishChannel: vi.fn(),
}));

describe('queue publisher timeout', () =>
{
    afterEach(() => { delete process.env.QUEUE_PUBLISH_TIMEOUT_MS; });

    it('does not publish when the connection arrives after the timeout', async () =>
    {
        process.env.QUEUE_PUBLISH_TIMEOUT_MS = '20';
        const channel = { publish: vi.fn((exchange, key, body, options, cb) => cb(null)) };
        let connect;
        getPublishChannel.mockReturnValue(new Promise((resolve) => { connect = resolve; }));

        await expect(publishEvent('user.registered', { email: 'a@b.test' })).resolves.toBe(false);
        connect(channel);
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(channel.publish).not.toHaveBeenCalled();
    });

    it('publishes and resolves true when the broker confirms in time', async () =>
    {
        const channel = { publish: vi.fn((exchange, key, body, options, cb) => cb(null)) };
        getPublishChannel.mockResolvedValue(channel);

        await expect(publishEvent('user.registered', { email: 'a@b.test' })).resolves.toBe(true);
        expect(channel.publish).toHaveBeenCalledTimes(1);
    });
});
