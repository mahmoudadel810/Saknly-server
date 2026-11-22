import os from 'node:os';
import { deleteMediaAssets } from '../services/cloudinary.js';
import { PermanentJobError } from '../services/queue/consumer.js';
import logger from '../utils/logger.js';

// Consumes media.cleanup. Run several worker replicas and they share this queue (competing consumers);
// prefetch keeps each one from taking more than it can handle. Deleting an already-deleted
// asset is harmless, so a redelivered job needs no duplicate guard.
export const handleMediaJob = async (payload, { queue }) =>
{
    const assets = payload.data?.assets;
    if (!Array.isArray(assets) || assets.length === 0) throw new PermanentJobError('media job without assets');

    await deleteMediaAssets(assets);
    logger.info(`[${queue}] ${os.hostname()} deleted ${assets.length} asset(s)${payload.data.reason ? ` (${payload.data.reason})` : ''}`);
};
