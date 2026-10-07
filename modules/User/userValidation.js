import joi from 'joi';

//=========================updateUserValidator====================================
export const updateUserValidator = {
    body: joi.object({
        userName: joi.string()
            .trim()
            .min(3)
            .max(30)
            .messages({
                'string.min': 'Username must be at least 3 characters',
                'string.max': 'Username cannot exceed 30 characters',
            }),

        email: joi.string()
            .email()
            .pattern(/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/)
            .messages({
                'string.email': 'Please enter a valid email',
                'string.pattern.base': 'Please enter a valid email',
            }),

        phone: joi.string()
            .pattern(/^01[0-9]{9}$/)
            .messages({
                'string.pattern.base': 'Phone must be an Egyptian number: 11 digits starting with 01',
            }),

        address: joi.string(),

        role: joi.string()
            .valid('user', 'admin')
            .messages({
                'any.only': 'Role must be one of [user, admin]',
            }),

        status: joi.string()
            .valid('active', 'in-active')
            .messages({
                'any.only': 'Status must be one of [active, in-active]',
            }),
    }),
    params: joi.object({
        id: joi.string()
            .required()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'any.required': 'User ID is required',
                'string.pattern.base': 'User ID is invalid',
            })
    })
};

//=========================deleteUserValidator====================================
export const deleteUserValidator = {
    params: joi.object({
        id: joi.string()
            .required()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'any.required': 'User ID is required',
                'string.pattern.base': 'User ID is invalid',
            })
    })
};