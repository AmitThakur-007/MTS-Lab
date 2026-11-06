import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

export type SmsNotificationStatus =
  | 'DRAFT'
  | 'OPENED'
  | 'PENDING_CONFIRMATION'
  | 'STAFF_CONFIRMED_SENT'
  | 'PROVIDER_ACCEPTED'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'NOT_SENT'
  | 'CANCELLED'
  // Legacy aliases for backward compatibility with existing DB records
  | 'PREPARED'
  | 'READY_TO_SEND'
  | 'INITIATED'
  | 'SENT'
  | 'CARRIER_CONFIRMED_DELIVERED'
  | 'REQUIRES_GOOGLE_MESSAGES'
  | 'INVALID_PHONE';

export type SmsNotificationChannel =
  | 'WINDOWS_PHONE_LINK'
  | 'SMS_PROTOCOL'
  | 'WHATSAPP'
  | 'MANUAL_COPY'
  // Legacy alias
  | 'GOOGLE_MESSAGES_WEB'
  | 'MANUAL';

export interface SmsNotificationRecord {
  id: string;
  repairId: string;
  repairNumber: string;
  customerId?: string | null;
  customerName: string;
  customerPhoneRaw: string;
  customerPhoneNormalized: string;
  customerPhoneInternational: string;
  deviceModel: string;
  deviceBrand?: string | null;
  messageType:
    | 'REPAIR_COMPLETED_SMS'
    | 'REPAIR_COMPLETED_WHATSAPP'
    | 'DEVICE_RECEIVED_SMS'
    | 'DEVICE_RECEIVED_WHATSAPP';
  messageContent: string;
  characterCount: number;
  encodingType: 'GSM_7' | 'UNICODE';
  segmentCount: number;
  status: SmsNotificationStatus;
  channel: SmsNotificationChannel;
  senderStaffId: string;
  senderStaffName: string;
  senderStaffRole: string;
  failureReason?: string | null;
  retryCount?: number;
  notes?: string | null;
  initiatedAt: string;
  openedAt?: string | null;
  sentAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// GSM 7-bit basic character set
const GSM_7_BASIC = new Set([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à'
]);

// GSM 7-bit extended character set (each character costs 2 septets: ESC + Char)
const GSM_7_EXTENDED = new Set([
  '\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€'
]);

/**
 * Validates text encoding and segment counts (GSM 03.38 vs Unicode)
 */
export function analyzeSmsEncodingServer(text: string): {
  encoding: 'GSM_7' | 'UNICODE';
  charCount: number;
  septetCount: number;
  unitsUsed: number;
  segmentCount: number;
  maxUnitsSingleSegment: number;
  isSingleSegment: boolean;
} {
  if (!text) {
    return {
      encoding: 'GSM_7',
      charCount: 0,
      septetCount: 0,
      unitsUsed: 0,
      segmentCount: 1,
      maxUnitsSingleSegment: 160,
      isSingleSegment: true,
    };
  }

  let isGsm = true;
  let septetCount = 0;

  for (const char of text) {
    if (GSM_7_BASIC.has(char)) {
      septetCount += 1;
    } else if (GSM_7_EXTENDED.has(char)) {
      septetCount += 2;
    } else {
      isGsm = false;
    }
  }

  const charCount = text.length;

  if (isGsm) {
    return {
      encoding: 'GSM_7',
      charCount,
      septetCount,
      unitsUsed: septetCount,
      segmentCount: septetCount === 0 ? 1 : Math.ceil(septetCount / 160),
      maxUnitsSingleSegment: 160,
      isSingleSegment: septetCount <= 160,
    };
  }

  return {
    encoding: 'UNICODE',
    charCount,
    septetCount: charCount,
    unitsUsed: charCount,
    segmentCount: charCount === 0 ? 1 : Math.ceil(charCount / 70),
    maxUnitsSingleSegment: 70,
    isSingleSegment: charCount <= 70,
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SMS_FILE = path.join(DATA_DIR, 'sms_notifications.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[SMS STORAGE DIR WARN]', e);
  }
}

// In-memory cache synced with authoritative database
let smsCache: Map<string, SmsNotificationRecord> = new Map();
let isInitialized = false;
let isSyncingPromise: Promise<void> | null = null;

function loadLocalFile(): SmsNotificationRecord[] {
  try {
    if (fs.existsSync(SMS_FILE)) {
      const content = fs.readFileSync(SMS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[SMS READ ERROR: ${SMS_FILE}]`, err);
  }
  return [];
}

function saveLocalFile(data: SmsNotificationRecord[]): void {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return;
  try {
    const tempPath = `${SMS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, SMS_FILE);
  } catch (err) {
    console.warn(`[SMS LOCAL WRITE WARN: ${SMS_FILE}]`, (err as any)?.message || err);
  }
}

function safeJsonParse(val: any): any {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * Standardize status helpers
 */
export function isStatusSent(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return [
    'STAFF_CONFIRMED_SENT',
    'SENT',
    'PROVIDER_ACCEPTED',
    'DELIVERED',
    'READ',
    'CARRIER_CONFIRMED_DELIVERED',
  ].includes(s);
}

export function isStatusStaffConfirmed(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return ['STAFF_CONFIRMED_SENT', 'SENT'].includes(s);
}

export function isStatusDelivered(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return ['DELIVERED', 'CARRIER_CONFIRMED_DELIVERED'].includes(s);
}

export function isStatusPending(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return [
    'DRAFT',
    'PREPARED',
    'OPENED',
    'PENDING_CONFIRMATION',
    'READY_TO_SEND',
    'INITIATED',
  ].includes(s);
}

export function isStatusFailed(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return s === 'FAILED';
}

export function isStatusNotSent(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return ['NOT_SENT', 'CANCELLED'].includes(s);
}

/**
 * Format a Nepal date string (YYYY-MM-DD) in Asia/Kathmandu timezone
 */
export function getNptDateKey(isoDateString?: string | null): string {
  if (!isoDateString) return 'Unknown';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return String(isoDateString).substring(0, 10);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d); // produces YYYY-MM-DD
  } catch {
    return String(isoDateString).substring(0, 10);
  }
}

/**
 * Synchronize authoritative records from Supabase PostgreSQL Notification, AuditLog, and RepairLog
 */
export async function syncSmsStorageFromDatabase(): Promise<void> {
  if (isSyncingPromise) {
    return isSyncingPromise;
  }

  isSyncingPromise = (async () => {
    try {
      // 1. First populate from local cache file if exists
      const localItems = loadLocalFile();
      for (const item of localItems) {
        if (item.id) {
          smsCache.set(item.id, item);
        }
      }

      // 2. Fetch authoritative records from Supabase Notification table
      const { data: dbNotifications, error: dbError } = await supabaseAdmin
        .from('Notification')
        .select('*')
        .in('type', ['CUSTOMER_SMS', 'CUSTOMER_WHATSAPP'])
        .order('createdAt', { ascending: false });

      if (!dbError && Array.isArray(dbNotifications)) {
        for (const row of dbNotifications) {
          const meta = safeJsonParse(row.metadata) || {};
          const status = (row.priority || meta.status || 'STAFF_CONFIRMED_SENT') as SmsNotificationStatus;
          const channel = (meta.channel || (row.type === 'CUSTOMER_WHATSAPP' ? 'WHATSAPP' : 'WINDOWS_PHONE_LINK')) as SmsNotificationChannel;

          const record: SmsNotificationRecord = {
            id: row.id,
            repairId: row.repairId || meta.repairId || '',
            repairNumber: row.repairNumber || meta.repairNumber || '',
            customerId: row.userId?.startsWith('customer:') ? null : (row.userId || meta.customerId || null),
            customerName: meta.customerName || 'Customer',
            customerPhoneRaw: meta.customerPhoneRaw || meta.phone || '',
            customerPhoneNormalized: meta.customerPhoneNormalized || meta.phone || '',
            customerPhoneInternational: meta.customerPhoneInternational || (meta.phone ? `+977${meta.phone}` : ''),
            deviceModel: meta.deviceModel || 'Device',
            deviceBrand: meta.deviceBrand || null,
            messageType: meta.messageType || (channel === 'WHATSAPP' ? 'REPAIR_COMPLETED_WHATSAPP' : 'REPAIR_COMPLETED_SMS'),
            messageContent: row.message || meta.messageContent || '',
            characterCount: meta.characterCount || (row.message ? row.message.length : 0),
            encodingType: meta.encodingType || 'GSM_7',
            segmentCount: meta.segmentCount || 1,
            status,
            channel,
            senderStaffId: row.senderId || meta.senderStaffId || 'system',
            senderStaffName: row.senderName || meta.senderStaffName || 'Staff Member',
            senderStaffRole: meta.senderStaffRole || 'STAFF',
            failureReason: meta.failureReason || null,
            retryCount: meta.retryCount || 0,
            notes: meta.notes || null,
            initiatedAt: meta.initiatedAt || row.createdAt,
            openedAt: meta.openedAt || null,
            sentAt: meta.sentAt || (isStatusSent(status) ? row.createdAt : null),
            confirmedAt: meta.confirmedAt || (isStatusSent(status) ? row.createdAt : null),
            failedAt: meta.failedAt || (status === 'FAILED' ? row.createdAt : null),
            createdAt: row.createdAt,
            updatedAt: row.createdAt,
          };

          smsCache.set(record.id, record);
        }
      }

      // 3. Historical recovery: Check AuditLog where action = 'SMS_NOTIFICATION_CONFIRMED_SENT'
      try {
        const { data: auditRows, error: auditErr } = await supabaseAdmin
          .from('AuditLog')
          .select('*')
          .eq('action', 'SMS_NOTIFICATION_CONFIRMED_SENT')
          .order('createdAt', { ascending: false });

        if (!auditErr && Array.isArray(auditRows)) {
          for (const a of auditRows) {
            const details = safeJsonParse(a.details) || {};
            const existingId = details.notificationId || a.id;
            if (!smsCache.has(existingId)) {
              // Reconstruct verified sent record
              const isWa = details.channel === 'WHATSAPP';
              const normPhone = details.phone || '';
              const rec: SmsNotificationRecord = {
                id: existingId,
                repairId: a.resourceId || details.repairId || '',
                repairNumber: details.repairNumber || '',
                customerId: details.customerId || null,
                customerName: details.customerName || 'Customer',
                customerPhoneRaw: normPhone,
                customerPhoneNormalized: normPhone,
                customerPhoneInternational: normPhone ? `+977${normPhone}` : '',
                deviceModel: details.deviceModel || 'Device',
                deviceBrand: null,
                messageType: isWa ? 'REPAIR_COMPLETED_WHATSAPP' : 'REPAIR_COMPLETED_SMS',
                messageContent: details.messageContent || `Customer notification confirmed sent via ${details.channel || 'SMS'}`,
                characterCount: (details.messageContent || '').length || 80,
                encodingType: 'GSM_7',
                segmentCount: 1,
                status: 'STAFF_CONFIRMED_SENT',
                channel: isWa ? 'WHATSAPP' : (details.channel || 'WINDOWS_PHONE_LINK'),
                senderStaffId: a.userId || details.confirmedByStaffId || 'staff',
                senderStaffName: details.confirmedByStaffName || 'Staff Member',
                senderStaffRole: details.confirmedByStaffRole || 'STAFF',
                initiatedAt: a.createdAt,
                openedAt: a.createdAt,
                sentAt: details.confirmedAt || a.createdAt,
                confirmedAt: details.confirmedAt || a.createdAt,
                createdAt: a.createdAt,
                updatedAt: a.createdAt,
              };

              smsCache.set(existingId, rec);

              // Persist recovered historical confirmation to Notification table
              await supabaseAdmin.from('Notification').upsert({
                id: rec.id,
                userId: rec.customerId || rec.senderStaffId || `customer:${rec.customerPhoneNormalized}`,
                title: rec.channel === 'WHATSAPP' ? `WhatsApp Notification - Repair #${rec.repairNumber}` : `SMS Notification - Repair #${rec.repairNumber}`,
                message: rec.messageContent,
                type: rec.channel === 'WHATSAPP' ? 'CUSTOMER_WHATSAPP' : 'CUSTOMER_SMS',
                repairId: rec.repairId || null,
                repairNumber: rec.repairNumber || null,
                senderId: rec.senderStaffId,
                senderName: rec.senderStaffName,
                priority: 'STAFF_CONFIRMED_SENT',
                isRead: true,
                metadata: JSON.stringify(rec),
                createdAt: rec.createdAt,
              });
            }
          }
        }
      } catch (auditFetchErr) {
        console.warn('[SMS AUDIT RECOVERY WARN]', auditFetchErr);
      }

      // 4. Save synced cache to local file for fast offline reads
      saveLocalFile(Array.from(smsCache.values()));
      isInitialized = true;
    } catch (err) {
      console.error('[SMS STORAGE SYNC ERROR]', err);
    } finally {
      isSyncingPromise = null;
    }
  })();

  return isSyncingPromise;
}

export function initializeSmsStorage(): void {
  if (isInitialized) return;
  const localItems = loadLocalFile();
  for (const item of localItems) {
    if (item.id) {
      smsCache.set(item.id, item);
    }
  }
  isInitialized = true;
  // Trigger background database sync immediately
  syncSmsStorageFromDatabase().catch((e) => console.warn('[ASYNC DB SYNC WARN]', e));
}

/**
 * Ensures authoritative SMS database records are synchronized before reading statistics or lists.
 * This completely prevents the race condition where the first API request after login returned 0 records.
 */
export async function ensureSmsStorageSynced(forceRefresh = false): Promise<void> {
  initializeSmsStorage();
  if (!forceRefresh && isInitialized && !isSyncingPromise && smsCache.size > 0) {
    return;
  }
  return syncSmsStorageFromDatabase();
}

/**
 * Validate and normalize Nepal mobile numbers (98XXXXXXXX, 97XXXXXXXX, 96XXXXXXXX)
 */
export function validateAndNormalizeNepalPhone(rawPhone: string | null | undefined): {
  isValid: boolean;
  normalized: string; // 10 digits
  international: string; // +97798XXXXXXXX
  whatsappPhone: string; // 97798XXXXXXXX
  displayFormatted: string; // +977 98XXXXXXXX
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: '',
      international: '',
      whatsappPhone: '',
      displayFormatted: '',
      error: 'Customer phone number is missing. Please update the customer information before sending SMS.',
    };
  }

  // Strip all non-digit characters
  let cleaned = rawPhone.replace(/\D/g, '');

  // Strip leading 977 if present and followed by 10 digits
  if (cleaned.startsWith('977') && cleaned.length >= 12) {
    cleaned = cleaned.substring(3);
  }

  // Strip leading 0 if present (e.g. 098XXXXXXXX)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Valid Nepal mobile prefix: starts with 98, 97, or 96, length exactly 10
  const nepalMobileRegex = /^9[678]\d{8}$/;

  if (!nepalMobileRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      international: '',
      whatsappPhone: '',
      displayFormatted: rawPhone.trim(),
      error: 'Invalid customer phone number. Must be a 10-digit Nepal mobile starting with 98, 97, or 96.',
    };
  }

  return {
    isValid: true,
    normalized: cleaned,
    international: `+977${cleaned}`,
    whatsappPhone: `977${cleaned}`,
    displayFormatted: `+977 ${cleaned.substring(0, 4)}-${cleaned.substring(4)}`,
  };
}

/**
 * Generate standard privacy-compliant SMS template for completed repairs.
 * Strict rule: Must fit in exactly ONE SMS (maximum 160 characters).
 */
export function generateRepairCompletedSmsMessage(params: {
  customerName?: string | null;
  deviceModel?: string | null;
  repairNumber?: string | null;
}): string {
  let cleanCustomer = (params.customerName || 'Customer').trim();
  let cleanModel = (params.deviceModel || 'device').trim();
  const cleanNumber = (params.repairNumber || 'N/A').trim();

  let msg = `Dear ${cleanCustomer}, your ${cleanModel} (Repair #${cleanNumber}) is repaired & ready for pickup at MTS Lab. Thank you.`;

  if (msg.length > 160 && cleanCustomer.length > 20) {
    cleanCustomer = cleanCustomer.slice(0, 18).trim() + '…';
    msg = `Dear ${cleanCustomer}, your ${cleanModel} (Repair #${cleanNumber}) is repaired & ready for pickup at MTS Lab. Thank you.`;
  }

  if (msg.length > 160 && cleanModel.length > 25) {
    cleanModel = cleanModel.slice(0, 22).trim() + '…';
    msg = `Dear ${cleanCustomer}, your ${cleanModel} (Repair #${cleanNumber}) is repaired & ready for pickup at MTS Lab. Thank you.`;
  }

  if (msg.length > 160) {
    msg = msg.slice(0, 160);
  }

  return msg;
}

/**
 * Standard MTS Lab SMS for Repaired Devices.
 * Strictly complies with max 160 GSM-7 characters and contains tracking link.
 */
export function generateRepairedDeviceSmsMessage(repairNumber: string): string {
  const cleanNumber = (repairNumber || 'N/A').trim();
  return `Dear Customer, your device (Repair No: ${cleanNumber}) is repaired and ready for collection. Track: https://www.mobiletechnologystation.com.np/track - MTS Lab`;
}

/**
 * Standard MTS Lab SMS for Received Devices.
 * Strictly complies with max 160 GSM-7 characters and contains tracking link.
 */
export function generateReceivedDeviceSmsMessage(repairNumber: string): string {
  const cleanNumber = (repairNumber || 'N/A').trim();
  return `Dear Customer, your device has been received by MTS Lab. Repair No: ${cleanNumber}. Track: https://www.mobiletechnologystation.com.np/track - MTS Lab`;
}

/**
 * Record a new SMS/notification record with authoritative Supabase database persistence
 */
export async function recordSmsNotification(
  data: Omit<SmsNotificationRecord, 'id' | 'createdAt' | 'updatedAt' | 'characterCount' | 'encodingType' | 'segmentCount'> & {
    characterCount?: number;
    encodingType?: 'GSM_7' | 'UNICODE';
    segmentCount?: number;
  }
): Promise<SmsNotificationRecord> {
  initializeSmsStorage();

  const msg = data.messageContent || '';
  const encodingInfo = analyzeSmsEncodingServer(msg);

  // Hard backend validation: strictly single segment required
  if (msg && !encodingInfo.isSingleSegment) {
    throw new Error(
      `Message exceeds single-segment limit (${encodingInfo.unitsUsed}/${encodingInfo.maxUnitsSingleSegment} ${encodingInfo.encoding}). Please shorten the message.`
    );
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const record: SmsNotificationRecord = {
    ...data,
    id,
    characterCount: msg.length,
    encodingType: encodingInfo.encoding,
    segmentCount: encodingInfo.segmentCount,
    createdAt: now,
    updatedAt: now,
  };

  // Authoritative Database Persistence into Supabase Notification Table
  const isWhatsApp = record.channel === 'WHATSAPP';
  const dbUserId = record.customerId || record.senderStaffId || `customer:${record.customerPhoneNormalized}`;
  const dbTitle = isWhatsApp
    ? `WhatsApp Notification - Repair #${record.repairNumber || 'N/A'}`
    : `SMS Notification - Repair #${record.repairNumber || 'N/A'}`;

  const { error: dbError } = await supabaseAdmin.from('Notification').upsert({
    id: record.id,
    userId: dbUserId,
    title: dbTitle,
    message: record.messageContent,
    type: isWhatsApp ? 'CUSTOMER_WHATSAPP' : 'CUSTOMER_SMS',
    repairId: record.repairId || null,
    repairNumber: record.repairNumber || null,
    senderId: record.senderStaffId || null,
    senderName: record.senderStaffName || null,
    priority: record.status,
    isRead: isStatusSent(record.status),
    metadata: JSON.stringify(record),
    createdAt: record.createdAt,
  });

  if (dbError) {
    console.error('[SMS DATABASE RECORD ERROR]', dbError);
    throw new Error(`Failed to permanently save notification to database: ${dbError.message}`);
  }

  // Update in-memory cache and local file
  smsCache.set(id, record);
  saveLocalFile(Array.from(smsCache.values()));

  await broadcastServerChange('SmsNotification', 'CREATE', id, record);

  return record;
}

/**
 * Update an existing SMS notification record with authoritative Supabase database persistence
 */
export async function updateSmsNotification(
  id: string,
  updates: Partial<SmsNotificationRecord>
): Promise<SmsNotificationRecord | null> {
  initializeSmsStorage();

  let existing = smsCache.get(id);

  // If not found in cache, check directly in Supabase Notification table
  if (!existing) {
    const { data: dbRow, error } = await supabaseAdmin
      .from('Notification')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && dbRow) {
      const meta = safeJsonParse(dbRow.metadata) || {};
      existing = {
        id: dbRow.id,
        repairId: dbRow.repairId || meta.repairId || '',
        repairNumber: dbRow.repairNumber || meta.repairNumber || '',
        customerId: dbRow.userId?.startsWith('customer:') ? null : (dbRow.userId || meta.customerId || null),
        customerName: meta.customerName || 'Customer',
        customerPhoneRaw: meta.customerPhoneRaw || meta.phone || '',
        customerPhoneNormalized: meta.customerPhoneNormalized || meta.phone || '',
        customerPhoneInternational: meta.customerPhoneInternational || '',
        deviceModel: meta.deviceModel || 'Device',
        deviceBrand: meta.deviceBrand || null,
        messageType: meta.messageType || (dbRow.type === 'CUSTOMER_WHATSAPP' ? 'REPAIR_COMPLETED_WHATSAPP' : 'REPAIR_COMPLETED_SMS'),
        messageContent: dbRow.message || meta.messageContent || '',
        characterCount: meta.characterCount || (dbRow.message ? dbRow.message.length : 0),
        encodingType: meta.encodingType || 'GSM_7',
        segmentCount: meta.segmentCount || 1,
        status: (dbRow.priority || meta.status || 'STAFF_CONFIRMED_SENT') as SmsNotificationStatus,
        channel: (meta.channel || (dbRow.type === 'CUSTOMER_WHATSAPP' ? 'WHATSAPP' : 'WINDOWS_PHONE_LINK')) as SmsNotificationChannel,
        senderStaffId: dbRow.senderId || meta.senderStaffId || 'staff',
        senderStaffName: dbRow.senderName || meta.senderStaffName || 'Staff Member',
        senderStaffRole: meta.senderStaffRole || 'STAFF',
        failureReason: meta.failureReason || null,
        retryCount: meta.retryCount || 0,
        notes: meta.notes || null,
        initiatedAt: meta.initiatedAt || dbRow.createdAt,
        openedAt: meta.openedAt || null,
        sentAt: meta.sentAt || null,
        confirmedAt: meta.confirmedAt || null,
        failedAt: meta.failedAt || null,
        createdAt: dbRow.createdAt,
        updatedAt: dbRow.createdAt,
      };
      smsCache.set(id, existing);
    }
  }

  if (!existing) return null;

  if (updates.messageContent !== undefined) {
    const encodingInfo = analyzeSmsEncodingServer(updates.messageContent);
    if (updates.messageContent && !encodingInfo.isSingleSegment) {
      throw new Error(
        `Message exceeds single-segment limit (${encodingInfo.unitsUsed}/${encodingInfo.maxUnitsSingleSegment} ${encodingInfo.encoding}).`
      );
    }
    updates.characterCount = updates.messageContent.length;
    updates.encodingType = encodingInfo.encoding;
    updates.segmentCount = encodingInfo.segmentCount;
  }

  const now = new Date().toISOString();
  const updated: SmsNotificationRecord = {
    ...existing,
    ...updates,
    updatedAt: now,
  };

  // Authoritative Database Persistence into Supabase Notification Table
  const isWhatsApp = updated.channel === 'WHATSAPP';
  const dbUserId = updated.customerId || updated.senderStaffId || `customer:${updated.customerPhoneNormalized}`;
  const dbTitle = isWhatsApp
    ? `WhatsApp Notification - Repair #${updated.repairNumber || 'N/A'}`
    : `SMS Notification - Repair #${updated.repairNumber || 'N/A'}`;

  const { error: dbUpdateError } = await supabaseAdmin.from('Notification').upsert({
    id: updated.id,
    userId: dbUserId,
    title: dbTitle,
    message: updated.messageContent,
    type: isWhatsApp ? 'CUSTOMER_WHATSAPP' : 'CUSTOMER_SMS',
    repairId: updated.repairId || null,
    repairNumber: updated.repairNumber || null,
    senderId: updated.senderStaffId || null,
    senderName: updated.senderStaffName || null,
    priority: updated.status,
    isRead: isStatusSent(updated.status),
    metadata: JSON.stringify(updated),
    createdAt: updated.createdAt,
  });

  if (dbUpdateError) {
    console.error('[SMS DATABASE UPDATE ERROR]', dbUpdateError);
    throw new Error(`Failed to permanently update notification in database: ${dbUpdateError.message}`);
  }

  // Update in-memory cache and local file
  smsCache.set(id, updated);
  saveLocalFile(Array.from(smsCache.values()));

  await broadcastServerChange('SmsNotification', 'UPDATE', id, updated);

  return updated;
}

/**
 * Prepare or retrieve idempotent pending notification for a repair.
 * Prevents multiple duplicates when status is checked or updated repeatedly.
 */
export async function prepareOrGetPendingNotification(params: {
  repairId: string;
  repairNumber: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  deviceBrand?: string | null;
  staffId: string;
  staffName: string;
  staffRole: string;
}): Promise<SmsNotificationRecord> {
  initializeSmsStorage();

  const phoneValidation = validateAndNormalizeNepalPhone(params.customerPhone);
  const existingNotifications = getSmsNotificationsForRepair(params.repairId);

  // If there is already a confirmed sent notification, return the latest
  const sentNotification = existingNotifications.find((n) => isStatusSent(n.status));
  if (sentNotification) {
    return sentNotification;
  }

  // If there is already an open/prepared draft, return it
  const draft = existingNotifications.find((n) => isStatusPending(n.status));
  if (draft) {
    return draft;
  }

  const defaultMsg = generateRepairCompletedSmsMessage({
    customerName: params.customerName,
    deviceModel: params.deviceModel,
    repairNumber: params.repairNumber,
  });

  const now = new Date().toISOString();

  return await recordSmsNotification({
    repairId: params.repairId,
    repairNumber: params.repairNumber,
    customerId: params.customerId || null,
    customerName: params.customerName,
    customerPhoneRaw: params.customerPhone,
    customerPhoneNormalized: phoneValidation.normalized || params.customerPhone,
    customerPhoneInternational: phoneValidation.international || params.customerPhone,
    deviceModel: params.deviceModel,
    deviceBrand: params.deviceBrand || null,
    messageType: 'REPAIR_COMPLETED_SMS',
    messageContent: defaultMsg,
    status: 'DRAFT',
    channel: 'WINDOWS_PHONE_LINK',
    senderStaffId: params.staffId,
    senderStaffName: params.staffName,
    senderStaffRole: params.staffRole,
    initiatedAt: now,
    notes: 'Automatically prepared upon repair completion',
  });
}

/**
 * Summary structure for repair SMS and WhatsApp status and counts
 */
export interface RepairSmsSummary {
  repairId: string;
  repairNumber?: string;
  status: 'NOT_SENT' | 'INITIATED' | 'SENT';
  normalizedStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'STAFF_CONFIRMED_SENT' | 'FAILED';
  smsStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED';
  whatsappStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED';
  count: number; // total confirmed sent messages (SMS + WhatsApp)
  smsCount: number; // confirmed sent SMS count
  whatsappCount: number; // confirmed sent WhatsApp count
  totalAttempts: number; // total attempts including initiated
  lastSentAt: string | null;
  lastSmsSentAt: string | null;
  lastWhatsappSentAt: string | null;
  lastChannel: SmsNotificationChannel | null;
  lastStaffName: string | null;
  lastRecordId: string | null;
  hasPendingConfirmation: boolean;
  pendingRecordId: string | null;
  pendingChannel: SmsNotificationChannel | null;
}

/**
 * Summary structure for customer-level notification tracking
 */
export interface CustomerNotificationSummary {
  customerId?: string | null;
  customerPhone?: string | null;
  smsStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED';
  whatsappStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED';
  overallStatus: 'NOT_SENT' | 'AWAITING_CONFIRMATION' | 'SENT' | 'FAILED';
  smsCount: number;
  whatsappCount: number;
  totalSent: number;
  totalAttempts: number;
  lastContactedAt: string | null;
  lastChannel: SmsNotificationChannel | null;
  lastStaffName: string | null;
  hasPendingConfirmation: boolean;
  pendingRecordId: string | null;
}

/**
 * Get all SMS notifications for a specific repair (matching either ID or repairNumber)
 */
export function getSmsNotificationsForRepair(repairIdOrNumber: string): SmsNotificationRecord[] {
  initializeSmsStorage();

  const results: SmsNotificationRecord[] = [];
  const searchKey = String(repairIdOrNumber || '').trim().toLowerCase();
  if (!searchKey) return results;

  for (const record of smsCache.values()) {
    const rId = String(record.repairId || '').trim().toLowerCase();
    const rNum = String(record.repairNumber || '').trim().toLowerCase();
    if (rId === searchKey || rNum === searchKey) {
      results.push(record);
    }
  }

  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get all notifications with optional search, channel, status, metric, and date filters
 */
export function getAllSmsNotifications(options: {
  search?: string;
  status?: string;
  channel?: string;
  staffId?: string;
  metric?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}): {
  items: SmsNotificationRecord[];
  total: number;
} {
  initializeSmsStorage();

  let list = Array.from(smsCache.values());

  // Search filter (repairNumber, customerName, customerPhone, deviceModel)
  if (options.search && options.search.trim()) {
    const term = options.search.trim().toLowerCase();
    list = list.filter((item) => {
      return (
        item.repairNumber?.toLowerCase().includes(term) ||
        item.customerName?.toLowerCase().includes(term) ||
        item.customerPhoneRaw?.toLowerCase().includes(term) ||
        item.customerPhoneNormalized?.includes(term) ||
        item.deviceModel?.toLowerCase().includes(term) ||
        item.senderStaffName?.toLowerCase().includes(term)
      );
    });
  }

  // Metric-based filter for direct 1-to-1 clickable KPI cards
  if (options.metric && options.metric !== 'ALL') {
    const m = options.metric.toUpperCase();
    if (m === 'TOTAL_SMS_SENT') {
      list = list.filter((item) => item.channel !== 'WHATSAPP' && !item.messageType?.includes('WHATSAPP') && isStatusSent(item.status));
    } else if (m === 'SMS_CHANNEL_TOTAL' || m === 'SMS_ALL') {
      list = list.filter((item) => item.channel !== 'WHATSAPP' && !item.messageType?.includes('WHATSAPP'));
    } else if (m === 'STAFF_CONFIRMED') {
      list = list.filter((item) => item.channel !== 'WHATSAPP' && !item.messageType?.includes('WHATSAPP') && isStatusStaffConfirmed(item.status));
    } else if (m === 'CARRIER_DELIVERED') {
      list = list.filter((item) => item.channel !== 'WHATSAPP' && !item.messageType?.includes('WHATSAPP') && isStatusDelivered(item.status));
    } else if (m === 'FAILED_SMS') {
      list = list.filter((item) => item.channel !== 'WHATSAPP' && !item.messageType?.includes('WHATSAPP') && isStatusFailed(item.status));
    } else if (m === 'PENDING_DRAFT') {
      list = list.filter((item) => item.channel !== 'WHATSAPP' && !item.messageType?.includes('WHATSAPP') && isStatusPending(item.status));
    } else if (m === 'WHATSAPP_SENT') {
      list = list.filter((item) => (item.channel === 'WHATSAPP' || item.messageType?.includes('WHATSAPP')) && isStatusSent(item.status));
    } else if (m === 'WHATSAPP_ALL') {
      list = list.filter((item) => item.channel === 'WHATSAPP' || item.messageType?.includes('WHATSAPP'));
    }
  }

  // Status filter (when metric is not already filtering status)
  if (!options.metric && options.status && options.status !== 'ALL') {
    const s = options.status.toUpperCase();
    if (s === 'SENT' || s === 'STAFF_CONFIRMED_SENT') {
      list = list.filter((item) => isStatusSent(item.status));
    } else if (s === 'PENDING' || s === 'PREPARED' || s === 'DRAFT') {
      list = list.filter((item) => isStatusPending(item.status));
    } else if (s === 'FAILED') {
      list = list.filter((item) => isStatusFailed(item.status));
    } else if (s === 'NOT_SENT') {
      list = list.filter((item) => isStatusNotSent(item.status));
    } else {
      list = list.filter((item) => item.status === s);
    }
  }

  // Channel filter (when metric is not already filtering channel)
  if (!options.metric && options.channel && options.channel !== 'ALL') {
    list = list.filter((item) => item.channel === options.channel);
  }

  // Staff filter
  if (options.staffId) {
    list = list.filter((item) => item.senderStaffId === options.staffId);
  }

  // Date filters with accurate lifecycle timestamp evaluation
  if (options.startDate || options.endDate) {
    const startMs = options.startDate ? new Date(options.startDate).getTime() : null;
    const endMs = options.endDate ? new Date(options.endDate).getTime() : null;

    list = list.filter((item) => {
      let ts = item.confirmedAt || item.sentAt || item.createdAt;
      if (isStatusFailed(item.status)) {
        ts = item.failedAt || item.updatedAt || item.createdAt;
      } else if (isStatusPending(item.status)) {
        ts = item.initiatedAt || item.createdAt;
      }
      const recTime = new Date(ts).getTime();
      if (startMs !== null && recTime < startMs) return false;
      if (endMs !== null && recTime >= endMs) return false; // Strict half-open interval: < endMs
      return true;
    });
  }

  // Sort descending by activity date
  list.sort((a, b) => {
    const aTime = new Date(a.confirmedAt || a.sentAt || a.createdAt).getTime();
    const bTime = new Date(b.confirmedAt || b.sentAt || b.createdAt).getTime();
    return bTime - aTime;
  });

  const total = list.length;
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  const items = list.slice(offset, offset + limit);

  return { items, total };
}

/**
 * Aggregated statistics calculation for the SMS Center and SMS Reports
 * Strictly calculates from authoritative recorded database entries.
 * Counts every notification record once, keeps SMS and WhatsApp strictly separate,
 * and accurately calculates unique customers notified.
 */
export function getSmsStatistics(options: {
  startDate?: string;
  endDate?: string;
}): {
  // SMS statistics
  totalSmsSent: number;
  smsChannelTotal: number;
  staffConfirmedSms: number;
  carrierConfirmedDelivered: number;
  failedSms: number;
  pendingSms: number;
  notSentSms: number;

  // WhatsApp statistics
  whatsappSent: number;
  whatsappPending: number;
  whatsappFailed: number;
  whatsappDelivered: number;
  whatsappRead: number;

  // Combined statistics
  totalNotifications: number;
  totalSms: number;
  totalWhatsApp: number;
  totalStaffConfirmed: number;
  totalPending: number;
  totalFailed: number;
  totalDelivered: number;
  uniqueCustomersNotified: number;
  uniqueCustomersNotNotified: number;

  // Breakdowns
  staffActivity: Array<{
    staffId: string;
    staffName: string;
    staffRole: string;
    smsSent: number;
    whatsappSent: number;
    failed: number;
    pending: number;
    totalActions: number;
  }>;
  dailyStats: Array<{
    date: string;
    smsSent: number;
    whatsappSent: number;
    failed: number;
  }>;
} {
  initializeSmsStorage();

  const allCached = Array.from(smsCache.values());

  const startMs = options.startDate ? new Date(options.startDate).getTime() : null;
  const endMs = options.endDate ? new Date(options.endDate).getTime() : null;

  // Filter list by accurate lifecycle timestamp
  const list = allCached.filter((item) => {
    if (startMs === null && endMs === null) return true;
    let ts = item.confirmedAt || item.sentAt || item.createdAt;
    if (isStatusFailed(item.status)) {
      ts = item.failedAt || item.updatedAt || item.createdAt;
    } else if (isStatusPending(item.status)) {
      ts = item.initiatedAt || item.createdAt;
    }
    const itemMs = new Date(ts).getTime();
    if (startMs !== null && itemMs < startMs) return false;
    if (endMs !== null && itemMs >= endMs) return false; // Strict half-open: < endMs
    return true;
  });

  // SMS metrics
  let totalSmsSent = 0;
  let staffConfirmedSms = 0;
  let carrierConfirmedDelivered = 0;
  let failedSms = 0;
  let pendingSms = 0;
  let notSentSms = 0;
  let totalSms = 0;

  // WhatsApp metrics
  let whatsappSent = 0;
  let whatsappPending = 0;
  let whatsappFailed = 0;
  let whatsappDelivered = 0;
  let whatsappRead = 0;
  let totalWhatsApp = 0;

  // Unique customer tracking
  const notifiedCustomerKeys = new Set<string>();
  const allCustomerKeys = new Set<string>();

  const staffMap: Record<
    string,
    {
      staffId: string;
      staffName: string;
      staffRole: string;
      smsSent: number;
      whatsappSent: number;
      failed: number;
      pending: number;
      totalActions: number;
    }
  > = {};

  const dailyMap: Record<
    string,
    {
      date: string;
      smsSent: number;
      whatsappSent: number;
      failed: number;
    }
  > = {};

  for (const record of list) {
    const isWhatsApp = record.channel === 'WHATSAPP' || record.messageType?.includes('WHATSAPP');
    const isSent = isStatusSent(record.status);
    const isStaffConfirmed = isStatusStaffConfirmed(record.status);
    const isDelivered = isStatusDelivered(record.status);
    const isRead = record.status === 'READ';
    const isFailed = isStatusFailed(record.status);
    const isPending = isStatusPending(record.status);
    const isNotSent = isStatusNotSent(record.status);

    // Customer identifier for uniqueness
    const custKey = record.customerId || record.customerPhoneNormalized || record.customerPhoneRaw || record.repairNumber;
    if (custKey) {
      allCustomerKeys.add(custKey);
      if (isSent) {
        notifiedCustomerKeys.add(custKey);
      }
    }

    if (isWhatsApp) {
      totalWhatsApp++;
      if (isSent) {
        whatsappSent++;
      }
      if (isPending) {
        whatsappPending++;
      }
      if (isFailed) {
        whatsappFailed++;
      }
      if (isDelivered) {
        whatsappDelivered++;
      }
      if (isRead) {
        whatsappRead++;
      }
    } else {
      // SMS channels
      totalSms++;
      if (isSent) {
        totalSmsSent++;
        if (isStaffConfirmed) {
          staffConfirmedSms++;
        }
        if (isDelivered) {
          carrierConfirmedDelivered++;
        }
      }
      if (isPending) {
        pendingSms++;
      }
      if (isFailed) {
        failedSms++;
      }
      if (isNotSent) {
        notSentSms++;
      }
    }

    // Staff activity aggregation
    const staffId = record.senderStaffId || 'unknown';
    if (!staffMap[staffId]) {
      staffMap[staffId] = {
        staffId,
        staffName: record.senderStaffName || 'Staff Member',
        staffRole: record.senderStaffRole || 'STAFF',
        smsSent: 0,
        whatsappSent: 0,
        failed: 0,
        pending: 0,
        totalActions: 0,
      };
    }

    staffMap[staffId].totalActions++;
    if (isWhatsApp && isSent) {
      staffMap[staffId].whatsappSent++;
    } else if (!isWhatsApp && isSent) {
      staffMap[staffId].smsSent++;
    }
    if (isFailed) staffMap[staffId].failed++;
    if (isPending) staffMap[staffId].pending++;

    // Daily activity aggregation using Nepal Timezone (YYYY-MM-DD)
    const dateKey = getNptDateKey(record.confirmedAt || record.sentAt || record.createdAt);
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        date: dateKey,
        smsSent: 0,
        whatsappSent: 0,
        failed: 0,
      };
    }

    if (isWhatsApp && isSent) {
      dailyMap[dateKey].whatsappSent++;
    } else if (!isWhatsApp && isSent) {
      dailyMap[dateKey].smsSent++;
    }
    if (isFailed) dailyMap[dateKey].failed++;
  }

  // Combined metrics
  const totalNotifications = list.length;
  const totalStaffConfirmed = staffConfirmedSms + (whatsappSent - whatsappDelivered);
  const totalPending = pendingSms + whatsappPending;
  const totalFailed = failedSms + whatsappFailed;
  const totalDelivered = carrierConfirmedDelivered + whatsappDelivered;
  const uniqueCustomersNotified = notifiedCustomerKeys.size;
  const uniqueCustomersNotNotified = Math.max(0, allCustomerKeys.size - uniqueCustomersNotified);

  // Sort dailyStats chronologically
  const dailyStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Sort staffActivity by total SMS/messaging sent descending
  const staffActivity = Object.values(staffMap).sort(
    (a, b) => (b.smsSent + b.whatsappSent) - (a.smsSent + a.whatsappSent)
  );

  return {
    totalSmsSent,
    smsChannelTotal: totalSms,
    staffConfirmedSms,
    carrierConfirmedDelivered,
    failedSms,
    pendingSms,
    notSentSms,

    whatsappSent,
    whatsappPending,
    whatsappFailed,
    whatsappDelivered,
    whatsappRead,

    totalNotifications,
    totalSms,
    totalWhatsApp,
    totalStaffConfirmed,
    totalPending,
    totalFailed,
    totalDelivered,
    uniqueCustomersNotified,
    uniqueCustomersNotNotified,

    staffActivity,
    dailyStats,
  };
}

/**
 * Helper to compute RepairSmsSummary from a repair's history
 */
function buildRepairSmsSummary(repairIdOrNumber: string, history: SmsNotificationRecord[]): RepairSmsSummary {
  if (!history || history.length === 0) {
    return {
      repairId: repairIdOrNumber,
      status: 'NOT_SENT',
      normalizedStatus: 'NOT_SENT',
      smsStatus: 'NOT_SENT',
      whatsappStatus: 'NOT_SENT',
      count: 0,
      smsCount: 0,
      whatsappCount: 0,
      totalAttempts: 0,
      lastSentAt: null,
      lastSmsSentAt: null,
      lastWhatsappSentAt: null,
      lastChannel: null,
      lastStaffName: null,
      lastRecordId: null,
      hasPendingConfirmation: false,
      pendingRecordId: null,
      pendingChannel: null,
    };
  }

  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const smsRecords = sorted.filter((h) => h.channel !== 'WHATSAPP' && !h.messageType?.includes('WHATSAPP'));
  const whatsappRecords = sorted.filter((h) => h.channel === 'WHATSAPP' || h.messageType?.includes('WHATSAPP'));

  const sentSms = smsRecords.filter((r) => isStatusSent(r.status));
  const pendingSms = smsRecords.filter((r) => isStatusPending(r.status));
  const failedSms = smsRecords.filter((r) => isStatusFailed(r.status));

  const sentWhatsapp = whatsappRecords.filter((r) => isStatusSent(r.status));
  const pendingWhatsapp = whatsappRecords.filter((r) => isStatusPending(r.status));
  const failedWhatsapp = whatsappRecords.filter((r) => isStatusFailed(r.status));

  let smsStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED' = 'NOT_SENT';
  if (sentSms.length > 0) smsStatus = 'SENT';
  else if (pendingSms.some((r) => r.status === 'OPENED' || r.status === 'INITIATED')) smsStatus = 'OPENED';
  else if (pendingSms.length > 0) smsStatus = 'PREPARED';
  else if (failedSms.length > 0) smsStatus = 'FAILED';

  let whatsappStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED' = 'NOT_SENT';
  if (sentWhatsapp.length > 0) whatsappStatus = 'SENT';
  else if (pendingWhatsapp.some((r) => r.status === 'OPENED' || r.status === 'INITIATED')) whatsappStatus = 'OPENED';
  else if (pendingWhatsapp.length > 0) whatsappStatus = 'PREPARED';
  else if (failedWhatsapp.length > 0) whatsappStatus = 'FAILED';

  const allSent = sorted.filter((r) => isStatusSent(r.status));
  const allPending = sorted.filter((r) => isStatusPending(r.status));
  const latestPending = sorted.find((r) => r.status === 'OPENED' || r.status === 'INITIATED' || r.status === 'PENDING_CONFIRMATION');

  const latestRecord = sorted[0];
  const mostRecentSent = allSent[0] || latestRecord;
  const mostRecentSmsSent = sentSms[0];
  const mostRecentWhatsappSent = sentWhatsapp[0];

  const hasSent = allSent.length > 0;
  const status: 'NOT_SENT' | 'INITIATED' | 'SENT' = hasSent
    ? 'SENT'
    : allPending.length > 0
    ? 'INITIATED'
    : 'NOT_SENT';

  let normalizedStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'STAFF_CONFIRMED_SENT' | 'FAILED' = 'NOT_SENT';
  if (hasSent) {
    normalizedStatus = 'STAFF_CONFIRMED_SENT';
  } else if (allPending.some((r) => r.status === 'OPENED' || r.status === 'INITIATED' || r.status === 'PENDING_CONFIRMATION')) {
    normalizedStatus = 'OPENED';
  } else if (allPending.length > 0) {
    normalizedStatus = 'PREPARED';
  } else if (sorted.some((r) => isStatusFailed(r.status))) {
    normalizedStatus = 'FAILED';
  }

  return {
    repairId: latestRecord?.repairId || repairIdOrNumber,
    repairNumber: latestRecord?.repairNumber,
    status,
    normalizedStatus,
    smsStatus,
    whatsappStatus,
    count: allSent.length,
    smsCount: sentSms.length,
    whatsappCount: sentWhatsapp.length,
    totalAttempts: sorted.length,
    lastSentAt: mostRecentSent?.sentAt || mostRecentSent?.confirmedAt || mostRecentSent?.createdAt || null,
    lastSmsSentAt: mostRecentSmsSent?.sentAt || mostRecentSmsSent?.confirmedAt || null,
    lastWhatsappSentAt: mostRecentWhatsappSent?.sentAt || mostRecentWhatsappSent?.confirmedAt || null,
    lastChannel: mostRecentSent?.channel || null,
    lastStaffName: mostRecentSent?.senderStaffName || null,
    lastRecordId: latestRecord?.id || null,
    hasPendingConfirmation: Boolean(latestPending),
    pendingRecordId: latestPending?.id || null,
    pendingChannel: latestPending?.channel || null,
  };
}

/**
 * Get aggregated SMS status summary for a single repair
 */
export function getRepairSmsSummary(repairIdOrNumber: string): RepairSmsSummary {
  initializeSmsStorage();
  const history = getSmsNotificationsForRepair(repairIdOrNumber);
  return buildRepairSmsSummary(repairIdOrNumber, history);
}

/**
 * Get all SMS summaries indexed by repairId and repairNumber
 */
export function getAllRepairSmsSummaries(): Record<string, RepairSmsSummary> {
  initializeSmsStorage();
  const map: Record<string, RepairSmsSummary> = {};

  const grouped: Record<string, SmsNotificationRecord[]> = {};
  for (const record of smsCache.values()) {
    if (record.repairId) {
      if (!grouped[record.repairId]) grouped[record.repairId] = [];
      grouped[record.repairId].push(record);
    }
  }

  for (const [repId, records] of Object.entries(grouped)) {
    const summary = buildRepairSmsSummary(repId, records);
    map[repId] = summary;
    if (summary.repairNumber) {
      map[summary.repairNumber] = summary;
    }
  }

  return map;
}

/**
 * Get all notifications for a specific customer by ID or phone number
 */
export function getSmsNotificationsForCustomer(
  customerId?: string | null,
  customerPhone?: string | null
): SmsNotificationRecord[] {
  initializeSmsStorage();

  const cId = (customerId || '').trim().toLowerCase();
  const cPhone = (customerPhone || '').replace(/\D/g, '');
  const cPhoneNorm = cPhone.length > 10 && cPhone.startsWith('977') ? cPhone.substring(3) : cPhone;

  const results: SmsNotificationRecord[] = [];

  for (const record of smsCache.values()) {
    let match = false;
    if (cId && record.customerId && record.customerId.toLowerCase() === cId) {
      match = true;
    }
    if (!match && cPhoneNorm) {
      const recPhone = (record.customerPhoneNormalized || record.customerPhoneRaw || '').replace(/\D/g, '');
      const recPhoneNorm = recPhone.length > 10 && recPhone.startsWith('977') ? recPhone.substring(3) : recPhone;
      if (recPhoneNorm && recPhoneNorm === cPhoneNorm) {
        match = true;
      }
    }
    if (match) {
      results.push(record);
    }
  }

  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get aggregated CustomerNotificationSummary for a specific customer
 */
export function getCustomerNotificationSummary(
  customerId?: string | null,
  customerPhone?: string | null
): CustomerNotificationSummary {
  const history = getSmsNotificationsForCustomer(customerId, customerPhone);

  if (!history || history.length === 0) {
    return {
      customerId: customerId || null,
      customerPhone: customerPhone || null,
      smsStatus: 'NOT_SENT',
      whatsappStatus: 'NOT_SENT',
      overallStatus: 'NOT_SENT',
      smsCount: 0,
      whatsappCount: 0,
      totalSent: 0,
      totalAttempts: 0,
      lastContactedAt: null,
      lastChannel: null,
      lastStaffName: null,
      hasPendingConfirmation: false,
      pendingRecordId: null,
    };
  }

  const smsRecords = history.filter((h) => h.channel !== 'WHATSAPP' && !h.messageType?.includes('WHATSAPP'));
  const whatsappRecords = history.filter((h) => h.channel === 'WHATSAPP' || h.messageType?.includes('WHATSAPP'));

  const sentSms = smsRecords.filter((r) => isStatusSent(r.status));
  const pendingSms = smsRecords.filter((r) => isStatusPending(r.status));
  const failedSms = smsRecords.filter((r) => isStatusFailed(r.status));

  const sentWhatsapp = whatsappRecords.filter((r) => isStatusSent(r.status));
  const pendingWhatsapp = whatsappRecords.filter((r) => isStatusPending(r.status));
  const failedWhatsapp = whatsappRecords.filter((r) => isStatusFailed(r.status));

  let smsStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED' = 'NOT_SENT';
  if (sentSms.length > 0) smsStatus = 'SENT';
  else if (pendingSms.some((r) => r.status === 'OPENED' || r.status === 'INITIATED')) smsStatus = 'OPENED';
  else if (pendingSms.length > 0) smsStatus = 'PREPARED';
  else if (failedSms.length > 0) smsStatus = 'FAILED';

  let whatsappStatus: 'NOT_SENT' | 'PREPARED' | 'OPENED' | 'SENT' | 'FAILED' = 'NOT_SENT';
  if (sentWhatsapp.length > 0) whatsappStatus = 'SENT';
  else if (pendingWhatsapp.some((r) => r.status === 'OPENED' || r.status === 'INITIATED')) whatsappStatus = 'OPENED';
  else if (pendingWhatsapp.length > 0) whatsappStatus = 'PREPARED';
  else if (failedWhatsapp.length > 0) whatsappStatus = 'FAILED';

  const allSent = history.filter((r) => isStatusSent(r.status));
  const allPending = history.filter((r) => isStatusPending(r.status));
  const latestPending = history.find((r) => r.status === 'OPENED' || r.status === 'INITIATED' || r.status === 'PENDING_CONFIRMATION');

  let overallStatus: 'NOT_SENT' | 'AWAITING_CONFIRMATION' | 'SENT' | 'FAILED' = 'NOT_SENT';
  if (allSent.length > 0) {
    overallStatus = 'SENT';
  } else if (allPending.some((r) => r.status === 'OPENED' || r.status === 'INITIATED' || r.status === 'PENDING_CONFIRMATION')) {
    overallStatus = 'AWAITING_CONFIRMATION';
  } else if (history.some((r) => isStatusFailed(r.status))) {
    overallStatus = 'FAILED';
  }

  const latestRecord = history[0];
  const mostRecentSent = allSent[0] || latestRecord;

  return {
    customerId: customerId || latestRecord?.customerId || null,
    customerPhone: customerPhone || latestRecord?.customerPhoneNormalized || null,
    smsStatus,
    whatsappStatus,
    overallStatus,
    smsCount: sentSms.length,
    whatsappCount: sentWhatsapp.length,
    totalSent: allSent.length,
    totalAttempts: history.length,
    lastContactedAt: mostRecentSent?.sentAt || mostRecentSent?.confirmedAt || mostRecentSent?.createdAt || null,
    lastChannel: mostRecentSent?.channel || null,
    lastStaffName: mostRecentSent?.senderStaffName || null,
    hasPendingConfirmation: Boolean(latestPending),
    pendingRecordId: latestPending?.id || null,
  };
}

/**
 * Get all CustomerNotificationSummaries indexed by customerId and normalized phone
 */
export function getAllCustomerNotificationSummaries(): Record<string, CustomerNotificationSummary> {
  initializeSmsStorage();
  const map: Record<string, CustomerNotificationSummary> = {};

  const groupedByCustomer: Record<string, SmsNotificationRecord[]> = {};

  for (const record of smsCache.values()) {
    const keys: string[] = [];
    if (record.customerId) keys.push(record.customerId);
    const p = (record.customerPhoneNormalized || record.customerPhoneRaw || '').replace(/\D/g, '');
    const pNorm = p.length > 10 && p.startsWith('977') ? p.substring(3) : p;
    if (pNorm) keys.push(`phone:${pNorm}`);

    for (const key of keys) {
      if (!groupedByCustomer[key]) groupedByCustomer[key] = [];
      groupedByCustomer[key].push(record);
    }
  }

  for (const [key, records] of Object.entries(groupedByCustomer)) {
    const summary = getCustomerNotificationSummary(
      records[0]?.customerId || null,
      records[0]?.customerPhoneNormalized || null
    );
    map[key] = summary;
  }

  return map;
}

/**
 * Get all notifications that are OPENED or PREPARED and awaiting staff confirmation
 */
export function getPendingConfirmations(): SmsNotificationRecord[] {
  initializeSmsStorage();
  const list = Array.from(smsCache.values());

  const pending = list.filter((r) => isStatusPending(r.status));

  return pending.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Check if an SMS was already initiated or sent for a given repair
 */
export function hasRecentSmsNotification(
  repairId: string
): { hasSent: boolean; lastNotification?: SmsNotificationRecord } {
  const history = getSmsNotificationsForRepair(repairId);
  if (history.length === 0) {
    return { hasSent: false };
  }

  const active = history.find(
    (h) => isStatusSent(h.status) || h.status === 'OPENED' || h.status === 'INITIATED'
  );

  return {
    hasSent: !!active,
    lastNotification: active || history[0],
  };
}
