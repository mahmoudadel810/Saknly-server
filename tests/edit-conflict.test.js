import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import Property from '../Model/PropertyModel.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeProperty, tokenFor, auth } from './helpers/factories.js';

const IMG1 = { publicId: 'saknly/one', url: 'https://res.cloudinary.com/demo/image/upload/v1/saknly/one.jpg', isMain: true };
const IMG2 = { publicId: 'saknly/two', url: 'https://res.cloudinary.com/demo/image/upload/v1/saknly/two.jpg', isMain: false };

describe('concurrent edits of one listing', () =>
{
    it('the second edit is a 409 conflict, and no image the listing still uses is deleted', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const listing = await makeProperty(owner, { images: [IMG1, IMG2] });

        const res = await Promise.all([
            request(app).put(`${API}/properties/updateProperty/${listing._id}`).set(auth(tokenFor(owner))).send({ imagesToDelete: [IMG1.publicId] }),
            request(app).put(`${API}/properties/updateProperty/${listing._id}`).set(auth(tokenFor(owner))).send({ title: 'Edited at the same time' }),
        ]);

        expect(res.map(r => r.status).sort()).toEqual([200, 409]);
        expect(res.find(r => r.status === 409).body.message).toBe('This was changed by another request. Reload it and try again');

        const saved = await Property.findById(listing._id).lean();
        const deleted = cloudinary.api.delete_resources.mock.calls.flatMap(([ids]) => ids);
        expect(saved.images.filter(img => deleted.includes(img.publicId))).toEqual([]);
    });
});
