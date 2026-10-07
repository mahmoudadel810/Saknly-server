import { describe, it, expect } from 'vitest';
import request from 'supertest';
import Property from '../Model/PropertyModel.js';
import User from '../Model/UserModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeProperty, makePendingProperty, tokenFor, auth, newId } from './helpers/factories.js';

const favoritesOf = async (property) => (await Property.findById(property._id)).favorites.map(String);
const wishlistOf = async (user) => (await User.findById(user._id)).wishlist.map(i => i.property.toString());

describe('/users/me/wishlist (M1/M2)', () =>
{
    it('refuses non-public and unknown listings, so they cannot be read through the wishlist', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const pending = await makePendingProperty(owner);

        expect((await request(app).post(`${API}/users/me/wishlist/${pending._id}`).set(auth(token))).status).toBe(404);
        expect((await request(app).post(`${API}/users/me/wishlist/${newId()}`).set(auth(token))).status).toBe(404);
        expect(await wishlistOf(user)).toEqual([]);

        const list = await request(app).get(`${API}/users/me/wishlist`).set(auth(token));
        expect(list.status).toBe(200);
        expect(list.body.data).toHaveLength(0);
    });

    it('drops listings that stopped being public from the wishlist view', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const pub = await makeProperty(owner);
        await request(app).post(`${API}/users/me/wishlist/${pub._id}`).set(auth(token)).expect(200);

        await Property.updateOne({ _id: pub._id }, { $set: { isApproved: false, isActive: false, status: 'pending' } });
        const list = await request(app).get(`${API}/users/me/wishlist`).set(auth(token));
        expect(list.body.data).toHaveLength(0);
        expect(JSON.stringify(list.body)).not.toContain(owner.email);
    });

    it('concurrent adds create one entry and keep Property.favorites in sync', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const pub = await makeProperty(owner);

        const results = await Promise.all(Array.from({ length: 5 }, () =>
            request(app).post(`${API}/users/me/wishlist/${pub._id}`).set(auth(token))));
        expect(results.every(r => r.status === 200)).toBe(true);

        expect(await wishlistOf(user)).toEqual([pub._id.toString()]);
        expect(await favoritesOf(pub)).toEqual([user._id.toString()]);

        const status = await request(app).get(`${API}/properties/${pub._id}/favorite`).set(auth(token));
        expect(status.body.data.isFavorite).toBe(true);
    });

    it('remove and clear update both stores', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const a = await makeProperty(owner);
        const b = await makeProperty(owner);
        const c = await makeProperty(owner);
        for (const p of [a, b, c]) await request(app).post(`${API}/users/me/wishlist/${p._id}`).set(auth(token)).expect(200);

        await request(app).delete(`${API}/users/me/wishlist/${a._id}`).set(auth(token)).expect(200);
        expect((await wishlistOf(user)).sort()).toEqual([b._id.toString(), c._id.toString()].sort());
        expect(await favoritesOf(a)).toEqual([]);
        expect(await favoritesOf(b)).toEqual([user._id.toString()]);

        await request(app).delete(`${API}/users/me/wishlist`).set(auth(token)).expect(200);
        expect(await wishlistOf(user)).toEqual([]);
        expect(await favoritesOf(b)).toEqual([]);
        expect(await favoritesOf(c)).toEqual([]);
    });

    it('a remove does not drop a concurrent add of another listing', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const a = await makeProperty(owner);
        const b = await makeProperty(owner);
        await request(app).post(`${API}/users/me/wishlist/${a._id}`).set(auth(token)).expect(200);

        await Promise.all([
            request(app).delete(`${API}/users/me/wishlist/${a._id}`).set(auth(token)),
            request(app).post(`${API}/users/me/wishlist/${b._id}`).set(auth(token)),
        ]);
        expect(await wishlistOf(user)).toEqual([b._id.toString()]);
    });
});
