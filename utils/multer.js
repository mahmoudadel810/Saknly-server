import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../middelWares/errorMiddleware.js';
import sharp from 'sharp';
import { promisify } from 'util';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Enable memory storage for processing
const memoryStorage = multer.memoryStorage();

// Process image with sharp - more aggressive compression for Vercel
const processImage = async (buffer) => {
  return sharp(buffer)
    .resize({
      width: 800, // Reduced from 1200
      height: 600, // Reduced from 800
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ 
      quality: 70, // Reduced from 80
      progressive: true,
      optimizeScans: true,
      mozjpeg: true // Better compression
    })
    .withMetadata()
    .toBuffer();
};

export const allowedMimeTypes = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'],
  file: [
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ],
  video: [
    'video/mp4', 
    'video/quicktime', 
    'video/x-matroska', 
    'video/webm'
  ],
};

// Create optimized storage engine
const createOptimizedStorage = (folder = 'saknly') => {
  return {
    _handleFile: async (req, file, cb) => {
      try {
        // Process only images
        if (file.mimetype.startsWith('image/')) {
          const processedBuffer = await processImage(file.buffer);
          file.buffer = processedBuffer;
        }
        
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: 'auto',
              quality: 'auto:low', // More aggressive compression
              fetch_format: 'auto',
              eager: [
                { width: 600, crop: 'scale' }, // Reduced sizes
                { width: 300, crop: 'scale' }
              ]
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          
          uploadStream.end(file.buffer);
        });
        
        cb(null, {
          path: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          width: uploadResult.width,
          height: uploadResult.height
        });
      } catch (error) {
        cb(error);
      }
    },
    
    _removeFile: (req, file, cb) => {
      if (file.public_id) {
        cloudinary.uploader.destroy(file.public_id);
      }
      cb(null);
    }
  };
};

export function createUploader(customValidation = allowedMimeTypes.image) {
  // Create file filter with better error handling
  const fileFilter = (req, file, cb) => {
    if (customValidation.includes(file.mimetype)) {
      return cb(null, true);
    }
    
    const error = new AppError(
      `Invalid file type. Allowed types: ${customValidation.join(', ')}`,
      400
    );
    return cb(error, false);
  };

  // Create multer instance with Vercel-optimized settings
  return multer({
    storage: createOptimizedStorage(),
    fileFilter,
    limits: {
      fileSize: 4 * 1024 * 1024, // 4MB limit (under Vercel's 4.5MB limit)
      files: 8, // Reduced from 10 to 8 files
      fieldSize: 2 * 1024 * 1024, // 2MB for text fields
    },
    preservePath: true
  });
}

// Export the default uploader with image validation
export const upload = createUploader(allowedMimeTypes.image);

// Export specific uploaders for different file types
export const uploadFiles = createUploader([...allowedMimeTypes.file, ...allowedMimeTypes.image]);

export const uploadVideos = createUploader(allowedMimeTypes.video);

export const uploadAll = createUploader([
  ...allowedMimeTypes.image,
  ...allowedMimeTypes.file,
  ...allowedMimeTypes.video
]);

// Helper function to clean up uploaded files on error
export const cleanupUploads = (req) => {
  if (!req.files) return;
  
  const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
  
  files.forEach(file => {
    if (file.public_id) {
      cloudinary.uploader.destroy(file.public_id).catch(console.error);
    }
  });
};

export default {
  upload,
  uploadFiles,
  uploadVideos,
  uploadAll,
  cleanupUploads,
  allowedMimeTypes
};
