import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import User from '../Model/UserModel.js';
import Property from '../Model/PropertyModel.js';
import Comment from '../Model/CommentModel.js';
import PropertyInquiry from '../Model/PropertyInquiryModel.js';
import ContactUs from '../Model/ContactModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, makeProperty, tokenFor, auth, PASSWORD } from './helpers/factories.js';

const IMAGE = { publicId: 'saknly/properties/own-1', url: 'https://res.cloudinary.test/own-1', isMain: true };

describe('DELETE /users/me (a user deletes their own account)', () =>
{
    it('needs the password of a password account', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const token = tokenFor(user);

        // 400, not 401: a wrong password must not look like an expired session to the apps
        await request(app).delete(`${API}/users/me`).set(auth(token)).send({}).expect(400);
        await request(app).delete(`${API}/users/me`).set(auth(token)).send({ password: 'wrong-Passw0rd' }).expect(400);
        expect(await User.exists({ _id: user._id })).toBeTruthy();
        await request(app).delete(`${API}/users/me`).send({ password: PASSWORD }).expect(401); // no token
    });

    it('deletes the account and everything it published, and leaves other users alone', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const other = await makeUser();
        const own = await makeProperty(user, { images: [IMAGE] });
        const othersListing = await makeProperty(other, { favorites: [user._id] });
        await User.updateOne({ _id: other._id }, { $push: { wishlist: { property: own._id } } });
        await Comment.create({ property: othersListing._id, user: user._id, text: 'Nice place, is it still free?' });
        await Comment.create({ property: own._id, user: other._id, text: 'Comment on the deleted listing' });
        const otherComment = await Comment.create({ property: othersListing._id, user: other._id, text: 'Still here after the deletion' });
        await PropertyInquiry.create({ property: othersListing._id, name: 'Mona', email: user.email, phone: '01012345678', message: 'I would like to visit it this week.' });
        await PropertyInquiry.create({ property: own._id, name: 'Karim', email: other.email, phone: '01012345678', message: 'Inquiry about the deleted listing.' });
        await ContactUs.create({ name: 'Mona', email: user.email.toUpperCase(), subject: 'Hello there', message: 'A message to the Saknly team.' });

        const res = await request(app).delete(`${API}/users/me`).set(auth(tokenFor(user))).send({ password: PASSWORD });
        expect(res.status).toBe(200);

        expect(await User.exists({ _id: user._id })).toBeFalsy();
        expect(await Property.exists({ _id: own._id })).toBeFalsy();
        expect(cloudinary.api.delete_resources.mock.calls.flatMap(([ids]) => ids)).toContain(IMAGE.publicId);
        expect(await Comment.countDocuments({ user: user._id })).toBe(0);
        expect(await Comment.countDocuments({ property: own._id })).toBe(0);
        expect(await PropertyInquiry.countDocuments({})).toBe(0);
        expect(await ContactUs.countDocuments({})).toBe(0);

        // the other user keeps their account, listing and comment; the deleted user's traces are gone
        const kept = await Property.findById(othersListing._id).lean();
        expect(kept.favorites.map(String)).not.toContain(String(user._id));
        expect(await Comment.exists({ _id: otherComment._id })).toBeTruthy();
        const otherUser = await User.findById(other._id).lean();
        expect(otherUser.wishlist.map((w) => String(w.property))).not.toContain(String(own._id));

        // the old token no longer works
        await request(app).get(`${API}/auth/getMe`).set(auth(tokenFor(user))).expect(401);
    });

    it('lets a Google-only account delete itself without a password', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        await User.updateOne({ _id: user._id }, { $set: { provider: 'google' }, $unset: { password: 1 } });
        await request(app).delete(`${API}/users/me`).set(auth(tokenFor(user))).send({}).expect(200);
        expect(await User.exists({ _id: user._id })).toBeFalsy();
    });

    it('refuses the last active admin', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const res = await request(app).delete(`${API}/users/me`).set(auth(tokenFor(admin))).send({ password: PASSWORD });
        expect(res.status).toBe(409);
        expect(await User.exists({ _id: admin._id })).toBeTruthy();

        // with another admin, an admin may leave
        await makeAdmin();
        await request(app).delete(`${API}/users/me`).set(auth(tokenFor(admin))).send({ password: PASSWORD }).expect(200);
    });
});

describe('PUT /properties/updateProperty/:id with clear[]', () =>
{
    it('empties the optional fields the owner cleared, and only those', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const listing = await makeProperty(owner, {
            category: 'sale',
            paymentMethod: 'installment',
            downPayment: 500000,
            installmentPeriodInYears: 5,
            deliveryDate: new Date('2028-03-01'),
            deliveryTerms: 'Half finished',
            location: { address: '1 Main St', city: 'طنطا', district: 'Center', latitude: 30.79, longitude: 31.0 },
        });

        const res = await request(app).put(`${API}/properties/updateProperty/${listing._id}`).set(auth(tokenFor(owner)))
            .field('paymentMethod', 'cash')
            .field('clear[]', 'downPayment')
            .field('clear[]', 'installmentPeriodInYears')
            .field('clear[]', 'deliveryDate')
            .field('clear[]', 'location.latitude')
            .field('clear[]', 'location.longitude');
        expect(res.status).toBe(200);

        const saved = await Property.findById(listing._id).lean();
        expect(saved.paymentMethod).toBe('cash');
        expect(saved.downPayment).toBeUndefined();
        expect(saved.installmentPeriodInYears).toBeUndefined();
        expect(saved.deliveryDate).toBeUndefined();
        expect(saved.location.latitude).toBeUndefined();
        expect(saved.location.longitude).toBeUndefined();
        // what wasn't cleared stays
        expect(saved.deliveryTerms).toBe('Half finished');
        expect(saved.location).toMatchObject({ address: '1 Main St', city: 'طنطا', district: 'Center' });
    });

    it('sets a field sent with a value even when it is also listed to clear, and refuses required fields', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const listing = await makeProperty(owner, { floor: 2, studentHousingDetails: { nearbyUniversities: [{ name: 'Tanta University', distanceInKm: 1 }] } });
        const token = auth(tokenFor(owner));

        await request(app).put(`${API}/properties/updateProperty/${listing._id}`).set(token)
            .send({ floor: 3, clear: ['floor', 'studentHousingDetails.nearbyUniversities'] }).expect(200);
        const saved = await Property.findById(listing._id).lean();
        expect(saved.floor).toBe(3);
        expect(saved.studentHousingDetails.nearbyUniversities).toEqual([]);

        const refused = await request(app).put(`${API}/properties/updateProperty/${listing._id}`).set(token).send({ clear: ['title'] });
        expect(refused.status).toBe(400);
        expect((await Property.findById(listing._id).lean()).title).toBe(listing.title);
    });
});
