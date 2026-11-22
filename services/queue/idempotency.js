import { randomUUID } from 'node:crypto';
import ProcessedMessage from '../../Model/ProcessedMessageModel.js';
import logger from '../../utils/logger.js';

// A claim older than this belongs to a worker that died mid-message and may be taken over
const STALE_CLAIM_MS = 2 * 60 * 1000;

// Thrown while another consumer holds a fresh claim: the message waits in a retry queue without
// using up an attempt, until the claim is done (skipped) or stale (taken over after a worker crash)
export class MessageInProgressError extends Error
{
    constructor(messageId)
    {
        super(`message ${messageId} is being handled by another consumer`);
        this.name = 'MessageInProgressError';
        this.countsAsAttempt = false;
    }
}

// Claims the message id with a unique insert before running the handler, so two copies
// delivered at the same time cannot both run. Resolves this holder's token, or null when the
// message was already handled.
const claim = async (messageId, queue) =>
{
    const token = randomUUID();
    try
    {
        await ProcessedMessage.create({ messageId, queue, claimToken: token });
        return token;
    }
    catch (error)
    {
        if (error.code !== 11000) throw error;
    }

    const takenOver = await ProcessedMessage.findOneAndUpdate(
        { messageId, queue, status: 'processing', claimedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        { $set: { claimedAt: new Date(), claimToken: token } }
    );
    if (takenOver) return token;

    const existing = await ProcessedMessage.findOne({ messageId, queue }).lean();
    if (existing?.status === 'done') return null;
    throw new MessageInProgressError(messageId);
};

// Runs fn at most once per (messageId, queue): resolves { ran: true, result }, or { ran: false } when the
// message was already handled. Throws MessageInProgressError while another holder's claim is fresh.
// A failed run releases its claim, so a retry can run.
export const runOnce = async (messageId, queue, fn) =>
{
    const token = await claim(messageId, queue);
    if (!token) return { ran: false };

    let result;
    try
    {
        result = await fn();
    }
    catch (error)
    {
        // Only our own claim: if it went stale and another holder took it over, that one is still running
        await ProcessedMessage.deleteOne({ messageId, queue, status: 'processing', claimToken: token }).catch(() => { });
        throw error;
    }

    // The work is done (the email is sent). Failing here must not throw: the message would be
    // retried and, once the claim went stale, sent a second time.
    try
    {
        await ProcessedMessage.updateOne({ messageId, queue }, { $set: { status: 'done', processedAt: new Date() } });
    }
    catch (error)
    {
        logger.error(`[${queue}] ${messageId} handled but not marked done: ${error.message}`);
    }
    return { ran: true, result };
};

// Wraps a consumer handler so each messageId is handled once per queue.
export const once = (handler) => async (payload, context) =>
{
    const { messageId, queue } = context;
    if (!messageId) return handler(payload, context);

    const { ran } = await runOnce(messageId, queue, () => handler(payload, context));
    if (!ran) logger.info(`[${queue}] ${messageId} already processed, skipping duplicate`);
};
