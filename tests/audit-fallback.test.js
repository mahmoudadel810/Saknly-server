import { describe, it, expect, afterEach } from 'vitest';
import AuditLog from '../Model/AuditLogModel.js';
import { publishEvent, publishMediaJob } from '../services/queue/publisher.js';
import { closeQueueConnection } from '../services/queue/connection.js';
import { handleAuditEvent } from '../workers/auditWorker.js';

const UNREACHABLE = 'amqp://127.0.0.1:1';
const deleted = { propertyId: 'p-1', title: 'Flat', deletedBy: 'u-1', email: 'owner@example.test' };

describe('audit record when publishing fails', () =>
{
    afterEach(async () =>
    {
        delete process.env.RABBITMQ_URL;
        await closeQueueConnection();
    });

    it('writes the audit row itself when the broker is unreachable, ids only', async () =>
    {
        process.env.RABBITMQ_URL = UNREACHABLE;
        await expect(publishEvent('property.deleted', deleted, { messageId: 'm-fallback' })).resolves.toBe(false);

        const rows = await AuditLog.find().lean();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ messageId: 'm-fallback', type: 'property.deleted' });
        expect(rows[0].details).toEqual({ propertyId: 'p-1', title: 'Flat', deletedBy: 'u-1' });
    });

    it('a late copy of the same event from the consumer adds no second row', async () =>
    {
        process.env.RABBITMQ_URL = UNREACHABLE;
        const occurredAt = '2026-11-22T12:00:00.000Z';
        await publishEvent('property.deleted', deleted, { messageId: 'm-late', occurredAt });
        await handleAuditEvent({ type: 'property.deleted', data: deleted, occurredAt }, { messageId: 'm-late', type: 'property.deleted' });

        expect(await AuditLog.countDocuments({ messageId: 'm-late' })).toBe(1);
    });

    it('writes nothing while the queue is off (behaviour unchanged)', async () =>
    {
        await expect(publishEvent('property.deleted', deleted)).resolves.toBe(false);
        expect(await AuditLog.countDocuments()).toBe(0);
    });

    it('media jobs are not audited', async () =>
    {
        process.env.RABBITMQ_URL = UNREACHABLE;
        await publishMediaJob('media.delete', { assets: [{ publicId: 'x' }] });
        expect(await AuditLog.countDocuments()).toBe(0);
    });
});
