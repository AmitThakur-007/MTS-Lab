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

    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: 'Please enter your Repair Number or Registered Phone Number.' });
    }

    const selectFields = `
      id,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
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
      batteryWarrantyExpiry,
      remarks,
      createdAt,
      updatedAt,
      completedAt,
      deliveredAt
    `;

    let repairRecord: any = null;

    // Case 1: Customer provided BOTH Repair Number AND Phone Number
    // PREVENT IDOR: Both must match the same repair/customer.
    if (cleanRepairNumber && cleanPhone) {
      const { data: candidates, error: cErr } = await supabase
        .from('Repair')
        .select(selectFields)
        .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
        .order('createdAt', { ascending: false })
        .limit(5);

      if (cErr) {
        console.error('[PUBLIC TRACK CANDIDATE ERROR]', cErr);
      }

      if (candidates && candidates.length > 0) {
        for (const cand of candidates) {
          if (isPhoneMatching(cleanPhone, cand.customerPhone)) {
            repairRecord = cand;
            break;
          }
          if (cand.customerId) {
            const { data: linkedCustomer } = await supabase
              .from('Customer')
              .select('phone, alternativePhone')
              .eq('id', cand.customerId)
              .maybeSingle();

            if (
              linkedCustomer &&
              (isPhoneMatching(cleanPhone, linkedCustomer.phone) || isPhoneMatching(cleanPhone, linkedCustomer.alternativePhone))
            ) {
              repairRecord = cand;
              break;
            }
          }
        }
      }

      if (!repairRecord) {
        return res.status(404).json({
          error: 'No repair records found matching the provided Repair Number and Phone Number.'
        });
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
        repairRecord = singleRepair;
      }
    }
    // Case 3: Customer provided ONLY Phone Number
    else if (cleanPhone) {
      const { data: directMatches } = await supabase
        .from('Repair')
        .select(selectFields)
        .order('createdAt', { ascending: false })
        .limit(20);

      if (directMatches && directMatches.length > 0) {
        const matched = directMatches.filter((r) => isPhoneMatching(cleanPhone, r.customerPhone));
        if (matched.length > 0) {
          repairRecord = matched[0];
        }
      }

      if (!repairRecord) {
        const { data: customers } = await supabase
          .from('Customer')
          .select('id, phone, alternativePhone')
          .limit(50);

        const matchedCustomer = customers?.find(
          (c) => isPhoneMatching(cleanPhone, c.phone) || isPhoneMatching(cleanPhone, c.alternativePhone)
        );

        if (matchedCustomer) {
          const { data: customerRepair } = await supabase
            .from('Repair')
            .select(selectFields)
            .eq('customerId', matchedCustomer.id)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (customerRepair) {
            repairRecord = customerRepair;
          }
        }
      }
    }

    if (!repairRecord) {
      return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
    }

    // Query RepairLog
    const { data: explicitLogs } = await supabase
      .from('RepairLog')
      .select('id, action, status, notes, message, createdAt')
      .eq('repairId', repairRecord.id)
      .order('createdAt', { ascending: false });

    let combinedLogs = explicitLogs || [];
    if (combinedLogs.length === 0) {
      combinedLogs = [
        {
          id: `synth-${repairRecord.id}`,
          action: 'STATUS_UPDATED',
          status: repairRecord.status || 'RECEIVED',
          notes: `Device registered and currently recorded as ${repairRecord.status || 'RECEIVED'}.`,
          message: `Device status: ${repairRecord.status || 'RECEIVED'}`,
          createdAt: repairRecord.createdAt || new Date().toISOString()
        }
      ];
    }

    repairRecord.logs = combinedLogs;

    if (repairRecord.logs && Array.isArray(repairRecord.logs)) {
      repairRecord.logs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const rawName = repairRecord.customerName || '';
    const sanitizedName = rawName
      ? `${rawName.charAt(0)}*** ${rawName.split(' ').slice(-1)[0] || ''}`.trim()
      : 'Valued Customer';

    const pDigits = normalizePhoneDigits(repairRecord.customerPhone || cleanPhone);
    const sanitizedPhone = pDigits && pDigits.length >= 6
      ? `${pDigits.slice(0, 3)}****${pDigits.slice(-3)}`
      : undefined;

    const sanitizedRecord = {
      ...repairRecord,
      customerName: sanitizedName,
      customerPhone: sanitizedPhone,
    };

    return res.json({
      success: true,
      repair: sanitizedRecord,
      ...sanitizedRecord
    });
  } catch (err: any) {
    console.error('[TRACK FUNCTION EXCEPTION]', err);
    return res.status(500).json({ error: err?.message || 'Server error tracking repair.' });
  }
}
