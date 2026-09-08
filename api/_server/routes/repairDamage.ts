import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createExcelBuffer } from '../services/excelService';
import {
  queryDamageRecords,
  getDamageOverviewMetrics,
  getDamageRecordById,
  createDamageRecord,
  updateDamageRecord,
  archiveDamageRecord,
  getNepalDateTime,
} from '../services/damageStorage';

const router = Router();

// Helper to check if role has team-wide management/view privileges
function isElevatedRole(role?: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role || '');
}

// Helper to check if role can edit/delete damage records (Super Admin & Admin only)
function canModifyDamage(role?: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(role || '');
}

// =========================================================================
// 1. GET /api/repair-damage/server-time
// =========================================================================
router.get('/server-time', authenticate, (_req: AuthRequest, res: Response) => {
  const npt = getNepalDateTime();
  return res.json({
    success: true,
    timezone: 'Asia/Kathmandu (NPT, UTC+5:45)',
    date: npt.date,
    time: npt.time,
    iso: npt.iso,
  });
});

// =========================================================================
// 2. GET /api/repair-damage/overview
// =========================================================================
router.get('/overview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let staffScope: string | undefined;

    // Strict RBAC: Technicians and Receptionists only see their own metrics
    if (!isElevatedRole(userRole)) {
      staffScope = userId;
    } else if (req.query.staffId && req.query.staffId !== 'ALL') {
      staffScope = String(req.query.staffId);
    }

    const overview = await getDamageOverviewMetrics(staffScope);

    return res.json({
      success: true,
      role: userRole,
      isScopedToSelf: !isElevatedRole(userRole),
      ...overview,
    });
  } catch (err: any) {
    console.error('[DAMAGE OVERVIEW ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate repair-related damage overview.' });
  }
});

// =========================================================================
// 3. GET /api/repair-damage/components
// =========================================================================
router.get('/components', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const standardComponents = [
      'Display Panel',
      'OCA Glass',
      'Touch Screen Digitizer',
      'AMOLED Display',
      'LCD Screen',
      'Flex Cable',
      'Camera Module (Rear)',
      'Camera Module (Front)',
      'Camera Lens Glass',
      'Back Housing / Cover',
      'Charging Port PCB',
      'Battery',
      'Motherboard / PCB',
      'Power IC',
      'Audio IC',
      'Speaker / Earpiece',
      'Microphone',
      'Fingerprint Sensor',
      'SIM Tray / Reader',
      'Screw / Internal Bracket',
      'Other Component',
    ];
    return res.json(standardComponents);
  } catch (err: any) {
    return res.json(['Display Panel', 'OCA Glass', 'Flex Cable', 'Camera Lens', 'Back Housing', 'Power IC', 'Other']);
  }
});

// =========================================================================
// 4. GET /api/repair-damage
// =========================================================================
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let targetStaffId = req.query.staffId ? String(req.query.staffId) : undefined;

    // Strict RBAC & IDOR Prevention:
    // Technicians, Head Technicians, and Receptionists can ONLY query their own records.
    if (!isElevatedRole(userRole)) {
      targetStaffId = userId;
    }

    const {
      role,
      component,
      damageType,
      date,
      month,
      year,
      startDate,
      endDate,
      search,
      limit = '100',
      offset = '0',
    } = req.query;

    const result = await queryDamageRecords({
      staffId: targetStaffId,
      role: role && role !== 'ALL' ? String(role) : undefined,
      component: component && component !== 'ALL' ? String(component) : undefined,
      damageType: damageType && damageType !== 'ALL' ? String(damageType) : undefined,
      date: date ? String(date) : undefined,
      month: month ? String(month) : undefined,
      year: year ? String(year) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      search: search ? String(search) : undefined,
      limit: parseInt(limit as string, 10) || 100,
      offset: parseInt(offset as string, 10) || 0,
    });

    // Provide backward compatible response (array) with pagination headers
    res.setHeader('X-Total-Count', result.total.toString());
    return res.json(result.records);
  } catch (err: any) {
    console.error('[QUERY DAMAGE RECORDS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve repair-related damage records.' });
  }
});

// =========================================================================
// 5. GET /api/repair-damage/:id
// =========================================================================
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const record = await getDamageRecordById(id);
    if (!record || record.isArchived) {
      return res.status(404).json({ error: 'Repair-related damage record not found.' });
    }

    // Strict RBAC: If not Super Admin / Admin / Manager, user can only access their own record
    if (!isElevatedRole(userRole)) {
      if (record.staffId !== userId && record.recordedById !== userId) {
        return res.status(403).json({
          error: 'Access Forbidden: You are not authorized to view another staff member\'s damage record.',
        });
      }
    }

    return res.json(record);
  } catch (err: any) {
    console.error('[GET DAMAGE BY ID ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch damage record details.' });
  }
});

// =========================================================================
// 6. POST /api/repair-damage (Record New Damage)
// =========================================================================
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const actor = {
      id: req.user!.id,
      name: req.user!.name || 'Staff Member',
      role: req.user!.role || 'MANAGER',
    };

    // RBAC: Only Super Admin, Admin, and Manager can create damage records
    if (!isElevatedRole(userRole)) {
      return res.status(403).json({
        error: 'Permission Denied: Only Managers, Admins, and Super Admins are authorized to record damage incidents.',
      });
    }

    const {
      staffId,
      damagedComponent,
      damageType = 'ACCIDENTAL',
      damageDescription,
      repairId,
      repairNumber,
      customerId,
      customerName,
      deviceBrand,
      deviceModel,
      damageDate,
      damageTime,
      quantity = 1,
      estimatedCost,
      notes,
      inventoryItemId,
      deductInventory = false,
      branchId,
    } = req.body;

    // Strict Validation
    if (!staffId) {
      return res.status(400).json({ error: 'Missing required field: staffId (Responsible staff member).' });
    }

    if (!damagedComponent || !damagedComponent.trim()) {
      return res.status(400).json({ error: 'Missing required field: damagedComponent.' });
    }

    if (!damageDescription || damageDescription.trim().length < 3) {
      return res.status(400).json({ error: 'Damage description is required (minimum 3 characters).' });
    }

    const createdRecord = await createDamageRecord(
      {
        staffId,
        damagedComponent,
        damageType,
        damageDescription,
        repairId,
        repairNumber,
        customerId,
        customerName,
        deviceBrand,
        deviceModel,
        damageDate,
        damageTime,
        quantity: parseInt(String(quantity), 10) || 1,
        estimatedCost: estimatedCost !== undefined && estimatedCost !== null && !isNaN(Number(estimatedCost))
          ? Number(estimatedCost)
          : null,
        notes,
        inventoryItemId,
        deductInventory: Boolean(deductInventory),
        branchId,
      },
      actor
    );

    return res.status(201).json(createdRecord);
  } catch (err: any) {
    console.error('[CREATE DAMAGE ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to record damage incident.' });
  }
});

// =========================================================================
// 7. PATCH /api/repair-damage/:id (Update Damage Record - SUPER_ADMIN / ADMIN ONLY)
// =========================================================================
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const actor = {
      id: req.user!.id,
      name: req.user!.name || 'Administrator',
      role: req.user!.role || 'ADMIN',
    };

    // RBAC: Strictly restricted to SUPER_ADMIN and ADMIN
    // Manager CANNOT edit existing damage records.
    if (!canModifyDamage(userRole)) {
      return res.status(403).json({
        error: 'Permission Denied: Managers and technicians are not authorized to edit or modify existing damage records. Only Admins and Super Admins can update records.',
      });
    }

    const { id } = req.params;
    const {
      damagedComponent,
      damageType,
      damageDescription,
      deviceBrand,
      deviceModel,
      repairNumber,
      damageDate,
      damageTime,
      quantity,
      estimatedCost,
      notes,
      status,
      auditReason,
    } = req.body;

    const updatedRecord = await updateDamageRecord(
      id,
      {
        damagedComponent,
        damageType,
        damageDescription,
        deviceBrand,
        deviceModel,
        repairNumber,
        damageDate,
        damageTime,
        quantity,
        estimatedCost,
        notes,
        status,
        auditReason: auditReason || 'Damage record details modified by Administrator',
      },
      actor
    );

    return res.json(updatedRecord);
  } catch (err: any) {
    console.error('[UPDATE DAMAGE ERROR]', err);
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Failed to update damage record.' });
  }
});

// =========================================================================
// 8. DELETE /api/repair-damage/:id (Archive Damage Record - SUPER_ADMIN / ADMIN ONLY)
// =========================================================================
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const actor = {
      id: req.user!.id,
      name: req.user!.name || 'Administrator',
      role: req.user!.role || 'ADMIN',
    };

    // RBAC: Strictly restricted to SUPER_ADMIN and ADMIN
    // Manager CANNOT delete or archive damage records.
    if (!canModifyDamage(userRole)) {
      return res.status(403).json({
        error: 'Permission Denied: Managers and technicians are not authorized to delete damage records. Only Admins and Super Admins can archive records.',
      });
    }

    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason ? String(req.body?.reason || req.query?.reason) : 'Record safely archived by Administrator';

    const result = await archiveDamageRecord(id, actor, reason);
    return res.json(result);
  } catch (err: any) {
    console.error('[ARCHIVE DAMAGE ERROR]', err);
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Failed to archive damage record.' });
  }
});

// =========================================================================
// 9. GET /api/repair-damage/export
// =========================================================================
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let targetStaffId = req.query.staffId ? String(req.query.staffId) : undefined;
    if (!isElevatedRole(userRole)) {
      targetStaffId = userId;
    }

    const { role, component, damageType, date, month, year, startDate, endDate, search } = req.query;

    const result = await queryDamageRecords({
      staffId: targetStaffId,
      role: role && role !== 'ALL' ? String(role) : undefined,
      component: component && component !== 'ALL' ? String(component) : undefined,
      damageType: damageType && damageType !== 'ALL' ? String(damageType) : undefined,
      date: date ? String(date) : undefined,
      month: month ? String(month) : undefined,
      year: year ? String(year) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      search: search ? String(search) : undefined,
      limit: 1000,
    });

    const rows = result.records.map((r: any) => ({
      'Record #': r.recordNumber,
      'Staff Name': r.staffName,
      'Role': r.staffRole?.replace(/_/g, ' '),
      'Damaged Component': r.damagedComponent,
      'Damage Type': r.damageType || 'Accidental',
      'Device Model': `${r.deviceBrand || ''} ${r.deviceModel || ''}`.trim() || '—',
      'Repair Job #': r.repairNumber ? `#${r.repairNumber}` : '—',
      'Incident Date': r.damageDate,
      'Incident Time': r.damageTime || '—',
      'Quantity': r.quantity || 1,
      'Estimated Cost (NPR)': r.estimatedCost !== null && r.estimatedCost !== undefined ? Number(r.estimatedCost) : '—',
      'Damage Description': r.damageDescription,
      'Recorded By': `${r.recordedByName || 'System'} (${r.recordedByRole || 'MANAGER'})`,
      'Status': r.status || 'ACTIVE',
    }));

    const buffer = createExcelBuffer('Repair Damage Log', rows);
    const nptDate = getNepalDateTime().date;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Repair_Damage_${nptDate}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[EXPORT DAMAGE ERROR]', err);
    return res.status(500).json({ error: 'Failed to export damage records.' });
  }
});

export default router;
