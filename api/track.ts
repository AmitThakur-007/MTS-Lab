import { Request, Response } from 'express';
import { supabaseAdmin } from './_server/config/supabase';

export default async function handler(req: Request, res: Response) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || '';
        const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || '';

        const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, '').trim();
        const cleanPhone = String(rawPhone).trim().replace(/\D/g, '');

        if (!cleanRepairNumber && !cleanPhone) {
            return res.status(400).json({ error: 'Please enter a Repair Job Number or Registered Phone Number.' });
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
      status,
      priority,
      expectedCompletionDate,
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      isCourierIn,
      isCourierOut,
      courierStatus,
      courierCompany,
      returnCourierCompany,
      returnCourierTrackingNumber,
      hasBatteryWarranty,
      batteryWarrantyPeriod,
      batteryType,
      createdAt,
      updatedAt,
      completedAt,
      deliveredAt,
      logs:RepairLog(action, status, notes, createdAt)
    `;

        let repairRecord: any = null;

        if (cleanRepairNumber) {
            const { data } = await supabaseAdmin
                .from('Repair')
                .select(selectFields)
                .or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`)
                .order('createdAt', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) repairRecord = data;
        }

        if (!repairRecord && cleanPhone) {
            const { data: directMatch } = await supabaseAdmin
                .from('Repair')
                .select(selectFields)
                .ilike('customerPhone', `%${cleanPhone}%`)
                .order('createdAt', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (directMatch) {
                repairRecord = directMatch;
            } else {
                const { data: customerData } = await supabaseAdmin
                    .from('Customer')
                    .select('id')
                    .ilike('phone', `%${cleanPhone}%`)
                    .limit(1)
                    .maybeSingle();

                if (customerData) {
                    const { data: customerRepair } = await supabaseAdmin
                        .from('Repair')
                        .select(selectFields)
                        .eq('customerId', customerData.id)
                        .order('createdAt', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (customerRepair) repairRecord = customerRepair;
                }
            }
        }

        if (!repairRecord) {
            return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
        }

        const sanitizedName = repairRecord.customerName
            ? `${repairRecord.customerName.charAt(0)}*** ${repairRecord.customerName.split(' ').slice(-1)[0] || ''}`.trim()
            : 'Customer';

        const sanitizedRecord = {
            ...repairRecord,
            customerName: sanitizedName,
            customerPhone: cleanPhone ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` : undefined,
        };

        return res.json({
            success: true,
            repair: sanitizedRecord,
            ...sanitizedRecord
        });
    } catch (err: any) {
        console.error('[PUBLIC TRACK EXCEPTION]', err);
        return res.status(500).json({ error: 'Failed to retrieve tracking details.' });
    }
}