import { randomUUID } from 'node:crypto';
import sendEmail from './sendEmail.js';
import { buildEmail } from './emailTemplates/index.js';
import { publishEvent } from './queue/publisher.js';
import { isQueueEnabled } from './queue/connection.js';
import { runOnce, MessageInProgressError } from './queue/idempotency.js';
import { QUEUES } from './queue/topology.js';
import logger from '../utils/logger.js';

// Publishes a domain event; the worker sends its email. When the queue is off or the
// publish fails, the email is sent inline as before. Never throws.
// Returns true when the email was queued or accepted by the mail server.
export const dispatchEmail = async (type, data) =>
{
    const messageId = randomUUID();
    if (await publishEvent(type, data, { messageId })) return true;

    const email = buildEmail(type, data);
    if (!email) return false;

    let sendAttempted = false;
    const send = () =>
    {
        sendAttempted = true;
        return sendEmail(email);
    };

    try
    {
        if (!isQueueEnabled()) return await send();

        // A failed publish may still have reached the broker (its confirm came too late), and then the
        // worker sends this email too. Both claim the same messageId, so only the first one sends it.
        const { ran, result } = await runOnce(messageId, QUEUES.email.name, send);
        return ran ? result : true;
    }
    catch (error)
    {
        // The worker holds the claim and is sending it right now
        if (error instanceof MessageInProgressError) return true;
        // The claim itself failed (database), not the send: the dedupe must not cost the email
        if (!sendAttempted) return sendPlain(email);
        logger.error(`Email to recipient failed (${email.subject}): ${error.message}`);
        return false;
    }
};

const sendPlain = async (email) =>
{
    try
    {
        return await sendEmail(email);
    }
    catch (error)
    {
        logger.error(`Email to recipient failed (${email.subject}): ${error.message}`);
        return false;
    }
};
