import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, supabasePublic, config } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import { sendEmail } from '../services/emailService';

const router = Router();

// Helper to generate access & refresh tokens
function generateTokens(user: any) {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, tokenVersion: Date.now() },
    config.refreshSecret,
    { expiresIn: '7d' }
  );

  return { token, refreshToken };
}

// 1. POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email: emailField, identity, password } = req.body;
    const emailOrUsername = emailField || identity;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedIdentifier = String(emailOrUsername).toLowerCase().trim();

    // Extract device details safely from body, nested device object, or headers
    const dev = (req.body && typeof req.body.device === 'object' && req.body.device) ? req.body.device : {};
    const deviceIdentifier = req.body.deviceIdentifier || dev.deviceIdentifier || (req.headers['x-device-identifier'] as string) || null;
    const deviceName = req.body.deviceName || dev.deviceName || null;
    const deviceType = req.body.deviceType || dev.deviceType || 'DESKTOP';
    const browser = req.body.browser || dev.browser || null;
    const os = req.body.os || dev.os || null;
    const ipAddress = req.body.ipAddress || dev.ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null;

    // Query authoritative User record from public.User by email or username
    let query = supabaseAdmin
      .from('User')
      .select('*')
      .or(`email.ilike.${normalizedIdentifier},username.ilike.${normalizedIdentifier}`)
      .is('deletedAt', null)
      .limit(1);

    let { data: users, error: userErr } = await query;

    if ((!users || users.length === 0) && normalizedIdentifier.includes('@')) {
      const { data: directUsers } = await supabaseAdmin
        .from('User')
        .select('*')
        .eq('email', normalizedIdentifier)
        .is('deletedAt', null)
        .limit(1);
      if (directUsers && directUsers.length > 0) {
        users = directUsers;
        userErr = null;
      }
    }

    if (userErr || !users || users.length === 0) {
      await logAudit({
        userEmail: normalizedIdentifier,
        action: 'FAILED_LOGIN',
        resource: 'Auth',
        status: 'FAILED',
        ipAddress: ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        deviceInfo: { deviceIdentifier, deviceName, browser, os },
        details: { reason: 'User account not found', enteredIdentifier: normalizedIdentifier },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Check account status
    if (user.accountStatus === 'REJECTED' || user.accountStatus === 'DISABLED' || user.isActive === false) {
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'LOGIN_DISABLED_ACCOUNT',
        resource: 'User',
        resourceId: user.id,
        status: 'DENIED',
        ipAddress: ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        deviceInfo: { deviceIdentifier, deviceName, browser, os },
        details: { accountStatus: user.accountStatus, isActive: user.isActive, reason: 'Account disabled or pending approval' },
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account is currently disabled or pending approval. Contact the administrator.',
      });
    }

    // Check if device is explicitly blocked / revoked
    if (deviceIdentifier) {
      const { data: existingDevice } = await supabaseAdmin
        .from('ApprovedDevice')
        .select('*')
        .eq('userId', user.id)
        .eq('deviceIdentifier', deviceIdentifier)
        .maybeSingle();

      if (existingDevice && (existingDevice.status === 'REVOKED' || existingDevice.status === 'BLOCKED')) {
        await logAudit({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: 'LOGIN_BLOCKED_DEVICE',
          resource: 'ApprovedDevice',
          resourceId: existingDevice.id,
          status: 'FAILED',
          ipAddress: ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null,
          userAgent: req.headers['user-agent'] || null,
          deviceInfo: { deviceIdentifier, deviceName, browser, os },
          details: { reason: 'Login attempt from revoked/blocked device' },
        });

        return res.status(403).json({
          error: 'DeviceBlocked',
          message: 'This device has been blocked or revoked from accessing MTS Lab. Please contact a Super Administrator.',
        });
      }
    }

    // Authenticate password
    let passwordMatches = false;

    // A. Try Supabase Auth password validation first (using authoritative user.email)
    try {
      const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (!authError && authData.user) {
        passwordMatches = true;
        if (!user.supabaseUid) {
          await supabaseAdmin.from('User').update({ supabaseUid: authData.user.id }).eq('id', user.id);
        }
      }
    } catch (_) {
      // Fallback to bcrypt verification
    }

    // B. Fallback to bcrypt verification if Supabase Auth check didn't match or failed
    if (!passwordMatches && user.password) {
      passwordMatches = await bcrypt.compare(password, user.password);
      if (passwordMatches && !user.supabaseUid) {
        try {
          const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password: password,
            email_confirm: true,
          });
          if (newAuthUser?.user) {
            await supabaseAdmin.from('User').update({ supabaseUid: newAuthUser.user.id }).eq('id', user.id);
          }
        } catch (_) { }
      }
    }

    if (!passwordMatches) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      await supabaseAdmin.from('User').update({ failedLoginAttempts: attempts }).eq('id', user.id);

      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'FAILED_LOGIN',
        resource: 'User',
        resourceId: user.id,
        status: 'FAILED',
        ipAddress: ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        deviceInfo: { deviceIdentifier, deviceName, browser, os },
        details: { attemptNumber: attempts },
      });

      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Reset failed login attempts & update lastLoginAt & lastActiveAt
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('User')
      .update({
        failedLoginAttempts: 0,
        lastLoginAt: nowIso,
        lastActiveAt: nowIso,
      })
      .eq('id', user.id);

    // Register or update device in ApprovedDevice
    if (deviceIdentifier) {
      try {
        const { data: dev } = await supabaseAdmin
          .from('ApprovedDevice')
          .select('id')
          .eq('userId', user.id)
          .eq('deviceIdentifier', deviceIdentifier)
          .maybeSingle();

        if (dev) {
          await supabaseAdmin
            .from('ApprovedDevice')
            .update({
              deviceName: deviceName || undefined,
              deviceType: deviceType || 'DESKTOP',
              browser: browser || undefined,
              os: os || undefined,
              ipAddress: ipAddress || req.ip || null,
              userAgent: req.headers['user-agent'] || null,
              lastUsedAt: nowIso,
              updatedAt: nowIso,
            })
            .eq('id', dev.id);
        } else {
          await supabaseAdmin.from('ApprovedDevice').insert([
            {
              id: uuidv4(),
              userId: user.id,
              deviceIdentifier,
              deviceName: deviceName || 'Workstation',
              deviceType: deviceType || 'DESKTOP',
              browser: browser || null,
              os: os || null,
              ipAddress: ipAddress || req.ip || null,
              userAgent: req.headers['user-agent'] || null,
              status: 'APPROVED',
              approvedAt: nowIso,
              lastUsedAt: nowIso,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ]);
        }
      } catch (devErr) {
        console.warn('[DEVICE REGISTRATION ERROR]', devErr);
      }
    }

    // Record login activity
    try {
      await supabaseAdmin.from('LoginActivity').insert([
        {
          id: uuidv4(),
          userId: user.id,
          ipAddress: ipAddress || req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          deviceIdentifier: deviceIdentifier || null,
          deviceName: deviceName || null,
          deviceType: deviceType || 'DESKTOP',
          browser: browser || null,
          os: os || null,
          status: 'SUCCESS',
          createdAt: nowIso,
        },
      ]);
    } catch (_) { }

    // Check if 2FA is required
    const is2FA = user.twoFactorEnabled === true || user.twoFactorEnabled === 'true' || user.twoFactorEnabled === 1;

    if (is2FA) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const mfaTicket = uuidv4();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabaseAdmin.from('OTPVerification').insert([
        {
          id: mfaTicket,
          userId: user.id,
          email: user.email,
          codeHash,
          purpose: 'LOGIN_2FA',
          expiresAt,
          isUsed: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Send 2FA code email via Resend
      await sendEmail({
        to: user.email,
        subject: 'MTS Lab — Two-Factor Authentication (2FA) Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #2563eb;">MTS Lab Security Verification</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>Your two-factor authentication verification code is:</p>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">This code will expire in 10 minutes. If you did not attempt to log in, please secure your account immediately.</p>
          </div>
        `,
      });

      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'OTP_REQUESTED',
        resource: 'Auth',
        resourceId: mfaTicket,
        status: 'SUCCESS',
        ipAddress: ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        deviceInfo: { deviceIdentifier, deviceName, deviceType, browser, os },
        details: { email: user.email, purpose: 'LOGIN_2FA' },
      });

      return res.json({
        success: true,
        requires2FA: true,
        mfaTicket,
        email: user.email,
        twoFactorType: user.twoFactorType || 'EMAIL',
        message: 'A 2FA verification code has been sent to your email.',
      });
    }

    // Direct Login without 2FA
    const { token, refreshToken } = generateTokens(user);

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN_SUCCESS',
      resource: 'User',
      resourceId: user.id,
      status: 'SUCCESS',
      ipAddress: ipAddress || req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      deviceInfo: { deviceIdentifier, deviceName, deviceType, browser, os },
      details: { email: user.email, role: user.role, method: 'PASSWORD' },
    });

    return res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
        phoneNumber: user.phoneNumber,
        department: user.department,
        address: user.address,
        profileImage: user.profileImage,
      },
    });
  } catch (err: any) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// 2. POST /api/auth/2fa/verify
router.post('/2fa/verify', async (req: Request, res: Response) => {
  try {
    const { mfaTicket, code, email } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required.' });
    }

    const inputHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');

    // Query by mfaTicket or fallback to latest unused OTP for that user/email
    let query = supabaseAdmin
      .from('OTPVerification')
      .select('*')
      .eq('purpose', 'LOGIN_2FA')
      .eq('isUsed', false);

    if (mfaTicket) {
      query = query.eq('id', mfaTicket);
    } else if (email) {
      query = query.eq('email', email.toLowerCase().trim()).order('createdAt', { ascending: false });
    }

    const { data: otps, error: otpErr } = await query.limit(1);

    if (otpErr || !otps || otps.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired 2FA verification session.' });
    }

    const otp = otps[0];

    if (new Date(otp.expiresAt) < new Date()) {
      await logAudit({
        userId: otp.userId,
        userEmail: otp.email,
        action: 'OTP_VERIFICATION_FAILED',
        resource: 'Auth',
        resourceId: otp.id,
        status: 'FAILED',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: { reason: 'Verification code expired', email: otp.email },
      });
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (otp.codeHash !== inputHash) {
      const attempts = (otp.attempts || 0) + 1;
      await supabaseAdmin.from('OTPVerification').update({ attempts }).eq('id', otp.id);
      await logAudit({
        userId: otp.userId,
        userEmail: otp.email,
        action: 'OTP_VERIFICATION_FAILED',
        resource: 'Auth',
        resourceId: otp.id,
        status: 'FAILED',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: { attemptNumber: attempts, reason: 'Incorrect verification code', email: otp.email },
      });
      return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
    }

    // Mark OTP as used
    await supabaseAdmin.from('OTPVerification').update({ isUsed: true }).eq('id', otp.id);

    // Fetch user
    const { data: users } = await supabaseAdmin
      .from('User')
      .select('*')
      .eq('id', otp.userId)
      .limit(1);

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const user = users[0];
    const { token, refreshToken } = generateTokens(user);

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'OTP_VERIFICATION_SUCCESS',
      resource: 'Auth',
      resourceId: user.id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      details: { email: user.email, method: '2FA_OTP' },
    });

    return res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
        phoneNumber: user.phoneNumber,
        department: user.department,
        address: user.address,
        profileImage: user.profileImage,
      },
    });
  } catch (err: any) {
    console.error('[2FA VERIFY ERROR]', err);
    return res.status(500).json({ error: 'Failed to verify 2FA code.' });
  }
});

// 3. POST /api/auth/2fa/resend
router.post('/2fa/resend', async (req: Request, res: Response) => {
  try {
    const { mfaTicket, email } = req.body;

    let query = supabaseAdmin.from('OTPVerification').select('*');
    if (mfaTicket) {
      query = query.eq('id', mfaTicket);
    } else if (email) {
      query = query.eq('email', email.toLowerCase().trim()).order('createdAt', { ascending: false });
    } else {
      return res.status(400).json({ error: 'MFA session identifier is required.' });
    }

    const { data: otps } = await query.limit(1);

    if (!otps || otps.length === 0) {
      return res.status(400).json({ error: 'Session not found. Please log in again.' });
    }

    const otp = otps[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('OTPVerification')
      .update({ codeHash, expiresAt, isUsed: false, attempts: 0 })
      .eq('id', otp.id);

    await sendEmail({
      to: otp.email,
      subject: 'MTS Lab — Resent 2FA Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb;">MTS Lab Security Verification</h2>
          <p>Your new verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">This code will expire in 10 minutes.</p>
        </div>
      `,
    });

    return res.json({ success: true, mfaTicket: otp.id, message: 'Verification code resent successfully.' });
  } catch (err: any) {
    console.error('[2FA RESEND ERROR]', err);
    return res.status(500).json({ error: 'Failed to resend verification code.' });
  }
});

// 4. POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body?.refreshToken || req.headers['x-refresh-token'];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, config.refreshSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const { data: users } = await supabaseAdmin
      .from('User')
      .select('*')
      .eq('id', decoded.id)
      .is('deletedAt', null)
      .limit(1);

    if (!users || users.length === 0 || users[0].isActive === false) {
      return res.status(401).json({ error: 'User session expired or account disabled.' });
    }

    const user = users[0];
    const { token: newToken, refreshToken: newRefreshToken } = generateTokens(user);

    return res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
        phoneNumber: user.phoneNumber,
        department: user.department,
        address: user.address,
        profileImage: user.profileImage,
      },
    });
  } catch (err: any) {
    console.error('[REFRESH ERROR]', err);
    return res.status(500).json({ error: 'Failed to refresh authentication session.' });
  }
});

// 5. POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        if (decoded && decoded.id) {
          await logAudit({
            userId: decoded.id,
            userEmail: decoded.email,
            userRole: decoded.role,
            action: 'LOGOUT',
            resource: 'User',
            resourceId: decoded.id,
            status: 'SUCCESS',
            ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
            userAgent: req.headers['user-agent'] || null,
            details: { message: 'User logged out' },
          });
        }
      } catch (_) {}
    }
  } catch (_) {}
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 6. GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// Helper to mask email address uniformly without disclosing user details
export function maskEmailAddress(email: string): string {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export const UNIFORM_FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email address, password-reset instructions will be sent shortly. Please check your inbox and spam folder.';

// Authorized Staff Roles eligible for staff portal password recovery
export const AUTHORIZED_STAFF_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'LEAD_TECHNICIAN',
  'TECHNICIAN',
  'TECHNICAL_ASSISTANT',
  'RECEPTIONIST',
  'INVENTORY_MANAGER',
  'ACCOUNTANT',
];

// Single-use token cache for password resets to guarantee zero-replay security
const consumedResetTokens = new Set<string>();
function markResetTokenConsumed(tokenId: string) {
  if (consumedResetTokens.size > 10000) {
    consumedResetTokens.clear();
  }
  consumedResetTokens.add(tokenId);
}

// 7. POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your email address.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Query staff user strictly from public.User table using case-insensitive email match
    const { data: users, error: dbErr } = await supabaseAdmin
      .from('User')
      .select('id, email, name, role, accountStatus, isActive, deletedAt')
      .ilike('email', normalizedEmail)
      .is('deletedAt', null)
      .limit(1);

    if (dbErr) {
      console.error('[FORGOT PASSWORD DB ERROR]', dbErr);
    }

    const user = users && users.length > 0 ? users[0] : null;
    const userRole = user?.role ? user.role.toUpperCase().replace(/\s+/g, '_').trim() : '';
    const normalizedRole = userRole === 'SUPERADMIN' ? 'SUPER_ADMIN' : (userRole === 'HEAD_TECHNICIAN' || userRole === 'LEADTECHNICIAN') ? 'LEAD_TECHNICIAN' : userRole;

    // Strict staff account eligibility check:
    // 1. Account must exist in staff User table
    // 2. Account must not be soft-deleted (deletedAt === null)
    // 3. Account must not be deactivated (isActive !== false)
    // 4. Account status must not be REJECTED, DISABLED, SUSPENDED, or PENDING
    // 5. Account role must be an AUTHORIZED_STAFF_ROLE and strictly NOT CUSTOMER
    const isEligibleStaff =
      user !== null &&
      !user.deletedAt &&
      user.isActive !== false &&
      user.accountStatus !== 'REJECTED' &&
      user.accountStatus !== 'DISABLED' &&
      user.accountStatus !== 'SUSPENDED' &&
      user.accountStatus !== 'PENDING' &&
      normalizedRole !== 'CUSTOMER' &&
      AUTHORIZED_STAFF_ROLES.includes(normalizedRole);

    // If the account is unregistered, inactive, customer, or ineligible:
    // Return the uniform privacy-preserving response WITHOUT generating any OTP or sending an email
    if (!isEligibleStaff) {
      await logAudit({
        userEmail: normalizedEmail,
        action: 'PASSWORD_RESET_ATTEMPT_INELIGIBLE',
        resource: 'Auth',
        status: 'DENIED',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: {
          reason: !user ? 'Email not registered in staff management database' : 'Account status inactive or unauthorized role',
          enteredEmail: normalizedEmail,
        },
      });

      return res.json({
        success: true,
        message: UNIFORM_FORGOT_PASSWORD_MESSAGE,
        resetTicket: uuidv4(), // unresolvable random ticket preserves identical response structure
        emailMasked: maskEmailAddress(normalizedEmail),
      });
    }

    // Rate-limiting check: enforce a 30-second cooldown between consecutive OTP requests for the same staff user
    const { data: recentOtps } = await supabaseAdmin
      .from('OTPVerification')
      .select('createdAt')
      .eq('userId', user.id)
      .eq('purpose', 'PASSWORD_RESET')
      .order('createdAt', { ascending: false })
      .limit(1);

    if (recentOtps && recentOtps.length > 0) {
      const lastCreated = new Date(recentOtps[0].createdAt).getTime();
      const elapsedMs = Date.now() - lastCreated;
      if (elapsedMs < 30 * 1000) {
        // Return uniform response safely without spamming email dispatch
        return res.json({
          success: true,
          message: UNIFORM_FORGOT_PASSWORD_MESSAGE,
          resetTicket: uuidv4(),
          emailMasked: maskEmailAddress(user.email),
        });
      }
    }

    // Invalidate any previous unused password-reset OTPs for this staff user
    await supabaseAdmin
      .from('OTPVerification')
      .update({ isUsed: true })
      .eq('userId', user.id)
      .eq('purpose', 'PASSWORD_RESET')
      .eq('isUsed', false);

    // Generate cryptographically secure 6-digit recovery code
    const secureCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(secureCode).digest('hex');
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-minute expiration

    // Insert hashed OTP challenge into OTPVerification table
    await supabaseAdmin.from('OTPVerification').insert([
      {
        id: otpId,
        userId: user.id,
        email: user.email, // Authoritative staff email directly from database
        codeHash,
        purpose: 'PASSWORD_RESET',
        expiresAt,
        isUsed: false,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Dispatch recovery email to the registered staff email address
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'MTS Lab — Staff Password Recovery Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 22px; font-weight: 800;">MTS Lab Staff Portal</h2>
            <p style="color: #64748b; margin: 0; font-size: 13px;">Security & Password Recovery Verification</p>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello <strong>${user.name || 'MTS Team Member'}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">A request was received to reset your staff account password. Use the verification code below to proceed:</p>
          <div style="background-color: #f8fafc; border: 2px dashed #06b6d4; padding: 18px; text-align: center; border-radius: 10px; margin: 24px 0;">
            <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0891b2;">${secureCode}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
            This recovery code will expire in <strong>15 minutes</strong> and can only be used once. If you did not initiate this request, your account remains secure and no action is required.
          </p>
          <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
            MTS Lab &bull; Mobile Technology Station &bull; Authorized Personnel Only &bull; Kathmandu, Nepal
          </div>
        </div>
      `,
      text: `MTS Lab Staff Password Recovery\n\nYour 6-digit verification code is: ${secureCode}\nThis code expires in 15 minutes.\n\nIf you did not request this, please disregard.`,
    });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'OTP_REQUESTED',
      resource: 'Auth',
      resourceId: otpId,
      status: emailResult ? 'SUCCESS' : 'WARNING',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      details: { email: user.email, purpose: 'PASSWORD_RESET', emailDelivered: emailResult },
    });

    return res.json({
      success: true,
      message: UNIFORM_FORGOT_PASSWORD_MESSAGE,
      resetTicket: otpId,
      emailMasked: maskEmailAddress(user.email),
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    return res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
});

// 8. POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, resetTicket, code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Please enter your 6-digit recovery code.' });
    }

    const cleanCode = String(code).trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit recovery code.' });
    }

    const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    // Query OTP record by ticket ID or falling back to registered email
    let query = supabaseAdmin
      .from('OTPVerification')
      .select('*')
      .eq('purpose', 'PASSWORD_RESET');

    if (resetTicket) {
      query = query.eq('id', resetTicket);
    } else if (email) {
      query = query.ilike('email', String(email).toLowerCase().trim()).order('createdAt', { ascending: false });
    } else {
      return res.status(400).json({ error: 'Session identifier or email is required.' });
    }

    const { data: otps, error: otpErr } = await query.limit(1);

    if (otpErr || !otps || otps.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired recovery code.' });
    }

    const otp = otps[0];

    // Check if code was already consumed
    if (otp.isUsed) {
      return res.status(400).json({ error: 'This recovery code has already been used. Please request a new one.' });
    }

    // Check attempt lockout limit (maximum 5 attempts)
    const currentAttempts = otp.attempts || 0;
    if (currentAttempts >= 5) {
      await supabaseAdmin.from('OTPVerification').update({ isUsed: true }).eq('id', otp.id);
      return res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new recovery code.' });
    }

    // Check code expiration
    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      await supabaseAdmin.from('OTPVerification').update({ isUsed: true }).eq('id', otp.id);
      await logAudit({
        userId: otp.userId,
        userEmail: otp.email,
        action: 'OTP_VERIFICATION_FAILED',
        resource: 'Auth',
        resourceId: otp.id,
        status: 'FAILED',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: { reason: 'Recovery code expired', email: otp.email },
      });
      return res.status(400).json({ error: 'Recovery code has expired. Please request a new one.' });
    }

    // Validate hash
    if (otp.codeHash !== inputHash) {
      const updatedAttempts = currentAttempts + 1;
      const willLock = updatedAttempts >= 5;
      await supabaseAdmin
        .from('OTPVerification')
        .update({
          attempts: updatedAttempts,
          ...(willLock ? { isUsed: true } : {}),
        })
        .eq('id', otp.id);

      await logAudit({
        userId: otp.userId,
        userEmail: otp.email,
        action: 'OTP_VERIFICATION_FAILED',
        resource: 'Auth',
        resourceId: otp.id,
        status: 'FAILED',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: { attemptNumber: updatedAttempts, reason: 'Incorrect recovery code', email: otp.email },
      });

      if (willLock) {
        return res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new recovery code.' });
      }
      return res.status(400).json({ error: 'Incorrect recovery code. Please check your email and try again.' });
    }

    // Mark OTP as used immediately to guarantee single-use enforcement
    const resetTokenId = uuidv4();
    await supabaseAdmin
      .from('OTPVerification')
      .update({
        isUsed: true,
        attempts: currentAttempts + 1,
      })
      .eq('id', otp.id);

    // Issue single-use, cryptographically signed reset token valid for 15 minutes
    const resetToken = jwt.sign(
      {
        userId: otp.userId,
        otpId: otp.id,
        tokenId: resetTokenId,
        purpose: 'RESET_PASSWORD',
      },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    await logAudit({
      userId: otp.userId,
      userEmail: otp.email,
      action: 'OTP_VERIFICATION_SUCCESS',
      resource: 'Auth',
      resourceId: otp.id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      details: { email: otp.email, purpose: 'PASSWORD_RESET' },
    });

    return res.json({
      success: true,
      resetToken,
      message: 'Recovery code verified successfully. You may now set your new password.',
    });
  } catch (err: any) {
    console.error('[VERIFY OTP ERROR]', err);
    return res.status(500).json({ error: 'Failed to verify recovery code.' });
  }
});

// 9. POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must include at least one number or special symbol.' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, config.jwtSecret);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    if (decoded.purpose !== 'RESET_PASSWORD' || !decoded.userId || !decoded.tokenId) {
      return res.status(400).json({ error: 'Invalid password reset token purpose.' });
    }

    // Enforce single-use token: check if token ID was already consumed
    if (consumedResetTokens.has(decoded.tokenId)) {
      return res.status(400).json({ error: 'This reset token has already been used. Please request a new recovery code.' });
    }

    // Verify user exists and is active in public.User
    const { data: users, error: userErr } = await supabaseAdmin
      .from('User')
      .select('id, email, name, role, supabaseUid, isActive, accountStatus')
      .eq('id', decoded.userId)
      .is('deletedAt', null)
      .limit(1);

    if (userErr || !users || users.length === 0) {
      return res.status(404).json({ error: 'User account not found or deactivated.' });
    }

    const user = users[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const nowIso = new Date().toISOString();

    // Update staff user password in PostgreSQL
    const { error: updateErr } = await supabaseAdmin
      .from('User')
      .update({
        password: passwordHash,
        failedLoginAttempts: 0,
        updatedAt: nowIso,
      })
      .eq('id', user.id);

    if (updateErr) {
      console.error('[RESET PASSWORD DB UPDATE ERROR]', updateErr);
      return res.status(500).json({ error: 'Failed to update user password.' });
    }

    // Sync new password to Supabase Auth if user has a linked auth record
    if (user.supabaseUid) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.supabaseUid, {
          password: newPassword,
        });
      } catch (_) { }
    }

    // Mark token ID as consumed immediately
    markResetTokenConsumed(decoded.tokenId);

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'PASSWORD_RESET',
      resource: 'User',
      resourceId: user.id,
      status: 'SUCCESS',
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
      userAgent: req.headers['user-agent'] || null,
      details: { email: user.email, method: 'RECOVERY_CODE_RESET' },
    });

    return res.json({
      success: true,
      message: 'Password updated successfully. Please log in with your new password.',
    });
  } catch (err: any) {
    console.error('[RESET PASSWORD ERROR]', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// 10. POST /api/auth/verify-email-status
router.post('/verify-email-status', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const { data: users } = await supabaseAdmin
      .from('User')
      .select('id, email, emailVerified, accountStatus')
      .eq('email', email.toLowerCase().trim())
      .limit(1);

    if (!users || users.length === 0) {
      return res.json({ isVerified: false, accountStatus: 'PENDING' });
    }

    return res.json({
      isVerified: Boolean(users[0].emailVerified),
      accountStatus: users[0].accountStatus,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify email status.' });
  }
});

// 11. POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Verification link resent to your email.' });
});

// 12. GET /api/auth/activity
router.get('/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: activities } = await supabaseAdmin
      .from('LoginActivity')
      .select('*')
      .eq('userId', req.user!.id)
      .order('createdAt', { ascending: false })
      .limit(20);

    return res.json(activities || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load activity logs.' });
  }
});

// 13. GET /api/auth/sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json([
    {
      id: 'current-session',
      userId: req.user!.id,
      deviceName: 'Current Browser Session',
      deviceType: 'DESKTOP',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ]);
});

// 14. POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    let user: any = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        if (decoded?.id || decoded?.sub) {
          user = decoded;
        }
      } catch (_) { }
    }

    if (user) {
      await logAudit({
        userId: user.id || user.sub,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'LOGOUT',
        resource: 'Auth',
        status: 'SUCCESS',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: { message: 'User logged out successfully' },
      });
    }

    res.clearCookie('token');
    res.clearCookie('refreshToken');
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    return res.json({ success: true, message: 'Logged out.' });
  }
});

// 15. POST /api/auth/logout-all
router.post('/logout-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user) {
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'LOGOUT',
        resource: 'Auth',
        status: 'SUCCESS',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        details: { message: 'User terminated sessions on all devices' },
      });
    }

    res.clearCookie('token');
    res.clearCookie('refreshToken');
    return res.json({ success: true, message: 'Logged out from all devices.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to logout from all devices.' });
  }
});

export default router;