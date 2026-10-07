import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeProperty, tokenFor, auth } from './helpers/factories.js';

const IMAGE = { publicId: 'saknly/photo', url: 'https://res.cloudinary.com/demo/image/upload/v1/saknly/photo.jpg', isMain: true };
const VIDEO = { publicId: 'saknly/tour', url: 'https://res.cloudinary.com/demo/video/upload/v1/saknly/tour.mp4', isMain: false };

const deletedByType = () =>
{
    const byType = {};
    for (const [ids, options] of cloudinary.api.delete_resources.mock.calls)
    {
        (byType[options.resource_type] ??= []).push(...ids);
    }
    return byType;
};

describe('Cloudinary video assets are deleted as videos', () =>
{
    it('property delete removes images and videos with their own resource_type', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const property = await makeProperty(owner, { images: [IMAGE, VIDEO] });

        await request(app).delete(`${API}/properties/deleteProperty/${property._id}`).set(auth(tokenFor(owner))).expect(200);
        expect(deletedByType()).toEqual({ image: [IMAGE.publicId], video: [VIDEO.publicId] });
    });

    it('removing a video from a listing deletes it as a video', async () =>
    {
        const app = await getApp();
        const owner = await makeUser();
        const property = await makeProperty(owner, { images: [IMAGE, VIDEO] });

        await request(app).put(`${API}/properties/updateProperty/${property._id}`).set(auth(tokenFor(owner)))
            .send({ imagesToDelete: [VIDEO.publicId] }).expect(200);
        expect(deletedByType()).toEqual({ video: [VIDEO.publicId] });
    });

    it('a video uploaded by a request that then fails is destroyed as a video', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        cloudinary.uploader.upload_stream.mockImplementationOnce((options, cb) => ({
            end: () => cb(null, {
                secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/saknly/up.mp4',
                public_id: 'saknly/up',
                resource_type: 'video',
                format: 'mp4',
                bytes: 4,
            }),
        }));

        // Missing required fields -> Joi 400 after the upload ran
        const res = await request(app).post(`${API}/properties/addProperty`).set(auth(tokenFor(user)))
            .field('category', 'rent')
            .attach('video', Buffer.from('fake'), { filename: 'tour.mp4', contentType: 'video/mp4' });
        expect(res.status).toBe(400);
        expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('saknly/up', expect.objectContaining({ resource_type: 'video' }));
    });
});
