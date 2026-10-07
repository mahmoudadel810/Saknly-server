import { describe, it, expect } from 'vitest';
import request from 'supertest';
import sendEmail from '../services/sendEmail.js';
import Property from '../Model/PropertyModel.js';
import Comment from '../Model/CommentModel.js';
import PropertyInquiry from '../Model/PropertyInquiryModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, makeProperty, tokenFor, auth } from './helpers/factories.js';

// A listing with one comment and one inquiry on it, plus an unrelated listing with its own
const seed = async () =>
{
    const owner = await makeUser();
    const commenter = await makeUser();
    const target = await makeProperty(owner);
    const unrelated = await makeProperty(owner);
    for (const p of [target, unrelated])
    {
        await Comment.create({ property: p._id, user: commenter._id, text: `comment on ${p.title}` });
        const inquiry = await PropertyInquiry.create({ property: p._id, name: 'Visitor', email: 'v@example.test', phone: '01022222222', message: 'Is this available?', agent: owner._id });
        await Property.updateOne({ _id: p._id }, { $push: { inquiries: inquiry._id } });
    }
    return { owner, target, unrelated };
};

const expectOnlyUnrelatedLeft = async (target, unrelated) =>
{
    expect(await Property.exists({ _id: target._id })).toBeNull();
    expect(await Comment.countDocuments({ property: target._id })).toBe(0);
    expect(await PropertyInquiry.countDocuments({ property: target._id })).toBe(0);
    expect(await Comment.countDocuments({ property: unrelated._id })).toBe(1);
    expect(await PropertyInquiry.countDocuments({ property: unrelated._id })).toBe(1);
};

describe('property delete cascade (M8)', () =>
{
    it('owner delete removes the listing comments and inquiries', async () =>
    {
        const app = await getApp();
        const { owner, target, unrelated } = await seed();
        await request(app).delete(`${API}/properties/deleteProperty/${target._id}`).set(auth(tokenFor(owner))).expect(200);
        await expectOnlyUnrelatedLeft(target, unrelated);
    });

    it('deny (currently a hard delete) cascades the same way and emails the escaped reason', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const { target, unrelated } = await seed();
        const res = await request(app).delete(`${API}/properties/${target._id}/deny?reason=${encodeURIComponent('<b>blurry</b> photos')}`)
            .set(auth(tokenFor(admin)));
        expect(res.status).toBe(200);
        await expectOnlyUnrelatedLeft(target, unrelated);

        const mail = sendEmail.mock.calls.at(-1)[0];
        expect(mail.message).toContain('&lt;b&gt;blurry&lt;/b&gt; photos');
        expect(mail.message).not.toContain('<b>blurry</b>');
    });

    it('deleting an inquiry pulls it from Property.inquiries', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const { target } = await seed();
        const [inquiryId] = (await Property.findById(target._id)).inquiries;

        await request(app).delete(`${API}/property-inquiry/delete-property-inquiry/${inquiryId}`).set(auth(tokenFor(admin))).expect(200);
        const stored = await Property.findById(target._id);
        expect(stored.inquiries).toHaveLength(0);
        expect(stored.inquiriesCount).toBe(0);
    });
});
