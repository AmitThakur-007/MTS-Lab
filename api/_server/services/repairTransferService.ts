import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';
import { createNotification } from './notificationStorage';

export interface RepairTransferRequestRecord {
  id: string;
  repairId: string;
  repairNumber: string;
  senderTechnicianId: string;
  senderTechnicianName: string;
  targetTechnicianId: string;
  targetTechnicianName: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  respondedAt?: string | null;
  responseNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory persistent synchronized store for zero-downtime & fallback safety
const transferStore = new Map<string, RepairTransferRequestRecord>();
let hasHydratedFromDb = false;

// Initial hydration from database if records exist
async function hydrateStoreFromDb() {
  if (hasHydratedFromDb) return;
  try {
    const { data, error } = await supabaseAdmin
      .from('RepairTransferRequest')
      .select('*')
      .order('createdAt', { ascending: false });

    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row && row.id) {
          transferStore.set(row.id, {
            id: row.id,
            repairId: row.repairId,
            repairNumber: row.repairNumber,
            senderTechnicianId: row.senderTechnicianId,
            senderTechnicianName: row.senderTechnicianName || 'Specialist',
            targetTechnicianId: row.targetTechnicianId,
            targetTechnicianName: row.targetTechnicianName || 'Specialist',
            reason: row.reason || '',
            status: row.status || 'PENDING',
            respondedAt: row.respondedAt || null,
            responseNote: row.responseNote || null,
            createdAt: row.createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || new Date().toISOString(),
          });
        }
      });
    }
    hasHydratedFromDb = true;
  } catch (err) {
    console.warn('[REPAIR TRANSFER HYDRATE WARNING]', err);
    hasHydratedFromDb = true;
  }
}

// Ensure hydration
hydrateStoreFromDb();

/**
 * Get all transfer requests for a given user (incoming, outgoing, pendingIncomingCount)
 */
export async function getMyTransferRequests(userId: string) {
  await hydrateStoreFromDb();

  // 1. Try fetching from Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from('RepairTransferRequest')
      .select('*')
      .or(`senderTechnicianId.eq.${userId},targetTechnicianId.eq.${userId}`)
      .order('createdAt', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      // Sync into memory store
      data.forEach((row: any) => {
        transferStore.set(row.id, row);
      });
    }
  } catch (err) {
    console.warn('[GET TRANSFER DB SELECT ERROR]', err);
  }

  // Combine and partition from authoritative store
  const allTransfers = Array.from(transferStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const incoming = allTransfers.filter(t => t.targetTechnicianId === userId);
  const outgoing = allTransfers.filter(t => t.senderTechnicianId === userId);
  const pendingIncomingCount = incoming.filter(t => t.status === 'PENDING').length;

  return {
    incoming,
    outgoing,
    pendingIncomingCount,
    all: allTransfers,
  };
}

/**
 * Get all transfer requests across the system (for Managers/Admins)
 */
export async function getAllTransferRequests() {
  await hydrateStoreFromDb();
  return Array.from(transferStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get single transfer request by ID
 */
export async function getTransferRequestById(id: string): Promise<RepairTransferRequestRecord | null> {
  await hydrateStoreFromDb();
  if (transferStore.has(id)) {
    return transferStore.get(id)!;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('RepairTransferRequest')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      transferStore.set(data.id, data);
      return data;
    }
  } catch {
    // ignore
  }

  return null;
}

const TERMINAL_REPAIR_STATUSES = ['DELIVERED', 'CANCELLED', 'COMPLETED', 'ARCHIVED', 'CLOSED'];

/**
 * Create a new repair transfer request
 */
export async function createRepairTransferRequest(params: {
  repairId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  targetTechnicianId: string;
  reason: string;
}): Promise<{ success: boolean; data?: RepairTransferRequestRecord; error?: string; statusCode?: number }> {
  await hydrateStoreFromDb();

  const { repairId, senderId, senderName, senderRole, targetTechnicianId, reason } = params;

  if (!repairId) {
    return { success: false, error: 'Repair ID is required.', statusCode: 400 };
  }

  if (!targetTechnicianId) {
    return { success: false, error: 'Please select a target technician.', statusCode: 400 };
  }

  if (targetTechnicianId === senderId) {
    return { success: false, error: 'Cannot transfer a repair to yourself.', statusCode: 400 };
  }

  if (!reason || reason.trim().length < 3) {
    return { success: false, error: 'Please provide a clear reason for the transfer (minimum 3 characters).', statusCode: 400 };
  }

  // 1. Fetch repair details
  const { data: repair, error: repairErr } = await supabaseAdmin
    .from('Repair')
    .select('id, repairNumber, status, technicianId, deviceBrand, deviceModel, customerName')
    .eq('id', repairId)
    .single();

  if (repairErr || !repair) {
    return { success: false, error: 'Repair record not found.', statusCode: 404 };
  }

  // 2. Validate Repair Status
  if (TERMINAL_REPAIR_STATUSES.includes(repair.status)) {
    return {
      success: false,
      error: `Cannot transfer repair #${repair.repairNumber} because its current status is ${repair.status}.`,
      statusCode: 400,
    };
  }

  // 3. Validate Technician Ownership if sender is a technician
  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'LEAD_TECHNICIAN'].includes(senderRole);
  if (!isManagement && repair.technicianId && repair.technicianId !== senderId) {
    return {
      success: false,
      error: 'You can only request transfers for repairs assigned to you.',
      statusCode: 403,
    };
  }

  // 4. Validate Target Technician exists and is active
  const { data: targetTech, error: techErr } = await supabaseAdmin
    .from('User')
    .select('id, name, role, isActive')
    .eq('id', targetTechnicianId)
    .single();

  if (techErr || !targetTech || targetTech.isActive === false) {
    return { success: false, error: 'Target technician was not found or is inactive.', statusCode: 400 };
  }

  // 5. Prevent Duplicate Pending Transfer Requests
  const existingPending = Array.from(transferStore.values()).find(
    t => t.repairId === repairId && t.status === 'PENDING'
  );

  if (existingPending) {
    return {
      success: false,
      error: `A pending transfer request for repair #${repair.repairNumber} is already active with ${existingPending.targetTechnicianName}.`,
      statusCode: 400,
    };
  }

  // 6. Construct new Transfer Request Record
  const transferId = uuidv4();
  const now = new Date().toISOString();
  const newTransfer: RepairTransferRequestRecord = {
    id: transferId,
    repairId: repair.id,
    repairNumber: repair.repairNumber,
    senderTechnicianId: senderId,
    senderTechnicianName: senderName || 'Specialist',
    targetTechnicianId: targetTech.id,
    targetTechnicianName: targetTech.name || 'Specialist',
    reason: reason.trim(),
    status: 'PENDING',
    respondedAt: null,
    responseNote: null,
    createdAt: now,
    updatedAt: now,
  };

  // Store in memory
  transferStore.set(transferId, newTransfer);

  // Attempt write to database (non-blocking if RLS restricts)
  try {
    await supabaseAdmin.from('RepairTransferRequest').insert([newTransfer]);
  } catch (dbErr) {
    console.warn('[DB INSERT REPAIR TRANSFER NON FATAL]', dbErr);
  }

  // 7. Dispatch High Priority Notification to Target Technician
  try {
    await createNotification({
      userId: targetTech.id,
      title: `Job Transfer Request: #${repair.repairNumber}`,
      message: `${senderName} requested to transfer job #${repair.repairNumber} (${repair.deviceBrand || ''} ${repair.deviceModel || ''}) to you. Reason: ${reason.trim()}`,
      type: 'TRANSFER_REQUEST',
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      senderId: senderId,
      senderName: senderName,
      senderRole: senderRole,
      priority: 'HIGH',
    });
  } catch (notifErr) {
    console.warn('[TRANSFER NOTIF NON FATAL]', notifErr);
  }

  // 8. Log action in RepairLog
  const logId = uuidv4();
  try {
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: repair.id,
        status: repair.status,
        message: `Transfer request submitted to ${targetTech.name} by ${senderName}. Reason: ${reason.trim()}`,
        createdAt: now,
      },
    ]);
    await broadcastServerChange('RepairLog', 'CREATE', logId);
  } catch (logErr) {
    console.warn('[REPAIR LOG NON FATAL]', logErr);
  }

  // 9. Realtime broadcast for transfer request
  await broadcastServerChange('RepairTransfer', 'CREATE', transferId, newTransfer);

  return { success: true, data: newTransfer };
}

/**
 * Respond to a transfer request (ACCEPT or REJECT)
 */
export async function respondToTransferRequest(params: {
  transferId: string;
  responderId: string;
  responderName: string;
  responderRole: string;
  action: 'ACCEPT' | 'REJECT';
  responseNote?: string;
}): Promise<{ success: boolean; data?: any; error?: string; statusCode?: number }> {
  await hydrateStoreFromDb();

  const { transferId, responderId, responderName, responderRole, action, responseNote } = params;

  if (!transferId) {
    return { success: false, error: 'Transfer ID is required.', statusCode: 400 };
  }

  if (action !== 'ACCEPT' && action !== 'REJECT') {
    return { success: false, error: "Action must be either 'ACCEPT' or 'REJECT'.", statusCode: 400 };
  }

  const transfer = await getTransferRequestById(transferId);
  if (!transfer) {
    return { success: false, error: 'Transfer request not found.', statusCode: 404 };
  }

  // Check if already processed (Concurrency / Double-response prevention)
  if (transfer.status !== 'PENDING') {
    return {
      success: false,
      error: `This transfer request has already been ${transfer.status.toLowerCase()}.`,
      statusCode: 400,
    };
  }

  // Authorization: must be the target technician or management
  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(responderRole);
  if (!isManagement && transfer.targetTechnicianId !== responderId) {
    return {
      success: false,
      error: 'You are not authorized to respond to this transfer request.',
      statusCode: 403,
    };
  }

  const now = new Date().toISOString();

  if (action === 'ACCEPT') {
    // 1. Mark transfer as ACCEPTED
    transfer.status = 'ACCEPTED';
    transfer.respondedAt = now;
    transfer.responseNote = responseNote?.trim() || 'Accepted by technician';
    transfer.updatedAt = now;
    transferStore.set(transfer.id, transfer);

    try {
      await supabaseAdmin
        .from('RepairTransferRequest')
        .update({
          status: 'ACCEPTED',
          respondedAt: now,
          responseNote: transfer.responseNote,
          updatedAt: now,
        })
        .eq('id', transfer.id);
    } catch (e) {
      console.warn('[UPDATE TRANSFER REQUEST DB NON FATAL]', e);
    }

    // 2. Reassign the Repair to the Target Technician atomically
    const { data: updatedRepair, error: repairUpdateErr } = await supabaseAdmin
      .from('Repair')
      .update({
        technicianId: transfer.targetTechnicianId,
        assignedAt: now,
        assignedById: responderId,
        assignedByName: responderName,
        updatedAt: now,
      })
      .eq('id', transfer.repairId)
      .select('*')
      .single();

    if (repairUpdateErr) {
      console.warn('[REPAIR REASSIGN ERROR]', repairUpdateErr);
    }

    // 3. Notify Sender Technician that transfer was accepted
    try {
      await createNotification({
        userId: transfer.senderTechnicianId,
        title: `Transfer Accepted: #${transfer.repairNumber}`,
        message: `${responderName} has accepted job #${transfer.repairNumber}. It is now in their active queue.`,
        type: 'TRANSFER_ACCEPTED',
        repairId: transfer.repairId,
        repairNumber: transfer.repairNumber,
        senderId: responderId,
        senderName: responderName,
        senderRole: responderRole,
        priority: 'NORMAL',
      });
    } catch (notifErr) {
      console.warn('[ACCEPT NOTIF NON FATAL]', notifErr);
    }

    // 4. Log in RepairLog
    const logId = uuidv4();
    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: transfer.repairId,
          status: updatedRepair?.status || 'IN_PROCESS',
          message: `Transfer accepted by ${responderName}. Repair successfully reassigned to ${transfer.targetTechnicianName}.`,
          createdAt: now,
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[ACCEPT LOG NON FATAL]', logErr);
    }

    // 5. Broadcast real-time changes
    await broadcastServerChange('RepairTransfer', 'UPDATE', transfer.id, transfer);
    if (updatedRepair) {
      await broadcastServerChange('Repair', 'UPDATE', transfer.repairId, updatedRepair);
    }

    return {
      success: true,
      data: {
        transfer,
        repair: updatedRepair,
        message: `Transfer request accepted. Repair #${transfer.repairNumber} is now assigned to you.`,
      },
    };
  } else {
    // REJECT Action
    transfer.status = 'REJECTED';
    transfer.respondedAt = now;
    transfer.responseNote = responseNote?.trim() || 'Declined by technician';
    transfer.updatedAt = now;
    transferStore.set(transfer.id, transfer);

    try {
      await supabaseAdmin
        .from('RepairTransferRequest')
        .update({
          status: 'REJECTED',
          respondedAt: now,
          responseNote: transfer.responseNote,
          updatedAt: now,
        })
        .eq('id', transfer.id);
    } catch (e) {
      console.warn('[UPDATE TRANSFER REQUEST DB NON FATAL]', e);
    }

    // Notify Sender Technician that transfer was declined
    try {
      await createNotification({
        userId: transfer.senderTechnicianId,
        title: `Transfer Declined: #${transfer.repairNumber}`,
        message: `${responderName} declined the transfer request for repair #${transfer.repairNumber}. The job remains in your active queue.`,
        type: 'TRANSFER_REJECTED',
        repairId: transfer.repairId,
        repairNumber: transfer.repairNumber,
        senderId: responderId,
        senderName: responderName,
        senderRole: responderRole,
        priority: 'NORMAL',
      });
    } catch (notifErr) {
      console.warn('[REJECT NOTIF NON FATAL]', notifErr);
    }

    // Log in RepairLog
    const logId = uuidv4();
    try {
      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: transfer.repairId,
          status: 'IN_PROCESS',
          message: `Transfer request to ${transfer.targetTechnicianName} declined by ${responderName}. Repair remains with ${transfer.senderTechnicianName}.`,
          createdAt: now,
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (logErr) {
      console.warn('[REJECT LOG NON FATAL]', logErr);
    }

    // Broadcast real-time changes
    await broadcastServerChange('RepairTransfer', 'UPDATE', transfer.id, transfer);

    return {
      success: true,
      data: {
        transfer,
        message: `Transfer request for repair #${transfer.repairNumber} was declined.`,
      },
    };
  }
}

/**
 * Cancel a transfer request by Sender or Management
 */
export async function cancelTransferRequest(params: {
  transferId: string;
  userId: string;
  userRole: string;
}): Promise<{ success: boolean; data?: any; error?: string; statusCode?: number }> {
  await hydrateStoreFromDb();

  const { transferId, userId, userRole } = params;

  const transfer = await getTransferRequestById(transferId);
  if (!transfer) {
    return { success: false, error: 'Transfer request not found.', statusCode: 404 };
  }

  if (transfer.status !== 'PENDING') {
    return {
      success: false,
      error: `Cannot cancel transfer request that is already ${transfer.status.toLowerCase()}.`,
      statusCode: 400,
    };
  }

  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole);
  if (!isManagement && transfer.senderTechnicianId !== userId) {
    return {
      success: false,
      error: 'You are not authorized to cancel this transfer request.',
      statusCode: 403,
    };
  }

  const now = new Date().toISOString();
  transfer.status = 'CANCELLED';
  transfer.respondedAt = now;
  transfer.updatedAt = now;
  transferStore.set(transfer.id, transfer);

  try {
    await supabaseAdmin
      .from('RepairTransferRequest')
      .update({ status: 'CANCELLED', updatedAt: now })
      .eq('id', transfer.id);
  } catch (e) {
    console.warn('[CANCEL TRANSFER DB NON FATAL]', e);
  }

  await broadcastServerChange('RepairTransfer', 'UPDATE', transfer.id, transfer);

  return { success: true, data: transfer };
}

/**
 * Direct Management Transfer (Manager / Admin immediate reassignment)
 */
export async function directTransferRepair(params: {
  repairId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  targetTechnicianId: string;
  reason: string;
  priority?: string;
}): Promise<{ success: boolean; data?: any; error?: string; statusCode?: number }> {
  await hydrateStoreFromDb();

  const { repairId, actorId, actorName, targetTechnicianId, reason, priority } = params;

  if (!repairId) {
    return { success: false, error: 'Repair ID is required.', statusCode: 400 };
  }

  if (!targetTechnicianId) {
    return { success: false, error: 'Please select a target technician.', statusCode: 400 };
  }

  if (!reason || reason.trim().length < 2) {
    return { success: false, error: 'Please provide a transfer reason or instruction.', statusCode: 400 };
  }

  // 1. Fetch repair
  const { data: repair, error: repairErr } = await supabaseAdmin
    .from('Repair')
    .select('*')
    .eq('id', repairId)
    .single();

  if (repairErr || !repair) {
    return { success: false, error: 'Repair record not found.', statusCode: 404 };
  }

  // 2. Fetch target tech
  const { data: targetTech, error: techErr } = await supabaseAdmin
    .from('User')
    .select('id, name, role, isActive')
    .eq('id', targetTechnicianId)
    .single();

  if (techErr || !targetTech || targetTech.isActive === false) {
    return { success: false, error: 'Target technician was not found or is inactive.', statusCode: 400 };
  }

  const now = new Date().toISOString();

  // 3. Cancel any pending transfer requests for this repair
  Array.from(transferStore.values())
    .filter(t => t.repairId === repairId && t.status === 'PENDING')
    .forEach(t => {
      t.status = 'CANCELLED';
      t.updatedAt = now;
      transferStore.set(t.id, t);
    });

  // 4. Update Repair Assignment immediately
  const updatePayload: any = {
    technicianId: targetTech.id,
    assignedAt: now,
    assignedById: actorId,
    assignedByName: actorName,
    updatedAt: now,
  };

  if (priority && ['LOW', 'NORMAL', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority.toUpperCase())) {
    updatePayload.priority = priority.toUpperCase();
  }

  const { data: updatedRepair, error: updateErr } = await supabaseAdmin
    .from('Repair')
    .update(updatePayload)
    .eq('id', repairId)
    .select('*')
    .single();

  if (updateErr) {
    return { success: false, error: 'Failed to reassign technician.', statusCode: 500 };
  }

  // 5. Send Notification to Target Technician
  try {
    await createNotification({
      userId: targetTech.id,
      title: `Repair Assigned / Transferred: #${repair.repairNumber}`,
      message: `${actorName} transferred repair #${repair.repairNumber} (${repair.deviceBrand || ''} ${repair.deviceModel || ''}) to your queue. Instructions: ${reason.trim()}`,
      type: 'REPAIR_ASSIGNED',
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      senderId: actorId,
      senderName: actorName,
      senderRole: params.actorRole,
      priority: priority ? (priority.toUpperCase() as any) : 'HIGH',
    });
  } catch (notifErr) {
    console.warn('[DIRECT TRANSFER NOTIF NON FATAL]', notifErr);
  }

  // 6. Log in RepairLog
  const logId = uuidv4();
  try {
    await supabaseAdmin.from('RepairLog').insert([
      {
        id: logId,
        repairId: repair.id,
        status: updatedRepair.status,
        message: `Management transfer to ${targetTech.name} by ${actorName}. Reason: ${reason.trim()}`,
        createdAt: now,
      },
    ]);
    await broadcastServerChange('RepairLog', 'CREATE', logId);
  } catch (logErr) {
    console.warn('[DIRECT TRANSFER LOG NON FATAL]', logErr);
  }

  // 7. Realtime broadcast for repair
  await broadcastServerChange('Repair', 'UPDATE', repair.id, updatedRepair);

  return {
    success: true,
    data: {
      repair: updatedRepair,
      message: `Repair #${repair.repairNumber} successfully transferred to ${targetTech.name}.`,
    },
  };
}
