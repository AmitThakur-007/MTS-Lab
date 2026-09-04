import { Router, Response } from 'express';
import multer from 'multer';
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

// 1. GET /api/upload/status — Connection & health test
router.get('/status', async (req, res: Response) => {
  try {
    const status = await pingCloudinary();
    return res.json({
      success: status.connected,
      ...status,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error checking Cloudinary status.',
    });
  }
});

// 2. POST /api/upload — Upload media file (multipart/form-data or Base64)
router.post('/', authenticate, upload.single('file') as any, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error: 'Cloudinary storage service is not configured on the server.',
        code: 'CLOUDINARY_NOT_CONFIGURED',
      });
    }

    let folder = ((req.query.folder as string) || req.body?.folder || 'mts_lab').trim();
    if (!ALLOWED_FOLDERS.has(folder)) {
      folder = 'mts_lab';
    }

    // 1. Binary file upload via multipart/form-data
    if (req.file) {
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
    }

    // 2. Base64 payload upload
    const base64Data = req.body?.base64Image || req.body?.image || req.body?.file;
    if (base64Data && typeof base64Data === 'string') {
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
    }

    return res.status(400).json({ error: 'No file or image content provided in request.' });
  } catch (err: any) {
    console.error('[UPLOAD ROUTE ERROR]', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload asset to Cloudinary.',
    });
  }
});

// 3. POST /api/upload/pdf — Dedicated PDF upload for Service Slips and Battery Warranties
router.post('/pdf', authenticate, upload.single('file') as any, async (req: AuthRequest, res: Response) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error: 'Cloudinary storage service is not configured on the server.',
        code: 'CLOUDINARY_NOT_CONFIGURED',
      });
    }

    const docType = (req.body?.docType || req.query.docType || 'GENERAL').toUpperCase();
    const referenceNumber = (req.body?.referenceNumber || req.query.referenceNumber || 'doc').trim();

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
  } catch (err: any) {
    console.error('[PDF UPLOAD ERROR]', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload PDF to Cloudinary.',
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
