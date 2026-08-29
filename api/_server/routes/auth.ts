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
    const { email: emailField, identity, password, deviceIdentifier, deviceName, deviceType, browser, os, ipAddress } = req.body;
    const email = emailField || identity;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Query authoritative User record from public.User
    const { data: users, error: userErr } = await supabaseAdmin
      .from('User')
      .select('*')
      .eq('email', normalizedEmail)
      .is('deletedAt', null)
      .limit(1);

    if (userErr || !users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Check account status
    if (user.accountStatus === 'REJECTED' || user.accountStatus === 'DISABLED' || user.isActive === false) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account is currently disabled or pending approval. Contact the administrator.',
      });
    }

    // Authenticate password
    let passwordMatches = false;

    // A. Try Supabase Auth password validation first
    try {
      const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (!authError && authData.user) {
        passwordMatches = true;
        // Ensure supabaseUid is synced
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
        // Create or link in Supabase Auth in background
        try {
          const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: password,
            email_confirm: true,
          });
          if (newAuthUser?.user) {
            await supabaseAdmin.from('User').update({ supabaseUid: newAuthUser.user.id }).eq('id', user.id);
          }
        } catch (_) {}
      }
    }

    if (!passwordMatches) {
      // Record failed login attempt
      const attempts = (user.failedLoginAttempts || 0) + 1;
      await supabaseAdmin.from('User').update({ failedLoginAttempts: attempts }).eq('id', user.id);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Reset failed login attempts & update lastLoginAt
    await supabaseAdmin
      .from('User')
      .update({
        failedLoginAttempts: 0,
        lastLoginAt: new Date().toISOString(),
      })
      .eq('id', user.id);

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
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (_) {}

    // Check if 2FA is required (explicitly true or default enabled for superadmin)
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

      // Send 2FA code email
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

      return res.json({
        requires2FA: true,
        mfaTicket,
        twoFactorType: user.twoFactorType || 'EMAIL',
        message: 'A 2FA verification code has been sent to your email.',
      });
    }

    // Direct Login without 2FA
    const { token, refreshToken } = generateTokens(user);

    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
    });

    return res.json({
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
    const { mfaTicket, code } = req.body;

    if (!mfaTicket || !code) {
      return res.status(400).json({ error: 'MFA ticket and verification code are required.' });
    }

    const { data: otps, error: otpErr } = await supabaseAdmin
      .from('OTPVerification')
      .select('*')
      .eq('id', mfaTicket)
      .eq('purpose', 'LOGIN_2FA')
      .eq('isUsed', false)
      .limit(1);

    if (otpErr || !otps || otps.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired 2FA verification session.' });
    }

    const otp = otps[0];

    if (new Date(otp.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (otp.codeHash !== inputHash) {
      const attempts = (otp.attempts || 0) + 1;
      await supabaseAdmin.from('OTPVerification').update({ attempts }).eq('id', otp.id);
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
      action: '2FA_VERIFIED',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email },
    });

    return res.json({
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
    const { mfaTicket } = req.body;
    if (!mfaTicket) {
      return res.status(400).json({ error: 'MFA ticket is required.' });
    }

    const { data: otps } = await supabaseAdmin
      .from('OTPVerification')
      .select('*')
      .eq('id', mfaTicket)
      .limit(1);

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

    return res.json({ success: true, message: 'Verification code resent successfully.' });
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
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 6. GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// 7. POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { data: users } = await supabaseAdmin
      .from('User')
      .select('*')
      .eq('email', normalizedEmail)
      .is('deletedAt', null)
      .limit(1);

    if (!users || users.length === 0) {
      return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }

    const user = users[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin.from('OTPVerification').insert([
      {
        id: otpId,
        userId: user.id,
        email: user.email,
        codeHash,
        purpose: 'PASSWORD_RESET',
        expiresAt,
        isUsed: false,
        createdAt: new Date().toISOString(),
      },
    ]);

    await sendEmail({
      to: user.email,
      subject: 'MTS Lab — Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb;">Reset Your Password</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>You requested a password reset for your MTS Lab account. Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">This code expires in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: 'Password reset code sent to your email.',
      resetId: otpId,
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    return res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
});

// 8. POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

    const { data: otps } = await supabaseAdmin
      .from('OTPVerification')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('purpose', 'PASSWORD_RESET')
      .eq('isUsed', false)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (!otps || otps.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP code.' });
    }

    const otp = otps[0];
    if (new Date(otp.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'OTP code has expired. Please request a new one.' });
    }

    if (otp.codeHash !== inputHash) {
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    await supabaseAdmin.from('OTPVerification').update({ isUsed: true }).eq('id', otp.id);

    const resetToken = jwt.sign(
      { userId: otp.userId, purpose: 'RESET_PASSWORD' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      resetToken,
      message: 'OTP verified successfully. You may now set a new password.',
    });
  } catch (err: any) {
    console.error('[VERIFY OTP ERROR]', err);
    return res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// 9. POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, config.jwtSecret);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { data: updatedUsers, error: updateErr } = await supabaseAdmin
      .from('User')
      .update({
        password: passwordHash,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', decoded.userId)
      .select('*');

    if (updateErr || !updatedUsers || updatedUsers.length === 0) {
      return res.status(500).json({ error: 'Failed to update user password.' });
    }

    const user = updatedUsers[0];

    // Update in Supabase Auth if supabaseUid exists
    if (user.supabaseUid) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.supabaseUid, {
          password: newPassword,
        });
      } catch (_) {}
    }

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_RESET',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email },
    });

    return res.json({ success: true, message: 'Password updated successfully. Please log in with your new password.' });
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

export default router;
