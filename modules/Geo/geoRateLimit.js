import { AppError } from '../../middelWares/errorMiddleware.js';

// Each GeoLink call is billed, so one account can't run up the bill through the apps: at most
// LIMIT calls per user in each WINDOW. In memory, so per server instance: it stops a runaway app
// or a scripted loop, not a determined attacker spread over many instances.
const LIMIT = 60;
const WINDOW_MS = 10 * 60 * 1000;
const counts = new Map();

export const geoRateLimit = (req, res, next) =>
{
    const now = Date.now();
    const id = String(req.user._id);
    const entry = counts.get(id);
    if (!entry || now - entry.start >= WINDOW_MS)
    {
        counts.set(id, { start: now, count: 1 });
        if (counts.size > 10_000) for (const [key, value] of counts) if (now - value.start >= WINDOW_MS) counts.delete(key);
        return next();
    }
    if (entry.count >= LIMIT)
    {
        res.set('Retry-After', String(Math.ceil((entry.start + WINDOW_MS - now) / 1000)));
        return next(new AppError('Too many location searches. Try again in a few minutes', 429));
    }
    entry.count += 1;
    return next();
};

/** Tests only. */
export const resetGeoRateLimit = () => counts.clear();
