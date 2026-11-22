import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import sendEmail from '../services/sendEmail.js';
import { publishEvent } from '../services/queue/publisher.js';
import { handleEmailEvent } from '../workers/emailWorker.js';
import { PermanentJobError } from '../services/queue/consumer.js';
import { MessageInProgressError } from '../services/queue/idempotency.js';
import ProcessedMessage from '../Model/ProcessedMessageModel.js';
import { getApp, API } from './helpers/app.js';
import { PASSWORD } from './helpers/factories.js';

vi.mock('../services/queue/publisher.js', async (importOriginal) =>
{
    const actual = await importOriginal();
    return { ...actual, publishEvent: vi.fn(actual.publishEvent) };
});

const registerBody = () => ({
    userName: 'queued',
    email: 'queued@example.test',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    phone: '01098765432',
    address: 'Menouf',
});

const context = (messageId) => ({ messageId, queue: 'email.notifications', type: 'property.approved', attempt: 1 });

const approvedPayload = {
    type: 'property.approved',
    data: { propertyId: 'p1', title: 'Flat', ownerName: 'Ali', contactEmail: 'owner@example.test' },
};

describe('email dispatch from the API', () =>
{
    afterEach(() => { delete process.env.RABBITMQ_URL; });

    it('queues the confirmation email instead of sending it when the broker confirms', async () =>
    {
        publishEvent.mockResolvedValueOnce(true);
        const app = await getApp();
        const res = await request(app).post(`${API}/auth/register`).send(registerBody());

        expect(res.status).toBe(201);
        expect(res.body.emailSent).toBe(true);
        expect(sendEmail).not.toHaveBeenCalled();
        expect(publishEvent).toHaveBeenCalledWith('user.registered', expect.objectContaining({
            email: 'queued@example.test',
            confirmationLink: expect.stringContaining('/confirm-email/'),
        }));
    });

    it('falls back to inline sending when the broker is unreachable', async () =>
    {
        process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
        const app = await getApp();
        const res = await request(app).post(`${API}/auth/register`).send(registerBody());

        expect(res.status).toBe(201);
        expect(res.body.emailSent).toBe(true);
        await expect(publishEvent.mock.results[0].value).resolves.toBe(false);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'queued@example.test', subject: 'Confirm your email' }));
    });
});

describe('email worker', () =>
{
    it('sends the email for a queued event', async () =>
    {
        await handleEmailEvent(approvedPayload, context('msg-1'));
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.test' }));
    });

    it('skips a redelivered message it already handled', async () =>
    {
        await handleEmailEvent(approvedPayload, context('msg-2'));
        await handleEmailEvent(approvedPayload, context('msg-2'));
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('sends once when two copies of a message arrive at the same time', async () =>
    {
        await ProcessedMessage.init(); // unique index must exist, as the worker ensures on start
        const results = await Promise.allSettled([
            handleEmailEvent(approvedPayload, context('msg-6')),
            handleEmailEvent(approvedPayload, context('msg-6')),
        ]);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        // the loser either saw the finished claim or is sent to retry while the claim is fresh
        results.filter(r => r.status === 'rejected')
            .forEach(r => expect(r.reason).toBeInstanceOf(MessageInProgressError));
    });

    it('waits on a fresh claim and takes over a stale one left by a crashed worker', async () =>
    {
        await ProcessedMessage.create({ messageId: 'msg-7', queue: 'email.notifications' });
        const waiting = await handleEmailEvent(approvedPayload, context('msg-7')).catch(e => e);
        expect(waiting).toBeInstanceOf(MessageInProgressError);
        expect(waiting.countsAsAttempt).toBe(false);
        expect(sendEmail).not.toHaveBeenCalled();

        await ProcessedMessage.updateOne({ messageId: 'msg-7' }, { $set: { claimedAt: new Date(Date.now() - 10 * 60 * 1000) } });
        await handleEmailEvent(approvedPayload, context('msg-7'));
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect((await ProcessedMessage.findOne({ messageId: 'msg-7' })).status).toBe('done');
    });

    it('lets a failed send be retried with the same message id', async () =>
    {
        sendEmail.mockRejectedValueOnce(new Error('smtp down'));
        await expect(handleEmailEvent(approvedPayload, context('msg-3'))).rejects.toThrow('smtp down');
        await handleEmailEvent(approvedPayload, context('msg-3'));
        expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    it('acks events without a recipient and dead-letters rejected recipients', async () =>
    {
        await handleEmailEvent({ type: 'property.approved', data: { title: 'No contact' } }, context('msg-4'));
        expect(sendEmail).not.toHaveBeenCalled();

        sendEmail.mockResolvedValueOnce(false);
        await expect(handleEmailEvent(approvedPayload, context('msg-5'))).rejects.toBeInstanceOf(PermanentJobError);
    });
});
