import { describe, it, expect, vi, afterEach } from 'vitest';
import sendEmail from '../services/sendEmail.js';
import { publishEvent } from '../services/queue/publisher.js';
import { dispatchEmail } from '../services/notify.js';
import { handleEmailEvent } from '../workers/emailWorker.js';
import ProcessedMessage from '../Model/ProcessedMessageModel.js';

vi.mock('../services/queue/publisher.js', async (importOriginal) =>
{
    const actual = await importOriginal();
    return { ...actual, publishEvent: vi.fn() };
});

const data = { propertyId: 'p1', title: 'Flat', ownerName: 'Ali', contactEmail: 'owner@example.test' };
const workerContext = (messageId) => ({ messageId, queue: 'email.notifications', type: 'property.approved', attempt: 1 });

// The publish "fails" from the API's point of view, but the broker stored the message anyway (late confirm)
describe('a late publish confirm sends the email once', () =>
{
    afterEach(() => { delete process.env.RABBITMQ_URL; });

    it('worker sent it first: the inline fallback skips it', async () =>
    {
        process.env.RABBITMQ_URL = 'amqp://broker.test';
        await ProcessedMessage.init();
        publishEvent.mockImplementationOnce(async (type, payload, { messageId }) =>
        {
            await handleEmailEvent({ type, data: payload }, workerContext(messageId));
            return false;
        });

        await expect(dispatchEmail('property.approved', data)).resolves.toBe(true);
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('inline fallback sent it first: the worker skips its copy', async () =>
    {
        process.env.RABBITMQ_URL = 'amqp://broker.test';
        await ProcessedMessage.init();
        let sharedId;
        publishEvent.mockImplementationOnce(async (type, payload, { messageId }) => { sharedId = messageId; return false; });

        await expect(dispatchEmail('property.approved', data)).resolves.toBe(true);
        await handleEmailEvent({ type: 'property.approved', data }, workerContext(sharedId));
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('queue off: plain inline send, no claim written (behaviour unchanged)', async () =>
    {
        publishEvent.mockResolvedValueOnce(false);
        await expect(dispatchEmail('property.approved', data)).resolves.toBe(true);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(await ProcessedMessage.countDocuments()).toBe(0);
    });
});
