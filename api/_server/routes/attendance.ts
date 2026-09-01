import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import {
  getNepalBusinessTime,
  getAuthorizedStaffList,
  getAllAttendanceRecords,
  getAttendanceRecordById,
  getAttendanceRecordByUserAndDate,
  upsertAttendanceRecord,
  bulkUpsertAttendance,
  deleteAttendanceRecord,
  purgeUserAttendance,
  getAttendanceAuditLogs,
  AttendanceRecord,
} from '../services/attendanceStorage';

const router = Router();

const ATTENDANCE_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const ATTENDANCE_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ==========================================
// 1. GET /api/attendance/server-time
// Authoritative Asia/Kathmandu (NPT) Business Clock
// ==========================================
router.get('/server-time', (req, res) => {
  try {
    const time = getNepalBusinessTime();
    return res.json({
      serverTime: time.timeString,
      serverDate: time.dateString,
      hours: time.hours,
      minutes: time.minutes,
      seconds: time.seconds,
      totalMinutes: time.totalMinutes,
      isWithinWindow: time.isWithinWindow,
      secondsRemainingInWindow: time.secondsRemainingInWindow,
      secondsUntilWindowOpens: time.secondsUntilWindowOpens,
      windowStart: time.windowStart,
      windowEnd: time.windowEnd,
      timezone: time.timezone,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve server business time.' });
  }
});

// ==========================================
// 2. GET /api/attendance/roster & /api/attendance/today
// Daily roster of active staff with today's status
// ==========================================
const handleGetRoster = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    const time = getNepalBusinessTime();
    const targetDate = (req.query.date as string) || time.dateString;
    const currentMonth = targetDate.slice(0, 7);

    // Fetch authorized staff list
    const staffList = await getAuthorizedStaffList();
    // Fetch all attendance records for target date
    const todayRecords = await getAllAttendanceRecords({ date: targetDate });
    // Fetch month records for calculating attendance rates
    const monthRecords = await getAllAttendanceRecords({ month: currentMonth });

    const recordMap = new Map<string, AttendanceRecord>();
    todayRecords.forEach((r) => recordMap.set(r.userId, r));

    // Calculate monthly rate per user
    const monthCounts = new Map<string, { present: number; total: number }>();
    monthRecords.forEach((r) => {
      const entry = monthCounts.get(r.userId) || { present: 0, total: 0 };
      entry.total += 1;
      if (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY') {
        entry.present += 1;
      }
      monthCounts.set(r.userId, entry);
    });

    const roster = staffList.map((user) => {
      const rec = recordMap.get(user.id);
      const mStats = monthCounts.get(user.id);
      const rate = mStats && mStats.total > 0 ? Math.round((mStats.present / mStats.total) * 100) : null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || 'Repair Lab',
        phoneNumber: user.phoneNumber || null,
        profileImage: user.profileImage || null,
        status: rec ? rec.status : 'NOT_MARKED',
        attendanceId: rec ? rec.id : null,
        checkInTime: rec ? rec.checkInTime : null,
        checkOutTime: rec ? rec.checkOutTime : null,
        notes: rec ? rec.notes : null,
        markedByName: rec ? rec.markedByName : null,
        markedByRole: rec ? rec.markedByRole : null,
        markedAt: rec ? rec.markedAt : null,
        monthlyAttendanceRate: rate,
      };
    });

    // Summary counts
    const totalStaff = roster.length;
    const presentCount = roster.filter((s) => s.status === 'PRESENT' || s.status === 'LATE' || s.status === 'HALF_DAY').length;
    const absentCount = roster.filter((s) => s.status === 'ABSENT').length;
    const pendingCount = roster.filter((s) => s.status === 'PENDING').length;
    const notMarkedCount = roster.filter((s) => s.status === 'NOT_MARKED').length;

    return res.json({
      success: true,
      date: targetDate,
      serverTime: time.timeString,
      isWithinWindow: time.isWithinWindow,
      summary: {
        totalStaff,
        presentCount,
        absentCount,
        pendingCount,
        notMarkedCount,
        markedCount: totalStaff - notMarkedCount,
        overallRate: totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0,
      },
      roster: isManagement ? roster : roster.filter((r) => r.id === currentUser.id),
    });
  } catch (err: any) {
    console.error('[ROSTER FETCH ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate attendance roster.' });
  }
};

router.get('/roster', authenticate, handleGetRoster);
router.get('/today', authenticate, handleGetRoster);

// ==========================================
// 2.5 GET /api/attendance/pending-requests & /api/attendance/pending
// Pending attendance logs and regularization requests
// ==========================================
const handleGetPendingRequests = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    const allRecords = await getAllAttendanceRecords();

    // Filter records with PENDING status or PENDING requestStatus
    let pendingList = allRecords.filter((r) => r.status === 'PENDING' || r.requestStatus === 'PENDING');

    if (!isManagement) {
      pendingList = pendingList.filter((r) => r.userId === currentUser.id);
    }

    const staffList = await getAuthorizedStaffList();
    const staffMap = new Map(staffList.map((s) => [s.id, s]));

    const enriched = pendingList.map((r) => {
      const user = staffMap.get(r.userId);
      return {
        ...r,
        userName: user?.name || r.markedByName || 'Staff Member',
        userEmail: user?.email || null,
        userRole: user?.role || null,
        userDepartment: user?.department || 'Repair Lab',
        userProfileImage: user?.profileImage || null,
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    console.error('[PENDING ATTENDANCE REQUESTS ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch pending attendance requests.' });
  }
};

router.get('/pending-requests', authenticate, handleGetPendingRequests);
router.get('/pending', authenticate, handleGetPendingRequests);

// POST /api/attendance/pending-requests/:id/approve
router.post('/pending-requests/:id/approve', authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status = 'PRESENT', notes } = req.body;
    const existing = await getAttendanceRecordById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const updated = await upsertAttendanceRecord(
      {
        userId: existing.userId,
        date: existing.date,
        status: status as any,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
        notes: notes || existing.notes || 'Approved by management',
        requestStatus: 'ACCEPTED',
      },
      {
        id: req.user?.id || 'SYSTEM',
        name: req.user?.name || 'Administrator',
        role: req.user?.role || 'ADMIN',
      }
    );

    return res.json({ success: true, message: 'Attendance request approved.', record: updated });
  } catch (err: any) {
    console.error('[APPROVE ATTENDANCE ERROR]', err);
    return res.status(500).json({ error: 'Failed to approve attendance request.' });
  }
});

// POST /api/attendance/pending-requests/:id/reject
router.post('/pending-requests/:id/reject', authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason = 'Rejected by management' } = req.body;
    const existing = await getAttendanceRecordById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const updated = await upsertAttendanceRecord(
      {
        userId: existing.userId,
        date: existing.date,
        status: 'REJECTED' as any,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
        notes: existing.notes,
        requestStatus: 'REJECTED',
        rejectionReason: reason,
      },
      {
        id: req.user?.id || 'SYSTEM',
        name: req.user?.name || 'Administrator',
        role: req.user?.role || 'ADMIN',
      }
    );

    return res.json({ success: true, message: 'Attendance request rejected.', record: updated });
  } catch (err: any) {
    console.error('[REJECT ATTENDANCE ERROR]', err);
    return res.status(500).json({ error: 'Failed to reject attendance request.' });
  }
});

// ==========================================
// 3. GET /api/attendance/monthly-report
// Comprehensive Monthly Report & Matrix
// ==========================================
router.get('/monthly-report', authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const time = getNepalBusinessTime();
    const targetMonth = (req.query.month as string) || time.dateString.slice(0, 7);

    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const staffList = await getAuthorizedStaffList();
    const records = await getAllAttendanceRecords({ month: targetMonth });

    // Group records by userId and date
    const userRecordsMap = new Map<string, Map<string, AttendanceRecord>>();
    records.forEach((r) => {
      let userMap = userRecordsMap.get(r.userId);
      if (!userMap) {
        userMap = new Map<string, AttendanceRecord>();
        userRecordsMap.set(r.userId, userMap);
      }
      userMap.set(r.date, r);
    });

    let totalStaffPresentSum = 0;
    let totalActiveStaffWithLogs = 0;

    const staffMetrics = staffList.map((staff) => {
      const userMap = userRecordsMap.get(staff.id) || new Map<string, AttendanceRecord>();
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;

      const dailyStatus: Record<string, string> = {};
      const logs: Array<{
        id: string;
        date: string;
        status: string;
        checkInTime?: string;
        notes?: string;
      }> = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
        const rec = userMap.get(dayStr);
        if (rec) {
          dailyStatus[dayStr] = rec.status;
          logs.push({
            id: rec.id,
            date: rec.date,
            status: rec.status,
            checkInTime: rec.checkInTime || undefined,
            notes: rec.notes || undefined,
          });

          if (rec.status === 'PRESENT') presentCount++;
          else if (rec.status === 'ABSENT') absentCount++;
          else if (rec.status === 'LATE') {
            lateCount++;
            presentCount++;
          } else if (rec.status === 'HALF_DAY') {
            halfDayCount++;
            presentCount++;
          } else if (rec.status === 'PENDING') {
            pendingCount++;
          } else if (rec.status === 'REJECTED') {
            rejectedCount++;
          }
        } else {
          dailyStatus[dayStr] = 'NOT_MARKED';
        }
      }

      const totalMarked = presentCount + absentCount + pendingCount + rejectedCount;
      const rate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null;

      if (rate !== null) {
        totalStaffPresentSum += rate;
        totalActiveStaffWithLogs++;
      }

      let statusTag: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_ATTENTION' | 'NO_DATA' = 'NO_DATA';
      if (rate !== null) {
        if (rate >= 90) statusTag = 'EXCELLENT';
        else if (rate >= 75) statusTag = 'GOOD';
        else if (rate >= 60) statusTag = 'AVERAGE';
        else statusTag = 'NEEDS_ATTENTION';
      }

      const userObj = {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        department: staff.department || 'Repair Lab',
        profileImage: staff.profileImage || undefined,
      };

      return {
        user: userObj,
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        department: staff.department || 'Repair Lab',
        profileImage: staff.profileImage || null,
        presentDays: presentCount,
        absentDays: absentCount,
        lateDays: lateCount,
        halfDays: halfDayCount,
        pendingDays: pendingCount,
        rejectedDays: rejectedCount,
        presentCount,
        absentCount,
        lateCount,
        halfDayCount,
        pendingCount,
        totalMarked,
        attendanceRate: rate,
        statusTag,
        dailyStatus,
        logs,
      };
    });

    const averageRate = totalActiveStaffWithLogs > 0 ? Math.round(totalStaffPresentSum / totalActiveStaffWithLogs) : 0;

    return res.json({
      success: true,
      month: targetMonth,
      daysInMonth,
      summary: {
        totalStaff: staffList.length,
        averageRate,
        totalLogs: records.length,
      },
      report: staffMetrics,
      staffMetrics,
    });
  } catch (err: any) {
    console.error('[MONTHLY REPORT ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate monthly attendance report.' });
  }
});

// ==========================================
// 4. GET /api/attendance/staff/:userId/monthly
// Single staff member's detailed monthly view
// ==========================================
router.get('/staff/:userId/monthly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    if (!isManagement && currentUser.id !== userId) {
      return res.status(403).json({ error: 'You are only authorized to view your own attendance logs.' });
    }

    const time = getNepalBusinessTime();
    const targetMonth = (req.query.month as string) || time.dateString.slice(0, 7);

    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const records = await getAllAttendanceRecords({ userId, month: targetMonth });
    const recordMap = new Map<string, AttendanceRecord>();
    records.forEach((r) => recordMap.set(r.date, r));

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let pendingCount = 0;

    const dailyLogs = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
      const rec = recordMap.get(dateStr);
      if (rec) {
        if (rec.status === 'PRESENT') presentCount++;
        else if (rec.status === 'ABSENT') absentCount++;
        else if (rec.status === 'LATE') {
          lateCount++;
          presentCount++;
        } else if (rec.status === 'HALF_DAY') {
          halfDayCount++;
          presentCount++;
        } else if (rec.status === 'PENDING') {
          pendingCount++;
        }

        dailyLogs.push(rec);
      } else {
        dailyLogs.push({
          id: null,
          userId,
          date: dateStr,
          status: 'NOT_MARKED',
          checkInTime: null,
          checkOutTime: null,
          notes: null,
        });
      }
    }

    const totalMarked = presentCount + absentCount + pendingCount;
    const rate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null;

    return res.json({
      success: true,
      userId,
      month: targetMonth,
      stats: {
        presentCount,
        absentCount,
        lateCount,
        halfDayCount,
        pendingCount,
        totalMarked,
        attendanceRate: rate,
      },
      dailyLogs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch staff monthly logs.' });
  }
});

// ==========================================
// 5. POST /api/attendance/mark
// Core Attendance Marking Endpoint with Strict Time Window for Managers
// ==========================================
router.post('/mark', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const {
      userId,
      date,
      status = 'PRESENT',
      notes,
      correctionReason,
      checkInTime,
      checkOutTime,
    } = req.body;

    const time = getNepalBusinessTime();
    const targetUserId = userId || currentUser.id;
    const targetDate = date || time.dateString;

    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
    const isAdmin = currentUser.role === 'ADMIN';
    const isManager = currentUser.role === 'MANAGER';
    const isSelf = targetUserId === currentUser.id;

    // RBAC & TIME WINDOW ENFORCEMENT
    if (isSuperAdmin || isAdmin) {
      // Super Admin and Admin have 24/7 unlimited access to mark anyone's attendance
    } else if (isManager) {
      // Manager marking other staff must be strictly within 10:00 AM - 10:35 AM NPT
      if (!isSelf && !time.isWithinWindow) {
        return res.status(403).json({
          error: `Manager can only record staff attendance between 10:00 AM and 10:35 AM (Asia/Kathmandu time). Current NPT time: ${time.timeString}`,
          code: 'OUTSIDE_ATTENDANCE_WINDOW',
          serverTime: time.timeString,
          window: '10:00 AM - 10:35 AM NPT',
        });
      }
    } else {
      // Regular staff (Technician, Receptionist, etc.) can ONLY mark their own attendance
      if (!isSelf) {
        return res.status(403).json({
          error: 'Access denied: Staff members can only record their own personal attendance.',
          code: 'UNAUTHORIZED_TARGET_USER',
        });
      }
    }

    // Verify target user is in authorized staff list
    const staffList = await getAuthorizedStaffList();
    const targetUser = staffList.find((s) => s.id === targetUserId);
    if (!targetUser && !isSuperAdmin && !isAdmin) {
      return res.status(400).json({ error: 'Target employee is not an active staff member.' });
    }

    const saved = await upsertAttendanceRecord(
      {
        userId: targetUserId,
        date: targetDate,
        status,
        notes,
        correctionReason,
        checkInTime,
        checkOutTime,
        method: isSuperAdmin
          ? 'DIRECT_SUPER_ADMIN'
          : isAdmin
          ? 'DIRECT_ADMIN'
          : isManager
          ? 'MANAGER_ATTENDANCE'
          : 'STAFF_SELF_CHECKIN',
        requestStatus: 'DIRECT',
      },
      {
        id: currentUser.id,
        name: currentUser.name || 'Staff User',
        role: currentUser.role,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Attendance marked as ${saved.status} for ${targetUser?.name || 'employee'}.`,
      record: saved,
    });
  } catch (err: any) {
    console.error('[MARK ATTENDANCE EXCEPTION]', err);
    return res.status(500).json({ error: err?.message || 'Failed to record attendance.' });
  }
});

// ==========================================
// 6. POST /api/attendance/bulk-mark
// Mark multiple staff attendance at once
// ==========================================
router.post('/bulk-mark', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
    const isAdmin = currentUser.role === 'ADMIN';
    const isManager = currentUser.role === 'MANAGER';

    if (!isSuperAdmin && !isAdmin && !isManager) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions for bulk attendance.' });
    }

    const time = getNepalBusinessTime();

    // Time window restriction for Manager
    if (isManager && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager can only record staff attendance between 10:00 AM and 10:35 AM (Asia/Kathmandu time). Current NPT time: ${time.timeString}`,
        code: 'OUTSIDE_ATTENDANCE_WINDOW',
      });
    }

    const { date, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'List of staff items is required for bulk marking.' });
    }

    const targetDate = date || time.dateString;
    const formattedItems = items.map((item) => ({
      userId: item.userId,
      date: targetDate,
      status: item.status || 'PRESENT',
      notes: item.notes,
    }));

    const results = await bulkUpsertAttendance(formattedItems, {
      id: currentUser.id,
      name: currentUser.name || 'Admin',
      role: currentUser.role,
    });

    return res.json({
      success: true,
      message: `Successfully processed attendance for ${results.length} staff members.`,
      records: results,
    });
  } catch (err: any) {
    console.error('[BULK MARK ERROR]', err);
    return res.status(500).json({ error: 'Failed to complete bulk attendance.' });
  }
});

// ==========================================
// 7. GET /api/attendance/my
// Personal Attendance Record for logged-in user
// ==========================================
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const time = getNepalBusinessTime();
    const currentMonth = (req.query.month as string) || time.dateString.slice(0, 7);

    const allMyRecords = await getAllAttendanceRecords({ userId: currentUser.id });
    const todayRecord = allMyRecords.find((r) => r.date === time.dateString);
    const monthRecords = allMyRecords.filter((r) => r.date.startsWith(currentMonth));

    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;

    monthRecords.forEach((r) => {
      if (r.status === 'PRESENT') presentDays++;
      else if (r.status === 'LATE') {
        lateDays++;
        presentDays++;
      } else if (r.status === 'HALF_DAY') presentDays++;
      else if (r.status === 'ABSENT') absentDays++;
    });

    const totalDays = monthRecords.length;
    const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

    return res.json({
      success: true,
      today: todayRecord || {
        status: 'NOT_MARKED',
        date: time.dateString,
        checkInTime: null,
      },
      stats: {
        month: currentMonth,
        presentDays,
        absentDays,
        lateDays,
        totalRecordedDays: totalDays,
        attendanceRate: rate,
      },
      history: allMyRecords.slice(0, 60),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve personal attendance.' });
  }
});

// ==========================================
// 8. GET /api/attendance/history
// Filterable Attendance History
// ==========================================
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    const { date, month, userId, status, search } = req.query as Record<string, string>;

    const filterUserId = isManagement ? userId : currentUser.id;

    const records = await getAllAttendanceRecords({
      date,
      month,
      userId: filterUserId,
      status,
      search,
    });

    const staffList = await getAuthorizedStaffList();
    const userMap = new Map<string, any>();
    staffList.forEach((s) => userMap.set(s.id, s));

    const enriched = records.map((r) => {
      const user = userMap.get(r.userId);
      return {
        ...r,
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              department: user.department,
              profileImage: user.profileImage,
            }
          : { id: r.userId, name: 'Staff Member', role: 'STAFF' },
      };
    });

    // Optional text search filter
    let finalRecords = enriched;
    if (search && search.trim()) {
      const s = search.toLowerCase();
      finalRecords = finalRecords.filter(
        (r) =>
          r.user?.name?.toLowerCase().includes(s) ||
          r.user?.email?.toLowerCase().includes(s) ||
          r.user?.role?.toLowerCase().includes(s) ||
          r.notes?.toLowerCase().includes(s) ||
          r.date?.includes(s)
      );
    }

    return res.json({
      success: true,
      count: finalRecords.length,
      records: finalRecords,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve attendance history.' });
  }
});

// ==========================================
// 9. PATCH /api/attendance/:id
// Correct / Update Attendance Record
// ==========================================
router.patch('/:id', authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;
    const { status, notes, correctionReason, checkInTime, checkOutTime } = req.body;

    const existing = await getAttendanceRecordById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const time = getNepalBusinessTime();
    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
    const isAdmin = currentUser.role === 'ADMIN';
    const isManager = currentUser.role === 'MANAGER';

    // Manager time window check if modifying others' attendance
    if (isManager && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager can only update attendance during 10:00 AM – 10:35 AM NPT. (Current NPT: ${time.timeString})`,
        code: 'OUTSIDE_ATTENDANCE_WINDOW',
      });
    }

    const updated = await upsertAttendanceRecord(
      {
        userId: existing.userId,
        date: existing.date,
        status: status || existing.status,
        checkInTime: checkInTime !== undefined ? checkInTime : existing.checkInTime,
        checkOutTime: checkOutTime !== undefined ? checkOutTime : existing.checkOutTime,
        notes: notes !== undefined ? notes : existing.notes,
        correctionReason: correctionReason || 'Administrative correction',
      },
      {
        id: currentUser.id,
        name: currentUser.name || 'Admin',
        role: currentUser.role,
      }
    );

    return res.json({
      success: true,
      message: 'Attendance record successfully updated.',
      record: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update attendance record.' });
  }
});

// ==========================================
// 10. DELETE /api/attendance/:id
// Delete Single Attendance Record (Admin / Super Admin)
// ==========================================
router.delete('/:id', authenticate, authorize(ATTENDANCE_ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;

    const success = await deleteAttendanceRecord(id, {
      id: currentUser.id,
      name: currentUser.name || 'Admin',
      role: currentUser.role,
    });

    if (!success) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    return res.json({
      success: true,
      message: 'Attendance record deleted successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete attendance record.' });
  }
});

// ==========================================
// 11. GET /api/attendance/export
// Export Attendance Data to CSV
// ==========================================
router.get('/export', authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const time = getNepalBusinessTime();
    const targetMonth = (month as string) || time.dateString.slice(0, 7);

    const records = await getAllAttendanceRecords({ month: targetMonth });
    const staffList = await getAuthorizedStaffList();
    const userMap = new Map<string, any>();
    staffList.forEach((u) => userMap.set(u.id, u));

    const rows = records.map((r) => {
      const u = userMap.get(r.userId) || {};
      return {
        Date: r.date,
        'Staff Name': u.name || 'Staff Member',
        Role: (u.role || 'TECHNICIAN').replace(/_/g, ' '),
        Department: u.department || 'Repair Lab',
        Status: r.status,
        'Check-In': r.checkInTime || '—',
        'Check-Out': r.checkOutTime || '—',
        'Marked By': r.markedByName || 'System',
        'Marked Role': r.markedByRole || '—',
        Notes: r.notes || '—',
        'Correction Reason': r.correctionReason || '—',
      };
    });

    return res.json({
      success: true,
      month: targetMonth,
      count: rows.length,
      rows,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export attendance records.' });
  }
});

// ==========================================
// 12. GET /api/attendance/audit-logs
// Audit Logs for Attendance Changes
// ==========================================
router.get('/audit-logs', authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await getAttendanceAuditLogs({ limit: 100 });
    return res.json({ success: true, auditLogs: logs, logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ==========================================
// 13. DELETE /api/attendance/staff/:userId
// Super Admin Only: Purge Staff Attendance Records
// ==========================================
router.delete('/staff/:userId', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Staff User ID is required.' });
    }

    if (userId === currentUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own Super Admin attendance records.' });
    }

    const count = await purgeUserAttendance(userId, {
      id: currentUser.id,
      name: currentUser.name || 'Super Admin',
      role: currentUser.role,
    });

    return res.json({
      success: true,
      message: `Permanently removed ${count} attendance records for this staff member.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to purge staff attendance records.' });
  }
});

export default router;
