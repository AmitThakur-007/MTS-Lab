import { supabaseAdmin } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: any;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const payload = {
      id: uuidv4(),
      userId: entry.userId || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      details: typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details ? String(entry.details) : null),
      createdAt: new Date().toISOString(),
    };

    await supabaseAdmin.from('AuditLog').insert([payload]);
  } catch (err) {
    console.warn('[AUDIT LOG WARNING] Failed to record audit log:', err);
  }
}
