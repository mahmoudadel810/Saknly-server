import sendEmail from './sendEmail.js';
import { buildEmail } from './emailTemplates/index.js';
import { publishEvent } from './queue/publisher.js';
import logger from '../utils/logger.js';

// Publishes a domain event; the worker sends its email. When the queue is off or the
// publish fails, the email is sent inline as before. Never throws.
// Returns true when the email was queued or accepted by the mail server.
export const dispatchEmail = async (type, data) =>
{
    if (await publishEvent(type, data)) return true;

    const email = buildEmail(type, data);
    if (!email) return false;

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
