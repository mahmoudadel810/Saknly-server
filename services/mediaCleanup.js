import { deleteMediaAssets } from './cloudinary.js';
import { publishMediaJob } from './queue/publisher.js';

// Deletes stored media ({publicId, url} items) from Cloudinary. Queued for the media workers when
// RabbitMQ is configured; inline (as before) when the queue is off or the publish fails.
// Inline failures throw, so callers keep their own best-effort handling.
export const removeMedia = async (assets = [], reason = '') =>
{
    const items = assets
        .filter(asset => asset?.publicId)
        .map(({ publicId, url }) => ({ publicId, ...(url && { url }) }));
    if (items.length === 0) return;

    if (await publishMediaJob('media.delete', { assets: items, reason })) return;
    await deleteMediaAssets(items);
};
