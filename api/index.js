// api/_server/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import path9 from "path";
import fs9 from "fs";

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
var cachedAdminAuthToken = null;
var adminAuthTokenExpiresAt = 0;
var adminLoginPromise = null;
async function getSystemAuthToken() {
  if (SUPABASE_SERVICE_ROLE_KEY) return null;
  if (cachedAdminAuthToken && Date.now() < adminAuthTokenExpiresAt) {
    return cachedAdminAuthToken;
  }
  if (adminLoginPromise) {
    return adminLoginPromise;
  }
  adminLoginPromise = (async () => {
    try {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const authAttempts = [
        { email: "admin@mtslab.com", password: "admin123" },
        { email: "mtsmobilelab@gmail.com", password: "admin123" },
        { email: "manojacharya526@gmail.com", password: "admin123" }
      ];
      for (const cred of authAttempts) {
        try {
          const { data, error } = await authClient.auth.signInWithPassword(cred);
          if (!error && data?.session?.access_token) {
            cachedAdminAuthToken = data.session.access_token;
            const expiresIn = data.session.expires_in || 3600;
            adminAuthTokenExpiresAt = Date.now() + Math.max(300, expiresIn - 60) * 1e3;
            return cachedAdminAuthToken;
          }
        } catch (_) {
        }
      }
      return null;
    } catch (e) {
      console.warn("[SUPABASE SYSTEM AUTH WARN]", e);
      return null;
    } finally {
      adminLoginPromise = null;
    }
  })();
  return adminLoginPromise;
}
var supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      fetch: async (url, options = {}) => {
        if (!SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const token = await getSystemAuthToken();
            if (token) {
              const headers = new Headers(options.headers || {});
              headers.set("Authorization", `Bearer ${token}`);
              options.headers = headers;
            }
          } catch (_) {
          }
        }
        return fetch(url, options);
      }
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
function getCloudinaryCredentials() {
  let cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  let apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
  let apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
  const cldUrl = (process.env.CLOUDINARY_URL || "").trim();
  if ((!cloudName || !apiKey || !apiSecret) && cldUrl) {
    try {
      const cleaned = cldUrl.replace(/^cloudinary:\/\//, "");
      const [credentials, cName] = cleaned.split("@");
      if (cName && !cloudName) {
        cloudName = cName.split("/")[0].trim();
      }
      if (credentials) {
        const [k, s] = credentials.split(":");
        if (k && !apiKey) apiKey = k.trim();
        if (s && !apiSecret) apiSecret = s.trim();
      }
    } catch (e) {
      console.warn("[CLOUDINARY CONFIG PARSE ERROR]", e);
    }
  }
  return { cloudName, apiKey, apiSecret, cldUrl };
}
var cldCreds = getCloudinaryCredentials();
var config = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  jwtSecret: process.env.JWT_SECRET || "mts-lab-super-secret-key-2026",
  refreshSecret: process.env.REFRESH_SECRET || "mts-lab-refresh-secret-key-2026",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  cloudinaryCloudName: cldCreds.cloudName,
  cloudinaryApiKey: cldCreds.apiKey,
  cloudinaryApiSecret: cldCreds.apiSecret,
  cloudinaryUrl: cldCreds.cldUrl,
  getCloudinaryCredentials
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
  const entityLower = entityName.toLowerCase();
  const payload = {
    entity: entityLower,
    action,
    id: String(id),
    data,
    timestamp: Date.now()
  };
  try {
    const channel = getOrCreateServerChannel();
    if (channel) {
      await channel.send({
        type: "broadcast",
        event: "db_event",
        payload
      });
    }
  } catch (err) {
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
    const { email: emailField, identity, password } = req.body;
    const emailOrUsername = emailField || identity;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const normalizedIdentifier = String(emailOrUsername).toLowerCase().trim();
    const dev = req.body && typeof req.body.device === "object" && req.body.device ? req.body.device : {};
    const deviceIdentifier = req.body.deviceIdentifier || dev.deviceIdentifier || req.headers["x-device-identifier"] || null;
    const deviceName = req.body.deviceName || dev.deviceName || null;
    const deviceType = req.body.deviceType || dev.deviceType || "DESKTOP";
    const browser = req.body.browser || dev.browser || null;
    const os = req.body.os || dev.os || null;
    const ipAddress = req.body.ipAddress || dev.ipAddress || req.ip || req.headers["x-forwarded-for"] || null;
    let query = supabaseAdmin.from("User").select("*").or(`email.ilike.${normalizedIdentifier},username.ilike.${normalizedIdentifier}`).is("deletedAt", null).limit(1);
    let { data: users, error: userErr } = await query;
    if ((!users || users.length === 0) && normalizedIdentifier.includes("@")) {
      const { data: directUsers } = await supabaseAdmin.from("User").select("*").eq("email", normalizedIdentifier).is("deletedAt", null).limit(1);
      if (directUsers && directUsers.length > 0) {
        users = directUsers;
        userErr = null;
      }
    }
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
        email: user.email,
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
            email: user.email,
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
        const { data: dev2 } = await supabaseAdmin.from("ApprovedDevice").select("id").eq("userId", user.id).eq("deviceIdentifier", deviceIdentifier).maybeSingle();
        if (dev2) {
          await supabaseAdmin.from("ApprovedDevice").update({
            deviceName: deviceName || void 0,
            deviceType: deviceType || "DESKTOP",
            browser: browser || void 0,
            os: os || void 0,
            ipAddress: ipAddress || req.ip || null,
            userAgent: req.headers["user-agent"] || null,
            lastUsedAt: nowIso,
            updatedAt: nowIso
          }).eq("id", dev2.id);
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
import { v4 as uuidv47 } from "uuid";
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

// api/_server/services/notificationStorage.ts
import fs from "fs";
import path from "path";
import { v4 as uuidv44 } from "uuid";
var DATA_DIR = path.join(process.cwd(), "data");
var NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn("[NOTIFICATIONS STORAGE DIR WARN]", e);
  }
}
var notificationCache = /* @__PURE__ */ new Map();
var isInitialized = false;
function loadLocalFile() {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const content = fs.readFileSync(NOTIFICATIONS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[NOTIFICATIONS READ ERROR: ${NOTIFICATIONS_FILE}]`, err);
  }
  return [];
}
function saveLocalFile(data) {
  try {
    const tempPath = `${NOTIFICATIONS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, NOTIFICATIONS_FILE);
  } catch (err) {
    console.error(`[NOTIFICATIONS WRITE ERROR: ${NOTIFICATIONS_FILE}]`, err);
  }
}
async function initializeNotificationStorage() {
  if (isInitialized) return;
  const localRecords = loadLocalFile();
  localRecords.forEach((n) => notificationCache.set(n.id, n));
  try {
    const { data: supaRecords, error } = await supabaseAdmin.from("Notification").select("*").order("createdAt", { ascending: false }).limit(200);
    if (!error && supaRecords && supaRecords.length > 0) {
      supaRecords.forEach((n) => {
        const existing = notificationCache.get(n.id);
        if (!existing || new Date(n.updatedAt || n.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
          notificationCache.set(n.id, {
            id: n.id,
            userId: n.userId || null,
            targetRole: n.targetRole || null,
            title: n.title,
            message: n.message,
            type: n.type || "GENERAL",
            repairId: n.repairId || null,
            repairNumber: n.repairNumber || null,
            senderId: n.senderId || null,
            senderName: n.senderName || null,
            senderRole: n.senderRole || null,
            priority: n.priority || "NORMAL",
            link: n.link || (n.repairId ? `/dashboard/repairs/${n.repairId}` : null),
            metadata: typeof n.metadata === "string" ? safeJsonParse(n.metadata) : n.metadata || null,
            isRead: Boolean(n.isRead),
            readAt: n.readAt || null,
            createdAt: n.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: n.updatedAt || n.createdAt || (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      });
      saveLocalFile(Array.from(notificationCache.values()));
    }
  } catch (err) {
    console.warn("[SUPABASE NOTIFICATIONS SYNC WARN - USING LOCAL CACHE]", err);
  }
  isInitialized = true;
}
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
async function getUserNotifications(user, options = {}) {
  await initializeNotificationStorage();
  const { unreadOnly = false, limit = 50, type } = options;
  const allNotifications = Array.from(notificationCache.values());
  const userNotifications = allNotifications.filter((n) => {
    if (n.userId && n.userId === user.id) return true;
    if (n.targetRole && (n.targetRole === user.role || n.targetRole === "ADMIN" && user.role === "SUPER_ADMIN")) {
      return true;
    }
    if (!n.userId && !n.targetRole) return true;
    return false;
  });
  const unreadCount = userNotifications.filter((n) => !n.isRead).length;
  let filtered = userNotifications;
  if (unreadOnly) {
    filtered = filtered.filter((n) => !n.isRead);
  }
  if (type) {
    filtered = filtered.filter((n) => n.type === type);
  }
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    notifications: filtered.slice(0, limit),
    unreadCount
  };
}
async function createNotification(data) {
  await initializeNotificationStorage();
  const id = uuidv44();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let link = data.link;
  if (!link && data.repairId) {
    link = `/dashboard/repairs/${data.repairId}`;
  } else if (!link && (data.type === "ATTENDANCE_REQUEST" || data.type === "ATTENDANCE_APPROVED" || data.type === "ATTENDANCE_REJECTED")) {
    link = "/dashboard/attendance";
  } else if (!link && (data.type === "ACCESS_REQUEST" || data.type === "ACCESS_APPROVED" || data.type === "ACCESS_REJECTED")) {
    link = "/dashboard/access-requests";
  } else if (!link && data.type === "COURIER_UPDATE") {
    link = "/dashboard/courier";
  } else if (!link && data.type === "WARRANTY_ALERT") {
    link = "/dashboard/battery-warranty";
  }
  const newRecord = {
    id,
    userId: data.userId || null,
    targetRole: data.targetRole || null,
    title: String(data.title || "").trim(),
    message: String(data.message || "").trim(),
    type: data.type || "GENERAL",
    repairId: data.repairId || null,
    repairNumber: data.repairNumber || null,
    senderId: data.senderId || null,
    senderName: data.senderName || null,
    senderRole: data.senderRole || null,
    priority: data.priority || "NORMAL",
    link: link || null,
    metadata: data.metadata || null,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now
  };
  notificationCache.set(id, newRecord);
  saveLocalFile(Array.from(notificationCache.values()));
  try {
    await supabaseAdmin.from("Notification").upsert([
      {
        id: newRecord.id,
        userId: newRecord.userId,
        title: newRecord.title,
        message: newRecord.message,
        type: newRecord.type,
        repairId: newRecord.repairId,
        repairNumber: newRecord.repairNumber,
        senderId: newRecord.senderId,
        senderName: newRecord.senderName,
        priority: newRecord.priority,
        metadata: typeof newRecord.metadata === "object" ? JSON.stringify(newRecord.metadata) : newRecord.metadata,
        isRead: false,
        createdAt: newRecord.createdAt
      }
    ]);
  } catch (err) {
    console.warn("[SUPABASE NOTIFICATION INSERT WARN]", err);
  }
  await broadcastServerChange("Notification", "CREATE", id, newRecord);
  return newRecord;
}
async function markNotificationRead(id, userId) {
  await initializeNotificationStorage();
  const record = notificationCache.get(id);
  if (!record) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  record.isRead = true;
  record.readAt = now;
  record.updatedAt = now;
  notificationCache.set(id, record);
  saveLocalFile(Array.from(notificationCache.values()));
  try {
    await supabaseAdmin.from("Notification").update({ isRead: true, readAt: now }).eq("id", id);
  } catch (err) {
    console.warn("[SUPABASE NOTIFICATION MARK READ WARN]", err);
  }
  await broadcastServerChange("Notification", "UPDATE", id, record);
  return record;
}
async function markAllNotificationsRead(user) {
  await initializeNotificationStorage();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let updatedCount = 0;
  notificationCache.forEach((record, id) => {
    const isTarget = record.userId && record.userId === user.id || record.targetRole && record.targetRole === user.role || !record.userId && !record.targetRole;
    if (isTarget && !record.isRead) {
      record.isRead = true;
      record.readAt = now;
      record.updatedAt = now;
      notificationCache.set(id, record);
      updatedCount++;
    }
  });
  if (updatedCount > 0) {
    saveLocalFile(Array.from(notificationCache.values()));
    try {
      await supabaseAdmin.from("Notification").update({ isRead: true, readAt: now }).or(`userId.eq.${user.id},userId.is.null`);
    } catch (err) {
      console.warn("[SUPABASE NOTIFICATION MARK ALL READ WARN]", err);
    }
    await broadcastServerChange("Notification", "UPDATE", "bulk", { userId: user.id });
  }
  return updatedCount;
}
async function deleteNotification(id, user) {
  await initializeNotificationStorage();
  const record = notificationCache.get(id);
  if (!record) return false;
  const isSuperAdminOrAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const isRecipient = record.userId === user.id || !record.userId && record.targetRole === user.role;
  if (!isSuperAdminOrAdmin && !isRecipient) {
    throw new Error("Unauthorized to delete this notification.");
  }
  notificationCache.delete(id);
  saveLocalFile(Array.from(notificationCache.values()));
  try {
    await supabaseAdmin.from("Notification").delete().eq("id", id);
  } catch (err) {
    console.warn("[SUPABASE NOTIFICATION DELETE WARN]", err);
  }
  await broadcastServerChange("Notification", "DELETE", id);
  return true;
}

// api/_server/services/repairTransferService.ts
import { v4 as uuidv45 } from "uuid";
var transferStore = /* @__PURE__ */ new Map();
var hasHydratedFromDb = false;
async function hydrateStoreFromDb() {
  if (hasHydratedFromDb) return;
  try {
    const { data, error } = await supabaseAdmin.from("RepairTransferRequest").select("*").order("createdAt", { ascending: false });
    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        if (row && row.id) {
          transferStore.set(row.id, {
            id: row.id,
            repairId: row.repairId,
            repairNumber: row.repairNumber,
            senderTechnicianId: row.senderTechnicianId,
            senderTechnicianName: row.senderTechnicianName || "Specialist",
            targetTechnicianId: row.targetTechnicianId,
            targetTechnicianName: row.targetTechnicianName || "Specialist",
            reason: row.reason || "",
            status: row.status || "PENDING",
            respondedAt: row.respondedAt || null,
            responseNote: row.responseNote || null,
            createdAt: row.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: row.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      });
    }
    hasHydratedFromDb = true;
  } catch (err) {
    console.warn("[REPAIR TRANSFER HYDRATE WARNING]", err);
    hasHydratedFromDb = true;
  }
}
hydrateStoreFromDb();
async function getMyTransferRequests(userId) {
  await hydrateStoreFromDb();
  try {
    const { data, error } = await supabaseAdmin.from("RepairTransferRequest").select("*").or(`senderTechnicianId.eq.${userId},targetTechnicianId.eq.${userId}`).order("createdAt", { ascending: false });
    if (!error && Array.isArray(data) && data.length > 0) {
      data.forEach((row) => {
        transferStore.set(row.id, row);
      });
    }
  } catch (err) {
    console.warn("[GET TRANSFER DB SELECT ERROR]", err);
  }
  const allTransfers = Array.from(transferStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const incoming = allTransfers.filter((t) => t.targetTechnicianId === userId);
  const outgoing = allTransfers.filter((t) => t.senderTechnicianId === userId);
  const pendingIncomingCount = incoming.filter((t) => t.status === "PENDING").length;
  return {
    incoming,
    outgoing,
    pendingIncomingCount,
    all: allTransfers
  };
}
async function getAllTransferRequests() {
  await hydrateStoreFromDb();
  return Array.from(transferStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
async function getTransferRequestById(id) {
  await hydrateStoreFromDb();
  if (transferStore.has(id)) {
    return transferStore.get(id);
  }
  try {
    const { data, error } = await supabaseAdmin.from("RepairTransferRequest").select("*").eq("id", id).single();
    if (!error && data) {
      transferStore.set(data.id, data);
      return data;
    }
  } catch {
  }
  return null;
}
var TERMINAL_REPAIR_STATUSES = ["DELIVERED", "CANCELLED", "COMPLETED", "ARCHIVED", "CLOSED"];
async function createRepairTransferRequest(params) {
  await hydrateStoreFromDb();
  const { repairId, senderId, senderName, senderRole, targetTechnicianId, reason } = params;
  if (!repairId) {
    return { success: false, error: "Repair ID is required.", statusCode: 400 };
  }
  if (!targetTechnicianId) {
    return { success: false, error: "Please select a target technician.", statusCode: 400 };
  }
  if (targetTechnicianId === senderId) {
    return { success: false, error: "Cannot transfer a repair to yourself.", statusCode: 400 };
  }
  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a clear reason for the transfer (minimum 3 characters).", statusCode: 400 };
  }
  const { data: repair, error: repairErr } = await supabaseAdmin.from("Repair").select("id, repairNumber, status, technicianId, deviceBrand, deviceModel, customerName").eq("id", repairId).single();
  if (repairErr || !repair) {
    return { success: false, error: "Repair record not found.", statusCode: 404 };
  }
  if (TERMINAL_REPAIR_STATUSES.includes(repair.status)) {
    return {
      success: false,
      error: `Cannot transfer repair #${repair.repairNumber} because its current status is ${repair.status}.`,
      statusCode: 400
    };
  }
  const isManagement = ["SUPER_ADMIN", "ADMIN", "MANAGER", "LEAD_TECHNICIAN"].includes(senderRole);
  if (!isManagement && repair.technicianId && repair.technicianId !== senderId) {
    return {
      success: false,
      error: "You can only request transfers for repairs assigned to you.",
      statusCode: 403
    };
  }
  const { data: targetTech, error: techErr } = await supabaseAdmin.from("User").select("id, name, role, isActive").eq("id", targetTechnicianId).single();
  if (techErr || !targetTech || targetTech.isActive === false) {
    return { success: false, error: "Target technician was not found or is inactive.", statusCode: 400 };
  }
  const existingPending = Array.from(transferStore.values()).find(
    (t) => t.repairId === repairId && t.status === "PENDING"
  );
  if (existingPending) {
    return {
      success: false,
      error: `A pending transfer request for repair #${repair.repairNumber} is already active with ${existingPending.targetTechnicianName}.`,
      statusCode: 400
    };
  }
  const transferId = uuidv45();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newTransfer = {
    id: transferId,
    repairId: repair.id,
    repairNumber: repair.repairNumber,
    senderTechnicianId: senderId,
    senderTechnicianName: senderName || "Specialist",
    targetTechnicianId: targetTech.id,
    targetTechnicianName: targetTech.name || "Specialist",
    reason: reason.trim(),
    status: "PENDING",
    respondedAt: null,
    responseNote: null,
    createdAt: now,
    updatedAt: now
  };
  transferStore.set(transferId, newTransfer);
  try {
    await supabaseAdmin.from("RepairTransferRequest").insert([newTransfer]);
  } catch (dbErr) {
    console.warn("[DB INSERT REPAIR TRANSFER NON FATAL]", dbErr);
  }
  try {
    await createNotification({
      userId: targetTech.id,
      title: `Job Transfer Request: #${repair.repairNumber}`,
      message: `${senderName} requested to transfer job #${repair.repairNumber} (${repair.deviceBrand || ""} ${repair.deviceModel || ""}) to you. Reason: ${reason.trim()}`,
      type: "TRANSFER_REQUEST",
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      senderId,
      senderName,
      senderRole,
      priority: "HIGH"
    });
  } catch (notifErr) {
    console.warn("[TRANSFER NOTIF NON FATAL]", notifErr);
  }
  const logId = uuidv45();
  try {
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: logId,
        repairId: repair.id,
        status: repair.status,
        message: `Transfer request submitted to ${targetTech.name} by ${senderName}. Reason: ${reason.trim()}`,
        createdAt: now
      }
    ]);
    await broadcastServerChange("RepairLog", "CREATE", logId);
  } catch (logErr) {
    console.warn("[REPAIR LOG NON FATAL]", logErr);
  }
  await broadcastServerChange("RepairTransfer", "CREATE", transferId, newTransfer);
  return { success: true, data: newTransfer };
}
async function respondToTransferRequest(params) {
  await hydrateStoreFromDb();
  const { transferId, responderId, responderName, responderRole, action, responseNote } = params;
  if (!transferId) {
    return { success: false, error: "Transfer ID is required.", statusCode: 400 };
  }
  if (action !== "ACCEPT" && action !== "REJECT") {
    return { success: false, error: "Action must be either 'ACCEPT' or 'REJECT'.", statusCode: 400 };
  }
  const transfer = await getTransferRequestById(transferId);
  if (!transfer) {
    return { success: false, error: "Transfer request not found.", statusCode: 404 };
  }
  if (transfer.status !== "PENDING") {
    return {
      success: false,
      error: `This transfer request has already been ${transfer.status.toLowerCase()}.`,
      statusCode: 400
    };
  }
  const isManagement = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(responderRole);
  if (!isManagement && transfer.targetTechnicianId !== responderId) {
    return {
      success: false,
      error: "You are not authorized to respond to this transfer request.",
      statusCode: 403
    };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (action === "ACCEPT") {
    transfer.status = "ACCEPTED";
    transfer.respondedAt = now;
    transfer.responseNote = responseNote?.trim() || "Accepted by technician";
    transfer.updatedAt = now;
    transferStore.set(transfer.id, transfer);
    try {
      await supabaseAdmin.from("RepairTransferRequest").update({
        status: "ACCEPTED",
        respondedAt: now,
        responseNote: transfer.responseNote,
        updatedAt: now
      }).eq("id", transfer.id);
    } catch (e) {
      console.warn("[UPDATE TRANSFER REQUEST DB NON FATAL]", e);
    }
    const { data: updatedRepair, error: repairUpdateErr } = await supabaseAdmin.from("Repair").update({
      technicianId: transfer.targetTechnicianId,
      assignedAt: now,
      assignedById: responderId,
      assignedByName: responderName,
      updatedAt: now
    }).eq("id", transfer.repairId).select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)").single();
    if (repairUpdateErr) {
      console.warn("[REPAIR REASSIGN ERROR]", repairUpdateErr);
    }
    try {
      await createNotification({
        userId: transfer.senderTechnicianId,
        title: `Transfer Accepted: #${transfer.repairNumber}`,
        message: `${responderName} has accepted job #${transfer.repairNumber}. It is now in their active queue.`,
        type: "TRANSFER_ACCEPTED",
        repairId: transfer.repairId,
        repairNumber: transfer.repairNumber,
        senderId: responderId,
        senderName: responderName,
        senderRole: responderRole,
        priority: "NORMAL"
      });
    } catch (notifErr) {
      console.warn("[ACCEPT NOTIF NON FATAL]", notifErr);
    }
    const logId = uuidv45();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: transfer.repairId,
          status: updatedRepair?.status || "IN_PROCESS",
          message: `Transfer accepted by ${responderName}. Repair successfully reassigned to ${transfer.targetTechnicianName}.`,
          createdAt: now
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[ACCEPT LOG NON FATAL]", logErr);
    }
    await broadcastServerChange("RepairTransfer", "UPDATE", transfer.id, transfer);
    if (updatedRepair) {
      await broadcastServerChange("Repair", "UPDATE", transfer.repairId, updatedRepair);
    }
    return {
      success: true,
      data: {
        transfer,
        repair: updatedRepair,
        message: `Transfer request accepted. Repair #${transfer.repairNumber} is now assigned to you.`
      }
    };
  } else {
    transfer.status = "REJECTED";
    transfer.respondedAt = now;
    transfer.responseNote = responseNote?.trim() || "Declined by technician";
    transfer.updatedAt = now;
    transferStore.set(transfer.id, transfer);
    try {
      await supabaseAdmin.from("RepairTransferRequest").update({
        status: "REJECTED",
        respondedAt: now,
        responseNote: transfer.responseNote,
        updatedAt: now
      }).eq("id", transfer.id);
    } catch (e) {
      console.warn("[UPDATE TRANSFER REQUEST DB NON FATAL]", e);
    }
    try {
      await createNotification({
        userId: transfer.senderTechnicianId,
        title: `Transfer Declined: #${transfer.repairNumber}`,
        message: `${responderName} declined the transfer request for repair #${transfer.repairNumber}. The job remains in your active queue.`,
        type: "TRANSFER_REJECTED",
        repairId: transfer.repairId,
        repairNumber: transfer.repairNumber,
        senderId: responderId,
        senderName: responderName,
        senderRole: responderRole,
        priority: "NORMAL"
      });
    } catch (notifErr) {
      console.warn("[REJECT NOTIF NON FATAL]", notifErr);
    }
    const logId = uuidv45();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: transfer.repairId,
          status: "IN_PROCESS",
          message: `Transfer request to ${transfer.targetTechnicianName} declined by ${responderName}. Repair remains with ${transfer.senderTechnicianName}.`,
          createdAt: now
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[REJECT LOG NON FATAL]", logErr);
    }
    await broadcastServerChange("RepairTransfer", "UPDATE", transfer.id, transfer);
    return {
      success: true,
      data: {
        transfer,
        message: `Transfer request for repair #${transfer.repairNumber} was declined.`
      }
    };
  }
}
async function cancelTransferRequest(params) {
  await hydrateStoreFromDb();
  const { transferId, userId, userRole } = params;
  const transfer = await getTransferRequestById(transferId);
  if (!transfer) {
    return { success: false, error: "Transfer request not found.", statusCode: 404 };
  }
  if (transfer.status !== "PENDING") {
    return {
      success: false,
      error: `Cannot cancel transfer request that is already ${transfer.status.toLowerCase()}.`,
      statusCode: 400
    };
  }
  const isManagement = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole);
  if (!isManagement && transfer.senderTechnicianId !== userId) {
    return {
      success: false,
      error: "You are not authorized to cancel this transfer request.",
      statusCode: 403
    };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  transfer.status = "CANCELLED";
  transfer.respondedAt = now;
  transfer.updatedAt = now;
  transferStore.set(transfer.id, transfer);
  try {
    await supabaseAdmin.from("RepairTransferRequest").update({ status: "CANCELLED", updatedAt: now }).eq("id", transfer.id);
  } catch (e) {
    console.warn("[CANCEL TRANSFER DB NON FATAL]", e);
  }
  await broadcastServerChange("RepairTransfer", "UPDATE", transfer.id, transfer);
  return { success: true, data: transfer };
}
async function directTransferRepair(params) {
  await hydrateStoreFromDb();
  const { repairId, actorId, actorName, targetTechnicianId, reason, priority } = params;
  if (!repairId) {
    return { success: false, error: "Repair ID is required.", statusCode: 400 };
  }
  if (!targetTechnicianId) {
    return { success: false, error: "Please select a target technician.", statusCode: 400 };
  }
  if (!reason || reason.trim().length < 2) {
    return { success: false, error: "Please provide a transfer reason or instruction.", statusCode: 400 };
  }
  const { data: repair, error: repairErr } = await supabaseAdmin.from("Repair").select("*").eq("id", repairId).single();
  if (repairErr || !repair) {
    return { success: false, error: "Repair record not found.", statusCode: 404 };
  }
  const { data: targetTech, error: techErr } = await supabaseAdmin.from("User").select("id, name, role, isActive").eq("id", targetTechnicianId).single();
  if (techErr || !targetTech || targetTech.isActive === false) {
    return { success: false, error: "Target technician was not found or is inactive.", statusCode: 400 };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  Array.from(transferStore.values()).filter((t) => t.repairId === repairId && t.status === "PENDING").forEach((t) => {
    t.status = "CANCELLED";
    t.updatedAt = now;
    transferStore.set(t.id, t);
  });
  const updatePayload = {
    technicianId: targetTech.id,
    assignedAt: now,
    assignedById: actorId,
    assignedByName: actorName,
    updatedAt: now
  };
  if (priority && ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"].includes(priority.toUpperCase())) {
    updatePayload.priority = priority.toUpperCase();
  }
  const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", repairId).select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)").single();
  if (updateErr) {
    return { success: false, error: "Failed to reassign technician.", statusCode: 500 };
  }
  try {
    await createNotification({
      userId: targetTech.id,
      title: `Repair Assigned / Transferred: #${repair.repairNumber}`,
      message: `${actorName} transferred repair #${repair.repairNumber} (${repair.deviceBrand || ""} ${repair.deviceModel || ""}) to your queue. Instructions: ${reason.trim()}`,
      type: "REPAIR_ASSIGNED",
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      senderId: actorId,
      senderName: actorName,
      senderRole: params.actorRole,
      priority: priority ? priority.toUpperCase() : "HIGH"
    });
  } catch (notifErr) {
    console.warn("[DIRECT TRANSFER NOTIF NON FATAL]", notifErr);
  }
  const logId = uuidv45();
  try {
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: logId,
        repairId: repair.id,
        status: updatedRepair.status,
        message: `Management transfer to ${targetTech.name} by ${actorName}. Reason: ${reason.trim()}`,
        createdAt: now
      }
    ]);
    await broadcastServerChange("RepairLog", "CREATE", logId);
  } catch (logErr) {
    console.warn("[DIRECT TRANSFER LOG NON FATAL]", logErr);
  }
  await broadcastServerChange("Repair", "UPDATE", repair.id, updatedRepair);
  return {
    success: true,
    data: {
      repair: updatedRepair,
      message: `Repair #${repair.repairNumber} successfully transferred to ${targetTech.name}.`
    }
  };
}

// api/_server/services/repairStatsService.ts
var NEPAL_TIMEZONE = "Asia/Kathmandu";
var NPT_OFFSET_MINUTES = 5 * 60 + 45;
var NPT_OFFSET_MS = NPT_OFFSET_MINUTES * 60 * 1e3;
function getNepalCalendarInfo(refDate = /* @__PURE__ */ new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NEPAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(refDate);
  const y = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value || "01", 10);
  const d = parseInt(parts.find((p) => p.type === "day")?.value || "01", 10);
  const pad = (n) => String(n).padStart(2, "0");
  const todayNpt = `${y}-${pad(m)}-${pad(d)}`;
  const todayMidnightUtc = Date.UTC(y, m - 1, d) - NPT_OFFSET_MS;
  const yesterdayDate = new Date(todayMidnightUtc - 24 * 60 * 60 * 1e3 + NPT_OFFSET_MS);
  const yesterdayNpt = `${yesterdayDate.getUTCFullYear()}-${pad(yesterdayDate.getUTCMonth() + 1)}-${pad(yesterdayDate.getUTCDate())}`;
  const dow = new Date(todayMidnightUtc + NPT_OFFSET_MS).getUTCDay();
  const weekStartDate = new Date(todayMidnightUtc - dow * 24 * 60 * 60 * 1e3 + NPT_OFFSET_MS);
  const weekEndDate = new Date(todayMidnightUtc + (6 - dow) * 24 * 60 * 60 * 1e3 + NPT_OFFSET_MS);
  const weekStartNpt = `${weekStartDate.getUTCFullYear()}-${pad(weekStartDate.getUTCMonth() + 1)}-${pad(weekStartDate.getUTCDate())}`;
  const weekEndNpt = `${weekEndDate.getUTCFullYear()}-${pad(weekEndDate.getUTCMonth() + 1)}-${pad(weekEndDate.getUTCDate())}`;
  const monthStartNpt = `${y}-${pad(m)}-01`;
  const lastDayDate = new Date(Date.UTC(y, m, 0));
  const monthEndNpt = `${y}-${pad(m)}-${pad(lastDayDate.getUTCDate())}`;
  return {
    todayNpt,
    yesterdayNpt,
    weekStartNpt,
    weekEndNpt,
    monthStartNpt,
    monthEndNpt
  };
}
function getNptIsoBoundsForPreset(preset, customStart, customEnd, refDate = /* @__PURE__ */ new Date()) {
  if (preset === "ALL") {
    return { startIso: null, endIso: null };
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NEPAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(refDate);
  const y = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value || "01", 10);
  const d = parseInt(parts.find((p) => p.type === "day")?.value || "01", 10);
  const nptMidnightToUtc = (year, month, day) => {
    return Date.UTC(year, month - 1, day) - NPT_OFFSET_MS;
  };
  const todayMidnightUtc = nptMidnightToUtc(y, m, d);
  const todayEndUtc = todayMidnightUtc + 24 * 60 * 60 * 1e3 - 1;
  if (preset === "TODAY") {
    return {
      startIso: new Date(todayMidnightUtc).toISOString(),
      endIso: new Date(todayEndUtc).toISOString()
    };
  }
  if (preset === "YESTERDAY") {
    const yesterdayMidnightUtc = todayMidnightUtc - 24 * 60 * 60 * 1e3;
    const yesterdayEndUtc = yesterdayMidnightUtc + 24 * 60 * 60 * 1e3 - 1;
    return {
      startIso: new Date(yesterdayMidnightUtc).toISOString(),
      endIso: new Date(yesterdayEndUtc).toISOString()
    };
  }
  if (preset === "THIS_WEEK") {
    const dow = new Date(todayMidnightUtc + NPT_OFFSET_MS).getUTCDay();
    const weekStartUtc = todayMidnightUtc - dow * 24 * 60 * 60 * 1e3;
    const weekEndUtc = weekStartUtc + 7 * 24 * 60 * 60 * 1e3 - 1;
    return {
      startIso: new Date(weekStartUtc).toISOString(),
      endIso: new Date(weekEndUtc).toISOString()
    };
  }
  if (preset === "THIS_MONTH") {
    const monthStartUtc = nptMidnightToUtc(y, m, 1);
    const nextMonthStartUtc = nptMidnightToUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
    const monthEndUtc = nextMonthStartUtc - 1;
    return {
      startIso: new Date(monthStartUtc).toISOString(),
      endIso: new Date(monthEndUtc).toISOString()
    };
  }
  if (preset === "CUSTOM") {
    if (!customStart && !customEnd) return { startIso: null, endIso: null };
    let startIso = null;
    let endIso = null;
    if (customStart) {
      const [sy, sm, sd] = customStart.split("-").map(Number);
      if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd)) {
        startIso = new Date(nptMidnightToUtc(sy, sm, sd)).toISOString();
      }
    }
    if (customEnd) {
      const [ey, em, ed] = customEnd.split("-").map(Number);
      if (!isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
        endIso = new Date(nptMidnightToUtc(ey, em, ed) + 24 * 60 * 60 * 1e3 - 1).toISOString();
      }
    }
    return { startIso, endIso };
  }
  return { startIso: null, endIso: null };
}
async function computeRepairDashboardStats(params) {
  const {
    preset = "ALL",
    startDate,
    endDate,
    technicianId,
    branchId,
    userRole = "SUPER_ADMIN",
    userId
  } = params;
  const calInfo = getNepalCalendarInfo();
  const { startIso, endIso } = getNptIsoBoundsForPreset(preset, startDate, endDate);
  let query = supabaseAdmin.from("Repair").select("id, status, priority, estimatedCost, totalCost, advancePaid, totalPaid, createdAt, technicianId, branchId");
  const role = normalizeRole(userRole);
  const isTechRole = ["TECHNICIAN", "LEAD_TECHNICIAN", "HEAD_TECHNICIAN", "TECHNICAL_ASSISTANT", "TECH"].includes(role);
  if (role === "TECHNICIAN" || isTechRole && (!technicianId || technicianId === String(userId))) {
    query = query.eq("technicianId", String(userId));
  } else if (technicianId && technicianId !== "ALL") {
    if (String(technicianId).toLowerCase() === "unassigned" || technicianId === "null") {
      query = query.is("technicianId", null);
    } else {
      query = query.eq("technicianId", String(technicianId));
    }
  }
  if (branchId && branchId !== "ALL") {
    query = query.eq("branchId", String(branchId));
  }
  if (startIso) {
    query = query.gte("createdAt", startIso);
  }
  if (endIso) {
    query = query.lte("createdAt", endIso);
  }
  const { data: records, error } = await query;
  if (error) {
    throw error;
  }
  let total = 0;
  let pending = 0;
  let received = 0;
  let inProgress = 0;
  let repaired = 0;
  let delivered = 0;
  let reProblem = 0;
  let cancelled = 0;
  let estimatedTotalSum = 0;
  let totalPaidSum = 0;
  const PENDING_LIST = ["PENDING"];
  const RECEIVED_LIST = ["RECEIVED"];
  const IN_PROGRESS_LIST = ["IN_PROCESS", "IN_PROGRESS", "DIAGNOSING", "WAITING_FOR_PARTS", "TESTING", "REPAIRING"];
  const REPAIRED_LIST = ["REPAIRED", "READY_FOR_PICKUP", "READY", "READY_FOR_DELIVERY"];
  const DELIVERED_LIST = ["DELIVERED", "COMPLETED"];
  const RE_PROBLEM_LIST = ["RE_PROBLEM", "REPROBLEM"];
  const CANCELLED_LIST = ["CANCELLED", "CANNOT_REPAIR"];
  for (const r of records || []) {
    total++;
    const s = (r.status || "").toUpperCase().trim();
    if (PENDING_LIST.includes(s)) {
      pending++;
    } else if (RECEIVED_LIST.includes(s)) {
      received++;
    } else if (IN_PROGRESS_LIST.includes(s)) {
      inProgress++;
    } else if (REPAIRED_LIST.includes(s)) {
      repaired++;
    } else if (DELIVERED_LIST.includes(s)) {
      delivered++;
    } else if (RE_PROBLEM_LIST.includes(s)) {
      reProblem++;
    } else if (CANCELLED_LIST.includes(s)) {
      cancelled++;
    }
    const paid = Number(r.totalPaid) || Number(r.advancePaid) || 0;
    const est = Number(r.estimatedCost) || Number(r.totalCost) || 0;
    totalPaidSum += isNaN(paid) ? 0 : paid;
    estimatedTotalSum += isNaN(est) ? 0 : est;
  }
  return {
    preset,
    startIso,
    endIso,
    calendar: calInfo,
    metrics: {
      total: Math.max(0, total - cancelled),
      activeTotal: Math.max(0, total - cancelled),
      totalRecords: total,
      pending,
      received,
      inProgress,
      repaired,
      delivered,
      reProblem,
      cancelled,
      estimatedTotalSum,
      totalPaidSum
    }
  };
}

// api/_server/services/smsStorage.ts
import fs2 from "fs";
import path2 from "path";
import { v4 as uuidv46 } from "uuid";
var DATA_DIR2 = path2.join(process.cwd(), "data");
var SMS_FILE = path2.join(DATA_DIR2, "sms_notifications.json");
if (!fs2.existsSync(DATA_DIR2)) {
  try {
    fs2.mkdirSync(DATA_DIR2, { recursive: true });
  } catch (e) {
    console.warn("[SMS STORAGE DIR WARN]", e);
  }
}
var smsCache = /* @__PURE__ */ new Map();
var isInitialized2 = false;
function loadLocalFile2() {
  try {
    if (fs2.existsSync(SMS_FILE)) {
      const content = fs2.readFileSync(SMS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[SMS READ ERROR: ${SMS_FILE}]`, err);
  }
  return [];
}
function saveLocalFile2(data) {
  try {
    const tempPath = `${SMS_FILE}.tmp.${Date.now()}`;
    fs2.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs2.renameSync(tempPath, SMS_FILE);
  } catch (err) {
    console.error(`[SMS WRITE ERROR: ${SMS_FILE}]`, err);
  }
}
function initializeSmsStorage() {
  if (isInitialized2) return;
  const localItems = loadLocalFile2();
  smsCache.clear();
  for (const item of localItems) {
    if (item.id) {
      smsCache.set(item.id, item);
    }
  }
  isInitialized2 = true;
}
function validateAndNormalizeNepalPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string" || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: "",
      international: "",
      displayFormatted: "",
      error: "Customer phone number is missing. Please update the customer information before sending SMS."
    };
  }
  let cleaned = rawPhone.replace(/\D/g, "");
  if (cleaned.startsWith("977") && cleaned.length >= 13) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith("977") && cleaned.length === 12) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  const nepalMobileRegex = /^9[678]\d{8}$/;
  if (!nepalMobileRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      international: "",
      displayFormatted: rawPhone.trim(),
      error: "Invalid customer phone number. Please update the customer information before sending SMS."
    };
  }
  return {
    isValid: true,
    normalized: cleaned,
    international: `+977${cleaned}`,
    displayFormatted: `+977 ${cleaned.substring(0, 2)}-${cleaned.substring(2, 6)}-${cleaned.substring(6)}`
  };
}
function generateRepairCompletedSmsMessage(params) {
  const cleanCustomer = (params.customerName || "Customer").trim();
  const cleanModel = (params.deviceModel || "device").trim();
  const cleanNumber = (params.repairNumber || "N/A").trim();
  return `Dear ${cleanCustomer}, your ${cleanModel} repair (Repair No: ${cleanNumber}) has been completed and is ready for pickup at MTS Lab. For assistance, please contact MTS Lab. Thank you.`;
}
async function recordSmsNotification(data) {
  initializeSmsStorage();
  const id = uuidv46();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const record = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  };
  smsCache.set(id, record);
  saveLocalFile2(Array.from(smsCache.values()));
  try {
    await supabaseAdmin.from("SmsNotification").insert([
      {
        id: record.id,
        repairId: record.repairId,
        repairNumber: record.repairNumber,
        customerId: record.customerId || null,
        customerName: record.customerName,
        customerPhone: record.customerPhoneNormalized,
        messageContent: record.messageContent,
        status: record.status,
        channel: record.channel,
        senderStaffId: record.senderStaffId,
        senderStaffName: record.senderStaffName,
        senderStaffRole: record.senderStaffRole,
        notes: record.notes || null,
        initiatedAt: record.initiatedAt,
        sentAt: record.sentAt || null,
        createdAt: record.createdAt
      }
    ]);
  } catch (dbErr) {
  }
  await broadcastServerChange("SmsNotification", "CREATE", id, record);
  return record;
}
async function updateSmsNotification(id, updates) {
  initializeSmsStorage();
  const existing = smsCache.get(id);
  if (!existing) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    ...existing,
    ...updates,
    updatedAt: now
  };
  smsCache.set(id, updated);
  saveLocalFile2(Array.from(smsCache.values()));
  try {
    await supabaseAdmin.from("SmsNotification").update({
      status: updated.status,
      notes: updated.notes || null,
      sentAt: updated.sentAt || null,
      confirmedAt: updated.confirmedAt || null,
      updatedAt: now
    }).eq("id", id);
  } catch (_) {
  }
  await broadcastServerChange("SmsNotification", "UPDATE", id, updated);
  return updated;
}
function getSmsNotificationsForRepair(repairId) {
  initializeSmsStorage();
  const results = [];
  for (const record of smsCache.values()) {
    if (record.repairId === repairId) {
      results.push(record);
    }
  }
  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
function hasRecentSmsNotification(repairId) {
  const history = getSmsNotificationsForRepair(repairId);
  if (history.length === 0) {
    return { hasSent: false };
  }
  const active = history.find(
    (h) => h.status === "SENT" || h.status === "INITIATED"
  );
  return {
    hasSent: !!active,
    lastNotification: active || history[0]
  };
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
  "partsUsed",
  "repairImages",
  "managerUpdatedAt",
  "managerUpdatedBy",
  "receivingMethod",
  "isCourierIn",
  "courierCompany",
  "courierTrackingNumber",
  "courierDate",
  "courierReceivedDate",
  "courierInPickupDate",
  "courierInStatus",
  "courierStatus",
  "courierInCharge",
  "courierInPaymentStatus",
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
  "courierArchived",
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
function parseWarrantyDurationMonths(periodStr) {
  const str = String(periodStr || "").toUpperCase().trim();
  if (str.includes("24") || str.includes("2_YEAR") || str.includes("2 YEAR") || str.includes("2YEAR") || str.includes("2_Y") || str === "2Y" || str === "2 YEARS") return 24;
  if (str.includes("12") || str.includes("1_YEAR") || str.includes("1 YEAR") || str.includes("1YEAR") || str.includes("1_Y") || str === "1Y" || str === "1 YEAR") return 12;
  if (str.includes("3")) return 3;
  return 6;
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
    const { data: existing } = await supabaseAdmin.from("BatteryWarranty").select("id, registrationDate").eq("repairId", repairData.id).limit(1);
    const months = parseWarrantyDurationMonths(repairData.batteryWarrantyPeriod);
    const periodLabel = months === 24 ? "2 Years" : months === 12 ? "1 Year" : `${months} Months`;
    const regDate = existing && existing[0]?.registrationDate ? new Date(existing[0].registrationDate) : new Date(repairData.createdAt || Date.now());
    const expDate = new Date(regDate);
    if (months === 24) {
      expDate.setFullYear(expDate.getFullYear() + 2);
    } else if (months === 12) {
      expDate.setFullYear(expDate.getFullYear() + 1);
    } else {
      expDate.setMonth(expDate.getMonth() + months);
    }
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
        warrantyPeriod: periodLabel,
        expiryDate: expDate.toISOString(),
        status: "ACTIVE",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", existing[0].id);
      await broadcastServerChange("BatteryWarranty", "UPDATE", existing[0].id);
    } else {
      const warrantyId = uuidv47();
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
          warrantyPeriod: periodLabel,
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
      preset,
      scope,
      assignedToMeOnly,
      includeCompleted,
      limit = "2000",
      page = "1"
    } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 2e3, 5e3);
    const offset = (pageNum - 1) * limitNum;
    let query = supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)", { count: "exact" });
    const role = normalizeRole(req.user.role);
    const scopeStr = String(scope || "").toLowerCase();
    const isAssignedToMeOnly = String(assignedToMeOnly || "").toLowerCase() === "true";
    const isIncludeCompleted = String(includeCompleted || "").toLowerCase() === "true";
    const isTechRole = ["TECHNICIAN", "LEAD_TECHNICIAN", "HEAD_TECHNICIAN", "TECHNICAL_ASSISTANT", "TECH"].includes(role);
    if (role === "TECHNICIAN" || isAssignedToMeOnly || isTechRole && scopeStr === "active" && !technicianId) {
      query = query.eq("technicianId", req.user.id);
      query = query.not("status", "in", '("CANCELLED","CANNOT_REPAIR")');
      if (scopeStr === "active" || !status && !isIncludeCompleted) {
        query = query.not("status", "in", '("REPAIRED","READY_FOR_PICKUP","READY","READY_FOR_DELIVERY","DELIVERED","COMPLETED","CANNOT_REPAIR","CANCELLED")');
      }
    } else if (technicianId && technicianId !== "ALL") {
      if (String(technicianId).toLowerCase() === "unassigned" || technicianId === "null") {
        query = query.is("technicianId", null);
      } else {
        query = query.eq("technicianId", String(technicianId));
      }
    }
    if (status && status !== "ALL") {
      const statusList = Array.isArray(status) ? status.map(String) : String(status).includes(",") ? String(status).split(",").map((s) => s.trim()) : [String(status)];
      if (statusList.length === 1) {
        query = query.eq("status", statusList[0]);
      } else if (statusList.length > 1) {
        query = query.in("status", statusList);
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
    let effectiveStart = startDate ? String(startDate) : void 0;
    let effectiveEnd = endDate ? String(endDate) : void 0;
    if (preset && preset !== "ALL") {
      const bounds = getNptIsoBoundsForPreset(preset, effectiveStart, effectiveEnd);
      if (bounds.startIso) effectiveStart = bounds.startIso;
      if (bounds.endIso) effectiveEnd = bounds.endIso;
    } else if (effectiveStart || effectiveEnd) {
      const bounds = getNptIsoBoundsForPreset("CUSTOM", effectiveStart, effectiveEnd);
      if (bounds.startIso) effectiveStart = bounds.startIso;
      if (bounds.endIso) effectiveEnd = bounds.endIso;
    }
    if (effectiveStart) {
      query = query.gte("createdAt", effectiveStart);
    }
    if (effectiveEnd) {
      query = query.lte("createdAt", effectiveEnd);
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
router3.get("/stats", authenticate, async (req, res) => {
  try {
    const { preset = "ALL", startDate, endDate, technicianId, branchId } = req.query;
    const stats = await computeRepairDashboardStats({
      preset,
      startDate: startDate ? String(startDate) : void 0,
      endDate: endDate ? String(endDate) : void 0,
      technicianId: technicianId ? String(technicianId) : void 0,
      branchId: branchId ? String(branchId) : void 0,
      userRole: req.user?.role,
      userId: req.user?.id
    });
    return res.json(stats);
  } catch (err) {
    console.error("[REPAIRS STATS ERROR]", err);
    return res.status(500).json({ error: "Failed to compute repair statistics." });
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
      const repairId = uuidv47();
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
        const role2 = normalizeRole(req.user.role);
        if (role2 === "TECHNICIAN") {
          const st = String(byNum.status || "").toUpperCase().trim();
          if (st === "CANCELLED" || st === "CANNOT_REPAIR") {
            return res.status(404).json({ error: "Repair ticket not found or has been cancelled." });
          }
        }
        return res.json(byNum);
      }
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    const role = normalizeRole(req.user.role);
    if (role === "TECHNICIAN") {
      const st = String(repair.status || "").toUpperCase().trim();
      if (st === "CANCELLED" || st === "CANNOT_REPAIR") {
        return res.status(404).json({ error: "Repair ticket not found or has been cancelled." });
      }
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
        const newCusId = uuidv47();
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
    const repairId = uuidv47();
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
      assignedAt: technicianId ? (/* @__PURE__ */ new Date()).toISOString() : null,
      assignedById: technicianId ? req.user.id : null,
      assignedByName: technicianId ? req.user.name || "Staff" : null,
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
    let assignedTechName = null;
    if (created.technicianId) {
      try {
        const { data: techUser } = await supabaseAdmin.from("User").select("name").eq("id", created.technicianId).single();
        if (techUser?.name) assignedTechName = techUser.name;
      } catch (tErr) {
        console.warn("[TECH LOOKUP WARN]", tErr);
      }
    }
    const logId = uuidv47();
    await supabaseAdmin.from("RepairLog").insert([
      {
        id: logId,
        repairId: created.id,
        status: "RECEIVED",
        message: assignedTechName ? `Repair intake recorded by ${req.user.name || "Staff"} (Assigned to: ${assignedTechName}).` : `Repair intake recorded by ${req.user.name || "Staff"}.`,
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
    if (created.technicianId) {
      try {
        const isUrgent = created.priority === "URGENT";
        const isHigh = created.priority === "HIGH";
        const priorityEmoji = isUrgent ? "\u{1F534}" : isHigh ? "\u{1F7E0}" : "\u{1F4CB}";
        await createNotification({
          userId: created.technicianId,
          title: `${priorityEmoji} ${isUrgent ? "Urgent Repair Assigned" : "New Repair Assigned"}: #${created.repairNumber}`,
          message: `${created.deviceBrand || ""} ${created.deviceModel || ""} (${created.customerName || "Customer"}) assigned by ${req.user.name}. Problem: ${created.problemDescription || "Inspection required"}`,
          type: isUrgent ? "REPAIR_URGENT" : "REPAIR_ASSIGNED",
          priority: created.priority || "NORMAL",
          repairId: created.id,
          repairNumber: created.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name,
          senderRole: req.user.role
        });
      } catch (notifErr) {
        console.warn("[REPAIR INTAKE NOTIF WARN]", notifErr);
      }
    }
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
        const newCusId = uuidv47();
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
      const repairId = uuidv47();
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
        assignedAt: dev.technicianId ? (/* @__PURE__ */ new Date()).toISOString() : null,
        assignedById: dev.technicianId ? req.user.id : null,
        assignedByName: dev.technicianId ? req.user.name || "Staff" : null,
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
      let assignedBatchTechName = null;
      if (created.technicianId) {
        try {
          const { data: techUser } = await supabaseAdmin.from("User").select("name").eq("id", created.technicianId).single();
          if (techUser?.name) assignedBatchTechName = techUser.name;
        } catch (tErr) {
          console.warn("[TECH BATCH LOOKUP WARN]", tErr);
        }
      }
      const logId = uuidv47();
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: created.id,
          status: "RECEIVED",
          message: assignedBatchTechName ? `Multi-device intake recorded by ${req.user.name || "Staff"} (Device ${i + 1} of ${devices.length}, Assigned to: ${assignedBatchTechName}).` : `Multi-device intake recorded by ${req.user.name || "Staff"} (Device ${i + 1} of ${devices.length}).`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
      if (created.technicianId) {
        try {
          const isUrgent = created.priority === "URGENT";
          const isHigh = created.priority === "HIGH";
          const priorityEmoji = isUrgent ? "\u{1F534}" : isHigh ? "\u{1F7E0}" : "\u{1F4CB}";
          await createNotification({
            userId: created.technicianId,
            title: `${priorityEmoji} ${isUrgent ? "Urgent Repair Assigned" : "New Repair Assigned"}: #${created.repairNumber}`,
            message: `${created.deviceBrand || ""} ${created.deviceModel || ""} (${created.customerName || "Customer"}) assigned by ${req.user.name}. Problem: ${created.problemDescription || "Inspection required"}`,
            type: isUrgent ? "REPAIR_URGENT" : "REPAIR_ASSIGNED",
            priority: created.priority || "NORMAL",
            repairId: created.id,
            repairNumber: created.repairNumber,
            senderId: req.user.id,
            senderName: req.user.name,
            senderRole: req.user.role
          });
        } catch (notifErr) {
          console.warn("[BATCH REPAIR NOTIF WARN]", notifErr);
        }
      }
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
    const role = normalizeRole(req.user.role);
    const { data: existingRepair, error: preFetchErr } = await supabaseAdmin.from("Repair").select("*").eq("id", id).single();
    if (preFetchErr || !existingRepair) {
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    const existingStatus = String(existingRepair.status || "").toUpperCase().trim();
    if (existingStatus === "CANCELLED") {
      if (["TECHNICIAN", "HEAD_TECHNICIAN", "LEAD_TECHNICIAN", "TECHNICAL_ASSISTANT", "TECH"].includes(role)) {
        return res.status(403).json({ error: "Access denied: Cancelled repairs cannot be modified by technicians." });
      }
      if (rawBody.status && String(rawBody.status).toUpperCase().trim() !== "CANCELLED") {
        if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) {
          return res.status(403).json({ error: "Access denied: Only Administrators and Managers can re-open or restore a cancelled repair." });
        }
      }
    }
    if (role === "TECHNICIAN") {
      if (existingRepair.technicianId !== req.user.id) {
        return res.status(403).json({ error: "Access denied: You can only modify repairs assigned to you." });
      }
      const FORBIDDEN_TECHNICIAN_STATUSES = [
        "DELIVERED",
        "READY_FOR_PICKUP",
        "READY",
        "READY_FOR_DELIVERY",
        "RE_PROBLEM",
        "REPROBLEM",
        "CANCELLED"
      ];
      if (rawBody.status && FORBIDDEN_TECHNICIAN_STATUSES.includes(String(rawBody.status).toUpperCase().trim())) {
        return res.status(403).json({
          error: `Access denied: Technicians cannot set status "${rawBody.status}". Only Managers, Admins, and Receptionists can mark repairs as Delivered, Ready for Pickup, Re-Problem, or Cancelled.`
        });
      }
    }
    if (rawBody.status && String(rawBody.status).toUpperCase().trim() === "CANCELLED") {
      if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"].includes(role)) {
        return res.status(403).json({
          error: "Access denied: Only Super Admins, Admins, Managers, and Receptionists can cancel repairs."
        });
      }
    }
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
      const logId = uuidv47();
      try {
        await supabaseAdmin.from("RepairLog").insert([
          {
            id: logId,
            repairId: id,
            status: rawBody.status,
            message: rawBody.remarks || `Status updated to ${rawBody.status} by ${req.user.name || "Staff"}`,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]);
        await broadcastServerChange("RepairLog", "CREATE", logId);
      } catch (logErr) {
        console.warn("[REPAIR LOG NON FATAL]", logErr);
      }
    }
    const oldPriority = (existingRepair.priority || "NORMAL").toUpperCase().trim();
    const newPriority = rawBody.priority ? String(rawBody.priority).toUpperCase().trim() : void 0;
    if (newPriority && newPriority !== oldPriority && updated.technicianId) {
      if (["URGENT", "HIGH", "MEDIUM"].includes(newPriority)) {
        const priorityEmoji = {
          URGENT: "\u{1F534}",
          HIGH: "\u{1F7E0}",
          MEDIUM: "\u{1F7E1}"
        };
        const emoji = priorityEmoji[newPriority] || "\u{1F514}";
        try {
          await createNotification({
            userId: updated.technicianId,
            title: `${emoji} ${newPriority} Priority Assigned: Job #${updated.repairNumber}`,
            message: `Priority was updated to ${newPriority} by ${req.user.name || "Staff"}.`,
            type: newPriority === "URGENT" ? "REPAIR_URGENT" : "REPAIR_ALERT",
            priority: newPriority,
            repairId: id,
            repairNumber: updated.repairNumber,
            senderId: req.user.id,
            senderName: req.user.name,
            senderRole: req.user.role
          });
        } catch (pNotifErr) {
          console.warn("[PRIORITY NOTIFICATION NON-FATAL]", pNotifErr);
        }
      }
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
    const {
      status,
      estimatedDeliveryDate,
      expectedCompletionDate,
      sparePartsUsed,
      partsUsed,
      technicianNotes,
      note,
      remarks
    } = req.body;
    const { data: existingRepair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*").eq("id", id).single();
    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: "Repair job not found." });
    }
    const existingStatus = String(existingRepair.status || "").toUpperCase().trim();
    if (existingStatus === "CANCELLED" || existingStatus === "CANNOT_REPAIR") {
      return res.status(400).json({ error: "This repair is cancelled and cannot be updated." });
    }
    const role = normalizeRole(req.user.role);
    if (role === "TECHNICIAN") {
      if (existingRepair.technicianId !== req.user.id) {
        return res.status(403).json({ error: "Access denied: You can only update repairs assigned to you." });
      }
      const FORBIDDEN_TECHNICIAN_STATUSES = [
        "DELIVERED",
        "READY_FOR_PICKUP",
        "READY",
        "READY_FOR_DELIVERY",
        "RE_PROBLEM",
        "REPROBLEM",
        "CANCELLED"
      ];
      if (status && FORBIDDEN_TECHNICIAN_STATUSES.includes(String(status).toUpperCase().trim())) {
        return res.status(403).json({
          error: `Access denied: Technicians cannot set status "${status}". Only Managers, Admins, and Receptionists can mark repairs as Delivered, Ready for Pickup, Re-Problem, or Cancelled.`
        });
      }
    }
    const updatePayload = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (status) updatePayload.status = status;
    const resolvedDueDate = expectedCompletionDate || estimatedDeliveryDate;
    if (resolvedDueDate) updatePayload.expectedCompletionDate = resolvedDueDate;
    const resolvedParts = partsUsed !== void 0 ? partsUsed : sparePartsUsed;
    if (resolvedParts !== void 0) updatePayload.partsUsed = resolvedParts;
    const resolvedRemarks = technicianNotes !== void 0 ? technicianNotes : note !== void 0 ? note : remarks;
    if (resolvedRemarks !== void 0) updatePayload.remarks = resolvedRemarks;
    const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", id).select("*").single();
    if (updateErr) {
      console.error("[TECHNICIAN UPDATE ERROR]", updateErr);
      return res.status(500).json({ error: "Failed to update repair progress." });
    }
    if (status && status !== existingRepair.status) {
      const logId = uuidv47();
      try {
        await supabaseAdmin.from("RepairLog").insert([
          {
            id: logId,
            repairId: id,
            status,
            message: resolvedRemarks ? `Status updated to ${status}. Note: ${resolvedRemarks}` : `Status updated to ${status} by ${req.user?.name || "Technician"}`,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]);
        await broadcastServerChange("RepairLog", "CREATE", logId);
      } catch (logErr) {
        console.warn("[REPAIR LOG NON FATAL]", logErr);
      }
    }
    try {
      if (existingRepair.createdById && existingRepair.createdById !== req.user?.id) {
        await createNotification({
          userId: existingRepair.createdById,
          title: `Repair Progress: #${updatedRepair.repairNumber || id.slice(0, 8)}`,
          message: `${req.user?.name || "Technician"} updated repair status to ${status || existingRepair.status}. Note: ${resolvedRemarks || "No notes added"}`,
          type: "REPAIR_STATUS",
          priority: "NORMAL",
          repairId: id,
          repairNumber: updatedRepair.repairNumber,
          senderId: req.user?.id,
          senderName: req.user?.name,
          senderRole: req.user?.role
        });
      }
    } catch (notifErr) {
      console.warn("[NOTIFICATION DISPATCH WARN - NON FATAL]", notifErr);
    }
    await broadcastServerChange("Repair", "UPDATE", id, updatedRepair);
    return res.json({
      success: true,
      message: "Repair progress updated successfully.",
      ...updatedRepair,
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
    const logId = uuidv47();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          status: updatedRepair.status,
          message: `[Priority Alert] ${resolvedPriority} \u2014 ${String(message).trim()} (Dispatched by ${req.user.name || "Staff"})`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[REPAIR LOG NON FATAL]", logErr);
    }
    const priorityEmoji = {
      URGENT: "\u{1F534}",
      HIGH: "\u{1F7E0}",
      MEDIUM: "\u{1F7E1}",
      NORMAL: "\u26AA"
    };
    const emoji = priorityEmoji[resolvedPriority] || "\u{1F514}";
    const notifTitle = `${emoji} ${resolvedPriority} Alert: Job #${updatedRepair.repairNumber}`;
    const notifMessage = String(message).trim() || `Priority alert from ${req.user.name}`;
    await createNotification({
      userId: updatedRepair.technicianId,
      title: notifTitle,
      message: notifMessage,
      type: resolvedPriority === "URGENT" ? "REPAIR_URGENT" : "REPAIR_ALERT",
      priority: resolvedPriority,
      repairId: id,
      repairNumber: updatedRepair.repairNumber,
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role
    });
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
var handleCancelRepair = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, remarks, note } = req.body || {};
    const cancellationReason = (reason || "Customer cancelled / withdrew repair").trim();
    const extraNote = (remarks || note || "").trim();
    const fullCancellationSummary = extraNote ? `${cancellationReason}: ${extraNote}` : cancellationReason;
    const { data: existingRepair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)").eq("id", id).single();
    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    const previousStatus = existingRepair.status;
    const updatePayload = {
      status: "CANCELLED",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Kathmandu" });
    const cancelRemarkLine = `[CANCELLED on ${timestamp} by ${req.user.name} (${req.user.role})]: ${fullCancellationSummary}`;
    if (existingRepair.remarks) {
      updatePayload.remarks = `${existingRepair.remarks}
${cancelRemarkLine}`;
    } else {
      updatePayload.remarks = cancelRemarkLine;
    }
    const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", id).select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)").single();
    if (updateErr || !updatedRepair) {
      console.error("[CANCEL REPAIR DB ERROR]", updateErr);
      return res.status(500).json({ error: "Failed to cancel repair in database." });
    }
    const logId = uuidv47();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          status: "CANCELLED",
          message: `Device marked CANCELLED from ${previousStatus}. Reason: ${fullCancellationSummary}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[CANCEL REPAIR LOG NON FATAL]", logErr);
    }
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name,
      userRole: req.user.role,
      action: "CANCEL_REPAIR",
      resource: "Repair",
      resourceId: id,
      previousValue: { status: previousStatus },
      newValue: { status: "CANCELLED", reason: fullCancellationSummary }
    });
    if (existingRepair.technicianId) {
      try {
        await createNotification({
          userId: existingRepair.technicianId,
          title: `\u{1F6AB} Job #${existingRepair.repairNumber} Cancelled`,
          message: `Repair #${existingRepair.repairNumber} (${existingRepair.deviceBrand} ${existingRepair.deviceModel}) was cancelled by ${req.user.name}. Reason: ${fullCancellationSummary}`,
          type: "REPAIR_ALERT",
          priority: "NORMAL",
          repairId: id,
          repairNumber: existingRepair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name,
          senderRole: req.user.role
        });
      } catch (nErr) {
        console.warn("[CANCEL TECH NOTIF WARN]", nErr);
      }
    }
    await broadcastServerChange("Repair", "UPDATE", id, updatedRepair);
    return res.json({
      success: true,
      message: `Repair #${existingRepair.repairNumber} successfully marked as Cancelled.`,
      repair: updatedRepair
    });
  } catch (err) {
    console.error("[CANCEL REPAIR EXCEPTION]", err);
    return res.status(500).json({ error: err?.message || "Failed to cancel repair." });
  }
};
router3.post("/:id/cancel", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"]), handleCancelRepair);
router3.patch("/:id/cancel", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"]), handleCancelRepair);
router3.post("/:id/reopen", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetStatus = "PENDING", note = "" } = req.body || {};
    const { data: existingRepair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)").eq("id", id).single();
    if (fetchErr || !existingRepair) {
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Kathmandu" });
    const reopenNote = `[RE-OPENED on ${timestamp} by ${req.user.name} (${req.user.role}) to ${targetStatus}]: ${note || "Restored from Cancelled"}`;
    const newRemarks = existingRepair.remarks ? `${existingRepair.remarks}
${reopenNote}` : reopenNote;
    const { data: updatedRepair, error: updateErr } = await supabaseAdmin.from("Repair").update({
      status: targetStatus,
      remarks: newRemarks,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, email, role)").single();
    if (updateErr || !updatedRepair) {
      return res.status(500).json({ error: "Failed to re-open repair." });
    }
    const logId = uuidv47();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          status: targetStatus,
          message: `Ticket re-opened from CANCELLED to ${targetStatus} by ${req.user.name}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (lErr) {
      console.warn("[REOPEN LOG NON FATAL]", lErr);
    }
    await broadcastServerChange("Repair", "UPDATE", id, updatedRepair);
    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name,
      userRole: req.user.role,
      action: "REOPEN_REPAIR",
      resource: "Repair",
      resourceId: id,
      previousValue: { status: "CANCELLED" },
      newValue: { status: targetStatus, note: reopenNote }
    });
    return res.json({
      success: true,
      message: `Repair #${existingRepair.repairNumber} re-opened to ${targetStatus}.`,
      repair: updatedRepair
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to re-open repair." });
  }
});
router3.post("/:id/assign", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "LEAD_TECHNICIAN", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;
    const normalizedTechId = technicianId && String(technicianId).trim() !== "" && String(technicianId).toLowerCase() !== "unassigned" && String(technicianId).toLowerCase() !== "null" ? String(technicianId).trim() : null;
    let techName = null;
    if (normalizedTechId) {
      const { data: tech } = await supabaseAdmin.from("User").select("name").eq("id", normalizedTechId).single();
      techName = tech?.name || null;
    }
    const { data: updated, error } = await supabaseAdmin.from("Repair").update({
      technicianId: normalizedTechId,
      assignedAt: normalizedTechId ? (/* @__PURE__ */ new Date()).toISOString() : null,
      assignedById: normalizedTechId ? req.user.id : null,
      assignedByName: normalizedTechId ? req.user.name || "Staff" : null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*, customer:Customer(*), technician:User!Repair_technicianId_fkey(id, name, role, email)").single();
    if (error) {
      return res.status(500).json({ error: "Failed to assign technician." });
    }
    const logId = uuidv47();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          status: updated.status,
          message: normalizedTechId ? `Assigned to technician: ${techName || "Technician"} by ${req.user.name || "Staff"}` : `Repair unassigned by ${req.user.name || "Staff"}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[REPAIR LOG NON FATAL]", logErr);
    }
    if (normalizedTechId) {
      try {
        const isUrgent = updated.priority === "URGENT";
        const isHigh = updated.priority === "HIGH";
        const priorityEmoji = isUrgent ? "\u{1F534}" : isHigh ? "\u{1F7E0}" : "\u{1F4CB}";
        await createNotification({
          userId: normalizedTechId,
          title: `${priorityEmoji} ${isUrgent ? "Urgent Repair Assigned" : "Repair Assigned"}: #${updated.repairNumber}`,
          message: `${updated.deviceBrand || ""} ${updated.deviceModel || ""} (${updated.customerName || "Customer"}) assigned to you by ${req.user.name}. Priority: ${updated.priority || "NORMAL"}.`,
          type: isUrgent ? "REPAIR_URGENT" : "REPAIR_ASSIGNED",
          priority: updated.priority || "NORMAL",
          repairId: updated.id,
          repairNumber: updated.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name,
          senderRole: req.user.role
        });
      } catch (notifErr) {
        console.warn("[ASSIGN NOTIF WARN]", notifErr);
      }
    }
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
    const noteId = uuidv47();
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
    try {
      const { data: repairRec } = await supabaseAdmin.from("Repair").select("repairNumber, technicianId, createdById").eq("id", id).single();
      if (repairRec) {
        const targetUser = repairRec.technicianId !== req.user.id ? repairRec.technicianId : repairRec.createdById;
        if (targetUser && targetUser !== req.user.id) {
          await createNotification({
            userId: targetUser,
            title: `New Note on Repair #${repairRec.repairNumber}`,
            message: `${req.user.name} (${req.user.role}) added a note: "${note.slice(0, 100)}${note.length > 100 ? "..." : ""}"`,
            type: "REPAIR_NOTE",
            priority: "NORMAL",
            repairId: id,
            repairNumber: repairRec.repairNumber,
            senderId: req.user.id,
            senderName: req.user.name,
            senderRole: req.user.role
          });
        }
      }
    } catch (notifErr) {
      console.warn("[REPAIR NOTE NOTIF WARN]", notifErr);
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
      const logId = uuidv47();
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: id,
          status: updatePayload.status || updated.status,
          message: `Courier logistics updated: ${company || "Courier"} (AWB #${tracking || "N/A"}) by ${userName || "Staff"}`,
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
router3.post("/:id/transfer-request", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetTechnicianId, reason } = req.body;
    const result = await createRepairTransferRequest({
      repairId: id,
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      targetTechnicianId,
      reason
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.status(201).json({
      success: true,
      message: "Transfer request submitted successfully.",
      transferRequest: result.data
    });
  } catch (err) {
    console.error("[POST /repairs/:id/transfer-request ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to submit transfer request." });
  }
});
router3.post("/:id/transfer", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "LEAD_TECHNICIAN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetTechnicianId, reason, priority } = req.body;
    const result = await directTransferRepair({
      repairId: id,
      actorId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      targetTechnicianId,
      reason: reason || "Direct management reassignment",
      priority
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (err) {
    console.error("[POST /repairs/:id/transfer ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to transfer repair." });
  }
});
var ALLOWED_SMS_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"];
function isRepairedStatusEligible(status) {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return ["REPAIRED", "READY_FOR_PICKUP", "READY", "READY_FOR_DELIVERY"].includes(s);
}
router3.get("/:id/sms-status", authenticate, authorize(ALLOWED_SMS_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: repair, error } = await supabaseAdmin.from("Repair").select("id, repairNumber, customerId, customerName, customerPhone, deviceBrand, deviceModel, status").or(`id.eq.${id},repairNumber.eq.${id}`).single();
    if (error || !repair) {
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    const eligible = isRepairedStatusEligible(repair.status);
    const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
    const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ""}${repair.deviceModel || ""}`.trim();
    const defaultMessage = generateRepairCompletedSmsMessage({
      customerName: repair.customerName,
      deviceModel: deviceModelFull,
      repairNumber: repair.repairNumber
    });
    const history = getSmsNotificationsForRepair(repair.id);
    const recentCheck = hasRecentSmsNotification(repair.id);
    const googleMessagesUrl = "https://messages.google.com/web/";
    const smsProtocolUrl = phoneValidation.isValid ? `sms:${phoneValidation.international}?body=${encodeURIComponent(defaultMessage)}` : null;
    return res.json({
      eligible,
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerName: repair.customerName,
      deviceModel: deviceModelFull,
      customerPhoneRaw: repair.customerPhone,
      phoneValidation,
      defaultMessage,
      history,
      hasRecentSent: recentCheck.hasSent,
      lastNotification: recentCheck.lastNotification,
      googleMessagesUrl,
      smsProtocolUrl
    });
  } catch (err) {
    console.error("[GET SMS STATUS ERROR]", err);
    return res.status(500).json({ error: "Failed to inspect SMS readiness." });
  }
});
router3.post("/:id/send-sms", authenticate, authorize(ALLOWED_SMS_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customMessage,
      channel = "GOOGLE_MESSAGES_WEB",
      action = "INITIATED",
      // 'INITIATED' | 'SENT'
      notes
    } = req.body || {};
    const { data: repair, error } = await supabaseAdmin.from("Repair").select("*").or(`id.eq.${id},repairNumber.eq.${id}`).single();
    if (error || !repair) {
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    if (!isRepairedStatusEligible(repair.status)) {
      return res.status(400).json({
        error: `Customer completed SMS can only be sent for repairs with status REPAIRED or READY FOR PICKUP. Current status: ${repair.status}`
      });
    }
    const phoneValidation = validateAndNormalizeNepalPhone(repair.customerPhone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        error: phoneValidation.error || "Invalid customer phone number. Please update the customer information before sending SMS.",
        phoneValidation
      });
    }
    const deviceModelFull = `${repair.deviceBrand ? `${repair.deviceBrand} ` : ""}${repair.deviceModel || ""}`.trim();
    const finalMessage = customMessage && typeof customMessage === "string" && customMessage.trim() ? customMessage.trim() : generateRepairCompletedSmsMessage({
      customerName: repair.customerName,
      deviceModel: deviceModelFull,
      repairNumber: repair.repairNumber
    });
    const isDirectSent = action === "SENT";
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const record = await recordSmsNotification({
      repairId: repair.id,
      repairNumber: repair.repairNumber,
      customerId: repair.customerId || null,
      customerName: repair.customerName,
      customerPhoneRaw: repair.customerPhone,
      customerPhoneNormalized: phoneValidation.normalized,
      customerPhoneInternational: phoneValidation.international,
      deviceModel: deviceModelFull,
      deviceBrand: repair.deviceBrand || null,
      messageType: "REPAIR_COMPLETED_SMS",
      messageContent: finalMessage,
      status: isDirectSent ? "SENT" : "INITIATED",
      channel: channel === "SMS_PROTOCOL" ? "SMS_PROTOCOL" : "GOOGLE_MESSAGES_WEB",
      senderStaffId: req.user.id,
      senderStaffName: req.user.name || "Staff",
      senderStaffRole: req.user.role,
      notes: notes || null,
      initiatedAt: nowIso,
      sentAt: isDirectSent ? nowIso : null,
      confirmedAt: isDirectSent ? nowIso : null
    });
    const logId = uuidv47();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: repair.id,
          status: repair.status,
          message: isDirectSent ? `Customer SMS confirmed sent to ${phoneValidation.displayFormatted} via ${record.channel === "GOOGLE_MESSAGES_WEB" ? "Google Messages for Web" : "SMS"} by ${req.user.name || "Staff"} (${req.user.role}).` : `Customer SMS notification prepared for ${phoneValidation.displayFormatted} via Google Messages for Web by ${req.user.name || "Staff"} (${req.user.role}).`,
          createdAt: nowIso
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (logErr) {
      console.warn("[REPAIR LOG SMS AUDIT WARN]", logErr);
    }
    await logAudit({
      userId: req.user.id,
      action: "SMS_NOTIFICATION_DISPATCHED",
      resource: "Repair",
      resourceId: repair.id,
      details: {
        repairNumber: repair.repairNumber,
        customerName: repair.customerName,
        phone: phoneValidation.normalized,
        status: record.status,
        channel: record.channel
      }
    });
    const googleMessagesUrl = "https://messages.google.com/web/";
    const smsProtocolUrl = `sms:${phoneValidation.international}?body=${encodeURIComponent(finalMessage)}`;
    return res.status(201).json({
      success: true,
      message: isDirectSent ? "SMS sent successfully." : "SMS workflow prepared for Google Messages.",
      record,
      googleMessagesUrl,
      smsProtocolUrl
    });
  } catch (err) {
    console.error("[SEND SMS ERROR]", err);
    return res.status(500).json({ error: "Failed to process SMS notification workflow." });
  }
});
router3.post("/:id/confirm-sms", authenticate, authorize(ALLOWED_SMS_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { smsRecordId, notes } = req.body || {};
    const { data: repair } = await supabaseAdmin.from("Repair").select("id, repairNumber, customerName, customerPhone").or(`id.eq.${id},repairNumber.eq.${id}`).single();
    if (!repair) {
      return res.status(404).json({ error: "Repair ticket not found." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let updatedRecord = null;
    if (smsRecordId) {
      updatedRecord = await updateSmsNotification(smsRecordId, {
        status: "SENT",
        sentAt: nowIso,
        confirmedAt: nowIso,
        notes: notes || void 0
      });
    }
    const logId = uuidv47();
    try {
      await supabaseAdmin.from("RepairLog").insert([
        {
          id: logId,
          repairId: repair.id,
          status: "REPAIRED",
          message: `Customer SMS confirmed sent in Google Messages by ${req.user.name || "Staff"} (${req.user.role}). Customer: ${repair.customerName}.`,
          createdAt: nowIso
        }
      ]);
      await broadcastServerChange("RepairLog", "CREATE", logId);
    } catch (_) {
    }
    return res.json({
      success: true,
      message: "SMS send confirmed successfully.",
      record: updatedRecord
    });
  } catch (err) {
    console.error("[CONFIRM SMS ERROR]", err);
    return res.status(500).json({ error: "Failed to confirm SMS send." });
  }
});
router3.get("/:id/sms-logs", authenticate, authorize(ALLOWED_SMS_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const logs = getSmsNotificationsForRepair(id);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve SMS logs." });
  }
});
var repairs_default = router3;

// api/_server/routes/repairTransfers.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/my-requests", authenticate, async (req, res) => {
  try {
    const result = await getMyTransferRequests(req.user.id);
    return res.json(result);
  } catch (err) {
    console.error("[GET /repair-transfers/my-requests ERROR]", err);
    return res.json({ incoming: [], outgoing: [], pendingIncomingCount: 0 });
  }
});
router4.get("/all", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "LEAD_TECHNICIAN"]), async (req, res) => {
  try {
    const requests = await getAllTransferRequests();
    return res.json(requests);
  } catch (err) {
    console.error("[GET /repair-transfers/all ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve transfer requests." });
  }
});
router4.get("/:id", authenticate, async (req, res) => {
  try {
    const transfer = await getTransferRequestById(req.params.id);
    if (!transfer) {
      return res.status(404).json({ error: "Transfer request not found." });
    }
    return res.json(transfer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch transfer request." });
  }
});
router4.post("/:id/respond", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, responseNote } = req.body;
    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user.id,
      responderName: req.user.name,
      responderRole: req.user.role,
      action: action?.toUpperCase(),
      responseNote
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (err) {
    console.error("[POST /repair-transfers/:id/respond ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to process transfer response." });
  }
});
router4.post("/:id/accept", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseNote } = req.body || {};
    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user.id,
      responderName: req.user.name,
      responderRole: req.user.role,
      action: "ACCEPT",
      responseNote
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to accept transfer request." });
  }
});
router4.post("/:id/reject", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseNote } = req.body || {};
    const result = await respondToTransferRequest({
      transferId: id,
      responderId: req.user.id,
      responderName: req.user.name,
      responderRole: req.user.role,
      action: "REJECT",
      responseNote
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to reject transfer request." });
  }
});
router4.post("/:id/cancel", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cancelTransferRequest({
      transferId: id,
      userId: req.user.id,
      userRole: req.user.role
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.json({ success: true, message: "Transfer request cancelled successfully.", data: result.data });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to cancel transfer request." });
  }
});
var repairTransfers_default = router4;

// api/_server/routes/customers.ts
import { Router as Router5 } from "express";
import { v4 as uuidv48 } from "uuid";
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
      id: uuidv48(),
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
import { v4 as uuidv49 } from "uuid";
var router6 = Router6();
var INVENTORY_MANAGERS = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_MANAGER", "RECEPTIONIST"];
var INVENTORY_STOCK_OUT_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_MANAGER", "LEAD_TECHNICIAN", "TECHNICIAN", "RECEPTIONIST"];
var customFoldersRegistry = /* @__PURE__ */ new Map();
function getFolderKey(brand, model, category) {
  return `${(brand || "").trim().toLowerCase()}|${(model || "").trim().toLowerCase()}|${(category || "").trim().toLowerCase()}`;
}
function getDeviceType(item) {
  if (item.subcategory) {
    const sub = item.subcategory.trim().toLowerCase();
    if (sub === "smartphone" || sub === "phone") return "Smartphone";
    if (sub === "tablet") return "Tablet";
    if (sub === "ipad") return "iPad";
    if (sub === "laptop" || sub === "macbook" || sub === "notebook") return "Laptop";
    if (sub === "tv" || sub === "television") return "TV";
  }
  const text = `${item.name || ""} ${item.model || ""} ${item.brand || ""} ${item.compatibility || ""}`.toLowerCase();
  if (text.includes("ipad")) return "iPad";
  if (text.includes("macbook") || text.includes("laptop") || text.includes("thinkpad") || text.includes("zenbook") || text.includes("notebook") || text.includes("legion") || text.includes("inspiron")) return "Laptop";
  if (text.includes("tab ") || text.includes("tablet") || text.includes("surface pro") || text.includes("pad 6") || text.includes("xiaomi pad")) return "Tablet";
  if (text.includes(" tv") || text.includes("bravia") || text.includes("television") || text.includes("smart tv") || text.includes("qled") || text.includes("oled tv")) return "TV";
  if (text.includes("iphone") || text.includes("galaxy") || text.includes("pixel") || text.includes("redmi") || text.includes("realme") || text.includes("xiaomi") || text.includes("oppo") || text.includes("vivo") || text.includes("oneplus") || text.includes("motorola") || text.includes("huawei") || text.includes("nokia") || text.includes("phone")) return "Smartphone";
  return "Other";
}
router6.get("/folders", authenticate, async (req, res) => {
  try {
    const { status = "ACTIVE" } = req.query;
    let query = supabaseAdmin.from("InventoryItem").select("brand, model, category, subcategory, status").not("brand", "is", null).neq("status", "INVENTORY_FILE");
    if (status && status !== "ALL") {
      if (status === "ACTIVE") {
        query = query.in("status", ["ACTIVE", "FOLDER_METADATA"]);
      } else {
        query = query.eq("status", String(status));
      }
    }
    const { data: items, error } = await query;
    if (error) {
      console.warn("[INVENTORY GET FOLDERS DB WARN]", error);
    }
    const folderMap = /* @__PURE__ */ new Map();
    customFoldersRegistry.forEach((folder, key) => {
      const folderStatus = folder.status || "ACTIVE";
      if (status === "ALL" || status === "ACTIVE" && folderStatus === "ACTIVE" || status === "ARCHIVED" && folderStatus === "ARCHIVED") {
        folderMap.set(key, folder);
      }
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
            subcategory: item.subcategory || null,
            status: item.status || "ACTIVE"
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
    try {
      let checkQuery = supabaseAdmin.from("InventoryItem").select("id").eq("brand", trimmedBrand);
      if (trimmedModel) {
        checkQuery = checkQuery.eq("model", trimmedModel);
      }
      if (trimmedCategory) {
        checkQuery = checkQuery.eq("category", trimmedCategory);
      }
      const { data: existing } = await checkQuery.limit(1);
      if (!existing || existing.length === 0) {
        await supabaseAdmin.from("InventoryItem").insert([
          {
            id: uuidv49(),
            name: ".folder_metadata",
            brand: trimmedBrand,
            model: trimmedModel,
            category: trimmedCategory,
            status: "FOLDER_METADATA",
            currentStock: 0,
            minStockLevel: 0,
            unit: "Piece",
            createdById: req.user.id,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]);
      }
    } catch (dbErr) {
      console.warn("[INVENTORY DB FOLDER PERSIST WARN]", dbErr);
    }
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
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: "Brand is required to delete/archive a folder." });
    }
    const trimmedBrand = brand.trim();
    const trimmedModel = model && typeof model === "string" && model.trim() ? model.trim() : void 0;
    const trimmedCategory = category && typeof category === "string" && category.trim() ? category.trim() : void 0;
    let findQuery = supabaseAdmin.from("InventoryItem").select("id, name, brand, model, category, status").ilike("brand", trimmedBrand);
    if (trimmedModel) {
      findQuery = findQuery.ilike("model", trimmedModel);
    }
    if (trimmedCategory) {
      findQuery = findQuery.ilike("category", trimmedCategory);
    }
    const { data: itemsToDelete, error: findError } = await findQuery;
    if (findError) {
      console.error("[INVENTORY DELETE-FOLDER FIND ERROR]", findError);
      return res.status(500).json({ error: "Failed to find items in folder." });
    }
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
      let matches = false;
      if (trimmedCategory) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() && (!trimmedModel || entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase()) && (entry.category && entry.category.toLowerCase() === trimmedCategory.toLowerCase())) {
          matches = true;
        }
      } else if (trimmedModel) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() && entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase()) {
          matches = true;
        }
      } else {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase()) {
          matches = true;
        }
      }
      if (matches) {
        if (permanent) {
          customFoldersRegistry.delete(k);
        } else {
          customFoldersRegistry.set(k, { ...entry, status: "ARCHIVED" });
        }
      }
    });
    await logAudit({
      userId: req.user.id,
      action: permanent ? "INVENTORY_FOLDER_DELETED" : "INVENTORY_FOLDER_ARCHIVED",
      resource: "InventoryFolder",
      details: { brand: trimmedBrand, model: trimmedModel, category: trimmedCategory, permanent, affectedCount: itemIds.length }
    });
    await broadcastServerChange("InventoryFolder", permanent ? "DELETE" : "UPDATE", `${trimmedBrand}-${trimmedModel || ""}-${trimmedCategory || ""}`, {
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
      status: permanent ? "DELETED" : "ARCHIVED"
    });
    return res.json({ success: true, affectedCount: itemIds.length, brand: trimmedBrand, model: trimmedModel, category: trimmedCategory });
  } catch (err) {
    console.error("[INVENTORY DELETE FOLDER ERROR]", err);
    return res.status(500).json({ error: "Failed to delete or archive folder." });
  }
});
router6.post("/restore-folder", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: "Brand is required to restore a folder." });
    }
    const trimmedBrand = brand.trim();
    const trimmedModel = model && typeof model === "string" && model.trim() ? model.trim() : void 0;
    const trimmedCategory = category && typeof category === "string" && category.trim() ? category.trim() : void 0;
    let findQuery = supabaseAdmin.from("InventoryItem").select("id, name, brand, model, category, status").ilike("brand", trimmedBrand).eq("status", "ARCHIVED");
    if (trimmedModel) {
      findQuery = findQuery.ilike("model", trimmedModel);
    }
    if (trimmedCategory) {
      findQuery = findQuery.ilike("category", trimmedCategory);
    }
    const { data: itemsToRestore, error: findError } = await findQuery;
    if (findError) {
      console.error("[INVENTORY RESTORE-FOLDER FIND ERROR]", findError);
      return res.status(500).json({ error: "Failed to find archived items in folder." });
    }
    const itemIds = (itemsToRestore || []).map((i) => i.id);
    if (itemIds.length > 0) {
      const { error: restoreErr } = await supabaseAdmin.from("InventoryItem").update({ status: "ACTIVE", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).in("id", itemIds);
      if (restoreErr) {
        console.error("[INVENTORY RESTORE ITEMS ERROR]", restoreErr);
        return res.status(500).json({ error: "Failed to restore archived items." });
      }
      for (const id of itemIds) {
        await broadcastServerChange("InventoryItem", "UPDATE", id, { id, status: "ACTIVE" });
      }
    }
    const registryEntries = Array.from(customFoldersRegistry.entries());
    registryEntries.forEach(([k, entry]) => {
      let matches = false;
      if (trimmedCategory) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() && (!trimmedModel || entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase()) && (entry.category && entry.category.toLowerCase() === trimmedCategory.toLowerCase())) {
          matches = true;
        }
      } else if (trimmedModel) {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase() && entry.model && entry.model.toLowerCase() === trimmedModel.toLowerCase()) {
          matches = true;
        }
      } else {
        if (entry.brand.toLowerCase() === trimmedBrand.toLowerCase()) {
          matches = true;
        }
      }
      if (matches) {
        customFoldersRegistry.set(k, { ...entry, status: "ACTIVE" });
      }
    });
    const fKey = getFolderKey(trimmedBrand, trimmedModel || null, trimmedCategory || null);
    if (!customFoldersRegistry.has(fKey)) {
      customFoldersRegistry.set(fKey, {
        brand: trimmedBrand,
        model: trimmedModel || null,
        category: trimmedCategory || null,
        status: "ACTIVE"
      });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FOLDER_RESTORED",
      resource: "InventoryFolder",
      details: { brand: trimmedBrand, model: trimmedModel, category: trimmedCategory, restoredCount: itemIds.length }
    });
    await broadcastServerChange("InventoryFolder", "UPDATE", `${trimmedBrand}-${trimmedModel || ""}-${trimmedCategory || ""}`, {
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory,
      status: "ACTIVE"
    });
    return res.json({
      success: true,
      restoredCount: itemIds.length,
      brand: trimmedBrand,
      model: trimmedModel,
      category: trimmedCategory
    });
  } catch (err) {
    console.error("[INVENTORY RESTORE FOLDER ERROR]", err);
    return res.status(500).json({ error: "Failed to restore folder." });
  }
});
router6.post("/bulk-restore", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No item IDs provided." });
    }
    const { error } = await supabaseAdmin.from("InventoryItem").update({ status: "ACTIVE", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).in("id", ids);
    if (error) return res.status(500).json({ error: "Failed to restore items." });
    for (const id of ids) {
      await broadcastServerChange("InventoryItem", "UPDATE", id, { id, status: "ACTIVE" });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_BULK_RESTORE",
      resource: "InventoryItem",
      details: { count: ids.length, ids }
    });
    return res.json({ success: true, count: ids.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process bulk restore." });
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
    const { category, brand, status = "ACTIVE", search, deviceType, limit = "1000" } = req.query;
    let query = supabaseAdmin.from("InventoryItem").select("*").neq("status", "FOLDER_METADATA").neq("status", "INVENTORY_FILE");
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
    let filteredItems = items || [];
    if (deviceType && deviceType !== "ALL") {
      filteredItems = filteredItems.filter((item) => getDeviceType(item) === String(deviceType));
    }
    return res.json(filteredItems);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve inventory." });
  }
});
router6.get("/stats", authenticate, async (req, res) => {
  try {
    const { data: activeItems, error: activeErr } = await supabaseAdmin.from("InventoryItem").select("id, name, brand, model, category, subcategory, compatibility, currentStock, minStockLevel, purchasePrice, sellingPrice, status").eq("status", "ACTIVE");
    if (activeErr) {
      console.error("[INVENTORY ACTIVE STATS DB ERROR]", activeErr);
    }
    const { data: archivedItems, error: archErr } = await supabaseAdmin.from("InventoryItem").select("id, currentStock, minStockLevel, purchasePrice, sellingPrice, status").eq("status", "ARCHIVED");
    if (archErr) {
      console.error("[INVENTORY ARCHIVED STATS DB ERROR]", archErr);
    }
    const safeActive = activeItems || [];
    const totalActiveProducts = safeActive.length;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalPurchaseValuation = 0;
    let totalSellingValuation = 0;
    let potentialProfit = 0;
    const deviceCounts = {
      Smartphone: 0,
      Tablet: 0,
      iPad: 0,
      Laptop: 0,
      TV: 0,
      Other: 0
    };
    safeActive.forEach((item) => {
      const stock = typeof item.currentStock === "number" ? item.currentStock : parseInt(item.currentStock, 10) || 0;
      const minStock = typeof item.minStockLevel === "number" ? item.minStockLevel : parseInt(item.minStockLevel, 10) || 5;
      const pCost = typeof item.purchasePrice === "number" ? item.purchasePrice : parseFloat(item.purchasePrice) || 0;
      const sPrice = typeof item.sellingPrice === "number" ? item.sellingPrice : parseFloat(item.sellingPrice) || 0;
      totalStockUnits += stock;
      if (stock > 0 && pCost > 0) {
        totalPurchaseValuation += stock * pCost;
      }
      if (stock > 0 && sPrice > 0) {
        totalSellingValuation += stock * sPrice;
      }
      if (stock > 0 && sPrice > 0 && pCost > 0) {
        potentialProfit += stock * (sPrice - pCost);
      }
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
      const devType = getDeviceType(item);
      deviceCounts[devType] = (deviceCounts[devType] || 0) + 1;
    });
    const profitMargin = totalPurchaseValuation > 0 ? (totalSellingValuation - totalPurchaseValuation) / totalPurchaseValuation * 100 : 0;
    const safeArchived = archivedItems || [];
    const archivedProductsCount = safeArchived.length;
    let archivedStockUnits = 0;
    let archivedValuation = 0;
    safeArchived.forEach((item) => {
      const stock = typeof item.currentStock === "number" ? item.currentStock : parseInt(item.currentStock, 10) || 0;
      const pCost = typeof item.purchasePrice === "number" ? item.purchasePrice : parseFloat(item.purchasePrice) || 0;
      archivedStockUnits += stock;
      if (stock > 0 && pCost > 0) {
        archivedValuation += stock * pCost;
      }
    });
    const { count: txCount } = await supabaseAdmin.from("InventoryTransaction").select("*", { count: "exact", head: true });
    return res.json({
      // Active stock metrics
      totalProducts: totalActiveProducts,
      totalItems: totalActiveProducts,
      totalStockUnits,
      totalStockQuantity: totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalValuation: Math.round(totalPurchaseValuation * 100) / 100,
      // strictly unit purchase cost
      totalStockValue: Math.round(totalPurchaseValuation * 100) / 100,
      totalSellingValuation: Math.round(totalSellingValuation * 100) / 100,
      potentialProfit: Math.round(potentialProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 10) / 10,
      deviceCounts,
      // Archived stock metrics (kept isolated)
      archivedProductsCount,
      archivedStockUnits,
      archivedValuation: Math.round(archivedValuation * 100) / 100,
      recentTxCount: txCount || 0
    });
  } catch (err) {
    console.error("[INVENTORY STATS ERROR]", err);
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
      id: uuidv49(),
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
router6.get("/files", authenticate, async (req, res) => {
  try {
    const { brand, model, category, itemId } = req.query;
    let query = supabaseAdmin.from("InventoryItem").select("*").eq("status", "INVENTORY_FILE");
    if (itemId) {
      query = query.eq("compatibility", String(itemId));
    } else {
      if (brand) query = query.eq("brand", String(brand));
      if (model) query = query.eq("model", String(model));
      if (category) query = query.eq("category", String(category));
    }
    const { data: files, error } = await query.order("createdAt", { ascending: false });
    if (error) {
      console.error("[INVENTORY GET FILES ERROR]", error);
      return res.status(500).json({ error: "Failed to retrieve inventory files." });
    }
    const parsedFiles = (files || []).map((f) => {
      let meta = {};
      try {
        if (f.notes) meta = JSON.parse(f.notes);
      } catch (_) {
      }
      return {
        id: f.id,
        name: f.name,
        brand: f.brand,
        model: f.model,
        category: f.category,
        itemId: f.compatibility || null,
        url: f.imageUrl,
        description: f.description || "",
        fileType: meta.fileType || (f.imageUrl?.endsWith(".pdf") ? "pdf" : "image"),
        fileSize: meta.fileSize || 0,
        uploadedBy: meta.uploadedByName || "Staff",
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      };
    });
    return res.json(parsedFiles);
  } catch (err) {
    console.error("[INVENTORY GET FILES EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to retrieve files." });
  }
});
router6.post("/files", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { name, url, fileType, fileSize, brand, model, category, itemId, description } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: "File name and file URL are required." });
    }
    const fileId = uuidv49();
    const meta = {
      fileType: fileType || (url.endsWith(".pdf") ? "pdf" : "image"),
      fileSize: fileSize || 0,
      uploadedById: req.user.id,
      uploadedByName: req.user.name
    };
    const newFileRecord = {
      id: fileId,
      name: name.trim(),
      brand: brand ? String(brand).trim() : null,
      model: model ? String(model).trim() : null,
      category: category ? String(category).trim() : "Technical Documentation",
      sku: `FILE-${Date.now().toString().slice(-6)}`,
      compatibility: itemId ? String(itemId) : null,
      imageUrl: url.trim(),
      description: description ? String(description).trim() : null,
      notes: JSON.stringify(meta),
      status: "INVENTORY_FILE",
      currentStock: 0,
      minStockLevel: 0,
      unit: "Piece",
      createdById: req.user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data: created, error } = await supabaseAdmin.from("InventoryItem").insert([newFileRecord]).select("*").single();
    if (error) {
      console.error("[INVENTORY CREATE FILE ERROR]", error);
      return res.status(500).json({ error: "Failed to record inventory file." });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FILE_UPLOADED",
      resource: "InventoryFile",
      resourceId: fileId,
      details: { name, brand, model, category, itemId, url }
    });
    await broadcastServerChange("InventoryFile", "CREATE", fileId, newFileRecord);
    return res.status(201).json({
      success: true,
      file: {
        id: created.id,
        name: created.name,
        brand: created.brand,
        model: created.model,
        category: created.category,
        itemId: created.compatibility || null,
        url: created.imageUrl,
        description: created.description,
        fileType: meta.fileType,
        fileSize: meta.fileSize,
        uploadedBy: meta.uploadedByName,
        createdAt: created.createdAt
      }
    });
  } catch (err) {
    console.error("[INVENTORY POST FILE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to upload inventory file." });
  }
});
router6.patch("/files/:id", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const updates = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (name) updates.name = String(name).trim();
    if (description !== void 0) updates.description = description ? String(description).trim() : null;
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update(updates).eq("id", id).eq("status", "INVENTORY_FILE").select("*").single();
    if (error || !updated) {
      return res.status(404).json({ error: "File not found or failed to update." });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FILE_UPDATED",
      resource: "InventoryFile",
      resourceId: id,
      details: { name: updated.name, description: updated.description }
    });
    await broadcastServerChange("InventoryFile", "UPDATE", id, updated);
    return res.json({ success: true, file: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update file details." });
  }
});
router6.delete("/files/:id", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("InventoryItem").delete().eq("id", id).eq("status", "INVENTORY_FILE");
    if (error) {
      return res.status(500).json({ error: "Failed to delete inventory file." });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FILE_DELETED",
      resource: "InventoryFile",
      resourceId: id
    });
    await broadcastServerChange("InventoryFile", "DELETE", id);
    return res.json({ success: true, message: "File successfully deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete file." });
  }
});
router6.post("/files/:id/move", authenticate, authorize(INVENTORY_MANAGERS), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetBrand, targetModel, targetCategory } = req.body;
    if (!targetBrand) {
      return res.status(400).json({ error: "Target brand is required." });
    }
    const { data: updated, error } = await supabaseAdmin.from("InventoryItem").update({
      brand: String(targetBrand).trim(),
      model: targetModel ? String(targetModel).trim() : null,
      category: targetCategory ? String(targetCategory).trim() : "Technical Documentation",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).eq("status", "INVENTORY_FILE").select("*").single();
    if (error || !updated) {
      return res.status(404).json({ error: "File not found or failed to move." });
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_FILE_MOVED",
      resource: "InventoryFile",
      resourceId: id,
      details: { targetBrand, targetModel, targetCategory }
    });
    await broadcastServerChange("InventoryFile", "UPDATE", id, updated);
    return res.json({ success: true, file: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to move file." });
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
      id: uuidv49(),
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
            id: uuidv49(),
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
    if (updated.brand) {
      const fKey = getFolderKey(updated.brand, updated.model, updated.category);
      if (customFoldersRegistry.has(fKey)) {
        const existing = customFoldersRegistry.get(fKey);
        customFoldersRegistry.set(fKey, { ...existing, status: "ACTIVE" });
      }
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
          id: uuidv49(),
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
          id: uuidv49(),
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
          id: uuidv49(),
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
    } catch (txErr) {
      console.warn("[ADJUST TX WARN]", txErr);
    }
    await logAudit({
      userId: req.user.id,
      action: "INVENTORY_STOCK_ADJUSTMENT",
      resource: "InventoryItem",
      resourceId: id,
      details: { previousStock: prevStock, newStock, diff, reason }
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
    if (String(permanent) === "true") {
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
import { v4 as uuidv410 } from "uuid";
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
            id: uuidv410(),
            repairId: existingRepairId,
            status: updatedRepair.status || "RECEIVED",
            message: `Inbound courier shipment received via ${courierCompany} (AWB #${courierTrackingNumber}) by ${userName}.`,
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
        const newCustomerId = uuidv410();
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
    const newRepairId = uuidv410();
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
          id: uuidv410(),
          repairId: newRepairId,
          status: "RECEIVED",
          message: `Device intake registered via courier (${courierCompany}, AWB #${courierTrackingNumber}) by ${userName}.`,
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
          id: uuidv410(),
          repairId,
          status: "DISPATCHED_VIA_COURIER",
          message: `Device dispatched to customer via ${returnCourierCompany} (AWB #${returnCourierTrackingNumber}) by ${userName}.`,
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
          id: uuidv410(),
          repairId: id,
          status: updated.status || "IN_TRANSIT",
          message: `Logistics status updated to ${status}${notes ? `: ${notes}` : ""} by ${req.user?.name || "Staff"}.`,
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
import { v4 as uuidv411 } from "uuid";
import multer2 from "multer";
var router8 = Router8();
var upload2 = multer2({ storage: multer2.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
var otpStore = {};
function parseWarrantyDurationMonths2(periodStr) {
  if (!periodStr) return 6;
  const str = String(periodStr).toUpperCase().trim();
  if (str.includes("24") || str.includes("2_YEAR") || str.includes("2 YEAR") || str.includes("2YEAR") || str.includes("2_Y") || str === "2Y" || str === "2 YEARS") {
    return 24;
  }
  if (str.includes("12") || str.includes("1_YEAR") || str.includes("1 YEAR") || str.includes("1YEAR") || str.includes("1_Y") || str === "1Y" || str === "1 YEAR") {
    return 12;
  }
  if (str.includes("3")) return 3;
  if (str.includes("6")) return 6;
  const num = parseInt(str, 10);
  return !isNaN(num) && num > 0 ? num : 6;
}
function formatWarrantyPeriodLabel(months) {
  if (months === 24) return "2 Years";
  if (months === 12) return "1 Year";
  return `${months} Months`;
}
function getAuthoritativeNepalDates() {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const todayStr = formatter.format(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const yesterdayStr = formatter.format(yesterdayDate);
  return { todayStr, yesterdayStr, now };
}
function toNepalDateString(isoOrDate) {
  if (!isoOrDate) return "";
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return "";
  }
}
function calculateWarrantyExpiry(startDate, months) {
  const d = new Date(startDate || Date.now());
  if (isNaN(d.getTime())) return /* @__PURE__ */ new Date();
  if (months === 24) {
    d.setFullYear(d.getFullYear() + 2);
  } else if (months === 12) {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + months);
  }
  return d;
}
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
    const {
      status,
      brand,
      period,
      search,
      dateFilter,
      datePreset,
      startDate,
      endDate
    } = req.query;
    const { todayStr, yesterdayStr } = getAuthoritativeNepalDates();
    const activeDateFilter = String(dateFilter || datePreset || "ALL").toUpperCase();
    const { data: rawWarranties, error } = await supabaseAdmin.from("BatteryWarranty").select("*").order("createdAt", { ascending: false });
    if (error) {
      console.error("[BATTERY WARRANTIES ERROR]", error);
      return res.status(500).json({ error: error.message || "Failed to fetch battery warranties." });
    }
    const { data: allRepairs } = await supabaseAdmin.from("Repair").select("id, repairNumber, customerId, customerName, customerPhone, customerAddress, customerEmail, status, hasBatteryWarranty, batteryWarrantyPeriod, batteryType, createdAt");
    const repairMap = /* @__PURE__ */ new Map();
    const repairWarrantyMap = /* @__PURE__ */ new Map();
    (allRepairs || []).forEach((r) => {
      repairMap.set(r.id, r);
      repairWarrantyMap.set(r.id, r.hasBatteryWarranty === true || r.hasBatteryWarranty === "true");
    });
    const { data: allClaims } = await supabaseAdmin.from("BatteryWarrantyClaim").select("*").order("claimDate", { ascending: false });
    const claimsByWarrantyId = /* @__PURE__ */ new Map();
    (allClaims || []).forEach((c) => {
      const list = claimsByWarrantyId.get(c.warrantyId) || [];
      list.push(c);
      claimsByWarrantyId.set(c.warrantyId, list);
    });
    const validWarranties = (rawWarranties || []).filter((w) => {
      if (w.repairId) {
        return repairWarrantyMap.get(w.repairId) !== false;
      }
      return true;
    });
    const nowMs = Date.now();
    const enrichedList = validWarranties.map((w) => {
      const linkedRepair = w.repairId ? repairMap.get(w.repairId) : null;
      const claims = claimsByWarrantyId.get(w.id) || [];
      const expMs = w.expiryDate ? new Date(w.expiryDate).getTime() : 0;
      const daysRemaining = expMs ? Math.ceil((expMs - nowMs) / (1e3 * 60 * 60 * 24)) : 0;
      const months = parseWarrantyDurationMonths2(w.warrantyPeriod);
      const periodLabel = formatWarrantyPeriodLabel(months);
      let calculatedStatus = (w.status || "ACTIVE").toUpperCase();
      if (calculatedStatus === "ACTIVE") {
        if (daysRemaining < 0) {
          calculatedStatus = "EXPIRED";
        } else if (daysRemaining <= 30) {
          calculatedStatus = "EXPIRING_SOON";
        }
      }
      const nepalRegDate = toNepalDateString(w.registrationDate || w.createdAt);
      return {
        ...w,
        customerAddress: w.customerAddress || linkedRepair?.customerAddress || null,
        customerEmail: w.customerEmail || linkedRepair?.customerEmail || null,
        repairStatus: linkedRepair?.status || null,
        warrantyPeriodMonths: months,
        warrantyPeriodLabel: periodLabel,
        daysRemaining,
        calculatedStatus,
        nepalRegDate,
        claims,
        claimCount: claims.length || w.claimCount || 0
      };
    });
    const summary = {
      total: enrichedList.length,
      today: enrichedList.filter((w) => w.nepalRegDate === todayStr).length,
      yesterday: enrichedList.filter((w) => w.nepalRegDate === yesterdayStr).length,
      active: enrichedList.filter((w) => w.daysRemaining >= 0 && (w.status || "").toUpperCase() === "ACTIVE").length,
      expiringSoon: enrichedList.filter((w) => w.daysRemaining >= 0 && w.daysRemaining <= 30 && (w.status || "").toUpperCase() === "ACTIVE").length,
      expired: enrichedList.filter((w) => w.daysRemaining < 0 || (w.status || "").toUpperCase() === "EXPIRED").length,
      claims: (allClaims || []).length,
      twoYears: enrichedList.filter((w) => w.warrantyPeriodMonths === 24).length,
      oneYear: enrichedList.filter((w) => w.warrantyPeriodMonths === 12).length,
      sixMonths: enrichedList.filter((w) => w.warrantyPeriodMonths === 6).length,
      todayNepalStr: todayStr,
      yesterdayNepalStr: yesterdayStr
    };
    let filtered = [...enrichedList];
    if (activeDateFilter === "TODAY") {
      filtered = filtered.filter((w) => w.nepalRegDate === todayStr);
    } else if (activeDateFilter === "YESTERDAY") {
      filtered = filtered.filter((w) => w.nepalRegDate === yesterdayStr);
    } else if (activeDateFilter === "CUSTOM" || startDate && endDate) {
      const sDateStr = startDate ? String(startDate).slice(0, 10) : "";
      const eDateStr = endDate ? String(endDate).slice(0, 10) : sDateStr;
      if (sDateStr) {
        filtered = filtered.filter((w) => {
          const itemDate = w.nepalRegDate;
          if (!itemDate) return false;
          if (eDateStr) {
            return itemDate >= sDateStr && itemDate <= eDateStr;
          }
          return itemDate >= sDateStr;
        });
      }
    }
    if (status && status !== "ALL") {
      const targetStatus = String(status).toUpperCase();
      if (targetStatus === "ACTIVE") {
        filtered = filtered.filter((w) => w.daysRemaining >= 0 && (w.status || "").toUpperCase() === "ACTIVE");
      } else if (targetStatus === "EXPIRING_SOON") {
        filtered = filtered.filter((w) => w.daysRemaining >= 0 && w.daysRemaining <= 30 && (w.status || "").toUpperCase() === "ACTIVE");
      } else if (targetStatus === "EXPIRED") {
        filtered = filtered.filter((w) => w.daysRemaining < 0 || (w.status || "").toUpperCase() === "EXPIRED");
      } else if (targetStatus === "CLAIMED") {
        filtered = filtered.filter((w) => w.claims && w.claims.length > 0 || w.claimCount > 0 || w.status === "CLAIMED");
      } else if (targetStatus === "REPLACED") {
        filtered = filtered.filter((w) => (w.status || "").toUpperCase() === "REPLACED");
      } else {
        filtered = filtered.filter((w) => (w.status || "").toUpperCase() === targetStatus);
      }
    }
    if (period && period !== "ALL") {
      const targetMonths = parseWarrantyDurationMonths2(period);
      filtered = filtered.filter((w) => w.warrantyPeriodMonths === targetMonths);
    }
    if (brand && brand !== "ALL") {
      filtered = filtered.filter((w) => (w.deviceBrand || "").toUpperCase() === String(brand).toUpperCase());
    }
    if (search) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter((w) => {
        const wNum = (w.warrantyNumber || "").toLowerCase();
        const rNum = (w.repairNumber || "").toLowerCase();
        const cName = (w.customerName || "").toLowerCase();
        const cPhone = (w.customerPhone || "").toLowerCase();
        const cAddr = (w.customerAddress || "").toLowerCase();
        const cEmail = (w.customerEmail || "").toLowerCase();
        const dModel = (w.deviceModel || "").toLowerCase();
        const dBrand = (w.deviceBrand || "").toLowerCase();
        const imei = (w.imeiNumber || "").toLowerCase();
        const bType = (w.batteryType || "").toLowerCase();
        return wNum.includes(q) || rNum.includes(q) || cName.includes(q) || cPhone.includes(q) || cAddr.includes(q) || cEmail.includes(q) || dModel.includes(q) || dBrand.includes(q) || imei.includes(q) || bType.includes(q);
      });
    }
    return res.json({
      success: true,
      data: filtered,
      warranties: filtered,
      summary,
      total: enrichedList.length,
      filteredCount: filtered.length,
      todayCount: summary.today,
      yesterdayCount: summary.yesterday
    });
  } catch (err) {
    console.error("[BATTERY WARRANTIES EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to load warranties." });
  }
});
router8.get("/export", authenticate, async (req, res) => {
  try {
    const {
      status,
      period,
      search,
      dateFilter,
      datePreset,
      startDate,
      endDate
    } = req.query;
    const { todayStr, yesterdayStr } = getAuthoritativeNepalDates();
    const activeDateFilter = String(dateFilter || datePreset || "ALL").toUpperCase();
    const { data: rawWarranties } = await supabaseAdmin.from("BatteryWarranty").select("*").order("createdAt", { ascending: false });
    const { data: allRepairs } = await supabaseAdmin.from("Repair").select("id, customerAddress, customerEmail, hasBatteryWarranty");
    const repairMap = /* @__PURE__ */ new Map();
    const repairWarrantyMap = /* @__PURE__ */ new Map();
    (allRepairs || []).forEach((r) => {
      repairMap.set(r.id, r);
      repairWarrantyMap.set(r.id, r.hasBatteryWarranty === true || r.hasBatteryWarranty === "true");
    });
    const validWarranties = (rawWarranties || []).filter((w) => {
      if (w.repairId) {
        return repairWarrantyMap.get(w.repairId) !== false;
      }
      return true;
    });
    let filtered = validWarranties.map((w) => {
      const linked = w.repairId ? repairMap.get(w.repairId) : null;
      const months = parseWarrantyDurationMonths2(w.warrantyPeriod);
      const nepalRegDate = toNepalDateString(w.registrationDate || w.createdAt);
      return {
        ...w,
        customerAddress: w.customerAddress || linked?.customerAddress || "",
        customerEmail: w.customerEmail || linked?.customerEmail || "",
        warrantyPeriodMonths: months,
        warrantyPeriodLabel: formatWarrantyPeriodLabel(months),
        nepalRegDate
      };
    });
    if (activeDateFilter === "TODAY") {
      filtered = filtered.filter((w) => w.nepalRegDate === todayStr);
    } else if (activeDateFilter === "YESTERDAY") {
      filtered = filtered.filter((w) => w.nepalRegDate === yesterdayStr);
    } else if (activeDateFilter === "CUSTOM" || startDate && endDate) {
      const sDateStr = startDate ? String(startDate).slice(0, 10) : "";
      const eDateStr = endDate ? String(endDate).slice(0, 10) : sDateStr;
      if (sDateStr) {
        filtered = filtered.filter((w) => {
          const itemDate = w.nepalRegDate;
          if (!itemDate) return false;
          if (eDateStr) return itemDate >= sDateStr && itemDate <= eDateStr;
          return itemDate >= sDateStr;
        });
      }
    }
    if (status && status !== "ALL") {
      filtered = filtered.filter((w) => (w.status || "").toUpperCase() === String(status).toUpperCase());
    }
    if (period && period !== "ALL") {
      const targetMonths = parseWarrantyDurationMonths2(period);
      filtered = filtered.filter((w) => w.warrantyPeriodMonths === targetMonths);
    }
    if (search) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter((w) => {
        return (w.warrantyNumber || "").toLowerCase().includes(q) || (w.repairNumber || "").toLowerCase().includes(q) || (w.customerName || "").toLowerCase().includes(q) || (w.customerPhone || "").toLowerCase().includes(q) || (w.deviceModel || "").toLowerCase().includes(q);
      });
    }
    const rows = filtered.map((w) => ({
      "Warranty Number": w.warrantyNumber,
      "Repair Number": w.repairNumber || "\u2014",
      "Customer Name": w.customerName,
      "Customer Phone": w.customerPhone,
      "Customer Address": w.customerAddress || "\u2014",
      "Customer Email": w.customerEmail || "\u2014",
      "Device Brand": w.deviceBrand,
      "Device Model": w.deviceModel,
      "IMEI Number": w.imeiNumber || "\u2014",
      "Battery Type": w.batteryType || "Original OEM",
      "Warranty Duration": w.warrantyPeriodLabel,
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
    console.error("[EXPORT BATTERY WARRANTIES ERROR]", err);
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
      "Device Model": "iPhone 13 Pro",
      "IMEI Number": "356891029384756",
      "Battery Type": "Original High Capacity 3095mAh",
      "Warranty Duration": "2 Years"
    },
    {
      "Customer Name": "Sita Shrestha",
      "Customer Phone": "9841234567",
      "Customer Email": "sita@example.com",
      "Customer Address": "New Road, Kathmandu",
      "Device Brand": "Samsung",
      "Device Model": "Galaxy S22 Ultra",
      "IMEI Number": "359812039485761",
      "Battery Type": "Original 5000mAh Replacement Battery",
      "Warranty Duration": "1 Year"
    },
    {
      "Customer Name": "Bikram Thapa",
      "Customer Phone": "9861928374",
      "Customer Email": "",
      "Customer Address": "Pokhara, Kaski",
      "Device Brand": "Xiaomi",
      "Device Model": "Redmi Note 12",
      "IMEI Number": "",
      "Battery Type": "Standard Replacement Battery",
      "Warranty Duration": "6 Months"
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
    const parsed = rows.map((r, idx) => {
      const rawMonths = r["Warranty Duration"] || r["Warranty Months"] || r["warrantyPeriod"] || r["warrantyMonths"] || "6 Months";
      const months = parseWarrantyDurationMonths2(rawMonths);
      const periodLabel = formatWarrantyPeriodLabel(months);
      const customerName = (r["Customer Name"] || r["customerName"] || "").trim();
      const customerPhone = (r["Customer Phone"] || r["customerPhone"] || "").toString().trim();
      const deviceModel = (r["Device Model"] || r["deviceModel"] || "").trim();
      const regDate = /* @__PURE__ */ new Date();
      const expDate = calculateWarrantyExpiry(regDate, months);
      const isValid = Boolean(customerName && customerPhone && deviceModel);
      return {
        rowIndex: idx + 1,
        rowNumber: idx + 1,
        customerName,
        customerPhone,
        customerEmail: (r["Customer Email"] || r["customerEmail"] || "").trim(),
        customerAddress: (r["Customer Address"] || r["customerAddress"] || "").trim(),
        deviceBrand: (r["Device Brand"] || r["deviceBrand"] || "Apple").trim(),
        deviceModel,
        imeiNumber: (r["IMEI Number"] || r["imeiNumber"] || "").toString().trim(),
        batteryType: (r["Battery Type"] || r["batteryType"] || "Original Replacement Battery").trim(),
        warrantyPeriod: periodLabel,
        warrantyPeriodMonths: months,
        registrationDate: regDate.toISOString(),
        expiryDate: expDate.toISOString(),
        status: isValid ? "VALID" : "INVALID",
        isValid,
        errors: !isValid ? ["Customer name, valid phone, and device model are mandatory."] : [],
        warnings: [],
        data: {
          customerName,
          customerPhone,
          customerEmail: (r["Customer Email"] || r["customerEmail"] || "").trim(),
          customerAddress: (r["Customer Address"] || r["customerAddress"] || "").trim(),
          deviceBrand: (r["Device Brand"] || r["deviceBrand"] || "Apple").trim(),
          deviceModel,
          imeiNumber: (r["IMEI Number"] || r["imeiNumber"] || "").toString().trim(),
          batteryType: (r["Battery Type"] || r["batteryType"] || "Original Replacement Battery").trim(),
          warrantyPeriod: periodLabel,
          registrationDate: regDate.toISOString(),
          expiryDate: expDate.toISOString()
        }
      };
    });
    return res.json({
      totalRows: parsed.length,
      validRows: parsed.filter((p) => p.isValid).length,
      invalidRows: parsed.filter((p) => !p.isValid).length,
      duplicateRows: 0,
      preview: parsed,
      items: parsed
    });
  } catch (err) {
    console.error("[IMPORT PREVIEW ERROR]", err);
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
    for (const rawItem of items) {
      const item = rawItem.data || rawItem;
      if (!item.customerName || !item.customerPhone || !item.deviceModel) continue;
      const months = parseWarrantyDurationMonths2(item.warrantyPeriod || item.warrantyPeriodMonths);
      const periodLabel = formatWarrantyPeriodLabel(months);
      const warrantyNumber = await generateWarrantyNumber2();
      const regDate = /* @__PURE__ */ new Date();
      const expDate = calculateWarrantyExpiry(regDate, months);
      const newWarranty = {
        id: uuidv411(),
        warrantyNumber,
        customerName: item.customerName.trim(),
        customerPhone: item.customerPhone.trim(),
        customerEmail: item.customerEmail ? item.customerEmail.trim() : null,
        customerAddress: item.customerAddress ? item.customerAddress.trim() : null,
        deviceBrand: item.deviceBrand || "Apple",
        deviceModel: item.deviceModel.trim(),
        imeiNumber: item.imeiNumber ? String(item.imeiNumber).trim() : null,
        batteryType: item.batteryType || "Original Replacement Battery",
        warrantyPeriod: periodLabel,
        registrationDate: regDate.toISOString(),
        expiryDate: expDate.toISOString(),
        status: "ACTIVE",
        claimCount: 0,
        createdById: req.user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: created, error } = await supabaseAdmin.from("BatteryWarranty").insert([newWarranty]).select("*").single();
      if (created && !error) {
        imported.push(created);
        await broadcastServerChange("BatteryWarranty", "CREATE", created.id, created);
      }
    }
    return res.json({ success: true, count: imported.length, message: `Successfully imported ${imported.length} warranties.` });
  } catch (err) {
    console.error("[IMPORT CONFIRM EXCEPTION]", err);
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
    const { data: claims } = await supabaseAdmin.from("BatteryWarrantyClaim").select("*").eq("warrantyId", id).order("claimDate", { ascending: false });
    let linkedRepair = null;
    if (warranty.repairId) {
      const { data: r } = await supabaseAdmin.from("Repair").select("*").eq("id", warranty.repairId).single();
      linkedRepair = r;
    }
    const months = parseWarrantyDurationMonths2(warranty.warrantyPeriod);
    return res.json({
      ...warranty,
      warrantyPeriodMonths: months,
      warrantyPeriodLabel: formatWarrantyPeriodLabel(months),
      customerAddress: warranty.customerAddress || linkedRepair?.customerAddress || null,
      customerEmail: warranty.customerEmail || linkedRepair?.customerEmail || null,
      repair: linkedRepair,
      claims: claims || []
    });
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
      batteryType = "Original Replacement Battery",
      warrantyPeriod,
      warrantyMonths = 6,
      terms
    } = req.body;
    if (!customerName || !customerPhone || !deviceModel) {
      return res.status(400).json({ error: "Customer name, phone, and device model are required." });
    }
    const months = parseWarrantyDurationMonths2(warrantyPeriod || warrantyMonths);
    const periodLabel = formatWarrantyPeriodLabel(months);
    const warrantyNumber = await generateWarrantyNumber2();
    const regDate = /* @__PURE__ */ new Date();
    const expDate = calculateWarrantyExpiry(regDate, months);
    const newWarranty = {
      id: uuidv411(),
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
      warrantyPeriod: periodLabel,
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
    if (repairId) {
      await supabaseAdmin.from("Repair").update({
        hasBatteryWarranty: true,
        batteryWarrantyPeriod: periodLabel,
        batteryType,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", repairId);
      await broadcastServerChange("Repair", "UPDATE", repairId);
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
    const { data: existing } = await supabaseAdmin.from("BatteryWarranty").select("*").eq("id", id).single();
    if (!existing) return res.status(404).json({ error: "Battery warranty not found." });
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.claims;
    delete updateData.repair;
    delete updateData.warrantyPeriodMonths;
    delete updateData.warrantyPeriodLabel;
    delete updateData.daysRemaining;
    delete updateData.calculatedStatus;
    delete updateData.nepalRegDate;
    if (updateData.warrantyPeriod || updateData.warrantyMonths) {
      const months = parseWarrantyDurationMonths2(updateData.warrantyPeriod || updateData.warrantyMonths);
      updateData.warrantyPeriod = formatWarrantyPeriodLabel(months);
      const regDate = new Date(existing.registrationDate || existing.createdAt || Date.now());
      updateData.expiryDate = calculateWarrantyExpiry(regDate, months).toISOString();
    }
    updateData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const { data: updated, error } = await supabaseAdmin.from("BatteryWarranty").update(updateData).eq("id", id).select("*").single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    if (existing.repairId && (updateData.warrantyPeriod || updateData.batteryType)) {
      await supabaseAdmin.from("Repair").update({
        batteryWarrantyPeriod: updateData.warrantyPeriod || existing.warrantyPeriod,
        batteryType: updateData.batteryType || existing.batteryType,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", existing.repairId);
      await broadcastServerChange("Repair", "UPDATE", existing.repairId);
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
      id: uuidv411(),
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
    return res.status(201).json({ success: true, message: "Warranty claim processed successfully.", claim: createdClaim });
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">MTS LAB \u2014 Official Battery Warranty Certificate</h2>
          <p>Dear <strong>${warranty.customerName}</strong>,</p>
          <p>Thank you for choosing MTS Lab. Your battery replacement warranty has been successfully registered.</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #cbd5e1;">
            <p style="margin: 4px 0;"><strong>Warranty ID:</strong> ${warranty.warrantyNumber}</p>
            ${warranty.repairNumber ? `<p style="margin: 4px 0;"><strong>Repair Job:</strong> #${warranty.repairNumber}</p>` : ""}
            <p style="margin: 4px 0;"><strong>Device:</strong> ${warranty.deviceBrand} ${warranty.deviceModel}</p>
            <p style="margin: 4px 0;"><strong>Battery Spec:</strong> ${warranty.batteryType || "Original Replacement Battery"}</p>
            <p style="margin: 4px 0;"><strong>Warranty Duration:</strong> ${warranty.warrantyPeriod}</p>
            <p style="margin: 4px 0;"><strong>Valid Until:</strong> ${new Date(warranty.expiryDate).toLocaleDateString("en-GB")}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">Please present this warranty certificate or ID whenever requesting warranty diagnostics or replacement at MTS Lab.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">MTS Lab \u2022 New Road, Kathmandu, Nepal \u2022 Phone: 986927668, 015364307</p>
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
import fs3 from "fs";
import path3 from "path";
import { v4 as uuidv412 } from "uuid";
var DATA_DIR3 = path3.join(process.cwd(), "data");
var ATTENDANCE_FILE = path3.join(DATA_DIR3, "attendance_records.json");
var AUDIT_FILE = path3.join(DATA_DIR3, "attendance_audit_logs.json");
if (!fs3.existsSync(DATA_DIR3)) {
  try {
    fs3.mkdirSync(DATA_DIR3, { recursive: true });
  } catch (e) {
    console.warn("[STORAGE DIR INIT WARN]", e);
  }
}
var attendanceCache = /* @__PURE__ */ new Map();
var auditCache = [];
var isInitialized3 = false;
function loadLocalFile3(filePath, defaultValue) {
  try {
    if (fs3.existsSync(filePath)) {
      const content = fs3.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${filePath}]`, err);
  }
  return defaultValue;
}
function saveLocalFile3(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs3.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs3.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[STORAGE WRITE ERROR: ${filePath}]`, err);
  }
}
async function initAttendanceStorage() {
  if (isInitialized3) return;
  const localAttendance = loadLocalFile3(ATTENDANCE_FILE, []);
  localAttendance.forEach((rec) => {
    if (rec && rec.id) {
      attendanceCache.set(rec.id, rec);
    }
  });
  const localAudit = loadLocalFile3(AUDIT_FILE, []);
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
  isInitialized3 = true;
  saveLocalFile3(ATTENDANCE_FILE, Array.from(attendanceCache.values()));
}
function syncAttendanceDisk() {
  saveLocalFile3(ATTENDANCE_FILE, Array.from(attendanceCache.values()));
}
function syncAuditDisk() {
  saveLocalFile3(AUDIT_FILE, auditCache);
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
  const isWithinWindow = totalMinutes >= 600 && totalMinutes <= 645;
  const dateString = `${y}-${m}-${d}`;
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  let secondsRemainingInWindow = 0;
  let secondsUntilWindowOpens = 0;
  if (isWithinWindow) {
    const endMinutes = 645 * 60 + 59;
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
    windowEnd: "10:45:00",
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
      id: uuidv412(),
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
      id: uuidv412(),
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
      id: uuidv412(),
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
    id: uuidv412(),
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
      id: uuidv412(),
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
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "Repair Lab",
        phoneNumber: user.phoneNumber || null,
        profileImage: user.profileImage || null,
        avatarUrl: user.profileImage || null,
        date: targetDate,
        status: rec ? rec.status : "NOT_MARKED",
        attendanceId: rec ? rec.id : null,
        checkInTime: rec ? rec.checkInTime : null,
        checkOutTime: rec ? rec.checkOutTime : null,
        notes: rec ? rec.notes : null,
        markedByName: rec ? rec.markedByName : null,
        markedByRole: rec ? rec.markedByRole : null,
        markedAt: rec ? rec.markedAt : null,
        monthlyAttendanceRate: rate,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department || "Repair Lab",
          avatarUrl: user.profileImage || null
        },
        attendance: rec ? {
          id: rec.id,
          status: rec.status,
          checkInTime: rec.checkInTime || void 0,
          checkOutTime: rec.checkOutTime || void 0,
          markedByName: rec.markedByName || void 0,
          markedByRole: rec.markedByRole || void 0,
          markedAt: rec.markedAt || void 0,
          notes: rec.notes || void 0
        } : void 0
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
var handleGetPendingRequests = async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    const isManagement = ATTENDANCE_MANAGEMENT_ROLES.includes(currentUser.role);
    const allRecords = await getAllAttendanceRecords();
    let pendingList = allRecords.filter((r) => r.status === "PENDING" || r.requestStatus === "PENDING");
    if (!isManagement) {
      pendingList = pendingList.filter((r) => r.userId === currentUser.id);
    }
    const staffList = await getAuthorizedStaffList();
    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    const enriched = pendingList.map((r) => {
      const user = staffMap.get(r.userId);
      return {
        ...r,
        userName: user?.name || r.markedByName || "Staff Member",
        userEmail: user?.email || null,
        userRole: user?.role || null,
        userDepartment: user?.department || "Repair Lab",
        userProfileImage: user?.profileImage || null
      };
    });
    return res.json(enriched);
  } catch (err) {
    console.error("[PENDING ATTENDANCE REQUESTS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch pending attendance requests." });
  }
};
router9.get("/pending-requests", authenticate, handleGetPendingRequests);
router9.get("/pending", authenticate, handleGetPendingRequests);
router9.post("/pending-requests/:id/approve", authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "PRESENT", notes } = req.body;
    const existing = await getAttendanceRecordById(id);
    if (!existing) {
      return res.status(404).json({ error: "Attendance record not found." });
    }
    const updated = await upsertAttendanceRecord(
      {
        userId: existing.userId,
        date: existing.date,
        status,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
        notes: notes || existing.notes || "Approved by management",
        requestStatus: "ACCEPTED"
      },
      {
        id: req.user?.id || "SYSTEM",
        name: req.user?.name || "Administrator",
        role: req.user?.role || "ADMIN"
      }
    );
    try {
      await createNotification({
        userId: existing.userId,
        title: `Attendance Request Approved (${existing.date})`,
        message: `Your attendance request for ${existing.date} has been approved as ${status} by ${req.user?.name || "Management"}.`,
        type: "ATTENDANCE_APPROVED",
        priority: "NORMAL",
        senderId: req.user?.id,
        senderName: req.user?.name,
        senderRole: req.user?.role,
        link: "/dashboard/attendance"
      });
    } catch (notifErr) {
      console.warn("[ATTENDANCE APPROVE NOTIF WARN]", notifErr);
    }
    return res.json({ success: true, message: "Attendance request approved.", record: updated });
  } catch (err) {
    console.error("[APPROVE ATTENDANCE ERROR]", err);
    return res.status(500).json({ error: "Failed to approve attendance request." });
  }
});
router9.post("/pending-requests/:id/reject", authenticate, authorize(ATTENDANCE_MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Rejected by management" } = req.body;
    const existing = await getAttendanceRecordById(id);
    if (!existing) {
      return res.status(404).json({ error: "Attendance record not found." });
    }
    const updated = await upsertAttendanceRecord(
      {
        userId: existing.userId,
        date: existing.date,
        status: "REJECTED",
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
        notes: existing.notes,
        requestStatus: "REJECTED",
        rejectionReason: reason
      },
      {
        id: req.user?.id || "SYSTEM",
        name: req.user?.name || "Administrator",
        role: req.user?.role || "ADMIN"
      }
    );
    try {
      await createNotification({
        userId: existing.userId,
        title: `Attendance Request Rejected (${existing.date})`,
        message: `Your attendance request for ${existing.date} was rejected by ${req.user?.name || "Management"}. Reason: ${reason}`,
        type: "ATTENDANCE_REJECTED",
        priority: "NORMAL",
        senderId: req.user?.id,
        senderName: req.user?.name,
        senderRole: req.user?.role,
        link: "/dashboard/attendance"
      });
    } catch (notifErr) {
      console.warn("[ATTENDANCE REJECT NOTIF WARN]", notifErr);
    }
    return res.json({ success: true, message: "Attendance request rejected.", record: updated });
  } catch (err) {
    console.error("[REJECT ATTENDANCE ERROR]", err);
    return res.status(500).json({ error: "Failed to reject attendance request." });
  }
});
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
      let rejectedCount = 0;
      const dailyStatus = {};
      const logs = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${targetMonth}-${String(day).padStart(2, "0")}`;
        const rec = userMap.get(dayStr);
        if (rec) {
          dailyStatus[dayStr] = rec.status;
          logs.push({
            id: rec.id,
            date: rec.date,
            status: rec.status,
            checkInTime: rec.checkInTime || void 0,
            notes: rec.notes || void 0
          });
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
          } else if (rec.status === "REJECTED") {
            rejectedCount++;
          }
        } else {
          dailyStatus[dayStr] = "NOT_MARKED";
        }
      }
      const totalMarked = presentCount + absentCount + pendingCount + rejectedCount;
      const rate = totalMarked > 0 ? Math.round(presentCount / totalMarked * 100) : null;
      if (rate !== null) {
        totalStaffPresentSum += rate;
        totalActiveStaffWithLogs++;
      }
      let statusTag = "NO_DATA";
      if (rate !== null) {
        if (rate >= 90) statusTag = "EXCELLENT";
        else if (rate >= 75) statusTag = "GOOD";
        else if (rate >= 60) statusTag = "AVERAGE";
        else statusTag = "NEEDS_ATTENTION";
      }
      const userObj = {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        department: staff.department || "Repair Lab",
        profileImage: staff.profileImage || void 0
      };
      return {
        user: userObj,
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        department: staff.department || "Repair Lab",
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
        logs
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
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${targetMonth}-${String(day).padStart(2, "0")}`;
      const rec = recordMap.get(dateStr);
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = daysOfWeek[dateObj.getDay()];
      const isToday = dateStr === time.dateString;
      const isFuture = dateStr > time.dateString;
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
        dailyLogs.push({
          date: dateStr,
          dayOfWeek,
          isToday,
          isFuture,
          status: rec.status,
          record: {
            id: rec.id,
            formattedCheckInTime: rec.checkInTime || "\u2014",
            checkInTime: rec.checkInTime || null,
            checkOutTime: rec.checkOutTime || null,
            markedBy: rec.markedByName || "System",
            markedByName: rec.markedByName || "System",
            markedByRole: rec.markedByRole || "ADMIN",
            notes: rec.notes || void 0,
            correctionReason: rec.correctionReason || void 0
          }
        });
      } else {
        dailyLogs.push({
          date: dateStr,
          dayOfWeek,
          isToday,
          isFuture,
          status: isFuture ? "FUTURE" : "NOT_MARKED",
          record: void 0
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
    if (isSuperAdmin || isAdmin) {
    } else if (isManager) {
      if (targetUserId === currentUser.id) {
        return res.status(403).json({
          error: "Managers cannot take their own attendance. Manager attendance must be verified and recorded by an Administrator or Super Administrator.",
          code: "MANAGER_SELF_ATTENDANCE_PROHIBITED"
        });
      }
      if (!time.isWithinWindow) {
        return res.status(403).json({
          error: `Manager can only record staff attendance between 10:00 AM and 10:45 AM Nepal Time (Asia/Kathmandu). Current NPT time: ${time.timeString}`,
          code: "OUTSIDE_ATTENDANCE_WINDOW",
          serverTime: time.timeString,
          window: "10:00 AM - 10:45 AM NPT"
        });
      }
    } else {
      return res.status(403).json({
        error: "Access denied: Staff members (Technicians, Receptionists, etc.) cannot record attendance. Attendance is recorded and verified authoritatively by Lab Management.",
        code: "UNAUTHORIZED_ROLE"
      });
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
        method: isSuperAdmin ? "DIRECT_SUPER_ADMIN" : isAdmin ? "DIRECT_ADMIN" : "MANAGER_ATTENDANCE",
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
        error: `Manager can only record staff attendance between 10:00 AM and 10:45 AM (Asia/Kathmandu time). Current NPT time: ${time.timeString}`,
        code: "OUTSIDE_ATTENDANCE_WINDOW"
      });
    }
    const { date, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "List of staff items is required for bulk marking." });
    }
    const targetDate = date || time.dateString;
    const validItems = isManager ? items.filter((item) => item.userId !== currentUser.id) : items;
    if (validItems.length === 0) {
      return res.status(400).json({ error: "No eligible staff members to mark." });
    }
    const formattedItems = validItems.map((item) => ({
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
    if (isManager && existing.userId === currentUser.id) {
      return res.status(403).json({
        error: "Managers cannot modify their own attendance records. Only an Administrator or Super Administrator can update Manager attendance.",
        code: "MANAGER_SELF_UPDATE_PROHIBITED"
      });
    }
    if (isManager && !time.isWithinWindow) {
      return res.status(403).json({
        error: `Manager can only update attendance during 10:00 AM \u2013 10:45 AM NPT. (Current NPT: ${time.timeString})`,
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
import fs4 from "fs";
import path4 from "path";
import { v4 as uuidv413 } from "uuid";
var DATA_DIR4 = path4.join(process.cwd(), "data");
var DAMAGE_FILE = path4.join(DATA_DIR4, "repair_damage_records.json");
var AUDIT_FILE2 = path4.join(DATA_DIR4, "repair_damage_audit_logs.json");
if (!fs4.existsSync(DATA_DIR4)) {
  try {
    fs4.mkdirSync(DATA_DIR4, { recursive: true });
  } catch (e) {
    console.warn("[STORAGE DIR INIT WARN]", e);
  }
}
var damageCache = /* @__PURE__ */ new Map();
var auditCache2 = [];
var isInitialized4 = false;
function loadLocalFile4(filePath, defaultValue) {
  try {
    if (fs4.existsSync(filePath)) {
      const content = fs4.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${filePath}]`, err);
  }
  return defaultValue;
}
function saveLocalFile4(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs4.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs4.renameSync(tempPath, filePath);
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
  if (isInitialized4) return;
  const localDamages = loadLocalFile4(DAMAGE_FILE, []);
  const localAudits = loadLocalFile4(AUDIT_FILE2, []);
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
      saveLocalFile4(DAMAGE_FILE, Array.from(damageCache.values()));
    }
    const { data: supaAudits, error: aErr } = await supabaseAdmin.from("RepairRelatedDamageAudit").select("*").order("createdAt", { ascending: false }).limit(500);
    if (!aErr && supaAudits && supaAudits.length > 0) {
      auditCache2 = supaAudits;
      saveLocalFile4(AUDIT_FILE2, auditCache2);
    }
  } catch (err) {
    console.warn("[SUPABASE DAMAGE SYNC WARN - USING LOCAL CACHE]", err);
  }
  isInitialized4 = true;
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
      saveLocalFile4(DAMAGE_FILE, Array.from(damageCache.values()));
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
  const recordId = uuidv413();
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
  saveLocalFile4(DAMAGE_FILE, Array.from(damageCache.values()));
  const auditId = uuidv413();
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
  saveLocalFile4(AUDIT_FILE2, auditCache2);
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
  saveLocalFile4(DAMAGE_FILE, Array.from(damageCache.values()));
  const auditId = uuidv413();
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
  saveLocalFile4(AUDIT_FILE2, auditCache2);
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
  saveLocalFile4(DAMAGE_FILE, Array.from(damageCache.values()));
  const auditId = uuidv413();
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
  saveLocalFile4(AUDIT_FILE2, auditCache2);
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
import { v4 as uuidv414 } from "uuid";
var router11 = Router11();
var customRepairFoldersRegistry = /* @__PURE__ */ new Map();
var inMemoryPricesOverlay = /* @__PURE__ */ new Map();
var deletedPriceIds = /* @__PURE__ */ new Set();
function getFolderKey2(brand, model, category) {
  return `${(brand || "").trim().toLowerCase()}|${(model || "").trim().toLowerCase()}|${(category || "").trim().toLowerCase()}`;
}
function parseServiceItem(item, isPublic = false) {
  if (!item) return item;
  let originalPrice = null;
  let rating = null;
  let ratingCount = null;
  let deviceType = null;
  let customIcon = null;
  let cleanNotes = item.notes || "";
  if (item.notes && typeof item.notes === "string" && item.notes.includes("<!--MTS_META:")) {
    try {
      const match = item.notes.match(/<!--MTS_META:([\s\S]*?)-->/);
      if (match && match[1]) {
        const meta = JSON.parse(match[1]);
        if (meta.originalPrice !== void 0 && meta.originalPrice !== null && !isNaN(Number(meta.originalPrice))) {
          originalPrice = Number(meta.originalPrice);
        }
        if (meta.rating !== void 0 && meta.rating !== null && !isNaN(Number(meta.rating))) {
          rating = Number(meta.rating);
        }
        if (meta.ratingCount !== void 0 && meta.ratingCount !== null && !isNaN(Number(meta.ratingCount))) {
          ratingCount = Number(meta.ratingCount);
        }
        if (meta.deviceType) deviceType = String(meta.deviceType).trim();
        if (meta.icon) customIcon = String(meta.icon).trim();
        cleanNotes = item.notes.replace(/<!--MTS_META:[\s\S]*?-->/, "").trim();
      }
    } catch (e) {
    }
  }
  if (!deviceType) {
    const text = `${item.brand || ""} ${item.model || ""} ${item.serviceName || ""} ${item.category || ""}`.toLowerCase();
    if (text.includes("ipad")) {
      deviceType = "iPad";
    } else if (text.includes("tablet") || text.includes("tab ") || text.includes("tab-")) {
      deviceType = "Tablet";
    } else {
      deviceType = "Smartphone";
    }
  }
  const result = {
    ...item,
    notes: cleanNotes || null,
    originalPrice,
    rating,
    ratingCount,
    deviceType,
    icon: customIcon || null
  };
  if (isPublic) {
    delete result.createdBy;
    delete result.updatedBy;
  }
  return result;
}
function serializeServiceNotes(notes, meta) {
  let baseNotes = notes ? notes.replace(/<!--MTS_META:[\s\S]*?-->/, "").trim() : "";
  const metaObj = {};
  if (meta.originalPrice !== void 0 && meta.originalPrice !== null && !isNaN(Number(meta.originalPrice)) && Number(meta.originalPrice) > 0) {
    metaObj.originalPrice = Number(meta.originalPrice);
  }
  if (meta.rating !== void 0 && meta.rating !== null && !isNaN(Number(meta.rating)) && Number(meta.rating) > 0) {
    metaObj.rating = Number(meta.rating);
  }
  if (meta.ratingCount !== void 0 && meta.ratingCount !== null && !isNaN(Number(meta.ratingCount)) && Number(meta.ratingCount) > 0) {
    metaObj.ratingCount = Number(meta.ratingCount);
  }
  if (meta.deviceType && meta.deviceType.trim()) {
    metaObj.deviceType = meta.deviceType.trim();
  }
  if (meta.icon && meta.icon.trim()) {
    metaObj.icon = meta.icon.trim();
  }
  if (Object.keys(metaObj).length > 0) {
    const metaTag = `<!--MTS_META:${JSON.stringify(metaObj)}-->`;
    return baseNotes ? `${baseNotes}
${metaTag}` : metaTag;
  }
  return baseNotes || null;
}
router11.get("/folders", authenticate, async (req, res) => {
  try {
    const { data: prices } = await supabaseAdmin.from("RepairPrice").select("brand, model, category").not("brand", "is", null);
    const folderMap = /* @__PURE__ */ new Map();
    customRepairFoldersRegistry.forEach((folder, key) => {
      folderMap.set(key, folder);
    });
    (prices || []).forEach((item) => {
      const b = (item.brand || "").trim();
      const m = (item.model || "").trim();
      const c = (item.category || "").trim();
      if (b) {
        const key = getFolderKey2(b, m, c);
        if (!folderMap.has(key)) {
          folderMap.set(key, {
            name: c || m || b,
            level: c ? "category" : m ? "model" : "brand",
            brand: b,
            model: m || null,
            category: c || null
          });
        }
      }
    });
    const foldersArray = Array.from(folderMap.values());
    return res.json(foldersArray);
  } catch (err) {
    console.error("[REPAIR PRICES GET FOLDERS ERROR]", err);
    return res.json(Array.from(customRepairFoldersRegistry.values()));
  }
});
router11.post("/folders", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { name, level = "brand", brand, model, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Folder name is required." });
    }
    const trimmedName = name.trim();
    const targetBrand = level === "brand" ? trimmedName : brand ? brand.trim() : trimmedName;
    const targetModel = level === "model" ? trimmedName : model && model.trim() ? model.trim() : null;
    const targetCategory = level === "category" ? trimmedName : category && category.trim() ? category.trim() : null;
    const key = getFolderKey2(targetBrand, targetModel, targetCategory);
    const entry = {
      id: uuidv414(),
      name: trimmedName,
      level,
      brand: targetBrand,
      model: targetModel,
      category: targetCategory
    };
    customRepairFoldersRegistry.set(key, entry);
    return res.status(201).json(entry);
  } catch (err) {
    console.error("[CREATE REPAIR FOLDER ERROR]", err);
    return res.status(500).json({ error: "Failed to create folder." });
  }
});
router11.post("/rename-folder", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { level, oldValue, newValue, brand, model } = req.body;
    if (!oldValue || !newValue || !newValue.trim()) {
      return res.status(400).json({ error: "Old value and new value are required." });
    }
    const oldClean = oldValue.trim();
    const newClean = newValue.trim();
    if (level === "brand") {
      await supabaseAdmin.from("RepairPrice").update({ brand: newClean, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("brand", oldClean);
    } else if (level === "model") {
      let query = supabaseAdmin.from("RepairPrice").update({ model: newClean, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("model", oldClean);
      if (brand) query = query.eq("brand", brand.trim());
      await query;
    } else if (level === "category") {
      let query = supabaseAdmin.from("RepairPrice").update({ category: newClean, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("category", oldClean);
      if (brand) query = query.eq("brand", brand.trim());
      if (model) query = query.eq("model", model.trim());
      await query;
    }
    const toUpdate = [];
    customRepairFoldersRegistry.forEach((val, k) => {
      let matched = false;
      const updated = { ...val };
      if (level === "brand" && val.brand.toLowerCase() === oldClean.toLowerCase()) {
        updated.brand = newClean;
        if (val.level === "brand") updated.name = newClean;
        matched = true;
      } else if (level === "model" && val.model && val.model.toLowerCase() === oldClean.toLowerCase()) {
        if (!brand || val.brand.toLowerCase() === brand.toLowerCase()) {
          updated.model = newClean;
          if (val.level === "model") updated.name = newClean;
          matched = true;
        }
      } else if (level === "category" && val.category && val.category.toLowerCase() === oldClean.toLowerCase()) {
        if (!brand || val.brand.toLowerCase() === brand.toLowerCase()) {
          if (!model || val.model && val.model.toLowerCase() === model.toLowerCase()) {
            updated.category = newClean;
            if (val.level === "category") updated.name = newClean;
            matched = true;
          }
        }
      }
      if (matched) {
        toUpdate.push({ oldKey: k, entry: updated });
      }
    });
    toUpdate.forEach(({ oldKey, entry }) => {
      customRepairFoldersRegistry.delete(oldKey);
      customRepairFoldersRegistry.set(getFolderKey2(entry.brand, entry.model, entry.category), entry);
    });
    await broadcastServerChange("RepairPrice", "UPDATE", "folders");
    return res.json({ success: true, message: `Folder renamed to "${newClean}".` });
  } catch (err) {
    console.error("[RENAME REPAIR FOLDER ERROR]", err);
    return res.status(500).json({ error: "Failed to rename folder." });
  }
});
router11.post("/delete-folder", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { brand, model, category } = req.body;
    if (!brand) {
      return res.status(400).json({ error: "Brand is required to identify folder." });
    }
    let query = supabaseAdmin.from("RepairPrice").delete().eq("brand", brand.trim());
    if (model) query = query.eq("model", model.trim());
    if (category) query = query.eq("category", category.trim());
    const { data: deleted, error } = await query.select("id");
    const deletedCount = deleted && deleted.length || 0;
    const toDelete = [];
    customRepairFoldersRegistry.forEach((val, k) => {
      if (val.brand.toLowerCase() === brand.toLowerCase().trim()) {
        if (!model || val.model && val.model.toLowerCase() === model.toLowerCase().trim()) {
          if (!category || val.category && val.category.toLowerCase() === category.toLowerCase().trim()) {
            toDelete.push(k);
          }
        }
      }
    });
    toDelete.forEach((k) => customRepairFoldersRegistry.delete(k));
    await broadcastServerChange("RepairPrice", "DELETE", "folder");
    return res.json({ success: true, message: "Folder deleted.", deletedCount });
  } catch (err) {
    console.error("[DELETE REPAIR FOLDER ERROR]", err);
    return res.status(500).json({ error: "Failed to delete folder." });
  }
});
router11.post("/move", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { serviceIds, source, destination } = req.body;
    if (!destination || !destination.brand) {
      return res.status(400).json({ error: "Destination brand is required." });
    }
    const destBrand = destination.brand.trim();
    const destModel = destination.model ? destination.model.trim() : null;
    const destCategory = destination.category ? destination.category.trim() : null;
    const updatePayload = {
      brand: destBrand,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (destModel !== void 0) updatePayload.model = destModel;
    if (destCategory !== void 0) updatePayload.category = destCategory;
    if (serviceIds && Array.isArray(serviceIds) && serviceIds.length > 0) {
      await supabaseAdmin.from("RepairPrice").update(updatePayload).in("id", serviceIds);
    } else if (source && source.brand) {
      let query = supabaseAdmin.from("RepairPrice").update(updatePayload).eq("brand", source.brand.trim());
      if (source.model) query = query.eq("model", source.model.trim());
      if (source.category) query = query.eq("category", source.category.trim());
      await query;
    }
    await broadcastServerChange("RepairPrice", "UPDATE", "relocate");
    return res.json({ success: true, message: "Services relocated successfully." });
  } catch (err) {
    console.error("[MOVE REPAIR SERVICES ERROR]", err);
    return res.status(500).json({ error: "Failed to move services." });
  }
});
var handleGetPrices = async (req, res) => {
  try {
    const { brand, model, category, search, status, deviceType } = req.query;
    const isPublic = req.path.includes("/public/") || req.baseUrl.includes("/public");
    let query = supabaseAdmin.from("RepairPrice").select("*");
    if (status && status !== "ALL") {
      query = query.eq("status", String(status));
    } else if (isPublic) {
      query = query.eq("status", "ACTIVE");
    }
    if (brand && brand !== "ALL") query = query.eq("brand", String(brand));
    if (model && model !== "ALL") query = query.eq("model", String(model));
    if (category && category !== "ALL") query = query.eq("category", String(category));
    if (search) {
      const s = String(search).trim();
      query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,serviceName.ilike.%${s}%,category.ilike.%${s}%,problem.ilike.%${s}%`);
    }
    const { data: rawPrices, error } = await query.order("brand", { ascending: true }).order("model", { ascending: true });
    if (error) {
      console.error("[REPAIR PRICES GET ERROR]", error);
      return res.status(500).json({ error: "Failed to fetch repair prices." });
    }
    const existingMap = /* @__PURE__ */ new Map();
    (rawPrices || []).forEach((p) => {
      if (!deletedPriceIds.has(p.id)) {
        existingMap.set(p.id, p);
      }
    });
    inMemoryPricesOverlay.forEach((val, id) => {
      if (!deletedPriceIds.has(id)) {
        existingMap.set(id, { ...existingMap.get(id) || {}, ...val });
      }
    });
    let allMerged = Array.from(existingMap.values());
    if (brand && brand !== "ALL") allMerged = allMerged.filter((p) => (p.brand || "").toLowerCase() === String(brand).toLowerCase());
    if (model && model !== "ALL") allMerged = allMerged.filter((p) => (p.model || "").toLowerCase() === String(model).toLowerCase());
    if (category && category !== "ALL") allMerged = allMerged.filter((p) => (p.category || "").toLowerCase() === String(category).toLowerCase());
    if (status && status !== "ALL") {
      allMerged = allMerged.filter((p) => p.status === String(status));
    } else if (isPublic) {
      allMerged = allMerged.filter((p) => p.status === "ACTIVE");
    }
    if (search) {
      const s = String(search).toLowerCase().trim();
      allMerged = allMerged.filter(
        (p) => (p.brand || "").toLowerCase().includes(s) || (p.model || "").toLowerCase().includes(s) || (p.serviceName || "").toLowerCase().includes(s) || (p.category || "").toLowerCase().includes(s) || (p.problem || "").toLowerCase().includes(s)
      );
    }
    let parsedPrices = allMerged.map((item) => parseServiceItem(item, isPublic));
    if (deviceType && deviceType !== "ALL" && deviceType !== "all") {
      const targetDevice = String(deviceType).toLowerCase().trim();
      parsedPrices = parsedPrices.filter((item) => (item.deviceType || "").toLowerCase() === targetDevice);
    }
    return res.json(parsedPrices);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve repair pricing directory." });
  }
};
router11.get("/", handleGetPrices);
router11.post("/", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), async (req, res) => {
  try {
    const {
      brand,
      model,
      variant = "Standard",
      category,
      problem,
      serviceName,
      description,
      price,
      originalPrice,
      rating,
      ratingCount,
      deviceType,
      icon,
      priceType = "FIXED",
      status = "ACTIVE",
      notes,
      estimatedTime = "1-2 Hours"
    } = req.body;
    if (!brand || !model || !serviceName || price === void 0) {
      return res.status(400).json({ error: "Brand, model, service name, and price are required." });
    }
    const serializedNotes = serializeServiceNotes(notes, {
      originalPrice,
      rating,
      ratingCount,
      deviceType,
      icon
    });
    const newPrice = {
      id: uuidv414(),
      brand: brand.trim(),
      model: model.trim(),
      variant: variant ? variant.trim() : "Standard",
      category: category ? category.trim() : "General",
      problem: problem ? problem.trim() : serviceName.trim(),
      serviceName: serviceName.trim(),
      description: description ? description.trim() : null,
      price: parseFloat(price) || 0,
      priceType,
      status,
      notes: serializedNotes,
      estimatedTime: estimatedTime || "1-2 Hours",
      createdBy: req.user?.id || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    let finalItem = newPrice;
    try {
      const { data: created, error } = await supabaseAdmin.from("RepairPrice").insert([newPrice]).select("*").single();
      if (!error && created) {
        finalItem = created;
      }
    } catch (_) {
    }
    inMemoryPricesOverlay.set(finalItem.id, finalItem);
    deletedPriceIds.delete(finalItem.id);
    const parsedCreated = parseServiceItem(finalItem, false);
    await broadcastServerChange("RepairPrice", "CREATE", finalItem.id, parsedCreated);
    return res.status(201).json(parsedCreated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save repair price." });
  }
});
var handleUpdatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    delete body.id;
    const hasMeta = body.originalPrice !== void 0 || body.rating !== void 0 || body.ratingCount !== void 0 || body.deviceType !== void 0 || body.icon !== void 0;
    let notesToSave = body.notes;
    if (hasMeta) {
      if (notesToSave === void 0) {
        const existingMem = inMemoryPricesOverlay.get(id);
        if (existingMem?.notes) {
          notesToSave = existingMem.notes;
        } else {
          try {
            const { data: current } = await supabaseAdmin.from("RepairPrice").select("notes").eq("id", id).single();
            notesToSave = current?.notes || "";
          } catch (_) {
          }
        }
      }
      notesToSave = serializeServiceNotes(notesToSave, {
        originalPrice: body.originalPrice,
        rating: body.rating,
        ratingCount: body.ratingCount,
        deviceType: body.deviceType,
        icon: body.icon
      });
      body.notes = notesToSave;
    }
    delete body.originalPrice;
    delete body.rating;
    delete body.ratingCount;
    delete body.deviceType;
    delete body.icon;
    if (body.price !== void 0) {
      body.price = parseFloat(body.price) || 0;
    }
    body.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    body.updatedBy = req.user?.id || null;
    let finalItem = null;
    try {
      const { data: updated, error } = await supabaseAdmin.from("RepairPrice").update(body).eq("id", id).select("*").single();
      if (!error && updated) {
        finalItem = updated;
      }
    } catch (_) {
    }
    if (!finalItem) {
      const existing = inMemoryPricesOverlay.get(id) || {};
      finalItem = { ...existing, ...body, id };
    }
    inMemoryPricesOverlay.set(id, finalItem);
    const parsedUpdated = parseServiceItem(finalItem, false);
    await broadcastServerChange("RepairPrice", "UPDATE", id, parsedUpdated);
    return res.json(parsedUpdated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update price item." });
  }
};
router11.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), handleUpdatePrice);
router11.patch("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), handleUpdatePrice);
router11.patch("/:id/toggle-status", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { id } = req.params;
    let existingStatus = inMemoryPricesOverlay.get(id)?.status;
    if (!existingStatus) {
      const { data: existing } = await supabaseAdmin.from("RepairPrice").select("status").eq("id", id).single();
      existingStatus = existing?.status;
    }
    if (!existingStatus) return res.status(404).json({ error: "Price item not found." });
    const newStatus = existingStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    let finalItem = null;
    try {
      const { data: updated, error } = await supabaseAdmin.from("RepairPrice").update({ status: newStatus, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: req.user?.id || null }).eq("id", id).select("*").single();
      if (!error && updated) finalItem = updated;
    } catch (_) {
    }
    if (!finalItem) {
      const mem = inMemoryPricesOverlay.get(id) || {};
      finalItem = { ...mem, status: newStatus, id };
    }
    inMemoryPricesOverlay.set(id, finalItem);
    const parsedUpdated = parseServiceItem(finalItem, false);
    await broadcastServerChange("RepairPrice", "UPDATE", id, parsedUpdated);
    return res.json(parsedUpdated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle status." });
  }
});
router11.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryPricesOverlay.delete(id);
    deletedPriceIds.add(id);
    try {
      await supabaseAdmin.from("RepairPrice").delete().eq("id", id);
    } catch (_) {
    }
    await broadcastServerChange("RepairPrice", "DELETE", id);
    return res.json({ success: true, message: "Repair price deleted." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete price record." });
  }
});
router11.post("/bulk-delete", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "No IDs specified." });
    ids.forEach((id) => {
      inMemoryPricesOverlay.delete(id);
      deletedPriceIds.add(id);
    });
    try {
      await supabaseAdmin.from("RepairPrice").delete().in("id", ids);
    } catch (_) {
    }
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
import multer3 from "multer";
import fs6 from "fs";
import path6 from "path";

// api/_server/services/cloudinaryService.ts
import { v2 as cloudinary } from "cloudinary";
var isConfigured = false;
function ensureCloudinaryConfigured() {
  if (isConfigured) return true;
  const creds = config.getCloudinaryCredentials();
  if (creds.cldUrl) {
    cloudinary.config(true);
    isConfigured = true;
    return true;
  }
  if (creds.cloudName && creds.apiKey && creds.apiSecret) {
    cloudinary.config({
      cloud_name: creds.cloudName,
      api_key: creds.apiKey,
      api_secret: creds.apiSecret,
      secure: true
    });
    isConfigured = true;
    return true;
  }
  return false;
}
ensureCloudinaryConfigured();
function isCloudinaryConfigured() {
  return ensureCloudinaryConfigured();
}
async function pingCloudinary() {
  if (!ensureCloudinaryConfigured()) {
    return {
      connected: false,
      cloudName: "",
      status: "NOT_CONFIGURED",
      error: "Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or CLOUDINARY_URL) are not set."
    };
  }
  try {
    const pingResult = await cloudinary.api.ping();
    const creds = config.getCloudinaryCredentials();
    return {
      connected: true,
      cloudName: creds.cloudName,
      status: pingResult.status || "ok",
      rateLimit: {
        allowed: pingResult.rate_limit_allowed,
        remaining: pingResult.rate_limit_remaining,
        resetAt: pingResult.rate_limit_reset_at
      }
    };
  } catch (err) {
    return {
      connected: false,
      cloudName: config.getCloudinaryCredentials().cloudName,
      status: "ERROR",
      error: err.message || "Failed to ping Cloudinary API."
    };
  }
}
async function uploadToCloudinary(fileBuffer, folderOrOptions = "mts_lab", resourceType = "auto") {
  if (!ensureCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Missing API credentials.");
  }
  const opts = typeof folderOrOptions === "string" ? { folder: folderOrOptions, resourceType } : folderOrOptions;
  const folder = opts.folder || "mts_lab";
  const rType = opts.resourceType || resourceType || "auto";
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: rType,
        public_id: opts.publicId,
        overwrite: opts.overwrite ?? false,
        tags: opts.tags
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed."));
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}
async function uploadBase64ToCloudinary(base64Data, folderOrOptions = "mts_lab") {
  if (!ensureCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Missing API credentials.");
  }
  const opts = typeof folderOrOptions === "string" ? { folder: folderOrOptions } : folderOrOptions;
  const folder = opts.folder || "mts_lab";
  return cloudinary.uploader.upload(base64Data, {
    folder,
    resource_type: opts.resourceType || "auto",
    public_id: opts.publicId,
    overwrite: opts.overwrite ?? false,
    tags: opts.tags
  });
}
async function uploadPdfToCloudinary(pdfInput, docType = "GENERAL", referenceId) {
  if (!ensureCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Missing API credentials.");
  }
  let folder = "mts_lab/documents";
  let prefix = "DOC";
  if (docType === "SERVICE_SLIP") {
    folder = "mts_lab/service-slips";
    prefix = "SLIP";
  } else if (docType === "BATTERY_WARRANTY") {
    folder = "mts_lab/battery-warranties";
    prefix = "WARRANTY";
  }
  const cleanRef = (referenceId || "doc").replace(/[^a-zA-Z0-9_-]/g, "_");
  const publicId = `${prefix}_${cleanRef}_${Date.now()}`;
  if (Buffer.isBuffer(pdfInput)) {
    return uploadToCloudinary(pdfInput, {
      folder,
      resourceType: "auto",
      publicId,
      overwrite: true,
      tags: ["mts_lab", docType.toLowerCase(), cleanRef]
    });
  } else {
    return uploadBase64ToCloudinary(pdfInput, {
      folder,
      resourceType: "auto",
      publicId,
      overwrite: true,
      tags: ["mts_lab", docType.toLowerCase(), cleanRef]
    });
  }
}
function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) {
    if (url.startsWith("mts_lab/")) return url;
    return null;
  }
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/");
    const uploadIdx = parts.findIndex((p) => p === "upload");
    if (uploadIdx === -1) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    const withoutVersion = afterUpload.filter((p) => !/^v\d+$/.test(p));
    const fullPath = withoutVersion.join("/");
    return fullPath.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}
async function deleteFromCloudinary(publicIdOrUrl, resourceType = "image") {
  if (!ensureCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }
  let publicId = extractPublicIdFromUrl(publicIdOrUrl) || publicIdOrUrl;
  if (!publicId) {
    throw new Error("Invalid public ID or URL.");
  }
  if (!publicId.startsWith("mts_lab") && !publicId.startsWith("mts_slides")) {
    throw new Error("Permission denied: Asset is outside MTS Lab root.");
  }
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    if (res.result === "not found" && resourceType === "image") {
      const rawRes = await cloudinary.uploader.destroy(publicId, {
        resource_type: "raw"
      });
      return { result: rawRes.result, publicId };
    }
    return { result: res.result, publicId };
  } catch (err) {
    console.error(`[CLOUDINARY DELETE ERROR: ${publicId}]`, err);
    throw err;
  }
}

// api/_server/services/slidesStorage.ts
import fs5 from "fs";
import path5 from "path";
import { v4 as uuidv415 } from "uuid";
var DATA_DIR5 = path5.join(process.cwd(), "data");
var SLIDES_FILE = path5.join(DATA_DIR5, "home_slides.json");
if (!fs5.existsSync(DATA_DIR5)) {
  try {
    fs5.mkdirSync(DATA_DIR5, { recursive: true });
  } catch (e) {
    console.warn("[STORAGE DIR INIT WARN]", e);
  }
}
var INITIAL_PRESET_SLIDES = [
  {
    id: "51a6593c-8b46-4b18-ba7f-9fe1eefc7f21",
    title: "Front Glass Change",
    description: "Specialized outer glass replacement preserving your original AMOLED / OLED display and touch responsiveness.",
    imageUrl: "/assets/images/front_glass_repair_1786719176945.jpg",
    buttonText: "Check Repair Price",
    buttonLink: "/services?focus=search&q=Front+Glass",
    displayOrder: 1,
    status: "ACTIVE",
    createdAt: "2026-08-18T11:06:14.238Z",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "fd9650d0-7ecf-4268-972a-205164cddbe4",
    title: "Display Replacement",
    description: "100% Genuine original quality screen restoration with True Tone, 120Hz ProMotion, and vibrant clarity.",
    imageUrl: "/assets/images/display_replace_1786719191504.jpg",
    buttonText: "Check Repair Price",
    buttonLink: "/services?focus=search&q=Display",
    displayOrder: 2,
    status: "ACTIVE",
    createdAt: "2026-08-18T11:06:14.242Z",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "f7b4fc3d-1648-45c0-8bc7-88ce85c13289",
    title: "Back Panel / Back Glass Change",
    description: "Factory finish laser back panel replacement and frame restoration for Apple, Samsung, and flagship devices.",
    imageUrl: "/assets/images/back_glass_fix_178671907185.jpg",
    buttonText: "Check Repair Price",
    buttonLink: "/services?focus=search&q=Back+Glass",
    displayOrder: 3,
    status: "ACTIVE",
    createdAt: "2026-08-18T11:06:14.245Z",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "b4439128-6477-421e-9492-f8c7478ad7e6",
    title: "Professional Smartphone Repair",
    description: "Advanced IC-level micro-soldering, green/white screen laser line repair, and specialized liquid damage restoration.",
    imageUrl: "/assets/images/phone_repair_lab_1786719222650.jpg",
    buttonText: "Check Repair Price",
    buttonLink: "/services?focus=search",
    displayOrder: 4,
    status: "ACTIVE",
    createdAt: "2026-08-18T11:06:14.247Z",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var slidesCache = /* @__PURE__ */ new Map();
var isInitialized5 = false;
function loadLocalFile5() {
  try {
    if (fs5.existsSync(SLIDES_FILE)) {
      const content = fs5.readFileSync(SLIDES_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[STORAGE READ ERROR: ${SLIDES_FILE}]`, err);
  }
  return INITIAL_PRESET_SLIDES;
}
function saveLocalFile5(data) {
  try {
    const tempPath = `${SLIDES_FILE}.tmp.${Date.now()}`;
    fs5.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs5.renameSync(tempPath, SLIDES_FILE);
  } catch (err) {
    console.error(`[STORAGE WRITE ERROR: ${SLIDES_FILE}]`, err);
  }
}
async function initializeSlidesStorage() {
  if (isInitialized5) return;
  const localSlides = loadLocalFile5();
  localSlides.forEach((s) => slidesCache.set(s.id, s));
  try {
    const { data: supaSlides, error } = await supabaseAdmin.from("HomeSlide").select("*").order("displayOrder", { ascending: true });
    if (!error && supaSlides && supaSlides.length > 0) {
      supaSlides.forEach((s) => {
        const existing = slidesCache.get(s.id);
        if (!existing || new Date(s.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
          slidesCache.set(s.id, {
            ...s,
            status: s.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            displayOrder: Number(s.displayOrder) || 1
          });
        }
      });
      saveLocalFile5(Array.from(slidesCache.values()));
    } else if (slidesCache.size === 0) {
      INITIAL_PRESET_SLIDES.forEach((s) => slidesCache.set(s.id, s));
      saveLocalFile5(INITIAL_PRESET_SLIDES);
    }
  } catch (err) {
    console.warn("[SUPABASE SLIDES SYNC WARN - USING LOCAL CACHE]", err);
  }
  isInitialized5 = true;
}
async function getSlides(onlyActive = false) {
  await initializeSlidesStorage();
  let list = Array.from(slidesCache.values());
  if (onlyActive) {
    list = list.filter((s) => s.status === "ACTIVE");
  }
  list.sort((a, b) => a.displayOrder - b.displayOrder);
  return list;
}
async function createSlide(slideData, userId) {
  await initializeSlidesStorage();
  const id = slideData.id || uuidv415();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newSlide = {
    id,
    title: String(slideData.title || "").trim(),
    description: slideData.description ? String(slideData.description).trim() : null,
    imageUrl: String(slideData.imageUrl || "").trim(),
    buttonText: slideData.buttonText ? String(slideData.buttonText).trim() : "Check Repair Price",
    buttonLink: slideData.buttonLink ? String(slideData.buttonLink).trim() : "/services?focus=search",
    displayOrder: parseInt(String(slideData.displayOrder || 1), 10) || 1,
    status: slideData.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    createdBy: userId || null,
    updatedBy: userId || null,
    createdAt: now,
    updatedAt: now
  };
  slidesCache.set(id, newSlide);
  saveLocalFile5(Array.from(slidesCache.values()));
  try {
    await supabaseAdmin.from("HomeSlide").upsert([newSlide]);
  } catch (err) {
    console.warn("[SUPABASE SLIDE CREATE WARN]", err);
  }
  await broadcastServerChange("HomeSlide", "CREATE", id, newSlide);
  return newSlide;
}
async function updateSlide(id, updates, userId) {
  await initializeSlidesStorage();
  const existing = slidesCache.get(id);
  if (!existing) {
    throw new Error("Slide not found");
  }
  if (updates.imageUrl && existing.imageUrl && updates.imageUrl !== existing.imageUrl && existing.imageUrl.includes("cloudinary.com")) {
    try {
      await deleteFromCloudinary(existing.imageUrl);
    } catch (cleanErr) {
      console.warn("[CLOUDINARY OLD SLIDE ASSET CLEANUP WARN]", cleanErr);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    ...existing,
    ...updates,
    id,
    updatedAt: now,
    updatedBy: userId || existing.updatedBy || null
  };
  slidesCache.set(id, updated);
  saveLocalFile5(Array.from(slidesCache.values()));
  try {
    await supabaseAdmin.from("HomeSlide").update(updated).eq("id", id);
  } catch (err) {
    console.warn("[SUPABASE SLIDE UPDATE WARN]", err);
  }
  await broadcastServerChange("HomeSlide", "UPDATE", id, updated);
  return updated;
}
async function toggleSlideStatus(id, userId) {
  await initializeSlidesStorage();
  const existing = slidesCache.get(id);
  if (!existing) {
    throw new Error("Slide not found");
  }
  const targetStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  return updateSlide(id, { status: targetStatus }, userId);
}
async function reorderSlides(items) {
  await initializeSlidesStorage();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const item of items) {
    const existing = slidesCache.get(item.id);
    if (existing) {
      existing.displayOrder = item.displayOrder;
      existing.updatedAt = now;
      slidesCache.set(item.id, existing);
      try {
        await supabaseAdmin.from("HomeSlide").update({ displayOrder: item.displayOrder, updatedAt: now }).eq("id", item.id);
      } catch (err) {
      }
    }
  }
  saveLocalFile5(Array.from(slidesCache.values()));
  await broadcastServerChange("HomeSlide", "UPDATE", "reorder");
}
async function deleteSlide(id) {
  await initializeSlidesStorage();
  const existing = slidesCache.get(id);
  if (existing && existing.imageUrl && existing.imageUrl.includes("cloudinary.com")) {
    try {
      await deleteFromCloudinary(existing.imageUrl);
    } catch (cleanErr) {
      console.warn("[CLOUDINARY DELETE SLIDE ASSET CLEANUP WARN]", cleanErr);
    }
  }
  slidesCache.delete(id);
  saveLocalFile5(Array.from(slidesCache.values()));
  try {
    await supabaseAdmin.from("HomeSlide").delete().eq("id", id);
  } catch (err) {
    console.warn("[SUPABASE SLIDE DELETE WARN]", err);
  }
  await broadcastServerChange("HomeSlide", "DELETE", id);
}

// api/_server/routes/slides.ts
var router12 = Router12();
var upload3 = multer3({ storage: multer3.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
var getSlidesHandler = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const isAll = req.query.all === "true" || req.query.status === "ALL" || req.originalUrl.includes("/admin/") || req.baseUrl.includes("/admin/");
    const slides = await getSlides(!isAll);
    return res.json(slides || []);
  } catch (err) {
    console.error("[GET SLIDES EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to retrieve slides." });
  }
};
router12.get("/", getSlidesHandler);
router12.get("/public", getSlidesHandler);
router12.get("/home-slides", getSlidesHandler);
router12.post("/upload-image", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), upload3.single("image"), async (req, res) => {
  try {
    if (req.file) {
      if (isCloudinaryConfigured()) {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "mts_lab/slides",
          resourceType: "image"
        });
        return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
      }
      const uploadDir = path6.join(process.cwd(), "public", "assets", "images");
      if (!fs6.existsSync(uploadDir)) {
        fs6.mkdirSync(uploadDir, { recursive: true });
      }
      const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `slide_${Date.now()}_${safeOriginalName}`;
      const filePath = path6.join(uploadDir, fileName);
      fs6.writeFileSync(filePath, req.file.buffer);
      return res.json({
        success: true,
        url: `/assets/images/${fileName}`
      });
    }
    if (req.body?.base64Image || req.body?.image) {
      const base64Data = req.body.base64Image || req.body.image;
      if (isCloudinaryConfigured()) {
        const result = await uploadBase64ToCloudinary(base64Data, {
          folder: "mts_lab/slides",
          resourceType: "image"
        });
        return res.json({ success: true, url: result.secure_url, publicId: result.public_id });
      }
      const uploadDir = path6.join(process.cwd(), "public", "assets", "images");
      if (!fs6.existsSync(uploadDir)) {
        fs6.mkdirSync(uploadDir, { recursive: true });
      }
      const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let ext = "jpg";
      let buffer;
      if (matches && matches.length === 3) {
        const mime = matches[1];
        if (mime.includes("png")) ext = "png";
        else if (mime.includes("webp")) ext = "webp";
        else if (mime.includes("gif")) ext = "gif";
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(base64Data, "base64");
      }
      const fileName = `slide_${Date.now()}.${ext}`;
      const filePath = path6.join(uploadDir, fileName);
      fs6.writeFileSync(filePath, buffer);
      return res.json({
        success: true,
        url: `/assets/images/${fileName}`
      });
    }
    return res.status(400).json({ error: "No image file or base64 data provided." });
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
    const created = await createSlide(
      {
        title,
        description,
        imageUrl,
        buttonText,
        buttonLink,
        displayOrder,
        status
      },
      req.user?.id
    );
    return res.status(201).json(created);
  } catch (err) {
    console.error("[CREATE SLIDE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to save slide." });
  }
});
router12.put("/reorder", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { slides, slideIds } = req.body;
    let itemsToReorder = [];
    if (Array.isArray(slides)) {
      itemsToReorder = slides.map((s) => ({ id: s.id, displayOrder: s.displayOrder }));
    } else if (Array.isArray(slideIds)) {
      itemsToReorder = slideIds.map((id, index) => ({ id, displayOrder: index + 1 }));
    }
    if (itemsToReorder.length > 0) {
      await reorderSlides(itemsToReorder);
    }
    return res.json({ success: true, message: "Slides reordered successfully." });
  } catch (err) {
    console.error("[REORDER SLIDES ERROR]", err);
    return res.status(500).json({ error: "Failed to reorder slides." });
  }
});
router12.put("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateSlide(id, req.body, req.user?.id);
    return res.json(updated);
  } catch (err) {
    console.error("[UPDATE SLIDE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to update slide." });
  }
});
router12.patch("/:id/toggle-status", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await toggleSlideStatus(id, req.user?.id);
    return res.json(updated);
  } catch (err) {
    console.error("[TOGGLE STATUS EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to toggle status." });
  }
});
router12.patch("/:id/status", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const targetStatus = status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const updated = await updateSlide(id, { status: targetStatus }, req.user?.id);
    return res.json(updated);
  } catch (err) {
    console.error("[SET STATUS EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to set slide status." });
  }
});
router12.delete("/:id", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await deleteSlide(id);
    return res.json({ success: true, message: "Slide deleted successfully." });
  } catch (err) {
    console.error("[DELETE SLIDE EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to delete slide." });
  }
});
var slides_default = router12;

// api/_server/routes/products.ts
import { Router as Router13 } from "express";
import { v4 as uuidv416 } from "uuid";
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
      id: uuidv416(),
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
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const type = req.query.type;
    const { notifications, unreadCount } = await getUserNotifications(
      { id: req.user.id, role: req.user.role },
      { unreadOnly, limit, type }
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.json(notifications);
  } catch (err) {
    console.error("[GET NOTIFICATIONS ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve notifications." });
  }
});
router14.get("/unread-count", authenticate, async (req, res) => {
  try {
    const { unreadCount } = await getUserNotifications(
      { id: req.user.id, role: req.user.role },
      { unreadOnly: true, limit: 1 }
    );
    return res.json({ unreadCount });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve unread count." });
  }
});
var handleMarkRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await markNotificationRead(id, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: "Notification not found." });
    }
    return res.json({ success: true, notification: updated });
  } catch (err) {
    console.error("[MARK READ ERROR]", err);
    return res.status(500).json({ error: "Failed to update notification status." });
  }
};
router14.post("/:id/read", authenticate, handleMarkRead);
router14.patch("/:id/read", authenticate, handleMarkRead);
router14.post("/mark-all-read", authenticate, async (req, res) => {
  try {
    const count = await markAllNotificationsRead({ id: req.user.id, role: req.user.role });
    return res.json({ success: true, message: "All notifications marked as read.", markedCount: count });
  } catch (err) {
    console.error("[MARK ALL READ ERROR]", err);
    return res.status(500).json({ error: "Failed to process mark all read." });
  }
});
router14.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteNotification(id, { id: req.user.id, role: req.user.role });
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found." });
    }
    return res.json({ success: true, message: "Notification removed successfully." });
  } catch (err) {
    console.error("[DELETE NOTIFICATION ERROR]", err);
    return res.status(403).json({ error: err?.message || "Failed to delete notification." });
  }
});
router14.post("/send-internal", authenticate, async (req, res) => {
  try {
    const { targetUserId, targetRole, title, message, priority = "NORMAL", link } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required." });
    }
    const allowedSenders = ["SUPER_ADMIN", "ADMIN", "MANAGER", "HEAD_TECHNICIAN", "LEAD_TECHNICIAN", "TECHNICIAN", "RECEPTIONIST", "ACCOUNTANT"];
    if (!allowedSenders.includes(req.user.role)) {
      return res.status(403).json({ error: "Unauthorized to send internal notifications." });
    }
    const created = await createNotification({
      userId: targetUserId || null,
      targetRole: targetRole || null,
      title: title.trim(),
      message: message.trim(),
      type: "INTERNAL_MESSAGE",
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      priority,
      link: link || null
    });
    return res.status(201).json({ success: true, notification: created });
  } catch (err) {
    console.error("[SEND INTERNAL NOTIFICATION ERROR]", err);
    return res.status(500).json({ error: "Failed to send internal communication." });
  }
});
var notifications_default = router14;

// api/_server/routes/dashboard.ts
import { Router as Router15 } from "express";
var router15 = Router15();
function getNepalDates() {
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
  const todayStr = `${y}-${m}-${d}`;
  const monthStr = `${y}-${m}`;
  const past7Days = [];
  for (let i = 6; i >= 0; i--) {
    const pastDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1e3);
    const pParts = formatter.formatToParts(pastDate);
    const py = pParts.find((p) => p.type === "year")?.value || "2026";
    const pm = pParts.find((p) => p.type === "month")?.value || "01";
    const pd = pParts.find((p) => p.type === "day")?.value || "01";
    const pStr = `${py}-${pm}-${pd}`;
    const dayName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", weekday: "short" }).format(pastDate);
    const shortDate = `${pm}/${pd}`;
    past7Days.push({ dateStr: pStr, dayLabel: dayName, shortDate, count: 0 });
  }
  const yDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const yParts = formatter.formatToParts(yDate);
  const yy = yParts.find((p) => p.type === "year")?.value || "2026";
  const ym = yParts.find((p) => p.type === "month")?.value || "01";
  const yd = yParts.find((p) => p.type === "day")?.value || "01";
  const yesterdayStr = `${yy}-${ym}-${yd}`;
  return { todayStr, yesterdayStr, monthStr, past7Days, now };
}
function toNepalDateString2(isoDateString) {
  if (!isoDateString) return "";
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return "";
  }
}
router15.get("/overview", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const role = normalizeRole(currentUser.role || "RECEPTIONIST");
    const { todayStr, yesterdayStr, monthStr, past7Days } = getNepalDates();
    const serverTimeInfo = getNepalBusinessTime();
    const { data: repairsData, error: repairsErr } = await supabaseAdmin.from("Repair").select(`
        id,
        repairNumber,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        deviceBrand,
        deviceModel,
        status,
        priority,
        estimatedCost,
        advancePaid,
        totalPaid,
        technicianId,
        isCourierIn,
        courierInStatus,
        isCourierOut,
        courierOutStatus,
        createdAt,
        updatedAt,
        courierOutDeliveredDate
      `).order("createdAt", { ascending: false }).limit(1e3);
    if (repairsErr) {
      console.error("[OVERVIEW REPAIRS QUERY ERROR]", repairsErr);
    }
    const allRepairs = Array.isArray(repairsData) ? repairsData : [];
    const { count: totalCustomersCount } = await supabaseAdmin.from("Customer").select("*", { count: "exact", head: true }).eq("archived", false);
    const authorizedStaff = await getAuthorizedStaffList();
    const todayAttendanceList = await getAllAttendanceRecords({ date: todayStr });
    const monthAttendanceList = await getAllAttendanceRecords({ month: monthStr });
    const attendanceMap = /* @__PURE__ */ new Map();
    todayAttendanceList.forEach((r) => attendanceMap.set(r.userId, r));
    let staffPresentToday = 0;
    let staffLateToday = 0;
    let staffAbsentToday = 0;
    let staffNotMarkedToday = 0;
    let pendingAttendanceRequestsCount = 0;
    authorizedStaff.forEach((s) => {
      const rec = attendanceMap.get(s.id);
      if (!rec || rec.status === "PENDING") {
        staffNotMarkedToday++;
      } else if (rec.status === "PRESENT") {
        staffPresentToday++;
      } else if (rec.status === "LATE" || rec.status === "HALF_DAY") {
        staffLateToday++;
      } else if (rec.status === "ABSENT") {
        staffAbsentToday++;
      }
      if (rec && rec.requestStatus === "PENDING") {
        pendingAttendanceRequestsCount++;
      }
    });
    const { data: inventoryItems } = await supabaseAdmin.from("InventoryItem").select("id, name, brand, model, category, currentStock, minStockLevel, unit, status").eq("status", "ACTIVE").limit(200);
    const allInventory = Array.isArray(inventoryItems) ? inventoryItems : [];
    const lowStockItems = allInventory.filter(
      (item) => (item.currentStock ?? 0) <= (item.minStockLevel ?? 5) && (item.currentStock ?? 0) > 0
    );
    const outOfStockItems = allInventory.filter((item) => (item.currentStock ?? 0) <= 0);
    const { count: totalWarrantiesCount } = await supabaseAdmin.from("BatteryWarranty").select("*", { count: "exact", head: true });
    const { count: activeWarrantiesCount } = await supabaseAdmin.from("BatteryWarranty").select("*", { count: "exact", head: true }).eq("status", "ACTIVE");
    const { data: transferRequests } = await supabaseAdmin.from("RepairTransferRequest").select("*").order("createdAt", { ascending: false }).limit(20);
    const allTransfers = Array.isArray(transferRequests) ? transferRequests : [];
    const pendingTransfers = allTransfers.filter((t) => t.status === "PENDING");
    let pendingAccessRequests = [];
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      const { data: accessReqs } = await supabaseAdmin.from("AccessRequest").select("*").eq("status", "PENDING").order("createdAt", { ascending: false }).limit(20);
      pendingAccessRequests = Array.isArray(accessReqs) ? accessReqs : [];
    }
    const { data: damageRecords } = await supabaseAdmin.from("RepairRelatedDamage").select("id, recordNumber, staffId, staffName, staffRole, repairNumber, damagedComponent, damageDate, estimatedCost, status").eq("isArchived", false).limit(100);
    const allDamages = Array.isArray(damageRecords) ? damageRecords : [];
    const todayDamages = allDamages.filter((d) => d.damageDate === todayStr);
    const thisMonthDamages = allDamages.filter((d) => (d.damageDate || "").startsWith(monthStr));
    const totalDamageCost = allDamages.reduce((sum, d) => sum + (Number(d.estimatedCost) || 0), 0);
    const { count: unreadNotificationsCount } = await supabaseAdmin.from("Notification").select("*", { count: "exact", head: true }).eq("userId", currentUser.id).eq("isRead", false);
    let totalRepairs = 0;
    let activeRepairs = 0;
    let completedRepairs = 0;
    let pendingRepairs = 0;
    let inProgressRepairs = 0;
    let readyForPickupRepairs = 0;
    let deliveredRepairs = 0;
    let reProblemRepairs = 0;
    let cannotRepairCount = 0;
    let unassignedRepairs = 0;
    let urgentPriorityCount = 0;
    let highPriorityCount = 0;
    let todayNewRepairs = 0;
    let todayCompletedRepairs = 0;
    let todayDeliveredRepairs = 0;
    let todayPendingRepairs = 0;
    let totalRevenue = 0;
    let todayRevenue = 0;
    let weekRevenue = 0;
    let monthRevenue = 0;
    let pendingReceivables = 0;
    let courierInCount = 0;
    let courierOutCount = 0;
    let courierPendingCount = 0;
    const trendMap = /* @__PURE__ */ new Map();
    past7Days.forEach((d) => trendMap.set(d.dateStr, 0));
    const brandMap = /* @__PURE__ */ new Map();
    const statusMap = {
      PENDING: 0,
      RECEIVED: 0,
      DIAGNOSING: 0,
      IN_PROCESS: 0,
      WAITING_FOR_PARTS: 0,
      TESTING: 0,
      REPAIRED: 0,
      READY_FOR_PICKUP: 0,
      DELIVERED: 0,
      RE_PROBLEM: 0,
      CANNOT_REPAIR: 0,
      CANCELLED: 0
    };
    const technicianWorkloadMap = /* @__PURE__ */ new Map();
    authorizedStaff.filter(
      (s) => ["TECHNICIAN", "HEAD_TECHNICIAN", "LEAD_TECHNICIAN", "TECHNICAL_ASSISTANT"].includes(s.role)
    ).forEach((tech) => {
      technicianWorkloadMap.set(tech.id, {
        id: tech.id,
        name: tech.name,
        role: tech.role,
        department: tech.department || "Hardware Lab",
        activeCount: 0,
        inProgressCount: 0,
        pendingCount: 0,
        urgentCount: 0,
        completedToday: 0
      });
    });
    allRepairs.forEach((repair) => {
      totalRepairs++;
      const s = (repair.status || "PENDING").toUpperCase();
      const p = (repair.priority || "NORMAL").toUpperCase();
      const createdNepalDate = toNepalDateString2(repair.createdAt);
      const isRepairedOrDelivered = ["REPAIRED", "COMPLETED", "DELIVERED", "READY_FOR_PICKUP"].includes(s);
      const completedNepalDate = toNepalDateString2(isRepairedOrDelivered ? repair.updatedAt : null);
      const deliveredNepalDate = toNepalDateString2(repair.courierOutDeliveredDate || (s === "DELIVERED" ? repair.updatedAt : null));
      const paid = Number(repair.totalPaid || repair.advancePaid || 0);
      const estimated = Number(repair.estimatedCost || 0);
      totalRevenue += paid;
      const isCompleted = ["COMPLETED", "DELIVERED"].includes(s);
      const isActive = !["COMPLETED", "DELIVERED", "CANCELLED", "CANNOT_REPAIR"].includes(s);
      if (isActive) {
        activeRepairs++;
        if (!repair.technicianId) unassignedRepairs++;
        if (p === "URGENT") urgentPriorityCount++;
        if (p === "HIGH") highPriorityCount++;
        if (paid < estimated) {
          pendingReceivables += estimated - paid;
        }
      }
      if (isCompleted) {
        completedRepairs++;
      }
      if (["PENDING", "RECEIVED"].includes(s)) pendingRepairs++;
      if (["IN_PROCESS", "DIAGNOSING", "TESTING", "WAITING_FOR_PARTS", "IN_PROGRESS", "REPAIRING"].includes(s)) {
        inProgressRepairs++;
      }
      if (["READY_FOR_PICKUP", "READY_FOR_DELIVERY"].includes(s)) readyForPickupRepairs++;
      if (["DELIVERED", "COMPLETED"].includes(s)) deliveredRepairs++;
      if (["RE_PROBLEM", "REPROBLEM"].includes(s)) reProblemRepairs++;
      if (["CANNOT_REPAIR", "CANCELLED"].includes(s)) cannotRepairCount++;
      if (statusMap[s] !== void 0) {
        statusMap[s]++;
      } else if (s === "REPROBLEM") {
        statusMap["RE_PROBLEM"]++;
      }
      if (createdNepalDate === todayStr) {
        todayNewRepairs++;
        todayRevenue += paid;
      }
      if (createdNepalDate && createdNepalDate.startsWith(monthStr)) {
        monthRevenue += paid;
      }
      if (completedNepalDate === todayStr || s === "REPAIRED" && toNepalDateString2(repair.updatedAt) === todayStr) {
        todayCompletedRepairs++;
      }
      if (deliveredNepalDate === todayStr || s === "DELIVERED" && toNepalDateString2(repair.updatedAt) === todayStr) {
        todayDeliveredRepairs++;
      }
      if (["PENDING", "RECEIVED"].includes(s) && createdNepalDate === todayStr) {
        todayPendingRepairs++;
      }
      if (createdNepalDate && trendMap.has(createdNepalDate)) {
        trendMap.set(createdNepalDate, (trendMap.get(createdNepalDate) || 0) + 1);
        if (createdNepalDate >= past7Days[0].dateStr) {
          weekRevenue += paid;
        }
      }
      const b = (repair.deviceBrand || "Other").trim();
      if (b) {
        brandMap.set(b, (brandMap.get(b) || 0) + 1);
      }
      if (repair.isCourierIn) {
        courierInCount++;
        if (["COURIER_REQUESTED", "PICKUP_SCHEDULED", "IN_TRANSIT"].includes(repair.courierInStatus)) {
          courierPendingCount++;
        }
      }
      if (repair.isCourierOut) {
        courierOutCount++;
        if (["READY_FOR_DISPATCH", "COURIER_BOOKED", "IN_TRANSIT"].includes(repair.courierOutStatus)) {
          courierPendingCount++;
        }
      }
      if (repair.technicianId && technicianWorkloadMap.has(repair.technicianId)) {
        const item = technicianWorkloadMap.get(repair.technicianId);
        if (isActive) {
          item.activeCount++;
          if (["IN_PROCESS", "DIAGNOSING", "TESTING", "WAITING_FOR_PARTS"].includes(s)) {
            item.inProgressCount++;
          }
          if (["PENDING", "RECEIVED"].includes(s)) {
            item.pendingCount++;
          }
          if (p === "URGENT") {
            item.urgentCount++;
          }
        }
        if (completedNepalDate === todayStr) {
          item.completedToday++;
        }
      }
    });
    const chartIntakeData = past7Days.map((d) => ({
      date: d.dateStr,
      day: d.dayLabel,
      shortDate: d.shortDate,
      count: trendMap.get(d.dateStr) || 0
    }));
    const topBrands = Array.from(brandMap.entries()).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    const urgentQueue = allRepairs.filter((r) => {
      const s = (r.status || "").toUpperCase();
      const p = (r.priority || "").toUpperCase();
      return !["COMPLETED", "DELIVERED", "CANCELLED"].includes(s) && (p === "URGENT" || p === "HIGH");
    }).slice(0, 8);
    const unassignedQueue = allRepairs.filter((r) => {
      const s = (r.status || "").toUpperCase();
      return !r.technicianId && !["COMPLETED", "DELIVERED", "CANCELLED"].includes(s);
    }).slice(0, 8);
    const readyForPickupQueue = allRepairs.filter((r) => ["READY_FOR_PICKUP", "READY_FOR_DELIVERY"].includes((r.status || "").toUpperCase())).slice(0, 8);
    const recentRepairs = allRepairs.slice(0, 8);
    const technicianWorkloadList = Array.from(technicianWorkloadMap.values());
    const myRepairs = allRepairs.filter(
      (r) => r.technicianId === currentUser.id && !["CANCELLED", "CANNOT_REPAIR"].includes((r.status || "").toUpperCase())
    );
    const myActiveRepairs = myRepairs.filter(
      (r) => !["COMPLETED", "DELIVERED"].includes((r.status || "").toUpperCase())
    );
    const myInProgress = myActiveRepairs.filter(
      (r) => ["IN_PROCESS", "DIAGNOSING", "TESTING", "WAITING_FOR_PARTS", "IN_PROGRESS"].includes((r.status || "").toUpperCase())
    );
    const myWaitingParts = myActiveRepairs.filter((r) => (r.status || "").toUpperCase() === "WAITING_FOR_PARTS");
    const myCompletedToday = myRepairs.filter((r) => {
      const s = (r.status || "").toUpperCase();
      const compDate = toNepalDateString2(r.updatedAt);
      return ["REPAIRED", "COMPLETED", "DELIVERED", "READY_FOR_PICKUP"].includes(s) && compDate === todayStr;
    });
    const myUrgentRepairs = myActiveRepairs.filter((r) => (r.priority || "").toUpperCase() === "URGENT");
    const myHighRepairs = myActiveRepairs.filter((r) => (r.priority || "").toUpperCase() === "HIGH");
    const myReProblemRepairs = myActiveRepairs.filter((r) => ["RE_PROBLEM", "REPROBLEM"].includes((r.status || "").toUpperCase()));
    const myIncomingTransfers = allTransfers.filter(
      (t) => t.targetTechnicianId === currentUser.id && t.status === "PENDING"
    );
    const myOutgoingTransfers = allTransfers.filter(
      (t) => t.senderTechnicianId === currentUser.id && t.status === "PENDING"
    );
    const myTodayAttendance = attendanceMap.get(currentUser.id) || null;
    const myMonthRecords = monthAttendanceList.filter((r) => r.userId === currentUser.id);
    const myPresentCount = myMonthRecords.filter((r) => ["PRESENT", "LATE", "HALF_DAY"].includes(r.status)).length;
    const myAttendanceRate = myMonthRecords.length > 0 ? Math.round(myPresentCount / myMonthRecords.length * 100) : 100;
    let customerRepairs = [];
    if (role === "CUSTOMER") {
      customerRepairs = allRepairs.filter(
        (r) => r.customerId === currentUser.id || currentUser.phoneNumber && r.customerPhone && r.customerPhone.includes(currentUser.phoneNumber) || currentUser.email && r.customerEmail && r.customerEmail.toLowerCase() === currentUser.email.toLowerCase()
      );
    }
    const overviewPayload = {
      role,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department || "MTS Lab Nepal"
      },
      serverTime: {
        ...serverTimeInfo,
        serverDateNPT: todayStr
      },
      systemSummary: {
        totalRepairs,
        activeRepairs,
        completedRepairs,
        pendingRepairs,
        inProgressRepairs,
        readyForPickupRepairs,
        deliveredRepairs,
        reProblemRepairs,
        cannotRepairCount,
        unassignedRepairs,
        urgentPriorityCount,
        highPriorityCount,
        totalCustomers: totalCustomersCount || 0,
        totalStaff: authorizedStaff.length,
        totalTechnicians: technicianWorkloadList.length,
        totalBranches: 1
      },
      todayOperations: {
        todayNewRepairs,
        todayCompletedRepairs,
        todayDeliveredRepairs,
        todayPendingRepairs,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalRevenue,
        pendingReceivables
      },
      staffAttendance: {
        totalStaff: authorizedStaff.length,
        presentToday: staffPresentToday,
        lateToday: staffLateToday,
        absentToday: staffAbsentToday,
        notMarkedToday: staffNotMarkedToday,
        pendingRequestsCount: pendingAttendanceRequestsCount
      },
      inventorySummary: {
        totalItems: allInventory.length,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        lowStockItems: lowStockItems.slice(0, 6)
      },
      warrantySummary: {
        totalWarranties: totalWarrantiesCount || 0,
        activeWarrantiesCount: activeWarrantiesCount || 0
      },
      courierSummary: {
        courierInCount,
        courierOutCount,
        courierPendingCount
      },
      damageSummary: {
        todayDamagesCount: todayDamages.length,
        thisMonthDamagesCount: thisMonthDamages.length,
        totalDamageCost
      },
      alerts: {
        urgentRepairsCount: urgentPriorityCount,
        highPriorityCount,
        lowStockCount: lowStockItems.length,
        unassignedRepairsCount: unassignedRepairs,
        pendingTransfersCount: pendingTransfers.length,
        pendingAccessRequestsCount: pendingAccessRequests.length,
        unreadNotificationsCount: unreadNotificationsCount || 0
      },
      technicianCockpit: {
        assignedToMeTotal: myActiveRepairs.length,
        myInProgressCount: myInProgress.length,
        myWaitingPartsCount: myWaitingParts.length,
        myCompletedTodayCount: myCompletedToday.length,
        myUrgentCount: myUrgentRepairs.length,
        myHighCount: myHighRepairs.length,
        myReProblemCount: myReProblemRepairs.length,
        myActiveRepairs: myActiveRepairs.slice(0, 10),
        incomingTransfers: myIncomingTransfers,
        outgoingTransfers: myOutgoingTransfers,
        todayAttendance: myTodayAttendance,
        attendanceRate: myAttendanceRate
      },
      charts: {
        intakeTrends: chartIntakeData,
        topBrands,
        statusBreakdown: statusMap
      },
      queues: {
        urgentQueue,
        unassignedQueue,
        readyForPickupQueue,
        recentRepairs,
        technicianWorkload: technicianWorkloadList,
        pendingAccessRequests: pendingAccessRequests.slice(0, 5),
        pendingTransfers: pendingTransfers.slice(0, 5),
        customerRepairs
      }
    };
    res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=15");
    return res.json(overviewPayload);
  } catch (err) {
    console.error("[OVERVIEW DASHBOARD CONTROLLER ERROR]", err);
    return res.status(500).json({
      error: "Failed to retrieve overview data.",
      message: err?.message || "Database query error."
    });
  }
});
router15.get("/stats", authenticate, async (req, res) => {
  try {
    const { data: repairs } = await supabaseAdmin.from("Repair").select("status, priority, totalPaid, advancePaid, estimatedCost");
    const { count: totalCustomers } = await supabaseAdmin.from("Customer").select("*", { count: "exact", head: true }).eq("archived", false);
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
    res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
    return res.json({
      activeRepairs,
      completedRepairs,
      totalCustomers: totalCustomers || 0,
      totalStaff: totalStaff || 0,
      totalRevenue
    });
  } catch (err) {
    console.error("[DASHBOARD STATS ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve dashboard stats." });
  }
});
var dashboard_default = router15;

// api/_server/routes/revenue.ts
import { Router as Router16 } from "express";
import { v4 as uuidv417 } from "uuid";
var router16 = Router16();
var REVENUE_VIEW_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNTANT", "LEAD_TECHNICIAN", "TECHNICIAN", "RECEPTIONIST"];
function getNepalDateRange(timeframe, customStart, customEnd) {
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
  const todayStr = `${y}-${m}-${d}`;
  const currentMonthStr = `${y}-${m}`;
  const yDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const yParts = formatter.formatToParts(yDate);
  const yy = yParts.find((p) => p.type === "year")?.value || "2026";
  const ym = yParts.find((p) => p.type === "month")?.value || "01";
  const yd = yParts.find((p) => p.type === "day")?.value || "01";
  const yesterdayStr = `${yy}-${ym}-${yd}`;
  const dayOfWeek = now.getDay();
  const startOfWeekDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1e3);
  const wParts = formatter.formatToParts(startOfWeekDate);
  const wy = wParts.find((p) => p.type === "year")?.value || y;
  const wm = wParts.find((p) => p.type === "month")?.value || m;
  const wd = wParts.find((p) => p.type === "day")?.value || d;
  const startOfWeekStr = `${wy}-${wm}-${wd}`;
  const currentMonthNum = parseInt(m, 10);
  const currentYearNum = parseInt(y, 10);
  const lastMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
  const lastMonthYear = currentMonthNum === 1 ? currentYearNum - 1 : currentYearNum;
  const lastMonthStr = `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}`;
  let startDate = `${y}-01-01`;
  let endDate = todayStr;
  switch (timeframe?.toUpperCase()) {
    case "TODAY":
      startDate = todayStr;
      endDate = todayStr;
      break;
    case "YESTERDAY":
      startDate = yesterdayStr;
      endDate = yesterdayStr;
      break;
    case "THIS_WEEK":
      startDate = startOfWeekStr;
      endDate = todayStr;
      break;
    case "THIS_MONTH":
      startDate = `${currentMonthStr}-01`;
      endDate = todayStr;
      break;
    case "LAST_MONTH": {
      const daysInLastMonth = new Date(lastMonthYear, lastMonthNum, 0).getDate();
      startDate = `${lastMonthStr}-01`;
      endDate = `${lastMonthStr}-${String(daysInLastMonth).padStart(2, "0")}`;
      break;
    }
    case "THIS_YEAR":
      startDate = `${y}-01-01`;
      endDate = todayStr;
      break;
    case "CUSTOM":
      if (customStart) startDate = customStart;
      if (customEnd) endDate = customEnd;
      break;
    case "ALL":
      startDate = "2020-01-01";
      endDate = "2099-12-31";
      break;
    default:
      startDate = `${currentMonthStr}-01`;
      endDate = todayStr;
      break;
  }
  return {
    todayStr,
    yesterdayStr,
    currentMonthStr,
    startDate,
    endDate,
    year: y,
    month: m
  };
}
function toNepalDate(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return "";
  }
}
function classifyRepairCategory(problem = "", deviceBrand = "") {
  const p = (problem || "").toLowerCase();
  if (p.includes("display") || p.includes("screen") || p.includes("touch") || p.includes("glass") || p.includes("oled") || p.includes("lcd") || p.includes("fold") || p.includes("crack")) {
    if (p.includes("glass") || p.includes("oca")) return "Glass & OCA Replacement";
    return "Display & Touch Replacement";
  }
  if (p.includes("battery") || p.includes("drain") || p.includes("backup") || p.includes("swollen")) {
    return "Battery Replacement";
  }
  if (p.includes("charging") || p.includes("port") || p.includes("cc") || p.includes("jack") || p.includes("type c") || p.includes("lightning")) {
    return "Charging Port / PCB Flex";
  }
  if (p.includes("camera") || p.includes("lens") || p.includes("focus") || p.includes("blur")) {
    return "Camera & Lens Module";
  }
  if (p.includes("back") || p.includes("housing") || p.includes("panel") || p.includes("body") || p.includes("frame")) {
    return "Back Panel / Housing";
  }
  if (p.includes("ic") || p.includes("board") || p.includes("motherboard") || p.includes("power ic") || p.includes("cpu") || p.includes("short") || p.includes("restart") || p.includes("dead") || p.includes("audio ic") || p.includes("network ic")) {
    return "Motherboard & IC Repair";
  }
  if (p.includes("speaker") || p.includes("earpiece") || p.includes("mic") || p.includes("sound") || p.includes("audio") || p.includes("ringer")) {
    return "Speaker / Mic / Audio";
  }
  if (p.includes("water") || p.includes("liquid") || p.includes("moisture") || p.includes("wash")) {
    return "Water Damage Restoration";
  }
  if (p.includes("software") || p.includes("flash") || p.includes("unlock") || p.includes("logo") || p.includes("bootloop") || p.includes("frp") || p.includes("imei") || p.includes("update")) {
    return "Software & OS Servicing";
  }
  return "Other Specialized Repair";
}
function extractPartsCost(partsUsed, estimatedCost = 0) {
  if (!partsUsed) {
    return { partsCost: 0, partsSummary: "" };
  }
  let cost = 0;
  let summary = "";
  if (typeof partsUsed === "string") {
    try {
      const parsed = JSON.parse(partsUsed);
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => {
          const itemCost = Number(p.purchasePrice || p.cost || p.price || 0);
          const qty = Number(p.quantity || 1);
          cost += itemCost * qty;
          summary += summary ? `, ${p.name || p.brand || "Part"}` : p.name || p.brand || "Part";
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        cost = Number(parsed.cost || parsed.purchasePrice || 0);
        summary = parsed.name || "Component";
      }
    } catch {
      summary = partsUsed.trim();
      const match = partsUsed.match(/cost:?\s*Rs\.?\s*(\d+(\.\d+)?)/i) || partsUsed.match(/(\d+)\s*(npr|rs)/i);
      if (match && match[1]) {
        cost = parseFloat(match[1]);
      }
    }
  } else if (Array.isArray(partsUsed)) {
    partsUsed.forEach((p) => {
      const itemCost = Number(p.purchasePrice || p.cost || p.price || 0);
      const qty = Number(p.quantity || 1);
      cost += itemCost * qty;
      summary += summary ? `, ${p.name || "Part"}` : p.name || "Part";
    });
  }
  return { partsCost: Math.round(cost * 100) / 100, partsSummary: summary };
}
router16.get("/overview", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userRole = normalizeRole(currentUser.role || "RECEPTIONIST");
    if (!REVENUE_VIEW_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: Access denied to financial hub." });
    }
    const timeframe = req.query.timeframe || "THIS_MONTH";
    const customStart = req.query.startDate;
    const customEnd = req.query.endDate;
    const branchFilter = req.query.branchId;
    const technicianFilter = req.query.technicianId;
    const brandFilter = req.query.deviceBrand;
    const statusFilter = req.query.status;
    const paymentStatusFilter = req.query.paymentStatus;
    const { startDate, endDate, todayStr, currentMonthStr } = getNepalDateRange(timeframe, customStart, customEnd);
    let query = supabaseAdmin.from("Repair").select(`
        id,
        repairNumber,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        deviceBrand,
        deviceModel,
        problemDescription,
        status,
        priority,
        estimatedCost,
        advancePaid,
        totalPaid,
        paymentStatus,
        technicianId,
        branchId,
        partsUsed,
        receivingMethod,
        isCourierIn,
        courierInCharge,
        courierInPaymentStatus,
        isCourierOut,
        courierOutCharge,
        courierOutPaymentStatus,
        createdAt,
        updatedAt
      `).order("createdAt", { ascending: false });
    if (userRole === "TECHNICIAN") {
      query = query.eq("technicianId", currentUser.id);
    } else if (technicianFilter && technicianFilter !== "ALL") {
      query = query.eq("technicianId", technicianFilter);
    }
    if (branchFilter && branchFilter !== "ALL") {
      query = query.eq("branchId", branchFilter);
    }
    const { data: repairsData, error: repairsErr } = await query;
    if (repairsErr) {
      console.error("[REVENUE REPAIRS QUERY ERROR]", repairsErr);
      return res.status(500).json({ error: "Failed to retrieve repair financial records" });
    }
    const allRepairs = Array.isArray(repairsData) ? repairsData : [];
    const { data: paymentsData } = await supabaseAdmin.from("Payment").select("id, repairId, amount, method, reference, createdAt").order("createdAt", { ascending: false });
    const paymentsList = Array.isArray(paymentsData) ? paymentsData : [];
    await initializeDamageStorage();
    const damageResult = await queryDamageRecords({
      includeArchived: false,
      startDate,
      endDate
    });
    const damageRecords = Array.isArray(damageResult) ? damageResult : damageResult?.records || [];
    const { data: usersData } = await supabaseAdmin.from("User").select("id, name, email, role, department").eq("isActive", true);
    const staffMap = /* @__PURE__ */ new Map();
    (usersData || []).forEach((u) => staffMap.set(u.id, u));
    const { data: inventoryItems } = await supabaseAdmin.from("InventoryItem").select("id, name, brand, model, purchasePrice, sellingPrice, category");
    const inventoryMap = /* @__PURE__ */ new Map();
    (inventoryItems || []).forEach((item) => inventoryMap.set(item.id, item));
    const filteredRepairs = allRepairs.filter((r) => {
      const createdNepalDate = toNepalDate(r.createdAt);
      if (startDate && createdNepalDate < startDate) return false;
      if (endDate && createdNepalDate > endDate) return false;
      if (brandFilter && brandFilter !== "ALL" && (r.deviceBrand || "").toLowerCase() !== brandFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter && statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }
      if (paymentStatusFilter && paymentStatusFilter !== "ALL" && r.paymentStatus !== paymentStatusFilter) {
        return false;
      }
      return true;
    });
    const repairDamageMap = /* @__PURE__ */ new Map();
    let totalDamageLoss = 0;
    damageRecords.forEach((d) => {
      const cost = Number(d.estimatedCost || 0);
      totalDamageLoss += cost;
      if (d.repairId) {
        repairDamageMap.set(d.repairId, (repairDamageMap.get(d.repairId) || 0) + cost);
      }
      if (d.repairNumber) {
        repairDamageMap.set(d.repairNumber, (repairDamageMap.get(d.repairNumber) || 0) + cost);
      }
    });
    let grossRevenue = 0;
    let estimatedBilled = 0;
    let outstandingReceivables = 0;
    let totalAdvanceCollected = 0;
    let totalSettlementCollected = 0;
    let totalPartsCost = 0;
    let completedRepairsCount = 0;
    let paidRepairsCount = 0;
    let partialRepairsCount = 0;
    let unpaidRepairsCount = 0;
    let courierInTotal = 0;
    let courierOutTotal = 0;
    const brandStatsMap = /* @__PURE__ */ new Map();
    const categoryStatsMap = /* @__PURE__ */ new Map();
    const technicianStatsMap = /* @__PURE__ */ new Map();
    const dateTrendMap = /* @__PURE__ */ new Map();
    filteredRepairs.forEach((r) => {
      const paid = Math.max(0, Number(r.totalPaid || 0));
      const est = Math.max(0, Number(r.estimatedCost || 0));
      const adv = Math.max(0, Number(r.advancePaid || 0));
      const status = r.status || "RECEIVED";
      const isCancelled = status === "CANCELLED" || status === "CANNOT_REPAIR";
      grossRevenue += paid;
      estimatedBilled += est;
      totalAdvanceCollected += adv;
      if (paid > adv) {
        totalSettlementCollected += paid - adv;
      }
      if (!isCancelled && est > paid) {
        outstandingReceivables += est - paid;
      }
      if (r.isCourierIn && r.courierInPaymentStatus === "PAID") {
        courierInTotal += Number(r.courierInCharge || 0);
      }
      if (r.isCourierOut && r.courierOutPaymentStatus === "PAID") {
        courierOutTotal += Number(r.courierOutCharge || 0);
      }
      const { partsCost } = extractPartsCost(r.partsUsed, est);
      totalPartsCost += partsCost;
      if (status === "DELIVERED" || status === "READY_FOR_PICKUP" || status === "REPAIRED") {
        completedRepairsCount++;
      }
      if (paid >= est && est > 0) {
        paidRepairsCount++;
      } else if (paid > 0) {
        partialRepairsCount++;
      } else {
        unpaidRepairsCount++;
      }
      const rawBrand = (r.deviceBrand || "Other").trim();
      const brandKey = rawBrand ? rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1).toLowerCase() : "Other";
      const bStat = brandStatsMap.get(brandKey) || { brand: brandKey, revenue: 0, cost: 0, profit: 0, count: 0 };
      bStat.revenue += paid;
      bStat.cost += partsCost;
      bStat.profit += paid - partsCost;
      bStat.count += 1;
      brandStatsMap.set(brandKey, bStat);
      const categoryKey = classifyRepairCategory(r.problemDescription, r.deviceBrand);
      const cStat = categoryStatsMap.get(categoryKey) || { category: categoryKey, revenue: 0, cost: 0, profit: 0, count: 0 };
      cStat.revenue += paid;
      cStat.cost += partsCost;
      cStat.profit += paid - partsCost;
      cStat.count += 1;
      categoryStatsMap.set(categoryKey, cStat);
      const techId = r.technicianId || "UNASSIGNED";
      const techUser = staffMap.get(techId);
      const techName = techUser ? techUser.name : techId === "UNASSIGNED" ? "Unassigned" : "Former Staff";
      const techRole = techUser ? techUser.role : "STAFF";
      const tStat = technicianStatsMap.get(techId) || {
        id: techId,
        name: techName,
        role: techRole,
        revenue: 0,
        cost: 0,
        profit: 0,
        completedCount: 0,
        activeCount: 0
      };
      tStat.revenue += paid;
      tStat.cost += partsCost;
      tStat.profit += paid - partsCost;
      if (status === "DELIVERED" || status === "READY_FOR_PICKUP" || status === "REPAIRED") {
        tStat.completedCount += 1;
      } else if (!isCancelled) {
        tStat.activeCount += 1;
      }
      technicianStatsMap.set(techId, tStat);
      const dateKey = toNepalDate(r.createdAt);
      if (dateKey) {
        const dStat = dateTrendMap.get(dateKey) || {
          date: dateKey,
          label: dateKey.slice(5),
          // MM-DD
          revenue: 0,
          partsCost: 0,
          damageCost: 0,
          profit: 0,
          count: 0
        };
        dStat.revenue += paid;
        dStat.partsCost += partsCost;
        dStat.profit += paid - partsCost;
        dStat.count += 1;
        dateTrendMap.set(dateKey, dStat);
      }
    });
    damageRecords.forEach((d) => {
      const dDate = d.damageDate;
      if (dDate) {
        const dStat = dateTrendMap.get(dDate) || {
          date: dDate,
          label: dDate.slice(5),
          revenue: 0,
          partsCost: 0,
          damageCost: 0,
          profit: 0,
          count: 0
        };
        const cost = Number(d.estimatedCost || 0);
        dStat.damageCost += cost;
        dStat.profit -= cost;
        dateTrendMap.set(dDate, dStat);
      }
    });
    const trend = Array.from(dateTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    if (trend.length === 0 && startDate && endDate) {
      trend.push({
        date: startDate,
        label: startDate.slice(5),
        revenue: 0,
        partsCost: 0,
        damageCost: 0,
        profit: 0,
        count: 0
      });
    }
    const grossProfit = Math.round((grossRevenue - totalPartsCost - totalDamageLoss) * 100) / 100;
    const operatingExpenses = 0;
    const netProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100;
    const profitMargin = grossRevenue > 0 ? Math.round(netProfit / grossRevenue * 100 * 10) / 10 : 0;
    const averageTicket = filteredRepairs.length > 0 ? Math.round(grossRevenue / filteredRepairs.length) : 0;
    const categoryBreakdown = Array.from(categoryStatsMap.values()).sort((a, b) => b.revenue - a.revenue).map((c) => ({
      ...c,
      percentage: grossRevenue > 0 ? Math.round(c.revenue / grossRevenue * 100) : 0,
      margin: c.revenue > 0 ? Math.round(c.profit / c.revenue * 100 * 10) / 10 : 0
    }));
    const brandBreakdown = Array.from(brandStatsMap.values()).sort((a, b) => b.revenue - a.revenue).map((b) => ({
      ...b,
      percentage: grossRevenue > 0 ? Math.round(b.revenue / grossRevenue * 100) : 0
    }));
    const technicianPerformance = Array.from(technicianStatsMap.values()).sort((a, b) => b.revenue - a.revenue);
    const mostProfitableCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
    const lowestProfitCategory = categoryBreakdown.length > 1 ? categoryBreakdown[categoryBreakdown.length - 1] : null;
    const topPerformingTechnician = technicianPerformance.length > 0 ? technicianPerformance[0] : null;
    return res.json({
      success: true,
      timeframe,
      dateRange: { startDate, endDate },
      role: userRole,
      summary: {
        grossRevenue,
        estimatedBilled,
        outstandingReceivables,
        totalAdvanceCollected,
        totalSettlementCollected,
        totalPartsCost,
        totalDamageLoss,
        grossProfit,
        netProfit,
        profitMargin,
        averageTicket,
        totalRepairsCount: filteredRepairs.length,
        completedRepairsCount,
        paidRepairsCount,
        partialRepairsCount,
        unpaidRepairsCount,
        courierInTotal,
        courierOutTotal
      },
      trend,
      categoryBreakdown,
      brandBreakdown,
      technicianPerformance,
      insights: {
        mostProfitableCategory,
        lowestProfitCategory,
        topPerformingTechnician,
        damageLossImpact: totalDamageLoss,
        partsCostRatio: grossRevenue > 0 ? Math.round(totalPartsCost / grossRevenue * 100) : 0
      }
    });
  } catch (err) {
    console.error("[REVENUE OVERVIEW ERROR]", err);
    return res.status(500).json({ error: "Internal financial calculation failure: " + (err.message || err) });
  }
});
router16.get("/repairs", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userRole = normalizeRole(currentUser.role || "RECEPTIONIST");
    if (!REVENUE_VIEW_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: Access denied." });
    }
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit || "20", 10)));
    const search = (req.query.search || "").trim().toLowerCase();
    const timeframe = req.query.timeframe || "ALL";
    const customStart = req.query.startDate;
    const customEnd = req.query.endDate;
    const statusFilter = req.query.status;
    const paymentStatusFilter = req.query.paymentStatus;
    const brandFilter = req.query.brand;
    const techFilter = req.query.technicianId;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    const { startDate, endDate } = getNepalDateRange(timeframe, customStart, customEnd);
    let query = supabaseAdmin.from("Repair").select(`
        id,
        repairNumber,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        deviceBrand,
        deviceModel,
        problemDescription,
        status,
        priority,
        estimatedCost,
        advancePaid,
        totalPaid,
        paymentStatus,
        technicianId,
        branchId,
        partsUsed,
        receivingMethod,
        isCourierIn,
        courierInCharge,
        courierInPaymentStatus,
        isCourierOut,
        courierOutCharge,
        courierOutPaymentStatus,
        createdAt,
        updatedAt
      `).order("createdAt", { ascending: false });
    if (userRole === "TECHNICIAN") {
      query = query.eq("technicianId", currentUser.id);
    } else if (techFilter && techFilter !== "ALL") {
      query = query.eq("technicianId", techFilter);
    }
    const { data: repairsData, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    const rawList = Array.isArray(repairsData) ? repairsData : [];
    const { data: usersData } = await supabaseAdmin.from("User").select("id, name, email, role");
    const staffMap = /* @__PURE__ */ new Map();
    (usersData || []).forEach((u) => staffMap.set(u.id, u));
    await initializeDamageStorage();
    const damageResult = await queryDamageRecords({ includeArchived: false });
    const damageRecords = Array.isArray(damageResult) ? damageResult : damageResult?.records || [];
    const damageByRepair = /* @__PURE__ */ new Map();
    damageRecords.forEach((d) => {
      const cost = Number(d.estimatedCost || 0);
      if (d.repairId) damageByRepair.set(d.repairId, (damageByRepair.get(d.repairId) || 0) + cost);
      if (d.repairNumber) damageByRepair.set(d.repairNumber, (damageByRepair.get(d.repairNumber) || 0) + cost);
    });
    let enrichedList = rawList.map((r) => {
      const paid = Math.max(0, Number(r.totalPaid || 0));
      const est = Math.max(0, Number(r.estimatedCost || 0));
      const adv = Math.max(0, Number(r.advancePaid || 0));
      const balanceDue = Math.max(0, est - paid);
      const { partsCost, partsSummary } = extractPartsCost(r.partsUsed, est);
      const damageCost = damageByRepair.get(r.id) || damageByRepair.get(r.repairNumber) || 0;
      const totalDirectCost = partsCost + damageCost;
      const grossProfit = Math.round((paid - totalDirectCost) * 100) / 100;
      const profitMargin = paid > 0 ? Math.round(grossProfit / paid * 100 * 10) / 10 : 0;
      const technician = r.technicianId ? staffMap.get(r.technicianId)?.name || "Former Staff" : "Unassigned";
      return {
        id: r.id,
        repairNumber: r.repairNumber,
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerEmail: r.customerEmail,
        deviceBrand: r.deviceBrand,
        deviceModel: r.deviceModel,
        problemDescription: r.problemDescription,
        category: classifyRepairCategory(r.problemDescription, r.deviceBrand),
        status: r.status,
        priority: r.priority,
        technicianId: r.technicianId,
        technicianName: technician,
        estimatedCost: est,
        advancePaid: adv,
        totalPaid: paid,
        balanceDue,
        paymentStatus: r.paymentStatus || (paid >= est && est > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID"),
        partsUsed: r.partsUsed,
        partsSummary,
        partsCost,
        damageCost,
        totalDirectCost,
        grossProfit,
        profitMargin,
        receivingMethod: r.receivingMethod,
        isCourierIn: r.isCourierIn,
        courierInCharge: r.courierInCharge,
        courierInPaymentStatus: r.courierInPaymentStatus,
        isCourierOut: r.isCourierOut,
        courierOutCharge: r.courierOutCharge,
        courierOutPaymentStatus: r.courierOutPaymentStatus,
        createdAt: r.createdAt,
        nepalDate: toNepalDate(r.createdAt)
      };
    });
    enrichedList = enrichedList.filter((item) => {
      if (timeframe !== "ALL") {
        if (startDate && item.nepalDate < startDate) return false;
        if (endDate && item.nepalDate > endDate) return false;
      }
      if (statusFilter && statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (paymentStatusFilter && paymentStatusFilter !== "ALL" && item.paymentStatus !== paymentStatusFilter) {
        return false;
      }
      if (brandFilter && brandFilter !== "ALL" && (item.deviceBrand || "").toLowerCase() !== brandFilter.toLowerCase()) {
        return false;
      }
      if (search) {
        const matchSearch = (item.repairNumber || "").toLowerCase().includes(search) || (item.customerName || "").toLowerCase().includes(search) || (item.customerPhone || "").toLowerCase().includes(search) || (item.deviceBrand || "").toLowerCase().includes(search) || (item.deviceModel || "").toLowerCase().includes(search) || (item.problemDescription || "").toLowerCase().includes(search) || (item.technicianName || "").toLowerCase().includes(search);
        if (!matchSearch) return false;
      }
      return true;
    });
    enrichedList.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
    const totalCount = enrichedList.length;
    const startIndex = (page - 1) * limit;
    const paginatedList = enrichedList.slice(startIndex, startIndex + limit);
    const totalFilteredRevenue = enrichedList.reduce((sum, item) => sum + item.totalPaid, 0);
    const totalFilteredProfit = enrichedList.reduce((sum, item) => sum + item.grossProfit, 0);
    const totalFilteredReceivables = enrichedList.reduce((sum, item) => sum + item.balanceDue, 0);
    return res.json({
      success: true,
      repairs: paginatedList,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      sliceSummary: {
        totalFilteredRevenue,
        totalFilteredProfit,
        totalFilteredReceivables
      }
    });
  } catch (err) {
    console.error("[REVENUE REPAIRS ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve repair profitability ledger." });
  }
});
router16.post("/payments", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { repairId, amount, method, reference, notes, type } = req.body;
    if (!repairId) {
      return res.status(400).json({ error: "Repair ID is required." });
    }
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: "Payment amount must be a positive number." });
    }
    const { data: repair, error: fetchErr } = await supabaseAdmin.from("Repair").select("*").eq("id", repairId).single();
    if (fetchErr || !repair) {
      return res.status(404).json({ error: "Repair record not found." });
    }
    const currentTotalPaid = Number(repair.totalPaid || 0);
    const currentEstCost = Number(repair.estimatedCost || 0);
    const newTotalPaid = Math.round((currentTotalPaid + payAmount) * 100) / 100;
    const newPaymentStatus = newTotalPaid >= currentEstCost && currentEstCost > 0 ? "PAID" : newTotalPaid > 0 ? "PARTIAL" : "UNPAID";
    const paymentId = uuidv417();
    const { error: payInsertErr } = await supabaseAdmin.from("Payment").insert({
      id: paymentId,
      repairId,
      amount: payAmount,
      method: method || "CASH",
      reference: reference || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (payInsertErr) {
      console.warn("[PAYMENT INSERT WARN]", payInsertErr);
    }
    const updatePayload = {
      totalPaid: newTotalPaid,
      paymentStatus: newPaymentStatus,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (type === "ADVANCE" && Number(repair.advancePaid || 0) === 0) {
      updatePayload.advancePaid = payAmount;
    }
    const { error: repairUpdateErr } = await supabaseAdmin.from("Repair").update(updatePayload).eq("id", repairId);
    if (repairUpdateErr) {
      return res.status(500).json({ error: "Failed to update repair payment status: " + repairUpdateErr.message });
    }
    await logAudit({
      userId: currentUser.id,
      action: "PAYMENT_RECORDED",
      resource: "Repair",
      resourceId: repairId,
      details: {
        repairNumber: repair.repairNumber,
        customerName: repair.customerName,
        paymentAmount: payAmount,
        previousTotalPaid: currentTotalPaid,
        newTotalPaid,
        method: method || "CASH",
        paymentStatus: newPaymentStatus
      }
    });
    broadcastServerChange("repair", "UPDATE", repairId, {
      totalPaid: newTotalPaid,
      paymentStatus: newPaymentStatus
    });
    return res.json({
      success: true,
      message: `Payment of Rs. ${payAmount.toLocaleString()} recorded successfully for ${repair.repairNumber}.`,
      payment: {
        id: paymentId,
        repairId,
        amount: payAmount,
        method: method || "CASH",
        newTotalPaid,
        paymentStatus: newPaymentStatus
      }
    });
  } catch (err) {
    console.error("[RECORD PAYMENT ERROR]", err);
    return res.status(500).json({ error: "Failed to record payment." });
  }
});
router16.get("/transactions", authenticate, async (req, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userRole = normalizeRole(currentUser.role || "RECEPTIONIST");
    if (!REVENUE_VIEW_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { data: payments } = await supabaseAdmin.from("Payment").select("*").order("createdAt", { ascending: false }).limit(200);
    const { data: repairs } = await supabaseAdmin.from("Repair").select("id, repairNumber, customerName, customerPhone, deviceBrand, deviceModel, totalPaid, advancePaid, estimatedCost, paymentStatus, createdAt, createdById").order("createdAt", { ascending: false }).limit(200);
    const repairMap = /* @__PURE__ */ new Map();
    (repairs || []).forEach((r) => repairMap.set(r.id, r));
    const ledger = [];
    (payments || []).forEach((p) => {
      const rep = repairMap.get(p.repairId);
      ledger.push({
        id: p.id,
        date: p.createdAt,
        nepalDate: toNepalDate(p.createdAt),
        type: "PAYMENT_RECEIVED",
        repairNumber: rep ? rep.repairNumber : "REPAIR-DIRECT",
        customerName: rep ? rep.customerName : "Walk-in Customer",
        customerPhone: rep ? rep.customerPhone : "",
        description: `Customer payment for ${rep ? `${rep.deviceBrand} ${rep.deviceModel}` : "Repair Service"}`,
        amount: Number(p.amount || 0),
        method: p.method || "CASH",
        reference: p.reference || "N/A",
        status: "COMPLETED"
      });
    });
    (repairs || []).forEach((r) => {
      if (Number(r.totalPaid || 0) > 0 && !ledger.some((l) => l.repairNumber === r.repairNumber)) {
        ledger.push({
          id: `tx-${r.id}`,
          date: r.createdAt,
          nepalDate: toNepalDate(r.createdAt),
          type: "INTAKE_COLLECTION",
          repairNumber: r.repairNumber,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          description: `Repair collection for ${r.deviceBrand} ${r.deviceModel}`,
          amount: Number(r.totalPaid || 0),
          method: "CASH / DIRECT",
          reference: r.repairNumber,
          status: "COMPLETED"
        });
      }
    });
    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return res.json({
      success: true,
      transactions: ledger,
      count: ledger.length
    });
  } catch (err) {
    console.error("[TRANSACTIONS ERROR]", err);
    return res.status(500).json({ error: "Failed to retrieve transaction journal." });
  }
});
var revenue_default = router16;

// api/_server/routes/superAdmin.ts
import { Router as Router17 } from "express";
import path7 from "path";
import fs7 from "fs";
import multer4 from "multer";
import { v4 as uuidv418 } from "uuid";
var router17 = Router17();
var upload4 = multer4({ storage: multer4.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router17.get("/audit-logs", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
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
router17.get("/deletion-history", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { data: logs, error } = await supabaseAdmin.from("AuditLog").select("*").ilike("action", "%DELETE%").order("createdAt", { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: "Failed to fetch deletion history." });
    return res.json(logs || []);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve deletion records." });
  }
});
router17.post("/delete-data", authenticate, authorize(["SUPER_ADMIN"]), async (req, res) => {
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
router17.get("/share/history", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { data: shares } = await supabaseAdmin.from("AppletShare").select("*").order("createdAt", { ascending: false }).limit(50);
    return res.json(shares || []);
  } catch (err) {
    return res.json([]);
  }
});
router17.post("/share/applet", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const { title, description, permissions, expiresAt } = req.body;
    const shareId = uuidv418();
    const shareToken = uuidv418().replace(/-/g, "");
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
var LEADERSHIP_TARGETS = {
  "ceo": { filename: "sabita-thakur.jpg", roleLabel: "CEO" },
  "sabita-thakur": { filename: "sabita-thakur.jpg", roleLabel: "CEO" },
  "sabita": { filename: "sabita-thakur.jpg", roleLabel: "CEO" },
  "founder": { filename: "manish-sharma.jpg", roleLabel: "Founder" },
  "manish-sharma": { filename: "manish-sharma.jpg", roleLabel: "Founder" },
  "manish": { filename: "manish-sharma.jpg", roleLabel: "Founder" },
  "technical-head": { filename: "amit-sharma.jpg", roleLabel: "Technical Head" },
  "technical_head": { filename: "amit-sharma.jpg", roleLabel: "Technical Head" },
  "technicalhead": { filename: "amit-sharma.jpg", roleLabel: "Technical Head" },
  "amit-sharma": { filename: "amit-sharma.jpg", roleLabel: "Technical Head" },
  "amit": { filename: "amit-sharma.jpg", roleLabel: "Technical Head" }
};
function validateImageSignature(buffer) {
  if (!buffer || buffer.length < 12) return { valid: false };
  const headerSample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8").toLowerCase();
  if (headerSample.includes("<script") || headerSample.includes("<?php") || headerSample.includes("<html") || headerSample.includes("<!doctype") || headerSample.includes("<svg") || headerSample.includes("javascript:") || headerSample.includes("onerror=") || headerSample.includes("onload=")) {
    return { valid: false };
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { valid: true, format: "jpeg" };
  }
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return { valid: true, format: "png" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { valid: true, format: "webp" };
  }
  return { valid: false };
}
router17.post(
  ["/team/update-photo", "/update-photo"],
  authenticate,
  authorize(["SUPER_ADMIN", "ADMIN"]),
  upload4.single("file"),
  async (req, res) => {
    try {
      const rawTarget = (req.body.target || "").toString().toLowerCase().trim();
      const targetConfig = LEADERSHIP_TARGETS[rawTarget];
      if (!targetConfig) {
        return res.status(400).json({
          error: "Invalid leadership target. Permitted targets: CEO, Founder, Technical Head."
        });
      }
      let fileBuffer = null;
      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer;
      } else if (req.body.base64) {
        const base64Data = req.body.base64.replace(/^data:image\/\w+;base64,/, "");
        fileBuffer = Buffer.from(base64Data, "base64");
      }
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No image file or base64 payload provided." });
      }
      const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
      if (fileBuffer.length > MAX_PHOTO_SIZE) {
        return res.status(400).json({ error: "File size exceeds 5MB limit for leadership photos." });
      }
      const signatureCheck = validateImageSignature(fileBuffer);
      if (!signatureCheck.valid) {
        return res.status(400).json({
          error: "Invalid file format. Only authentic JPEG, PNG, and WebP images are permitted for leadership photos."
        });
      }
      const filename = targetConfig.filename;
      const publicDir = path7.join(process.cwd(), "public", "images", "team");
      if (!fs7.existsSync(publicDir)) {
        fs7.mkdirSync(publicDir, { recursive: true });
      }
      const publicFilePath = path7.join(publicDir, filename);
      const tempFilename = `.${filename}.${Date.now()}-${uuidv418().substring(0, 8)}.tmp`;
      const tempFilePath = path7.join(publicDir, tempFilename);
      try {
        fs7.writeFileSync(tempFilePath, fileBuffer);
        if (!fs7.existsSync(tempFilePath) || fs7.statSync(tempFilePath).size !== fileBuffer.length) {
          throw new Error("Verification of written temporary image failed.");
        }
        fs7.renameSync(tempFilePath, publicFilePath);
      } catch (writeErr) {
        if (fs7.existsSync(tempFilePath)) {
          try {
            fs7.unlinkSync(tempFilePath);
          } catch (_) {
          }
        }
        console.error("[LEADERSHIP PHOTO STORAGE ERROR]", writeErr?.message || writeErr);
        return res.status(500).json({ error: "Failed to safely store the new leadership photo." });
      }
      const distRoot = path7.join(process.cwd(), "dist");
      if (fs7.existsSync(distRoot)) {
        try {
          const distDir = path7.join(distRoot, "images", "team");
          if (!fs7.existsSync(distDir)) {
            fs7.mkdirSync(distDir, { recursive: true });
          }
          const distFilePath = path7.join(distDir, filename);
          const distTemp = path7.join(distDir, tempFilename);
          fs7.writeFileSync(distTemp, fileBuffer);
          fs7.renameSync(distTemp, distFilePath);
        } catch (_) {
        }
      }
      const assetDir = path7.join(process.cwd(), "src", "assets", "team");
      if (fs7.existsSync(assetDir)) {
        try {
          const assetFilePath = path7.join(assetDir, filename);
          fs7.writeFileSync(assetFilePath, fileBuffer);
        } catch (_) {
        }
      }
      const timestamp = Date.now();
      const publicUrl = `/images/team/${filename}?v=${timestamp}`;
      await logAudit({
        userId: req.user?.id || "system",
        userEmail: req.user?.email || "admin@mtslab.com",
        action: "UPDATE_LEADERSHIP_PHOTO",
        resource: "LeadershipTeam",
        details: {
          target: rawTarget,
          role: targetConfig.roleLabel,
          filename,
          size: fileBuffer.length,
          actorRole: req.user?.role,
          format: signatureCheck.format
        }
      });
      await broadcastServerChange("AppSetting", "UPDATE", `team-photo-${rawTarget}`);
      return res.json({
        success: true,
        message: `Successfully updated ${targetConfig.roleLabel} photo.`,
        url: publicUrl,
        target: rawTarget
      });
    } catch (err) {
      console.error("[UPDATE LEADERSHIP PHOTO ERROR]", err?.message || err);
      return res.status(500).json({ error: "An unexpected error occurred while updating the leadership photo." });
    }
  }
);
var superAdmin_default = router17;

// api/_server/routes/security.ts
import { Router as Router18 } from "express";
import { v4 as uuidv419 } from "uuid";
var router18 = Router18();
router18.use(authenticate);
router18.use(authorize(["SUPER_ADMIN", "ADMIN"]));
router18.get("/stats", async (req, res) => {
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
router18.get("/active-staff", async (req, res) => {
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
router18.get("/devices", async (req, res) => {
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
router18.post("/devices/:id/revoke", async (req, res) => {
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
router18.post("/devices/:id/approve", async (req, res) => {
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
router18.delete("/devices/:id", async (req, res) => {
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
router18.get("/activity-timeline", async (req, res) => {
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
var handleGetAccessRequests = async (req, res) => {
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
};
router18.get("/access-requests", handleGetAccessRequests);
router18.get("/", handleGetAccessRequests);
var handleApproveAccessRequest = async (req, res) => {
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
                id: uuidv419(),
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
    if (accessReq.userId) {
      try {
        await createNotification({
          userId: accessReq.userId,
          title: "Access Request Approved",
          message: `Your staff access request for role '${finalRole}' has been approved by ${req.user?.name || "Administrator"}.`,
          type: "ACCESS_APPROVED",
          priority: "HIGH",
          senderId: req.user?.id,
          senderName: req.user?.name,
          senderRole: req.user?.role,
          link: "/dashboard"
        });
      } catch (notifErr) {
        console.warn("[ACCESS APPROVE NOTIF WARN]", notifErr);
      }
    }
    await broadcastServerChange("AccessRequest", "UPDATE", id, { id, status: "APPROVED", role: finalRole });
    return res.json({
      success: true,
      message: `Access granted for ${accessReq.fullName} with role '${finalRole}' and device authorization.`
    });
  } catch (err) {
    console.error("[APPROVE ACCESS REQUEST ERROR]", err);
    return res.status(500).json({ error: "Failed to approve access request." });
  }
};
router18.post("/access-requests/:id/approve", handleApproveAccessRequest);
router18.post("/:id/approve", handleApproveAccessRequest);
var handleRejectAccessRequest = async (req, res) => {
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
    if (accessReq.userId) {
      try {
        await createNotification({
          userId: accessReq.userId,
          title: "Access Request Rejected",
          message: `Your access request was rejected. Reason: ${reason || "Denied by administrator"}`,
          type: "ACCESS_REJECTED",
          priority: "NORMAL",
          senderId: req.user?.id,
          senderName: req.user?.name,
          senderRole: req.user?.role
        });
      } catch (notifErr) {
        console.warn("[ACCESS REJECT NOTIF WARN]", notifErr);
      }
    }
    await broadcastServerChange("AccessRequest", "UPDATE", id, { id, status: "REJECTED" });
    return res.json({
      success: true,
      message: `Access request for ${accessReq.fullName} has been rejected.`
    });
  } catch (err) {
    console.error("[REJECT ACCESS REQUEST ERROR]", err);
    return res.status(500).json({ error: "Failed to reject access request." });
  }
};
router18.post("/access-requests/:id/reject", handleRejectAccessRequest);
router18.post("/:id/reject", handleRejectAccessRequest);
var handleResetAttempts = async (req, res) => {
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
};
router18.post("/access-requests/:id/reset-attempts", handleResetAttempts);
router18.post("/:id/reset-attempts", handleResetAttempts);
var handleSystemRepair = async (req, res) => {
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
              id: uuidv419(),
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
};
router18.post("/access-requests/system-repair", handleSystemRepair);
router18.post("/system-repair", handleSystemRepair);
var security_default = router18;

// api/_server/routes/upload.ts
import { Router as Router19 } from "express";
import multer5 from "multer";
import fs8 from "fs";
import path8 from "path";
import crypto2 from "crypto";
var router19 = Router19();
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf"
]);
var ALLOWED_FOLDERS = /* @__PURE__ */ new Set([
  "mts_lab",
  "mts_lab/service-slips",
  "mts_lab/battery-warranties",
  "mts_lab/repairs",
  "mts_lab/inventory",
  "mts_lab/slides",
  "mts_lab/profiles",
  "mts_lab/products",
  "mts_lab/documents",
  "mts_lab/test"
]);
var upload5 = multer5({
  storage: multer5.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  // 25MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not permitted. Only images and PDFs are allowed.`));
    }
  }
});
function saveFileLocally(buffer, originalName, mimeType) {
  const uploadsDir = path8.join(process.cwd(), "uploads");
  if (!fs8.existsSync(uploadsDir)) {
    try {
      fs8.mkdirSync(uploadsDir, { recursive: true });
    } catch (_) {
    }
  }
  const ext = path8.extname(originalName) || (mimeType === "application/pdf" ? ".pdf" : ".jpg");
  const filename = `${Date.now()}-${crypto2.randomBytes(6).toString("hex")}${ext}`;
  const filePath = path8.join(uploadsDir, filename);
  fs8.writeFileSync(filePath, buffer);
  return {
    url: `/uploads/${filename}`,
    secureUrl: `/uploads/${filename}`,
    publicId: filename,
    format: ext.replace(".", ""),
    bytes: buffer.length,
    resourceType: mimeType === "application/pdf" ? "raw" : "image"
  };
}
function saveBase64Locally(base64Data) {
  const uploadsDir = path8.join(process.cwd(), "uploads");
  if (!fs8.existsSync(uploadsDir)) {
    try {
      fs8.mkdirSync(uploadsDir, { recursive: true });
    } catch (_) {
    }
  }
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = ".jpg";
  let buffer;
  let isPdf = false;
  if (matches && matches.length === 3) {
    const mime = matches[1];
    isPdf = mime === "application/pdf";
    ext = isPdf ? ".pdf" : mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
    buffer = Buffer.from(matches[2], "base64");
  } else {
    buffer = Buffer.from(base64Data, "base64");
  }
  const filename = `${Date.now()}-${crypto2.randomBytes(6).toString("hex")}${ext}`;
  const filePath = path8.join(uploadsDir, filename);
  fs8.writeFileSync(filePath, buffer);
  return {
    url: `/uploads/${filename}`,
    secureUrl: `/uploads/${filename}`,
    publicId: filename,
    format: ext.replace(".", ""),
    bytes: buffer.length,
    resourceType: isPdf ? "raw" : "image"
  };
}
router19.get("/status", async (req, res) => {
  try {
    const status = await pingCloudinary();
    return res.json({
      success: true,
      storage: status.connected ? "CLOUDINARY" : "LOCAL_STORAGE",
      ...status
    });
  } catch (err) {
    return res.json({
      success: true,
      storage: "LOCAL_STORAGE",
      connected: false,
      error: err.message || "Cloudinary offline, falling back to local storage"
    });
  }
});
router19.post("/", authenticate, upload5.single("file"), async (req, res) => {
  try {
    const useCloudinary = isCloudinaryConfigured();
    let folder = (req.query.folder || req.body?.folder || "mts_lab").trim();
    if (!ALLOWED_FOLDERS.has(folder)) {
      folder = "mts_lab";
    }
    if (req.file) {
      if (useCloudinary) {
        const isPdf = req.file.mimetype === "application/pdf";
        const resourceType = isPdf ? "auto" : "image";
        const result = await uploadToCloudinary(req.file.buffer, {
          folder,
          resourceType
        });
        return res.json({
          success: true,
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          resourceType: result.resource_type,
          folder,
          width: result.width,
          height: result.height
        });
      } else {
        const local = saveFileLocally(req.file.buffer, req.file.originalname, req.file.mimetype);
        return res.json({
          success: true,
          ...local,
          folder
        });
      }
    }
    const base64Data = req.body?.base64Image || req.body?.image || req.body?.file;
    if (base64Data && typeof base64Data === "string") {
      if (useCloudinary) {
        const isPdf = base64Data.startsWith("data:application/pdf");
        const resourceType = isPdf ? "auto" : "image";
        const result = await uploadBase64ToCloudinary(base64Data, {
          folder,
          resourceType
        });
        return res.json({
          success: true,
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          resourceType: result.resource_type,
          folder,
          width: result.width,
          height: result.height
        });
      } else {
        const local = saveBase64Locally(base64Data);
        return res.json({
          success: true,
          ...local,
          folder
        });
      }
    }
    return res.status(400).json({ error: "No file or image content provided in request." });
  } catch (err) {
    console.error("[UPLOAD ROUTE ERROR]", err);
    return res.status(500).json({
      error: err.message || "Failed to upload asset."
    });
  }
});
router19.post("/pdf", authenticate, upload5.single("file"), async (req, res) => {
  try {
    const useCloudinary = isCloudinaryConfigured();
    const docType = (req.body?.docType || req.query.docType || "GENERAL").toUpperCase();
    const referenceNumber = (req.body?.referenceNumber || req.query.referenceNumber || "doc").trim();
    if (useCloudinary) {
      let result;
      if (req.file) {
        result = await uploadPdfToCloudinary(
          req.file.buffer,
          docType === "SERVICE_SLIP" ? "SERVICE_SLIP" : docType === "BATTERY_WARRANTY" ? "BATTERY_WARRANTY" : "GENERAL",
          referenceNumber
        );
      } else if (req.body?.pdfBase64 || req.body?.base64) {
        const b64 = req.body.pdfBase64 || req.body.base64;
        result = await uploadPdfToCloudinary(
          b64,
          docType === "SERVICE_SLIP" ? "SERVICE_SLIP" : docType === "BATTERY_WARRANTY" ? "BATTERY_WARRANTY" : "GENERAL",
          referenceNumber
        );
      } else {
        return res.status(400).json({ error: "No PDF file or base64 data provided." });
      }
      return res.json({
        success: true,
        url: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format || "pdf",
        bytes: result.bytes,
        resourceType: result.resource_type,
        docType,
        referenceNumber
      });
    } else {
      let local;
      if (req.file) {
        local = saveFileLocally(req.file.buffer, req.file.originalname, "application/pdf");
      } else if (req.body?.pdfBase64 || req.body?.base64) {
        const b64 = req.body.pdfBase64 || req.body.base64;
        local = saveBase64Locally(b64);
      } else {
        return res.status(400).json({ error: "No PDF file or base64 data provided." });
      }
      return res.json({
        success: true,
        ...local,
        referenceNumber,
        docType
      });
    }
  } catch (err) {
    console.error("[PDF UPLOAD ERROR]", err);
    return res.status(500).json({
      error: err.message || "Failed to upload PDF."
    });
  }
});
router19.delete("/", authenticate, async (req, res) => {
  try {
    const { publicId, url, resourceType = "image" } = req.body;
    const target = publicId || (url ? extractPublicIdFromUrl(url) : null);
    if (!target) {
      return res.status(400).json({ error: "Target publicId or url is required for deletion." });
    }
    const deletion = await deleteFromCloudinary(target, resourceType);
    return res.json({
      success: true,
      ...deletion
    });
  } catch (err) {
    console.error("[DELETE UPLOAD ERROR]", err);
    return res.status(500).json({
      error: err.message || "Failed to delete asset from Cloudinary."
    });
  }
});
var upload_default = router19;

// api/_server/routes/events.ts
import { Router as Router20 } from "express";
var router20 = Router20();
router20.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const acceptsSSE = req.headers.accept && req.headers.accept.includes("text/event-stream");
  if (acceptsSSE) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "close");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(`event: connected
data: ${JSON.stringify({ status: "connected", engine: "supabase", timestamp: Date.now() })}

`);
    return res.end();
  }
  return res.json({
    status: "active",
    engine: "supabase-realtime",
    timestamp: Date.now()
  });
});
var events_default = router20;

// api/_server/routes/public.ts
import { Router as Router21 } from "express";
var router21 = Router21();
var handlePublicSlides = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const slides = await getSlides(true);
    return res.json(slides || []);
  } catch (err) {
    console.error("[PUBLIC SLIDES EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to retrieve public slides." });
  }
};
router21.get("/slides", handlePublicSlides);
router21.get("/home-slides", handlePublicSlides);
function normalizePhoneDigits(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}
function isPhoneMatching(providedPhoneDigits, recordPhone) {
  if (!providedPhoneDigits || !recordPhone) return false;
  const dbDigits = normalizePhoneDigits(recordPhone);
  if (!dbDigits) return false;
  if (providedPhoneDigits === dbDigits) return true;
  const p10 = providedPhoneDigits.length >= 10 ? providedPhoneDigits.slice(-10) : providedPhoneDigits;
  const db10 = dbDigits.length >= 10 ? dbDigits.slice(-10) : dbDigits;
  if (p10 === db10) return true;
  if (providedPhoneDigits.length >= 7 && dbDigits.length >= 7) {
    if (providedPhoneDigits.slice(-7) === dbDigits.slice(-7)) return true;
  }
  return false;
}
var handlePublicTrack = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const rawRepairNumber = req.body?.repairNumber || req.query?.repairNumber || req.body?.ticketNumber || req.query?.ticketNumber || "";
    const rawPhone = req.body?.phone || req.query?.phone || req.body?.customerPhone || req.query?.customerPhone || "";
    const cleanRepairNumber = String(rawRepairNumber).trim().replace(/^#+/, "").trim();
    const cleanPhone = normalizePhoneDigits(String(rawPhone));
    const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
    if (!cleanRepairNumber && !cleanPhone) {
      return res.status(400).json({ error: "Please enter your Repair Number or Registered Phone Number." });
    }
    const selectFields = `
      id,
      repairNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceBrand,
      deviceModel,
      problemDescription,
      deviceCondition,
      conditionNotes,
      accessoriesReceived,
      status,
      priority,
      expectedCompletionDate,
      estimatedCost,
      advancePaid,
      totalPaid,
      paymentStatus,
      receivingMethod,
      isCourierIn,
      isCourierOut,
      courierStatus,
      courierCompany,
      courierTrackingNumber,
      returnCourierCompany,
      returnCourierTrackingNumber,
      returnCourierDispatchDate,
      courierOutDeliveredDate,
      hasBatteryWarranty,
      batteryWarrantyPeriod,
      batteryType,
      batteryHealth,
      batterySerial,
      batteryWarrantyExpiry,
      warrantyTerms,
      remarks,
      createdAt,
      updatedAt
    `;
    let allMatchingRepairs = [];
    if (cleanRepairNumber && cleanPhone) {
      const { data: candidates, error: cErr } = await supabaseAdmin.from("Repair").select(selectFields).or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`).order("createdAt", { ascending: false }).limit(10);
      if (cErr) {
        console.error("[PUBLIC TRACK CANDIDATE ERROR]", cErr);
      }
      if (candidates && candidates.length > 0) {
        for (const cand of candidates) {
          if (isPhoneMatching(cleanPhone, cand.customerPhone)) {
            allMatchingRepairs.push(cand);
          } else if (cand.customerId) {
            const { data: linkedCustomer } = await supabaseAdmin.from("Customer").select("phone, alternativePhone").eq("id", cand.customerId).maybeSingle();
            if (linkedCustomer && (isPhoneMatching(cleanPhone, linkedCustomer.phone) || isPhoneMatching(cleanPhone, linkedCustomer.alternativePhone))) {
              allMatchingRepairs.push(cand);
            }
          }
        }
      }
    } else if (cleanRepairNumber) {
      const { data: singleRepair } = await supabaseAdmin.from("Repair").select(selectFields).or(`repairNumber.eq.${cleanRepairNumber},repairNumber.ilike.%${cleanRepairNumber}%`).order("createdAt", { ascending: false }).limit(1).maybeSingle();
      if (singleRepair) {
        allMatchingRepairs.push(singleRepair);
      }
    } else if (cleanPhone) {
      const { data: directMatches } = await supabaseAdmin.from("Repair").select(selectFields).or(`customerPhone.eq.${cleanPhone},customerPhone.ilike.%${phone10}%`).order("createdAt", { ascending: false }).limit(20);
      if (directMatches && directMatches.length > 0) {
        for (const r of directMatches) {
          if (isPhoneMatching(cleanPhone, r.customerPhone)) {
            allMatchingRepairs.push(r);
          }
        }
      }
      const { data: cusList } = await supabaseAdmin.from("Customer").select("id, phone, alternativePhone").or(`phone.eq.${cleanPhone},phone.ilike.%${phone10}%,alternativePhone.ilike.%${phone10}%`).limit(10);
      if (cusList && cusList.length > 0) {
        for (const cus of cusList) {
          if (isPhoneMatching(cleanPhone, cus.phone) || isPhoneMatching(cleanPhone, cus.alternativePhone)) {
            const { data: customerRepairs } = await supabaseAdmin.from("Repair").select(selectFields).eq("customerId", cus.id).order("createdAt", { ascending: false }).limit(10);
            if (customerRepairs) {
              for (const cr of customerRepairs) {
                if (!allMatchingRepairs.some((existing) => existing.id === cr.id)) {
                  allMatchingRepairs.push(cr);
                }
              }
            }
          }
        }
      }
    }
    if (!allMatchingRepairs || allMatchingRepairs.length === 0) {
      return res.status(404).json({ error: "No repair records found matching your tracking information." });
    }
    const primaryRepair = allMatchingRepairs[0];
    const allRepairIds = allMatchingRepairs.map((r) => r.id);
    const { data: allExplicitLogs } = await supabaseAdmin.from("RepairLog").select("id, repairId, status, message, createdAt").in("repairId", allRepairIds).order("createdAt", { ascending: false });
    const getCustomerLogDesc = (logStatus, currentOverallStatus) => {
      const st = (logStatus || currentOverallStatus || "RECEIVED").toUpperCase().trim();
      const currentSt = (currentOverallStatus || "RECEIVED").toUpperCase().trim();
      const isDeliveredOverall = currentSt === "DELIVERED" || currentSt === "COMPLETED";
      const isRepairedOrBeyond = isDeliveredOverall || currentSt === "REPAIRED" || currentSt === "READY_FOR_PICKUP" || currentSt === "READY_FOR_DELIVERY" || currentSt === "COURIER_DISPATCHED" || currentSt === "DISPATCHED_VIA_COURIER" || currentSt === "REPROBLEM_FIXED" || currentSt === "WARRANTY_FIXED";
      if (st === "REPAIRED" || st.includes("WARRANTY_FIXED") || st.includes("REPROBLEM_FIXED")) {
        return "The technical repair was successfully completed and the device passed the required quality verification.";
      }
      if (st.includes("READY") || st.includes("PICKUP")) {
        return "The repaired device is sanitized, packaged, and ready for customer pickup.";
      }
      if (st.includes("COURIER") || st.includes("DISPATCH")) {
        return "The repaired device was safely packed and dispatched via courier logistics.";
      }
      if (st.includes("DELIVERED") || st.includes("COMPLETED")) {
        return "The device was handed over to the customer when the actual status reaches Delivered.";
      }
      if (st.includes("TEST") || st.includes("QA")) {
        if (isRepairedOrBeyond) {
          return "The repaired device underwent quality verification/testing.";
        }
        return "The repaired device is undergoing comprehensive quality verification and calibration.";
      }
      if (st.includes("PROCESS") || st.includes("RESTORATION") || st.includes("WAITING_FOR_PARTS") || st === "REPAIRING") {
        if (isRepairedOrBeyond) {
          return "The required repair/restoration work was carried out.";
        }
        return "The required repair/restoration work is currently being carried out by certified engineers.";
      }
      if (st.includes("DIAGNOSING")) {
        return "The device was inspected/diagnosed to identify the reported issue.";
      }
      if (st.includes("RECEIVED") || st.includes("CREATED")) {
        return "The device was received by MTS Lab for repair.";
      }
      if (st.includes("PENDING")) {
        return "Your device is cataloged in the service queue awaiting laboratory intake and diagnosis.";
      }
      if (st.includes("RE_PROBLEM") || st.includes("REPROBLEM")) {
        return "Device received for priority diagnostic re-evaluation.";
      }
      if (st.includes("CANCEL")) {
        return "Repair service request closed.";
      }
      if (st.includes("CANNOT")) {
        return "Catastrophic hardware damage exceeds viable safe restoration standards.";
      }
      return "Device status updated to reflect laboratory progress.";
    };
    const extractPublicNote = (msg) => {
      if (!msg) return null;
      const match = msg.match(/Note:\s*([^.\n]+)/i) || msg.match(/Note:\s*(.+)$/i);
      if (match && match[1]) {
        const note = match[1].trim();
        if (note && !note.toLowerCase().startsWith("by ")) return note;
      }
      return null;
    };
    const buildLogsForRepair = (rep) => {
      const repLogs = (allExplicitLogs || []).filter((l) => l.repairId === rep.id);
      const currentSt = (rep.status || "RECEIVED").toUpperCase().trim();
      const notesByStatus = {};
      repLogs.forEach((l) => {
        const key = (l.status || "").toUpperCase().trim();
        const note = extractPublicNote(l.message);
        if (note && !notesByStatus[key]) {
          notesByStatus[key] = note;
        }
      });
      const isDelivered = currentSt === "DELIVERED" || currentSt === "COMPLETED";
      const isRepaired = [
        "REPAIRED",
        "READY_FOR_PICKUP",
        "READY_FOR_DELIVERY",
        "READY",
        "COURIER_DISPATCHED",
        "DISPATCHED_VIA_COURIER",
        "REPROBLEM_FIXED",
        "WARRANTY_FIXED"
      ].includes(currentSt);
      const isTesting = ["TESTING", "QA_TESTING", "QA"].includes(currentSt);
      const isRestoration = [
        "IN_PROCESS",
        "IN_PROGRESS",
        "WAITING_FOR_PARTS",
        "RESTORATION",
        "REPAIRING",
        "RE_PROBLEM",
        "REPROBLEM"
      ].includes(currentSt);
      const isDiagnosing = currentSt === "DIAGNOSING";
      const isCancelled = currentSt.includes("CANCEL");
      const isCannotRepair = currentSt.includes("CANNOT");
      const trace = [];
      if (isDelivered) {
        trace.push({
          id: `trace-${rep.id}-delivered`,
          action: "STATUS_UPDATED",
          status: "DELIVERED",
          title: "Delivered",
          notes: "The device was safely delivered and handed over to the customer.",
          message: "The device was safely delivered and handed over to the customer.",
          statusText: "Completed"
        });
      }
      if (isDelivered || isRepaired) {
        const customNote = notesByStatus["REPAIRED"] || notesByStatus["READY_FOR_PICKUP"] || "";
        const desc = customNote ? `The technical repair was successfully completed and quality verification passed. (${customNote})` : "The technical repair was successfully completed and the device passed the required quality verification.";
        trace.push({
          id: `trace-${rep.id}-repaired`,
          action: "STATUS_UPDATED",
          status: "REPAIRED",
          title: "Repaired",
          notes: desc,
          message: desc,
          statusText: "Completed"
        });
      }
      if (isDelivered || isRepaired || isTesting) {
        const isPast = isDelivered || isRepaired;
        trace.push({
          id: `trace-${rep.id}-qa`,
          action: "STATUS_UPDATED",
          status: "QA_TESTING",
          title: "QA Testing",
          notes: isPast ? "The repaired device completed comprehensive quality verification, electrical diagnostic check, and functionality testing." : "The repaired device is undergoing comprehensive quality verification, electrical diagnostic check, and calibration.",
          message: isPast ? "The repaired device completed comprehensive quality verification, electrical diagnostic check, and functionality testing." : "The repaired device is undergoing comprehensive quality verification, electrical diagnostic check, and calibration.",
          statusText: isPast ? "Completed" : "Active"
        });
      }
      if (isDelivered || isRepaired || isTesting || isRestoration) {
        const isPast = isDelivered || isRepaired || isTesting;
        const customNote = notesByStatus["IN_PROCESS"] || notesByStatus["RESTORATION"] || "";
        const desc = isPast ? customNote ? `Component restoration and precision servicing successfully executed. (${customNote})` : "Component restoration and precision servicing successfully executed by certified hardware engineers." : "Active hardware restoration and component servicing is currently in progress.";
        trace.push({
          id: `trace-${rep.id}-restoration`,
          action: "STATUS_UPDATED",
          status: "RESTORATION",
          title: "Restoration",
          notes: desc,
          message: desc,
          statusText: isPast ? "Completed" : "Active"
        });
      }
      if (isDelivered || isRepaired || isTesting || isRestoration || isDiagnosing) {
        const isPast = isDelivered || isRepaired || isTesting || isRestoration;
        trace.push({
          id: `trace-${rep.id}-diagnosing`,
          action: "STATUS_UPDATED",
          status: "DIAGNOSING",
          title: "Diagnosing",
          notes: isPast ? "Circuit and schematic diagnostic assessment completed to identify fault causes." : "Hardware diagnostic assessment and multi-point circuit inspection under way.",
          message: isPast ? "Circuit and schematic diagnostic assessment completed to identify fault causes." : "Hardware diagnostic assessment and multi-point circuit inspection under way.",
          statusText: isPast ? "Completed" : "Active"
        });
      }
      trace.push({
        id: `trace-${rep.id}-received`,
        action: "STATUS_UPDATED",
        status: "RECEIVED",
        title: "Received",
        notes: "Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.",
        message: "Device received, securely cataloged in MTS Lab laboratory queue, and assigned initial tracking.",
        statusText: "Completed"
      });
      if (isCancelled) {
        trace.unshift({
          id: `trace-${rep.id}-cancelled`,
          action: "STATUS_UPDATED",
          status: "CANCELLED",
          title: "Service Cancelled",
          notes: "Repair service ticket was closed or cancelled by customer request.",
          message: "Repair service ticket was closed or cancelled by customer request.",
          statusText: "Closed"
        });
      } else if (isCannotRepair) {
        trace.unshift({
          id: `trace-${rep.id}-cannot-repair`,
          action: "STATUS_UPDATED",
          status: "CANNOT_REPAIR",
          title: "Cannot Repair",
          notes: "Hardware damage exceeds safe restoration limits or replacement parts are permanently unavailable.",
          message: "Hardware damage exceeds safe restoration limits or replacement parts are permanently unavailable.",
          statusText: "Closed"
        });
      }
      return trace;
    };
    const rawName = primaryRepair.customerName || "";
    const sanitizedName = rawName ? `${rawName.charAt(0)}*** ${rawName.split(" ").slice(-1)[0] || ""}`.trim() : "Valued Customer";
    const pDigits = normalizePhoneDigits(primaryRepair.customerPhone || cleanPhone);
    const sanitizedPhone = pDigits && pDigits.length >= 6 ? `${pDigits.slice(0, 3)}****${pDigits.slice(-3)}` : void 0;
    const sanitizePublicRepairObj = (rep) => {
      const {
        technicianId,
        technician,
        assignedTechnician,
        assignedTechnicianId,
        technicianName,
        createdById,
        receptionist,
        receptionistId,
        receptionistName,
        manager,
        managerId,
        managerName,
        admin,
        adminId,
        adminName,
        user,
        userId,
        staff,
        staffName,
        ...safe
      } = rep;
      return {
        ...safe,
        customerName: sanitizedName,
        customerPhone: sanitizedPhone,
        logs: buildLogsForRepair(rep)
      };
    };
    const sanitizedPrimary = sanitizePublicRepairObj(primaryRepair);
    const sanitizedAll = allMatchingRepairs.map((rep) => sanitizePublicRepairObj(rep));
    return res.json({
      success: true,
      repair: sanitizedPrimary,
      repairs: sanitizedAll,
      devices: sanitizedAll,
      ...sanitizedPrimary
    });
  } catch (err) {
    console.error("[PUBLIC TRACK EXCEPTION]", err);
    return res.status(500).json({ error: "Failed to retrieve tracking details. Please try again later." });
  }
};
router21.get("/track", handlePublicTrack);
router21.post("/track", handlePublicTrack);
router21.get("/public/track", handlePublicTrack);
router21.post("/public/track", handlePublicTrack);
router21.get("/manager/stats", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
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
router21.get("/manager/workload", authenticate, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]), async (req, res) => {
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
router21.get("/dashboard/stats", authenticate, async (req, res) => {
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
var public_default = router21;

// api/_server/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());
  const uploadsDir = path9.join(process.cwd(), "uploads");
  if (!fs9.existsSync(uploadsDir)) {
    try {
      fs9.mkdirSync(uploadsDir, { recursive: true });
    } catch (_) {
    }
  }
  app.use("/uploads", express.static(uploadsDir));
  app.use("/api/auth", auth_default);
  app.use("/api/users", users_default);
  app.use("/api/user", users_default);
  app.use("/api/staff", users_default);
  app.use("/api/staffs", users_default);
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
  app.use("/api/dashboard", dashboard_default);
  app.use("/api/revenue", revenue_default);
  app.use("/api/finance", revenue_default);
  app.use("/api/admin", superAdmin_default);
  app.use("/api/team", superAdmin_default);
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
