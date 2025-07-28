import joi from 'joi';

//=========================submitContactValidator====================================
export const contactValidator = {
    body: joi.object({
        name: joi.string()
            .required()
            .trim()
            .messages({
                'string.empty': 'Name is required',
                'any.required': 'Name is required',
            }),

        email: joi.string()
            .required()
            .email()
            .pattern(/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/)
            .messages({
                'string.empty': 'Email is required',
                'any.required': 'Email is required',
                'string.email': 'Please enter a valid email',
                'string.pattern.base': 'Please enter a valid email',
            }),

        subject: joi.string()
            .required()
            .max(100)
            .messages({
                'string.empty': 'Subject is required',
                'any.required': 'Subject is required',
                'string.max': 'Subject must be less than 100 characters',
            }),

        message: joi.string()
            .required()
            .messages({
                'string.empty': 'Message is required',
                'any.required': 'Message is required',
            }),

        status: joi.string()
            .valid('pending', 'in-progress', 'closed')
            .default('pending')
            .messages({
                'any.only': 'Status must be one of [pending, in-progress, closed]',
            }),
    })
};

//=========================updateStatusValidator====================================
export const updateStatusValidator = {
    body: joi.object({
        status: joi.string()
            .valid('pending', 'in-progress', 'closed')
            .required()
            .messages({
                'any.only': 'Status must be one of [pending, in-progress, closed]',
                'any.required': 'Status is required',
            }),
    }),
    params: joi.object({
        id: joi.string()
            .required()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'any.required': 'Message ID is required',
                'string.pattern.base': 'Message ID is invalid',
            })
    })
};

//=========================deleteContactValidator====================================
export const deleteContactValidator = {
    params: joi.object({
        id: joi.string()
            .required()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'any.required': 'Message ID is required',
                'string.pattern.base': 'Message ID is invalid',
            })
    })
};