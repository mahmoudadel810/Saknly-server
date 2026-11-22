import AuditLog from '../Model/AuditLogModel.js';

// Only these fields are kept: events also carry emails, confirmation links and inquiry text
const AUDITED_FIELDS = ['userId', 'propertyId', 'inquiryId', 'deletedBy', 'title', 'reason'];

const pickAuditedFields = (data = {}) =>
    Object.fromEntries(AUDITED_FIELDS.filter(key => data[key] !== undefined).map(key => [key, data[key]]));

// Consumes audit.log (bound to '#', so it receives every event on saknly.events).
// The upsert on messageId makes a redelivered event a no-op.
export const handleAuditEvent = async (payload, { messageId, type }) =>
{
    const eventType = payload.type || type;
    const filter = messageId ? { messageId } : { messageId: `${eventType}:${payload.occurredAt}` };
    await AuditLog.updateOne(
        filter,
        {
            $setOnInsert: {
                type: eventType,
                occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
                details: pickAuditedFields(payload.data),
            },
        },
        { upsert: true }
    );
};
