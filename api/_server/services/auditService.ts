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

function sanitizePayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  const sanitized: Record<string, any> = {};
  const sensitiveKeys = new Set(['password', 'passwordhash', 'codehash', 'refreshtoken', 'token', 'jwt', 'secret', 'authorization', 'cookie']);
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
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

    const cleanDetails = sanitizePayload(entry.details);
    const cleanPrev = sanitizePayload(entry.previousValue);
    const cleanNext = sanitizePayload(entry.newValue);
    const cleanMeta = sanitizePayload(entry.metadata);

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
      details: typeof cleanDetails === 'object' ? JSON.stringify(cleanDetails) : (cleanDetails ? String(cleanDetails) : null),
      previousValue: typeof cleanPrev === 'object' ? JSON.stringify(cleanPrev) : (cleanPrev ? String(cleanPrev) : null),
      newValue: typeof cleanNext === 'object' ? JSON.stringify(cleanNext) : (cleanNext ? String(cleanNext) : null),
      metadata: typeof cleanMeta === 'object' ? JSON.stringify(cleanMeta) : (cleanMeta ? String(cleanMeta) : null),
      createdAt: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin.from('AuditLog').insert([payload]).select('*').maybeSingle();

    if (insertErr) {
      console.warn('[AUDIT LOG ERROR] Failed to record audit log in Supabase:', insertErr);
    }

    // Broadcast audit log event in realtime
    await broadcastServerChange('AuditLog', 'CREATE', payload.id, inserted || payload);
  } catch (err) {
    console.warn('[AUDIT LOG WARNING] Failed to record audit log:', err);
  }
}

export async function logAuditFromRequest(
  req: any,
  entry: {
    action: string;
    resource: string;
    resourceId?: string | null;
    status?: 'SUCCESS' | 'FAILED' | 'DENIED' | string;
    deviceInfo?: any;
    details?: any;
    previousValue?: any;
    newValue?: any;
    metadata?: any;
    userId?: string | null;
    userEmail?: string | null;
    userName?: string | null;
    userRole?: string | null;
  }
): Promise<void> {
  const user = req?.user;
  const ipAddress = req?.ip || (req?.headers ? (req.headers['x-forwarded-for'] as string) : null) || null;
  const userAgent = req?.headers ? (req.headers['user-agent'] as string) : null;

  return logAudit({
    userId: entry.userId ?? user?.id ?? null,
    userEmail: entry.userEmail ?? user?.email ?? null,
    userName: entry.userName ?? user?.name ?? null,
    userRole: entry.userRole ?? user?.role ?? null,
    ipAddress,
    userAgent,
    ...entry,
  });
}

