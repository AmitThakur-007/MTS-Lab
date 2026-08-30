import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createExcelBuffer } from '../services/excelService';

const router = Router();

/**
 * Helper to get exact current Nepal Standard Time (UTC + 5:45)
 */
function getNepalTimeDetails() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  // Nepal is UTC + 5 hours 45 minutes = 345 minutes
  const nptDate = new Date(utc + 345 * 60000);

  const hours = nptDate.getHours();
  const minutes = nptDate.getMinutes();
  const seconds = nptDate.getSeconds();
  const totalMinutes = hours * 60 + minutes;

  // 10:00 AM = 600 mins, 10:35 AM = 635 mins
  const isWithinWindow = totalMinutes >= 600 && totalMinutes <= 635;

  const dateString = nptDate.toISOString().split('T')[0];
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    nptDate,
    dateString,
    timeString,
    hours,
    minutes,
    totalMinutes,
    isWithinWindow,
    windowStart: '10:00:00',
    windowEnd: '10:35:00'
  };
}

// ==========================================
// 1. GET /api/attendance/server-time
// ==========================================
router.get('/server-time', (req, res) => {
  const time = getNepalTimeDetails();
  return res.json({
    iso: time.nptDate.toISOString(),
    timestamp: time.nptDate.getTime(),
    dateString: time.dateString,
    timeString: time.timeString,
    isWithinWindow: time.isWithinWindow,
    windowRange: '10:00 AM – 10:35 AM NPT'
  });
});

// ==========================================
// 2. GET /api/attendance/roster
// ==========================================
router.get('/roster', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalTimeDetails();
    const todayStr = (req.query.date as string) || time.dateString;

    // 1. Fetch all registered staff members
    const { data: users, error: userErr } = await supabaseAdmin
      .from('User')
      .select('id, name, email, role, department, phone, avatarUrl, status')
      .order('name', { ascending: true });

    if (userErr) {
      console.error('[ATTENDANCE ROSTER USERS ERROR]', userErr);
      return res.status(500).json({ error: 'Failed to retrieve staff roster.' });
    }

    const staffList = (users || []).filter((u: any) => u.status !== 'SUSPENDED' && u.status !== 'INACTIVE');

    // 2. Fetch today's attendance logs
    const { data: attendanceRecords } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('date', todayStr);

    const attendanceMap = new Map();
    (attendanceRecords || []).forEach((rec: any) => {
      attendanceMap.set(rec.userId, rec);
    });

    // 3. Fetch manager broadcast dispatch count for today
    const { data: broadcastLogs } = await supabaseAdmin
      .from('AttendanceBroadcast')
      .select('id')
      .eq('date', todayStr);

    const dispatchCount = broadcastLogs?.length || 0;

    // 4. Merge users with attendance status
    const roster = staffList.map((u: any) => {
      const record = attendanceMap.get(u.id);
      return {
        userId: u.id,
        name: u.name || u.email?.split('@')[0] || 'Staff Member',
        email: u.email,
        role: u.role || 'TECHNICIAN',
        department: u.department || 'Repair Lab',
        phone: u.phone || '',
        avatarUrl: u.avatarUrl || null,
        date: todayStr,
        status: record ? record.status : 'NOT_MARKED',
        checkInTime: record ? record.checkInTime : null,
        checkOutTime: record ? record.checkOutTime : null,
        notes: record ? record.notes : null,
        attendanceId: record ? record.id : null,
      };
    });

    const presentToday = roster.filter((r: any) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
    const absentToday = roster.filter((r: any) => r.status === 'ABSENT').length;

    return res.json({
      success: true,
      roster,
      windowInfo: {
        isWithinWindow: time.isWithinWindow,
        currentTimeNPT: time.timeString,
        windowStart: '10:00 AM',
        windowEnd: '10:35 AM',
        dispatchCount,
        maxDispatches: 3,
        canManagerDispatch: time.isWithinWindow && dispatchCount < 3
      },
      stats: {
        totalStaff: roster.length,
        presentToday,
        absentToday,
        unmarked: roster.length - (presentToday + absentToday),
      }
    });
  } catch (err: any) {
    console.error('[ATTENDANCE ROSTER EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to generate attendance roster.' });
  }
});

// ==========================================
// 3. POST /api/attendance/dispatch-request (Manager Broadcast: 10:00 - 10:35 AM only, max 3 times)
// ==========================================
router.post('/dispatch-request', authenticate, authorize(['MANAGER', 'SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalTimeDetails();
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    // Rule: Manager cannot dispatch outside 10:00 AM - 10:35 AM
    if (!isSuperAdmin && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager attendance dispatch is only allowed between 10:00 AM and 10:35 AM NPT. (Current NPT: ${time.timeString})`
      });
    }

    // Rule: Check 3-dispatch daily limit for Manager
    const { data: existingDispatches } = await supabaseAdmin
      .from('AttendanceBroadcast')
      .select('id')
      .eq('date', time.dateString);

    const currentCount = existingDispatches?.length || 0;
    if (!isSuperAdmin && currentCount >= 3) {
      return res.status(429).json({
        error: 'Daily limit reached: Manager can only send attendance requests up to 3 times per day.'
      });
    }

    // 1. Log the broadcast dispatch
    await supabaseAdmin.from('AttendanceBroadcast').insert([
      {
        id: uuidv4(),
        dispatchedById: req.user!.id,
        dispatchedByName: req.user!.name,
        date: time.dateString,
        time: time.timeString,
        broadcastNumber: currentCount + 1,
        createdAt: new Date().toISOString()
      }
    ]);

    // 2. AUTOMATIC ATTENDANCE FOR THE MANAGER (Manager gets marked PRESENT automatically)
    const { data: managerRecord } = await supabaseAdmin
      .from('Attendance')
      .select('id')
      .eq('userId', req.user!.id)
      .eq('date', time.dateString)
      .maybeSingle();

    if (!managerRecord) {
      await supabaseAdmin.from('Attendance').insert([
        {
          id: uuidv4(),
          userId: req.user!.id,
          date: time.dateString,
          checkInTime: time.timeString,
          status: 'PRESENT',
          notes: 'Auto-marked PRESENT via Daily Attendance Broadcast Dispatch',
          markedById: req.user!.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    } else {
      await supabaseAdmin.from('Attendance').update({
        status: 'PRESENT',
        checkInTime: time.timeString,
        notes: 'Confirmed PRESENT via Broadcast Dispatch',
        updatedAt: new Date().toISOString()
      }).eq('id', managerRecord.id);
    }

    // 3. Mark unmarked staff as PENDING / REQUESTED so they can respond
    const { data: staffUsers } = await supabaseAdmin
      .from('User')
      .select('id')
      .neq('id', req.user!.id)
      .not('status', 'eq', 'SUSPENDED');

    for (const staff of (staffUsers || [])) {
      const { data: exists } = await supabaseAdmin
        .from('Attendance')
        .select('id, status')
        .eq('userId', staff.id)
        .eq('date', time.dateString)
        .maybeSingle();

      if (!exists) {
        await supabaseAdmin.from('Attendance').insert([
          {
            id: uuidv4(),
            userId: staff.id,
            date: time.dateString,
            status: 'PENDING',
            notes: `Attendance requested by Manager (Attempt #${currentCount + 1})`,
            markedById: req.user!.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]);
      }
    }

    return res.json({
      success: true,
      message: `Attendance request dispatched to all staff (${currentCount + 1}/3). You have been auto-marked PRESENT.`,
      dispatchCount: currentCount + 1,
      maxDispatches: 3
    });
  } catch (err: any) {
    console.error('[DISPATCH REQUEST ERROR]', err);
    return res.status(500).json({ error: 'Failed to broadcast attendance request.' });
  }
});

// ==========================================
// 4. POST /api/attendance/mark (Super Admin Universal Override & Staff Response)
// ==========================================
router.post('/mark', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      status: explicitStatus,
      notes,
      userId: targetUserId,
      date: targetDate,
      time: targetTime
    } = req.body;

    const time = getNepalTimeDetails();
    const effectiveDate = targetDate || time.dateString;
    const effectiveTime = targetTime || time.timeString;
    const effectiveUserId = targetUserId || req.user!.id;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const isManager = req.user?.role === 'MANAGER';

    // Check existing record
    const { data: existing } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', effectiveUserId)
      .eq('date', effectiveDate)
      .limit(1);

    const existingRecord = existing?.[0];

    // ----------------------------------------------------
    // CASE A: SUPER ADMIN UNIVERSAL DIRECT MARK (ANY TIME 24/7)
    // ----------------------------------------------------
    if (isSuperAdmin || (isManager && explicitStatus && time.isWithinWindow)) {
      const finalStatus = explicitStatus || 'PRESENT';
      const updatePayload: any = {
        status: finalStatus,
        notes: notes ? notes.trim() : (isSuperAdmin ? `Directly marked by Super Admin (${req.user!.name})` : 'Marked by Manager'),
        updatedAt: new Date().toISOString()
      };

      if (type === 'CHECK_OUT' || explicitStatus === 'CHECK_OUT') {
        updatePayload.checkOutTime = effectiveTime;
      } else {
        if (!existingRecord?.checkInTime) updatePayload.checkInTime = effectiveTime;
      }

      if (existingRecord) {
        const { data: updated, error } = await supabaseAdmin
          .from('Attendance')
          .update(updatePayload)
          .eq('id', existingRecord.id)
          .select('*')
          .single();

        if (error) throw error;
        return res.json({ success: true, message: `Staff attendance updated to ${finalStatus}.`, record: updated });
      } else {
        const newRecord = {
          id: uuidv4(),
          userId: effectiveUserId,
          date: effectiveDate,
          checkInTime: effectiveTime,
          status: finalStatus,
          notes: notes ? notes.trim() : `Directly marked by Super Admin (${req.user!.name})`,
          markedById: req.user!.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const { data: created, error } = await supabaseAdmin
          .from('Attendance')
          .insert([newRecord])
          .select('*')
          .single();

        if (error) throw error;
        return res.status(201).json({ success: true, message: `Staff attendance marked as ${finalStatus}.`, record: created });
      }
    }

    // ----------------------------------------------------
    // CASE B: REGULAR STAFF SELF CHECK-IN (During Active Window or if Requested)
    // ----------------------------------------------------
    if (type === 'CHECK_IN' || type === 'IN') {
      if (existingRecord && existingRecord.checkInTime && existingRecord.status === 'PRESENT') {
        return res.status(400).json({ error: 'Check-in already completed for today.' });
      }

      if (existingRecord) {
        const { data: updated, error } = await supabaseAdmin
          .from('Attendance')
          .update({
            checkInTime: effectiveTime,
            status: 'PRESENT',
            notes: notes || 'Confirmed presence in response to request',
            updatedAt: new Date().toISOString(),
          })
          .eq('id', existingRecord.id)
          .select('*')
          .single();

        if (error) throw error;
        return res.json({ success: true, message: 'Check-in confirmed successfully.', record: updated });
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

      const { data: created, error } = await supabaseAdmin
        .from('Attendance')
        .insert([newRecord])
        .select('*')
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, message: 'Check-in recorded.', record: created });
    }

    // ----------------------------------------------------
    // CASE C: REGULAR STAFF CHECK-OUT
    // ----------------------------------------------------
    if (type === 'CHECK_OUT' || type === 'OUT') {
      if (!existingRecord) {
        return res.status(400).json({ error: 'No check-in record found for today.' });
      }

      const { data: updated, error } = await supabaseAdmin
        .from('Attendance')
        .update({
          checkOutTime: effectiveTime,
          notes: notes ? `${existingRecord.notes || ''} | ${notes}`.trim() : existingRecord.notes,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select('*')
        .single();

      if (error) throw error;
      return res.json({ success: true, message: 'Check-out recorded successfully.', record: updated });
    }

    return res.status(400).json({ error: 'Invalid attendance parameters.' });
  } catch (err: any) {
    console.error('[ATTENDANCE MARK ERROR]', err);
    return res.status(500).json({ error: err?.message || 'Failed to mark attendance.' });
  }
});

// ==========================================
// 5. GET /api/attendance/today
// ==========================================
router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalTimeDetails();
    const todayStr = (req.query.date as string) || time.dateString;

    const { data: records, error } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User(id, name, email, role, department, avatarUrl)')
      .eq('date', todayStr);

    if (error) return res.status(500).json({ error: 'Failed to fetch today attendance.' });
    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load today attendance records.' });
  }
});

// ==========================================
// 6. GET /api/attendance/my
// ==========================================
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalTimeDetails();
    const todayStr = time.dateString;

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

// ==========================================
// 7. GET /api/attendance/history
// ==========================================
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, status, month, startDate, endDate, limit = '100' } = req.query;
    let query = supabaseAdmin.from('Attendance').select('*, user:User(id, name, role, department)');

    if (userId && userId !== 'ALL') query = query.eq('userId', String(userId));
    if (status && status !== 'ALL') query = query.eq('status', String(status));

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

// ==========================================
// 8. GET /api/attendance/monthly-report
// ==========================================
router.get('/monthly-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const currentMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records, error } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User(id, name, role, department)')
      .ilike('date', `${currentMonth}%`);

    if (error) return res.status(500).json({ error: 'Failed to load monthly report.' });
    return res.json(records || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load monthly report.' });
  }
});

// ==========================================
// 9. DELETE /api/attendance/:id
// ==========================================
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

// ==========================================
// 10. GET /api/attendance/export
// ==========================================
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const targetMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records } = await supabaseAdmin
      .from('Attendance')
      .select('*, user:User(name, role, department)')
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