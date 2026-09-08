import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import {
  uploadToCloudinary,
  uploadBase64ToCloudinary,
  uploadPdfToCloudinary,
  deleteFromCloudinary,
  pingCloudinary,
  extractPublicIdFromUrl,
  isValidCloudinaryUrl,
  isCloudinaryConfigured,
} from '../services/cloudinaryService';

const router = Router();

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);

const ALLOWED_FOLDERS = new Set([
  'mts_lab',
  'mts_lab/service-slips',
  'mts_lab/battery-warranties',
  'mts_lab/repairs',
  'mts_lab/inventory',
  'mts_lab/slides',
  'mts_lab/profiles',
  'mts_lab/products',
  'mts_lab/documents',
  'mts_lab/test',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not permitted. Only images and PDFs are allowed.`));
    }
  },
});

// Local storage fallback helpers when Cloudinary is not configured
function saveFileLocally(buffer: Buffer, originalName: string, mimeType: string) {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) { }
  }
  const ext = path.extname(originalName) || (mimeType === 'application/pdf' ? '.pdf' : '.jpg');
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);
  return {
    url: `/uploads/${filename}`,
    secureUrl: `/uploads/${filename}`,
    publicId: filename,
    format: ext.replace('.', ''),
    bytes: buffer.length,
    resourceType: mimeType === 'application/pdf' ? 'raw' : 'image',
  };
}

function saveBase64Locally(base64Data: string) {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) { }
  }
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = '.jpg';
  let buffer: Buffer;
  let isPdf = false;
  if (matches && matches.length === 3) {
    const mime = matches[1];
    isPdf = mime === 'application/pdf';
    ext = isPdf ? '.pdf' : mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(base64Data, 'base64');
  }
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);
  return {
    url: `/uploads/${filename}`,
    secureUrl: `/uploads/${filename}`,
    publicId: filename,
    format: ext.replace('.', ''),
    bytes: buffer.length,
    resourceType: isPdf ? 'raw' : 'image',
  };
}

// 1. GET /api/upload/status — Connection & health test
router.get('/status', async (req, res: Response) => {
  try {
    const status = await pingCloudinary();
    return res.json({
      success: true,
      storage: status.connected ? 'CLOUDINARY' : 'LOCAL_STORAGE',
      ...status,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      storage: 'LOCAL_STORAGE',
      connected: false,
      error: err.message || 'Cloudinary offline, falling back to local storage',
    });
  }
});

// 2. POST /api/upload — Upload media file (multipart/form-data or Base64)
router.post('/', authenticate, upload.single('file') as any, async (req: AuthRequest, res: Response) => {
  try {
    const useCloudinary = isCloudinaryConfigured();

    let folder = ((req.query.folder as string) || req.body?.folder || 'mts_lab').trim();
    if (!ALLOWED_FOLDERS.has(folder)) {
      folder = 'mts_lab';
    }

    // 1. Binary file upload via multipart/form-data
    if (req.file) {
      if (useCloudinary) {
        const isPdf = req.file.mimetype === 'application/pdf';
        const resourceType = isPdf ? 'auto' : 'image';

        const result = await uploadToCloudinary(req.file.buffer, {
          folder,
          resourceType,
        });

        return res.json({
          success: true,
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          resourceType: result.resource_type,
          folder,
          width: result.width,
          height: result.height,
        });
      } else {
        const local = saveFileLocally(req.file.buffer, req.file.originalname, req.file.mimetype);
        return res.json({
          success: true,
          ...local,
          folder,
        });
      }
    }

    // 2. Base64 payload upload
    const base64Data = req.body?.base64Image || req.body?.image || req.body?.file;
    if (base64Data && typeof base64Data === 'string') {
      if (useCloudinary) {
        const isPdf = base64Data.startsWith('data:application/pdf');
        const resourceType = isPdf ? 'auto' : 'image';

        const result = await uploadBase64ToCloudinary(base64Data, {
          folder,
          resourceType,
        });

        return res.json({
          success: true,
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          resourceType: result.resource_type,
          folder,
          width: result.width,
          height: result.height,
        });
      } else {
        const local = saveBase64Locally(base64Data);
        return res.json({
          success: true,
          ...local,
          folder,
        });
      }
    }

    return res.status(400).json({ error: 'No file or image content provided in request.' });
  } catch (err: any) {
    console.error('[UPLOAD ROUTE ERROR]', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload asset.',
    });
  }
});

// 3. POST /api/upload/pdf — Dedicated PDF upload for Service Slips and Battery Warranties
router.post('/pdf', authenticate, upload.single('file') as any, async (req: AuthRequest, res: Response) => {
  try {
    const useCloudinary = isCloudinaryConfigured();
    const docType = (req.body?.docType || req.query.docType || 'GENERAL').toUpperCase();
    const referenceNumber = (req.body?.referenceNumber || req.query.referenceNumber || 'doc').trim();

    if (useCloudinary) {
      let result;
      if (req.file) {
        result = await uploadPdfToCloudinary(
          req.file.buffer,
          docType === 'SERVICE_SLIP'
            ? 'SERVICE_SLIP'
            : docType === 'BATTERY_WARRANTY'
            ? 'BATTERY_WARRANTY'
            : 'GENERAL',
          referenceNumber
        );
      } else if (req.body?.pdfBase64 || req.body?.base64) {
        const b64 = req.body.pdfBase64 || req.body.base64;
        result = await uploadPdfToCloudinary(
          b64,
          docType === 'SERVICE_SLIP'
            ? 'SERVICE_SLIP'
            : docType === 'BATTERY_WARRANTY'
            ? 'BATTERY_WARRANTY'
            : 'GENERAL',
          referenceNumber
        );
      } else {
        return res.status(400).json({ error: 'No PDF file or base64 data provided.' });
      }

      return res.json({
        success: true,
        url: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format || 'pdf',
        bytes: result.bytes,
        resourceType: result.resource_type,
        docType,
        referenceNumber,
      });
    } else {
      let local;
      if (req.file) {
        local = saveFileLocally(req.file.buffer, req.file.originalname, 'application/pdf');
      } else if (req.body?.pdfBase64 || req.body?.base64) {
        const b64 = req.body.pdfBase64 || req.body.base64;
        local = saveBase64Locally(b64);
      } else {
        return res.status(400).json({ error: 'No PDF file or base64 data provided.' });
      }
      return res.json({
        success: true,
        ...local,
        referenceNumber,
        docType,
      });
    }
  } catch (err: any) {
    console.error('[PDF UPLOAD ERROR]', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload PDF.',
    });
  }
});

// 4. DELETE /api/upload — Delete asset from Cloudinary
router.delete('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId, url, resourceType = 'image' } = req.body;
    const target = publicId || (url ? extractPublicIdFromUrl(url) : null);

    if (!target) {
      return res.status(400).json({ error: 'Target publicId or url is required for deletion.' });
    }

    const deletion = await deleteFromCloudinary(target, resourceType as any);
    return res.json({
      success: true,
      ...deletion,
    });
  } catch (err: any) {
    console.error('[DELETE UPLOAD ERROR]', err);
    return res.status(500).json({
      error: err.message || 'Failed to delete asset from Cloudinary.',
    });
  }
});

export default router;
