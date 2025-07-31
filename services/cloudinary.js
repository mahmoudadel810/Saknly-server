import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required Cloudinary environment variables: ${missingVars.join(', ')}`);
}

// Configure Cloudinary with optimizations
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  cdn_subdomain: true,
  secure_distribution: true,
  private_cdn: false,
  cname: process.env.CLOUDINARY_CNAME || undefined
});

// Cache for transformed images
const transformCache = new Map();

// Default transformation options
const defaultTransformations = {
  quality: 'auto:good',
  fetch_format: 'auto',
  dpr: 'auto',
  responsive: true,
  crop: 'limit'
};

/**
 * Upload image to Cloudinary with optimizations
 * @param {string|Buffer} file - Path to the file or buffer to upload
 * @param {string} [folder='saknly'] - Cloudinary folder name
 * @param {Object} [options={}] - Additional upload options
 * @returns {Promise<Object>} Upload result
 */
export const uploadImage = async (file, folder = 'saknly', options = {}) => {
  try {
    const uploadOptions = {
      folder,
      resource_type: 'image',
      ...defaultTransformations,
      ...options,
      eager: [
        { width: 400, crop: 'scale' },
        { width: 800, crop: 'scale' },
        ...(options.eager || [])
      ],
      eager_async: true
    };

    const result = await cloudinary.uploader.upload(file, uploadOptions);

    return {
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      responsive_breakpoints: result.responsive_breakpoints,
      eager: result.eager
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary with concurrency control
 * @param {Array<string|Buffer>} files - Array of file paths or buffers
 * @param {string} [folder='saknly'] - Cloudinary folder name
 * @param {Object} [options={}] - Additional upload options
 * @param {number} [concurrency=3] - Maximum concurrent uploads
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleImages = async (
  files,
  folder = 'saknly',
  options = {},
  concurrency = 3
) => {
  try {
    const results = [];
    const queue = [...files];
    
    // Process uploads in batches
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map(file => 
          uploadImage(file, folder, options)
            .catch(error => ({
              error: error.message,
              file: typeof file === 'string' ? file : 'buffer'
            }))
        )
      );
      results.push(...batchResults);
    }

    // Check for any failed uploads
    const failedUploads = results.filter(r => r.error);
    if (failedUploads.length > 0) {
      console.error('Some uploads failed:', failedUploads);
      if (failedUploads.length === results.length) {
        throw new Error('All uploads failed');
      }
    }

    return results.filter(r => !r.error);
  } catch (error) {
    console.error('Multiple uploads failed:', error);
    throw new Error(`Failed to upload multiple images: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary with retry logic
 * @param {string} publicId - Public ID of the image to delete
 * @param {Object} [options={}] - Additional delete options
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImage = async (publicId, options = {}) => {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        ...options
      });
      
      if (result.result === 'ok') {
        // Invalidate CDN cache
        if (options.invalidate !== false) {
          await cloudinary.uploader.explicit(publicId, { 
            type: 'upload',
            invalidate: true 
          });
        }
        return result;
      }
      
      throw new Error(`Delete failed: ${result.result}`);
      
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }
  
  throw new Error(`Failed to delete image after ${maxRetries} attempts: ${lastError.message}`);
};

/**
 * Delete multiple images from Cloudinary with batching
 * @param {Array<string>} publicIds - Array of public IDs to delete
 * @param {Object} [options={}] - Additional delete options
 * @param {number} [batchSize=100] - Number of IDs to process per batch
 * @returns {Promise<Array>} Array of deletion results
 */
export const deleteMultipleImages = async (
  publicIds,
  options = {},
  batchSize = 100
) => {
  try {
    const results = [];
    
    // Process in batches to avoid hitting API limits
    for (let i = 0; i < publicIds.length; i += batchSize) {
      const batch = publicIds.slice(i, i + batchSize);
      const result = await cloudinary.api.delete_resources(batch, {
        ...options,
        type: 'upload',
        resource_type: 'image'
      });
      
      // Invalidate CDN cache for the batch
      if (options.invalidate !== false) {
        await Promise.all(
          batch.map(id => 
            cloudinary.uploader.explicit(id, { 
              type: 'upload',
              invalidate: true 
            }).catch(console.error)
          )
        );
      }
      
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Batch delete failed:', error);
    throw new Error(`Failed to delete multiple images: ${error.message}`);
  }
};

/**
 * Generate optimized image URL with caching
 * @param {string} publicId - Public ID of the image
 * @param {Object} [transformations={}] - Image transformations
 * @param {boolean} [useCache=true] - Whether to use transform cache
 * @returns {string} Optimized image URL
 */
export const getOptimizedImageUrl = (
  publicId,
  transformations = {},
  useCache = true
) => {
  try {
    const cacheKey = `${publicId}-${JSON.stringify(transformations)}`;
    
    // Return cached URL if available
    if (useCache && transformCache.has(cacheKey)) {
      return transformCache.get(cacheKey);
    }
    
    const url = cloudinary.url(publicId, {
      ...defaultTransformations,
      ...transformations,
      secure: true,
      sign_url: true,
      type: 'upload'
    });
    
    // Cache the URL
    if (useCache) {
      transformCache.set(cacheKey, url);
    }
    
    return url;
  } catch (error) {
    console.error('URL generation failed:', error);
    throw new Error(`Failed to generate image URL: ${error.message}`);
  }
};

/**
 * Get responsive image URLs with srcset
 * @param {string} publicId - Public ID of the image
 * @param {Array<number>} [widths=[400, 800, 1200]] - Array of widths for srcset
 * @returns {Object} Object with src and srcset strings
 */
export const getResponsiveImage = (
  publicId,
  widths = [400, 800, 1200]
) => {
  const src = getOptimizedImageUrl(publicId, { width: Math.max(...widths) });
  
  const srcset = widths
    .sort((a, b) => a - b)
    .map(width => {
      const url = getOptimizedImageUrl(publicId, { width, crop: 'scale' });
      return `${url} ${width}w`;
    })
    .join(', ');
  
  return { src, srcset };
};

// Export the configured cloudinary instance
export default cloudinary;