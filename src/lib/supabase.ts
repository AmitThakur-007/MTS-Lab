import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PRODUCTION_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

// Safe environment variable resolution for Vite and Node with placeholder sanitizer
const resolveSupabaseUrl = (): string => {
  let url = '';
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) {
      url = String((import.meta as any).env.VITE_SUPABASE_URL).trim();
    }
  } catch (_) { }

  if (!url) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      }
    } catch (_) { }
  }

  if (!url || url.includes('your-project') || url.includes('example.com') || !url.startsWith('http')) {
    return PRODUCTION_SUPABASE_URL;
  }
  return url;
};

const resolveSupabaseKey = (): string => {
  let key = '';
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) {
      key = String((import.meta as any).env.VITE_SUPABASE_ANON_KEY).trim();
    }
  } catch (_) { }

  if (!key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
      }
    } catch (_) { }
  }

  if (!key || key.includes('...') || key.length < 50) {
    return PRODUCTION_SUPABASE_ANON_KEY;
  }
  return key;
};

const SUPABASE_URL = resolveSupabaseUrl();
const SUPABASE_ANON_KEY = resolveSupabaseKey();

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[SUPABASE ERROR] Missing Supabase URL or Anon Key configuration.');
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();
export default supabase;

/**
 * Sanitize repair object for Supabase Realtime synchronization
 */
export function sanitizeRepairForSupabase(repair: any) {
  if (!repair) return null;
  return {
    id: String(repair.id || ''),
    repairNumber: String(repair.repairNumber || ''),
    customerId: repair.customerId ? String(repair.customerId) : (repair.customer?.id ? String(repair.customer.id) : null),
    customerName: String(repair.customerName || repair.customer?.name || ''),
    customerPhone: String(repair.customerPhone || repair.customer?.phone || ''),
    customerEmail: repair.customerEmail || repair.customer?.email || null,
    customerAddress: repair.customerAddress || repair.customer?.address || null,
    deviceBrand: String(repair.deviceBrand || 'apple'),
    deviceModel: String(repair.deviceModel || ''),
    imeiNumber: repair.imeiNumber || null,
    deviceCondition: repair.deviceCondition || 'Fair',
    problemDescription: repair.problemDescription || '',
    accessoriesReceived: repair.accessoriesReceived || null,
    estimatedCost: Number(repair.estimatedCost ?? repair.totalCost ?? 0),
    advancePaid: Number(repair.advancePaid ?? 0),
    totalPaid: Number(repair.totalPaid ?? repair.advancePaid ?? 0),
    paymentStatus: repair.paymentStatus || 'UNPAID',
    technicianId: repair.technicianId || repair.technician?.id || null,
    technician: repair.technician ? {
      id: String(repair.technician.id || ''),
      name: String(repair.technician.name || ''),
      role: String(repair.technician.role || 'TECHNICIAN')
    } : null,
    status: String(repair.status || 'RECEIVED'),
    priority: String(repair.priority || 'NORMAL').toUpperCase().trim(),
    priorityUpdatedAt: repair.priorityUpdatedAt ? new Date(repair.priorityUpdatedAt).toISOString() : null,
    partsUsed: repair.partsUsed || null,
    remarks: repair.remarks || null,
    expectedCompletionDate: repair.expectedCompletionDate ? new Date(repair.expectedCompletionDate).toISOString() : null,
    createdAt: repair.createdAt ? new Date(repair.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSyncTimestamp: Date.now()
  };
}

/**
 * Broadcast an entity update or sync to Supabase Realtime Channel
 */
export async function syncRepairToSupabase(repair: any) {
  if (!repair || !repair.id) return;
  try {
    const sanitized = sanitizeRepairForSupabase(repair);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mts-realtime-update', {
          detail: {
            entity: 'repair',
            action: 'UPDATE',
            id: String(repair.id),
            data: sanitized,
            timestamp: Date.now()
          }
        })
      );
    }
    const channel = supabase.channel('mts_app_db_changes');
    if (channel.state !== 'joined') {
      await channel.subscribe();
    }
    await channel.send({
      type: 'broadcast',
      event: 'repair_sync',
      payload: {
        entity: 'repair',
        action: 'UPDATE',
        id: String(repair.id),
        data: sanitized,
        ...sanitized
      }
    });
  } catch (err) {
    console.warn('[SUPABASE REALTIME] Sync repair notice:', err);
  }
}

/**
 * Broadcast repair deletion to Supabase Realtime Channel
 */
export async function deleteRepairFromSupabase(repairId: string) {
  if (!repairId) return;
  try {
    const channel = supabase.channel('mts_app_db_changes');
    if (channel.state !== 'joined') {
      await channel.subscribe();
    }
    await channel.send({
      type: 'broadcast',
      event: 'repair_delete',
      payload: { id: repairId, timestamp: Date.now() }
    });
  } catch (err) {
    console.warn('[SUPABASE REALTIME] Delete repair notice:', err);
  }
}

/**
 * Broadcast general entity sync to Supabase Realtime Channel
 */
export async function syncEntityToSupabase(entityName: string, id: string, data: any) {
  if (!entityName || !id || !data) return;
  try {
    const channel = supabase.channel('mts_app_db_changes');
    if (channel.state !== 'joined') {
      await channel.subscribe();
    }
    await channel.send({
      type: 'broadcast',
      event: `${entityName.toLowerCase()}_sync`,
      payload: {
        ...data,
        entity: entityName.toLowerCase(),
        id: String(id),
        updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString(),
        lastSyncTimestamp: Date.now()
      }
    });
  } catch (err) {
    console.warn(`[SUPABASE REALTIME] Sync ${entityName} notice:`, err);
  }
}

/**
 * Broadcast general entity deletion to Supabase Realtime Channel
 */
export async function deleteEntityFromSupabase(entityName: string, id: string) {
  if (!entityName || !id) return;
  try {
    const channel = supabase.channel('mts_app_db_changes');
    if (channel.state !== 'joined') {
      await channel.subscribe();
    }
    await channel.send({
      type: 'broadcast',
      event: `${entityName.toLowerCase()}_delete`,
      payload: { entity: entityName.toLowerCase(), id: String(id), timestamp: Date.now() }
    });
  } catch (err) {
    console.warn(`[SUPABASE REALTIME] Delete ${entityName} notice:`, err);
  }
}

// Aliases for compatibility during migration
export const syncRepairToRtdb = syncRepairToSupabase;
export const deleteRepairFromRtdb = deleteRepairFromSupabase;
export const syncEntityToRtdb = syncEntityToSupabase;
export const deleteEntityFromRtdb = deleteEntityFromSupabase;