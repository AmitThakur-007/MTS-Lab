import fs from 'fs';
import path from 'path';
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
  userId: string | null; // Specific recipient user ID (null = role-based or system-wide)
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

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[NOTIFICATIONS STORAGE DIR WARN]', e);
  }
}

let notificationCache: Map<string, NotificationRecord> = new Map();
let isInitialized = false;

function loadLocalFile(): NotificationRecord[] {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const content = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[NOTIFICATIONS READ ERROR: ${NOTIFICATIONS_FILE}]`, err);
  }
  return [];
}

function saveLocalFile(data: NotificationRecord[]): void {
  try {
    const tempPath = `${NOTIFICATIONS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, NOTIFICATIONS_FILE);
  } catch (err) {
    console.error(`[NOTIFICATIONS WRITE ERROR: ${NOTIFICATIONS_FILE}]`, err);
  }
}

/**
 * Initialize notification storage from local storage & Supabase
 */
export async function initializeNotificationStorage(): Promise<void> {
  if (isInitialized) return;

  const localRecords = loadLocalFile();
  localRecords.forEach((n) => notificationCache.set(n.id, n));

  // Sync with Supabase if available
  try {
    const { data: supaRecords, error } = await supabaseAdmin
      .from('Notification')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(200);

    if (!error && supaRecords && supaRecords.length > 0) {
      supaRecords.forEach((n: any) => {
        const existing = notificationCache.get(n.id);
        if (!existing || new Date(n.updatedAt || n.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
          notificationCache.set(n.id, {
            id: n.id,
            userId: n.userId || null,
            targetRole: n.targetRole || null,
            title: n.title,
            message: n.message,
            type: (n.type as NotificationType) || 'GENERAL',
            repairId: n.repairId || null,
            repairNumber: n.repairNumber || null,
            senderId: n.senderId || null,
            senderName: n.senderName || null,
            senderRole: n.senderRole || null,
            priority: (n.priority as NotificationPriority) || 'NORMAL',
            link: n.link || (n.repairId ? `/dashboard/repairs/${n.repairId}` : null),
            metadata: typeof n.metadata === 'string' ? safeJsonParse(n.metadata) : n.metadata || null,
            isRead: Boolean(n.isRead),
            readAt: n.readAt || null,
            createdAt: n.createdAt || new Date().toISOString(),
            updatedAt: n.updatedAt || n.createdAt || new Date().toISOString(),
          });
        }
      });
      saveLocalFile(Array.from(notificationCache.values()));
    }
  } catch (err) {
    console.warn('[SUPABASE NOTIFICATIONS SYNC WARN - USING LOCAL CACHE]', err);
  }

  isInitialized = true;
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Get notifications for a specific user and their role
 */
export async function getUserNotifications(
  user: { id: string; role: string },
  options: { unreadOnly?: boolean; limit?: number; type?: string } = {}
): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
  await initializeNotificationStorage();

  const { unreadOnly = false, limit = 50, type } = options;
  const allNotifications = Array.from(notificationCache.values());

  // Filter notifications intended for this specific user OR their role OR global
  const userNotifications = allNotifications.filter((n) => {
    // Direct recipient match
    if (n.userId && n.userId === user.id) return true;
    
    // Role-based recipient match (if userId is null or explicitly matches role)
    if (n.targetRole && (n.targetRole === user.role || (n.targetRole === 'ADMIN' && user.role === 'SUPER_ADMIN'))) {
      return true;
    }

    // Global broadcast notifications (both userId and targetRole are null)
    if (!n.userId && !n.targetRole) return true;

    return false;
  });

  // Calculate unread count for this user
  const unreadCount = userNotifications.filter((n) => !n.isRead).length;

  let filtered = userNotifications;
  if (unreadOnly) {
    filtered = filtered.filter((n) => !n.isRead);
  }
  if (type) {
    filtered = filtered.filter((n) => n.type === type);
  }

  // Sort by createdAt descending
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    notifications: filtered.slice(0, limit),
    unreadCount,
  };
}

/**
 * Create a new notification and dispatch real-time events
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
  await initializeNotificationStorage();

  const id = uuidv4();
  const now = new Date().toISOString();

  // Smart link resolution if not explicitly provided
  let link = data.link;
  if (!link && data.repairId) {
    link = `/dashboard/repairs/${data.repairId}`;
  } else if (!link && (data.type === 'ATTENDANCE_REQUEST' || data.type === 'ATTENDANCE_APPROVED' || data.type === 'ATTENDANCE_REJECTED')) {
    link = '/dashboard/attendance';
  } else if (!link && (data.type === 'ACCESS_REQUEST' || data.type === 'ACCESS_APPROVED' || data.type === 'ACCESS_REJECTED')) {
    link = '/dashboard/access-requests';
  } else if (!link && data.type === 'COURIER_UPDATE') {
    link = '/dashboard/courier';
  } else if (!link && data.type === 'WARRANTY_ALERT') {
    link = '/dashboard/battery-warranty';
  }

  const newRecord: NotificationRecord = {
    id,
    userId: data.userId || null,
    targetRole: data.targetRole || null,
    title: String(data.title || '').trim(),
    message: String(data.message || '').trim(),
    type: data.type || 'GENERAL',
    repairId: data.repairId || null,
    repairNumber: data.repairNumber || null,
    senderId: data.senderId || null,
    senderName: data.senderName || null,
    senderRole: data.senderRole || null,
    priority: data.priority || 'NORMAL',
    link: link || null,
    metadata: data.metadata || null,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  };

  notificationCache.set(id, newRecord);
  saveLocalFile(Array.from(notificationCache.values()));

  // Attempt async sync to Supabase
  try {
    await supabaseAdmin.from('Notification').upsert([
      {
        id: newRecord.id,
        userId: newRecord.userId,
        title: newRecord.title,
        message: newRecord.message,
        type: newRecord.type,
        repairId: newRecord.repairId,
        repairNumber: newRecord.repairNumber,
        senderId: newRecord.senderId,
        senderName: newRecord.senderName,
        priority: newRecord.priority,
        metadata: typeof newRecord.metadata === 'object' ? JSON.stringify(newRecord.metadata) : newRecord.metadata,
        isRead: false,
        createdAt: newRecord.createdAt,
      },
    ]);
  } catch (err) {
    console.warn('[SUPABASE NOTIFICATION INSERT WARN]', err);
  }

  // Broadcast realtime event to all connected clients & target channels
  await broadcastServerChange('Notification', 'CREATE', id, newRecord);

  return newRecord;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id: string, userId: string): Promise<NotificationRecord | null> {
  await initializeNotificationStorage();

  const record = notificationCache.get(id);
  if (!record) return null;

  const now = new Date().toISOString();
  record.isRead = true;
  record.readAt = now;
  record.updatedAt = now;

  notificationCache.set(id, record);
  saveLocalFile(Array.from(notificationCache.values()));

  try {
    await supabaseAdmin
      .from('Notification')
      .update({ isRead: true, readAt: now })
      .eq('id', id);
  } catch (err) {
    console.warn('[SUPABASE NOTIFICATION MARK READ WARN]', err);
  }

  await broadcastServerChange('Notification', 'UPDATE', id, record);
  return record;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(user: { id: string; role: string }): Promise<number> {
  await initializeNotificationStorage();

  const now = new Date().toISOString();
  let updatedCount = 0;

  notificationCache.forEach((record, id) => {
    const isTarget =
      (record.userId && record.userId === user.id) ||
      (record.targetRole && record.targetRole === user.role) ||
      (!record.userId && !record.targetRole);

    if (isTarget && !record.isRead) {
      record.isRead = true;
      record.readAt = now;
      record.updatedAt = now;
      notificationCache.set(id, record);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    saveLocalFile(Array.from(notificationCache.values()));

    try {
      await supabaseAdmin
        .from('Notification')
        .update({ isRead: true, readAt: now })
        .or(`userId.eq.${user.id},userId.is.null`);
    } catch (err) {
      console.warn('[SUPABASE NOTIFICATION MARK ALL READ WARN]', err);
    }

    await broadcastServerChange('Notification', 'UPDATE', 'bulk', { userId: user.id });
  }

  return updatedCount;
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string, user: { id: string; role: string }): Promise<boolean> {
  await initializeNotificationStorage();

  const record = notificationCache.get(id);
  if (!record) return false;

  // Authorization check: User must be recipient, creator, or Super Admin/Admin
  const isSuperAdminOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isRecipient = record.userId === user.id || (!record.userId && record.targetRole === user.role);

  if (!isSuperAdminOrAdmin && !isRecipient) {
    throw new Error('Unauthorized to delete this notification.');
  }

  notificationCache.delete(id);
  saveLocalFile(Array.from(notificationCache.values()));

  try {
    await supabaseAdmin.from('Notification').delete().eq('id', id);
  } catch (err) {
    console.warn('[SUPABASE NOTIFICATION DELETE WARN]', err);
  }

  await broadcastServerChange('Notification', 'DELETE', id);
  return true;
}
