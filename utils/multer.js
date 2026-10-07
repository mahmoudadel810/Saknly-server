import multer from 'multer';
import cloudinary from '../services/cloudinary.js';
import { AppError } from '../middelWares/errorMiddleware.js';
import sharp from 'sharp';

// Note: Vercel serverless functions reject request bodies larger than ~4.5MB in total
// (all files + fields), regardless of the per-file limit below. The client compresses
// images before upload; very large multi-image uploads will get a 413 from the platform.

// Process image with sharp - aggressive compression for Vercel
const processImage = async (buffer) => {
  return sharp(buffer)
    .rotate() // apply EXIF orientation, then metadata (incl. GPS) is dropped
    .resize({
      width: 800,
      height: 600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ 
      quality: 70,
      progressive: true,
      optimizeScans: true,
      mozjpeg: true
    })
    .toBuffer();
};

// Multer custom storage engines receive file.stream (not file.buffer) - read it fully
const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(Buffer.concat(chunks)));
});

const uploadBufferToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder,
      resource_type: 'auto',
      quality: 'auto:low',
      fetch_format: 'auto',
    },
    (error, result) => {
      if (error) return reject(error);
      resolve(result);
    }
  );

  uploadStream.end(buffer);
});

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

// Storage engine: buffer the stream, compress images, upload to Cloudinary.
// Result fields merged onto req.file / req.files[i]: path (secure_url), public_id, format, bytes, width, height
const createOptimizedStorage = (folder = 'saknly') => {
  return {
    _handleFile: async (req, file, cb) => {
      try {
        let buffer = await streamToBuffer(file.stream);

        // Process only still images (sharp can't handle animated gifs well, keep them as-is)
        if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
          buffer = await processImage(buffer);
        }

        const uploadResult = await uploadBufferToCloudinary(buffer, folder);

        cb(null, {
          path: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          size: uploadResult.bytes,
          width: uploadResult.width,
          height: uploadResult.height
        });
      } catch (error) {
        cb(error);
      }
    },
    
    _removeFile: (req, file, cb) => {
      if (file.public_id) {
        Promise.resolve(cloudinary.uploader.destroy(file.public_id)).catch(() => { });
      }
      cb(null);
    }
  };
};

export function createUploader(customValidation = allowedMimeTypes.image) {
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

  return multer({
    storage: createOptimizedStorage(),
    fileFilter,
    limits: {
      fileSize: 4 * 1024 * 1024, // 4MB per file (Vercel caps the whole body at ~4.5MB)
      files: 8,
      fieldSize: 1 * 1024 * 1024, // 1MB for text fields
    },
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
  const files = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    files.push(...(Array.isArray(req.files) ? req.files : Object.values(req.files).flat()));
  }

  files.forEach(file => {
    if (file.public_id) {
      Promise.resolve(cloudinary.uploader.destroy(file.public_id)).catch(() => { });
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
