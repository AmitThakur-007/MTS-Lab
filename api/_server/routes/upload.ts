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
  testCloudinaryUpload,
  extractPublicIdFromUrl,
  isValidCloudinaryUrl,
  isCloudinaryConfigured,
} from '../services/cloudinaryService';
import { supabaseAdmin } from '../config/supabase';

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

// 1.1 POST /api/upload/test — Active end-to-end upload & latency check
router.post('/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isConfigured = isCloudinaryConfigured();
    if (!isConfigured) {
      return res.json({
        success: false,
        storage: 'LOCAL_STORAGE',
        connected: false,
        message: 'Cloudinary is not configured in this environment. Falling back to local storage.',
      });
    }

    const testResult = await testCloudinaryUpload();
    return res.json({
      success: testResult.success,
      storage: 'CLOUDINARY',
      connected: testResult.success,
      latencyMs: testResult.latencyMs,
      testUrl: testResult.url,
      error: testResult.error,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Cloudinary test upload failed.',
    });
  }
});

// 1.2 GET /api/upload/documents — Query archived documents (Service Slips, Warranties)
router.get('/documents', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const referenceNumber = (req.query.referenceNumber as string || '').trim();
    const docType = (req.query.docType as string || '').trim().toUpperCase();

    let query = supabaseAdmin
      .from('AuditLog')
      .select('*')
      .eq('action', 'DOCUMENT_UPLOAD')
      .order('createdAt', { ascending: false });

    if (referenceNumber) {
      query = query.eq('resourceId', referenceNumber);
    }
    if (docType) {
      query = query.eq('resource', docType);
    }

    const { data: logs, error } = await query.limit(50);
    if (error) {
      console.warn('[QUERY DOCUMENTS WARN]', error);
      return res.json({ success: true, documents: [] });
    }

    const documents = (logs || []).map((l: any) => {
      let meta: any = {};
      try {
        meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : (l.metadata || {});
      } catch (_) { }
      return {
        id: l.id,
        docType: l.resource,
        referenceNumber: l.resourceId,
        url: meta.url || meta.secureUrl,
        secureUrl: meta.secureUrl || meta.url,
        publicId: meta.publicId,
        storageProvider: meta.storageProvider || 'UNKNOWN',
        bytes: meta.bytes,
        format: meta.format,
        uploadedAt: l.createdAt,
        uploadedByName: l.userName || 'System',
      };
    });

    return res.json({ success: true, documents });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve documents.' });
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
          storageProvider: 'CLOUDINARY',
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
          storageProvider: 'LOCAL_STORAGE',
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
          storageProvider: 'CLOUDINARY',
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
          storageProvider: 'LOCAL_STORAGE',
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

    let uploadedDoc: {
      url: string;
      secureUrl: string;
      publicId: string;
      format: string;
      bytes: number;
      resourceType: string;
      storageProvider: 'CLOUDINARY' | 'LOCAL_STORAGE';
    };

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

      uploadedDoc = {
        url: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format || 'pdf',
        bytes: result.bytes,
        resourceType: result.resource_type,
        storageProvider: 'CLOUDINARY',
      };
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

      uploadedDoc = {
        url: local.url,
        secureUrl: local.secureUrl,
        publicId: local.publicId,
        format: local.format || 'pdf',
        bytes: local.bytes,
        resourceType: local.resourceType,
        storageProvider: 'LOCAL_STORAGE',
      };
    }

    // Persist document metadata in AuditLog as authoritative document registry
    try {
      await supabaseAdmin.from('AuditLog').insert({
        userId: req.user?.id || 'system',
        userEmail: req.user?.email || null,
        userName: req.user?.name || null,
        userRole: req.user?.role || null,
        action: 'DOCUMENT_UPLOAD',
        resource: docType,
        resourceId: referenceNumber,
        status: 'SUCCESS',
        details: `Uploaded ${docType} PDF (${referenceNumber}) via ${uploadedDoc.storageProvider}`,
        metadata: JSON.stringify({
          ...uploadedDoc,
          docType,
          referenceNumber,
          uploadedAt: new Date().toISOString(),
          uploadedById: req.user?.id,
          uploadedByName: req.user?.name,
        }),
      });
    } catch (auditErr) {
      console.warn('[DOC AUDIT LOG INSERT WARN]', auditErr);
    }

    return res.json({
      success: true,
      ...uploadedDoc,
      docType,
      referenceNumber,
    });
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
