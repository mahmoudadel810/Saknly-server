import joi from "joi";


//---------------------------------registerValidator----------------------------------

export const registerValidator = {
    body: joi.object({
        firstName : joi.string().trim().max(20).allow(''),
        lastName : joi.string().trim().max(20).allow(''),
        userName: joi.string().trim().min(3).max(30).required().messages({
            "string.base": "your name must be string",
            "any.required": "please enter your name"
        }),
        email: joi.string()
            .trim()
            .email({ tlds: { allow: false } })
            .required()
            .messages({
                "string.email": "please enter a valid format"
            }),
        password: joi.string()
            .required()
            .min(5)
            .max(30)
            .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).*$/)
            .messages({
                "string.min": "password must contain at least 5 characters",
                "string.max": "password must contain 30 characters as maximum",
                "string.pattern.base": "password must contain at least 1 uppercase letter, 1 number, and a symbol"
            }),
        confirmPassword: joi.string().required().valid(joi.ref("password")).messages({
            "any.only": "confirmation password must match password .. Try again"
        }),
        phone: joi.string()
            .required()
            .pattern(/^01[0-9]{9}$/)
            .messages({
                "string.pattern.base": "الرجاء إدخال رقم هاتف صحيح مكون من 11 رقم يبدأ بـ 01"
            }),
        address: joi.string().trim().max(200).required().messages({
            "any.required": "please enter your address"
        }),
    })
};

//---------------------loginValidator-------------------–––--––--–––––––––––––––––––
export const loginValidator = {
    body: joi.object()
        .required()
        .keys({
            email: joi.string()
                .trim()
                .email({ tlds: { allow: false } })
                .required()
                .messages({
                    "string.email": "please enter a valid email"
                }),
            password: joi.string()
                .required()
                .min(5)
                .max(30)
                .messages({
                    "string.min": "password must contain at least 5 characters",
                    "string.max": "password must contain 30 characters as maximum",
                }),
        })
};

//======================================resetPassword-==========================

export const verifyResetValidator = {
    body: joi.object().keys({
        email: joi.string().trim().email({ tlds: { allow: false } }).required().messages({
            "string.email": "please enter a valid email",
            "any.required": "email is required"
        }),
        code: joi.string().trim().required().messages({
            "object.unknown": "Code Sent to your Gmail Does Not Match"
        }),
        newPassword: joi.string()
            .required()
            .min(5)
            .max(30)
            .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).*$/)
            .messages({
                "string.min": "Password must contain at least 5 characters",
                "string.max": "Password must contain 30 characters as maximum",
                "string.pattern.base": "Password must contain at least 1 uppercase letter, 1 number, and a symbol"
            }),
        confirmNewPassword: joi.string().required().valid(joi.ref("newPassword")).messages({
            "any.only": "Must Match New password "
        }),
    })
};

//=========================email only (forgot-password / resend-confirmation)====================================
export const emailOnlyValidator = {
    body: joi.object().keys({
        email: joi.string().trim().email({ tlds: { allow: false } }).required().messages({
            "string.email": "please enter a valid email",
            "any.required": "email is required"
        }),
    })
};

//=========================refreshTokenValidator====================================
export const refreshTokenValidator = {
    headers: joi.object().keys({
        authorization: joi.string()
            .required()
            .messages({
                "any.required": "Token is required in the Authorization header"
            })
    }).options({ allowUnknown: true })
};

//=========================logoutValidator====================================
export const logoutValidator = {
    headers: joi.object().keys({
        authorization: joi.string()
            .required()
            .messages({
                "any.required": "Token is required in the Authorization header"
            })
    }).options({ allowUnknown: true })
};