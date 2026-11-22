import sendEmail from '../services/sendEmail.js';
import { buildEmail } from '../services/emailTemplates/index.js';
import { PermanentJobError } from '../services/queue/consumer.js';
import { once } from '../services/queue/idempotency.js';
import logger from '../utils/logger.js';

// Consumes email.notifications. A transport error throws, so the message is retried and then dead-lettered.
export const handleEmailEvent = once(async (payload, { type, queue }) =>
{
    const email = buildEmail(payload.type || type, payload.data);
    if (!email)
    {
        logger.info(`[${queue}] ${payload.type || type} sends no email, acked`);
        return;
    }

    const accepted = await sendEmail(email);
    if (!accepted) throw new PermanentJobError(`mail server rejected the recipient for ${payload.type || type}`);
});
