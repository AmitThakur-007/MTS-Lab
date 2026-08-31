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

        // Select only standard verified columns
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
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      createdAt,
      updatedAt
    `;

        let query = supabase.from('Repair').select(selectFields);

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