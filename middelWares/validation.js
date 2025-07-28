import { AppError } from './errorMiddleware.js';

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