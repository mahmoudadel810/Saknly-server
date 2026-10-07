import { AppError } from './errorMiddleware.js';

// schema shape: { body?, params?, query?, headers?, file?, files? } - each a Joi schema
export const validation = (schema) =>
{
    return (req, res, next) =>
    {
        let validationErrorsArr = [];
        const requestKeys = ["body", "params", "query", "headers", "file", "files"];

        for (const key of requestKeys)
        {
            if (schema[key])
            {
                const validationResult = schema[key].validate(req[key], {
                    abortEarly: false
                });

                if (validationResult?.error?.details)
                {
                    validationErrorsArr.push(...validationResult.error.details);
                }
                else if (key === 'body' && validationResult.value !== undefined)
                {
                    // Use the converted value (multipart strings -> numbers/booleans, JSON strings -> objects)
                    // req.query/params are left untouched (req.query is a read-only getter in Express 5)
                    req.body = validationResult.value;
                }
            }
        }
        //validation errors
        if (validationErrorsArr.length)
        {
            const errorMessages = validationErrorsArr.map(error => error.message).join(', ');
            return next(new AppError(`Validation failed: ${errorMessages}`, 400));
        }

        return next();
    };
};
