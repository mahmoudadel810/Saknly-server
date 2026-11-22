import mongoose from 'mongoose';
import Property from '../Model/PropertyModel.js';
import sendEmail from '../services/sendEmail.js';
import { buildEmail } from '../services/emailTemplates/index.js';
import { PermanentJobError } from '../services/queue/consumer.js';
import { once } from '../services/queue/idempotency.js';
import logger from '../utils/logger.js';

// A retried approval email can arrive after the listing was deleted or sent back to review.
// Skips only on positive evidence: a real listing id that is gone or no longer approved.
const approvalIsStale = async (data = {}) =>
{
    if (!mongoose.isValidObjectId(data.propertyId)) return false;
    const listing = await Property.findById(data.propertyId).select('isApproved').lean();
    return !listing || listing.isApproved !== true;
};

// Consumes email.notifications. A transport error throws, so the message is retried and then dead-lettered.
export const handleEmailEvent = once(async (payload, { type, queue }) =>
{
    const eventType = payload.type || type;
    if (eventType === 'property.approved' && await approvalIsStale(payload.data))
    {
        logger.info(`[${queue}] ${eventType} for ${payload.data.propertyId} skipped: the listing is gone or no longer approved`);
        return;
    }

    const email = buildEmail(eventType, payload.data);
    if (!email)
    {
        logger.info(`[${queue}] ${eventType} sends no email, acked`);
        return;
    }

    const accepted = await sendEmail(email);
    if (!accepted) throw new PermanentJobError(`mail server rejected the recipient for ${eventType}`);
});
