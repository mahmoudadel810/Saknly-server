import joi from 'joi';

const objectId = () => joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/);

export const createInquiryValidator = {
  body: joi.object({
    property: objectId().required().messages({
      'any.required': 'Property ID is required',
      'string.empty': 'Property ID is required',
      'string.pattern.base': 'Invalid property ID format',
    }),
    name: joi.string().trim().min(2).max(50).required().messages({
      'any.required': 'Name is required',
      'string.empty': 'Name is required',
      'string.min': 'Name must be between 2 and 50 characters',
      'string.max': 'Name must be between 2 and 50 characters',
    }),
    email: joi.string().trim().email({ tlds: { allow: false } }).required().messages({
      'any.required': 'Email is required',
      'string.empty': 'Email is required',
      'string.email': 'Invalid email format',
    }),
    phone: joi.string().trim().max(30).pattern(/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/).required().messages({
      'any.required': 'Phone number is required',
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Invalid phone number format',
    }),
    message: joi.string().trim().min(10).max(500).required().messages({
      'any.required': 'Message is required',
      'string.empty': 'Message is required',
      'string.min': 'Message must be between 10 and 500 characters',
      'string.max': 'Message must be between 10 and 500 characters',
    }),
  }).options({ stripUnknown: true }),
};

export const updateInquiryStatusValidator = {
  body: joi.object({
    status: joi.string().valid('new', 'in-progress', 'responded', 'closed').required().messages({
      'any.required': 'Status is required',
      'any.only': 'Status must be one of: new, in-progress, responded, closed',
    }),
  }),
};
