import ProcessedMessage from '../../Model/ProcessedMessageModel.js';
import logger from '../../utils/logger.js';

// A claim older than this belongs to a worker that died mid-message and may be taken over
const STALE_CLAIM_MS = 2 * 60 * 1000;

// Thrown while another consumer holds a fresh claim: the message goes to a retry queue,
// and by the next attempt the claim is either done (skipped) or stale (taken over)
export class MessageInProgressError extends Error
{
    constructor(messageId)
    {
        super(`message ${messageId} is being handled by another consumer`);
        this.name = 'MessageInProgressError';
    }
}

// Claims the message id with a unique insert before running the handler, so two copies
// delivered at the same time cannot both run. Returns false when the message was already handled.
const claim = async (messageId, queue) =>
{
    try
    {
        await ProcessedMessage.create({ messageId, queue });
        return true;
    }
    catch (error)
    {
        if (error.code !== 11000) throw error;
    }

    const takenOver = await ProcessedMessage.findOneAndUpdate(
        { messageId, queue, status: 'processing', claimedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        { $set: { claimedAt: new Date() } }
    );
    if (takenOver) return true;

    const existing = await ProcessedMessage.findOne({ messageId, queue }).lean();
    if (existing?.status === 'done') return false;
    throw new MessageInProgressError(messageId);
};

// Wraps a consumer handler so each messageId is handled once per queue.
// A failed attempt releases its claim, so the retry can run.
export const once = (handler) => async (payload, context) =>
{
    const { messageId, queue } = context;
    if (!messageId) return handler(payload, context);

    if (!(await claim(messageId, queue)))
    {
        logger.info(`[${queue}] ${messageId} already processed, skipping duplicate`);
        return;
    }

    try
    {
        await handler(payload, context);
    }
    catch (error)
    {
        await ProcessedMessage.deleteOne({ messageId, queue, status: 'processing' }).catch(() => { });
        throw error;
    }

    await ProcessedMessage.updateOne({ messageId, queue }, { $set: { status: 'done', processedAt: new Date() } });
};
