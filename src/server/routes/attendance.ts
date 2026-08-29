import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createExcelBuffer } from '../services/excelService';

const router = Router();

// 1. GET /api/attendance/server-time
router.get('/server-time', (req, res) => {
  const now = new Date();
  return res.json({
    iso: now.toISOString(),
    timestamp: now.getTime(),
    dateString: now.toISOString().split('T')[0],
    timeString: now.toTimeString().split(' ')[0],
  });
});

// 2. GET /api/attendance/today
router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const todayStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const { data: records, error } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User!Attendance_userId_fkey(id, name, email, role, department, profileImage)')
      .eq('date', todayStr);

    if (error) {
      console.error('[ATTENDANCE TODAY ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch today attendance.' });
    }

    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load today attendance records.' });
  }
});

// 3. GET /api/attendance/my
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: todayRecord } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', req.user!.id)
      .eq('date', todayStr)
      .limit(1);

    const { data: recentRecords } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', req.user!.id)
      .order('date', { ascending: false })
      .limit(30);

    return res.json({
      today: todayRecord?.[0] || null,
      recent: recentRecords || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch personal attendance.' });
  }
});

// 4. GET /api/attendance/pending-requests
router.get('/pending-requests', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: records, error } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User!Attendance_userId_fkey(id, name, role, department)')
      .eq('status', 'PENDING')
      .order('createdAt', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch pending requests.' });

    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load pending requests.' });
  }
});

// 5. POST /api/attendance/mark
router.post('/mark', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, notes, userId: targetUserId, date: targetDate, time: targetTime } = req.body;
    const now = new Date();
    const effectiveDate = targetDate || now.toISOString().split('T')[0];
    const effectiveTime = targetTime || now.toTimeString().split(' ')[0];
    const effectiveUserId = targetUserId || req.user!.id;

    // Check if record for today already exists
    const { data: existing } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', effectiveUserId)
      .eq('date', effectiveDate)
      .limit(1);

    if (type === 'CHECK_IN' || type === 'IN') {
      if (existing && existing.length > 0 && existing[0].checkInTime) {
        return res.status(400).json({ error: 'Check-in already recorded for this date.' });
      }

      if (existing && existing.length > 0) {
        const { data: updated } = await supabaseAdmin
          .from('Attendance')
          .update({
            checkInTime: effectiveTime,
            status: 'PRESENT',
            notes: notes || existing[0].notes,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', existing[0].id)
          .select('*')
          .single();

        return res.json({ success: true, message: 'Check-in marked successfully.', record: updated });
      }

      const newRecord = {
        id: uuidv4(),
        userId: effectiveUserId,
        date: effectiveDate,
        checkInTime: effectiveTime,
        status: 'PRESENT',
        notes: notes || null,
        markedById: req.user!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data: created, error } = await supabaseAdmin.from('Attendance').insert([newRecord]).select('*').single();
      if (error) return res.status(500).json({ error: 'Failed to record check-in.' });

      return res.status(201).json({ success: true, message: 'Check-in recorded.', record: created });
    }

    if (type === 'CHECK_OUT' || type === 'OUT') {
      if (!existing || existing.length === 0) {
        return res.status(400).json({ error: 'No check-in record found for today to check out from.' });
      }

      const record = existing[0];
      const { data: updated, error } = await supabaseAdmin
        .from('Attendance')
        .update({
          checkOutTime: effectiveTime,
          notes: notes ? `${record.notes || ''} | ${notes}`.trim() : record.notes,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', record.id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: 'Failed to record check-out.' });

      return res.json({ success: true, message: 'Check-out recorded successfully.', record: updated });
    }

    return res.status(400).json({ error: 'Invalid attendance action type (must be CHECK_IN or CHECK_OUT).' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark attendance.' });
  }
});

// 6. POST /api/attendance/:id/respond
router.post('/:id/respond', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // 'APPROVE' or 'REJECT'
    const newStatus = action === 'APPROVE' ? 'PRESENT' : 'REJECTED';

    const { data: updated, error } = await supabaseAdmin
      .from('Attendance')
      .update({
        status: newStatus,
        notes: notes || `Request ${action.toLowerCase()}d by ${req.user!.name}`,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to respond to attendance request.' });

    return res.json({ success: true, message: `Request ${action.toLowerCase()}d.`, record: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update request.' });
  }
});

// 7. GET /api/attendance/history
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, status, month, startDate, endDate, limit = '100' } = req.query;
    let query = supabaseAdmin.from('Attendance').select('*, user:User!Attendance_userId_fkey(id, name, role, department)');

    if (userId && userId !== 'ALL') {
      query = query.eq('userId', String(userId));
    }

    if (status && status !== 'ALL') {
      query = query.eq('status', String(status));
    }

    if (month) {
      query = query.ilike('date', `${month}%`);
    } else if (startDate || endDate) {
      if (startDate) query = query.gte('date', String(startDate));
      if (endDate) query = query.lte('date', String(endDate));
    }

    const { data: records, error } = await query
      .order('date', { ascending: false })
      .limit(parseInt(limit as string, 10) || 100);

    if (error) return res.status(500).json({ error: 'Failed to fetch attendance history.' });

    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve attendance logs.' });
  }
});

// 8. GET /api/attendance/monthly-report
router.get('/monthly-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const currentMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records, error } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User!Attendance_userId_fkey(id, name, role, department)')
      .ilike('date', `${currentMonth}%`);

    if (error) return res.status(500).json({ error: 'Failed to load monthly report.' });

    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load monthly report.' });
  }
});

// 9. GET /api/attendance/staff/:userId/monthly
router.get('/staff/:userId/monthly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;
    const currentMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records, error } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', userId)
      .ilike('date', `${currentMonth}%`)
      .order('date', { ascending: true });

    if (error) return res.status(500).json({ error: 'Failed to fetch user monthly attendance.' });

    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load staff monthly calendar.' });
  }
});

// 10. PATCH /api/attendance/:id
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.id;
    delete updateData.user;

    const { data: updated, error } = await supabaseAdmin
      .from('Attendance')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update attendance log.' });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update log.' });
  }
});

// 11. DELETE /api/attendance/:id
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('Attendance').delete().eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to delete attendance record.' });

    return res.json({ success: true, message: 'Attendance record deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete log.' });
  }
});

// 12. GET /api/attendance/export
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const targetMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User!Attendance_userId_fkey(name, role, department)')
      .ilike('date', `${targetMonth}%`)
      .order('date', { ascending: false });

    const rows = (records || []).map((r: any) => ({
      'Date': r.date,
      'Staff Name': r.user?.name || 'Staff',
      'Role': r.user?.role || 'TECHNICIAN',
      'Department': r.user?.department || 'Lab',
      'Check In': r.checkInTime || '—',
      'Check Out': r.checkOutTime || '—',
      'Status': r.status,
      'Notes': r.notes || '—',
    }));

    const buffer = createExcelBuffer('Attendance', rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MTS_Attendance_${targetMonth}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export attendance records.' });
  }
});

export default router;
