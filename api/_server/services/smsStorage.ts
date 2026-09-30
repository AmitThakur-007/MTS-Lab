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
 * Strict rule: Must fit in exactly ONE SMS (maximum 160 characters).
 * Omits internal diagnostic notes, technician names, staff emails, or internal database keys.
 * Essential elements: Customer name, Device, Repair number, Ready for pickup/collection, MTS Lab.
 */
export function generateRepairCompletedSmsMessage(params: {
  customerName: string;
  deviceModel: string;
  repairNumber: string;
}): string {
  let cleanCustomer = (params.customerName || 'Customer').trim();
  let cleanModel = (params.deviceModel || 'device').trim();
  const cleanNumber = (params.repairNumber || 'N/A').trim();

  // Baseline template with all 5 essential requirements:
  let msg = `Dear ${cleanCustomer}, your ${cleanModel} (Repair #${cleanNumber}) is repaired & ready for pickup at MTS Lab. Thank you.`;

  // If long names cause total length to exceed 160 characters, safely shorten customer or model
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
 * Record a new SMS notification
 */
export async function recordSmsNotification(
  data: Omit<SmsNotificationRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SmsNotificationRecord> {
  initializeSmsStorage();

  // Hard backend validation: strictly 1 SMS <= 160 characters
  if (data.messageContent && data.messageContent.length > 160) {
    throw new Error('Message must not exceed 160 characters. Exactly one SMS is permitted per send action.');
  }

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

  if (updates.messageContent && updates.messageContent.length > 160) {
    throw new Error('Message must not exceed 160 characters. Exactly one SMS is permitted per send action.');
  }

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
 * Summary structure for repair SMS status and counts
 */
export interface RepairSmsSummary {
  repairId: string;
  repairNumber?: string;
  status: 'NOT_SENT' | 'INITIATED' | 'SENT';
  count: number; // confirmed sent messages count
  totalAttempts: number; // total attempts including initiated
  lastSentAt: string | null;
  lastChannel: SmsNotificationChannel | null;
  lastStaffName: string | null;
  lastRecordId: string | null;
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
 * Get aggregated SMS status summary for a single repair
 */
export function getRepairSmsSummary(repairIdOrNumber: string): RepairSmsSummary {
  initializeSmsStorage();
  const history = getSmsNotificationsForRepair(repairIdOrNumber);

  if (!history || history.length === 0) {
    return {
      repairId: repairIdOrNumber,
      status: 'NOT_SENT',
      count: 0,
      totalAttempts: 0,
      lastSentAt: null,
      lastChannel: null,
      lastStaffName: null,
      lastRecordId: null,
    };
  }

  const sentRecords = history.filter((h) => h.status === 'SENT');
  const initiatedRecords = history.filter((h) => h.status === 'INITIATED');
  const latestRecord = history[0];

  const hasSent = sentRecords.length > 0;
  const status: 'NOT_SENT' | 'INITIATED' | 'SENT' = hasSent
    ? 'SENT'
    : initiatedRecords.length > 0
    ? 'INITIATED'
    : 'NOT_SENT';

  const mostRecentSent = sentRecords[0] || latestRecord;

  return {
    repairId: latestRecord?.repairId || repairIdOrNumber,
    repairNumber: latestRecord?.repairNumber,
    status,
    count: sentRecords.length,
    totalAttempts: history.length,
    lastSentAt: mostRecentSent?.sentAt || mostRecentSent?.confirmedAt || mostRecentSent?.createdAt || null,
    lastChannel: mostRecentSent?.channel || null,
    lastStaffName: mostRecentSent?.senderStaffName || null,
    lastRecordId: latestRecord?.id || null,
  };
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
    const sorted = records.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const sent = sorted.filter((h) => h.status === 'SENT');
    const initiated = sorted.filter((h) => h.status === 'INITIATED');
    const latest = sorted[0];
    const mostRecentSent = sent[0] || latest;

    const summary: RepairSmsSummary = {
      repairId: repId,
      repairNumber: latest?.repairNumber,
      status: sent.length > 0 ? 'SENT' : initiated.length > 0 ? 'INITIATED' : 'NOT_SENT',
      count: sent.length,
      totalAttempts: sorted.length,
      lastSentAt: mostRecentSent?.sentAt || mostRecentSent?.confirmedAt || mostRecentSent?.createdAt || null,
      lastChannel: mostRecentSent?.channel || null,
      lastStaffName: mostRecentSent?.senderStaffName || null,
      lastRecordId: latest?.id || null,
    };

    map[repId] = summary;
    if (latest?.repairNumber) {
      map[latest.repairNumber] = summary;
    }
  }

  return map;
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
