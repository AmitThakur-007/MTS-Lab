import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../config/supabase';

let isConfigured = false;

/**
 * Lazily configures Cloudinary SDK with latest environment variables
 */
export function ensureCloudinaryConfigured(): boolean {
  if (isConfigured) return true;

  const creds = config.getCloudinaryCredentials();
  if (creds.cldUrl) {
    cloudinary.config(true); // Auto-parses CLOUDINARY_URL
    isConfigured = true;
    return true;
  }

  if (creds.cloudName && creds.apiKey && creds.apiSecret) {
    cloudinary.config({
      cloud_name: creds.cloudName,
      api_key: creds.apiKey,
      api_secret: creds.apiSecret,
      secure: true,
    });
    isConfigured = true;
    return true;
  }

  return false;
}

// Initial attempt
ensureCloudinaryConfigured();

/**
 * Returns true if Cloudinary credentials are fully loaded
 */
export function isCloudinaryConfigured(): boolean {
  return ensureCloudinaryConfigured();
}

/**
 * Pings Cloudinary API to verify active credentials and connectivity
 */
export async function pingCloudinary(): Promise<{
  connected: boolean;
  cloudName: string;
  status: string;
  rateLimit?: any;
  error?: string;
}> {
  if (!ensureCloudinaryConfigured()) {
    return {
      connected: false,
      cloudName: '',
      status: 'NOT_CONFIGURED',
      error: 'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or CLOUDINARY_URL) are not set.',
    };
  }

  try {
    const pingResult = await cloudinary.api.ping();
    const creds = config.getCloudinaryCredentials();
    return {
      connected: true,
      cloudName: creds.cloudName,
      status: pingResult.status || 'ok',
      rateLimit: {
        allowed: pingResult.rate_limit_allowed,
        remaining: pingResult.rate_limit_remaining,
        resetAt: pingResult.rate_limit_reset_at,
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      cloudName: config.getCloudinaryCredentials().cloudName,
      status: 'ERROR',
      error: err.message || 'Failed to ping Cloudinary API.',
    };
  }
}

export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'raw' | 'auto';
  publicId?: string;
  overwrite?: boolean;
  tags?: string[];
}

/**
 * Uploads a binary buffer to Cloudinary with collision protection
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folderOrOptions: string | UploadOptions = 'mts_lab',
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<UploadApiResponse> {
  if (!ensureCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Missing API credentials.');
  }

  const opts: UploadOptions =
    typeof folderOrOptions === 'string'
      ? { folder: folderOrOptions, resourceType }
      : folderOrOptions;

  const folder = opts.folder || 'mts_lab';
  const rType = opts.resourceType || resourceType || 'auto';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: rType,
        public_id: opts.publicId,
        overwrite: opts.overwrite ?? false,
        tags: opts.tags,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload failed.'));
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

/**
 * Uploads a Base64 encoded asset (image or data URL) to Cloudinary
 */
export async function uploadBase64ToCloudinary(
  base64Data: string,
  folderOrOptions: string | UploadOptions = 'mts_lab'
): Promise<UploadApiResponse> {
  if (!ensureCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Missing API credentials.');
  }

  const opts: UploadOptions =
    typeof folderOrOptions === 'string'
      ? { folder: folderOrOptions }
      : folderOrOptions;

  const folder = opts.folder || 'mts_lab';

  return cloudinary.uploader.upload(base64Data, {
    folder,
    resource_type: opts.resourceType || 'auto',
    public_id: opts.publicId,
    overwrite: opts.overwrite ?? false,
    tags: opts.tags,
  });
}

/**
 * Uploads a PDF buffer or base64 to Cloudinary with dedicated PDF handling
 */
export async function uploadPdfToCloudinary(
  pdfInput: Buffer | string,
  docType: 'SERVICE_SLIP' | 'BATTERY_WARRANTY' | 'GENERAL' = 'GENERAL',
  referenceId?: string
): Promise<UploadApiResponse> {
  if (!ensureCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Missing API credentials.');
  }

  let folder = 'mts_lab/documents';
  let prefix = 'DOC';
  if (docType === 'SERVICE_SLIP') {
    folder = 'mts_lab/service-slips';
    prefix = 'SLIP';
  } else if (docType === 'BATTERY_WARRANTY') {
    folder = 'mts_lab/battery-warranties';
    prefix = 'WARRANTY';
  }

  const cleanRef = (referenceId || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_');
  const publicId = `${prefix}_${cleanRef}_${Date.now()}`;

  if (Buffer.isBuffer(pdfInput)) {
    return uploadToCloudinary(pdfInput, {
      folder,
      resourceType: 'auto',
      publicId,
      overwrite: true,
      tags: ['mts_lab', docType.toLowerCase(), cleanRef],
    });
  } else {
    return uploadBase64ToCloudinary(pdfInput, {
      folder,
      resourceType: 'auto',
      publicId,
      overwrite: true,
      tags: ['mts_lab', docType.toLowerCase(), cleanRef],
    });
  }
}

/**
 * Extracts public_id from a Cloudinary URL
 * Example: https://res.cloudinary.com/d0mavfi1/image/upload/v1788530915/mts_lab/test/alive_check.png -> mts_lab/test/alive_check
 */
export function extractPublicIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('cloudinary.com')) {
    // If it's already a public_id
    if (url.startsWith('mts_lab/')) return url;
    return null;
  }

  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/');
    // Find "upload" in the path
    const uploadIdx = parts.findIndex((p) => p === 'upload');
    if (uploadIdx === -1) return null;

    // Everything after "upload" (excluding version like v12345678)
    const afterUpload = parts.slice(uploadIdx + 1);
    const withoutVersion = afterUpload.filter((p) => !/^v\d+$/.test(p));
    const fullPath = withoutVersion.join('/');
    // Remove file extension if present (.jpg, .png, .pdf, etc.)
    return fullPath.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

/**
 * Deletes an asset from Cloudinary by publicId or full URL
 */
export async function deleteFromCloudinary(
  publicIdOrUrl: string,
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<{ result: string; publicId: string }> {
  if (!ensureCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }

  let publicId = extractPublicIdFromUrl(publicIdOrUrl) || publicIdOrUrl;
  if (!publicId) {
    throw new Error('Invalid public ID or URL.');
  }

  // Security guard: Ensure asset is inside mts_lab folder hierarchy
  if (!publicId.startsWith('mts_lab') && !publicId.startsWith('mts_slides')) {
    throw new Error('Permission denied: Asset is outside MTS Lab root.');
  }

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    // If result was "not found" under 'image', try 'raw'
    if (res.result === 'not found' && resourceType === 'image') {
      const rawRes = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });
      return { result: rawRes.result, publicId };
    }
    return { result: res.result, publicId };
  } catch (err: any) {
    console.error(`[CLOUDINARY DELETE ERROR: ${publicId}]`, err);
    throw err;
  }
}

/**
 * Validates that a URL is an authentic, HTTPS Cloudinary URL
 */
export function isValidCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://res.cloudinary.com/')) return false;

  const creds = config.getCloudinaryCredentials();
  if (creds.cloudName && !trimmed.includes(`res.cloudinary.com/${creds.cloudName}/`)) {
    // URL does not belong to configured cloud
    return false;
  }

  return true;
}
