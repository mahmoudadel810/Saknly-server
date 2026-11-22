import ProcessedMessage from '../../Model/ProcessedMessageModel.js';
import logger from '../../utils/logger.js';

// Wraps a consumer handler so each messageId is handled once per queue.
// The id is recorded only after the handler succeeds, so a failed attempt can still be retried.
export const once = (handler) => async (payload, context) =>
{
    const { messageId, queue } = context;
    if (!messageId) return handler(payload, context);

    if (await ProcessedMessage.exists({ messageId, queue }))
    {
        logger.info(`[${queue}] ${messageId} already processed, skipping duplicate`);
        return;
    }

    await handler(payload, context);

    await ProcessedMessage.updateOne(
        { messageId, queue },
        { $setOnInsert: { processedAt: new Date() } },
        { upsert: true }
    );
};
