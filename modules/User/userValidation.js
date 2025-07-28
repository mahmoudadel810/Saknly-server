import joi from 'joi';

//=========================registerUserValidator====================================
export const registerUserValidator = {
    body: joi.object({
        userName: joi.string()
            .required()
            .trim()
            .min(3)
            .max(30)
            .messages({
                'string.empty': 'Username is required',
                'any.required': 'Username is required',
                'string.min': 'Username must be at least 3 characters',
                'string.max': 'Username cannot exceed 30 characters',
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

        password: joi.string()
            .required()
            .min(6)
            .messages({
                'string.empty': 'Password is required',
                'any.required': 'Password is required',
                'string.min': 'Password must be at least 6 characters',
            }),

        phone: joi.string()
            .required()
            .pattern(/^[\+]?[1-9][\d]{0,15}$/)
            .messages({
                'string.empty': 'Phone number is required',
                'any.required': 'Phone number is required',
                'string.pattern.base': 'Please enter a valid phone number',
            }),

        address: joi.string()
            .required()
            .messages({
                'string.empty': 'Address is required',
                'any.required': 'Address is required',
            }),
    })
};

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
            .pattern(/^[\+]?[1-9][\d]{0,15}$/)
            .messages({
                'string.pattern.base': 'Please enter a valid phone number',
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