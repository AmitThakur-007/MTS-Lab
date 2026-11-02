import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { broadcastServerChange } from './realtimeSync';

export type SmsNotificationStatus =
  | 'PREPARED'
  | 'OPENED'
  | 'STAFF_CONFIRMED_SENT'
  | 'CARRIER_CONFIRMED_DELIVERED'
  | 'FAILED'
  | 'CANCELLED'
  // Legacy aliases for backward compatibility with existing DB records
  | 'READY_TO_SEND'
  | 'INITIATED'
  | 'SENT'
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
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return;
  try {
    const tempPath = `${SMS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, SMS_FILE);
  } catch (err) {
    console.warn(`[SMS LOCAL WRITE WARN: ${SMS_FILE}]`, (err as any)?.message || err);
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
 * Omits internal diagnostic notes, technician names, staff emails, or internal database keys.
 * Essential elements: Customer name, Device, Repair number, Ready for pickup/collection, MTS Lab.
 */
export function generateRepairCompletedSmsMessage(params: {
  customerName?: string | null;
  deviceModel?: string | null;
  repairNumber?: string | null;
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
 * Record a new SMS/notification record
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
  const sentNotification = existingNotifications.find(
    (n) => n.status === 'STAFF_CONFIRMED_SENT' || n.status === 'SENT' || n.status === 'CARRIER_CONFIRMED_DELIVERED'
  );
  if (sentNotification) {
    return sentNotification;
  }

  // If there is already an open/prepared draft, return it
  const draft = existingNotifications.find(
    (n) => n.status === 'PREPARED' || n.status === 'OPENED' || n.status === 'READY_TO_SEND' || n.status === 'INITIATED'
  );
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
    status: 'PREPARED',
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
 * Get all notifications with optional search, channel, status, and date filters
 */
export function getAllSmsNotifications(options: {
  search?: string;
  status?: string;
  channel?: string;
  staffId?: string;
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

  // Status filter
  if (options.status && options.status !== 'ALL') {
    const s = options.status.toUpperCase();
    if (s === 'SENT' || s === 'STAFF_CONFIRMED_SENT') {
      list = list.filter((item) => item.status === 'STAFF_CONFIRMED_SENT' || item.status === 'SENT' || item.status === 'CARRIER_CONFIRMED_DELIVERED');
    } else if (s === 'PENDING' || s === 'PREPARED') {
      list = list.filter((item) => item.status === 'PREPARED' || item.status === 'OPENED' || item.status === 'READY_TO_SEND' || item.status === 'INITIATED');
    } else {
      list = list.filter((item) => item.status === s);
    }
  }

  // Channel filter
  if (options.channel && options.channel !== 'ALL') {
    list = list.filter((item) => item.channel === options.channel);
  }

  // Staff filter
  if (options.staffId) {
    list = list.filter((item) => item.senderStaffId === options.staffId);
  }

  // Date filters
  if (options.startDate) {
    const startMs = new Date(options.startDate).getTime();
    list = list.filter((item) => new Date(item.createdAt).getTime() >= startMs);
  }

  if (options.endDate) {
    const endMs = new Date(options.endDate).getTime();
    list = list.filter((item) => new Date(item.createdAt).getTime() <= endMs);
  }

  // Sort descending by created date
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = list.length;
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  const items = list.slice(offset, offset + limit);

  return { items, total };
}

/**
 * Aggregated statistics calculation for the SMS Center and SMS Reports
 * Strictly calculates from recorded database entries. Never counts clicks or WhatsApp as SMS!
 */
export function getSmsStatistics(options: {
  startDate?: string;
  endDate?: string;
}): {
  totalSmsSent: number;
  staffConfirmedSms: number;
  carrierConfirmedDelivered: number;
  failedSms: number;
  pendingSms: number;
  whatsappSent: number;
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

  let list = Array.from(smsCache.values());

  if (options.startDate) {
    const startMs = new Date(options.startDate).getTime();
    list = list.filter((item) => new Date(item.createdAt).getTime() >= startMs);
  }

  if (options.endDate) {
    const endMs = new Date(options.endDate).getTime();
    list = list.filter((item) => new Date(item.createdAt).getTime() <= endMs);
  }

  let totalSmsSent = 0;
  let staffConfirmedSms = 0;
  let carrierConfirmedDelivered = 0;
  let failedSms = 0;
  let pendingSms = 0;
  let whatsappSent = 0;

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
    const isWhatsApp = record.channel === 'WHATSAPP';
    const isSent =
      record.status === 'STAFF_CONFIRMED_SENT' ||
      record.status === 'SENT' ||
      record.status === 'CARRIER_CONFIRMED_DELIVERED';
    const isCarrierDelivered = record.status === 'CARRIER_CONFIRMED_DELIVERED';
    const isFailed = record.status === 'FAILED';
    const isPending =
      record.status === 'PREPARED' ||
      record.status === 'OPENED' ||
      record.status === 'READY_TO_SEND' ||
      record.status === 'INITIATED';

    if (isWhatsApp) {
      if (isSent) {
        whatsappSent++;
      }
    } else {
      // It is an SMS (Windows Phone Link, SMS protocol, or manual copy)
      if (isSent) {
        totalSmsSent++;
        staffConfirmedSms++;
        if (isCarrierDelivered) {
          carrierConfirmedDelivered++;
        }
      }
    }

    if (isFailed) {
      failedSms++;
    }

    if (isPending) {
      pendingSms++;
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

    // Daily activity aggregation (YYYY-MM-DD)
    const dateKey = record.createdAt ? record.createdAt.substring(0, 10) : 'Unknown';
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

  // Sort dailyStats chronologically
  const dailyStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Sort staffActivity by total SMS/messaging sent descending
  const staffActivity = Object.values(staffMap).sort(
    (a, b) => (b.smsSent + b.whatsappSent) - (a.smsSent + a.whatsappSent)
  );

  return {
    totalSmsSent,
    staffConfirmedSms,
    carrierConfirmedDelivered,
    failedSms,
    pendingSms,
    whatsappSent,
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

  const smsRecords = sorted.filter((h) => h.channel !== 'WHATSAPP');
  const whatsappRecords = sorted.filter((h) => h.channel === 'WHATSAPP');

  const isConfirmedSent = (r: SmsNotificationRecord) =>
    r.status === 'STAFF_CONFIRMED_SENT' || r.status === 'SENT' || r.status === 'CARRIER_CONFIRMED_DELIVERED';
  const isOpenedOrPending = (r: SmsNotificationRecord) =>
    r.status === 'OPENED' || r.status === 'PREPARED' || r.status === 'INITIATED' || r.status === 'READY_TO_SEND';

  const sentSms = smsRecords.filter(isConfirmedSent);
  const pendingSms = smsRecords.filter(isOpenedOrPending);
  const failedSms = smsRecords.filter((r) => r.status === 'FAILED');

  const sentWhatsapp = whatsappRecords.filter(isConfirmedSent);
  const pendingWhatsapp = whatsappRecords.filter(isOpenedOrPending);
  const failedWhatsapp = whatsappRecords.filter((r) => r.status === 'FAILED');

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

  const allSent = sorted.filter(isConfirmedSent);
  const allPending = sorted.filter(isOpenedOrPending);
  const latestPending = sorted.find((r) => r.status === 'OPENED' || r.status === 'INITIATED');

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
  } else if (allPending.some((r) => r.status === 'OPENED' || r.status === 'INITIATED')) {
    normalizedStatus = 'OPENED';
  } else if (allPending.length > 0) {
    normalizedStatus = 'PREPARED';
  } else if (sorted.some((r) => r.status === 'FAILED')) {
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

  const isConfirmedSent = (r: SmsNotificationRecord) =>
    r.status === 'STAFF_CONFIRMED_SENT' || r.status === 'SENT' || r.status === 'CARRIER_CONFIRMED_DELIVERED';
  const isOpenedOrPending = (r: SmsNotificationRecord) =>
    r.status === 'OPENED' || r.status === 'PREPARED' || r.status === 'INITIATED' || r.status === 'READY_TO_SEND';

  const smsRecords = history.filter((h) => h.channel !== 'WHATSAPP');
  const whatsappRecords = history.filter((h) => h.channel === 'WHATSAPP');

  const sentSms = smsRecords.filter(isConfirmedSent);
  const pendingSms = smsRecords.filter(isOpenedOrPending);
  const failedSms = smsRecords.filter((r) => r.status === 'FAILED');

  const sentWhatsapp = whatsappRecords.filter(isConfirmedSent);
  const pendingWhatsapp = whatsappRecords.filter(isOpenedOrPending);
  const failedWhatsapp = whatsappRecords.filter((r) => r.status === 'FAILED');

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

  const allSent = history.filter(isConfirmedSent);
  const allPending = history.filter(isOpenedOrPending);
  const latestPending = history.find((r) => r.status === 'OPENED' || r.status === 'INITIATED');

  let overallStatus: 'NOT_SENT' | 'AWAITING_CONFIRMATION' | 'SENT' | 'FAILED' = 'NOT_SENT';
  if (allSent.length > 0) {
    overallStatus = 'SENT';
  } else if (allPending.some((r) => r.status === 'OPENED' || r.status === 'INITIATED')) {
    overallStatus = 'AWAITING_CONFIRMATION';
  } else if (history.some((r) => r.status === 'FAILED')) {
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

  const pending = list.filter(
    (r) =>
      r.status === 'OPENED' ||
      r.status === 'PREPARED' ||
      r.status === 'INITIATED' ||
      r.status === 'READY_TO_SEND'
  );

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
    (h) => h.status === 'STAFF_CONFIRMED_SENT' || h.status === 'SENT' || h.status === 'OPENED' || h.status === 'INITIATED'
  );

  return {
    hasSent: !!active,
    lastNotification: active || history[0],
  };
}
