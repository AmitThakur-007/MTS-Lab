import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';

const router = Router();

// Helper to generate next unique sequential customer ID (e.g. CUS-00105)
async function generateCustomerId(): Promise<string> {
  const { count } = await supabaseAdmin.from('Customer').select('*', { count: 'exact', head: true });
  const baseNum = (count || 0) + 101;
  let candidate = `CUS-${baseNum.toString().padStart(5, '0')}`;

  const { data: existing } = await supabaseAdmin.from('Customer').select('id').eq('customerId', candidate).limit(1);
  if (!existing || existing.length === 0) {
    return candidate;
  }

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `CUS-${(baseNum + randomSuffix).toString().padStart(5, '0')}`;
}

// 1. GET /api/customers
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, district, status = 'ACTIVE', page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin.from('Customer').select('*, repairs:Repair(count)', { count: 'exact' });

    if (status === 'ACTIVE') {
      query = query.eq('archived', false);
    } else if (status === 'ARCHIVED') {
      query = query.eq('archived', true);
    }

    if (district && district !== 'ALL') {
      query = query.eq('district', String(district));
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,customerId.ilike.%${s}%,email.ilike.%${s}%`);
    }

    query = query.order('createdAt', { ascending: false }).range(offset, offset + limitNum - 1);

    const { data: customers, count, error } = await query;

    if (error) {
      console.error('[CUSTOMERS GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch customers.' });
    }

    // Format customer response with repair count
    const formatted = (customers || []).map((c: any) => ({
      ...c,
      totalRepairs: Array.isArray(c.repairs) ? c.repairs[0]?.count || 0 : (c.repairs?.count || 0),
    }));

    return res.json({
      customers: formatted,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum),
    });
  } catch (err: any) {
    console.error('[CUSTOMERS LIST ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve customer list.' });
  }
});

// 2. GET /api/customers/lookup
router.get('/lookup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { phone, name, q } = req.query;
    const queryTerm = (phone || name || q || '') as string;

    if (!queryTerm || queryTerm.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = queryTerm.trim();
    const { data: customers, error } = await supabaseAdmin
      .from('Customer')
      .select('id, customerId, name, phone, email, address, district, municipality, landmark')
      .eq('archived', false)
      .or(`phone.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,customerId.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) {
      return res.status(500).json({ error: 'Customer lookup failed.' });
    }

    return res.json(customers || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to perform customer lookup.' });
  }
});

// 3. GET /api/customers/search
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length === 0) {
      return res.json([]);
    }

    const term = String(q).trim();
    const { data: customers, error } = await supabaseAdmin
      .from('Customer')
      .select('*')
      .eq('archived', false)
      .or(`phone.ilike.%${term}%,name.ilike.%${term}%,customerId.ilike.%${term}%`)
      .limit(15);

    if (error) {
      return res.status(500).json({ error: 'Search failed.' });
    }

    return res.json(customers || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to search customers.' });
  }
});

// 4. GET /api/customers/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: customer, error } = await supabaseAdmin
      .from('Customer')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    return res.json(customer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve customer details.' });
  }
});

// 5. GET /api/customers/:id/repairs
router.get('/:id/repairs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: repairs, error } = await supabaseAdmin
      .from('Repair')
      .select('*, technician:User!Repair_technicianId_fkey(id, name, role)')
      .eq('customerId', id)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[CUSTOMER REPAIRS ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch customer repair records.' });
    }

    return res.json(repairs || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve customer repair history.' });
  }
});

// 6. POST /api/customers
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      phone,
      alternativePhone,
      email,
      district,
      municipality,
      address,
      landmark,
      notes,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const customerId = await generateCustomerId();
    const newCustomer = {
      id: uuidv4(),
      customerId,
      name: name.trim(),
      phone: phone.trim(),
      alternativePhone: alternativePhone ? alternativePhone.trim() : null,
      email: email ? email.trim() : null,
      district: district ? district.trim() : null,
      municipality: municipality ? municipality.trim() : null,
      address: address ? address.trim() : null,
      landmark: landmark ? landmark.trim() : null,
      notes: notes ? notes.trim() : null,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin
      .from('Customer')
      .insert([newCustomer])
      .select('*')
      .single();

    if (error) {
      console.error('[CUSTOMER CREATE ERROR]', error);
      return res.status(500).json({ error: 'Failed to create customer record.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'CUSTOMER_CREATED',
      resource: 'Customer',
      resourceId: created.id,
      details: { name: created.name, customerId: created.customerId, phone: created.phone },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save customer.' });
  }
});

// 7. PATCH /api/customers/:id
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      alternativePhone,
      email,
      district,
      municipality,
      address,
      landmark,
      notes,
    } = req.body;

    const updatePayload: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name.trim();
    if (phone !== undefined) updatePayload.phone = phone.trim();
    if (alternativePhone !== undefined) updatePayload.alternativePhone = alternativePhone ? alternativePhone.trim() : null;
    if (email !== undefined) updatePayload.email = email ? email.trim() : null;
    if (district !== undefined) updatePayload.district = district ? district.trim() : null;
    if (municipality !== undefined) updatePayload.municipality = municipality ? municipality.trim() : null;
    if (address !== undefined) updatePayload.address = address ? address.trim() : null;
    if (landmark !== undefined) updatePayload.landmark = landmark ? landmark.trim() : null;
    if (notes !== undefined) updatePayload.notes = notes ? notes.trim() : null;

    const { data: updated, error } = await supabaseAdmin
      .from('Customer')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update customer record.' });
    }

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update customer.' });
  }
});

// 8. POST /api/customers/:id/archive
router.post('/:id/archive', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin
      .from('Customer')
      .update({
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: req.user!.name,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to archive customer.' });
    }

    return res.json({ success: true, message: 'Customer archived successfully.', customer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to archive customer.' });
  }
});

// 9. POST /api/customers/:id/restore
router.post('/:id/restore', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin
      .from('Customer')
      .update({
        archived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to restore customer.' });
    }

    return res.json({ success: true, message: 'Customer restored successfully.', customer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to restore customer.' });
  }
});

// 10. DELETE /api/customers/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('Customer').delete().eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete customer record.' });
    }

    return res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete customer.' });
  }
});

export default router;
