import { Router, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize, normalizeRole } from '../middleware/rbac';
import { logAudit } from '../services/auditService';

const router = Router();

// Helper to clean and normalize Nepal phone numbers
export function cleanNepalPhone(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+977')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('977') && cleaned.length > 10) {
    cleaned = cleaned.substring(3);
  }
  return cleaned;
}

// Helper to validate Nepal phone format
export function isValidNepalPhone(phone: string): boolean {
  const cleaned = cleanNepalPhone(phone);
  // Mobile: 10 digits starting with 98 or 97
  const isMobile = /^(98|97)\d{8}$/.test(cleaned);
  // Landline: e.g. 01XXXXXXX (8 digits) or other district codes 0XX-XXXXXX (8-9 digits)
  const isLandline = /^0\d{7,8}$/.test(cleaned);
  return isMobile || isLandline;
}

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

// 1. GET /api/customers/stats - Overview statistics for Super Admin, Admin & Manager
router.get('/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    // Total active customers
    const { count: totalActive } = await supabaseAdmin
      .from('Customer')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false);

    // Total archived customers
    const { count: totalArchived } = await supabaseAdmin
      .from('Customer')
      .select('*', { count: 'exact', head: true })
      .eq('archived', true);

    // Added Today (since midnight UTC / Nepal time)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const { count: addedToday } = await supabaseAdmin
      .from('Customer')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)
      .gte('createdAt', startOfToday);

    // Added This Month (since 1st of current month)
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
    const { count: addedThisMonth } = await supabaseAdmin
      .from('Customer')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)
      .gte('createdAt', startOfMonth);

    // Customers with repair history (customers that have at least 1 repair)
    const { data: customerRepairCounts, error: repairError } = await supabaseAdmin
      .from('Customer')
      .select('id, repairs:Repair(count)')
      .eq('archived', false);

    let withRepairs = 0;
    let returningCustomers = 0;

    if (!repairError && Array.isArray(customerRepairCounts)) {
      customerRepairCounts.forEach((c: any) => {
        const count = Array.isArray(c.repairs) ? c.repairs[0]?.count || 0 : (c.repairs?.count || 0);
        if (count > 0) withRepairs++;
        if (count >= 2) returningCustomers++;
      });
    }

    return res.json({
      totalCustomers: totalActive || 0,
      totalArchived: totalArchived || 0,
      totalAll: (totalActive || 0) + (totalArchived || 0),
      addedToday: addedToday || 0,
      addedThisMonth: addedThisMonth || 0,
      withRepairs,
      withoutRepairs: Math.max(0, (totalActive || 0) - withRepairs),
      returningCustomers,
    });
  } catch (err: any) {
    console.error('[CUSTOMERS STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to compute customer statistics.' });
  }
});

// 2. GET /api/customers - Advanced list with server-side pagination, filters, search & sorting
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      district,
      status = 'ACTIVE',
      filter = 'ALL',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '25',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit as string, 10) || 25), 200);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin.from('Customer').select('*, repairs:Repair(count)', { count: 'exact' });

    // Status filter
    if (status === 'ACTIVE') {
      query = query.eq('archived', false);
    } else if (status === 'ARCHIVED') {
      query = query.eq('archived', true);
    } // 'ALL' leaves archived unconstrained

    // District filter
    if (district && district !== 'ALL') {
      query = query.eq('district', String(district));
    }

    // Time-based filters
    const now = new Date();
    if (filter === 'TODAY') {
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
      query = query.gte('createdAt', startOfToday);
    } else if (filter === 'THIS_WEEK') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('createdAt', oneWeekAgo);
    } else if (filter === 'THIS_MONTH') {
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
      query = query.gte('createdAt', startOfMonth);
    }

    // Search query: supports Name, Phone (normalized or raw), Customer ID, Email
    if (search) {
      const s = String(search).trim();
      const cleanedPhone = cleanNepalPhone(s);
      
      if (cleanedPhone && cleanedPhone.length >= 3 && cleanedPhone !== s) {
        query = query.or(
          `name.ilike.%${s}%,phone.ilike.%${s}%,phone.ilike.%${cleanedPhone}%,customerId.ilike.%${s}%,email.ilike.%${s}%`
        );
      } else {
        query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,customerId.ilike.%${s}%,email.ilike.%${s}%`);
      }
    }

    // Determine ordering
    const validSortFields = ['createdAt', 'updatedAt', 'name', 'phone', 'customerId'];
    const chosenSort = validSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
    const isAscending = String(sortOrder).toLowerCase() === 'asc';

    query = query.order(chosenSort, { ascending: isAscending }).range(offset, offset + limitNum - 1);

    const { data: customers, count, error } = await query;

    if (error) {
      console.error('[CUSTOMERS GET ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch customers.' });
    }

    // Format customer response with repair count
    let formatted = (customers || []).map((c: any) => ({
      ...c,
      totalRepairs: Array.isArray(c.repairs) ? c.repairs[0]?.count || 0 : (c.repairs?.count || 0),
    }));

    // In-memory filter if WITH_REPAIRS / WITHOUT_REPAIRS requested
    if (filter === 'WITH_REPAIRS') {
      formatted = formatted.filter((c: any) => (c.totalRepairs || 0) > 0);
    } else if (filter === 'WITHOUT_REPAIRS') {
      formatted = formatted.filter((c: any) => (c.totalRepairs || 0) === 0);
    }

    // In-memory sort if requested by totalRepairs
    if (sortBy === 'totalRepairs') {
      formatted.sort((a: any, b: any) => {
        return isAscending ? (a.totalRepairs - b.totalRepairs) : (b.totalRepairs - a.totalRepairs);
      });
    }

    return res.json({
      customers: formatted,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil((count || 0) / limitNum)),
    });
  } catch (err: any) {
    console.error('[CUSTOMERS LIST ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve customer list.' });
  }
});

// 3. GET /api/customers/lookup
router.get('/lookup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { phone, name, q } = req.query;
    const queryTerm = (phone || name || q || '') as string;

    if (!queryTerm || queryTerm.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = queryTerm.trim();
    const cleaned = cleanNepalPhone(searchTerm);
    let query = supabaseAdmin
      .from('Customer')
      .select('id, customerId, name, phone, email, address, district, municipality, landmark')
      .eq('archived', false);

    if (cleaned && cleaned.length >= 3 && cleaned !== searchTerm) {
      query = query.or(`phone.ilike.%${searchTerm}%,phone.ilike.%${cleaned}%,name.ilike.%${searchTerm}%,customerId.ilike.%${searchTerm}%`);
    } else {
      query = query.or(`phone.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,customerId.ilike.%${searchTerm}%`);
    }

    const { data: customers, error } = await query.limit(10);

    if (error) {
      return res.status(500).json({ error: 'Customer lookup failed.' });
    }

    return res.json(customers || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to perform customer lookup.' });
  }
});

// 4. GET /api/customers/search
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length === 0) {
      return res.json([]);
    }

    const term = String(q).trim();
    const cleaned = cleanNepalPhone(term);
    let query = supabaseAdmin.from('Customer').select('*').eq('archived', false);

    if (cleaned && cleaned.length >= 3 && cleaned !== term) {
      query = query.or(`phone.ilike.%${term}%,phone.ilike.%${cleaned}%,name.ilike.%${term}%,customerId.ilike.%${term}%`);
    } else {
      query = query.or(`phone.ilike.%${term}%,name.ilike.%${term}%,customerId.ilike.%${term}%`);
    }

    const { data: customers, error } = await query.limit(15);

    if (error) {
      return res.status(500).json({ error: 'Search failed.' });
    }

    return res.json(customers || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to search customers.' });
  }
});

// 5. GET /api/customers/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: customer, error } = await supabaseAdmin
      .from('Customer')
      .select('*, repairs:Repair(count)')
      .eq('id', id)
      .single();

    if (error || !customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const totalRepairs = Array.isArray(customer.repairs)
      ? customer.repairs[0]?.count || 0
      : (customer.repairs?.count || 0);

    return res.json({
      ...customer,
      totalRepairs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve customer details.' });
  }
});

// 6. GET /api/customers/:id/repairs
router.get('/:id/repairs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page, limit, status, dateFrom, dateTo } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt((limit as string) || '40', 10)), 500);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('Repair')
      .select('*, technician:User!Repair_technicianId_fkey(id, name, role)', { count: 'exact' })
      .eq('customerId', id);

    if (status && status !== 'ALL') {
      query = query.eq('status', String(status));
    }
    if (dateFrom) {
      query = query.gte('createdAt', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte('createdAt', `${dateTo}T23:59:59.999Z`);
    }

    query = query.order('createdAt', { ascending: false }).range(offset, offset + limitNum - 1);

    const { data: repairs, count, error } = await query;

    if (error) {
      console.error('[CUSTOMER REPAIRS ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch customer repair records.' });
    }

    const totalCount = typeof count === 'number' ? count : (Array.isArray(repairs) ? repairs.length : 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));

    return res.json({
      repairs: repairs || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve customer repair history.' });
  }
});

// 7. POST /api/customers - Add Customer with validation and duplicate prevention
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
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

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Customer name is required (minimum 2 characters).' });
    }

    if (!phone || String(phone).trim().length === 0) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanedPhone = cleanNepalPhone(phone);
    if (!isValidNepalPhone(cleanedPhone)) {
      return res.status(400).json({
        error: 'Invalid Nepal phone number. Must be a 10-digit mobile number (starting with 98 or 97) or valid landline number.',
      });
    }

    // Check for duplicate active customer with this phone number
    const { data: duplicate } = await supabaseAdmin
      .from('Customer')
      .select('id, customerId, name, phone, archived')
      .eq('phone', cleanedPhone)
      .eq('archived', false)
      .limit(1);

    if (duplicate && duplicate.length > 0) {
      return res.status(409).json({
        error: `Customer already exists with phone ${cleanedPhone} (${duplicate[0].name} - ${duplicate[0].customerId}).`,
        existingCustomer: duplicate[0],
      });
    }

    const customerId = await generateCustomerId();
    const newCustomer = {
      id: uuidv4(),
      customerId,
      name: String(name).trim(),
      phone: cleanedPhone,
      alternativePhone: alternativePhone ? cleanNepalPhone(alternativePhone) : null,
      email: email && String(email).trim().length > 0 ? String(email).trim().toLowerCase() : null,
      district: district ? String(district).trim() : 'Kathmandu',
      municipality: municipality ? String(municipality).trim() : null,
      address: address ? String(address).trim() : null,
      landmark: landmark ? String(landmark).trim() : null,
      notes: notes ? String(notes).trim() : null,
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
      details: {
        name: created.name,
        customerId: created.customerId,
        phone: created.phone,
        createdByRole: req.user!.role,
      },
    });

    await broadcastServerChange('Customer', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save customer.' });
  }
});

// 8. PATCH /api/customers/:id - Update Customer
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: AuthRequest, res: Response) => {
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

    if (name !== undefined) {
      if (String(name).trim().length < 2) {
        return res.status(400).json({ error: 'Customer name must be at least 2 characters.' });
      }
      updatePayload.name = String(name).trim();
    }

    if (phone !== undefined) {
      const cleaned = cleanNepalPhone(phone);
      if (!isValidNepalPhone(cleaned)) {
        return res.status(400).json({
          error: 'Invalid Nepal phone number. Must be a 10-digit mobile number (starting with 98 or 97) or valid landline number.',
        });
      }
      // Check if another customer is using this phone
      const { data: conflict } = await supabaseAdmin
        .from('Customer')
        .select('id, name, customerId')
        .eq('phone', cleaned)
        .eq('archived', false)
        .neq('id', id)
        .limit(1);

      if (conflict && conflict.length > 0) {
        return res.status(409).json({
          error: `Another active customer already has phone ${cleaned} (${conflict[0].name} - ${conflict[0].customerId}).`,
        });
      }

      updatePayload.phone = cleaned;
    }

    if (alternativePhone !== undefined) {
      updatePayload.alternativePhone = alternativePhone ? cleanNepalPhone(alternativePhone) : null;
    }
    if (email !== undefined) {
      updatePayload.email = email && String(email).trim().length > 0 ? String(email).trim().toLowerCase() : null;
    }
    if (district !== undefined) updatePayload.district = district ? String(district).trim() : null;
    if (municipality !== undefined) updatePayload.municipality = municipality ? String(municipality).trim() : null;
    if (address !== undefined) updatePayload.address = address ? String(address).trim() : null;
    if (landmark !== undefined) updatePayload.landmark = landmark ? String(landmark).trim() : null;
    if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim() : null;

    const { data: updated, error } = await supabaseAdmin
      .from('Customer')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update customer record.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'CUSTOMER_UPDATED',
      resource: 'Customer',
      resourceId: id,
      details: { updatedFields: Object.keys(updatePayload), customerId: updated.customerId },
    });

    await broadcastServerChange('Customer', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update customer.' });
  }
});

// 9. POST /api/customers/:id/archive
router.post('/:id/archive', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin
      .from('Customer')
      .update({
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: req.user!.name || req.user!.email,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to archive customer.' });
    }

    await logAudit({
      userId: req.user!.id,
      action: 'CUSTOMER_ARCHIVED',
      resource: 'Customer',
      resourceId: id,
      details: { customerId: updated.customerId, name: updated.name },
    });

    await broadcastServerChange('Customer', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Customer archived successfully.', customer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to archive customer.' });
  }
});

// 10. POST /api/customers/:id/restore
router.post('/:id/restore', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
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

    await logAudit({
      userId: req.user!.id,
      action: 'CUSTOMER_RESTORED',
      resource: 'Customer',
      resourceId: id,
      details: { customerId: updated.customerId, name: updated.name },
    });

    await broadcastServerChange('Customer', 'UPDATE', id, updated);

    return res.json({ success: true, message: 'Customer restored successfully.', customer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to restore customer.' });
  }
});

// 11. DELETE /api/customers/:id - Safe deletion with critical data protection
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = normalizeRole(req.user!.role);

    // Check if customer exists
    const { data: customer, error: fetchErr } = await supabaseAdmin
      .from('Customer')
      .select('id, customerId, name, phone, archived')
      .eq('id', id)
      .single();

    if (fetchErr || !customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Inspect associated repairs
    const { count: repairCount } = await supabaseAdmin
      .from('Repair')
      .select('id', { count: 'exact', head: true })
      .eq('customerId', id);

    // Inspect associated battery warranties
    const { count: warrantyCount } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('id', { count: 'exact', head: true })
      .eq('customerId', id);

    const totalAssociated = (repairCount || 0) + (warrantyCount || 0);

    // CRITICAL DATA PROTECTION:
    // If customer has associated repairs or warranties, they CANNOT be permanently deleted.
    // They must be safely archived to preserve warranty, financial, and repair audit history.
    if (totalAssociated > 0) {
      const { data: archivedCustomer, error: archiveErr } = await supabaseAdmin
        .from('Customer')
        .update({
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: req.user!.name || req.user!.email,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (archiveErr) {
        return res.status(500).json({ error: 'Failed to archive customer record.' });
      }

      await logAudit({
        userId: req.user!.id,
        action: 'CUSTOMER_ARCHIVED_PROTECTED',
        resource: 'Customer',
        resourceId: id,
        details: {
          reason: 'Customer has associated repair history or warranty records; protected from permanent deletion.',
          repairCount: repairCount || 0,
          warrantyCount: warrantyCount || 0,
          customerId: customer.customerId,
        },
      });

      await broadcastServerChange('Customer', 'UPDATE', id, archivedCustomer);

      return res.json({
        success: true,
        archived: true,
        permanent: false,
        message: `Customer "${customer.name}" (${customer.customerId}) has ${repairCount || 0} associated repair(s) and cannot be permanently deleted. The record has been safely archived to preserve repair, warranty, and financial audit history.`,
        repairCount: repairCount || 0,
        warrantyCount: warrantyCount || 0,
      });
    }

    // Customer has ZERO associated records:
    // Only SUPER_ADMIN can execute permanent deletion from the database
    if (userRole === 'SUPER_ADMIN') {
      const { error: deleteErr } = await supabaseAdmin.from('Customer').delete().eq('id', id);

      if (deleteErr) {
        return res.status(500).json({ error: 'Failed to delete customer record from database.' });
      }

      await logAudit({
        userId: req.user!.id,
        action: 'CUSTOMER_PERMANENTLY_DELETED',
        resource: 'Customer',
        resourceId: id,
        details: { customerId: customer.customerId, name: customer.name, phone: customer.phone },
      });

      await broadcastServerChange('Customer', 'DELETE', id);

      return res.json({
        success: true,
        archived: false,
        permanent: true,
        message: `Customer "${customer.name}" (${customer.customerId}) with zero repairs was permanently deleted by Super Admin.`,
      });
    } else {
      // Non-SuperAdmin (Admin, Manager): safely archive instead
      const { data: archivedCustomer, error: archiveErr } = await supabaseAdmin
        .from('Customer')
        .update({
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: req.user!.name || req.user!.email,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (archiveErr) {
        return res.status(500).json({ error: 'Failed to archive customer record.' });
      }

      await logAudit({
        userId: req.user!.id,
        action: 'CUSTOMER_ARCHIVED',
        resource: 'Customer',
        resourceId: id,
        details: {
          reason: 'Non-SuperAdmin requested deletion; record was safely archived.',
          customerId: customer.customerId,
          role: req.user!.role,
        },
      });

      await broadcastServerChange('Customer', 'UPDATE', id, archivedCustomer);

      return res.json({
        success: true,
        archived: true,
        permanent: false,
        message: `Customer "${customer.name}" has been safely archived. Permanent deletion requires Super Admin authority.`,
      });
    }
  } catch (err: any) {
    console.error('[CUSTOMER DELETE ERROR]', err);
    return res.status(500).json({ error: 'Failed to process customer deletion.' });
  }
});

// 12. POST /api/customers/bulk-delete - Bulk delete/archive with role enforcement & repair protection
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { customerIds, permanent = false } = req.body;
    const userRole = normalizeRole(req.user!.role);

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: 'Please provide a non-empty array of customerIds.' });
    }

    let archivedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;
    const detailsList: any[] = [];

    for (const id of customerIds) {
      try {
        const { data: customer } = await supabaseAdmin
          .from('Customer')
          .select('id, customerId, name, phone, archived')
          .eq('id', id)
          .single();

        if (!customer) {
          skippedCount++;
          continue;
        }

        // Count associated repairs & warranties
        const { count: repairCount } = await supabaseAdmin
          .from('Repair')
          .select('id', { count: 'exact', head: true })
          .eq('customerId', id);

        const { count: warrantyCount } = await supabaseAdmin
          .from('BatteryWarranty')
          .select('id', { count: 'exact', head: true })
          .eq('customerId', id);

        const totalAssociated = (repairCount || 0) + (warrantyCount || 0);

        if (totalAssociated > 0) {
          // Associated repairs exist -> MUST safely archive
          await supabaseAdmin
            .from('Customer')
            .update({
              archived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: req.user!.name || req.user!.email,
              updatedAt: new Date().toISOString(),
            })
            .eq('id', id);

          archivedCount++;
          detailsList.push({
            id,
            customerId: customer.customerId,
            action: 'ARCHIVED',
            reason: `${repairCount || 0} associated repair(s) protected`,
          });
        } else {
          // Zero repairs
          if (userRole === 'SUPER_ADMIN' && permanent) {
            await supabaseAdmin.from('Customer').delete().eq('id', id);
            deletedCount++;
            detailsList.push({
              id,
              customerId: customer.customerId,
              action: 'DELETED',
              reason: 'Zero repairs; permanent deletion executed by Super Admin',
            });
          } else {
            await supabaseAdmin
              .from('Customer')
              .update({
                archived: true,
                archivedAt: new Date().toISOString(),
                archivedBy: req.user!.name || req.user!.email,
                updatedAt: new Date().toISOString(),
              })
              .eq('id', id);

            archivedCount++;
            detailsList.push({
              id,
              customerId: customer.customerId,
              action: 'ARCHIVED',
              reason: userRole === 'SUPER_ADMIN' ? 'Archived by request' : 'Archived (permanent delete requires Super Admin)',
            });
          }
        }
      } catch (itemErr) {
        console.error(`[BULK DELETE ITEM ERROR] id: ${id}`, itemErr);
        skippedCount++;
      }
    }

    await logAudit({
      userId: req.user!.id,
      action: 'CUSTOMER_BULK_ACTION',
      resource: 'Customer',
      details: {
        totalRequested: customerIds.length,
        archivedCount,
        deletedCount,
        skippedCount,
        detailsList,
      },
    });

    await broadcastServerChange('Customer', 'UPDATE', 'bulk', { archivedCount, deletedCount });

    return res.json({
      success: true,
      processedCount: customerIds.length,
      archivedCount,
      deletedCount,
      skippedCount,
      summary: {
        total: customerIds.length,
        archived: archivedCount,
        permanentlyDeleted: deletedCount,
        skipped: skippedCount,
      },
      message: `Processed ${customerIds.length} customer records: ${archivedCount} archived, ${deletedCount} permanently deleted.`,
    });
  } catch (err: any) {
    console.error('[BULK DELETE ERROR]', err);
    return res.status(500).json({ error: 'Failed to process bulk customer deletion.' });
  }
});

export default router;
