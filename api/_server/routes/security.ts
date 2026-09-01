import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';
import { broadcastServerChange } from '../services/realtimeSync';
import { createNotification } from '../services/notificationStorage';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure all endpoints require SUPER_ADMIN or ADMIN
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

// 1. GET /api/security/stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Total staff count (excluding deleted & customers)
    const { data: staffUsers, error: staffErr } = await supabaseAdmin
      .from('User')
      .select('id, lastActiveAt, role')
      .is('deletedAt', null)
      .neq('role', 'CUSTOMER');

    const totalStaff = staffUsers ? staffUsers.length : 0;
    const activeStaffNow = staffUsers ? staffUsers.filter(u => u.lastActiveAt && u.lastActiveAt >= fifteenMinutesAgo).length : 0;

    // Devices stats
    const { data: devices, error: devErr } = await supabaseAdmin
      .from('ApprovedDevice')
      .select('id, status');

    const totalDevices = devices ? devices.length : 0;
    const blockedDevices = devices ? devices.filter(d => d.status === 'REVOKED' || d.status === 'BLOCKED').length : 0;

    // Security Alerts (last 24 hours)
    const alertActions = [
      'FAILED_LOGIN',
      'LOGIN_BLOCKED_DEVICE',
      'DEVICE_REVOKED',
      'DEVICE_BLOCKED',
      'ACCESS_REQUEST_REJECTED',
      'ACCOUNT_DISABLED',
      'USER_ROLE_CHANGED',
      'PASSWORD_RESET',
      'DATA_PURGED',
      'SECURITY_POLICY_VIOLATION'
    ];

    const { data: alertLogs, error: alertErr } = await supabaseAdmin
      .from('AuditLog')
      .select('id')
      .gte('createdAt', twentyFourHoursAgo)
      .or(`status.eq.FAILED,action.in.(${alertActions.join(',')})`);

    const securityAlertsCount = alertLogs ? alertLogs.length : 0;

    // Pending Access Requests
    const { data: pendingRequests, error: reqErr } = await supabaseAdmin
      .from('AccessRequest')
      .select('id')
      .eq('status', 'PENDING');

    const pendingAccessRequests = pendingRequests ? pendingRequests.length : 0;

    return res.json({
      success: true,
      stats: {
        totalStaff,
        activeStaffNow,
        totalDevices,
        blockedDevices,
        securityAlertsCount,
        pendingAccessRequests,
      }
    });
  } catch (err: any) {
    console.error('[SECURITY STATS ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch security metrics.' });
  }
});

// 2. GET /api/security/active-staff
router.get('/active-staff', async (req: AuthRequest, res: Response) => {
  try {
    const { data: staffList, error: staffErr } = await supabaseAdmin
      .from('User')
      .select(`
        id, name, email, username, role, department, phoneNumber, branchId,
        profileImage, accountStatus, isActive, twoFactorEnabled, lastLoginAt, lastActiveAt, createdAt
      `)
      .is('deletedAt', null)
      .neq('role', 'CUSTOMER')
      .order('lastActiveAt', { ascending: false, nullsFirst: false });

    if (staffErr) throw staffErr;

    // Get all approved devices for staff
    const { data: devices } = await supabaseAdmin
      .from('ApprovedDevice')
      .select('*')
      .order('lastUsedAt', { ascending: false });

    // Group devices by userId
    const deviceMap = new Map<string, any[]>();
    (devices || []).forEach(d => {
      if (!deviceMap.has(d.userId)) {
        deviceMap.set(d.userId, []);
      }
      deviceMap.get(d.userId)!.push(d);
    });

    const now = Date.now();
    const activeStaff = (staffList || []).map(user => {
      let presenceStatus: 'ONLINE' | 'IDLE' | 'OFFLINE' = 'OFFLINE';
      if (user.lastActiveAt) {
        const diffMs = now - new Date(user.lastActiveAt).getTime();
        if (diffMs <= 5 * 60 * 1000) {
          presenceStatus = 'ONLINE';
        } else if (diffMs <= 15 * 60 * 1000) {
          presenceStatus = 'IDLE';
        }
      }

      const userDevices = deviceMap.get(user.id) || [];
      const activeDevices = userDevices.filter(d => d.status === 'APPROVED');
      const latestDevice = userDevices[0] || null;

      return {
        ...user,
        presenceStatus,
        devicesCount: userDevices.length,
        activeDevicesCount: activeDevices.length,
        devices: userDevices,
        lastIpAddress: latestDevice?.ipAddress || null,
        lastKnownDevice: latestDevice?.deviceName || latestDevice?.browser ? `${latestDevice?.browser || ''} on ${latestDevice?.os || ''}`.trim() : null,
      };
    });

    return res.json({
      success: true,
      staff: activeStaff,
      total: activeStaff.length
    });
  } catch (err: any) {
    console.error('[ACTIVE STAFF ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch active staff list.' });
  }
});

// 3. GET /api/security/devices
router.get('/devices', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, userId } = req.query;

    let query = supabaseAdmin
      .from('ApprovedDevice')
      .select(`
        *,
        user:User (id, name, email, role, profileImage, department, branchId)
      `)
      .order('lastUsedAt', { ascending: false, nullsFirst: false });

    if (status && status !== 'ALL') {
      query = query.eq('status', status as string);
    }

    if (userId) {
      query = query.eq('userId', userId as string);
    }

    const { data: devices, error } = await query;
    if (error) throw error;

    let filtered = devices || [];
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(d => 
        (d.deviceName && d.deviceName.toLowerCase().includes(q)) ||
        (d.deviceIdentifier && d.deviceIdentifier.toLowerCase().includes(q)) ||
        (d.browser && d.browser.toLowerCase().includes(q)) ||
        (d.os && d.os.toLowerCase().includes(q)) ||
        (d.ipAddress && d.ipAddress.toLowerCase().includes(q)) ||
        (d.user?.name && d.user.name.toLowerCase().includes(q)) ||
        (d.user?.email && d.user.email.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      devices: filtered,
      total: filtered.length
    });
  } catch (err: any) {
    console.error('[SECURITY DEVICES ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch registered devices.' });
  }
});

// 4. POST /api/security/devices/:id/revoke (or block)
router.post('/devices/:id/revoke', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: device, error: devErr } = await supabaseAdmin
      .from('ApprovedDevice')
      .select('*, user:User (id, name, email, role)')
      .eq('id', id)
      .maybeSingle();

    if (devErr || !device) {
      return res.status(404).json({ error: 'Device not found.' });
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('ApprovedDevice')
      .update({
        status: 'REVOKED',
        revokedAt: nowIso,
        updatedAt: nowIso
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Log security audit event
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'DEVICE_BLOCKED',
      resource: 'ApprovedDevice',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      deviceInfo: {
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.deviceName,
        browser: device.browser,
        os: device.os
      },
      details: {
        targetUserId: device.userId,
        targetUserName: device.user?.name,
        targetUserEmail: device.user?.email,
        reason: reason || 'Revoked/Blocked by Administrator',
      },
    });

    await broadcastServerChange('ApprovedDevice', 'UPDATE', id, { id, status: 'REVOKED' });

    return res.json({
      success: true,
      message: `Device '${device.deviceName || device.deviceIdentifier}' has been blocked and access revoked.`,
    });
  } catch (err: any) {
    console.error('[REVOKE DEVICE ERROR]', err);
    return res.status(500).json({ error: 'Failed to revoke device authorization.' });
  }
});

// 5. POST /api/security/devices/:id/approve (or unblock)
router.post('/devices/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: device, error: devErr } = await supabaseAdmin
      .from('ApprovedDevice')
      .select('*, user:User (id, name, email, role)')
      .eq('id', id)
      .maybeSingle();

    if (devErr || !device) {
      return res.status(404).json({ error: 'Device not found.' });
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('ApprovedDevice')
      .update({
        status: 'APPROVED',
        approvedBy: req.user?.name || req.user?.email,
        approvedAt: nowIso,
        revokedAt: null,
        updatedAt: nowIso
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Log audit event
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'DEVICE_UNBLOCKED',
      resource: 'ApprovedDevice',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      deviceInfo: {
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.deviceName,
        browser: device.browser,
        os: device.os
      },
      details: {
        targetUserId: device.userId,
        targetUserName: device.user?.name,
        targetUserEmail: device.user?.email,
      },
    });

    await broadcastServerChange('ApprovedDevice', 'UPDATE', id, { id, status: 'APPROVED' });

    return res.json({
      success: true,
      message: `Device '${device.deviceName || device.deviceIdentifier}' has been authorized and restored.`,
    });
  } catch (err: any) {
    console.error('[APPROVE DEVICE ERROR]', err);
    return res.status(500).json({ error: 'Failed to authorize device.' });
  }
});

// 6. DELETE /api/security/devices/:id
router.delete('/devices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: device } = await supabaseAdmin
      .from('ApprovedDevice')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from('ApprovedDevice')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'DEVICE_DELETED',
      resource: 'ApprovedDevice',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      details: { deletedDevice: device },
    });

    await broadcastServerChange('ApprovedDevice', 'DELETE', id);

    return res.json({ success: true, message: 'Device record removed successfully.' });
  } catch (err: any) {
    console.error('[DELETE DEVICE ERROR]', err);
    return res.status(500).json({ error: 'Failed to remove device record.' });
  }
});

// 7. GET /api/security/activity-timeline
router.get('/activity-timeline', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const { userId, action, category, resource, status, search, startDate, endDate } = req.query;

    let query = supabaseAdmin
      .from('AuditLog')
      .select('*', { count: 'exact' })
      .order('createdAt', { ascending: false });

    if (userId && userId !== 'ALL') {
      query = query.eq('userId', userId as string);
    }

    if (status && status !== 'ALL') {
      query = query.eq('status', status as string);
    }

    if (resource && resource !== 'ALL') {
      query = query.eq('resource', resource as string);
    }

    if (action && action !== 'ALL') {
      query = query.eq('action', action as string);
    } else if (category && category !== 'ALL') {
      if (category === 'AUTH') {
        query = query.in('action', ['LOGIN', 'LOGOUT', '2FA_VERIFY', 'LOGIN_2FA', 'PASSWORD_RESET', 'FAILED_LOGIN']);
      } else if (category === 'SECURITY') {
        query = query.in('action', [
          'FAILED_LOGIN', 'LOGIN_BLOCKED_DEVICE', 'DEVICE_BLOCKED', 'DEVICE_REVOKED',
          'DEVICE_UNBLOCKED', 'ACCESS_REQUEST_REJECTED', 'ACCESS_REQUEST_APPROVED',
          'ACCOUNT_DISABLED', 'USER_ROLE_CHANGED', 'DATA_PURGED'
        ]);
      } else if (category === 'DATA_MUTATION') {
        query = query.or('action.ilike.%CREATE%,action.ilike.%UPDATE%,action.ilike.%DELETE%');
      }
    }

    if (startDate) {
      query = query.gte('createdAt', new Date(startDate as string).toISOString());
    }

    if (endDate) {
      // Include the entire end day
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      query = query.lte('createdAt', end.toISOString());
    }

    if (search) {
      const s = search as string;
      query = query.or(`userName.ilike.%${s}%,userEmail.ilike.%${s}%,action.ilike.%${s}%,resource.ilike.%${s}%,ipAddress.ilike.%${s}%,details.ilike.%${s}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: logs, count, error } = await query;
    if (error) throw error;

    return res.json({
      success: true,
      logs: logs || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: any) {
    console.error('[ACTIVITY TIMELINE ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

// 8. GET /api/security/access-requests (and mounted on /api/access-requests)
const handleGetAccessRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;

    let query = supabaseAdmin
      .from('AccessRequest')
      .select(`
        *,
        user:User (id, name, email, role, profileImage, accountStatus, isActive)
      `)
      .order('createdAt', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('status', status as string);
    }

    const { data: requests, error } = await query;
    if (error) throw error;

    let filtered = requests || [];
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(r => 
        (r.fullName && r.fullName.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.deviceName && r.deviceName.toLowerCase().includes(q)) ||
        (r.deviceIdentifier && r.deviceIdentifier.toLowerCase().includes(q)) ||
        (r.requestedRole && r.requestedRole.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      requests: filtered,
      total: filtered.length
    });
  } catch (err: any) {
    console.error('[ACCESS REQUESTS ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch access requests.' });
  }
};

router.get('/access-requests', handleGetAccessRequests);
router.get('/', handleGetAccessRequests);

// 9. POST /api/security/access-requests/:id/approve
const handleApproveAccessRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedRole } = req.body;

    const { data: accessReq, error: reqErr } = await supabaseAdmin
      .from('AccessRequest')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (reqErr || !accessReq) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    const nowIso = new Date().toISOString();
    const finalRole = assignedRole || accessReq.requestedRole || 'RECEPTIONIST';

    // 1. Update Access Request
    await supabaseAdmin
      .from('AccessRequest')
      .update({
        status: 'APPROVED',
        requestedRole: finalRole,
        approvedBy: req.user?.name || req.user?.email,
        approvedAt: nowIso,
        updatedAt: nowIso
      })
      .eq('id', id);

    // 2. Activate or Update User if linked
    if (accessReq.userId || accessReq.email) {
      const userCondition = accessReq.userId ? { id: accessReq.userId } : { email: accessReq.email.toLowerCase() };
      
      const { data: existingUser } = await supabaseAdmin
        .from('User')
        .select('id, name, email')
        .match(userCondition)
        .maybeSingle();

      if (existingUser) {
        await supabaseAdmin
          .from('User')
          .update({
            role: finalRole,
            accountStatus: 'ACTIVE',
            isActive: true,
            emailVerified: true,
            failedLoginAttempts: 0,
            updatedAt: nowIso
          })
          .eq('id', existingUser.id);

        // 3. Register or update device as APPROVED
        if (accessReq.deviceIdentifier) {
          const { data: dev } = await supabaseAdmin
            .from('ApprovedDevice')
            .select('id')
            .eq('userId', existingUser.id)
            .eq('deviceIdentifier', accessReq.deviceIdentifier)
            .maybeSingle();

          if (dev) {
            await supabaseAdmin
              .from('ApprovedDevice')
              .update({
                status: 'APPROVED',
                approvedBy: req.user?.name || req.user?.email,
                approvedAt: nowIso,
                revokedAt: null,
                updatedAt: nowIso
              })
              .eq('id', dev.id);
          } else {
            await supabaseAdmin.from('ApprovedDevice').insert([
              {
                id: uuidv4(),
                userId: existingUser.id,
                deviceIdentifier: accessReq.deviceIdentifier,
                deviceName: accessReq.deviceName || 'Workstation',
                deviceType: accessReq.deviceType || 'DESKTOP',
                browser: accessReq.browser || null,
                os: accessReq.os || null,
                ipAddress: accessReq.ipAddress || null,
                userAgent: accessReq.userAgent || null,
                status: 'APPROVED',
                approvedBy: req.user?.name || req.user?.email,
                approvedAt: nowIso,
                lastUsedAt: nowIso,
                createdAt: nowIso,
                updatedAt: nowIso,
              }
            ]);
          }
        }
      }
    }

    // Log security audit event
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'ACCESS_REQUEST_APPROVED',
      resource: 'AccessRequest',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      details: {
        applicantName: accessReq.fullName,
        applicantEmail: accessReq.email,
        assignedRole: finalRole,
        deviceIdentifier: accessReq.deviceIdentifier,
      },
    });

    // Notify target user if user account exists
    if (accessReq.userId) {
      try {
        await createNotification({
          userId: accessReq.userId,
          title: 'Access Request Approved',
          message: `Your staff access request for role '${finalRole}' has been approved by ${req.user?.name || 'Administrator'}.`,
          type: 'ACCESS_APPROVED',
          priority: 'HIGH',
          senderId: req.user?.id,
          senderName: req.user?.name,
          senderRole: req.user?.role,
          link: '/dashboard',
        });
      } catch (notifErr) {
        console.warn('[ACCESS APPROVE NOTIF WARN]', notifErr);
      }
    }

    await broadcastServerChange('AccessRequest', 'UPDATE', id, { id, status: 'APPROVED', role: finalRole });

    return res.json({
      success: true,
      message: `Access granted for ${accessReq.fullName} with role '${finalRole}' and device authorization.`,
    });
  } catch (err: any) {
    console.error('[APPROVE ACCESS REQUEST ERROR]', err);
    return res.status(500).json({ error: 'Failed to approve access request.' });
  }
};

router.post('/access-requests/:id/approve', handleApproveAccessRequest);
router.post('/:id/approve', handleApproveAccessRequest);

// 10. POST /api/security/access-requests/:id/reject
const handleRejectAccessRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: accessReq, error: reqErr } = await supabaseAdmin
      .from('AccessRequest')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (reqErr || !accessReq) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    const nowIso = new Date().toISOString();

    // 1. Mark request rejected
    await supabaseAdmin
      .from('AccessRequest')
      .update({
        status: 'REJECTED',
        rejectedBy: req.user?.name || req.user?.email,
        rejectedAt: nowIso,
        updatedAt: nowIso
      })
      .eq('id', id);

    // 2. If user or device exists, revoke authorization
    if (accessReq.deviceIdentifier) {
      await supabaseAdmin
        .from('ApprovedDevice')
        .update({
          status: 'REVOKED',
          revokedAt: nowIso,
          updatedAt: nowIso
        })
        .eq('deviceIdentifier', accessReq.deviceIdentifier);
    }

    // Log security audit event
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'ACCESS_REQUEST_REJECTED',
      resource: 'AccessRequest',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      details: {
        applicantName: accessReq.fullName,
        applicantEmail: accessReq.email,
        reason: reason || 'Access denied by administrator',
        deviceIdentifier: accessReq.deviceIdentifier,
      },
    });

    // Notify user if exists
    if (accessReq.userId) {
      try {
        await createNotification({
          userId: accessReq.userId,
          title: 'Access Request Rejected',
          message: `Your access request was rejected. Reason: ${reason || 'Denied by administrator'}`,
          type: 'ACCESS_REJECTED',
          priority: 'NORMAL',
          senderId: req.user?.id,
          senderName: req.user?.name,
          senderRole: req.user?.role,
        });
      } catch (notifErr) {
        console.warn('[ACCESS REJECT NOTIF WARN]', notifErr);
      }
    }

    await broadcastServerChange('AccessRequest', 'UPDATE', id, { id, status: 'REJECTED' });

    return res.json({
      success: true,
      message: `Access request for ${accessReq.fullName} has been rejected.`,
    });
  } catch (err: any) {
    console.error('[REJECT ACCESS REQUEST ERROR]', err);
    return res.status(500).json({ error: 'Failed to reject access request.' });
  }
};

router.post('/access-requests/:id/reject', handleRejectAccessRequest);
router.post('/:id/reject', handleRejectAccessRequest);

// 11. POST /api/security/access-requests/:id/reset-attempts
const handleResetAttempts = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: accessReq, error: reqErr } = await supabaseAdmin
      .from('AccessRequest')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (reqErr || !accessReq) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    const nowIso = new Date().toISOString();

    await supabaseAdmin
      .from('AccessRequest')
      .update({
        requestNumber: 1,
        totalRequests: 1,
        status: 'PENDING',
        updatedAt: nowIso
      })
      .eq('id', id);

    if (accessReq.userId || accessReq.email) {
      const match = accessReq.userId ? { id: accessReq.userId } : { email: accessReq.email.toLowerCase() };
      await supabaseAdmin
        .from('User')
        .update({ failedLoginAttempts: 0, accountStatus: 'PENDING' })
        .match(match);
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'ACCESS_ATTEMPTS_RESET',
      resource: 'AccessRequest',
      resourceId: id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      details: { email: accessReq.email },
    });

    await broadcastServerChange('AccessRequest', 'UPDATE', id);

    return res.json({ success: true, message: 'Attempts reset and request reset to PENDING.' });
  } catch (err: any) {
    console.error('[RESET ATTEMPTS ERROR]', err);
    return res.status(500).json({ error: 'Failed to reset attempts.' });
  }
};

router.post('/access-requests/:id/reset-attempts', handleResetAttempts);
router.post('/:id/reset-attempts', handleResetAttempts);

// 12. POST /api/security/access-requests/system-repair
const handleSystemRepair = async (req: AuthRequest, res: Response) => {
  try {
    let repairedCount = 0;

    // A. Link orphaned access requests with existing users by email
    const { data: unlinkedRequests } = await supabaseAdmin
      .from('AccessRequest')
      .select('id, email, userId')
      .is('userId', null);

    if (unlinkedRequests && unlinkedRequests.length > 0) {
      for (const reqItem of unlinkedRequests) {
        if (reqItem.email) {
          const { data: user } = await supabaseAdmin
            .from('User')
            .select('id')
            .eq('email', reqItem.email.toLowerCase().trim())
            .maybeSingle();

          if (user) {
            await supabaseAdmin
              .from('AccessRequest')
              .update({ userId: user.id })
              .eq('id', reqItem.id);
            repairedCount++;
          }
        }
      }
    }

    // B. Fix active users without approved devices
    const { data: activeUsers } = await supabaseAdmin
      .from('User')
      .select('id, name, email')
      .eq('isActive', true)
      .neq('role', 'CUSTOMER');

    if (activeUsers) {
      for (const usr of activeUsers) {
        const { data: dev } = await supabaseAdmin
          .from('ApprovedDevice')
          .select('id')
          .eq('userId', usr.id)
          .maybeSingle();

        if (!dev) {
          await supabaseAdmin.from('ApprovedDevice').insert([
            {
              id: uuidv4(),
              userId: usr.id,
              deviceIdentifier: `legacy_${usr.id.substring(0, 8)}`,
              deviceName: 'Primary Workstation',
              deviceType: 'DESKTOP',
              status: 'APPROVED',
              approvedBy: 'System Auto-Repair',
              approvedAt: new Date().toISOString(),
              lastUsedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]);
          repairedCount++;
        }
      }
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'SECURITY_SYSTEM_REPAIR',
      resource: 'SecurityCenter',
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      details: { repairedCount },
    });

    return res.json({
      success: true,
      message: `System integrity repair complete. Synchronized ${repairedCount} security and device records.`,
      repairedCount
    });
  } catch (err: any) {
    console.error('[SECURITY REPAIR ERROR]', err);
    return res.status(500).json({ error: 'Failed to run security system repair.' });
  }
};

router.post('/access-requests/system-repair', handleSystemRepair);
router.post('/system-repair', handleSystemRepair);

export default router;
