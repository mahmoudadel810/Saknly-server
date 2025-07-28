import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Path to the file to upload
 * @param {string} folder - Cloudinary folder name
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result
 */
export const uploadImage = async (filePath, folder = 'saknly', options = {}) =>
{
    try
    {
        const defaultOptions = {
            folder,
            resource_type: 'image',
            quality: 'auto',
            fetch_format: 'auto',
            ...options,
        };

        const result = await cloudinary.uploader.upload(filePath, defaultOptions);

        return {
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
        };
    } catch (error)
    {
        throw new Error(`Image upload failed: ${error.message}`);
    }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of file paths
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleImages = async (files, folder = 'saknly/properties') =>
{
    try
    {
        const uploadPromises = files.map((file, index) =>
            uploadImage(file.tempFilePath, folder, {
                public_id: `${Date.now()}_${index}`,
            })
        );

        return await Promise.all(uploadPromises);
    } catch (error)
    {
        throw new Error(`Multiple image upload failed: ${error.message}`);
    }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Public ID of the image to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImage = async (publicId) =>
{
    try
    {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error)
    {
        throw new Error(`Image deletion failed: ${error.message}`);
    }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array} publicIds - Array of public IDs to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deleteMultipleImages = async (publicIds) =>
{
    try
    {
        const result = await cloudinary.api.delete_resources(publicIds);
        return result;
    } catch (error)
    {
        throw new Error(`Multiple image deletion failed: ${error.message}`);
    }
};

/**
 * Generate optimized image URL
 * @param {string} publicId - Public ID of the image
 * @param {Object} transformations - Image transformations
 * @returns {string} Optimized image URL
 */
export const getOptimizedImageUrl = (publicId, transformations = {}) =>
{
    const defaultTransformations = {
        quality: 'auto',
        fetch_format: 'auto',
        ...transformations,
    };

    return cloudinary.url(publicId, defaultTransformations);
};

export default cloudinary; 