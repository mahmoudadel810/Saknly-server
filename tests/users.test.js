import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import User from '../Model/UserModel.js';
import Property from '../Model/PropertyModel.js';
import Comment from '../Model/CommentModel.js';
import PropertyInquiry from '../Model/PropertyInquiryModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, makeProperty, makePendingProperty, tokenFor, auth } from './helpers/factories.js';

describe('admin safety guards (H2)', () =>
{
    it('an admin cannot delete their own account', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        await makeAdmin(); // not the last admin: self-delete is still refused
        const res = await request(app).delete(`${API}/users/delete-user/${admin._id}`).set(auth(tokenFor(admin)));
        expect(res.status).toBe(409);
        expect(await User.exists({ _id: admin._id })).toBeTruthy();
    });

    it('the last active admin cannot be demoted or deactivated', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const token = tokenFor(admin);

        const demote = await request(app).put(`${API}/users/update-user/${admin._id}`).set(auth(token)).send({ role: 'user' });
        expect(demote.status).toBe(409);
        const deactivate = await request(app).put(`${API}/users/update-user/${admin._id}`).set(auth(token)).send({ status: 'in-active' });
        expect(deactivate.status).toBe(409);
        const stored = await User.findById(admin._id);
        expect(stored.role).toBe('admin');
        expect(stored.status).toBe('active');

        // harmless edits of the last admin still work
        await request(app).put(`${API}/users/update-user/${admin._id}`).set(auth(token)).send({ address: 'New address' }).expect(200);
    });

    it('another admin can be demoted or deleted while one active admin remains', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const second = await makeAdmin();
        const third = await makeAdmin();
        const token = tokenFor(admin);
        await request(app).put(`${API}/users/update-user/${second._id}`).set(auth(token)).send({ role: 'user' }).expect(200);
        await request(app).delete(`${API}/users/delete-user/${third._id}`).set(auth(token)).expect(200);
    });
});

describe('user deletion cleanup (H2)', () =>
{
    it('unlists their properties, removes their comments and favorites, keeps inquiries and media', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const victim = await makeUser();
        const other = await makeUser();

        const own = await makeProperty(victim, { images: [{ publicId: 'saknly/own', url: 'https://x/own', isMain: true }] });
        const ownPending = await makePendingProperty(victim);
        const othersListing = await makeProperty(other, { favorites: [victim._id, other._id] });
        await Comment.create({ property: othersListing._id, user: victim._id, text: 'by victim' });
        await Comment.create({ property: othersListing._id, user: other._id, text: 'by other' });
        await PropertyInquiry.create({ property: othersListing._id, name: 'Victim', email: victim.email, phone: '01012345678', message: 'Inquiry text here', agent: other._id });

        const res = await request(app).delete(`${API}/users/delete-user/${victim._id}`).set(auth(tokenFor(admin)));
        expect(res.status).toBe(200);
        expect(await User.exists({ _id: victim._id })).toBeNull();

        for (const p of [own, ownPending])
        {
            const stored = await Property.findById(p._id);
            expect(stored).not.toBeNull();
            expect(stored.isActive).toBe(false);
            expect(stored.status).toBe('inactive');
        }
        expect((await Property.findById(othersListing._id)).favorites.map(String)).toEqual([other._id.toString()]);
        expect((await Comment.find()).map(c => c.text)).toEqual(['by other']);
        expect(await PropertyInquiry.countDocuments()).toBe(1);
        expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
        expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();

        const listing = await request(app).get(`${API}/properties/allProperties`);
        expect(listing.body.data.map(p => p._id)).toEqual([othersListing._id.toString()]);
    });
});
