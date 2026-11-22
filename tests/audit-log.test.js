import { describe, it, expect } from 'vitest';
import AuditLog from '../Model/AuditLogModel.js';
import { handleAuditEvent } from '../workers/auditWorker.js';

const event = {
    type: 'user.registered',
    occurredAt: '2026-11-22T10:00:00.000Z',
    data: { userId: 'u1', email: 'private@example.test', confirmationLink: 'http://x/confirm-email/secret' },
};

describe('audit log consumer', () =>
{
    it('stores the event with ids only, never emails or links', async () =>
    {
        await handleAuditEvent(event, { messageId: 'a-1', type: 'user.registered' });
        const row = await AuditLog.findOne({ messageId: 'a-1' }).lean();
        expect(row.type).toBe('user.registered');
        expect(row.details).toEqual({ userId: 'u1' });
        expect(JSON.stringify(row)).not.toContain('private@example.test');
        expect(JSON.stringify(row)).not.toContain('secret');
    });

    it('writes one row when the same message is delivered twice', async () =>
    {
        await AuditLog.init();
        await handleAuditEvent(event, { messageId: 'a-2', type: 'user.registered' });
        await handleAuditEvent(event, { messageId: 'a-2', type: 'user.registered' });
        expect(await AuditLog.countDocuments({ messageId: 'a-2' })).toBe(1);
    });
});
