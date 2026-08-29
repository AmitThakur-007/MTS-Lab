import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../config/supabase';

if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true,
  });
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string = 'mts_lab',
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload failed'));
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export async function uploadBase64ToCloudinary(
  base64Data: string,
  folder: string = 'mts_lab'
): Promise<UploadApiResponse> {
  return cloudinary.uploader.upload(base64Data, {
    folder,
    resource_type: 'auto',
  });
}
