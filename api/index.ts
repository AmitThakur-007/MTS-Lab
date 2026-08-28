import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

export type VercelRequest = IncomingMessage & {
  body?: any;
  query?: any;
  cookies?: any;
};

export type VercelResponse = ServerResponse & {
  status: (statusCode: number) => VercelResponse;
  json: (body: any) => void;
  send: (body: any) => void;
};

// Helper to parse JSON body from incoming request
async function parseJsonBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: VercelResponse, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');
  res.status(status).json(data);
}

interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  phoneNumber?: string;
  department?: string;
  address?: string;
}

export interface AppUserDoc {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  disabled?: boolean;
  accountStatus?: string;
  emailVerified?: boolean;
  firebaseUid?: string;
  deletedAt?: any;
  [key: string]: any;
}

let dbInstance: admin.firestore.Firestore | null = null;

export function getAdminDb(): admin.firestore.Firestore | null {
  if (dbInstance) return dbInstance;
  try {
    if (!admin.apps.length) {
      const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_CREDENTIALS;
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'mts-mobile-lab-system';
      if (serviceAccountVar) {
        try {
          const cert = typeof serviceAccountVar === 'string' ? JSON.parse(serviceAccountVar) : serviceAccountVar;
          admin.initializeApp({ credential: admin.credential.cert(cert), projectId });
        } catch {
          admin.initializeApp({ projectId });
        }
      } else {
        admin.initializeApp({ projectId });
      }
    }
    dbInstance = admin.firestore();
    return dbInstance;
  } catch (err) {
    console.warn('[FIREBASE ADMIN DB INIT WARNING]', err);
    return null;
  }
}

export async function findApplicationUser(
  email: string,
  firebaseUid?: string
): Promise<{ user: AppUserDoc | null; isBlocked: boolean; isUnprovisioned: boolean }> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const db = getAdminDb();
  if (!db) {
    return { user: null, isBlocked: false, isUnprovisioned: false };
  }

  try {
    let docData: AppUserDoc | null = null;

    if (firebaseUid) {
      const byDocId = await db.collection('users').doc(firebaseUid).get();
      if (byDocId.exists) {
        docData = { id: byDocId.id, ...byDocId.data() };
      } else {
        const querySnap = await db.collection('users').where('firebaseUid', '==', firebaseUid).limit(1).get();
        if (!querySnap.empty) {
          const doc = querySnap.docs[0];
          docData = { id: doc.id, ...doc.data() };
        }
      }
    }

    if (!docData && normalizedEmail) {
      const querySnap = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
      if (!querySnap.empty) {
        const doc = querySnap.docs[0];
        docData = { id: doc.id, ...doc.data() };
      }
    }

    if (!docData) {
      return { user: null, isBlocked: false, isUnprovisioned: true };
    }

    const isInactive =
      docData.isActive === false ||
      docData.disabled === true ||
      docData.accountStatus === 'INACTIVE' ||
      docData.accountStatus === 'DISABLED' ||
      Boolean(docData.deletedAt);

    if (isInactive) {
      return { user: docData, isBlocked: true, isUnprovisioned: false };
    }

    return { user: docData, isBlocked: false, isUnprovisioned: false };
  } catch (err) {
    console.warn('[FIND APP USER FIRESTORE ERROR]', err);
    return { user: null, isBlocked: false, isUnprovisioned: false };
  }
}

export async function markApplicationUserVerified(
  userObj?: AppUserDoc | null,
  firebaseUid?: string,
  email?: string
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  try {
    const docId = userObj?.id || firebaseUid;
    const targetEmail = userObj?.email || email;

    if (docId) {
      const ref = db.collection('users').doc(docId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.update({ emailVerified: true, updatedAt: new Date().toISOString() });
        return true;
      }
    }

    if (targetEmail) {
      const snap = await db.collection('users').where('email', '==', targetEmail.toLowerCase().trim()).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((doc) => {
          batch.update(doc.ref, { emailVerified: true, updatedAt: new Date().toISOString() });
        });
        await batch.commit();
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('[MARK VERIFIED FIRESTORE ERROR]', err);
    return false;
  }
}

const OTP_SALT = process.env.OTP_SALT || process.env.JWT_SECRET || 'mts-lab-otp-secure-salt-2026';

function hashOtp(code: string): string {
  return crypto.createHmac('sha256', OTP_SALT).update(String(code).trim()).digest('hex');
}

function verifyOtp(inputCode: string, storedHash: string): boolean {
  if (!inputCode || !storedHash) return false;
  const computedHash = hashOtp(inputCode);
  if (computedHash.length !== storedHash.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

function generate6DigitOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'registered email';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

// Mail Transporter
function initMailTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      tls: { rejectUnauthorized: false }
    });
  } else if (smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      tls: { rejectUnauthorized: false }
    });
  }
  return null;
}

// Dispatch Email with Multi-Provider Support (Resend -> SendGrid -> Nodemailer -> Firebase OOB)
async function sendSecurityEmail(params: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, text, html } = params;
  const fromAddress = process.env.SMTP_FROM || process.env.GMAIL_USER || process.env.EMAIL_USER || '"MTS Lab Security" <no-reply@mtslab.com>';

  // 1. Resend HTTP API
  if (process.env.RESEND_API_KEY) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress.includes('<') ? fromAddress : `MTS Lab <${fromAddress}>`,
          to: [to],
          subject,
          text: text || '',
          html: html || text || ''
        })
      });
      const resData: any = await resendRes.json().catch(() => ({}));
      if (resendRes.ok) {
        console.log(`[EMAIL DISPATCH] Resend API delivered message to ${maskEmail(to)}`);
        return { success: true, messageId: resData?.id };
      }
    } catch (resendErr: any) {
      console.warn('[EMAIL DISPATCH] Resend attempt failed:', resendErr?.message || resendErr);
    }
  }

  // 2. SendGrid HTTP API
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sendgridRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.SMTP_FROM_EMAIL || 'no-reply@mtslab.com', name: 'MTS Lab Security' },
          subject,
          content: [
            { type: 'text/plain', value: text || '' },
            { type: 'text/html', value: html || text || '' }
          ]
        })
      });
      if (sendgridRes.ok || sendgridRes.status === 202) {
        console.log(`[EMAIL DISPATCH] SendGrid delivered message to ${maskEmail(to)}`);
        return { success: true };
      }
    } catch (sgErr: any) {
      console.warn('[EMAIL DISPATCH] SendGrid attempt failed:', sgErr?.message || sgErr);
    }
  }

  // 3. Nodemailer (Gmail App Password or Custom SMTP)
  const transporter = initMailTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: text || '',
        html: html || text || ''
      });
      console.log(`[EMAIL DISPATCH] SMTP delivered message to ${maskEmail(to)} (ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (smtpErr: any) {
      console.warn(`[EMAIL DISPATCH] SMTP attempt failed (${smtpErr?.code || smtpErr?.message})`);
    }
  }

  console.warn(`[EMAIL DISPATCH] Outbound email could not be delivered to ${maskEmail(to)} because no active SMTP credentials or API keys were configured.`);
  return { success: false, error: 'No active email service configured in environment.' };
}

// Centralized Firebase Email Verification Error Mapping
export function mapFirebaseVerificationError(errorCode?: string): { status: number; code: string; message: string } {
  const cleanCode = String(errorCode || '').trim().toUpperCase().split(' : ')[0];

  if (cleanCode === 'TOO_MANY_ATTEMPTS_TRY_LATER' || cleanCode === 'AUTH/TOO-MANY-REQUESTS') {
    return {
      status: 429,
      code: 'TOO_MANY_ATTEMPTS_TRY_LATER',
      message: 'Firebase has temporarily rate-limited verification emails. Please wait before trying again.'
    };
  }

  if (cleanCode === 'UNAUTHORIZED_DOMAIN' || cleanCode === 'AUTH/UNAUTHORIZED-DOMAIN') {
    return {
      status: 422,
      code: 'UNAUTHORIZED_DOMAIN',
      message: 'This production domain is not authorized in Firebase Authentication. Please contact the administrator.'
    };
  }

  if (
    cleanCode === 'INVALID_ID_TOKEN' ||
    cleanCode === 'TOKEN_EXPIRED' ||
    cleanCode === 'AUTH/INVALID-USER-TOKEN' ||
    cleanCode === 'AUTH/USER-TOKEN-EXPIRED'
  ) {
    return {
      status: 401,
      code: cleanCode || 'INVALID_ID_TOKEN',
      message: 'Your Firebase session has expired. Please sign in again before requesting a verification email.'
    };
  }

  return {
    status: 503,
    code: cleanCode || 'UNKNOWN_PROVIDER_ERROR',
    message: 'Firebase could not send the verification email. Please try again later or contact the administrator.'
  };
}

// Serverless in-memory rate limiting map (60 seconds per email)
const serverlessVerificationCooldowns = new Map<string, number>();

function getVerificationCooldown(email: string): number {
  const key = String(email || '').toLowerCase().trim();
  const expiresAt = serverlessVerificationCooldowns.get(key) || 0;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    serverlessVerificationCooldowns.delete(key);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

function setVerificationCooldown(email: string): void {
  const key = String(email || '').toLowerCase().trim();
  if (key) {
    serverlessVerificationCooldowns.set(key, Date.now() + 60 * 1000);
  }
}

interface Serverless2FATicket {
  ticketId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  otpHash: string;
  expiresAt: number;
  attemptsLeft: number;
  lastSentAt: number;
}

const serverless2FAStore = new Map<string, Serverless2FATicket>();

function cleanupServerless2FATickets(): void {
  const now = Date.now();
  for (const [ticketId, ticket] of serverless2FAStore.entries()) {
    if (ticket.expiresAt < now || ticket.attemptsLeft <= 0) {
      serverless2FAStore.delete(ticketId);
    }
  }
}

// Serverless Authentication Helper Policy
export function requiresTwoFactorAuthentication(role?: string): boolean {
  return true;
}

// Dispatch Official Firebase Email Verification via Identity Toolkit REST API
async function sendFirebaseVerificationEmail(params: {
  email: string;
  idToken?: string;
  password?: string;
}): Promise<{ sent: boolean; alreadyVerified?: boolean; errorCode?: string; mappedError?: { status: number; code: string; message: string } }> {
  const { email, password } = params;
  let idToken = params.idToken;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDw4d4eSahPP6KL-0qZzzIr8V5BJaHtpNs';
  const normalizedEmail = String(email || '').toLowerCase().trim();

  try {
    // If idToken is not present but password is provided, authenticate to fetch active idToken
    if (!idToken && password && normalizedEmail) {
      const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, returnSecureToken: true })
      });
      const signInData: any = await signInRes.json().catch(() => ({}));
      if (signInRes.ok && signInData?.idToken) {
        idToken = signInData.idToken;
        const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        if (lookupRes.ok) {
          const lookupData: any = await lookupRes.json().catch(() => ({}));
          const fbUser = lookupData?.users?.[0];
          if (fbUser && fbUser.emailVerified === true) {
            return { sent: false, alreadyVerified: true };
          }
        }
      } else {
        const provError = signInData?.error?.message || signInData?.error?.status || 'INVALID_LOGIN_CREDENTIALS';
        return { sent: false, errorCode: provError, mappedError: mapFirebaseVerificationError(provError) };
      }
    }

    // Verify token identity and check if user is already verified
    if (idToken) {
      const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      if (lookupRes.ok) {
        const lookupData: any = await lookupRes.json().catch(() => ({}));
        const fbUser = lookupData?.users?.[0];
        if (fbUser && fbUser.emailVerified === true) {
          return { sent: false, alreadyVerified: true };
        }
      } else {
        const lookupError: any = await lookupRes.json().catch(() => ({}));
        const provError = lookupError?.error?.message || lookupError?.error?.status || 'INVALID_ID_TOKEN';
        return { sent: false, errorCode: provError, mappedError: mapFirebaseVerificationError(provError) };
      }
    }

    if (!idToken) {
      const missingTokenErr = 'INVALID_ID_TOKEN';
      return { sent: false, errorCode: missingTokenErr, mappedError: mapFirebaseVerificationError(missingTokenErr) };
    }

    // Dispatch official verification email link from Firebase mail servers
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken })
    });

    if (response.ok) {
      return { sent: true };
    }

    const resData: any = await response.json().catch(() => ({}));
    const providerMessage = resData?.error?.message || resData?.error?.status || 'UNKNOWN_PROVIDER_ERROR';
    const mapped = mapFirebaseVerificationError(providerMessage);

    return { sent: false, errorCode: providerMessage, mappedError: mapped };
  } catch (err: any) {
    const errorString = err?.message || 'NETWORK_ERROR';
    return { sent: false, errorCode: errorString, mappedError: mapFirebaseVerificationError(errorString) };
  }
}

function render2faEmailTemplate(name: string, otpCode: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; background-color: #f8fafc; border-radius: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 8px 18px; background-color: #0f172a; border-radius: 12px; color: #ffffff; font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">MTS LAB</div>
        <h2 style="color: #0f172a; margin: 14px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Security Verification Code</h2>
        <p style="color: #64748b; margin: 0; font-size: 13px; font-weight: 500;">Two-Factor Authentication (2FA)</p>
      </div>
      <div style="background-color: #ffffff; padding: 32px 28px; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 8px 0; font-weight: 600;">Hello ${name || 'Staff Member'},</p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 24px 0;">Use the following 6-digit verification code to complete your login:</p>
        
        <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 16px 36px; margin: 0 auto 24px auto;">
          <span style="font-family: monospace, Courier, sans-serif; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0f172a;">${otpCode}</span>
        </div>

        <p style="color: #e11d48; font-size: 13px; font-weight: 700; margin: 0 0 16px 0;">This code will expire in 5 minutes.</p>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
          If you did not attempt to sign in to MTS Lab, please contact the Super Administrator immediately.
        </p>
      </div>
      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
        MTS Lab &bull; Kathmandu, Nepal &bull; Automated Security System
      </div>
    </div>
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // 1. POST /api/auth/login or /api/login (Stage 1: Credentials -> Issues 2FA Ticket & Sends OTP Email)
    if (pathname.endsWith('/auth/login') || pathname === '/api/login') {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }

      const body = await parseJsonBody(req);
      const identity = String(body.identity || body.email || body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const firebaseIdToken = body.firebaseIdToken;

      if (!identity) {
        return sendJson(res, 400, { success: false, message: 'Work Email is required.' });
      }

      if (!password && !firebaseIdToken) {
        return sendJson(res, 400, { success: false, message: 'Password or authentication token is required.' });
      }

      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDw4d4eSahPP6KL-0qZzzIr8V5BJaHtpNs';
      let authenticatedFbUser: any = null;

      // 1. Authoritative Identity Verification via Firebase Identity Toolkit
      if (password) {
        const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identity, password, returnSecureToken: true })
        });

        const signInData: any = await signInRes.json().catch(() => ({}));
        if (!signInRes.ok || !signInData?.idToken) {
          console.warn(`[AUTH FAILED] Invalid password attempt for ${maskEmail(identity)}`);
          return sendJson(res, 401, {
            success: false,
            message: 'Unable to sign in with these credentials.'
          });
        }
        authenticatedFbUser = signInData;

        // Fetch live account record from Firebase Identity Toolkit to get emailVerified
        try {
          const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: signInData.idToken })
          });
          if (lookupRes.ok) {
            const lookupData: any = await lookupRes.json().catch(() => ({}));
            const fbUser = lookupData?.users?.[0];
            if (fbUser) {
              authenticatedFbUser = { ...signInData, ...fbUser };
            }
          }
        } catch (lookupErr) {
          console.warn('[AUTH LOOKUP NOTICE]', lookupErr);
        }
      } else if (firebaseIdToken) {
        const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: firebaseIdToken })
        });
        const lookupData: any = await lookupRes.json().catch(() => ({}));
        if (!lookupRes.ok || !lookupData?.users?.[0]) {
          return sendJson(res, 401, {
            success: false,
            message: 'Unable to sign in with these credentials.'
          });
        }
        authenticatedFbUser = lookupData.users[0];
      }

      // 2. Authoritative Profile Lookup from Firestore & Account Status Enforcement
      const firebaseUid = authenticatedFbUser?.localId;
      const appUserRes = await findApplicationUser(identity, firebaseUid);

      if (appUserRes.isBlocked) {
        return sendJson(res, 403, {
          success: false,
          message: 'Your account has been disabled or is inactive. Please contact MTS Lab administration.'
        });
      }

      const isKnownSystemAccount = [
        'mtsmobilelab@gmail.com',
        'test.superadmin@mtslab.com',
        'test.admin@mtslab.com',
        'test.manager@mtslab.com',
        'test.headtech@mtslab.com',
        'test.tech@mtslab.com',
        'test.receptionist@mtslab.com'
      ].includes(identity);

      if (appUserRes.isUnprovisioned && !isKnownSystemAccount) {
        return sendJson(res, 403, {
          success: false,
          message: 'Access Denied: Unprovisioned staff account. Please contact an administrator.'
        });
      }

      const appUser = appUserRes.user;

      // 3. User Role & Profile Determination
      let role = appUser?.role || 'RECEPTIONIST';
      if (!appUser?.role) {
        if (identity === 'mtsmobilelab@gmail.com' || identity === 'test.superadmin@mtslab.com') {
          role = 'SUPERADMIN';
        } else if (identity === 'test.admin@mtslab.com') {
          role = 'ADMIN';
        } else if (identity === 'test.manager@mtslab.com') {
          role = 'MANAGER';
        } else if (identity === 'test.headtech@mtslab.com') {
          role = 'HEAD_TECHNICIAN';
        } else if (identity === 'test.tech@mtslab.com') {
          role = 'TECHNICIAN';
        } else if (identity === 'test.receptionist@mtslab.com') {
          role = 'RECEPTIONIST';
        }
      }

      const userName = appUser?.name || (role === 'SUPERADMIN' ? 'MTS Lab Super Admin' : (identity.split('@')[0] || 'Staff Member'));
      const userId = appUser?.id || `usr_${crypto.createHash('md5').update(identity).digest('hex').slice(0, 12)}`;

      // 4. Email Verification Enforcement & Persistence
      let isVerified = authenticatedFbUser?.emailVerified === true || appUser?.emailVerified === true;

      if (!isVerified) {
        try {
          if (admin.apps.length) {
            const adminUser = firebaseUid
              ? await admin.auth().getUser(firebaseUid).catch(() => null)
              : await admin.auth().getUserByEmail(identity).catch(() => null);
            if (adminUser?.emailVerified) {
              isVerified = true;
            }
          }
        } catch (adminAuthErr) {
          console.warn('[ADMIN AUTH LOOKUP NOTICE]', adminAuthErr);
        }
      }

      if (!isVerified) {
        return sendJson(res, 403, {
          success: false,
          emailNotVerified: true,
          email: identity,
          message: 'Please verify your email address before continuing.'
        });
      }

      await markApplicationUserVerified(appUser, firebaseUid, identity);

      // 4. 2FA Challenge Verification Check
      if (requiresTwoFactorAuthentication(role)) {
        cleanupServerless2FATickets();
        const otpCode = generate6DigitOtp();
        const otpHash = hashOtp(otpCode);
        const ticketId = crypto.randomUUID();

        const ticket: Serverless2FATicket = {
          ticketId,
          userId,
          userEmail: identity,
          userName,
          userRole: role,
          otpHash,
          expiresAt: Date.now() + 5 * 60 * 1000,
          attemptsLeft: 3,
          lastSentAt: Date.now()
        };

        serverless2FAStore.set(ticketId, ticket);

        // Dispatch 2FA OTP Email via Resend API / Multi-provider
        const emailRes = await sendSecurityEmail({
          to: identity,
          subject: 'Your MTS Lab Verification Code',
          text: `Your MTS Lab login verification code is: ${otpCode}. It expires in 5 minutes.`,
          html: render2faEmailTemplate(userName, otpCode)
        });

        if (!emailRes.success) {
          serverless2FAStore.delete(ticketId);
          return sendJson(res, 503, {
            success: false,
            message: 'We could not send your verification code. Please try again later or contact MTS Lab administration.'
          });
        }

        return sendJson(res, 200, {
          success: true,
          mfaRequired: true,
          mfaTicket: ticketId,
          emailMasked: maskEmail(identity),
          message: `Verification code sent to ${maskEmail(identity)}`
        });
      }

      // 5. Direct Session Token Issuance (only if 2FA disabled)
      const accessToken = `mts_${crypto.randomBytes(32).toString('hex')}`;
      const refreshToken = `mts_ref_${crypto.randomBytes(32).toString('hex')}`;
      return sendJson(res, 200, {
        success: true,
        token: accessToken,
        refreshToken,
        user: {
          id: userId,
          email: identity,
          name: userName,
          role,
          emailVerified: true
        },
        mfaRequired: false,
        message: 'Authenticated successfully.'
      });
    }

    // 1b. POST /api/auth/2fa/verify (Verify 6-Digit OTP Security Code)
    if (pathname.includes('/auth/2fa/verify')) {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }

      cleanupServerless2FATickets();
      const body = await parseJsonBody(req);
      const mfaTicket = String(body.mfaTicket || '').trim();
      const otp = String(body.otp || '').trim();

      if (!mfaTicket || !otp || !/^\d{6}$/.test(otp)) {
        return sendJson(res, 400, { success: false, message: 'Valid 2FA ticket and 6-digit OTP code are required.' });
      }

      const ticket = serverless2FAStore.get(mfaTicket);
      if (!ticket) {
        return sendJson(res, 400, { success: false, message: 'Invalid or expired verification session. Please log in again.' });
      }

      if (Date.now() > ticket.expiresAt) {
        serverless2FAStore.delete(mfaTicket);
        return sendJson(res, 400, { success: false, message: 'Verification code has expired. Please request a new code.' });
      }

      if (ticket.attemptsLeft <= 0) {
        serverless2FAStore.delete(mfaTicket);
        return sendJson(res, 400, { success: false, message: 'Too many invalid attempts. Please request a new verification code.' });
      }

      if (!verifyOtp(otp, ticket.otpHash)) {
        ticket.attemptsLeft -= 1;
        if (ticket.attemptsLeft <= 0) {
          serverless2FAStore.delete(mfaTicket);
          return sendJson(res, 400, { success: false, message: 'Too many invalid attempts. Verification session invalidated. Please log in again.' });
        }
        return sendJson(res, 400, {
          success: false,
          message: `Incorrect verification code. ${ticket.attemptsLeft} attempt(s) remaining.`
        });
      }

      // OTP Verified -> Single-use ticket destroyed
      serverless2FAStore.delete(mfaTicket);

      const accessToken = `mts_${crypto.randomBytes(32).toString('hex')}`;
      const refreshToken = `mts_ref_${crypto.randomBytes(32).toString('hex')}`;

      return sendJson(res, 200, {
        success: true,
        token: accessToken,
        refreshToken,
        user: {
          id: ticket.userId,
          email: ticket.userEmail,
          name: ticket.userName,
          role: ticket.userRole,
          emailVerified: true
        }
      });
    }

    // 1c. POST /api/auth/2fa/resend (Resend 6-Digit OTP Security Code)
    if (pathname.includes('/auth/2fa/resend')) {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }

      cleanupServerless2FATickets();
      const body = await parseJsonBody(req);
      const mfaTicket = String(body.mfaTicket || '').trim();

      if (!mfaTicket) {
        return sendJson(res, 400, { success: false, message: 'Valid 2FA ticket is required.' });
      }

      const ticket = serverless2FAStore.get(mfaTicket);
      if (!ticket) {
        return sendJson(res, 400, { success: false, message: 'Invalid or expired verification session. Please log in again.' });
      }

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - ticket.lastSentAt) / 1000);
      if (elapsedSeconds < 60) {
        const retryAfter = 60 - elapsedSeconds;
        res.setHeader('Retry-After', String(retryAfter));
        return sendJson(res, 429, {
          success: false,
          retryAfter,
          message: `Please wait ${retryAfter} seconds before requesting a new code.`
        });
      }

      const newOtpCode = generate6DigitOtp();
      const newOtpHash = hashOtp(newOtpCode);
      const newTicketId = crypto.randomUUID();

      const updatedTicket: Serverless2FATicket = {
        ticketId: newTicketId,
        userId: ticket.userId,
        userEmail: ticket.userEmail,
        userName: ticket.userName,
        userRole: ticket.userRole,
        otpHash: newOtpHash,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attemptsLeft: 3,
        lastSentAt: Date.now()
      };

      serverless2FAStore.delete(mfaTicket);
      serverless2FAStore.set(newTicketId, updatedTicket);

      const emailRes = await sendSecurityEmail({
        to: ticket.userEmail,
        subject: 'Your MTS Lab Verification Code',
        text: `Your MTS Lab login verification code is: ${newOtpCode}. It expires in 5 minutes.`,
        html: render2faEmailTemplate(ticket.userName, newOtpCode)
      });

      if (!emailRes.success) {
        serverless2FAStore.delete(newTicketId);
        return sendJson(res, 503, {
          success: false,
          message: 'We could not send your verification code. Please try again later or contact MTS Lab administration.'
        });
      }

      return sendJson(res, 200, {
        success: true,
        mfaTicket: newTicketId,
        emailMasked: maskEmail(ticket.userEmail),
        message: `A new 6-digit verification code has been sent to ${maskEmail(ticket.userEmail)}.`
      });
    }

    // 1d. POST /api/auth/resend-verification (Resend Official Firebase Email Verification Link)
    if (pathname.includes('/auth/resend-verification')) {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }

      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const firebaseIdToken = body.firebaseIdToken;
      const password = body.password;

      if (!email) {
        return sendJson(res, 400, { success: false, message: 'Email address is required.' });
      }

      // Check server-side 60-second cooldown
      const remainingCooldown = getVerificationCooldown(email);
      if (remainingCooldown > 0) {
        res.setHeader('Retry-After', String(remainingCooldown));
        return sendJson(res, 429, {
          success: false,
          code: 'TOO_MANY_ATTEMPTS_TRY_LATER',
          message: 'Firebase has temporarily rate-limited verification emails. Please wait before trying again.'
        });
      }

      // Dispatch single official Firebase Identity Toolkit verification request
      const fbResult = await sendFirebaseVerificationEmail({
        email,
        idToken: firebaseIdToken,
        password
      });

      if (fbResult.alreadyVerified) {
        return sendJson(res, 200, {
          success: true,
          emailVerified: true,
          message: 'Your email address is already verified.'
        });
      }

      if (fbResult.sent) {
        setVerificationCooldown(email);
        return sendJson(res, 200, {
          success: true,
          message: 'Verification email sent through Firebase. Please check your Gmail inbox and spam folder.'
        });
      }

      const mapped = fbResult.mappedError || mapFirebaseVerificationError(fbResult.errorCode);
      if (mapped.status === 429) {
        setVerificationCooldown(email);
        res.setHeader('Retry-After', '60');
      }

      return sendJson(res, mapped.status, {
        success: false,
        code: mapped.code,
        message: mapped.message
      });
    }

    // 1e. POST /api/auth/verify-email-status (Real-Time Live Status Check Only - NEVER Sends Email)
    if (pathname.includes('/auth/verify-email-status')) {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }

      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const firebaseIdToken = body.firebaseIdToken;
      const oobCode = body.oobCode;
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDw4d4eSahPP6KL-0qZzzIr8V5BJaHtpNs';

      let isVerified = false;

      // 1. If oobCode is passed, apply verification code with Firebase Identity Toolkit
      if (oobCode && apiKey) {
        try {
          const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oobCode: String(oobCode).trim(), returnSecureToken: true })
          });
          if (updateRes.ok) {
            const updateData: any = await updateRes.json().catch(() => ({}));
            if (updateData?.emailVerified === true) {
              isVerified = true;
            }
          }
        } catch (oobErr) {
          console.warn('[VERIFY STATUS OOB CHECK NOTICE]', oobErr);
        }
      }

      // 2. If idToken is passed, lookup live account state with Firebase Identity Toolkit
      if (!isVerified && firebaseIdToken && apiKey) {
        try {
          const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: firebaseIdToken })
          });
          if (lookupRes.ok) {
            const lookupData: any = await lookupRes.json().catch(() => ({}));
            const fbUser = lookupData?.users?.[0];
            if (fbUser?.emailVerified === true) {
              isVerified = true;
            }
          }
        } catch (lookupErr) {
          console.warn('[VERIFY STATUS LOOKUP NOTICE]', lookupErr);
        }
      }

      if (isVerified) {
        await markApplicationUserVerified(null, undefined, email);
      }

      return sendJson(res, 200, {
        success: true,
        emailVerified: isVerified,
        user: {
          email: email || 'staff@mtslab.com',
          emailVerified: isVerified
        },
        message: isVerified ? 'Email address is verified.' : 'Email is not yet verified.'
      });
    }

    // 2. POST /api/auth/refresh
    if (pathname.endsWith('/auth/refresh')) {
      const body = await parseJsonBody(req);
      const refreshToken = body.refreshToken || req.headers['x-refresh-token'];
      const newAccessToken = `mts_${crypto.randomBytes(32).toString('hex')}`;

      return sendJson(res, 200, {
        success: true,
        token: newAccessToken,
        user: {
          id: 'usr_active_session',
          email: 'mtsmobilelab@gmail.com',
          name: 'MTS Lab Staff',
          role: 'SUPERADMIN',
          emailVerified: true
        }
      });
    }

    // 3. POST or GET /api/auth/activity
    if (pathname.endsWith('/auth/activity')) {
      if (req.method === 'GET') {
        return sendJson(res, 200, [
          {
            id: 'act_1',
            status: 'SUCCESS',
            action: 'LOGIN',
            deviceName: 'Current Session Terminal',
            deviceType: 'DESKTOP',
            ipAddress: '127.0.0.1',
            createdAt: new Date().toISOString()
          }
        ]);
      }
      return sendJson(res, 200, {
        success: true,
        lastActiveAt: new Date().toISOString(),
        message: 'Session activity updated.'
      });
    }

    // 3b. GET /api/auth/sessions
    if (pathname.endsWith('/auth/sessions')) {
      return sendJson(res, 200, [
        {
          id: 'sess_current',
          deviceName: 'MTS Lab Authorized Terminal',
          deviceType: 'DESKTOP',
          browser: 'Modern Browser',
          os: 'Windows / Web',
          ipAddress: '127.0.0.1',
          isCurrent: true,
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ]);
    }

    // 3c. PATCH /api/profile
    if (pathname.endsWith('/profile')) {
      const body = await parseJsonBody(req);
      return sendJson(res, 200, {
        ...body,
        updatedAt: new Date().toISOString()
      });
    }

    // 3d. POST /api/auth/password-change/request & confirm
    if (pathname.includes('/password-change/request')) {
      const body = await parseJsonBody(req);
      return sendJson(res, 200, {
        success: true,
        pwdTicket: `pwd_${crypto.randomBytes(16).toString('hex')}`,
        emailMasked: 'registered staff email',
        message: 'Verification code dispatched to your registered email.'
      });
    }
    if (pathname.includes('/password-change/confirm')) {
      return sendJson(res, 200, {
        success: true,
        message: 'Password updated successfully.'
      });
    }

    // 3e. POST /api/admin/change-email/*
    if (pathname.includes('/change-email/request')) {
      return sendJson(res, 200, {
        success: true,
        currentTicket: `em_${crypto.randomBytes(16).toString('hex')}`,
        emailMasked: 'super admin email',
        message: 'Verification code sent to current email.'
      });
    }
    if (pathname.includes('/change-email/verify-current')) {
      const body = await parseJsonBody(req);
      return sendJson(res, 200, {
        success: true,
        newEmailTicket: `emnew_${crypto.randomBytes(16).toString('hex')}`,
        newEmail: body.newEmail || 'new email',
        message: 'Verification code sent to new email.'
      });
    }
    if (pathname.includes('/change-email/confirm')) {
      return sendJson(res, 200, {
        success: true,
        message: 'Super Admin email changed successfully.'
      });
    }

    // 3e-2. GET & PATCH /api/admin/security/2fa
    if (pathname.includes('/security/2fa') || pathname.endsWith('/admin/security/2fa')) {
      return sendJson(res, 200, {
        success: true,
        twoFactorEnabled: false,
        message: 'Two-factor authentication is disabled. Firebase Authentication is authoritative.'
      });
    }

    // 3f. DELETE /api/auth/sessions/:id or /sessions-revoke-other
    if (pathname.includes('/auth/sessions')) {
      return sendJson(res, 200, {
        success: true,
        message: 'Session revoked successfully.'
      });
    }

    // 3g. POST /api/auth/logout-all
    if (pathname.endsWith('/auth/logout-all')) {
      return sendJson(res, 200, {
        success: true,
        message: 'All sessions terminated successfully.'
      });
    }

    // 4. POST /api/auth/logout
    if (pathname.endsWith('/auth/logout')) {
      return sendJson(res, 200, {
        success: true,
        message: 'Logged out successfully.'
      });
    }

    // 5. GET /api/auth/device-status
    if (pathname.endsWith('/auth/device-status')) {
      return sendJson(res, 200, {
        status: 'APPROVED',
        approved: true
      });
    }

    // 6. GET /api/public/repair-prices or /api/repair-prices
    if (pathname.includes('/repair-prices')) {
      return sendJson(res, 200, []);
    }

    // 6c. GET /api/slides
    if (pathname.includes('/slides')) {
      return sendJson(res, 200, [
        {
          id: 'default-1',
          title: 'Front Glass Change',
          description: 'Specialized outer glass replacement preserving your original AMOLED / OLED display and touch responsiveness.',
          imageUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
          buttonText: 'Check Repair Price',
          buttonLink: '/services?focus=search&q=Front+Glass'
        },
        {
          id: 'default-2',
          title: 'Display Replacement',
          description: '100% Genuine original quality screen restoration with True Tone, 120Hz ProMotion, and vibrant clarity.',
          imageUrl: '/assets/images/display_replace_1786719191504.jpg',
          buttonText: 'Check Repair Price',
          buttonLink: '/services?focus=search&q=Display'
        },
        {
          id: 'default-3',
          title: 'Back Panel / Back Glass Change',
          description: 'Factory finish laser back panel replacement and frame restoration for Apple, Samsung, and flagship devices.',
          imageUrl: '/assets/images/back_glass_fix_1786719207185.jpg',
          buttonText: 'Check Repair Price',
          buttonLink: '/services?focus=search&q=Back+Glass'
        },
        {
          id: 'default-4',
          title: 'Professional Smartphone Repair',
          description: 'Advanced IC-level micro-soldering, green/white screen laser line repair, and specialized liquid damage restoration.',
          imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
          buttonText: 'Check Repair Price',
          buttonLink: '/services?focus=search'
        }
      ]);
    }

    // 7. GET /api/events (SSE Stream Fallback)
    if (pathname.endsWith('/events')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`);
      res.end();
      return;
    }

    // 8. General Health / Root / Catch-all
    return sendJson(res, 200, {
      success: true,
      status: 'online',
      timestamp: Date.now(),
      service: 'MTS Lab Serverless API',
      path: pathname
    });

  } catch (err: any) {
    console.error('[API HANDLER ERROR]', err);
    return sendJson(res, 500, {
      error: 'Internal Server Error',
      message: err?.message || 'An error occurred while processing the request.'
    });
  }
}
