import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createExcelBuffer, parseExcelBuffer } from '../services/excelService';
import { sendEmail } from '../services/emailService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper to generate next unique warranty number (BW-YYYY-XXXX)
async function generateWarrantyNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: records } = await supabaseAdmin
    .from('BatteryWarranty')
    .select('warrantyNumber')
    .ilike('warrantyNumber', `BW-${currentYear}-%`)
    .order('warrantyNumber', { ascending: false })
    .limit(10);

  let maxNum = 0;
  if (records && records.length > 0) {
    for (const r of records) {
      if (!r.warrantyNumber) continue;
      const match = r.warrantyNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `BW-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

// Helper to generate claim number (BWC-YYYY-XXXX)
async function generateClaimNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const { data: records } = await supabaseAdmin
    .from('BatteryWarrantyClaim')
    .select('claimNumber')
    .ilike('claimNumber', `BWC-${currentYear}-%`)
    .order('claimNumber', { ascending: false })
    .limit(10);

  let maxNum = 0;
  if (records && records.length > 0) {
    for (const r of records) {
      if (!r.claimNumber) continue;
      const match = r.claimNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `BWC-${currentYear}-${nextNum.toString().padStart(4, '0')}`;
}

// 1. GET /api/battery-warranties
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, brand, search, startDate, endDate } = req.query;

    let query = supabaseAdmin.from('BatteryWarranty').select('*');

    if (status && status !== 'ALL') {
      query = query.eq('status', String(status));
    }

    if (brand && brand !== 'ALL') {
      query = query.eq('deviceBrand', String(brand));
    }

    if (startDate) {
      query = query.gte('registrationDate', String(startDate));
    }

    if (endDate) {
      query = query.lte('registrationDate', String(endDate));
    }

    if (search) {
      const s = String(search).trim();
      query = query.or(`warrantyNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%,deviceModel.ilike.%${s}%,imeiNumber.ilike.%${s}%`);
    }

    const { data: warranties, error } = await query.order('createdAt', { ascending: false });

    if (error) {
      console.error('[BATTERY WARRANTIES ERROR]', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch battery warranties.' });
    }

    // Fetch claims safely
    const { data: allClaims } = await supabaseAdmin.from('BatteryWarrantyClaim').select('*');

    const combined = (warranties || []).map((w: any) => ({
      ...w,
      claims: (allClaims || []).filter((c: any) => c.warrantyId === w.id),
    }));

    return res.json(combined);
  } catch (err: any) {
    console.error('[BATTERY WARRANTIES EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to load warranties.' });
  }
});

// 2. GET /api/battery-warranties/export
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;
    let query = supabaseAdmin.from('BatteryWarranty').select('*');
    if (status && status !== 'ALL') query = query.eq('status', String(status));

    const { data: warranties } = await query.order('createdAt', { ascending: false });

    const rows = (warranties || []).map((w: any) => ({
      'Warranty Number': w.warrantyNumber,
      'Customer Name': w.customerName,
      'Phone': w.customerPhone,
      'Email': w.customerEmail || '—',
      'Device Model': `${w.deviceBrand} ${w.deviceModel}`,
      'IMEI': w.imeiNumber || '—',
      'Battery Type': w.batteryType || 'Original OEM',
      'Warranty Period': w.warrantyPeriod || '6 Months',
      'Registration Date': w.registrationDate ? new Date(w.registrationDate).toISOString().split('T')[0] : '',
      'Expiry Date': w.expiryDate ? new Date(w.expiryDate).toISOString().split('T')[0] : '',
      'Status': w.status,
      'Claims Count': w.claimCount || 0,
    }));

    const buffer = createExcelBuffer('Battery Warranties', rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Battery_Warranties_${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export battery warranties.' });
  }
});

// 3. GET /api/battery-warranties/import/template
router.get('/import/template', authenticate, (req: Request, res: Response) => {
  const sample = [
    {
      'Customer Name': 'Hari Sharma',
      'Customer Phone': '9801234567',
      'Customer Email': 'hari@example.com',
      'Customer Address': 'Patan, Lalitpur',
      'Device Brand': 'Apple',
      'Device Model': 'iPhone 12',
      'IMEI Number': '356891029384756',
      'Battery Type': 'Original High Capacity 2815mAh',
      'Warranty Months': 6,
    },
  ];

  const buffer = createExcelBuffer('Warranty Template', sample);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="MTS_Lab_Battery_Warranty_Template.xlsx"');
  return res.send(buffer);
});

// 4. POST /api/battery-warranties/import/preview
router.post('/import/preview', authenticate, upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No Excel file provided.' });
    const rows = parseExcelBuffer(req.file.buffer);

    const parsed = rows.map((r, idx) => ({
      rowIndex: idx + 1,
      customerName: r['Customer Name'] || r['customerName'] || '',
      customerPhone: r['Customer Phone'] || r['customerPhone'] || '',
      customerEmail: r['Customer Email'] || r['customerEmail'] || '',
      customerAddress: r['Customer Address'] || r['customerAddress'] || '',
      deviceBrand: r['Device Brand'] || r['deviceBrand'] || 'Apple',
      deviceModel: r['Device Model'] || r['deviceModel'] || '',
      imeiNumber: r['IMEI Number'] || r['imeiNumber'] || '',
      batteryType: r['Battery Type'] || r['batteryType'] || 'Standard',
      warrantyPeriod: `${r['Warranty Months'] || 6} Months`,
      isValid: Boolean((r['Customer Name'] || r['customerName']) && (r['Customer Phone'] || r['customerPhone']) && (r['Device Model'] || r['deviceModel'])),
    }));

    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p) => p.isValid).length,
      invalidRows: parsed.filter((p) => !p.isValid).length,
      preview: parsed,
    });
  } catch (err: any) {
    return res.status(400).json({ error: 'Failed to parse Excel file.' });
  }
});

// 5. POST /api/battery-warranties/import/confirm
router.post('/import/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items to import.' });
    }

    const imported = [];
    for (const item of items) {
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;

      const warrantyNumber = await generateWarrantyNumber();
      const regDate = new Date();
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + 6);

      const newWarranty = {
        id: uuidv4(),
        warrantyNumber,
        customerName: item.customerName.trim(),
        customerPhone: item.customerPhone.trim(),
        customerEmail: item.customerEmail ? item.customerEmail.trim() : null,
        customerAddress: item.customerAddress ? item.customerAddress.trim() : null,
        deviceBrand: item.deviceBrand || 'Apple',
        deviceModel: item.deviceModel.trim(),
        imeiNumber: item.imeiNumber ? String(item.imeiNumber).trim() : null,
        batteryType: item.batteryType || 'Original OEM',
        warrantyPeriod: item.warrantyPeriod || '6 Months',
        registrationDate: regDate.toISOString(),
        expiryDate: expDate.toISOString(),
        status: 'ACTIVE',
        claimCount: 0,
        createdById: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data: created } = await supabaseAdmin.from('BatteryWarranty').insert([newWarranty]).select('*').single();
      if (created) imported.push(created);
    }

    return res.json({ success: true, count: imported.length, message: `Imported ${imported.length} warranties.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to commit warranty import.' });
  }
});

// 6. GET /api/battery-warranties/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: warranty, error } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !warranty) {
      return res.status(404).json({ error: 'Battery warranty not found.' });
    }

    const { data: claims } = await supabaseAdmin
      .from('BatteryWarrantyClaim')
      .select('*')
      .eq('warrantyId', id);

    return res.json({ ...warranty, claims: claims || [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch warranty record.' });
  }
});

// 7. POST /api/battery-warranties
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      repairId,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceBrand,
      deviceModel,
      imeiNumber,
      batteryType = 'Original OEM Battery',
      warrantyMonths = 6,
      terms,
    } = req.body;

    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: 'Customer name, phone, and device model are required.' });
    }

    const warrantyNumber = await generateWarrantyNumber();
    const regDate = new Date();
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + parseInt(String(warrantyMonths), 10));

    const newWarranty = {
      id: uuidv4(),
      warrantyNumber,
      repairId: repairId || null,
      repairNumber: repairNumber || null,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      customerAddress: customerAddress ? customerAddress.trim() : null,
      deviceBrand: deviceBrand || 'Apple',
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber ? String(imeiNumber).trim() : null,
      batteryType,
      warrantyPeriod: `${warrantyMonths} Months`,
      registrationDate: regDate.toISOString(),
      expiryDate: expDate.toISOString(),
      status: 'ACTIVE',
      claimCount: 0,
      terms: terms || null,
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin.from('BatteryWarranty').insert([newWarranty]).select('*').single();

    if (error) {
      console.error('[CREATE WARRANTY ERROR]', error);
      return res.status(500).json({ error: 'Failed to issue warranty.' });
    }

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register battery warranty.' });
  }
});

// 8. PUT / PATCH /api/battery-warranties/:id (Edit Warranty)
router.all('/:id/edit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;
    delete updateData.claims;

    const { data: updated, error } = await supabaseAdmin
      .from('BatteryWarranty')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update warranty.' });
  }
});

// 9. POST /api/battery-warranties/:id/claim
router.post('/:id/claim', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { issueDescription, actionTaken = 'FREE_REPLACEMENT', notes } = req.body;

    const { data: warranty } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('id', id).single();
    if (!warranty) return res.status(404).json({ error: 'Warranty not found.' });

    const claimNumber = await generateClaimNumber();
    const newClaim = {
      id: uuidv4(),
      claimNumber,
      warrantyId: id,
      repairNumber: warranty.repairNumber || null,
      customerName: warranty.customerName,
      customerPhone: warranty.customerPhone,
      deviceBrand: warranty.deviceBrand,
      deviceModel: warranty.deviceModel,
      claimDate: new Date().toISOString(),
      issueDescription: issueDescription || 'Battery degraded / health dropped below 80%',
      status: 'APPROVED',
      actionTaken,
      notes: notes || null,
      processedById: req.user!.id,
      processedByName: req.user!.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: createdClaim, error: claimErr } = await supabaseAdmin
      .from('BatteryWarrantyClaim')
      .insert([newClaim])
      .select('*')
      .single();

    if (claimErr) return res.status(500).json({ error: 'Failed to register warranty claim.' });

    const updatedClaimCount = (warranty.claimCount || 0) + 1;
    await supabaseAdmin
      .from('BatteryWarranty')
      .update({
        claimCount: updatedClaimCount,
        lastClaimDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    return res.status(201).json({ success: true, message: 'Warranty claim processed.', claim: createdClaim });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record warranty claim.' });
  }
});

// 10. POST /api/battery-warranties/:id/send-email
router.post('/:id/send-email', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const { data: warranty } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('id', id).single();
    if (!warranty) return res.status(404).json({ error: 'Warranty not found.' });

    const targetEmail = email || warranty.customerEmail;
    if (!targetEmail) return res.status(400).json({ error: 'No email address available for customer.' });

    await sendEmail({
      to: targetEmail,
      subject: `MTS Lab — Battery Warranty Certificate (${warranty.warrantyNumber})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb;">MTS Mobile Lab — Official Warranty Certificate</h2>
          <p>Dear <strong>${warranty.customerName}</strong>,</p>
          <p>Thank you for choosing MTS Mobile Lab. Your battery warranty has been successfully registered.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p><strong>Warranty ID:</strong> ${warranty.warrantyNumber}</p>
            <p><strong>Device:</strong> ${warranty.deviceBrand} ${warranty.deviceModel}</p>
            <p><strong>Battery Type:</strong> ${warranty.batteryType}</p>
            <p><strong>Valid Until:</strong> ${new Date(warranty.expiryDate).toLocaleDateString()}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">Please retain this email or warranty ID for any future warranty service or claim.</p>
        </div>
      `,
    });

    return res.json({ success: true, message: 'Warranty certificate email sent successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send warranty email.' });
  }
});

// 11. POST /api/battery-warranties/delete-2fa/request
router.post('/delete-2fa/request', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ success: true, message: '2FA verification bypassed for administrative session.' });
});

// 12. POST /api/battery-warranties/bulk-delete
router.post('/bulk-delete', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided.' });

    await supabaseAdmin.from('BatteryWarrantyClaim').delete().in('warrantyId', ids);
    const { error } = await supabaseAdmin.from('BatteryWarranty').delete().in('id', ids);

    if (error) return res.status(500).json({ error: 'Failed to delete warranties.' });

    return res.json({ success: true, message: `Deleted ${ids.length} warranty records.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to bulk delete warranties.' });
  }
});

// 13. DELETE /api/battery-warranties/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('BatteryWarrantyClaim').delete().eq('warrantyId', id);
    const { error } = await supabaseAdmin.from('BatteryWarranty').delete().eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to delete warranty.' });

    return res.json({ success: true, message: 'Warranty deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete warranty.' });
  }
});

export default router;