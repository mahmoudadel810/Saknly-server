import joi from "joi";


//---------------------------------registerValidator----------------------------------

export const registerValidator = {
    body: joi.object({
        firstName : joi.string(),
        lastName : joi.string(),
        userName: joi.string().required().messages({
            "string.base": "your name must be string",
            "any.required": "please enter your name"
        }),
        email: joi.string()
            .email({
                maxDomainSegments: 2, // allowed dots in email .. ex dola.com.net نقطتين فقط
                tlds: { allow: ["com", "net"] }
            })
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
            .pattern(/^[\+]?[0-9]{10,15}$/)
            .messages({
                "string.pattern.base": "Please enter a valid phone number"
            }),
        address: joi.string().required().messages({
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
                .email({
                    maxDomainSegments: 3,
                    tlds: { allow: ["com", "net"] }
                })
                .required()
                .messages({
                    "string.email": "please enter a valid format eg .. [ .Com , .net ]"
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
        code: joi.string().required().messages({
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