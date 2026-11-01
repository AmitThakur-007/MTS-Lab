import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';
import {
  validateAndNormalizeNepalPhone,
  generateRepairCompletedSmsMessage,
  generateRepairedDeviceSmsMessage,
  generateReceivedDeviceSmsMessage,
  analyzeSmsEncodingServer,
  recordSmsNotification,
  updateSmsNotification,
  getSmsNotificationsForRepair,
  getAllSmsNotifications,
  getSmsStatistics,
  getRepairSmsSummary,
  prepareOrGetPendingNotification,
  SmsNotificationRecord,
  SmsNotificationStatus,
  SmsNotificationChannel,
} from '../services/smsStorage';
import { getNptIsoBoundsForPreset, DateFilterPreset } from '../services/repairStatsService';

const router = Router();

// Roles with full or send permissions
const SMS_SEND_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'];
// Roles with read-only or full access to stats and reports
const SMS_REPORT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
// Roles allowed to view history
const SMS_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'];

function isRepairedStatusEligible(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return ['REPAIRED', 'READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'].includes(s);
}

/**
 * 1. GET /api/sms/stats — High-accuracy backend-calculated SMS & WhatsApp statistics
 * Roles: SUPER_ADMIN, ADMIN, MANAGER
 */
router.get('/stats', authenticate, authorize(SMS_REPORT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, filterPreset } = req.query as {
      startDate?: string;
      endDate?: string;
      filterPreset?: string;
    };

    let computedStartDate = startDate;
    let computedEndDate = endDate;

    if (filterPreset && filterPreset !== 'ALL' && !startDate && !endDate) {
      const validPresets: DateFilterPreset[] = ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'];
      if (validPresets.includes(filterPreset as DateFilterPreset)) {
        const bounds = getNptIsoBoundsForPreset(filterPreset as DateFilterPreset);
        computedStartDate = bounds.startIso || undefined;
        computedEndDate = bounds.endIso || undefined;
      } else if (filterPreset === 'LAST_7_DAYS') {
        const now = new Date();
        computedStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (filterPreset === 'LAST_30_DAYS') {
        const now = new Date();
        computedStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const stats = getSmsStatistics({
      startDate: computedStartDate,
      endDate: computedEndDate,
    });

    return res.json({
      success: true,
      filter: {
        startDate: computedStartDate || null,
        endDate: computedEndDate || null,
        filterPreset: filterPreset || 'ALL',
      },
      ...stats,
    });
  } catch (err: any) {
    console.error('[GET /api/sms/stats ERROR]', err);
    return res.status(500).json({ error: 'Failed to calculate SMS statistics.' });
  }
});

/**
 * 2. GET /api/sms/notifications — Searchable, filterable list of all notification records
 * Roles: SUPER_ADMIN, ADMIN, MANAGER, RECEPTIONIST
 */
router.get('/notifications', authenticate, authorize(SMS_VIEW_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, channel, staffId, startDate, endDate, limit, offset } = req.query as {
      search?: string;
      status?: string;
      channel?: string;
      staffId?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };

    const result = getAllSmsNotifications({
      search,
      status,
      channel,
      staffId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('[GET /api/sms/notifications ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve SMS notifications.' });
  }
});

/**
 * 3. GET /api/sms/pending-repairs — Repairs currently completed awaiting customer notification
 * Roles: SUPER_ADMIN, ADMIN, RECEPTIONIST, MANAGER (read-only for manager)
 */
router.get('/pending-repairs', authenticate, authorize(SMS_VIEW_ROLES), async (_req: AuthRequest, res: Response) => {
  try {
    const { data: repairs, error } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, status, priority, createdAt, updatedAt')
      .in('status', ['REPAIRED', 'READY_FOR_PICKUP', 'READY', 'READY_FOR_DELIVERY'])
      .order('updatedAt', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('[FETCH PENDING REPAIRS DB WARN]', error);
    }

    const items = (repairs || []).map((repair) => {
      const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
      const summary = getRepairSmsSummary(repair.id);
      const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair.deviceModel || ''}`.trim();

      const defaultMsg = generateRepairCompletedSmsMessage({
        customerName: repair.customerName,
        deviceModel: deviceModelFull,
        repairNumber: repair.repairNumber,
      });

      return {
        repairId: repair.id,
        repairNumber: repair.repairNumber,
        customerName: repair.customerName,
        customerPhoneRaw: repair.customerPhone,
        phoneValidation,
        deviceModel: deviceModelFull,
        deviceBrand: repair.deviceBrand || null,
        status: repair.status,
        completedAt: repair.updatedAt,
        defaultMessage: defaultMsg,
        smsSummary: summary,
      };
    });

    return res.json({
      success: true,
      repairs: items,
      count: items.length,
    });
  } catch (err: any) {
    console.error('[GET /api/sms/pending-repairs ERROR]', err);
    return res.status(500).json({ error: 'Failed to load pending repaired devices.' });
  }
});

/**
 * 3.1 GET /api/sms/devices/repaired — Retrieve repaired devices filtered by date (NPT) and search
 * Roles: SUPER_ADMIN, ADMIN, RECEPTIONIST, MANAGER
 */
router.get('/devices/repaired', authenticate, authorize(SMS_VIEW_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const {
      preset = 'THIS_MONTH',
      startDate,
      endDate,
      search,
      page = '1',
      limit = '20',
      refDate: queryRefDate,
      referenceDate,
    } = req.query as {
      preset?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: string;
      limit?: string;
      refDate?: string;
      referenceDate?: string;
    };

    const rawPreset = (typeof preset === 'string' && preset.trim()) ? preset.trim().toUpperCase() : 'THIS_MONTH';
    const validPreset: DateFilterPreset = (['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'].includes(rawPreset)
      ? rawPreset
      : 'THIS_MONTH') as DateFilterPreset;

    const evaluationRefDate = (queryRefDate || referenceDate)
      ? new Date(String(queryRefDate || referenceDate))
      : new Date();

    const { startIso, endIso } = getNptIsoBoundsForPreset(validPreset, startDate, endDate, evaluationRefDate);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const REPAIRED_STATUS_LIST = ['REPAIRED', 'READY_FOR_PICKUP', 'repaired', 'ready_for_pickup', 'Repaired'];

    // 1. Query Repair records whose current status is REPAIRED (devices waiting for customer collection)
    let repairQuery = supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, problemDescription, status, priority, courierReceivedDate, isCourierIn, expectedCompletionDate, createdAt, updatedAt')
      .in('status', REPAIRED_STATUS_LIST);

    if (search && search.trim()) {
      const term = search.trim();
      repairQuery = repairQuery.or(`repairNumber.ilike.%${term}%,customerName.ilike.%${term}%,customerPhone.ilike.%${term}%,deviceModel.ilike.%${term}%`);
    }

    const { data: repairs, error } = await repairQuery;

    if (error) {
      console.error('[REPAIRED DEVICES QUERY ERROR]', error);
      return res.status(500).json({ error: error.message || 'Failed to retrieve repaired devices.' });
    }

    const rawList = Array.isArray(repairs) ? repairs : [];

    // 2. Lookup authoritative completion timestamps from RepairLog
    const completionDatesMap: Record<string, string> = {};
    const repairIds = rawList.map(r => r.id);

    if (repairIds.length > 0) {
      try {
        const { data: logs, error: logsError } = await supabaseAdmin
          .from('RepairLog')
          .select('repairId, status, createdAt')
          .in('repairId', repairIds)
          .in('status', REPAIRED_STATUS_LIST)
          .order('createdAt', { ascending: false });

        if (!logsError && Array.isArray(logs)) {
          for (const log of logs) {
            if (!completionDatesMap[log.repairId]) {
              completionDatesMap[log.repairId] = log.createdAt;
            }
          }
        }
      } catch (logErr) {
        console.warn('[REPAIR LOG LOOKUP WARN]', logErr);
      }
    }

    // 3. Filter by NPT bounds on actual completion date using strict half-open interval [startIso, endIso)
    const startMs = startIso ? new Date(startIso).getTime() : null;
    const endMs = endIso ? new Date(endIso).getTime() : null;

    const filtered = rawList.filter((repair) => {
      const compDate = completionDatesMap[repair.id] || repair.updatedAt || repair.createdAt;
      if (!compDate) {
        return validPreset === 'ALL';
      }

      if (startMs !== null || endMs !== null) {
        const compMs = new Date(compDate).getTime();
        if (startMs !== null && compMs < startMs) return false;
        if (endMs !== null && compMs >= endMs) return false; // Strict half-open: < endMs
      }

      return true;
    });

    // 4. Sort by completion date descending
    filtered.sort((a, b) => {
      const aComp = new Date(completionDatesMap[a.id] || a.updatedAt || a.createdAt).getTime();
      const bComp = new Date(completionDatesMap[b.id] || b.updatedAt || b.createdAt).getTime();
      return bComp - aComp;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const pagedItems = filtered.slice(offset, offset + limitNum);

    // Diagnostic logging without customer PII
    console.log(`[SMS CENTER REPAIRED DEVICES] Preset: ${validPreset}, Start: ${startIso || 'NONE'}, End: ${endIso || 'NONE'}, Status: REPAIRED, ResultCount: ${pagedItems.length}, Total: ${total}`);

    const items = pagedItems.map((repair) => {
      const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
      const summary = getRepairSmsSummary(repair.id);
      const isCourier = Boolean(repair.isCourierIn);
      const receivedDate = (isCourier && repair.courierReceivedDate ? repair.courierReceivedDate : repair.createdAt);
      const completedDate = completionDatesMap[repair.id] || repair.updatedAt;
      const suggestedMessage = generateRepairedDeviceSmsMessage(repair.repairNumber);

      return {
        id: repair.id,
        repairId: repair.id,
        repairNumber: repair.repairNumber,
        customerId: repair.customerId,
        customerName: repair.customerName,
        customerPhoneRaw: repair.customerPhone,
        customerPhone: phoneValidation.normalized || repair.customerPhone,
        phoneValidation,
        deviceBrand: repair.deviceBrand || '',
        deviceModel: repair.deviceModel || 'Device',
        problemDescription: repair.problemDescription || 'Inspection & Repair',
        status: repair.status,
        receivedDate,
        completedDate,
        smsSummary: summary,
        suggestedSms: suggestedMessage,
        suggestedWhatsApp: suggestedMessage,
      };
    });

    return res.json({
      success: true,
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      filter: {
        preset: validPreset,
        startIso,
        endIso,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/sms/devices/repaired ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve repaired devices.' });
  }
});

/**
 * 3.2 GET /api/sms/devices/received — Retrieve received devices filtered by date (NPT) and search
 * Roles: SUPER_ADMIN, ADMIN, RECEPTIONIST, MANAGER
 */
router.get('/devices/received', authenticate, authorize(SMS_VIEW_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const {
      preset = 'THIS_MONTH',
      startDate,
      endDate,
      search,
      page = '1',
      limit = '20',
      refDate: queryRefDate,
      referenceDate,
    } = req.query as {
      preset?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: string;
      limit?: string;
      refDate?: string;
      referenceDate?: string;
    };

    const rawPreset = (typeof preset === 'string' && preset.trim()) ? preset.trim().toUpperCase() : 'THIS_MONTH';
    const validPreset: DateFilterPreset = (['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'].includes(rawPreset)
      ? rawPreset
      : 'THIS_MONTH') as DateFilterPreset;

    const evaluationRefDate = (queryRefDate || referenceDate)
      ? new Date(String(queryRefDate || referenceDate))
      : new Date();

    const { startIso, endIso } = getNptIsoBoundsForPreset(validPreset, startDate, endDate, evaluationRefDate);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    let repairsMap = new Map<string, any>();

    if (startIso && endIso) {
      // 1. Database-side query by createdAt in [startIso, endIso)
      let standardQuery = supabaseAdmin
        .from('Repair')
        .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, problemDescription, status, priority, courierReceivedDate, isCourierIn, expectedCompletionDate, createdAt, updatedAt')
        .gte('createdAt', startIso)
        .lt('createdAt', endIso);

      if (search && search.trim()) {
        const term = search.trim();
        standardQuery = standardQuery.or(`repairNumber.ilike.%${term}%,customerName.ilike.%${term}%,customerPhone.ilike.%${term}%,deviceModel.ilike.%${term}%`);
      }

      const { data: regularRepairs, error: regError } = await standardQuery.order('createdAt', { ascending: false });
      if (regError) {
        console.error('[RECEIVED REGULAR QUERY ERROR]', regError);
      }
      if (Array.isArray(regularRepairs)) {
        for (const r of regularRepairs) {
          repairsMap.set(r.id, r);
        }
      }

      // 2. Query courier-in repairs where courierReceivedDate is in [startIso, endIso)
      let courierQuery = supabaseAdmin
        .from('Repair')
        .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, problemDescription, status, priority, courierReceivedDate, isCourierIn, expectedCompletionDate, createdAt, updatedAt')
        .eq('isCourierIn', true)
        .gte('courierReceivedDate', startIso)
        .lt('courierReceivedDate', endIso);

      if (search && search.trim()) {
        const term = search.trim();
        courierQuery = courierQuery.or(`repairNumber.ilike.%${term}%,customerName.ilike.%${term}%,customerPhone.ilike.%${term}%,deviceModel.ilike.%${term}%`);
      }

      const { data: courierRepairs, error: courError } = await courierQuery;
      if (Array.isArray(courierRepairs)) {
        for (const r of courierRepairs) {
          repairsMap.set(r.id, r);
        }
      }
    } else {
      // ALL preset: query all repairs
      let allQuery = supabaseAdmin
        .from('Repair')
        .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, problemDescription, status, priority, courierReceivedDate, isCourierIn, expectedCompletionDate, createdAt, updatedAt');

      if (search && search.trim()) {
        const term = search.trim();
        allQuery = allQuery.or(`repairNumber.ilike.%${term}%,customerName.ilike.%${term}%,customerPhone.ilike.%${term}%,deviceModel.ilike.%${term}%`);
      }

      const { data: allRepairs, error: allError } = await allQuery.order('createdAt', { ascending: false });
      if (allError) {
        console.error('[RECEIVED ALL QUERY ERROR]', allError);
        return res.status(500).json({ error: allError.message || 'Failed to retrieve received devices.' });
      }
      if (Array.isArray(allRepairs)) {
        for (const r of allRepairs) {
          repairsMap.set(r.id, r);
        }
      }
    }

    const rawList = Array.from(repairsMap.values());

    const startMs = startIso ? new Date(startIso).getTime() : null;
    const endMs = endIso ? new Date(endIso).getTime() : null;

    // Filter by NPT bounds on actual device received date (courierReceivedDate if courier, else createdAt)
    // with strict half-open interval: recMs >= startMs && recMs < endMs
    const filtered = rawList.filter((repair) => {
      const isCourier = Boolean(repair.isCourierIn);
      const receivedDate = (isCourier && repair.courierReceivedDate ? repair.courierReceivedDate : repair.createdAt);
      if (!receivedDate) return true;
      if (startMs !== null || endMs !== null) {
        const recMs = new Date(receivedDate).getTime();
        if (startMs !== null && recMs < startMs) return false;
        if (endMs !== null && recMs >= endMs) return false; // Strict half-open: < endMs
      }
      return true;
    });

    filtered.sort((a, b) => {
      const aDate = new Date(a.isCourierIn && a.courierReceivedDate ? a.courierReceivedDate : a.createdAt).getTime();
      const bDate = new Date(b.isCourierIn && b.courierReceivedDate ? b.courierReceivedDate : b.createdAt).getTime();
      return bDate - aDate;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const pagedItems = filtered.slice(offset, offset + limitNum);

    const items = pagedItems.map((repair) => {
      const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
      const summary = getRepairSmsSummary(repair.id);
      const isCourier = Boolean(repair.isCourierIn);
      const receivedDate = (isCourier && repair.courierReceivedDate ? repair.courierReceivedDate : repair.createdAt);
      const suggestedMessage = generateReceivedDeviceSmsMessage(repair.repairNumber);

      return {
        id: repair.id,
        repairId: repair.id,
        repairNumber: repair.repairNumber,
        customerId: repair.customerId,
        customerName: repair.customerName,
        customerPhoneRaw: repair.customerPhone,
        customerPhone: phoneValidation.normalized || repair.customerPhone,
        phoneValidation,
        deviceBrand: repair.deviceBrand || '',
        deviceModel: repair.deviceModel || 'Device',
        problemDescription: repair.problemDescription || 'Inspection & Repair',
        status: repair.status,
        receivedDate,
        smsSummary: summary,
        suggestedSms: suggestedMessage,
        suggestedWhatsApp: suggestedMessage,
      };
    });

    return res.json({
      success: true,
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      filter: {
        preset: validPreset,
        startIso,
        endIso,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/sms/devices/received ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve received devices.' });
  }
});

/**
 * 4. GET /api/sms/repair/:id — SMS status, validation & history for a specific repair
 * Roles: SUPER_ADMIN, ADMIN, MANAGER, RECEPTIONIST
 */
router.get('/repair/:id', authenticate, authorize(SMS_VIEW_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: repair, error } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, status, priority, expectedCompletionDate, createdAt, updatedAt')
      .or(`id.eq.${id},repairNumber.eq.${id}`)
      .single();

    if (error || !repair) {
      return res.status(404).json({ error: 'Repair ticket not found.' });
    }

    const eligible = isRepairedStatusEligible(repair.status);
    const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
    const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair.deviceModel || ''}`.trim();
    const defaultMessage = generateRepairCompletedSmsMessage({
      customerName: repair.customerName,
      deviceModel: deviceModelFull,
      repairNumber: repair.repairNumber,
    });

    const encodingAnalysis = analyzeSmsEncodingServer(defaultMessage);
    const history = getSmsNotificationsForRepair(repair.id);
    const smsSummary = getRepairSmsSummary(repair.id);

    // Deep link URLs for Windows Phone Link, SMS URI and WhatsApp
    const smsProtocolUrl = phoneValidation.isValid
      ? `sms:${phoneValidation.international}?body=${encodeURIComponent(defaultMessage)}`
      : null;

    const whatsappUrl = phoneValidation.isValid
      ? `https://wa.me/${phoneValidation.whatsappPhone}?text=${encodeURIComponent(defaultMessage)}`
      : null;

    return res.json({
      success: true,
      eligible,
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerName: repair.customerName,
      deviceModel: deviceModelFull,
      customerPhoneRaw: repair.customerPhone,
      phoneValidation,
      defaultMessage,
      encodingAnalysis,
      history,
      smsSummary,
      smsProtocolUrl,
      whatsappUrl,
    });
  } catch (err: any) {
    console.error('[GET /api/sms/repair/:id ERROR]', err);
    return res.status(500).json({ error: 'Failed to inspect repair notification status.' });
  }
});

/**
 * 5. POST /api/sms/prepare — Prepare draft notification for a repaired device
 * STRICT RBAC: SUPER_ADMIN, ADMIN, RECEPTIONIST. MANAGER is strictly blocked!
 */
router.post('/prepare', authenticate, authorize(SMS_SEND_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { repairId } = req.body;
    if (!repairId) {
      return res.status(400).json({ error: 'repairId is required.' });
    }

    const { data: repair } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .or(`id.eq.${repairId},repairNumber.eq.${repairId}`)
      .single();

    if (!repair) {
      return res.status(404).json({ error: 'Repair ticket not found.' });
    }

    if (!isRepairedStatusEligible(repair.status)) {
      return res.status(400).json({
        error: `Customer completed SMS can only be prepared for repairs with status REPAIRED or READY FOR PICKUP. Current: ${repair.status}`,
      });
    }

    const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair.deviceModel || ''}`.trim();

    const record = await prepareOrGetPendingNotification({
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerId: repair.customerId || null,
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      deviceModel: deviceModelFull,
      deviceBrand: repair.deviceBrand || null,
      staffId: req.user!.id,
      staffName: req.user!.name || 'Staff',
      staffRole: req.user!.role,
    });

    return res.json({
      success: true,
      record,
      smsSummary: getRepairSmsSummary(repair.id),
    });
  } catch (err: any) {
    console.error('[POST /api/sms/prepare ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to prepare SMS notification.' });
  }
});

/**
 * 6. POST /api/sms/open — Triggered when staff clicks "Send via Phone Link", "Send via WhatsApp", or "Send via SMS"
 * Marks notification as OPENED with target channel.
 * STRICT RBAC: SUPER_ADMIN, ADMIN, RECEPTIONIST. MANAGER is strictly blocked!
 */
router.post('/open', authenticate, authorize(SMS_SEND_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const {
      repairId,
      smsRecordId,
      customMessage,
      channel = 'WINDOWS_PHONE_LINK',
      notificationType = 'REPAIR_COMPLETED',
    } = req.body;

    if (!repairId && !smsRecordId) {
      return res.status(400).json({ error: 'repairId or smsRecordId is required.' });
    }

    const { data: repair } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .or(`id.eq.${repairId},repairNumber.eq.${repairId}`)
      .single();

    if (!repair) {
      return res.status(404).json({ error: 'Repair ticket not found.' });
    }

    // Phone validation
    const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        error: phoneValidation.error || 'Invalid customer phone number.',
        phoneValidation,
      });
    }

    // Generate standard message based on notificationType if customMessage not provided
    const isReceivedNotification = notificationType === 'DEVICE_RECEIVED';
    const finalMessage = customMessage && typeof customMessage === 'string' && customMessage.trim()
      ? customMessage.trim()
      : isReceivedNotification
      ? generateReceivedDeviceSmsMessage(repair.repairNumber)
      : generateRepairedDeviceSmsMessage(repair.repairNumber);

    const encodingInfo = analyzeSmsEncodingServer(finalMessage);
    if (!encodingInfo.isSingleSegment) {
      return res.status(400).json({
        error: `Message exceeds single-segment SMS limit (${encodingInfo.septetCount}/${encodingInfo.maxUnitsSingleSegment} units). Please shorten before sending.`,
        encodingInfo,
      });
    }

    const nowIso = new Date().toISOString();
    let record: SmsNotificationRecord | null = null;

    if (smsRecordId) {
      record = await updateSmsNotification(smsRecordId, {
        status: 'OPENED',
        channel: channel as SmsNotificationChannel,
        openedAt: nowIso,
        messageContent: finalMessage,
      });
    }

    const calculatedMessageType = isReceivedNotification
      ? (channel === 'WHATSAPP' ? 'DEVICE_RECEIVED_WHATSAPP' : 'DEVICE_RECEIVED_SMS')
      : (channel === 'WHATSAPP' ? 'REPAIR_COMPLETED_WHATSAPP' : 'REPAIR_COMPLETED_SMS');

    if (!record) {
      // Find existing prepared draft
      const history = getSmsNotificationsForRepair(repair.id);
      const draft = history.find(
        (h) => h.status === 'PREPARED' || h.status === 'OPENED' || h.status === 'READY_TO_SEND' || h.status === 'INITIATED'
      );

      if (draft) {
        record = await updateSmsNotification(draft.id, {
          status: 'OPENED',
          channel: channel as SmsNotificationChannel,
          openedAt: nowIso,
          messageContent: finalMessage,
        });
      } else {
        const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair.deviceModel || ''}`.trim();
        record = await recordSmsNotification({
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          customerId: repair.customerId || null,
          customerName: repair.customerName,
          customerPhoneRaw: repair.customerPhone,
          customerPhoneNormalized: phoneValidation.normalized,
          customerPhoneInternational: phoneValidation.international,
          deviceModel: deviceModelFull,
          deviceBrand: repair.deviceBrand || null,
          messageType: calculatedMessageType,
          messageContent: finalMessage,
          status: 'OPENED',
          channel: channel as SmsNotificationChannel,
          senderStaffId: req.user!.id,
          senderStaffName: req.user!.name || 'Staff',
          senderStaffRole: req.user!.role,
          notes: `Messaging opened via ${channel} (${notificationType}) by ${req.user!.name}`,
          initiatedAt: nowIso,
          openedAt: nowIso,
        });
      }
    }

    const smsProtocolUrl = `sms:${phoneValidation.international}?body=${encodeURIComponent(finalMessage)}`;
    const whatsappUrl = `https://wa.me/${phoneValidation.whatsappPhone}?text=${encodeURIComponent(finalMessage)}`;

    return res.json({
      success: true,
      message: 'Messaging application opened. Awaiting staff confirmation.',
      record,
      smsSummary: getRepairSmsSummary(repair.id),
      smsProtocolUrl,
      whatsappUrl,
    });
  } catch (err: any) {
    console.error('[POST /api/sms/open ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to open messaging workflow.' });
  }
});

/**
 * 7. POST /api/sms/confirm — Explicit staff confirmation after sending
 * STRICT RBAC: SUPER_ADMIN, ADMIN, RECEPTIONIST. MANAGER is strictly blocked!
 */
router.post('/confirm', authenticate, authorize(SMS_SEND_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const {
      smsRecordId,
      repairId,
      status = 'STAFF_CONFIRMED_SENT', // 'STAFF_CONFIRMED_SENT' | 'FAILED' | 'CANCELLED'
      failureReason,
      notes,
    } = req.body;

    if (!smsRecordId && !repairId) {
      return res.status(400).json({ error: 'smsRecordId or repairId is required.' });
    }

    let recordId = smsRecordId;
    let targetRepairId = repairId;

    if (!recordId && targetRepairId) {
      const history = getSmsNotificationsForRepair(targetRepairId);
      const active = history.find(
        (h) => h.status === 'OPENED' || h.status === 'PREPARED' || h.status === 'INITIATED'
      );
      if (active) {
        recordId = active.id;
      }
    }

    if (!recordId) {
      return res.status(404).json({ error: 'No active notification record found to confirm.' });
    }

    const nowIso = new Date().toISOString();
    const isSent = status === 'STAFF_CONFIRMED_SENT';
    const isFailed = status === 'FAILED';

    const updated = await updateSmsNotification(recordId, {
      status: isSent
        ? 'STAFF_CONFIRMED_SENT'
        : isFailed
        ? 'FAILED'
        : 'CANCELLED',
      sentAt: isSent ? nowIso : undefined,
      confirmedAt: isSent ? nowIso : undefined,
      failedAt: isFailed ? nowIso : undefined,
      failureReason: isFailed ? (failureReason || 'Staff reported failed') : undefined,
      notes: notes || undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Notification record could not be updated.' });
    }

    // Append to repair log for traceability
    const logId = uuidv4();
    try {
      const channelLabel =
        updated.channel === 'WHATSAPP'
          ? 'WhatsApp'
          : updated.channel === 'WINDOWS_PHONE_LINK'
          ? 'Windows Phone Link'
          : updated.channel === 'SMS_PROTOCOL'
          ? 'SMS Protocol'
          : 'SMS';

      await supabaseAdmin.from('RepairLog').insert([
        {
          id: logId,
          repairId: updated.repairId,
          status: 'REPAIRED',
          message: isSent
            ? `Customer notification confirmed sent via ${channelLabel} to ${updated.customerPhoneNormalized} by ${req.user!.name} (${req.user!.role}).`
            : `Customer notification via ${channelLabel} marked as ${status}: ${failureReason || 'No reason provided'} by ${req.user!.name} (${req.user!.role}).`,
          createdAt: nowIso,
        },
      ]);
      await broadcastServerChange('RepairLog', 'CREATE', logId);
    } catch (_) {}

    await logAudit({
      userId: req.user!.id,
      action: isSent ? 'SMS_NOTIFICATION_CONFIRMED_SENT' : 'SMS_NOTIFICATION_STATUS_UPDATE',
      resource: 'Repair',
      resourceId: updated.repairId,
      details: {
        repairNumber: updated.repairNumber,
        customerName: updated.customerName,
        phone: updated.customerPhoneNormalized,
        channel: updated.channel,
        status: updated.status,
        failureReason: updated.failureReason,
      },
    });

    await broadcastServerChange('Repair', 'UPDATE', updated.repairId);

    return res.json({
      success: true,
      message: isSent ? 'Notification confirmed sent successfully.' : `Notification marked as ${status}.`,
      record: updated,
      smsSummary: getRepairSmsSummary(updated.repairId),
    });
  } catch (err: any) {
    console.error('[POST /api/sms/confirm ERROR]', err);
    return res.status(500).json({ error: 'Failed to confirm SMS notification.' });
  }
});

/**
 * 8. POST /api/sms/resend — Resend / Retry a notification without overwriting historical log
 * STRICT RBAC: SUPER_ADMIN, ADMIN, RECEPTIONIST. MANAGER is strictly blocked!
 */
router.post('/resend', authenticate, authorize(SMS_SEND_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { repairId, customMessage, channel = 'WINDOWS_PHONE_LINK', notes } = req.body;
    if (!repairId) {
      return res.status(400).json({ error: 'repairId is required.' });
    }

    const { data: repair } = await supabaseAdmin
      .from('Repair')
      .select('*')
      .or(`id.eq.${repairId},repairNumber.eq.${repairId}`)
      .single();

    if (!repair) {
      return res.status(404).json({ error: 'Repair ticket not found.' });
    }

    const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ error: phoneValidation.error || 'Invalid phone number.' });
    }

    const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair.deviceModel || ''}`.trim();
    const finalMessage = customMessage && typeof customMessage === 'string' && customMessage.trim()
      ? customMessage.trim()
      : generateRepairCompletedSmsMessage({
          customerName: repair.customerName,
          deviceModel: deviceModelFull,
          repairNumber: repair.repairNumber,
        });

    const encodingInfo = analyzeSmsEncodingServer(finalMessage);
    if (!encodingInfo.isSingleSegment) {
      return res.status(400).json({
        error: `Message exceeds single-segment limit (${encodingInfo.unitsUsed}/${encodingInfo.maxUnitsSingleSegment}).`,
      });
    }

    const nowIso = new Date().toISOString();
    const existingHistory = getSmsNotificationsForRepair(repair.id);
    const retryCount = existingHistory.length;

    const record = await recordSmsNotification({
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerId: repair.customerId || null,
      customerName: repair.customerName,
      customerPhoneRaw: repair.customerPhone,
      customerPhoneNormalized: phoneValidation.normalized,
      customerPhoneInternational: phoneValidation.international,
      deviceModel: deviceModelFull,
      deviceBrand: repair.deviceBrand || null,
      messageType: channel === 'WHATSAPP' ? 'REPAIR_COMPLETED_WHATSAPP' : 'REPAIR_COMPLETED_SMS',
      messageContent: finalMessage,
      status: 'OPENED',
      channel: channel as SmsNotificationChannel,
      senderStaffId: req.user!.id,
      senderStaffName: req.user!.name || 'Staff',
      senderStaffRole: req.user!.role,
      notes: notes || `Retry attempt #${retryCount + 1}`,
      retryCount: retryCount + 1,
      initiatedAt: nowIso,
      openedAt: nowIso,
    });

    const smsProtocolUrl = `sms:${phoneValidation.international}?body=${encodeURIComponent(finalMessage)}`;
    const whatsappUrl = `https://wa.me/${phoneValidation.whatsappPhone}?text=${encodeURIComponent(finalMessage)}`;

    return res.status(201).json({
      success: true,
      message: 'New notification attempt created and opened.',
      record,
      smsSummary: getRepairSmsSummary(repair.id),
      smsProtocolUrl,
      whatsappUrl,
    });
  } catch (err: any) {
    console.error('[POST /api/sms/resend ERROR]', err);
    return res.status(500).json({ error: err.message || 'Failed to resend SMS.' });
  }
});

export default router;
