import fs from 'fs';
import path from 'path';
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

const DATA_DIR = path.join(process.cwd(), 'data');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance_records.json');
const AUDIT_FILE = path.join(DATA_DIR, 'attendance_audit_logs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[STORAGE DIR INIT WARN]', e);
  }
}

// In-Memory caches
let attendanceCache: Map<string, AttendanceRecord> = new Map();
let auditCache: AttendanceAuditRecord[] = [];
let isInitialized = false;

function loadLocalFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${filePath}]`, err);
  }
  return defaultValue;
}

function saveLocalFile(filePath: string, data: any): void {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[STORAGE WRITE ERROR: ${filePath}]`, err);
  }
}

export async function initAttendanceStorage(): Promise<void> {
  if (isInitialized) return;

  // Load from local storage first
  const localAttendance = loadLocalFile<AttendanceRecord[]>(ATTENDANCE_FILE, []);
  localAttendance.forEach((rec) => {
    if (rec && rec.id) {
      attendanceCache.set(rec.id, rec);
    }
  });

  const localAudit = loadLocalFile<AttendanceAuditRecord[]>(AUDIT_FILE, []);
  auditCache = localAudit;

  // Try to load any existing from Supabase
  try {
    const { data: remoteData, error } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .order('date', { ascending: false });

    if (!error && remoteData && remoteData.length > 0) {
      remoteData.forEach((rec: any) => {
        if (rec && rec.id) {
          attendanceCache.set(rec.id, {
            id: rec.id,
            userId: rec.userId,
            date: rec.date,
            status: rec.status || 'PRESENT',
            checkInTime: rec.checkInTime || rec.markedAt?.slice(11, 19) || null,
            checkOutTime: rec.checkOutTime || null,
            markedById: rec.markedById || 'SYSTEM',
            markedByName: rec.markedByName || 'System',
            markedByRole: rec.markedByRole || 'ADMIN',
            markedAt: rec.markedAt || rec.createdAt || new Date().toISOString(),
            method: rec.method || 'DIRECT_ADMIN',
            requestStatus: rec.requestStatus || 'DIRECT',
            respondedAt: rec.respondedAt || null,
            rejectionReason: rec.rejectionReason || null,
            notes: rec.notes || null,
            correctionReason: rec.correctionReason || null,
            branchId: rec.branchId || null,
            isArchived: !!rec.isArchived,
            createdAt: rec.createdAt || new Date().toISOString(),
            updatedAt: rec.updatedAt || new Date().toISOString(),
          });
        }
      });
    }
  } catch (e) {
    console.warn('[SUPABASE ATTENDANCE PREFETCH WARN]', e);
  }

  isInitialized = true;
  saveLocalFile(ATTENDANCE_FILE, Array.from(attendanceCache.values()));
}

// Persist single or multiple changes
function syncAttendanceDisk(): void {
  saveLocalFile(ATTENDANCE_FILE, Array.from(attendanceCache.values()));
}

function syncAuditDisk(): void {
  saveLocalFile(AUDIT_FILE, auditCache);
}

// Attempt Supabase async write without blocking
async function trySupabaseUpsert(record: AttendanceRecord): Promise<void> {
  try {
    await supabaseAdmin.from('Attendance').upsert({
      id: record.id,
      userId: record.userId,
      date: record.date,
      status: record.status,
      markedById: record.markedById,
      markedByName: record.markedByName,
      markedByRole: record.markedByRole,
      markedAt: record.markedAt,
      method: record.method,
      requestStatus: record.requestStatus,
      respondedAt: record.respondedAt,
      rejectionReason: record.rejectionReason,
      notes: record.notes,
      branchId: record.branchId,
      isArchived: record.isArchived,
      updatedAt: record.updatedAt,
    });
  } catch (e) {
    // Supabase RLS fallback is normal in sandbox
  }
}

async function trySupabaseDelete(recordId: string): Promise<void> {
  try {
    await supabaseAdmin.from('Attendance').delete().eq('id', recordId);
  } catch (e) {
    // Supabase delete fallback
  }
}

// Safe Staff user list fetcher
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
      // Fallback query without filter if needed
      const { data: fallbackUsers } = await supabaseAdmin.from('User').select('id, name, email, role');
      return (fallbackUsers || []).filter((u: any) => AUTHORIZED_ROLES.includes(u.role));
    }

    return users || [];
  } catch (err) {
    console.error('[STAFF FETCH EXCEPTION]', err);
    return [];
  }
}

// NPT Business Time calculation
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
  // Window: 10:00 AM (600 mins) to 10:35 AM (635 mins)
  const isWithinWindow = totalMinutes >= 600 && totalMinutes <= 635;

  const dateString = `${y}-${m}-${d}`;
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Calculate seconds remaining in window or seconds until window opens
  let secondsRemainingInWindow = 0;
  let secondsUntilWindowOpens = 0;

  if (isWithinWindow) {
    const endMinutes = 635 * 60 + 59; // 10:35:59
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
    windowEnd: '10:35:00',
    timezone: 'Asia/Kathmandu',
  };
}

// Attendance Query Operations
export async function getAllAttendanceRecords(filters?: {
  date?: string;
  month?: string; // YYYY-MM
  userId?: string;
  status?: string;
  search?: string;
}): Promise<AttendanceRecord[]> {
  await initAttendanceStorage();

  let records = Array.from(attendanceCache.values()).filter((r) => !r.isArchived);

  if (filters?.date) {
    records = records.filter((r) => r.date === filters.date);
  }

  if (filters?.month) {
    records = records.filter((r) => r.date.startsWith(filters.month!));
  }

  if (filters?.userId) {
    records = records.filter((r) => r.userId === filters.userId);
  }

  if (filters?.status && filters.status !== 'ALL') {
    records = records.filter((r) => r.status === filters.status);
  }

  // Sort descending by date, then by markedAt
  records.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.markedAt || '').localeCompare(a.markedAt || '');
  });

  return records;
}

export async function getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
  await initAttendanceStorage();
  return attendanceCache.get(id) || null;
}

export async function getAttendanceRecordByUserAndDate(userId: string, date: string): Promise<AttendanceRecord | null> {
  await initAttendanceStorage();
  for (const rec of attendanceCache.values()) {
    if (rec.userId === userId && rec.date === date && !rec.isArchived) {
      return rec;
    }
  }
  return null;
}

// Upsert single record
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
  await initAttendanceStorage();

  const existing = await getAttendanceRecordByUserAndDate(data.userId, data.date);
  const nowIso = new Date().toISOString();
  const time = getNepalBusinessTime();

  let finalRecord: AttendanceRecord;

  if (existing) {
    const prevStatus = existing.status;
    finalRecord = {
      ...existing,
      status: data.status,
      checkInTime: data.checkInTime !== undefined ? data.checkInTime : (existing.checkInTime || time.timeString),
      checkOutTime: data.checkOutTime !== undefined ? data.checkOutTime : existing.checkOutTime,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      correctionReason: data.correctionReason !== undefined ? data.correctionReason : existing.correctionReason,
      method: data.method || existing.method,
      requestStatus: data.requestStatus || existing.requestStatus,
      rejectionReason: data.rejectionReason !== undefined ? data.rejectionReason : existing.rejectionReason,
      markedById: actor.id,
      markedByName: actor.name,
      markedByRole: actor.role,
      updatedAt: nowIso,
    };

    attendanceCache.set(finalRecord.id, finalRecord);

    // Audit Log
    const auditLog: AttendanceAuditRecord = {
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
    auditCache.unshift(auditLog);
    syncAuditDisk();
    await broadcastServerChange('AttendanceAuditLog', 'CREATE', auditLog.id, auditLog);
  } else {
    finalRecord = {
      id: uuidv4(),
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
      correctionReason: data.correctionReason || null,
      branchId: data.branchId || null,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    attendanceCache.set(finalRecord.id, finalRecord);

    // Audit Log
    const auditLog: AttendanceAuditRecord = {
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
    auditCache.unshift(auditLog);
    syncAuditDisk();
    await broadcastServerChange('AttendanceAuditLog', 'CREATE', auditLog.id, auditLog);
  }

  syncAttendanceDisk();
  trySupabaseUpsert(finalRecord);
  await broadcastServerChange('Attendance', existing ? 'UPDATE' : 'CREATE', finalRecord.id, finalRecord);

  return finalRecord;
}

// Bulk mark multiple staff
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

// Delete attendance record
export async function deleteAttendanceRecord(
  id: string,
  actor: { id: string; name: string; role: string }
): Promise<boolean> {
  await initAttendanceStorage();
  const existing = attendanceCache.get(id);
  if (!existing) return false;

  attendanceCache.delete(id);
  syncAttendanceDisk();
  trySupabaseDelete(id);

  // Audit
  const auditLog: AttendanceAuditRecord = {
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
  auditCache.unshift(auditLog);
  syncAuditDisk();

  await broadcastServerChange('Attendance', 'DELETE', id, { id });
  return true;
}

// Purge all attendance records for a user
export async function purgeUserAttendance(
  userId: string,
  actor: { id: string; name: string; role: string }
): Promise<number> {
  await initAttendanceStorage();
  let count = 0;

  for (const [id, rec] of attendanceCache.entries()) {
    if (rec.userId === userId) {
      attendanceCache.delete(id);
      trySupabaseDelete(id);
      count++;
    }
  }

  if (count > 0) {
    syncAttendanceDisk();
    const auditLog: AttendanceAuditRecord = {
      id: uuidv4(),
      attendanceId: `PURGE_${userId}`,
      action: 'PURGED',
      performedById: actor.id,
      performedByName: actor.name,
      performedByRole: actor.role,
      reason: `Purged ${count} attendance records for user ${userId}`,
      createdAt: new Date().toISOString(),
    };
    auditCache.unshift(auditLog);
    syncAuditDisk();
  }

  return count;
}

// Get Audit Logs
export async function getAttendanceAuditLogs(filters?: {
  attendanceId?: string;
  userId?: string;
  limit?: number;
}): Promise<AttendanceAuditRecord[]> {
  await initAttendanceStorage();
  let logs = [...auditCache];

  if (filters?.attendanceId) {
    logs = logs.filter((l) => l.attendanceId === filters.attendanceId);
  }

  if (filters?.limit) {
    logs = logs.slice(0, filters.limit);
  }

  return logs;
}
