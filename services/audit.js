import AuditLog from '../Model/AuditLogModel.js';

// Only these fields are kept: events also carry emails, confirmation links and inquiry text
const AUDITED_FIELDS = ['userId', 'propertyId', 'inquiryId', 'deletedBy', 'title', 'reason'];

const pickAuditedFields = (data = {}) =>
    Object.fromEntries(AUDITED_FIELDS.filter(key => data[key] !== undefined).map(key => [key, data[key]]));

// One row per event, upserted on messageId: the audit.log consumer and the publisher's fallback
// (broker unreachable) can both write the same event without creating a second row.
export const recordAuditEvent = ({ messageId, type, occurredAt, data }) =>
    AuditLog.updateOne(
        { messageId: messageId || `${type}:${occurredAt}` },
        {
            $setOnInsert: {
                type,
                occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
                details: pickAuditedFields(data),
            },
        },
        { upsert: true }
    );
