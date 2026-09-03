import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const PRODUCTION_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const supabaseUrl = (!rawUrl || rawUrl.includes('your-project') || rawUrl.includes('example.com') || !rawUrl.startsWith('http'))
  ? PRODUCTION_SUPABASE_URL
  : rawUrl;

const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabaseKey = (!rawKey || rawKey.includes('...') || rawKey.length < 50)
  ? PRODUCTION_SUPABASE_ANON_KEY
  : rawKey;

const supabaseAdminKey = (process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('...') && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50)
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : supabaseKey;

const supabase = createClient(supabaseUrl, supabaseAdminKey);

// Helper functions for phone verification & IDOR prevention
function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function isPhoneMatching(providedPhoneDigits: string, recordPhone?: string | null): boolean {
  if (!providedPhoneDigits || !recordPhone) return false;
  const dbDigits = normalizePhoneDigits(recordPhone);
  if (!dbDigits) return false;

  if (providedPhoneDigits === dbDigits) return true;

  const p10 = providedPhoneDigits.length >= 10 ? providedPhoneDigits.slice(-10) : providedPhoneDigits;
  const db10 = dbDigits.length >= 10 ? dbDigits.slice(-10) : dbDigits;
  if (p10 === db10) return true;

  if (providedPhoneDigits.length >= 7 && dbDigits.length >= 7) {
    if (providedPhoneDigits.slice(-7) === dbDigits.slice(-7)) return true;
  }

  return false;
}

export default async function handler(req: Request, res: Response) {
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
    const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || '';
    const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || '';

    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, '').trim();
    const cleanPhone = normalizePhoneDigits(String(rawPhone));
    const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: 'Please enter your Repair Number or Registered Phone Number.' });
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
      const { data: directMatches } = await supabase
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
      return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
    }

    const primaryRepair = allMatchingRepairs[0];

    const allRepairIds = allMatchingRepairs.map((r) => r.id);
    const { data: allExplicitLogs } = await supabase
      .from('RepairLog')
      .select('id, repairId, status, message, createdAt')
      .in('repairId', allRepairIds)
      .order('createdAt', { ascending: false });

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

      if (st === 'REPAIRED' || st.includes('WARRANTY_FIXED') || st.includes('REPROBLEM_FIXED')) {
        return 'The technical repair was successfully completed and the device passed the required quality verification.';
      }
      if (st.includes('READY') || st.includes('PICKUP')) {
        return 'The repaired device is sanitized, packaged, and ready for customer pickup.';
      }
      if (st.includes('COURIER') || st.includes('DISPATCH')) {
        return 'The repaired device was safely packed and dispatched via courier logistics.';
      }
      if (st.includes('DELIVERED') || st.includes('COMPLETED')) {
        return 'The device was handed over to the customer when the actual status reaches Delivered.';
      }
      if (st.includes('TEST') || st.includes('QA')) {
        if (isRepairedOrBeyond) {
          return 'The repaired device underwent quality verification/testing.';
        }
        return 'The repaired device is undergoing comprehensive quality verification and calibration.';
      }
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
      if (st.includes('DIAGNOSING')) {
        return 'The device was inspected/diagnosed to identify the reported issue.';
      }
      if (st.includes('RECEIVED') || st.includes('CREATED')) {
        return 'The device was received by MTS Lab for repair.';
      }
      if (st.includes('PENDING')) {
        return 'Your device is cataloged in the service queue awaiting laboratory intake and diagnosis.';
      }
      if (st.includes('RE_PROBLEM') || st.includes('REPROBLEM')) {
        return 'Device received for priority diagnostic re-evaluation.';
      }
      if (st.includes('CANCEL')) {
        return 'Repair service request closed.';
      }
      if (st.includes('CANNOT')) {
        return 'Catastrophic hardware damage exceeds viable safe restoration standards.';
      }
      return 'Device status updated to reflect laboratory progress.';
    };

    const buildLogsForRepair = (rep: any) => {
      const repLogs = (allExplicitLogs || []).filter((l: any) => l.repairId === rep.id);
      let list = repLogs.map((l: any) => {
        const desc = getCustomerLogDesc(l.status, rep.status);
        return {
          id: l.id,
          action: 'STATUS_UPDATED',
          status: l.status || rep.status || 'RECEIVED',
          notes: desc,
          message: desc,
        };
      });

      if (list.length === 0) {
        const desc = getCustomerLogDesc(rep.status, rep.status);
        list = [
          {
            id: `synth-${rep.id}`,
            action: 'STATUS_UPDATED',
            status: rep.status || 'RECEIVED',
            notes: desc,
            message: desc,
          },
        ];
      }
      return list;
    };

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
    const sanitizedAll = allMatchingRepairs.map((rep) => sanitizePublicRepairObj(rep));

    return res.json({
      success: true,
      repair: sanitizedPrimary,
      repairs: sanitizedAll,
      devices: sanitizedAll,
      ...sanitizedPrimary
    });
  } catch (err: any) {
    console.error('[TRACK FUNCTION EXCEPTION]', err);
    return res.status(500).json({ error: err?.message || 'Server error tracking repair.' });
  }
}
