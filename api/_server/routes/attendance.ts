import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createExcelBuffer } from '../services/excelService';

const router = Router();

function getNepalTimeDetails() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const nptDate = new Date(utc + 345 * 60000);

  const hours = nptDate.getHours();
  const minutes = nptDate.getMinutes();
  const seconds = nptDate.getSeconds();
  const totalMinutes = hours * 60 + minutes;

  // 10:00 AM (600m) to 10:35 AM (635m)
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

// Safe user helper to avoid failing when column names differ
async function fetchSafeStaffUsers() {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('User')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[SUPABASE USER QUERY ERROR]', error);
      return [];
    }

    return (users || []).filter((u: any) => u.status !== 'SUSPENDED' && u.status !== 'INACTIVE');
  } catch (err) {
    console.error('[SAFE USER FETCH EXCEPTION]', err);
    return [];
  }
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
// 2. GET /api/attendance/pending-requests
// ==========================================
router.get('/pending-requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: records } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('status', 'PENDING')
      .order('createdAt', { ascending: false });

    const staffList = await fetchSafeStaffUsers();
    const userMap = new Map();
    staffList.forEach((u: any) => userMap.set(u.id, u));

    const formatted = (records || []).map((r: any) => ({
      ...r,
      user: userMap.get(r.userId) || { name: 'Staff Member', role: 'TECHNICIAN' }
    }));

    return res.json(formatted);
  } catch (err: any) {
    return res.json([]);
  }
});

// ==========================================
// 3. GET /api/attendance/roster & /api/attendance/today
// ==========================================
const handleRosterRequest = async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalTimeDetails();
    const todayStr = (req.query.date as string) || time.dateString;

    // 1. Fetch staff safely
    const staffList = await fetchSafeStaffUsers();

    // 2. Fetch today's attendance records
    const { data: attendanceRecords } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('date', todayStr);

    const attendanceMap = new Map();
    (attendanceRecords || []).forEach((rec: any) => {
      attendanceMap.set(rec.userId, rec);
    });

    let dispatchCount = 0;
    try {
      const { data: broadcastLogs } = await supabaseAdmin
        .from('AttendanceBroadcast')
        .select('id')
        .eq('date', todayStr);
      dispatchCount = broadcastLogs?.length || 0;
    } catch {
      dispatchCount = 0;
    }

    const roster = staffList.map((u: any) => {
      const record = attendanceMap.get(u.id);
      return {
        userId: u.id,
        id: u.id,
        name: u.name || u.email?.split('@')[0] || 'Staff Member',
        email: u.email,
        role: u.role || 'TECHNICIAN',
        department: u.department || 'Repair Lab',
        phone: u.phone || '',
        avatarUrl: u.avatarUrl || u.profileImage || null,
        date: todayStr,
        status: record ? record.status : 'NOT_MARKED',
        checkInTime: record ? record.checkInTime : null,
        checkOutTime: record ? record.checkOutTime : null,
        notes: record ? record.notes : null,
        attendanceId: record ? record.id : null,
        user: {
          id: u.id,
          name: u.name || u.email?.split('@')[0] || 'Staff Member',
          email: u.email,
          role: u.role || 'TECHNICIAN',
          department: u.department || 'Repair Lab',
          profileImage: u.avatarUrl || u.profileImage || null,
        },
        attendance: record ? {
          id: record.id,
          status: record.status,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          markedByName: record.markedByName || 'Administrator',
          markedAt: record.checkInTime || record.date,
          notes: record.notes
        } : null
      };
    });

    const presentToday = roster.filter((r: any) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
    const absentToday = roster.filter((r: any) => r.status === 'ABSENT').length;
    const rate = roster.length > 0 ? Math.round((presentToday / roster.length) * 100) : 100;

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
        presentCount: presentToday,
        absentToday,
        absentCount: absentToday,
        attendanceRate: rate,
        pendingCount: roster.filter((r: any) => r.status === 'PENDING').length,
        notMarkedCount: roster.filter((r: any) => r.status === 'NOT_MARKED').length,
      }
    });
  } catch (err: any) {
    console.error('[ATTENDANCE ROSTER EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to generate attendance roster.' });
  }
};

router.get('/roster', authenticate, handleRosterRequest);
router.get('/today', authenticate, handleRosterRequest);

// ==========================================
// 4. GET /api/attendance/monthly-report
// ==========================================
router.get('/monthly-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const currentMonth = (month as string) || new Date().toISOString().slice(0, 7);

    // 1. Fetch staff safely with select('*')
    const staffList = await fetchSafeStaffUsers();

    // 2. Fetch all logs for this month
    const { data: records } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .gte('date', `${currentMonth}-01`)
      .lte('date', `${currentMonth}-31`);

    const userLogsMap = new Map<string, any[]>();
    (records || []).forEach((r: any) => {
      const existing = userLogsMap.get(r.userId) || [];
      existing.push(r);
      userLogsMap.set(r.userId, existing);
    });

    let totalPresentAll = 0;
    let totalAbsentAll = 0;

    const report = staffList.map((u: any) => {
      const logs = userLogsMap.get(u.id) || [];
      const presentDays = logs.filter((l: any) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(l.status)).length;
      const absentDays = logs.filter((l: any) => l.status === 'ABSENT').length;
      const pendingDays = logs.filter((l: any) => l.status === 'PENDING').length;
      const rejectedDays = logs.filter((l: any) => l.status === 'REJECTED').length;

      totalPresentAll += presentDays;
      totalAbsentAll += absentDays;

      const totalActiveDays = presentDays + absentDays;
      const attendanceRate = totalActiveDays > 0 ? Math.round((presentDays / totalActiveDays) * 100) : null;

      let statusTag = 'NO_DATA';
      if (attendanceRate !== null) {
        if (attendanceRate >= 90) statusTag = 'EXCELLENT';
        else if (attendanceRate >= 75) statusTag = 'GOOD';
        else if (attendanceRate >= 60) statusTag = 'AVERAGE';
        else statusTag = 'NEEDS_ATTENTION';
      }

      return {
        user: {
          id: u.id,
          name: u.name || u.email?.split('@')[0] || 'Staff Member',
          email: u.email,
          role: u.role || 'TECHNICIAN',
          department: u.department || 'Repair Lab',
          profileImage: u.avatarUrl || u.profileImage || null,
        },
        presentDays,
        absentDays,
        pendingDays,
        rejectedDays,
        attendanceRate,
        statusTag,
        logs
      };
    });

    const avgRate = staffList.length > 0 && (totalPresentAll + totalAbsentAll) > 0
      ? Math.round((totalPresentAll / (totalPresentAll + totalAbsentAll)) * 100)
      : 100;

    return res.json({
      success: true,
      report,
      stats: {
        totalStaff: staffList.length,
        presentToday: totalPresentAll,
        absentToday: totalAbsentAll,
        attendanceRate: avgRate
      }
    });
  } catch (err: any) {
    console.error('[MONTHLY REPORT EXCEPTION]', err);
    return res.status(500).json({ error: 'Failed to load monthly report.' });
  }
});

// ==========================================
// 5. GET /api/attendance/staff/:userId/monthly
// ==========================================
router.get('/staff/:userId/monthly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;
    const currentMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', userId)
      .gte('date', `${currentMonth}-01`)
      .lte('date', `${currentMonth}-31`)
      .order('date', { ascending: true });

    const logs = records || [];
    const presentCount = logs.filter((l: any) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(l.status)).length;
    const absentCount = logs.filter((l: any) => l.status === 'ABSENT').length;
    const pendingCount = logs.filter((l: any) => l.status === 'PENDING').length;
    const rejectedCount = logs.filter((l: any) => l.status === 'REJECTED').length;

    const rate = (presentCount + absentCount) > 0 ? Math.round((presentCount / (presentCount + absentCount)) * 100) : null;

    const [y, m] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const dailyLogs = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const rec = logs.find((l: any) => l.date === dStr);
      const isFuture = dStr > todayStr;
      const isToday = dStr === todayStr;
      const dayOfWeek = format(new Date(y, m - 1, day), 'EEE');

      dailyLogs.push({
        date: dStr,
        dayOfWeek,
        isToday,
        isFuture,
        status: rec ? rec.status : isFuture ? 'FUTURE' : 'NOT_MARKED',
        record: rec ? {
          ...rec,
          formattedCheckInTime: rec.checkInTime || '—',
          markedBy: rec.markedByName || 'Administrator'
        } : null
      });
    }

    return res.json({
      success: true,
      dailyLogs,
      stats: {
        presentCount,
        absentCount,
        pendingCount,
        rejectedCount,
        attendanceRate: rate
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load staff monthly calendar.' });
  }
});

// ==========================================
// 6. POST /api/attendance/dispatch-request (Manager 10:00 - 10:35 AM Broadcast)
// ==========================================
router.post('/dispatch-request', authenticate, authorize(['MANAGER', 'SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalTimeDetails();
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager attendance dispatch is only allowed between 10:00 AM and 10:35 AM NPT. (Current NPT: ${time.timeString})`
      });
    }

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

    try {
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
    } catch (e) {
      console.warn('[BROADCAST LOG FAIL NON FATAL]', e);
    }

    // Auto-mark manager PRESENT
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

    // Set other staff to PENDING if not marked
    const staffUsers = await fetchSafeStaffUsers();

    for (const staff of staffUsers.filter((u: any) => u.id !== req.user!.id)) {
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
// 7. POST /api/attendance/mark (Super Admin Universal Override 24/7)
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

    const { data: existing } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .eq('userId', effectiveUserId)
      .eq('date', effectiveDate)
      .limit(1);

    const existingRecord = existing?.[0];

    // CASE A: SUPER ADMIN / MANAGER DIRECT MARK
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

    // CASE B: REGULAR STAFF SELF CHECK-IN
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

    // CASE C: REGULAR STAFF CHECK-OUT
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
// 8. GET /api/attendance/my
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
      success: true,
      today: todayRecord?.[0] || null,
      recent: recentRecords || [],
      history: recentRecords || []
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch personal attendance.' });
  }
});

// ==========================================
// 9. GET /api/attendance/history
// ==========================================
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, status, month, startDate, endDate, limit = '100' } = req.query;
    let query = supabaseAdmin.from('Attendance').select('*');

    if (userId && userId !== 'ALL') query = query.eq('userId', String(userId));
    if (status && status !== 'ALL') query = query.eq('status', String(status));

    if (month) {
      query = query.gte('date', `${month}-01`).lte('date', `${month}-31`);
    } else if (startDate || endDate) {
      if (startDate) query = query.gte('date', String(startDate));
      if (endDate) query = query.lte('date', String(endDate));
    }

    const { data: records, error } = await query
      .order('date', { ascending: false })
      .limit(parseInt(limit as string, 10) || 100);

    if (error) return res.status(500).json({ error: 'Failed to fetch attendance history.' });

    const staffList = await fetchSafeStaffUsers();
    const userMap = new Map();
    staffList.forEach((u: any) => userMap.set(u.id, u));

    const enriched = (records || []).map((r: any) => ({
      ...r,
      user: userMap.get(r.userId) || { name: 'Staff Member', role: 'TECHNICIAN' }
    }));

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve attendance logs.' });
  }
});

// ==========================================
// 10. PATCH /api/attendance/:id
// ==========================================
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, reason } = req.body;

    const { data: updated, error } = await supabaseAdmin
      .from('Attendance')
      .update({
        status,
        notes: notes || `Corrected by Admin (${req.user!.name}): ${reason || ''}`,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update record.' });
    return res.json({ success: true, message: 'Attendance record corrected.', record: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update attendance log.' });
  }
});

// ==========================================
// 11. DELETE /api/attendance/:id
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
// 12. GET /api/attendance/export
// ==========================================
router.get('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const targetMonth = (month as string) || new Date().toISOString().slice(0, 7);

    const { data: records } = await supabaseAdmin
      .from('Attendance')
      .select('*')
      .gte('date', `${targetMonth}-01`)
      .lte('date', `${targetMonth}-31`)
      .order('date', { ascending: false });

    const staffList = await fetchSafeStaffUsers();
    const userMap = new Map();
    staffList.forEach((u: any) => userMap.set(u.id, u));

    const rows = (records || []).map((r: any) => {
      const u = userMap.get(r.userId) || {};
      return {
        'Date': r.date,
        'Staff Name': u.name || 'Staff',
        'Role': u.role || 'TECHNICIAN',
        'Department': u.department || 'Repair Lab',
        'Check In': r.checkInTime || '—',
        'Check Out': r.checkOutTime || '—',
        'Status': r.status,
        'Notes': r.notes || '—',
      };
    });

    return res.json({ success: true, rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export attendance records.' });
  }
});

export default router;