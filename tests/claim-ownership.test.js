import { describe, it, expect, vi } from 'vitest';
import ProcessedMessage from '../Model/ProcessedMessageModel.js';
import { runOnce } from '../services/queue/idempotency.js';

const QUEUE = 'email.notifications';
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
const gate = () =>
{
    let open;
    const promise = new Promise((resolve) => { open = resolve; });
    return { promise, open };
};

describe('claim ownership', () =>
{
    it('a stale holder that fails does not release the claim its successor took over', async () =>
    {
        await ProcessedMessage.init();
        const first = gate();
        const second = gate();

        // A claims and hangs (a slow send), its claim goes stale, B takes over and is still sending
        const runA = runOnce('m-own', QUEUE, async () => { await first.promise; throw new Error('smtp timeout'); });
        await tick();
        await ProcessedMessage.updateOne({ messageId: 'm-own' }, { $set: { claimedAt: new Date(Date.now() - 10 * 60 * 1000) } });
        const runB = runOnce('m-own', QUEUE, async () => { await second.promise; return 'sent'; });
        await tick();

        first.open();
        await expect(runA).rejects.toThrow('smtp timeout');
        // B's claim must survive A's failure, or a third copy could claim it and send again
        expect(await ProcessedMessage.countDocuments({ messageId: 'm-own', status: 'processing' })).toBe(1);

        second.open();
        await expect(runB).resolves.toEqual({ ran: true, result: 'sent' });
        expect((await ProcessedMessage.findOne({ messageId: 'm-own' })).status).toBe('done');
    });

    it('a failed "done" write does not throw, so the message is not retried and sent again', async () =>
    {
        await ProcessedMessage.init();
        const send = vi.fn(async () => 'sent');
        const spy = vi.spyOn(ProcessedMessage, 'updateOne').mockRejectedValueOnce(new Error('mongo blip'));

        await expect(runOnce('m-done', QUEUE, send)).resolves.toEqual({ ran: true, result: 'sent' });
        expect(send).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});
