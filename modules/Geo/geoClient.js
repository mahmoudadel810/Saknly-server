// GeoLink (https://geolink-eg.com): place search and reverse geocoding for Egypt. The API key is
// billed per request and must stay private, so the apps call these through the server and never
// see it. GEOLINK_BASE_URL lets the local test server point at a fake.
const BASE_URL = () => (process.env.GEOLINK_BASE_URL || 'https://geolink-eg.com/api/v2').replace(/\/$/, '');
const TIMEOUT_MS = 8000;

export class GeoUnavailableError extends Error {}

/** One GeoLink call; throws GeoUnavailableError for a missing key, a failure or a timeout. */
const call = async (endpoint, params) =>
{
    const key = process.env.GEOLINK_API_KEY;
    if (!key) throw new GeoUnavailableError('GEOLINK_API_KEY is not set');

    const url = new URL(`${BASE_URL()}/${endpoint}`);
    Object.entries({ ...params, key }).forEach(([name, value]) =>
    {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    });

    let response;
    try
    {
        response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    }
    catch (error)
    {
        throw new GeoUnavailableError(`GeoLink ${endpoint} unreachable: ${error.message}`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success)
    {
        // The error text can echo request details; never the key, which is only in the URL.
        throw new GeoUnavailableError(`GeoLink ${endpoint} failed (${response.status}): ${body?.error || 'no body'}`);
    }
    return body.data;
};

/** A GeoLink result as the apps use it: a name, the full address, the pin and the area names. */
const toPlace = (item) => ({
    name: item?.short_address || '',
    address: item?.address || '',
    latitude: item?.location?.lat,
    longitude: item?.location?.lng,
    governorate: item?.address_parts?.governorate || '',
    district: item?.address_parts?.district || '',
});

const isPlace = (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

export const searchPlaces = async ({ query, latitude, longitude, language }) =>
{
    const data = await call('text_search', { query, latitude, longitude, language, country: 'eg', max_results: 8 });
    return (Array.isArray(data) ? data : []).map(toPlace).filter(isPlace);
};

export const reverseGeocode = async ({ latitude, longitude, language }) =>
{
    const place = toPlace(await call('reverse_geocode', { latitude, longitude, language, country: 'eg' }));
    return isPlace(place) ? place : null;
};
