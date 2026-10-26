import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

export type NotificationType =
  | 'REPAIR_ASSIGNED'
  | 'REPAIR_TRANSFER'
  | 'TRANSFER_REQUEST'
  | 'TRANSFER_ACCEPTED'
  | 'TRANSFER_REJECTED'
  | 'REPAIR_URGENT'
  | 'REPAIR_ALERT'
  | 'REPAIR_STATUS'
  | 'REPAIR_NOTE'
  | 'ATTENDANCE_REQUEST'
  | 'ATTENDANCE_APPROVED'
  | 'ATTENDANCE_REJECTED'
  | 'ATTENDANCE_ALERT'
  | 'ACCESS_REQUEST'
  | 'ACCESS_APPROVED'
  | 'ACCESS_REJECTED'
  | 'DEVICE_BLOCKED'
  | 'DEVICE_RESTORED'
  | 'INTERNAL_MESSAGE'
  | 'INVENTORY_ALERT'
  | 'COURIER_UPDATE'
  | 'WARRANTY_ALERT'
  | 'GENERAL';

export type NotificationPriority = 'NORMAL' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface NotificationRecord {
  id: string;
  userId: string | null; // Specific recipient user ID
  targetRole?: string | null; // e.g. 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'
  title: string;
  message: string;
  type: NotificationType;
  repairId?: string | null;
  repairNumber?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderRole?: string | null;
  priority?: NotificationPriority;
  link?: string | null;
  metadata?: any;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function formatNotificationRecord(row: any): NotificationRecord {
  const metadata = typeof row.metadata === 'string' ? safeJsonParse(row.metadata) : (row.metadata || {});
  return {
    id: row.id,
    userId: row.userId || null,
    targetRole: row.targetRole || metadata?.targetRole || null,
    title: row.title || '',
    message: row.message || '',
    type: (row.type as NotificationType) || 'GENERAL',
    repairId: row.repairId || null,
    repairNumber: row.repairNumber || null,
    senderId: row.senderId || null,
    senderName: row.senderName || null,
    senderRole: row.senderRole || metadata?.senderRole || null,
    priority: (row.priority as NotificationPriority) || 'NORMAL',
    link: row.link || metadata?.link || (row.repairId ? `/dashboard/repairs/${row.repairId}` : null),
    metadata: metadata || null,
    isRead: Boolean(row.isRead),
    readAt: row.readAt || null,
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
  };
}

/**
 * Initialize notification storage.
 * In production Supabase PostgreSQL is the authoritative store.
 * Kept for signature compatibility with existing callers. Zero filesystem side-effects.
 */
export async function initializeNotificationStorage(): Promise<void> {
  // Pure Supabase persistence - no local file operations required
  return Promise.resolve();
}

/**
 * Get notifications for a specific user and their role directly from Supabase PostgreSQL.
 * Securely scopes query to the authenticated recipient user.
 */
export async function getUserNotifications(
  user: { id: string; role: string },
  options: { unreadOnly?: boolean; limit?: number; type?: string } = {}
): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
  const { unreadOnly = false, limit = 50, type } = options;

  let query = supabaseAdmin
    .from('Notification')
    .select('*')
    .eq('userId', user.id);

  if (unreadOnly) {
    query = query.eq('isRead', false);
  }
  if (type) {
    query = query.eq('type', type);
  }

  query = query.order('createdAt', { ascending: false }).limit(limit);

  const { data: rows, error } = await query;
  if (error) {
    console.error('[SUPABASE GET USER NOTIFICATIONS ERROR]', error);
    throw new Error(`Failed to retrieve notifications: ${error.message}`);
  }

  // Exact unread count
  const { count: unreadCount, error: countErr } = await supabaseAdmin
    .from('Notification')
    .select('id', { count: 'exact', head: true })
    .eq('userId', user.id)
    .eq('isRead', false);

  if (countErr) {
    console.warn('[SUPABASE UNREAD COUNT WARN]', countErr);
  }

  return {
    notifications: (rows || []).map(formatNotificationRecord),
    unreadCount: unreadCount || 0,
  };
}

/**
 * Create a new notification persisted directly in Supabase PostgreSQL and dispatch real-time events.
 * Resolves recipient user IDs when targetRole is specified.
 */
export async function createNotification(
  data: {
    userId?: string | null;
    targetRole?: string | null;
    title: string;
    message: string;
    type: NotificationType;
    repairId?: string | null;
    repairNumber?: string | null;
    senderId?: string | null;
    senderName?: string | null;
    senderRole?: string | null;
    priority?: NotificationPriority;
    link?: string | null;
    metadata?: any;
  }
): Promise<NotificationRecord> {
  const title = String(data.title || '').trim();
  const message = String(data.message || '').trim();
  const type = data.type || 'GENERAL';

  // Smart link resolution if not explicitly provided
  let link = data.link;
  if (!link && data.repairId) {
    link = `/dashboard/repairs/${data.repairId}`;
  } else if (!link && (type === 'ATTENDANCE_REQUEST' || type === 'ATTENDANCE_APPROVED' || type === 'ATTENDANCE_REJECTED')) {
    link = '/dashboard/attendance';
  } else if (!link && (type === 'ACCESS_REQUEST' || type === 'ACCESS_APPROVED' || type === 'ACCESS_REJECTED')) {
    link = '/dashboard/access-requests';
  } else if (!link && type === 'COURIER_UPDATE') {
    link = '/dashboard/courier';
  } else if (!link && type === 'WARRANTY_ALERT') {
    link = '/dashboard/battery-warranty';
  }

  // Resolve target user IDs (PostgreSQL Notification.userId constraint is NOT NULL)
  let targetUserIds: string[] = [];

  if (data.userId) {
    targetUserIds = [data.userId];
  } else if (data.targetRole) {
    try {
      let roleFilter: string[] = [data.targetRole];
      if (data.targetRole === 'ADMIN') {
        roleFilter = ['ADMIN', 'SUPER_ADMIN'];
      } else if (data.targetRole === 'MANAGER') {
        roleFilter = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'];
      }

      const { data: matchedUsers, error: userErr } = await supabaseAdmin
        .from('User')
        .select('id')
        .is('deletedAt', null)
        .in('role', roleFilter);

      if (!userErr && matchedUsers && matchedUsers.length > 0) {
        targetUserIds = matchedUsers.map((u: any) => u.id);
      }
    } catch (uErr) {
      console.warn('[NOTIF RESOLVE TARGET ROLE WARN]', uErr);
    }
  }

  // If still no target user IDs, fallback to finding active admins or staff
  if (targetUserIds.length === 0) {
    try {
      const { data: admins } = await supabaseAdmin
        .from('User')
        .select('id')
        .is('deletedAt', null)
        .in('role', ['SUPER_ADMIN', 'ADMIN'])
        .limit(5);

      if (admins && admins.length > 0) {
        targetUserIds = admins.map((u: any) => u.id);
      }
    } catch (_) {}
  }

  if (targetUserIds.length === 0) {
    console.warn('[CREATE NOTIFICATION WARN]: No target recipients found. Skipping notification insert.');
    return {
      id: uuidv4(),
      userId: null,
      title,
      message,
      type,
      priority: data.priority || 'NORMAL',
      link: link || null,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const now = new Date().toISOString();
  const metaObj = {
    ...(typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {}),
    ...(link ? { link } : {}),
    ...(data.targetRole ? { targetRole: data.targetRole } : {}),
    ...(data.senderRole ? { senderRole: data.senderRole } : {}),
  };
  const metadataStr = JSON.stringify(metaObj);

  const rowsToInsert = targetUserIds.map((uid) => ({
    id: uuidv4(),
    userId: uid,
    title,
    message,
    type,
    repairId: data.repairId || null,
    repairNumber: data.repairNumber || null,
    senderId: data.senderId || null,
    senderName: data.senderName || null,
    priority: data.priority || 'NORMAL',
    metadata: metadataStr,
    isRead: false,
    readAt: null,
    createdAt: now,
  }));

  const { data: inserted, error } = await supabaseAdmin
    .from('Notification')
    .insert(rowsToInsert)
    .select('*');

  if (error) {
    console.error('[SUPABASE NOTIFICATION INSERT ERROR]', error);
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  const primaryRecord = formatNotificationRecord(inserted?.[0] || rowsToInsert[0]);

  // Broadcast realtime event for each created notification
  for (const rec of (inserted || rowsToInsert)) {
    const formatted = formatNotificationRecord(rec);
    broadcastServerChange('Notification', 'CREATE', formatted.id, formatted).catch(() => {});
  }

  return primaryRecord;
}

/**
 * Mark a single notification as read in Supabase PostgreSQL
 */
export async function markNotificationRead(id: string, userId: string): Promise<NotificationRecord | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('Notification')
    .update({ isRead: true, readAt: now })
    .eq('id', id)
    .eq('userId', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[SUPABASE NOTIFICATION MARK READ ERROR]', error);
    throw error;
  }

  if (!data) return null;

  const record = formatNotificationRecord(data);
  broadcastServerChange('Notification', 'UPDATE', id, record).catch(() => {});
  return record;
}

/**
 * Mark all notifications as read for a user in Supabase PostgreSQL
 */
export async function markAllNotificationsRead(user: { id: string; role: string }): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('Notification')
    .update({ isRead: true, readAt: now })
    .eq('userId', user.id)
    .eq('isRead', false)
    .select('id');

  if (error) {
    console.error('[SUPABASE NOTIFICATION MARK ALL READ ERROR]', error);
    throw error;
  }

  const count = data?.length || 0;
  if (count > 0) {
    broadcastServerChange('Notification', 'UPDATE', 'bulk', { userId: user.id }).catch(() => {});
  }

  return count;
}

/**
 * Delete a notification from Supabase PostgreSQL with role-based authorization check
 */
export async function deleteNotification(id: string, user: { id: string; role: string }): Promise<boolean> {
  let query = supabaseAdmin.from('Notification').delete().eq('id', id);

  const isSuperAdminOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  if (!isSuperAdminOrAdmin) {
    query = query.eq('userId', user.id);
  }

  const { data, error } = await query.select('id');
  if (error) {
    console.error('[SUPABASE NOTIFICATION DELETE ERROR]', error);
    throw error;
  }

  const deleted = Boolean(data && data.length > 0);
  if (deleted) {
    broadcastServerChange('Notification', 'DELETE', id).catch(() => {});
  }

  return deleted;
}
