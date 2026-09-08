import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

export interface RepairRelatedDamageRecord {
  id: string;
  recordNumber: string; // e.g. "RRD-2026-0001"
  staffId: string;
  staffName: string;
  staffRole: string;
  repairId?: string | null;
  repairNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  damagedComponent: string;
  damageType?: string | null;
  damageDescription: string;
  damageDate: string; // YYYY-MM-DD
  damageTime?: string | null; // HH:mm
  damageTimestamp: string; // ISO String
  quantity: number;
  estimatedCost?: number | null;
  notes?: string | null;
  inventoryItemId?: string | null;
  inventoryDeducted: boolean;
  inventoryTxId?: string | null;
  recordedById: string;
  recordedByName: string;
  recordedByRole: string;
  branchId?: string | null;
  status: string; // "ACTIVE", "RESOLVED", "REPLACED", "ARCHIVED"
  isArchived: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  staff?: {
    name: string;
    email: string;
    role: string;
    department?: string | null;
  };
}

export interface RepairRelatedDamageAuditRecord {
  id: string;
  damageRecordId: string;
  action: 'CREATED' | 'UPDATED' | 'ARCHIVED' | 'RESTORED' | 'DELETED' | 'INVENTORY_DEDUCTED';
  performedById: string;
  performedByName?: string | null;
  performedByRole?: string | null;
  previousData?: string | null;
  newData?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DAMAGE_FILE = path.join(DATA_DIR, 'repair_damage_records.json');
const AUDIT_FILE = path.join(DATA_DIR, 'repair_damage_audit_logs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[STORAGE DIR INIT WARN]', e);
  }
}

// In-Memory caches
let damageCache: Map<string, RepairRelatedDamageRecord> = new Map();
let auditCache: RepairRelatedDamageAuditRecord[] = [];
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

/**
 * Get Authoritative Nepal Date & Time (UTC+5:45)
 */
export function getNepalDateTime(): { date: string; time: string; iso: string; fullDate: Date } {
  const now = new Date();
  const nptDateString = now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
  const nptDate = new Date(nptDateString);

  const year = nptDate.getFullYear();
  const month = String(nptDate.getMonth() + 1).padStart(2, '0');
  const day = String(nptDate.getDate()).padStart(2, '0');
  const hours = String(nptDate.getHours()).padStart(2, '0');
  const minutes = String(nptDate.getMinutes()).padStart(2, '0');

  const date = `${year}-${month}-${day}`;
  const time = `${hours}:${minutes}`;

  return {
    date,
    time,
    iso: now.toISOString(),
    fullDate: nptDate,
  };
}

/**
 * Initialize storage from Supabase or local files
 */
export async function initializeDamageStorage(): Promise<void> {
  if (isInitialized) return;

  // 1. Load local cache first
  const localDamages: RepairRelatedDamageRecord[] = loadLocalFile(DAMAGE_FILE, []);
  const localAudits: RepairRelatedDamageAuditRecord[] = loadLocalFile(AUDIT_FILE, []);

  localDamages.forEach(d => damageCache.set(d.id, d));
  auditCache = localAudits;

  // 2. Fetch from Supabase to sync up
  try {
    const { data: supaDamages, error: dErr } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .select('*')
      .order('createdAt', { ascending: false });

    if (!dErr && supaDamages && supaDamages.length > 0) {
      supaDamages.forEach((d: any) => {
        damageCache.set(d.id, {
          ...d,
          isArchived: Boolean(d.isArchived),
          inventoryDeducted: Boolean(d.inventoryDeducted),
        });
      });
      saveLocalFile(DAMAGE_FILE, Array.from(damageCache.values()));
    }

    const { data: supaAudits, error: aErr } = await supabaseAdmin
      .from('RepairRelatedDamageAudit')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(500);

    if (!aErr && supaAudits && supaAudits.length > 0) {
      auditCache = supaAudits;
      saveLocalFile(AUDIT_FILE, auditCache);
    }
  } catch (err) {
    console.warn('[SUPABASE DAMAGE SYNC WARN - USING LOCAL CACHE]', err);
  }

  isInitialized = true;
}

/**
 * Generate sequential damage record number (RRD-YYYY-XXXX)
 */
export async function generateDamageRecordNumber(): Promise<string> {
  await initializeDamageStorage();
  const currentYear = getNepalDateTime().date.slice(0, 4);

  let maxNum = 0;
  for (const r of damageCache.values()) {
    if (r.recordNumber && r.recordNumber.startsWith(`RRD-${currentYear}-`)) {
      const match = r.recordNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
      }
    }
  }

  try {
    const { data: supaRecords } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .select('recordNumber')
      .ilike('recordNumber', `RRD-${currentYear}-%`)
      .order('recordNumber', { ascending: false })
      .limit(10);

    if (supaRecords && supaRecords.length > 0) {
      for (const r of supaRecords) {
        if (!r.recordNumber) continue;
        const match = r.recordNumber.match(/(\d+)$/);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
        }
      }
    }
  } catch (e) {
    // Local max is sufficient fallback
  }

  const nextNum = maxNum + 1;
  return `RRD-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

/**
 * Fetch staff user info
 */
export async function getStaffUserDetails(userId: string): Promise<{ id: string; name: string; email: string; role: string; department?: string } | null> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, department')
      .eq('id', userId)
      .single();

    if (user && !error) return user;
  } catch (err) {
    console.warn('[FETCH STAFF USER DETAIL WARN]', err);
  }
  return null;
}

/**
 * Query damage records with role-based scoping and multi-dimensional filters
 */
export async function queryDamageRecords(options: {
  staffId?: string;
  role?: string;
  component?: string;
  damageType?: string;
  date?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
  year?: string; // YYYY
  startDate?: string;
  endDate?: string;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ records: RepairRelatedDamageRecord[]; total: number }> {
  await initializeDamageStorage();

  // Try querying fresh from Supabase
  try {
    let query = supabaseAdmin
      .from('RepairRelatedDamage')
      .select('*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role, department)', { count: 'exact' });

    if (!options.includeArchived) {
      query = query.eq('isArchived', false);
    }

    if (options.staffId && options.staffId !== 'ALL') {
      query = query.eq('staffId', options.staffId);
    }

    if (options.role && options.role !== 'ALL') {
      query = query.eq('staffRole', options.role);
    }

    if (options.component && options.component !== 'ALL') {
      query = query.eq('damagedComponent', options.component);
    }

    if (options.damageType && options.damageType !== 'ALL') {
      query = query.eq('damageType', options.damageType);
    }

    if (options.date) {
      query = query.eq('damageDate', options.date);
    } else if (options.month) {
      query = query.ilike('damageDate', `${options.month}%`);
    } else if (options.year) {
      query = query.ilike('damageDate', `${options.year}%`);
    } else if (options.startDate || options.endDate) {
      if (options.startDate) query = query.gte('damageDate', options.startDate);
      if (options.endDate) query = query.lte('damageDate', options.endDate);
    }

    if (options.search) {
      const s = options.search.trim();
      query = query.or(`recordNumber.ilike.%${s}%,staffName.ilike.%${s}%,repairNumber.ilike.%${s}%,deviceBrand.ilike.%${s}%,deviceModel.ilike.%${s}%,damagedComponent.ilike.%${s}%,damageDescription.ilike.%${s}%`);
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const { data, count, error } = await query
      .order('damageDate', { ascending: false })
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && data) {
      // Update local cache
      data.forEach((d: any) => {
        damageCache.set(d.id, d);
      });
      saveLocalFile(DAMAGE_FILE, Array.from(damageCache.values()));
      return { records: data, total: count ?? data.length };
    }
  } catch (err) {
    console.warn('[QUERY DAMAGE DB EXCEPTION - USING LOCAL CACHE]', err);
  }

  // Fallback to local memory filter
  let allRecords = Array.from(damageCache.values());

  if (!options.includeArchived) {
    allRecords = allRecords.filter(r => !r.isArchived && r.status !== 'ARCHIVED');
  }

  if (options.staffId && options.staffId !== 'ALL') {
    allRecords = allRecords.filter(r => r.staffId === options.staffId);
  }

  if (options.role && options.role !== 'ALL') {
    allRecords = allRecords.filter(r => r.staffRole === options.role);
  }

  if (options.component && options.component !== 'ALL') {
    allRecords = allRecords.filter(r => r.damagedComponent === options.component);
  }

  if (options.damageType && options.damageType !== 'ALL') {
    allRecords = allRecords.filter(r => r.damageType === options.damageType);
  }

  if (options.date) {
    allRecords = allRecords.filter(r => r.damageDate === options.date);
  } else if (options.month) {
    allRecords = allRecords.filter(r => r.damageDate.startsWith(options.month!));
  } else if (options.year) {
    allRecords = allRecords.filter(r => r.damageDate.startsWith(options.year!));
  } else if (options.startDate || options.endDate) {
    if (options.startDate) allRecords = allRecords.filter(r => r.damageDate >= options.startDate!);
    if (options.endDate) allRecords = allRecords.filter(r => r.damageDate <= options.endDate!);
  }

  if (options.search) {
    const s = options.search.toLowerCase().trim();
    allRecords = allRecords.filter(r => 
      (r.recordNumber && r.recordNumber.toLowerCase().includes(s)) ||
      (r.staffName && r.staffName.toLowerCase().includes(s)) ||
      (r.repairNumber && r.repairNumber.toLowerCase().includes(s)) ||
      (r.deviceBrand && r.deviceBrand.toLowerCase().includes(s)) ||
      (r.deviceModel && r.deviceModel.toLowerCase().includes(s)) ||
      (r.damagedComponent && r.damagedComponent.toLowerCase().includes(s)) ||
      (r.damageDescription && r.damageDescription.toLowerCase().includes(s))
    );
  }

  // Sort descending by date
  allRecords.sort((a, b) => (b.damageDate + (b.damageTime || '')).localeCompare(a.damageDate + (a.damageTime || '')));

  const total = allRecords.length;
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  const sliced = allRecords.slice(offset, offset + limit);

  return { records: sliced, total };
}

/**
 * Get Damage Overview Metrics
 */
export async function getDamageOverviewMetrics(staffIdScope?: string): Promise<{
  totalRecords: number;
  thisMonthRecords: number;
  todayRecords: number;
  totalEstimatedCost: number;
  totalDeductions: number;
  componentBreakdown: Record<string, number>;
  latestRecord?: RepairRelatedDamageRecord | null;
  latestRecords: RepairRelatedDamageRecord[];
  currentMonth: string;
  todayDate: string;
}> {
  await initializeDamageStorage();

  const { date: todayDate, time: _time } = getNepalDateTime();
  const currentMonth = todayDate.slice(0, 7); // YYYY-MM

  // Fetch all active records from memory / DB
  let records = Array.from(damageCache.values()).filter(r => !r.isArchived && r.status !== 'ARCHIVED');

  if (staffIdScope && staffIdScope !== 'ALL') {
    records = records.filter(r => r.staffId === staffIdScope);
  }

  let totalRecords = 0;
  let thisMonthRecords = 0;
  let todayRecords = 0;
  let totalEstimatedCost = 0;
  let totalDeductions = 0;
  const componentBreakdown: Record<string, number> = {};

  records.forEach(r => {
    totalRecords++;
    const cost = Number(r.estimatedCost || 0);
    totalEstimatedCost += isNaN(cost) ? 0 : cost;
    if (r.inventoryDeducted) totalDeductions++;

    if (r.damageDate === todayDate) {
      todayRecords++;
    }

    if (r.damageDate && r.damageDate.startsWith(currentMonth)) {
      thisMonthRecords++;
    }

    const comp = r.damagedComponent || 'Other';
    componentBreakdown[comp] = (componentBreakdown[comp] || 0) + 1;
  });

  // Sort for latest
  const sorted = [...records].sort((a, b) => 
    (b.damageDate + (b.damageTime || '')).localeCompare(a.damageDate + (a.damageTime || ''))
  );

  return {
    totalRecords,
    thisMonthRecords,
    todayRecords,
    totalEstimatedCost,
    totalDeductions,
    componentBreakdown,
    latestRecord: sorted[0] || null,
    latestRecords: sorted.slice(0, 5),
    currentMonth,
    todayDate,
  };
}

/**
 * Get Single Damage Record with Audits
 */
export async function getDamageRecordById(id: string): Promise<RepairRelatedDamageRecord | null> {
  await initializeDamageStorage();

  try {
    const { data: record, error } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .select('*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role, department), audits:RepairRelatedDamageAudit(*)')
      .eq('id', id)
      .single();

    if (!error && record) {
      damageCache.set(record.id, record);
      return record;
    }
  } catch (err) {
    console.warn('[FETCH DAMAGE BY ID DB WARN]', err);
  }

  const cached = damageCache.get(id);
  if (cached) {
    const relatedAudits = auditCache.filter(a => a.damageRecordId === id);
    return {
      ...cached,
      auditLogs: relatedAudits,
    } as any;
  }

  return null;
}

/**
 * Create a new Repair-Related Damage Record with Audit
 */
export async function createDamageRecord(
  data: {
    staffId: string;
    damagedComponent: string;
    damageType?: string;
    damageDescription: string;
    repairId?: string | null;
    repairNumber?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    deviceBrand?: string | null;
    deviceModel?: string | null;
    damageDate?: string;
    damageTime?: string;
    quantity?: number;
    estimatedCost?: number | null;
    notes?: string | null;
    inventoryItemId?: string | null;
    deductInventory?: boolean;
    branchId?: string | null;
  },
  actor: { id: string; name: string; role: string }
): Promise<RepairRelatedDamageRecord> {
  await initializeDamageStorage();

  const { date: nptDate, time: nptTime, iso: nptIso } = getNepalDateTime();

  // Resolve staff details
  let staffName = 'Staff Member';
  let staffRole = 'TECHNICIAN';
  const staffDetails = await getStaffUserDetails(data.staffId);
  if (staffDetails) {
    staffName = staffDetails.name;
    staffRole = staffDetails.role;
  }

  const recordNumber = await generateDamageRecordNumber();
  const recordId = uuidv4();

  const newRecord: RepairRelatedDamageRecord = {
    id: recordId,
    recordNumber,
    staffId: data.staffId,
    staffName,
    staffRole,
    repairId: data.repairId || null,
    repairNumber: data.repairNumber || null,
    customerId: data.customerId || null,
    customerName: data.customerName || null,
    deviceBrand: data.deviceBrand || null,
    deviceModel: data.deviceModel || null,
    damagedComponent: data.damagedComponent.trim(),
    damageType: data.damageType || 'CRACKED',
    damageDescription: data.damageDescription.trim(),
    damageDate: data.damageDate || nptDate,
    damageTime: data.damageTime || nptTime,
    damageTimestamp: nptIso,
    quantity: Math.max(1, parseInt(String(data.quantity || 1), 10) || 1),
    estimatedCost: data.estimatedCost !== undefined && data.estimatedCost !== null && !isNaN(Number(data.estimatedCost))
      ? Number(data.estimatedCost)
      : null,
    notes: data.notes || null,
    inventoryItemId: data.inventoryItemId || null,
    inventoryDeducted: Boolean(data.deductInventory && data.inventoryItemId),
    inventoryTxId: null,
    recordedById: actor.id,
    recordedByName: actor.name,
    recordedByRole: actor.role,
    branchId: data.branchId || null,
    status: 'ACTIVE',
    isArchived: false,
    deletedAt: null,
    createdAt: nptIso,
    updatedAt: nptIso,
    staff: {
      name: staffName,
      email: staffDetails?.email || '',
      role: staffRole,
      department: staffDetails?.department || null,
    },
  };

  // 1. Update local cache & file immediately
  damageCache.set(recordId, newRecord);
  saveLocalFile(DAMAGE_FILE, Array.from(damageCache.values()));

  // 2. Create Audit Record
  const auditId = uuidv4();
  const auditRecord: RepairRelatedDamageAuditRecord = {
    id: auditId,
    damageRecordId: recordId,
    action: 'CREATED',
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousData: null,
    newData: JSON.stringify(newRecord),
    reason: 'Initial damage incident recorded',
    notes: data.notes || null,
    createdAt: nptIso,
  };

  auditCache.unshift(auditRecord);
  saveLocalFile(AUDIT_FILE, auditCache);

  // 3. Persist to Supabase in background / async
  try {
    const dbPayload = { ...newRecord };
    delete (dbPayload as any).staff;

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('RepairRelatedDamage')
      .insert([dbPayload])
      .select('*')
      .single();

    if (insertErr) {
      console.error('[SUPABASE DAMAGE INSERT ERROR]', insertErr);
    }

    await supabaseAdmin
      .from('RepairRelatedDamageAudit')
      .insert([auditRecord]);

    if (inserted) {
      damageCache.set(recordId, {
        ...inserted,
        staff: newRecord.staff,
      });
    }
  } catch (err) {
    console.error('[SUPABASE DAMAGE INSERT EXCEPTION]', err);
  }

  // 4. Broadcast Real-time event
  await broadcastServerChange('RepairRelatedDamage', 'CREATE', recordId, newRecord);

  return newRecord;
}

/**
 * Update an existing Repair-Related Damage Record with Audit
 */
export async function updateDamageRecord(
  id: string,
  updates: Partial<RepairRelatedDamageRecord> & { auditReason?: string },
  actor: { id: string; name: string; role: string }
): Promise<RepairRelatedDamageRecord> {
  await initializeDamageStorage();

  const existing = await getDamageRecordById(id);
  if (!existing || existing.isArchived) {
    throw new Error('Damage record not found or already archived.');
  }

  const { iso: nowIso } = getNepalDateTime();
  const previousDataSnapshot = JSON.stringify(existing);

  const updatedRecord: RepairRelatedDamageRecord = {
    ...existing,
    ...updates,
    damagedComponent: updates.damagedComponent ? updates.damagedComponent.trim() : existing.damagedComponent,
    damageDescription: updates.damageDescription !== undefined ? updates.damageDescription.trim() : existing.damageDescription,
    quantity: updates.quantity !== undefined ? Math.max(1, parseInt(String(updates.quantity), 10) || 1) : existing.quantity,
    estimatedCost: updates.estimatedCost !== undefined
      ? (updates.estimatedCost !== null && !isNaN(Number(updates.estimatedCost)) ? Number(updates.estimatedCost) : null)
      : existing.estimatedCost,
    updatedAt: nowIso,
  };

  // 1. Update local cache & file
  damageCache.set(id, updatedRecord);
  saveLocalFile(DAMAGE_FILE, Array.from(damageCache.values()));

  // 2. Create Audit Record
  const auditId = uuidv4();
  const auditRecord: RepairRelatedDamageAuditRecord = {
    id: auditId,
    damageRecordId: id,
    action: 'UPDATED',
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousData: previousDataSnapshot,
    newData: JSON.stringify(updatedRecord),
    reason: updates.auditReason || 'Record details modified by supervisor',
    notes: updates.notes || null,
    createdAt: nowIso,
  };

  auditCache.unshift(auditRecord);
  saveLocalFile(AUDIT_FILE, auditCache);

  // 3. Persist to Supabase
  try {
    const dbPayload = { ...updatedRecord };
    delete (dbPayload as any).staff;
    delete (dbPayload as any).audits;
    delete (dbPayload as any).auditLogs;
    delete (dbPayload as any).auditReason;

    await supabaseAdmin
      .from('RepairRelatedDamage')
      .update(dbPayload)
      .eq('id', id);

    await supabaseAdmin
      .from('RepairRelatedDamageAudit')
      .insert([auditRecord]);
  } catch (err) {
    console.error('[SUPABASE DAMAGE UPDATE EXCEPTION]', err);
  }

  // 4. Broadcast Real-time event
  await broadcastServerChange('RepairRelatedDamage', 'UPDATE', id, updatedRecord);

  return updatedRecord;
}

/**
 * Archive / Delete a Repair-Related Damage Record with Audit
 */
export async function archiveDamageRecord(
  id: string,
  actor: { id: string; name: string; role: string },
  reason?: string
): Promise<{ success: boolean; message: string }> {
  await initializeDamageStorage();

  const existing = await getDamageRecordById(id);
  if (!existing) {
    throw new Error('Damage record not found.');
  }

  const { iso: nowIso } = getNepalDateTime();
  const previousDataSnapshot = JSON.stringify(existing);

  const archivedRecord: RepairRelatedDamageRecord = {
    ...existing,
    isArchived: true,
    status: 'ARCHIVED',
    deletedAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Update local cache
  damageCache.set(id, archivedRecord);
  saveLocalFile(DAMAGE_FILE, Array.from(damageCache.values()));

  // 2. Create Audit Record
  const auditId = uuidv4();
  const auditRecord: RepairRelatedDamageAuditRecord = {
    id: auditId,
    damageRecordId: id,
    action: 'ARCHIVED',
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousData: previousDataSnapshot,
    newData: JSON.stringify(archivedRecord),
    reason: reason || 'Record archived by administrator',
    createdAt: nowIso,
  };

  auditCache.unshift(auditRecord);
  saveLocalFile(AUDIT_FILE, auditCache);

  // 3. Persist to Supabase
  try {
    await supabaseAdmin
      .from('RepairRelatedDamage')
      .update({
        isArchived: true,
        status: 'ARCHIVED',
        deletedAt: nowIso,
        updatedAt: nowIso,
      })
      .eq('id', id);

    await supabaseAdmin
      .from('RepairRelatedDamageAudit')
      .insert([auditRecord]);
  } catch (err) {
    console.error('[SUPABASE DAMAGE ARCHIVE EXCEPTION]', err);
  }

  // 4. Broadcast Real-time event
  await broadcastServerChange('RepairRelatedDamage', 'DELETE', id);

  return { success: true, message: 'Damage record safely archived.' };
}
