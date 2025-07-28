import joi from 'joi';

export const PropertyValidator = joi.object({
    body: joi.object({
        title: joi.string().trim().max(70).required(),
        description: joi.string().trim().max(4096).required(),
        type: joi.string().valid('apartment', 'house', 'villa', 'studio', 'penthouse', 'duplex', 'commercial', 'students').required(),
        price: joi.number().min(0).required(),
        area: joi.number().min(100).required(),
        bedrooms: joi.number().min(0).max(10).required(),
        bathrooms: joi.number().min(1).max(10).required(),
        floor: joi.number().min(0).optional(),
        totalFloors: joi.number().min(1).optional(),
        location: joi.object({
            address: joi.string().trim().required(),
            city: joi.string().trim().required(),
            district: joi.string().trim().optional(),
            latitude: joi.number().min(-90).max(90).optional(),
            longitude: joi.number().min(-180).max(180).optional(),
        }).required(),
        amenities: joi.array().items(joi.string()).optional(),
        contactInfo: joi.object({
            phone: joi.string().required(),
            email: joi.string().email().optional(),
            whatsapp: joi.string().optional(),
        }).optional(),
        isNegotiable: joi.boolean().default(false),
        isStudentFriendly: joi.boolean().default(false),
        category: joi.string().valid('sale', 'rent', 'student').required()
    }).messages({
        "object.unknown": "Unknown field detected in request body"
    }).options({ abortEarly: false, allowUnknown: false, stripUnknown: true })
});

