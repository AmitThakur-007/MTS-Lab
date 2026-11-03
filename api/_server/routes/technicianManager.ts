import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize, normalizeRole } from '../middleware/rbac';
import { logAuditFromRequest } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';
import { createNotification } from '../services/notificationStorage';
import {
  getAllTransferRequests,
  getTransferRequestById,
  respondToTransferRequest,
  directTransferRepair,
  cancelTransferRequest
} from '../services/repairTransferService';
import {
  getNptIsoBoundsForPreset,
  DateFilterPreset,
  NEPAL_TIMEZONE
} from '../services/repairStatsService';

const router = Router();

// Strictly guard entire router for SUPER_ADMIN, ADMIN, and MANAGER roles
router.use(authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']));

export const TECHNICIAN_ROLES = [
  'HEAD_TECHNICIAN',
  'LEAD_TECHNICIAN',
  'TECHNICIAN',
  'TECHNICAL_ASSISTANT'
];

const TERMINAL_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'ARCHIVED', 'CLOSED']);
const COMPLETED_STATUSES = new Set(['REPAIRED', 'REPROBLEM_FIXED', 'READY_FOR_PICKUP', 'DELIVERED']);
const IN_PROGRESS_STATUSES = new Set(['IN_PROCESS', 'IN_PROGRESS', 'TESTING']);
const PENDING_STATUSES = new Set(['PENDING', 'DIAGNOSING']);
const WAITING_PARTS_STATUSES = new Set(['WAITING_FOR_PARTS']);

/**
 * Categorizes device brand and model into standardized MTS Lab hardware types
 */
function categorizeDevice(brand?: string | null, model?: string | null): 'IPHONE' | 'SMARTPHONE' | 'IPAD' | 'TABLET' | 'LAPTOP' | 'TV' {
  const b = (brand || '').toLowerCase();
  const m = (model || '').toLowerCase();

  if (m.includes('tv') || m.includes('television') || m.includes('bravia') || m.includes('oled') || m.includes('smart tv')) {
    return 'TV';
  }
  if (m.includes('laptop') || m.includes('macbook') || m.includes('thinkpad') || m.includes('notebook') || m.includes('dell xps')) {
    return 'LAPTOP';
  }
  if (m.includes('ipad') || (b.includes('apple') && m.includes('pad'))) {
    return 'IPAD';
  }
  if (m.includes('tablet') || m.includes('tab') || m.includes('galaxy tab')) {
    return 'TABLET';
  }
  if (b.includes('apple') || m.includes('iphone')) {
    return 'IPHONE';
  }
  return 'SMARTPHONE';
}

/**
 * Calculates workload level and label based on verified active repair count
 */
function calculateWorkloadStatus(activeCount: number): {
  status: 'AVAILABLE' | 'NORMAL' | 'HEAVY' | 'OVERLOADED';
  label: string;
  badgeClass: string;
  dotColor: string;
} {
  if (activeCount <= 2) {
    return {
      status: 'AVAILABLE',
      label: 'Available',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      dotColor: 'bg-emerald-500'
    };
  }
  if (activeCount <= 6) {
    return {
      status: 'NORMAL',
      label: 'Normal Workload',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      dotColor: 'bg-blue-500'
    };
  }
  if (activeCount <= 9) {
    return {
      status: 'HEAVY',
      label: 'Heavy Workload',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      dotColor: 'bg-amber-500'
    };
  }
  return {
    status: 'OVERLOADED',
    label: 'Overloaded',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    dotColor: 'bg-rose-500'
  };
}

// ============================================================================
// 1. GET /api/technician-manager/overview
// Provides real-time workload statistics, active technician queues & overview
// ============================================================================
router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    // 1. Fetch all active technicians
    const { data: techUsers, error: techErr } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, phoneNumber, department, profileImage, isActive, lastLoginAt, createdAt')
      .is('deletedAt', null)
      .in('role', TECHNICIAN_ROLES)
      .order('name', { ascending: true });

    if (techErr) {
      console.error('[TECH MANAGER OVERVIEW] Failed to query technicians:', techErr);
      return res.status(500).json({ error: 'Failed to retrieve technician directory.' });
    }

    const techniciansList = (techUsers || []).filter(u => u.isActive !== false);

    // 2. Fetch all repairs that are not archived/cancelled or belong to current queues
    const { data: allRepairs, error: repairErr } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, status, priority, technicianId, customerName, customerPhone, deviceBrand, deviceModel, problemDescription, createdAt, updatedAt, assignedAt, assignedByName')
      .order('updatedAt', { ascending: false });

    if (repairErr) {
      console.error('[TECH MANAGER OVERVIEW] Failed to query repairs:', repairErr);
      return res.status(500).json({ error: 'Failed to retrieve repair data.' });
    }

    // 3. Fetch all transfer requests from service
    const transferRequests = await getAllTransferRequests();
    const pendingTransfers = transferRequests.filter(t => t.status === 'PENDING');

    // Maps for fast technician lookup & aggregations
    const techMap = new Map<string, any>();
    techniciansList.forEach(t => {
      techMap.set(t.id, {
        ...t,
        assignedRepairsCount: 0,
        activeRepairsCount: 0,
        pendingCount: 0,
        inProgressCount: 0,
        waitingForPartsCount: 0,
        completedCount: 0,
        highPriorityCount: 0,
        urgentCount: 0,
        deviceCategories: {
          IPHONE: 0,
          SMARTPHONE: 0,
          IPAD: 0,
          TABLET: 0,
          LAPTOP: 0,
          TV: 0,
        },
        latestRepair: null as any,
        activeRepairs: [] as any[],
      });
    });

    let totalAssignedRepairs = 0;
    let unassignedRepairsCount = 0;
    let pendingRepairsCount = 0;
    let inProgressRepairsCount = 0;
    let waitingForPartsCount = 0;
    let completedRepairsCount = 0;
    let highPriorityRepairsCount = 0;
    let urgentRepairsCount = 0;

    (allRepairs || []).forEach(r => {
      const priority = (r.priority || 'NORMAL').toUpperCase();
      const status = (r.status || 'PENDING').toUpperCase();
      const isTerminal = TERMINAL_STATUSES.has(status);
      const isCompleted = COMPLETED_STATUSES.has(status);
      const isUrgent = priority === 'URGENT';
      const isHigh = priority === 'HIGH';

      if (isUrgent) urgentRepairsCount++;
      if (isHigh || isUrgent) highPriorityRepairsCount++;

      if (PENDING_STATUSES.has(status)) pendingRepairsCount++;
      if (IN_PROGRESS_STATUSES.has(status)) inProgressRepairsCount++;
      if (WAITING_PARTS_STATUSES.has(status)) waitingForPartsCount++;
      if (isCompleted) completedRepairsCount++;

      if (!r.technicianId) {
        if (!isTerminal) {
          unassignedRepairsCount++;
        }
      } else {
        totalAssignedRepairs++;
        const techData = techMap.get(r.technicianId);
        if (techData) {
          techData.assignedRepairsCount++;

          if (isCompleted) {
            techData.completedCount++;
          }

          if (!isTerminal) {
            techData.activeRepairsCount++;

            if (PENDING_STATUSES.has(status)) techData.pendingCount++;
            if (IN_PROGRESS_STATUSES.has(status)) techData.inProgressCount++;
            if (WAITING_PARTS_STATUSES.has(status)) techData.waitingForPartsCount++;
            if (isHigh || isUrgent) techData.highPriorityCount++;
            if (isUrgent) techData.urgentCount++;

            const cat = categorizeDevice(r.deviceBrand, r.deviceModel);
            techData.deviceCategories[cat] = (techData.deviceCategories[cat] || 0) + 1;

            if (!techData.latestRepair) {
              techData.latestRepair = {
                id: r.id,
                repairNumber: r.repairNumber,
                deviceBrand: r.deviceBrand,
                deviceModel: r.deviceModel,
                status: r.status,
                priority: r.priority,
                updatedAt: r.updatedAt,
              };
            }

            if (techData.activeRepairs.length < 15) {
              techData.activeRepairs.push({
                id: r.id,
                repairNumber: r.repairNumber,
                customerName: r.customerName,
                customerPhone: r.customerPhone,
                deviceBrand: r.deviceBrand,
                deviceModel: r.deviceModel,
                category: cat,
                problemDescription: r.problemDescription,
                status: r.status,
                priority: r.priority,
                assignedAt: r.assignedAt,
                updatedAt: r.updatedAt,
              });
            }
          }
        }
      }
    });

    // Compute workload status and summary indicators for all technicians
    let availableTechnicians = 0;
    let workingTechnicians = 0;
    let overloadedTechnicians = 0;

    const enrichedTechnicians = Array.from(techMap.values()).map(tech => {
      const workloadInfo = calculateWorkloadStatus(tech.activeRepairsCount);
      if (workloadInfo.status === 'AVAILABLE') availableTechnicians++;
      if (tech.activeRepairsCount > 0) workingTechnicians++;
      if (workloadInfo.status === 'OVERLOADED') overloadedTechnicians++;

      return {
        ...tech,
        workloadStatus: workloadInfo.status,
        workloadLabel: workloadInfo.label,
        workloadBadgeClass: workloadInfo.badgeClass,
        workloadDotColor: workloadInfo.dotColor,
      };
    });

    const summary = {
      totalTechnicians: techniciansList.length,
      availableTechnicians,
      workingTechnicians,
      overloadedTechnicians,
      totalAssignedRepairs,
      unassignedRepairsCount,
      pendingRepairsCount,
      inProgressRepairsCount,
      waitingForPartsCount,
      completedRepairsCount,
      pendingTransferRequestsCount: pendingTransfers.length,
      highPriorityRepairsCount,
      urgentRepairsCount,
    };

    return res.json({
      summary,
      technicians: enrichedTechnicians,
      pendingTransfersCount: pendingTransfers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[TECH MANAGER OVERVIEW ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate technician manager overview.' });
  }
});

// ============================================================================
// 2. GET /api/technician-manager/transfers
// Retrieves all repair transfer requests with full device & technician metadata
// ============================================================================
router.get('/transfers', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, preset, startDate, endDate } = req.query;

    const allRequests = await getAllTransferRequests();

    // Fetch related repairs for rich display
    const repairIds = Array.from(new Set(allRequests.map(t => t.repairId).filter(Boolean)));
    const repairMap = new Map<string, any>();

    if (repairIds.length > 0) {
      const { data: repairsData } = await supabaseAdmin
        .from('Repair')
        .select('id, repairNumber, deviceBrand, deviceModel, customerName, customerPhone, status, priority')
        .in('id', repairIds);

      (repairsData || []).forEach(r => {
        repairMap.set(r.id, r);
      });
    }

    // Apply Date Range Filter if requested
    let bounds: { startIso: string | null; endIso: string | null } = { startIso: null, endIso: null };
    if (preset && preset !== 'ALL') {
      bounds = getNptIsoBoundsForPreset(
        preset as DateFilterPreset,
        startDate ? String(startDate) : undefined,
        endDate ? String(endDate) : undefined
      );
    }

    let filtered = allRequests.map(t => {
      const repairInfo = repairMap.get(t.repairId) || {};
      const cat = categorizeDevice(repairInfo.deviceBrand, repairInfo.deviceModel);
      return {
        ...t,
        customerName: repairInfo.customerName || 'Customer',
        customerPhone: repairInfo.customerPhone || '',
        deviceBrand: repairInfo.deviceBrand || '',
        deviceModel: repairInfo.deviceModel || '',
        deviceCategory: cat,
        repairStatus: repairInfo.status || 'PENDING',
        priority: repairInfo.priority || 'NORMAL',
      };
    });

    // 1. Status Filter
    if (status && status !== 'ALL') {
      filtered = filtered.filter(t => t.status === String(status).toUpperCase());
    }

    // 2. Date Filter
    if (bounds.startIso) {
      filtered = filtered.filter(t => {
        const time = new Date(t.createdAt).getTime();
        const start = new Date(bounds.startIso!).getTime();
        const end = bounds.endIso ? new Date(bounds.endIso).getTime() : Infinity;
        return time >= start && time <= end;
      });
    }

    // 3. Search Filter
    if (search && String(search).trim() !== '') {
      const q = String(search).toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.repairNumber.toLowerCase().includes(q) ||
        t.senderTechnicianName.toLowerCase().includes(q) ||
        t.targetTechnicianName.toLowerCase().includes(q) ||
        t.reason.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.customerPhone.toLowerCase().includes(q) ||
        t.deviceModel.toLowerCase().includes(q) ||
        t.deviceBrand.toLowerCase().includes(q)
      );
    }

    return res.json({
      transfers: filtered,
      totalCount: filtered.length,
      pendingCount: allRequests.filter(t => t.status === 'PENDING').length,
      acceptedCount: allRequests.filter(t => t.status === 'ACCEPTED').length,
      rejectedCount: allRequests.filter(t => t.status === 'REJECTED').length,
      cancelledCount: allRequests.filter(t => t.status === 'CANCELLED').length,
    });
  } catch (err: any) {
    console.error('[TECH MANAGER TRANSFERS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve transfer requests.' });
  }
});

// ============================================================================
// 3. POST /api/technician-manager/transfers/:id/respond
// Approves or Rejects a transfer request with reason & notification
// ============================================================================
router.post('/transfers/:id/respond', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, responseNote } = req.body;

    if (!action || (action !== 'ACCEPT' && action !== 'REJECT')) {
      return res.status(400).json({ error: "Action must be 'ACCEPT' or 'REJECT'." });
    }

    if (action === 'REJECT' && (!responseNote || responseNote.trim().length < 2)) {
      return res.status(400).json({ error: 'Please provide a clear reason when rejecting a transfer request.' });
    }

    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user!.id,
      responderName: req.user!.name,
      responderRole: req.user!.role,
      action,
      responseNote: responseNote?.trim(),
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json({
      success: true,
      message: action === 'ACCEPT' ? 'Transfer request approved successfully.' : 'Transfer request rejected.',
      data: result.data,
    });
  } catch (err: any) {
    console.error('[TECH MANAGER RESPOND TRANSFER ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to process transfer request.' });
  }
});

// ============================================================================
// 4. POST /api/technician-manager/direct-transfer
// Direct management transfer (Manager / Admin immediate reassignment)
// ============================================================================
router.post('/direct-transfer', async (req: AuthRequest, res: Response) => {
  try {
    const { repairId, targetTechnicianId, reason, priority } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: 'Repair ID is required.' });
    }

    if (!targetTechnicianId) {
      return res.status(400).json({ error: 'Please select a destination technician.' });
    }

    if (!reason || reason.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide a reason or note for this management reassignment.' });
    }

    const result = await directTransferRepair({
      repairId,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      targetTechnicianId,
      reason: reason.trim(),
      priority,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    return res.json(result.data);
  } catch (err: any) {
    console.error('[TECH MANAGER DIRECT TRANSFER ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to reassign repair.' });
  }
});

// ============================================================================
// 5. POST /api/technician-manager/assign
// Assign or unassign a repair with confirmation details & audit trail
// ============================================================================
router.post('/assign', async (req: AuthRequest, res: Response) => {
  try {
    const { repairId, technicianId, notes, priority } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: 'Repair ID is required.' });
    }

    const normalizedTechId = (technicianId && String(technicianId).trim() !== '' && String(technicianId).toLowerCase() !== 'unassigned')
      ? String(technicianId).trim()
      : null;

    let targetTech: any = null;
    if (normalizedTechId) {
      const { data: tech, error: techErr } = await supabaseAdmin
        .from('User')
        .select('id, name, role, email, isActive')
        .eq('id', normalizedTechId)
        .single();

      if (techErr || !tech || tech.isActive === false) {
        return res.status(400).json({ error: 'Selected technician was not found or is currently inactive.' });
      }
      targetTech = tech;
    }

    // Fetch existing repair
    const { data: existingRepair, error: repairErr } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, status, priority, technicianId, assignedByName, deviceBrand, deviceModel, customerName')
      .eq('id', repairId)
      .single();

    if (repairErr || !existingRepair) {
      return res.status(404).json({ error: 'Repair workorder not found.' });
    }

    const now = new Date().toISOString();
    const updatePayload: any = {
      technicianId: normalizedTechId,
      assignedAt: normalizedTechId ? now : null,
      assignedById: normalizedTechId ? req.user!.id : null,
      assignedByName: normalizedTechId ? req.user!.name : null,
      updatedAt: now,
    };

    if (priority && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority.toUpperCase())) {
      updatePayload.priority = priority.toUpperCase();
      updatePayload.priorityUpdatedAt = now;
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('Repair')
      .update(updatePayload)
      .eq('id', repairId)
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)')
      .single();

    if (updateErr) {
      console.error('[ASSIGN TECH ERROR]', updateErr);
      return res.status(500).json({ error: 'Failed to update technician assignment in database.' });
    }

    // Record in RepairLog
    const logId = uuidv4();
    try {
      const logMessage = targetTech
        ? `Assigned to ${targetTech.name} (${targetTech.role.replace(/_/g, ' ')}) by ${req.user!.name}${notes ? `. Note: ${notes.trim()}` : ''}`
        : `Repair unassigned by ${req.user!.name}${notes ? `. Note: ${notes.trim()}` : ''}`;

      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId,
          status: updated.status,
          message: logMessage,
          createdAt: now,
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[REPAIR LOG NON FATAL]', logErr);
    }

    // Log Audit Trail
    await logAuditFromRequest(req, {
      action: normalizedTechId ? 'REPAIR_ASSIGNED' : 'REPAIR_UNASSIGNED',
      resource: 'Repair',
      resourceId: repairId,
      status: 'SUCCESS',
      details: {
        repairNumber: updated.repairNumber,
        newTechnicianId: normalizedTechId,
        newTechnicianName: targetTech?.name || null,
        previousTechnicianName: existingRepair.assignedByName || null,
        notes: notes || null,
        priority: updatePayload.priority || existingRepair.priority,
      },
      previousValue: {
        technicianId: existingRepair.technicianId,
        technicianName: existingRepair.assignedByName,
      },
      newValue: {
        technicianId: normalizedTechId,
        technicianName: targetTech?.name || null,
      },
    });

    // Notify newly assigned technician
    if (targetTech) {
      try {
        const isUrgent = (updatePayload.priority || updated.priority) === 'URGENT';
        const isHigh = (updatePayload.priority || updated.priority) === 'HIGH';
        const emoji = isUrgent ? '🔴' : isHigh ? '🟠' : '📋';

        await createNotification({
          userId: targetTech.id,
          title: `${emoji} ${isUrgent ? 'Urgent Repair Assigned' : 'Repair Assigned'}: #${updated.repairNumber}`,
          message: `${updated.deviceBrand || ''} ${updated.deviceModel || ''} (${updated.customerName || 'Customer'}) was assigned to your bench by ${req.user!.name}.${notes ? ` Instructions: ${notes.trim()}` : ''}`,
          type: isUrgent ? 'REPAIR_URGENT' : 'REPAIR_ASSIGNED',
          priority: (updatePayload.priority || updated.priority || 'NORMAL') as any,
          repairId: updated.id,
          repairNumber: updated.repairNumber,
          senderId: req.user!.id,
          senderName: req.user!.name,
          senderRole: req.user!.role,
        });
      } catch (notifErr) {
        console.warn('[ASSIGN NOTIF WARN]', notifErr);
      }
    }

    await broadcastServerChange('Repair', 'UPDATE', repairId, updated);

    return res.json({
      success: true,
      message: targetTech
        ? `Repair #${updated.repairNumber} successfully assigned to ${targetTech.name}.`
        : `Repair #${updated.repairNumber} is now unassigned.`,
      repair: updated,
    });
  } catch (err: any) {
    console.error('[TECH MANAGER ASSIGN ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to update repair assignment.' });
  }
});

// ============================================================================
// 6. POST /api/technician-manager/priority
// Update repair priority (LOW, NORMAL, HIGH, URGENT) with reason & alert
// ============================================================================
router.post('/priority', async (req: AuthRequest, res: Response) => {
  try {
    const { repairId, priority, reason } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: 'Repair ID is required.' });
    }

    const normalizedPriority = String(priority || '').toUpperCase().trim();
    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(normalizedPriority)) {
      return res.status(400).json({ error: "Priority must be one of: 'LOW', 'NORMAL', 'HIGH', 'URGENT'." });
    }

    const { data: existingRepair, error: repairErr } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, status, priority, technicianId, customerName, deviceBrand, deviceModel')
      .eq('id', repairId)
      .single();

    if (repairErr || !existingRepair) {
      return res.status(404).json({ error: 'Repair workorder not found.' });
    }

    const oldPriority = (existingRepair.priority || 'NORMAL').toUpperCase();
    const now = new Date().toISOString();

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('Repair')
      .update({
        priority: normalizedPriority,
        priorityUpdatedAt: now,
        updatedAt: now,
      })
      .eq('id', repairId)
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)')
      .single();

    if (updateErr) {
      console.error('[UPDATE PRIORITY ERROR]', updateErr);
      return res.status(500).json({ error: 'Failed to update repair priority in database.' });
    }

    // Log in RepairLog
    const logId = uuidv4();
    try {
      const priorityLabel: Record<string, string> = {
        URGENT: '🔴 URGENT',
        HIGH: '🟠 HIGH',
        NORMAL: '🔵 NORMAL',
        LOW: '⚪ LOW',
      };
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId,
          status: updated.status,
          message: `Priority changed from ${oldPriority} to ${priorityLabel[normalizedPriority] || normalizedPriority} by ${req.user!.name}${reason ? `. Reason: ${reason.trim()}` : ''}`,
          createdAt: now,
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[REPAIR LOG NON FATAL]', logErr);
    }

    // Audit log
    await logAuditFromRequest(req, {
      action: 'REPAIR_PRIORITY_CHANGED',
      resource: 'Repair',
      resourceId: repairId,
      status: 'SUCCESS',
      details: {
        repairNumber: updated.repairNumber,
        oldPriority,
        newPriority: normalizedPriority,
        reason: reason || null,
      },
      previousValue: { priority: oldPriority },
      newValue: { priority: normalizedPriority },
    });

    // Notify assigned technician if present
    if (updated.technicianId) {
      try {
        const priorityEmojis: Record<string, string> = {
          URGENT: '🔴',
          HIGH: '🟠',
          NORMAL: '🔵',
          LOW: '⚪',
        };
        const emoji = priorityEmojis[normalizedPriority] || '🔔';

        await createNotification({
          userId: updated.technicianId,
          title: `${emoji} Priority Updated to ${normalizedPriority}: #${updated.repairNumber}`,
          message: `Manager ${req.user!.name} changed priority of #${updated.repairNumber} (${updated.deviceBrand || ''} ${updated.deviceModel || ''}) to ${normalizedPriority}.${reason ? ` Note: ${reason.trim()}` : ''}`,
          type: normalizedPriority === 'URGENT' ? 'REPAIR_URGENT' : 'REPAIR_ALERT',
          priority: normalizedPriority as any,
          repairId: updated.id,
          repairNumber: updated.repairNumber,
          senderId: req.user!.id,
          senderName: req.user!.name,
          senderRole: req.user!.role,
        });
      } catch (notifErr) {
        console.warn('[PRIORITY NOTIF WARN]', notifErr);
      }
    }

    await broadcastServerChange('Repair', 'UPDATE', repairId, updated);

    return res.json({
      success: true,
      message: `Priority of repair #${updated.repairNumber} updated to ${normalizedPriority}.`,
      repair: updated,
    });
  } catch (err: any) {
    console.error('[TECH MANAGER PRIORITY ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to update repair priority.' });
  }
});

// ============================================================================
// 7. GET /api/technician-manager/repairs
// Search and filter repairs specifically for assignments and priority queues
// ============================================================================
router.get('/repairs', async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      category,
      technicianId,
      priority,
      status,
      assignmentFilter,
      preset,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query;

    const parsedLimit = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    let query = supabaseAdmin
      .from('Repair')
      .select('*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)', { count: 'exact' });

    // 1. Assignment Filter
    if (assignmentFilter === 'UNASSIGNED') {
      query = query.is('technicianId', null);
    } else if (assignmentFilter === 'ASSIGNED') {
      query = query.not('technicianId', 'is', null);
    }

    // 2. Technician Filter
    if (technicianId && technicianId !== 'ALL') {
      if (technicianId === 'UNASSIGNED') {
        query = query.is('technicianId', null);
      } else {
        query = query.eq('technicianId', String(technicianId));
      }
    }

    // 3. Priority Filter
    if (priority && priority !== 'ALL') {
      query = query.eq('priority', String(priority).toUpperCase());
    }

    // 4. Status Filter
    if (status && status !== 'ALL') {
      query = query.eq('status', String(status).toUpperCase());
    }

    // 5. Date Bounds Filter
    if (preset && preset !== 'ALL') {
      const bounds = getNptIsoBoundsForPreset(
        preset as DateFilterPreset,
        startDate ? String(startDate) : undefined,
        endDate ? String(endDate) : undefined
      );
      if (bounds.startIso) {
        query = query.gte('createdAt', bounds.startIso);
      }
      if (bounds.endIso) {
        query = query.lte('createdAt', bounds.endIso);
      }
    }

    // 6. Search Filter
    if (search && String(search).trim() !== '') {
      const q = String(search).trim();
      query = query.or(
        `repairNumber.ilike.%${q}%,customerName.ilike.%${q}%,customerPhone.ilike.%${q}%,deviceBrand.ilike.%${q}%,deviceModel.ilike.%${q}%,imeiNumber.ilike.%${q}%`
      );
    }

    query = query
      .order('updatedAt', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: repairs, error, count } = await query;

    if (error) {
      console.error('[TECH MANAGER REPAIRS ERROR]', error);
      return res.status(500).json({ error: 'Failed to retrieve repairs list.' });
    }

    // Enrich with calculated device category and timeline
    let enriched = (repairs || []).map(r => ({
      ...r,
      deviceCategory: categorizeDevice(r.deviceBrand, r.deviceModel),
    }));

    // Post-filter by device category if specified
    if (category && category !== 'ALL') {
      const targetCat = String(category).toUpperCase();
      enriched = enriched.filter(r => r.deviceCategory === targetCat);
    }

    return res.json({
      repairs: enriched,
      totalCount: count || enriched.length,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (err: any) {
    console.error('[TECH MANAGER REPAIRS QUERY ERROR]', err);
    return res.status(500).json({ error: 'Failed to query repairs.' });
  }
});

export default router;
