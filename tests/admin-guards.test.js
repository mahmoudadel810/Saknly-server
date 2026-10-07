import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, tokenFor, auth, newId } from './helpers/factories.js';

const id = newId();

// Every admin-only route: anonymous -> 401, user -> 403, admin -> anything but 401/403
const ADMIN_ROUTES = [
    ['get', '/users/get-all-users'],
    ['get', `/users/get-user/${id}`],
    ['put', `/users/update-user/${id}`],
    ['delete', `/users/delete-user/${id}`],
    ['get', '/admin/analytics'],
    ['get', '/properties/pending'],
    ['get', '/properties/getMostViewedProperties'],
    ['put', `/properties/${id}/approve`],
    ['delete', `/properties/${id}/deny`],
    ['get', '/property-inquiry/get-all-property-inquiries'],
    ['get', `/property-inquiry/get-property-inquiry-by-id/${id}`],
    ['put', `/property-inquiry/update-property-inquiry-status/${id}`, { status: 'closed' }],
    ['delete', `/property-inquiry/delete-property-inquiry/${id}`],
    ['get', '/property-inquiry/get-inquiry-stats'],
    ['get', '/agencies'],
    ['post', '/agencies', { name: 'Agency' }],
    ['put', `/agencies/${id}`, { name: 'Agency' }],
    ['delete', `/agencies/${id}`],
    ['patch', `/agencies/${id}/feature`],
    ['get', '/testimonial/all'],
    ['put', `/testimonial/${id}/status`, { status: 'approved' }],
    ['delete', `/testimonial/${id}`],
    ['get', '/contact/get-all-contacts'],
    ['put', `/contact/update-contact-status/${id}`, { status: 'closed' }],
    ['delete', `/contact/delete-contact/${id}`],
];

describe('admin-only routes', () =>
{
    it.each(ADMIN_ROUTES)('%s %s rejects anonymous callers and regular users', async (method, path, body) =>
    {
        const app = await getApp();
        const user = await makeUser();
        const admin = await makeAdmin();

        const anon = await request(app)[method](`${API}${path}`).send(body || {});
        expect(anon.status).toBe(401);

        const asUser = await request(app)[method](`${API}${path}`).set(auth(tokenFor(user))).send(body || {});
        expect(asUser.status).toBe(403);

        const asAdmin = await request(app)[method](`${API}${path}`).set(auth(tokenFor(admin))).send(body || {});
        expect([401, 403]).not.toContain(asAdmin.status);
        expect(asAdmin.status).toBeLessThan(500);
    });

    it('the user list is admin-only and paginated', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const res = await request(app).get(`${API}/users/get-all-users?limit=1000`).set(auth(tokenFor(admin)));
        expect(res.status).toBe(200);
        expect(res.body.pagination.itemsPerPage).toBe(100);
        expect(res.body.users.every(u => u.password === undefined)).toBe(true);
    });

    it('the removed public registration path under /users does not exist', async () =>
    {
        const app = await getApp();
        const res = await request(app).post(`${API}/users/register`).send({});
        expect(res.status).toBe(404);
    });
});
