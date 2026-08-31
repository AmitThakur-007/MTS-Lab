import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToCloudinary, uploadBase64ToCloudinary } from '../services/cloudinaryService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 1. POST /api/upload
router.post('/', authenticate, upload.single('file') as any, async (req: AuthRequest, res: Response) => {
  try {
    const folder = (req.query.folder as string) || (req.body?.folder as string) || 'mts_lab';

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, folder);
      return res.json({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type,
      });
    }

    if (req.body?.base64Image || req.body?.image) {
      const b64 = req.body.base64Image || req.body.image;
      const result = await uploadBase64ToCloudinary(b64, folder);
      return res.json({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
      });
    }

    return res.status(400).json({ error: 'No file or image content provided.' });
  } catch (err: any) {
    console.error('[UPLOAD ERROR]', err);
    return res.status(500).json({ error: 'Failed to upload asset to Cloudinary.' });
  }
});

export default router;
