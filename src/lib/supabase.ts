import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-only Supabase configuration. Never read service-role credentials here.
 *
 * Vite statically replaces direct import.meta.env.VITE_* references during the
 * production build. Keep the public project values as a last-resort fallback
 * so a missing Vercel VITE_* variable cannot blank the entire SPA.
 */
const DEFAULT_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const DEFAULT_SUPABASE_PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

const SUPABASE_URL = String(
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
).trim();
const SUPABASE_ANON_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLIC_KEY
).trim();

if (!SUPABASE_URL.startsWith('https://')) {
  throw new Error('Invalid Supabase URL configuration.');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase public client key configuration.');
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();
export default supabase;

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

async function getBroadcastChannel() {
  const channel = supabase.channel('mts_app_db_changes');
  if (channel.state !== 'joined') await channel.subscribe();
  return channel;
}

export async function syncRepairToSupabase(repair: any) {
  if (!repair?.id) return;
  try {
    const sanitized = sanitizeRepairForSupabase(repair);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mts-realtime-update', {
        detail: { entity: 'repair', action: 'UPDATE', id: String(repair.id), data: sanitized, timestamp: Date.now() }
      }));
    }
    const channel = await getBroadcastChannel();
    await channel.send({
      type: 'broadcast', event: 'repair_sync',
      payload: { entity: 'repair', action: 'UPDATE', id: String(repair.id), data: sanitized, ...sanitized }
    });
  } catch (err) {
    console.warn('[SUPABASE REALTIME] Sync repair notice:', err);
  }
}

export async function deleteRepairFromSupabase(repairId: string) {
  if (!repairId) return;
  try {
    const channel = await getBroadcastChannel();
    await channel.send({ type: 'broadcast', event: 'repair_delete', payload: { id: repairId, timestamp: Date.now() } });
  } catch (err) {
    console.warn('[SUPABASE REALTIME] Delete repair notice:', err);
  }
}

export async function syncEntityToSupabase(entityName: string, id: string, data: any) {
  if (!entityName || !id || !data) return;
  try {
    const channel = await getBroadcastChannel();
    await channel.send({
      type: 'broadcast', event: `${entityName.toLowerCase()}_sync`,
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

export async function deleteEntityFromSupabase(entityName: string, id: string) {
  if (!entityName || !id) return;
  try {
    const channel = await getBroadcastChannel();
    await channel.send({
      type: 'broadcast', event: `${entityName.toLowerCase()}_delete`,
      payload: { entity: entityName.toLowerCase(), id: String(id), timestamp: Date.now() }
    });
  } catch (err) {
    console.warn(`[SUPABASE REALTIME] Delete ${entityName} notice:`, err);
  }
}

export const syncRepairToRtdb = syncRepairToSupabase;
export const deleteRepairFromRtdb = deleteRepairFromSupabase;
export const syncEntityToRtdb = syncEntityToSupabase;
export const deleteEntityFromRtdb = deleteEntityFromSupabase;
