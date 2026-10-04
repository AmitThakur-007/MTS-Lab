import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import {
  uploadToCloudinary,
  uploadBase64ToCloudinary,
  isCloudinaryConfigured,
} from '../services/cloudinaryService';
import {
  getSlides,
  getSlideById,
  createSlide,
  updateSlide,
  toggleSlideStatus,
  reorderSlides,
  deleteSlide,
} from '../services/slidesStorage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

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

// 2. GET /api/admin/slides/:id & GET /api/slides/:id (Single Slide Retrieval by UUID)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Valid slide ID is required.' });
    }

    const slide = await getSlideById(id);
    if (!slide) {
      return res.status(404).json({ error: `Slide with ID '${id}' not found.` });
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    return res.json(slide);
  } catch (err: any) {
    console.error(`[GET SLIDE BY ID EXCEPTION: ${req.params.id}]`, err);
    return res.status(500).json({ error: 'Failed to retrieve slide.' });
  }
});

// 3. POST /api/admin/slides/upload-image (Supports both 'image' and 'file' FormData fields + Base64)
router.post(
  '/upload-image',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN']),
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]) as any,
  async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFile = files?.image?.[0] || files?.file?.[0] || (req as any).file;

      // 1. Multipart Form File Upload
      if (uploadedFile) {
        if (isCloudinaryConfigured()) {
          const result = await uploadToCloudinary(uploadedFile.buffer, {
            folder: 'mts_lab/slides',
            resourceType: 'image',
          });
          return res.json({
            success: true,
            storageProvider: 'CLOUDINARY',
            url: result.secure_url,
            publicId: result.public_id,
          });
        }

        // Local asset storage fallback when Cloudinary is absent
        const uploadDir = path.join(process.cwd(), 'public', 'assets', 'images');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const safeOriginalName = uploadedFile.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `slide_${Date.now()}_${safeOriginalName}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, uploadedFile.buffer);

        // Also duplicate to uploads/ for consistency
        try {
          const generalUploadsDir = path.join(process.cwd(), 'uploads');
          if (fs.existsSync(generalUploadsDir)) {
            fs.writeFileSync(path.join(generalUploadsDir, fileName), uploadedFile.buffer);
          }
        } catch (_) {}

        return res.json({
          success: true,
          storageProvider: 'LOCAL_STORAGE',
          url: `/assets/images/${fileName}`,
          publicId: fileName,
        });
      }

      // 2. Base64 Image Upload
      const base64Data = req.body?.base64Image || req.body?.image || req.body?.file;
      if (base64Data && typeof base64Data === 'string') {
        if (isCloudinaryConfigured()) {
          const result = await uploadBase64ToCloudinary(base64Data, {
            folder: 'mts_lab/slides',
            resourceType: 'image',
          });
          return res.json({
            success: true,
            storageProvider: 'CLOUDINARY',
            url: result.secure_url,
            publicId: result.public_id,
          });
        }

        // Parse and save base64 locally fallback
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

        // Also duplicate to uploads/ for consistency
        try {
          const generalUploadsDir = path.join(process.cwd(), 'uploads');
          if (fs.existsSync(generalUploadsDir)) {
            fs.writeFileSync(path.join(generalUploadsDir, fileName), buffer);
          }
        } catch (_) {}

        return res.json({
          success: true,
          storageProvider: 'LOCAL_STORAGE',
          url: `/assets/images/${fileName}`,
          publicId: fileName,
        });
      }

      return res.status(400).json({ error: 'No image file or base64 data provided in request.' });
    } catch (err: any) {
      console.error('[SLIDE IMAGE UPLOAD ERROR]', err);
      return res.status(500).json({ error: err?.message || 'Failed to upload slide image.' });
    }
  }
);

// 4. POST /api/admin/slides (Create slide)
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, buttonText, buttonLink, displayOrder = 1, status = 'ACTIVE' } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Slide title is required.' });
    }
    if (!imageUrl || !String(imageUrl).trim()) {
      return res.status(400).json({ error: 'Slide image URL is required.' });
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
    return res.status(500).json({ error: err?.message || 'Failed to save slide.' });
  }
});

// 5. PUT /api/admin/slides/reorder (Batch Reorder)
router.put('/reorder', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { slides, slideIds } = req.body;

    let itemsToReorder: { id: string; displayOrder: number }[] = [];

    if (Array.isArray(slides)) {
      itemsToReorder = slides.map(s => ({ id: String(s.id), displayOrder: Number(s.displayOrder) || 1 }));
    } else if (Array.isArray(slideIds)) {
      itemsToReorder = slideIds.map((id, index) => ({ id: String(id), displayOrder: index + 1 }));
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

// Helper for Slide Update (shared between PUT and PATCH)
const handleUpdateSlide = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Valid slide ID is required.' });
    }
    const updated = await updateSlide(id, req.body, req.user?.id);
    return res.json(updated);
  } catch (err: any) {
    console.error(`[UPDATE SLIDE EXCEPTION: ${req.params.id}]`, err);
    const statusCode = err?.message?.includes('not found') ? 404 : 500;
    return res.status(statusCode).json({ error: err?.message || 'Failed to update slide.' });
  }
};

// 6. PUT /api/admin/slides/:id & PATCH /api/admin/slides/:id
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleUpdateSlide);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleUpdateSlide);

// 7. PATCH /api/admin/slides/:id/toggle-status
router.patch('/:id/toggle-status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Valid slide ID is required.' });
    }
    const updated = await toggleSlideStatus(id, req.user?.id);
    return res.json(updated);
  } catch (err: any) {
    console.error(`[TOGGLE STATUS EXCEPTION: ${req.params.id}]`, err);
    const statusCode = err?.message?.includes('not found') ? 404 : 500;
    return res.status(statusCode).json({ error: err?.message || 'Failed to toggle slide status.' });
  }
});

// 8. PATCH /api/admin/slides/:id/status (Set explicit status)
router.patch('/:id/status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const targetStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await updateSlide(id, { status: targetStatus }, req.user?.id);
    return res.json(updated);
  } catch (err: any) {
    console.error(`[SET STATUS EXCEPTION: ${req.params.id}]`, err);
    const statusCode = err?.message?.includes('not found') ? 404 : 500;
    return res.status(statusCode).json({ error: err?.message || 'Failed to set slide status.' });
  }
});

// 9. DELETE /api/admin/slides/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Valid slide ID is required.' });
    }
    await deleteSlide(id);
    return res.json({ success: true, message: 'Slide deleted successfully.' });
  } catch (err: any) {
    console.error(`[DELETE SLIDE EXCEPTION: ${req.params.id}]`, err);
    return res.status(500).json({ error: err?.message || 'Failed to delete slide.' });
  }
});

export default router;
