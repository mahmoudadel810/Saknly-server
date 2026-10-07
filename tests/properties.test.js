import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import Property from '../Model/PropertyModel.js';
import Agency from '../Model/AgencyModel.js';
import User from '../Model/UserModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, makeProperty, makePendingProperty, tokenFor, auth, newId, pngBuffer } from './helpers/factories.js';

const validBody = (overrides = {}) => ({
    title: 'Sunny flat',
    description: 'Close to the university',
    type: 'شقة',
    category: 'rent',
    price: 2500,
    area: 100,
    bedrooms: 2,
    bathrooms: 1,
    location: { address: '5 Nile St', city: 'طنطا' },
    contactInfo: { name: 'Owner', phone: '01011111111' },
    ...overrides,
});

describe('public listings', () =>
{
    it('only approved + active listings are returned and query filters cannot override that', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        await makeProperty(owner, { title: 'Public A' });
        await makeProperty(owner, { title: 'Public B' });
        await makePendingProperty(owner, { title: 'Pending C' });
        await makeProperty(owner, { title: 'Inactive D', isActive: false });

        const queries = ['', '?isApproved=false', '?isActive=false', '?status=pending', '?price[gte]=abc',
            `?owner=${owner._id}`, '?$where=1', '?fields=+password', '?isApproved[$ne]=true'];
        for (const q of queries)
        {
            const res = await request(app).get(`${API}/properties/allProperties${q}`);
            expect(res.status, q).toBe(200);
            if (q === '?fields=+password')
            {
                // projection only: still public docs only, and no hidden field is un-hidden
                expect(res.body.data, q).toHaveLength(2);
                continue;
            }
            const titles = res.body.data.map(p => p.title).sort();
            if (q === '?status=pending') expect(titles, q).toEqual([]);
            else expect(titles, q).toEqual(['Public A', 'Public B']);
        }

        const search = await request(app).get(`${API}/properties/search?isApproved=false`);
        expect(search.body.data.map(p => p.title).sort()).toEqual(['Public A', 'Public B']);
        const featured = await request(app).get(`${API}/properties/featured`);
        expect(featured.body.data).toHaveLength(2);
    });

    it('search input is treated literally (regex escaped)', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        await makeProperty(owner, { title: 'Plain title' });
        const res = await request(app).get(`${API}/properties/allProperties?search=.*`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
        const evil = await request(app).get(`${API}/properties/allProperties?search=(a%2B)%2B$`);
        expect(evil.status).toBe(200);
    });

    it('paginates with metadata and caps limit at 50', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        for (let i = 0; i < 12; i++) await makeProperty(owner);

        const page2 = await request(app).get(`${API}/properties/allProperties?page=2&limit=5`);
        expect(page2.body.data).toHaveLength(5);
        expect(page2.body.pagination).toMatchObject({ currentPage: 2, totalDocs: 12, totalPages: 3, hasNext: true, hasPrev: true });

        const big = await request(app).get(`${API}/properties/allProperties?limit=1000`);
        expect(big.body.pagination.itemsPerPage).toBe(50);
        expect(big.body.data).toHaveLength(12);

        const bad = await request(app).get(`${API}/properties/allProperties?page=-3`);
        expect(bad.body.pagination.currentPage).toBe(1);
    });

    it('filters and sorts', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        await makeProperty(owner, { title: 'cheap', price: 1500, bedrooms: 2 });
        await makeProperty(owner, { title: 'mid', price: 3000, bedrooms: 3 });
        await makeProperty(owner, { title: 'too expensive', price: 9000, bedrooms: 3 });
        await makeProperty(owner, { title: 'other city', price: 2000, bedrooms: 2, location: { address: 'x', city: 'منوف' } });

        const q = encodeURI('?city=طنطا&category=rent&minPrice=1000&maxPrice=5000&bedrooms=2,3&sort=-price');
        const res = await request(app).get(`${API}/properties/allProperties${q}`);
        expect(res.body.data.map(p => p.title)).toEqual(['mid', 'cheap']);
    });
});

describe('property details visibility', () =>
{
    it('a non-public listing is visible only to its owner and admins, and views are not counted', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const other = await makeUser();
        const admin = await makeAdmin();
        const pending = await makePendingProperty(owner);
        const url = `${API}/properties/propertyDetails/${pending._id}`;

        expect((await request(app).get(url)).status).toBe(404);
        expect((await request(app).get(url).set(auth(tokenFor(other)))).status).toBe(404);
        expect((await request(app).get(url).set(auth(tokenFor(owner)))).status).toBe(200);
        expect((await request(app).get(url).set(auth(tokenFor(admin)))).status).toBe(200);
        expect((await Property.findById(pending._id)).views).toBe(0);
    });

    it('a public listing increments views; unknown and malformed ids are 404', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const pub = await makeProperty(owner);
        expect((await request(app).get(`${API}/properties/propertyDetails/${pub._id}`)).status).toBe(200);
        expect((await Property.findById(pub._id)).views).toBe(1);
        expect((await request(app).get(`${API}/properties/propertyDetails/${newId()}`)).status).toBe(404);
        expect((await request(app).get(`${API}/properties/propertyDetails/not-an-id`)).status).toBe(404);
    });
});

describe('ownership (IDOR)', () =>
{
    it('a non-owner cannot update a property, and their upload is discarded', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const intruder = await makeUser();
        const property = await makePendingProperty(owner, { title: 'Original' });

        const json = await request(app).put(`${API}/properties/updateProperty/${property._id}`)
            .set(auth(tokenFor(intruder))).send({ title: 'Hacked' });
        expect(json.status).toBe(403);

        const multipart = await request(app).put(`${API}/properties/updateProperty/${property._id}`)
            .set(auth(tokenFor(intruder)))
            .field('title', 'Hacked')
            .attach('newImages', await pngBuffer(), { filename: 'a.png', contentType: 'image/png' });
        expect(multipart.status).toBe(403);
        expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
        const uploadedId = cloudinary.uploader.destroy.mock.calls[0]?.[0];
        expect(uploadedId).toMatch(/^saknly\/test-/);

        expect((await Property.findById(property._id)).title).toBe('Original');
    });

    it('a non-owner cannot delete a property; the owner can, and references are cleaned', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const intruder = await makeUser();
        const property = await makeProperty(owner, { images: [{ publicId: 'saknly/p1', url: 'https://x/p1', isMain: true }] });
        const agency = await Agency.create({ name: 'Agency', logo: { publicId: 'l', url: 'https://x/l' }, properties: [property._id] });
        await User.updateOne({ _id: intruder._id }, { $push: { wishlist: { property: property._id } } });

        const denied = await request(app).delete(`${API}/properties/deleteProperty/${property._id}`).set(auth(tokenFor(intruder)));
        expect(denied.status).toBe(403);
        expect(await Property.exists({ _id: property._id })).toBeTruthy();

        const ok = await request(app).delete(`${API}/properties/deleteProperty/${property._id}`).set(auth(tokenFor(owner)));
        expect(ok.status).toBe(200);
        expect(await Property.exists({ _id: property._id })).toBeNull();
        expect((await Agency.findById(agency._id)).properties).toHaveLength(0);
        expect((await User.findById(intruder._id)).wishlist).toHaveLength(0);
        expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['saknly/p1'], expect.any(Object));
    });

    it('an admin may edit and delete any property', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const admin = await makeAdmin();
        const property = await makeProperty(owner);
        const upd = await request(app).put(`${API}/properties/updateProperty/${property._id}`)
            .set(auth(tokenFor(admin))).send({ title: 'Edited by admin' });
        expect(upd.status).toBe(200);
        expect(upd.body.data.isApproved).toBe(true);
        const del = await request(app).delete(`${API}/properties/deleteProperty/${property._id}`).set(auth(tokenFor(admin)));
        expect(del.status).toBe(200);
    });
});

describe('mass assignment and validation', () =>
{
    it('server-controlled fields are ignored on create by a regular user', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const other = await makeUser();
        const res = await request(app).post(`${API}/properties/addProperty`).set(auth(tokenFor(user)))
            .send(validBody({ isApproved: true, isActive: true, owner: other._id.toString(), views: 999, status: 'available', agency: newId(), favorites: [other._id.toString()], slug: 'mine' }));
        expect(res.status).toBe(201);

        const stored = await Property.findById(res.body.data._id);
        expect(stored.owner.toString()).toBe(user._id.toString());
        expect(stored.isApproved).toBe(false);
        expect(stored.isActive).toBe(false);
        expect(stored.status).toBe('pending');
        expect(stored.views).toBe(0);
        expect(stored.agency).toBeUndefined();
        expect(stored.favorites).toHaveLength(0);
        expect(stored.slug).not.toBe('mine');
    });

    it('an owner edit sends the listing back to review and ignores approval fields', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const admin = await makeAdmin();
        const property = await makeProperty(owner, { approvedBy: admin._id, approvedAt: new Date() });

        const res = await request(app).put(`${API}/properties/updateProperty/${property._id}`)
            .set(auth(tokenFor(owner))).send({ title: 'Renamed', isApproved: true, isActive: true, status: 'sold', views: 50 });
        expect(res.status).toBe(200);
        const stored = await Property.findById(property._id);
        expect(stored.title).toBe('Renamed');
        expect(stored.isApproved).toBe(false);
        expect(stored.isActive).toBe(false);
        expect(stored.status).toBe('pending');
        expect(stored.approvedBy).toBeUndefined();
        expect(stored.views).toBe(0);
    });

    it('Joi validation rejects bad bodies (and discards uploads) and coerces multipart strings', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const token = tokenFor(user);
        const post = () => request(app).post(`${API}/properties/addProperty`).set(auth(token));

        const { contactInfo, ...noContact } = validBody();
        expect((await post().send({ ...noContact, contactInfo: { name: 'x' } })).status).toBe(400);
        expect((await post().send(validBody({ price: -5 }))).status).toBe(400);
        expect((await post().send(validBody({ category: 'hotel' }))).status).toBe(400);

        const png = await pngBuffer();
        const invalidUpload = await post()
            .field('title', 'x').field('category', 'rent')
            .attach('images', png, { filename: 'a.png', contentType: 'image/png' });
        expect(invalidUpload.status).toBe(400);
        expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);

        const wrongType = await post().field('category', 'rent')
            .attach('images', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
        expect(wrongType.status).toBe(400);

        const ok = await post()
            .field('title', 'Multipart flat').field('description', 'desc').field('type', 'شقة').field('category', 'rent')
            .field('price', '2500').field('area', '100').field('bedrooms', '3').field('bathrooms', '1')
            .field('isNegotiable', 'true')
            .field('location[address]', '5 Nile St').field('location[city]', 'طنطا')
            .field('contactInfo[name]', 'Owner').field('contactInfo[phone]', '01011111111')
            .attach('images', png, { filename: 'a.png', contentType: 'image/png' });
        expect(ok.status).toBe(201);
        expect(ok.body.data.bedrooms).toBe(3);
        expect(ok.body.data.isNegotiable).toBe(true);
        expect(ok.body.data.images).toHaveLength(1);
        expect(ok.body.data.images[0].isMain).toBe(true);
        expect(await Property.countDocuments()).toBe(1);
    });
});

describe('favorites endpoint', () =>
{
    it('is idempotent under concurrency and public-only', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const pub = await makeProperty(owner);
        const pending = await makePendingProperty(owner);

        await Promise.all(Array.from({ length: 5 }, () =>
            request(app).post(`${API}/properties/${pub._id}/favorite`).set(auth(token))));
        expect((await Property.findById(pub._id)).favorites.map(String)).toEqual([user._id.toString()]);
        expect((await User.findById(user._id)).wishlist).toHaveLength(1);

        expect((await request(app).post(`${API}/properties/${pending._id}/favorite`).set(auth(token))).status).toBe(404);
    });
});

describe('approve and deny', () =>
{
    it('approve publishes a pending listing', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const admin = await makeAdmin();
        const pending = await makePendingProperty(owner);
        const res = await request(app).put(`${API}/properties/${pending._id}/approve`).set(auth(tokenFor(admin))).send({});
        expect(res.status).toBe(200);
        const stored = await Property.findById(pending._id);
        expect(stored.isApproved && stored.isActive).toBe(true);
        expect(stored.status).toBe('available');
    });
});
