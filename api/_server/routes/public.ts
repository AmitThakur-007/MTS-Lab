import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { getSlides } from '../services/slidesStorage';
import { filterPubliclyTrackableRepairs } from '../services/trackingExpiration';
import { createNotification } from '../services/notificationStorage';
import { sendEmail, sendEmailDetailed } from '../services/emailService';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();

// 0. Public Slides Endpoints (GET /api/public/slides, /api/public/home-slides)
const handlePublicSlides = async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const slides = await getSlides(true);
    return res.json(slides || []);
  } catch (err: any) {
    console.error('[PUBLIC SLIDES EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve public slides.' });
  }
};

router.get('/slides', handlePublicSlides);
router.get('/home-slides', handlePublicSlides);

// Helper functions for phone verification & IDOR prevention
function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function isPhoneMatching(providedPhoneDigits: string, recordPhone?: string | null): boolean {
  if (!providedPhoneDigits || !recordPhone) return false;
  const dbDigits = normalizePhoneDigits(recordPhone);
  if (!dbDigits) return false;

  // Exact digits match
  if (providedPhoneDigits === dbDigits) return true;

  // 10-digit mobile matching (Nepal standard 10-digit mobile, ignoring +977 or country codes)
  const p10 = providedPhoneDigits.length >= 10 ? providedPhoneDigits.slice(-10) : providedPhoneDigits;
  const db10 = dbDigits.length >= 10 ? dbDigits.slice(-10) : dbDigits;
  if (p10.length === 10 && db10.length === 10 && p10 === db10) return true;

  // If both are exact landline numbers (7-8 digits)
  if (providedPhoneDigits.length < 10 && dbDigits.length < 10 && providedPhoneDigits.length >= 7 && dbDigits.length >= 7) {
    if (providedPhoneDigits.slice(-7) === dbDigits.slice(-7)) return true;
  }

  return false;
}

// 1. GET & POST /api/public/track (or /api/track) - Secure Resilient Public Tracking
const handlePublicTrack = async (req: Request, res: Response) => {
  // Prevent any browser or intermediary caching of tracking responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || '';
    const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || '';

    // Strip leading '#', trim whitespace, and clean digits
    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, '').trim();
    const cleanPhone = normalizePhoneDigits(String(rawPhone));
    const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ success: false, error: 'Please enter your Repair Number or Registered Phone Number.' });
    }

    if (!cleanRepairNumber && cleanPhone.length < 7) {
      return res.status(400).json({ success: false, error: 'Please enter a valid Phone Number (minimum 7 digits) or Repair Number.' });
    }

    const selectFields = `
      id,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceBrand,
      deviceModel,
      problemDescription,
      deviceCondition,
      conditionNotes,
      accessoriesReceived,
      status,
      priority,
      expectedCompletionDate,
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      receivingMethod,
      isCourierIn,
      isCourierOut,
      courierStatus,
      courierCompany,
      courierTrackingNumber,
      returnCourierCompany,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      courierOutDeliveredDate,
      hasBatteryWarranty,
      batteryWarrantyPeriod,
      batteryType,
      batteryHealth,
      batterySerial,
      batteryWarrantyExpiry,
      warrantyTerms,
      remarks,
      createdAt,
      updatedAt
    `;

    let allMatchingRepairs: any[] = [];

    // Case 1: Customer provided BOTH Repair Number AND Phone Number
    if (cleanRepairNumber && cleanPhone) {
      const { data: candidates, error: cErr } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(10);

      if (cErr) {
        console.error('[PUBLIC TRACK CANDIDATE ERROR]', cErr);
      }

      if (candidates && candidates.length > 0) {
        for (const cand of candidates) {
          if (isPhoneMatching(cleanPhone, cand.customerPhone)) {
            allMatchingRepairs.push(cand);
          } else if (cand.customerId) {
            const { data: linkedCustomer } = await supabaseAdmin
              .from('Customer')
              .select('phone, alternativePhone')
              .eq('id', cand.customerId)
              .maybeSingle();

            if (
              linkedCustomer &&
              (isPhoneMatching(cleanPhone, linkedCustomer.phone) || isPhoneMatching(cleanPhone, linkedCustomer.alternativePhone))
            ) {
              allMatchingRepairs.push(cand);
            }
          }
        }
      }
    }
    // Case 2: Customer provided ONLY Repair Number
    else if (cleanRepairNumber) {
      const { data: singleRepair } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (singleRepair) {
        allMatchingRepairs.push(singleRepair);
      }
    }
    // Case 3: Customer provided ONLY Phone Number
    else if (cleanPhone) {
      const { data: directMatches } = await supabaseAdmin
        .from('Repair')
        .select(selectFields)
        .or(`customerPhone.eq.${cleanPhone},customerPhone.ilike.%${phone10}%`)
        .order('createdAt', { ascending: false })
        .limit(20);

      if (directMatches && directMatches.length > 0) {
        for (const r of directMatches) {
          if (isPhoneMatching(cleanPhone, r.customerPhone)) {
            allMatchingRepairs.push(r);
          }
        }
      }

      // Also search linked Customer accounts
      const { data: cusList } = await supabaseAdmin
        .from('Customer')
        .select('id, phone, alternativePhone')
        .or(`phone.eq.${cleanPhone},phone.ilike.%${phone10}%,alternativePhone.ilike.%${phone10}%`)
        .limit(10);

      if (cusList && cusList.length > 0) {
        for (const cus of cusList) {
          if (isPhoneMatching(cleanPhone, cus.phone) || isPhoneMatching(cleanPhone, cus.alternativePhone)) {
            const { data: customerRepairs } = await supabaseAdmin
              .from('Repair')
              .select(selectFields)
              .eq('customerId', cus.id)
              .order('createdAt', { ascending: false })
              .limit(10);

            if (customerRepairs) {
              for (const cr of customerRepairs) {
                if (!allMatchingRepairs.some((existing) => existing.id === cr.id)) {
                  allMatchingRepairs.push(cr);
                }
              }
            }
          }
        }
      }
    }

    if (!allMatchingRepairs || allMatchingRepairs.length === 0) {
      return res.status(200).json({
        success: true,
        repair: null,
        repairs: [],
        devices: [],
        message: 'No repair records found matching your tracking information.'
      });
    }

    // Query RepairLog for all matching repairs to determine authoritative delivery timestamps and diagnostic trace
    const allRepairIds = allMatchingRepairs.map((r) => r.id);
    const { data: allExplicitLogs } = await supabaseAdmin
      .from('RepairLog')
      .select('id, repairId, status, message, createdAt')
      .in('repairId', allRepairIds)
      .order('createdAt', { ascending: false });

    // Enforce business rule: Once marked DELIVERED, trackable only until end of that delivery day (Asia/Kathmandu).
    // Starting next calendar day, repair is expired from public tracking.
    const trackableRepairs = filterPubliclyTrackableRepairs(allMatchingRepairs, allExplicitLogs || []);

    if (!trackableRepairs || trackableRepairs.length === 0) {
      return res.status(200).json({
        success: true,
        repair: null,
        repairs: [],
        devices: [],
        message: 'No active repair records found matching your tracking information.'
      });
    }

    const primaryRepair = trackableRepairs[0];

    const getCustomerLogDesc = (logStatus?: string, currentOverallStatus?: string) => {
      const st = (logStatus || currentOverallStatus || 'RECEIVED').toUpperCase().trim();
      const currentSt = (currentOverallStatus || 'RECEIVED').toUpperCase().trim();

      const isDeliveredOverall = currentSt === 'DELIVERED' || currentSt === 'COMPLETED';
      const isRepairedOrBeyond =
        isDeliveredOverall ||
        currentSt === 'REPAIRED' ||
        currentSt === 'READY_FOR_PICKUP' ||
        currentSt === 'READY_FOR_DELIVERY' ||
        currentSt === 'COURIER_DISPATCHED' ||
        currentSt === 'DISPATCHED_VIA_COURIER' ||
        currentSt === 'REPROBLEM_FIXED' ||
        currentSt === 'WARRANTY_FIXED';

      // 1. REPAIRED stage
      if (st === 'REPAIRED' || st.includes('WARRANTY_FIXED') || st.includes('REPROBLEM_FIXED')) {
        return 'The technical repair was successfully completed and the device passed the required quality verification.';
      }

      // 2. READY FOR PICKUP / DELIVERY
      if (st.includes('READY') || st.includes('PICKUP')) {
        return 'The repaired device is sanitized, packaged, and ready for customer pickup.';
      }

      // 3. COURIER LOGISTICS
      if (st.includes('COURIER') || st.includes('DISPATCH')) {
        return 'The repaired device was safely packed and dispatched via courier logistics.';
      }

      // 4. DELIVERED
      if (st.includes('DELIVERED') || st.includes('COMPLETED')) {
        return 'The device was handed over to the customer when the actual status reaches Delivered.';
      }

      // 5. TESTING / QA
      if (st.includes('TEST') || st.includes('QA')) {
        if (isRepairedOrBeyond) {
          return 'The repaired device underwent quality verification/testing.';
        }
        return 'The repaired device is undergoing comprehensive quality verification and calibration.';
      }

      // 6. RESTORATION / IN_PROCESS / WAITING_FOR_PARTS
      if (
        st.includes('PROCESS') ||
        st.includes('RESTORATION') ||
        st.includes('WAITING_FOR_PARTS') ||
        st === 'REPAIRING'
      ) {
        if (isRepairedOrBeyond) {
          return 'The required repair/restoration work was carried out.';
        }
        return 'The required repair/restoration work is currently being carried out by certified engineers.';
      }

      // 7. DIAGNOSING
      if (st.includes('DIAGNOSING')) {
        return 'The device was inspected/diagnosed to identify the reported issue.';
      }

      // 8. RECEIVED / INTAKE
      if (st.includes('RECEIVED') || st.includes('CREATED')) {
        return 'The device was received by MTS Lab for repair.';
      }

      // 9. PENDING
      if (st.includes('PENDING')) {
        return 'Your device is cataloged in the service queue awaiting laboratory intake and diagnosis.';
      }

      // 10. RE-PROBLEM
      if (st.includes('RE_PROBLEM') || st.includes('REPROBLEM')) {
        return 'Device received for priority diagnostic re-evaluation.';
      }

      // 11. CANCELLED / CANNOT REPAIR
      if (st.includes('CANCEL')) {
        return 'Repair service request closed.';
      }
      if (st.includes('CANNOT')) {
        return 'Catastrophic hardware damage exceeds viable safe restoration standards.';
      }

      return 'Device status updated to reflect laboratory progress.';
    };

    const extractPublicNote = (msg?: string): string | null => {
      if (!msg) return null;
      const match = msg.match(/Note:\s*([^.\n]+)/i) || msg.match(/Note:\s*(.+)$/i);
      if (match && match[1]) {
        const note = match[1].trim();
        // Discard if it only contained staff name
        if (note && !note.toLowerCase().startsWith('by ')) return note;
      }
      return null;
    };

    const buildLogsForRepair = (rep: any) => {
      const repLogs = (allExplicitLogs || []).filter((l: any) => l.repairId === rep.id);
      const currentSt = (rep.status || 'RECEIVED').toUpperCase().trim();

      // Find any custom technician notes attached to explicit logs
      const notesByStatus: Record<string, string> = {};
      repLogs.forEach((l: any) => {
        const key = (l.status || '').toUpperCase().trim();
        const note = extractPublicNote(l.message);
        if (note && !notesByStatus[key]) {
          notesByStatus[key] = note;
        }
      });

      const isDelivered = currentSt === 'DELIVERED' || currentSt === 'COMPLETED';
      const isRepaired = [
        'REPAIRED',
        'READY_FOR_PICKUP',
        'READY_FOR_DELIVERY',
        'READY',
        'COURIER_DISPATCHED',
        'DISPATCHED_VIA_COURIER',
        'REPROBLEM_FIXED',
        'WARRANTY_FIXED',
      ].includes(currentSt);

      const isTesting = ['TESTING', 'QA_TESTING', 'QA'].includes(currentSt);
      const isRestoration = [
        'IN_PROCESS',
        'IN_PROGRESS',
        'WAITING_FOR_PARTS',
        'RESTORATION',
        'REPAIRING',
        'RE_PROBLEM',
        'REPROBLEM',
      ].includes(currentSt);
      const isDiagnosing = currentSt === 'DIAGNOSING';
      const isCancelled = currentSt.includes('CANCEL');
      const isCannotRepair = currentSt.includes('CANNOT');

      // Build ordered trace stages in reverse-chronological order (latest first)
      const trace: any[] = [];

      // 1. Delivered Stage
      if (isDelivered) {
        trace.push({
          id: `trace-${rep.id}-delivered`,
          action: 'STATUS_UPDATED',
          status: 'DELIVERED',
          title: 'Delivered',
          notes: 'The device was safely delivered and handed over to the customer.',
          message: 'The device was safely delivered and handed over to the customer.',
          statusText: 'Completed',
        });
      }

      // 2. Repaired Stage
      if (isDelivered || isRepaired) {
        const customNote = notesByStatus['REPAIRED'] || notesByStatus['READY_FOR_PICKUP'] || '';
        const desc = customNote
          ? `The technical repair was successfully completed and quality verification passed. (${customNote})`
          : 'The technical repair was successfully completed and the device passed the required quality verification.';
        trace.push({
          id: `trace-${rep.id}-repaired`,
          action: 'STATUS_UPDATED',
          status: 'REPAIRED',
          title: 'Repaired',
          notes: desc,
          message: desc,
          statusText: 'Completed',
        });
      }

      // 3. QA Testing Stage
      if (isDelivered || isRepaired || isTesting) {
        const isPast = isDelivered || isRepaired;
        trace.push({
          id: `trace-${rep.id}-qa`,
          action: 'STATUS_UPDATED',
          status: 'QA_TESTING',
          title: 'QA Testing',
          notes: isPast
            ? 'The repaired device completed comprehensive quality verification, electrical diagnostic check, and functionality testing.'
            : 'The repaired device is undergoing comprehensive quality verification, electrical diagnostic check, and calibration.',
          message: isPast
            ? 'The repaired device completed comprehensive quality verification, electrical diagnostic check, and functionality testing.'
            : 'The repaired device is undergoing comprehensive quality verification, electrical diagnostic check, and calibration.',
          statusText: isPast ? 'Completed' : 'Active',
        });
      }

      // 4. Restoration Stage
      if (isDelivered || isRepaired || isTesting || isRestoration) {
        const isPast = isDelivered || isRepaired || isTesting;
        const customNote = notesByStatus['IN_PROCESS'] || notesByStatus['RESTORATION'] || '';
        const desc = isPast
          ? customNote
            ? `Component restoration and precision servicing successfully executed. (${customNote})`
            : 'Component restoration and precision servicing successfully executed by certified hardware engineers.'
          : 'Active hardware restoration and component servicing is currently in progress.';
        trace.push({
          id: `trace-${rep.id}-restoration`,
          action: 'STATUS_UPDATED',
          status: 'RESTORATION',
          title: 'Restoration',
          notes: desc,
          message: desc,
          statusText: isPast ? 'Completed' : 'Active',
        });
      }

      // 5. Diagnosing Stage
      if (isDelivered || isRepaired || isTesting || isRestoration || isDiagnosing) {
        const isPast = isDelivered || isRepaired || isTesting || isRestoration;
        trace.push({
          id: `trace-${rep.id}-diagnosing`,
          action: 'STATUS_UPDATED',
          status: 'DIAGNOSING',
          title: 'Diagnosing',
          notes: isPast
            ? 'Circuit and schematic diagnostic assessment completed to identify fault causes.'
            : 'Hardware diagnostic assessment and multi-point circuit inspection under way.',
          message: isPast
            ? 'Circuit and schematic diagnostic assessment completed to identify fault causes.'
            : 'Hardware diagnostic assessment and multi-point circuit inspection under way.',
          statusText: isPast ? 'Completed' : 'Active',
        });
      }

      // 6. Received / Cataloged Stage (Always completed once intake occurs)
      trace.push({
        id: `trace-${rep.id}-received`,
        action: 'STATUS_UPDATED',
        status: 'RECEIVED',
        title: 'Received',
        notes: 'Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.',
        message: 'Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.',
        statusText: 'Completed',
      });

      // Special terminal statuses
      if (isCancelled) {
        trace.unshift({
          id: `trace-${rep.id}-cancelled`,
          action: 'STATUS_UPDATED',
          status: 'CANCELLED',
          title: 'Service Cancelled',
          notes: 'Repair service ticket was closed or cancelled by customer request.',
          message: 'Repair service ticket was closed or cancelled by customer request.',
          statusText: 'Closed',
        });
      } else if (isCannotRepair) {
        trace.unshift({
          id: `trace-${rep.id}-cannot-repair`,
          action: 'STATUS_UPDATED',
          status: 'CANNOT_REPAIR',
          title: 'Cannot Repair',
          notes: 'Hardware damage exceeds safe restoration limits or replacement parts are permanently unavailable.',
          message: 'Hardware damage exceeds safe restoration limits or replacement parts are permanently unavailable.',
          statusText: 'Closed',
        });
      }

      return trace;
    };

    // Mask customer name and phone for public privacy
    const rawName = primaryRepair.customerName || '';
    const sanitizedName = rawName
      ? `${rawName.charAt(0)}*** ${rawName.split(' ').slice(-1)[0] || ''}`.trim()
      : 'Valued Customer';

    const pDigits = normalizePhoneDigits(primaryRepair.customerPhone || cleanPhone);
    const sanitizedPhone = pDigits && pDigits.length >= 6
      ? `${pDigits.slice(0, 3)}****${pDigits.slice(-3)}`
      : undefined;

    const sanitizePublicRepairObj = (rep: any) => {
      const {
        technicianId,
        technician,
        assignedTechnician,
        assignedTechnicianId,
        technicianName,
        createdById,
        receptionist,
        receptionistId,
        receptionistName,
        manager,
        managerId,
        managerName,
        admin,
        adminId,
        adminName,
        user,
        userId,
        staff,
        staffName,
        ...safe
      } = rep;

      return {
        ...safe,
        customerName: sanitizedName,
        customerPhone: sanitizedPhone,
        logs: buildLogsForRepair(rep),
      };
    };

    const sanitizedPrimary = sanitizePublicRepairObj(primaryRepair);
    const sanitizedAll = trackableRepairs.map((rep) => sanitizePublicRepairObj(rep));

    return res.json({
      success: true,
      repair: sanitizedPrimary,
      repairs: sanitizedAll,
      devices: sanitizedAll,
      ...sanitizedPrimary
    });
  } catch (err: any) {
    console.error('[PUBLIC TRACK EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to retrieve tracking details. Please try again later.' });
  }
};

router.get('/track', handlePublicTrack);
router.post('/track', handlePublicTrack);
router.get('/public/track', handlePublicTrack);
router.post('/public/track', handlePublicTrack);

// 1.5 Public Contact Inquiries (POST /api/contact, /api/public/contact)
interface InquiryRateRecord {
  timestamps: number[];
  lastHash?: string;
  lastSubmitTime?: number;
}
const inquiryRateMap = new Map<string, InquiryRateRecord>();
const INQUIRY_MAX_PER_WINDOW = 5;
const INQUIRY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const INQUIRY_DUPLICATE_WINDOW_MS = 60 * 1000; // 60 seconds

function checkInquiryRateLimit(ip: string, phone: string, messageHash: string): { allowed: boolean; reason?: string; isDuplicate?: boolean } {
  const now = Date.now();
  const key = `${ip}_${phone}`;
  const record = inquiryRateMap.get(key) || { timestamps: [] };

  // Filter out timestamps older than window
  record.timestamps = record.timestamps.filter(ts => now - ts < INQUIRY_WINDOW_MS);

  // Check duplicate submission within 60 seconds
  if (record.lastHash === messageHash && record.lastSubmitTime && (now - record.lastSubmitTime < INQUIRY_DUPLICATE_WINDOW_MS)) {
    return { allowed: false, isDuplicate: true };
  }

  // Check frequency limit
  if (record.timestamps.length >= INQUIRY_MAX_PER_WINDOW) {
    return { 
      allowed: false, 
      reason: 'Too many inquiries submitted from your connection. Please contact our reception desk directly via phone (+977 9869276668) or WhatsApp.' 
    };
  }

  // Allow and record
  record.timestamps.push(now);
  record.lastHash = messageHash;
  record.lastSubmitTime = now;
  inquiryRateMap.set(key, record);
  return { allowed: true };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const INQUIRIES_FILE = path.join(process.cwd(), 'data', 'inquiries.json');

function saveInquiryRecord(inquiry: any) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    let list: any[] = [];
    if (fs.existsSync(INQUIRIES_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(INQUIRIES_FILE, 'utf8'));
      } catch {
        list = [];
      }
    }
    list.unshift(inquiry);
    if (list.length > 300) list = list.slice(0, 300);
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[INQUIRY STORAGE WARN]', err);
  }
}

const handlePublicContact = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, subject, message, botTrap, website, companyAddress } = req.body || {};

    // 1. Honeypot check for automated bots
    if (botTrap || website || companyAddress) {
      console.warn('[BOT DETECTED ON CONTACT FORM]');
      return res.status(400).json({ error: 'Invalid submission parameter.' });
    }

    // 2. Strict Input Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name (minimum 2 characters).' });
    }

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Please enter your contact phone number.' });
    }

    const cleanPhone = phone.trim().replace(/[^\d+-\s]/g, '').slice(0, 25);
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return res.status(400).json({ error: 'Please enter a valid phone number (at least 7 digits).' });
    }

    let cleanEmail = '';
    if (email && typeof email === 'string' && email.trim().length > 0) {
      cleanEmail = email.trim().slice(0, 100);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address format (or leave blank).' });
      }
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Please enter a message of at least 10 characters describing your device inquiry.' });
    }

    const cleanName = name.trim().slice(0, 100);
    const cleanSubject = typeof subject === 'string' && subject.trim().length > 0 ? subject.trim().slice(0, 150) : 'General Inquiry';
    const cleanMessage = message.trim().slice(0, 3000);

    // 3. Spam and Rate Limiting
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const messageHash = crypto.createHash('md5').update(`${cleanPhone}_${cleanSubject}_${cleanMessage}`).digest('hex');
    const rateCheck = checkInquiryRateLimit(clientIp, cleanPhone, messageHash);

    if (!rateCheck.allowed) {
      if (rateCheck.isDuplicate) {
        return res.json({
          success: true,
          message: 'Your inquiry has already been received. Our support team will get back to you shortly.',
          inquiry: {
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            subject: cleanSubject,
            message: cleanMessage,
            submittedAt: new Date().toISOString()
          }
        });
      }
      return res.status(429).json({ error: rateCheck.reason || 'Too many submissions. Please wait before submitting again.' });
    }

    const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const submissionTime = new Date().toISOString();

    // 4. Log staff notification for reception / management
    try {
      await createNotification({
        title: `Web Inquiry: ${cleanSubject}`,
        message: `From ${cleanName} (${cleanPhone}${cleanEmail ? `, ${cleanEmail}` : ''}): "${cleanMessage.slice(0, 150)}${cleanMessage.length > 150 ? '...' : ''}"`,
        type: 'GENERAL',
        priority: 'NORMAL',
        targetRole: 'RECEPTIONIST',
        metadata: {
          inquiryId,
          customerName: cleanName,
          customerPhone: cleanPhone,
          customerEmail: cleanEmail,
          subject: cleanSubject,
          fullMessage: cleanMessage,
          source: 'CONTACT_PAGE',
          receivedAt: submissionTime
        }
      });
    } catch (notifErr) {
      console.warn('[CONTACT NOTIFICATION WARN]', notifErr);
    }

    // 5. Build and send email to official support desk
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@mobiletechnologystation.com.np';
    const safeEmailSubject = `[MTS Lab Inquiry] ${cleanSubject} - ${cleanName}`.replace(/[\r\n]+/g, ' ');
    const nepalTimestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });

    const emailText = [
      `New Customer Inquiry — MTS Lab`,
      ``,
      `Customer Name: ${cleanName}`,
      `Phone: ${cleanPhone}`,
      `Email: ${cleanEmail || 'Not provided'}`,
      `Subject: ${cleanSubject}`,
      ``,
      `Message:`,
      `${cleanMessage}`,
      ``,
      `Submitted:`,
      `${nepalTimestamp} (Nepal Time)`
    ].join('\n');

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px; color: #0f172a;">New Customer Inquiry — MTS Lab</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Central Diagnostic & Screen Refurbishment Facility</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 130px; font-weight: 600;">Customer Name:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${escapeHtml(cleanName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Phone Number:</td>
            <td style="padding: 8px 0; color: #0f172a;"><a href="tel:${escapeHtml(cleanPhone)}" style="color: #059669; text-decoration: none; font-weight: bold;">${escapeHtml(cleanPhone)}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Email Address:</td>
            <td style="padding: 8px 0; color: #0f172a;">${cleanEmail ? `<a href="mailto:${escapeHtml(cleanEmail)}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(cleanEmail)}</a>` : '<span style="color: #94a3b8;">Not provided</span>'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Inquiry Subject:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${escapeHtml(cleanSubject)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Submitted Time:</td>
            <td style="padding: 8px 0; color: #64748b; font-size: 12px;">${nepalTimestamp} (Nepal Time)</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Customer Message</h4>
          <div style="font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${escapeHtml(cleanMessage)}</div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #94a3b8;">
          This customer inquiry was submitted through the official MTS Lab Contact Page at <a href="https://mobiletechnologystation.com.np" style="color: #64748b;">mobiletechnologystation.com.np</a>.
        </div>
      </div>
    `;

    // 6. Deliver email to support desk via configured provider
    const emailResult = await sendEmailDetailed({
      to: SUPPORT_EMAIL,
      subject: safeEmailSubject,
      text: emailText,
      html: emailHtml
    });

    // Save inquiry record locally
    saveInquiryRecord({
      id: inquiryId,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      submittedAt: submissionTime,
      emailStatus: emailResult.success ? 'sent' : 'failed',
      emailProvider: emailResult.provider,
      clientIp
    });

    if (!emailResult.success) {
      console.error('[PUBLIC CONTACT EMAIL FAILURE]', emailResult.error);
      return res.status(502).json({
        error: "We couldn't submit your inquiry right now. Please try again or contact us directly via WhatsApp or phone."
      });
    }

    return res.json({
      success: true,
      message: 'Your inquiry has been submitted successfully. Our support team will get back to you.',
      inquiry: {
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        submittedAt: submissionTime
      }
    });
  } catch (err: any) {
    console.error('[PUBLIC CONTACT EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to submit inquiry. Please call our hotline directly.' });
  }
};

router.post('/contact', handlePublicContact);
router.post('/public/contact', handlePublicContact);

// 2. GET /api/manager/stats
router.get('/manager/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin.from('Repair').select('technicianId, status, priority, estimatedCost, advancePaid, totalPaid');

    let totalRepairs = 0;
    let pending = 0;
    let assigned = 0;
    let inProgress = 0;
    let repaired = 0;
    let ready = 0;
    let delivered = 0;
    let reproblem = 0;
    let unassigned = 0;
    let urgentCount = 0;
    let highCount = 0;
    let totalRevenue = 0;

    (repairs || []).forEach((r: any) => {
      totalRepairs++;
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);

      const s = (r.status || '').toUpperCase();
      if (!r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') unassigned++;
      if (r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') assigned++;

      if (['PENDING', 'RECEIVED'].includes(s)) pending++;
      if (['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS', 'IN_PROGRESS', 'REPAIRING'].includes(s)) inProgress++;
      if (['REPAIRED'].includes(s)) repaired++;
      if (['READY_FOR_PICKUP', 'READY_FOR_DELIVERY'].includes(s)) ready++;
      if (['DELIVERED', 'COMPLETED'].includes(s)) delivered++;
      if (['RE_PROBLEM', 'REPROBLEM'].includes(s)) reproblem++;

      if (r.priority === 'URGENT') urgentCount++;
      if (r.priority === 'HIGH') highCount++;
    });

    return res.json({
      totalRepairs,
      pending,
      assigned,
      inProgress,
      repaired,
      ready,
      delivered,
      reproblem,
      unassigned,
      urgentCount,
      highCount,
      totalRevenue,
    });
  } catch (err: any) {
    console.error('[MANAGER STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to compute manager stats.' });
  }
});

// 3. GET /api/manager/workload
router.get('/manager/workload', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: staff } = await supabaseAdmin
      .from('User')
      .select('id, name, role, department')
      .in('role', ['TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT'])
      .is('deletedAt', null);

    const { data: repairs } = await supabaseAdmin
      .from('Repair')
      .select('technicianId, status, priority')
      .not('status', 'in', '("COMPLETED","DELIVERED","CANCELLED")');

    const workloadMap: Record<string, { pendingCount: number; inProgressCount: number; repairedCount: number; readyCount: number; urgentCount: number; totalActive: number }> = {};

    (staff || []).forEach((s: any) => {
      workloadMap[s.id] = {
        pendingCount: 0,
        inProgressCount: 0,
        repairedCount: 0,
        readyCount: 0,
        urgentCount: 0,
        totalActive: 0
      };
    });

    (repairs || []).forEach((r: any) => {
      if (r.technicianId && workloadMap[r.technicianId]) {
        const item = workloadMap[r.technicianId];
        const s = (r.status || '').toUpperCase();
        item.totalActive++;

        if (['PENDING', 'RECEIVED'].includes(s)) item.pendingCount++;
        if (['IN_PROCESS', 'DIAGNOSING', 'TESTING', 'WAITING_FOR_PARTS', 'IN_PROGRESS'].includes(s)) item.inProgressCount++;
        if (s === 'REPAIRED') item.repairedCount++;
        if (s === 'READY_FOR_PICKUP') item.readyCount++;
        if (r.priority === 'URGENT') item.urgentCount++;
      }
    });

    const workload = (staff || []).map((s: any) => ({
      technician: {
        id: s.id,
        name: s.name,
        role: s.role,
        department: s.department
      },
      ...workloadMap[s.id]
    }));

    return res.json(workload);
  } catch (err: any) {
    console.error('[MANAGER WORKLOAD ERROR]', err);
    return res.status(500).json({ error: 'Failed to calculate technician workloads.' });
  }
});

// 4. GET /api/dashboard/stats
router.get('/dashboard/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: repairs } = await supabaseAdmin.from('Repair').select('status, priority, totalPaid, advancePaid, estimatedCost');
    const { count: totalCustomers } = await supabaseAdmin.from('Customer').select('*', { count: 'exact', head: true });
    const { count: totalStaff } = await supabaseAdmin.from('User').select('*', { count: 'exact', head: true }).is('deletedAt', null);

    let activeRepairs = 0;
    let completedRepairs = 0;
    let totalRevenue = 0;

    (repairs || []).forEach((r: any) => {
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);
      if (['COMPLETED', 'DELIVERED'].includes((r.status || '').toUpperCase())) {
        completedRepairs++;
      } else {
        activeRepairs++;
      }
    });

    return res.json({
      activeRepairs,
      completedRepairs,
      totalCustomers: totalCustomers || 0,
      totalStaff: totalStaff || 0,
      totalRevenue,
    });
  } catch (err: any) {
    console.error('[DASHBOARD STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve dashboard overview.' });
  }
});

export default router;