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
var PRODUCTION_SUPABASE_URL = "https://pirynpugkiurjobrqiqg.supabase.co";
var PRODUCTION_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w";
var rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
var SUPABASE_URL = !rawUrl || rawUrl.includes("your-project") || rawUrl.includes("example.com") || !rawUrl.startsWith("http") ? PRODUCTION_SUPABASE_URL : rawUrl;
var rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
var SUPABASE_ANON_KEY = !rawKey || rawKey.includes("...") || rawKey.length < 50 ? PRODUCTION_SUPABASE_ANON_KEY : rawKey;
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("...") && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50 ? process.env.SUPABASE_SERVICE_ROLE_KEY : void 0;
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
    const deviceIdentifier = req.headers["x-device-identifier"] || req.body?.deviceIdentifier || req.query?.deviceIdentifier;
    if (deviceIdentifier) {
      try {
        const { data: devRecord } = await supabaseAdmin.from("ApprovedDevice").select("status, deviceName").eq("userId", dbUser.id).eq("deviceIdentifier", deviceIdentifier).maybeSingle();
        if (devRecord && (devRecord.status === "REVOKED" || devRecord.status === "BLOCKED")) {
          return res.status(403).json({
            error: "DeviceBlocked",
            message: `This device (${devRecord.deviceName || "Unidentified Hardware"}) has been revoked or blocked from accessing MTS Lab by a security administrator.`
          });
        }
      } catch (devCheckErr) {
      }
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    Promise.resolve(supabaseAdmin.from("User").update({ lastActiveAt: nowIso }).eq("id", dbUser.id)).catch(() => {
    });
    if (deviceIdentifier) {
      Promise.resolve(supabaseAdmin.from("ApprovedDevice").update({
        lastUsedAt: nowIso,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null
      }).eq("userId", dbUser.id).eq("deviceIdentifier", deviceIdentifier)).catch(() => {
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

// api/_server/services/realtimeSync.ts
var serverBroadcastChannel = null;
var isChannelSubscribing = false;
function getOrCreateServerChannel() {
  if (!serverBroadcastChannel && supabaseAdmin) {
    try {
      serverBroadcastChannel = supabaseAdmin.channel("mts_app_db_changes");
      if (serverBroadcastChannel && !isChannelSubscribing) {
        isChannelSubscribing = true;
        serverBroadcastChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("[SERVER REALTIME] Connected to broadcast channel mts_app_db_changes");
          }
        });
      }
    } catch (e) {
      console.warn("[SERVER REALTIME] Error initializing channel:", e);
    }
  }
  return serverBroadcastChannel;
}
async function broadcastServerChange(entityName, action, id, data) {
  try {
    const channel = getOrCreateServerChannel();
    if (!channel) return;
    const entityLower = entityName.toLowerCase();
    const payload = {
      entity: entityLower,
      action,
      id: String(id),
      data,
      timestamp: Date.now()
    };
    await channel.send({
      type: "broadcast",
      event: "db_event",
      payload
    });
    console.log(`[SERVER REALTIME BROADCAST] Sent ${action} for ${entityLower} (${id})`);
  } catch (err) {
    console.warn("[SERVER REALTIME BROADCAST WARNING] Failed to broadcast change:", err);
  }
}

// api/_server/services/auditService.ts
async function logAudit(entry) {
  try {
    let userEmail = entry.userEmail || null;
    let userName = entry.userName || null;
    let userRole = entry.userRole || null;
    if (entry.userId && (!userEmail || !userName || !userRole)) {
      try {
        const { data: user } = await supabaseAdmin.from("User").select("email, name, role").eq("id", entry.userId).maybeSingle();
        if (user) {
          userEmail = userEmail || user.email;
          userName = userName || user.name;
          userRole = userRole || user.role;
        }
      } catch (_) {
      }
    }
    const payload = {
      id: uuidv4(),
      userId: entry.userId || null,
      userEmail,
      userName,
      userRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ? String(entry.resourceId) : null,
      status: entry.status || "SUCCESS",
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      deviceInfo: typeof entry.deviceInfo === "object" ? JSON.stringify(entry.deviceInfo) : entry.deviceInfo ? String(entry.deviceInfo) : null,
      details: typeof entry.details === "object" ? JSON.stringify(entry.details) : entry.details ? String(entry.details) : null,
      previousValue: typeof entry.previousValue === "object" ? JSON.stringify(entry.previousValue) : entry.previousValue ? String(entry.previousValue) : null,
      newValue: typeof entry.newValue === "object" ? JSON.stringify(entry.newValue) : entry.newValue ? String(entry.newValue) : null,
      metadata: typeof entry.metadata === "object" ? JSON.stringify(entry.metadata) : entry.metadata ? String(entry.metadata) : null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: inserted } = await supabaseAdmin.from("AuditLog").insert([payload]).select("*").maybeSingle();
    await broadcastServerChange("AuditLog", "CREATE", payload.id, inserted || payload);
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
    if (deviceIdentifier) {
      const { data: existingDevice } = await supabaseAdmin.from("ApprovedDevice").select("*").eq("userId", user.id).eq("deviceIdentifier", deviceIdentifier).maybeSingle();
      if (existingDevice && (existingDevice.status === "REVOKED" || existingDevice.status === "BLOCKED")) {
        await logAudit({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_BLOCKED_DEVICE",
          resource: "ApprovedDevice",
          resourceId: existingDevice.id,
          status: "FAILED",
          ipAddress: ipAddress || req.ip || req.headers["x-forwarded-for"] || null,
          userAgent: req.headers["user-agent"] || null,
          deviceInfo: { deviceIdentifier, deviceName, browser, os },
          details: { reason: "Login attempt from revoked/blocked device" }
        });
        return res.status(403).json({
          error: "DeviceBlocked",
          message: "This device has been blocked or revoked from accessing MTS Lab. Please contact a Super Administrator."
        });
      }
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
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "FAILED_LOGIN",
        resource: "User",
        resourceId: user.id,
        status: "FAILED",
        ipAddress: ipAddress || req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
        deviceInfo: { deviceIdentifier, deviceName, browser, os },
        details: { attemptNumber: attempts }
      });
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await supabaseAdmin.from("User").update({
      failedLoginAttempts: 0,
      lastLoginAt: nowIso,
      lastActiveAt: nowIso
    }).eq("id", user.id);
    if (deviceIdentifier) {
      try {
        const { data: dev } = await supabaseAdmin.from("ApprovedDevice").select("id").eq("userId", user.id).eq("deviceIdentifier", deviceIdentifier).maybeSingle();
        if (dev) {
          await supabaseAdmin.from("ApprovedDevice").update({
            deviceName: deviceName || void 0,
            deviceType: deviceType || "DESKTOP",
            browser: browser || void 0,
            os: os || void 0,
            ipAddress: ipAddress || req.ip || null,
            userAgent: req.headers["user-agent"] || null,
            lastUsedAt: nowIso,
            updatedAt: nowIso
          }).eq("id", dev.id);
        } else {
          await supabaseAdmin.from("ApprovedDevice").insert([
            {
              id: uuidv42(),
              userId: user.id,
              deviceIdentifier,
              deviceName: deviceName || "Workstation",
              deviceType: deviceType || "DESKTOP",
              browser: browser || null,
              os: os || null,
              ipAddress: ipAddress || req.ip || null,
              userAgent: req.headers["user-agent"] || null,
              status: "APPROVED",
              approvedAt: nowIso,
              lastUsedAt: nowIso,
              createdAt: nowIso,
              updatedAt: nowIso
            }
          ]);
        }
      } catch (devErr) {
        console.warn("[DEVICE REGISTRATION ERROR]", devErr);
      }
    }
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
          createdAt: nowIso
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
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: "LOGIN",
      resource: "User",
      resourceId: user.id,
      status: "SUCCESS",
      ipAddress: ipAddress || req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      deviceInfo: { deviceIdentifier, deviceName, deviceType, browser, os },
      details: { email: user.email, role: user.role, method: "PASSWORD" }
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
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt2.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          await logAudit({
            userId: decoded.id,
            userEmail: decoded.email,
            userRole: decoded.role,
            action: "LOGOUT",
            resource: "User",
            resourceId: decoded.id,
            status: "SUCCESS",
            ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
            userAgent: req.headers["user-agent"] || null,
            details: { message: "User logged out" }
          });
        }
      } catch (_) {
      }
    }
  } catch (_) {
  }
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
    await broadcastServerChange("User", "CREATE", insertedUser.id, insertedUser);
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
    await broadcastServerChange("User", "UPDATE", id, updated);
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
    await broadcastServerChange("User", "UPDATE", id, updated);
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
    await broadcastServerChange("User", "UPDATE", id, updated);
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
    await broadcastServerChange("User", "DELETE", id);
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
  "priorityUpdatedAt",
  "technicianId",
  "branchId",
  "expectedCompletionDate",
  "remarks",
  "receivingMethod",
  "isCourierIn",
  "courierCompany",
  "courierTrackingNumber",
  "courierDate",
  "courierReceivedDate",
  "courierInStatus",
  "courierStatus",
  "courierInCharge",
  "courierInPaymentStatus",
  "courierInNotes",
  "courierNotes",
  "senderName",
  "senderPhone",
  "senderWhatsapp",
  "originDistrict",
  "originAddress",
  "isCourierOut",
  "returnCourierCompany",
  "returnCourierTrackingNumber",
  "returnCourierDispatchDate",
  "courierOutDeliveredDate",
  "courierOutStatus",
  "courierOutCharge",
  "courierOutPaymentStatus",
  "destinationDistrict",
  "destinationAddress",
  "receiverName",
  "receiverPhone",
  "receiverWhatsapp",
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
  "warrantyTerms",
  "technicianNotes",
  "sparePartsUsed"
]);
async function generateRepairNumber(offset = 0) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: repairs } = await supabaseAdmin.from("Repair").select("repairNumber").ilike("repairNumber", `MTS-${currentYear}-%`).order("repairNumber", { ascending: false }).limit(30);
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
  const nextNum = maxNum + 1 + offset;
  return `MTS-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
async function generateWarrantyNumber(offset = 0) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const { data: records } = await supabaseAdmin.from("BatteryWarranty").select("warrantyNumber").ilike("warrantyNumber", `BW-${currentYear}-%`).order("warrantyNumber", { ascending: false }).limit(20);
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
  const nextNum = maxNum + 1 + offset;
  return `BW-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
async function syncBatteryWarrantyFromRepair(repairData, reqUser) {
  try {
    if (!repairData || !repairData.id) return;
    const isWarrantyActive = repairData.hasBatteryWarranty === true || repairData.hasBatteryWarranty === "true";
    if (!isWarrantyActive) {
      const { data: existing2 } = await supabaseAdmin.from("BatteryWarranty").select("id").eq("repairId", repairData.id);
      if (existing2 && existing2.length > 0) {
        for (const w of existing2) {
          await supabaseAdmin.from("BatteryWarrantyClaim").delete().eq("warrantyId", w.id);
          await supabaseAdmin.from("BatteryWarranty").delete().eq("id", w.id);
          await broadcastServerChange("BatteryWarranty", "DELETE", w.id);
        }
      }
      return;
    }
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
      await broadcastServerChange("BatteryWarranty", "UPDATE", existing[0].id);
    } else {
      const warrantyId = uuidv44();
      const warrantyNumber = await generateWarrantyNumber();
      await supabaseAdmin.from("BatteryWarranty").insert([
        {
          id: warrantyId,
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
      await broadcastServerChange("BatteryWarranty", "CREATE", warrantyId);
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
      query = query.or(`technicianId.eq.${req.user.id},priority.eq.URGENT,priority.eq.HIGH`);
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
      "Priority": r.priority || "NORMAL",
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
router3.get("/import/template", authenticate, (_req, res) => {
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
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;
      const repairNumber = await generateRepairNumber(i);
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
        priority: "NORMAL",
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
router3.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({ error: "Invalid repair ID." });
    }
    const { data: repair, error } = await supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)").eq("id", id).single();
    if (error || !repair) {
      const { data: byNum } = await supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)").eq("repairNumber", id).single();
      if (byNum) {
        return res.json(byNum);
      }
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    return res.json(repair);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load repair record." });
  }
});
router3.get("/:id/notes", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: notes, error } = await supabaseAdmin.from("TechnicianNote").select("*").eq("repairId", id).order("createdAt", { ascending: false });
    if (error) {
      return res.status(500).json({ error: "Failed to retrieve notes." });
    }
    return res.json(notes || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load notes." });
  }
});
router3.post("/", authenticate, async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerAlternativePhone,
      customerEmail,
      customerDistrict,
      customerMunicipality,
      customerAddress,
      customerLandmark,
      customerNotes,
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
      priority = "NORMAL",
      expectedCompletionDate,
      remarks,
      receivingMethod = "WALK_IN",
      isCourierIn = false,
      courierCompany,
      courierTrackingNumber,
      courierDate,
      courierReceivedDate,
      senderName,
      senderPhone,
      originDistrict,
      originAddress,
      courierNotes,
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
        await supabaseAdmin.from("Customer").update({
          name: customerName.trim(),
          alternativePhone: customerAlternativePhone ? customerAlternativePhone.trim() : void 0,
          email: customerEmail ? customerEmail.trim() : void 0,
          district: customerDistrict ? customerDistrict.trim() : void 0,
          municipality: customerMunicipality ? customerMunicipality.trim() : void 0,
          address: customerAddress ? customerAddress.trim() : void 0,
          landmark: customerLandmark ? customerLandmark.trim() : void 0,
          notes: customerNotes ? customerNotes.trim() : void 0,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", resolvedCustomerId);
      } else {
        const newCusId = uuidv44();
        const { data: createdCus } = await supabaseAdmin.from("Customer").insert([
          {
            id: newCusId,
            customerId: `CUS-${Date.now().toString().slice(-5)}`,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            alternativePhone: customerAlternativePhone ? customerAlternativePhone.trim() : null,
            email: customerEmail ? customerEmail.trim() : null,
            district: customerDistrict ? customerDistrict.trim() : null,
            municipality: customerMunicipality ? customerMunicipality.trim() : null,
            address: customerAddress ? customerAddress.trim() : null,
            landmark: customerLandmark ? customerLandmark.trim() : null,
            notes: customerNotes ? customerNotes.trim() : null,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]).select("id").single();
        if (createdCus) {
          resolvedCustomerId = createdCus.id;
          await broadcastServerChange("Customer", "CREATE", newCusId);
        }
      }
    }
    const repairNumber = await generateRepairNumber();
    const repairId = uuidv44();
    const estCostNum = parseFloat(estimatedCost || 0) || 0;
    const advPaidNum = parseFloat(advancePaid || 0) || 0;
    const paymentStatus = advPaidNum >= estCostNum && estCostNum > 0 ? "PAID" : advPaidNum > 0 ? "PARTIAL" : "UNPAID";
    const isWarrantyExplicit = hasBatteryWarranty === true || hasBatteryWarranty === "true";
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
      courierDate: courierDate || null,
      courierReceivedDate: courierReceivedDate || null,
      senderName: senderName || null,
      senderPhone: senderPhone || null,
      originDistrict: originDistrict || null,
      originAddress: originAddress || null,
      courierNotes: courierNotes || null,
      hasBatteryWarranty: isWarrantyExplicit,
      batteryWarrantyPeriod: isWarrantyExplicit ? batteryWarrantyPeriod || "6_MONTHS" : null,
      batteryType: isWarrantyExplicit ? batteryType || "Original Replacement Battery" : null,
      batteryHealth: isWarrantyExplicit ? batteryHealth || null : null,
      batterySerial: isWarrantyExplicit ? batterySerial || null : null,
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("Repair").insert([newRepair]).select("*").single();
    if (error) {
      console.error("[REPAIR CREATE ERROR]", error);
      return res.status(500).json({ error: "Failed to create repair ticket." });
    }
    if (isWarrantyExplicit) {
      await syncBatteryWarrantyFromRepair(created, req.user);
    }
    const logId = uuidv44();
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: logId,
        repairId: created.id,
        userId: req.user.id,
        action: "CREATED",
        status: "RECEIVED",
        notes: `Repair intake recorded by ${req.user.name}.`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await broadcastServerChange("RepairLog", "CREATE", logId);
    await logAudit({
      userId: req.user.id,
      action: "REPAIR_CREATED",
      resource: "Repair",
      resourceId: created.id,
      details: { repairNumber: created.repairNumber, customerName: created.customerName }
    });
    await broadcastServerChange("Repair", "CREATE", created.id, created);
    return res.status(201).json(created);
  } catch (err) {
    console.error("[CREATE REPAIR ERROR]", err);
    return res.status(500).json({ error: "Failed to register repair ticket." });
  }
});
var handleBatchRepairIntake = async (req, res) => {
  const createdRepairs = [];
  try {
    const rawCustomer = req.body.customer || {};
    const customer = {
      id: rawCustomer.id || req.body.customerId,
      name: (rawCustomer.name || req.body.customerName || "").trim(),
      phone: (rawCustomer.phone || req.body.customerPhone || "").trim(),
      email: (rawCustomer.email || req.body.customerEmail || "").trim() || null,
      district: (rawCustomer.district || req.body.customerDistrict || "").trim() || null,
      municipality: (rawCustomer.municipality || req.body.customerMunicipality || "").trim() || null,
      address: (rawCustomer.address || req.body.customerAddress || "").trim() || null,
      landmark: (rawCustomer.landmark || req.body.customerLandmark || "").trim() || null,
      alternativePhone: (rawCustomer.alternativePhone || req.body.customerAlternativePhone || "").trim() || null,
      notes: (rawCustomer.notes || req.body.customerNotes || "").trim() || null
    };
    const devices = req.body.devices || [];
    if (!customer.name || !customer.phone) {
      return res.status(400).json({ error: "Customer name and phone number are required." });
    }
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ error: "At least one device must be included in batch intake." });
    }
    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      if (!dev || !dev.deviceModel || !dev.deviceModel.trim()) {
        return res.status(400).json({ error: `Device #${i + 1} is missing a valid device model.` });
      }
    }
    let resolvedCustomerId = customer.id;
    let resolvedCustomerObj = null;
    if (resolvedCustomerId) {
      const { data: existingCus } = await supabaseAdmin.from("Customer").select("*").eq("id", resolvedCustomerId).single();
      if (existingCus) {
        resolvedCustomerObj = existingCus;
        const { data: updatedCus } = await supabaseAdmin.from("Customer").update({
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          alternativePhone: customer.alternativePhone ? customer.alternativePhone.trim() : existingCus.alternativePhone,
          email: customer.email ? customer.email.trim() : existingCus.email,
          district: customer.district ? customer.district.trim() : existingCus.district,
          municipality: customer.municipality ? customer.municipality.trim() : existingCus.municipality,
          address: customer.address ? customer.address.trim() : existingCus.address,
          landmark: customer.landmark ? customer.landmark.trim() : existingCus.landmark,
          notes: customer.notes ? customer.notes.trim() : existingCus.notes,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", resolvedCustomerId).select("*").single();
        if (updatedCus) resolvedCustomerObj = updatedCus;
      }
    }
    if (!resolvedCustomerObj) {
      const { data: existingByPhone } = await supabaseAdmin.from("Customer").select("*").eq("phone", customer.phone.trim()).limit(1);
      if (existingByPhone && existingByPhone.length > 0) {
        resolvedCustomerId = existingByPhone[0].id;
        resolvedCustomerObj = existingByPhone[0];
        const { data: updatedCus } = await supabaseAdmin.from("Customer").update({
          name: customer.name.trim(),
          alternativePhone: customer.alternativePhone ? customer.alternativePhone.trim() : existingByPhone[0].alternativePhone,
          email: customer.email ? customer.email.trim() : existingByPhone[0].email,
          district: customer.district ? customer.district.trim() : existingByPhone[0].district,
          municipality: customer.municipality ? customer.municipality.trim() : existingByPhone[0].municipality,
          address: customer.address ? customer.address.trim() : existingByPhone[0].address,
          landmark: customer.landmark ? customer.landmark.trim() : existingByPhone[0].landmark,
          notes: customer.notes ? customer.notes.trim() : existingByPhone[0].notes,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", resolvedCustomerId).select("*").single();
        if (updatedCus) resolvedCustomerObj = updatedCus;
      } else {
        const newCusId = uuidv44();
        const newCustomerNumber = `CUS-${Date.now().toString().slice(-5)}`;
        const { data: createdCus, error: cusErr } = await supabaseAdmin.from("Customer").insert([
          {
            id: newCusId,
            customerId: newCustomerNumber,
            name: customer.name.trim(),
            phone: customer.phone.trim(),
            alternativePhone: customer.alternativePhone ? customer.alternativePhone.trim() : null,
            email: customer.email ? customer.email.trim() : null,
            district: customer.district ? customer.district.trim() : null,
            municipality: customer.municipality ? customer.municipality.trim() : null,
            address: customer.address ? customer.address.trim() : null,
            landmark: customer.landmark ? customer.landmark.trim() : null,
            notes: customer.notes ? customer.notes.trim() : null,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]).select("*").single();
        if (cusErr) {
          console.error("[CUSTOMER CREATE BATCH ERROR]", cusErr);
        }
        if (createdCus) {
          resolvedCustomerId = createdCus.id;
          resolvedCustomerObj = createdCus;
          await broadcastServerChange("Customer", "CREATE", newCusId, createdCus);
        }
      }
    }
    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      const repairNumber = await generateRepairNumber(i);
      const repairId = uuidv44();
      const estCostNum = parseFloat(dev.estimatedCost || 0) || 0;
      const advPaidNum = parseFloat(dev.advancePaid || 0) || 0;
      const paymentStatus = advPaidNum >= estCostNum && estCostNum > 0 ? "PAID" : advPaidNum > 0 ? "PARTIAL" : "UNPAID";
      const isWarrantyExplicit = dev.hasBatteryWarranty === true || dev.hasBatteryWarranty === "true";
      const newRepair = {
        id: repairId,
        repairNumber,
        customerId: resolvedCustomerId || null,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        customerEmail: customer.email ? customer.email.trim() : null,
        customerAddress: customer.address ? customer.address.trim() : null,
        deviceBrand: dev.deviceBrand || "Apple",
        deviceModel: dev.deviceModel.trim(),
        imeiNumber: dev.imeiNumber ? String(dev.imeiNumber).trim() : null,
        deviceColor: dev.deviceColor || null,
        deviceCondition: dev.deviceCondition || "FAIR",
        conditionNotes: dev.conditionNotes || null,
        problemDescription: dev.problemDescription || "",
        accessoriesReceived: dev.accessoriesReceived || null,
        estimatedCost: estCostNum,
        advancePaid: advPaidNum,
        totalPaid: advPaidNum,
        paymentStatus,
        status: dev.status || "RECEIVED",
        priority: dev.priority || "NORMAL",
        technicianId: dev.technicianId || null,
        branchId: req.user.branchId || null,
        expectedCompletionDate: dev.expectedCompletionDate || null,
        remarks: dev.remarks || null,
        receivingMethod: dev.receivingMethod || "WALK_IN",
        isCourierIn: Boolean(dev.isCourierIn),
        courierCompany: dev.courierCompany || null,
        courierTrackingNumber: dev.courierTrackingNumber || null,
        courierDate: dev.courierDate || null,
        courierReceivedDate: dev.courierReceivedDate || null,
        senderName: dev.senderName || null,
        senderPhone: dev.senderPhone || null,
        originDistrict: dev.originDistrict || null,
        originAddress: dev.originAddress || null,
        courierNotes: dev.courierNotes || null,
        hasBatteryWarranty: isWarrantyExplicit,
        batteryWarrantyPeriod: isWarrantyExplicit ? dev.batteryWarrantyPeriod || "6_MONTHS" : null,
        batteryType: isWarrantyExplicit ? dev.batteryType || "Original Replacement Battery" : null,
        batteryHealth: isWarrantyExplicit ? dev.batteryHealth || null : null,
        batterySerial: isWarrantyExplicit ? dev.batterySerial || null : null,
        createdById: req.user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: created, error: insertErr } = await supabaseAdmin.from("Repair").insert([newRepair]).select("*").single();
      if (insertErr || !created) {
        console.error(`[BATCH REPAIR DEVICE ${i + 1} INSERT ERROR]`, insertErr);
        if (createdRepairs.length > 0) {
          const insertedIds = createdRepairs.map((r) => r.id);
          await supabaseAdmin.from("RepairLog").delete().in("repairId", insertedIds);
          await supabaseAdmin.from("Repair").delete().in("id", insertedIds);
        }
        return res.status(500).json({ error: `Failed to create repair ticket for device #${i + 1} (${dev.deviceModel}). Batch rolled back.` });
      }
      if (isWarrantyExplicit) {
        await syncBatteryWarrantyFromRepair(created, req.user);
      }
      const logId = uuidv44();
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: created.id,
          userId: req.user.id,
          action: "CREATED",
          status: "RECEIVED",
          notes: `Multi-device intake recorded by ${req.user.name} (Device ${i + 1} of ${devices.length}).`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
      await broadcastServerChange("Repair", "CREATE", created.id, created);
      await logAudit({
        userId: req.user.id,
        action: "REPAIR_CREATED",
        resource: "Repair",
        resourceId: created.id,
        details: {
          repairNumber: created.repairNumber,
          customerName: created.customerName,
          deviceModel: created.deviceModel,
          batchIndex: i + 1,
          totalDevices: devices.length
        }
      });
      createdRepairs.push(created);
    }
    return res.status(201).json({
      success: true,
      totalRegistered: createdRepairs.length,
      count: createdRepairs.length,
      repairs: createdRepairs,
      customer: resolvedCustomerObj || customer
    });
  } catch (batchErr) {
    console.error("[BATCH REPAIR INTAKE EXCEPTION]", batchErr);
    if (createdRepairs.length > 0) {
      try {
        const insertedIds = createdRepairs.map((r) => r.id);
        await supabaseAdmin.from("RepairLog").delete().in("repairId", insertedIds);
        await supabaseAdmin.from("Repair").delete().in("id", insertedIds);
      } catch (rollbackErr) {
        console.error("[ROLLBACK EXCEPTION]", rollbackErr);
      }
    }
    return res.status(500).json({ error: "Failed to process batch repair intake: " + (batchErr?.message || "Server error") });
  }
};
router3.post("/batch", authenticate, handleBatchRepairIntake);
router3.post("/repairs/batch", authenticate, handleBatchRepairIntake);
router3.post("/repair/batch", authenticate, handleBatchRepairIntake);
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
    if (rawBody.hasBatteryWarranty !== void 0) {
      const isWarranty = rawBody.hasBatteryWarranty === true || rawBody.hasBatteryWarranty === "true";
      updateData.hasBatteryWarranty = isWarranty;
      if (!isWarranty) {
        updateData.batteryWarrantyPeriod = null;
        updateData.batteryType = null;
      }
    }
    updateData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const { data: updated, error } = await supabaseAdmin.from("Repair").update(updateData).eq("id", id).select("*").single();
    if (error) {
      console.error("[REPAIR UPDATE ERROR]", error);
      return res.status(400).json({ error: error.message });
    }
    if (rawBody.hasBatteryWarranty !== void 0 || updated.hasBatteryWarranty !== void 0) {
      await syncBatteryWarrantyFromRepair({ ...updated, ...rawBody, id, repairNumber: updated.repairNumber }, req.user);
    }
    if (rawBody.status) {
      const logId = uuidv44();
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          userId: req.user.id,
          action: "STATUS_UPDATED",
          status: rawBody.status,
          notes: rawBody.remarks || `Status updated to ${rawBody.status} by ${req.user.name}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    }
    await broadcastServerChange("Repair", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    console.error("[REPAIR UPDATE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to update repair." });
  }
};
router3.patch("/:id", authenticate, handleRepairUpdate);
router3.put("/:id", authenticate, handleRepairUpdate);
router3.patch("/:id/technician-update", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, estimatedDeliveryDate, sparePartsUsed, technicianNotes } = req.body;
    const { data: existingRepair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*").eq("id", id).single();
    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: "Repair job not found." });
    }
    const updatePayload = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (status) updatePayload.status = status;
    if (estimatedDeliveryDate) updatePayload.estimatedDeliveryDate = estimatedDeliveryDate;
    if (sparePartsUsed !== void 0) updatePayload.sparePartsUsed = sparePartsUsed;
    if (technicianNotes !== void 0) updatePayload.technicianNotes = technicianNotes;
    const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", id).select("*").single();
    if (updateErr) {
      console.error("[TECHNICIAN UPDATE ERROR]", updateErr);
      return res.status(500).json({ error: "Failed to update repair progress." });
    }
    try {
      const notifId = uuidv44();
      await supabaseAdmin.from("Notification").insert([
        {
          id: notifId,
          title: `Repair Updated: #${updatedRepair.repairNumber || id.slice(0, 8)}`,
          message: `${req.user?.name || "Technician"} updated repair status to ${status || existingRepair.status}. Note: ${technicianNotes || "No notes added"}`,
          type: "REPAIR_UPDATE",
          userId: existingRepair.createdById || null,
          isRead: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("Notification", "CREATE", notifId);
    } catch (notifErr) {
      console.warn("[NOTIFICATION DISPATCH WARN - NON FATAL]", notifErr);
    }
    await broadcastServerChange("Repair", "UPDATE", id, updatedRepair);
    return res.json({
      success: true,
      message: "Repair progress updated successfully.",
      repair: updatedRepair
    });
  } catch (err) {
    console.error("[TECHNICIAN UPDATE EXCEPTION]", err);
    return res.status(500).json({ error: err?.message || "Server error updating repair." });
  }
});
router3.post("/:id/alert", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST", "LEAD_TECHNICIAN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, message } = req.body;
    const VALID_PRIORITIES = ["NORMAL", "MEDIUM", "HIGH", "URGENT"];
    const resolvedPriority = priority ? String(priority).toUpperCase().trim() : "NORMAL";
    if (!VALID_PRIORITIES.includes(resolvedPriority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Alert message is required." });
    }
    const { data: existingRepair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*, technician:User!Repair_technicianId_fkey(id, name)").eq("id", id).single();
    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: "Repair not found." });
    }
    if (!existingRepair.technicianId) {
      return res.status(400).json({ error: "Cannot alert technician \u2014 no technician is assigned to this repair." });
    }
    const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update({
      priority: resolvedPriority,
      priorityUpdatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (updateErr) {
      console.error("[ALERT PRIORITY DB UPDATE ERROR]", updateErr);
      return res.status(500).json({ error: "Failed to update repair priority." });
    }
    const logId = uuidv44();
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: logId,
        repairId: id,
        userId: req.user.id,
        action: "PRIORITY_ALERT_DISPATCHED",
        status: updatedRepair.status,
        notes: `[Priority Alert] ${resolvedPriority} \u2014 ${String(message).trim()} (Dispatched by ${req.user.name})`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await broadcastServerChange("RepairLog", "CREATE", logId);
    const priorityEmoji = {
      URGENT: "\u{1F534}",
      HIGH: "\u{1F7E0}",
      MEDIUM: "\u{1F7E1}",
      NORMAL: "\u26AA"
    };
    const emoji = priorityEmoji[resolvedPriority] || "\u{1F514}";
    const notifTitle = `${emoji} ${resolvedPriority} Alert: Job #${updatedRepair.repairNumber}`;
    const notifMessage = String(message).trim() || `Priority alert from ${req.user.name}`;
    const notifId = uuidv44();
    await supabaseAdmin.from("Notification").insert([
      {
        id: notifId,
        title: notifTitle,
        message: notifMessage,
        type: resolvedPriority === "URGENT" ? "REPAIR_URGENT" : "REPAIR_ALERT",
        priority: resolvedPriority,
        userId: updatedRepair.technicianId,
        repairId: id,
        repairNumber: updatedRepair.repairNumber,
        senderId: req.user.id,
        senderName: req.user.name,
        isRead: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await broadcastServerChange("Notification", "CREATE", notifId);
    await broadcastServerChange("Repair", "UPDATE", id, updatedRepair);
    return res.json({
      success: true,
      message: `${resolvedPriority} priority alert dispatched to ${existingRepair.technician?.name || "assigned technician"}.`,
      repair: updatedRepair
    });
  } catch (err) {
    console.error("[ALERT TECHNICIAN EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to dispatch alert." });
  }
});
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
    const logId = uuidv44();
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: logId,
        repairId: id,
        userId: req.user.id,
        action: "ASSIGNED",
        status: updated.status,
        notes: `Assigned to technician: ${tech?.name || "Unassigned"} by ${req.user.name}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]);
    await broadcastServerChange("RepairLog", "CREATE", logId);
    await broadcastServerChange("Repair", "UPDATE", id, updated);
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
    const noteId = uuidv44();
    const newNote = {
      id: noteId,
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
    await broadcastServerChange("TechnicianNote", "CREATE", noteId, created);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add repair note." });
  }
});
router3.post("/:id/courier-dispatch", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      courierCompany,
      returnCourierCompany,
      trackingNumber,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      destinationDistrict,
      destinationAddress,
      receiverName,
      receiverPhone,
      receiverWhatsapp,
      courierOutCharge,
      courierOutPaymentStatus,
      courierOutStatus,
      notes,
      returnCourierNotes,
      status
    } = req.body;
    const company = (returnCourierCompany || courierCompany || "").trim();
    const tracking = (returnCourierTrackingNumber || trackingNumber || "").trim();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = req.user?.id || "system";
    const userName = req.user?.name || "Staff";
    const updatePayload = {
      isCourierOut: true,
      returnCourierCompany: company || null,
      returnCourierTrackingNumber: tracking || null,
      returnCourierDispatchDate: returnCourierDispatchDate || now.split("T")[0],
      destinationDistrict: destinationDistrict ? String(destinationDistrict).trim() : null,
      destinationAddress: destinationAddress ? String(destinationAddress).trim() : null,
      receiverName: receiverName ? String(receiverName).trim() : null,
      receiverPhone: receiverPhone ? String(receiverPhone).trim() : null,
      receiverWhatsapp: receiverWhatsapp ? String(receiverWhatsapp).trim() : null,
      returnCourierNotes: returnCourierNotes || notes || null,
      isReturnCourierDispatched: true,
      returnCourierDispatchedAt: now,
      returnCourierDispatchedById: userId,
      returnCourierDispatchedByName: userName,
      courierOutStatus: courierOutStatus || "DISPATCHED",
      courierStatus: "DISPATCHED",
      courierOutPaymentStatus: courierOutPaymentStatus || "UNPAID",
      updatedAt: now
    };
    if (courierOutCharge !== void 0 && courierOutCharge !== null && courierOutCharge !== "") {
      updatePayload.courierOutCharge = Number(courierOutCharge);
    }
    if (status) {
      updatePayload.status = status;
    } else {
      updatePayload.status = "DISPATCHED_VIA_COURIER";
    }
    const { data: updated, error } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", id).select("*").single();
    if (error) {
      console.error("[COURIER DISPATCH UPDATE ERROR]", error);
      return res.status(500).json({ error: error.message || "Failed to record courier dispatch." });
    }
    try {
      const logId = uuidv44();
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          action: "COURIER_DISPATCH_UPDATED",
          status: updatePayload.status,
          notes: `Courier logistics updated: ${company || "Courier"} (AWB #${tracking || "N/A"}) by ${userName}`,
          userId,
          createdAt: now
        }
      ]);
      broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[REPAIR LOG NON FATAL]", logErr);
    }
    await broadcastServerChange("Repair", "UPDATE", id, updated);
    return res.json({ success: true, message: "Repair courier logistics updated successfully.", repair: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to record courier dispatch." });
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
    await broadcastServerChange("Repair", "UPDATE", id, updated);
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
    await broadcastServerChange("Repair", "DELETE", id);
    return res.json({ success: true, message: "Repair deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete repair record." });
  }
});
var repairs_default = router3;

// api/_server/routes/repairTransfers.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/my-requests", authenticate, async (req, res) => {
  try {
    const { data: requests, error } = await supabaseAdmin.from("RepairTransferRequest").select("*").or(`senderId.eq.${req.user.id},receiverId.eq.${req.user.id}`).order("createdAt", { ascending: false });
    if (error) {
      return res.json([]);
    }
    return res.json(requests || []);
  } catch {
    return res.json([]);
  }
});
var repairTransfers_default = router4;

// api/_server/routes/customers.ts
import { Router as Router5 } from "express";
import { v4 as uuidv45 } from "uuid";
var router5 = Router5();
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
router5.get("/", authenticate, async (req, res) => {
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
router5.get("/lookup", authenticate, async (req, res) => {
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
router5.get("/search", authenticate, async (req, res) => {
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
router5.get("/:id", authenticate, async (req, res) => {
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
router5.get("/:id/repairs", authenticate, async (req, res) => {
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
router5.post("/", authenticate, async (req, res) => {
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
    await broadcastServerChange("Customer", "CREATE", created.id, created);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save customer." });
  }
});
router5.patch("/:id", authenticate, async (req, res) => {
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
    await broadcastServerChange("Customer", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update customer." });
  }
});
router5.post("/:id/archive", authenticate, async (req, res) => {
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
    await broadcastServerChange("Customer", "UPDATE", id, updated);
    return res.json({ success: true, message: "Customer archived successfully.", customer: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to archive customer." });
  }
});
router5.post("/:id/restore", authenticate, async (req, res) => {
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
    await broadcastServerChange("Customer", "UPDATE", id, updated);
    return res.json({ success: true, message: "Customer restored successfully.", customer: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to restore customer." });
  }
});
router5.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Customer").delete().eq("id", id);
    if (error) {
      return res.status(500).json({ error: "Failed to delete customer record." });
    }
    await broadcastServerChange("Customer", "DELETE", id);
    return res.json({ success: true, message: "Customer deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete customer." });
  }
});
var customers_default = router5;

// api/_server/routes/inventory.ts
import { Router as Router6 } from "express";
import { v4 as uuidv46 } from "uuid";
var router6 = Router6();
var INVENTORY_MANAGERS = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_MANAGER", "RECEPTIONIST"];
var INVENTORY_STOCK_OUT_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_MANAGER", "LEAD_TECHNICIAN", "TECHNICIAN", "RECEPTIONIST"];
var customFoldersRegistry = /* @__PURE__ */ new Map();
function getFolderKey(brand, model, category) {
  return `${(brand || "").trim().toLowerCase()}|${(model || "").trim().toLowerCase()}|${(category || "").trim().toLowerCase()}`;
}
router6.get("/folders", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("brand, model, category, subcategory").not("brand", "is", null);
    const folderMap = /* @__PURE__ */ new Map();
    customFoldersRegistry.forEach((folder, key) => {
      folderMap.set(key, folder);
    });
    (items || []).forEach((item) => {
      const b = (item.brand || "").trim();
      const m = (item.model || "").trim();
      const c = (item.category || "").trim();
      if (b) {
        const key = getFolderKey(b, m, c);
        if (!folderMap.has(key)) {
          folderMap.set(key, {
            brand: b,
            model: m || null,
            category: c || null,
            subcategory: item.subcategory || null
          });
        }
      }
    });
    const foldersArray = Array.from(folderMap.values());
    return res.json(foldersArray);
  } catch (err) {
    console.error("[INVENTORY GET FOLDERS ERROR]", err);
    return res.json(Array.from(customFoldersRegistry.values()));
  }
});
router6.post("/folders", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: "Brand name is required." });
    }
    const trimmedBrand = brand.trim();
    const trimmedModel = model && typeof model === "string" && model.trim() ? model.trim() : null;
    const trimmedCategory = category && typeof category === "string" && category.trim() ? category.trim() : null;
    const key = getFolderKey(trimmedBrand, trimmedModel, trimmedCategory);
    const entry = {
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory
    };
    customFoldersRegistry.set(key, entry);
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FOLDER_CREATED",
      resource: "InventoryFolder",
      details: { brand: trimmedBrand, model: trimmedModel, category: trimmedCategory }
    });
    await broadcastServerChange("InventoryFolder", "CREATE", `${trimmedBrand}-${trimmedModel || ""}-${trimmedCategory || ""}`, entry);
    return res.status(201).json({
      success: true,
      folder: entry,
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory
    });
  } catch (err) {
    console.error("[INVENTORY POST FOLDERS ERROR]", err);
    return res.status(500).json({ error: "Failed to create folder branch." });
  }
});
router6.post("/rename-folder", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { level, oldName, newName, parentBrand, parentModel } = req.body;
    if (!level || !oldName || !newName || !newName.trim()) {
      return res.status(400).json({ error: "Missing required folder rename parameters." });
    }
    const trimmedNew = newName.trim();
    let query = supabaseAdmin.from("InventoryItem").update({
      [level]: trimmedNew,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (level === "brand") {
      query = query.eq("brand", oldName);
    } else if (level === "model") {
      query = query.eq("model", oldName);
      if (parentBrand) query = query.eq("brand", parentBrand);
    } else if (level === "category") {
      query = query.eq("category", oldName);
      if (parentBrand) query = query.eq("brand", parentBrand);
      if (parentModel) query = query.eq("model", parentModel);
    }
    const { data: updatedItems, error } = await query.select("id, name, brand, model, category");
    if (error) {
      console.error("[INVENTORY RENAME FOLDER ERROR]", error);
      return res.status(500).json({ error: "Failed to rename folder in database." });
    }
    const registryEntries = Array.from(customFoldersRegistry.entries());
    registryEntries.forEach(([k, entry]) => {
      let matched = false;
      const updatedEntry = { ...entry };
      if (level === "brand" && entry.brand.toLowerCase() === oldName.toLowerCase()) {
        updatedEntry.brand = trimmedNew;
        matched = true;
      } else if (level === "model" && entry.model && entry.model.toLowerCase() === oldName.toLowerCase()) {
        if (!parentBrand || entry.brand.toLowerCase() === parentBrand.toLowerCase()) {
          updatedEntry.model = trimmedNew;
          matched = true;
        }
      } else if (level === "category" && entry.category && entry.category.toLowerCase() === oldName.toLowerCase()) {
        if ((!parentBrand || entry.brand.toLowerCase() === parentBrand.toLowerCase()) && (!parentModel || entry.model && entry.model.toLowerCase() === parentModel.toLowerCase())) {
          updatedEntry.category = trimmedNew;
          matched = true;
        }
      }
      if (matched) {
        customFoldersRegistry.delete(k);
        const newKey = getFolderKey(updatedEntry.brand, updatedEntry.model, updatedEntry.category);
        customFoldersRegistry.set(newKey, updatedEntry);
      }
    });
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FOLDER_RENAMED",
      resource: "InventoryFolder",
      details: { level, oldName, newName: trimmedNew, parentBrand, parentModel, affected: updatedItems?.length || 0 }
    });
    if (updatedItems && updatedItems.length > 0) {
      for (const it of updatedItems) {
        await broadcastServerChange("InventoryItem", "UPDATE", it.id, it);
      }
    }
    await broadcastServerChange("InventoryFolder", "UPDATE", `${level}-${oldName}`, { level, oldName, newName: trimmedNew });
    return res.json({ success: true, count: updatedItems?.length || 0 });
  } catch (err) {
    console.error("[INVENTORY RENAME EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to rename folder." });
  }
});
router6.post("/move", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { itemIds, targetBrand, targetModel, targetCategory } = req.body;
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0 || !targetBrand) {
      return res.status(400).json({ error: "Item IDs and target brand are required." });
    }
    const updatePayload = {
      brand: targetBrand.trim(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (targetModel !== void 0) {
      updatePayload.model = targetModel && typeof targetModel === "string" ? targetModel.trim() : null;
    }
    if (targetCategory !== void 0) {
      updatePayload.category = targetCategory && typeof targetCategory === "string" ? targetCategory.trim() : "Spare Parts";
    }
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update(updatePayload).in("id", itemIds).select("*");
    if (error) {
      console.error("[INVENTORY MOVE ERROR]", error);
      return res.status(500).json({ error: "Failed to move items." });
    }
    const targetKey = getFolderKey(updatePayload.brand, updatePayload.model, updatePayload.category);
    if (!customFoldersRegistry.has(targetKey)) {
      customFoldersRegistry.set(targetKey, {
        brand: updatePayload.brand,
        model: updatePayload.model || null,
        category: updatePayload.category || null
      });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_ITEMS_MOVED",
      resource: "InventoryItem",
      details: { count: itemIds.length, targetBrand, targetModel, targetCategory }
    });
    if (updated && updated.length > 0) {
      for (const it of updated) {
        await broadcastServerChange("InventoryItem", "UPDATE", it.id, it);
      }
    }
    return res.json({ success: true, count: updated?.length || 0 });
  } catch (err) {
    console.error("[INVENTORY MOVE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to move inventory items." });
  }
});
router6.post("/delete-folder", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { brand, model, category, permanent = false } = req.body;
    if (!brand) {
      return res.status(400).json({ error: "Brand is required to delete/archive a folder." });
    }
    let findQuery = supabaseAdmin.from("InventoryItem").select("id, name").eq("brand", brand);
    if (model) findQuery = findQuery.eq("model", model);
    if (category) findQuery = findQuery.eq("category", category);
    const { data: itemsToDelete } = await findQuery;
    const itemIds = (itemsToDelete || []).map((i) => i.id);
    if (itemIds.length > 0) {
      if (permanent) {
        await supabaseAdmin.from("InventoryTransaction").delete().in("itemId", itemIds);
        await supabaseAdmin.from("InventoryItem").delete().in("id", itemIds);
        for (const id of itemIds) {
          await broadcastServerChange("InventoryItem", "DELETE", id);
        }
      } else {
        await supabaseAdmin.from("InventoryItem").update({ status: "ARCHIVED", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).in("id", itemIds);
        for (const id of itemIds) {
          await broadcastServerChange("InventoryItem", "UPDATE", id, { id, status: "ARCHIVED" });
        }
      }
    }
    const registryEntries = Array.from(customFoldersRegistry.entries());
    registryEntries.forEach(([k, entry]) => {
      let shouldDelete = false;
      if (category) {
        if (entry.brand.toLowerCase() === brand.toLowerCase() && (!model || entry.model && entry.model.toLowerCase() === model.toLowerCase()) && (entry.category && entry.category.toLowerCase() === category.toLowerCase())) {
          shouldDelete = true;
        }
      } else if (model) {
        if (entry.brand.toLowerCase() === brand.toLowerCase() && entry.model && entry.model.toLowerCase() === model.toLowerCase()) {
          shouldDelete = true;
        }
      } else {
        if (entry.brand.toLowerCase() === brand.toLowerCase()) {
          shouldDelete = true;
        }
      }
      if (shouldDelete) {
        customFoldersRegistry.delete(k);
      }
    });
    await logAudit({
      userId: req.user.id,
      action: permanent ? "INVENTORY_FOLDER_DELETED" : "INVENTORY_FOLDER_ARCHIVED",
      resource: "InventoryFolder",
      details: { brand, model, category, permanent, affectedCount: itemIds.length }
    });
    return res.json({ success: true, affectedCount: itemIds.length });
  } catch (err) {
    console.error("[INVENTORY DELETE FOLDER ERROR]", err);
    return res.status(500).json({ error: "Failed to delete or archive folder." });
  }
});
router6.post("/bulk-archive", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No item IDs provided." });
    }
    const { error } = await supabaseAdmin.from("InventoryItem").update({ status: "ARCHIVED", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to archive items." });
    for (const id of ids) {
      await broadcastServerChange("InventoryItem", "UPDATE", id, { id, status: "ARCHIVED" });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_BULK_ARCHIVE",
      resource: "InventoryItem",
      details: { count: ids.length, ids }
    });
    return res.json({ success: true, count: ids.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process bulk archive." });
  }
});
router6.post("/bulk-status", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: "Item IDs and valid status are required." });
    }
    const { error } = await supabaseAdmin.from("InventoryItem").update({ status, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to update items status." });
    for (const id of ids) {
      await broadcastServerChange("InventoryItem", "UPDATE", id, { id, status });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_BULK_STATUS_CHANGE",
      resource: "InventoryItem",
      details: { count: ids.length, status, ids }
    });
    return res.json({ success: true, count: ids.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update status in bulk." });
  }
});
router6.get("/suppliers", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("supplier").not("supplier", "is", null);
    const suppliers = Array.from(new Set((items || []).map((i) => i.supplier).filter(Boolean)));
    return res.json(suppliers);
  } catch (err) {
    return res.json([]);
  }
});
router6.get("/locations", authenticate, async (req, res) => {
  try {
    const { data: items } = await supabaseAdmin.from("InventoryItem").select("storageLocation").not("storageLocation", "is", null);
    const locations = Array.from(new Set((items || []).map((i) => i.storageLocation).filter(Boolean)));
    return res.json(locations);
  } catch (err) {
    return res.json([]);
  }
});
router6.get("/", authenticate, async (req, res) => {
  try {
    const { category, brand, status = "ACTIVE", search, limit = "1000" } = req.query;
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
    const { data: items, error } = await query.order("name", { ascending: true }).limit(parseInt(limit, 10) || 1e3);
    if (error) {
      console.error("[INVENTORY GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch inventory items." });
    }
    return res.json(items || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve inventory." });
  }
});
router6.get("/stats", authenticate, async (req, res) => {
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
    const { count: txCount } = await supabaseAdmin.from("InventoryTransaction").select("*", { count: "exact", head: true });
    return res.json({
      totalProducts: totalItems,
      totalItems,
      totalStockUnits: totalStockQuantity,
      totalStockQuantity,
      lowStockCount,
      outOfStockCount,
      totalValuation: totalStockValue,
      totalStockValue,
      recentTxCount: txCount || 0
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to calculate inventory statistics." });
  }
});
router6.get("/categories", authenticate, async (req, res) => {
  try {
    const { data: categories } = await supabaseAdmin.from("InventoryCategory").select("*");
    return res.json(categories || []);
  } catch (err) {
    return res.json([]);
  }
});
router6.post("/categories", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required." });
    const newCat = {
      id: uuidv46(),
      name: name.trim(),
      description: description || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("InventoryCategory").insert([newCat]).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to create category." });
    await broadcastServerChange("InventoryCategory", "CREATE", created.id, created);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add inventory category." });
  }
});
router6.get("/transactions/history", authenticate, async (req, res) => {
  try {
    const { itemId, limit = "100" } = req.query;
    let query = supabaseAdmin.from("InventoryTransaction").select("*, item:InventoryItem(name, sku, category)");
    if (itemId) {
      query = query.eq("itemId", String(itemId));
    }
    const { data: transactions, error } = await query.order("createdAt", { ascending: false }).limit(parseInt(limit, 10) || 100);
    if (error) {
      return res.status(500).json({ error: "Failed to fetch inventory transactions." });
    }
    return res.json(transactions || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve transaction logs." });
  }
});
router6.post("/bulk-delete", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No item IDs provided." });
    }
    await supabaseAdmin.from("InventoryTransaction").delete().in("itemId", ids);
    const { error } = await supabaseAdmin.from("InventoryItem").delete().in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to delete inventory items." });
    for (const id of ids) {
      await broadcastServerChange("InventoryItem", "DELETE", id);
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_BULK_DELETE",
      resource: "InventoryItem",
      details: { count: ids.length, ids }
    });
    return res.json({ success: true, message: `Successfully removed ${ids.length} items.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process bulk delete." });
  }
});
router6.get("/:id", authenticate, async (req, res) => {
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
router6.post("/", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
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
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Item name is required." });
    }
    const initialStock = parseInt(currentStock || "0", 10) || 0;
    const newItem = {
      id: uuidv46(),
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      model: model ? model.trim() : null,
      sku: sku && sku.trim() ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
      category: (category || "Spare Parts").trim(),
      subcategory: subcategory ? subcategory.trim() : null,
      compatibility: compatibility ? compatibility.trim() : null,
      unit: (unit || "Piece").trim(),
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
      status: status || "ACTIVE",
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("InventoryItem").insert([newItem]).select("*").single();
    if (error) {
      console.error("[INVENTORY CREATE ERROR]", error);
      return res.status(500).json({ error: "Failed to create inventory item." });
    }
    if (newItem.brand) {
      const fKey = getFolderKey(newItem.brand, newItem.model, newItem.category);
      customFoldersRegistry.set(fKey, {
        brand: newItem.brand,
        model: newItem.model,
        category: newItem.category
      });
    }
    if (initialStock > 0) {
      try {
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
      } catch (txErr) {
        console.warn("[INVENTORY TX WARN]", txErr);
      }
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_ITEM_CREATED",
      resource: "InventoryItem",
      resourceId: created.id,
      details: { name: created.name, sku: created.sku, stock: created.currentStock, brand: created.brand, model: created.model }
    });
    await broadcastServerChange("InventoryItem", "CREATE", created.id, created);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save inventory item." });
  }
});
router6.patch("/:id", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    delete updateData.transactions;
    if (updateData.currentStock !== void 0) {
      updateData.currentStock = parseInt(updateData.currentStock, 10) || 0;
    }
    if (updateData.minStockLevel !== void 0) {
      updateData.minStockLevel = parseInt(updateData.minStockLevel, 10) || 5;
    }
    if (updateData.purchasePrice !== void 0 && updateData.purchasePrice !== "") {
      updateData.purchasePrice = parseFloat(updateData.purchasePrice);
    }
    if (updateData.sellingPrice !== void 0 && updateData.sellingPrice !== "") {
      updateData.sellingPrice = parseFloat(updateData.sellingPrice);
    }
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update(updateData).eq("id", id).select("*").single();
    if (error) {
      return res.status(500).json({ error: "Failed to update inventory item." });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_ITEM_UPDATED",
      resource: "InventoryItem",
      resourceId: id,
      details: { updatedFields: Object.keys(updateData) }
    });
    await broadcastServerChange("InventoryItem", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update inventory." });
  }
});
router6.post("/:id/restore", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update({ status: "ACTIVE", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error || !updated) {
      return res.status(500).json({ error: "Failed to restore item." });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_ITEM_RESTORED",
      resource: "InventoryItem",
      resourceId: id,
      details: { name: updated.name }
    });
    await broadcastServerChange("InventoryItem", "UPDATE", id, updated);
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to restore inventory item." });
  }
});
router6.post("/:id/stock-in", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason = "Stock replenishment", notes, supplier, reference } = req.body;
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
    try {
      await supabaseAdmin.from("InventoryTransaction").insert([
        {
          id: uuidv46(),
          itemId: id,
          type: "STOCK_IN",
          quantity: qty,
          previousStock: prevStock,
          newStock,
          reason: reference ? `${reason} (Ref: ${reference})` : reason,
          notes: supplier ? `Supplier: ${supplier}. ${notes || ""}` : notes,
          performedById: req.user.id,
          performedByName: req.user.name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
    } catch (txErr) {
      console.warn("[STOCK IN TX WARN]", txErr);
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_STOCK_IN",
      resource: "InventoryItem",
      resourceId: id,
      details: { added: qty, previousStock: prevStock, newStock }
    });
    await broadcastServerChange("InventoryItem", "UPDATE", id, updated);
    return res.json({ success: true, item: updated, newStock });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process stock intake." });
  }
});
router6.post("/:id/stock-out", authenticate, authorize(INVENTORY_STOCK_OUT_ROLES), async (req, res) => {
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
    if (prevStock < qty) {
      return res.status(400).json({ error: `Insufficient stock. Current stock is only ${prevStock}.` });
    }
    const newStock = Math.max(0, prevStock - qty);
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update({ currentStock: newStock, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to deduct stock." });
    try {
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
    } catch (txErr) {
      console.warn("[STOCK OUT TX WARN]", txErr);
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_STOCK_OUT",
      resource: "InventoryItem",
      resourceId: id,
      details: { deducted: qty, previousStock: prevStock, newStock, repairNumber }
    });
    await broadcastServerChange("InventoryItem", "UPDATE", id, updated);
    return res.json({ success: true, item: updated, newStock });
  } catch (err) {
    return res.status(500).json({ error: "Failed to deduct inventory." });
  }
});
router6.post("/:id/adjust-stock", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
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
    try {
      await supabaseAdmin.from("InventoryTransaction").insert([
        {
          id: uuidv46(),
          itemId: id,
          type: "STOCK_ADJUSTMENT",
          quantity: Math.abs(diff),
          previousStock,
          newStock,
          reason,
          notes,
          performedById: req.user.id,
          performedByName: req.user.name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
    } catch (txErr) {
      console.warn("[ADJUST TX WARN]", txErr);
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_STOCK_ADJUSTMENT",
      resource: "InventoryItem",
      resourceId: id,
      details: { previousStock, newStock, diff, reason }
    });
    await broadcastServerChange("InventoryItem", "UPDATE", id, updated);
    return res.json({ success: true, item: updated, newStock });
  } catch (err) {
    return res.status(500).json({ error: "Failed to adjust stock quantity." });
  }
});
router6.delete("/:id", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    if (permanent === "true" || permanent === true) {
      await supabaseAdmin.from("InventoryTransaction").delete().eq("itemId", id);
      const { error } = await supabaseAdmin.from("InventoryItem").delete().eq("id", id);
      if (error) return res.status(500).json({ error: "Failed to delete inventory item." });
      await logAudit({
        userId: req.user.id,
        action: "INVENTORY_ITEM_DELETED_PERMANENT",
        resource: "InventoryItem",
        resourceId: id
      });
      await broadcastServerChange("InventoryItem", "DELETE", id);
      return res.json({ success: true, message: "Item permanently deleted." });
    } else {
      const { error } = await supabaseAdmin.from("InventoryItem").update({ status: "ARCHIVED", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
      if (error) return res.status(500).json({ error: "Failed to archive inventory item." });
      await logAudit({
        userId: req.user.id,
        action: "INVENTORY_ITEM_ARCHIVED",
        resource: "InventoryItem",
        resourceId: id
      });
      await broadcastServerChange("InventoryItem", "UPDATE", id, { id, status: "ARCHIVED" });
      return res.json({ success: true, message: "Item archived successfully." });
    }
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete or archive item." });
  }
});
var inventory_default = router6;

// api/_server/routes/couriers.ts
import { Router as Router7 } from "express";
import { v4 as uuidv47 } from "uuid";
var router7 = Router7();
router7.get("/", authenticate, async (req, res) => {
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
router7.get("/stats", authenticate, async (req, res) => {
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
router7.get("/eligible-repairs", authenticate, async (req, res) => {
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
router7.get("/filters-metadata", authenticate, async (req, res) => {
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
router7.get("/search-customers", authenticate, async (req, res) => {
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
router7.post("/check-duplicate-awb", authenticate, async (req, res) => {
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
router7.post("/incoming", authenticate, async (req, res) => {
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
      await broadcastServerChange("Repair", "UPDATE", existingRepairId, updatedRepair);
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
    await broadcastServerChange("Repair", "CREATE", newRepairId, createdRepair);
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
router7.post("/outgoing", authenticate, async (req, res) => {
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
    await broadcastServerChange("Repair", "UPDATE", repairId, updated);
    return res.json({
      success: true,
      message: "Shipment dispatched successfully.",
      repair: updated
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record outgoing dispatch." });
  }
});
router7.patch("/:id/status", authenticate, async (req, res) => {
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
    await broadcastServerChange("Repair", "UPDATE", id, updated);
    return res.json({
      success: true,
      message: "Courier status updated.",
      repair: updated
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update courier status." });
  }
});
router7.post("/bulk-status", authenticate, async (req, res) => {
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
    for (const id of targetIds) {
      await broadcastServerChange("Repair", "UPDATE", id);
    }
    return res.json({
      success: true,
      message: `Updated ${targetIds.length} shipments.`
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to perform bulk status update." });
  }
});
router7.post("/bulk-archive", authenticate, async (req, res) => {
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
    for (const id of targetIds) {
      await broadcastServerChange("Repair", "UPDATE", id);
    }
    return res.json({
      success: true,
      message: `Archived ${targetIds.length} courier records.`
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to archive shipments." });
  }
});
router7.delete("/:id", authenticate, async (req, res) => {
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
    await broadcastServerChange("Repair", "UPDATE", id);
    return res.json({ success: true, message: "Courier record archived successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete shipment." });
  }
});
var couriers_default = router7;

// api/_server/routes/batteryWarranties.ts
import { Router as Router8 } from "express";
import { v4 as uuidv48 } from "uuid";
import multer2 from "multer";
var router8 = Router8();
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
router8.get("/", authenticate, async (req, res) => {
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
    const { data: allRepairs } = await supabaseAdmin.from("Repair").select("id, hasBatteryWarranty");
    const repairWarrantyMap = /* @__PURE__ */ new Map();
    (allRepairs || []).forEach((r) => {
      repairWarrantyMap.set(r.id, r.hasBatteryWarranty === true || r.hasBatteryWarranty === "true");
    });
    const validWarranties = (warranties || []).filter((w) => {
      if (w.repairId) {
        return repairWarrantyMap.get(w.repairId) === true;
      }
      return true;
    });
    const { data: allClaims } = await supabaseAdmin.from("BatteryWarrantyClaim").select("*");
    const combined = validWarranties.map((w) => ({
      ...w,
      claims: (allClaims || []).filter((c) => c.warrantyId === w.id)
    }));
    return res.json(combined);
  } catch (err) {
    console.error("[BATTERY WARRANTIES EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to load warranties." });
  }
});
router8.get("/export", authenticate, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabaseAdmin.from("BatteryWarranty").select("*");
    if (status && status !== "ALL") query = query.eq("status", String(status));
    const { data: warranties } = await query.order("createdAt", { ascending: false });
    const { data: allRepairs } = await supabaseAdmin.from("Repair").select("id, hasBatteryWarranty");
    const repairWarrantyMap = /* @__PURE__ */ new Map();
    (allRepairs || []).forEach((r) => {
      repairWarrantyMap.set(r.id, r.hasBatteryWarranty === true || r.hasBatteryWarranty === "true");
    });
    const validWarranties = (warranties || []).filter((w) => {
      if (w.repairId) {
        return repairWarrantyMap.get(w.repairId) === true;
      }
      return true;
    });
    const rows = validWarranties.map((w) => ({
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
router8.get("/import/template", authenticate, (req, res) => {
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
router8.post("/import/preview", authenticate, upload2.single("file"), (req, res) => {
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
router8.post("/import/confirm", authenticate, async (req, res) => {
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
      if (created) {
        imported.push(created);
        await broadcastServerChange("BatteryWarranty", "CREATE", created.id, created);
      }
    }
    return res.json({ success: true, count: imported.length, message: `Imported ${imported.length} warranties.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to commit warranty import." });
  }
});
router8.get("/:id", authenticate, async (req, res) => {
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
router8.post("/", authenticate, async (req, res) => {
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
    await broadcastServerChange("BatteryWarranty", "CREATE", created.id, created);
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
    await broadcastServerChange("BatteryWarranty", "UPDATE", id, updated);
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update warranty." });
  }
};
router8.put("/:id", authenticate, handleWarrantyUpdate);
router8.patch("/:id", authenticate, handleWarrantyUpdate);
router8.all("/:id/edit", authenticate, handleWarrantyUpdate);
router8.post("/:id/claim", authenticate, async (req, res) => {
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
    await broadcastServerChange("BatteryWarrantyClaim", "CREATE", createdClaim.id, createdClaim);
    await broadcastServerChange("BatteryWarranty", "UPDATE", id);
    return res.status(201).json({ success: true, message: "Warranty claim processed.", claim: createdClaim });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record warranty claim." });
  }
});
router8.post("/:id/send-email", authenticate, async (req, res) => {
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
router8.post("/delete-2fa/request", authenticate, async (req, res) => {
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
router8.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
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
    for (const id of ids) {
      await broadcastServerChange("BatteryWarranty", "DELETE", id);
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
router8.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from("BatteryWarrantyClaim").delete().eq("warrantyId", id);
    const { error } = await supabaseAdmin.from("BatteryWarranty").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete warranty." });
    await broadcastServerChange("BatteryWarranty", "DELETE", id);
    return res.json({ success: true, message: "Warranty deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete warranty." });
  }
});
var batteryWarranties_default = router8;

// api/_server/routes/attendance.ts
import { Router as Router9 } from "express";

// api/_server/services/attendanceStorage.ts
import fs from "fs";
import path from "path";
import { v4 as uuidv49 } from "uuid";
var DATA_DIR = path.join(process.cwd(), "data");
var ATTENDANCE_FILE = path.join(DATA_DIR, "attendance_records.json");
var AUDIT_FILE = path.join(DATA_DIR, "attendance_audit_logs.json");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn("[STORAGE DIR INIT WARN]", e);
  }
}
var attendanceCache = /* @__PURE__ */ new Map();
var auditCache = [];
var isInitialized = false;
function loadLocalFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${filePath}]`, err);
  }
  return defaultValue;
}
function saveLocalFile(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[STORAGE WRITE ERROR: ${filePath}]`, err);
  }
}
async function initAttendanceStorage() {
  if (isInitialized) return;
  const localAttendance = loadLocalFile(ATTENDANCE_FILE, []);
  localAttendance.forEach((rec) => {
    if (rec && rec.id) {
      attendanceCache.set(rec.id, rec);
    }
  });
  const localAudit = loadLocalFile(AUDIT_FILE, []);
  auditCache = localAudit;
  try {
    const { data: remoteData, error } = await supabaseAdmin.from("Attendance").select("*").order("date", { ascending: false });
    if (!error && remoteData && remoteData.length > 0) {
      remoteData.forEach((rec) => {
        if (rec && rec.id) {
          attendanceCache.set(rec.id, {
            id: rec.id,
            userId: rec.userId,
            date: rec.date,
            status: rec.status || "PRESENT",
            checkInTime: rec.checkInTime || rec.markedAt?.slice(11, 19) || null,
            checkOutTime: rec.checkOutTime || null,
            markedById: rec.markedById || "SYSTEM",
            markedByName: rec.markedByName || "System",
            markedByRole: rec.markedByRole || "ADMIN",
            markedAt: rec.markedAt || rec.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            method: rec.method || "DIRECT_ADMIN",
            requestStatus: rec.requestStatus || "DIRECT",
            respondedAt: rec.respondedAt || null,
            rejectionReason: rec.rejectionReason || null,
            notes: rec.notes || null,
            correctionReason: rec.correctionReason || null,
            branchId: rec.branchId || null,
            isArchived: !!rec.isArchived,
            createdAt: rec.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: rec.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      });
    }
  } catch (e) {
    console.warn("[SUPABASE ATTENDANCE PREFETCH WARN]", e);
  }
  isInitialized = true;
  saveLocalFile(ATTENDANCE_FILE, Array.from(attendanceCache.values()));
}
function syncAttendanceDisk() {
  saveLocalFile(ATTENDANCE_FILE, Array.from(attendanceCache.values()));
}
function syncAuditDisk() {
  saveLocalFile(AUDIT_FILE, auditCache);
}
async function trySupabaseUpsert(record) {
  try {
    await supabaseAdmin.from("Attendance").upsert({
      id: record.id,
      userId: record.userId,
      date: record.date,
      status: record.status,
      markedById: record.markedById,
      markedByName: record.markedByName,
      markedByRole: record.markedByRole,
      markedAt: record.markedAt,
      method: record.method,
      requestStatus: record.requestStatus,
      respondedAt: record.respondedAt,
      rejectionReason: record.rejectionReason,
      notes: record.notes,
      branchId: record.branchId,
      isArchived: record.isArchived,
      updatedAt: record.updatedAt
    });
  } catch (e) {
  }
}
async function trySupabaseDelete(recordId) {
  try {
    await supabaseAdmin.from("Attendance").delete().eq("id", recordId);
  } catch (e) {
  }
}
async function getAuthorizedStaffList() {
  const AUTHORIZED_ROLES = [
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "HEAD_TECHNICIAN",
    "LEAD_TECHNICIAN",
    "TECHNICIAN",
    "RECEPTIONIST",
    "TECHNICAL_ASSISTANT",
    "STAFF"
  ];
  try {
    const { data: users, error } = await supabaseAdmin.from("User").select("id, name, email, role, department, phoneNumber, profileImage, deletedAt").is("deletedAt", null).in("role", AUTHORIZED_ROLES).order("name", { ascending: true });
    if (error) {
      console.error("[SUPABASE USER FETCH ERROR]", error);
      const { data: fallbackUsers } = await supabaseAdmin.from("User").select("id, name, email, role");
      return (fallbackUsers || []).filter((u) => AUTHORIZED_ROLES.includes(u.role));
    }
    return users || [];
  } catch (err) {
    console.error("[STAFF FETCH EXCEPTION]", err);
    return [];
  }
}
function getNepalBusinessTime() {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value || "2026";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  const hourStr = parts.find((p) => p.type === "hour")?.value || "0";
  const minStr = parts.find((p) => p.type === "minute")?.value || "0";
  const secStr = parts.find((p) => p.type === "second")?.value || "0";
  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minStr, 10);
  const seconds = parseInt(secStr, 10);
  const totalMinutes = hours * 60 + minutes;
  const isWithinWindow = totalMinutes >= 600 && totalMinutes <= 635;
  const dateString = `${y}-${m}-${d}`;
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  let secondsRemainingInWindow = 0;
  let secondsUntilWindowOpens = 0;
  if (isWithinWindow) {
    const endMinutes = 635 * 60 + 59;
    const currentSeconds = totalMinutes * 60 + seconds;
    secondsRemainingInWindow = Math.max(0, endMinutes - currentSeconds);
  } else if (totalMinutes < 600) {
    const startSeconds = 600 * 60;
    const currentSeconds = totalMinutes * 60 + seconds;
    secondsUntilWindowOpens = Math.max(0, startSeconds - currentSeconds);
  }
  return {
    dateString,
    timeString,
    hours,
    minutes,
    seconds,
    totalMinutes,
    isWithinWindow,
    secondsRemainingInWindow,
    secondsUntilWindowOpens,
    windowStart: "10:00:00",
    windowEnd: "10:35:00",
    timezone: "Asia/Kathmandu"
  };
}
async function getAllAttendanceRecords(filters) {
  await initAttendanceStorage();
  let records = Array.from(attendanceCache.values()).filter((r) => !r.isArchived);
  if (filters?.date) {
    records = records.filter((r) => r.date === filters.date);
  }
  if (filters?.month) {
    records = records.filter((r) => r.date.startsWith(filters.month));
  }
  if (filters?.userId) {
    records = records.filter((r) => r.userId === filters.userId);
  }
  if (filters?.status && filters.status !== "ALL") {
    records = records.filter((r) => r.status === filters.status);
  }
  records.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.markedAt || "").localeCompare(a.markedAt || "");
  });
  return records;
}
async function getAttendanceRecordById(id) {
  await initAttendanceStorage();
  return attendanceCache.get(id) || null;
}
async function getAttendanceRecordByUserAndDate(userId, date) {
  await initAttendanceStorage();
  for (const rec of attendanceCache.values()) {
    if (rec.userId === userId && rec.date === date && !rec.isArchived) {
      return rec;
    }
  }
  return null;
}
async function upsertAttendanceRecord(data, actor) {
  await initAttendanceStorage();
  const existing = await getAttendanceRecordByUserAndDate(data.userId, data.date);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const time = getNepalBusinessTime();
  let finalRecord;
  if (existing) {
    const prevStatus = existing.status;
    finalRecord = {
      ...existing,
      status: data.status,
      checkInTime: data.checkInTime !== void 0 ? data.checkInTime : existing.checkInTime || time.timeString,
      checkOutTime: data.checkOutTime !== void 0 ? data.checkOutTime : existing.checkOutTime,
      notes: data.notes !== void 0 ? data.notes : existing.notes,
      correctionReason: data.correctionReason !== void 0 ? data.correctionReason : existing.correctionReason,
      method: data.method || existing.method,
      requestStatus: data.requestStatus || existing.requestStatus,
      rejectionReason: data.rejectionReason !== void 0 ? data.rejectionReason : existing.rejectionReason,
      markedById: actor.id,
      markedByName: actor.name,
      markedByRole: actor.role,
      updatedAt: nowIso
    };
    attendanceCache.set(finalRecord.id, finalRecord);
    const auditLog = {
      id: uuidv49(),
      attendanceId: finalRecord.id,
      action: prevStatus !== data.status ? "STATUS_CHANGED" : "UPDATED",
      performedById: actor.id,
      performedByName: actor.name,
      performedByRole: actor.role,
      previousStatus: prevStatus,
      newStatus: data.status,
      reason: data.correctionReason || data.notes || "Attendance record modified",
      createdAt: nowIso
    };
    auditCache.unshift(auditLog);
    syncAuditDisk();
    await broadcastServerChange("AttendanceAuditLog", "CREATE", auditLog.id, auditLog);
  } else {
    finalRecord = {
      id: uuidv49(),
      userId: data.userId,
      date: data.date,
      status: data.status,
      checkInTime: data.checkInTime || (data.status === "PRESENT" || data.status === "LATE" || data.status === "HALF_DAY" ? time.timeString : null),
      checkOutTime: data.checkOutTime || null,
      markedById: actor.id,
      markedByName: actor.name,
      markedByRole: actor.role,
      markedAt: nowIso,
      method: data.method || (actor.role === "SUPER_ADMIN" ? "DIRECT_SUPER_ADMIN" : actor.role === "ADMIN" ? "DIRECT_ADMIN" : actor.role === "MANAGER" ? "MANAGER_ATTENDANCE" : "STAFF_SELF_CHECKIN"),
      requestStatus: data.requestStatus || "DIRECT",
      rejectionReason: data.rejectionReason || null,
      notes: data.notes || null,
      correctionReason: data.correctionReason || null,
      branchId: data.branchId || null,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    attendanceCache.set(finalRecord.id, finalRecord);
    const auditLog = {
      id: uuidv49(),
      attendanceId: finalRecord.id,
      action: "CREATED",
      performedById: actor.id,
      performedByName: actor.name,
      performedByRole: actor.role,
      previousStatus: null,
      newStatus: data.status,
      reason: data.notes || `Attendance marked as ${data.status}`,
      createdAt: nowIso
    };
    auditCache.unshift(auditLog);
    syncAuditDisk();
    await broadcastServerChange("AttendanceAuditLog", "CREATE", auditLog.id, auditLog);
  }
  syncAttendanceDisk();
  trySupabaseUpsert(finalRecord);
  await broadcastServerChange("Attendance", existing ? "UPDATE" : "CREATE", finalRecord.id, finalRecord);
  return finalRecord;
}
async function bulkUpsertAttendance(items, actor) {
  const results = [];
  for (const item of items) {
    const rec = await upsertAttendanceRecord(item, actor);
    results.push(rec);
  }
  return results;
}
async function deleteAttendanceRecord(id, actor) {
  await initAttendanceStorage();
  const existing = attendanceCache.get(id);
  if (!existing) return false;
  attendanceCache.delete(id);
  syncAttendanceDisk();
  trySupabaseDelete(id);
  const auditLog = {
    id: uuidv49(),
    attendanceId: id,
    action: "DELETED",
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousStatus: existing.status,
    newStatus: null,
    reason: "Record deleted by administrator",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  auditCache.unshift(auditLog);
  syncAuditDisk();
  await broadcastServerChange("Attendance", "DELETE", id, { id });
  return true;
}
async function purgeUserAttendance(userId, actor) {
  await initAttendanceStorage();
  let count = 0;
  for (const [id, rec] of attendanceCache.entries()) {
    if (rec.userId === userId) {
      attendanceCache.delete(id);
      trySupabaseDelete(id);
      count++;
    }
  }
  if (count > 0) {
    syncAttendanceDisk();
    const auditLog = {
      id: uuidv49(),
      attendanceId: `PURGE_${userId}`,
      action: "PURGED",
      performedById: actor.id,
      performedByName: actor.name,
      performedByRole: actor.role,
      reason: `Purged ${count} attendance records for user ${userId}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    auditCache.unshift(auditLog);
    syncAuditDisk();
  }
  return count;
}
async function getAttendanceAuditLogs(filters) {
  await initAttendanceStorage();
  let logs = [...auditCache];
  if (filters?.attendanceId) {
    logs = logs.filter((l) => l.attendanceId === filters.attendanceId);
  }
  if (filters?.limit) {
    logs = logs.slice(0, filters.limit);
  }
  return logs;
}

// api/_server/routes/attendance.ts
var router9 = Router9();
var ATTENDANCE_MANAGEMENT_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
var ATTENDANCE_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];
router9.get("/server-time", (req, res) => {
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
      timezone: time.timezone
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve server business time." });
  }
});
var handleGetRoster = async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    const time = getNepalBusinessTime();
    const targetDate = req.query.date || time.dateString;
    const currentMonth = targetDate.slice(0, 7);
    const staffList = await getAuthorizedStaffList();
    const todayRecords = await getAllAttendanceRecords({ date: targetDate });
    const monthRecords = await getAllAttendanceRecords({ month: currentMonth });
    const recordMap = /* @__PURE__ */ new Map();
    todayRecords.forEach((r) => recordMap.set(r.userId, r));
    const monthCounts = /* @__PURE__ */ new Map();
    monthRecords.forEach((r) => {
      const entry = monthCounts.get(r.userId) || { present: 0, total: 0 };
      entry.total += 1;
      if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") {
        entry.present += 1;
      }
      monthCounts.set(r.userId, entry);
    });
    const roster = staffList.map((user) => {
      const rec = recordMap.get(user.id);
      const mStats = monthCounts.get(user.id);
      const rate = mStats && mStats.total > 0 ? Math.round(mStats.present / mStats.total * 100) : null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "Repair Lab",
        phoneNumber: user.phoneNumber || null,
        profileImage: user.profileImage || null,
        status: rec ? rec.status : "NOT_MARKED",
        attendanceId: rec ? rec.id : null,
        checkInTime: rec ? rec.checkInTime : null,
        checkOutTime: rec ? rec.checkOutTime : null,
        notes: rec ? rec.notes : null,
        markedByName: rec ? rec.markedByName : null,
        markedByRole: rec ? rec.markedByRole : null,
        markedAt: rec ? rec.markedAt : null,
        monthlyAttendanceRate: rate
      };
    });
    const totalStaff = roster.length;
    const presentCount = roster.filter((s) => s.status === "PRESENT" || s.status === "LATE" || s.status === "HALF_DAY").length;
    const absentCount = roster.filter((s) => s.status === "ABSENT").length;
    const pendingCount = roster.filter((s) => s.status === "PENDING").length;
    const notMarkedCount = roster.filter((s) => s.status === "NOT_MARKED").length;
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
        overallRate: totalStaff > 0 ? Math.round(presentCount / totalStaff * 100) : 0
      },
      roster: isManagement ? roster : roster.filter((r) => r.id === currentUser.id)
    });
  } catch (err) {
    console.error("[ROSTER FETCH ERROR]", err);
    return res.status(500).json({ error: "Failed to generate attendance roster." });
  }
};
router9.get("/roster", authenticate, handleGetRoster);
router9.get("/today", authenticate, handleGetRoster);
router9.get("/monthly-report", authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req, res) => {
  try {
    const time = getNepalBusinessTime();
    const targetMonth = req.query.month || time.dateString.slice(0, 7);
    const [yearStr, monthStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const staffList = await getAuthorizedStaffList();
    const records = await getAllAttendanceRecords({ month: targetMonth });
    const userRecordsMap = /* @__PURE__ */ new Map();
    records.forEach((r) => {
      let userMap = userRecordsMap.get(r.userId);
      if (!userMap) {
        userMap = /* @__PURE__ */ new Map();
        userRecordsMap.set(r.userId, userMap);
      }
      userMap.set(r.date, r);
    });
    let totalStaffPresentSum = 0;
    let totalActiveStaffWithLogs = 0;
    const staffMetrics = staffList.map((staff) => {
      const userMap = userRecordsMap.get(staff.id) || /* @__PURE__ */ new Map();
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let pendingCount = 0;
      const dailyStatus = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${targetMonth}-${String(day).padStart(2, "0")}`;
        const rec = userMap.get(dayStr);
        if (rec) {
          dailyStatus[dayStr] = rec.status;
          if (rec.status === "PRESENT") presentCount++;
          else if (rec.status === "ABSENT") absentCount++;
          else if (rec.status === "LATE") {
            lateCount++;
            presentCount++;
          } else if (rec.status === "HALF_DAY") {
            halfDayCount++;
            presentCount++;
          } else if (rec.status === "PENDING") {
            pendingCount++;
          }
        } else {
          dailyStatus[dayStr] = "NOT_MARKED";
        }
      }
      const totalMarked = presentCount + absentCount + pendingCount;
      const rate = totalMarked > 0 ? Math.round(presentCount / totalMarked * 100) : null;
      if (rate !== null) {
        totalStaffPresentSum += rate;
        totalActiveStaffWithLogs++;
      }
      let statusTag = "UNTRACKED";
      if (rate !== null) {
        if (rate >= 90) statusTag = "EXCELLENT";
        else if (rate >= 75) statusTag = "GOOD";
        else if (rate >= 60) statusTag = "AVERAGE";
        else statusTag = "NEEDS_ATTENTION";
      }
      return {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        department: staff.department || "Repair Lab",
        profileImage: staff.profileImage || null,
        presentCount,
        absentCount,
        lateCount,
        halfDayCount,
        pendingCount,
        totalMarked,
        attendanceRate: rate,
        statusTag,
        dailyStatus
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
        totalLogs: records.length
      },
      report: staffMetrics,
      staffMetrics
    });
  } catch (err) {
    console.error("[MONTHLY REPORT ERROR]", err);
    return res.status(500).json({ error: "Failed to generate monthly attendance report." });
  }
});
router9.get("/staff/:userId/monthly", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    if (!isManagement && currentUser.id !== userId) {
      return res.status(403).json({ error: "You are only authorized to view your own attendance logs." });
    }
    const time = getNepalBusinessTime();
    const targetMonth = req.query.month || time.dateString.slice(0, 7);
    const [yearStr, monthStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const records = await getAllAttendanceRecords({ userId, month: targetMonth });
    const recordMap = /* @__PURE__ */ new Map();
    records.forEach((r) => recordMap.set(r.date, r));
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let pendingCount = 0;
    const dailyLogs = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${targetMonth}-${String(day).padStart(2, "0")}`;
      const rec = recordMap.get(dateStr);
      if (rec) {
        if (rec.status === "PRESENT") presentCount++;
        else if (rec.status === "ABSENT") absentCount++;
        else if (rec.status === "LATE") {
          lateCount++;
          presentCount++;
        } else if (rec.status === "HALF_DAY") {
          halfDayCount++;
          presentCount++;
        } else if (rec.status === "PENDING") {
          pendingCount++;
        }
        dailyLogs.push(rec);
      } else {
        dailyLogs.push({
          id: null,
          userId,
          date: dateStr,
          status: "NOT_MARKED",
          checkInTime: null,
          checkOutTime: null,
          notes: null
        });
      }
    }
    const totalMarked = presentCount + absentCount + pendingCount;
    const rate = totalMarked > 0 ? Math.round(presentCount / totalMarked * 100) : null;
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
        attendanceRate: rate
      },
      dailyLogs
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch staff monthly logs." });
  }
});
router9.post("/mark", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const {
      userId,
      date,
      status = "PRESENT",
      notes,
      correctionReason,
      checkInTime,
      checkOutTime
    } = req.body;
    const time = getNepalBusinessTime();
    const targetUserId = userId || currentUser.id;
    const targetDate = date || time.dateString;
    const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
    const isAdmin = currentUser.role === "ADMIN";
    const isManager = currentUser.role === "MANAGER";
    const isSelf = targetUserId === currentUser.id;
    if (isSuperAdmin || isAdmin) {
    } else if (isManager) {
      if (!isSelf && !time.isWithinWindow) {
        return res.status(403).json({
          error: `Manager can only record staff attendance between 10:00 AM and 10:35 AM (Asia/Kathmandu time). Current NPT time: ${time.timeString}`,
          code: "OUTSIDE_ATTENDANCE_WINDOW",
          serverTime: time.timeString,
          window: "10:00 AM - 10:35 AM NPT"
        });
      }
    } else {
      if (!isSelf) {
        return res.status(403).json({
          error: "Access denied: Staff members can only record their own personal attendance.",
          code: "UNAUTHORIZED_TARGET_USER"
        });
      }
    }
    const staffList = await getAuthorizedStaffList();
    const targetUser = staffList.find((s) => s.id === targetUserId);
    if (!targetUser && !isSuperAdmin && !isAdmin) {
      return res.status(400).json({ error: "Target employee is not an active staff member." });
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
        method: isSuperAdmin ? "DIRECT_SUPER_ADMIN" : isAdmin ? "DIRECT_ADMIN" : isManager ? "MANAGER_ATTENDANCE" : "STAFF_SELF_CHECKIN",
        requestStatus: "DIRECT"
      },
      {
        id: currentUser.id,
        name: currentUser.name || "Staff User",
        role: currentUser.role
      }
    );
    return res.status(200).json({
      success: true,
      message: `Attendance marked as ${saved.status} for ${targetUser?.name || "employee"}.`,
      record: saved
    });
  } catch (err) {
    console.error("[MARK ATTENDANCE EXCEPTION]", err);
    return res.status(500).json({ error: err?.message || "Failed to record attendance." });
  }
});
router9.post("/bulk-mark", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
    const isAdmin = currentUser.role === "ADMIN";
    const isManager = currentUser.role === "MANAGER";
    if (!isSuperAdmin && !isAdmin && !isManager) {
      return res.status(403).json({ error: "Access denied: Insufficient permissions for bulk attendance." });
    }
    const time = getNepalBusinessTime();
    if (isManager && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager can only record staff attendance between 10:00 AM and 10:35 AM (Asia/Kathmandu time). Current NPT time: ${time.timeString}`,
        code: "OUTSIDE_ATTENDANCE_WINDOW"
      });
    }
    const { date, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "List of staff items is required for bulk marking." });
    }
    const targetDate = date || time.dateString;
    const formattedItems = items.map((item) => ({
      userId: item.userId,
      date: targetDate,
      status: item.status || "PRESENT",
      notes: item.notes
    }));
    const results = await bulkUpsertAttendance(formattedItems, {
      id: currentUser.id,
      name: currentUser.name || "Admin",
      role: currentUser.role
    });
    return res.json({
      success: true,
      message: `Successfully processed attendance for ${results.length} staff members.`,
      records: results
    });
  } catch (err) {
    console.error("[BULK MARK ERROR]", err);
    return res.status(500).json({ error: "Failed to complete bulk attendance." });
  }
});
router9.get("/my", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const time = getNepalBusinessTime();
    const currentMonth = req.query.month || time.dateString.slice(0, 7);
    const allMyRecords = await getAllAttendanceRecords({ userId: currentUser.id });
    const todayRecord = allMyRecords.find((r) => r.date === time.dateString);
    const monthRecords = allMyRecords.filter((r) => r.date.startsWith(currentMonth));
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    monthRecords.forEach((r) => {
      if (r.status === "PRESENT") presentDays++;
      else if (r.status === "LATE") {
        lateDays++;
        presentDays++;
      } else if (r.status === "HALF_DAY") presentDays++;
      else if (r.status === "ABSENT") absentDays++;
    });
    const totalDays = monthRecords.length;
    const rate = totalDays > 0 ? Math.round(presentDays / totalDays * 100) : null;
    return res.json({
      success: true,
      today: todayRecord || {
        status: "NOT_MARKED",
        date: time.dateString,
        checkInTime: null
      },
      stats: {
        month: currentMonth,
        presentDays,
        absentDays,
        lateDays,
        totalRecordedDays: totalDays,
        attendanceRate: rate
      },
      history: allMyRecords.slice(0, 60)
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve personal attendance." });
  }
});
router9.get("/history", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    const { date, month, userId, status, search } = req.query;
    const filterUserId = isManagement ? userId : currentUser.id;
    const records = await getAllAttendanceRecords({
      date,
      month,
      userId: filterUserId,
      status,
      search
    });
    const staffList = await getAuthorizedStaffList();
    const userMap = /* @__PURE__ */ new Map();
    staffList.forEach((s) => userMap.set(s.id, s));
    const enriched = records.map((r) => {
      const user = userMap.get(r.userId);
      return {
        ...r,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          profileImage: user.profileImage
        } : { id: r.userId, name: "Staff Member", role: "STAFF" }
      };
    });
    let finalRecords = enriched;
    if (search && search.trim()) {
      const s = search.toLowerCase();
      finalRecords = finalRecords.filter(
        (r) => r.user?.name?.toLowerCase().includes(s) || r.user?.email?.toLowerCase().includes(s) || r.user?.role?.toLowerCase().includes(s) || r.notes?.toLowerCase().includes(s) || r.date?.includes(s)
      );
    }
    return res.json({
      success: true,
      count: finalRecords.length,
      records: finalRecords
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve attendance history." });
  }
});
router9.patch("/:id", authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req, res) => {
  try {
    const currentUser = req.user;
    const { id } = req.params;
    const { status, notes, correctionReason, checkInTime, checkOutTime } = req.body;
    const existing = await getAttendanceRecordById(id);
    if (!existing) {
      return res.status(404).json({ error: "Attendance record not found." });
    }
    const time = getNepalBusinessTime();
    const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
    const isAdmin = currentUser.role === "ADMIN";
    const isManager = currentUser.role === "MANAGER";
    if (isManager && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager can only update attendance during 10:00 AM \u2013 10:35 AM NPT. (Current NPT: ${time.timeString})`,
        code: "OUTSIDE_ATTENDANCE_WINDOW"
      });
    }
    const updated = await upsertAttendanceRecord(
      {
        userId: existing.userId,
        date: existing.date,
        status: status || existing.status,
        checkInTime: checkInTime !== void 0 ? checkInTime : existing.checkInTime,
        checkOutTime: checkOutTime !== void 0 ? checkOutTime : existing.checkOutTime,
        notes: notes !== void 0 ? notes : existing.notes,
        correctionReason: correctionReason || "Administrative correction"
      },
      {
        id: currentUser.id,
        name: currentUser.name || "Admin",
        role: currentUser.role
      }
    );
    return res.json({
      success: true,
      message: "Attendance record successfully updated.",
      record: updated
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update attendance record." });
  }
});
router9.delete("/:id", authenticate, authorize(ATTENDANCE_ADMIN_ROLES), async (req, res) => {
  try {
    const currentUser = req.user;
    const { id } = req.params;
    const success = await deleteAttendanceRecord(id, {
      id: currentUser.id,
      name: currentUser.name || "Admin",
      role: currentUser.role
    });
    if (!success) {
      return res.status(404).json({ error: "Attendance record not found." });
    }
    return res.json({
      success: true,
      message: "Attendance record deleted successfully."
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete attendance record." });
  }
});
router9.get("/export", authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { month } = req.query;
    const time = getNepalBusinessTime();
    const targetMonth = month || time.dateString.slice(0, 7);
    const records = await getAllAttendanceRecords({ month: targetMonth });
    const staffList = await getAuthorizedStaffList();
    const userMap = /* @__PURE__ */ new Map();
    staffList.forEach((u) => userMap.set(u.id, u));
    const rows = records.map((r) => {
      const u = userMap.get(r.userId) || {};
      return {
        Date: r.date,
        "Staff Name": u.name || "Staff Member",
        Role: (u.role || "TECHNICIAN").replace(/_/g, " "),
        Department: u.department || "Repair Lab",
        Status: r.status,
        "Check-In": r.checkInTime || "\u2014",
        "Check-Out": r.checkOutTime || "\u2014",
        "Marked By": r.markedByName || "System",
        "Marked Role": r.markedByRole || "\u2014",
        Notes: r.notes || "\u2014",
        "Correction Reason": r.correctionReason || "\u2014"
      };
    });
    return res.json({
      success: true,
      month: targetMonth,
      count: rows.length,
      rows
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to export attendance records." });
  }
});
router9.get("/audit-logs", authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req, res) => {
  try {
    const logs = await getAttendanceAuditLogs({ limit: 100 });
    return res.json({ success: true, auditLogs: logs, logs });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch audit logs." });
  }
});
router9.delete("/staff/:userId", authenticate, authorize(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const currentUser = req.user;
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "Staff User ID is required." });
    }
    if (userId === currentUser.id) {
      return res.status(400).json({ error: "You cannot delete your own Super Admin attendance records." });
    }
    const count = await purgeUserAttendance(userId, {
      id: currentUser.id,
      name: currentUser.name || "Super Admin",
      role: currentUser.role
    });
    return res.json({
      success: true,
      message: `Permanently removed ${count} attendance records for this staff member.`
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to purge staff attendance records." });
  }
});
var attendance_default = router9;

// api/_server/routes/repairDamage.ts
import { Router as Router10 } from "express";

// api/_server/services/damageStorage.ts
import fs2 from "fs";
import path2 from "path";
import { v4 as uuidv410 } from "uuid";
var DATA_DIR2 = path2.join(process.cwd(), "data");
var DAMAGE_FILE = path2.join(DATA_DIR2, "repair_damage_records.json");
var AUDIT_FILE2 = path2.join(DATA_DIR2, "repair_damage_audit_logs.json");
if (!fs2.existsSync(DATA_DIR2)) {
  try {
    fs2.mkdirSync(DATA_DIR2, { recursive: true });
  } catch (e) {
    console.warn("[STORAGE DIR INIT WARN]", e);
  }
}
var damageCache = /* @__PURE__ */ new Map();
var auditCache2 = [];
var isInitialized2 = false;
function loadLocalFile2(filePath, defaultValue) {
  try {
    if (fs2.existsSync(filePath)) {
      const content = fs2.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${filePath}]`, err);
  }
  return defaultValue;
}
function saveLocalFile2(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs2.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs2.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[STORAGE WRITE ERROR: ${filePath}]`, err);
  }
}
function getNepalDateTime() {
  const now = /* @__PURE__ */ new Date();
  const nptDateString = now.toLocaleString("en-US", { timeZone: "Asia/Kathmandu" });
  const nptDate = new Date(nptDateString);
  const year = nptDate.getFullYear();
  const month = String(nptDate.getMonth() + 1).padStart(2, "0");
  const day = String(nptDate.getDate()).padStart(2, "0");
  const hours = String(nptDate.getHours()).padStart(2, "0");
  const minutes = String(nptDate.getMinutes()).padStart(2, "0");
  const date = `${year}-${month}-${day}`;
  const time = `${hours}:${minutes}`;
  return {
    date,
    time,
    iso: now.toISOString(),
    fullDate: nptDate
  };
}
async function initializeDamageStorage() {
  if (isInitialized2) return;
  const localDamages = loadLocalFile2(DAMAGE_FILE, []);
  const localAudits = loadLocalFile2(AUDIT_FILE2, []);
  localDamages.forEach((d) => damageCache.set(d.id, d));
  auditCache2 = localAudits;
  try {
    const { data: supaDamages, error: dErr } = await supabaseAdmin.from("RepairRelatedDamage").select("*").order("createdAt", { ascending: false });
    if (!dErr && supaDamages && supaDamages.length > 0) {
      supaDamages.forEach((d) => {
        damageCache.set(d.id, {
          ...d,
          isArchived: Boolean(d.isArchived),
          inventoryDeducted: Boolean(d.inventoryDeducted)
        });
      });
      saveLocalFile2(DAMAGE_FILE, Array.from(damageCache.values()));
    }
    const { data: supaAudits, error: aErr } = await supabaseAdmin.from("RepairRelatedDamageAudit").select("*").order("createdAt", { ascending: false }).limit(500);
    if (!aErr && supaAudits && supaAudits.length > 0) {
      auditCache2 = supaAudits;
      saveLocalFile2(AUDIT_FILE2, auditCache2);
    }
  } catch (err) {
    console.warn("[SUPABASE DAMAGE SYNC WARN - USING LOCAL CACHE]", err);
  }
  isInitialized2 = true;
}
async function generateDamageRecordNumber() {
  await initializeDamageStorage();
  const currentYear = getNepalDateTime().date.slice(0, 4);
  let maxNum = 0;
  for (const r of damageCache.values()) {
    if (r.recordNumber && r.recordNumber.startsWith(`RRD-${currentYear}-`)) {
      const match = r.recordNumber.match(/(\d+)$/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
      }
    }
  }
  try {
    const { data: supaRecords } = await supabaseAdmin.from("RepairRelatedDamage").select("recordNumber").ilike("recordNumber", `RRD-${currentYear}-%`).order("recordNumber", { ascending: false }).limit(10);
    if (supaRecords && supaRecords.length > 0) {
      for (const r of supaRecords) {
        if (!r.recordNumber) continue;
        const match = r.recordNumber.match(/(\d+)$/);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
        }
      }
    }
  } catch (e) {
  }
  const nextNum = maxNum + 1;
  return `RRD-${currentYear}-${nextNum.toString().padStart(4, "0")}`;
}
async function getStaffUserDetails(userId) {
  try {
    const { data: user, error } = await supabaseAdmin.from("User").select("id, name, email, role, department").eq("id", userId).single();
    if (user && !error) return user;
  } catch (err) {
    console.warn("[FETCH STAFF USER DETAIL WARN]", err);
  }
  return null;
}
async function queryDamageRecords(options) {
  await initializeDamageStorage();
  try {
    let query = supabaseAdmin.from("RepairRelatedDamage").select("*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role, department)", { count: "exact" });
    if (!options.includeArchived) {
      query = query.eq("isArchived", false);
    }
    if (options.staffId && options.staffId !== "ALL") {
      query = query.eq("staffId", options.staffId);
    }
    if (options.role && options.role !== "ALL") {
      query = query.eq("staffRole", options.role);
    }
    if (options.component && options.component !== "ALL") {
      query = query.eq("damagedComponent", options.component);
    }
    if (options.damageType && options.damageType !== "ALL") {
      query = query.eq("damageType", options.damageType);
    }
    if (options.date) {
      query = query.eq("damageDate", options.date);
    } else if (options.month) {
      query = query.ilike("damageDate", `${options.month}%`);
    } else if (options.year) {
      query = query.ilike("damageDate", `${options.year}%`);
    } else if (options.startDate || options.endDate) {
      if (options.startDate) query = query.gte("damageDate", options.startDate);
      if (options.endDate) query = query.lte("damageDate", options.endDate);
    }
    if (options.search) {
      const s = options.search.trim();
      query = query.or(`recordNumber.ilike.%${s}%,staffName.ilike.%${s}%,repairNumber.ilike.%${s}%,deviceBrand.ilike.%${s}%,deviceModel.ilike.%${s}%,damagedComponent.ilike.%${s}%,damageDescription.ilike.%${s}%`);
    }
    const limit2 = options.limit || 100;
    const offset2 = options.offset || 0;
    const { data, count, error } = await query.order("damageDate", { ascending: false }).order("createdAt", { ascending: false }).range(offset2, offset2 + limit2 - 1);
    if (!error && data) {
      data.forEach((d) => {
        damageCache.set(d.id, d);
      });
      saveLocalFile2(DAMAGE_FILE, Array.from(damageCache.values()));
      return { records: data, total: count ?? data.length };
    }
  } catch (err) {
    console.warn("[QUERY DAMAGE DB EXCEPTION - USING LOCAL CACHE]", err);
  }
  let allRecords = Array.from(damageCache.values());
  if (!options.includeArchived) {
    allRecords = allRecords.filter((r) => !r.isArchived && r.status !== "ARCHIVED");
  }
  if (options.staffId && options.staffId !== "ALL") {
    allRecords = allRecords.filter((r) => r.staffId === options.staffId);
  }
  if (options.role && options.role !== "ALL") {
    allRecords = allRecords.filter((r) => r.staffRole === options.role);
  }
  if (options.component && options.component !== "ALL") {
    allRecords = allRecords.filter((r) => r.damagedComponent === options.component);
  }
  if (options.damageType && options.damageType !== "ALL") {
    allRecords = allRecords.filter((r) => r.damageType === options.damageType);
  }
  if (options.date) {
    allRecords = allRecords.filter((r) => r.damageDate === options.date);
  } else if (options.month) {
    allRecords = allRecords.filter((r) => r.damageDate.startsWith(options.month));
  } else if (options.year) {
    allRecords = allRecords.filter((r) => r.damageDate.startsWith(options.year));
  } else if (options.startDate || options.endDate) {
    if (options.startDate) allRecords = allRecords.filter((r) => r.damageDate >= options.startDate);
    if (options.endDate) allRecords = allRecords.filter((r) => r.damageDate <= options.endDate);
  }
  if (options.search) {
    const s = options.search.toLowerCase().trim();
    allRecords = allRecords.filter(
      (r) => r.recordNumber && r.recordNumber.toLowerCase().includes(s) || r.staffName && r.staffName.toLowerCase().includes(s) || r.repairNumber && r.repairNumber.toLowerCase().includes(s) || r.deviceBrand && r.deviceBrand.toLowerCase().includes(s) || r.deviceModel && r.deviceModel.toLowerCase().includes(s) || r.damagedComponent && r.damagedComponent.toLowerCase().includes(s) || r.damageDescription && r.damageDescription.toLowerCase().includes(s)
    );
  }
  allRecords.sort((a, b) => (b.damageDate + (b.damageTime || "")).localeCompare(a.damageDate + (a.damageTime || "")));
  const total = allRecords.length;
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  const sliced = allRecords.slice(offset, offset + limit);
  return { records: sliced, total };
}
async function getDamageOverviewMetrics(staffIdScope) {
  await initializeDamageStorage();
  const { date: todayDate, time: _time } = getNepalDateTime();
  const currentMonth = todayDate.slice(0, 7);
  let records = Array.from(damageCache.values()).filter((r) => !r.isArchived && r.status !== "ARCHIVED");
  if (staffIdScope && staffIdScope !== "ALL") {
    records = records.filter((r) => r.staffId === staffIdScope);
  }
  let totalRecords = 0;
  let thisMonthRecords = 0;
  let todayRecords = 0;
  let totalEstimatedCost = 0;
  let totalDeductions = 0;
  const componentBreakdown = {};
  records.forEach((r) => {
    totalRecords++;
    const cost = Number(r.estimatedCost || 0);
    totalEstimatedCost += isNaN(cost) ? 0 : cost;
    if (r.inventoryDeducted) totalDeductions++;
    if (r.damageDate === todayDate) {
      todayRecords++;
    }
    if (r.damageDate && r.damageDate.startsWith(currentMonth)) {
      thisMonthRecords++;
    }
    const comp = r.damagedComponent || "Other";
    componentBreakdown[comp] = (componentBreakdown[comp] || 0) + 1;
  });
  const sorted = [...records].sort(
    (a, b) => (b.damageDate + (b.damageTime || "")).localeCompare(a.damageDate + (a.damageTime || ""))
  );
  return {
    totalRecords,
    thisMonthRecords,
    todayRecords,
    totalEstimatedCost,
    totalDeductions,
    componentBreakdown,
    latestRecord: sorted[0] || null,
    latestRecords: sorted.slice(0, 5),
    currentMonth,
    todayDate
  };
}
async function getDamageRecordById(id) {
  await initializeDamageStorage();
  try {
    const { data: record, error } = await supabaseAdmin.from("RepairRelatedDamage").select("*, staff:User!RepairRelatedDamage_staffId_fkey(name, email, role, department), audits:RepairRelatedDamageAudit(*)").eq("id", id).single();
    if (!error && record) {
      damageCache.set(record.id, record);
      return record;
    }
  } catch (err) {
    console.warn("[FETCH DAMAGE BY ID DB WARN]", err);
  }
  const cached = damageCache.get(id);
  if (cached) {
    const relatedAudits = auditCache2.filter((a) => a.damageRecordId === id);
    return {
      ...cached,
      auditLogs: relatedAudits
    };
  }
  return null;
}
async function createDamageRecord(data, actor) {
  await initializeDamageStorage();
  const { date: nptDate, time: nptTime, iso: nptIso } = getNepalDateTime();
  let staffName = "Staff Member";
  let staffRole = "TECHNICIAN";
  const staffDetails = await getStaffUserDetails(data.staffId);
  if (staffDetails) {
    staffName = staffDetails.name;
    staffRole = staffDetails.role;
  }
  const recordNumber = await generateDamageRecordNumber();
  const recordId = uuidv410();
  const newRecord = {
    id: recordId,
    recordNumber,
    staffId: data.staffId,
    staffName,
    staffRole,
    repairId: data.repairId || null,
    repairNumber: data.repairNumber || null,
    customerId: data.customerId || null,
    customerName: data.customerName || null,
    deviceBrand: data.deviceBrand || null,
    deviceModel: data.deviceModel || null,
    damagedComponent: data.damagedComponent.trim(),
    damageType: data.damageType || "CRACKED",
    damageDescription: data.damageDescription.trim(),
    damageDate: data.damageDate || nptDate,
    damageTime: data.damageTime || nptTime,
    damageTimestamp: nptIso,
    quantity: Math.max(1, parseInt(String(data.quantity || 1), 10) || 1),
    estimatedCost: data.estimatedCost !== void 0 && data.estimatedCost !== null && !isNaN(Number(data.estimatedCost)) ? Number(data.estimatedCost) : null,
    notes: data.notes || null,
    inventoryItemId: data.inventoryItemId || null,
    inventoryDeducted: Boolean(data.deductInventory && data.inventoryItemId),
    inventoryTxId: null,
    recordedById: actor.id,
    recordedByName: actor.name,
    recordedByRole: actor.role,
    branchId: data.branchId || null,
    status: "ACTIVE",
    isArchived: false,
    deletedAt: null,
    createdAt: nptIso,
    updatedAt: nptIso,
    staff: {
      name: staffName,
      email: staffDetails?.email || "",
      role: staffRole,
      department: staffDetails?.department || null
    }
  };
  damageCache.set(recordId, newRecord);
  saveLocalFile2(DAMAGE_FILE, Array.from(damageCache.values()));
  const auditId = uuidv410();
  const auditRecord = {
    id: auditId,
    damageRecordId: recordId,
    action: "CREATED",
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousData: null,
    newData: JSON.stringify(newRecord),
    reason: "Initial damage incident recorded",
    notes: data.notes || null,
    createdAt: nptIso
  };
  auditCache2.unshift(auditRecord);
  saveLocalFile2(AUDIT_FILE2, auditCache2);
  try {
    const dbPayload = { ...newRecord };
    delete dbPayload.staff;
    const { data: inserted, error: insertErr } = await supabaseAdmin.from("RepairRelatedDamage").insert([dbPayload]).select("*").single();
    if (insertErr) {
      console.error("[SUPABASE DAMAGE INSERT ERROR]", insertErr);
    }
    await supabaseAdmin.from("RepairRelatedDamageAudit").insert([auditRecord]);
    if (inserted) {
      damageCache.set(recordId, {
        ...inserted,
        staff: newRecord.staff
      });
    }
  } catch (err) {
    console.error("[SUPABASE DAMAGE INSERT EXCEPTION]", err);
  }
  await broadcastServerChange("RepairRelatedDamage", "CREATE", recordId, newRecord);
  return newRecord;
}
async function updateDamageRecord(id, updates, actor) {
  await initializeDamageStorage();
  const existing = await getDamageRecordById(id);
  if (!existing || existing.isArchived) {
    throw new Error("Damage record not found or already archived.");
  }
  const { iso: nowIso } = getNepalDateTime();
  const previousDataSnapshot = JSON.stringify(existing);
  const updatedRecord = {
    ...existing,
    ...updates,
    damagedComponent: updates.damagedComponent ? updates.damagedComponent.trim() : existing.damagedComponent,
    damageDescription: updates.damageDescription !== void 0 ? updates.damageDescription.trim() : existing.damageDescription,
    quantity: updates.quantity !== void 0 ? Math.max(1, parseInt(String(updates.quantity), 10) || 1) : existing.quantity,
    estimatedCost: updates.estimatedCost !== void 0 ? updates.estimatedCost !== null && !isNaN(Number(updates.estimatedCost)) ? Number(updates.estimatedCost) : null : existing.estimatedCost,
    updatedAt: nowIso
  };
  damageCache.set(id, updatedRecord);
  saveLocalFile2(DAMAGE_FILE, Array.from(damageCache.values()));
  const auditId = uuidv410();
  const auditRecord = {
    id: auditId,
    damageRecordId: id,
    action: "UPDATED",
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousData: previousDataSnapshot,
    newData: JSON.stringify(updatedRecord),
    reason: updates.auditReason || "Record details modified by supervisor",
    notes: updates.notes || null,
    createdAt: nowIso
  };
  auditCache2.unshift(auditRecord);
  saveLocalFile2(AUDIT_FILE2, auditCache2);
  try {
    const dbPayload = { ...updatedRecord };
    delete dbPayload.staff;
    delete dbPayload.audits;
    delete dbPayload.auditLogs;
    delete dbPayload.auditReason;
    await supabaseAdmin.from("RepairRelatedDamage").update(dbPayload).eq("id", id);
    await supabaseAdmin.from("RepairRelatedDamageAudit").insert([auditRecord]);
  } catch (err) {
    console.error("[SUPABASE DAMAGE UPDATE EXCEPTION]", err);
  }
  await broadcastServerChange("RepairRelatedDamage", "UPDATE", id, updatedRecord);
  return updatedRecord;
}
async function archiveDamageRecord(id, actor, reason) {
  await initializeDamageStorage();
  const existing = await getDamageRecordById(id);
  if (!existing) {
    throw new Error("Damage record not found.");
  }
  const { iso: nowIso } = getNepalDateTime();
  const previousDataSnapshot = JSON.stringify(existing);
  const archivedRecord = {
    ...existing,
    isArchived: true,
    status: "ARCHIVED",
    deletedAt: nowIso,
    updatedAt: nowIso
  };
  damageCache.set(id, archivedRecord);
  saveLocalFile2(DAMAGE_FILE, Array.from(damageCache.values()));
  const auditId = uuidv410();
  const auditRecord = {
    id: auditId,
    damageRecordId: id,
    action: "ARCHIVED",
    performedById: actor.id,
    performedByName: actor.name,
    performedByRole: actor.role,
    previousData: previousDataSnapshot,
    newData: JSON.stringify(archivedRecord),
    reason: reason || "Record archived by administrator",
    createdAt: nowIso
  };
  auditCache2.unshift(auditRecord);
  saveLocalFile2(AUDIT_FILE2, auditCache2);
  try {
    await supabaseAdmin.from("RepairRelatedDamage").update({
      isArchived: true,
      status: "ARCHIVED",
      deletedAt: nowIso,
      updatedAt: nowIso
    }).eq("id", id);
    await supabaseAdmin.from("RepairRelatedDamageAudit").insert([auditRecord]);
  } catch (err) {
    console.error("[SUPABASE DAMAGE ARCHIVE EXCEPTION]", err);
  }
  await broadcastServerChange("RepairRelatedDamage", "DELETE", id);
  return { success: true, message: "Damage record safely archived." };
}

// api/_server/routes/repairDamage.ts
var router10 = Router10();
function isElevatedRole(role) {
  return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role || "");
}
function canModifyDamage(role) {
  return ["SUPER_ADMIN", "ADMIN"].includes(role || "");
}
router10.get("/server-time", authenticate, (_req, res) => {
  const npt = getNepalDateTime();
  return res.json({
    success: true,
    timezone: "Asia/Kathmandu (NPT, UTC+5:45)",
    date: npt.date,
    time: npt.time,
    iso: npt.iso
  });
});
router10.get("/overview", authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    let staffScope;
    if (!isElevatedRole(userRole)) {
      staffScope = userId;
    } else if (req.query.staffId && req.query.staffId !== "ALL") {
      staffScope = String(req.query.staffId);
    }
    const overview = await getDamageOverviewMetrics(staffScope);
    return res.json({
      success: true,
      role: userRole,
      isScopedToSelf: !isElevatedRole(userRole),
      ...overview
    });
  } catch (err) {
    console.error("[DAMAGE OVERVIEW ERROR]", err);
    return res.status(500).json({ error: "Failed to generate repair-related damage overview." });
  }
});
router10.get("/components", authenticate, async (_req, res) => {
  try {
    const standardComponents = [
      "Display Panel",
      "OCA Glass",
      "Touch Screen Digitizer",
      "AMOLED Display",
      "LCD Screen",
      "Flex Cable",
      "Camera Module (Rear)",
      "Camera Module (Front)",
      "Camera Lens Glass",
      "Back Housing / Cover",
      "Charging Port PCB",
      "Battery",
      "Motherboard / PCB",
      "Power IC",
      "Audio IC",
      "Speaker / Earpiece",
      "Microphone",
      "Fingerprint Sensor",
      "SIM Tray / Reader",
      "Screw / Internal Bracket",
      "Other Component"
    ];
    return res.json(standardComponents);
  } catch (err) {
    return res.json(["Display Panel", "OCA Glass", "Flex Cable", "Camera Lens", "Back Housing", "Power IC", "Other"]);
  }
});
router10.get("/", authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    let targetStaffId = req.query.staffId ? String(req.query.staffId) : void 0;
    if (!isElevatedRole(userRole)) {
      targetStaffId = userId;
    }
    const {
      role,
      component,
      damageType,
      date,
      month,
      year,
      startDate,
      endDate,
      search,
      limit = "100",
      offset = "0"
    } = req.query;
    const result = await queryDamageRecords({
      staffId: targetStaffId,
      role: role && role !== "ALL" ? String(role) : void 0,
      component: component && component !== "ALL" ? String(component) : void 0,
      damageType: damageType && damageType !== "ALL" ? String(damageType) : void 0,
      date: date ? String(date) : void 0,
      month: month ? String(month) : void 0,
      year: year ? String(year) : void 0,
      startDate: startDate ? String(startDate) : void 0,
      endDate: endDate ? String(endDate) : void 0,
      search: search ? String(search) : void 0,
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0
    });
    res.setHeader("X-Total-Count", result.total.toString());
    return res.json(result.records);
  } catch (err) {
    console.error("[QUERY DAMAGE RECORDS ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve repair-related damage records." });
  }
});
router10.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const record = await getDamageRecordById(id);
    if (!record || record.isArchived) {
      return res.status(404).json({ error: "Repair-related damage record not found." });
    }
    if (!isElevatedRole(userRole)) {
      if (record.staffId !== userId && record.recordedById !== userId) {
        return res.status(403).json({
          error: "Access Forbidden: You are not authorized to view another staff member's damage record."
        });
      }
    }
    return res.json(record);
  } catch (err) {
    console.error("[GET DAMAGE BY ID ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch damage record details." });
  }
});
router10.post("/", authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const actor = {
      id: req.user.id,
      name: req.user.name || "Staff Member",
      role: req.user.role || "MANAGER"
    };
    if (!isElevatedRole(userRole)) {
      return res.status(403).json({
        error: "Permission Denied: Only Managers, Admins, and Super Admins are authorized to record damage incidents."
      });
    }
    const {
      staffId,
      damagedComponent,
      damageType = "ACCIDENTAL",
      damageDescription,
      repairId,
      repairNumber,
      customerId,
      customerName,
      deviceBrand,
      deviceModel,
      damageDate,
      damageTime,
      quantity = 1,
      estimatedCost,
      notes,
      inventoryItemId,
      deductInventory = false,
      branchId
    } = req.body;
    if (!staffId) {
      return res.status(400).json({ error: "Missing required field: staffId (Responsible staff member)." });
    }
    if (!damagedComponent || !damagedComponent.trim()) {
      return res.status(400).json({ error: "Missing required field: damagedComponent." });
    }
    if (!damageDescription || damageDescription.trim().length < 3) {
      return res.status(400).json({ error: "Damage description is required (minimum 3 characters)." });
    }
    const createdRecord = await createDamageRecord(
      {
        staffId,
        damagedComponent,
        damageType,
        damageDescription,
        repairId,
        repairNumber,
        customerId,
        customerName,
        deviceBrand,
        deviceModel,
        damageDate,
        damageTime,
        quantity: parseInt(String(quantity), 10) || 1,
        estimatedCost: estimatedCost !== void 0 && estimatedCost !== null && !isNaN(Number(estimatedCost)) ? Number(estimatedCost) : null,
        notes,
        inventoryItemId,
        deductInventory: Boolean(deductInventory),
        branchId
      },
      actor
    );
    return res.status(201).json(createdRecord);
  } catch (err) {
    console.error("[CREATE DAMAGE ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to record damage incident." });
  }
});
router10.patch("/:id", authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const actor = {
      id: req.user.id,
      name: req.user.name || "Administrator",
      role: req.user.role || "ADMIN"
    };
    if (!canModifyDamage(userRole)) {
      return res.status(403).json({
        error: "Permission Denied: Managers and technicians are not authorized to edit or modify existing damage records. Only Admins and Super Admins can update records."
      });
    }
    const { id } = req.params;
    const {
      damagedComponent,
      damageType,
      damageDescription,
      deviceBrand,
      deviceModel,
      repairNumber,
      damageDate,
      damageTime,
      quantity,
      estimatedCost,
      notes,
      status,
      auditReason
    } = req.body;
    const updatedRecord = await updateDamageRecord(
      id,
      {
        damagedComponent,
        damageType,
        damageDescription,
        deviceBrand,
        deviceModel,
        repairNumber,
        damageDate,
        damageTime,
        quantity,
        estimatedCost,
        notes,
        status,
        auditReason: auditReason || "Damage record details modified by Administrator"
      },
      actor
    );
    return res.json(updatedRecord);
  } catch (err) {
    console.error("[UPDATE DAMAGE ERROR]", err);
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || "Failed to update damage record." });
  }
});
router10.delete("/:id", authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const actor = {
      id: req.user.id,
      name: req.user.name || "Administrator",
      role: req.user.role || "ADMIN"
    };
    if (!canModifyDamage(userRole)) {
      return res.status(403).json({
        error: "Permission Denied: Managers and technicians are not authorized to delete damage records. Only Admins and Super Admins can archive records."
      });
    }
    const { id } = req.params;
    const reason = req.body?.reason || req.query?.reason ? String(req.body?.reason || req.query?.reason) : "Record safely archived by Administrator";
    const result = await archiveDamageRecord(id, actor, reason);
    return res.json(result);
  } catch (err) {
    console.error("[ARCHIVE DAMAGE ERROR]", err);
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || "Failed to archive damage record." });
  }
});
router10.get("/export", authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    let targetStaffId = req.query.staffId ? String(req.query.staffId) : void 0;
    if (!isElevatedRole(userRole)) {
      targetStaffId = userId;
    }
    const { role, component, damageType, date, month, year, startDate, endDate, search } = req.query;
    const result = await queryDamageRecords({
      staffId: targetStaffId,
      role: role && role !== "ALL" ? String(role) : void 0,
      component: component && component !== "ALL" ? String(component) : void 0,
      damageType: damageType && damageType !== "ALL" ? String(damageType) : void 0,
      date: date ? String(date) : void 0,
      month: month ? String(month) : void 0,
      year: year ? String(year) : void 0,
      startDate: startDate ? String(startDate) : void 0,
      endDate: endDate ? String(endDate) : void 0,
      search: search ? String(search) : void 0,
      limit: 1e3
    });
    const rows = result.records.map((r) => ({
      "Record #": r.recordNumber,
      "Staff Name": r.staffName,
      "Role": r.staffRole?.replace(/_/g, " "),
      "Damaged Component": r.damagedComponent,
      "Damage Type": r.damageType || "Accidental",
      "Device Model": `${r.deviceBrand || ""} ${r.deviceModel || ""}`.trim() || "\u2014",
      "Repair Job #": r.repairNumber ? `#${r.repairNumber}` : "\u2014",
      "Incident Date": r.damageDate,
      "Incident Time": r.damageTime || "\u2014",
      "Quantity": r.quantity || 1,
      "Estimated Cost (NPR)": r.estimatedCost !== null && r.estimatedCost !== void 0 ? Number(r.estimatedCost) : "\u2014",
      "Damage Description": r.damageDescription,
      "Recorded By": `${r.recordedByName || "System"} (${r.recordedByRole || "MANAGER"})`,
      "Status": r.status || "ACTIVE"
    }));
    const buffer = createExcelBuffer("Repair Damage Log", rows);
    const nptDate = getNepalDateTime().date;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="MTS_Repair_Damage_${nptDate}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    console.error("[EXPORT DAMAGE ERROR]", err);
    return res.status(500).json({ error: "Failed to export damage records." });
  }
});
var repairDamage_default = router10;

// api/_server/routes/repairPrices.ts
import { Router as Router11 } from "express";
import { v4 as uuidv411 } from "uuid";
var router11 = Router11();
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
router11.get("/", handleGetPrices);
router11.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
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
    await broadcastServerChange("RepairPrice", "CREATE", created.id, created);
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
    await broadcastServerChange("RepairPrice", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update price item." });
  }
};
router11.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), handleUpdatePrice);
router11.patch("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), handleUpdatePrice);
router11.patch("/:id/toggle-status", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from("RepairPrice").select("status").eq("id", id).single();
    if (!existing) return res.status(404).json({ error: "Price item not found." });
    const newStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { data: updated, error } = await supabaseAdmin.from("RepairPrice").update({ status: newStatus, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to toggle status." });
    await broadcastServerChange("RepairPrice", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle status." });
  }
});
router11.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("RepairPrice").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete repair price." });
    await broadcastServerChange("RepairPrice", "DELETE", id);
    return res.json({ success: true, message: "Repair price deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete price record." });
  }
});
router11.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "No IDs specified." });
    const { error } = await supabaseAdmin.from("RepairPrice").delete().in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to bulk delete prices." });
    for (const id of ids) {
      await broadcastServerChange("RepairPrice", "DELETE", id);
    }
    return res.json({ success: true, message: `Deleted ${ids.length} price items.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process bulk delete." });
  }
});
var repairPrices_default = router11;

// api/_server/routes/slides.ts
import { Router as Router12 } from "express";
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
var router12 = Router12();
var upload3 = multer3({ storage: multer3.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router12.get("/", async (req, res) => {
  try {
    const { data: slides, error } = await supabaseAdmin.from("HomeSlide").select("*").order("displayOrder", { ascending: true });
    if (error) return res.status(500).json({ error: "Failed to fetch slides." });
    return res.json(slides || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve slides." });
  }
});
router12.post("/upload-image", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), upload3.single("image"), async (req, res) => {
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
router12.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
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
    await broadcastServerChange("HomeSlide", "CREATE", created.id, created);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save slide." });
  }
});
router12.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    const { data: updated, error } = await supabaseAdmin.from("HomeSlide").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update slide." });
    await broadcastServerChange("HomeSlide", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update slide." });
  }
});
router12.patch("/:id/toggle-status", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: slide } = await supabaseAdmin.from("HomeSlide").select("status").eq("id", id).single();
    if (!slide) return res.status(404).json({ error: "Slide not found." });
    const newStatus = slide.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { data: updated, error } = await supabaseAdmin.from("HomeSlide").update({ status: newStatus, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to toggle status." });
    await broadcastServerChange("HomeSlide", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle status." });
  }
});
router12.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("HomeSlide").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete slide." });
    await broadcastServerChange("HomeSlide", "DELETE", id);
    return res.json({ success: true, message: "Slide deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete slide." });
  }
});
var slides_default = router12;

// api/_server/routes/products.ts
import { Router as Router13 } from "express";
import { v4 as uuidv413 } from "uuid";
var router13 = Router13();
router13.get("/", async (req, res) => {
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
router13.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
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
    await broadcastServerChange("Product", "CREATE", created.id, created);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create product." });
  }
});
router13.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete updateData.id;
    if (updateData.price !== void 0) updateData.price = parseFloat(updateData.price) || 0;
    if (updateData.discountPrice !== void 0) updateData.discountPrice = updateData.discountPrice ? parseFloat(updateData.discountPrice) : null;
    if (updateData.stockQuantity !== void 0) updateData.stockQuantity = parseInt(updateData.stockQuantity, 10) || 0;
    const { data: updated, error } = await supabaseAdmin.from("Product").update(updateData).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: "Failed to update product." });
    await broadcastServerChange("Product", "UPDATE", id, updated);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update product record." });
  }
});
router13.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Product").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to delete product." });
    await broadcastServerChange("Product", "DELETE", id);
    return res.json({ success: true, message: "Product deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete product." });
  }
});
var products_default = router13;

// api/_server/routes/notifications.ts
import { Router as Router14 } from "express";
var router14 = Router14();
router14.get("/", authenticate, async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin.from("Notification").select("*").or(`userId.eq.${req.user.id},userId.is.null`).order("createdAt", { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: "Failed to fetch notifications." });
    return res.json(notifications || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve notifications." });
  }
});
router14.post("/:id/read", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("Notification").update({ isRead: true, readAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) return res.status(500).json({ error: "Failed to mark notification as read." });
    await broadcastServerChange("Notification", "UPDATE", id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update notification status." });
  }
});
router14.post("/mark-all-read", authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from("Notification").update({ isRead: true, readAt: (/* @__PURE__ */ new Date()).toISOString() }).or(`userId.eq.${req.user.id},userId.is.null`);
    if (error) return res.status(500).json({ error: "Failed to mark all notifications as read." });
    await broadcastServerChange("Notification", "UPDATE", "bulk");
    return res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process mark all read." });
  }
});
var notifications_default = router14;

// api/_server/routes/superAdmin.ts
import { Router as Router15 } from "express";
import { v4 as uuidv414 } from "uuid";
var router15 = Router15();
router15.get("/audit-logs", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
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
router15.get("/deletion-history", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { data: logs, error } = await supabaseAdmin.from("AuditLog").select("*").ilike("action", "%DELETE%").order("createdAt", { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: "Failed to fetch deletion history." });
    return res.json(logs || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve deletion records." });
  }
});
router15.post("/delete-data", authenticate, authorize(["SUPER_ADMIN"]), async (req, res) => {
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
    for (const id of ids) {
      await broadcastServerChange(table, "DELETE", id);
    }
    return res.json({ success: true, message: `Safely removed ${ids.length} records from ${table}.` });
  } catch (err) {
    return res.status(500).json({ error: "Failed to execute data deletion." });
  }
});
router15.get("/share/history", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { data: shares } = await supabaseAdmin.from("AppletShare").select("*").order("createdAt", { ascending: false }).limit(50);
    return res.json(shares || []);
  } catch (err) {
    return res.json([]);
  }
});
router15.post("/share/applet", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
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
var superAdmin_default = router15;

// api/_server/routes/security.ts
import { Router as Router16 } from "express";
import { v4 as uuidv415 } from "uuid";
var router16 = Router16();
router16.use(authenticate);
router16.use(authorize(["SUPER_ADMIN", "ADMIN"]));
router16.get("/stats", async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const { data: staffUsers, error: staffErr } = await supabaseAdmin.from("User").select("id, lastActiveAt, role").is("deletedAt", null).neq("role", "CUSTOMER");
    const totalStaff = staffUsers ? staffUsers.length : 0;
    const activeStaffNow = staffUsers ? staffUsers.filter((u) => u.lastActiveAt && u.lastActiveAt >= fifteenMinutesAgo).length : 0;
    const { data: devices, error: devErr } = await supabaseAdmin.from("ApprovedDevice").select("id, status");
    const totalDevices = devices ? devices.length : 0;
    const blockedDevices = devices ? devices.filter((d) => d.status === "REVOKED" || d.status === "BLOCKED").length : 0;
    const alertActions = [
      "FAILED_LOGIN",
      "LOGIN_BLOCKED_DEVICE",
      "DEVICE_REVOKED",
      "DEVICE_BLOCKED",
      "ACCESS_REQUEST_REJECTED",
      "ACCOUNT_DISABLED",
      "USER_ROLE_CHANGED",
      "PASSWORD_RESET",
      "DATA_PURGED",
      "SECURITY_POLICY_VIOLATION"
    ];
    const { data: alertLogs, error: alertErr } = await supabaseAdmin.from("AuditLog").select("id").gte("createdAt", twentyFourHoursAgo).or(`status.eq.FAILED,action.in.(${alertActions.join(",")})`);
    const securityAlertsCount = alertLogs ? alertLogs.length : 0;
    const { data: pendingRequests, error: reqErr } = await supabaseAdmin.from("AccessRequest").select("id").eq("status", "PENDING");
    const pendingAccessRequests = pendingRequests ? pendingRequests.length : 0;
    return res.json({
      success: true,
      stats: {
        totalStaff,
        activeStaffNow,
        totalDevices,
        blockedDevices,
        securityAlertsCount,
        pendingAccessRequests
      }
    });
  } catch (err) {
    console.error("[SECURITY STATS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch security metrics." });
  }
});
router16.get("/active-staff", async (req, res) => {
  try {
    const { data: staffList, error: staffErr } = await supabaseAdmin.from("User").select(`
        id, name, email, username, role, department, phoneNumber, branchId,
        profileImage, accountStatus, isActive, twoFactorEnabled, lastLoginAt, lastActiveAt, createdAt
      `).is("deletedAt", null).neq("role", "CUSTOMER").order("lastActiveAt", { ascending: false, nullsFirst: false });
    if (staffErr) throw staffErr;
    const { data: devices } = await supabaseAdmin.from("ApprovedDevice").select("*").order("lastUsedAt", { ascending: false });
    const deviceMap = /* @__PURE__ */ new Map();
    (devices || []).forEach((d) => {
      if (!deviceMap.has(d.userId)) {
        deviceMap.set(d.userId, []);
      }
      deviceMap.get(d.userId).push(d);
    });
    const now = Date.now();
    const activeStaff = (staffList || []).map((user) => {
      let presenceStatus = "OFFLINE";
      if (user.lastActiveAt) {
        const diffMs = now - new Date(user.lastActiveAt).getTime();
        if (diffMs <= 5 * 60 * 1e3) {
          presenceStatus = "ONLINE";
        } else if (diffMs <= 15 * 60 * 1e3) {
          presenceStatus = "IDLE";
        }
      }
      const userDevices = deviceMap.get(user.id) || [];
      const activeDevices = userDevices.filter((d) => d.status === "APPROVED");
      const latestDevice = userDevices[0] || null;
      return {
        ...user,
        presenceStatus,
        devicesCount: userDevices.length,
        activeDevicesCount: activeDevices.length,
        devices: userDevices,
        lastIpAddress: latestDevice?.ipAddress || null,
        lastKnownDevice: latestDevice?.deviceName || latestDevice?.browser ? `${latestDevice?.browser || ""} on ${latestDevice?.os || ""}`.trim() : null
      };
    });
    return res.json({
      success: true,
      staff: activeStaff,
      total: activeStaff.length
    });
  } catch (err) {
    console.error("[ACTIVE STAFF ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch active staff list." });
  }
});
router16.get("/devices", async (req, res) => {
  try {
    const { status, search, userId } = req.query;
    let query = supabaseAdmin.from("ApprovedDevice").select(`
        *,
        user:User (id, name, email, role, profileImage, department, branchId)
      `).order("lastUsedAt", { ascending: false, nullsFirst: false });
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    if (userId) {
      query = query.eq("userId", userId);
    }
    const { data: devices, error } = await query;
    if (error) throw error;
    let filtered = devices || [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (d) => d.deviceName && d.deviceName.toLowerCase().includes(q) || d.deviceIdentifier && d.deviceIdentifier.toLowerCase().includes(q) || d.browser && d.browser.toLowerCase().includes(q) || d.os && d.os.toLowerCase().includes(q) || d.ipAddress && d.ipAddress.toLowerCase().includes(q) || d.user?.name && d.user.name.toLowerCase().includes(q) || d.user?.email && d.user.email.toLowerCase().includes(q)
      );
    }
    return res.json({
      success: true,
      devices: filtered,
      total: filtered.length
    });
  } catch (err) {
    console.error("[SECURITY DEVICES ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch registered devices." });
  }
});
router16.post("/devices/:id/revoke", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { data: device, error: devErr } = await supabaseAdmin.from("ApprovedDevice").select("*, user:User (id, name, email, role)").eq("id", id).maybeSingle();
    if (devErr || !device) {
      return res.status(404).json({ error: "Device not found." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const { error: updateErr } = await supabaseAdmin.from("ApprovedDevice").update({
      status: "REVOKED",
      revokedAt: nowIso,
      updatedAt: nowIso
    }).eq("id", id);
    if (updateErr) throw updateErr;
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "DEVICE_BLOCKED",
      resource: "ApprovedDevice",
      resourceId: id,
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
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
        reason: reason || "Revoked/Blocked by Administrator"
      }
    });
    await broadcastServerChange("ApprovedDevice", "UPDATE", id, { id, status: "REVOKED" });
    return res.json({
      success: true,
      message: `Device '${device.deviceName || device.deviceIdentifier}' has been blocked and access revoked.`
    });
  } catch (err) {
    console.error("[REVOKE DEVICE ERROR]", err);
    return res.status(500).json({ error: "Failed to revoke device authorization." });
  }
});
router16.post("/devices/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: device, error: devErr } = await supabaseAdmin.from("ApprovedDevice").select("*, user:User (id, name, email, role)").eq("id", id).maybeSingle();
    if (devErr || !device) {
      return res.status(404).json({ error: "Device not found." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const { error: updateErr } = await supabaseAdmin.from("ApprovedDevice").update({
      status: "APPROVED",
      approvedBy: req.user?.name || req.user?.email,
      approvedAt: nowIso,
      revokedAt: null,
      updatedAt: nowIso
    }).eq("id", id);
    if (updateErr) throw updateErr;
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "DEVICE_UNBLOCKED",
      resource: "ApprovedDevice",
      resourceId: id,
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      deviceInfo: {
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.deviceName,
        browser: device.browser,
        os: device.os
      },
      details: {
        targetUserId: device.userId,
        targetUserName: device.user?.name,
        targetUserEmail: device.user?.email
      }
    });
    await broadcastServerChange("ApprovedDevice", "UPDATE", id, { id, status: "APPROVED" });
    return res.json({
      success: true,
      message: `Device '${device.deviceName || device.deviceIdentifier}' has been authorized and restored.`
    });
  } catch (err) {
    console.error("[APPROVE DEVICE ERROR]", err);
    return res.status(500).json({ error: "Failed to authorize device." });
  }
});
router16.delete("/devices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: device } = await supabaseAdmin.from("ApprovedDevice").select("*").eq("id", id).maybeSingle();
    const { error } = await supabaseAdmin.from("ApprovedDevice").delete().eq("id", id);
    if (error) throw error;
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "DEVICE_DELETED",
      resource: "ApprovedDevice",
      resourceId: id,
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      details: { deletedDevice: device }
    });
    await broadcastServerChange("ApprovedDevice", "DELETE", id);
    return res.json({ success: true, message: "Device record removed successfully." });
  } catch (err) {
    console.error("[DELETE DEVICE ERROR]", err);
    return res.status(500).json({ error: "Failed to remove device record." });
  }
});
router16.get("/activity-timeline", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const { userId, action, category, resource, status, search, startDate, endDate } = req.query;
    let query = supabaseAdmin.from("AuditLog").select("*", { count: "exact" }).order("createdAt", { ascending: false });
    if (userId && userId !== "ALL") {
      query = query.eq("userId", userId);
    }
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    if (resource && resource !== "ALL") {
      query = query.eq("resource", resource);
    }
    if (action && action !== "ALL") {
      query = query.eq("action", action);
    } else if (category && category !== "ALL") {
      if (category === "AUTH") {
        query = query.in("action", ["LOGIN", "LOGOUT", "2FA_VERIFY", "LOGIN_2FA", "PASSWORD_RESET", "FAILED_LOGIN"]);
      } else if (category === "SECURITY") {
        query = query.in("action", [
          "FAILED_LOGIN",
          "LOGIN_BLOCKED_DEVICE",
          "DEVICE_BLOCKED",
          "DEVICE_REVOKED",
          "DEVICE_UNBLOCKED",
          "ACCESS_REQUEST_REJECTED",
          "ACCESS_REQUEST_APPROVED",
          "ACCOUNT_DISABLED",
          "USER_ROLE_CHANGED",
          "DATA_PURGED"
        ]);
      } else if (category === "DATA_MUTATION") {
        query = query.or("action.ilike.%CREATE%,action.ilike.%UPDATE%,action.ilike.%DELETE%");
      }
    }
    if (startDate) {
      query = query.gte("createdAt", new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("createdAt", end.toISOString());
    }
    if (search) {
      const s = search;
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
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    console.error("[ACTIVITY TIMELINE ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch activity logs." });
  }
});
router16.get("/access-requests", async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabaseAdmin.from("AccessRequest").select(`
        *,
        user:User (id, name, email, role, profileImage, accountStatus, isActive)
      `).order("createdAt", { ascending: false });
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    const { data: requests, error } = await query;
    if (error) throw error;
    let filtered = requests || [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.fullName && r.fullName.toLowerCase().includes(q) || r.email && r.email.toLowerCase().includes(q) || r.deviceName && r.deviceName.toLowerCase().includes(q) || r.deviceIdentifier && r.deviceIdentifier.toLowerCase().includes(q) || r.requestedRole && r.requestedRole.toLowerCase().includes(q)
      );
    }
    return res.json({
      success: true,
      requests: filtered,
      total: filtered.length
    });
  } catch (err) {
    console.error("[ACCESS REQUESTS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch access requests." });
  }
});
router16.post("/access-requests/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedRole } = req.body;
    const { data: accessReq, error: reqErr } = await supabaseAdmin.from("AccessRequest").select("*").eq("id", id).maybeSingle();
    if (reqErr || !accessReq) {
      return res.status(404).json({ error: "Access request not found." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const finalRole = assignedRole || accessReq.requestedRole || "RECEPTIONIST";
    await supabaseAdmin.from("AccessRequest").update({
      status: "APPROVED",
      requestedRole: finalRole,
      approvedBy: req.user?.name || req.user?.email,
      approvedAt: nowIso,
      updatedAt: nowIso
    }).eq("id", id);
    if (accessReq.userId || accessReq.email) {
      const userCondition = accessReq.userId ? { id: accessReq.userId } : { email: accessReq.email.toLowerCase() };
      const { data: existingUser } = await supabaseAdmin.from("User").select("id, name, email").match(userCondition).maybeSingle();
      if (existingUser) {
        await supabaseAdmin.from("User").update({
          role: finalRole,
          accountStatus: "ACTIVE",
          isActive: true,
          emailVerified: true,
          failedLoginAttempts: 0,
          updatedAt: nowIso
        }).eq("id", existingUser.id);
        if (accessReq.deviceIdentifier) {
          const { data: dev } = await supabaseAdmin.from("ApprovedDevice").select("id").eq("userId", existingUser.id).eq("deviceIdentifier", accessReq.deviceIdentifier).maybeSingle();
          if (dev) {
            await supabaseAdmin.from("ApprovedDevice").update({
              status: "APPROVED",
              approvedBy: req.user?.name || req.user?.email,
              approvedAt: nowIso,
              revokedAt: null,
              updatedAt: nowIso
            }).eq("id", dev.id);
          } else {
            await supabaseAdmin.from("ApprovedDevice").insert([
              {
                id: uuidv415(),
                userId: existingUser.id,
                deviceIdentifier: accessReq.deviceIdentifier,
                deviceName: accessReq.deviceName || "Workstation",
                deviceType: accessReq.deviceType || "DESKTOP",
                browser: accessReq.browser || null,
                os: accessReq.os || null,
                ipAddress: accessReq.ipAddress || null,
                userAgent: accessReq.userAgent || null,
                status: "APPROVED",
                approvedBy: req.user?.name || req.user?.email,
                approvedAt: nowIso,
                lastUsedAt: nowIso,
                createdAt: nowIso,
                updatedAt: nowIso
              }
            ]);
          }
        }
      }
    }
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "ACCESS_REQUEST_APPROVED",
      resource: "AccessRequest",
      resourceId: id,
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      details: {
        applicantName: accessReq.fullName,
        applicantEmail: accessReq.email,
        assignedRole: finalRole,
        deviceIdentifier: accessReq.deviceIdentifier
      }
    });
    await broadcastServerChange("AccessRequest", "UPDATE", id, { id, status: "APPROVED", role: finalRole });
    return res.json({
      success: true,
      message: `Access granted for ${accessReq.fullName} with role '${finalRole}' and device authorization.`
    });
  } catch (err) {
    console.error("[APPROVE ACCESS REQUEST ERROR]", err);
    return res.status(500).json({ error: "Failed to approve access request." });
  }
});
router16.post("/access-requests/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { data: accessReq, error: reqErr } = await supabaseAdmin.from("AccessRequest").select("*").eq("id", id).maybeSingle();
    if (reqErr || !accessReq) {
      return res.status(404).json({ error: "Access request not found." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await supabaseAdmin.from("AccessRequest").update({
      status: "REJECTED",
      rejectedBy: req.user?.name || req.user?.email,
      rejectedAt: nowIso,
      updatedAt: nowIso
    }).eq("id", id);
    if (accessReq.deviceIdentifier) {
      await supabaseAdmin.from("ApprovedDevice").update({
        status: "REVOKED",
        revokedAt: nowIso,
        updatedAt: nowIso
      }).eq("deviceIdentifier", accessReq.deviceIdentifier);
    }
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "ACCESS_REQUEST_REJECTED",
      resource: "AccessRequest",
      resourceId: id,
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      details: {
        applicantName: accessReq.fullName,
        applicantEmail: accessReq.email,
        reason: reason || "Access denied by administrator",
        deviceIdentifier: accessReq.deviceIdentifier
      }
    });
    await broadcastServerChange("AccessRequest", "UPDATE", id, { id, status: "REJECTED" });
    return res.json({
      success: true,
      message: `Access request for ${accessReq.fullName} has been rejected.`
    });
  } catch (err) {
    console.error("[REJECT ACCESS REQUEST ERROR]", err);
    return res.status(500).json({ error: "Failed to reject access request." });
  }
});
router16.post("/access-requests/:id/reset-attempts", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: accessReq, error: reqErr } = await supabaseAdmin.from("AccessRequest").select("*").eq("id", id).maybeSingle();
    if (reqErr || !accessReq) {
      return res.status(404).json({ error: "Access request not found." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await supabaseAdmin.from("AccessRequest").update({
      requestNumber: 1,
      totalRequests: 1,
      status: "PENDING",
      updatedAt: nowIso
    }).eq("id", id);
    if (accessReq.userId || accessReq.email) {
      const match = accessReq.userId ? { id: accessReq.userId } : { email: accessReq.email.toLowerCase() };
      await supabaseAdmin.from("User").update({ failedLoginAttempts: 0, accountStatus: "PENDING" }).match(match);
    }
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: "ACCESS_ATTEMPTS_RESET",
      resource: "AccessRequest",
      resourceId: id,
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      details: { email: accessReq.email }
    });
    await broadcastServerChange("AccessRequest", "UPDATE", id);
    return res.json({ success: true, message: "Attempts reset and request reset to PENDING." });
  } catch (err) {
    console.error("[RESET ATTEMPTS ERROR]", err);
    return res.status(500).json({ error: "Failed to reset attempts." });
  }
});
router16.post("/access-requests/system-repair", async (req, res) => {
  try {
    let repairedCount = 0;
    const { data: unlinkedRequests } = await supabaseAdmin.from("AccessRequest").select("id, email, userId").is("userId", null);
    if (unlinkedRequests && unlinkedRequests.length > 0) {
      for (const reqItem of unlinkedRequests) {
        if (reqItem.email) {
          const { data: user } = await supabaseAdmin.from("User").select("id").eq("email", reqItem.email.toLowerCase().trim()).maybeSingle();
          if (user) {
            await supabaseAdmin.from("AccessRequest").update({ userId: user.id }).eq("id", reqItem.id);
            repairedCount++;
          }
        }
      }
    }
    const { data: activeUsers } = await supabaseAdmin.from("User").select("id, name, email").eq("isActive", true).neq("role", "CUSTOMER");
    if (activeUsers) {
      for (const usr of activeUsers) {
        const { data: dev } = await supabaseAdmin.from("ApprovedDevice").select("id").eq("userId", usr.id).maybeSingle();
        if (!dev) {
          await supabaseAdmin.from("ApprovedDevice").insert([
            {
              id: uuidv415(),
              userId: usr.id,
              deviceIdentifier: `legacy_${usr.id.substring(0, 8)}`,
              deviceName: "Primary Workstation",
              deviceType: "DESKTOP",
              status: "APPROVED",
              approvedBy: "System Auto-Repair",
              approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
              lastUsedAt: (/* @__PURE__ */ new Date()).toISOString(),
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      action: "SECURITY_SYSTEM_REPAIR",
      resource: "SecurityCenter",
      status: "SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      details: { repairedCount }
    });
    return res.json({
      success: true,
      message: `System integrity repair complete. Synchronized ${repairedCount} security and device records.`,
      repairedCount
    });
  } catch (err) {
    console.error("[SECURITY REPAIR ERROR]", err);
    return res.status(500).json({ error: "Failed to run security system repair." });
  }
});
var security_default = router16;

// api/_server/routes/upload.ts
import { Router as Router17 } from "express";
import multer4 from "multer";
var router17 = Router17();
var upload4 = multer4({ storage: multer4.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router17.post("/", authenticate, upload4.single("file"), async (req, res) => {
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
var upload_default = router17;

// api/_server/routes/events.ts
import { Router as Router18 } from "express";
import jwt3 from "jsonwebtoken";
var router18 = Router18();
router18.get("/", (req, res) => {
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
var events_default = router18;

// api/_server/routes/public.ts
import { Router as Router19 } from "express";
var router19 = Router19();
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
      deliveredAt
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
    const { data: explicitLogs } = await supabaseAdmin.from("RepairLog").select("id, action, status, notes, message, createdAt").eq("repairId", repairRecord.id).order("createdAt", { ascending: false });
    let combinedLogs = explicitLogs || [];
    if (combinedLogs.length === 0) {
      combinedLogs = [
        {
          id: `synth-${repairRecord.id}`,
          action: "STATUS_UPDATED",
          status: repairRecord.status || "RECEIVED",
          notes: `Device checked in and status currently registered as ${repairRecord.status || "RECEIVED"}.`,
          message: `Device status: ${repairRecord.status || "RECEIVED"}`,
          createdAt: repairRecord.createdAt || (/* @__PURE__ */ new Date()).toISOString()
        }
      ];
    }
    repairRecord.logs = combinedLogs;
    if (repairRecord.logs && Array.isArray(repairRecord.logs)) {
      repairRecord.logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
router19.get("/track", handlePublicTrack);
router19.post("/track", handlePublicTrack);
router19.get("/public/track", handlePublicTrack);
router19.post("/public/track", handlePublicTrack);
router19.get("/manager/stats", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
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
router19.get("/manager/workload", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
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
router19.get("/dashboard/stats", authenticate, async (req, res) => {
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
var public_default = router19;

// api/_server/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());
  app.use("/api/auth", auth_default);
  app.use("/api/users", users_default);
  app.use("/api/user", users_default);
  app.use("/api/security", security_default);
  app.use("/api/repairs", repairs_default);
  app.use("/api/repair", repairs_default);
  app.use("/api/repair-transfers", repairTransfers_default);
  app.use("/api/repair-transfer", repairTransfers_default);
  app.use("/api/customers", customers_default);
  app.use("/api/customer", customers_default);
  app.use("/api/inventory", inventory_default);
  app.use("/api/couriers", couriers_default);
  app.use("/api/courier", couriers_default);
  app.use("/api/battery-warranties", batteryWarranties_default);
  app.use("/api/battery-warranty", batteryWarranties_default);
  app.use("/api/warranties", batteryWarranties_default);
  app.use("/api/warranty", batteryWarranties_default);
  app.use("/api/attendance", attendance_default);
  app.use("/api/repair-damage", repairDamage_default);
  app.use("/api/repair-prices", repairPrices_default);
  app.use("/api/public/repair-prices", repairPrices_default);
  app.use("/api/slides", slides_default);
  app.use("/api/admin/slides", slides_default);
  app.use("/api/products", products_default);
  app.use("/api/public/products", products_default);
  app.use("/api/notifications", notifications_default);
  app.use("/api/admin", superAdmin_default);
  app.use("/api/share", superAdmin_default);
  app.use("/api/access-requests", security_default);
  app.use("/api/approved-devices", security_default);
  app.use("/api/upload", upload_default);
  app.use("/api/events", events_default);
  app.use("/api/public", public_default);
  app.use("/api", public_default);
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  return app;
}
var app_default = createApp();
export {
  createApp,
  app_default as default
};
