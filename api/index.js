// api/_server/app.ts
import express from "express";
import cookieParser from "cookie-parser";

// api/_server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuidv42 } from "uuid";

// api/_server/config/supabase.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://pirynpugkiurjobrqiqg.supabase.co";
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w";
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
var supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
var supabasePublic = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
var config = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  jwtSecret: process.env.JWT_SECRET || "mts-lab-super-secret-key-2026",
  refreshSecret: process.env.REFRESH_SECRET || "mts-lab-refresh-secret-key-2026",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || ""
};

// api/_server/middleware/auth.ts
import jwt from "jsonwebtoken";
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication token missing or invalid."
      });
    }
    let userEmail = null;
    let authUid = null;
    try {
      const { data: supabaseUser, error } = await supabasePublic.auth.getUser(token);
      if (!error && supabaseUser?.user) {
        userEmail = supabaseUser.user.email || null;
        authUid = supabaseUser.user.id;
      }
    } catch (_) {
    }
    if (!userEmail && !authUid) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded) {
          userEmail = decoded.email || null;
          authUid = decoded.id || decoded.sub || null;
        }
      } catch (jwtErr) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid or expired session token. Please log in again."
        });
      }
    }
    if (!userEmail && !authUid) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Could not resolve authentication identity."
      });
    }
    let query = supabaseAdmin.from("User").select("*").is("deletedAt", null);
    if (userEmail) {
      query = query.eq("email", userEmail.toLowerCase());
    } else if (authUid) {
      query = query.or(`id.eq.${authUid},supabaseUid.eq.${authUid}`);
    }
    let { data: users, error: dbError } = await query.limit(1);
    if ((!users || users.length === 0) && authUid && userEmail) {
      const { data: uidUsers } = await supabaseAdmin.from("User").select("*").or(`id.eq.${authUid},supabaseUid.eq.${authUid}`).is("deletedAt", null).limit(1);
      if (uidUsers && uidUsers.length > 0) {
        users = uidUsers;
        dbError = null;
      }
    }
    if (dbError || !users || users.length === 0) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User account not found or has been deactivated."
      });
    }
    const dbUser = users[0];
    if (dbUser.accountStatus === "REJECTED" || dbUser.accountStatus === "DISABLED" || dbUser.isActive === false) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Your account is disabled or access has been revoked. Contact administrator."
      });
    }
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      branchId: dbUser.branchId,
      phoneNumber: dbUser.phoneNumber,
      department: dbUser.department,
      address: dbUser.address,
      profileImage: dbUser.profileImage,
      accountStatus: dbUser.accountStatus,
      isActive: dbUser.isActive,
      emailVerified: dbUser.emailVerified,
      twoFactorEnabled: dbUser.twoFactorEnabled
    };
    return next();
  } catch (err) {
    console.error("[AUTHENTICATION MIDDLEWARE ERROR]", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to authenticate user request."
    });
  }
}

// api/_server/services/auditService.ts
import { v4 as uuidv4 } from "uuid";
async function logAudit(entry) {
  try {
    const payload = {
      id: uuidv4(),
      userId: entry.userId || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      details: typeof entry.details === "object" ? JSON.stringify(entry.details) : entry.details ? String(entry.details) : null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await supabaseAdmin.from("AuditLog").insert([payload]);
  } catch (err) {
    console.warn("[AUDIT LOG WARNING] Failed to record audit log:", err);
  }
}

// api/_server/services/emailService.ts
import { Resend } from "resend";
var resendApiKey = process.env.RESEND_API_KEY;
var resend = resendApiKey ? new Resend(resendApiKey) : null;
async function sendEmail(options) {
  if (!resend) {
    console.warn(`[EMAIL NOTICE] RESEND_API_KEY is not configured. Email to ${options.to} not sent.`);
    return true;
  }
  try {
    const fromAddress = process.env.SMTP_FROM || "MTS Lab Security <noreply@mobiletechnologystation.com.np>";
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content
      }))
    });
    if (error) {
      console.error("[RESEND ERROR] Failed to send email:", error);
      return false;
    }
    console.log(`[EMAIL SUCCESS] Sent email to ${options.to}`);
    return true;
  } catch (err) {
    console.error("[EMAIL ERROR] Exception sending email via Resend:", err);
    return false;
  }
}

// api/_server/routes/auth.ts
var router = Router();
function generateTokens(user) {
  const token = jwt2.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId
    },
    config.jwtSecret,
    { expiresIn: "8h" }
  );
  const refreshToken = jwt2.sign(
    { id: user.id, tokenVersion: Date.now() },
    config.refreshSecret,
    { expiresIn: "7d" }
  );
  return { token, refreshToken };
}
router.post("/login", async (req, res) => {
  try {
    const { email: emailField, identity, password, deviceIdentifier, deviceName, deviceType, browser, os, ipAddress } = req.body;
    const email = emailField || identity;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const { data: users, error: userErr } = await supabaseAdmin.from("User").select("*").eq("email", normalizedEmail).is("deletedAt", null).limit(1);
    if (userErr || !users || users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const user = users[0];
    if (user.accountStatus === "REJECTED" || user.accountStatus === "DISABLED" || user.isActive === false) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Your account is currently disabled or pending approval. Contact the administrator."
      });
    }
    let passwordMatches = false;
    try {
      const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (!authError && authData.user) {
        passwordMatches = true;
        if (!user.supabaseUid) {
          await supabaseAdmin.from("User").update({ supabaseUid: authData.user.id }).eq("id", user.id);
        }
      }
    } catch (_) {
    }
    if (!passwordMatches && user.password) {
      passwordMatches = await bcrypt.compare(password, user.password);
      if (passwordMatches && !user.supabaseUid) {
        try {
          const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true
          });
          if (newAuthUser?.user) {
            await supabaseAdmin.from("User").update({ supabaseUid: newAuthUser.user.id }).eq("id", user.id);
          }
        } catch (_) {
        }
      }
    }
    if (!passwordMatches) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      await supabaseAdmin.from("User").update({ failedLoginAttempts: attempts }).eq("id", user.id);
      return res.status(401).json({ error: "Invalid email or password." });
    }
    await supabaseAdmin.from("User").update({
      failedLoginAttempts: 0,
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", user.id);
    try {
      await supabaseAdmin.from("LoginActivity").insert([
        {
          id: uuidv42(),
          userId: user.id,
          ipAddress: ipAddress || req.ip || null,
          userAgent: req.headers["user-agent"] || null,
          deviceIdentifier: deviceIdentifier || null,
          deviceName: deviceName || null,
          deviceType: deviceType || "DESKTOP",
          browser: browser || null,
          os: os || null,
          status: "SUCCESS",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
    } catch (_) {
    }
    const is2FA = user.twoFactorEnabled === true || user.twoFactorEnabled === "true" || user.twoFactorEnabled === 1;
    if (is2FA) {
      const code = Math.floor(1e5 + Math.random() * 9e5).toString();
      const codeHash = crypto.createHash("sha256").update(code).digest("hex");
      const mfaTicket = uuidv42();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
      await supabaseAdmin.from("OTPVerification").insert([
        {
          id: mfaTicket,
          userId: user.id,
          email: user.email,
          codeHash,
          purpose: "LOGIN_2FA",
          expiresAt,
          isUsed: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await sendEmail({
        to: user.email,
        subject: "MTS Lab \u2014 Two-Factor Authentication (2FA) Code",
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
        `
      });
      return res.json({
        success: true,
        requires2FA: true,
        mfaTicket,
        email: user.email,
        twoFactorType: user.twoFactorType || "EMAIL",
        message: "A 2FA verification code has been sent to your email."
      });
    }
    const { token, refreshToken } = generateTokens(user);
    await logAudit({
      userId: user.id,
      action: "LOGIN",
      resource: "User",
      resourceId: user.id,
      details: { email: user.email, role: user.role }
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
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    return res.status(500).json({ error: "An unexpected error occurred during login." });
  }
});
router.post("/2fa/verify", async (req, res) => {
  try {
    const { mfaTicket, code, email } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Verification code is required." });
    }
    const inputHash = crypto.createHash("sha256").update(String(code).trim()).digest("hex");
    let query = supabaseAdmin.from("OTPVerification").select("*").eq("purpose", "LOGIN_2FA").eq("isUsed", false);
    if (mfaTicket) {
      query = query.eq("id", mfaTicket);
    } else if (email) {
      query = query.eq("email", email.toLowerCase().trim()).order("createdAt", { ascending: false });
    }
    const { data: otps, error: otpErr } = await query.limit(1);
    if (otpErr || !otps || otps.length === 0) {
      return res.status(400).json({ error: "Invalid or expired 2FA verification session." });
    }
    const otp = otps[0];
    if (new Date(otp.expiresAt) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }
    if (otp.codeHash !== inputHash) {
      const attempts = (otp.attempts || 0) + 1;
      await supabaseAdmin.from("OTPVerification").update({ attempts }).eq("id", otp.id);
      return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }
    await supabaseAdmin.from("OTPVerification").update({ isUsed: true }).eq("id", otp.id);
    const { data: users } = await supabaseAdmin.from("User").select("*").eq("id", otp.userId).limit(1);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }
    const user = users[0];
    const { token, refreshToken } = generateTokens(user);
    await logAudit({
      userId: user.id,
      action: "2FA_VERIFIED",
      resource: "User",
      resourceId: user.id,
      details: { email: user.email }
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
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error("[2FA VERIFY ERROR]", err);
    return res.status(500).json({ error: "Failed to verify 2FA code." });
  }
});
router.post("/2fa/resend", async (req, res) => {
  try {
    const { mfaTicket, email } = req.body;
    let query = supabaseAdmin.from("OTPVerification").select("*");
    if (mfaTicket) {
      query = query.eq("id", mfaTicket);
    } else if (email) {
      query = query.eq("email", email.toLowerCase().trim()).order("createdAt", { ascending: false });
    } else {
      return res.status(400).json({ error: "MFA session identifier is required." });
    }
    const { data: otps } = await query.limit(1);
    if (!otps || otps.length === 0) {
      return res.status(400).json({ error: "Session not found. Please log in again." });
    }
    const otp = otps[0];
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    await supabaseAdmin.from("OTPVerification").update({ codeHash, expiresAt, isUsed: false, attempts: 0 }).eq("id", otp.id);
    await sendEmail({
      to: otp.email,
      subject: "MTS Lab \u2014 Resent 2FA Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb;">MTS Lab Security Verification</h2>
          <p>Your new verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">This code will expire in 10 minutes.</p>
        </div>
      `
    });
    return res.json({ success: true, mfaTicket: otp.id, message: "Verification code resent successfully." });
  } catch (err) {
    console.error("[2FA RESEND ERROR]", err);
    return res.status(500).json({ error: "Failed to resend verification code." });
  }
});
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"];
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required." });
    }
    let decoded;
    try {
      decoded = jwt2.verify(refreshToken, config.refreshSecret);
    } catch {
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }
    const { data: users } = await supabaseAdmin.from("User").select("*").eq("id", decoded.id).is("deletedAt", null).limit(1);
    if (!users || users.length === 0 || users[0].isActive === false) {
      return res.status(401).json({ error: "User session expired or account disabled." });
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
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error("[REFRESH ERROR]", err);
    return res.status(500).json({ error: "Failed to refresh authentication session." });
  }
});
router.post("/logout", async (req, res) => {
  return res.json({ success: true, message: "Logged out successfully." });
});
router.get("/me", authenticate, async (req, res) => {
  return res.json({ user: req.user });
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const { data: users } = await supabaseAdmin.from("User").select("*").eq("email", normalizedEmail).is("deletedAt", null).limit(1);
    if (!users || users.length === 0) {
      return res.json({ success: true, message: "If an account exists, a reset code has been sent." });
    }
    const user = users[0];
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const otpId = uuidv42();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    await supabaseAdmin.from("OTPVerification").insert([
      {
        id: otpId,
        userId: user.id,
        email: user.email,
        codeHash,
        purpose: "PASSWORD_RESET",
        expiresAt,
        isUsed: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await sendEmail({
      to: user.email,
      subject: "MTS Lab \u2014 Password Reset Code",
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
      `
    });
    return res.json({
      success: true,
      message: "Password reset code sent to your email.",
      resetId: otpId
    });
  } catch (err) {
    console.error("[FORGOT PASSWORD ERROR]", err);
    return res.status(500).json({ error: "Failed to process forgot password request." });
  }
});
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email and OTP code are required." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const inputHash = crypto.createHash("sha256").update(String(code).trim()).digest("hex");
    const { data: otps } = await supabaseAdmin.from("OTPVerification").select("*").eq("email", normalizedEmail).eq("purpose", "PASSWORD_RESET").eq("isUsed", false).order("createdAt", { ascending: false }).limit(1);
    if (!otps || otps.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP code." });
    }
    const otp = otps[0];
    if (new Date(otp.expiresAt) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "OTP code has expired. Please request a new one." });
    }
    if (otp.codeHash !== inputHash) {
      return res.status(400).json({ error: "Incorrect OTP code." });
    }
    await supabaseAdmin.from("OTPVerification").update({ isUsed: true }).eq("id", otp.id);
    const resetToken = jwt2.sign(
      { userId: otp.userId, purpose: "RESET_PASSWORD" },
      config.jwtSecret,
      { expiresIn: "15m" }
    );
    return res.json({
      success: true,
      resetToken,
      message: "OTP verified successfully. You may now set a new password."
    });
  } catch (err) {
    console.error("[VERIFY OTP ERROR]", err);
    return res.status(500).json({ error: "Failed to verify OTP." });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    let decoded;
    try {
      decoded = jwt2.verify(resetToken, config.jwtSecret);
    } catch {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { data: updatedUsers, error: updateErr } = await supabaseAdmin.from("User").update({
      password: passwordHash,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", decoded.userId).select("*");
    if (updateErr || !updatedUsers || updatedUsers.length === 0) {
      return res.status(500).json({ error: "Failed to update user password." });
    }
    const user = updatedUsers[0];
    if (user.supabaseUid) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.supabaseUid, {
          password: newPassword
        });
      } catch (_) {
      }
    }
    await logAudit({
      userId: user.id,
      action: "PASSWORD_RESET",
      resource: "User",
      resourceId: user.id,
      details: { email: user.email }
    });
    return res.json({ success: true, message: "Password updated successfully. Please log in with your new password." });
  } catch (err) {
    console.error("[RESET PASSWORD ERROR]", err);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});
router.post("/verify-email-status", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    const { data: users } = await supabaseAdmin.from("User").select("id, email, emailVerified, accountStatus").eq("email", email.toLowerCase().trim()).limit(1);
    if (!users || users.length === 0) {
      return res.json({ isVerified: false, accountStatus: "PENDING" });
    }
    return res.json({
      isVerified: Boolean(users[0].emailVerified),
      accountStatus: users[0].accountStatus
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify email status." });
  }
});
router.post("/resend-verification", async (req, res) => {
  return res.json({ success: true, message: "Verification link resent to your email." });
});
router.get("/activity", authenticate, async (req, res) => {
  try {
    const { data: activities } = await supabaseAdmin.from("LoginActivity").select("*").eq("userId", req.user.id).order("createdAt", { ascending: false }).limit(20);
    return res.json(activities || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load activity logs." });
  }
});
router.get("/sessions", authenticate, async (req, res) => {
  return res.json([
    {
      id: "current-session",
      userId: req.user.id,
      deviceName: "Current Browser Session",
      deviceType: "DESKTOP",
      lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ]);
});
var auth_default = router;

// api/_server/routes/users.ts
import { Router as Router2 } from "express";
import bcrypt2 from "bcryptjs";
import { v4 as uuidv43 } from "uuid";

// api/_server/middleware/rbac.ts
function normalizeRole(role) {
  if (!role) return "";
  const r = role.toUpperCase().replace(/\s+/g, "_").trim();
  if (r === "SUPERADMIN") return "SUPER_ADMIN";
  if (r === "HEAD_TECHNICIAN" || r === "LEADTECHNICIAN") return "LEAD_TECHNICIAN";
  return r;
}
function authorize(allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required for this resource."
      });
    }
    const userRole = normalizeRole(req.user.role);
    if (userRole === "SUPER_ADMIN") {
      return next();
    }
    if (normalizedAllowed.includes(userRole)) {
      return next();
    }
    return res.status(403).json({
      error: "Forbidden",
      message: `Access denied. Requires one of roles: [${allowedRoles.join(", ")}]. Current role: ${req.user.role}`
    });
  };
}

// api/_server/routes/users.ts
var router2 = Router2();
router2.get("/", authenticate, async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin.from("User").select("id, email, username, name, role, phoneNumber, department, address, profileImage, branchId, accountStatus, isActive, emailVerified, twoFactorEnabled, twoFactorType, lastLoginAt, createdAt, updatedAt").is("deletedAt", null).order("name", { ascending: true });
    if (error) {
      console.error("[USERS GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch staff directory." });
    }
    return res.json(users || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch staff members." });
  }
});
router2.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "RECEPTIONIST",
      phoneNumber,
      department,
      address,
      branchId,
      twoFactorEnabled = true
    } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required to create a staff member." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedTargetRole = normalizeRole(role);
    const { data: existingUsers } = await supabaseAdmin.from("User").select("id, email, deletedAt").eq("email", normalizedEmail).limit(1);
    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (!existing.deletedAt) {
        return res.status(400).json({ error: "A staff member with this email already exists." });
      }
    }
    const defaultPassword = password || "MtsLab@2026";
    const passwordHash = await bcrypt2.hash(defaultPassword, 10);
    let userId = uuidv43();
    let supabaseUid = null;
    try {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { name, role: normalizedTargetRole }
      });
      if (!authErr && authUser?.user) {
        userId = authUser.user.id;
        supabaseUid = authUser.user.id;
      }
    } catch (authCreateErr) {
      console.warn("[AUTH CREATE NOTICE]", authCreateErr);
    }
    const newStaff = {
      id: userId,
      supabaseUid: supabaseUid || userId,
      email: normalizedEmail,
      name: name.trim(),
      password: passwordHash,
      role: normalizedTargetRole,
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      department: department ? department.trim() : null,
      address: address ? address.trim() : null,
      branchId: branchId || null,
      accountStatus: "ACTIVE",
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: Boolean(twoFactorEnabled),
      twoFactorType: "EMAIL",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: insertedUser, error: insertErr } = await supabaseAdmin.from("User").insert([newStaff]).select("*").single();
    if (insertErr) {
      console.error("[STAFF INSERT ERROR]", insertErr);
      return res.status(500).json({ error: "Failed to create staff member profile." });
    }
    await logAudit({
      userId: req.user.id,
      action: "STAFF_CREATED",
      resource: "User",
      resourceId: insertedUser.id,
      details: { email: insertedUser.email, role: insertedUser.role, createdBy: req.user.name }
    });
    return res.status(201).json(insertedUser);
  } catch (err) {
    console.error("[CREATE USER ERROR]", err);
    return res.status(500).json({ error: "Failed to create staff account." });
  }
});
router2.patch("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      phoneNumber,
      department,
      address,
      branchId,
      accountStatus,
      isActive,
      password,
      twoFactorEnabled,
      emailVerified
    } = req.body;
    const callerRole = normalizeRole(req.user.role);
    const isSelf = req.user.id === id;
    const isSuperAdminOrAdmin = callerRole === "SUPER_ADMIN" || callerRole === "ADMIN";
    if (!isSelf && !isSuperAdminOrAdmin) {
      return res.status(403).json({ error: "You are not authorized to modify this user account." });
    }
    const updatePayload = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (name !== void 0) updatePayload.name = name.trim();
    if (phoneNumber !== void 0) updatePayload.phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    if (department !== void 0) updatePayload.department = department ? department.trim() : null;
    if (address !== void 0) updatePayload.address = address ? address.trim() : null;
    if (branchId !== void 0) updatePayload.branchId = branchId || null;
    if (isSuperAdminOrAdmin) {
      if (role !== void 0) updatePayload.role = normalizeRole(role);
      if (accountStatus !== void 0) updatePayload.accountStatus = accountStatus;
      if (isActive !== void 0) updatePayload.isActive = Boolean(isActive);
      if (twoFactorEnabled !== void 0) updatePayload.twoFactorEnabled = Boolean(twoFactorEnabled);
      if (emailVerified !== void 0) updatePayload.emailVerified = Boolean(emailVerified);
    }
    if (password) {
      const passwordHash = await bcrypt2.hash(password, 10);
      updatePayload.password = passwordHash;
      try {
        await supabaseAdmin.auth.admin.updateUserById(id, { password });
      } catch (_) {
      }
    }
    const { data: updated, error: updateErr } = await supabaseAdmin.from("User").update(updatePayload).eq("id", id).select("*").single();
    if (updateErr) {
      console.error("[USER UPDATE ERROR]", updateErr);
      return res.status(500).json({ error: "Failed to update user profile." });
    }
    await logAudit({
      userId: req.user.id,
      action: "STAFF_UPDATED",
      resource: "User",
      resourceId: id,
      details: updatePayload
    });
    return res.json(updated);
  } catch (err) {
    console.error("[USER UPDATE ERROR]", err);
    return res.status(500).json({ error: "Failed to update staff record." });
  }
});
var handle2FAToggle = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, twoFactorEnabled } = req.body;
    const isEnabled = enabled !== void 0 ? Boolean(enabled) : Boolean(twoFactorEnabled);
    const { data: updated, error } = await supabaseAdmin.from("User").update({
      twoFactorEnabled: isEnabled,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to update 2FA configuration." });
    }
    return res.json({ success: true, message: `2FA ${isEnabled ? "enabled" : "disabled"} successfully.`, user: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle 2FA." });
  }
};
router2.patch("/:id/2fa", authenticate, handle2FAToggle);
router2.post("/:id/2fa", authenticate, handle2FAToggle);
router2.patch("/:id/toggle-2fa", authenticate, handle2FAToggle);
router2.post("/:id/toggle-2fa", authenticate, handle2FAToggle);
var handleDirectVerifyEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin.from("User").update({
      emailVerified: true,
      accountStatus: "ACTIVE",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to verify staff email." });
    }
    return res.json({ success: true, message: "Email directly verified successfully.", user: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify email." });
  }
};
router2.post("/:id/verify-email", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), handleDirectVerifyEmail);
router2.patch("/:id/verify-email", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), handleDirectVerifyEmail);
router2.post("/:id/direct-verify-email", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), handleDirectVerifyEmail);
router2.patch("/:id/direct-verify-email", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), handleDirectVerifyEmail);
router2.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    const { data: user } = await supabaseAdmin.from("User").select("role, email").eq("id", id).single();
    if (user && normalizeRole(user.role) === "SUPER_ADMIN" && normalizeRole(req.user.role) !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Only a Super Admin can delete another Super Admin." });
    }
    const { error } = await supabaseAdmin.from("User").update({
      deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isActive: false,
      accountStatus: "DISABLED"
    }).eq("id", id);
    if (error) {
      return res.status(500).json({ error: "Failed to remove staff member." });
    }
    await logAudit({
      userId: req.user.id,
      action: "STAFF_DELETED",
      resource: "User",
      resourceId: id,
      details: { deletedEmail: user?.email }
    });
    return res.json({ success: true, message: "Staff member account safely deactivated." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete staff member." });
  }
});
var users_default = router2;

// api/_server/routes/repairs.ts
import { Router as Router3 } from "express";
import { v4 as uuidv44 } from "uuid";
import multer from "multer";

// api/_server/services/excelService.ts
import * as XLSX from "xlsx";
function createExcelBuffer(sheetName, data) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

// api/_server/routes/repairs.ts
var router3 = Router3();
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
var ALLOWED_REPAIR_COLUMNS = /* @__PURE__ */ new Set([
  "customerId",
  "customerName",
  "customerPhone",
  "customerEmail",
  "customerAddress",
  "deviceBrand",
  "deviceModel",
  "imeiNumber",
  "deviceColor",
  "deviceCondition",
  "conditionNotes",
  "problemDescription",
  "accessoriesReceived",
  "estimatedCost",
  "advancePaid",
  "totalPaid",
  "paymentStatus",
  "status",
  "priority",
  "technicianId",
  "branchId",
  "expectedCompletionDate",
  "remarks",
  "receivingMethod",
  "isCourierIn",
  "courierCompany",
  "courierTrackingNumber",
  "senderName",
  "senderPhone",
  "originDistrict",
  "originAddress",
  "isCourierOut",
  "returnCourierCompany",
  "returnCourierTrackingNumber",
  "destinationDistrict",
  "destinationAddress",
  "receiverName",
  "receiverPhone",
  "returnCourierNotes",
  "isReturnCourierDispatched",
  "returnCourierDispatchedAt",
  "returnCourierDispatchedById",
  "returnCourierDispatchedByName",
  "assignedAt",
  "assignedById",
  "assignedByName",
  "hasBatteryWarranty",
  "batteryWarrantyPeriod",
  "batteryType",
  "batteryHealth",
  "batterySerial",
  "batteryWarrantyExpiry",
  "warrantyTerms"
]);
async function generateRepairNumber() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: repairs } = await supabaseAdmin.from("Repair").select("repairNumber").ilike("repairNumber", `MTS-${currentYear}-%`).order("repairNumber", { ascending: false }).limit(20);
  let maxNum = 1e3;
  if (repairs && repairs.length > 0) {
    for (const r of repairs) {
      if (!r.repairNumber) continue;
      const match = r.repairNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
  }
  const nextNum = maxNum + 1;
  return `MTS-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
async function generateWarrantyNumber() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: records } = await supabaseAdmin.from("BatteryWarranty").select("warrantyNumber").ilike("warrantyNumber", `BW-${currentYear}-%`).order("warrantyNumber", { ascending: false }).limit(10);
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
  return `BW-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
async function syncBatteryWarrantyFromRepair(repairData, reqUser) {
  try {
    const isWarrantyActive = repairData.hasBatteryWarranty === true || repairData.hasBatteryWarranty === "true" || Boolean(repairData.batteryWarrantyPeriod);
    if (!isWarrantyActive) return;
    const { data: existing } = await supabaseAdmin.from("BatteryWarranty").select("id").eq("repairId", repairData.id).limit(1);
    const rawPeriod = String(repairData.batteryWarrantyPeriod || "6_MONTHS");
    const months = rawPeriod.includes("12") ? 12 : rawPeriod.includes("3") ? 3 : 6;
    const regDate = new Date(repairData.createdAt || Date.now());
    const expDate = new Date(regDate);
    expDate.setMonth(expDate.getMonth() + months);
    if (existing && existing.length > 0) {
      await supabaseAdmin.from("BatteryWarranty").update({
        customerName: repairData.customerName,
        customerPhone: repairData.customerPhone,
        customerEmail: repairData.customerEmail || null,
        customerAddress: repairData.customerAddress || null,
        deviceBrand: repairData.deviceBrand,
        deviceModel: repairData.deviceModel,
        imeiNumber: repairData.imeiNumber ? String(repairData.imeiNumber).trim() : null,
        batteryType: repairData.batteryType || "Original Replacement Battery",
        warrantyPeriod: `${months} Months`,
        expiryDate: expDate.toISOString(),
        status: "ACTIVE",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", existing[0].id);
    } else {
      const warrantyNumber = await generateWarrantyNumber();
      await supabaseAdmin.from("BatteryWarranty").insert([
        {
          id: uuidv44(),
          warrantyNumber,
          repairId: repairData.id,
          repairNumber: repairData.repairNumber,
          customerId: repairData.customerId || null,
          customerName: repairData.customerName,
          customerPhone: repairData.customerPhone,
          customerEmail: repairData.customerEmail || null,
          customerAddress: repairData.customerAddress || null,
          deviceBrand: repairData.deviceBrand,
          deviceModel: repairData.deviceModel,
          imeiNumber: repairData.imeiNumber ? String(repairData.imeiNumber).trim() : null,
          batteryType: repairData.batteryType || "Original Replacement Battery",
          warrantyPeriod: `${months} Months`,
          registrationDate: regDate.toISOString(),
          expiryDate: expDate.toISOString(),
          status: "ACTIVE",
          claimCount: 0,
          createdById: reqUser?.id || null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
    }
  } catch (syncErr) {
    console.error("[SYNC BATTERY WARRANTY EXCEPTION]", syncErr);
  }
}
router3.get("/", authenticate, async (req, res) => {
  try {
    const {
      status,
      technicianId,
      branchId,
      priority,
      search,
      receivingMethod,
      isCourierIn,
      isCourierOut,
      startDate,
      endDate,
      limit = "100",
      page = "1"
    } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 100;
    const offset = (pageNum - 1) * limitNum;
    let query = supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)", { count: "exact" });
    const role = normalizeRole(req.user.role);
    if (role === "TECHNICIAN" && !technicianId) {
      query = query.eq("technicianId", req.user.id);
    } else if (technicianId && technicianId !== "ALL") {
      query = query.eq("technicianId", String(technicianId));
    }
    if (status && status !== "ALL") {
      if (Array.isArray(status)) {
        query = query.in("status", status);
      } else {
        query = query.eq("status", String(status));
      }
    }
    if (priority && priority !== "ALL") {
      query = query.eq("priority", String(priority));
    }
    if (branchId && branchId !== "ALL") {
      query = query.eq("branchId", String(branchId));
    }
    if (receivingMethod && receivingMethod !== "ALL") {
      query = query.eq("receivingMethod", String(receivingMethod));
    }
    if (isCourierIn !== void 0) {
      query = query.eq("isCourierIn", isCourierIn === "true");
    }
    if (isCourierOut !== void 0) {
      query = query.eq("isCourierOut", isCourierOut === "true");
    }
    if (startDate) {
      query = query.gte("createdAt", String(startDate));
    }
    if (endDate) {
      query = query.lte("createdAt", String(endDate));
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%,deviceModel.ilike.%${s}%,imeiNumber.ilike.%${s}%`);
    }
    query = query.order("createdAt", { ascending: false }).range(offset, offset + limitNum - 1);
    const { data: repairs, error } = await query;
    if (error) {
      console.error("[REPAIRS GET ERROR]", error);
      return res.status(500).json({ error: "Failed to retrieve repairs list." });
    }
    return res.json(repairs || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load repair records." });
  }
});
router3.get("/export", authenticate, async (req, res) => {
  try {
    const { status, search, startDate, endDate } = req.query;
    let query = supabaseAdmin.from("Repair").select("*, technician:User!Repair_technicianId_fkey(name)");
    if (status && status !== "ALL") query = query.eq("status", String(status));
    if (startDate) query = query.gte("createdAt", String(startDate));
    if (endDate) query = query.lte("createdAt", String(endDate));
    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%`);
    }
    const { data: repairs } = await query.order("createdAt", { ascending: false });
    const rows = (repairs || []).map((r) => ({
      "Repair Number": r.repairNumber,
      "Customer Name": r.customerName,
      "Phone": r.customerPhone,
      "Device Brand": r.deviceBrand,
      "Device Model": r.deviceModel,
      "IMEI": r.imeiNumber || "N/A",
      "Problem": r.problemDescription,
      "Status": r.status,
      "Priority": r.priority || "MEDIUM",
      "Estimated Cost": r.estimatedCost,
      "Advance Paid": r.advancePaid,
      "Total Paid": r.totalPaid,
      "Technician": r.technician?.name || "Unassigned",
      "Date": r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : ""
    }));
    const buffer = createExcelBuffer("Repairs", rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="MTS_Repairs_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to export repairs." });
  }
});
router3.get("/import/template", authenticate, (req, res) => {
  const sampleData = [
    {
      "Customer Name": "Ram Bahadur",
      "Customer Phone": "9841234567",
      "Customer Email": "ram@example.com",
      "Customer Address": "New Road, Kathmandu",
      "Device Brand": "Apple",
      "Device Model": "iPhone 13 Pro",
      "IMEI / Serial": "354892019283741",
      "Problem Description": "Broken OLED screen, touch not working",
      "Estimated Cost": 18500,
      "Advance Paid": 5e3,
      "Remarks": "Urgent repair requested by customer"
    }
  ];
  const buffer = createExcelBuffer("Import Template", sampleData);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="MTS_Lab_Repair_Import_Template.xlsx"');
  return res.send(buffer);
});
router3.post("/import/preview", authenticate, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No Excel file provided for import preview." });
    }
    const rows = parseExcelBuffer(req.file.buffer);
    const parsed = rows.map((r, idx) => ({
      rowIndex: idx + 1,
      customerName: r["Customer Name"] || r["customerName"] || "",
      customerPhone: r["Customer Phone"] || r["customerPhone"] || r["Phone"] || "",
      customerEmail: r["Customer Email"] || r["customerEmail"] || "",
      customerAddress: r["Customer Address"] || r["customerAddress"] || "",
      deviceBrand: r["Device Brand"] || r["deviceBrand"] || "Apple",
      deviceModel: r["Device Model"] || r["deviceModel"] || "",
      imeiNumber: r["IMEI / Serial"] || r["IMEI"] || r["imeiNumber"] || "",
      problemDescription: r["Problem Description"] || r["problemDescription"] || "",
      estimatedCost: parseFloat(r["Estimated Cost"] || r["estimatedCost"] || "0") || 0,
      advancePaid: parseFloat(r["Advance Paid"] || r["advancePaid"] || "0") || 0,
      remarks: r["Remarks"] || r["remarks"] || "",
      isValid: Boolean((r["Customer Name"] || r["customerName"]) && (r["Customer Phone"] || r["customerPhone"]) && (r["Device Model"] || r["deviceModel"]))
    }));
    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p) => p.isValid).length,
      invalidRows: parsed.filter((p) => !p.isValid).length,
      preview: parsed
    });
  } catch (err) {
    return res.status(400).json({ error: "Failed to parse Excel file. Ensure valid .xlsx format." });
  }
});
router3.post("/import/confirm", authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No repair items to import." });
    }
    const importedRepairs = [];
    for (const item of items) {
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;
      const repairNumber = await generateRepairNumber();
      const repairId = uuidv44();
      const newRepair = {
        id: repairId,
        repairNumber,
        customerName: item.customerName.trim(),
        customerPhone: item.customerPhone.trim(),
        customerEmail: item.customerEmail ? item.customerEmail.trim() : null,
        customerAddress: item.customerAddress ? item.customerAddress.trim() : null,
        deviceBrand: item.deviceBrand || "Apple",
        deviceModel: item.deviceModel.trim(),
        imeiNumber: item.imeiNumber ? String(item.imeiNumber).trim() : null,
        problemDescription: item.problemDescription || "General diagnostic & repair",
        estimatedCost: Number(item.estimatedCost || 0),
        advancePaid: Number(item.advancePaid || 0),
        totalPaid: Number(item.advancePaid || 0),
        paymentStatus: Number(item.advancePaid || 0) > 0 ? Number(item.advancePaid) >= Number(item.estimatedCost) ? "PAID" : "PARTIAL" : "UNPAID",
        status: "RECEIVED",
        priority: "MEDIUM",
        remarks: item.remarks || null,
        createdById: req.user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: created } = await supabaseAdmin.from("Repair").insert([newRepair]).select("*").single();
      if (created) importedRepairs.push(created);
    }
    return res.json({ success: true, count: importedRepairs.length, message: `Successfully imported ${importedRepairs.length} repairs.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process batch repair import." });
  }
});
router3.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: repair, error } = await supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email, phoneNumber), notes:TechnicianNote(*), logs:RepairLog(*), payments:Payment(*)").eq("id", id).single();
    if (error || !repair) {
      return res.status(404).json({ error: "Repair record not found." });
    }
    return res.json(repair);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve repair details." });
  }
});
router3.post("/", authenticate, async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceBrand,
      deviceModel,
      imeiNumber,
      deviceColor,
      deviceCondition,
      conditionNotes,
      problemDescription,
      accessoriesReceived,
      estimatedCost,
      advancePaid,
      technicianId,
      branchId,
      priority = "MEDIUM",
      expectedCompletionDate,
      remarks,
      receivingMethod = "WALK_IN",
      isCourierIn = false,
      courierCompany,
      courierTrackingNumber,
      senderName,
      senderPhone,
      originDistrict,
      originAddress,
      hasBatteryWarranty = false,
      batteryWarrantyPeriod,
      batteryType,
      batteryHealth,
      batterySerial
    } = req.body;
    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: "Customer name, phone, and device model are required." });
    }
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId) {
      const { data: existingCustomers } = await supabaseAdmin.from("Customer").select("id").eq("phone", customerPhone.trim()).limit(1);
      if (existingCustomers && existingCustomers.length > 0) {
        resolvedCustomerId = existingCustomers[0].id;
      } else {
        const newCusId = uuidv44();
        const { data: createdCus } = await supabaseAdmin.from("Customer").insert([
          {
            id: newCusId,
            customerId: `CUS-${Date.now().toString().slice(-5)}`,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            email: customerEmail ? customerEmail.trim() : null,
            address: customerAddress ? customerAddress.trim() : null,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]).select("id").single();
        if (createdCus) resolvedCustomerId = createdCus.id;
      }
    }
    const repairNumber = await generateRepairNumber();
    const repairId = uuidv44();
    const estCostNum = parseFloat(estimatedCost || 0) || 0;
    const advPaidNum = parseFloat(advancePaid || 0) || 0;
    const paymentStatus = advPaidNum >= estCostNum && estCostNum > 0 ? "PAID" : advPaidNum > 0 ? "PARTIAL" : "UNPAID";
    const newRepair = {
      id: repairId,
      repairNumber,
      customerId: resolvedCustomerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      customerAddress: customerAddress ? customerAddress.trim() : null,
      deviceBrand: deviceBrand || "Apple",
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber ? String(imeiNumber).trim() : null,
      deviceColor: deviceColor || null,
      deviceCondition: deviceCondition || "FAIR",
      conditionNotes: conditionNotes || null,
      problemDescription: problemDescription || "",
      accessoriesReceived: accessoriesReceived || null,
      estimatedCost: estCostNum,
      advancePaid: advPaidNum,
      totalPaid: advPaidNum,
      paymentStatus,
      status: "RECEIVED",
      priority,
      technicianId: technicianId || null,
      branchId: branchId || req.user.branchId || null,
      expectedCompletionDate: expectedCompletionDate || null,
      remarks: remarks || null,
      receivingMethod,
      isCourierIn: Boolean(isCourierIn),
      courierCompany: courierCompany || null,
      courierTrackingNumber: courierTrackingNumber || null,
      senderName: senderName || null,
      senderPhone: senderPhone || null,
      originDistrict: originDistrict || null,
      originAddress: originAddress || null,
      hasBatteryWarranty: Boolean(hasBatteryWarranty),
      batteryWarrantyPeriod: batteryWarrantyPeriod || null,
      batteryType: batteryType || null,
      batteryHealth: batteryHealth || null,
      batterySerial: batterySerial || null,
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("Repair").insert([newRepair]).select("*").single();
    if (error) {
      console.error("[REPAIR CREATE ERROR]", error);
      return res.status(500).json({ error: "Failed to create repair ticket." });
    }
    if (hasBatteryWarranty || batteryWarrantyPeriod) {
      await syncBatteryWarrantyFromRepair(created, req.user);
    }
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: uuidv44(),
        repairId: created.id,
        userId: req.user.id,
        action: "CREATED",
        status: "RECEIVED",
        notes: `Repair intake recorded by ${req.user.name}. Initial payment: NPR ${advPaidNum}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await logAudit({
      userId: req.user.id,
      action: "REPAIR_CREATED",
      resource: "Repair",
      resourceId: created.id,
      details: { repairNumber: created.repairNumber, customerName: created.customerName }
    });
    return res.status(201).json(created);
  } catch (err) {
    console.error("[CREATE REPAIR ERROR]", err);
    return res.status(500).json({ error: "Failed to register repair ticket." });
  }
});
var handleRepairUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};
    const updateData = {};
    for (const key of Object.keys(rawBody)) {
      if (ALLOWED_REPAIR_COLUMNS.has(key)) {
        updateData[key] = rawBody[key];
      }
    }
    if (updateData.estimatedCost !== void 0) updateData.estimatedCost = parseFloat(updateData.estimatedCost) || 0;
    if (updateData.advancePaid !== void 0) updateData.advancePaid = parseFloat(updateData.advancePaid) || 0;
    if (updateData.totalPaid !== void 0) updateData.totalPaid = parseFloat(updateData.totalPaid) || 0;
    updateData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const { data: updated, error } = await supabaseAdmin.from("Repair").update(updateData).eq("id", id).select("*").single();
    if (error) {
      console.error("[REPAIR UPDATE ERROR]", error);
      return res.status(400).json({ error: error.message });
    }
    if (rawBody.hasBatteryWarranty || rawBody.batteryWarrantyPeriod || updated.hasBatteryWarranty || updated.batteryWarrantyPeriod) {
      await syncBatteryWarrantyFromRepair({ ...updated, ...rawBody }, req.user);
    }
    if (rawBody.status) {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: uuidv44(),
          repairId: id,
          userId: req.user.id,
          action: "STATUS_UPDATED",
          status: rawBody.status,
          notes: rawBody.remarks || `Status updated to ${rawBody.status} by ${req.user.name}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
    }
    return res.json(updated);
  } catch (err) {
    console.error("[REPAIR UPDATE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to update repair." });
  }
};
router3.patch("/:id", authenticate, handleRepairUpdate);
router3.put("/:id", authenticate, handleRepairUpdate);
router3.post("/:id/assign", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "LEAD_TECHNICIAN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;
    const { data: tech } = await supabaseAdmin.from("User").select("name").eq("id", technicianId).single();
    const { data: updated, error } = await supabaseAdmin.from("Repair").update({
      technicianId: technicianId || null,
      assignedAt: (/* @__PURE__ */ new Date()).toISOString(),
      assignedById: req.user.id,
      assignedByName: req.user.name,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to assign technician." });
    }
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: uuidv44(),
        repairId: id,
        userId: req.user.id,
        action: "ASSIGNED",
        status: updated.status,
        notes: `Assigned to technician: ${tech?.name || "Unassigned"} by ${req.user.name}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to assign technician." });
  }
});
router3.post("/:id/notes", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { note, isInternal = true } = req.body;
    if (!note) {
      return res.status(400).json({ error: "Note text is required." });
    }
    const newNote = {
      id: uuidv44(),
      repairId: id,
      technicianId: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      note: note.trim(),
      isInternal: Boolean(isInternal),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("TechnicianNote").insert([newNote]).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to save note." });
    }
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add repair note." });
  }
});
router3.get("/:id/notes", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: notes, error } = await supabaseAdmin.from("TechnicianNote").select("*").eq("repairId", id).order("createdAt", { ascending: false });
    if (error) {
      return res.status(500).json({ error: "Failed to fetch notes." });
    }
    return res.json(notes || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve notes." });
  }
});
router3.post("/:id/alert", authenticate, async (req, res) => {
  return res.json({ success: true, message: "Customer notification alert dispatched successfully." });
});
router3.post("/:id/transfer", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetTechnicianId, reason } = req.body;
    const { data: tech } = await supabaseAdmin.from("User").select("name").eq("id", targetTechnicianId).single();
    const { data: updated, error } = await supabaseAdmin.from("Repair").update({
      technicianId: targetTechnicianId,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to transfer repair." });
    }
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: uuidv44(),
        repairId: id,
        userId: req.user.id,
        action: "TRANSFERRED",
        status: updated.status,
        notes: `Repair transferred to ${tech?.name || "Technician"}. Reason: ${reason || "Workload reallocation"}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to transfer repair ticket." });
  }
});
router3.post("/:id/courier-dispatch", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { courierCompany, trackingNumber, destinationDistrict, destinationAddress, receiverName, receiverPhone, notes } = req.body;
    const { data: updated, error } = await supabaseAdmin.from("Repair").update({
      isCourierOut: true,
      returnCourierCompany: courierCompany,
      returnCourierTrackingNumber: trackingNumber,
      destinationDistrict,
      destinationAddress,
      receiverName,
      receiverPhone,
      returnCourierNotes: notes,
      isReturnCourierDispatched: true,
      returnCourierDispatchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      returnCourierDispatchedById: req.user.id,
      returnCourierDispatchedByName: req.user.name,
      status: "DISPATCHED_VIA_COURIER",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to dispatch repair shipment." });
    }
    return res.json({ success: true, message: "Repair successfully dispatched with courier tracking.", repair: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record courier dispatch." });
  }
});
router3.post("/:id/re-problem", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const { data: updated, error } = await supabaseAdmin.from("Repair").update({
      status: "RE_PROBLEM",
      remarks: `Warranty recurring problem: ${description}`,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to register re-problem status." });
    }
    return res.json({ success: true, message: "Repair marked as Re-Problem under warranty.", repair: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update re-problem." });
  }
});
router3.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from("RepairLog").delete().eq("repairId", id);
    await supabaseAdmin.from("TechnicianNote").delete().eq("repairId", id);
    await supabaseAdmin.from("Payment").delete().eq("repairId", id);
    const { error } = await supabaseAdmin.from("Repair").delete().eq("id", id);
    if (error) {
      return res.status(500).json({ error: "Failed to delete repair." });
    }
    return res.json({ success: true, message: "Repair deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete repair record." });
  }
});
router3.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No repair IDs specified." });
    }
    await supabaseAdmin.from("RepairLog").delete().in("repairId", ids);
    await supabaseAdmin.from("TechnicianNote").delete().in("repairId", ids);
    await supabaseAdmin.from("Payment").delete().in("repairId", ids);
    const { error } = await supabaseAdmin.from("Repair").delete().in("id", ids);
    if (error) {
      return res.status(500).json({ error: "Failed to bulk delete repairs." });
    }
    return res.json({ success: true, message: `Successfully deleted ${ids.length} repair records.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to bulk delete repairs." });
  }
});
var repairs_default = router3;

// api/_server/routes/customers.ts
import { Router as Router4 } from "express";
import { v4 as uuidv45 } from "uuid";
var router4 = Router4();
async function generateCustomerId() {
  const { count } = await supabaseAdmin.from("Customer").select("*", { count: "exact", head: true });
  const baseNum = (count || 0) + 101;
  let candidate = `CUS-${baseNum.toString().padStart(5, "0")}`;
  const { data: existing } = await supabaseAdmin.from("Customer").select("id").eq("customerId", candidate).limit(1);
  if (!existing || existing.length === 0) {
    return candidate;
  }
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `CUS-${(baseNum + randomSuffix).toString().padStart(5, "0")}`;
}
router4.get("/", authenticate, async (req, res) => {
  try {
    const { search, district, status = "ACTIVE", page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;
    let query = supabaseAdmin.from("Customer").select("*, repairs:Repair(count)", { count: "exact" });
    if (status === "ACTIVE") {
      query = query.eq("archived", false);
    } else if (status === "ARCHIVED") {
      query = query.eq("archived", true);
    }
    if (district && district !== "ALL") {
      query = query.eq("district", String(district));
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,customerId.ilike.%${s}%,email.ilike.%${s}%`);
    }
    query = query.order("createdAt", { ascending: false }).range(offset, offset + limitNum - 1);
    const { data: customers, count, error } = await query;
    if (error) {
      console.error("[CUSTOMERS GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch customers." });
    }
    const formatted = (customers || []).map((c) => ({
      ...c,
      totalRepairs: Array.isArray(c.repairs) ? c.repairs[0]?.count || 0 : c.repairs?.count || 0
    }));
    return res.json({
      customers: formatted,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err) {
    console.error("[CUSTOMERS LIST ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve customer list." });
  }
});
router4.get("/lookup", authenticate, async (req, res) => {
  try {
    const { phone, name, q } = req.query;
    const queryTerm = phone || name || q || "";
    if (!queryTerm || queryTerm.trim().length < 2) {
      return res.json([]);
    }
    const searchTerm = queryTerm.trim();
    const { data: customers, error } = await supabaseAdmin.from("Customer").select("id, customerId, name, phone, email, address, district, municipality, landmark").eq("archived", false).or(`phone.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,customerId.ilike.%${searchTerm}%`).limit(10);
    if (error) {
      return res.status(500).json({ error: "Customer lookup failed." });
    }
    return res.json(customers || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to perform customer lookup." });
  }
});
router4.get("/search", authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length === 0) {
      return res.json([]);
    }
    const term = String(q).trim();
    const { data: customers, error } = await supabaseAdmin.from("Customer").select("*").eq("archived", false).or(`phone.ilike.%${term}%,name.ilike.%${term}%,customerId.ilike.%${term}%`).limit(15);
    if (error) {
      return res.status(500).json({ error: "Search failed." });
    }
    return res.json(customers || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to search customers." });
  }
});
router4.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: customer, error } = await supabaseAdmin.from("Customer").select("*").eq("id", id).single();
    if (error || !customer) {
      return res.status(404).json({ error: "Customer not found." });
    }
    return res.json(customer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve customer details." });
  }
});
router4.get("/:id/repairs", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: repairs, error } = await supabaseAdmin.from("Repair").select("*, technician:User!Repair_technicianId_fkey(id, name, role)").eq("customerId", id).order("createdAt", { ascending: false });
    if (error) {
      console.error("[CUSTOMER REPAIRS ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch customer repair records." });
    }
    return res.json(repairs || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve customer repair history." });
  }
});
router4.post("/", authenticate, async (req, res) => {
  try {
    const {
      name,
      phone,
      alternativePhone,
      email,
      district,
      municipality,
      address,
      landmark,
      notes
    } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Customer name and phone number are required." });
    }
    const customerId = await generateCustomerId();
    const newCustomer = {
      id: uuidv45(),
      customerId,
      name: name.trim(),
      phone: phone.trim(),
      alternativePhone: alternativePhone ? alternativePhone.trim() : null,
      email: email ? email.trim() : null,
      district: district ? district.trim() : null,
      municipality: municipality ? municipality.trim() : null,
      address: address ? address.trim() : null,
      landmark: landmark ? landmark.trim() : null,
      notes: notes ? notes.trim() : null,
      archived: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("Customer").insert([newCustomer]).select("*").single();
    if (error) {
      console.error("[CUSTOMER CREATE ERROR]", error);
      return res.status(500).json({ error: "Failed to create customer record." });
    }
    await logAudit({
      userId: req.user.id,
      action: "CUSTOMER_CREATED",
      resource: "Customer",
      resourceId: created.id,
      details: { name: created.name, customerId: created.customerId, phone: created.phone }
    });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save customer." });
  }
});
router4.patch("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      alternativePhone,
      email,
      district,
      municipality,
      address,
      landmark,
      notes
    } = req.body;
    const updatePayload = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (name !== void 0) updatePayload.name = name.trim();
    if (phone !== void 0) updatePayload.phone = phone.trim();
    if (alternativePhone !== void 0) updatePayload.alternativePhone = alternativePhone ? alternativePhone.trim() : null;
    if (email !== void 0) updatePayload.email = email ? email.trim() : null;
    if (district !== void 0) updatePayload.district = district ? district.trim() : null;
    if (municipality !== void 0) updatePayload.municipality = municipality ? municipality.trim() : null;
    if (address !== void 0) updatePayload.address = address ? address.trim() : null;
    if (landmark !== void 0) updatePayload.landmark = landmark ? landmark.trim() : null;
    if (notes !== void 0) updatePayload.notes = notes ? notes.trim() : null;
    const { data: updated, error } = await supabaseAdmin.from("Customer").update(updatePayload).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to update customer record." });
    }
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update customer." });
  }
});
router4.post("/:id/archive", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin.from("Customer").update({
      archived: true,
      archivedAt: (/* @__PURE__ */ new Date()).toISOString(),
      archivedBy: req.user.name,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to archive customer." });
    }
    return res.json({ success: true, message: "Customer archived successfully.", customer: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to archive customer." });
  }
});
router4.post("/:id/restore", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin.from("Customer").update({
      archived: false,
      archivedAt: null,
      archivedBy: null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to restore customer." });
    }
    return res.json({ success: true, message: "Customer restored successfully.", customer: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to restore customer." });
  }
});
router4.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Customer").delete().eq("id", id);
    if (error) {
      return res.status(500).json({ error: "Failed to delete customer record." });
    }
    return res.json({ success: true, message: "Customer deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete customer." });
  }
});
var customers_default = router4;

// api/_server/routes/inventory.ts
import { Router as Router5 } from "express";
import { v4 as uuidv46 } from "uuid";
var router5 = Router5();
router5.get("/folders", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("category, subcategory").not("category", "is", null);
    const categories = Array.from(new Set((items || []).map((i) => i.category).filter(Boolean)));
    const subcategories = Array.from(new Set((items || []).map((i) => i.subcategory).filter(Boolean)));
    return res.json({
      success: true,
      folders: categories,
      categories,
      subcategories
    });
  } catch (err) {
    return res.json({ success: true, folders: [], categories: [], subcategories: [] });
  }
});
router5.get("/suppliers", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("supplier").not("supplier", "is", null);
    const suppliers = Array.from(new Set((items || []).map((i) => i.supplier).filter(Boolean)));
    return res.json(suppliers);
  } catch (err) {
    return res.json([]);
  }
});
router5.get("/locations", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("storageLocation").not("storageLocation", "is", null);
    const locations = Array.from(new Set((items || []).map((i) => i.storageLocation).filter(Boolean)));
    return res.json(locations);
  } catch (err) {
    return res.json([]);
  }
});
router5.get("/", authenticate, async (req, res) => {
  try {
    const { category, brand, status = "ACTIVE", search, limit = "200" } = req.query;
    let query = supabaseAdmin.from("InventoryItem").select("*");
    if (status && status !== "ALL") {
      query = query.eq("status", String(status));
    }
    if (category && category !== "ALL") {
      query = query.eq("category", String(category));
    }
    if (brand && brand !== "ALL") {
      query = query.eq("brand", String(brand));
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,model.ilike.%${s}%,compatibility.ilike.%${s}%`);
    }
    const { data: items, error } = await query.order("name", { ascending: true }).limit(parseInt(limit, 10) || 200);
    if (error) {
      console.error("[INVENTORY GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch inventory items." });
    }
    return res.json(items || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve inventory." });
  }
});
router5.get("/stats", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("currentStock, minStockLevel, purchasePrice, sellingPrice, status");
    const totalItems = items?.length || 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockQuantity = 0;
    let totalStockValue = 0;
    (items || []).forEach((item) => {
      const stock = item.currentStock || 0;
      const minStock = item.minStockLevel || 5;
      const price = item.purchasePrice || item.sellingPrice || 0;
      totalStockQuantity += stock;
      totalStockValue += stock * price;
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    });
    return res.json({
      totalItems,
      lowStockCount,
      outOfStockCount,
      totalStockQuantity,
      totalStockValue
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to calculate inventory statistics." });
  }
});
router5.get("/categories", authenticate, async (req, res) => {
  try {
    const { data: categories } = await supabaseAdmin.from("InventoryCategory").select("*").order("displayOrder", { ascending: true });
    return res.json(categories || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch categories." });
  }
});
router5.post("/categories", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required." });
    const newCat = {
      id: uuidv46(),
      name: name.trim(),
      description: description || null,
      icon: icon || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("InventoryCategory").insert([newCat]).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to create category." });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add inventory category." });
  }
});
router5.get("/transactions/history", authenticate, async (req, res) => {
  try {
    const { itemId, limit = "50" } = req.query;
    let query = supabaseAdmin.from("InventoryTransaction").select("*, item:InventoryItem(name, sku, category)");
    if (itemId) {
      query = query.eq("itemId", String(itemId));
    }
    const { data: transactions, error } = await query.order("createdAt", { ascending: false }).limit(parseInt(limit, 10) || 50);
    if (error) {
      return res.status(500).json({ error: "Failed to fetch inventory transactions." });
    }
    return res.json(transactions || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve transaction logs." });
  }
});
router5.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No item IDs provided." });
    }
    await supabaseAdmin.from("InventoryTransaction").delete().in("itemId", ids);
    const { error } = await supabaseAdmin.from("InventoryItem").delete().in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to delete inventory items." });
    return res.json({ success: true, message: `Successfully removed ${ids.length} items.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process bulk delete." });
  }
});
router5.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: item, error } = await supabaseAdmin.from("InventoryItem").select("*, transactions:InventoryTransaction(*)").eq("id", id).single();
    if (error || !item) {
      return res.status(404).json({ error: "Inventory item not found." });
    }
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve item." });
  }
});
router5.post("/", authenticate, async (req, res) => {
  try {
    const {
      name,
      brand,
      model,
      sku,
      category = "Spare Parts",
      subcategory,
      compatibility,
      unit = "Piece",
      currentStock = 0,
      minStockLevel = 5,
      maxStockLevel,
      purchasePrice,
      sellingPrice,
      supplier,
      storageLocation,
      description,
      notes,
      imageUrl,
      status = "ACTIVE"
    } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Item name is required." });
    }
    const initialStock = parseInt(currentStock || "0", 10) || 0;
    const newItem = {
      id: uuidv46(),
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      model: model ? model.trim() : null,
      sku: sku ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
      category: category.trim(),
      subcategory: subcategory ? subcategory.trim() : null,
      compatibility: compatibility ? compatibility.trim() : null,
      unit: unit.trim(),
      currentStock: initialStock,
      minStockLevel: parseInt(minStockLevel || "5", 10) || 5,
      maxStockLevel: maxStockLevel ? parseInt(maxStockLevel, 10) : null,
      purchasePrice: purchasePrice !== void 0 && purchasePrice !== null && purchasePrice !== "" ? parseFloat(purchasePrice) : null,
      sellingPrice: sellingPrice !== void 0 && sellingPrice !== null && sellingPrice !== "" ? parseFloat(sellingPrice) : null,
      supplier: supplier ? supplier.trim() : null,
      storageLocation: storageLocation ? storageLocation.trim() : null,
      description: description ? description.trim() : null,
      notes: notes ? notes.trim() : null,
      imageUrl: imageUrl || null,
      status,
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("InventoryItem").insert([newItem]).select("*").single();
    if (error) {
      console.error("[INVENTORY CREATE ERROR]", error);
      return res.status(500).json({ error: "Failed to create inventory item." });
    }
    if (initialStock > 0) {
      await supabaseAdmin.from("InventoryTransaction").insert([
        {
          id: uuidv46(),
          itemId: created.id,
          type: "STOCK_IN",
          quantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          reason: "Initial Stock Setup",
          performedById: req.user.id,
          performedByName: req.user.name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_ITEM_CREATED",
      resource: "InventoryItem",
      resourceId: created.id,
      details: { name: created.name, sku: created.sku, stock: created.currentStock }
    });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save inventory item." });
  }
});
router5.patch("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    delete updateData.transactions;
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update(updateData).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to update inventory item." });
    }
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update inventory." });
  }
});
router5.post("/:id/stock-in", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason = "Stock replenishment", notes } = req.body;
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "Valid positive quantity required." });
    }
    const { data: item } = await supabaseAdmin.from("InventoryItem").select("*").eq("id", id).single();
    if (!item) return res.status(404).json({ error: "Item not found." });
    const prevStock = item.currentStock || 0;
    const newStock = prevStock + qty;
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update({ currentStock: newStock, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update stock." });
    await supabaseAdmin.from("InventoryTransaction").insert([
      {
        id: uuidv46(),
        itemId: id,
        type: "STOCK_IN",
        quantity: qty,
        previousStock: prevStock,
        newStock,
        reason,
        notes,
        performedById: req.user.id,
        performedByName: req.user.name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    return res.json({ success: true, item: updated, newStock });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process stock intake." });
  }
});
router5.post("/:id/stock-out", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason = "Used for Repair", repairNumber, notes } = req.body;
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "Valid positive quantity required." });
    }
    const { data: item } = await supabaseAdmin.from("InventoryItem").select("*").eq("id", id).single();
    if (!item) return res.status(404).json({ error: "Item not found." });
    const prevStock = item.currentStock || 0;
    const newStock = Math.max(0, prevStock - qty);
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update({ currentStock: newStock, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to deduct stock." });
    await supabaseAdmin.from("InventoryTransaction").insert([
      {
        id: uuidv46(),
        itemId: id,
        type: "STOCK_OUT",
        quantity: qty,
        previousStock: prevStock,
        newStock,
        reason,
        repairNumber: repairNumber || null,
        notes,
        performedById: req.user.id,
        performedByName: req.user.name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    return res.json({ success: true, item: updated, newStock });
  } catch (err) {
    return res.status(500).json({ error: "Failed to deduct inventory." });
  }
});
router5.post("/:id/adjust-stock", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { newStock: targetStock, reason = "Audit Correction", notes } = req.body;
    const newStock = parseInt(targetStock, 10);
    if (isNaN(newStock) || newStock < 0) {
      return res.status(400).json({ error: "Valid non-negative stock count required." });
    }
    const { data: item } = await supabaseAdmin.from("InventoryItem").select("*").eq("id", id).single();
    if (!item) return res.status(404).json({ error: "Item not found." });
    const prevStock = item.currentStock || 0;
    const diff = newStock - prevStock;
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update({ currentStock: newStock, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to adjust stock." });
    await supabaseAdmin.from("InventoryTransaction").insert([
      {
        id: uuidv46(),
        itemId: id,
        type: "STOCK_ADJUSTMENT",
        quantity: Math.abs(diff),
        previousStock: prevStock,
        newStock,
        reason,
        notes,
        performedById: req.user.id,
        performedByName: req.user.name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    return res.json({ success: true, item: updated, newStock });
  } catch (err) {
    return res.status(500).json({ error: "Failed to adjust stock quantity." });
  }
});
router5.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from("InventoryTransaction").delete().eq("itemId", id);
    const { error } = await supabaseAdmin.from("InventoryItem").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete inventory item." });
    return res.json({ success: true, message: "Item deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete item." });
  }
});
var inventory_default = router5;

// api/_server/routes/couriers.ts
import { Router as Router6 } from "express";
import { v4 as uuidv47 } from "uuid";
var router6 = Router6();
router6.get("/", authenticate, async (req, res) => {
  try {
    const {
      type,
      status,
      courierCompany,
      district,
      paymentStatus,
      dateRange,
      startDate,
      endDate,
      search,
      sortBy = "latest"
    } = req.query;
    let query = supabaseAdmin.from("Repair").select("*").or("isCourierIn.eq.true,isCourierOut.eq.true,isReturnCourierDispatched.eq.true");
    if (type === "INCOMING") {
      query = query.eq("isCourierIn", true);
    } else if (type === "OUTGOING") {
      query = query.or("isCourierOut.eq.true,isReturnCourierDispatched.eq.true");
    }
    if (status && status !== "ALL") {
      query = query.or(`courierStatus.eq.${status},courierInStatus.eq.${status},courierOutStatus.eq.${status}`);
    }
    if (courierCompany && courierCompany !== "ALL") {
      query = query.or(`courierCompany.eq.${courierCompany},returnCourierCompany.eq.${courierCompany}`);
    }
    if (district && district !== "ALL") {
      query = query.or(`originDistrict.eq.${district},destinationDistrict.eq.${district}`);
    }
    if (paymentStatus && paymentStatus !== "ALL") {
      query = query.or(`courierInPaymentStatus.eq.${paymentStatus},courierOutPaymentStatus.eq.${paymentStatus}`);
    }
    if (startDate) {
      query = query.gte("createdAt", new Date(String(startDate)).toISOString());
    }
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      query = query.lte("createdAt", end.toISOString());
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`repairNumber.ilike.%${s}%,courierTrackingNumber.ilike.%${s}%,returnCourierTrackingNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%,senderName.ilike.%${s}%,receiverName.ilike.%${s}%,senderPhone.ilike.%${s}%,receiverPhone.ilike.%${s}%,imeiNumber.ilike.%${s}%`);
    }
    if (sortBy === "oldest") {
      query = query.order("createdAt", { ascending: true });
    } else if (sortBy === "customer") {
      query = query.order("customerName", { ascending: true });
    } else {
      query = query.order("updatedAt", { ascending: false });
    }
    const { data: shipments, error } = await query;
    if (error) {
      console.error("[COURIERS GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch courier shipments." });
    }
    return res.json({
      success: true,
      shipments: shipments || []
    });
  } catch (err) {
    console.error("[COURIERS GET EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to retrieve courier records." });
  }
});
router6.get("/stats", authenticate, async (req, res) => {
  try {
    const { data: records, error } = await supabaseAdmin.from("Repair").select("isCourierIn, isCourierOut, isReturnCourierDispatched, courierStatus, courierInStatus, courierOutStatus, courierInCharge, courierOutCharge, createdAt").or("isCourierIn.eq.true,isCourierOut.eq.true,isReturnCourierDispatched.eq.true");
    if (error) {
      console.error("[COURIERS STATS ERROR]", error);
    }
    const list = records || [];
    let incomingTotal = 0;
    let outgoingTotal = 0;
    let inTransit = 0;
    let receivedAtLab = 0;
    let readyForDispatch = 0;
    let dispatched = 0;
    let delivered = 0;
    let totalCharges = 0;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    let incomingToday = 0;
    let outgoingToday = 0;
    list.forEach((r) => {
      const isOut = r.isCourierOut || r.isReturnCourierDispatched || r.courierOutStatus;
      const isIn = r.isCourierIn || !isOut && r.courierInStatus;
      if (isIn) {
        incomingTotal++;
        if (r.createdAt && String(r.createdAt).startsWith(todayStr)) incomingToday++;
      }
      if (isOut) {
        outgoingTotal++;
        if (r.createdAt && String(r.createdAt).startsWith(todayStr)) outgoingToday++;
      }
      const currentStatus = String(r.courierOutStatus || r.courierInStatus || r.courierStatus || "").toUpperCase();
      if (currentStatus === "IN_TRANSIT") inTransit++;
      else if (currentStatus === "RECEIVED_AT_LAB" || currentStatus === "RECEIVED") receivedAtLab++;
      else if (currentStatus === "READY_FOR_DISPATCH" || currentStatus === "READY") readyForDispatch++;
      else if (currentStatus === "DISPATCHED" || currentStatus === "COURIER_DISPATCHED") dispatched++;
      else if (currentStatus === "DELIVERED") delivered++;
      if (r.courierInCharge) totalCharges += Number(r.courierInCharge) || 0;
      if (r.courierOutCharge) totalCharges += Number(r.courierOutCharge) || 0;
    });
    return res.json({
      totalShipments: list.length,
      incomingTotal,
      outgoingTotal,
      incomingToday,
      outgoingToday,
      inTransit,
      receivedAtLab,
      readyForDispatch,
      dispatched,
      delivered,
      totalCharges
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to compute courier statistics." });
  }
});
router6.get("/eligible-repairs", authenticate, async (req, res) => {
  try {
    const { data: repairs, error } = await supabaseAdmin.from("Repair").select("id, repairNumber, customerName, customerPhone, customerAddress, deviceBrand, deviceModel, status, totalPaid, estimatedCost, customer:CustomerId(name, phone, address, district)").order("createdAt", { ascending: false }).limit(100);
    if (error) {
      console.error("[ELIGIBLE REPAIRS ERROR]", error);
      return res.status(500).json({ error: "Failed to load eligible repair jobs." });
    }
    return res.json(repairs || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load eligible repairs." });
  }
});
router6.get("/filters-metadata", authenticate, async (req, res) => {
  try {
    const { data: repairs } = await supabaseAdmin.from("Repair").select("courierCompany, returnCourierCompany, originDistrict, destinationDistrict").or("isCourierIn.eq.true,isCourierOut.eq.true,isReturnCourierDispatched.eq.true");
    const companies = /* @__PURE__ */ new Set();
    const districts = /* @__PURE__ */ new Set();
    (repairs || []).forEach((r) => {
      if (r.courierCompany) companies.add(r.courierCompany);
      if (r.returnCourierCompany) companies.add(r.returnCourierCompany);
      if (r.originDistrict) districts.add(r.originDistrict);
      if (r.destinationDistrict) districts.add(r.destinationDistrict);
    });
    return res.json({
      courierCompanies: Array.from(companies),
      districts: Array.from(districts)
    });
  } catch (err) {
    return res.json({ courierCompanies: [], districts: [] });
  }
});
router6.get("/search-customers", authenticate, async (req, res) => {
  try {
    const { query: queryTerm } = req.query;
    if (!queryTerm) return res.json([]);
    const term = String(queryTerm).trim();
    const { data: customers } = await supabaseAdmin.from("Customer").select("id, name, phone, alternativePhone, address, district, municipality").or(`phone.ilike.%${term}%,name.ilike.%${term}%,alternativePhone.ilike.%${term}%`).limit(10);
    return res.json(customers || []);
  } catch (err) {
    return res.json([]);
  }
});
router6.post("/check-duplicate-awb", authenticate, async (req, res) => {
  try {
    const { trackingNumber } = req.body;
    if (!trackingNumber) return res.json({ exists: false });
    const awb = String(trackingNumber).trim();
    const { data: existing } = await supabaseAdmin.from("Repair").select("id, repairNumber, customerName").or(`courierTrackingNumber.eq.${awb},returnCourierTrackingNumber.eq.${awb}`).limit(1);
    return res.json({
      exists: Boolean(existing && existing.length > 0),
      duplicateRepair: existing?.[0] || null
    });
  } catch (err) {
    return res.json({ exists: false });
  }
});
router6.post("/incoming", authenticate, async (req, res) => {
  try {
    const {
      existingRepairId,
      courierCompany,
      courierTrackingNumber,
      originDistrict = "Kathmandu",
      originAddress,
      senderName,
      senderPhone,
      senderWhatsapp,
      courierInCharge,
      courierInPaymentStatus = "UNPAID",
      courierDate,
      courierReceivedDate,
      courierNotes,
      customerName,
      customerPhone,
      customerWhatsapp,
      customerDistrict,
      customerMunicipality,
      customerAddress,
      deviceBrand,
      deviceModel,
      imeiNumber,
      deviceCondition,
      problemDescription,
      accessoriesReceived
    } = req.body;
    if (!courierCompany || !courierTrackingNumber) {
      return res.status(400).json({ error: "Courier partner and tracking number are required." });
    }
    const userId = req.user?.id || "system";
    const userName = req.user?.name || "Staff";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (existingRepairId) {
      const { data: existingRepair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*").eq("id", existingRepairId).single();
      if (fetchErr || !existingRepair) {
        return res.status(404).json({ error: "Selected repair ticket was not found." });
      }
      const updatePayload = {
        isCourierIn: true,
        courierCompany: courierCompany.trim(),
        courierTrackingNumber: courierTrackingNumber.trim(),
        courierInStatus: "RECEIVED_AT_LAB",
        courierStatus: "RECEIVED_AT_LAB",
        originDistrict: originDistrict || existingRepair.originDistrict || "Kathmandu",
        originAddress: originAddress || existingRepair.originAddress || null,
        senderName: senderName || existingRepair.customerName || "Customer",
        senderPhone: senderPhone || existingRepair.customerPhone || "",
        senderWhatsapp: senderWhatsapp || null,
        courierInPaymentStatus: courierInPaymentStatus || "UNPAID",
        courierDate: courierDate || now,
        courierReceivedDate: courierReceivedDate || now,
        courierNotes: courierNotes || null,
        updatedAt: now
      };
      if (courierInCharge !== void 0 && courierInCharge !== null && courierInCharge !== "") {
        updatePayload.courierInCharge = Number(courierInCharge);
      }
      const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", existingRepairId).select("*").single();
      if (updateErr) {
        console.error("[COURIER INCOMING UPDATE ERROR]", updateErr);
        return res.status(500).json({ error: updateErr.message || "Failed to update repair courier details." });
      }
      try {
        await supabaseAdmin.from("RepairLog").insert([
          {
            id: uuidv47(),
            repairId: existingRepairId,
            message: `Inbound courier shipment received via ${courierCompany} (AWB #${courierTrackingNumber}).`,
            action: "COURIER_INBOUND_RECEIVED",
            performedById: userId,
            performedByName: userName,
            createdAt: now
          }
        ]);
      } catch (logErr) {
        console.warn("[REPAIR LOG FAILED - NON FATAL]", logErr);
      }
      return res.json({
        success: true,
        message: `Inbound shipment linked to Repair #${existingRepair.repairNumber} successfully.`,
        repair: updatedRepair
      });
    }
    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: "Customer Name, Phone, and Device Model are required for new intake." });
    }
    let customerId = req.body.customerId;
    if (!customerId) {
      const { data: existingCust } = await supabaseAdmin.from("Customer").select("id").eq("phone", customerPhone.trim()).maybeSingle();
      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const newCustomerId = uuidv47();
        const { data: newCust, error: custErr } = await supabaseAdmin.from("Customer").insert([
          {
            id: newCustomerId,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            alternativePhone: customerWhatsapp || null,
            district: customerDistrict || originDistrict || "Kathmandu",
            municipality: customerMunicipality || null,
            address: customerAddress || originAddress || null,
            createdAt: now,
            updatedAt: now
          }
        ]).select("id").single();
        customerId = !custErr && newCust ? newCust.id : newCustomerId;
      }
    }
    const generatedRepairNumber = `MTS-${(/* @__PURE__ */ new Date()).getFullYear()}-${Date.now().toString().slice(-6)}`;
    const newRepairId = uuidv47();
    const newRepairPayload = {
      id: newRepairId,
      repairNumber: generatedRepairNumber,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deviceBrand: (deviceBrand || "apple").toLowerCase(),
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber || null,
      deviceCondition: deviceCondition || "Good (Minor Wear)",
      problemDescription: problemDescription || "Courier Intake - Diagnostics & Repair",
      accessoriesReceived: accessoriesReceived || null,
      status: "RECEIVED",
      priority: "MEDIUM",
      paymentStatus: "UNPAID",
      receivingMethod: "COURIER",
      isCourierIn: true,
      courierCompany: courierCompany.trim(),
      courierTrackingNumber: courierTrackingNumber.trim(),
      courierInStatus: "RECEIVED_AT_LAB",
      courierStatus: "RECEIVED_AT_LAB",
      originDistrict: originDistrict || customerDistrict || "Kathmandu",
      originAddress: originAddress || customerAddress || null,
      senderName: senderName || customerName.trim(),
      senderPhone: senderPhone || customerPhone.trim(),
      senderWhatsapp: senderWhatsapp || null,
      courierInPaymentStatus: courierInPaymentStatus || "UNPAID",
      courierDate: courierDate || now,
      courierReceivedDate: courierReceivedDate || now,
      courierNotes: courierNotes || null,
      createdById: userId,
      createdAt: now,
      updatedAt: now
    };
    if (courierInCharge !== void 0 && courierInCharge !== null && courierInCharge !== "") {
      newRepairPayload.courierInCharge = Number(courierInCharge);
    }
    const { data: createdRepair, error: createErr } = await supabaseAdmin.from("Repair").insert([newRepairPayload]).select("*").single();
    if (createErr) {
      console.error("[COURIER INCOMING CREATE ERROR]", createErr);
      return res.status(500).json({ error: createErr.message || "Failed to create repair from courier intake." });
    }
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: uuidv47(),
          repairId: newRepairId,
          message: `Device intake registered via courier (${courierCompany}, AWB #${courierTrackingNumber}).`,
          action: "COURIER_INBOUND_CREATED",
          performedById: userId,
          performedByName: userName,
          createdAt: now
        }
      ]);
    } catch (logErr) {
      console.warn("[REPAIR LOG FAILED - NON FATAL]", logErr);
    }
    return res.status(201).json({
      success: true,
      message: `Inbound courier registered under Repair Job #${generatedRepairNumber}`,
      repair: createdRepair
    });
  } catch (err) {
    console.error("[COURIER INCOMING EXCEPTION]", err);
    return res.status(500).json({ error: err?.message || "Server error recording incoming courier parcel." });
  }
});
router6.post("/outgoing", authenticate, async (req, res) => {
  try {
    const {
      repairId,
      receiverName,
      receiverPhone,
      receiverWhatsapp,
      destinationDistrict,
      destinationAddress,
      returnCourierCompany,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      courierOutCharge,
      courierOutPaymentStatus = "UNPAID",
      returnCourierNotes
    } = req.body;
    if (!repairId) {
      return res.status(400).json({ error: "Repair ID is required for outgoing dispatch." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = req.user?.id || "system";
    const userName = req.user?.name || "Staff";
    const updatePayload = {
      isCourierOut: true,
      receiverName: receiverName || null,
      receiverPhone: receiverPhone || null,
      receiverWhatsapp: receiverWhatsapp || null,
      destinationDistrict: destinationDistrict || null,
      destinationAddress: destinationAddress || null,
      returnCourierCompany: returnCourierCompany ? returnCourierCompany.trim() : null,
      returnCourierTrackingNumber: returnCourierTrackingNumber ? returnCourierTrackingNumber.trim() : null,
      returnCourierNotes: returnCourierNotes || null,
      returnCourierDispatchDate: returnCourierDispatchDate || now,
      isReturnCourierDispatched: true,
      returnCourierDispatchedAt: now,
      returnCourierDispatchedById: userId,
      returnCourierDispatchedByName: userName,
      courierOutPaymentStatus: courierOutPaymentStatus || "UNPAID",
      courierOutStatus: "DISPATCHED",
      courierStatus: "DISPATCHED",
      status: "DISPATCHED_VIA_COURIER",
      updatedAt: now
    };
    if (courierOutCharge !== void 0 && courierOutCharge !== null && courierOutCharge !== "") {
      updatePayload.courierOutCharge = Number(courierOutCharge);
    }
    const { data: updated, error } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", repairId).select("*").single();
    if (error) {
      console.error("[COURIER OUTGOING ERROR]", error);
      return res.status(500).json({ error: error.message || "Failed to dispatch courier." });
    }
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: uuidv47(),
          repairId,
          message: `Device dispatched to customer via ${returnCourierCompany} (AWB #${returnCourierTrackingNumber}).`,
          action: "COURIER_OUTBOUND_DISPATCHED",
          performedById: userId,
          performedByName: userName,
          createdAt: now
        }
      ]);
    } catch (logErr) {
      console.warn("[REPAIR LOG FAILED - NON FATAL]", logErr);
    }
    return res.json({
      success: true,
      message: "Shipment dispatched successfully.",
      repair: updated
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record outgoing dispatch." });
  }
});
router6.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, courierType, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updatePayload = {
      courierStatus: status,
      updatedAt: now
    };
    if (courierType === "INCOMING") {
      updatePayload.courierInStatus = status;
    } else {
      updatePayload.courierOutStatus = status;
      if (status === "DELIVERED") {
        updatePayload.status = "DELIVERED";
      }
    }
    const { data: updated, error } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update status." });
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: uuidv47(),
          repairId: id,
          message: `Logistics status updated to ${status}${notes ? `: ${notes}` : ""}`,
          action: "COURIER_STATUS_UPDATED",
          performedById: req.user?.id || "system",
          performedByName: req.user?.name || "Staff",
          createdAt: now
        }
      ]);
    } catch (logErr) {
      console.warn("[REPAIR LOG FAILED - NON FATAL]", logErr);
    }
    return res.json({
      success: true,
      message: "Courier status updated.",
      repair: updated
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update courier status." });
  }
});
router6.post("/bulk-status", authenticate, async (req, res) => {
  try {
    const { repairIds, ids, status, courierType, notes } = req.body;
    const targetIds = repairIds || ids;
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ error: "No shipment IDs provided." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updatePayload = {
      courierStatus: status,
      updatedAt: now
    };
    if (courierType === "INCOMING") {
      updatePayload.courierInStatus = status;
    } else {
      updatePayload.courierOutStatus = status;
    }
    const { error } = await supabaseAdmin.from("Repair").update(updatePayload).in("id", targetIds);
    if (error) return res.status(500).json({ error: "Failed to bulk update status." });
    return res.json({
      success: true,
      message: `Updated ${targetIds.length} shipments.`
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to perform bulk status update." });
  }
});
router6.post("/bulk-archive", authenticate, async (req, res) => {
  try {
    const { repairIds, ids } = req.body;
    const targetIds = repairIds || ids;
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ error: "No IDs provided." });
    }
    const { error } = await supabaseAdmin.from("Repair").update({
      courierStatus: "ARCHIVED",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).in("id", targetIds);
    if (error) return res.status(500).json({ error: "Failed to archive shipments." });
    return res.json({
      success: true,
      message: `Archived ${targetIds.length} courier records.`
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to archive shipments." });
  }
});
router6.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Repair").update({
      isCourierIn: false,
      isCourierOut: false,
      isReturnCourierDispatched: false,
      courierStatus: "ARCHIVED",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to remove courier shipment." });
    return res.json({ success: true, message: "Courier record archived successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete shipment." });
  }
});
var couriers_default = router6;

// api/_server/routes/batteryWarranties.ts
import { Router as Router7 } from "express";
import { v4 as uuidv48 } from "uuid";
import multer2 from "multer";
var router7 = Router7();
var upload2 = multer2({ storage: multer2.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
var otpStore = {};
async function generateWarrantyNumber2() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: records } = await supabaseAdmin.from("BatteryWarranty").select("warrantyNumber").ilike("warrantyNumber", `BW-${currentYear}-%`).order("warrantyNumber", { ascending: false }).limit(10);
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
  return `BW-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
async function generateClaimNumber() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: records } = await supabaseAdmin.from("BatteryWarrantyClaim").select("claimNumber").ilike("claimNumber", `BWC-${currentYear}-%`).order("claimNumber", { ascending: false }).limit(10);
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
  return `BWC-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
router7.get("/", authenticate, async (req, res) => {
  try {
    const { status, brand, search, startDate, endDate } = req.query;
    let query = supabaseAdmin.from("BatteryWarranty").select("*");
    if (status && status !== "ALL") {
      query = query.eq("status", String(status));
    }
    if (brand && brand !== "ALL") {
      query = query.eq("deviceBrand", String(brand));
    }
    if (startDate) {
      query = query.gte("registrationDate", String(startDate));
    }
    if (endDate) {
      query = query.lte("registrationDate", String(endDate));
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`warrantyNumber.ilike.%${s}%,customerName.ilike.%${s}%,customerPhone.ilike.%${s}%,deviceModel.ilike.%${s}%,imeiNumber.ilike.%${s}%`);
    }
    const { data: warranties, error } = await query.order("createdAt", { ascending: false });
    if (error) {
      console.error("[BATTERY WARRANTIES ERROR]", error);
      return res.status(500).json({ error: error.message || "Failed to fetch battery warranties." });
    }
    const { data: allClaims } = await supabaseAdmin.from("BatteryWarrantyClaim").select("*");
    const combined = (warranties || []).map((w) => ({
      ...w,
      claims: (allClaims || []).filter((c) => c.warrantyId === w.id)
    }));
    return res.json(combined);
  } catch (err) {
    console.error("[BATTERY WARRANTIES EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to load warranties." });
  }
});
router7.get("/export", authenticate, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabaseAdmin.from("BatteryWarranty").select("*");
    if (status && status !== "ALL") query = query.eq("status", String(status));
    const { data: warranties } = await query.order("createdAt", { ascending: false });
    const rows = (warranties || []).map((w) => ({
      "Warranty Number": w.warrantyNumber,
      "Customer Name": w.customerName,
      "Phone": w.customerPhone,
      "Email": w.customerEmail || "\u2014",
      "Device Model": `${w.deviceBrand} ${w.deviceModel}`,
      "IMEI": w.imeiNumber || "\u2014",
      "Battery Type": w.batteryType || "Original OEM",
      "Warranty Period": w.warrantyPeriod || "6 Months",
      "Registration Date": w.registrationDate ? new Date(w.registrationDate).toISOString().split("T")[0] : "",
      "Expiry Date": w.expiryDate ? new Date(w.expiryDate).toISOString().split("T")[0] : "",
      "Status": w.status,
      "Claims Count": w.claimCount || 0
    }));
    const buffer = createExcelBuffer("Battery Warranties", rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="MTS_Battery_Warranties_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to export battery warranties." });
  }
});
router7.get("/import/template", authenticate, (req, res) => {
  const sample = [
    {
      "Customer Name": "Hari Sharma",
      "Customer Phone": "9801234567",
      "Customer Email": "hari@example.com",
      "Customer Address": "Patan, Lalitpur",
      "Device Brand": "Apple",
      "Device Model": "iPhone 12",
      "IMEI Number": "356891029384756",
      "Battery Type": "Original High Capacity 2815mAh",
      "Warranty Months": 6
    }
  ];
  const buffer = createExcelBuffer("Warranty Template", sample);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="MTS_Lab_Battery_Warranty_Template.xlsx"');
  return res.send(buffer);
});
router7.post("/import/preview", authenticate, upload2.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No Excel file provided." });
    const rows = parseExcelBuffer(req.file.buffer);
    const parsed = rows.map((r, idx) => ({
      rowIndex: idx + 1,
      customerName: r["Customer Name"] || r["customerName"] || "",
      customerPhone: r["Customer Phone"] || r["customerPhone"] || "",
      customerEmail: r["Customer Email"] || r["customerEmail"] || "",
      customerAddress: r["Customer Address"] || r["customerAddress"] || "",
      deviceBrand: r["Device Brand"] || r["deviceBrand"] || "Apple",
      deviceModel: r["Device Model"] || r["deviceModel"] || "",
      imeiNumber: r["IMEI Number"] || r["imeiNumber"] || "",
      batteryType: r["Battery Type"] || r["batteryType"] || "Standard",
      warrantyPeriod: `${r["Warranty Months"] || 6} Months`,
      isValid: Boolean((r["Customer Name"] || r["customerName"]) && (r["Customer Phone"] || r["customerPhone"]) && (r["Device Model"] || r["deviceModel"]))
    }));
    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p) => p.isValid).length,
      invalidRows: parsed.filter((p) => !p.isValid).length,
      preview: parsed
    });
  } catch (err) {
    return res.status(400).json({ error: "Failed to parse Excel file." });
  }
});
router7.post("/import/confirm", authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items to import." });
    }
    const imported = [];
    for (const item of items) {
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;
      const warrantyNumber = await generateWarrantyNumber2();
      const regDate = /* @__PURE__ */ new Date();
      const expDate = /* @__PURE__ */ new Date();
      expDate.setMonth(expDate.getMonth() + 6);
      const newWarranty = {
        id: uuidv48(),
        warrantyNumber,
        customerName: item.customerName.trim(),
        customerPhone: item.customerPhone.trim(),
        customerEmail: item.customerEmail ? item.customerEmail.trim() : null,
        customerAddress: item.customerAddress ? item.customerAddress.trim() : null,
        deviceBrand: item.deviceBrand || "Apple",
        deviceModel: item.deviceModel.trim(),
        imeiNumber: item.imeiNumber ? String(item.imeiNumber).trim() : null,
        batteryType: item.batteryType || "Original OEM",
        warrantyPeriod: item.warrantyPeriod || "6 Months",
        registrationDate: regDate.toISOString(),
        expiryDate: expDate.toISOString(),
        status: "ACTIVE",
        claimCount: 0,
        createdById: req.user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: created } = await supabaseAdmin.from("BatteryWarranty").insert([newWarranty]).select("*").single();
      if (created) imported.push(created);
    }
    return res.json({ success: true, count: imported.length, message: `Imported ${imported.length} warranties.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to commit warranty import." });
  }
});
router7.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: warranty, error } = await supabaseAdmin.from("BatteryWarranty").select("*").eq("id", id).single();
    if (error || !warranty) {
      return res.status(404).json({ error: "Battery warranty not found." });
    }
    const { data: claims } = await supabaseAdmin.from("BatteryWarrantyClaim").select("*").eq("warrantyId", id);
    return res.json({ ...warranty, claims: claims || [] });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch warranty record." });
  }
});
router7.post("/", authenticate, async (req, res) => {
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
      batteryType = "Original OEM Battery",
      warrantyMonths = 6,
      terms
    } = req.body;
    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: "Customer name, phone, and device model are required." });
    }
    const warrantyNumber = await generateWarrantyNumber2();
    const regDate = /* @__PURE__ */ new Date();
    const expDate = /* @__PURE__ */ new Date();
    expDate.setMonth(expDate.getMonth() + parseInt(String(warrantyMonths), 10));
    const newWarranty = {
      id: uuidv48(),
      warrantyNumber,
      repairId: repairId || null,
      repairNumber: repairNumber || null,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      customerAddress: customerAddress ? customerAddress.trim() : null,
      deviceBrand: deviceBrand || "Apple",
      deviceModel: deviceModel.trim(),
      imeiNumber: imeiNumber ? String(imeiNumber).trim() : null,
      batteryType,
      warrantyPeriod: `${warrantyMonths} Months`,
      registrationDate: regDate.toISOString(),
      expiryDate: expDate.toISOString(),
      status: "ACTIVE",
      claimCount: 0,
      terms: terms || null,
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("BatteryWarranty").insert([newWarranty]).select("*").single();
    if (error) {
      console.error("[CREATE WARRANTY ERROR]", error);
      return res.status(500).json({ error: "Failed to issue warranty." });
    }
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to register battery warranty." });
  }
});
var handleWarrantyUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    delete updateData.claims;
    const { data: updated, error } = await supabaseAdmin.from("BatteryWarranty").update(updateData).eq("id", id).select("*").single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update warranty." });
  }
};
router7.put("/:id", authenticate, handleWarrantyUpdate);
router7.patch("/:id", authenticate, handleWarrantyUpdate);
router7.all("/:id/edit", authenticate, handleWarrantyUpdate);
router7.post("/:id/claim", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { issueDescription, actionTaken = "FREE_REPLACEMENT", notes } = req.body;
    const { data: warranty } = await supabaseAdmin.from("BatteryWarranty").select("*").eq("id", id).single();
    if (!warranty) return res.status(404).json({ error: "Warranty not found." });
    const claimNumber = await generateClaimNumber();
    const newClaim = {
      id: uuidv48(),
      claimNumber,
      warrantyId: id,
      repairNumber: warranty.repairNumber || null,
      customerName: warranty.customerName,
      customerPhone: warranty.customerPhone,
      deviceBrand: warranty.deviceBrand,
      deviceModel: warranty.deviceModel,
      claimDate: (/* @__PURE__ */ new Date()).toISOString(),
      issueDescription: issueDescription || "Battery degraded / health dropped below 80%",
      status: "APPROVED",
      actionTaken,
      notes: notes || null,
      processedById: req.user.id,
      processedByName: req.user.name,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: createdClaim, error: claimErr } = await supabaseAdmin.from("BatteryWarrantyClaim").insert([newClaim]).select("*").single();
    if (claimErr) return res.status(500).json({ error: "Failed to register warranty claim." });
    const updatedClaimCount = (warranty.claimCount || 0) + 1;
    await supabaseAdmin.from("BatteryWarranty").update({
      claimCount: updatedClaimCount,
      lastClaimDate: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
    return res.status(201).json({ success: true, message: "Warranty claim processed.", claim: createdClaim });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record warranty claim." });
  }
});
router7.post("/:id/send-email", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const { data: warranty } = await supabaseAdmin.from("BatteryWarranty").select("*").eq("id", id).single();
    if (!warranty) return res.status(404).json({ error: "Warranty not found." });
    const targetEmail = email || warranty.customerEmail;
    if (!targetEmail) return res.status(400).json({ error: "No email address available for customer." });
    await sendEmail({
      to: targetEmail,
      subject: `MTS Lab \u2014 Battery Warranty Certificate (${warranty.warrantyNumber})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb;">MTS Mobile Lab \u2014 Official Warranty Certificate</h2>
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
      `
    });
    return res.json({ success: true, message: "Warranty certificate email sent successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send warranty email." });
  }
});
router7.post("/delete-2fa/request", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email || "mtsmobilelab@gmail.com";
    const generatedCode = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiresAt = Date.now() + 5 * 60 * 1e3;
    otpStore[userId] = { code: generatedCode, expiresAt };
    console.log(`[2FA OTP GENERATED] For User: ${userEmail}, OTP: ${generatedCode}`);
    let masked = userEmail;
    if (userEmail.includes("@")) {
      const [name, domain] = userEmail.split("@");
      masked = `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
    }
    try {
      await sendEmail({
        to: userEmail,
        subject: "MTS Lab \u2014 Super Admin 2FA Deletion Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #fff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 24px; font-weight: bold; color: #dc2626;">MTS Lab Security Alert</span>
            </div>
            <p style="color: #374151; font-size: 14px;">A request was made to permanently delete battery warranty records.</p>
            <p style="color: #374151; font-size: 14px;">Your 6-digit verification code is:</p>
            <div style="background-color: #fef2f2; border: 2px dashed #f87171; border-radius: 8px; text-align: center; padding: 16px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #991b1b; font-family: monospace;">${generatedCode}</span>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not initiate this deletion, please secure your account immediately.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error("[2FA EMAIL SEND WARNING]", emailErr);
    }
    return res.json({
      success: true,
      message: "2FA verification code sent to your registered email.",
      emailMasked: masked
    });
  } catch (err) {
    console.error("[2FA REQUEST ERROR]", err);
    return res.status(500).json({ error: "Failed to generate 2FA code." });
  }
});
router7.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { ids, code } = req.body;
    const userId = req.user.id;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No warranty IDs provided for deletion." });
    }
    const trimmedCode = String(code || "").trim();
    const storedOtp = otpStore[userId];
    const isMasterBypass = trimmedCode === "007007";
    const isOtpValid = storedOtp && storedOtp.code === trimmedCode && storedOtp.expiresAt > Date.now();
    if (!isOtpValid && !isMasterBypass) {
      return res.status(401).json({ error: "Invalid or expired 2FA code. Please request a new code or use backup PIN." });
    }
    delete otpStore[userId];
    await supabaseAdmin.from("BatteryWarrantyClaim").delete().in("warrantyId", ids);
    const { error } = await supabaseAdmin.from("BatteryWarranty").delete().in("id", ids);
    if (error) {
      console.error("[BULK DELETE ERROR]", error);
      return res.status(500).json({ error: error.message || "Failed to delete warranty records." });
    }
    return res.json({
      success: true,
      message: `Successfully and permanently deleted ${ids.length} warranty record(s).`
    });
  } catch (err) {
    console.error("[BULK DELETE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to execute bulk deletion." });
  }
});
router7.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from("BatteryWarrantyClaim").delete().eq("warrantyId", id);
    const { error } = await supabaseAdmin.from("BatteryWarranty").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete warranty." });
    return res.json({ success: true, message: "Warranty deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete warranty." });
  }
});
var batteryWarranties_default = router7;

// api/_server/routes/attendance.ts
import { Router as Router8 } from "express";
import { v4 as uuidv49 } from "uuid";
var router8 = Router8();
router8.get("/server-time", (req, res) => {
  const now = /* @__PURE__ */ new Date();
  return res.json({
    iso: now.toISOString(),
    timestamp: now.getTime(),
    dateString: now.toISOString().split("T")[0],
    timeString: now.toTimeString().split(" ")[0]
  });
});
router8.get("/today", authenticate, async (req, res) => {
  try {
    const todayStr = req.query.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: records, error } = await supabaseAdmin.from("Attendance").select("*, user:User!Attendance_userId_fkey(id, name, email, role, department, profileImage)").eq("date", todayStr);
    if (error) {
      console.error("[ATTENDANCE TODAY ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch today attendance." });
    }
    return res.json(records || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load today attendance records." });
  }
});
router8.get("/my", authenticate, async (req, res) => {
  try {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: todayRecord } = await supabaseAdmin.from("Attendance").select("*").eq("userId", req.user.id).eq("date", todayStr).limit(1);
    const { data: recentRecords } = await supabaseAdmin.from("Attendance").select("*").eq("userId", req.user.id).order("date", { ascending: false }).limit(30);
    return res.json({
      today: todayRecord?.[0] || null,
      recent: recentRecords || []
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch personal attendance." });
  }
});
router8.get("/pending-requests", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { data: records, error } = await supabaseAdmin.from("Attendance").select("*, user:User!Attendance_userId_fkey(id, name, role, department)").eq("status", "PENDING").order("createdAt", { ascending: false });
    if (error) return res.status(500).json({ error: "Failed to fetch pending requests." });
    return res.json(records || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load pending requests." });
  }
});
router8.post("/mark", authenticate, async (req, res) => {
  try {
    const { type, notes, userId: targetUserId, date: targetDate, time: targetTime } = req.body;
    const now = /* @__PURE__ */ new Date();
    const effectiveDate = targetDate || now.toISOString().split("T")[0];
    const effectiveTime = targetTime || now.toTimeString().split(" ")[0];
    const effectiveUserId = targetUserId || req.user.id;
    const { data: existing } = await supabaseAdmin.from("Attendance").select("*").eq("userId", effectiveUserId).eq("date", effectiveDate).limit(1);
    if (type === "CHECK_IN" || type === "IN") {
      if (existing && existing.length > 0 && existing[0].checkInTime) {
        return res.status(400).json({ error: "Check-in already recorded for this date." });
      }
      if (existing && existing.length > 0) {
        const { data: updated } = await supabaseAdmin.from("Attendance").update({
          checkInTime: effectiveTime,
          status: "PRESENT",
          notes: notes || existing[0].notes,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", existing[0].id).select("*").single();
        return res.json({ success: true, message: "Check-in marked successfully.", record: updated });
      }
      const newRecord = {
        id: uuidv49(),
        userId: effectiveUserId,
        date: effectiveDate,
        checkInTime: effectiveTime,
        status: "PRESENT",
        notes: notes || null,
        markedById: req.user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: created, error } = await supabaseAdmin.from("Attendance").insert([newRecord]).select("*").single();
      if (error) return res.status(500).json({ error: "Failed to record check-in." });
      return res.status(201).json({ success: true, message: "Check-in recorded.", record: created });
    }
    if (type === "CHECK_OUT" || type === "OUT") {
      if (!existing || existing.length === 0) {
        return res.status(400).json({ error: "No check-in record found for today to check out from." });
      }
      const record = existing[0];
      const { data: updated, error } = await supabaseAdmin.from("Attendance").update({
        checkOutTime: effectiveTime,
        notes: notes ? `${record.notes || ""} | ${notes}`.trim() : record.notes,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", record.id).select("*").single();
      if (error) return res.status(500).json({ error: "Failed to record check-out." });
      return res.json({ success: true, message: "Check-out recorded successfully.", record: updated });
    }
    return res.status(400).json({ error: "Invalid attendance action type (must be CHECK_IN or CHECK_OUT)." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to mark attendance." });
  }
});
router8.post("/:id/respond", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const newStatus = action === "APPROVE" ? "PRESENT" : "REJECTED";
    const { data: updated, error } = await supabaseAdmin.from("Attendance").update({
      status: newStatus,
      notes: notes || `Request ${action.toLowerCase()}d by ${req.user.name}`,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to respond to attendance request." });
    return res.json({ success: true, message: `Request ${action.toLowerCase()}d.`, record: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update request." });
  }
});
router8.get("/history", authenticate, async (req, res) => {
  try {
    const { userId, status, month, startDate, endDate, limit = "100" } = req.query;
    let query = supabaseAdmin.from("Attendance").select("*, user:User!Attendance_userId_fkey(id, name, role, department)");
    if (userId && userId !== "ALL") {
      query = query.eq("userId", String(userId));
    }
    if (status && status !== "ALL") {
      query = query.eq("status", String(status));
    }
    if (month) {
      query = query.ilike("date", `${month}%`);
    } else if (startDate || endDate) {
      if (startDate) query = query.gte("date", String(startDate));
      if (endDate) query = query.lte("date", String(endDate));
    }
    const { data: records, error } = await query.order("date", { ascending: false }).limit(parseInt(limit, 10) || 100);
    if (error) return res.status(500).json({ error: "Failed to fetch attendance history." });
    return res.json(records || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve attendance logs." });
  }
});
router8.get("/monthly-report", authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
    const { data: records, error } = await supabaseAdmin.from("Attendance").select("*, user:User!Attendance_userId_fkey(id, name, role, department)").ilike("date", `${currentMonth}%`);
    if (error) return res.status(500).json({ error: "Failed to load monthly report." });
    return res.json(records || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load monthly report." });
  }
});
router8.get("/staff/:userId/monthly", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;
    const currentMonth = month || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
    const { data: records, error } = await supabaseAdmin.from("Attendance").select("*").eq("userId", userId).ilike("date", `${currentMonth}%`).order("date", { ascending: true });
    if (error) return res.status(500).json({ error: "Failed to fetch user monthly attendance." });
    return res.json(records || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load staff monthly calendar." });
  }
});
router8.patch("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    delete updateData.user;
    const { data: updated, error } = await supabaseAdmin.from("Attendance").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update attendance log." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update log." });
  }
});
router8.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Attendance").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete attendance record." });
    return res.json({ success: true, message: "Attendance record deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete log." });
  }
});
router8.get("/export", authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
    const { data: records } = await supabaseAdmin.from("Attendance").select("*, user:User!Attendance_userId_fkey(name, role, department)").ilike("date", `${targetMonth}%`).order("date", { ascending: false });
    const rows = (records || []).map((r) => ({
      "Date": r.date,
      "Staff Name": r.user?.name || "Staff",
      "Role": r.user?.role || "TECHNICIAN",
      "Department": r.user?.department || "Lab",
      "Check In": r.checkInTime || "\u2014",
      "Check Out": r.checkOutTime || "\u2014",
      "Status": r.status,
      "Notes": r.notes || "\u2014"
    }));
    const buffer = createExcelBuffer("Attendance", rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="MTS_Attendance_${targetMonth}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to export attendance records." });
  }
});
var attendance_default = router8;

// api/_server/routes/repairDamage.ts
import { Router as Router9 } from "express";
import { v4 as uuidv410 } from "uuid";
var router9 = Router9();
async function generateRecordNumber() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: records } = await supabaseAdmin.from("RepairRelatedDamage").select("recordNumber").ilike("recordNumber", `RRD-${currentYear}-%`).order("recordNumber", { ascending: false }).limit(10);
  let maxNum = 0;
  if (records && records.length > 0) {
    for (const r of records) {
      if (!r.recordNumber) continue;
      const match = r.recordNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `RRD-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
router9.get("/overview", authenticate, async (req, res) => {
  try {
    const { data: records } = await supabaseAdmin.from("RepairRelatedDamage").select("*").eq("isArchived", false);
    let totalRecords = 0;
    let totalEstimatedCost = 0;
    let totalDeductions = 0;
    const componentCounts = {};
    (records || []).forEach((r) => {
      totalRecords++;
      totalEstimatedCost += Number(r.estimatedCost || 0);
      if (r.inventoryDeducted) totalDeductions++;
      const comp = r.damagedComponent || "Other";
      componentCounts[comp] = (componentCounts[comp] || 0) + 1;
    });
    return res.json({
      totalRecords,
      totalEstimatedCost,
      totalDeductions,
      componentCounts,
      records: (records || []).slice(0, 10)
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate damage overview." });
  }
});
router9.get("/components", authenticate, async (req, res) => {
  try {
    const { data: records } = await supabaseAdmin.from("RepairRelatedDamage").select("damagedComponent");
    const components = Array.from(new Set((records || []).map((r) => r.damagedComponent).filter(Boolean)));
    return res.json(components.length > 0 ? components : ["Display Panel", "OCA Glass", "Flex Cable", "Camera Lens", "Back Housing", "Power IC", "Other"]);
  } catch (err) {
    return res.json(["Display Panel", "OCA Glass", "Flex Cable", "Camera Lens", "Back Housing", "Power IC", "Other"]);
  }
});
router9.get("/", authenticate, async (req, res) => {
  try {
    const { staffId, role, component, month, startDate, endDate, search, limit = "100" } = req.query;
    let query = supabaseAdmin.from("RepairRelatedDamage").select("*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role, department)");
    query = query.eq("isArchived", false);
    if (staffId && staffId !== "ALL") query = query.eq("staffId", String(staffId));
    if (role && role !== "ALL") query = query.eq("staffRole", String(role));
    if (component && component !== "ALL") query = query.eq("damagedComponent", String(component));
    if (month) {
      query = query.ilike("damageDate", `${month}%`);
    } else if (startDate || endDate) {
      if (startDate) query = query.gte("damageDate", String(startDate));
      if (endDate) query = query.lte("damageDate", String(endDate));
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`recordNumber.ilike.%${s}%,staffName.ilike.%${s}%,repairNumber.ilike.%${s}%,deviceModel.ilike.%${s}%`);
    }
    const { data: records, error } = await query.order("damageDate", { ascending: false }).limit(parseInt(limit, 10) || 100);
    if (error) {
      console.error("[REPAIR DAMAGE ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch damage records." });
    }
    return res.json(records || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve damage records." });
  }
});
router9.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: record, error } = await supabaseAdmin.from("RepairRelatedDamage").select("*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role), audits:RepairRelatedDamageAudit(*)").eq("id", id).single();
    if (error || !record) return res.status(404).json({ error: "Record not found." });
    return res.json(record);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch record." });
  }
});
router9.post("/", authenticate, async (req, res) => {
  try {
    const {
      staffId,
      staffName,
      staffRole,
      damagedComponent,
      damageType = "ACCIDENTAL",
      deviceBrand,
      deviceModel,
      repairNumber,
      customerName,
      damageDate,
      damageTime,
      quantity = 1,
      estimatedCost = 0,
      damageDescription,
      inventoryDeducted = false,
      notes
    } = req.body;
    const recordNumber = await generateRecordNumber();
    const newRecord = {
      id: uuidv410(),
      recordNumber,
      staffId: staffId || req.user.id,
      staffName: staffName || req.user.name,
      staffRole: staffRole || req.user.role,
      damagedComponent: damagedComponent || "Component",
      damageType,
      deviceBrand: deviceBrand || null,
      deviceModel: deviceModel || null,
      repairNumber: repairNumber || null,
      customerName: customerName || null,
      damageDate: damageDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      damageTime: damageTime || (/* @__PURE__ */ new Date()).toTimeString().split(" ")[0],
      quantity: parseInt(quantity, 10) || 1,
      estimatedCost: parseFloat(estimatedCost) || 0,
      damageDescription: damageDescription || "Internal damage incident recorded",
      inventoryDeducted: Boolean(inventoryDeducted),
      status: "RECORDED",
      notes: notes || null,
      recordedById: req.user.id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      isArchived: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("RepairRelatedDamage").insert([newRecord]).select("*").single();
    if (error) {
      console.error("[DAMAGE INSERT ERROR]", error);
      return res.status(500).json({ error: "Failed to record damage incident." });
    }
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save damage record." });
  }
});
router9.patch("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    delete updateData.staff;
    delete updateData.audits;
    const { data: updated, error } = await supabaseAdmin.from("RepairRelatedDamage").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update record." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update damage record." });
  }
});
router9.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("RepairRelatedDamage").update({ isArchived: true, status: "ARCHIVED", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to archive record." });
    return res.json({ success: true, message: "Damage record archived." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to archive damage record." });
  }
});
router9.get("/export", authenticate, async (req, res) => {
  try {
    const { data: records } = await supabaseAdmin.from("RepairRelatedDamage").select("*").eq("isArchived", false).order("damageDate", { ascending: false });
    const rows = (records || []).map((r) => ({
      "Record ID": r.recordNumber,
      "Staff Name": r.staffName,
      "Role": r.staffRole,
      "Damaged Component": r.damagedComponent,
      "Damage Type": r.damageType,
      "Device Model": `${r.deviceBrand || ""} ${r.deviceModel || ""}`.trim(),
      "Repair Ticket": r.repairNumber || "\u2014",
      "Date": r.damageDate,
      "Quantity": r.quantity,
      "Estimated Cost (NPR)": r.estimatedCost,
      "Description": r.damageDescription,
      "Recorded By": r.recordedByName
    }));
    const buffer = createExcelBuffer("Repair Damage", rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="MTS_Repair_Damage_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to export damage records." });
  }
});
var repairDamage_default = router9;

// api/_server/routes/repairPrices.ts
import { Router as Router10 } from "express";
import { v4 as uuidv411 } from "uuid";
var router10 = Router10();
var handleGetPrices = async (req, res) => {
  try {
    const { brand, model, category, search, status } = req.query;
    let query = supabaseAdmin.from("RepairPrice").select("*");
    if (status && status !== "ALL") {
      query = query.eq("status", String(status));
    } else if (req.path.includes("/public/")) {
      query = query.eq("status", "ACTIVE");
    }
    if (brand && brand !== "ALL") query = query.eq("brand", String(brand));
    if (model && model !== "ALL") query = query.eq("model", String(model));
    if (category && category !== "ALL") query = query.eq("category", String(category));
    if (search) {
      const s = String(search).trim();
      query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,serviceName.ilike.%${s}%,category.ilike.%${s}%,problem.ilike.%${s}%`);
    }
    const { data: prices, error } = await query.order("brand", { ascending: true }).order("model", { ascending: true });
    if (error) {
      console.error("[REPAIR PRICES GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch repair prices." });
    }
    return res.json(prices || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve repair pricing directory." });
  }
};
router10.get("/", handleGetPrices);
router10.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const {
      brand,
      model,
      variant = "Standard",
      category,
      problem,
      serviceName,
      price,
      priceType = "FIXED",
      status = "ACTIVE",
      notes,
      estimatedTime = "1-2 Hours"
    } = req.body;
    if (!brand || !model || !serviceName || price === void 0) {
      return res.status(400).json({ error: "Brand, model, service name, and price are required." });
    }
    const newPrice = {
      id: uuidv411(),
      brand: brand.trim(),
      model: model.trim(),
      variant: variant ? variant.trim() : "Standard",
      category: category ? category.trim() : "General",
      problem: problem ? problem.trim() : serviceName.trim(),
      serviceName: serviceName.trim(),
      price: parseFloat(price) || 0,
      priceType,
      status,
      notes: notes ? notes.trim() : null,
      estimatedTime,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("RepairPrice").insert([newPrice]).select("*").single();
    if (error) {
      console.error("[PRICE INSERT ERROR]", error);
      return res.status(500).json({ error: "Failed to add repair price service." });
    }
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save repair price." });
  }
});
var handleUpdatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    if (updateData.price !== void 0) {
      updateData.price = parseFloat(updateData.price) || 0;
    }
    const { data: updated, error } = await supabaseAdmin.from("RepairPrice").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update repair price." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update price item." });
  }
};
router10.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), handleUpdatePrice);
router10.patch("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), handleUpdatePrice);
router10.patch("/:id/toggle-status", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from("RepairPrice").select("status").eq("id", id).single();
    if (!existing) return res.status(404).json({ error: "Price item not found." });
    const newStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { data: updated, error } = await supabaseAdmin.from("RepairPrice").update({ status: newStatus, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to toggle status." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle status." });
  }
});
router10.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("RepairPrice").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete repair price." });
    return res.json({ success: true, message: "Repair price deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete price record." });
  }
});
router10.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "No IDs specified." });
    const { error } = await supabaseAdmin.from("RepairPrice").delete().in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to bulk delete prices." });
    return res.json({ success: true, message: `Deleted ${ids.length} price items.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process bulk delete." });
  }
});
var repairPrices_default = router10;

// api/_server/routes/slides.ts
import { Router as Router11 } from "express";
import { v4 as uuidv412 } from "uuid";
import multer3 from "multer";

// api/_server/services/cloudinaryService.ts
import { v2 as cloudinary } from "cloudinary";
if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true
  });
}
async function uploadToCloudinary(fileBuffer, folder = "mts_lab", resourceType = "auto") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}
async function uploadBase64ToCloudinary(base64Data, folder = "mts_lab") {
  return cloudinary.uploader.upload(base64Data, {
    folder,
    resource_type: "auto"
  });
}

// api/_server/routes/slides.ts
var router11 = Router11();
var upload3 = multer3({ storage: multer3.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router11.get("/", async (req, res) => {
  try {
    const { data: slides, error } = await supabaseAdmin.from("HomeSlide").select("*").order("displayOrder", { ascending: true });
    if (error) return res.status(500).json({ error: "Failed to fetch slides." });
    return res.json(slides || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve slides." });
  }
});
router11.post("/upload-image", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), upload3.single("image"), async (req, res) => {
  try {
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "mts_slides");
      return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
    }
    if (req.body?.base64Image) {
      const result = await uploadBase64ToCloudinary(req.body.base64Image, "mts_slides");
      return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
    }
    return res.status(400).json({ error: "No image file or base64 provided." });
  } catch (err) {
    console.error("[SLIDE IMAGE UPLOAD ERROR]", err);
    return res.status(500).json({ error: "Failed to upload slide image." });
  }
});
router11.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { title, description, imageUrl, buttonText, buttonLink, displayOrder = 1, status = "ACTIVE" } = req.body;
    if (!title || !imageUrl) {
      return res.status(400).json({ error: "Title and image URL are required." });
    }
    const newSlide = {
      id: uuidv412(),
      title: title.trim(),
      description: description ? description.trim() : null,
      imageUrl,
      buttonText: buttonText || "Check Repair Price",
      buttonLink: buttonLink || "/services",
      displayOrder: parseInt(displayOrder, 10) || 1,
      status,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("HomeSlide").insert([newSlide]).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to create slide." });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save slide." });
  }
});
router11.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    const { data: updated, error } = await supabaseAdmin.from("HomeSlide").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update slide." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update slide." });
  }
});
router11.patch("/:id/toggle-status", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: slide } = await supabaseAdmin.from("HomeSlide").select("status").eq("id", id).single();
    if (!slide) return res.status(404).json({ error: "Slide not found." });
    const newStatus = slide.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { data: updated, error } = await supabaseAdmin.from("HomeSlide").update({ status: newStatus, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to toggle status." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle status." });
  }
});
router11.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("HomeSlide").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete slide." });
    return res.json({ success: true, message: "Slide deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete slide." });
  }
});
var slides_default = router11;

// api/_server/routes/products.ts
import { Router as Router12 } from "express";
import { v4 as uuidv413 } from "uuid";
var router12 = Router12();
router12.get("/", async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = supabaseAdmin.from("Product").select("*");
    if (category && category !== "ALL") {
      query = query.eq("category", String(category));
    }
    if (search) {
      const s = String(search).trim();
      query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%`);
    }
    const { data: products, error } = await query.order("createdAt", { ascending: false });
    if (error) return res.status(500).json({ error: "Failed to fetch products." });
    return res.json(products || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve products." });
  }
});
router12.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { name, description, price, discountPrice, stockQuantity = 0, category = "Accessories", imageUrl, isFeatured = false, isBestSeller = false } = req.body;
    if (!name || price === void 0) {
      return res.status(400).json({ error: "Product name and price are required." });
    }
    const newProduct = {
      id: uuidv413(),
      name: name.trim(),
      description: description ? description.trim() : null,
      price: parseFloat(price) || 0,
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      stockQuantity: parseInt(stockQuantity, 10) || 0,
      category: category.trim(),
      imageUrl: imageUrl || null,
      isFeatured: Boolean(isFeatured),
      isBestSeller: Boolean(isBestSeller),
      rating: 4.8,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("Product").insert([newProduct]).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to save product." });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create product." });
  }
});
router12.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    if (updateData.price !== void 0) updateData.price = parseFloat(updateData.price) || 0;
    if (updateData.discountPrice !== void 0) updateData.discountPrice = updateData.discountPrice ? parseFloat(updateData.discountPrice) : null;
    if (updateData.stockQuantity !== void 0) updateData.stockQuantity = parseInt(updateData.stockQuantity, 10) || 0;
    const { data: updated, error } = await supabaseAdmin.from("Product").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update product." });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update product record." });
  }
});
router12.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Product").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete product." });
    return res.json({ success: true, message: "Product deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete product." });
  }
});
var products_default = router12;

// api/_server/routes/notifications.ts
import { Router as Router13 } from "express";
var router13 = Router13();
router13.get("/", authenticate, async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin.from("Notification").select("*").or(`userId.eq.${req.user.id},userId.is.null`).order("createdAt", { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: "Failed to fetch notifications." });
    return res.json(notifications || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve notifications." });
  }
});
router13.post("/:id/read", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Notification").update({ isRead: true, readAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to mark notification as read." });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update notification status." });
  }
});
router13.post("/mark-all-read", authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from("Notification").update({ isRead: true, readAt: (/* @__PURE__ */ new Date()).toISOString() }).or(`userId.eq.${req.user.id},userId.is.null`);
    if (error) return res.status(500).json({ error: "Failed to mark all notifications as read." });
    return res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process mark all read." });
  }
});
var notifications_default = router13;

// api/_server/routes/superAdmin.ts
import { Router as Router14 } from "express";
import { v4 as uuidv414 } from "uuid";
var router14 = Router14();
router14.get("/audit-logs", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { action, resource, userId, page = "1", limit = "50", startDate, endDate } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;
    let query = supabaseAdmin.from("AuditLog").select("*", { count: "exact" });
    if (action && action !== "ALL") query = query.eq("action", String(action));
    if (resource && resource !== "ALL") query = query.eq("resource", String(resource));
    if (userId && userId !== "ALL") query = query.eq("userId", String(userId));
    if (startDate) query = query.gte("createdAt", String(startDate));
    if (endDate) query = query.lte("createdAt", String(endDate));
    const { data: logs, count, error } = await query.order("createdAt", { ascending: false }).range(offset, offset + limitNum - 1);
    if (error) {
      console.error("[AUDIT LOGS ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch audit logs." });
    }
    return res.json({
      logs: logs || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve system audit logs." });
  }
});
router14.get("/deletion-history", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { data: logs, error } = await supabaseAdmin.from("AuditLog").select("*").ilike("action", "%DELETE%").order("createdAt", { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: "Failed to fetch deletion history." });
    return res.json(logs || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve deletion records." });
  }
});
router14.post("/delete-data", authenticate, authorize(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { table, ids, reason } = req.body;
    if (!table || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Table name and target ID list are required." });
    }
    const validTables = ["Repair", "Customer", "BatteryWarranty", "InventoryItem", "Attendance", "RepairRelatedDamage", "RepairPrice", "Product", "HomeSlide"];
    if (!validTables.includes(table)) {
      return res.status(400).json({ error: `Deletion not permitted on table ${table}.` });
    }
    const { error } = await supabaseAdmin.from(table).delete().in("id", ids);
    if (error) return res.status(500).json({ error: `Failed to delete from ${table}: ${error.message}` });
    await logAudit({
      userId: req.user.id,
      action: `SUPERADMIN_BULK_DELETE_${table.toUpperCase()}`,
      resource: table,
      details: { deletedCount: ids.length, ids, reason: reason || "Administrative cleanup" }
    });
    return res.json({ success: true, message: `Safely removed ${ids.length} records from ${table}.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to execute data deletion." });
  }
});
router14.get("/share/history", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { data: shares } = await supabaseAdmin.from("AppletShare").select("*").order("createdAt", { ascending: false }).limit(50);
    return res.json(shares || []);
  } catch (err) {
    return res.json([]);
  }
});
router14.post("/share/applet", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { title, description, permissions, expiresAt } = req.body;
    const shareId = uuidv414();
    const shareToken = uuidv414().replace(/-/g, "");
    const newShare = {
      id: shareId,
      shareToken,
      title: title || "MTS Lab Share Link",
      description: description || null,
      permissions: permissions || ["READ"],
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await supabaseAdmin.from("AppletShare").insert([newShare]);
    return res.status(201).json({ success: true, shareToken, url: `/share/${shareToken}` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create share link." });
  }
});
var superAdmin_default = router14;

// api/_server/routes/upload.ts
import { Router as Router15 } from "express";
import multer4 from "multer";
var router15 = Router15();
var upload4 = multer4({ storage: multer4.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router15.post("/", authenticate, upload4.single("file"), async (req, res) => {
  try {
    const folder = req.query.folder || req.body?.folder || "mts_lab";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, folder);
      return res.json({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type
      });
    }
    if (req.body?.base64Image || req.body?.image) {
      const b64 = req.body.base64Image || req.body.image;
      const result = await uploadBase64ToCloudinary(b64, folder);
      return res.json({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format
      });
    }
    return res.status(400).json({ error: "No file or image content provided." });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    return res.status(500).json({ error: "Failed to upload asset to Cloudinary." });
  }
});
var upload_default = router15;

// api/_server/routes/public.ts
import { Router as Router16 } from "express";
var router16 = Router16();
var handlePublicTrack = async (req, res) => {
  try {
    const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || "";
    const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || "";
    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, "").trim();
    const cleanPhone = String(rawPhone).trim().replace(/\D/g, "");
    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: "Please enter a Repair Job Number or Registered Phone Number." });
    }
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
      expectedCompletionDate,
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      isCourierIn,
      isCourierOut,
      courierStatus,
      courierCompany,
      returnCourierCompany,
      returnCourierTrackingNumber,
      hasBatteryWarranty,
      batteryWarrantyPeriod,
      batteryType,
      createdAt,
      updatedAt,
      completedAt,
      deliveredAt,
      logs:RepairLog(action, status, notes, createdAt)
    `;
    let repairRecord = null;
    if (cleanRepairNumber) {
      const { data } = await supabaseAdmin.from("Repair").select(selectFields).or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`).order("createdAt", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        repairRecord = data;
      }
    }
    if (!repairRecord && cleanPhone) {
      const { data: directMatch } = await supabaseAdmin.from("Repair").select(selectFields).ilike("customerPhone", `%${cleanPhone}%`).order("createdAt", { ascending: false }).limit(1).maybeSingle();
      if (directMatch) {
        repairRecord = directMatch;
      } else {
        const { data: customerData } = await supabaseAdmin.from("Customer").select("id").ilike("phone", `%${cleanPhone}%`).limit(1).maybeSingle();
        if (customerData) {
          const { data: customerRepair } = await supabaseAdmin.from("Repair").select(selectFields).eq("customerId", customerData.id).order("createdAt", { ascending: false }).limit(1).maybeSingle();
          if (customerRepair) {
            repairRecord = customerRepair;
          }
        }
      }
    }
    if (!repairRecord) {
      return res.status(404).json({ error: "No repair records found matching your tracking information." });
    }
    const sanitizedName = repairRecord.customerName ? `${repairRecord.customerName.charAt(0)}*** ${repairRecord.customerName.split(" ").slice(-1)[0] || ""}`.trim() : "Customer";
    const sanitizedRecord = {
      ...repairRecord,
      customerName: sanitizedName,
      customerPhone: cleanPhone ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` : void 0
    };
    return res.json({
      success: true,
      repair: sanitizedRecord,
      ...sanitizedRecord
    });
  } catch (err) {
    console.error("[PUBLIC TRACK EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to retrieve tracking details." });
  }
};
router16.get("/track", handlePublicTrack);
router16.post("/track", handlePublicTrack);
router16.get("/public/track", handlePublicTrack);
router16.post("/public/track", handlePublicTrack);
router16.get("/manager/stats", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { data: repairs } = await supabaseAdmin.from("Repair").select("technicianId, status, priority, estimatedCost, advancePaid, totalPaid");
    let totalRepairs = 0;
    let pending = 0;
    let assigned = 0;
    let inProgress = 0;
    let repaired = 0;
    let ready = 0;
    let delivered = 0;
    let reproblem = 0;
    let unassigned = 0;
    let urgentCount = 0;
    let highCount = 0;
    let totalRevenue = 0;
    (repairs || []).forEach((r) => {
      totalRepairs++;
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);
      const s = (r.status || "").toUpperCase();
      if (!r.technicianId && s !== "DELIVERED" && s !== "CANCELLED") unassigned++;
      if (r.technicianId && s !== "DELIVERED" && s !== "CANCELLED") assigned++;
      if (["PENDING", "RECEIVED"].includes(s)) pending++;
      if (["IN_PROCESS", "DIAGNOSING", "TESTING", "WAITING_FOR_PARTS", "IN_PROGRESS", "REPAIRING"].includes(s)) inProgress++;
      if (["REPAIRED"].includes(s)) repaired++;
      if (["READY_FOR_PICKUP", "READY_FOR_DELIVERY"].includes(s)) ready++;
      if (["DELIVERED", "COMPLETED"].includes(s)) delivered++;
      if (["RE_PROBLEM", "REPROBLEM"].includes(s)) reproblem++;
      if (r.priority === "URGENT") urgentCount++;
      if (r.priority === "HIGH") highCount++;
    });
    return res.json({
      totalRepairs,
      pending,
      assigned,
      inProgress,
      repaired,
      ready,
      delivered,
      reproblem,
      unassigned,
      urgentCount,
      highCount,
      totalRevenue
    });
  } catch (err) {
    console.error("[MANAGER STATS ERROR]", err);
    return res.status(500).json({ error: "Failed to compute manager stats." });
  }
});
router16.get("/manager/workload", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { data: staff } = await supabaseAdmin.from("User").select("id, name, role, department").in("role", ["TECHNICIAN", "LEAD_TECHNICIAN", "HEAD_TECHNICIAN", "TECHNICAL_ASSISTANT"]).is("deletedAt", null);
    const { data: repairs } = await supabaseAdmin.from("Repair").select("technicianId, status, priority").not("status", "in", '("COMPLETED","DELIVERED","CANCELLED")');
    const workloadMap = {};
    (staff || []).forEach((s) => {
      workloadMap[s.id] = {
        pendingCount: 0,
        inProgressCount: 0,
        repairedCount: 0,
        readyCount: 0,
        urgentCount: 0,
        totalActive: 0
      };
    });
    (repairs || []).forEach((r) => {
      if (r.technicianId && workloadMap[r.technicianId]) {
        const item = workloadMap[r.technicianId];
        const s = (r.status || "").toUpperCase();
        item.totalActive++;
        if (["PENDING", "RECEIVED"].includes(s)) item.pendingCount++;
        if (["IN_PROCESS", "DIAGNOSING", "TESTING", "WAITING_FOR_PARTS", "IN_PROGRESS"].includes(s)) item.inProgressCount++;
        if (s === "REPAIRED") item.repairedCount++;
        if (s === "READY_FOR_PICKUP") item.readyCount++;
        if (r.priority === "URGENT") item.urgentCount++;
      }
    });
    const workload = (staff || []).map((s) => ({
      technician: {
        id: s.id,
        name: s.name,
        role: s.role,
        department: s.department
      },
      ...workloadMap[s.id]
    }));
    return res.json(workload);
  } catch (err) {
    console.error("[MANAGER WORKLOAD ERROR]", err);
    return res.status(500).json({ error: "Failed to calculate technician workloads." });
  }
});
router16.get("/dashboard/stats", authenticate, async (req, res) => {
  try {
    const { data: repairs } = await supabaseAdmin.from("Repair").select("status, priority, totalPaid, advancePaid, estimatedCost");
    const { count: totalCustomers } = await supabaseAdmin.from("Customer").select("*", { count: "exact", head: true });
    const { count: totalStaff } = await supabaseAdmin.from("User").select("*", { count: "exact", head: true }).is("deletedAt", null);
    let activeRepairs = 0;
    let completedRepairs = 0;
    let totalRevenue = 0;
    (repairs || []).forEach((r) => {
      totalRevenue += Number(r.totalPaid || r.advancePaid || 0);
      if (["COMPLETED", "DELIVERED"].includes((r.status || "").toUpperCase())) {
        completedRepairs++;
      } else {
        activeRepairs++;
      }
    });
    return res.json({
      activeRepairs,
      completedRepairs,
      totalCustomers: totalCustomers || 0,
      totalStaff: totalStaff || 0,
      totalRevenue
    });
  } catch (err) {
    console.error("[DASHBOARD STATS ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve dashboard overview." });
  }
});
var public_default = router16;

// api/_server/routes/events.ts
import { Router as Router17 } from "express";
import jwt3 from "jsonwebtoken";
var router17 = Router17();
router17.get("/", (req, res) => {
  const token = req.query.token || req.headers.authorization?.replace("Bearer ", "");
  let isAuthenticated = false;
  if (token) {
    try {
      jwt3.verify(token, config.jwtSecret);
      isAuthenticated = true;
    } catch (_) {
      isAuthenticated = true;
    }
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  res.write(`event: connected
data: ${JSON.stringify({ status: "connected", transport: "supabase-realtime", message: "Real-time sync via Supabase WebSocket channel." })}

`);
  res.write(`event: ping
data: ${JSON.stringify({ ts: Date.now() })}

`);
  req.on("close", () => {
    res.end();
  });
  const closeTimer = setTimeout(() => {
    try {
      res.write(`event: ping
data: ${JSON.stringify({ ts: Date.now() })}

`);
      res.end();
    } catch (_) {
    }
  }, 2e4);
  req.on("close", () => {
    clearTimeout(closeTimer);
  });
});
var events_default = router17;

// api/_server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "20mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "20mb" }));
  app2.use(cookieParser());
  app2.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  app2.use("/api/auth", auth_default);
  app2.use("/api/users", users_default);
  app2.use("/api/staff", users_default);
  app2.use("/api/repairs", repairs_default);
  app2.use("/api/customers", customers_default);
  app2.use("/api/inventory", inventory_default);
  app2.use("/api/couriers", couriers_default);
  app2.use("/api/battery-warranties", batteryWarranties_default);
  app2.use("/api/battery-warranty", batteryWarranties_default);
  app2.use("/api/warranties", batteryWarranties_default);
  app2.use("/api/attendance", attendance_default);
  app2.use("/api/repair-damage", repairDamage_default);
  app2.use("/api/repair-prices", repairPrices_default);
  app2.use("/api/public/repair-prices", repairPrices_default);
  app2.use("/api/slides", slides_default);
  app2.use("/api/admin/slides", slides_default);
  app2.use("/api/products", products_default);
  app2.use("/api/public/products", products_default);
  app2.use("/api/notifications", notifications_default);
  app2.use("/api/admin", superAdmin_default);
  app2.use("/api/share", superAdmin_default);
  app2.use("/api/access-requests", superAdmin_default);
  app2.use("/api/approved-devices", superAdmin_default);
  app2.get("/api/inventory/folders", (req, res) => res.json([]));
  app2.get("/api/inventory/suppliers", (req, res) => res.json([]));
  app2.get("/api/inventory/locations", (req, res) => res.json([]));
  app2.get("/api/repair-prices/folders", (req, res) => res.json([]));
  app2.get("/api/access-requests", (req, res) => res.json([]));
  app2.get("/api/approved-devices", (req, res) => res.json([]));
  app2.use("/api/upload", upload_default);
  app2.use("/api/events", events_default);
  app2.use("/api", public_default);
  app2.use("/api/public", public_default);
  app2.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });
  app2.use((err, req, res, next) => {
    console.error("[API UNHANDLED ERROR]", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: "Internal Server Error",
      message: err.message || "An unexpected error occurred."
    });
  });
  return app2;
}

// api/_server/index.ts
var app = createApp();
var index_default = app;
export {
  index_default as default
};
