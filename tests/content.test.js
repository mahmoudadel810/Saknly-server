import { describe, it, expect } from 'vitest';
import request from 'supertest';
import sendEmail from '../services/sendEmail.js';
import PropertyInquiry from '../Model/PropertyInquiryModel.js';
import Testimonial from '../Model/TestimonialModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, makeProperty, makePendingProperty, tokenFor, auth } from './helpers/factories.js';

describe('comments', () =>
{
    it('require auth, a public property and a sane length; reads expose no email', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const user = await makeUser();
        const token = tokenFor(user);
        const pub = await makeProperty(owner);
        const pending = await makePendingProperty(owner);
        const url = `${API}/property-comments/${pub._id}`;

        expect((await request(app).post(url).send({ text: 'hi' })).status).toBe(401);
        expect((await request(app).post(url).set(auth(token)).send({ text: '   ' })).status).toBe(400);
        expect((await request(app).post(url).set(auth(token)).send({ text: 'x'.repeat(1001) })).status).toBe(400);
        expect((await request(app).post(`${API}/property-comments/${pending._id}`).set(auth(token)).send({ text: 'hello' })).status).toBe(404);
        expect((await request(app).post(url).set(auth(token)).send({ text: 'Nice place' })).status).toBe(201);

        const list = await request(app).get(url);
        expect(list.body.data).toHaveLength(1);
        expect(list.body.data[0].user.userName).toBe(user.userName);
        expect(JSON.stringify(list.body)).not.toContain(user.email);
    });
});

describe('inquiries', () =>
{
    it('public create on public listings only, injected fields stripped, owner notified', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const admin = await makeAdmin();
        const pub = await makeProperty(owner);
        const pending = await makePendingProperty(owner);
        const body = { name: 'Visitor', email: 'v@example.test', phone: '01022222222', message: 'Is this still available?' };

        const res = await request(app).post(`${API}/property-inquiry/add-property-inquiry`)
            .send({ ...body, property: pub._id.toString(), status: 'closed', agent: admin._id.toString(), isRead: true });
        expect(res.status).toBe(201);
        const stored = await PropertyInquiry.findById(res.body.data._id);
        expect(stored.status).toBe('new');
        expect(stored.isRead).toBe(false);
        expect(stored.agent.toString()).toBe(owner._id.toString());
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: owner.email }));

        const onPending = await request(app).post(`${API}/property-inquiry/add-property-inquiry`).send({ ...body, property: pending._id.toString() });
        expect(onPending.status).toBe(400);

        const adminToken = tokenFor(admin);
        await request(app).get(`${API}/property-inquiry/get-property-inquiry-by-id/${stored._id}`).set(auth(adminToken)).expect(200);
        expect((await PropertyInquiry.findById(stored._id)).isRead).toBe(true);
        expect((await request(app).put(`${API}/property-inquiry/update-property-inquiry-status/${stored._id}`).set(auth(adminToken)).send({ status: 'bogus' })).status).toBe(400);
    });
});

describe('testimonials', () =>
{
    it('are moderated: created pending, public sees approved only', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const user = await makeUser();
        const created = await request(app).post(`${API}/testimonial`).send({ name: 'Sara', text: 'Great service', type: 'general', status: 'approved' });
        expect(created.status).toBe(201);
        expect(created.body.data.status).toBe('pending');

        expect((await request(app).get(`${API}/testimonial`)).body.data).toHaveLength(0);
        await request(app).put(`${API}/testimonial/${created.body.data._id}/status`).set(auth(tokenFor(admin))).send({ status: 'approved' }).expect(200);
        expect((await request(app).get(`${API}/testimonial`)).body.data).toHaveLength(1);

        await Testimonial.create({ name: 'Other', text: 'Pending one', type: 'general' });
        const sneaky = await request(app).get(`${API}/testimonial?status=pending`).set(auth(tokenFor(user)));
        expect(sneaky.body.data.every(t => t.status === 'approved')).toBe(true);
    });
});

describe('error handling', () =>
{
    it('unknown routes and malformed JSON give JSON errors without stacks', async () =>
    {
        const app = await getApp();
        const missing = await request(app).get(`${API}/nope`);
        expect(missing.status).toBe(404);
        expect(missing.body.stack).toBeNull();

        const malformed = await request(app).post(`${API}/auth/login`).set('Content-Type', 'application/json').send('{"email":');
        expect(malformed.status).toBe(400);
        expect(malformed.body.stack).toBeNull();
    });
});
