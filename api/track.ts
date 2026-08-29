import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

const supabase = createClient(supabaseUrl, supabaseAdminKey);

export default async function handler(req: Request, res: Response) {
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

        let query = supabase.from('Repair').select(`
      id,
      repairNumber,
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
      createdAt,
      updatedAt,
      completedAt,
      deliveredAt
    `);

        if (cleanRepairNumber && cleanPhone) {
            query = query.ilike('repairNumber', `%${cleanRepairNumber}%`).ilike('customerPhone', `%${cleanPhone}%`);
        } else if (cleanRepairNumber) {
            query = query.ilike('repairNumber', `%${cleanRepairNumber}%`);
        } else if (cleanPhone) {
            query = query.ilike('customerPhone', `%${cleanPhone}%`);
        }

        const { data: repairs, error } = await query.order('createdAt', { ascending: false }).limit(5);

        if (error) {
            console.error('[SUPABASE QUERY ERROR]', error);
            return res.status(500).json({ error: error.message || 'Database query failed.' });
        }

        if (!repairs || repairs.length === 0) {
            return res.status(404).json({ error: 'No repair records found matching your tracking information.' });
        }

        const sanitized = repairs.map((r: any) => ({
            ...r,
            customerName: r.customerName ? `${r.customerName.charAt(0)}*** ${r.customerName.split(' ').slice(-1)[0] || ''}` : 'Customer',
        }));

        return res.json(sanitized.length === 1 ? sanitized[0] : { devices: sanitized, customer: { name: sanitized[0].customerName } });
    } catch (err: any) {
        console.error('[TRACK FUNCTION EXCEPTION]', err);
        return res.status(500).json({ error: err?.message || 'Server error tracking repair.' });
    }
}