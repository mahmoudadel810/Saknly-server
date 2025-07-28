import joi from 'joi';

export const addAgencyValidator = joi.object({
  body: joi.object({
    name: joi.string().trim().max(70).required().messages({
      'string.empty': 'اسم الوكالة مطلوب',
      'string.max': 'اسم الوكالة لا يزيد عن 70 حرف',
      'any.required': 'اسم الوكالة مطلوب'
    }),
    description: joi.string().trim().max(512).optional().messages({
      'string.max': 'الوصف لا يزيد عن 512 حرف'
    }),
    isFeatured: joi.boolean().optional(),
  }).options({ abortEarly: false, allowUnknown: false, stripUnknown: true })
});

export const updateAgencyValidator = joi.object({
  body: joi.object({
    name: joi.string().trim().max(70),
    description: joi.string().trim().max(512),
    isFeatured: joi.boolean(),
  }).options({ abortEarly: false, allowUnknown: false, stripUnknown: true })
});
