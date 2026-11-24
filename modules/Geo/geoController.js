import { asyncHandler, AppError } from '../../middelWares/errorMiddleware.js';
import logger from '../../utils/logger.js';
import { GeoUnavailableError, reverseGeocode, searchPlaces } from './geoClient.js';

const unavailable = (error, next) =>
{
    if (!(error instanceof GeoUnavailableError)) throw error;
    logger.warn(error.message);
    return next(new AppError('Location search is not available right now', 503));
};

// GET /geo/search?query=&latitude=&longitude=&language=
export const search = asyncHandler(async (req, res, next) =>
{
    try
    {
        const data = await searchPlaces(req.query);
        res.status(200).json({ success: true, data });
    }
    catch (error)
    {
        return unavailable(error, next);
    }
});

// GET /geo/reverse?latitude=&longitude=&language=
export const reverse = asyncHandler(async (req, res, next) =>
{
    try
    {
        const data = await reverseGeocode(req.query);
        if (!data) return next(new AppError('No address found for this location', 404));
        res.status(200).json({ success: true, data });
    }
    catch (error)
    {
        return unavailable(error, next);
    }
});
