import { describe, it, expect, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import { publishMediaJob } from '../services/queue/publisher.js';
import { removeMedia } from '../services/mediaCleanup.js';
import { handleMediaJob } from '../workers/mediaWorker.js';
import { PermanentJobError } from '../services/queue/consumer.js';

vi.mock('../services/queue/publisher.js', async (importOriginal) =>
{
    const actual = await importOriginal();
    return { ...actual, publishMediaJob: vi.fn(actual.publishMediaJob) };
});

const assets = [
    { publicId: 'saknly/a', url: 'https://res.cloudinary.test/demo/image/upload/a.jpg' },
    { publicId: 'saknly/v', url: 'https://res.cloudinary.test/demo/video/upload/v.mp4' },
];

describe('media cleanup', () =>
{
    it('queues the delete instead of calling Cloudinary when the broker confirms', async () =>
    {
        publishMediaJob.mockResolvedValueOnce(true);
        await removeMedia(assets, 'property removed');
        expect(publishMediaJob).toHaveBeenCalledWith('media.delete', { assets, reason: 'property removed' });
        expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
    });

    it('deletes inline when the queue is off', async () =>
    {
        await removeMedia([{ publicId: 'saknly/logo' }, { url: 'no-public-id' }]);
        expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['saknly/logo'], expect.objectContaining({ resource_type: 'image' }));
    });

    it('does nothing when there is nothing to delete', async () =>
    {
        await removeMedia([]);
        expect(publishMediaJob).not.toHaveBeenCalled();
    });

    it('worker deletes images and videos with the right resource type', async () =>
    {
        await handleMediaJob({ type: 'media.delete', data: { assets } }, { queue: 'media.cleanup' });
        expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['saknly/a'], expect.objectContaining({ resource_type: 'image' }));
        expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['saknly/v'], expect.objectContaining({ resource_type: 'video' }));
    });

    it('worker dead-letters a job without assets and lets Cloudinary errors retry', async () =>
    {
        await expect(handleMediaJob({ data: {} }, { queue: 'media.cleanup' })).rejects.toBeInstanceOf(PermanentJobError);

        cloudinary.api.delete_resources.mockRejectedValueOnce(new Error('rate limited'));
        const result = handleMediaJob({ data: { assets } }, { queue: 'media.cleanup' });
        await expect(result).rejects.toThrow('rate limited');
        await expect(result).rejects.not.toBeInstanceOf(PermanentJobError);
    });
});
