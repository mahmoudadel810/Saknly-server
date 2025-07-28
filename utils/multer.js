import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import { AppError } from '../middelWares/errorMiddleware.js';

export const allowedMimeTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    file: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    video: ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'],
};

// Configure Cloudinary
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export function createUploader(customValidation = allowedMimeTypes.image)
{
    // Create storage engine
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary.v2,
        params: {
            folder: 'saknly',
            resource_type: 'auto'
        }
    });

    // Create file filter
    function fileFilter(req, file, cb)
    {
        if (customValidation.includes(file.mimetype))
        {
            cb(null, true);
        } else
        {
            cb(new AppError('Invalid file format. Please upload a valid file.', 400), false);
        }
    }

    // Create multer upload instance
    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 20 * 1024 * 1024 // 20MB limit
        }
    });

    return upload;
}

//may i use sharp for validation of the images or pdfs ?





