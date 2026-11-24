import joi from 'joi';

const language = joi.string().valid('ar', 'en').default('ar');
const latitude = joi.number().min(-90).max(90);
const longitude = joi.number().min(-180).max(180);

export const searchValidator = {
    query: joi.object({
        query: joi.string().trim().min(2).max(100).required(),
        // An optional point to rank nearby places first; both or neither.
        latitude,
        longitude,
        language,
    }).and('latitude', 'longitude'),
};

export const reverseValidator = {
    query: joi.object({
        latitude: latitude.required(),
        longitude: longitude.required(),
        language,
    }),
};
