import { Router, Request, Response } from 'express';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createExcelBuffer } from '../services/excelService';

const router = Router();

// Helper to generate damage record number (RRD-YYYY-XXXX)
async function generateRecordNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: records } = await supabaseAdmin
    .from('RepairRelatedDamage')
    .select('recordNumber')
    .ilike('recordNumber', `RRD-${currentYear}-%`)
    .order('recordNumber', { ascending: false })
    .limit(10);

  let maxNum = 0;
  if (records && records.length > 0) {
    for (const r of records) {
      if (!r.recordNumber) continue;
      const match = r.recordNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `RRD-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

// 1. GET /api/repair-damage/overview
router.get('/overview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: records } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .select('*')
      .eq('isArchived', false);

    let totalRecords = 0;
    let totalEstimatedCost = 0;
    let totalDeductions = 0;
    const componentCounts: Record<string, number> = {};

    (records || []).forEach((r: any) => {
      totalRecords++;
      totalEstimatedCost += Number(r.estimatedCost || 0);
      if (r.inventoryDeducted) totalDeductions++;

      const comp = r.damagedComponent || 'Other';
      componentCounts[comp] = (componentCounts[comp] || 0) + 1;
    });

    return res.json({
      totalRecords,
      totalEstimatedCost,
      totalDeductions,
      componentCounts,
      records: (records || []).slice(0, 10),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate damage overview.' });
  }
});

// 2. GET /api/repair-damage/components
router.get('/components', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: records } = await supabaseAdmin.from('RepairRelatedDamage').select('damagedComponent');
    const components = Array.from(new Set((records || []).map((r: any) => r.damagedComponent).filter(Boolean)));
    return res.json(components.length > 0 ? components : ['Display Panel', 'OCA Glass', 'Flex Cable', 'Camera Lens', 'Back Housing', 'Power IC', 'Other']);
  } catch (err: any) {
    return res.json(['Display Panel', 'OCA Glass', 'Flex Cable', 'Camera Lens', 'Back Housing', 'Power IC', 'Other']);
  }
});

// 3. GET /api/repair-damage
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, role, component, month, startDate, endDate, search, limit = '100' } = req.query;
    let query = supabaseAdmin.from('RepairRelatedDamage').select('*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role, department)');

    query = query.eq('isArchived', false);

    if (staffId && staffId !== 'ALL') query = query.eq('staffId', String(staffId));
    if (role && role !== 'ALL') query = query.eq('staffRole', String(role));
    if (component && component !== 'ALL') query = query.eq('damagedComponent', String(component));

    if (month) {
      query = query.ilike('damageDate', `${month}%`);
    } else if (startDate || endDate) {
      if (startDate) query = query.gte('damageDate', String(startDate));
      if (endDate) query = query.lte('damageDate', String(endDate));
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`recordNumber.ilike.%${s}%,staffName.ilike.%${s}%,repairNumber.ilike.%${s}%,deviceModel.ilike.%${s}%`);
    }

    const { data: records, error } = await query
      .order('damageDate', { ascending: false })
      .limit(parseInt(limit as string, 10) || 100);

    if (error) {
      console.error('[REPAIR DAMAGE ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch damage records.' });
    }

    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve damage records.' });
  }
});

// 4. GET /api/repair-damage/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: record, error } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .select('*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role), audits:RepairRelatedDamageAudit(*)')
      .eq('id', id)
      .single();

    if (error || !record) return res.status(404).json({ error: 'Record not found.' });

    return res.json(record);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch record.' });
  }
});

// 5. POST /api/repair-damage
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      staffId,
      staffName,
      staffRole,
      damagedComponent,
      damageType = 'ACCIDENTAL',
      deviceBrand,
      deviceModel,
      repairNumber,
      customerName,
      damageDate,
      damageTime,
      quantity = 1,
      estimatedCost = 0,
      damageDescription,
      inventoryDeducted = false,
      notes,
    } = req.body;

    const recordNumber = await generateRecordNumber();
    const newRecord = {
      id: uuidv4(),
      recordNumber,
      staffId: staffId || req.user!.id,
      staffName: staffName || req.user!.name,
      staffRole: staffRole || req.user!.role,
      damagedComponent: damagedComponent || 'Component',
      damageType,
      deviceBrand: deviceBrand || null,
      deviceModel: deviceModel || null,
      repairNumber: repairNumber || null,
      customerName: customerName || null,
      damageDate: damageDate || new Date().toISOString().split('T')[0],
      damageTime: damageTime || new Date().toTimeString().split(' ')[0],
      quantity: parseInt(quantity, 10) || 1,
      estimatedCost: parseFloat(estimatedCost) || 0,
      damageDescription: damageDescription || 'Internal damage incident recorded',
      inventoryDeducted: Boolean(inventoryDeducted),
      status: 'RECORDED',
      notes: notes || null,
      recordedById: req.user!.id,
      recordedByName: req.user!.name,
      recordedByRole: req.user!.role,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('RepairRelatedDamage').insert([newRecord]).select('*').single();

    if (error) {
      console.error('[DAMAGE INSERT ERROR]', error);
      return res.status(500).json({ error: 'Failed to record damage incident.' });
    }

    await broadcastServerChange('RepairRelatedDamage', 'CREATE', created.id, created);

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save damage record.' });
  }
});

// 6. PATCH /api/repair-damage/:id
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;
    delete updateData.staff;
    delete updateData.audits;

    const { data: updated, error } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update record.' });

    await broadcastServerChange('RepairRelatedDamage', 'UPDATE', id, updated);

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update damage record.' });
  }
});

// 7. DELETE /api/repair-damage/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .update({ isArchived: true, status: 'ARCHIVED', updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to archive record.' });

    await broadcastServerChange('RepairRelatedDamage', 'DELETE', id);

    return res.json({ success: true, message: 'Damage record archived.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to archive damage record.' });
  }
});

// 8. GET /api/repair-damage/export
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: records } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .select('*')
      .eq('isArchived', false)
      .order('damageDate', { ascending: false });

    const rows = (records || []).map((r: any) => ({
      'Record ID': r.recordNumber,
      'Staff Name': r.staffName,
      'Role': r.staffRole,
      'Damaged Component': r.damagedComponent,
      'Damage Type': r.damageType,
      'Device Model': `${r.deviceBrand || ''} ${r.deviceModel || ''}`.trim(),
      'Repair Ticket': r.repairNumber || '—',
      'Date': r.damageDate,
      'Quantity': r.quantity,
      'Estimated Cost (NPR)': r.estimatedCost,
      'Description': r.damageDescription,
      'Recorded By': r.recordedByName,
    }));

    const buffer = createExcelBuffer('Repair Damage', rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Repair_Damage_${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export damage records.' });
  }
});

export default router;
