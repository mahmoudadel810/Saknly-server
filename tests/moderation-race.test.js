import { describe, it, expect } from 'vitest';
import request from 'supertest';
import sendEmail from '../services/sendEmail.js';
import Property from '../Model/PropertyModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, makePendingProperty, makeProperty, tokenFor, auth } from './helpers/factories.js';

const contact = { contactInfo: { name: 'Owner', phone: '01011111111', email: 'owner@example.test' } };

const approve = (app, admin, id) =>
    request(app).put(`${API}/properties/${id}/approve`).set(auth(tokenFor(admin))).send({});
const deny = (app, admin, id) =>
    request(app).delete(`${API}/properties/${id}/deny?reason=dup`).set(auth(tokenFor(admin)));

const sortedStatuses = (responses) => responses.map(r => r.status).sort();

describe('moderation: the first admin wins, one email per listing', () =>
{
    it('two admins approving at once: one succeeds, the other gets 409, one email', async () =>
    {
        const app = await getApp();
        const [a1, a2] = [await makeAdmin(), await makeAdmin()];
        const listing = await makePendingProperty(await makeUser(), contact);

        const res = await Promise.all([approve(app, a1, listing._id), approve(app, a2, listing._id)]);

        expect(sortedStatuses(res)).toEqual([200, 409]);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect((await Property.findById(listing._id)).isApproved).toBe(true);
    });

    it('approving an approved listing again is a 409 and sends nothing', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const listing = await makePendingProperty(await makeUser(), contact);

        await approve(app, admin, listing._id).expect(200);
        const again = await approve(app, admin, listing._id);

        expect(again.status).toBe(409);
        expect(again.body.message).toBe('Property was already reviewed');
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('two admins denying at once: one deletes and emails, the other gets 404', async () =>
    {
        const app = await getApp();
        const [a1, a2] = [await makeAdmin(), await makeAdmin()];
        const listing = await makePendingProperty(await makeUser(), contact);

        const res = await Promise.all([deny(app, a1, listing._id), deny(app, a2, listing._id)]);

        expect(sortedStatuses(res)).toEqual([200, 404]);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(await Property.exists({ _id: listing._id })).toBeNull();
    });

    it('approve and deny at once: exactly one wins and exactly one email goes out', async () =>
    {
        const app = await getApp();
        const [a1, a2] = [await makeAdmin(), await makeAdmin()];
        const listing = await makePendingProperty(await makeUser(), contact);

        const res = await Promise.all([approve(app, a1, listing._id), deny(app, a2, listing._id)]);

        expect(res.filter(r => r.status === 200)).toHaveLength(1);
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('deny leaves an approved listing alone (409, no email)', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const listing = await makeProperty(await makeUser(), contact);

        const res = await deny(app, admin, listing._id);

        expect(res.status).toBe(409);
        expect(sendEmail).not.toHaveBeenCalled();
        expect(await Property.exists({ _id: listing._id })).not.toBeNull();
    });

    it('unknown listings are still a 404', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const missing = '507f1f77bcf86cd799439011';

        expect((await approve(app, admin, missing)).status).toBe(404);
        expect((await deny(app, admin, missing)).status).toBe(404);
    });
});
