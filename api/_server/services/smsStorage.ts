import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

export type SmsNotificationStatus =
  | 'READY_TO_SEND'
  | 'INITIATED'
  | 'SENT'
  | 'FAILED'
  | 'REQUIRES_GOOGLE_MESSAGES'
  | 'INVALID_PHONE';

export type SmsNotificationChannel =
  | 'GOOGLE_MESSAGES_WEB'
  | 'SMS_PROTOCOL'
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
  messageType: 'REPAIR_COMPLETED_SMS';
  messageContent: string;
  status: SmsNotificationStatus;
  channel: SmsNotificationChannel;
  senderStaffId: string;
  senderStaffName: string;
  senderStaffRole: string;
  notes?: string | null;
  initiatedAt: string;
  sentAt?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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

let smsCache: Map<string, SmsNotificationRecord> = new Map();
let isInitialized = false;

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
  try {
    const tempPath = `${SMS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, SMS_FILE);
  } catch (err) {
    console.error(`[SMS WRITE ERROR: ${SMS_FILE}]`, err);
  }
}

export function initializeSmsStorage(): void {
  if (isInitialized) return;
  const localItems = loadLocalFile();
  smsCache.clear();
  for (const item of localItems) {
    if (item.id) {
      smsCache.set(item.id, item);
    }
  }
  isInitialized = true;
}

/**
 * Validate and normalize Nepal mobile numbers (98XXXXXXXX, 97XXXXXXXX, 96XXXXXXXX)
 */
export function validateAndNormalizeNepalPhone(rawPhone: string | null | undefined): {
  isValid: boolean;
  normalized: string; // 10 digits
  international: string; // +97798XXXXXXXX
  displayFormatted: string; // +977 98XXXXXXXX
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: '',
      international: '',
      displayFormatted: '',
      error: 'Customer phone number is missing. Please update the customer information before sending SMS.'
    };
  }

  // Strip all non-digit characters
  let cleaned = rawPhone.replace(/\D/g, '');

  // Strip leading 977 if present and followed by 10 digits
  if (cleaned.startsWith('977') && cleaned.length >= 13) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('977') && cleaned.length === 12) {
    // 977 + 9 or 8 digits
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
      displayFormatted: rawPhone.trim(),
      error: 'Invalid customer phone number. Please update the customer information before sending SMS.'
    };
  }

  return {
    isValid: true,
    normalized: cleaned,
    international: `+977${cleaned}`,
    displayFormatted: `+977 ${cleaned.substring(0, 2)}-${cleaned.substring(2, 6)}-${cleaned.substring(6)}`,
  };
}

/**
 * Generate standard privacy-compliant SMS template for completed repairs.
 * Omits internal diagnostic notes, technician names, staff emails, or internal database keys.
 */
export function generateRepairCompletedSmsMessage(params: {
  customerName: string;
  deviceModel: string;
  repairNumber: string;
}): string {
  const cleanCustomer = (params.customerName || 'Customer').trim();
  const cleanModel = (params.deviceModel || 'device').trim();
  const cleanNumber = (params.repairNumber || 'N/A').trim();

  return `Dear ${cleanCustomer}, your ${cleanModel} repair (Repair No: ${cleanNumber}) has been completed and is ready for pickup at MTS Lab. For assistance, please contact MTS Lab. Thank you.`;
}

/**
 * Record a new SMS notification
 */
export async function recordSmsNotification(
  data: Omit<SmsNotificationRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SmsNotificationRecord> {
  initializeSmsStorage();

  const id = uuidv4();
  const now = new Date().toISOString();

  const record: SmsNotificationRecord = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  smsCache.set(id, record);
  saveLocalFile(Array.from(smsCache.values()));

  // Attempt database backup (fail-soft if table does not exist)
  try {
    await supabaseAdmin.from('SmsNotification').insert([
      {
        id: record.id,
        repairId: record.repairId,
        repairNumber: record.repairNumber,
        customerId: record.customerId || null,
        customerName: record.customerName,
        customerPhone: record.customerPhoneNormalized,
        messageContent: record.messageContent,
        status: record.status,
        channel: record.channel,
        senderStaffId: record.senderStaffId,
        senderStaffName: record.senderStaffName,
        senderStaffRole: record.senderStaffRole,
        notes: record.notes || null,
        initiatedAt: record.initiatedAt,
        sentAt: record.sentAt || null,
        createdAt: record.createdAt,
      },
    ]);
  } catch (dbErr) {
    // Fail-soft: local storage remains fully authoritative
  }

  await broadcastServerChange('SmsNotification', 'CREATE', id, record);

  return record;
}

/**
 * Update an existing SMS notification record
 */
export async function updateSmsNotification(
  id: string,
  updates: Partial<SmsNotificationRecord>
): Promise<SmsNotificationRecord | null> {
  initializeSmsStorage();

  const existing = smsCache.get(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: SmsNotificationRecord = {
    ...existing,
    ...updates,
    updatedAt: now,
  };

  smsCache.set(id, updated);
  saveLocalFile(Array.from(smsCache.values()));

  try {
    await supabaseAdmin.from('SmsNotification').update({
      status: updated.status,
      notes: updated.notes || null,
      sentAt: updated.sentAt || null,
      confirmedAt: updated.confirmedAt || null,
      updatedAt: now,
    }).eq('id', id);
  } catch (_) {}

  await broadcastServerChange('SmsNotification', 'UPDATE', id, updated);

  return updated;
}

/**
 * Get all SMS notifications for a specific repair
 */
export function getSmsNotificationsForRepair(repairId: string): SmsNotificationRecord[] {
  initializeSmsStorage();

  const results: SmsNotificationRecord[] = [];
  for (const record of smsCache.values()) {
    if (record.repairId === repairId) {
      results.push(record);
    }
  }

  return results.sort(
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
    (h) => h.status === 'SENT' || h.status === 'INITIATED'
  );

  return {
    hasSent: !!active,
    lastNotification: active || history[0],
  };
}
