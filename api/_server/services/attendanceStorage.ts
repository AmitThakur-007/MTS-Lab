import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'PENDING' | 'REJECTED';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  markedById: string;
  markedByName?: string | null;
  markedByRole?: string | null;
  markedAt: string; // ISO String
  method: 'DIRECT_SUPER_ADMIN' | 'DIRECT_ADMIN' | 'MANAGER_ATTENDANCE' | 'STAFF_SELF_CHECKIN' | 'MANAGER_REQUEST';
  requestStatus: 'DIRECT' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  respondedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  correctionReason?: string | null;
  branchId?: string | null;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceAuditRecord {
  id: string;
  attendanceId: string;
  action: 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'DELETED' | 'PURGED';
  performedById: string;
  performedByName?: string | null;
  performedByRole?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  metadata?: any;
  createdAt: string;
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function formatAttendanceRecord(rec: any): AttendanceRecord {
  return {
    id: rec.id,
    userId: rec.userId,
    date: rec.date,
    status: (rec.status as any) || 'PRESENT',
    checkInTime: rec.checkInTime || rec.markedAt?.slice(11, 19) || null,
    checkOutTime: rec.checkOutTime || null,
    markedById: rec.markedById || 'SYSTEM',
    markedByName: rec.markedByName || 'System',
    markedByRole: rec.markedByRole || 'ADMIN',
    markedAt: rec.markedAt || rec.createdAt || new Date().toISOString(),
    method: (rec.method as any) || 'DIRECT_ADMIN',
    requestStatus: (rec.requestStatus as any) || 'DIRECT',
    respondedAt: rec.respondedAt || null,
    rejectionReason: rec.rejectionReason || null,
    notes: rec.notes || null,
    correctionReason: rec.correctionReason || null,
    branchId: rec.branchId || null,
    isArchived: Boolean(rec.isArchived),
    createdAt: rec.createdAt || new Date().toISOString(),
    updatedAt: rec.updatedAt || new Date().toISOString(),
  };
}

function formatAuditRecord(l: any): AttendanceAuditRecord {
  return {
    id: l.id,
    attendanceId: l.attendanceId,
    action: (l.action as any) || 'UPDATED',
    performedById: l.performedById,
    performedByName: l.performedByName || null,
    performedByRole: l.performedByRole || null,
    previousStatus: l.previousStatus || null,
    newStatus: l.newStatus || null,
    reason: l.reason || null,
    metadata: typeof l.metadata === 'string' ? safeJsonParse(l.metadata) : (l.metadata || null),
    createdAt: l.createdAt || new Date().toISOString(),
  };
}

async function writeAuditLogSafe(auditLog: any): Promise<void> {
  try {
    await supabaseAdmin.from('AttendanceAuditLog').insert([auditLog]);
  } catch (err) {
    console.warn('[ATTENDANCE AUDIT LOG INSERT WARN]', err);
  }
}

/**
 * Initialize Attendance Storage.
 * In production Supabase PostgreSQL is the authoritative store.
 * Kept for signature compatibility with existing callers. Zero filesystem side-effects.
 */
export async function initAttendanceStorage(): Promise<void> {
  // Pure Supabase persistence - no local file operations required
  return Promise.resolve();
}

/**
 * Fetch authorized staff list directly from Supabase User table
 */
export async function getAuthorizedStaffList(): Promise<any[]> {
  const AUTHORIZED_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'HEAD_TECHNICIAN',
    'LEAD_TECHNICIAN',
    'TECHNICIAN',
    'RECEPTIONIST',
    'TECHNICAL_ASSISTANT',
    'STAFF',
  ];

  try {
    const { data: users, error } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, department, phoneNumber, profileImage, deletedAt')
      .is('deletedAt', null)
      .in('role', AUTHORIZED_ROLES)
      .order('name', { ascending: true });

    if (error) {
      console.error('[SUPABASE USER FETCH ERROR]', error);
      const { data: fallbackUsers } = await supabaseAdmin.from('User').select('id, name, email, role');
      return (fallbackUsers || []).filter((u: any) => AUTHORIZED_ROLES.includes(u.role));
    }

    return users || [];
  } catch (err) {
    console.error('[STAFF FETCH EXCEPTION]', err);
    return [];
  }
}

/**
 * Authoritative NPT Business Time calculation (Asia/Kathmandu timezone: UTC+05:45)
 */
export function getNepalBusinessTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
  const minStr = parts.find((p) => p.type === 'minute')?.value || '0';
  const secStr = parts.find((p) => p.type === 'second')?.value || '0';

  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minStr, 10);
  const seconds = parseInt(secStr, 10);

  const totalMinutes = hours * 60 + minutes;
  // Window: 10:00 AM (600 mins) to 10:45 AM (645 mins)
  const isWithinWindow = totalMinutes >= 600 && totalMinutes <= 645;

  const dateString = `${y}-${m}-${d}`;
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let secondsRemainingInWindow = 0;
  let secondsUntilWindowOpens = 0;

  if (isWithinWindow) {
    const endMinutes = 645 * 60 + 59; // 10:45:59
    const currentSeconds = totalMinutes * 60 + seconds;
    secondsRemainingInWindow = Math.max(0, endMinutes - currentSeconds);
  } else if (totalMinutes < 600) {
    const startSeconds = 600 * 60;
    const currentSeconds = totalMinutes * 60 + seconds;
    secondsUntilWindowOpens = Math.max(0, startSeconds - currentSeconds);
  }

  return {
    dateString,
    timeString,
    hours,
    minutes,
    seconds,
    totalMinutes,
    isWithinWindow,
    secondsRemainingInWindow,
    secondsUntilWindowOpens,
    windowStart: '10:00:00',
    windowEnd: '10:45:00',
    timezone: 'Asia/Kathmandu',
  };
}

/**
 * Attendance Query Operations directly from Supabase PostgreSQL
 */
export async function getAllAttendanceRecords(filters?: {
  date?: string;
  month?: string; // YYYY-MM
  userId?: string;
  status?: string;
  search?: string;
}): Promise<AttendanceRecord[]> {
  let query = supabaseAdmin
    .from('Attendance')
    .select('*')
    .eq('isArchived', false);

  if (filters?.date) {
    query = query.eq('date', filters.date);
  }

  if (filters?.month) {
    query = query.like('date', `${filters.month}%`);
  }

  if (filters?.userId) {
    query = query.eq('userId', filters.userId);
  }

  if (filters?.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  query = query.order('date', { ascending: false }).order('markedAt', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('[SUPABASE ATTENDANCE FETCH ERROR]', error);
    throw new Error(`Failed to fetch attendance records: ${error.message}`);
  }

  return (data || []).map(formatAttendanceRecord);
}

/**
 * Get attendance record by primary ID directly from Supabase
 */
export async function getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('Attendance')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[SUPABASE ATTENDANCE BY ID ERROR]', error);
    return null;
  }

  return data ? formatAttendanceRecord(data) : null;
}

/**
 * Get attendance record for a specific user and date directly from Supabase
 */
export async function getAttendanceRecordByUserAndDate(userId: string, date: string): Promise<AttendanceRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('Attendance')
    .select('*')
    .eq('userId', userId)
    .eq('date', date)
    .eq('isArchived', false)
    .maybeSingle();

  if (error) {
    console.error('[SUPABASE ATTENDANCE BY USER AND DATE ERROR]', error);
    return null;
  }

  return data ? formatAttendanceRecord(data) : null;
}

/**
 * Upsert attendance record with audit logging directly into Supabase PostgreSQL.
 * Atomic and persistent without local filesystem writes.
 */
export async function upsertAttendanceRecord(
  data: {
    userId: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'PENDING' | 'REJECTED';
    checkInTime?: string | null;
    checkOutTime?: string | null;
    notes?: string | null;
    correctionReason?: string | null;
    method?: 'DIRECT_SUPER_ADMIN' | 'DIRECT_ADMIN' | 'MANAGER_ATTENDANCE' | 'STAFF_SELF_CHECKIN' | 'MANAGER_REQUEST';
    requestStatus?: 'DIRECT' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
    rejectionReason?: string | null;
    branchId?: string | null;
  },
  actor: {
    id: string;
    name: string;
    role: string;
  }
): Promise<AttendanceRecord> {
  const existing = await getAttendanceRecordByUserAndDate(data.userId, data.date);
  const nowIso = new Date().toISOString();
  const time = getNepalBusinessTime();

  let finalRecord: AttendanceRecord;

  if (existing) {
    const prevStatus = existing.status;
    const updatePayload = {
      status: data.status,
      checkInTime: data.checkInTime !== undefined ? data.checkInTime : (existing.checkInTime || time.timeString),
      checkOutTime: data.checkOutTime !== undefined ? data.checkOutTime : existing.checkOutTime,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      method: data.method || existing.method,
      requestStatus: data.requestStatus || existing.requestStatus,
      rejectionReason: data.rejectionReason !== undefined ? data.rejectionReason : existing.rejectionReason,
      markedById: actor.id,
      markedByName: actor.name,
      markedByRole: actor.role,
      updatedAt: nowIso,
    };

    const { data: updated, error } = await supabaseAdmin
      .from('Attendance')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      console.error('[SUPABASE ATTENDANCE UPDATE ERROR]', error);
      throw new Error(`Failed to update attendance record: ${error.message}`);
    }

    finalRecord = formatAttendanceRecord(updated);

    // Write Audit Log directly to Supabase
    const auditLog = {
      id: uuidv4(),
      attendanceId: finalRecord.id,
      action: prevStatus !== data.status ? 'STATUS_CHANGED' : 'UPDATED',
      performedById: actor.id,
      performedByName: actor.name,
      performedByRole: actor.role,
      previousStatus: prevStatus,
      newStatus: data.status,
      reason: data.correctionReason || data.notes || 'Attendance record modified',
      createdAt: nowIso,
    };

    writeAuditLogSafe(auditLog);

    broadcastServerChange('AttendanceAuditLog', 'CREATE', auditLog.id, auditLog).catch(() => {});
    broadcastServerChange('Attendance', 'UPDATE', finalRecord.id, finalRecord).catch(() => {});
  } else {
    const newId = uuidv4();
    const insertPayload = {
      id: newId,
      userId: data.userId,
      date: data.date,
      status: data.status,
      checkInTime: data.checkInTime || (data.status === 'PRESENT' || data.status === 'LATE' || data.status === 'HALF_DAY' ? time.timeString : null),
      checkOutTime: data.checkOutTime || null,
      markedById: actor.id,
      markedByName: actor.name,
      markedByRole: actor.role,
      markedAt: nowIso,
      method: data.method || (actor.role === 'SUPER_ADMIN' ? 'DIRECT_SUPER_ADMIN' : actor.role === 'ADMIN' ? 'DIRECT_ADMIN' : actor.role === 'MANAGER' ? 'MANAGER_ATTENDANCE' : 'STAFF_SELF_CHECKIN'),
      requestStatus: data.requestStatus || 'DIRECT',
      rejectionReason: data.rejectionReason || null,
      notes: data.notes || null,
      branchId: data.branchId || null,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const { data: created, error } = await supabaseAdmin
      .from('Attendance')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      console.error('[SUPABASE ATTENDANCE INSERT ERROR]', error);
      throw new Error(`Failed to insert attendance record: ${error.message}`);
    }

    finalRecord = formatAttendanceRecord(created);

    // Write Audit Log directly to Supabase
    const auditLog = {
      id: uuidv4(),
      attendanceId: finalRecord.id,
      action: 'CREATED',
      performedById: actor.id,
      performedByName: actor.name,
      performedByRole: actor.role,
      previousStatus: null,
      newStatus: data.status,
      reason: data.notes || `Attendance marked as ${data.status}`,
      createdAt: nowIso,
    };

    writeAuditLogSafe(auditLog);

    broadcastServerChange('AttendanceAuditLog', 'CREATE', auditLog.id, auditLog).catch(() => {});
    broadcastServerChange('Attendance', 'CREATE', finalRecord.id, finalRecord).catch(() => {});
  }

  return finalRecord;
}

/**
 * Bulk mark multiple staff members in Supabase PostgreSQL
 */
export async function bulkUpsertAttendance(
  items: Array<{
    userId: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'PENDING' | 'REJECTED';
    notes?: string;
  }>,
  actor: {
    id: string;
    name: string;
    role: string;
  }
): Promise<AttendanceRecord[]> {
  const results: AttendanceRecord[] = [];
  for (const item of items) {
    const rec = await upsertAttendanceRecord(item, actor);
    results.push(rec);
  }
  return results;
}

/**
 * Delete single attendance record from Supabase PostgreSQL
 */
export async function deleteAttendanceRecord(
  id: string,
  actor: { id: string; name: string; role: string }
): Promise<boolean> {
  const existing = await getAttendanceRecordById(id);
  if (!existing) return false;

  const { error } = await supabaseAdmin.from('Attendance').delete().eq('id', id);
  if (error) {
    console.error('[SUPABASE ATTENDANCE DELETE ERROR]', error);
    throw new Error(`Failed to delete attendance record: ${error.message}`);
  }

  const auditLog = {
    id: uuidv4(),
    attendanceId: id,
    action: 'DELETED',
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousStatus: existing.status,
    newStatus: null,
    reason: 'Record deleted by administrator',
    createdAt: new Date().toISOString(),
  };

  writeAuditLogSafe(auditLog);
  broadcastServerChange('Attendance', 'DELETE', id, { id }).catch(() => {});

  return true;
}

/**
 * Purge all attendance records for a user from Supabase PostgreSQL
 */
export async function purgeUserAttendance(
  userId: string,
  actor: { id: string; name: string; role: string }
): Promise<number> {
  const { data: toDelete, error: selectErr } = await supabaseAdmin
    .from('Attendance')
    .select('id')
    .eq('userId', userId);

  if (selectErr) {
    console.error('[SUPABASE PURGE SELECT ERROR]', selectErr);
    throw selectErr;
  }

  const count = toDelete?.length || 0;
  if (count === 0) return 0;

  const { error: delErr } = await supabaseAdmin
    .from('Attendance')
    .delete()
    .eq('userId', userId);

  if (delErr) {
    console.error('[SUPABASE PURGE DELETE ERROR]', delErr);
    throw delErr;
  }

  const auditLog = {
    id: uuidv4(),
    attendanceId: `PURGE_${userId}`,
    action: 'PURGED',
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    reason: `Purged ${count} attendance records for user ${userId}`,
    createdAt: new Date().toISOString(),
  };

  writeAuditLogSafe(auditLog);
  broadcastServerChange('Attendance', 'DELETE', `PURGE_${userId}`, { userId }).catch(() => {});

  return count;
}

/**
 * Get Attendance Audit Logs directly from Supabase PostgreSQL
 */
export async function getAttendanceAuditLogs(filters?: {
  attendanceId?: string;
  userId?: string;
  limit?: number;
}): Promise<AttendanceAuditRecord[]> {
  let query = supabaseAdmin
    .from('AttendanceAuditLog')
    .select('*')
    .order('createdAt', { ascending: false });

  if (filters?.attendanceId) {
    query = query.eq('attendanceId', filters.attendanceId);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[SUPABASE ATTENDANCE AUDIT LOGS ERROR]', error);
    return [];
  }

  return (data || []).map(formatAuditRecord);
}
