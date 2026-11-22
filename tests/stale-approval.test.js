import { describe, it, expect } from 'vitest';
import sendEmail from '../services/sendEmail.js';
import Property from '../Model/PropertyModel.js';
import { handleEmailEvent } from '../workers/emailWorker.js';
import { makeUser, makeProperty, makePendingProperty } from './helpers/factories.js';

const approvedEvent = (listing) => ({
    type: 'property.approved',
    data: { propertyId: String(listing._id), title: listing.title, ownerName: 'Ali', contactEmail: 'owner@example.test' },
});
const context = (messageId) => ({ messageId, queue: 'email.notifications', type: 'property.approved', attempt: 2 });

describe('a retried approval email checks the listing first', () =>
{
    it('sends it while the listing is still approved', async () =>
    {
        const listing = await makeProperty(await makeUser());
        await handleEmailEvent(approvedEvent(listing), context('a-1'));
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('skips it when the listing was deleted in the meantime', async () =>
    {
        const listing = await makeProperty(await makeUser());
        await Property.deleteOne({ _id: listing._id });
        await handleEmailEvent(approvedEvent(listing), context('a-2'));
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('skips it when the listing went back to review', async () =>
    {
        const listing = await makePendingProperty(await makeUser());
        await handleEmailEvent(approvedEvent(listing), context('a-3'));
        expect(sendEmail).not.toHaveBeenCalled();
    });
});
