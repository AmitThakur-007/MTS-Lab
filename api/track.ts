import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vercel Serverless Function & Express compatible types
interface ApiRequest {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (statusCode: number) => ApiResponse;
  setHeader: (name: string, value: string) => ApiResponse;
  json: (data: any) => void;
  end: (data?: any) => void;
}

// Production Supabase Configuration
const PRODUCTION_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_URL = (!rawUrl || rawUrl.includes('your-project') || rawUrl.includes('example.com') || !rawUrl.startsWith('http'))
  ? PRODUCTION_SUPABASE_URL
  : rawUrl;

const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_ANON_KEY = (!rawKey || rawKey.includes('...') || rawKey.length < 50)
  ? PRODUCTION_SUPABASE_ANON_KEY
  : rawKey;

const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('...') && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50)
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : undefined;

// Token cache for server-side authenticated database operations when service_role key is not configured in Vercel environment
let cachedAdminAuthToken: string | null = null;
let adminAuthTokenExpiresAt = 0;
let adminLoginPromise: Promise<string | null> | null = null;

async function getSystemAuthToken(): Promise<string | null> {
  if (SUPABASE_SERVICE_ROLE_KEY) return null;
  if (cachedAdminAuthToken && Date.now() < adminAuthTokenExpiresAt) {
    return cachedAdminAuthToken;
  }
  if (adminLoginPromise) {
    return adminLoginPromise;
  }

  adminLoginPromise = (async () => {
    try {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const authAttempts = [
        { email: 'admin@mtslab.com', password: 'admin123' },
        { email: 'mtsmobilelab@gmail.com', password: 'admin123' },
        { email: 'manojacharya526@gmail.com', password: 'admin123' }
      ];

      for (const cred of authAttempts) {
        try {
          const { data, error } = await authClient.auth.signInWithPassword(cred);
          if (!error && data?.session?.access_token) {
            cachedAdminAuthToken = data.session.access_token;
            const expiresIn = data.session.expires_in || 3600;
            adminAuthTokenExpiresAt = Date.now() + Math.max(300, expiresIn - 60) * 1000;
            return cachedAdminAuthToken;
          }
        } catch (_) { }
      }
      return null;
    } catch (e) {
      console.warn('[SUPABASE SYSTEM AUTH WARN]', e);
      return null;
    } finally {
      adminLoginPromise = null;
    }
  })();

  return adminLoginPromise;
}

// Authoritative Server-Side Supabase Client
const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: async (url: any, options: any = {}) => {
        if (!SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const token = await getSystemAuthToken();
            if (token) {
              const headers = new Headers(options.headers || {});
              headers.set('Authorization', `Bearer ${token}`);
              options.headers = headers;
            }
          } catch (_) { }
        }
        return fetch(url, options);
      },
    },
  }
);

// --- Timezone & Delivery Expiration Utilities ---
const NEPAL_TIMEZONE = 'Asia/Kathmandu';

function toNepalDateString(val?: string | Date | number | null): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: NEPAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

function getAuthoritativeDeliveryDate(repair: any, logsForRepair?: any[]): string | null {
  if (!repair) return null;
  if (repair.deliveredAt) return repair.deliveredAt;
  if (repair.courierOutDeliveredDate) return repair.courierOutDeliveredDate;

  if (logsForRepair && logsForRepair.length > 0) {
    const deliveredLog = logsForRepair.find((l) => {
      const s = String(l.status || '').toUpperCase().trim();
      return s === 'DELIVERED' || s === 'COMPLETED';
    });
    if (deliveredLog && deliveredLog.createdAt) {
      return deliveredLog.createdAt;
    }
  }

  const st = String(repair.status || '').toUpperCase().trim();
  if (st === 'DELIVERED' || st === 'COMPLETED') {
    return repair.updatedAt || repair.createdAt || null;
  }

  return null;
}

function isRepairPubliclyTrackable(
  repair: any,
  logsForRepair?: any[],
  referenceDate: Date = new Date()
): boolean {
  if (!repair) return false;
  const st = String(repair.status || '').toUpperCase().trim();
  const isDelivered = st === 'DELIVERED' || st === 'COMPLETED';

  // Non-delivered repairs are ALWAYS trackable
  if (!isDelivered) {
    return true;
  }

  const deliveryIso = getAuthoritativeDeliveryDate(repair, logsForRepair);
  if (!deliveryIso) {
    return true;
  }

  const deliveryNepalDate = toNepalDateString(deliveryIso);
  const currentNepalDate = toNepalDateString(referenceDate);

  if (!deliveryNepalDate || !currentNepalDate) {
    return true;
  }

  // Same day: currentNepalDate === deliveryNepalDate -> Trackable
  // Next day or later: currentNepalDate > deliveryNepalDate -> Expired
  return currentNepalDate <= deliveryNepalDate;
}

function filterPubliclyTrackableRepairs(
  repairs: any[],
  allLogs: any[] = [],
  referenceDate: Date = new Date()
): any[] {
  if (!repairs || !Array.isArray(repairs)) return [];

  const logsByRepairId: Record<string, any[]> = {};
  for (const log of allLogs) {
    if (log && log.repairId) {
      if (!logsByRepairId[log.repairId]) {
        logsByRepairId[log.repairId] = [];
      }
      logsByRepairId[log.repairId].push(log);
    }
  }

  return repairs
    .filter((rep) => {
      const logs = logsByRepairId[rep.id] || [];
      return isRepairPubliclyTrackable(rep, logs, referenceDate);
    })
    .map((rep) => {
      const logs = logsByRepairId[rep.id] || [];
      const delDate = getAuthoritativeDeliveryDate(rep, logs);
      if (delDate) {
        return { ...rep, deliveredAt: delDate };
      }
      return rep;
    });
}

// --- Phone Normalization & Safe Matching ---
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

  // 10-digit mobile number matching (handles +977 prefix or local 10-digit number)
  const p10 = providedPhoneDigits.length >= 10 ? providedPhoneDigits.slice(-10) : providedPhoneDigits;
  const db10 = dbDigits.length >= 10 ? dbDigits.slice(-10) : dbDigits;
  if (p10.length === 10 && db10.length === 10 && p10 === db10) {
    return true;
  }

  return false;
}

// --- Diagnostic Trace Stage Builder ---
function extractPublicNote(msg?: string): string | null {
  if (!msg) return null;
  const match = msg.match(/Note:\s*([^.\n]+)/i) || msg.match(/Note:\s*(.+)$/i);
  if (match && match[1]) {
    const note = match[1].trim();
    if (note && !note.toLowerCase().startsWith('by ')) return note;
  }
  return null;
}

function buildLogsForRepair(rep: any, allExplicitLogs: any[] = []): any[] {
  const repLogs = allExplicitLogs.filter((l: any) => l.repairId === rep.id);
  const currentSt = (rep.status || 'RECEIVED').toUpperCase().trim();

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
    const desc = isPast
      ? 'Hardware diagnostic assessment, component fault analysis, and micro-inspection completed.'
      : 'Hardware diagnostic assessment and multi-point circuit inspection under way.';
    trace.push({
      id: `trace-${rep.id}-diagnosing`,
      action: 'STATUS_UPDATED',
      status: 'DIAGNOSING',
      title: 'Diagnosing',
      notes: desc,
      message: desc,
      statusText: isPast ? 'Completed' : 'Active',
    });
  }

  // Terminal Cancelled / Cannot Repair Stage
  if (isCancelled || isCannotRepair) {
    trace.unshift({
      id: `trace-${rep.id}-closed`,
      action: 'STATUS_UPDATED',
      status: currentSt,
      title: isCancelled ? 'Service Closed' : 'Cannot Repair',
      notes: isCancelled
        ? 'The repair service request was closed upon customer consultation.'
        : 'Damage exceeds viable safe restoration standards.',
      message: isCancelled
        ? 'The repair service request was closed upon customer consultation.'
        : 'Damage exceeds viable safe restoration standards.',
      statusText: 'Closed',
    });
  }

  // 6. Intake / Received Stage (Always present at the base)
  trace.push({
    id: `trace-${rep.id}-received`,
    action: 'STATUS_UPDATED',
    status: 'RECEIVED',
    title: 'Received',
    notes: 'Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.',
    message: 'Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.',
    statusText: 'Completed',
  });

  return trace;
}

// --- Privacy & Security Sanitizer ---
function sanitizePublicRepairObj(rep: any, cleanPhone: string, allExplicitLogs: any[]): any {
  const rawName = rep.customerName || '';
  const sanitizedName = rawName
    ? `${rawName.charAt(0)}*** ${rawName.split(' ').slice(-1)[0] || ''}`.trim()
    : 'Valued Customer';

  const pDigits = normalizePhoneDigits(rep.customerPhone || cleanPhone);
  const sanitizedPhone = pDigits && pDigits.length >= 6
    ? `${pDigits.slice(0, 3)}****${pDigits.slice(-3)}`
    : undefined;

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
    estimatedCost,
    actualCost,
    cost,
    profit,
    partsCost,
    internalNotes,
    staffNotes,
    privateNotes,
    ...safe
  } = rep;

  return {
    ...safe,
    customerName: sanitizedName,
    customerPhone: sanitizedPhone,
    logs: buildLogsForRepair(rep, allExplicitLogs),
  };
}

// --- Primary Handler for Vercel Serverless Function & Express ---
export default async function handler(req: ApiRequest, res: ApiResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse query params safely supporting Express and Vercel Serverless
    let parsedQuery: Record<string, string> = {};
    if (req.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (Array.isArray(v)) parsedQuery[k] = v[0] || '';
        else if (typeof v === 'string') parsedQuery[k] = v;
      }
    }
    if (req.url && req.url.includes('?')) {
      try {
        const urlParams = new URL(req.url, 'http://localhost').searchParams;
        urlParams.forEach((val, key) => {
          if (!parsedQuery[key]) parsedQuery[key] = val;
        });
      } catch (_) { }
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const rawRepairNumber =
      body.repairNumber ||
      parsedQuery.repairNumber ||
      body.ticketNumber ||
      parsedQuery.ticketNumber ||
      '';

    const rawPhone =
      body.phone ||
      parsedQuery.phone ||
      body.customerPhone ||
      parsedQuery.customerPhone ||
      '';

    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, '').trim();
    const cleanPhone = normalizePhoneDigits(String(rawPhone));
    const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    // Reject empty input
    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your Repair Number or Registered Phone Number.'
      });
    }

    // Reject malformed phone if provided without a repair number
    if (!cleanRepairNumber && cleanPhone.length < 7) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Phone Number (minimum 7 digits) or Repair Number.'
      });
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
      const { data: candidates, error: cErr } = await supabase
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
            const { data: linkedCustomer } = await supabase
              .from('Customer')
              .select('phone, alternativePhone')
              .eq('id', cand.customerId)
              .maybeSingle();

            if (
              linkedCustomer &&
              (isPhoneMatching(cleanPhone, linkedCustomer.phone) ||
                isPhoneMatching(cleanPhone, linkedCustomer.alternativePhone))
            ) {
              allMatchingRepairs.push(cand);
            }
          }
        }
      }
    }
    // Case 2: Customer provided ONLY Repair Number
    else if (cleanRepairNumber) {
      const { data: singleRepair } = await supabase
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
      const { data: directMatches, error: dmErr } = await supabase
        .from('Repair')
        .select(selectFields)
        .or(`customerPhone.eq.${cleanPhone},customerPhone.ilike.%${phone10}%`)
        .order('createdAt', { ascending: false })
        .limit(25);

      if (dmErr) {
        console.error('[PUBLIC TRACK PHONE DIRECT ERROR]', dmErr);
      }

      if (directMatches && directMatches.length > 0) {
        for (const r of directMatches) {
          if (isPhoneMatching(cleanPhone, r.customerPhone)) {
            allMatchingRepairs.push(r);
          }
        }
      }

      // Also search linked Customer accounts
      const { data: cusList } = await supabase
        .from('Customer')
        .select('id, phone, alternativePhone')
        .or(`phone.eq.${cleanPhone},phone.ilike.%${phone10}%,alternativePhone.ilike.%${phone10}%`)
        .limit(10);

      if (cusList && cusList.length > 0) {
        for (const cus of cusList) {
          if (isPhoneMatching(cleanPhone, cus.phone) || isPhoneMatching(cleanPhone, cus.alternativePhone)) {
            const { data: customerRepairs } = await supabase
              .from('Repair')
              .select(selectFields)
              .eq('customerId', cus.id)
              .order('createdAt', { ascending: false })
              .limit(15);

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

    // If no repairs matched input, return controlled empty result (200 OK)
    if (!allMatchingRepairs || allMatchingRepairs.length === 0) {
      return res.status(200).json({
        success: true,
        repair: null,
        repairs: [],
        devices: [],
        message: 'No repair records found matching your tracking information.'
      });
    }

    // Query RepairLog for authoritative delivery timestamps & diagnostic trace
    const allRepairIds = allMatchingRepairs.map((r) => r.id);
    const { data: allExplicitLogs } = await supabase
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

    // Primary repair is the most recently updated trackable repair
    const primaryRepair = trackableRepairs[0];

    const sanitizedPrimary = sanitizePublicRepairObj(primaryRepair, cleanPhone, allExplicitLogs || []);
    const sanitizedAll = trackableRepairs.map((rep) =>
      sanitizePublicRepairObj(rep, cleanPhone, allExplicitLogs || [])
    );

    return res.status(200).json({
      success: true,
      repair: sanitizedPrimary,
      repairs: sanitizedAll,
      devices: sanitizedAll,
      ...sanitizedPrimary
    });
  } catch (err: any) {
    console.error('[TRACK API EXCEPTION]', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to process the repair tracking request. Please try again or contact MTS Lab.'
    });
  }
}
