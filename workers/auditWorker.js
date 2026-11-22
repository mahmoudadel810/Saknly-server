import { recordAuditEvent } from '../services/audit.js';

// Consumes audit.log (bound to '#', so it receives every event on saknly.events).
// The upsert on messageId makes a redelivered event a no-op.
export const handleAuditEvent = (payload, { messageId, type }) =>
    recordAuditEvent({ messageId, type: payload.type || type, occurredAt: payload.occurredAt, data: payload.data });
