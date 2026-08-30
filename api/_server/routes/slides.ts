import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { uploadToCloudinary, uploadBase64ToCloudinary } from '../services/cloudinaryService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 1. GET /api/slides & GET /api/admin/slides
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data: slides, error } = await supabaseAdmin
      .from('HomeSlide')
      .select('*')
      .order('displayOrder', { ascending: true });

    if (error) return res.status(500).json({ error: 'Failed to fetch slides.' });

    return res.json(slides || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve slides.' });
  }
});

// 2. POST /api/admin/slides/upload-image
router.post('/upload-image', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'mts_slides');
      return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
    }

    if (req.body?.base64Image) {
      const result = await uploadBase64ToCloudinary(req.body.base64Image, 'mts_slides');
      return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
    }

    return res.status(400).json({ error: 'No image file or base64 provided.' });
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

    const newSlide = {
      id: uuidv4(),
      title: title.trim(),
      description: description ? description.trim() : null,
      imageUrl,
      buttonText: buttonText || 'Check Repair Price',
      buttonLink: buttonLink || '/services',
      displayOrder: parseInt(displayOrder, 10) || 1,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('HomeSlide').insert([newSlide]).select('*').single();
    if (error) return res.status(500).json({ error: 'Failed to create slide.' });

    await broadcastServerChange('HomeSlide', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save slide.' });
  }
});

// 4. PUT /api/admin/slides/:id
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;

    const { data: updated, error } = await supabaseAdmin
      .from('HomeSlide')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update slide.' });

    await broadcastServerChange('HomeSlide', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update slide.' });
  }
});

// 5. PATCH /api/admin/slides/:id/toggle-status
router.patch('/:id/toggle-status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: slide } = await supabaseAdmin.from('HomeSlide').select('status').eq('id', id).single();
    if (!slide) return res.status(404).json({ error: 'Slide not found.' });

    const newStatus = slide.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { data: updated, error } = await supabaseAdmin
      .from('HomeSlide')
      .update({ status: newStatus, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to toggle status.' });

    await broadcastServerChange('HomeSlide', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle status.' });
  }
});

// 6. DELETE /api/admin/slides/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('HomeSlide').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete slide.' });

    await broadcastServerChange('HomeSlide', 'DELETE', id);

    return res.json({ success: true, message: 'Slide deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete slide.' });
  }
});

export default router;
