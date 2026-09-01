import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { config } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { uploadToCloudinary, uploadBase64ToCloudinary } from '../services/cloudinaryService';
import {
  getSlides,
  createSlide,
  updateSlide,
  toggleSlideStatus,
  reorderSlides,
  deleteSlide,
} from '../services/slidesStorage';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Helper to fetch slides with no-cache headers
const getSlidesHandler = async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Admin endpoints or explicit query param ?all=true / ?status=ALL returns all slides
    const isAll = req.query.all === 'true' || 
                  req.query.status === 'ALL' || 
                  req.originalUrl.includes('/admin/') || 
                  req.baseUrl.includes('/admin/');

    const slides = await getSlides(!isAll);
    return res.json(slides || []);
  } catch (err: any) {
    console.error('[GET SLIDES EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve slides.' });
  }
};

// 1. GET /api/slides, /api/slides/public, /api/slides/home-slides & GET /api/admin/slides
router.get('/', getSlidesHandler);
router.get('/public', getSlidesHandler);
router.get('/home-slides', getSlidesHandler);

// 2. POST /api/admin/slides/upload-image
router.post('/upload-image', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), upload.single('image') as any, async (req: Request, res: Response) => {
  try {
    // 1. Multipart Form File Upload
    if (req.file) {
      if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
        try {
          const result = await uploadToCloudinary(req.file.buffer, 'mts_slides');
          return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
        } catch (cloudErr) {
          console.warn('[CLOUDINARY FALLBACK] Cloudinary upload failed, falling back to local asset:', cloudErr);
        }
      }

      // Local asset storage fallback
      const uploadDir = path.join(process.cwd(), 'public', 'assets', 'images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `slide_${Date.now()}_${safeOriginalName}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);

      return res.json({
        success: true,
        url: `/assets/images/${fileName}`
      });
    }

    // 2. Base64 Image Upload
    if (req.body?.base64Image || req.body?.image) {
      const base64Data = req.body.base64Image || req.body.image;

      if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
        try {
          const result = await uploadBase64ToCloudinary(base64Data, 'mts_slides');
          return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
        } catch (cloudErr) {
          console.warn('[CLOUDINARY BASE64 FALLBACK] Cloudinary base64 failed, falling back to local asset:', cloudErr);
        }
      }

      // Parse and save base64 locally
      const uploadDir = path.join(process.cwd(), 'public', 'assets', 'images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let ext = 'jpg';
      let buffer: Buffer;

      if (matches && matches.length === 3) {
        const mime = matches[1];
        if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
        else if (mime.includes('gif')) ext = 'gif';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const fileName = `slide_${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      return res.json({
        success: true,
        url: `/assets/images/${fileName}`
      });
    }

    return res.status(400).json({ error: 'No image file or base64 data provided.' });
  } catch (err: any) {
    console.error('[SLIDE IMAGE UPLOAD ERROR]', err);
    return res.status(500).json({ error: 'Failed to upload slide image.' });
  }
});

// 3. POST /api/admin/slides
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, buttonText, buttonLink, displayOrder = 1, status = 'ACTIVE' } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({ error: 'Title and image URL are required.' });
    }

    const created = await createSlide(
      {
        title,
        description,
        imageUrl,
        buttonText,
        buttonLink,
        displayOrder,
        status,
      },
      req.user?.id
    );

    return res.status(201).json(created);
  } catch (err: any) {
    console.error('[CREATE SLIDE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to save slide.' });
  }
});

// 4. PUT /api/admin/slides/reorder (Batch Reorder)
router.put('/reorder', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { slides, slideIds } = req.body;

    let itemsToReorder: { id: string; displayOrder: number }[] = [];

    if (Array.isArray(slides)) {
      itemsToReorder = slides.map(s => ({ id: s.id, displayOrder: s.displayOrder }));
    } else if (Array.isArray(slideIds)) {
      itemsToReorder = slideIds.map((id, index) => ({ id, displayOrder: index + 1 }));
    }

    if (itemsToReorder.length > 0) {
      await reorderSlides(itemsToReorder);
    }

    return res.json({ success: true, message: 'Slides reordered successfully.' });
  } catch (err: any) {
    console.error('[REORDER SLIDES ERROR]', err);
    return res.status(500).json({ error: 'Failed to reorder slides.' });
  }
});

// 5. PUT /api/admin/slides/:id
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await updateSlide(id, req.body, req.user?.id);
    return res.json(updated);
  } catch (err: any) {
    console.error('[UPDATE SLIDE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to update slide.' });
  }
});

// 6. PATCH /api/admin/slides/:id/toggle-status
router.patch('/:id/toggle-status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await toggleSlideStatus(id, req.user?.id);
    return res.json(updated);
  } catch (err: any) {
    console.error('[TOGGLE STATUS EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to toggle status.' });
  }
});

// 7. PATCH /api/admin/slides/:id/status (Set explicit status)
router.patch('/:id/status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const targetStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await updateSlide(id, { status: targetStatus }, req.user?.id);
    return res.json(updated);
  } catch (err: any) {
    console.error('[SET STATUS EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to set slide status.' });
  }
});

// 8. DELETE /api/admin/slides/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await deleteSlide(id);
    return res.json({ success: true, message: 'Slide deleted successfully.' });
  } catch (err: any) {
    console.error('[DELETE SLIDE EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to delete slide.' });
  }
});

export default router;

