import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe environment variable resolution for Vite and Node
const getEnvVar = (viteKey: string, nodeKey: string, fallback: string = ''): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[viteKey]) {
      return String((import.meta as any).env[viteKey]);
    }
  } catch (_) {}

  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[nodeKey]) return String(process.env[nodeKey]);
      if (process.env[viteKey]) return String(process.env[viteKey]);
    }
  } catch (_) {}

  return fallback;
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL', 'https://mts-mobile-lab.supabase.co');
const SUPABASE_ANON_KEY = getEnvVar(
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cy1sYWIiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder'
);

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
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
    const channel = supabase.channel('repairs_realtime');
    await channel.send({
      type: 'broadcast',
      event: 'repair_sync',
      payload: sanitized
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
    const channel = supabase.channel('repairs_realtime');
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
    const channel = supabase.channel(`${entityName}_realtime`);
    await channel.send({
      type: 'broadcast',
      event: `${entityName}_sync`,
      payload: {
        ...data,
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
    const channel = supabase.channel(`${entityName}_realtime`);
    await channel.send({
      type: 'broadcast',
      event: `${entityName}_delete`,
      payload: { id: String(id), timestamp: Date.now() }
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
