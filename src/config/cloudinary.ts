import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage (we'll upload to cloudinary manually)
const storage = multer.memoryStorage();

// Create multer upload middleware
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

// Upload any file type (no filter), still using memory storage
export const uploadAny = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for attachments
  },
});

// Utility function to upload buffer to cloudinary
export const uploadToCloudinary = async (
  buffer: Buffer,
  folder: string,
  filename?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        {
          width: 1000,
          height: 1000,
          crop: 'limit',
          quality: 'auto:good',
          fetch_format: 'auto',
        },
      ],
    };

    if (filename) {
      uploadOptions.public_id = filename;
    }

    cloudinary.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result?.secure_url || '');
        }
      })
      .end(buffer);
  });
};

// Upload generic attachment (images, pdfs, docs, zips...) with resource_type auto
export const uploadToCloudinaryGeneric = async (
  buffer: Buffer,
  folder: string,
  filename?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder: folder,
      resource_type: 'auto',
      overwrite: true,
    };

    // If filename provided, use it without extension (Cloudinary adds it automatically)
    if (filename) {
      // Remove file extension from filename
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      uploadOptions.public_id = nameWithoutExt;
    }

    cloudinary.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result?.secure_url || '');
        }
      })
      .end(buffer);
  });
};

// Export cloudinary instance
export default cloudinary;
