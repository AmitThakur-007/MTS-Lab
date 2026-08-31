import { supabaseAdmin } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import { broadcastServerChange } from './realtimeSync';

export interface AuditLogEntry {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  status?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: any;
  details?: any;
  previousValue?: any;
  newValue?: any;
  metadata?: any;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    let userEmail = entry.userEmail || null;
    let userName = entry.userName || null;
    let userRole = entry.userRole || null;

    // Enrich user details if userId is provided but metadata is missing
    if (entry.userId && (!userEmail || !userName || !userRole)) {
      try {
        const { data: user } = await supabaseAdmin
          .from('User')
          .select('email, name, role')
          .eq('id', entry.userId)
          .maybeSingle();

        if (user) {
          userEmail = userEmail || user.email;
          userName = userName || user.name;
          userRole = userRole || user.role;
        }
      } catch (_) {
        // Continue even if lookup fails
      }
    }

    const payload = {
      id: uuidv4(),
      userId: entry.userId || null,
      userEmail,
      userName,
      userRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ? String(entry.resourceId) : null,
      status: entry.status || 'SUCCESS',
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      deviceInfo: typeof entry.deviceInfo === 'object' ? JSON.stringify(entry.deviceInfo) : (entry.deviceInfo ? String(entry.deviceInfo) : null),
      details: typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details ? String(entry.details) : null),
      previousValue: typeof entry.previousValue === 'object' ? JSON.stringify(entry.previousValue) : (entry.previousValue ? String(entry.previousValue) : null),
      newValue: typeof entry.newValue === 'object' ? JSON.stringify(entry.newValue) : (entry.newValue ? String(entry.newValue) : null),
      metadata: typeof entry.metadata === 'object' ? JSON.stringify(entry.metadata) : (entry.metadata ? String(entry.metadata) : null),
      createdAt: new Date().toISOString(),
    };

    const { data: inserted } = await supabaseAdmin.from('AuditLog').insert([payload]).select('*').maybeSingle();

    // Broadcast audit log event in realtime
    await broadcastServerChange('AuditLog', 'CREATE', payload.id, inserted || payload);
  } catch (err) {
    console.warn('[AUDIT LOG WARNING] Failed to record audit log:', err);
  }
}

