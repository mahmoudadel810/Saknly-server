import { check } from 'express-validator';

export const createInquiryValidator = [
  check('propertyId')
    .notEmpty()
    .withMessage('Property ID is required')
    .isMongoId()
    .withMessage('Invalid property ID format'),

  check('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  check('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),

  check('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/)
    .withMessage('Invalid phone number format'),

  check('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Message must be between 10 and 500 characters'),
];

export const updateInquiryStatusValidator = [
  check('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['new', 'in-progress', 'responded', 'closed'])
    .withMessage('Status must be one of: new, in-progress, responded, closed'),
];
