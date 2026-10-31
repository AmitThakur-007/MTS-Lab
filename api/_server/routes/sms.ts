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

    if (filterPreset && !startDate && !endDate) {
      const now = new Date();
      if (filterPreset === 'TODAY') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        computedStartDate = start.toISOString();
      } else if (filterPreset === 'YESTERDAY') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        computedStartDate = start.toISOString();
        computedEndDate = end.toISOString();
      } else if (filterPreset === 'LAST_7_DAYS') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        computedStartDate = start.toISOString();
      } else if (filterPreset === 'LAST_30_DAYS') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        computedStartDate = start.toISOString();
      } else if (filterPreset === 'THIS_MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        computedStartDate = start.toISOString();
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
      .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, status, priority, completedAt, createdAt, updatedAt')
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
        completedAt: repair.completedAt || repair.updatedAt,
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
 * 4. GET /api/sms/repair/:id — SMS status, validation & history for a specific repair
 * Roles: SUPER_ADMIN, ADMIN, MANAGER, RECEPTIONIST
 */
router.get('/repair/:id', authenticate, authorize(SMS_VIEW_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: repair, error } = await supabaseAdmin
      .from('Repair')
      .select('id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, status, priority, estimatedCompletionDate, completedAt')
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

    // Analyze message encoding & single-segment limit
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
          messageType: channel === 'WHATSAPP' ? 'REPAIR_COMPLETED_WHATSAPP' : 'REPAIR_COMPLETED_SMS',
          messageContent: finalMessage,
          status: 'OPENED',
          channel: channel as SmsNotificationChannel,
          senderStaffId: req.user!.id,
          senderStaffName: req.user!.name || 'Staff',
          senderStaffRole: req.user!.role,
          notes: `Messaging opened via ${channel} by ${req.user!.name}`,
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
