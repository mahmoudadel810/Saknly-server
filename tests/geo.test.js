import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { getApp, API } from './helpers/app.js';
import { makeUser, tokenFor, auth } from './helpers/factories.js';
import { resetGeoRateLimit } from '../modules/Geo/geoRateLimit.js';

const KEY = 'test-geolink-key';
const place = {
    short_address: 'الإدارة العامة لجامعة المنوفية',
    address: 'الإدارة العامة لجامعة المنوفية, مركز شبين الكوم, محافظة المنوفية, EG',
    address_parts: { country: 'EG', district: 'مركز شبين الكوم', governorate: 'محافظة المنوفية' },
    location: { lat: 30.5655, lng: 31.0130 },
};
const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchMock;
beforeEach(() =>
{
    resetGeoRateLimit();
    process.env.GEOLINK_API_KEY = KEY;
    delete process.env.GEOLINK_BASE_URL;
    fetchMock = vi.spyOn(globalThis, 'fetch');
});
afterEach(() =>
{
    fetchMock.mockRestore();
    delete process.env.GEOLINK_API_KEY;
});

describe('GET /geo/search and /geo/reverse (GeoLink through the server)', () =>
{
    it('searches places with the key kept on the server, and returns them in the apps\' shape', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        fetchMock.mockImplementation(() => reply({ success: true, data: [place, { short_address: 'no pin' }] }));

        const res = await request(app).get(`${API}/geo/search`).query({ query: 'جامعة المنوفية', latitude: 30.55, longitude: 31.01 }).set(auth(tokenFor(user)));
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([{
            name: place.short_address,
            address: place.address,
            latitude: 30.5655,
            longitude: 31.013,
            governorate: 'محافظة المنوفية',
            district: 'مركز شبين الكوم',
        }]);
        const called = new URL(fetchMock.mock.calls[0][0]);
        expect(called.origin + called.pathname).toBe('https://geolink-eg.com/api/v2/text_search');
        expect(called.searchParams.get('key')).toBe(KEY);
        expect(called.searchParams.get('query')).toBe('جامعة المنوفية');
        expect(called.searchParams.get('country')).toBe('eg');
        // the key never reaches the app
        expect(JSON.stringify(res.body)).not.toContain(KEY);
    });

    it('turns a pin into an address', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        fetchMock.mockImplementation(() => reply({ success: true, data: place }));

        const res = await request(app).get(`${API}/geo/reverse`).query({ latitude: 30.5655, longitude: 31.013 }).set(auth(tokenFor(user)));
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ address: place.address, governorate: 'محافظة المنوفية' });
        expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/api/v2/reverse_geocode');
    });

    it('is for signed-in users only, and checks its input before calling GeoLink', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        await request(app).get(`${API}/geo/search`).query({ query: 'cairo' }).expect(401);
        await request(app).get(`${API}/geo/search`).query({ query: 'c' }).set(auth(tokenFor(user))).expect(400);
        await request(app).get(`${API}/geo/search`).query({ query: 'cairo', latitude: 30 }).set(auth(tokenFor(user))).expect(400);
        await request(app).get(`${API}/geo/reverse`).query({ latitude: 95, longitude: 31 }).set(auth(tokenFor(user))).expect(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 503 without a key or when GeoLink fails, and never leaks the key', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        fetchMock.mockImplementation(() => reply({ success: false, error: 'Invalid API key' }, 401));
        const failed = await request(app).get(`${API}/geo/reverse`).query({ latitude: 30, longitude: 31 }).set(auth(tokenFor(user)));
        expect(failed.status).toBe(503);
        expect(JSON.stringify(failed.body)).not.toContain(KEY);

        fetchMock.mockImplementation(() => Promise.reject(new Error('timeout')));
        await request(app).get(`${API}/geo/search`).query({ query: 'cairo' }).set(auth(tokenFor(user))).expect(503);

        delete process.env.GEOLINK_API_KEY;
        fetchMock.mockClear();
        await request(app).get(`${API}/geo/search`).query({ query: 'cairo' }).set(auth(tokenFor(user))).expect(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('limits each user to 60 calls per 10 minutes', async () =>
    {
        const app = await getApp();
        const [user, other] = [await makeUser(), await makeUser()];
        fetchMock.mockImplementation(() => reply({ success: true, data: [] }));
        for (let i = 0; i < 60; i++)
        {
            await request(app).get(`${API}/geo/search`).query({ query: 'cairo' }).set(auth(tokenFor(user))).expect(200);
        }
        const limited = await request(app).get(`${API}/geo/search`).query({ query: 'cairo' }).set(auth(tokenFor(user)));
        expect(limited.status).toBe(429);
        expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
        // another user is not affected
        await request(app).get(`${API}/geo/search`).query({ query: 'cairo' }).set(auth(tokenFor(other))).expect(200);
    });
});
