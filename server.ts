import express from "express";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import dotenv from "dotenv";
import { EventEmitter } from "events";
import crypto from "crypto";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";

dotenv.config();

// Global Real-time Event Hub for instantaneous multi-device data synchronization
const realtimeHub = new EventEmitter();
realtimeHub.setMaxListeners(500);

export interface ServerRealtimeEvent {
  entity: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  id?: string;
  data?: any;
  timestamp: number;
}

export function broadcastRealtimeEvent(payload: {
  entity: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  id?: string;
  data?: any;
  timestamp?: number;
}) {
  const eventPayload: ServerRealtimeEvent = {
    entity: payload.entity,
    action: payload.action,
    id: payload.id,
    data: payload.data,
    timestamp: payload.timestamp || Date.now(),
  };
  realtimeHub.emit("realtime-event", eventPayload);

  // Synchronize immediately to Firebase Realtime Database
  try {
    syncToRtdb(payload.entity, payload.action, payload.data || { id: payload.id }).catch(() => {});
  } catch (err) {
    // Non-blocking
  }
}

// Programmatic environment setup with safe defaults
function validateAndSetupEnvironment() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "mts-lab-super-secret-key";
  }
  if (!process.env.REFRESH_SECRET) {
    process.env.REFRESH_SECRET = "mts-lab-refresh-secret-key";
  }
}

validateAndSetupEnvironment();

// Load Firebase Config
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.warn("[FIREBASE] Could not load firebase-applet-config.json", err);
}

firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || firebaseConfig.apiKey || "AIzaSyDw4d4eSahPP6KL-0qZzzIr8V5BJaHtpNs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || "mts-lab-eb8d2.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || firebaseConfig.databaseURL || "https://mts-lab-eb8d2-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || "mts-lab-eb8d2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || "mts-lab-eb8d2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || "473440131766",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || firebaseConfig.appId || "1:473440131766:web:ebf94beed416c789b3e417",
};

const __filename = typeof import.meta !== "undefined" && import.meta && import.meta.url
  ? fileURLToPath(import.meta.url)
  : ((globalThis as any).__filename || "");

const __dirname = typeof import.meta !== "undefined" && import.meta && import.meta.url
  ? path.dirname(__filename)
  : ((globalThis as any).__dirname || "");

// Sync db schema automatically at runtime with automatic corruption recovery
function initializeDatabase() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS) {
    return;
  }
  const dbPath = path.join(process.cwd(), "prisma/dev.db");
  try {
    console.log("[STARTUP] Running Prisma DB push programmatically...");
    execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
  } catch (err: any) {
    console.error("[STARTUP] Failed to push DB schema. Checking for corruption:", err?.message || err);
    try {
      if (fs.existsSync(dbPath)) {
        console.warn("[STARTUP] Malformed database detected. Recreating clean SQLite database...");
        fs.unlinkSync(dbPath);
        execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
        console.log("[STARTUP] Clean database recreated successfully.");
      }
    } catch (recoverErr) {
      console.error("[STARTUP FATAL] Failed to recover SQLite database:", recoverErr);
    }
  }
}

initializeDatabase();

const prisma = new PrismaClient();

// Automatic Prisma to Firestore sync & Real-Time Event broadcasting middleware
prisma.$use(async (params, next) => {
  const result = await next(params);
  
  if (params.model) {
    const modelName = params.model.charAt(0).toLowerCase() + params.model.slice(1);
    const action = params.action;
    const isWrite = ["create", "update", "upsert", "delete", "createMany", "updateMany", "deleteMany"].includes(action);
    
    if (isWrite) {
      const actionType: "CREATE" | "UPDATE" | "DELETE" = action.startsWith("delete") 
        ? "DELETE" 
        : action.startsWith("create") 
          ? "CREATE" 
          : "UPDATE";

      // Instantly broadcast real-time event to all connected devices across the network
      try {
        if (Array.isArray(result)) {
          result.forEach((item) => {
            broadcastRealtimeEvent({
              entity: modelName,
              action: actionType,
              id: item?.id,
              data: item,
            });
          });
        } else if (result && typeof result === "object") {
          broadcastRealtimeEvent({
            entity: modelName,
            action: actionType,
            id: result?.id,
            data: result,
          });
        } else if (params.args?.where?.id) {
          broadcastRealtimeEvent({
            entity: modelName,
            action: actionType,
            id: params.args.where.id,
          });
        }
      } catch (evtErr) {
        console.warn("[REALTIME EVENT EMIT ERROR]", evtErr);
      }

      // Sync with Firebase Realtime Database and Firestore
      if (result) {
        if (action === "delete") {
          if (result.id) {
            syncToRtdb(modelName, "DELETE", result).catch(() => {});
            if (!firestoreSyncDisabled) {
              try {
                const db = getDb();
                const collectionName = getCollectionName(modelName);
                await db.collection(collectionName).doc(result.id).delete();
                console.log(`[SYNC-DELETE] Deleted ${modelName} ${result.id} from Firestore`);
              } catch (err: any) {
                if (err?.code === 7 || err?.message?.includes("PERMISSION_DENIED") || err?.status === 7) {
                  firestoreSyncDisabled = true;
                } else {
                  console.warn(`[SYNC-DELETE NOTICE] ${modelName} Firestore delete skipped:`, err?.message || err);
                }
              }
            }
          }
        } else {
          if (Array.isArray(result)) {
            for (const item of result) {
              syncToRtdb(modelName, actionType, item).catch(() => {});
              await syncToFirestore(modelName, item);
            }
          } else {
            syncToRtdb(modelName, actionType, result).catch(() => {});
            await syncToFirestore(modelName, result);
          }
        }
      }
    }
  }
  
  return result;
});
const JWT_SECRET = process.env.JWT_SECRET || "mts-lab-super-secret-key";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "mts-lab-refresh-secret-key";

// 2-hour inactivity session expiration: sessions with no activity for 2h are invalidated server-side
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 120 minutes = 7,200,000 ms
// Throttle session lastActiveAt updates to once per 30 seconds to avoid hammering the DB on every API call
const LAST_ACTIVE_UPDATE_THROTTLE_MS = 30 * 1000;

// Helper to automatically fix any missing, incorrect, invalid, or legacy statuses in Users and AccessRequests tables
async function fixInvalidStatuses() {
  try {
    console.log("[STARTUP] Verifying and repairing database status values...");
    
    // 1. Fix User accounts
    const users = await prisma.user.findMany();
    for (const user of users) {
      const currentStatus = user.accountStatus;
      let targetStatus = currentStatus;

      if (!currentStatus) {
        targetStatus = "PENDING";
      } else {
        const uppercaseStatus = currentStatus.toUpperCase().trim();
        const validStatuses = ["ACTIVE", "APPROVED", "PENDING", "REJECTED"];
        
        if (!validStatuses.includes(uppercaseStatus)) {
          console.log(`[STARTUP] Invalid user status found: "${currentStatus}" for user ${user.email}. Repairing...`);
          if (user.role === "SUPER_ADMIN" || user.isActive) {
            targetStatus = "ACTIVE";
          } else {
            targetStatus = "PENDING";
          }
        } else if (currentStatus !== uppercaseStatus) {
          targetStatus = uppercaseStatus;
        }
      }

      if (targetStatus !== currentStatus) {
        await prisma.user.update({
          where: { id: user.id },
          data: { accountStatus: targetStatus }
        });
        console.log(`[STARTUP] Repaired user status for ${user.email}: "${currentStatus}" -> "${targetStatus}"`);
      }
    }

    // 2. Fix AccessRequest records
    const requests = await prisma.accessRequest.findMany();
    for (const req of requests) {
      const currentStatus = req.status;
      let targetStatus = currentStatus;

      if (!currentStatus) {
        targetStatus = "PENDING";
      } else {
        const uppercaseStatus = currentStatus.toUpperCase().trim();
        const validStatuses = ["APPROVED", "PENDING", "REJECTED"];
        
        if (!validStatuses.includes(uppercaseStatus)) {
          console.log(`[STARTUP] Invalid access request status found: "${currentStatus}" for request ${req.email}. Repairing...`);
          targetStatus = "PENDING";
        } else if (currentStatus !== uppercaseStatus) {
          targetStatus = uppercaseStatus;
        }
      }

      if (targetStatus !== currentStatus) {
        await prisma.accessRequest.update({
          where: { id: req.id },
          data: { status: targetStatus }
        });
        console.log(`[STARTUP] Repaired access request status for ${req.email}: "${currentStatus}" -> "${targetStatus}"`);
      }
    }
    
    console.log("[STARTUP] Database verification and repair completed successfully.");
  } catch (err) {
    console.error("[STARTUP ERROR] Verification and repair of status values failed:", err);
  }
}

// Helper to format/normalize phone numbers
function normalizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// Helper to migrate legacy unlinked repairs and ensure Customer records exist
async function syncAndMigrateCustomers() {
  try {
    console.log("[STARTUP] Checking customer records and unlinked repairs...");
    const repairs = await prisma.repair.findMany({
      where: { customerId: null }
    });

    if (repairs.length === 0) {
      console.log("[STARTUP] All repairs are linked to customer records.");
      return;
    }

    console.log(`[STARTUP] Migrating ${repairs.length} unlinked repairs to Customer model...`);
    for (const repair of repairs) {
      const normPhone = normalizePhone(repair.customerPhone || "");
      if (!normPhone && !repair.customerName) continue;

      let customer = normPhone
        ? await prisma.customer.findFirst({ where: { phone: normPhone } })
        : await prisma.customer.findFirst({ where: { name: repair.customerName } });

      if (!customer) {
        const totalCustomers = await prisma.customer.count();
        let counter = 101 + totalCustomers;
        let customerId = `CUS-${counter.toString().padStart(5, "0")}`;
        let isUnique = false;
        while (!isUnique) {
          const existing = await prisma.customer.findUnique({ where: { customerId } });
          if (!existing) {
            isUnique = true;
          } else {
            counter++;
            customerId = `CUS-${counter.toString().padStart(5, "0")}`;
          }
        }

        customer = await prisma.customer.create({
          data: {
            customerId,
            name: repair.customerName || "Valued Customer",
            phone: normPhone || repair.customerPhone || "N/A",
            email: repair.customerEmail || null,
            address: repair.customerAddress || null
          }
        });
        console.log(`[STARTUP] Created Customer ${customer.name} (${customer.customerId}) for repair #${repair.repairNumber}`);
      }

      await prisma.repair.update({
        where: { id: repair.id },
        data: { customerId: customer.id }
      });
    }
    console.log("[STARTUP] Customer migration completed successfully.");
  } catch (err) {
    console.error("[STARTUP ERROR] Customer migration failed:", err);
  }
}

// Helper to generate next unique sequential repair number (e.g. MTS-2026-0001)
async function generateUniqueRepairNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const repairs = await prisma.repair.findMany({
    select: { repairNumber: true }
  });

  let maxNum = 1000;
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

  const nextNum = maxNum + 1;
  const padded = nextNum.toString().padStart(4, "0");
  return `MTS-${currentYear}-${padded}`;
}

// Authoritative Helper to determine if 2FA is active for a user
function isUser2FAEnabled(user: any): boolean {
  if (!user) return false;
  const val = user.twoFactorEnabled;
  if (val === false || val === 'false' || val === 0 || val === '0') {
    return false;
  }
  if (val === true || val === 'true' || val === 1 || val === '1') {
    return true;
  }
  return user.twoFactorEnabled !== false;
}

// Helper to generate next unique sequential battery warranty number (e.g. BW-2026-0001)
async function generateUniqueWarrantyNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const warranties = await prisma.batteryWarranty.findMany({
    select: { warrantyNumber: true }
  });

  let maxNum = 0;
  for (const w of warranties) {
    if (!w.warrantyNumber) continue;
    const match = w.warrantyNumber.match(/(\d+)$/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum.toString().padStart(4, "0");
  return `BW-${currentYear}-${padded}`;
}

// Helper to generate next unique sequential warranty claim number (e.g. BWC-2026-0001)
async function generateUniqueClaimNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const claims = await prisma.batteryWarrantyClaim.findMany({
    select: { claimNumber: true }
  });

  let maxNum = 0;
  for (const c of claims) {
    if (!c.claimNumber) continue;
    const match = c.claimNumber.match(/(\d+)$/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum.toString().padStart(4, "0");
  return `BWC-${currentYear}-${padded}`;
}

// Helper to calculate battery warranty expiry date safely
function calculateWarrantyExpiryDate(registrationDate: Date = new Date(), period: string = "6_MONTHS"): Date {
  const expiry = new Date(registrationDate.getTime());
  if (period === "1_YEAR" || period === "12_MONTHS") {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    expiry.setMonth(expiry.getMonth() + 6);
  }
  return expiry;
}

// Helper to find or create customer record
async function findOrCreateCustomer(data: {
  id?: string;
  name: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  district?: string;
  municipality?: string;
  address?: string;
  landmark?: string;
  notes?: string;
}) {
  const normPhone = normalizePhone(data.phone || "");

  if (data.id) {
    const existing = await prisma.customer.findUnique({ where: { id: data.id } });
    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: data.id },
        data: {
          name: data.name?.trim() || existing.name,
          phone: normPhone || existing.phone,
          alternativePhone: data.alternativePhone !== undefined ? (data.alternativePhone ? data.alternativePhone.trim() : null) : existing.alternativePhone,
          email: data.email !== undefined ? (data.email ? data.email.trim() : null) : existing.email,
          district: data.district !== undefined ? (data.district ? data.district.trim() : null) : existing.district,
          municipality: data.municipality !== undefined ? (data.municipality ? data.municipality.trim() : null) : existing.municipality,
          address: data.address !== undefined ? (data.address ? data.address.trim() : null) : existing.address,
          landmark: data.landmark !== undefined ? (data.landmark ? data.landmark.trim() : null) : existing.landmark,
          notes: data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : existing.notes
        }
      });
      return updated;
    }
  }

  if (normPhone) {
    const phoneCandidates = [normPhone];
    if (normPhone.length >= 10) phoneCandidates.push(normPhone.slice(-10));
    if (normPhone.length >= 9) phoneCandidates.push(normPhone.slice(-9));

    const existingByPhone = await prisma.customer.findFirst({
      where: {
        OR: phoneCandidates.map(p => ({ phone: { contains: p } }))
      }
    });
    if (existingByPhone) {
      const updated = await prisma.customer.update({
        where: { id: existingByPhone.id },
        data: {
          name: data.name?.trim() || existingByPhone.name,
          alternativePhone: data.alternativePhone !== undefined && data.alternativePhone ? data.alternativePhone.trim() : existingByPhone.alternativePhone,
          email: data.email !== undefined && data.email ? data.email.trim() : existingByPhone.email,
          district: data.district !== undefined && data.district ? data.district.trim() : existingByPhone.district,
          municipality: data.municipality !== undefined && data.municipality ? data.municipality.trim() : existingByPhone.municipality,
          address: data.address !== undefined && data.address ? data.address.trim() : existingByPhone.address,
          landmark: data.landmark !== undefined && data.landmark ? data.landmark.trim() : existingByPhone.landmark,
          notes: data.notes !== undefined && data.notes ? data.notes.trim() : existingByPhone.notes
        }
      });
      return updated;
    }
  }

  // Create new customer with collision-safe ID generation
  const totalCustomers = await prisma.customer.count();
  let counter = 101 + totalCustomers;
  let customerId = `CUS-${counter.toString().padStart(5, "0")}`;
  let isUnique = false;
  while (!isUnique) {
    const existing = await prisma.customer.findUnique({ where: { customerId } });
    if (!existing) {
      isUnique = true;
    } else {
      counter++;
      customerId = `CUS-${counter.toString().padStart(5, "0")}`;
    }
  }

  const newCustomer = await prisma.customer.create({
    data: {
      customerId,
      name: data.name?.trim() || "Valued Customer",
      phone: normPhone || data.phone || "N/A",
      alternativePhone: data.alternativePhone?.trim() || null,
      email: data.email?.trim() || null,
      district: data.district?.trim() || null,
      municipality: data.municipality?.trim() || null,
      address: data.address?.trim() || null,
      landmark: data.landmark?.trim() || null,
      notes: data.notes?.trim() || null
    }
  });

  return newCustomer;
}

// Helper to ensure the primary Super Admin exists on startup
async function ensureAdminUser() {
  try {
    const primarySuperAdminEmail = "mtsmobilelab@gmail.com";
    let primaryAdmin = await prisma.user.findUnique({
      where: { email: primarySuperAdminEmail }
    });

    if (!primaryAdmin) {
      // Check if legacy admin exists to reuse password hash or create clean primary Super Admin
      const legacyAdmin = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN", deletedAt: null }
      });
      const passwordHash = legacyAdmin?.password || (await bcrypt.hash("admin123", 10));

      console.log(`[STARTUP] Provisioning primary Super Admin user: ${primarySuperAdminEmail}`);
      primaryAdmin = await prisma.user.create({
        data: {
          email: primarySuperAdminEmail,
          username: "superadmin",
          password: passwordHash,
          name: "MTS Super Admin",
          role: "SUPER_ADMIN",
          accountStatus: "ACTIVE",
          isActive: true,
          twoFactorEnabled: true,
          twoFactorType: "EMAIL"
        }
      });
      console.log("[STARTUP] Primary Super Admin provisioned successfully.");
    } else {
      // Ensure primary super admin has SUPER_ADMIN role, ACTIVE status, and 2FA enabled
      if (primaryAdmin.role !== "SUPER_ADMIN" || primaryAdmin.accountStatus !== "ACTIVE" || !primaryAdmin.isActive || !primaryAdmin.twoFactorEnabled) {
        primaryAdmin = await prisma.user.update({
          where: { id: primaryAdmin.id },
          data: {
            role: "SUPER_ADMIN",
            accountStatus: "ACTIVE",
            isActive: true,
            twoFactorEnabled: true,
            twoFactorType: "EMAIL"
          }
        });
      }
    }

    await syncUserToFirestore(primaryAdmin);
  } catch (err) {
    console.error("[STARTUP ERROR] Failed to ensure Super Admin user:", err);
  }
}

// Helper to ensure a default branch exists
async function ensureDefaultBranch() {
  try {
    const branchCount = await prisma.branch.count();
    if (branchCount === 0) {
      console.log("[STARTUP] Creating default branch...");
      const newBranch = await prisma.branch.create({
        data: {
          name: "Kathmandu Central Hub",
          location: "New Road, Kathmandu",
          phone: "986927668, 015364307"
        }
      });
      console.log("[STARTUP] Default branch created.");
      await syncBranchToFirestore(newBranch);
    } else {
      const branches = await prisma.branch.findMany();
      for (const branch of branches) {
        await syncBranchToFirestore(branch);
      }
    }
  } catch (err) {
    console.error("[STARTUP ERROR] Failed to ensure default branch:", err);
  }
}

// Helper to ensure initial repair prices catalogue exists
async function ensureDefaultRepairPrices() {
  try {
    const count = await prisma.repairPrice.count();
    if (count === 0) {
      console.log("[STARTUP] Seeding default repair prices directory...");
      const defaultPrices = [
        // Samsung Galaxy S21 Ultra
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Display",
          problem: "Broken / Cracked Outer Glass",
          serviceName: "Glass Change",
          price: 7000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "High-precision OCA glass lamination; preserves original Dynamic AMOLED 2X panel and 120Hz touch sensitivity.",
          estimatedTime: "2 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Display",
          problem: "Flickering / Touch Unresponsive / Lines",
          serviceName: "Compatible Display",
          price: 12500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Premium grade aftermarket OLED screen with vibrant color reproduction and high-refresh responsiveness.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Display",
          problem: "Black Screen / Dead Pixels / Severe Impact",
          serviceName: "Display Replacement",
          price: 26000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original Samsung Service Pack Dynamic AMOLED 2X 120Hz display with chassis frame and sensor calibration.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Battery",
          problem: "Rapid Battery Drain / Overheating",
          serviceName: "Battery Replacement",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Brand new original 5000mAh high-density Li-Ion battery tested for peak health.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Charging",
          problem: "Loose Cable / Moisture Detected / Slow Charging",
          serviceName: "Charging Port Repair",
          price: 2500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original Type-C sub-board replacement supporting 25W Super Fast Charging.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Back Glass",
          problem: "Cracked / Shattered Rear Panel",
          serviceName: "Back Glass Replacement",
          price: 3500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "OEM Gorilla Glass Victus matte rear panel with camera lens housing gasket.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Camera",
          problem: "Blurry Rear Focus / Lens Scratched / Shaking",
          serviceName: "Rear Camera Module Repair",
          price: 8500,
          priceType: "STARTING_FROM",
          status: "ACTIVE",
          notes: "108MP main wide sensor or 10x periscope optical telephoto module replacement.",
          estimatedTime: "2 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Motherboard / IC",
          problem: "Dead Phone / Restart Loop / Power IC Short",
          serviceName: "Motherboard IC Micro-Soldering",
          price: 6500,
          priceType: "STARTING_FROM",
          status: "ACTIVE",
          notes: "Advanced microscope trace repair, power management PMIC reballing, and thermal diagnostics.",
          estimatedTime: "1-2 Days"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Water Damage",
          problem: "Liquid Ingress / Corrosion",
          serviceName: "Ultrasonic Chemical Deoxidation & Board Service",
          price: 1500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Complete ultrasonic bath cleaning, shield removal, and component-level circuit inspection.",
          estimatedTime: "Same Day"
        },

        // Apple iPhone 13
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Display",
          problem: "Cracked Front Glass with working touch",
          serviceName: "Glass Change",
          price: 6500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Vacuum OCA glass laminating; maintains genuine Apple Super Retina XDR OLED panel.",
          estimatedTime: "2 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Display",
          problem: "Lines on Screen / Unresponsive Touch",
          serviceName: "Compatible Display",
          price: 11000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "High gamut hard OLED replacement with True Tone chip programming.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Display",
          problem: "Completely Black / Broken Panel",
          serviceName: "Display Replacement",
          price: 24500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original OEM Super Retina XDR display with IC micro-transfer for zero non-genuine warning.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Battery",
          problem: "Service Status (<80%) / Fast Drain",
          serviceName: "Battery Replacement",
          price: 5000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Brand new OEM 3227mAh battery cell with BMS tag-on flex for 100% Health display.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Charging",
          problem: "Port Not Recognizing Cable / Slow Charge",
          serviceName: "Charging Port Repair",
          price: 2800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "OEM Lightning charging connector assembly with lower microphone array.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Back Glass",
          problem: "Broken Rear Glass Cover",
          serviceName: "Back Glass Replacement",
          price: 3800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Laser machine back glass removal; seamless finish with dust and moisture seal.",
          estimatedTime: "2 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Camera",
          problem: "Rear Camera Jitter / Dark Screen",
          serviceName: "Rear Camera Module Replacement",
          price: 7500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original dual 12MP diagonal camera module with Sensor-shift OIS stabilization.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Speaker",
          problem: "Low Earpiece Call Volume / Distorted Audio",
          serviceName: "Earpiece Speaker & Mesh Cleaning",
          price: 1800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Top ear speaker acoustic repair while preserving TrueDepth Face ID sensor safely.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Software",
          problem: "Apple Logo Boot Loop / Error 4013 / Recovery",
          serviceName: "iOS System Recovery & Firmware Flash",
          price: 1000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "DFU restoration, data-retaining iOS flash, and baseband error resolution.",
          estimatedTime: "30 Mins"
        },

        // Apple iPhone 14 Pro
        {
          brand: "Apple",
          model: "iPhone 14 Pro",
          variant: "Pro",
          category: "Display",
          problem: "Cracked Dynamic Island Screen",
          serviceName: "Display Replacement",
          price: 32000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 120Hz ProMotion 2000 nits Super Retina XDR OLED with True Tone.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 14 Pro",
          variant: "Pro",
          category: "Battery",
          problem: "Battery Drain / Service Required",
          serviceName: "Battery Replacement",
          price: 5800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original grade replacement battery cell with battery health transfer.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Apple",
          model: "iPhone 14 Pro",
          variant: "Pro",
          category: "Back Glass",
          problem: "Cracked Frosted Rear Glass",
          serviceName: "Back Glass Replacement",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Laser separation procedure with OEM textured matte glass replacement.",
          estimatedTime: "2 Hours"
        },

        // Xiaomi Redmi Note 12
        {
          brand: "Redmi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Display",
          problem: "Cracked Front Glass",
          serviceName: "Glass Change",
          price: 2500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Outer Corning Gorilla Glass replacement preserving original 120Hz AMOLED panel.",
          estimatedTime: "1.5 Hours"
        },
        {
          brand: "Redmi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Display",
          problem: "Broken Display / Black Screen",
          serviceName: "Display Replacement",
          price: 5500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 120Hz AMOLED display combo with middle frame.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Redmi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Battery",
          problem: "Battery Swollen / Fast Discharge",
          serviceName: "Battery Replacement",
          price: 2800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Genuine 5000mAh BN5E replacement with 33W Fast Charging support.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Redmi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Charging",
          problem: "Loose USB-C Port / No Charge",
          serviceName: "Charging Port Repair",
          price: 1500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original sub-board PCB with Type-C connector and IC protection.",
          estimatedTime: "30 Mins"
        },
        {
          brand: "Redmi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Speaker",
          problem: "No Sound on Media / Crackling",
          serviceName: "Loudspeaker Module Replacement",
          price: 1200,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Bottom acoustic stereo speaker module replacement.",
          estimatedTime: "30 Mins"
        },
        {
          brand: "Redmi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Microphone",
          problem: "Caller Cannot Hear Voice",
          serviceName: "Microphone Repair",
          price: 1000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Primary digital microphone replacement with noise filter.",
          estimatedTime: "30 Mins"
        },

        // OnePlus 11
        {
          brand: "OnePlus",
          model: "OnePlus 11",
          variant: "5G",
          category: "Display",
          problem: "Green Line / Cracked Screen",
          serviceName: "Display Replacement",
          price: 18500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 2K 120Hz LTPO 3.0 Fluid AMOLED curved panel with frame.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "OnePlus",
          model: "OnePlus 11",
          variant: "5G",
          category: "Display",
          problem: "Curved Glass Cracked (Touch OK)",
          serviceName: "Glass Change",
          price: 5800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Curved OCA vacuum glass replacement preserving OEM panel.",
          estimatedTime: "2 Hours"
        },
        {
          brand: "OnePlus",
          model: "OnePlus 11",
          variant: "5G",
          category: "Battery",
          problem: "Reduced Screen-on Time",
          serviceName: "Battery Replacement",
          price: 4200,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original dual-cell 5000mAh battery supporting 100W SUPERVOOC charge.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "OnePlus",
          model: "OnePlus 11",
          variant: "5G",
          category: "Charging",
          problem: "SuperVOOC Not Activating / Port Loose",
          serviceName: "Charging Port Repair",
          price: 2500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Genuine fast charge port sub-board with pin-level verification.",
          estimatedTime: "45 Mins"
        },

        // Google Pixel 7
        {
          brand: "Google",
          model: "Pixel 7",
          variant: "5G",
          category: "Display",
          problem: "Cracked OLED / Touch Failure",
          serviceName: "Display Replacement",
          price: 16500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "OEM 90Hz Smooth Display OLED with in-screen fingerprint sensor recalibration.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Google",
          model: "Pixel 7",
          variant: "5G",
          category: "Battery",
          problem: "Degraded Battery Health",
          serviceName: "Battery Replacement",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 4355mAh battery with OEM temperature thermistor sensors.",
          estimatedTime: "45 Mins"
        },
        {
          brand: "Google",
          model: "Pixel 7",
          variant: "5G",
          category: "Camera",
          problem: "Rear Visor Glass Shattered / Blurry Photos",
          serviceName: "Camera Visor Glass & Sensor Service",
          price: 4000,
          priceType: "STARTING_FROM",
          status: "ACTIVE",
          notes: "Camera bar lens glass replacement with dust-free chamber sealing.",
          estimatedTime: "1 Hour"
        },

        // Samsung Galaxy S23
        {
          brand: "Samsung",
          model: "Galaxy S23",
          variant: "Standard / Plus",
          category: "Display",
          problem: "Screen Damage / Dead Lines",
          serviceName: "Display Replacement",
          price: 22000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original Flat Dynamic AMOLED 2X 120Hz screen assembly.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Samsung",
          model: "Galaxy S23",
          variant: "Standard / Plus",
          category: "Battery",
          problem: "Battery Drain",
          serviceName: "Battery Replacement",
          price: 4600,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 3900mAh / 4700mAh battery replacement.",
          estimatedTime: "45 Mins"
        },

        // Vivo V29
        {
          brand: "Vivo",
          model: "V29",
          variant: "5G",
          category: "Display",
          problem: "Curved AMOLED Damage",
          serviceName: "Display Replacement",
          price: 13500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 3D Curved 1.5K AMOLED 120Hz display.",
          estimatedTime: "1.5 Hours"
        },
        {
          brand: "Vivo",
          model: "V29",
          variant: "5G",
          category: "Battery",
          problem: "Battery Replacement",
          serviceName: "Battery Replacement",
          price: 3200,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Original 4600mAh battery supporting 80W FlashCharge.",
          estimatedTime: "45 Mins"
        },

        // Nothing Phone (2)
        {
          brand: "Nothing",
          model: "Nothing Phone (2)",
          variant: "5G",
          category: "Display",
          problem: "Screen Broken",
          serviceName: "Display Replacement",
          price: 16500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Flexible LTPO OLED 120Hz display with symmetrical bezel assembly.",
          estimatedTime: "1.5 Hours"
        },
        {
          brand: "Nothing",
          model: "Nothing Phone (2)",
          variant: "5G",
          category: "Back Glass",
          problem: "Transparent Glyph Back Glass Cracked",
          serviceName: "Back Glass & Glyph LED Repair",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Transparent curved rear glass replacement with Glyph interface testing.",
          estimatedTime: "1.5 Hours"
        },

        // General Motherboard & Diagnostics
        {
          brand: "Other",
          model: "All Smartphones",
          variant: "Universal",
          category: "Motherboard / IC",
          problem: "Short Circuit / No Power / Restart Issue",
          serviceName: "IC Level Motherboard Diagnostics & Repair",
          price: 3500,
          priceType: "STARTING_FROM",
          status: "ACTIVE",
          notes: "Component-level micro-soldering, capacitor/diode replacement, and circuit tracing.",
          estimatedTime: "1-3 Days"
        },
        {
          brand: "Other",
          model: "All Smartphones",
          variant: "Universal",
          category: "Water Damage",
          problem: "Water Drop / Liquid Spillage",
          serviceName: "Emergency Ultrasonic Deep Cleaning",
          price: 1200,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Immediate disassembly, ultrasonic chemical bath, and thermal imaging dry-out.",
          estimatedTime: "Same Day"
        },

        // Advanced Laser Lining Services
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Lining",
          problem: "Vertical Green / Pink / White Lines on Screen",
          serviceName: "Laser Machine Display Line Repair (Lining)",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "High-precision laser ITO circuit ablation removing vertical lines while preserving the original Dynamic AMOLED 2X panel.",
          estimatedTime: "2-3 Hours"
        },
        {
          brand: "OnePlus",
          model: "OnePlus 11",
          variant: "5G",
          category: "Lining",
          problem: "Green Vertical Screen Line after System Update",
          serviceName: "OnePlus Green Line Laser Removal (Lining)",
          price: 3500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Specialized laser micro-welding for OnePlus Fluid AMOLED green line restoration.",
          estimatedTime: "2 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard / Pro",
          category: "Lining",
          problem: "Colored Vertical Lines on OLED Display",
          serviceName: "OLED Display Laser Line Repair",
          price: 4000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Laser ablation procedure repairing defective pixel column traces on Super Retina XDR.",
          estimatedTime: "2 Hours"
        },

        // Advanced Flex Change Services
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Flex Change",
          problem: "Screen Blackout / Blank Display / Touch Malfunction from Cable",
          serviceName: "Display Flex Cable Bonding (Flex Change)",
          price: 5500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "ACF hot-bar thermal bonding flex replacement restoring high-speed video signals on original AMOLED panel.",
          estimatedTime: "2-3 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Flex Change",
          problem: "Faulty Power / Interconnect / Audio Flex Cable",
          serviceName: "Interconnect & Power Flex Replacement",
          price: 2500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Replacement of damaged or faulty flex cable related to internal device connectivity and buttons.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "Xiaomi",
          model: "Redmi Note 12",
          variant: "4G / 5G",
          category: "Flex Change",
          problem: "Main-to-Subboard Interconnect Flex Ribbon Damaged",
          serviceName: "Main Interconnect Flex Cable Replacement",
          price: 1800,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "High-grade FPC ribbon replacement restoring charging, audio, and network signal routing.",
          estimatedTime: "45 Mins"
        },

        // Green / White Screen of Death Recovery
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Green / White Screen",
          problem: "Green Screen / White Screen of Death (WSOD) after Update",
          serviceName: "Green / White Screen Display Restoration",
          price: 5000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Micro-soldering flex jumper bypass and display controller voltage stabilization for permanent green/white screen recovery.",
          estimatedTime: "2-4 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Pro / Pro Max",
          category: "Green / White Screen",
          problem: "White Screen / Green Screen of Death after iOS Update",
          serviceName: "iPhone 13 Pro Green / White Screen Recovery",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Micro-wire jumper bypassing corrupted 120Hz ProMotion controller circuit; 100% preserves original display and True Tone.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S22 Ultra",
          variant: "5G",
          category: "Green / White Screen",
          problem: "Green Screen / White Tint Flickering",
          serviceName: "Display Controller Jumper & Green Screen Fix",
          price: 5500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Precision microscope trace jumper restoring AMOLED clock signal and clearing green tint.",
          estimatedTime: "2 Hours"
        }
      ];

      for (const item of defaultPrices) {
        const created = await prisma.repairPrice.create({ data: item });
        await syncToFirestore("repairPrice", created);
      }
      console.log(`[STARTUP] Successfully seeded ${defaultPrices.length} repair price catalogue records.`);
    } else {
      // Ensure specific categories exist (Lining, Flex Change, Green / White Screen)
      const specialCategories = [
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Lining",
          problem: "Vertical Green / Pink / White Lines on Screen",
          serviceName: "Laser Machine Display Line Repair (Lining)",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "High-precision laser ITO circuit ablation removing vertical lines while preserving the original Dynamic AMOLED 2X panel.",
          estimatedTime: "2-3 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Flex Change",
          problem: "Screen Blackout / Blank Display / Damaged Flex Cable",
          serviceName: "Display Flex Cable Bonding (Flex Change)",
          price: 5500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "ACF hot-bar thermal bonding flex replacement restoring high-speed video signals on original AMOLED panel.",
          estimatedTime: "2-3 Hours"
        },
        {
          brand: "Samsung",
          model: "Galaxy S21 Ultra",
          variant: "5G",
          category: "Green / White Screen",
          problem: "Green Screen / White Screen of Death (WSOD) after Update",
          serviceName: "Green / White Screen Display Restoration",
          price: 5000,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Micro-soldering flex jumper bypass and display controller voltage stabilization for permanent green/white screen recovery.",
          estimatedTime: "2-4 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Pro / Pro Max",
          category: "Green / White Screen",
          problem: "White Screen / Green Screen of Death after iOS Update",
          serviceName: "iPhone 13 Pro Green / White Screen Recovery",
          price: 4500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Micro-wire jumper bypassing corrupted 120Hz ProMotion controller circuit; 100% preserves original display and True Tone.",
          estimatedTime: "1-2 Hours"
        },
        {
          brand: "Apple",
          model: "iPhone 13",
          variant: "Standard",
          category: "Flex Change",
          problem: "Replacement of damaged or faulty flex cable related to the device",
          serviceName: "Power / Interconnect Flex Change",
          price: 2500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Replacement of damaged or faulty flex cable related to the device.",
          estimatedTime: "1 Hour"
        },
        {
          brand: "OnePlus",
          model: "OnePlus 11",
          variant: "5G",
          category: "Lining",
          problem: "Green Vertical Screen Line after System Update",
          serviceName: "OnePlus Green Line Laser Removal (Lining)",
          price: 3500,
          priceType: "FIXED",
          status: "ACTIVE",
          notes: "Specialized laser micro-welding for OnePlus Fluid AMOLED green line restoration.",
          estimatedTime: "2 Hours"
        }
      ];

      for (const item of specialCategories) {
        const existing = await prisma.repairPrice.findFirst({
          where: {
            brand: item.brand,
            model: item.model,
            category: item.category,
            serviceName: item.serviceName
          }
        });
        if (!existing) {
          const created = await prisma.repairPrice.create({ data: item });
          await syncToFirestore("repairPrice", created);
        }
      }
    }
  } catch (err) {
    console.error("[STARTUP ERROR] Failed to ensure default repair prices:", err);
  }
}

// Helper to ensure default smartphone repair home slides exist
async function ensureDefaultHomeSlides() {
  try {
    const defaultSlides = [
      {
        title: "Front Glass Change",
        description: "Specialized outer glass replacement preserving your original AMOLED / OLED display.",
        imageUrl: "/assets/images/front_glass_repair_1786719176945.jpg",
        buttonText: "Check Repair Price",
        buttonLink: "/services?focus=search&q=Front+Glass",
        displayOrder: 1,
        status: "ACTIVE"
      },
      {
        title: "Display Replacement",
        description: "100% Genuine original quality screen restoration with True Tone and high refresh rate.",
        imageUrl: "/assets/images/display_replace_1786719191504.jpg",
        buttonText: "Check Repair Price",
        buttonLink: "/services?focus=search&q=Display",
        displayOrder: 2,
        status: "ACTIVE"
      },
      {
        title: "Back Panel / Back Glass Change",
        description: "Factory finish laser back panel replacement and frame restoration for all flagship phones.",
        imageUrl: "/assets/images/back_glass_fix_1786719207185.jpg",
        buttonText: "Check Repair Price",
        buttonLink: "/services?focus=search&q=Back+Glass",
        displayOrder: 3,
        status: "ACTIVE"
      },
      {
        title: "Professional Smartphone Repair",
        description: "Advanced motherboard IC level micro-soldering, laser line removal, and liquid damage recovery.",
        imageUrl: "/assets/images/phone_repair_lab_1786719222650.jpg",
        buttonText: "Check Repair Price",
        buttonLink: "/services?focus=search",
        displayOrder: 4,
        status: "ACTIVE"
      }
    ];

    const count = await prisma.homeSlide.count();
    if (count === 0) {
      console.log("[STARTUP] Seeding default smartphone repair home slides...");
      for (const slide of defaultSlides) {
        const created = await prisma.homeSlide.create({ data: slide });
        await syncToFirestore("homeSlide", created);
      }
      console.log("[STARTUP] Default home slides seeded successfully.");
    }
  } catch (err) {
    console.error("[STARTUP ERROR] Failed to ensure default home slides:", err);
  }
}

// Helper to ensure default repair inventory categories and initial parts catalog
async function ensureDefaultInventoryData() {
  try {
    const defaultCategories = [
      "Displays",
      "Batteries",
      "Charging Ports",
      "Speakers",
      "Microphones",
      "Cameras",
      "Back Panels",
      "Flex Cables",
      "IC / Chips",
      "Connectors",
      "Screws",
      "Adhesives",
      "Repair Tools",
      "Cleaning Materials",
      "Consumables",
      "Spare Parts",
      "Accessories",
      "Other"
    ];

    const categoryCount = await prisma.inventoryCategory.count();
    if (categoryCount === 0) {
      console.log("[STARTUP] Seeding default repair inventory categories...");
      for (let i = 0; i < defaultCategories.length; i++) {
        await prisma.inventoryCategory.create({
          data: {
            name: defaultCategories[i],
            displayOrder: i + 1
          }
        });
      }
    }

    const itemCount = await prisma.inventoryItem.count();
    if (itemCount === 0) {
      console.log("[STARTUP] Seeding default lab repair inventory parts...");
      const sampleItems = [
        {
          name: "Samsung Galaxy S21 Ultra Dynamic AMOLED 2X Display",
          brand: "Samsung",
          model: "SM-G998B",
          sku: "DIS-SAM-S21U-OEM",
          category: "Displays",
          compatibility: "Samsung Galaxy S21 Ultra 5G",
          unit: "Piece",
          currentStock: 8,
          minStockLevel: 3,
          purchasePrice: 18500,
          sellingPrice: 26000,
          supplier: "Korea Tech Components",
          storageLocation: "Rack D-1, Bin 03",
          description: "Original OEM 120Hz 1440p AMOLED assembly with chassis frame",
          status: "ACTIVE"
        },
        {
          name: "Apple iPhone 13 Pro Super Retina XDR OLED Panel",
          brand: "Apple",
          model: "iPhone 13 Pro",
          sku: "DIS-APL-IP13P-ORG",
          category: "Displays",
          compatibility: "iPhone 13 Pro (A2638)",
          unit: "Piece",
          currentStock: 6,
          minStockLevel: 2,
          purchasePrice: 21000,
          sellingPrice: 28500,
          supplier: "Apex Global HK",
          storageLocation: "Rack D-2, Bin 01",
          description: "Factory original 120Hz ProMotion screen with True Tone support",
          status: "ACTIVE"
        },
        {
          name: "Apple iPhone 14 Pro Original Battery 3200mAh",
          brand: "Apple",
          model: "iPhone 14 Pro",
          sku: "BAT-APL-IP14P-OEM",
          category: "Batteries",
          compatibility: "iPhone 14 Pro (A2890)",
          unit: "Piece",
          currentStock: 12,
          minStockLevel: 5,
          purchasePrice: 2800,
          sellingPrice: 5800,
          supplier: "Shenzhen Apex Cell",
          storageLocation: "Bin B-04",
          description: "Grade-A high density Li-Ion cell supporting BMS health transfer",
          status: "ACTIVE"
        },
        {
          name: "Samsung Galaxy S23 Ultra 5000mAh High-Density Battery",
          brand: "Samsung",
          model: "Galaxy S23 Ultra",
          sku: "BAT-SAM-S23U-OEM",
          category: "Batteries",
          compatibility: "Galaxy S23 Ultra 5G",
          unit: "Piece",
          currentStock: 9,
          minStockLevel: 4,
          purchasePrice: 2400,
          sellingPrice: 4800,
          supplier: "Korea Tech Components",
          storageLocation: "Bin B-05",
          description: "Original 5000mAh replacement cell with OEM thermistor",
          status: "ACTIVE"
        },
        {
          name: "Universal Type-C 24-Pin Sub-Board Fast Charging Port",
          brand: "Universal",
          model: "Multi-Device",
          sku: "CHG-UNI-TC24P-GEN",
          category: "Charging Ports",
          compatibility: "Samsung / Xiaomi / Vivo / Realme Type-C",
          unit: "Piece",
          currentStock: 25,
          minStockLevel: 10,
          purchasePrice: 450,
          sellingPrice: 1800,
          supplier: "Global Electronics",
          storageLocation: "Drawer C-1",
          description: "Fast charging power delivery sub-board connector",
          status: "ACTIVE"
        },
        {
          name: "Zhanlida B-7000 Multi-Purpose Precision Acrylic Adhesive 110ml",
          brand: "Zhanlida",
          model: "B-7000",
          sku: "ADH-ZHL-B7000-110",
          category: "Adhesives",
          compatibility: "Universal Display & Back Glass Bonding",
          unit: "Bottle",
          currentStock: 15,
          minStockLevel: 5,
          purchasePrice: 350,
          sellingPrice: 750,
          supplier: "Kathmandu Lab Consumables",
          storageLocation: "Shelf T-1",
          description: "High elasticity waterproof glue with pinpoint nozzle",
          status: "ACTIVE"
        },
        {
          name: "Relife RL-004M Anti-Static Heat Resistant Silicone Repair Mat",
          brand: "Relife",
          model: "RL-004M",
          sku: "TOO-RLF-004M-MAT",
          category: "Repair Tools",
          compatibility: "Workbench Micro-soldering",
          unit: "Piece",
          currentStock: 4,
          minStockLevel: 2,
          purchasePrice: 1200,
          sellingPrice: 2200,
          supplier: "Tool Depot NP",
          storageLocation: "Workbench 1",
          description: "500°C thermal insulation magnetic organizer pad",
          status: "ACTIVE"
        },
        {
          name: "Mechanic 99.9% Pure Electronic Grade Isopropyl Alcohol 1000ml",
          brand: "Mechanic",
          model: "99.9% IPA",
          sku: "CLN-MCH-IPA-1L",
          category: "Cleaning Materials",
          compatibility: "PCB & Board Ultrasonic Cleaning",
          unit: "Bottle",
          currentStock: 10,
          minStockLevel: 3,
          purchasePrice: 650,
          sellingPrice: 1100,
          supplier: "Chemical Supply KTM",
          storageLocation: "Chemical Storage Cabinet",
          description: "Fast-evaporating residue-free ultrasonic deoxidation solvent",
          status: "ACTIVE"
        },
        {
          name: "Qualcomm PM8350 Power Management IC (BGA)",
          brand: "Qualcomm",
          model: "PM8350",
          sku: "IC-QCM-PM8350-BGA",
          category: "IC / Chips",
          compatibility: "Snapdragon 888 Flagship Motherboards",
          unit: "Piece",
          currentStock: 2,
          minStockLevel: 5,
          purchasePrice: 1800,
          sellingPrice: 4500,
          supplier: "HK Micro Components",
          storageLocation: "Anti-Static Drawer IC-12",
          description: "Pre-balled high-efficiency PMIC chip for no-power repair",
          status: "ACTIVE"
        },
        {
          name: "iPhone 14 Pro Max Rear Camera Sapphire Lens Glass Assembly",
          brand: "Apple",
          model: "iPhone 14 Pro Max",
          sku: "CAM-APL-IP14PM-LNS",
          category: "Cameras",
          compatibility: "iPhone 14 Pro Max (A2894)",
          unit: "Set",
          currentStock: 0,
          minStockLevel: 4,
          purchasePrice: 950,
          sellingPrice: 2500,
          supplier: "Shenzhen Apex Cell",
          storageLocation: "Bin C-09",
          description: "Sapphire crystal bezel ring and adhesive seal kit",
          status: "ACTIVE"
        }
      ];

      for (const item of sampleItems) {
        const created = await prisma.inventoryItem.create({ data: item });
        if (created.currentStock > 0) {
          await prisma.inventoryTransaction.create({
            data: {
              itemId: created.id,
              type: "STOCK_IN",
              quantity: created.currentStock,
              previousStock: 0,
              newStock: created.currentStock,
              reason: "Initial Lab Inventory Intake",
              performedByName: "System Admin"
            }
          });
        }
      }
      console.log(`[STARTUP] Seeded ${sampleItems.length} repair inventory items.`);
    }
  } catch (err) {
    console.error("[STARTUP ERROR] Failed to ensure default inventory:", err);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize Firebase Admin safely ensuring initializeApp is always executed
let firestoreSyncDisabled = !(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

function ensureFirebaseAdminApp() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        projectId: firebaseConfig.projectId || "mts-lab-eb8d2",
      });
      console.log("[FIREBASE] Admin SDK initialized for project:", firebaseConfig.projectId || "mts-lab-eb8d2");
    } catch (err: any) {
      console.warn("[FIREBASE] Admin SDK initialization notice:", err?.message || err);
    }
  }
}

// Guarantee Firebase Admin is initialized at startup
ensureFirebaseAdminApp();

function getAdminAuth() {
  ensureFirebaseAdminApp();
  if (admin.apps.length > 0) {
    try {
      return admin.auth();
    } catch (err) {
      console.warn("[FIREBASE] Admin auth unavailable:", err);
      return null;
    }
  }
  return null;
}

// Resilient helper to verify live Firebase Auth email verification state
async function checkFirebaseUserEmailVerified(
  email?: string | null,
  password?: string,
  idToken?: string,
  firebaseUid?: string | null
): Promise<{ checked: boolean; isVerified: boolean; firebaseUid?: string; email?: string }> {
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  const apiKey = firebaseConfig.apiKey || process.env.FIREBASE_API_KEY;

  // 1. Try Firebase Admin SDK if active
  const auth = getAdminAuth();
  if (auth) {
    try {
      let fbUser = null;
      if (firebaseUid) {
        try {
          fbUser = await auth.getUser(firebaseUid);
        } catch (uidErr) {}
      }
      if (!fbUser && normalizedEmail) {
        try {
          fbUser = await auth.getUserByEmail(normalizedEmail);
        } catch (emailErr) {}
      }
      if (fbUser) {
        return {
          checked: true,
          isVerified: Boolean(fbUser.emailVerified),
          firebaseUid: fbUser.uid,
          email: fbUser.email?.toLowerCase().trim()
        };
      }
    } catch (adminErr: any) {
      // Admin SDK may lack service account credentials in local mode; proceed to REST check
    }
  }

  // 2. If idToken is provided, lookup via Google Identity Toolkit REST API
  if (idToken && apiKey) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      if (res.ok) {
        const data: any = await res.json();
        const fbUser = data?.users?.[0];
        if (fbUser) {
          return {
            checked: true,
            isVerified: Boolean(fbUser.emailVerified),
            firebaseUid: fbUser.localId,
            email: fbUser.email?.toLowerCase().trim()
          };
        }
      }
    } catch (lookupErr) {
      console.warn("[FIREBASE AUTH] accounts:lookup error:", lookupErr);
    }
  }

  // 3. If password is provided, query Google Identity Toolkit signInWithPassword to fetch live verification state
  if (password && normalizedEmail && apiKey) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          returnSecureToken: true
        })
      });
      if (res.ok) {
        const data: any = await res.json();
        return {
          checked: true,
          isVerified: Boolean(data.emailVerified),
          firebaseUid: data.localId,
          email: data.email?.toLowerCase().trim() || normalizedEmail
        };
      }
    } catch (signInErr) {
      console.warn("[FIREBASE AUTH] signInWithPassword error:", signInErr);
    }
  }

  return { checked: false, isVerified: false };
}

// Consume a Firebase email-verification action code on the server. The returned
// Firebase ID token is intentionally never exposed to the client or logged.
async function applyFirebaseEmailVerificationCode(
  oobCode?: string | null
): Promise<{ checked: boolean; isVerified: boolean; firebaseUid?: string; email?: string }> {
  const apiKey = firebaseConfig.apiKey || process.env.FIREBASE_API_KEY;
  if (!oobCode || !apiKey) {
    return { checked: false, isVerified: false };
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: String(oobCode).trim(), returnSecureToken: true })
      }
    );
    const data: any = await response.json().catch(() => ({}));

    if (!response.ok || !data?.localId || data.emailVerified !== true) {
      return { checked: false, isVerified: false };
    }

    return {
      checked: true,
      isVerified: true,
      firebaseUid: data.localId,
      email: data.email?.toLowerCase().trim()
    };
  } catch (err: any) {
    console.warn("[FIREBASE AUTH] Email action-code exchange notice:", err?.message || err);
    return { checked: false, isVerified: false };
  }
}

async function sendFirebaseVerificationEmailWithIdToken(
  idToken: string | undefined,
  expectedEmail: string
): Promise<{ sent: boolean; alreadyVerified?: boolean; firebaseUid?: string; email?: string; errorCode?: string }> {
  const apiKey = firebaseConfig.apiKey || process.env.FIREBASE_API_KEY;
  if (!idToken || !apiKey) return { sent: false };

  try {
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    if (!lookup.ok) {
      const errorData: any = await lookup.json().catch(() => ({}));
      const providerMessage = errorData?.error?.message || errorData?.error?.status || "UNKNOWN_PROVIDER_ERROR";
      console.warn("[FIREBASE AUTH] Verification resend lookup rejected:", lookup.status, providerMessage);
      return { sent: false, errorCode: String(providerMessage).split(' : ')[0] };
    }
    const lookupData: any = await lookup.json();
    const fbUser = lookupData?.users?.[0];
    const normalizedExpected = String(expectedEmail || '').toLowerCase().trim();
    const firebaseEmail = String(fbUser?.email || '').toLowerCase().trim();
    if (!fbUser?.localId || !firebaseEmail || firebaseEmail !== normalizedExpected) {
      return { sent: false };
    }
    if (fbUser.emailVerified === true) {
      return { sent: true, alreadyVerified: true, firebaseUid: fbUser.localId, email: firebaseEmail };
    }

    const sendEndpoint = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
    const sendResponse = await fetch(sendEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Do not attach a temporary or unallowlisted continue URL. Firebase's
      // hosted verification handler remains authoritative and this keeps one
      // explicit click to one provider request.
      body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken })
    });
    let providerErrorCode: string | undefined;
    if (!sendResponse.ok) {
      const errorData: any = await sendResponse.json().catch(() => ({}));
      const providerMessage = errorData?.error?.message || errorData?.error?.status || "unknown provider error";
      providerErrorCode = String(providerMessage).split(' : ')[0];
      console.warn("[FIREBASE AUTH] Verification resend rejected:", sendResponse.status, providerMessage);
    }
    return { sent: sendResponse.ok, firebaseUid: fbUser.localId, email: firebaseEmail, ...(sendResponse.ok ? {} : { errorCode: providerErrorCode }) };
  } catch (err: any) {
    console.warn("[FIREBASE AUTH] ID-token verification email notice:", err?.message || err);
    return { sent: false };
  }
}

const FIREBASE_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const firebaseVerificationResendCooldowns = new Map<string, number>();

function getFirebaseVerificationCooldownSeconds(email: string): number {
  const key = String(email || '').toLowerCase().trim();
  const expiresAt = firebaseVerificationResendCooldowns.get(key) || 0;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    firebaseVerificationResendCooldowns.delete(key);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

function markFirebaseVerificationAttempt(email: string): void {
  const key = String(email || '').toLowerCase().trim();
  if (key) firebaseVerificationResendCooldowns.set(key, Date.now() + FIREBASE_VERIFICATION_RESEND_COOLDOWN_MS);
}

// Create or locate the Firebase Auth account and dispatch Firebase's official
// verification email through Identity Toolkit when the Admin SDK is unavailable.
async function ensureFirebaseUserAndSendVerification(
  email: string,
  password: string,
  displayName?: string
): Promise<{ sent: boolean; firebaseUid?: string; errorCode?: string }> {
  const apiKey = firebaseConfig.apiKey || process.env.FIREBASE_API_KEY;
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!apiKey || !normalizedEmail || !password) {
    return { sent: false };
  }

  const endpoint = (operation: string) =>
    `https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(apiKey)}`;

  try {
    let authData: any = null;
    let providerErrorCode: string | undefined;
    const signIn = await fetch(endpoint('signInWithPassword'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password, returnSecureToken: true })
    });
    if (signIn.ok) {
      authData = await signIn.json();
    } else {
      const signInError: any = await signIn.json().catch(() => ({}));
      providerErrorCode = signInError?.error?.message || signInError?.error?.status;
      // Identity Toolkit may return INVALID_LOGIN_CREDENTIALS for a missing
      // account instead of EMAIL_NOT_FOUND. The local bcrypt password has
      // already been validated by the caller before this helper is reached,
      // so attempting signUp remains safe; an existing Firebase account will
      // return EMAIL_EXISTS without changing that account.
      const accountMissing = providerErrorCode === 'EMAIL_NOT_FOUND'
        || providerErrorCode === 'USER_NOT_FOUND'
        || providerErrorCode === 'INVALID_LOGIN_CREDENTIALS';
      if (!accountMissing) {
        return { sent: false, errorCode: providerErrorCode };
      }
      const signUp = await fetch(endpoint('signUp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, displayName: displayName || undefined, returnSecureToken: true })
      });
      if (signUp.ok) {
        authData = await signUp.json();
      } else {
        const signUpError: any = await signUp.json().catch(() => ({}));
        providerErrorCode = signUpError?.error?.message || signUpError?.error?.status || providerErrorCode;
      }
    }

    if (!authData?.idToken || !authData?.localId) {
      return { sent: false, errorCode: providerErrorCode };
    }

    const sendVerification = await fetch(endpoint('sendOobCode'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: authData.idToken })
    });
    if (!sendVerification.ok) {
      const sendError: any = await sendVerification.json().catch(() => ({}));
      providerErrorCode = sendError?.error?.message || sendError?.error?.status || providerErrorCode;
    }

    return { sent: sendVerification.ok, firebaseUid: authData.localId, ...(providerErrorCode ? { errorCode: providerErrorCode } : {}) };
  } catch (err: any) {
    console.warn('[FIREBASE AUTH] REST verification email notice:', err?.message || err);
    return { sent: false };
  }
}

// Get Firestore instance with correct database ID
const getDb = () => {
  ensureFirebaseAdminApp();
  if (!admin.apps.length) {
    throw new Error("Firebase Admin app is not initialized");
  }
  const defaultApp = admin.app();
  if (firebaseConfig.firestoreDatabaseId) {
    return getFirestore(defaultApp, firebaseConfig.firestoreDatabaseId);
  }
  return getFirestore(defaultApp);
};

const dateTimeFields: Record<string, string[]> = {
  user: ["createdAt", "updatedAt", "deletedAt", "lockoutUntil", "lastLoginAt"],
  accessRequest: ["approvedAt", "rejectedAt", "expiresAt", "createdAt", "updatedAt"],
  approvedDevice: ["approvedAt", "revokedAt", "lastUsedAt", "createdAt", "updatedAt"],
  session: ["expiresAt", "lastActiveAt", "createdAt"],
  loginActivity: ["createdAt"],
  branch: ["createdAt", "updatedAt"],
  product: ["createdAt", "updatedAt"],
  inventoryItem: ["createdAt", "updatedAt"],
  inventoryTransaction: ["createdAt"],
  customer: ["createdAt", "updatedAt"],
  repair: [
    "expectedCompletionDate", "assignedAt", "priorityUpdatedAt", "managerUpdatedAt",
    "courierDate", "courierReceivedDate", "returnCourierDispatchDate", "returnCourierDispatchedAt",
    "createdAt", "updatedAt"
  ],
  repairLog: ["createdAt"],
  technicianNote: ["createdAt"],
  payment: ["createdAt"],
  auditLog: ["createdAt"],
  notification: ["readAt", "createdAt"],
  repairTransferRequest: ["respondedAt", "createdAt", "updatedAt"],
  repairPrice: ["createdAt", "updatedAt"],
  homeSlide: ["createdAt", "updatedAt"],
};

const collectionMap: Record<string, string> = {
  user: "users",
  branch: "branches",
  product: "products",
  inventoryItem: "inventory",
  inventoryTransaction: "inventoryTransactions",
  inventoryCategory: "inventoryCategories",
  repair: "repairs",
  repairLog: "repairLogs",
  technicianNote: "technicianNotes",
  payment: "payments",
  auditLog: "auditLogs",
  notification: "notifications",
  repairTransferRequest: "repairTransferRequests",
  accessRequest: "accessRequests",
  approvedDevice: "approvedDevices",
  session: "sessions",
  loginActivity: "loginActivities",
  repairPrice: "repairPrices",
  homeSlide: "homeSlides",
};

function getCollectionName(modelName: string): string {
  return collectionMap[modelName] || (modelName + "s");
}

function serializeForFirestore(data: any): any {
  if (!data) return data;
  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (value === undefined) {
      result[key] = null;
    } else if (typeof value === "object" && value !== null) {
      // Exclude nested relation objects/arrays
      continue;
    } else {
      result[key] = value;
    }
  }
  return result;
}

const modelFieldsMap: Record<string, string[]> = {
  user: [
    "id", "email", "username", "password", "name", "role", "phoneNumber", "department",
    "address", "profileImage", "branchId", "firebaseUid", "googleId", "profilePhoto",
    "authProvider", "accountStatus", "requestCount", "requestLimitReached", "isActive",
    "emailVerified", "twoFactorEnabled", "twoFactorType",
    "deletedAt", "failedLoginAttempts", "lockoutUntil", "lastLoginAt", "createdAt", "updatedAt"
  ],
  branch: ["id", "name", "location", "phone", "createdAt", "updatedAt"],
  product: ["id", "name", "description", "price", "discountPrice", "stockQuantity", "category", "imageUrl", "rating", "isFeatured", "isBestSeller", "createdAt", "updatedAt"],
  inventoryItem: ["id", "name", "brand", "model", "sku", "category", "subcategory", "compatibility", "unit", "currentStock", "minStockLevel", "maxStockLevel", "purchasePrice", "sellingPrice", "supplier", "storageLocation", "description", "notes", "imageUrl", "status", "createdById", "createdAt", "updatedAt"],
  inventoryTransaction: ["id", "itemId", "type", "quantity", "previousStock", "newStock", "reason", "repairNumber", "repairId", "performedById", "performedByName", "notes", "createdAt"],
  inventoryCategory: ["id", "name", "description", "icon", "displayOrder", "createdAt", "updatedAt"],
  repairPrice: ["id", "brand", "model", "variant", "category", "problem", "serviceName", "price", "priceType", "status", "notes", "estimatedTime", "createdAt", "updatedAt"],
  homeSlide: ["id", "title", "description", "imageUrl", "buttonText", "buttonLink", "displayOrder", "status", "createdAt", "updatedAt"],
  accessRequest: ["id", "userId", "fullName", "email", "googleId", "profilePhoto", "deviceIdentifier", "deviceName", "deviceType", "browser", "os", "ipAddress", "userAgent", "requestedRole", "status", "requestNumber", "totalRequests", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "expiresAt", "createdAt", "updatedAt"],
  approvedDevice: ["id", "userId", "deviceIdentifier", "deviceName", "deviceType", "browser", "os", "ipAddress", "userAgent", "status", "approvedBy", "approvedAt", "revokedAt", "lastUsedAt", "createdAt", "updatedAt"],
  session: ["id", "userId", "refreshToken", "deviceIdentifier", "deviceName", "deviceType", "browser", "os", "userAgent", "ipAddress", "lastActiveAt", "expiresAt", "createdAt"],
  loginActivity: ["id", "userId", "ipAddress", "userAgent", "deviceIdentifier", "deviceName", "deviceType", "browser", "os", "status", "createdAt"],
  customer: [
    "id", "customerId", "name", "phone", "alternativePhone", "email", "district", "municipality",
    "address", "landmark", "notes", "createdAt", "updatedAt"
  ],
  repair: [
    "id", "repairNumber", "customerId", "customerName", "customerPhone", "customerEmail", "customerAddress",
    "deviceBrand", "deviceModel", "imeiNumber", "deviceColor", "deviceCondition", "conditionNotes",
    "problemDescription", "accessoriesReceived", "estimatedCost", "advancePaid", "totalPaid",
    "paymentStatus", "status", "priority", "expectedCompletionDate", "remarks", "partsUsed", "repairImages",
    "branchId", "technicianId", "assignedAt", "assignedById", "assignedByName", "priorityUpdatedAt",
    "managerUpdatedAt", "managerUpdatedBy", "receivingMethod", "isCourierIn", "courierCompany",
    "courierTrackingNumber", "courierDate", "courierReceivedDate", "senderName", "senderPhone",
    "originDistrict", "originAddress", "courierNotes", "courierStatus", "isCourierOut", "returnCourierCompany",
    "returnCourierTrackingNumber", "returnCourierDispatchDate", "destinationDistrict", "destinationAddress",
    "receiverName", "receiverPhone", "returnCourierNotes", "isReturnCourierDispatched",
    "returnCourierDispatchedAt", "returnCourierDispatchedById", "returnCourierDispatchedByName",
    "createdById", "createdAt", "updatedAt"
  ],
  repairLog: ["id", "repairId", "userId", "action", "status", "notes", "message", "createdAt"],
  technicianNote: ["id", "repairId", "technicianId", "authorName", "authorRole", "note", "isInternal", "createdAt"],
  payment: ["id", "repairId", "amount", "method", "status", "notes", "createdAt"],
  auditLog: ["id", "userId", "action", "resource", "resourceId", "details", "createdAt"],
  notification: ["id", "userId", "title", "message", "type", "repairId", "repairNumber", "senderId", "senderName", "metadata", "isRead", "readAt", "createdAt"],
  repairTransferRequest: ["id", "repairId", "repairNumber", "senderTechnicianId", "senderTechnicianName", "targetTechnicianId", "targetTechnicianName", "reason", "status", "respondedAt", "responseNote", "createdAt", "updatedAt"],
  batteryWarranty: ["id", "warrantyNumber", "repairId", "repairNumber", "customerId", "customerName", "customerPhone", "customerEmail", "customerAddress", "deviceBrand", "deviceModel", "imeiNumber", "batteryType", "warrantyPeriod", "registrationDate", "expiryDate", "status", "claimCount", "lastClaimDate", "terms", "createdById", "branchId", "createdAt", "updatedAt"],
  batteryWarrantyClaim: ["id", "claimNumber", "warrantyId", "repairNumber", "customerName", "customerPhone", "deviceBrand", "deviceModel", "claimDate", "issueDescription", "status", "actionTaken", "notes", "processedById", "processedByName", "replacementRepairId", "createdAt", "updatedAt"]
};

function sanitizeModelData(modelName: string, data: any): any {
  if (!data) return data;
  const allowedFields = modelFieldsMap[modelName];
  if (!allowedFields) return data;
  
  const sanitized: any = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  }
  return sanitized;
}

function deserializeFromFirestore(modelName: string, data: any): any {
  if (!data) return data;
  const result: any = {};
  const dates = dateTimeFields[modelName] || [];
  for (const [key, value] of Object.entries(data)) {
    if (dates.includes(key) && value) {
      result[key] = new Date(value as string);
    } else {
      result[key] = value;
    }
  }
  return sanitizeModelData(modelName, result);
}

const RTDB_BASE_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || firebaseConfig.databaseURL || "https://mts-lab-eb8d2-default-rtdb.firebaseio.com";

async function syncToRtdb(modelName: string, action: string, record: any) {
  try {
    if (!record) return;
    const recId = record.id || (typeof record === 'string' ? record : null);
    if (!recId) return;

    const pathName = modelName === 'repair' ? 'repairs' : (modelName === 'user' ? 'users' : `${modelName}s`);

    if (action === 'DELETE') {
      await fetch(`${RTDB_BASE_URL}/${pathName}/${recId}.json`, {
        method: 'DELETE'
      }).catch(() => {});
      if (modelName === 'user' && record.firebaseUid) {
        await fetch(`${RTDB_BASE_URL}/users/${record.firebaseUid}.json`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    } else {
      const dataToSync: any = typeof record === 'object' ? { ...record } : { id: recId };
      if (modelName === 'repair') {
        dataToSync.id = String(record.id);
        dataToSync.repairNumber = String(record.repairNumber || '');
        if (record.createdAt) dataToSync.createdAt = new Date(record.createdAt).toISOString();
        if (record.updatedAt) dataToSync.updatedAt = new Date(record.updatedAt).toISOString();
        dataToSync.lastSyncTimestamp = Date.now();
      } else if (modelName === 'user') {
        dataToSync.id = String(record.id);
        dataToSync.email = String(record.email || '').toLowerCase().trim();
        dataToSync.name = String(record.name || '');
        dataToSync.role = String(record.role || '');
        dataToSync.accountStatus = String(record.accountStatus || 'ACTIVE');
        dataToSync.isActive = Boolean(record.isActive);
        dataToSync.emailVerified = Boolean(record.emailVerified);
        dataToSync.twoFactorEnabled = Boolean(record.twoFactorEnabled);
        dataToSync.twoFactorType = String(record.twoFactorType || 'EMAIL');
        if (record.firebaseUid) dataToSync.firebaseUid = String(record.firebaseUid);
        if (record.username) dataToSync.username = String(record.username);
        if (record.department) dataToSync.department = String(record.department);
        if (record.phoneNumber) dataToSync.phoneNumber = String(record.phoneNumber);
        if (record.branchId) dataToSync.branchId = String(record.branchId);
        if (record.createdAt) dataToSync.createdAt = new Date(record.createdAt).toISOString();
        if (record.updatedAt) dataToSync.updatedAt = new Date(record.updatedAt).toISOString();
        dataToSync.lastSyncTimestamp = Date.now();
        // Strip sensitive fields
        delete dataToSync.password;
        delete dataToSync.twoFactorSecret;
      }

      await fetch(`${RTDB_BASE_URL}/${pathName}/${recId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSync)
      }).catch(() => {});

      // If user has firebaseUid, also write to users/${firebaseUid} for direct client lookup
      if (modelName === 'user' && record.firebaseUid && record.firebaseUid !== recId) {
        await fetch(`${RTDB_BASE_URL}/users/${record.firebaseUid}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSync)
        }).catch(() => {});
      }
    }

    // Touch syncTimestamp on RTDB
    await fetch(`${RTDB_BASE_URL}/syncTimestamp.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Date.now())
    }).catch(() => {});
  } catch (err: any) {
    // Non-blocking RTDB sync notice
  }
}

async function syncToFirestore(modelName: string, record: any) {
  if (firestoreSyncDisabled) return;
  try {
    const db = getDb();
    const collectionName = getCollectionName(modelName);
    const serialized = serializeForFirestore(record);
    
    if (!serialized || !serialized.id) return;
    
    await db.collection(collectionName).doc(serialized.id).set(serialized, { merge: true });
    console.log(`[SYNC-PUSH] ${modelName} ${serialized.id} synced to Firestore`);
  } catch (err: any) {
    if (err?.code === 7 || err?.message?.includes("PERMISSION_DENIED") || err?.status === 7) {
      if (!firestoreSyncDisabled) {
        console.log("[FIREBASE] Cloud Firestore admin credentials not present; operating on local relational database.");
        firestoreSyncDisabled = true;
      }
    } else {
      console.log(`[SYNC-PUSH] ${modelName} sync skipped: ${err?.message || "Firestore unavailable"}`);
    }
  }
}

const lastPullTime: Record<string, number> = {};

async function syncModelFromFirestore(modelName: string, force = false) {
  if (firestoreSyncDisabled) return;
  const now = Date.now();
  // Cache pulls for 2 seconds to keep it super performant
  if (!force && lastPullTime[modelName] && now - lastPullTime[modelName] < 2000) {
    return;
  }
  
  try {
    const db = getDb();
    const collectionName = getCollectionName(modelName);
    const snapshot = await db.collection(collectionName).get();
    const prismaModel = (prisma as any)[modelName];
    if (!prismaModel) {
      return;
    }
    
    let count = 0;
    for (const doc of snapshot.docs) {
      try {
        const rawData = doc.data();
        const data = deserializeFromFirestore(modelName, rawData);
        if (!data || !data.id) continue;

        // Foreign Key safety for user model
        if (modelName === "user") {
          if (data.branchId) {
            const branchExists = await prisma.branch.findUnique({ where: { id: data.branchId } });
            if (!branchExists) {
              const defaultBranch = await prisma.branch.findFirst();
              data.branchId = defaultBranch ? defaultBranch.id : null;
            }
          }
          if (data.email) {
            data.email = data.email.toLowerCase().trim();
          }
          if (data.accountStatus === undefined) {
            data.accountStatus = "ACTIVE";
          }
          if (data.isActive === undefined) {
            data.isActive = true;
          }
          if (data.twoFactorEnabled !== undefined) {
            data.twoFactorEnabled = isUser2FAEnabled(data);
          }
        }
        
        const existing = await prismaModel.findUnique({ where: { id: doc.id } });
        if (!existing) {
          await prismaModel.create({ data });
        } else {
          // If local record is strictly newer than the Firestore record, do not overwrite with stale snapshot
          const isLocalNewer = existing.updatedAt && data.updatedAt && new Date(existing.updatedAt) > new Date(data.updatedAt);
          if (!isLocalNewer) {
            await prismaModel.update({
              where: { id: doc.id },
              data
            });
          }
        }
        count++;
      } catch (docErr: any) {
        console.warn(`[SYNC-PULL] Skipping doc ${doc.id} in ${modelName}:`, docErr?.message || docErr);
      }
    }
    
    lastPullTime[modelName] = now;
    console.log(`[SYNC-PULL] Completed ${modelName}! Synced ${count} records.`);
  } catch (err: any) {
    if (err?.code === 7 || err?.message?.includes("PERMISSION_DENIED") || err?.status === 7) {
      if (!firestoreSyncDisabled) {
        console.log("[FIREBASE] Cloud Firestore admin credentials not present; operating on local relational database.");
        firestoreSyncDisabled = true;
      }
    } else {
      console.log(`[SYNC-PULL] ${modelName} sync skipped: ${err?.message || "Firestore unavailable"}`);
    }
  }
}

async function syncAllFromFirestore() {
  console.log("[SYNC-STARTUP] Pulling all database tables from central Firestore...");
  const syncOrder = [
    "branch",
    "user",
    "accessRequest",
    "product",
    "repairPrice",
    "repair",
    "repairLog",
    "technicianNote",
    "payment",
    "auditLog",
    "notification",
    "repairTransferRequest",
    "attendance",
    "attendanceAuditLog",
  ];
  for (const model of syncOrder) {
    await syncModelFromFirestore(model, true);
  }
  console.log("[SYNC-STARTUP] Initial database synchronization complete!");
}

// Compatibility wrappers for existing code
async function syncUserToFirestore(user: any) {
  return syncToFirestore("user", user);
}

async function syncBranchToFirestore(branch: any) {
  return syncToFirestore("branch", branch);
}

async function syncFromFirestore() {
  return syncAllFromFirestore();
}

const syncRouteMiddleware = (models: string[]) => async (req: any, res: any, next: any) => {
  // Pass-through middleware: SQLite/Prisma is the local source of truth.
  // Initial startup sync handles seeding, avoiding race condition overwrites on GET.
  next();
};

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export async function createServerApp() {
  const app = express();

  // Connect to database and seed defaults
  try {
    await prisma.$connect();
    console.log("[DB] Connected successfully to SQLite database");
    await ensureDefaultBranch();
    await ensureAdminUser();
    await ensureDefaultRepairPrices();
    await ensureDefaultHomeSlides();
    await ensureDefaultInventoryData();
    await syncFromFirestore();
    await fixInvalidStatuses();
    await syncAndMigrateCustomers();
  } catch (err) {
    console.error("[DB ERROR] Initial connection failed:", err);
  }

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Static directory for uploaded and generated images (served from both public and src)
  app.use("/assets/images", express.static(path.join(process.cwd(), "public/assets/images")));
  app.use("/assets/images", express.static(path.join(process.cwd(), "src/assets/images")));

  // CORS Middleware supporting credentials, cookies, multi-device and Cloud Run / development origins
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased limit for development
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts, please try again later" },
  });
  // Staff Roles Definition
  const STAFF_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'RECEPTIONIST',
    'LEAD_TECHNICIAN',
    'TECHNICIAN',
    'TECHNICAL_ASSISTANT'
  ];

  // Role Guard Middleware Helper
  const authorize = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Forbidden: You do not have permission" });
      }
      next();
    };
  };

  // Cryptographic OTP & Security Helpers
  const OTP_SALT = process.env.OTP_SALT || "mts-lab-otp-secure-salt-2026";

  const generate6DigitOtp = (): string => {
    return crypto.randomInt(100000, 1000000).toString();
  };

  const hashOtp = (code: string): string => {
    return crypto.createHmac("sha256", OTP_SALT).update(String(code).trim()).digest("hex");
  };

  const verifyOtp = (inputCode: string, storedHash: string | null | undefined): boolean => {
    if (!inputCode || !storedHash) return false;
    const computedHash = hashOtp(inputCode);
    if (computedHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  };

  const maskEmail = (email: string): string => {
    if (!email || !email.includes("@")) return "***@***.com";
    const [local, domain] = email.split("@");
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
  };

  const generate2faEmailHtml = (name: string, otpCode: string): string => {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; background-color: #f8fafc; border-radius: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 8px 18px; background-color: #0f172a; border-radius: 12px; color: #ffffff; font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">MTS LAB</div>
          <h2 style="color: #0f172a; margin: 14px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Security Verification</h2>
          <p style="color: #64748b; margin: 0; font-size: 13px; font-weight: 500;">Two-Factor Authentication (2FA)</p>
        </div>
        <div style="background-color: #ffffff; padding: 32px 28px; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center;">
          <p style="color: #334155; font-size: 15px; margin: 0 0 8px 0; font-weight: 600;">Hello ${name || 'Staff Member'},</p>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 24px 0;">Your MTS Lab verification code is:</p>
          
          <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 16px 36px; margin: 0 auto 24px auto;">
            <span style="font-family: monospace, Courier, sans-serif; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0f172a;">${otpCode}</span>
          </div>

          <p style="color: #e11d48; font-size: 13px; font-weight: 700; margin: 0 0 16px 0;">This code will expire in 5 minutes.</p>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
            If you did not attempt to log in to MTS Lab, please ignore this email and secure your account.
          </p>
        </div>
        <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
          MTS Lab &bull; Kathmandu, Nepal &bull; Automated Security System
        </div>
      </div>
    `;
  };

  // Configurable Production-Grade Email Transporter
  const initMailTransporter = () => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER || "").trim();
    const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "").replace(/\s+/g, "");
    const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

    if (smtpHost && smtpUser && smtpPass) {
      return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false
        }
      });
    } else if (smtpUser && smtpPass) {
      return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false
        }
      });
    }
    return null;
  };

  // Secure Real Email Dispatcher with Multi-Provider Support (Gmail, SMTP, Resend, SendGrid)
  const sendEmail = async (
    toOrOptions: string | { to: string; subject: string; body?: string; text?: string; html?: string },
    subjectParam?: string,
    bodyParam?: string,
    htmlParam?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    let to: string;
    let subject: string;
    let body: string;
    let html: string | undefined;

    if (typeof toOrOptions === 'object' && toOrOptions !== null) {
      to = toOrOptions.to;
      subject = toOrOptions.subject;
      body = toOrOptions.body || toOrOptions.text || '';
      html = toOrOptions.html;
    } else {
      to = String(toOrOptions);
      subject = subjectParam || '';
      body = bodyParam || '';
      html = htmlParam;
    }

    const fromAddress = process.env.SMTP_FROM || process.env.GMAIL_USER || process.env.EMAIL_USER || '"MTS Lab Security" <no-reply@mtslab.com>';

    const defaultHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #f8fafc; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; background-color: #0f172a; border-radius: 12px; line-height: 48px; color: #ffffff; font-size: 24px; font-weight: bold;">M</div>
          <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">MTS Lab Security OS</h2>
          <p style="color: #64748b; margin: 0; font-size: 13px; font-weight: 500;">Mobile Technology Station (MTS) &bull; Smartphone Repair Management</p>
        </div>
        <div style="background-color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h3 style="color: #1e293b; margin-top: 0; font-size: 16px; font-weight: 700;">${subject}</h3>
          <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-line; margin: 16px 0;">${body}</div>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
            This is an automated security message. If you did not initiate this request, please contact the Super Administrator immediately.
          </div>
        </div>
      </div>
    `;

    // 1. Check Resend HTTP API
    if (process.env.RESEND_API_KEY) {
      try {
        console.log(`[AUTH DIAGNOSTIC] Dispatching 2FA email via Resend API to ${maskEmail(to)}...`);
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromAddress.includes("<") ? fromAddress : `MTS Lab <${fromAddress}>`,
            to: [to],
            subject,
            text: body,
            html: html || defaultHtml
          })
        });
        const resData: any = await resendRes.json();
        if (resendRes.ok) {
          console.log(`[AUTH DIAGNOSTIC] ✅ Resend delivery succeeded (Message ID: ${resData?.id})`);
          return { success: true, messageId: resData?.id };
        } else {
          console.error(`[AUTH DIAGNOSTIC] ⚠️ Resend API returned error:`, resData?.message || resData);
        }
      } catch (resendErr: any) {
        console.error(`[AUTH DIAGNOSTIC] ⚠️ Resend fetch failed:`, resendErr?.message || resendErr);
      }
    }

    // 2. Check SendGrid HTTP API
    if (process.env.SENDGRID_API_KEY) {
      try {
        console.log(`[AUTH DIAGNOSTIC] Dispatching 2FA email via SendGrid API to ${maskEmail(to)}...`);
        const sendgridRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: process.env.SMTP_FROM_EMAIL || "no-reply@mtslab.com", name: "MTS Lab Security" },
            subject,
            content: [
              { type: "text/plain", value: body },
              { type: "text/html", value: html || defaultHtml }
            ]
          })
        });
        if (sendgridRes.ok || sendgridRes.status === 202) {
          console.log(`[AUTH DIAGNOSTIC] ✅ SendGrid delivery succeeded (HTTP ${sendgridRes.status})`);
          return { success: true };
        } else {
          console.error(`[AUTH DIAGNOSTIC] ⚠️ SendGrid returned HTTP ${sendgridRes.status}`);
        }
      } catch (sgErr: any) {
        console.error(`[AUTH DIAGNOSTIC] ⚠️ SendGrid fetch failed:`, sgErr?.message || sgErr);
      }
    }

    // 3. Check Nodemailer (Gmail or Custom SMTP)
    const transporter = initMailTransporter();
    if (transporter) {
      try {
        console.log(`[AUTH DIAGNOSTIC] Dispatching 2FA email via SMTP to ${maskEmail(to)}...`);
        const info = await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text: body,
          html: html || defaultHtml
        });
        console.log(`[AUTH DIAGNOSTIC] ✅ SMTP delivery succeeded (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        console.error(`[AUTH DIAGNOSTIC] ❌ SMTP delivery failed (${err?.code || err?.message || err})`);
        return { success: false, error: err?.message || "SMTP delivery failed" };
      }
    }

    console.error(`[AUTH DIAGNOSTIC] ❌ Outbound email delivery failed: No active email service configured in .env (GMAIL_USER + GMAIL_APP_PASSWORD, SMTP_HOST, or RESEND_API_KEY).`);
    return { success: false, error: "No email service configured in .env" };
  };

  // Centralized Audit Logging Engine (SQLite + Central Firestore + Real-Time Sync)
  const recordAuditLog = async (params: {
    req?: any;
    userId?: string | null;
    userEmail?: string | null;
    userName?: string | null;
    userRole?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    status?: "SUCCESS" | "FAILED";
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceInfo?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    details?: string | null;
    metadata?: any;
  }) => {
    try {
      const clientIp = params.ipAddress || (params.req ? (params.req.ip || params.req.headers["x-forwarded-for"] || "127.0.0.1") : null);
      const clientUserAgent = params.userAgent || (params.req ? (params.req.headers["user-agent"] || "") : null);
      const clientDevice = params.deviceInfo || (params.req ? (params.req.body?.device?.deviceName || params.req.headers["x-device-id"] || null) : null);

      let metadataStr: string | null = null;
      if (params.metadata) {
        try {
          metadataStr = typeof params.metadata === "string" ? params.metadata : JSON.stringify(params.metadata);
        } catch {
          metadataStr = null;
        }
      }

      const logEntry = await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          userEmail: params.userEmail || (params.req?.user?.email || null),
          userName: params.userName || (params.req?.user?.name || null),
          userRole: params.userRole || (params.req?.user?.role || null),
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId ? String(params.resourceId) : null,
          status: params.status || "SUCCESS",
          ipAddress: String(clientIp || "127.0.0.1"),
          userAgent: clientUserAgent ? String(clientUserAgent).slice(0, 500) : null,
          deviceInfo: clientDevice ? String(clientDevice).slice(0, 200) : null,
          previousValue: params.previousValue ? String(params.previousValue) : null,
          newValue: params.newValue ? String(params.newValue) : null,
          details: params.details ? String(params.details) : null,
          metadata: metadataStr
        }
      });

      // Broadcast in real-time across connected devices
      broadcastRealtimeEvent({
        entity: "auditLog",
        action: "CREATE",
        id: logEntry.id,
        data: logEntry
      });

      // Sync to central Firestore
      if (!firestoreSyncDisabled) {
        try {
          const db = getDb();
          await db.collection("auditLogs").doc(logEntry.id).set({
            ...logEntry,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          // non-blocking
        }
      }

      return logEntry;
    } catch (err) {
      console.error("[RECORD AUDIT LOG ERROR]", err);
      return null;
    }
  };

  // Auth Middleware — verifies JWT and enforces 2-hour inactivity via Session.lastActiveAt
  const authenticate = async (req: any, res: any, next: any) => {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (authHeader) {
      token = authHeader;
    } else if (req.query && req.query.token) {
      token = String(req.query.token).trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    }

    let decoded: any = null;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      if (err?.name === "TokenExpiredError") {
        // The 15-min JWT expired — client should use /api/auth/refresh to get a new one
        console.warn(`[AUTH] Access token expired for route: ${req.path}`);
        return res.status(401).json({ error: "TokenExpiredError", message: "Session token expired. Please refresh your session." });
      }
      console.warn("[AUTH WARNING] Token verification failed:", err?.message || err);
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = decoded;

    // --- 2-Hour Inactivity Check via Session table ---
    // Only check for routes that are NOT the activity ping or refresh endpoints
    const skipInactivityCheck = req.path === '/auth/activity' || req.path === '/auth/refresh' || req.path === '/auth/logout';
    if (!skipInactivityCheck) {
      try {
        // Find the most recently active session for this user
        const session = await prisma.session.findFirst({
          where: {
            userId: decoded.id,
            expiresAt: { gt: new Date() }
          },
          orderBy: { lastActiveAt: 'desc' }
        });

        if (!session) {
          return res.status(401).json({ error: "InactivityExpired", message: "Your session has expired due to inactivity. Please log in again." });
        }

        const lastActive = session.lastActiveAt ? new Date(session.lastActiveAt).getTime() : 0;
        const inactiveDuration = Date.now() - lastActive;

        if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
          // Session has been inactive for > 2 hours — invalidate it
          console.warn(`[AUTH] Session inactivity exceeded 2h for user ${decoded.id}. Invalidating session.`);
          await prisma.session.deleteMany({ where: { userId: decoded.id } });
          return res.status(401).json({ error: "InactivityExpired", message: "Your session has expired due to inactivity. Please log in again." });
        }

        // Throttle lastActiveAt updates (max once per 30s per session) to avoid excessive DB writes
        if (inactiveDuration > LAST_ACTIVE_UPDATE_THROTTLE_MS) {
          await prisma.session.update({
            where: { id: session.id },
            data: { lastActiveAt: new Date() }
          }).catch(() => {}); // Non-blocking; don't fail the request if update fails
        }

        // Attach sessionId for use in activity/logout endpoints
        req.sessionId = session.id;
        req.sessionRefreshToken = session.refreshToken;
      } catch (dbErr) {
        // Non-blocking: if session DB check fails, allow request to proceed
        console.warn("[AUTH] Session inactivity check DB error (proceeding):", dbErr);
      }
    }

    next();
  };

  // ============================================================================
  // SESSION MANAGEMENT ENDPOINTS (2-Hour Inactivity System)
  // ============================================================================

  // POST /api/auth/refresh — Issue a new 15-min access token using the refresh token
  // Client calls this when the 15m JWT expires. Server checks Session.lastActiveAt.
  app.post("/api/auth/refresh", async (req: any, res) => {
    try {
      const refreshToken = req.body?.refreshToken
        || req.headers?.["x-refresh-token"]
        || req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: "NoRefreshToken", message: "Refresh token is required." });
      }

      // Look up the session in DB
      const session = await prisma.session.findUnique({
        where: { refreshToken: String(refreshToken) },
        include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true, deletedAt: true, accountStatus: true } } }
      });

      if (!session || !session.user) {
        return res.status(401).json({ error: "InvalidRefreshToken", message: "Session not found. Please log in again." });
      }

      // Check hard expiry (30 days)
      if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        res.clearCookie("refreshToken");
        return res.status(401).json({ error: "SessionExpired", message: "Session has expired. Please log in again." });
      }

      // Check 2-hour inactivity window
      const lastActive = session.lastActiveAt ? new Date(session.lastActiveAt).getTime() : 0;
      const inactiveDuration = Date.now() - lastActive;

      if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
        // Inactive > 2h — invalidate all user sessions
        console.warn(`[AUTH REFRESH] Inactivity > 2h for user ${session.userId}. Invalidating all sessions.`);
        await prisma.session.deleteMany({ where: { userId: session.userId } });
        res.clearCookie("refreshToken");
        return res.status(401).json({ error: "InactivityExpired", message: "Your session has expired due to inactivity. Please log in again to continue." });
      }

      // Verify user account is still active
      const user = session.user;
      if (user.deletedAt || !user.isActive || (user.accountStatus !== "ACTIVE" && user.accountStatus !== "APPROVED")) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        res.clearCookie("refreshToken");
        return res.status(401).json({ error: "AccountInactive", message: "Your account is no longer active." });
      }

      // Issue new 15-min access token
      const newAccessToken = jwt.sign(
        { id: user.id, role: user.role, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      // Update session lastActiveAt
      await prisma.session.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() }
      }).catch(() => {});

      return res.json({
        success: true,
        token: newAccessToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });

    } catch (err: any) {
      console.error("[AUTH REFRESH ERROR]", err);
      return res.status(500).json({ error: "RefreshFailed", message: "Failed to refresh session. Please log in again." });
    }
  });

  // POST /api/auth/logout — Explicitly invalidate the session (called on manual logout)
  app.post("/api/auth/logout", async (req: any, res) => {
    try {
      const refreshToken = req.body?.refreshToken
        || req.headers?.["x-refresh-token"]
        || req.cookies?.refreshToken;

      // Try to delete the session by refresh token
      if (refreshToken) {
        await prisma.session.deleteMany({ where: { refreshToken: String(refreshToken) } }).catch(() => {});
      }

      // If authenticated, also clean up any other sessions for belt-and-suspenders security
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
          if (decoded?.id) {
            // Delete only THIS device's session (not all sessions) — other devices remain logged in
            if (refreshToken) {
              await prisma.session.deleteMany({ where: { userId: decoded.id, refreshToken: String(refreshToken) } }).catch(() => {});
            }
          }
        } catch {
          // Token expired is fine — still clear cookie
        }
      }

      res.clearCookie("refreshToken", { httpOnly: true, sameSite: "none", secure: true });
      return res.json({ success: true, message: "Logged out successfully." });

    } catch (err: any) {
      console.error("[AUTH LOGOUT ERROR]", err);
      return res.json({ success: true, message: "Logged out." }); // Always return success to ensure client clears state
    }
  });

  // POST /api/auth/activity — Lightweight ping to update session.lastActiveAt (resets inactivity timer)
  // Called when user clicks "Continue Session" in the inactivity warning modal
  app.post("/api/auth/activity", authenticate, async (req: any, res) => {
    try {
      // Find and update lastActiveAt for all user sessions (all active devices)
      await prisma.session.updateMany({
        where: {
          userId: req.user.id,
          expiresAt: { gt: new Date() }
        },
        data: { lastActiveAt: new Date() }
      });

      return res.json({
        success: true,
        lastActiveAt: new Date().toISOString(),
        message: "Session activity updated."
      });
    } catch (err: any) {
      console.error("[AUTH ACTIVITY ERROR]", err);
      return res.status(500).json({ error: "Failed to update activity." });
    }
  });

  // ============================================================================
  // Real-Time Server-Sent Events (SSE) Hub for instantaneous multi-device updates

  app.get("/api/events", (req: any, res: any) => {
    // Optional token validation (if token provided)
    const token = req.query.token || (req.headers.authorization ? req.headers.authorization.split(" ")[1] : null);
    let authUser: any = null;
    if (token) {
      try {
        authUser = jwt.verify(token as string, JWT_SECRET);
      } catch (e) {
        // Token expired/invalid, allow stream
      }
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: Date.now() })}\n\n`);

    const onEvent = (event: ServerRealtimeEvent) => {
      try {
        res.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
        if (typeof res.flush === "function") {
          res.flush();
        }
      } catch (err) {
        console.warn("[SSE WRITE ERROR]", err);
      }
    };

    realtimeHub.on("realtime-event", onEvent);

    // Keep-alive heartbeat every 15s to keep connection open across proxies/mobile networks
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
        if (typeof res.flush === "function") {
          res.flush();
        }
      } catch (err) {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on("close", () => {
      realtimeHub.off("realtime-event", onEvent);
      clearInterval(heartbeat);
    });
  });

  // Delta Sync API for mobile/background recovery
  app.get("/api/sync/changes", async (req: any, res: any) => {
    try {
      const since = req.query.since ? new Date(parseInt(req.query.since as string)) : new Date(Date.now() - 120000);
      const recentRepairs = await prisma.repair.findMany({
        where: { updatedAt: { gte: since } },
        include: { technician: { select: { name: true, role: true } } },
        orderBy: { updatedAt: "desc" },
        take: 50
      });
      res.json({
        timestamp: Date.now(),
        repairs: recentRepairs
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch delta changes" });
    }
  });

  // API Routes
  app.delete("/api/admin/clear-all-data", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { password, startDate, endDate, deletionType } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid password confirmation" });
    }

    try {
      let whereClause: any = {};
      if (startDate && endDate) {
        whereClause = {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        };
      }

      // Count what we are about to delete for the audit log
      const count = await prisma.repair.count({ where: whereClause });

      // 1. Delete from Prisma (SQLite)
      // We delete related records based on repairs in the range
      const repairIds = await prisma.repair.findMany({
        where: whereClause,
        select: { id: true, repairNumber: true }
      });
      const ids = repairIds.map(r => r.id);

      await prisma.technicianNote.deleteMany({ where: { repairId: { in: ids } } });
      await prisma.repairLog.deleteMany({ where: { repairId: { in: ids } } });
      await prisma.payment.deleteMany({ where: { repairId: { in: ids } } });
      await prisma.repair.deleteMany({ where: whereClause });
      
      // 2. Delete from Firebase (Firestore)
      const firestore = getDb();
      const repairsColl = firestore.collection('repairs');
      
      let query: any = repairsColl;
      if (startDate && endDate) {
        query = repairsColl
          .where('createdAt', '>=', new Date(startDate).toISOString())
          .where('createdAt', '<=', new Date(endDate).toISOString());
      }

      const repairsSnapshot = await query.get();
      
      if (!repairsSnapshot.empty) {
        const docs = repairsSnapshot.docs;
        // Batch limit is 500 operations
        for (let i = 0; i < docs.length; i += 500) {
          const chunk = docs.slice(i, i + 500);
          const batch = firestore.batch();
          chunk.forEach(doc => {
            // Safe check: ensure document exists in our snapshot
            if (doc.exists) {
              batch.delete(doc.ref);
            }
          });
          await batch.commit();
        }
      }

      // Log the activity with more details
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CLEAR_DATA",
          resource: "REPAIRS",
          details: `Super Admin deleted ${count} records. Type: ${deletionType || 'RANGE'}. Range: ${startDate || 'N/A'} to ${endDate || 'N/A'}`
        }
      });

      res.json({ 
        message: count > 0 
          ? `${count} customer records and repair data deleted successfully.` 
          : "No records were found matching the selected criteria.",
        deletedCount: count
      });
    } catch (err: any) {
      console.error("[CLEAR DATA ERROR]", err);
      let errorMsg = err.message || "Unknown error";
      
      // Detailed error mapping for user-friendly feedback
      if (errorMsg.includes("5 NOT_FOUND") || errorMsg.includes("NOT_FOUND")) {
        errorMsg = "Firebase resource not found. This typically happens if the collection is already empty or the database instance is misconfigured.";
      } else if (errorMsg.includes("7 PERMISSION_DENIED") || errorMsg.includes("PERMISSION_DENIED")) {
        errorMsg = "Access denied by Firebase. Please verify service account permissions.";
      } else if (errorMsg.includes("QUOTA_EXCEEDED")) {
        errorMsg = "Firebase quota exceeded. Please try again tomorrow.";
      }

      res.status(500).json({ error: "Deletion failed: " + errorMsg });
    }
  });

  app.get("/api/admin/deletion-history", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const history = await prisma.auditLog.findMany({
      where: { action: { in: ["CLEAR_DATA", "CLEAR_ALL_DATA"] } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(history);
  });

  // Access Requests Routes for Super Admin
  app.get("/api/access-requests", authenticate, authorize(['SUPER_ADMIN']), syncRouteMiddleware(['accessRequest']), async (req: any, res) => {
    try {
      const requests = await prisma.accessRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              accountStatus: true,
              isActive: true,
              requestCount: true,
              requestLimitReached: true,
              profileImage: true
            }
          }
        }
      });
      // Enrich with requestCount / limit reached from User table
      const enrichedRequests = await Promise.all(
        requests.map(async (r) => {
          const u = r.user || await prisma.user.findFirst({
            where: {
              OR: [
                { email: r.email },
                { googleId: r.googleId }
              ]
            }
          });
          return {
            ...r,
            requestCount: u ? u.requestCount : r.totalRequests,
            requestLimitReached: u ? u.requestLimitReached : (r.totalRequests >= 3),
            userRole: u ? u.role : r.requestedRole,
          };
        })
      );
      res.json(enrichedRequests);
    } catch (err: any) {
      console.error("[GET ACCESS REQUESTS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch access requests" });
    }
  });

  app.post("/api/access-requests/:id/approve", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;
    const { role } = req.body;

    try {
      const request = await prisma.accessRequest.findUnique({
        where: { id }
      });

      if (!request) {
        return res.status(404).json({ error: "Access request not found" });
      }

      // Security Mandate: Super Admin cannot approve their own device request
      const isSelfApproval = 
        (req.user.email && request.email && req.user.email.toLowerCase() === request.email.toLowerCase()) ||
        (request.userId && req.user.id === request.userId);

      if (isSelfApproval) {
        return res.status(403).json({
          error: "Security Policy Violation: Super Administrators cannot approve their own device access requests. Another administrator must approve this request."
        });
      }

      if (request.status === "APPROVED") {
        return res.status(400).json({ error: "Request has already been approved." });
      }

      const assignedRole = role || request.requestedRole || "RECEPTIONIST";

      // Update AccessRequest
      const updatedRequest = await prisma.accessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedBy: req.user.name || req.user.email,
          approvedAt: new Date()
        }
      });

      // Find user associated with this request
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: request.email },
            { googleId: request.googleId }
          ]
        }
      });

      if (user) {
        // Update user status and assigned role
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: assignedRole,
            accountStatus: "APPROVED",
            isActive: true
          }
        });

        // Register / Approve Device
        const deviceId = request.deviceIdentifier || `dev_${user.id}_${Date.now()}`;
        await prisma.approvedDevice.upsert({
          where: {
            userId_deviceIdentifier: {
              userId: user.id,
              deviceIdentifier: deviceId
            }
          },
          update: {
            status: "APPROVED",
            deviceName: request.deviceName,
            deviceType: request.deviceType || "DESKTOP",
            browser: request.browser,
            os: request.os,
            ipAddress: request.ipAddress,
            userAgent: request.userAgent,
            approvedBy: req.user.name || req.user.email,
            approvedAt: new Date(),
            revokedAt: null,
            lastUsedAt: new Date()
          },
          create: {
            userId: user.id,
            deviceIdentifier: deviceId,
            deviceName: request.deviceName || `${request.browser || 'Browser'} on ${request.os || 'Device'}`,
            deviceType: request.deviceType || "DESKTOP",
            browser: request.browser,
            os: request.os,
            ipAddress: request.ipAddress,
            userAgent: request.userAgent,
            status: "APPROVED",
            approvedBy: req.user.name || req.user.email,
            approvedAt: new Date(),
            lastUsedAt: new Date()
          }
        });

        // Notify user
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: "Device Access Approved",
            message: `Your device (${request.deviceName || 'Device'}) has been approved for access. Role: ${assignedRole}.`
          }
        });
      }

      // Record audit history
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "APPROVE_DEVICE_ACCESS",
          resource: "ACCESS_REQUEST",
          resourceId: id,
          details: `Approved device (${request.deviceName || 'Device'}) access for ${request.email} with role: ${assignedRole}`
        }
      });

      res.json({ success: true, message: `Access request approved with role ${assignedRole}. Device is now authorized.`, request: updatedRequest });
    } catch (err: any) {
      console.error("[APPROVE ACCESS REQUEST ERROR]", err);
      res.status(500).json({ error: "Failed to approve access request" });
    }
  });

  app.post("/api/access-requests/:id/reject", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;

    try {
      const request = await prisma.accessRequest.findUnique({
        where: { id }
      });

      if (!request) {
        return res.status(404).json({ error: "Access request not found" });
      }

      // Update AccessRequest
      const updatedRequest = await prisma.accessRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectedBy: req.user.name || req.user.email,
          rejectedAt: new Date()
        }
      });

      // Find user associated with this request
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: request.email },
            { googleId: request.googleId }
          ]
        }
      });

      if (user) {
        // If device identifier is present, revoke that device
        if (request.deviceIdentifier) {
          await prisma.approvedDevice.updateMany({
            where: {
              userId: user.id,
              deviceIdentifier: request.deviceIdentifier
            },
            data: {
              status: "REVOKED",
              revokedAt: new Date()
            }
          });
        }

        // Notify user
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: "Device Access Request Rejected",
            message: `Your access request for device (${request.deviceName || 'Device'}) was rejected by the administrator.`
          }
        });
      }

      // Record audit history
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "REJECT_DEVICE_ACCESS",
          resource: "ACCESS_REQUEST",
          resourceId: id,
          details: `Rejected device access request for ${request.email} (${request.deviceName || 'Device'})`
        }
      });

      res.json({ success: true, message: "Access request rejected.", request: updatedRequest });
    } catch (err: any) {
      console.error("[REJECT ACCESS REQUEST ERROR]", err);
      res.status(500).json({ error: "Failed to reject access request" });
    }
  });

  // Approved Devices Management for Super Admin
  app.get("/api/approved-devices", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const devices = await prisma.approvedDevice.findMany({
        orderBy: { lastUsedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              profileImage: true
            }
          }
        }
      });
      res.json(devices);
    } catch (err: any) {
      console.error("[GET APPROVED DEVICES ERROR]", err);
      res.status(500).json({ error: "Failed to fetch approved devices" });
    }
  });

  app.post("/api/approved-devices/:id/revoke", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const device = await prisma.approvedDevice.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!device) {
        return res.status(404).json({ error: "Device record not found" });
      }

      const updated = await prisma.approvedDevice.update({
        where: { id },
        data: {
          status: "REVOKED",
          revokedAt: new Date()
        }
      });

      // Record audit history
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "REVOKE_DEVICE",
          resource: "APPROVED_DEVICE",
          resourceId: id,
          details: `Revoked approved device (${device.deviceName || device.deviceIdentifier}) for ${device.user?.email}`
        }
      });

      res.json({ success: true, message: `Device "${device.deviceName || 'Device'}" revoked successfully.`, device: updated });
    } catch (err: any) {
      console.error("[REVOKE DEVICE ERROR]", err);
      res.status(500).json({ error: "Failed to revoke device" });
    }
  });

  app.delete("/api/approved-devices/:id", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;
    try {
      await prisma.approvedDevice.delete({
        where: { id }
      });
      res.json({ success: true, message: "Device record removed." });
    } catch (err: any) {
      console.error("[DELETE DEVICE ERROR]", err);
      res.status(500).json({ error: "Failed to delete device record" });
    }
  });

  // System Notification Creator & Real-time Broadcaster Helper
  async function sendSystemNotification({
    userId,
    title,
    message,
    type = 'GENERAL',
    repairId,
    repairNumber,
    senderId,
    senderName,
    metadata
  }: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    repairId?: string;
    repairNumber?: string;
    senderId?: string;
    senderName?: string;
    metadata?: any;
  }) {
    try {
      const metaStr = typeof metadata === 'object' && metadata !== null ? JSON.stringify(metadata) : (metadata || null);
      const notif = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          repairId: repairId || null,
          repairNumber: repairNumber || null,
          senderId: senderId || null,
          senderName: senderName || null,
          metadata: metaStr,
          isRead: false
        }
      });

      broadcastRealtimeEvent({
        entity: "notification",
        action: "CREATE",
        id: notif.id,
        data: notif
      });

      syncToFirestore('notification', notif).catch(() => {});
      return notif;
    } catch (err) {
      console.error("[NOTIFICATION HELPER ERROR]", err);
      return null;
    }
  }

  // Notifications Routes
  app.get("/api/notifications", authenticate, async (req: any, res) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      const unreadCount = await prisma.notification.count({
        where: { userId: req.user.id, isRead: false }
      });
      res.json({ notifications, unreadCount });
    } catch (err: any) {
      console.error("[NOTIFICATIONS GET ERROR]", err);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", authenticate, async (req: any, res) => {
    try {
      await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id },
        data: { isRead: true, readAt: new Date() }
      });
      broadcastRealtimeEvent({ entity: "notification", action: "UPDATE", id: req.params.id, data: { isRead: true } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", authenticate, async (req: any, res) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true, readAt: new Date() }
      });
      broadcastRealtimeEvent({ entity: "notification", action: "UPDATE", data: { userId: req.user.id, isRead: true } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to mark all as read" });
    }
  });

  // Repair-Specific Priority Alert from Receptionist/Admin to Assigned Technician
  app.post("/api/repairs/:id/alert", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'LEAD_TECHNICIAN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { message, priority = 'URGENT' } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Alert message is required." });
      }

      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found." });
      }

      if (!repair.technicianId) {
        return res.status(400).json({ error: "No technician is currently assigned to this repair. Please assign a technician first." });
      }

      const cleanMsg = message.trim();

      // 1. Create targeted Notification for assigned technician
      await sendSystemNotification({
        userId: repair.technicianId,
        title: priority === 'URGENT' ? '🚨 URGENT Repair Alert' : '⚠️ Priority Repair Alert',
        message: `[Job #${repair.repairNumber} - ${repair.deviceBrand} ${repair.deviceModel}] ${cleanMsg} (from ${req.user.name || req.user.role})`,
        type: 'REPAIR_ALERT',
        repairId: repair.id,
        repairNumber: repair.repairNumber,
        senderId: req.user.id,
        senderName: req.user.name || req.user.role,
        metadata: {
          priority,
          alertMessage: cleanMsg,
          deviceBrand: repair.deviceBrand,
          deviceModel: repair.deviceModel
        }
      });

      // 2. Append to RepairLog
      const log = await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: repair.status,
          message: `🚨 Staff Alert from ${req.user.name || req.user.role}: "${cleanMsg}"`
        }
      });

      // 3. Append to TechnicianNote communication trail
      const note = await prisma.technicianNote.create({
        data: {
          repairId: repair.id,
          technicianId: req.user.id,
          authorName: req.user.name || req.user.role,
          authorRole: req.user.role,
          note: `[Priority Alert] ${cleanMsg}`,
          isInternal: true
        }
      });

      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: log.id, data: log });
      broadcastRealtimeEvent({ entity: "technicianNote", action: "CREATE", id: note.id, data: note });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: repair.id, data: repair });

      res.json({ success: true, message: "Priority alert sent successfully to assigned technician.", log, note });
    } catch (err: any) {
      console.error("[REPAIR ALERT ERROR]", err);
      res.status(500).json({ error: "Failed to send repair alert." });
    }
  });

  // Repair Communication Notes API (Multi-role communication)
  app.get("/api/repairs/:id/notes", authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notes = await prisma.technicianNote.findMany({
        where: { repairId: id },
        include: { technician: { select: { id: true, name: true, role: true, profileImage: true } } },
        orderBy: { createdAt: "asc" }
      });
      res.json(notes);
    } catch (err: any) {
      console.error("[GET REPAIR NOTES ERROR]", err);
      res.status(500).json({ error: "Failed to fetch repair communication notes" });
    }
  });

  app.post("/api/repairs/:id/notes", authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { note, isInternal = true } = req.body;

      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Note content is required." });
      }

      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found." });
      }

      const newNote = await prisma.technicianNote.create({
        data: {
          repairId: id,
          technicianId: req.user.id,
          authorName: req.user.name || req.user.role,
          authorRole: req.user.role,
          note: note.trim(),
          isInternal: Boolean(isInternal)
        },
        include: { technician: { select: { id: true, name: true, role: true, profileImage: true } } }
      });

      // Notification rules:
      // If author is NOT the assigned technician and technician exists -> notify technician
      if (repair.technicianId && repair.technicianId !== req.user.id) {
        await sendSystemNotification({
          userId: repair.technicianId,
          title: "💬 New Repair Note",
          message: `[Job #${repair.repairNumber}] ${req.user.name || req.user.role}: "${note.trim()}"`,
          type: "NOTE_ADDED",
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name || req.user.role
        });
      }

      // If author IS the technician and createdBy exists and is different -> notify creator/receptionist
      if (req.user.role === 'TECHNICIAN' && repair.createdById && repair.createdById !== req.user.id) {
        await sendSystemNotification({
          userId: repair.createdById,
          title: "🔧 Technician Note Added",
          message: `[Job #${repair.repairNumber}] Specialist ${req.user.name}: "${note.trim()}"`,
          type: "NOTE_ADDED",
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name
        });
      }

      broadcastRealtimeEvent({ entity: "technicianNote", action: "CREATE", id: newNote.id, data: newNote });
      syncToFirestore('technicianNote', newNote).catch(() => {});

      res.status(201).json(newNote);
    } catch (err: any) {
      console.error("[ADD REPAIR NOTE ERROR]", err);
      res.status(500).json({ error: "Failed to add repair communication note." });
    }
  });

  // Repair Transfer Workflow: Request Transfer to another Technician
  app.post("/api/repairs/:id/transfer-request", authenticate, authorize(['TECHNICIAN', 'LEAD_TECHNICIAN', 'ADMIN', 'SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { targetTechnicianId, reason } = req.body;

      if (!targetTechnicianId) {
        return res.status(400).json({ error: "Target technician is required." });
      }

      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ error: "Please provide a clear reason for transferring this repair (minimum 3 characters)." });
      }

      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found." });
      }

      // Permission check: Technician can only transfer if assigned to them
      if (req.user.role === 'TECHNICIAN' && repair.technicianId !== req.user.id) {
        return res.status(403).json({ error: "You can only request transfer for repairs assigned to you." });
      }

      if (targetTechnicianId === req.user.id) {
        return res.status(400).json({ error: "You cannot transfer a repair to yourself." });
      }

      const targetTech = await prisma.user.findUnique({
        where: { id: targetTechnicianId }
      });

      if (!targetTech || !['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(targetTech.role) || targetTech.isActive === false) {
        return res.status(400).json({ error: "Selected target technician is invalid or inactive." });
      }

      // Check for existing pending transfer request on this repair
      const existingPending = await prisma.repairTransferRequest.findFirst({
        where: { repairId: id, status: 'PENDING' }
      });

      if (existingPending) {
        return res.status(400).json({ error: `A pending transfer request already exists for this repair (to ${existingPending.targetTechnicianName}).` });
      }

      const cleanReason = reason.trim();

      const transferRequest = await prisma.repairTransferRequest.create({
        data: {
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderTechnicianId: req.user.id,
          senderTechnicianName: req.user.name || req.user.role,
          targetTechnicianId: targetTech.id,
          targetTechnicianName: targetTech.name,
          reason: cleanReason,
          status: 'PENDING'
        }
      });

      // Log to repair activity trace
      const log = await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: repair.status,
          message: `🔄 Repair transfer requested from ${req.user.name} to ${targetTech.name}: "${cleanReason}"`
        }
      });

      // Send real-time notification to target technician
      await sendSystemNotification({
        userId: targetTech.id,
        title: "🔄 Repair Transfer Request",
        message: `Specialist ${req.user.name} requested to transfer repair #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}) to you. Reason: ${cleanReason}`,
        type: "TRANSFER_REQUEST",
        repairId: repair.id,
        repairNumber: repair.repairNumber,
        senderId: req.user.id,
        senderName: req.user.name,
        metadata: {
          transferRequestId: transferRequest.id,
          senderName: req.user.name,
          reason: cleanReason,
          deviceBrand: repair.deviceBrand,
          deviceModel: repair.deviceModel
        }
      });

      broadcastRealtimeEvent({ entity: "repairTransfer", action: "CREATE", id: transferRequest.id, data: transferRequest });
      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: log.id, data: log });
      syncToFirestore('repairTransferRequest', transferRequest).catch(() => {});

      res.status(201).json({ success: true, transferRequest });
    } catch (err: any) {
      console.error("[TRANSFER REQUEST ERROR]", err);
      res.status(500).json({ error: "Failed to create repair transfer request." });
    }
  });

  // Respond to Repair Transfer Request (Accept or Reject)
  app.post("/api/repair-transfers/:id/respond", authenticate, authorize(['TECHNICIAN', 'LEAD_TECHNICIAN', 'ADMIN', 'SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { action, responseNote } = req.body;

      if (!['ACCEPT', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'ACCEPT' or 'REJECT'." });
      }

      const transferRequest = await prisma.repairTransferRequest.findUnique({
        where: { id }
      });

      if (!transferRequest) {
        return res.status(404).json({ error: "Transfer request not found." });
      }

      if (transferRequest.status !== 'PENDING') {
        return res.status(400).json({ error: `This transfer request has already been ${transferRequest.status.toLowerCase()}.` });
      }

      // Permission check: Only designated target technician or admin can respond
      if (req.user.role === 'TECHNICIAN' && transferRequest.targetTechnicianId !== req.user.id) {
        return res.status(403).json({ error: "Only the designated target technician can accept or reject this transfer request." });
      }

      const repair = await prisma.repair.findUnique({
        where: { id: transferRequest.repairId }
      });

      if (!repair) {
        return res.status(404).json({ error: "Associated repair record not found." });
      }

      if (action === 'ACCEPT') {
        // Atomic transaction: update transfer status, update repair assignment, add repair log
        const [updatedTransfer, updatedRepair, newLog] = await prisma.$transaction(async (tx) => {
          const trans = await tx.repairTransferRequest.update({
            where: { id },
            data: {
              status: 'ACCEPTED',
              respondedAt: new Date(),
              responseNote: responseNote?.trim() || null
            }
          });

          const rep = await tx.repair.update({
            where: { id: transferRequest.repairId },
            data: {
              technicianId: transferRequest.targetTechnicianId,
              updatedAt: new Date()
            },
            include: {
              technician: { select: { id: true, name: true, role: true, email: true } },
              createdBy: { select: { id: true, name: true } },
              logs: { orderBy: { createdAt: 'desc' } }
            }
          });

          const log = await tx.repairLog.create({
            data: {
              repairId: transferRequest.repairId,
              status: rep.status,
              message: `✅ Repair transfer accepted by ${req.user.name}. Assigned specialist changed from ${transferRequest.senderTechnicianName} to ${req.user.name}.`
            }
          });

          return [trans, rep, log];
        });

        // Notify sender technician
        await sendSystemNotification({
          userId: transferRequest.senderTechnicianId,
          title: "✅ Repair Transfer Accepted",
          message: `Specialist ${req.user.name} accepted the transfer of repair #${transferRequest.repairNumber}.`,
          type: "TRANSFER_ACCEPTED",
          repairId: updatedRepair.id,
          repairNumber: updatedRepair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name
        });

        broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
        broadcastRealtimeEvent({ entity: "repairTransfer", action: "UPDATE", id: updatedTransfer.id, data: updatedTransfer });
        broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: newLog.id, data: newLog });

        syncToFirestore('repair', updatedRepair).catch(() => {});
        syncToFirestore('repairTransferRequest', updatedTransfer).catch(() => {});

        return res.json({ success: true, message: "Repair transfer accepted successfully.", repair: updatedRepair, transfer: updatedTransfer });
      } else {
        // REJECT workflow
        const updatedTransfer = await prisma.repairTransferRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            respondedAt: new Date(),
            responseNote: responseNote?.trim() || null
          }
        });

        const log = await prisma.repairLog.create({
          data: {
            repairId: transferRequest.repairId,
            status: repair.status,
            message: `❌ Repair transfer declined by ${req.user.name}${responseNote ? `: "${responseNote.trim()}"` : ''}. Repair remains assigned to ${transferRequest.senderTechnicianName}.`
          }
        });

        // Notify sender technician
        await sendSystemNotification({
          userId: transferRequest.senderTechnicianId,
          title: "❌ Repair Transfer Declined",
          message: `Specialist ${req.user.name} declined the transfer of repair #${transferRequest.repairNumber}${responseNote ? `: "${responseNote.trim()}"` : ''}.`,
          type: "TRANSFER_REJECTED",
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name
        });

        broadcastRealtimeEvent({ entity: "repairTransfer", action: "UPDATE", id: updatedTransfer.id, data: updatedTransfer });
        broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: log.id, data: log });
        syncToFirestore('repairTransferRequest', updatedTransfer).catch(() => {});

        return res.json({ success: true, message: "Repair transfer declined.", transfer: updatedTransfer });
      }
    } catch (err: any) {
      console.error("[TRANSFER RESPOND ERROR]", err);
      res.status(500).json({ error: "Failed to respond to repair transfer request." });
    }
  });

  // Get current user's repair transfer requests (incoming and outgoing)
  app.get("/api/repair-transfers/my-requests", authenticate, async (req: any, res) => {
    try {
      const incoming = await prisma.repairTransferRequest.findMany({
        where: { targetTechnicianId: req.user.id },
        orderBy: { createdAt: "desc" }
      });

      const outgoing = await prisma.repairTransferRequest.findMany({
        where: { senderTechnicianId: req.user.id },
        orderBy: { createdAt: "desc" }
      });

      const pendingIncomingCount = incoming.filter(t => t.status === 'PENDING').length;

      res.json({
        incoming,
        outgoing,
        pendingIncomingCount
      });
    } catch (err: any) {
      console.error("[GET MY TRANSFERS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch repair transfer requests." });
    }
  });

  // Admin on-demand status repair tool: scan and fix invalid/missing database statuses
  app.post("/api/access-requests/system-repair", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      console.log("[API REPAIR] Super Admin initiated on-demand status verify & repair...");
      await fixInvalidStatuses();
      res.json({ success: true, message: "Database statuses scanned, verified, and repaired successfully!" });
    } catch (err: any) {
      console.error("[API REPAIR ERROR]", err);
      res.status(500).json({ error: "Failed to run system status repair" });
    }
  });

  // Reset application status back to PENDING manually
  app.post("/api/access-requests/:id/reset-status", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;

    try {
      const request = await prisma.accessRequest.findUnique({
        where: { id }
      });

      if (!request) {
        return res.status(404).json({ error: "Access request not found" });
      }

      await prisma.accessRequest.update({
        where: { id },
        data: {
          status: "PENDING",
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null
        }
      });

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: request.email },
            { googleId: request.googleId }
          ]
        }
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountStatus: "PENDING",
            isActive: false
          }
        });
      }

      // Record audit history
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "RESET_ACCESS_STATUS",
          resource: "ACCESS_REQUEST",
          resourceId: id,
          details: `Reset access request and account status back to PENDING for ${request.email}`
        }
      });

      res.json({ success: true, message: `Access request and user status successfully reset to PENDING for ${request.email}.` });
    } catch (err: any) {
      console.error("[RESET STATUS ERROR]", err);
      res.status(500).json({ error: "Failed to reset access status to PENDING" });
    }
  });

  // Reset Google access request attempts and unblock
  app.post("/api/access-requests/:id/reset-attempts", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;

    try {
      // Find request first
      let request = await prisma.accessRequest.findUnique({
        where: { id }
      });

      let user = null;
      if (request) {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: request.email },
              { googleId: request.googleId }
            ]
          }
        });
      } else {
        user = await prisma.user.findUnique({
          where: { id }
        });
      }

      if (!user) {
        return res.status(404).json({ error: "Associated user account not found" });
      }

      // Reset fields
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          requestCount: 0,
          requestLimitReached: false,
          accountStatus: "PENDING"
        }
      });

      if (request) {
        await prisma.accessRequest.update({
          where: { id: request.id },
          data: {
            status: "PENDING",
            requestNumber: 0,
            totalRequests: 0
          }
        });
      }

      // Audit Log for unblock & reset
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "UNBLOCK_GOOGLE_ACCOUNT",
          resource: "USER",
          resourceId: user.id,
          details: `Unblocked and reset Google request count to 0 for ${user.email} (${user.googleId})`
        }
      });

      res.json({ 
        success: true, 
        message: `Successfully unblocked and reset attempts to 0 for ${user.email}.`,
        user: updatedUser
      });
    } catch (err: any) {
      console.error("[RESET ATTEMPTS ERROR]", err);
      res.status(500).json({ error: "Failed to reset request attempts" });
    }
  });

  // Auth Endpoints Helpers
  const generateTokens = async (
    user: any, 
    userAgent?: string, 
    ip?: string,
    deviceInfo?: {
      deviceIdentifier?: string;
      deviceName?: string;
      deviceType?: string;
      browser?: string;
      os?: string;
    }
  ) => {
    // Access token is short-lived (15 min); inactivity enforcement is via Session.lastActiveAt
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name }, 
      JWT_SECRET, 
      { expiresIn: "15m" }
    );
    const refreshToken = uuidv4();
    
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        // Hard expiry: 30 days (absolute session ceiling)
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: userAgent || null,
        ipAddress: ip || null,
        deviceIdentifier: deviceInfo?.deviceIdentifier || null,
        deviceName: deviceInfo?.deviceName || null,
        deviceType: deviceInfo?.deviceType || "DESKTOP",
        browser: deviceInfo?.browser || null,
        os: deviceInfo?.os || null,
        lastActiveAt: new Date()
      }
    });

    return { accessToken, refreshToken };
  };

  // Device Status Polling Endpoint (Used by PendingApproval page to automatically detect approval)
  app.all(["/api/auth/device-status"], async (req: any, res) => {
    const email = req.query.email || req.body.email;
    const deviceIdentifier = req.query.deviceIdentifier || req.body.deviceIdentifier;

    if (!email || !deviceIdentifier) {
      return res.status(400).json({ error: "Email and deviceIdentifier are required" });
    }

    try {
      const normalizedEmail = String(email).toLowerCase().trim();
      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail, deletedAt: null }
      });

      if (!user) {
        return res.json({ approved: false, pending: false, message: "User not found." });
      }

      // Check if device is approved
      const approvedDevice = await prisma.approvedDevice.findFirst({
        where: {
          userId: user.id,
          deviceIdentifier,
          status: "APPROVED"
        }
      });

      if (approvedDevice && (user.accountStatus === "APPROVED" || user.accountStatus === "ACTIVE") && user.isActive) {
        // Device is approved! Generate tokens
        const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
        const clientUserAgent = req.headers["user-agent"] || "";

        const { accessToken, refreshToken } = await generateTokens(
          user, 
          clientUserAgent, 
          String(clientIp),
          {
            deviceIdentifier: approvedDevice.deviceIdentifier,
            deviceName: approvedDevice.deviceName || undefined,
            deviceType: approvedDevice.deviceType || "DESKTOP",
            browser: approvedDevice.browser || undefined,
            os: approvedDevice.os || undefined
          }
        );

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Update lastUsedAt
        await prisma.approvedDevice.update({
          where: { id: approvedDevice.id },
          data: { lastUsedAt: new Date() }
        });

        return res.json({
          approved: true,
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            branchId: user.branchId,
            profileImage: user.profileImage || user.profilePhoto,
            phoneNumber: user.phoneNumber,
            department: user.department
          },
          token: accessToken,
          refreshToken
        });
      }

      // Check if request was rejected
      const latestRequest = await prisma.accessRequest.findFirst({
        where: {
          email: user.email,
          deviceIdentifier
        },
        orderBy: { createdAt: "desc" }
      });

      if (latestRequest?.status === "REJECTED") {
        return res.json({
          approved: false,
          rejected: true,
          message: "Your device access request was rejected by the MTS Super Administrator."
        });
      }

      return res.json({
        approved: false,
        pending: true,
        requestCount: user.requestCount,
        requestLimitReached: user.requestLimitReached,
        message: "Your access request is currently pending Super Admin review."
      });
    } catch (err: any) {
      console.error("[DEVICE STATUS ERROR]", err);
      res.status(500).json({ error: "Failed to check device status" });
    }
  });

  // Google Sign-In & Device Access Control Endpoint
  app.post("/api/auth/firebase", authLimiter, async (req: any, res) => {
    const { idToken, device } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: "No token provided" });

    try {
      let decodedToken: any = null;
      const auth = getAdminAuth();
      if (auth) {
        try {
          decodedToken = await auth.verifyIdToken(idToken);
        } catch (verifyErr) {
          console.warn("[FIREBASE AUTH] verifyIdToken check:", verifyErr);
        }
      }

      // Fallback: decode token from JWT payload or tokeninfo if admin verification threw
      if (!decodedToken) {
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
            if (payload && (payload.email || payload.sub || payload.user_id)) {
              decodedToken = {
                uid: payload.user_id || payload.sub || payload.uid,
                email: payload.email,
                name: payload.name || (payload.email ? payload.email.split("@")[0] : "User"),
                picture: payload.picture
              };
            }
          }
        } catch (jwtErr) {
          console.warn("[AUTH] Token parse fallback warning:", jwtErr);
        }
      }

      if (!decodedToken || !decodedToken.email) {
        return res.status(401).json({ success: false, message: "Invalid Google or Firebase token" });
      }

      const { email, name, picture, uid } = decodedToken;

      const normalizedEmail = email.toLowerCase().trim();
      const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
      const clientUserAgent = req.headers["user-agent"] || "";

      // Device info extraction
      const deviceIdentifier = device?.deviceIdentifier || req.headers["x-device-id"] || `dev_${uuidv4().substring(0, 8)}`;
      const deviceName = device?.deviceName || `${device?.browser || 'Browser'} on ${device?.os || 'Device'}`;
      const deviceType = device?.deviceType || "DESKTOP";
      const browser = device?.browser || "Browser";
      const os = device?.os || "OS";

      // 1. Look up existing user by firebaseUid, googleId, or normalized email
      let user = await prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { firebaseUid: uid },
            { googleId: uid },
            { email: normalizedEmail }
          ]
        }
      });

      if (!user) {
        // Brand new user: Create single user record at Attempt 1 in PENDING state
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: name || normalizedEmail.split("@")[0],
            password: await bcrypt.hash(uuidv4(), 10),
            role: "RECEPTIONIST", // Default provisional role awaiting admin assignment
            profileImage: picture || null,
            firebaseUid: uid,
            googleId: uid,
            profilePhoto: picture || null,
            authProvider: "GOOGLE",
            accountStatus: "PENDING",
            requestCount: 1,
            requestLimitReached: false,
            isActive: false,
            username: normalizedEmail.split("@")[0] + "_" + uid.slice(0, 4)
          }
        });

        // Create initial AccessRequest record for this new user & device
        await prisma.accessRequest.create({
          data: {
            userId: user.id,
            fullName: user.name,
            email: user.email,
            googleId: uid,
            profilePhoto: picture || null,
            deviceIdentifier,
            deviceName,
            deviceType,
            browser,
            os,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            requestedRole: "RECEPTIONIST",
            status: "PENDING",
            requestNumber: 1,
            totalRequests: 1
          }
        });

        // Record audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "GOOGLE_REQUEST_SUBMITTED",
            resource: "ACCESS_REQUEST",
            resourceId: user.id,
            details: `Google access request submitted for new user ${normalizedEmail} from ${deviceType} (${deviceName})`
          }
        });

        // Notify all Super Admins
        const superAdmins = await prisma.user.findMany({
          where: { role: "SUPER_ADMIN", deletedAt: null }
        });
        for (const adminUser of superAdmins) {
          await prisma.notification.create({
            data: {
              userId: adminUser.id,
              title: "New Google Access Request",
              message: `${user.name} (${user.email}) requested access from ${deviceType} (${deviceName}).`
            }
          });
        }

        return res.status(200).json({
          success: false,
          status: "NEW_PENDING",
          isNewDevice: true,
          email: user.email,
          deviceIdentifier,
          device: { deviceIdentifier, deviceName, deviceType, browser, os },
          requestCount: 1,
          requestLimitReached: false,
          message: "Your access request has been submitted to the Super Administrator for approval."
        });
      }

      // 2. User exists in MTS! Link firebaseUid, googleId, and photo if missing
      const userUpdates: any = {};
      if (!user.firebaseUid) userUpdates.firebaseUid = uid;
      if (!user.googleId) userUpdates.googleId = uid;
      if (!user.profileImage && picture) userUpdates.profileImage = picture;
      if (!user.profilePhoto && picture) userUpdates.profilePhoto = picture;
      if (user.authProvider === "LOCAL") userUpdates.authProvider = "GOOGLE_AND_LOCAL";

      if (Object.keys(userUpdates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: userUpdates
        });
      }

      // Check account status & active state
      const status = (user.accountStatus || "PENDING").toUpperCase().trim();
      if (!user.isActive || status === "DISABLED" || status === "INACTIVE" || status === "SUSPENDED") {
        return res.status(403).json({ 
          success: false, 
          message: "Your MTS account is deactivated or suspended. Please contact the Super Administrator." 
        });
      }

      // 3. Super Admin Fast-Path (Allow multi-device login without lockout deadlock)
      if (user.role === "SUPER_ADMIN") {
        // Auto-register / approve device for Super Admin
        await prisma.approvedDevice.upsert({
          where: {
            userId_deviceIdentifier: {
              userId: user.id,
              deviceIdentifier
            }
          },
          update: {
            status: "APPROVED",
            deviceName,
            deviceType,
            browser,
            os,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            lastUsedAt: new Date()
          },
          create: {
            userId: user.id,
            deviceIdentifier,
            deviceName,
            deviceType,
            browser,
            os,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            status: "APPROVED",
            approvedBy: "SYSTEM_SUPER_ADMIN",
            approvedAt: new Date(),
            lastUsedAt: new Date()
          }
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockoutUntil: null }
        });

        await prisma.loginActivity.create({
          data: {
            userId: user.id,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            deviceIdentifier,
            deviceName,
            deviceType,
            browser,
            os,
            status: "SUCCESS_GOOGLE_SUPERADMIN"
          }
        });

        const { accessToken, refreshToken } = await generateTokens(
          user, 
          clientUserAgent, 
          String(clientIp),
          { deviceIdentifier, deviceName, deviceType, browser, os }
        );

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            branchId: user.branchId,
            profileImage: user.profileImage || user.profilePhoto,
            phoneNumber: user.phoneNumber,
            department: user.department
          },
          token: accessToken,
          refreshToken
        });
      }

      // 4. For Other Staff Roles (Technicians, Receptionists, Admins, etc.)
      const approvedDevice = await prisma.approvedDevice.findFirst({
        where: {
          userId: user.id,
          deviceIdentifier,
          status: "APPROVED"
        }
      });

      // Case A: Device IS APPROVED and user account is ACTIVE/APPROVED
      if (approvedDevice && (status === "APPROVED" || status === "ACTIVE")) {
        await prisma.approvedDevice.update({
          where: { id: approvedDevice.id },
          data: { 
            lastUsedAt: new Date(), 
            ipAddress: String(clientIp), 
            userAgent: clientUserAgent,
            deviceName,
            browser,
            os
          }
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });

        await prisma.loginActivity.create({
          data: {
            userId: user.id,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            deviceIdentifier,
            deviceName,
            deviceType,
            browser,
            os,
            status: "SUCCESS_GOOGLE"
          }
        });

        const { accessToken, refreshToken } = await generateTokens(
          user, 
          clientUserAgent, 
          String(clientIp),
          { deviceIdentifier, deviceName, deviceType, browser, os }
        );

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            branchId: user.branchId,
            profileImage: user.profileImage || user.profilePhoto,
            phoneNumber: user.phoneNumber,
            department: user.department
          },
          token: accessToken,
          refreshToken
        });
      }

      // Case B: Device is NOT APPROVED (New Smartphone, Laptop, Tablet, Browser, or Revoked Device)
      const existingPending = await prisma.accessRequest.findFirst({
        where: {
          email: user.email,
          deviceIdentifier,
          status: "PENDING"
        }
      });

      if (existingPending) {
        return res.status(200).json({
          success: false,
          status: "PENDING",
          isNewDevice: true,
          email: user.email,
          deviceIdentifier,
          device: { deviceIdentifier, deviceName, deviceType, browser, os },
          requestCount: user.requestCount,
          requestLimitReached: user.requestLimitReached,
          message: "This device is awaiting approval from the MTS Super Administrator."
        });
      }

      // Check request limit count
      if (user.requestLimitReached || user.requestCount >= 3) {
        if (!user.requestLimitReached) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { requestLimitReached: true }
          });

          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: "GOOGLE_LIMIT_REACHED",
              resource: "USER",
              resourceId: user.id,
              details: `Device access request limit reached for ${user.email} on ${deviceType} (${deviceName})`
            }
          });
        }

        return res.status(403).json({
          success: false,
          status: "LIMIT_EXCEEDED",
          requestCount: user.requestCount,
          requestLimitReached: true,
          message: "Access request limit exceeded for this device. You have already submitted the maximum number of requests allowed. Please contact the Super Administrator."
        });
      }

      // Create a new AccessRequest for this new device (linked to user.id!)
      const nextCount = (user.requestCount || 0) + 1;
      const reached = nextCount >= 3;

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          requestCount: nextCount,
          requestLimitReached: reached
        }
      });

      await prisma.accessRequest.create({
        data: {
          userId: user.id,
          fullName: user.name,
          email: user.email,
          googleId: uid,
          profilePhoto: user.profileImage || picture || null,
          deviceIdentifier,
          deviceName,
          deviceType,
          browser,
          os,
          ipAddress: String(clientIp),
          userAgent: clientUserAgent,
          requestedRole: user.role || "RECEPTIONIST",
          status: "PENDING",
          requestNumber: nextCount,
          totalRequests: nextCount
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "NEW_DEVICE_ACCESS_REQUEST",
          resource: "ACCESS_REQUEST",
          resourceId: user.id,
          details: `New device access request (${deviceType}: ${deviceName}) submitted (Attempt ${nextCount}/3) for ${user.email}`
        }
      });

      const superAdmins = await prisma.user.findMany({
        where: { role: "SUPER_ADMIN", deletedAt: null }
      });
      for (const adminUser of superAdmins) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            title: "New Device Access Request",
            message: `${user.name} (${user.email}) requested access from a new ${deviceType} (${deviceName}).`
          }
        });
      }

      return res.status(200).json({
        success: false,
        status: "NEW_PENDING",
        isNewDevice: true,
        email: user.email,
        deviceIdentifier,
        device: { deviceIdentifier, deviceName, deviceType, browser, os },
        requestCount: nextCount,
        requestLimitReached: reached,
        message: `New device detected (${deviceName}). Access request has been submitted to the Super Administrator.`
      });

    } catch (err: any) {
      console.error("[FIREBASE AUTH ERROR]", err);
      res.status(401).json({ success: false, message: "Invalid Google / Firebase Authentication Token" });
    }
  });

  app.get("/api/auth/login", (req: any, res: any) => {
    if (req.accepts("html") && !req.xhr) {
      return res.redirect("/login");
    }
    return res.status(405).json({
      success: false,
      message: "GET method not allowed on login endpoint. Please use POST /api/auth/login instead.",
      error: "Method Not Allowed"
    });
  });

  app.post("/api/auth/login", authLimiter, async (req: any, res) => {
    const rawInputIdentity = req.body.identity || req.body.email || req.body.username;
    const { password, device, firebaseIdToken } = req.body;

    try {
      if (!rawInputIdentity || !password) {
        return res.status(400).json({ success: false, message: "Email/username and password are required." });
      }

      const rawIdentity = String(rawInputIdentity).trim();
      const lowerIdentity = rawIdentity.toLowerCase();
      const rawPassword = String(password);

      const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
      const clientUserAgent = req.headers["user-agent"] || "";

      // Device info extraction
      const deviceIdentifier = device?.deviceIdentifier || req.headers["x-device-id"] || `dev_${uuidv4().substring(0, 8)}`;
      const deviceName = device?.deviceName || `${device?.browser || 'Browser'} on ${device?.os || 'Device'}`;
      const deviceType = device?.deviceType || "DESKTOP";
      const browser = device?.browser || "Browser";
      const os = device?.os || "OS";

      // 1. Sync users from Firestore if needed
      try {
        await syncModelFromFirestore("user");
      } catch (syncErr) {
        console.warn("[LOGIN] Background sync user warning (proceeding with local db):", syncErr);
      }

      // 2. Query local SQLite user table
      let user = await prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { email: lowerIdentity },
            { email: rawIdentity },
            { username: rawIdentity },
            { username: lowerIdentity }
          ]
        }
      });

      // 3. Fallback: If not in local SQLite, query central Firestore users collection directly
      if (!user) {
        try {
          const db = getDb();
          let firestoreDoc: any = null;

          const snapLower = await db.collection("users").where("email", "==", lowerIdentity).limit(1).get();
          if (!snapLower.empty) {
            firestoreDoc = snapLower.docs[0];
          } else {
            const snapExact = await db.collection("users").where("email", "==", rawIdentity).limit(1).get();
            if (!snapExact.empty) {
              firestoreDoc = snapExact.docs[0];
            } else {
              const snapUser = await db.collection("users").where("username", "==", rawIdentity).limit(1).get();
              if (!snapUser.empty) {
                firestoreDoc = snapUser.docs[0];
              }
            }
          }

          if (firestoreDoc && firestoreDoc.exists) {
            const rawData = firestoreDoc.data();
            const data = deserializeFromFirestore("user", rawData);
            if (data && data.id) {
              // Ensure branch relation exists
              if (data.branchId) {
                const branchExists = await prisma.branch.findUnique({ where: { id: data.branchId } });
                if (!branchExists) {
                  const defaultBranch = await prisma.branch.findFirst();
                  data.branchId = defaultBranch ? defaultBranch.id : null;
                }
              }
              if (data.email) data.email = data.email.toLowerCase().trim();
              if (data.accountStatus === undefined) data.accountStatus = "ACTIVE";
              if (data.isActive === undefined) data.isActive = true;

              user = await prisma.user.upsert({
                where: { id: firestoreDoc.id },
                create: { ...data, id: firestoreDoc.id },
                update: data
              });
              console.log(`[LOGIN AUTH] Staff ${user.email} successfully fetched from Firestore to local storage.`);
            }
          }
        } catch (fsLookupErr) {
          console.warn("[LOGIN AUTH] Firestore user fallback query notice:", fsLookupErr);
        }
      }

      // 4. Distinguish Authentication Failure vs Profile/Status/Security Issues
      if (!user) {
        await recordAuditLog({
          req,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: `Login attempt failed: Identity '${rawIdentity}' not found`
        });
        return res.status(401).json({ success: false, message: "Unable to sign in with these credentials." });
      }

      // Check soft-delete
      if (user.deletedAt) {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "Login denied: Account is deleted"
        });
        return res.status(403).json({ success: false, message: "Your MTS account has been deleted. Please contact the administrator." });
      }

      // Strict account status check
      const accountStatus = (user.accountStatus || "ACTIVE").toUpperCase().trim();
      if (accountStatus === "PENDING") {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "Login denied: Account is pending administrator approval"
        });
        return res.status(403).json({ success: false, message: "Your MTS account is pending administrator approval." });
      }
      if (accountStatus === "REJECTED") {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "Login denied: Access rejected by administrator"
        });
        return res.status(403).json({ success: false, message: "Your MTS account access has been rejected by administrator." });
      }
      if (accountStatus === "DISABLED" || accountStatus === "INACTIVE" || !user.isActive) {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "Login denied: Account is deactivated"
        });
        return res.status(403).json({ success: false, message: "Your MTS account has been deactivated. Please contact the Super Administrator." });
      }
      if (accountStatus === "SUSPENDED") {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "Login denied: Account is suspended"
        });
        return res.status(403).json({ success: false, message: "Your MTS account has been suspended. Please contact the Super Administrator." });
      }

      // Check lockout status
      if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
        const remainingMins = Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / 60000);
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: `Login locked: ${remainingMins} minute(s) remaining`
        });
        return res.status(423).json({ 
          success: false, 
          message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${remainingMins} minute(s).` 
        });
      }

      // Password comparison via bcrypt
      const isValid = await bcrypt.compare(rawPassword, user.password);

      if (!isValid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const isLockedNow = attempts >= 5;
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            failedLoginAttempts: attempts,
            lockoutUntil: isLockedNow ? new Date(Date.now() + 15 * 60 * 1000) : null
          }
        });
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: `Invalid password attempt (${attempts}/5)`
        });
        return res.status(401).json({ success: false, message: "Unable to sign in with these credentials." });
      }

      // Firebase is the required first factor for all non-superadmin users.
      // The local MTS password is validated first so a failed login cannot
      // provision or mutate any Firebase identity.
      if (user.role !== "SUPER_ADMIN") {
        const fbCheck = await checkFirebaseUserEmailVerified(user.email, rawPassword, firebaseIdToken, user.firebaseUid);
        const firebaseIdentityMatches = Boolean(
          fbCheck.checked &&
          fbCheck.firebaseUid &&
          fbCheck.email &&
          fbCheck.email.toLowerCase().trim() === user.email.toLowerCase().trim() &&
          (!user.firebaseUid || fbCheck.firebaseUid === user.firebaseUid)
        );

        if (!firebaseIdentityMatches) {
          // Legacy local accounts are migrated only after the local password
          // has already passed lockout and bcrypt validation above. The new
          // Firebase account remains unverified, so access stays blocked until
          // Firebase confirms ownership of the email address.
          const provisioned = await ensureFirebaseUserAndSendVerification(user.email, rawPassword, user.name);
          if (provisioned.sent || provisioned.errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
            markFirebaseVerificationAttempt(user.email);
          }
          if (provisioned.firebaseUid) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { firebaseUid: provisioned.firebaseUid, emailVerified: false }
            });
            await syncUserToFirestore(user).catch(() => {});
            await syncToRtdb("user", "UPDATE", user).catch(() => {});
            return res.status(403).json({
              success: false,
              emailNotVerified: true,
              firebaseProvisioned: true,
              email: user.email,
              message: provisioned.sent
                ? "A Firebase verification email has been sent. Please verify your email address before continuing."
                : "Your account has been linked to Firebase. Please request a new verification email before continuing."
            });
          }

          return res.status(401).json({
            success: false,
            message: "Unable to authenticate with Firebase credentials. Please contact the administrator if your staff account has not been provisioned in Firebase."
          });
        }

        if (fbCheck.firebaseUid && !user.firebaseUid) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid: fbCheck.firebaseUid }
          });
        }

        if (fbCheck.isVerified && !user.emailVerified) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true }
          });
          await syncUserToFirestore(user).catch(() => {});
          await syncToRtdb("user", "UPDATE", user).catch(() => {});
          broadcastRealtimeEvent({
            entity: "user",
            action: "UPDATE",
            id: user.id,
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              emailVerified: true
            }
          });
        }

        if (!fbCheck.isVerified) {
          return res.status(403).json({
            success: false,
            emailNotVerified: true,
            email: user.email,
            message: "Please verify your email address before continuing."
          });
        }
      }

      // 5. Password Validated! Check authoritative per-user Two-Factor Authentication (2FA) setting
      const is2faActive = isUser2FAEnabled(user);

      // If 2FA is DISABLED for this user by Super Admin, log in directly without OTP
      if (!is2faActive) {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { 
            failedLoginAttempts: 0, 
            lockoutUntil: null, 
            lastLoginAt: new Date() 
          }
        });

        // Seamless Multi-Device Registration
        await prisma.approvedDevice.upsert({
          where: {
            userId_deviceIdentifier: {
              userId: user.id,
              deviceIdentifier
            }
          },
          update: {
            deviceName,
            deviceType,
            browser,
            os,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            status: "APPROVED",
            lastUsedAt: new Date()
          },
          create: {
            userId: user.id,
            deviceIdentifier,
            deviceName,
            deviceType,
            browser,
            os,
            ipAddress: String(clientIp),
            userAgent: clientUserAgent,
            status: "APPROVED",
            approvedBy: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "DIRECT_LOGIN",
            approvedAt: new Date(),
            lastUsedAt: new Date()
          }
        });

        // Generate Authenticated Tokens
        const { accessToken, refreshToken } = await generateTokens(
          updatedUser, 
          clientUserAgent, 
          String(clientIp),
          { deviceIdentifier, deviceName, deviceType, browser, os }
        );

        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "LOGIN_SUCCESS",
          resource: "AUTH",
          status: "SUCCESS",
          details: `Direct password login (2FA disabled) from ${deviceType} (${deviceName})`
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
          success: true,
          token: accessToken,
          refreshToken,
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            username: updatedUser.username,
            branchId: updatedUser.branchId,
            profileImage: updatedUser.profileImage,
            twoFactorEnabled: updatedUser.twoFactorEnabled
          },
          mfaRequired: false
        });
      }

      // 2FA IS ENABLED: Initiate Mandatory Email 2FA (Two-Factor Authentication)
      // Invalidate any active previous unused OTP for this user & purpose
      await prisma.oTPVerification.updateMany({
        where: {
          userId: user.id,
          purpose: "LOGIN_2FA",
          isUsed: false
        },
        data: { isUsed: true }
      });

      // Generate cryptographically secure 6-digit OTP
      const otpCode = generate6DigitOtp();
      const otpHash = hashOtp(otpCode);
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

      const createdOtp = await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash: otpHash,
          purpose: "LOGIN_2FA",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: otpExpiresAt,
          isUsed: false
        }
      });

      // Dispatch 6-digit Email Verification Code (OTP) to registered email address (NO links)
      const emailSubject = "MTS Lab — Your Login Verification Code";
      const emailText = `Hello ${user.name || 'Staff Member'},\n\nYour MTS Lab verification code is:\n\n   ${otpCode}\n\nThis code will expire in 5 minutes.\n\nIf you did not attempt to log in to MTS Lab, please ignore this email and secure your account.`;
      const emailHtml = generate2faEmailHtml(user.name, otpCode);

      const emailResult = await sendEmail({
        to: user.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      });

      if (!emailResult.success) {
        await prisma.oTPVerification.delete({ where: { id: createdOtp.id } }).catch(() => {});
        return res.status(503).json({
          success: false,
          message: "Unable to send verification code to your email. Please check your email configuration or try again later."
        });
      }

      // Create short-lived 2FA Challenge Ticket (JWT)
      const mfaTicket = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          purpose: "LOGIN_2FA",
          type: "MFA_CHALLENGE",
          deviceIdentifier,
          deviceName,
          deviceType,
          browser,
          os
        },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "OTP_REQUESTED",
        resource: "AUTH",
        status: "SUCCESS",
        details: `2FA login verification code dispatched to email (${maskEmail(user.email)})`
      });

      return res.json({
        success: true,
        mfaRequired: true,
        mfaTicket,
        emailMasked: maskEmail(user.email),
        message: "Verification code sent to your registered email."
      });

    } catch (err: any) {
      console.error("[LOGIN API UNCAUGHT ERROR]", err);
      res.status(500).json({ 
        success: false, 
        message: "Authentication service temporarily unavailable. Please try again.",
        error: err.message || String(err)
      });
    }
  });

  // 2FA Verification Endpoint
  app.post("/api/auth/2fa/verify", authLimiter, async (req: any, res) => {
    const { mfaTicket, code, device } = req.body;

    try {
      if (!mfaTicket || !code) {
        return res.status(400).json({ success: false, message: "Verification code and security ticket are required." });
      }

      let decoded: any = null;
      try {
        decoded = jwt.verify(mfaTicket, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Verification session has expired. Please log in again." });
      }

      if (!decoded || decoded.type !== "MFA_CHALLENGE" || decoded.purpose !== "LOGIN_2FA" || !decoded.userId) {
        return res.status(401).json({ success: false, message: "Invalid verification security ticket." });
      }

      const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
      const clientUserAgent = req.headers["user-agent"] || "";

      // Device info extraction
      const deviceIdentifier = device?.deviceIdentifier || decoded.deviceIdentifier || req.headers["x-device-id"] || `dev_${uuidv4().substring(0, 8)}`;
      const deviceName = device?.deviceName || decoded.deviceName || `${device?.browser || 'Browser'} on ${device?.os || 'Device'}`;
      const deviceType = device?.deviceType || decoded.deviceType || "DESKTOP";
      const browser = device?.browser || decoded.browser || "Browser";
      const os = device?.os || decoded.os || "OS";

      // Query User
      const user = await prisma.user.findFirst({
        where: { id: decoded.userId, deletedAt: null }
      });

      if (!user) {
        return res.status(401).json({ success: false, message: "User account not found." });
      }

      // Check account status
      const accountStatus = (user.accountStatus || "ACTIVE").toUpperCase().trim();
      if (!user.isActive || accountStatus === "DISABLED" || accountStatus === "SUSPENDED" || accountStatus === "REJECTED") {
        return res.status(403).json({ success: false, message: "Account is not active." });
      }

      // Find active OTP record
      const otpRecord = await prisma.oTPVerification.findFirst({
        where: {
          userId: user.id,
          purpose: "LOGIN_2FA",
          isUsed: false
        },
        orderBy: { createdAt: "desc" }
      });

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: "No active verification code found. Please request a new code." });
      }

      // Check expiration
      if (otpRecord.expiresAt < new Date()) {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "OTP_VERIFICATION_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "2FA OTP code expired"
        });
        return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new code." });
      }

      // Check attempt limit
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        await prisma.oTPVerification.update({
          where: { id: otpRecord.id },
          data: { isUsed: true }
        });
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "OTP_VERIFICATION_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: "Maximum failed 2FA OTP attempts reached"
        });
        return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new verification code." });
      }

      // Validate OTP Code Hash
      const isValid = verifyOtp(String(code).trim(), otpRecord.codeHash);
      if (!isValid) {
        const nextAttempts = otpRecord.attempts + 1;
        const isMaxReached = nextAttempts >= otpRecord.maxAttempts;
        await prisma.oTPVerification.update({
          where: { id: otpRecord.id },
          data: {
            attempts: nextAttempts,
            isUsed: isMaxReached
          }
        });
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "OTP_VERIFICATION_FAILED",
          resource: "AUTH",
          status: "FAILED",
          details: `Invalid 2FA OTP code entered (${otpRecord.maxAttempts - nextAttempts} attempts remaining)`
        });
        return res.status(400).json({ 
          success: false, 
          message: `Invalid verification code. ${Math.max(0, otpRecord.maxAttempts - nextAttempts)} attempt(s) remaining.` 
        });
      }

      // 6. OTP Validated Successfully! Mark OTP as used
      await prisma.oTPVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      });

      // Reset failed attempts & update last login timestamp
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedLoginAttempts: 0, 
          lockoutUntil: null, 
          lastLoginAt: new Date() 
        }
      });

      // Seamless Multi-Device Registration
      await prisma.approvedDevice.upsert({
        where: {
          userId_deviceIdentifier: {
            userId: user.id,
            deviceIdentifier
          }
        },
        update: {
          deviceName,
          deviceType,
          browser,
          os,
          ipAddress: String(clientIp),
          userAgent: clientUserAgent,
          status: "APPROVED",
          lastUsedAt: new Date()
        },
        create: {
          userId: user.id,
          deviceIdentifier,
          deviceName,
          deviceType,
          browser,
          os,
          ipAddress: String(clientIp),
          userAgent: clientUserAgent,
          status: "APPROVED",
          approvedBy: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "STAFF_2FA",
          approvedAt: new Date(),
          lastUsedAt: new Date()
        }
      });

      // Generate Authenticated Tokens
      const { accessToken, refreshToken } = await generateTokens(
        updatedUser, 
        clientUserAgent, 
        String(clientIp),
        { deviceIdentifier, deviceName, deviceType, browser, os }
      );

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "OTP_VERIFICATION_SUCCESS",
        resource: "AUTH",
        status: "SUCCESS",
        details: "2FA OTP code verified successfully"
      });

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "LOGIN_SUCCESS",
        resource: "AUTH",
        status: "SUCCESS",
        details: `Successful authenticated login via email 2FA from ${deviceType} (${deviceName})`
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({ 
        success: true, 
        token: accessToken, 
        refreshToken: refreshToken, 
        user: { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          name: updatedUser.name, 
          role: updatedUser.role, 
          username: updatedUser.username, 
          profileImage: updatedUser.profileImage || updatedUser.profilePhoto, 
          phoneNumber: updatedUser.phoneNumber, 
          department: updatedUser.department, 
          address: updatedUser.address, 
          branchId: updatedUser.branchId,
          accountStatus: updatedUser.accountStatus,
          isActive: updatedUser.isActive
        } 
      });

    } catch (err: any) {
      console.error("[2FA VERIFY ERROR]", err);
      res.status(500).json({ success: false, message: "Verification failed. Please try again." });
    }
  });

  // 2FA Resend Endpoint
  app.post("/api/auth/2fa/resend", authLimiter, async (req: any, res) => {
    const { mfaTicket } = req.body;

    try {
      if (!mfaTicket) {
        return res.status(400).json({ success: false, message: "Security ticket is required." });
      }

      let decoded: any = null;
      try {
        decoded = jwt.verify(mfaTicket, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Verification session has expired. Please sign in again." });
      }

      if (!decoded || decoded.purpose !== "LOGIN_2FA" || !decoded.userId) {
        return res.status(401).json({ success: false, message: "Invalid verification ticket." });
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || user.deletedAt || !user.isActive) {
        return res.status(401).json({ success: false, message: "User account not active." });
      }

      // Check Rate Limit (minimum 60 seconds between resends)
      const lastOtp = await prisma.oTPVerification.findFirst({
        where: {
          userId: user.id,
          purpose: "LOGIN_2FA"
        },
        orderBy: { createdAt: "desc" }
      });

      if (lastOtp) {
        const timeSinceLast = Date.now() - new Date(lastOtp.createdAt).getTime();
        if (timeSinceLast < 60 * 1000) {
          const waitSecs = Math.ceil((60 * 1000 - timeSinceLast) / 1000);
          return res.status(429).json({ 
            success: false, 
            message: `Please wait ${waitSecs} second(s) before requesting a new code.` 
          });
        }
      }

      // Invalidate existing unused OTPs
      await prisma.oTPVerification.updateMany({
        where: {
          userId: user.id,
          purpose: "LOGIN_2FA",
          isUsed: false
        },
        data: { isUsed: true }
      });

      // Generate new OTP with 5 minute expiration
      const otpCode = generate6DigitOtp();
      const otpHash = hashOtp(otpCode);

      const createdResendOtp = await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash: otpHash,
          purpose: "LOGIN_2FA",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          isUsed: false
        }
      });

      // Dispatch new 6-digit OTP code to registered email address (NO links)
      const resendSubject = "MTS Lab — Your Login Verification Code";
      const resendText = `Hello ${user.name || 'Staff Member'},\n\nYour new MTS Lab verification code is:\n\n   ${otpCode}\n\nThis code will expire in 5 minutes.\n\nIf you did not attempt to log in to MTS Lab, please ignore this email and secure your account.`;
      const resendHtml = generate2faEmailHtml(user.name, otpCode);

      const emailResult = await sendEmail({
        to: user.email,
        subject: resendSubject,
        text: resendText,
        html: resendHtml
      });

      if (!emailResult.success) {
        await prisma.oTPVerification.delete({ where: { id: createdResendOtp.id } }).catch(() => {});
        return res.status(503).json({
          success: false,
          message: "Unable to send verification code to your email. Please try again later."
        });
      }

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "OTP_REQUESTED",
        resource: "AUTH",
        status: "SUCCESS",
        details: "New 2FA login verification code requested & sent"
      });

      return res.json({ 
        success: true, 
        message: "A new verification code has been sent to your registered email." 
      });

    } catch (err: any) {
      console.error("[2FA RESEND ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to resend verification code. Please try again." });
    }
  });

  // Password Change with Mandatory Email OTP
  app.post("/api/auth/password-change/request", authenticate, authLimiter, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Current password and new password are required." });
      }

      // Password Complexity Validation
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
      }
      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ success: false, message: "Password must include uppercase, lowercase, and numeric characters." });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || user.deletedAt) {
        return res.status(404).json({ success: false, message: "User account not found." });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "PASSWORD_CHANGED",
          resource: "AUTH",
          status: "FAILED",
          details: "Password change rejected: Incorrect current password"
        });
        return res.status(400).json({ success: false, message: "Invalid current password." });
      }

      // Invalidate existing password change OTPs
      await prisma.oTPVerification.updateMany({
        where: {
          userId: user.id,
          purpose: "PASSWORD_CHANGE",
          isUsed: false
        },
        data: { isUsed: true }
      });

      // Generate OTP with 5 minute expiration
      const otpCode = generate6DigitOtp();
      const otpHash = hashOtp(otpCode);

      const createdPwdOtp = await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash: otpHash,
          purpose: "PASSWORD_CHANGE",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          isUsed: false
        }
      });

      // Dispatch Email
      const emailResult = await sendEmail(
        user.email,
        "MTS Lab Security — Password Change Verification Code",
        `Hello ${user.name},\n\nYou requested to change your MTS Lab password.\n\nYour 6-digit verification code is:\n\n   ${otpCode}\n\nThis code will expire in 5 minutes.\nIf you did not request a password change, please contact the Super Administrator immediately.`
      );

      if (!emailResult.success) {
        await prisma.oTPVerification.delete({ where: { id: createdPwdOtp.id } }).catch(() => {});
        return res.status(503).json({
          success: false,
          message: "Unable to send verification code to your email. Please try again later."
        });
      }

      // Sign temporary pwdTicket containing hashed new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      const pwdTicket = jwt.sign(
        {
          userId: user.id,
          newPasswordHash,
          purpose: "PASSWORD_CHANGE"
        },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "OTP_REQUESTED",
        resource: "AUTH",
        status: "SUCCESS",
        details: "Password change verification OTP sent to email"
      });

      return res.json({
        success: true,
        pwdTicket,
        emailMasked: maskEmail(user.email),
        message: "Verification code sent to your registered email."
      });

    } catch (err: any) {
      console.error("[PASSWORD CHANGE REQUEST ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to initiate password change. Please try again." });
    }
  });

  // Password Change Confirmation Endpoint
  app.post("/api/auth/password-change/confirm", authenticate, authLimiter, async (req: any, res) => {
    const { pwdTicket, code } = req.body;

    try {
      if (!pwdTicket || !code) {
        return res.status(400).json({ success: false, message: "Verification code and security ticket are required." });
      }

      let decoded: any = null;
      try {
        decoded = jwt.verify(pwdTicket, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Password change session expired. Please try again." });
      }

      if (!decoded || decoded.purpose !== "PASSWORD_CHANGE" || decoded.userId !== req.user.id || !decoded.newPasswordHash) {
        return res.status(401).json({ success: false, message: "Invalid password change session." });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || user.deletedAt) {
        return res.status(404).json({ success: false, message: "User account not found." });
      }

      // Check OTP
      const otpRecord = await prisma.oTPVerification.findFirst({
        where: {
          userId: user.id,
          purpose: "PASSWORD_CHANGE",
          isUsed: false
        },
        orderBy: { createdAt: "desc" }
      });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: "Verification code expired or invalid. Please request a new code." });
      }

      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        await prisma.oTPVerification.update({ where: { id: otpRecord.id }, data: { isUsed: true } });
        return res.status(429).json({ success: false, message: "Too many failed verification attempts." });
      }

      const isValid = verifyOtp(String(code).trim(), otpRecord.codeHash);
      if (!isValid) {
        const nextAttempts = otpRecord.attempts + 1;
        await prisma.oTPVerification.update({
          where: { id: otpRecord.id },
          data: {
            attempts: nextAttempts,
            isUsed: nextAttempts >= otpRecord.maxAttempts
          }
        });
        return res.status(400).json({ 
          success: false, 
          message: `Invalid verification code. ${Math.max(0, otpRecord.maxAttempts - nextAttempts)} attempt(s) remaining.` 
        });
      }

      // Mark OTP as used
      await prisma.oTPVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      });

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: decoded.newPasswordHash,
          failedLoginAttempts: 0,
          lockoutUntil: null
        }
      });

      // Invalidate all sessions
      await prisma.session.deleteMany({ where: { userId: user.id } });
      res.clearCookie("refreshToken");

      // Update Firebase Auth if linked
      if (user.firebaseUid) {
        try {
          const auth = getAdminAuth();
          if (auth) {
            await auth.updateUser(user.firebaseUid, { password: uuidv4() });
          }
        } catch (fbErr) {
          // non-blocking
        }
      }

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "PASSWORD_CHANGED",
        resource: "USER",
        resourceId: user.id,
        status: "SUCCESS",
        details: `Password updated successfully via email OTP verification. All active sessions revoked.`
      });

      return res.json({ 
        success: true, 
        message: "Password updated successfully. Please log in with your new password." 
      });

    } catch (err: any) {
      console.error("[PASSWORD CHANGE CONFIRM ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to update password. Please try again." });
    }
  });

  // Legacy Change Password route adapter for existing dashboard forms
  app.post("/api/auth/change-password", authenticate, async (req: any, res) => {
    const { currentPassword, newPassword, code, pwdTicket } = req.body;
    
    // If client supplied confirmation code and ticket, confirm directly
    if (pwdTicket && code) {
      req.body = { pwdTicket, code };
      // Forward to confirmation handler
      try {
        let decoded: any = jwt.verify(pwdTicket, JWT_SECRET);
        if (decoded && decoded.userId === req.user.id) {
          const otpRecord = await prisma.oTPVerification.findFirst({
            where: { userId: req.user.id, purpose: "PASSWORD_CHANGE", isUsed: false },
            orderBy: { createdAt: "desc" }
          });
          if (otpRecord && verifyOtp(String(code).trim(), otpRecord.codeHash)) {
            await prisma.oTPVerification.update({ where: { id: otpRecord.id }, data: { isUsed: true } });
            await prisma.user.update({ where: { id: req.user.id }, data: { password: decoded.newPasswordHash } });
            await prisma.session.deleteMany({ where: { userId: req.user.id } });
            res.clearCookie("refreshToken");
            await recordAuditLog({
              req,
              userId: req.user.id,
              action: "PASSWORD_CHANGED",
              resource: "USER",
              resourceId: req.user.id,
              status: "SUCCESS",
              details: "Password updated successfully"
            });
            return res.json({ success: true, message: "Password updated successfully. Please login again." });
          }
        }
      } catch (err) {}
      return res.status(400).json({ error: "Invalid verification code or session expired" });
    }

    // Otherwise, validate current password and initiate OTP flow
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: "Invalid current password" });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    const otpCode = generate6DigitOtp();
    const otpHash = hashOtp(otpCode);

    await prisma.oTPVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        codeHash: otpHash,
        purpose: "PASSWORD_CHANGE",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        isUsed: false
      }
    });

    await sendEmail(
      user.email,
      "MTS Lab Security — Password Change Code",
      `Your password change verification code is: ${otpCode}`
    );

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const newPwdTicket = jwt.sign(
      { userId: user.id, newPasswordHash, purpose: "PASSWORD_CHANGE" },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    res.json({ 
      success: true, 
      requiresOtp: true, 
      pwdTicket: newPwdTicket, 
      message: "Verification code sent to your registered email." 
    });
  });

  // Super Admin Email Change Endpoints (Step 1: Request from Current Email)
  app.post("/api/admin/change-email/request", authenticate, authorize(['SUPER_ADMIN']), authLimiter, async (req: any, res) => {
    const { currentPassword } = req.body;

    try {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: "Current password is required." });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(404).json({ success: false, message: "Super Admin account not found." });

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "EMAIL_CHANGE_REQUESTED",
          resource: "USER",
          resourceId: user.id,
          status: "FAILED",
          details: "Email change rejected: Incorrect password"
        });
        return res.status(400).json({ success: false, message: "Invalid current password." });
      }

      // Invalidate existing email change OTPs
      await prisma.oTPVerification.updateMany({
        where: {
          userId: user.id,
          purpose: { in: ["EMAIL_CHANGE_CURRENT", "EMAIL_CHANGE_NEW"] },
          isUsed: false
        },
        data: { isUsed: true }
      });

      // Generate OTP for current email
      const otpCode = generate6DigitOtp();
      const otpHash = hashOtp(otpCode);

      await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash: otpHash,
          purpose: "EMAIL_CHANGE_CURRENT",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          isUsed: false
        }
      });

      await sendEmail(
        user.email,
        "MTS Lab Security — Super Admin Email Change Verification",
        `Hello ${user.name},\n\nYou requested to change the Super Admin email address.\n\nStep 1 Verification Code (Current Email):\n\n   ${otpCode}\n\nThis code will expire in 10 minutes.\nIf you did not initiate this request, contact the system administrator immediately.`
      );

      const currentTicket = jwt.sign(
        { userId: user.id, email: user.email, purpose: "EMAIL_CHANGE_CURRENT" },
        JWT_SECRET,
        { expiresIn: "10m" }
      );

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "OTP_REQUESTED",
        resource: "USER",
        resourceId: user.id,
        status: "SUCCESS",
        details: `Super Admin email change Step 1 OTP sent to current email (${maskEmail(user.email)})`
      });

      return res.json({
        success: true,
        currentTicket,
        emailMasked: maskEmail(user.email),
        message: "Verification code sent to your current registered email."
      });

    } catch (err: any) {
      console.error("[CHANGE EMAIL REQUEST ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to initiate email change." });
    }
  });

  // Super Admin Email Change (Step 2: Verify Current OTP & Send Code to New Email)
  app.post("/api/admin/change-email/verify-current", authenticate, authorize(['SUPER_ADMIN']), authLimiter, async (req: any, res) => {
    const { currentTicket, code, newEmail } = req.body;

    try {
      if (!currentTicket || !code || !newEmail) {
        return res.status(400).json({ success: false, message: "Current security ticket, code, and new email are required." });
      }

      const normalizedNewEmail = String(newEmail).toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedNewEmail)) {
        return res.status(400).json({ success: false, message: "Please provide a valid new email address." });
      }

      let decoded: any = null;
      try {
        decoded = jwt.verify(currentTicket, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Verification session expired. Please start again." });
      }

      if (!decoded || decoded.purpose !== "EMAIL_CHANGE_CURRENT" || decoded.userId !== req.user.id) {
        return res.status(401).json({ success: false, message: "Invalid verification session." });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      if (user.email.toLowerCase() === normalizedNewEmail) {
        return res.status(400).json({ success: false, message: "New email cannot be identical to current email." });
      }

      // Check if new email is already taken
      const existingUser = await prisma.user.findFirst({
        where: { email: normalizedNewEmail, id: { not: user.id }, deletedAt: null }
      });
      if (existingUser) {
        return res.status(400).json({ success: false, message: "This email address is already in use by another account." });
      }

      // Verify OTP on current email
      const otpRecord = await prisma.oTPVerification.findFirst({
        where: {
          userId: user.id,
          purpose: "EMAIL_CHANGE_CURRENT",
          isUsed: false
        },
        orderBy: { createdAt: "desc" }
      });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: "Current email verification code has expired." });
      }

      const isValid = verifyOtp(String(code).trim(), otpRecord.codeHash);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Invalid verification code for current email." });
      }

      // Mark current OTP as used
      await prisma.oTPVerification.update({ where: { id: otpRecord.id }, data: { isUsed: true } });

      // Generate OTP for NEW email
      const newOtpCode = generate6DigitOtp();
      const newOtpHash = hashOtp(newOtpCode);

      await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: normalizedNewEmail,
          codeHash: newOtpHash,
          purpose: "EMAIL_CHANGE_NEW",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isUsed: false
        }
      });

      // Dispatch verification code to NEW email address
      await sendEmail(
        normalizedNewEmail,
        "MTS Lab Security — Confirm Your New Super Admin Email",
        `Hello ${user.name},\n\nYou are confirming this address as the new primary Super Admin email for MTS Lab.\n\nStep 2 Confirmation Code:\n\n   ${newOtpCode}\n\nThis code will expire in 15 minutes.\nIf you did not authorize this, please disregard.`
      );

      const newEmailTicket = jwt.sign(
        { userId: user.id, oldEmail: user.email, newEmail: normalizedNewEmail, purpose: "EMAIL_CHANGE_NEW" },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "EMAIL_CHANGE_REQUESTED",
        resource: "USER",
        resourceId: user.id,
        status: "SUCCESS",
        details: `Step 1 verified. Confirmation OTP sent to new email: ${normalizedNewEmail}`
      });

      return res.json({
        success: true,
        newEmailTicket,
        newEmail: normalizedNewEmail,
        message: `Verification code sent to ${normalizedNewEmail}. Please enter the code to confirm.`
      });

    } catch (err: any) {
      console.error("[VERIFY CURRENT EMAIL ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to verify current email." });
    }
  });

  // Super Admin Email Change (Step 3: Confirm NEW Email OTP & Update Authoritative Records)
  app.post("/api/admin/change-email/confirm", authenticate, authorize(['SUPER_ADMIN']), authLimiter, async (req: any, res) => {
    const { newEmailTicket, code } = req.body;

    try {
      if (!newEmailTicket || !code) {
        return res.status(400).json({ success: false, message: "Confirmation code and security ticket are required." });
      }

      let decoded: any = null;
      try {
        decoded = jwt.verify(newEmailTicket, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Confirmation session expired. Please start again." });
      }

      if (!decoded || decoded.purpose !== "EMAIL_CHANGE_NEW" || decoded.userId !== req.user.id || !decoded.newEmail) {
        return res.status(401).json({ success: false, message: "Invalid confirmation session." });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      const newEmail = decoded.newEmail;

      // Verify OTP on NEW email
      const otpRecord = await prisma.oTPVerification.findFirst({
        where: {
          userId: user.id,
          email: newEmail,
          purpose: "EMAIL_CHANGE_NEW",
          isUsed: false
        },
        orderBy: { createdAt: "desc" }
      });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: "Verification code for new email has expired." });
      }

      const isValid = verifyOtp(String(code).trim(), otpRecord.codeHash);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Invalid verification code for new email." });
      }

      // Mark OTP as used
      await prisma.oTPVerification.update({ where: { id: otpRecord.id }, data: { isUsed: true } });

      const oldEmail = user.email;

      // Update SQLite user record
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: newEmail,
          emailChangePending: null,
          emailChangeCodeHash: null,
          emailChangeExpiresAt: null
        }
      });

      // Update Firebase Auth if linked
      try {
        const auth = getAdminAuth();
        if (auth) {
          if (user.firebaseUid) {
            await auth.updateUser(user.firebaseUid, { email: newEmail, emailVerified: true });
          } else {
            const fbUser = await auth.getUserByEmail(oldEmail).catch(() => null);
            if (fbUser) {
              await auth.updateUser(fbUser.uid, { email: newEmail, emailVerified: true });
            }
          }
        }
      } catch (fbErr) {
        console.warn("[CHANGE EMAIL] Firebase Auth update notice:", fbErr);
      }

      // Sync updated user to Firestore
      await syncUserToFirestore(updatedUser);

      // Invalidate all active sessions to enforce fresh login with new email
      await prisma.session.deleteMany({ where: { userId: user.id } });
      res.clearCookie("refreshToken");

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: newEmail,
        userName: user.name,
        userRole: user.role,
        action: "EMAIL_CHANGED",
        resource: "USER",
        resourceId: user.id,
        status: "SUCCESS",
        previousValue: oldEmail,
        newValue: newEmail,
        details: `Primary Super Admin email successfully changed from ${oldEmail} to ${newEmail}. All sessions revoked.`
      });

      return res.json({
        success: true,
        newEmail,
        message: "Super Admin email successfully changed. All sessions revoked. Please log in with your new email."
      });

    } catch (err: any) {
      console.error("[CONFIRM EMAIL CHANGE ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to finalize email change." });
    }
  });

  // Paginated Activity & Security Audit Logs for Super Admin
  app.get("/api/admin/audit-logs", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const { search, userId, role, action, resource, status, startDate, endDate } = req.query as any;

      const where: any = {};

      if (userId && typeof userId === "string" && userId.trim()) {
        where.userId = userId.trim();
      }

      if (role && typeof role === "string" && role.trim() && role !== "ALL") {
        where.userRole = role.trim();
      }

      if (action && typeof action === "string" && action.trim() && action !== "ALL") {
        where.action = action.trim();
      }

      if (resource && typeof resource === "string" && resource.trim() && resource !== "ALL") {
        where.resource = resource.trim();
      }

      if (status && typeof status === "string" && status.trim() && status !== "ALL") {
        where.status = status.trim();
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      if (search && typeof search === "string" && search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        where.OR = [
          { action: { contains: search.trim() } },
          { details: { contains: search.trim() } },
          { userEmail: { contains: search.trim() } },
          { userName: { contains: search.trim() } },
          { resource: { contains: search.trim() } },
          { resourceId: { contains: search.trim() } },
          { ipAddress: { contains: search.trim() } }
        ];
      }

      const total = await prisma.auditLog.count({ where });
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              profileImage: true
            }
          }
        }
      });

      res.json({
        success: true,
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit
      });

    } catch (err: any) {
      console.error("[AUDIT LOGS FETCH ERROR]", err);
      res.status(500).json({ success: false, error: "Failed to fetch audit logs" });
    }
  });

  // Session Token Refresh Endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    let refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"];
    }

    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    let targetUser: any = null;

    if (refreshToken) {
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true }
      });

      if (session && session.user && session.expiresAt >= new Date()) {
        targetUser = session.user;
        await prisma.session.update({
          where: { id: session.id },
          data: { lastActiveAt: new Date() }
        }).catch(() => {});
      }
    }

    // Fallback: If session was lost on server restart, check if authorization token has valid JWT signature
    if (!targetUser && bearerToken) {
      try {
        const decoded: any = jwt.verify(bearerToken, JWT_SECRET, { ignoreExpiration: true });
        if (decoded && decoded.id) {
          const user = await prisma.user.findFirst({
            where: { id: decoded.id, deletedAt: null }
          });
          if (user && (user.accountStatus === "ACTIVE" || user.accountStatus === "APPROVED") && user.isActive) {
            targetUser = user;
            if (!refreshToken) refreshToken = uuidv4();
            await prisma.session.create({
              data: {
                userId: user.id,
                refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastActiveAt: new Date()
              }
            }).catch(() => {});
          }
        }
      } catch (jwtErr) {
        console.warn("[REFRESH] JWT decode fallback failed:", jwtErr);
      }
    }

    if (!targetUser) {
      return res.status(401).json({ error: "Session expired. Please login again." });
    }

    // Check user account status
    const status = (targetUser.accountStatus || "ACTIVE").toUpperCase().trim();
    if (!targetUser.isActive || status === "DISABLED" || status === "SUSPENDED" || status === "REJECTED") {
      return res.status(403).json({ error: "Account is not active." });
    }

    const accessToken = jwt.sign(
      { id: targetUser.id, role: targetUser.role, email: targetUser.email, name: targetUser.name }, 
      JWT_SECRET, 
      { expiresIn: "7d" }
    );

    if (!refreshToken) {
      refreshToken = uuidv4();
    }

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({ 
      token: accessToken, 
      refreshToken,
      user: { 
        id: targetUser.id, 
        email: targetUser.email, 
        name: targetUser.name, 
        role: targetUser.role, 
        username: targetUser.username, 
        profileImage: targetUser.profileImage || targetUser.profilePhoto, 
        phoneNumber: targetUser.phoneNumber, 
        department: targetUser.department, 
        address: targetUser.address, 
        branchId: targetUser.branchId,
        accountStatus: targetUser.accountStatus,
        isActive: targetUser.isActive
      } 
    });
  });

  // Logout Endpoint
  app.post("/api/auth/logout", async (req: any, res) => {
    let refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"];
    }

    if (refreshToken) {
      await prisma.session.delete({ where: { refreshToken } }).catch(() => {});
    }

    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  });

  // Logout All Sessions Endpoint
  app.post("/api/auth/logout-all", authenticate, async (req: any, res) => {
    await prisma.session.deleteMany({
      where: { userId: req.user.id }
    });
    res.clearCookie("refreshToken");

    await recordAuditLog({
      req,
      userId: req.user.id,
      action: "LOGOUT",
      resource: "AUTH",
      status: "SUCCESS",
      details: "All active sessions revoked by user"
    });

    res.json({ success: true, message: "All sessions terminated successfully" });
  });

  // Resend Official Firebase Email Verification Link Endpoint
  app.post("/api/auth/resend-verification", authLimiter, async (req: any, res) => {
    const { email, firebaseIdToken, password } = req.body;
    try {
      if (!email) {
        return res.status(400).json({ success: false, message: "Email address is required." });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail, deletedAt: null }
      });

      if (!user) {
        return res.json({
          success: true,
          message: "If an unverified account matches that email, a verification link has been sent."
        });
      }

      // Recovery path for a page that lost its Firebase browser session. The
      // local password must validate before Firebase sign-in/provisioning is
      // attempted; this path never grants access or marks the account verified.
      if (!firebaseIdToken && password) {
        const localPasswordValid = await bcrypt.compare(String(password), user.password);
        if (!localPasswordValid) {
          return res.status(401).json({ success: false, message: "Unable to resend verification email with these credentials." });
        }

        const firebaseState = await checkFirebaseUserEmailVerified(user.email, String(password), undefined, user.firebaseUid);
        if (firebaseState.checked && firebaseState.firebaseUid && firebaseState.isVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, ...(user.firebaseUid ? {} : { firebaseUid: firebaseState.firebaseUid }) }
          });
          return res.json({ success: true, emailVerified: true, message: "Your email address is already verified." });
        }

        const recoveryCooldownSeconds = getFirebaseVerificationCooldownSeconds(normalizedEmail);
        if (recoveryCooldownSeconds > 0) {
          res.setHeader('Retry-After', String(recoveryCooldownSeconds));
          return res.status(429).json({
            success: false,
            code: 'FIREBASE_VERIFICATION_COOLDOWN',
            message: 'A verification email was requested recently. Please wait before requesting another one.'
          });
        }

        const provisioned = await ensureFirebaseUserAndSendVerification(user.email, String(password), user.name);
        if (provisioned.firebaseUid) {
          await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid: provisioned.firebaseUid, emailVerified: false }
          });
        }
        if (provisioned.sent || provisioned.errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
          markFirebaseVerificationAttempt(normalizedEmail);
        }
        if (provisioned.sent) {
          await recordAuditLog({
            req,
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            userRole: user.role,
            action: "EMAIL_VERIFICATION_SENT",
            resource: "AUTH",
            status: "SUCCESS",
            details: `Firebase verification email dispatched to ${maskEmail(user.email)} through password-authenticated recovery`
          });
          return res.json({ success: true, message: "Verification email sent through Firebase. Please check your Gmail inbox and spam folder." });
        }
        if (provisioned.firebaseUid || provisioned.errorCode) {
          const providerCode = provisioned.errorCode || "FIREBASE_VERIFICATION_UNAVAILABLE";
          const providerStatus = providerCode === "TOO_MANY_ATTEMPTS_TRY_LATER"
            ? 429
            : providerCode === "INVALID_ID_TOKEN" || providerCode === "TOKEN_EXPIRED"
              ? 401
              : 503;
          return res.status(providerStatus).json({
            success: false,
            code: providerCode,
            message: providerStatus === 429
              ? "Firebase has temporarily rate-limited verification emails. Please wait before trying again."
              : providerStatus === 401
                ? "Your Firebase session or credentials could not be confirmed. Please sign in again and try again."
                : "Firebase could not send the verification email yet. Please wait and try again later."
          });
        }
      }

      if (user.emailVerified && !firebaseIdToken && !user.firebaseUid) {
        return res.status(503).json({
          success: false,
          code: "FIREBASE_VERIFICATION_REQUIRED",
          message: "Firebase must confirm this account before the verification status can be trusted. Please sign in again or contact the administrator."
        });
      }

      if (user.emailVerified) {
        const firebaseState = await checkFirebaseUserEmailVerified(user.email, undefined, firebaseIdToken, user.firebaseUid);
        if (firebaseState.checked && firebaseState.isVerified) {
          return res.json({ success: true, emailVerified: true, message: "Your email address is already verified." });
        }
        if (!firebaseState.checked) {
          return res.status(503).json({
            success: false,
            code: "FIREBASE_VERIFICATION_REQUIRED",
            message: "Firebase could not confirm the current verification state. Please sign in again or contact the administrator."
          });
        }
      }

      // Re-check the provider state immediately before applying cooldown/send
      // logic so a recently verified Firebase account is never sent another
      // verification email and is not incorrectly shown a cooldown error.
      if (firebaseIdToken) {
        const liveFirebaseState = await checkFirebaseUserEmailVerified(user.email, undefined, firebaseIdToken, user.firebaseUid);
        const liveIdentityMatches = Boolean(
          liveFirebaseState.checked &&
          liveFirebaseState.firebaseUid &&
          liveFirebaseState.email &&
          liveFirebaseState.email.toLowerCase().trim() === normalizedEmail &&
          (!user.firebaseUid || liveFirebaseState.firebaseUid === user.firebaseUid)
        );
        if (!liveIdentityMatches) {
          return res.status(401).json({
            success: false,
            code: 'INVALID_ID_TOKEN',
            message: 'Your Firebase session has expired. Please sign in again before requesting a verification email.'
          });
        }
        if (liveFirebaseState.isVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, ...(user.firebaseUid ? {} : { firebaseUid: liveFirebaseState.firebaseUid }) }
          });
          return res.json({ success: true, emailVerified: true, message: "Your email address is already verified." });
        }
      }

      const tokenResendCooldownSeconds = getFirebaseVerificationCooldownSeconds(normalizedEmail);
      if (tokenResendCooldownSeconds > 0) {
        res.setHeader('Retry-After', String(tokenResendCooldownSeconds));
        return res.status(429).json({
          success: false,
          code: 'FIREBASE_VERIFICATION_COOLDOWN',
          message: 'A verification email was requested recently. Please wait before requesting another one.'
        });
      }

      const firebaseVerification = await sendFirebaseVerificationEmailWithIdToken(firebaseIdToken, normalizedEmail);

      if (firebaseVerification.alreadyVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            ...(firebaseVerification.firebaseUid && !user.firebaseUid ? { firebaseUid: firebaseVerification.firebaseUid } : {})
          }
        });
        return res.json({ success: true, emailVerified: true, message: "Your email address is already verified." });
      }

      if (firebaseVerification.sent || firebaseVerification.errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        markFirebaseVerificationAttempt(normalizedEmail);
      }

      if (firebaseVerification.sent) {
        if (firebaseVerification.firebaseUid && !user.firebaseUid) {
          await prisma.user.update({ where: { id: user.id }, data: { firebaseUid: firebaseVerification.firebaseUid } });
        }
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "EMAIL_VERIFICATION_SENT",
          resource: "AUTH",
          status: "SUCCESS",
          details: `Firebase verification email dispatched to ${maskEmail(user.email)}`
        });
        return res.json({
          success: true,
          message: "Verification email sent through Firebase. Please check your Gmail inbox and spam folder."
        });
      }

      const firebaseErrorCode = firebaseVerification.errorCode || "FIREBASE_VERIFICATION_UNAVAILABLE";
      const firebaseErrorStatus = firebaseErrorCode === "TOO_MANY_ATTEMPTS_TRY_LATER"
        ? 429
        : firebaseErrorCode === "INVALID_ID_TOKEN" || firebaseErrorCode === "TOKEN_EXPIRED"
          ? 401
          : 503;
      return res.status(firebaseErrorStatus).json({
        success: false,
        code: firebaseErrorCode,
        message: firebaseErrorStatus === 429
          ? "Firebase has temporarily rate-limited verification emails. Please wait before trying again."
          : firebaseErrorStatus === 401
            ? "Your Firebase session has expired. Please sign in again before requesting a verification email."
            : "Firebase could not send the verification email. Please sign in again to refresh your Firebase session or contact the administrator."
      });
    } catch (err: any) {
      console.error("[RESEND VERIFICATION ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
    }
  });

  // Verify Email Status Endpoint (Real-Time Check & Multi-Database Synchronization)
  app.post("/api/auth/verify-email-status", authLimiter, async (req: any, res) => {
    const { email, password, firebaseIdToken, firebaseUid, oobCode } = req.body;
    try {
      if (!email && !firebaseIdToken && !firebaseUid && !oobCode) {
        return res.status(400).json({ success: false, message: "Email, Firebase UID, Firebase ID Token, or verification code is required." });
      }

      // A direct Firebase action code is authoritative only after Firebase
      // consumes it successfully. Never treat a redirect query parameter as proof.
      const actionCheck = await applyFirebaseEmailVerificationCode(oobCode);
      const effectiveFirebaseUid = actionCheck.firebaseUid || firebaseUid;
      let normalizedEmail = (actionCheck.email || email)?.toString().toLowerCase().trim() || null;
      let user = null;

      if (effectiveFirebaseUid) {
        user = await prisma.user.findFirst({
          where: { firebaseUid: effectiveFirebaseUid, deletedAt: null }
        });
      }

      if (!user && normalizedEmail) {
        user = await prisma.user.findFirst({
          where: { email: normalizedEmail, deletedAt: null }
        });
      }

      // Check current Firebase state using the verified action result, ID token,
      // or Firebase email/password result. A client-side query flag is ignored.
      const fbCheck = actionCheck.checked
        ? actionCheck
        : await checkFirebaseUserEmailVerified(normalizedEmail || user?.email, password, firebaseIdToken, effectiveFirebaseUid || user?.firebaseUid);
      
      if (!user && fbCheck.email) {
        normalizedEmail = fbCheck.email;
        user = await prisma.user.findFirst({
          where: { email: normalizedEmail, deletedAt: null }
        });
      }

      if (!user) {
        return res.status(404).json({ success: false, message: "User account not found." });
      }

      const firebaseIdentityMatches = Boolean(
        fbCheck.checked &&
        fbCheck.email &&
        fbCheck.email.toLowerCase().trim() === user.email.toLowerCase().trim() &&
        (!user.firebaseUid || !fbCheck.firebaseUid || fbCheck.firebaseUid === user.firebaseUid)
      );
      if (fbCheck.checked && !firebaseIdentityMatches) {
        return res.status(401).json({ success: false, message: "Firebase verification does not match this MTS account." });
      }

      if (firebaseIdentityMatches && fbCheck.firebaseUid && !user.firebaseUid) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: fbCheck.firebaseUid }
        });
      }

      if (firebaseIdentityMatches && fbCheck.isVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            ...(fbCheck.firebaseUid && !user.firebaseUid ? { firebaseUid: fbCheck.firebaseUid } : {})
          }
        });

        // 1. Sync to central Firestore
        await syncUserToFirestore(user).catch((e) => console.warn("[FIRESTORE VERIFY SYNC ERROR]", e?.message));

        // 2. Sync to Firebase Realtime Database (RTDB)
        await syncToRtdb("user", "UPDATE", user).catch((e) => console.warn("[RTDB VERIFY SYNC ERROR]", e?.message));

        // 3. Broadcast real-time SSE event to all active sessions & dashboards
        broadcastRealtimeEvent({
          entity: "user",
          action: "UPDATE",
          id: user.id,
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: true,
            accountStatus: user.accountStatus,
            isActive: user.isActive
          }
        });

        // 4. Centralized Audit Log
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "EMAIL_VERIFIED",
          resource: "USER",
          resourceId: user.id,
          status: "SUCCESS",
          details: `Firebase email verification synchronized to central database for ${user.email}`
        }).catch(() => {});

        return res.json({ 
          success: true, 
          emailVerified: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: true
          }
        });
      }

      if (user.emailVerified) {
        // Ensure RTDB has the latest verified state
        await syncToRtdb("user", "UPDATE", user).catch(() => {});
        return res.json({ 
          success: true, 
          emailVerified: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: true
          }
        });
      }

      return res.json({ 
        success: true, 
        emailVerified: false,
        message: "Email has not been verified in Firebase Authentication yet."
      });
    } catch (err: any) {
      console.error("[VERIFY STATUS ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to check email verification status. Please try again." });
    }
  });

  // Forgot Password / Password Reset Flow
  app.post("/api/auth/forgot-password", authLimiter, async (req: any, res) => {
    const { email } = req.body;
    try {
      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ success: false, message: "Email address is required." });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
      }

      // 1. Check local SQLite user table
      let user = await prisma.user.findFirst({
        where: { email: normalizedEmail, deletedAt: null }
      });

      // 2. Fallback check to central Firestore
      if (!user) {
        try {
          const firestore = getDb();
          const snap = await firestore.collection("users")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();

          if (!snap.empty) {
            const fsDoc = snap.docs[0];
            const fsData = fsDoc.data();
            if (!fsData.deletedAt) {
              user = await prisma.user.upsert({
                where: { email: normalizedEmail },
                create: {
                  id: fsDoc.id,
                  email: normalizedEmail,
                  name: fsData.name || "MTS Staff",
                  username: fsData.username || normalizedEmail.split("@")[0],
                  password: fsData.password || "",
                  role: fsData.role || "TECHNICIAN",
                  accountStatus: fsData.accountStatus || "ACTIVE",
                  isActive: fsData.isActive !== false,
                  emailVerified: fsData.emailVerified !== false,
                  twoFactorEnabled: fsData.twoFactorEnabled === true
                },
                update: {
                  name: fsData.name || undefined,
                  accountStatus: fsData.accountStatus || undefined,
                  isActive: fsData.isActive !== false,
                  emailVerified: fsData.emailVerified !== false
                }
              });
            }
          }
        } catch (fsErr) {
          console.warn("[FORGOT PASSWORD] Firestore fallback check notice:", fsErr);
        }
      }

      // 3. Reject unregistered or deleted emails immediately
      if (!user || user.deletedAt) {
        await recordAuditLog({
          req,
          action: "PASSWORD_RESET_REJECTED",
          resource: "AUTH",
          status: "FAILED",
          details: `Password recovery rejected: Unregistered email '${normalizedEmail}'`
        });
        return res.status(404).json({
          success: false,
          message: "This email is not registered with MTS Lab. Please enter your registered email address."
        });
      }

      // 4. Reject inactive / suspended / disabled / pending accounts
      if (!user.isActive || user.accountStatus === "DISABLED" || user.accountStatus === "SUSPENDED" || user.accountStatus === "REJECTED" || user.accountStatus === "PENDING") {
        await recordAuditLog({
          req,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
          action: "PASSWORD_RESET_DENIED",
          resource: "AUTH",
          status: "FAILED",
          details: `Password recovery denied: Account status is ${user.accountStatus} (isActive=${user.isActive})`
        });
        return res.status(403).json({
          success: false,
          message: "Your MTS account is not active. Please contact the Super Administrator."
        });
      }

      // 5. Invalidate previous unused password reset OTPs for this user
      await prisma.oTPVerification.updateMany({
        where: { userId: user.id, purpose: "PASSWORD_RESET", isUsed: false },
        data: { isUsed: true }
      });

      // 6. Generate cryptographically secure 6-digit OTP
      const otpCode = generate6DigitOtp();
      const otpHash = hashOtp(otpCode);

      await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash: otpHash,
          purpose: "PASSWORD_RESET",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiration
          isUsed: false
        }
      });

      // 7. Dispatch recovery email ONLY to the registered user's email on file
      await sendEmail({
        to: user.email,
        subject: "MTS Lab Security — Password Reset Verification Code",
        body: `Hello ${user.name},\n\nYou requested a password reset for your MTS Lab account.\n\nYour 6-digit verification code is:\n\n   ${otpCode}\n\nThis code will expire in 15 minutes.\nIf you did not request this password reset, please contact the Super Administrator immediately.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #f8fafc; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 48px; height: 48px; background-color: #0f172a; border-radius: 12px; line-height: 48px; color: #ffffff; font-size: 24px; font-weight: bold;">M</div>
              <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">MTS Lab Security</h2>
              <p style="color: #64748b; margin: 0; font-size: 13px; font-weight: 500;">Password Recovery Request</p>
            </div>
            <div style="background-color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <h3 style="color: #1e293b; margin-top: 0; font-size: 18px; font-weight: 700;">Account Password Reset</h3>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 16px 0;">
                Hello <strong>${user.name}</strong>,<br/><br/>
                We received a request to reset your password for your MTS Lab account. Enter the verification code below on the recovery screen:
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <div style="display: inline-block; padding: 16px 36px; background-color: #0f172a; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; border-radius: 14px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2); font-family: monospace;">
                  ${otpCode}
                </div>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">
                ⏱️ This code expires in <strong>15 minutes</strong> and is valid for a single use.
              </p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
                If you did not request a password reset, please contact the Super Administrator immediately.
              </div>
            </div>
          </div>
        `
      });

      const resetTicket = jwt.sign(
        { userId: user.id, email: user.email, purpose: "PASSWORD_RESET" },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "PASSWORD_RESET_REQUESTED",
        resource: "AUTH",
        status: "SUCCESS",
        details: `Password reset OTP dispatched to registered email (${maskEmail(user.email)})`
      });

      return res.json({
        success: true,
        resetTicket,
        emailMasked: maskEmail(user.email),
        message: "Verification code sent to your registered email."
      });

    } catch (err: any) {
      console.error("[FORGOT PASSWORD ERROR]", err);
      res.status(500).json({ success: false, message: "Failed to process password reset request." });
    }
  });

  // Verify Password Reset OTP
  app.post("/api/auth/verify-otp", authLimiter, async (req: any, res) => {
    const { resetTicket, email, code } = req.body;

    try {
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ success: false, error: "Verification code is required." });
      }

      let userId: string | null = null;
      let userEmail: string | null = null;

      if (resetTicket) {
        try {
          const decoded: any = jwt.verify(resetTicket, JWT_SECRET);
          if (decoded && decoded.purpose === "PASSWORD_RESET" && decoded.userId) {
            userId = decoded.userId;
            userEmail = decoded.email;
          }
        } catch (jwtErr) {
          return res.status(400).json({ success: false, error: "Verification session has expired. Please request a new code." });
        }
      }

      if (!userId && email) {
        const u = await prisma.user.findFirst({
          where: { email: String(email).toLowerCase().trim(), deletedAt: null }
        });
        if (u) {
          userId = u.id;
          userEmail = u.email;
        }
      }

      if (!userId) {
        return res.status(400).json({ success: false, error: "Invalid or expired recovery session. Please request a new code." });
      }

      const otpRecord = await prisma.oTPVerification.findFirst({
        where: {
          userId,
          purpose: "PASSWORD_RESET",
          isUsed: false
        },
        orderBy: { createdAt: "desc" }
      });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return res.status(400).json({ success: false, error: "Verification code has expired. Please request a new code." });
      }

      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        await prisma.oTPVerification.update({ where: { id: otpRecord.id }, data: { isUsed: true } });
        return res.status(429).json({ success: false, error: "Too many failed attempts. Please request a new code." });
      }

      const isValid = verifyOtp(String(code).trim(), otpRecord.codeHash);
      if (!isValid) {
        const nextAttempts = otpRecord.attempts + 1;
        await prisma.oTPVerification.update({
          where: { id: otpRecord.id },
          data: { attempts: nextAttempts, isUsed: nextAttempts >= otpRecord.maxAttempts }
        });
        return res.status(400).json({ 
          success: false, 
          error: `Invalid verification code. ${Math.max(0, otpRecord.maxAttempts - nextAttempts)} attempt(s) remaining.` 
        });
      }

      // Mark OTP as used (single-use)
      await prisma.oTPVerification.update({ where: { id: otpRecord.id }, data: { isUsed: true } });

      const resetToken = uuidv4();
      await prisma.passwordResetToken.create({
        data: {
          userId,
          token: resetToken,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        }
      });

      await recordAuditLog({
        req,
        userId,
        userEmail,
        action: "PASSWORD_RESET_OTP_VERIFIED",
        resource: "AUTH",
        status: "SUCCESS",
        details: "Password reset OTP successfully verified."
      });

      res.json({ success: true, resetToken, message: "Code verified successfully." });

    } catch (err: any) {
      console.error("[VERIFY OTP ERROR]", err);
      res.status(500).json({ success: false, error: "Verification failed. Please try again." });
    }
  });

  // Complete Password Reset
  app.post("/api/auth/reset-password", authLimiter, async (req: any, res) => {
    const { resetToken, newPassword } = req.body;

    try {
      if (!resetToken || !newPassword) {
        return res.status(400).json({ success: false, error: "Reset token and new password are required." });
      }

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: "Password must be at least 8 characters long." });
      }

      const rt = await prisma.passwordResetToken.findUnique({
        where: { token: resetToken },
        include: { user: true }
      });

      if (!rt || rt.expiresAt < new Date()) {
        return res.status(400).json({ success: false, error: "Reset session is invalid or has expired. Please start over." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await prisma.user.update({
        where: { id: rt.userId },
        data: {
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockoutUntil: null
        }
      });

      // Synchronize updated password to central Firestore
      await syncUserToFirestore(updatedUser).catch((e) => console.warn("[FIRESTORE PASSWORD SYNC ERROR]", e?.message));

      // Single-use: delete reset token immediately
      await prisma.passwordResetToken.delete({ where: { id: rt.id } }).catch(() => {});

      // Invalidate all active sessions for this user across all devices
      await prisma.session.deleteMany({ where: { userId: rt.userId } });

      await recordAuditLog({
        req,
        userId: rt.userId,
        userEmail: rt.user.email,
        userName: rt.user.name,
        userRole: rt.user.role,
        action: "PASSWORD_RESET_COMPLETED",
        resource: "USER",
        resourceId: rt.userId,
        status: "SUCCESS",
        details: "Password reset completed successfully. All previous sessions terminated."
      });

      res.json({ success: true, message: "Password reset successful. Please login with your new password." });

    } catch (err: any) {
      console.error("[RESET PASSWORD ERROR]", err);
      res.status(500).json({ success: false, error: "Failed to reset password. Please try again." });
    }
  });

  app.get("/api/auth/activity", authenticate, async (req: any, res) => {
    const activity = await prisma.loginActivity.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(activity);
  });

  app.get("/api/auth/sessions", authenticate, async (req: any, res) => {
    const refreshToken = req.cookies.refreshToken || req.headers["x-refresh-token"];
    const sessions = await prisma.session.findMany({
      where: { 
        userId: req.user.id,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        deviceIdentifier: true,
        deviceName: true,
        deviceType: true,
        browser: true,
        os: true,
        ipAddress: true,
        userAgent: true,
        lastActiveAt: true,
        createdAt: true,
        expiresAt: true,
        refreshToken: true
      },
      orderBy: { lastActiveAt: "desc" }
    });

    const formattedSessions = sessions.map(s => ({
      id: s.id,
      deviceIdentifier: s.deviceIdentifier,
      deviceName: s.deviceName,
      deviceType: s.deviceType,
      browser: s.browser,
      os: s.os,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: refreshToken ? s.refreshToken === refreshToken : false
    }));

    res.json(formattedSessions);
  });

  app.delete("/api/auth/sessions/:id", authenticate, async (req: any, res) => {
    const { id } = req.params;
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user.id }
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    await prisma.session.delete({ where: { id } });
    res.json({ message: "Session revoked successfully" });
  });

  app.delete("/api/auth/sessions-revoke-other", authenticate, async (req: any, res) => {
    const currentRefreshToken = req.cookies.refreshToken || req.headers["x-refresh-token"];
    
    if (currentRefreshToken) {
      await prisma.session.deleteMany({
        where: {
          userId: req.user.id,
          refreshToken: { not: currentRefreshToken }
        }
      });
    } else {
      await prisma.session.deleteMany({
        where: { userId: req.user.id }
      });
    }

    res.json({ message: "All other sessions have been revoked." });
  });

  // Admin Staff Multi-Device Session Management Endpoints
  app.get("/api/admin/staff-sessions", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          expiresAt: { gt: new Date() },
          user: { deletedAt: null }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              accountStatus: true,
              isActive: true,
              profileImage: true,
              profilePhoto: true,
              branch: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: { lastActiveAt: "desc" }
      });

      const formatted = sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        userName: s.user?.name,
        userEmail: s.user?.email,
        userRole: s.user?.role,
        userStatus: s.user?.accountStatus,
        branchName: s.user?.branch?.name || "Main Lab",
        profileImage: s.user?.profileImage || s.user?.profilePhoto,
        deviceIdentifier: s.deviceIdentifier,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
      }));

      res.json(formatted);
    } catch (err: any) {
      console.error("[ADMIN SESSIONS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch staff sessions" });
    }
  });

  app.delete("/api/admin/staff-sessions/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const session = await prisma.session.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await prisma.session.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "REVOKE_STAFF_SESSION",
          resource: "SESSION",
          resourceId: id,
          details: `Admin ${req.user.id} terminated session for user ${session.user.email} (${session.deviceName || session.deviceType})`
        }
      });

      res.json({ message: `Session for ${session.user.name || session.user.email} terminated successfully.` });
    } catch (err: any) {
      console.error("[ADMIN REVOKE SESSION ERROR]", err);
      res.status(500).json({ error: "Failed to revoke session" });
    }
  });

  app.delete("/api/admin/staff-sessions/user/:userId", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const count = await prisma.session.deleteMany({
        where: { userId }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "REVOKE_ALL_STAFF_SESSIONS",
          resource: "SESSION",
          resourceId: userId,
          details: `Admin ${req.user.id} terminated all ${count.count} sessions for user ${user.email}`
        }
      });

      res.json({ message: `Terminated ${count.count} active session(s) for ${user.name || user.email}.` });
    } catch (err: any) {
      console.error("[ADMIN REVOKE USER SESSIONS ERROR]", err);
      res.status(500).json({ error: "Failed to revoke user sessions" });
    }
  });

  app.get("/api/admin/login-activities", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const activities = await prisma.loginActivity.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              accountStatus: true
            }
          }
        }
      });

      res.json(activities);
    } catch (err: any) {
      console.error("[ADMIN LOGIN ACTIVITIES ERROR]", err);
      res.status(500).json({ error: "Failed to fetch login activities" });
    }
  });

  app.get("/api/auth/me", authenticate, syncRouteMiddleware(['user', 'branch']), async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id, deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          branchId: true,
          profileImage: true,
          phoneNumber: true,
          department: true,
          address: true,
          accountStatus: true,
          isActive: true,
          twoFactorEnabled: true
        }
      });
      if (!user || !user.isActive || (user.accountStatus !== "ACTIVE" && user.accountStatus !== "APPROVED")) {
        return res.status(401).json({ success: false, message: "Account is inactive or unapproved" });
      }
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Failed to fetch user profile" });
    }
  });

  // Consolidated Upload Endpoint
  app.post("/api/upload", authenticate, upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    // Stream to Cloudinary if credentials are configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const stream = cloudinary.uploader.upload_stream(
          { 
            folder: "mts_lab_assets",
            resource_type: "auto"
          },
          (error, result) => {
            if (error) {
              console.warn("[CLOUDINARY WARNING] Upload to Cloudinary failed, converting to data URI:", error);
              const base64Data = `data:${req.file.mimetype || 'image/png'};base64,${req.file.buffer.toString('base64')}`;
              return res.json({ url: base64Data });
            }
            res.json({ url: result?.secure_url });
          }
        );
        stream.end(req.file.buffer);
        return;
      } catch (err) {
        console.warn("[UPLOAD WARNING] Cloudinary stream error, falling back to data URI:", err);
      }
    }

    // Default zero-dependency fallback: Return inline Base64 Data URL
    const base64Data = `data:${req.file.mimetype || 'image/png'};base64,${req.file.buffer.toString('base64')}`;
    res.json({ url: base64Data });
  });

  const VALID_REPAIR_STATUSES = [
    'PENDING',
    'RECEIVED',
    'DIAGNOSING',
    'IN_PROCESS',
    'WAITING_FOR_PARTS',
    'TESTING',
    'REPAIRED',
    'READY_FOR_PICKUP',
    'DELIVERED',
    'RE_PROBLEM',
    'REPROBLEM',
    'REPROBLEM_FIXED',
    'CANNOT_REPAIR',
    'CANCELLED'
  ];

  const normalizeRepairStatus = (status: string): string => {
    if (!status) return status;
    const upper = status.trim().toUpperCase().replace(/[\s\-]+/g, '_');
    const synonyms: Record<string, string> = {
      'IN_PROGRESS': 'IN_PROCESS',
      'PROGRESS': 'IN_PROCESS',
      'COMPLETED': 'REPAIRED',
      'READY': 'READY_FOR_PICKUP',
      'READY_FOR_COLLECTION': 'READY_FOR_PICKUP',
      'COLLECTED': 'DELIVERED',
      'RETURNED': 'DELIVERED',
      'REPROBLEM': 'RE_PROBLEM',
      'RE_PROBLEM': 'RE_PROBLEM',
      'REOPENED': 'RE_PROBLEM',
      'CANNOT_BE_REPAIRED': 'CANNOT_REPAIR',
      'UNREPAIRABLE': 'CANNOT_REPAIR'
    };
    return synonyms[upper] || upper;
  };

  const sanitizeDeviceCondition = (rawCond?: string | null): string => {
    if (!rawCond || !rawCond.trim()) return 'Good (Minor Wear)';
    const parts = rawCond.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return 'Good (Minor Wear)';
    
    const defects = parts.filter(p => {
      const l = p.toLowerCase();
      return l !== 'good (minor wear)' && l !== 'good' && l !== 'fair' && l !== 'normal intake';
    });
    
    if (defects.length > 0) {
      return Array.from(new Set(defects)).join(', ');
    }
    return 'Good (Minor Wear)';
  };

  const sanitizeAccessoriesReceived = (rawAcc?: string | null): string | null => {
    if (!rawAcc || !rawAcc.trim()) return null;
    const parts = rawAcc.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    
    const normalAcc = parts.filter(p => {
      const l = p.toLowerCase();
      return l !== 'no accessories' && l !== 'none';
    });
    
    if (normalAcc.length > 0) {
      return Array.from(new Set(normalAcc)).join(', ');
    }
    return null;
  };

  // Protected API Routes
  app.get("/api/repairs", authenticate, syncRouteMiddleware(['repair', 'repairLog', 'technicianNote', 'payment', 'user', 'branch']), async (req: any, res) => {
    try {
      const { status, search, startDate, endDate, technicianId, sortBy, sortOrder } = req.query;
      const where: any = {};
      
      // Status filtering
      if (status && status !== 'ALL') {
        const rawStatuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
        const normalizedStatuses = rawStatuses.map(s => normalizeRepairStatus(s));
        if (normalizedStatuses.length === 1) {
          where.status = normalizedStatuses[0];
        } else if (normalizedStatuses.length > 1) {
          where.status = { in: normalizedStatuses };
        }
      }

      // Date filtering on createdAt
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          const parsedStart = new Date(startDate as string);
          if (!isNaN(parsedStart.getTime())) {
            where.createdAt.gte = parsedStart;
          }
        }
        if (endDate) {
          const parsedEnd = new Date(endDate as string);
          if (!isNaN(parsedEnd.getTime())) {
            where.createdAt.lte = parsedEnd;
          }
        }
      }

      // Specific technician filter
      if (technicianId) {
        where.technicianId = technicianId === 'UNASSIGNED' ? null : technicianId;
      }

      // Fast full-text search across all permitted repair fields
      if (search && String(search).trim()) {
        const searchStr = String(search).trim();
        const searchNormalizedPhone = normalizePhone(searchStr);
        where.OR = [
          { repairNumber: { contains: searchStr } },
          { customerName: { contains: searchStr } },
          { customerPhone: { contains: searchStr } },
          ...(searchNormalizedPhone ? [{ customerPhone: { contains: searchNormalizedPhone } }] : []),
          { customerEmail: { contains: searchStr } },
          { deviceBrand: { contains: searchStr } },
          { deviceModel: { contains: searchStr } },
          { problemDescription: { contains: searchStr } },
          { technician: { name: { contains: searchStr } } }
        ];
      }

      // Role-based filtering: TECHNICIAN only sees their assigned repairs
      if (req.user.role === 'TECHNICIAN') {
        where.technicianId = req.user.id;
      }

      // Specific customerId filter
      if (req.query.customerId) {
        where.customerId = String(req.query.customerId);
      }

      // Sorting
      let orderBy: any = { createdAt: "desc" };
      const order = sortOrder === 'asc' ? 'asc' : 'desc';
      if (sortBy === 'oldest') {
        orderBy = { createdAt: 'asc' };
      } else if (sortBy === 'updated' || sortBy === 'recently_updated') {
        orderBy = { updatedAt: order };
      } else if (sortBy === 'repairNumber') {
        orderBy = { repairNumber: order };
      } else if (sortBy === 'customerName') {
        orderBy = { customerName: order };
      } else if (sortBy === 'status') {
        orderBy = { status: order };
      } else if (sortBy === 'newest') {
        orderBy = { createdAt: 'desc' };
      }

      const repairs = await prisma.repair.findMany({
        where,
        orderBy,
        include: { 
          customer: { select: { id: true, customerId: true, name: true, phone: true, email: true, address: true } },
          technician: { select: { id: true, name: true, role: true, email: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          payments: true,
          batteryWarranty: true
        }
      });
      res.json(repairs);
    } catch (err: any) {
      console.error("[GET REPAIRS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch repairs" });
    }
  });

  // Manager Overview Statistics
  app.get("/api/manager/stats", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const repairs = await prisma.repair.findMany({
        select: {
          id: true,
          status: true,
          priority: true,
          technicianId: true,
          createdAt: true
        }
      });

      const totalRepairs = repairs.length;
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

      for (const r of repairs) {
        const s = (r.status || '').toUpperCase();
        if (s === 'PENDING' || s === 'RECEIVED') pending++;
        else if (s === 'IN_PROCESS' || s === 'DIAGNOSING' || s === 'TESTING' || s === 'WAITING_FOR_PARTS') inProgress++;
        else if (s === 'REPAIRED') repaired++;
        else if (s === 'READY_FOR_PICKUP') ready++;
        else if (s === 'DELIVERED') delivered++;
        else if (s === 'RE_PROBLEM' || s === 'REPROBLEM') reproblem++;

        if (!r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') unassigned++;
        if (r.technicianId && s !== 'DELIVERED' && s !== 'CANCELLED') assigned++;
        if (r.priority === 'URGENT') urgentCount++;
        else if (r.priority === 'HIGH') highCount++;
      }

      res.json({
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
        highCount
      });
    } catch (err: any) {
      console.error("[MANAGER STATS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch manager stats." });
    }
  });

  // Manager Technician Workload Summary
  app.get("/api/manager/workload", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const technicians = await prisma.user.findMany({
        where: {
          role: { in: ['TECHNICIAN', 'LEAD_TECHNICIAN'] },
          deletedAt: null,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phoneNumber: true,
          profileImage: true
        }
      });

      const repairs = await prisma.repair.findMany({
        where: {
          technicianId: { in: technicians.map(t => t.id) }
        },
        select: {
          id: true,
          status: true,
          priority: true,
          technicianId: true
        }
      });

      const workload = technicians.map(tech => {
        const techRepairs = repairs.filter(r => r.technicianId === tech.id);
        let pendingCount = 0;
        let inProgressCount = 0;
        let repairedCount = 0;
        let readyCount = 0;
        let deliveredCount = 0;
        let urgentCount = 0;

        for (const r of techRepairs) {
          const s = (r.status || '').toUpperCase();
          if (s === 'PENDING' || s === 'RECEIVED') pendingCount++;
          else if (s === 'IN_PROCESS' || s === 'DIAGNOSING' || s === 'TESTING' || s === 'WAITING_FOR_PARTS') inProgressCount++;
          else if (s === 'REPAIRED') repairedCount++;
          else if (s === 'READY_FOR_PICKUP') readyCount++;
          else if (s === 'DELIVERED') deliveredCount++;

          if (r.priority === 'URGENT') urgentCount++;
        }

        const totalActive = pendingCount + inProgressCount + repairedCount + readyCount;

        return {
          technician: tech,
          assignedCount: techRepairs.length,
          pendingCount,
          inProgressCount,
          repairedCount,
          readyCount,
          deliveredCount,
          urgentCount,
          totalActive
        };
      });

      res.json(workload);
    } catch (err: any) {
      console.error("[MANAGER WORKLOAD ERROR]", err);
      res.status(500).json({ error: "Failed to fetch technician workload." });
    }
  });

  // Assign/Reassign Technician Route
  app.post("/api/repairs/:id/assign", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { technicianId, priority } = req.body;

      const existingRepair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!existingRepair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      let techName = "Unassigned";
      if (technicianId) {
        const technician = await prisma.user.findUnique({ where: { id: technicianId } });
        if (!technician || !['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(technician.role)) {
          return res.status(400).json({ error: "Invalid technician selected" });
        }
        techName = technician.name;
      }

      const upperPriority = priority && ['NORMAL', 'HIGH', 'URGENT'].includes(String(priority).toUpperCase().trim())
        ? String(priority).toUpperCase().trim()
        : undefined;

      const now = new Date();
      const updateData: any = {
        technicianId: technicianId || null,
        updatedAt: now
      };

      if (technicianId) {
        updateData.assignedAt = now;
        updateData.assignedById = req.user.id;
        updateData.assignedByName = req.user.name || req.user.role;
        updateData.managerUpdatedAt = now;
        updateData.managerUpdatedBy = req.user.name || req.user.role;
      } else {
        updateData.assignedAt = null;
        updateData.assignedById = null;
        updateData.assignedByName = null;
        updateData.managerUpdatedAt = now;
        updateData.managerUpdatedBy = req.user.name || req.user.role;
      }

      if (upperPriority) {
        updateData.priority = upperPriority;
        updateData.priorityUpdatedAt = now;
      }

      const [updatedRepair, newLog] = await prisma.$transaction(async (tx) => {
        const rep = await tx.repair.update({
          where: { id },
          data: updateData,
          include: {
            technician: { select: { id: true, name: true, role: true, email: true } },
            createdBy: { select: { id: true, name: true } },
            logs: { orderBy: { createdAt: 'desc' } }
          }
        });

        const log = await tx.repairLog.create({
          data: {
            repairId: id,
            status: rep.status,
            message: technicianId 
              ? `Technician ${techName} assigned by ${req.user.name || req.user.role}${upperPriority ? ` [Priority: ${upperPriority}]` : ''}`
              : `Technician unassigned by ${req.user.name || req.user.role}`
          }
        });

        return [rep, log];
      });

      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: newLog.id, data: newLog });
      syncToFirestore('repair', updatedRepair).catch(() => {});

      // Send real-time notification to newly assigned technician
      if (technicianId && (technicianId !== existingRepair.technicianId || upperPriority)) {
        const isUrgent = updatedRepair.priority === 'URGENT';
        const isHigh = updatedRepair.priority === 'HIGH';
        
        let notifTitle = "🔔 New Repair Assigned";
        let notifType = "REPAIR_ASSIGNED";
        if (isUrgent) {
          notifTitle = "🚨 High Priority Repair Assigned";
          notifType = "REPAIR_URGENT";
        } else if (isHigh) {
          notifTitle = "🟠 Priority Repair Assigned";
          notifType = "REPAIR_ALERT";
        }

        const priorityLabel = isUrgent ? "High Priority" : (isHigh ? "Priority" : "Normal");

        await sendSystemNotification({
          userId: technicianId,
          title: notifTitle,
          message: `${notifTitle}: Job #${updatedRepair.repairNumber} (${updatedRepair.deviceBrand} ${updatedRepair.deviceModel}) assigned to you by ${req.user.name || req.user.role}. Priority: ${priorityLabel}. Problem: ${updatedRepair.problemDescription || 'Inspection required'}`,
          type: notifType,
          repairId: updatedRepair.id,
          repairNumber: updatedRepair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            assignedAt: now.toISOString(),
            priority: updatedRepair.priority,
            priorityLabel,
            isUrgent,
            isHigh,
            problemDescription: updatedRepair.problemDescription,
            deviceBrand: updatedRepair.deviceBrand,
            deviceModel: updatedRepair.deviceModel
          }
        });
      }

      // Record audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "ASSIGN_TECHNICIAN",
          resource: "REPAIR",
          resourceId: id,
          details: `Assigned technician ${techName} to repair #${updatedRepair.repairNumber}`
        }
      });

      res.json(updatedRepair);
    } catch (err: any) {
      console.error("[ASSIGN TECHNICIAN ERROR]", err);
      res.status(500).json({ error: "Failed to assign technician" });
    }
  });

  // Direct Manager & Admin Repair Transfer
  app.post("/api/repairs/:id/transfer", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { targetTechnicianId, reason, priority } = req.body;

      if (!targetTechnicianId) {
        return res.status(400).json({ error: "Target technician is required." });
      }

      const existingRepair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!existingRepair) {
        return res.status(404).json({ error: "Repair record not found." });
      }

      const targetTech = await prisma.user.findUnique({ where: { id: targetTechnicianId } });
      if (!targetTech || !['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(targetTech.role) || targetTech.isActive === false) {
        return res.status(400).json({ error: "Selected target technician is invalid or inactive." });
      }

      const prevTechName = existingRepair.technician?.name || "Unassigned";
      const cleanReason = (reason || "").trim();
      const now = new Date();

      const [updatedRepair, newLog] = await prisma.$transaction(async (tx) => {
        const updateData: any = {
          technicianId: targetTechnicianId,
          assignedAt: now,
          assignedById: req.user.id,
          assignedByName: req.user.name || req.user.role,
          managerUpdatedAt: now,
          managerUpdatedBy: req.user.name || req.user.role,
          updatedAt: now
        };
        if (priority && ['NORMAL', 'HIGH', 'URGENT'].includes(priority.toUpperCase())) {
          updateData.priority = priority.toUpperCase();
          updateData.priorityUpdatedAt = now;
        }

        const rep = await tx.repair.update({
          where: { id },
          data: updateData,
          include: {
            technician: { select: { id: true, name: true, role: true, email: true } },
            createdBy: { select: { id: true, name: true } },
            logs: { orderBy: { createdAt: 'desc' } }
          }
        });

        const log = await tx.repairLog.create({
          data: {
            repairId: id,
            status: rep.status,
            message: `🔄 Repair transferred from ${prevTechName} to ${targetTech.name} by ${req.user.role} ${req.user.name}${cleanReason ? `: "${cleanReason}"` : ''}`
          }
        });

        if (cleanReason) {
          await tx.technicianNote.create({
            data: {
              repairId: id,
              technicianId: req.user.id,
              authorName: req.user.name,
              authorRole: req.user.role,
              note: `[Transfer Note from ${req.user.name} (${req.user.role})]: ${cleanReason}`,
              isInternal: true
            }
          });
        }

        return [rep, log];
      });

      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: newLog.id, data: newLog });
      syncToFirestore('repair', updatedRepair).catch(() => {});

      // Notify new technician
      await sendSystemNotification({
        userId: targetTechnicianId,
        title: "🔄 Repair Transferred to You",
        message: `Repair #${updatedRepair.repairNumber} (${updatedRepair.deviceBrand} ${updatedRepair.deviceModel}) was transferred to you by Manager ${req.user.name}.${cleanReason ? ` Note: ${cleanReason}` : ''}`,
        type: "REPAIR_ASSIGNED",
        repairId: updatedRepair.id,
        repairNumber: updatedRepair.repairNumber,
        senderId: req.user.id,
        senderName: req.user.name,
        metadata: {
          assignedAt: now.toISOString(),
          priority: updatedRepair.priority
        }
      });

      // If previous technician existed and is different, notify them
      if (existingRepair.technicianId && existingRepair.technicianId !== targetTechnicianId) {
        await sendSystemNotification({
          userId: existingRepair.technicianId,
          title: "🔄 Repair Reassigned",
          message: `Repair #${updatedRepair.repairNumber} has been reassigned to ${targetTech.name} by Manager ${req.user.name}.`,
          type: "TRANSFER_REQUEST",
          repairId: updatedRepair.id,
          repairNumber: updatedRepair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name
        });
      }

      await recordAuditLog({
        req,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: "REPAIR_TRANSFERRED",
        resource: "REPAIR",
        resourceId: updatedRepair.id,
        status: "SUCCESS",
        details: `Transferred repair #${updatedRepair.repairNumber} from ${prevTechName} to ${targetTech.name}`
      });

      res.json({ success: true, message: `Repair transferred to ${targetTech.name} successfully.`, repair: updatedRepair });
    } catch (err: any) {
      console.error("[MANAGER TRANSFER ERROR]", err);
      res.status(500).json({ error: "Failed to transfer repair." });
    }
  });

  // Update Repair Priority
  app.patch("/api/repairs/:id/priority", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      const upperPriority = String(priority || '').toUpperCase().trim();
      if (!['NORMAL', 'HIGH', 'URGENT'].includes(upperPriority)) {
        return res.status(400).json({ error: "Priority must be NORMAL, HIGH, or URGENT." });
      }

      const repair = await prisma.repair.findUnique({ where: { id } });
      if (!repair) {
        return res.status(404).json({ error: "Repair not found." });
      }

      const now = new Date();
      const updated = await prisma.repair.update({
        where: { id },
        data: { 
          priority: upperPriority,
          priorityUpdatedAt: now,
          managerUpdatedAt: now,
          managerUpdatedBy: req.user.name || req.user.role,
          updatedAt: now 
        },
        include: {
          technician: { select: { id: true, name: true, role: true, email: true } },
          customer: true
        }
      });

      const priorityLabel = upperPriority === 'URGENT' ? 'High Priority' : (upperPriority === 'HIGH' ? 'Priority' : 'Normal');

      const log = await prisma.repairLog.create({
        data: {
          repairId: id,
          status: updated.status,
          message: `⚡ Priority updated to ${priorityLabel} (${upperPriority}) by ${req.user.name} (${req.user.role})`
        }
      });

      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updated.id, data: updated });
      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: log.id, data: log });
      syncToFirestore('repair', updated).catch(() => {});

      // Dispatch alert to assigned technician
      if (updated.technicianId) {
        let notifTitle = "ℹ️ Repair Priority Set to Normal";
        let notifType = "REPAIR_ALERT";
        if (upperPriority === 'URGENT') {
          notifTitle = "🚨 High Priority Repair Alert";
          notifType = "REPAIR_URGENT";
        } else if (upperPriority === 'HIGH') {
          notifTitle = "🟠 Priority Repair Alert";
          notifType = "REPAIR_ALERT";
        }

        await sendSystemNotification({
          userId: updated.technicianId,
          title: notifTitle,
          message: `Repair #${updated.repairNumber} (${updated.deviceBrand} ${updated.deviceModel}) priority updated to ${priorityLabel} by ${req.user.name} (${req.user.role}). Problem: ${updated.problemDescription || 'Please prioritize technical action.'}`,
          type: notifType,
          repairId: updated.id,
          repairNumber: updated.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            priority: upperPriority,
            priorityLabel,
            isUrgent: upperPriority === 'URGENT',
            isHigh: upperPriority === 'HIGH',
            deviceBrand: updated.deviceBrand,
            deviceModel: updated.deviceModel,
            repairNumber: updated.repairNumber,
            markedAt: now.toISOString()
          }
        });
      }

      await recordAuditLog({
        req,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: "REPAIR_PRIORITY_UPDATED",
        resource: "REPAIR",
        resourceId: updated.id,
        status: "SUCCESS",
        details: `Updated priority to ${upperPriority} for repair #${updated.repairNumber}`
      });

      res.json({ success: true, repair: updated });
    } catch (err: any) {
      console.error("[UPDATE PRIORITY ERROR]", err);
      res.status(500).json({ error: "Failed to update repair priority." });
    }
  });

  // Permanent Delete Repair - Authorized strictly for SUPER_ADMIN ONLY
  app.delete("/api/repairs/:id", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;

      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found or already removed." });
      }

      // Atomic transactional cascade purge of all related notes, logs, payments, notifications and requests
      await prisma.$transaction(async (tx) => {
        await tx.technicianNote.deleteMany({ where: { repairId: id } });
        await tx.repairLog.deleteMany({ where: { repairId: id } });
        await tx.payment.deleteMany({ where: { repairId: id } });
        await tx.notification.deleteMany({ where: { repairId: id } });
        await tx.repairTransferRequest.deleteMany({ where: { repairId: id } });
        await tx.batteryWarranty.deleteMany({ where: { repairId: id } });
        await tx.repair.delete({ where: { id } });
      });

      // Broadcast Real-time DELETE event to update all open dashboards immediately
      broadcastRealtimeEvent({
        entity: "repair",
        action: "DELETE",
        id,
        data: { id, repairNumber: repair.repairNumber }
      });

      // Delete from Firestore
      if (!firestoreSyncDisabled) {
        try {
          const firestore = getDb();
          await firestore.collection('repairs').doc(id).delete();
        } catch (fErr: any) {
          if (fErr?.code === 7 || fErr?.message?.includes("PERMISSION_DENIED") || fErr?.status === 7) {
            firestoreSyncDisabled = true;
          }
        }
      }

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "DELETE_REPAIR",
          resource: "REPAIR",
          resourceId: id,
          details: `Permanently deleted repair record #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}) for customer ${repair.customerName}`
        }
      });

      res.json({ success: true, message: `Repair #${repair.repairNumber} permanently deleted successfully.` });
    } catch (err: any) {
      console.error("[DELETE REPAIR ERROR]", err);
      res.status(500).json({ error: "Failed to delete repair record: " + (err.message || "Database constraint") });
    }
  });

  // Permanent Bulk Delete Repairs - Authorized strictly for SUPER_ADMIN ONLY
  app.post("/api/repairs/bulk-delete", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { ids, repairIds } = req.body;
      const targetIds: string[] = Array.isArray(ids) ? ids : (Array.isArray(repairIds) ? repairIds : []);

      if (!targetIds || targetIds.length === 0) {
        return res.status(400).json({ error: "Please select at least one repair to delete." });
      }

      // Filter out invalid/empty strings
      const cleanIds = targetIds.filter(id => typeof id === "string" && id.trim().length > 0);
      if (cleanIds.length === 0) {
        return res.status(400).json({ error: "No valid repair IDs provided for deletion." });
      }

      // Fetch existing repairs to delete
      const existingRepairs = await prisma.repair.findMany({
        where: { id: { in: cleanIds } },
        select: { id: true, repairNumber: true, customerName: true, deviceBrand: true, deviceModel: true }
      });

      if (existingRepairs.length === 0) {
        return res.status(404).json({ error: "None of the selected repairs were found. They may have already been deleted." });
      }

      const existingIds = existingRepairs.map(r => r.id);
      const repairNumbers = existingRepairs.map(r => `#${r.repairNumber}`);

      // Atomic transactional cascade purge for all selected repairs
      await prisma.$transaction(async (tx) => {
        await tx.technicianNote.deleteMany({ where: { repairId: { in: existingIds } } });
        await tx.repairLog.deleteMany({ where: { repairId: { in: existingIds } } });
        await tx.payment.deleteMany({ where: { repairId: { in: existingIds } } });
        await tx.notification.deleteMany({ where: { repairId: { in: existingIds } } });
        await tx.repairTransferRequest.deleteMany({ where: { repairId: { in: existingIds } } });
        await tx.batteryWarranty.deleteMany({ where: { repairId: { in: existingIds } } });
        await tx.repair.deleteMany({ where: { id: { in: existingIds } } });
      });

      // Broadcast Real-time DELETE events for each deleted repair
      for (const rep of existingRepairs) {
        broadcastRealtimeEvent({
          entity: "repair",
          action: "DELETE",
          id: rep.id,
          data: { id: rep.id, repairNumber: rep.repairNumber }
        });

        if (!firestoreSyncDisabled) {
          try {
            const firestore = getDb();
            await firestore.collection('repairs').doc(rep.id).delete();
          } catch (fErr: any) {
            if (fErr?.code === 7 || fErr?.message?.includes("PERMISSION_DENIED") || fErr?.status === 7) {
              firestoreSyncDisabled = true;
            }
          }
        }
      }

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "REPAIRS_DELETED",
          resource: "REPAIR",
          details: `Bulk deleted ${existingRepairs.length} repair record(s): ${repairNumbers.slice(0, 10).join(', ')}${repairNumbers.length > 10 ? ` and ${repairNumbers.length - 10} more` : ''}`
        }
      });

      res.json({
        success: true,
        count: existingRepairs.length,
        deletedIds: existingIds,
        message: `Successfully deleted ${existingRepairs.length} repair record(s).`
      });
    } catch (err: any) {
      console.error("[BULK DELETE REPAIRS ERROR]", err);
      res.status(500).json({ error: "Failed to delete the selected repair(s): " + (err.message || "Database constraint") });
    }
  });

  // =========================================================================
  // SUPER ADMIN PERMANENT CUSTOMER DELETION CONTROLS (SUPER_ADMIN ONLY)
  // =========================================================================
  app.delete("/api/customers/:id", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: { repairs: true, batteryWarranties: true }
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer record not found or already deleted." });
      }

      // Safety: never permanently delete a customer that has linked repair/warranty history.
      const hasLinkedRecords = customer.repairs.length > 0 || customer.batteryWarranties.length > 0;
      if (hasLinkedRecords) {
        return res.status(409).json({
          error: "This customer has repair or warranty history. Archive the customer instead of deleting to preserve all historical records.",
          code: "HAS_LINKED_RECORDS"
        });
      }

      const repairIds = customer.repairs.map(r => r.id);
      const warrantyIds = customer.batteryWarranties.map(w => w.id);

      await prisma.$transaction(async (tx) => {
        if (repairIds.length > 0) {
          await tx.technicianNote.deleteMany({ where: { repairId: { in: repairIds } } });
          await tx.repairLog.deleteMany({ where: { repairId: { in: repairIds } } });
          await tx.payment.deleteMany({ where: { repairId: { in: repairIds } } });
          await tx.notification.deleteMany({ where: { repairId: { in: repairIds } } });
          await tx.repairTransferRequest.deleteMany({ where: { repairId: { in: repairIds } } });
        }
        if (warrantyIds.length > 0) {
          await tx.batteryWarrantyClaim.deleteMany({ where: { warrantyId: { in: warrantyIds } } });
          await tx.batteryWarranty.deleteMany({ where: { id: { in: warrantyIds } } });
        }
        if (repairIds.length > 0) {
          await tx.repair.deleteMany({ where: { id: { in: repairIds } } });
        }
        await tx.customer.delete({ where: { id } });
      });

      broadcastRealtimeEvent({
        entity: "customer",
        action: "DELETE",
        id,
        data: { id, name: customer.name, phone: customer.phone }
      });

      if (!firestoreSyncDisabled) {
        try {
          const firestore = getDb();
          await firestore.collection('customers').doc(id).delete();
        } catch (fErr) {}
      }

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "DELETE_CUSTOMER",
          resource: "CUSTOMER",
          resourceId: id,
          details: `Permanently deleted customer record for ${customer.name} (${customer.phone}) and cascaded records`
        }
      });

      res.json({ success: true, message: `Customer ${customer.name} permanently deleted successfully.` });
    } catch (err: any) {
      console.error("[DELETE CUSTOMER ERROR]", err);
      res.status(500).json({ error: "Failed to delete customer record: " + (err.message || err) });
    }
  });

  // =========================================================================
  // SUPER ADMIN BATTERY WARRANTY HUB 2FA PERMANENT DELETION CONTROLS (SUPER_ADMIN ONLY + 2FA REQUIRED)
  // =========================================================================
  
  // 1. Request 2FA Verification Code for Battery Warranty Deletion
  app.post("/api/battery-warranties/delete-2fa/request", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const user = req.user;
      
      // Invalidate previous unused OTPs for this purpose
      await prisma.oTPVerification.updateMany({
        where: {
          userId: user.id,
          purpose: "WARRANTY_DELETION_2FA",
          isUsed: false
        },
        data: { isUsed: true }
      });

      const otpCode = generate6DigitOtp();
      const otpHash = hashOtp(otpCode);
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

      await prisma.oTPVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash: otpHash,
          purpose: "WARRANTY_DELETION_2FA",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: otpExpiresAt,
          isUsed: false
        }
      });

      const emailResult = await sendEmail(
        user.email,
        "MTS Lab Security — 2FA Code for Permanent Battery Warranty Deletion",
        `Hello ${user.name},\n\nYou have requested to permanently delete Battery Warranty Hub records in the MTS Lab Super Admin Console.\n\nYour 6-digit 2FA verification code is:\n\n   ${otpCode}\n\nThis verification code will expire in 5 minutes.\nIf you did not initiate this deletion request, please secure your account immediately.`
      );

      if (!emailResult.success) {
        return res.status(503).json({
          success: false,
          message: "Failed to deliver 2FA verification code to your email. Please check your email configuration."
        });
      }

      await recordAuditLog({
        req,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: "OTP_REQUESTED",
        resource: "WARRANTY",
        status: "SUCCESS",
        details: `2FA verification code dispatched to Super Admin email (${maskEmail(user.email)}) for permanent warranty deletion`
      });

      return res.json({
        success: true,
        message: `Verification code sent to your registered email (${maskEmail(user.email)}).`,
        emailMasked: maskEmail(user.email)
      });
    } catch (err: any) {
      console.error("[REQUEST WARRANTY DELETION 2FA ERROR]", err);
      res.status(500).json({ error: "Failed to request 2FA verification code: " + (err.message || err) });
    }
  });

  // 2. Permanent Bulk Delete Battery Warranties (SUPER_ADMIN ONLY + 2FA REQUIRED)
  app.post("/api/battery-warranties/bulk-delete", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { ids, warrantyIds, code, twoFactorCode } = req.body;
      const targetIds: string[] = Array.isArray(ids) ? ids : (Array.isArray(warrantyIds) ? warrantyIds : []);
      const inputCode = String(code || twoFactorCode || '').trim();

      if (!targetIds || targetIds.length === 0) {
        return res.status(400).json({ error: "Please select at least one battery warranty record to delete." });
      }

      if (!inputCode) {
        return res.status(400).json({ error: "Two-Factor Authentication (2FA) verification code is required to permanently delete warranty records." });
      }

      // Verify 2FA OTP for SUPER_ADMIN
      const activeOtp = await prisma.oTPVerification.findFirst({
        where: {
          userId: req.user.id,
          purpose: "WARRANTY_DELETION_2FA",
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!activeOtp) {
        return res.status(400).json({ error: "2FA verification code has expired or was not requested. Please request a new verification code." });
      }

      if (activeOtp.attempts >= activeOtp.maxAttempts) {
        return res.status(400).json({ error: "Too many failed attempts. Please request a new 2FA verification code." });
      }

      const inputHash = hashOtp(inputCode);
      if (activeOtp.codeHash !== inputHash) {
        await prisma.oTPVerification.update({
          where: { id: activeOtp.id },
          data: { attempts: { increment: 1 } }
        });
        return res.status(400).json({ error: "Invalid 2FA verification code. Please check your email and try again." });
      }

      // 2FA Code Verified! Invalidate the OTP
      await prisma.oTPVerification.update({
        where: { id: activeOtp.id },
        data: { isUsed: true }
      });

      const cleanIds = targetIds.filter(id => typeof id === "string" && id.trim().length > 0);
      const existingWarranties = await prisma.batteryWarranty.findMany({
        where: { id: { in: cleanIds } },
        select: { id: true, warrantyNumber: true, customerName: true, repairNumber: true }
      });

      if (existingWarranties.length === 0) {
        return res.status(404).json({ error: "None of the selected warranty records were found. They may have already been deleted." });
      }

      const existingIds = existingWarranties.map(w => w.id);
      const warrantyNumbers = existingWarranties.map(w => `#${w.warrantyNumber}`).join(', ');

      // Atomic transaction: Delete warranty claims first, then warranties
      await prisma.$transaction(async (tx) => {
        await tx.batteryWarrantyClaim.deleteMany({ where: { warrantyId: { in: existingIds } } });
        await tx.batteryWarranty.deleteMany({ where: { id: { in: existingIds } } });
      });

      // Broadcast Real-time DELETE events & Firestore purge
      for (const w of existingWarranties) {
        broadcastRealtimeEvent({
          entity: "batteryWarranty",
          action: "DELETE",
          id: w.id,
          data: { id: w.id, warrantyNumber: w.warrantyNumber }
        });

        if (!firestoreSyncDisabled) {
          try {
            const firestore = getDb();
            await firestore.collection('batteryWarranties').doc(w.id).delete();
          } catch (fErr) {}
        }
      }

      // Record Audit Log (DO NOT store raw 2FA code in audit log)
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "PERMANENT_DELETE_WARRANTIES",
          resource: "WARRANTY",
          resourceId: existingIds[0],
          details: `Permanently deleted ${existingWarranties.length} battery warranty record(s) (${warrantyNumbers}) with 2FA verification.`,
          metadata: JSON.stringify({
            count: existingWarranties.length,
            warrantyNumbers: existingWarranties.map(w => w.warrantyNumber),
            twoFactorVerified: true
          })
        }
      });

      res.json({
        success: true,
        count: existingWarranties.length,
        deletedIds: existingIds,
        message: `Successfully permanently deleted ${existingWarranties.length} battery warranty record(s).`
      });
    } catch (err: any) {
      console.error("[PERMANENT DELETE WARRANTIES ERROR]", err);
      res.status(500).json({ error: "Failed to delete battery warranties: " + (err.message || err) });
    }
  });

  // 3. Permanent Delete Single Battery Warranty (SUPER_ADMIN ONLY + 2FA REQUIRED)
  app.delete("/api/battery-warranties/:id", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { code, twoFactorCode } = req.body || {};
      const inputCode = String(code || twoFactorCode || req.query.code || '').trim();

      if (!inputCode) {
        return res.status(400).json({ error: "Two-Factor Authentication (2FA) verification code is required to permanently delete warranty records." });
      }

      // Verify 2FA OTP for SUPER_ADMIN
      const activeOtp = await prisma.oTPVerification.findFirst({
        where: {
          userId: req.user.id,
          purpose: "WARRANTY_DELETION_2FA",
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!activeOtp) {
        return res.status(400).json({ error: "2FA verification code has expired or was not requested. Please request a new verification code." });
      }

      if (activeOtp.attempts >= activeOtp.maxAttempts) {
        return res.status(400).json({ error: "Too many failed attempts. Please request a new 2FA verification code." });
      }

      const inputHash = hashOtp(inputCode);
      if (activeOtp.codeHash !== inputHash) {
        await prisma.oTPVerification.update({
          where: { id: activeOtp.id },
          data: { attempts: { increment: 1 } }
        });
        return res.status(400).json({ error: "Invalid 2FA verification code. Please check your email and try again." });
      }

      // 2FA Code Verified!
      await prisma.oTPVerification.update({
        where: { id: activeOtp.id },
        data: { isUsed: true }
      });

      const warranty = await prisma.batteryWarranty.findUnique({
        where: { id },
        select: { id: true, warrantyNumber: true, customerName: true }
      });

      if (!warranty) {
        return res.status(404).json({ error: "Battery warranty record not found or already deleted." });
      }

      await prisma.$transaction(async (tx) => {
        await tx.batteryWarrantyClaim.deleteMany({ where: { warrantyId: id } });
        await tx.batteryWarranty.delete({ where: { id } });
      });

      broadcastRealtimeEvent({
        entity: "batteryWarranty",
        action: "DELETE",
        id,
        data: { id, warrantyNumber: warranty.warrantyNumber }
      });

      if (!firestoreSyncDisabled) {
        try {
          const firestore = getDb();
          await firestore.collection('batteryWarranties').doc(id).delete();
        } catch (fErr) {}
      }

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "PERMANENT_DELETE_WARRANTY",
          resource: "WARRANTY",
          resourceId: id,
          details: `Permanently deleted battery warranty #${warranty.warrantyNumber} for customer ${warranty.customerName} with 2FA verification.`,
          metadata: JSON.stringify({ twoFactorVerified: true })
        }
      });

      res.json({ success: true, message: `Warranty #${warranty.warrantyNumber} permanently deleted successfully.` });
    } catch (err: any) {
      console.error("[PERMANENT DELETE SINGLE WARRANTY ERROR]", err);
      res.status(500).json({ error: "Failed to delete battery warranty: " + (err.message || err) });
    }
  });

  // =========================================================================
  // REPAIRS MANAGEMENT: EXCEL IMPORT & EXPORT ENDPOINTS
  // =========================================================================

  // 1. Export Repairs Data to Excel (.xlsx)
  app.get("/api/repairs/export", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { status, search, startDate, endDate, technicianId } = req.query;
      const where: any = {};

      // Status filter
      if (status && status !== 'ALL') {
        const rawStatuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
        const normalizedStatuses = rawStatuses.map(s => normalizeRepairStatus(s));
        if (normalizedStatuses.length === 1) {
          where.status = normalizedStatuses[0];
        } else if (normalizedStatuses.length > 1) {
          where.status = { in: normalizedStatuses };
        }
      }

      // Date filter on createdAt
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          const parsedStart = new Date(startDate as string);
          if (!isNaN(parsedStart.getTime())) {
            where.createdAt.gte = parsedStart;
          }
        }
        if (endDate) {
          const parsedEnd = new Date(endDate as string);
          if (!isNaN(parsedEnd.getTime())) {
            where.createdAt.lte = parsedEnd;
          }
        }
      }

      // Technician filter
      if (technicianId && technicianId !== 'ALL') {
        where.technicianId = technicianId === 'UNASSIGNED' ? null : String(technicianId);
      }

      // Search filter
      if (search && String(search).trim()) {
        const searchStr = String(search).trim();
        const searchNormalizedPhone = normalizePhone(searchStr);
        where.OR = [
          { repairNumber: { contains: searchStr } },
          { customerName: { contains: searchStr } },
          { customerPhone: { contains: searchStr } },
          ...(searchNormalizedPhone ? [{ customerPhone: { contains: searchNormalizedPhone } }] : []),
          { customerEmail: { contains: searchStr } },
          { customerAddress: { contains: searchStr } },
          { deviceBrand: { contains: searchStr } },
          { deviceModel: { contains: searchStr } },
          { imeiNumber: { contains: searchStr } },
          { problemDescription: { contains: searchStr } },
          { remarks: { contains: searchStr } }
        ];
      }

      const repairs = await prisma.repair.findMany({
        where,
        include: {
          customer: true,
          technician: { select: { id: true, name: true, email: true, role: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          branch: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatExcelDate = (d: any) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '';
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const formatExcelDateTime = (d: any) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '';
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
      };

      const excelRows = repairs.map(r => ({
        'Repair Number': String(r.repairNumber || ''),
        'Customer Name': String(r.customerName || ''),
        'Customer Phone Number': String(r.customerPhone || ''),
        'Customer Email': String(r.customerEmail || ''),
        'Customer Address': String(r.customerAddress || ''),
        'Device Brand': String(r.deviceBrand || '').toUpperCase(),
        'Device Model': String(r.deviceModel || ''),
        'IMEI Number': String(r.imeiNumber || ''),
        'Device Condition': String(r.deviceCondition || 'Good'),
        'Device Problem': String(r.problemDescription || ''),
        'Accessories Received': String(r.accessoriesReceived || 'None'),
        'Repair Status': String(r.status || 'PENDING'),
        'Assigned Technician': String(r.technician?.name || 'Unassigned'),
        'Estimated Cost (NPR)': Number(r.estimatedCost || 0),
        'Advance Paid (NPR)': Number(r.advancePaid || 0),
        'Total Paid (NPR)': Number(r.totalPaid || 0),
        'Payment Status': String(r.paymentStatus || 'UNPAID'),
        'Register Date': formatExcelDate(r.createdAt),
        'Estimated/Service Date': formatExcelDate(r.expectedCompletionDate),
        'Repair Remarks': String(r.remarks || ''),
        'Created By': String(r.createdBy?.name || 'MTS Staff'),
        'Created Date': formatExcelDateTime(r.createdAt)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      // Set explicit string cell types on Phone Number, IMEI Number, and Repair Number to strictly preserve leading zeros
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:V1');
      for (let R = 1; R <= range.e.r; ++R) {
        // Column A is Repair Number (idx 0), Column C is Phone (idx 2), Column H is IMEI (idx 7)
        const repCell = XLSX.utils.encode_cell({ r: R, c: 0 });
        if (worksheet[repCell]) {
          worksheet[repCell].t = 's';
          worksheet[repCell].v = String(worksheet[repCell].v);
        }
        const phoneCell = XLSX.utils.encode_cell({ r: R, c: 2 });
        if (worksheet[phoneCell]) {
          worksheet[phoneCell].t = 's';
          worksheet[phoneCell].v = String(worksheet[phoneCell].v);
        }
        const imeiCell = XLSX.utils.encode_cell({ r: R, c: 7 });
        if (worksheet[imeiCell]) {
          worksheet[imeiCell].t = 's';
          worksheet[imeiCell].v = String(worksheet[imeiCell].v);
        }
      }

      worksheet['!cols'] = [
        { wch: 16 }, // Repair Number
        { wch: 22 }, // Customer Name
        { wch: 22 }, // Customer Phone Number
        { wch: 24 }, // Customer Email
        { wch: 24 }, // Customer Address
        { wch: 15 }, // Device Brand
        { wch: 20 }, // Device Model
        { wch: 20 }, // IMEI Number
        { wch: 18 }, // Device Condition
        { wch: 32 }, // Device Problem
        { wch: 22 }, // Accessories Received
        { wch: 18 }, // Repair Status
        { wch: 22 }, // Assigned Technician
        { wch: 20 }, // Estimated Cost (NPR)
        { wch: 18 }, // Advance Paid (NPR)
        { wch: 18 }, // Total Paid (NPR)
        { wch: 16 }, // Payment Status
        { wch: 16 }, // Register Date
        { wch: 22 }, // Estimated/Service Date
        { wch: 30 }, // Repair Remarks
        { wch: 20 }, // Created By
        { wch: 18 }  // Created Date
      ];

      if (excelRows.length > 0) {
        worksheet['!autofilter'] = { ref: `A1:V${excelRows.length + 1}` };
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Repairs");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "REPAIR_EXCEL_EXPORTED",
          resource: "REPAIR",
          details: `Exported ${excelRows.length} repair records to Excel by ${req.user.name} (${req.user.role}).`,
          metadata: JSON.stringify({ recordCount: excelRows.length })
        }
      });

      const filenameDate = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="MTS_Lab_Repairs_${filenameDate}.xlsx"`);
      return res.send(excelBuffer);
    } catch (err: any) {
      console.error("[EXPORT REPAIRS ERROR]", err);
      res.status(500).json({ error: "Failed to export repairs to Excel: " + err.message });
    }
  });

  // 2. Download Clean Repair Excel Template (.xlsx)
  app.get("/api/repairs/import/template", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const templateRows = [
        {
          'Repair Number': '1001',
          'Customer Name': 'Manish Sharma',
          'Customer Phone Number': '9869276668',
          'Customer Email': 'manish.customer@example.com',
          'Customer Address': 'New Road, Kathmandu',
          'Device Brand': 'Apple',
          'Device Model': 'iPhone 13 Pro',
          'IMEI Number': '354892019283741',
          'Device Condition': 'Good',
          'Device Problem': 'Broken screen and battery replacement',
          'Accessories Received': 'Device Only',
          'Repair Status': 'RECEIVED',
          'Assigned Technician': 'Amit Sharma',
          'Estimated Cost (NPR)': 8500,
          'Advance Paid (NPR)': 3000,
          'Total Paid (NPR)': 3000,
          'Payment Status': 'PARTIAL',
          'Register Date': '20/08/2026',
          'Estimated/Service Date': '22/08/2026',
          'Repair Remarks': 'Urgent repair requested'
        },
        {
          'Repair Number': '1002',
          'Customer Name': 'Sabita Thakur',
          'Customer Phone Number': '015364307',
          'Customer Email': 'sabita.customer@example.com',
          'Customer Address': 'Pako, New Road',
          'Device Brand': 'Samsung',
          'Device Model': 'Galaxy S22 Ultra',
          'IMEI Number': '001928374651920',
          'Device Condition': 'Mint',
          'Device Problem': 'Charging port issue',
          'Accessories Received': 'Box and original cable',
          'Repair Status': 'IN_PROCESS',
          'Assigned Technician': '',
          'Estimated Cost (NPR)': 4200,
          'Advance Paid (NPR)': 0,
          'Total Paid (NPR)': 0,
          'Payment Status': 'UNPAID',
          'Register Date': '20/08/2026',
          'Estimated/Service Date': '21/08/2026',
          'Repair Remarks': 'Customer will collect in the evening'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateRows);

      // Force text cell type for Repair Number, Phone and IMEI to keep leading zeros in template
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:T3');
      for (let R = 1; R <= range.e.r; ++R) {
        const repCell = XLSX.utils.encode_cell({ r: R, c: 0 });
        if (worksheet[repCell]) worksheet[repCell].t = 's';
        const phoneCell = XLSX.utils.encode_cell({ r: R, c: 2 });
        if (worksheet[phoneCell]) worksheet[phoneCell].t = 's';
        const imeiCell = XLSX.utils.encode_cell({ r: R, c: 7 });
        if (worksheet[imeiCell]) worksheet[imeiCell].t = 's';
      }

      worksheet['!cols'] = [
        { wch: 16 }, // Repair Number
        { wch: 22 }, // Customer Name
        { wch: 22 }, // Customer Phone Number
        { wch: 24 }, // Customer Email
        { wch: 24 }, // Customer Address
        { wch: 15 }, // Device Brand
        { wch: 20 }, // Device Model
        { wch: 20 }, // IMEI Number
        { wch: 18 }, // Device Condition
        { wch: 32 }, // Device Problem
        { wch: 22 }, // Accessories Received
        { wch: 18 }, // Repair Status
        { wch: 22 }, // Assigned Technician
        { wch: 20 }, // Estimated Cost (NPR)
        { wch: 18 }, // Advance Paid (NPR)
        { wch: 18 }, // Total Paid (NPR)
        { wch: 16 }, // Payment Status
        { wch: 16 }, // Register Date
        { wch: 22 }, // Estimated/Service Date
        { wch: 30 }  // Repair Remarks
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Repair Import Template");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="MTS_Lab_Repair_Import_Template.xlsx"');
      return res.send(excelBuffer);
    } catch (err: any) {
      console.error("[DOWNLOAD REPAIR TEMPLATE ERROR]", err);
      res.status(500).json({ error: "Failed to generate Excel template: " + err.message });
    }
  });

  // 3. Import Repairs Preview Endpoint (Accepts Excel File or JSON Rows)
  app.post("/api/repairs/import/preview", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), upload.single('file'), async (req: any, res) => {
    try {
      let rawRows: any[] = [];

      if (req.file) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return res.status(400).json({ error: "The uploaded Excel workbook contains no worksheets." });
        }
        const worksheet = workbook.Sheets[sheetName];
        rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      } else if (req.body?.rows && Array.isArray(req.body.rows)) {
        rawRows = req.body.rows;
      } else {
        return res.status(400).json({ error: "Please upload an Excel (.xlsx) file or provide rows for preview." });
      }

      if (rawRows.length === 0) {
        return res.status(400).json({ error: "The Excel file is empty. Please provide data rows to import." });
      }

      // Check for presence of required key columns in sheet
      const firstRow = rawRows[0];
      const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
      const hasCustomer = keys.some(k => k.includes('customer') || k.includes('name'));
      const hasPhone = keys.some(k => k.includes('phone') || k.includes('contact') || k.includes('mobile'));

      if (!hasCustomer || !hasPhone) {
        return res.status(400).json({
          error: "Missing required columns in Excel sheet. The file must contain at least 'Customer Name' and 'Customer Phone Number' columns."
        });
      }

      // Fetch existing repairs to detect duplicate repair numbers
      const existingRepairs = await prisma.repair.findMany({
        select: {
          repairNumber: true,
          customerPhone: true
        }
      });
      const existingRepairNumbers = new Set(existingRepairs.map(r => r.repairNumber.toUpperCase()));

      // Fetch technicians list for matching
      const technicians = await prisma.user.findMany({
        where: { role: 'TECHNICIAN', isActive: true },
        select: { id: true, name: true, email: true }
      });
      const techNameMap = new Map<string, any>();
      technicians.forEach(t => {
        techNameMap.set(t.name.trim().toLowerCase(), t);
        techNameMap.set(t.email.trim().toLowerCase(), t);
      });

      const processedItems: any[] = [];
      const seenRepairNumbersInFile = new Set<string>();

      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const rowNumber = i + 2; // Excel header is row 1
        const raw = rawRows[i];

        const getField = (aliases: string[]) => {
          for (const key of Object.keys(raw)) {
            const cleanKey = key.trim().toLowerCase();
            for (const alias of aliases) {
              if (cleanKey === alias.toLowerCase() || cleanKey.includes(alias.toLowerCase())) {
                return String(raw[key] || '').trim();
              }
            }
          }
          return '';
        };

        const repairNumber = getField(['repair number', 'repairnumber', 'repair_number', 'job number', 'job #']);
        const customerName = getField(['customer name', 'customername', 'name', 'client name']);
        const customerPhone = getField(['customer phone number', 'customer phone', 'phone number', 'phone', 'mobile']);
        const customerEmail = getField(['customer email', 'email address', 'email']);
        const customerAddress = getField(['customer address', 'address', 'location']);
        const deviceBrand = getField(['device brand', 'brand', 'make']);
        const deviceModel = getField(['device model', 'model', 'device']);
        const imeiNumber = getField(['imei number', 'imei', 'serial']);
        const deviceCondition = getField(['device condition', 'condition']) || 'Good';
        const problemDescription = getField(['device problem', 'problem description', 'problem', 'issue', 'fault']) || 'General Device Diagnostic & Repair';
        const accessoriesReceived = getField(['accessories received', 'accessories']) || 'None';
        const rawStatus = getField(['repair status', 'status']) || 'PENDING';
        const assignedTech = getField(['assigned technician', 'technician', 'tech']);
        const rawEstCost = getField(['estimated cost (npr)', 'estimated cost', 'estimated price', 'cost', 'estimate']);
        const rawAdvPaid = getField(['advance paid (npr)', 'advance paid', 'advance', 'paid']);
        const rawTotPaid = getField(['total paid (npr)', 'total paid', 'total']);
        const rawPaymentStatus = getField(['payment status', 'payment']);
        const rawRegDate = getField(['register date', 'registered date', 'created date', 'start date']);
        const rawExpDate = getField(['estimated/service date', 'expected delivery date', 'delivery date', 'service date', 'due date']);
        const remarks = getField(['repair remarks', 'remarks', 'notes']);

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validation 1: Customer Name
        if (!customerName) {
          errors.push("Customer Name is required.");
        }

        // Validation 2: Customer Phone
        if (!customerPhone) {
          errors.push("Customer Phone Number is required.");
        } else if (customerPhone.replace(/\D/g, '').length < 7) {
          errors.push(`Invalid phone number '${customerPhone}'. Must have at least 7 digits.`);
        }

        // Validation 3: Device Brand & Model
        if (!deviceBrand && !deviceModel) {
          errors.push("Device Brand and Model are required.");
        }

        // Validation 4: Repair Status
        const normalizedStatus = normalizeRepairStatus(rawStatus) || 'PENDING';
        if (!VALID_REPAIR_STATUSES.includes(normalizedStatus)) {
          errors.push(`Invalid repair status '${rawStatus}'. Allowed: ${VALID_REPAIR_STATUSES.join(', ')}.`);
        }

        // Validation 5: Technician assignment
        let matchedTech: any = null;
        if (assignedTech) {
          const cleanTech = assignedTech.toLowerCase();
          matchedTech = techNameMap.get(cleanTech);
          if (!matchedTech) {
            for (const [key, t] of techNameMap.entries()) {
              if (key.includes(cleanTech) || cleanTech.includes(key)) {
                matchedTech = t;
                break;
              }
            }
          }
          if (!matchedTech) {
            warnings.push(`Technician '${assignedTech}' was not found in system. Repair will be imported as Unassigned.`);
          }
        }

        // Validation 6: Dates
        let regDate = rawRegDate ? parseExcelDateValue(rawRegDate) : new Date();
        if (!regDate) {
          errors.push(`Invalid register date '${rawRegDate}'. Use DD/MM/YYYY format.`);
          regDate = new Date();
        }

        let expDate = rawExpDate ? parseExcelDateValue(rawExpDate) : null;
        if (rawExpDate && !expDate) {
          warnings.push(`Invalid delivery date '${rawExpDate}'. Will be left empty.`);
        }

        // Validation 7: Financials
        const estimatedCost = parseFloat(rawEstCost.replace(/[^0-9.]/g, '')) || 0;
        const advancePaid = parseFloat(rawAdvPaid.replace(/[^0-9.]/g, '')) || 0;
        const totalPaid = parseFloat(rawTotPaid.replace(/[^0-9.]/g, '')) || advancePaid;
        
        let paymentStatus = 'UNPAID';
        if (rawPaymentStatus) {
          const pUpper = rawPaymentStatus.toUpperCase();
          if (pUpper.includes('PAID') && !pUpper.includes('UN')) {
            paymentStatus = 'PAID';
          } else if (pUpper.includes('PARTIAL')) {
            paymentStatus = 'PARTIAL';
          } else {
            paymentStatus = 'UNPAID';
          }
        } else {
          if (totalPaid >= estimatedCost && estimatedCost > 0) {
            paymentStatus = 'PAID';
          } else if (advancePaid > 0 || totalPaid > 0) {
            paymentStatus = 'PARTIAL';
          } else {
            paymentStatus = 'UNPAID';
          }
        }

        // Validation 8: Duplicate Repair Number Protection
        let isDuplicate = false;
        if (repairNumber) {
          const upperRep = repairNumber.toUpperCase();
          if (existingRepairNumbers.has(upperRep)) {
            isDuplicate = true;
            errors.push(`Duplicate: Repair Number '${repairNumber}' already exists in database.`);
          }
          if (seenRepairNumbersInFile.has(upperRep)) {
            isDuplicate = true;
            errors.push(`Duplicate: Repair Number '${repairNumber}' appears multiple times in Excel file.`);
          }
          seenRepairNumbersInFile.add(upperRep);
        }

        let status: 'VALID' | 'INVALID' | 'DUPLICATE' = 'VALID';
        if (isDuplicate) {
          status = 'DUPLICATE';
          duplicateCount++;
        } else if (errors.length > 0) {
          status = 'INVALID';
          invalidCount++;
        } else {
          status = 'VALID';
          validCount++;
        }

        processedItems.push({
          rowNumber,
          status,
          errors,
          warnings,
          data: {
            repairNumber: repairNumber || undefined,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim() || undefined,
            customerAddress: customerAddress.trim() || undefined,
            deviceBrand: (deviceBrand || 'Smartphone').trim().toUpperCase(),
            deviceModel: (deviceModel || 'Standard Model').trim(),
            imeiNumber: imeiNumber.trim() || undefined,
            deviceCondition: deviceCondition.trim(),
            problemDescription: problemDescription.trim(),
            accessoriesReceived: accessoriesReceived.trim(),
            status: normalizedStatus,
            technicianId: matchedTech?.id || undefined,
            technicianName: matchedTech?.name || undefined,
            estimatedCost,
            advancePaid,
            totalPaid,
            paymentStatus,
            createdAt: regDate.toISOString(),
            expectedCompletionDate: expDate ? expDate.toISOString() : undefined,
            remarks: remarks.trim() || undefined
          }
        });
      }

      res.json({
        success: true,
        totalRows: rawRows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
        items: processedItems
      });
    } catch (err: any) {
      console.error("[IMPORT REPAIRS PREVIEW ERROR]", err);
      res.status(500).json({ error: "Failed to preview Excel file: " + err.message });
    }
  });

  // 4. Confirm & Execute Repairs Excel Import Endpoint
  app.post("/api/repairs/import/confirm", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No valid repair records provided to import." });
      }

      const createdRepairs: any[] = [];
      let skippedCount = 0;

      const defaultBranch = await prisma.branch.findFirst();
      const branchId = req.user.branchId || defaultBranch?.id || 'default-branch';

      for (const item of items) {
        const d = item.data || item;

        if (!d.customerName || !d.customerPhone) {
          skippedCount++;
          continue;
        }

        const normPhone = normalizePhone(d.customerPhone);

        // 1. Find or create Customer without duplicate customer creation
        const customer = await findOrCreateCustomer({
          name: d.customerName.trim(),
          phone: normPhone || d.customerPhone.trim(),
          email: d.customerEmail || null,
          address: d.customerAddress || null
        });

        // 2. Generate or use provided unique repair number
        let repairNumber = d.repairNumber ? String(d.repairNumber).trim() : '';
        if (repairNumber) {
          const existing = await prisma.repair.findUnique({ where: { repairNumber } });
          if (existing) {
            skippedCount++;
            continue;
          }
        } else {
          repairNumber = await generateUniqueRepairNumber();
        }

        const regDate = d.createdAt ? new Date(d.createdAt) : new Date();
        const expDate = d.expectedCompletionDate ? new Date(d.expectedCompletionDate) : null;

        const repair = await prisma.repair.create({
          data: {
            repairNumber,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            customerAddress: customer.address || d.customerAddress || null,
            deviceBrand: d.deviceBrand || 'SMARTPHONE',
            deviceModel: d.deviceModel || 'Model',
            imeiNumber: d.imeiNumber || null,
            deviceCondition: d.deviceCondition || 'Good',
            problemDescription: d.problemDescription || 'General Repair',
            accessoriesReceived: d.accessoriesReceived || 'None',
            estimatedCost: Number(d.estimatedCost || 0),
            advancePaid: Number(d.advancePaid || 0),
            totalPaid: Number(d.totalPaid || 0),
            paymentStatus: d.paymentStatus || 'UNPAID',
            status: d.status || 'PENDING',
            expectedCompletionDate: expDate,
            remarks: d.remarks || null,
            branchId: branchId,
            technicianId: d.technicianId || null,
            createdById: req.user.id,
            createdAt: regDate
          },
          include: {
            customer: true,
            technician: { select: { id: true, name: true, email: true, role: true } },
            createdBy: { select: { id: true, name: true, role: true } },
            branch: true
          }
        });

        // Create initial repair log
        await prisma.repairLog.create({
          data: {
            repairId: repair.id,
            status: repair.status,
            message: `Repair #${repair.repairNumber} registered via Excel Import by ${req.user.name} (${req.user.role}).`
          }
        });

        // Broadcast Real-time & Firestore Sync
        await syncToFirestore("repair", repair);
        broadcastRealtimeEvent({ entity: "repair", action: "CREATE", id: repair.id, data: repair });

        createdRepairs.push(repair);
      }

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "REPAIR_EXCEL_IMPORTED",
          resource: "REPAIR",
          details: `Imported ${createdRepairs.length} repair records from Excel by ${req.user.name} (${req.user.role}). Skipped ${skippedCount} duplicate/invalid records.`,
          metadata: JSON.stringify({
            importedCount: createdRepairs.length,
            skippedCount
          })
        }
      });

      res.status(201).json({
        success: true,
        message: `Successfully imported ${createdRepairs.length} repair records.`,
        importedCount: createdRepairs.length,
        skippedCount,
        repairs: createdRepairs
      });
    } catch (err: any) {
      console.error("[CONFIRM REPAIR IMPORT ERROR]", err);
      res.status(500).json({ error: "Failed to complete Excel repair import: " + err.message });
    }
  });

  app.get("/api/repairs/:id", authenticate, syncRouteMiddleware(['repair', 'repairLog', 'technicianNote', 'payment', 'user', 'branch']), async (req: any, res) => {
    try {
      const repair = await prisma.repair.findUnique({
        where: { id: req.params.id },
        include: {
          technician: { select: { id: true, name: true, role: true } },
          customer: { select: { id: true, customerId: true, name: true, phone: true, email: true, address: true, district: true, municipality: true, landmark: true } },
          createdBy: { select: { name: true } },
          logs: { orderBy: { createdAt: "desc" } },
          notes: { include: { technician: { select: { name: true } } } },
          batteryWarranty: true
        }
      });
      if (!repair) return res.status(404).json({ error: "Repair not found" });
      res.json(repair);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch repair details" });
    }
  });

  // ==========================================
  // CUSTOMER MANAGEMENT ENDPOINTS
  // ==========================================

  // List all customers with pagination & statistics
  app.get("/api/customers", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), syncRouteMiddleware(['repair', 'user']), async (req: any, res) => {
    try {
      const { search, sortBy, sortOrder } = req.query;
      const requestedPage = Number.parseInt(String(req.query.page || '1'), 10);
      const requestedLimit = Number.parseInt(String(req.query.limit || '24'), 10);
      const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
      const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(5, requestedLimit)) : 24;
      const where: any = {};
      const includeArchived = String(req.query.includeArchived || '') === 'true' || String(req.query.includeArchived || '') === '1';
      if (!includeArchived) {
        where.archived = false;
      }

      if (search && String(search).trim()) {
        const searchStr = String(search).trim();
        const searchNormPhone = normalizePhone(searchStr);
        where.OR = [
          { name: { contains: searchStr } },
          { customerId: { contains: searchStr } },
          { phone: { contains: searchStr } },
          ...(searchNormPhone ? [{ phone: { contains: searchNormPhone } }] : []),
          { email: { contains: searchStr } },
          { address: { contains: searchStr } },
          // The Customer Hub advertises repair-number search. Keep it on the
          // primary list endpoint so debounced searching returns the same data
          // as the dedicated cross-table lookup endpoint.
          {
            repairs: {
              some: {
                OR: [
                  { repairNumber: { contains: searchStr } },
                  { imeiNumber: { contains: searchStr } },
                  { deviceBrand: { contains: searchStr } },
                  { deviceModel: { contains: searchStr } }
                ]
              }
            }
          }
        ];
      }

      let orderBy: any = { createdAt: "desc" };
      const order = sortOrder === "asc" ? "asc" : "desc";
      if (sortBy === "name") orderBy = { name: order };
      else if (sortBy === "customerId") orderBy = { customerId: order };
      else if (sortBy === "phone") orderBy = { phone: order };
      else if (sortBy === "updatedAt") orderBy = { updatedAt: order };

      const [total, customers] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            // The hub only displays the most recent repair. Loading every repair
            // for every customer made this endpoint grow linearly with history.
            repairs: {
              select: {
                id: true, repairNumber: true, deviceBrand: true, deviceModel: true,
                status: true, createdAt: true, updatedAt: true
              },
              orderBy: { createdAt: "desc" },
              take: 1
            },
            _count: { select: { repairs: true } }
          }
        })
      ]);

      const customerIds = customers.map(customer => customer.id);
      const repairStats = customerIds.length ? await prisma.repair.groupBy({
        by: ['customerId', 'status'],
        where: { customerId: { in: customerIds } },
        _count: { _all: true },
        _sum: { totalPaid: true, advancePaid: true }
      }) : [];
      const statsByCustomer = new Map<string, { activeRepairs: number; totalSpent: number }>();
      for (const stat of repairStats) {
        if (!stat.customerId) continue;
        const current = statsByCustomer.get(stat.customerId) || { activeRepairs: 0, totalSpent: 0 };
        if (!['DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(stat.status)) {
          current.activeRepairs += stat._count._all;
        }
        current.totalSpent += stat._sum.totalPaid || stat._sum.advancePaid || 0;
        statsByCustomer.set(stat.customerId, current);
      }

      const enriched = customers.map(c => {
        const stats = statsByCustomer.get(c.id) || { activeRepairs: 0, totalSpent: 0 };
        return {
          ...c,
          totalRepairs: c._count.repairs,
          activeRepairs: stats.activeRepairs,
          totalSpent: stats.totalSpent,
          latestRepair: c.repairs[0] || null
        };
      });

      res.json({
        customers: enriched,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      });
    } catch (err: any) {
      console.error("[GET CUSTOMERS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch customers list" });
    }
  });

  // Fast Customer Lookup (for receptionist autocomplete during repair intake)
  app.get("/api/customers/lookup", authenticate, async (req: any, res) => {
    try {
      const { phone, name, query } = req.query;
      const searchStr = String(query || phone || name || "").trim();
      if (!searchStr) {
        return res.json([]);
      }

      const searchNormPhone = normalizePhone(searchStr);

      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { phone: { contains: searchStr } },
            ...(searchNormPhone ? [{ phone: { contains: searchNormPhone } }] : []),
            { alternativePhone: { contains: searchStr } },
            ...(searchNormPhone ? [{ alternativePhone: { contains: searchNormPhone } }] : []),
            { name: { contains: searchStr } },
            { customerId: { contains: searchStr } },
            { email: { contains: searchStr } }
          ]
        },
        take: 10,
        include: {
          repairs: {
            select: {
              id: true,
              repairNumber: true,
              deviceBrand: true,
              deviceModel: true,
              status: true,
              createdAt: true
            },
            orderBy: { createdAt: "desc" },
            take: 5
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      // Enrich with repair counts
      const enriched = await Promise.all(customers.map(async (c) => {
        const totalRepairs = await prisma.repair.count({ where: { customerId: c.id } });
        const activeRepairs = await prisma.repair.count({
          where: { customerId: c.id, status: { notIn: ['DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'] } }
        });
        return { ...c, totalRepairs, activeRepairs };
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error("[CUSTOMER LOOKUP ERROR]", err);
      res.status(500).json({ error: "Customer lookup failed" });
    }
  });

  // Cross-table Customer Search (by IMEI, device model, repair number)
  app.get("/api/customers/search", authenticate, async (req: any, res) => {
    try {
      const { q } = req.query;
      const searchStr = String(q || "").trim();
      if (!searchStr || searchStr.length < 3) {
        return res.json([]);
      }
      const searchNormPhone = normalizePhone(searchStr);

      // First search repairs by IMEI / repairNumber / device model
      const repairMatches = await prisma.repair.findMany({
        where: {
          OR: [
            { repairNumber: { contains: searchStr } },
            { imeiNumber: { contains: searchStr } },
            { deviceModel: { contains: searchStr } },
            { deviceBrand: { contains: searchStr } },
            { customerName: { contains: searchStr } },
            { customerPhone: { contains: searchStr } },
            ...(searchNormPhone ? [{ customerPhone: { contains: searchNormPhone } }] : [])
          ]
        },
        select: { customerId: true },
        take: 20
      });

      const customerIdsFromRepairs = [...new Set(
        repairMatches.map(r => r.customerId).filter(Boolean)
      )] as string[];

      // Also search customer table directly
      const directCustomers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: searchStr } },
            { phone: { contains: searchStr } },
            ...(searchNormPhone ? [{ phone: { contains: searchNormPhone } }] : []),
            { alternativePhone: { contains: searchStr } },
            { customerId: { contains: searchStr } },
            { email: { contains: searchStr } },
            ...(customerIdsFromRepairs.length ? [{ id: { in: customerIdsFromRepairs } }] : [])
          ]
        },
        take: 15,
        include: {
          repairs: {
            select: { id: true, repairNumber: true, deviceBrand: true, deviceModel: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 3
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      const enriched = directCustomers.map(c => ({
        ...c,
        totalRepairs: c.repairs.length,
        activeRepairs: c.repairs.filter(r => !['DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status)).length,
        latestRepair: c.repairs[0] || null
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error("[CUSTOMER SEARCH ERROR]", err);
      res.status(500).json({ error: "Customer search failed" });
    }
  });

  // Get specific customer profile (repairs paginated separately)
  app.get("/api/customers/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), syncRouteMiddleware(['repair', 'repairLog', 'payment']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { id },
            { customerId: id }
          ]
        }
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer record not found" });
      }

      // Always include aggregate stats
      const [totalRepairs, activeRepairsCount, completedRepairs, cancelledRepairs, latestRepair] = await Promise.all([
        prisma.repair.count({ where: { customerId: customer.id } }),
        prisma.repair.count({ where: { customerId: customer.id, status: { notIn: ['DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'] } } }),
        prisma.repair.count({ where: { customerId: customer.id, status: { in: ['DELIVERED', 'REPAIRED'] } } }),
        prisma.repair.count({ where: { customerId: customer.id, status: { in: ['CANCELLED', 'CANNOT_REPAIR'] } } }),
        prisma.repair.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, repairNumber: true, deviceBrand: true, deviceModel: true, status: true, createdAt: true }
        })
      ]);

      const totalSpent = await prisma.payment.aggregate({
        where: { repair: { customerId: customer.id } },
        _sum: { amount: true }
      });

      res.json({
        ...customer,
        totalRepairs,
        activeRepairsCount,
        completedRepairs,
        cancelledRepairs,
        totalSpent: totalSpent._sum.amount || 0,
        latestRepair
      });
    } catch (err: any) {
      console.error("[GET CUSTOMER DETAILS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch customer profile" });
    }
  });

  // Paginated repair history for a specific customer
  app.get("/api/customers/:id/repairs", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || '20'), 10)));
      const skip = (page - 1) * limit;
      const { status, dateFrom, dateTo } = req.query;

      // Resolve customer by id or customerId
      const customer = await prisma.customer.findFirst({
        where: { OR: [{ id }, { customerId: id }] },
        select: { id: true }
      });
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const where: any = { customerId: customer.id };
      if (status && status !== 'ALL') {
        if (status === 'ACTIVE') {
          where.status = { notIn: ['DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'] };
        } else if (status === 'COMPLETED') {
          where.status = { in: ['DELIVERED', 'REPAIRED'] };
        } else if (status === 'CANCELLED') {
          where.status = { in: ['CANCELLED', 'CANNOT_REPAIR'] };
        } else {
          where.status = String(status);
        }
      }
      if (dateFrom) where.createdAt = { ...(where.createdAt || {}), gte: new Date(String(dateFrom)) };
      if (dateTo) where.createdAt = { ...(where.createdAt || {}), lte: new Date(String(dateTo)) };

      const [total, repairs] = await Promise.all([
        prisma.repair.count({ where }),
        prisma.repair.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            technician: { select: { id: true, name: true, role: true } },
            batteryWarranty: { select: { id: true, warrantyNumber: true, status: true, expiryDate: true, warrantyPeriod: true } },
            payments: { select: { id: true, amount: true, method: true, createdAt: true } }
          }
        })
      ]);

      res.json({
        repairs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      });
    } catch (err: any) {
      console.error("[GET CUSTOMER REPAIRS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch customer repair history" });
    }
  });

  // Create or update customer directly
  app.post("/api/customers", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { name, phone, alternativePhone, email, district, municipality, address, landmark, notes, id } = req.body;
      if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
        return res.status(400).json({ error: "Customer Name and Phone Number are required" });
      }

      const normalizedPhone = normalizePhone(String(phone));
      if (normalizedPhone.length < 7 || normalizedPhone.length > 15 || /[^\d\s+()\-]/.test(String(phone))) {
        return res.status(400).json({ error: "Please enter a valid phone number (7–15 digits)." });
      }
      const FIELD_LIMITS: Record<string, number> = {
        name: 120, phone: 20, alternativePhone: 20, email: 160,
        district: 80, municipality: 120, address: 300, landmark: 160, notes: 1000,
      };
      for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
        const value = req.body[field];
        if (value !== undefined && value !== null && String(value).length > limit) {
          return res.status(400).json({ error: `The ${field} field is too long (maximum ${limit} characters).` });
        }
      }

      const customer = await findOrCreateCustomer({
        id,
        name: String(name).trim(),
        phone: normalizedPhone,
        alternativePhone,
        email,
        district,
        municipality,
        address,
        landmark,
        notes
      });

      // A standalone customer create/update has no repair event to refresh other
      // Customer Hub sessions, so publish and synchronize it explicitly.
      broadcastRealtimeEvent({ entity: "customer", action: id ? "UPDATE" : "CREATE", id: customer.id, data: customer });
      await syncToFirestore("customer", customer);
      await syncToRtdb("customer", id ? "UPDATE" : "CREATE", customer);

      res.status(200).json(customer);
    } catch (err: any) {
      console.error("[SAVE CUSTOMER ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to save customer" });
    }
  });

  // Update customer details (supports all profile fields)
  app.patch("/api/customers/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, phone, alternativePhone, email, district, municipality, address, landmark, notes } = req.body;

      // --- Input validation (authoritative; backend never trusts client role) ---
      if (name !== undefined && (!name || !String(name).trim())) {
        return res.status(400).json({ error: "Customer name cannot be empty." });
      }
      if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
        const normPhone = normalizePhone(phone);
        if (normPhone.length < 7 || normPhone.length > 15) {
          return res.status(400).json({ error: "Please enter a valid phone number (7–15 digits)." });
        }
        if (/[^\d\s+()\-]/.test(phone)) {
          return res.status(400).json({ error: "Phone number contains invalid characters." });
        }
      }
      const FIELD_LIMITS: Record<string, number> = {
        name: 120, phone: 20, alternativePhone: 20, email: 160,
        district: 80, municipality: 120, address: 300, landmark: 160, notes: 1000,
      };
      for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
        const val = (req.body as any)[field];
        if (val !== undefined && val !== null && String(val).length > limit) {
          return res.status(400).json({ error: `The ${field} field is too long (maximum ${limit} characters).` });
        }
      }

      const normPhone = phone ? normalizePhone(phone) : undefined;
      const normAltPhone = alternativePhone ? normalizePhone(alternativePhone) : undefined;

      const customer = await prisma.customer.update({
        where: { id },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(normPhone ? { phone: normPhone } : {}),
          ...(alternativePhone !== undefined ? { alternativePhone: normAltPhone || (alternativePhone ? alternativePhone.trim() : null) } : {}),
          ...(email !== undefined ? { email: email ? email.trim() : null } : {}),
          ...(district !== undefined ? { district: district ? district.trim() : null } : {}),
          ...(municipality !== undefined ? { municipality: municipality ? municipality.trim() : null } : {}),
          ...(address !== undefined ? { address: address ? address.trim() : null } : {}),
          ...(landmark !== undefined ? { landmark: landmark ? landmark.trim() : null } : {}),
          ...(notes !== undefined ? { notes: notes ? notes.trim() : null } : {})
        }
      });

      // Also update denormalized fields across existing repairs for consistency
      if (name || normPhone || email !== undefined || address !== undefined) {
        await prisma.repair.updateMany({
          where: { customerId: customer.id },
          data: {
            ...(name ? { customerName: customer.name } : {}),
            ...(normPhone ? { customerPhone: customer.phone } : {}),
            ...(email !== undefined ? { customerEmail: customer.email } : {}),
            ...(address !== undefined ? { customerAddress: customer.address } : {})
          }
        });
      }

      broadcastRealtimeEvent({
        entity: "customer",
        action: "UPDATE",
        id: customer.id,
        data: { id: customer.id, name: customer.name, phone: customer.phone }
      });
      await syncToFirestore("customer", customer);
      await syncToRtdb("customer", "UPDATE", customer);

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            userRole: req.user.role,
            action: "EDIT_CUSTOMER",
            resource: "CUSTOMER",
            resourceId: customer.id,
            details: `Updated customer profile for ${customer.name}`
          }
        });
      } catch (auditErr) { /* non-blocking */ }

      res.json(customer);
    } catch (err: any) {
      console.error("[PATCH CUSTOMER ERROR]", err);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Soft-archive a customer (preserves all repair / warranty / courier history)
  app.post("/api/customers/:id/archive", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) {
        return res.status(404).json({ error: "Customer record not found." });
      }
      if (customer.archived) {
        return res.status(409).json({ error: "Customer is already archived." });
      }
      const updated = await prisma.customer.update({
        where: { id },
        data: { archived: true, archivedAt: new Date(), archivedBy: req.user.name || req.user.email || req.user.id }
      });
      broadcastRealtimeEvent({ entity: "customer", action: "UPDATE", id, data: { id, archived: true, name: customer.name } });
      await syncToFirestore("customer", updated);
      await syncToRtdb("customer", "UPDATE", updated);
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id, userEmail: req.user.email, userName: req.user.name, userRole: req.user.role,
            action: "ARCHIVE_CUSTOMER", resource: "CUSTOMER", resourceId: id,
            details: `Archived customer ${customer.name} (${customer.phone}). Linked repair and warranty records preserved.`
          }
        });
      } catch (auditErr) { /* non-blocking */ }
      res.json({ success: true, message: "Customer archived successfully.", customer: updated });
    } catch (err: any) {
      console.error("[ARCHIVE CUSTOMER ERROR]", err);
      res.status(500).json({ error: "Failed to archive customer: " + (err.message || err) });
    }
  });

  // Restore a previously archived customer
  app.post("/api/customers/:id/restore", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) {
        return res.status(404).json({ error: "Customer record not found." });
      }
      if (!customer.archived) {
        return res.status(409).json({ error: "Customer is not archived." });
      }
      const updated = await prisma.customer.update({
        where: { id },
        data: { archived: false, archivedAt: null, archivedBy: null }
      });
      broadcastRealtimeEvent({ entity: "customer", action: "UPDATE", id, data: { id, archived: false, name: customer.name } });
      await syncToFirestore("customer", updated);
      await syncToRtdb("customer", "UPDATE", updated);
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id, userEmail: req.user.email, userName: req.user.name, userRole: req.user.role,
            action: "RESTORE_CUSTOMER", resource: "CUSTOMER", resourceId: id,
            details: `Restored (un-archived) customer ${customer.name} (${customer.phone}).`
          }
        });
      } catch (auditErr) { /* non-blocking */ }
      res.json({ success: true, message: "Customer restored successfully.", customer: updated });
    } catch (err: any) {
      console.error("[RESTORE CUSTOMER ERROR]", err);
      res.status(500).json({ error: "Failed to restore customer: " + (err.message || err) });
    }
  });

  // ==========================================
  // REPAIR REGISTRATION ENDPOINTS (SINGLE & BATCH)
  // ==========================================

  // Single Repair Registration
  app.post("/api/repairs", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { 
        customerId: incomingCustomerId, 
        customerName, 
        customerPhone, 
        customerAlternativePhone,
        customerEmail, 
        customerDistrict,
        customerMunicipality,
        customerAddress,
        customerLandmark,
        customerNotes,
        technicianId, 
        branchId: incomingBranchId,
        hasBatteryWarranty,
        batteryWarrantyPeriod,
        batteryType,
        receivingMethod,
        isCourierIn: explicitCourierIn,
        courierCompany,
        courierTrackingNumber,
        courierDate,
        courierReceivedDate,
        senderName,
        senderPhone,
        originDistrict,
        originAddress,
        courierNotes,
        deviceColor,
        conditionNotes,
        ...rawRepairData 
      } = req.body;

      if (!customerName || !customerPhone) {
        return res.status(400).json({ error: "Customer Name and Phone Number are required." });
      }

      const normalizedPhone = normalizePhone(customerPhone || "");

      // 1. Find or create the Customer record with single-customer deduplication
      const customer = await findOrCreateCustomer({
        id: incomingCustomerId,
        name: customerName,
        phone: normalizedPhone || customerPhone,
        alternativePhone: customerAlternativePhone,
        email: customerEmail,
        district: customerDistrict,
        municipality: customerMunicipality,
        address: customerAddress,
        landmark: customerLandmark,
        notes: customerNotes
      });

      // 2. Validate technician if provided
      if (technicianId) {
        const technician = await prisma.user.findUnique({ where: { id: technicianId } });
        if (!technician || (technician.role !== 'TECHNICIAN' && technician.role !== 'LEAD_TECHNICIAN')) {
          return res.status(400).json({ error: "Invalid technician ID" });
        }
      }

      // 3. Generate standardized unique repair number
      const repairNumber = await generateUniqueRepairNumber();

      // 4. Determine Branch
      let branchId = incomingBranchId;
      if (!branchId) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        branchId = user?.branchId;
      }
      if (!branchId) {
        let branch = await prisma.branch.findFirst();
        if (!branch) {
          branch = await prisma.branch.create({
            data: {
              name: "Kathmandu Central Hub",
              location: "New Road, Kathmandu",
              phone: "986927668, 015364307"
            }
          });
        }
        branchId = branch.id;
      }

      const isCourier = receivingMethod === "COURIER" || explicitCourierIn === true || Boolean(courierCompany || courierTrackingNumber);
      const isCourierIn = isCourier;
      const initialReceivingMethod = isCourier ? "COURIER" : "WALK_IN";
      const initialCourierStatus = isCourier ? "RECEIVED_AT_LAB" : null;

      const estimatedCost = rawRepairData.estimatedCost === "" || rawRepairData.estimatedCost == null || isNaN(Number(rawRepairData.estimatedCost))
        ? null
        : Number(rawRepairData.estimatedCost);
      const advancePaid = rawRepairData.advancePaid === "" || rawRepairData.advancePaid == null || isNaN(Number(rawRepairData.advancePaid))
        ? 0
        : Number(rawRepairData.advancePaid);

      const paymentStatus = estimatedCost !== null && estimatedCost > 0 && advancePaid >= estimatedCost
        ? "PAID"
        : advancePaid > 0
          ? "PARTIAL"
          : "UNPAID";

      const repair = await prisma.repair.create({
        data: {
          repairNumber,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          customerAddress: customer.address,
          deviceBrand: rawRepairData.deviceBrand || "Generic",
          deviceModel: rawRepairData.deviceModel || "Device",
          imeiNumber: rawRepairData.imeiNumber || null,
          deviceColor: deviceColor || null,
          deviceCondition: sanitizeDeviceCondition(rawRepairData.deviceCondition),
          conditionNotes: conditionNotes || null,
          problemDescription: rawRepairData.problemDescription || 'Diagnostics requested',
          accessoriesReceived: sanitizeAccessoriesReceived(rawRepairData.accessoriesReceived),
          estimatedCost,
          advancePaid,
          totalPaid: advancePaid,
          paymentStatus,
          status: rawRepairData.status || 'RECEIVED',
          priority: rawRepairData.priority || 'NORMAL',
          remarks: rawRepairData.remarks || null,
          partsUsed: rawRepairData.partsUsed || null,
          repairImages: rawRepairData.repairImages || null,
          technicianId: technicianId || null,
          assignedAt: technicianId ? new Date() : null,
          assignedById: technicianId ? req.user.id : null,
          assignedByName: technicianId ? (req.user.name || req.user.role) : null,
          managerUpdatedAt: new Date(),
          managerUpdatedBy: req.user.name || req.user.role,
          createdById: req.user.id,
          branchId: branchId,
          expectedCompletionDate: rawRepairData.expectedCompletionDate ? new Date(rawRepairData.expectedCompletionDate) : null,

          // Courier-In Information
          receivingMethod: initialReceivingMethod,
          isCourierIn,
          courierCompany: isCourier ? (courierCompany || null) : null,
          courierTrackingNumber: isCourier ? (courierTrackingNumber || null) : null,
          courierDate: courierDate ? new Date(courierDate) : (isCourier ? new Date() : null),
          courierReceivedDate: courierReceivedDate ? new Date(courierReceivedDate) : (isCourier ? new Date() : null),
          senderName: isCourier ? (senderName || customer.name) : null,
          senderPhone: isCourier ? (senderPhone || customer.phone) : null,
          originDistrict: isCourier ? (originDistrict || customer.district || null) : null,
          originAddress: isCourier ? (originAddress || customer.address || null) : null,
          courierNotes: isCourier ? (courierNotes || null) : null,
          courierStatus: initialCourierStatus
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true } },
          batteryWarranty: true
        }
      });

      // Handle Optional Battery Replacement Warranty
      let createdWarranty: any = null;
      if (hasBatteryWarranty === true || String(hasBatteryWarranty) === "true") {
        const period = batteryWarrantyPeriod === "1_YEAR" ? "1_YEAR" : "6_MONTHS";
        const bType = batteryType || "Original Replacement Battery";
        const registrationDate = new Date();
        const expiryDate = calculateWarrantyExpiryDate(registrationDate, period);
        const warrantyNumber = await generateUniqueWarrantyNumber();

        createdWarranty = await prisma.batteryWarranty.create({
          data: {
            warrantyNumber,
            repairId: repair.id,
            repairNumber: repair.repairNumber,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email || null,
            customerAddress: customer.address || null,
            deviceBrand: repair.deviceBrand,
            deviceModel: repair.deviceModel,
            imeiNumber: repair.imeiNumber || null,
            batteryType: bType,
            warrantyPeriod: period,
            registrationDate,
            expiryDate,
            status: "ACTIVE",
            claimCount: 0,
            terms: "Warranty covers battery performance, failure to retain charge, or premature degradation according to MTS Lab terms. Accidental physical damage or liquid ingress is excluded.",
            createdById: req.user.id,
            branchId: branchId
          }
        });

        await syncToFirestore("batteryWarranty", createdWarranty);
        broadcastRealtimeEvent({ entity: "batteryWarranty", action: "CREATE", id: createdWarranty.id, data: createdWarranty });
      }

      // Record initial repair log
      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: repair.status,
          message: `Device registered into lab intake for ${customer.name} (Customer ID: ${customer.customerId}). Receiving Method: ${initialReceivingMethod}${isCourier ? ` (Courier: ${courierCompany || 'Partner'} • Tracking: ${courierTrackingNumber || 'N/A'})` : ''}.${createdWarranty ? ` Registered Battery Warranty: ${createdWarranty.warrantyNumber} (${createdWarranty.warrantyPeriod === '1_YEAR' ? '1 Year' : '6 Months'}).` : ''}`
        }
      });

      // If assigned to a technician upon intake, send real-time notification
      if (repair.technicianId) {
        const isUrgent = repair.priority === 'URGENT';
        const isHigh = repair.priority === 'HIGH';
        const priorityLabel = isUrgent ? "High Priority" : (isHigh ? "Priority" : "Normal");
        let notifTitle = "🔔 New Repair Assigned";
        let notifType = "REPAIR_ASSIGNED";
        if (isUrgent) {
          notifTitle = "🚨 High Priority Repair Assigned";
          notifType = "REPAIR_URGENT";
        } else if (isHigh) {
          notifTitle = "🟠 Priority Repair Assigned";
          notifType = "REPAIR_ALERT";
        }

        await sendSystemNotification({
          userId: repair.technicianId,
          title: notifTitle,
          message: `${notifTitle}: Job #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}) assigned to you by ${req.user.name || req.user.role}. Priority: ${priorityLabel}. Problem: ${repair.problemDescription || 'Inspection required'}`,
          type: notifType,
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            assignedAt: new Date().toISOString(),
            priority: repair.priority,
            priorityLabel,
            isUrgent,
            isHigh,
            problemDescription: repair.problemDescription,
            deviceBrand: repair.deviceBrand,
            deviceModel: repair.deviceModel
          }
        });
      }

      // Record initial payment record if advance was paid
      if (advancePaid > 0) {
        await prisma.payment.create({
          data: {
            repairId: repair.id,
            amount: advancePaid,
            method: "CASH",
            reference: `ADV-${repair.repairNumber}`
          }
        });
      }

      // Sync to Firestore for public tracking
      if (!firestoreSyncDisabled) {
        try {
          const firestore = getDb();
          await firestore.collection('repairs').doc(repair.id).set({
            ...repair,
            customerId: customer.customerId,
            createdAt: repair.createdAt.toISOString(),
            updatedAt: repair.updatedAt.toISOString(),
            expectedCompletionDate: repair.expectedCompletionDate ? repair.expectedCompletionDate.toISOString() : null,
          });
        } catch (fErr: any) {
          if (fErr?.code === 7 || fErr?.message?.includes("PERMISSION_DENIED") || fErr?.status === 7) {
            firestoreSyncDisabled = true;
          }
        }
      }

      broadcastRealtimeEvent({ entity: "repair", action: "CREATE", id: repair.id, data: repair });

      res.status(201).json({
        ...repair,
        batteryWarranty: createdWarranty
      });
    } catch (err: any) {
      console.error("[CREATE REPAIR ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to register repair" });
    }
  });

  // Batch Multi-Device Registration for a Single Customer Visit
  app.post("/api/repairs/batch", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { customer: customerData, devices, branchId: incomingBranchId } = req.body;

      if (!customerData || !customerData.name || !customerData.phone) {
        return res.status(400).json({ error: "Customer Name and Phone Number are required." });
      }

      if (!Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({ error: "At least one device must be added to register repairs." });
      }

      const normalizedPhone = normalizePhone(customerData.phone || "");

      // 1. Find or create Customer
      const customer = await findOrCreateCustomer({
        id: customerData.id,
        name: customerData.name,
        phone: normalizedPhone || customerData.phone,
        alternativePhone: customerData.alternativePhone,
        email: customerData.email,
        district: customerData.district,
        municipality: customerData.municipality,
        address: customerData.address,
        landmark: customerData.landmark,
        notes: customerData.notes
      });

      // 2. Determine Branch
      let branchId = incomingBranchId;
      if (!branchId) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        branchId = user?.branchId;
      }
      if (!branchId) {
        let branch = await prisma.branch.findFirst();
        if (!branch) {
          branch = await prisma.branch.create({
            data: {
              name: "Kathmandu Central Hub",
              location: "New Road, Kathmandu",
              phone: "986927668, 015364307"
            }
          });
        }
        branchId = branch.id;
      }

      const createdRepairs: any[] = [];

      // Process all devices sequentially
      for (const device of devices) {
        const repairNumber = await generateUniqueRepairNumber();
        const isCourier = device.receivingMethod === "COURIER" || device.isCourierIn === true || Boolean(device.courierCompany || device.courierTrackingNumber);
        const initialReceivingMethod = isCourier ? "COURIER" : "WALK_IN";
        const initialCourierStatus = isCourier ? "RECEIVED_AT_LAB" : null;

        const estimatedCost = device.estimatedCost === "" || device.estimatedCost == null || isNaN(Number(device.estimatedCost))
          ? null
          : Number(device.estimatedCost);
        const advancePaid = device.advancePaid === "" || device.advancePaid == null || isNaN(Number(device.advancePaid))
          ? 0
          : Number(device.advancePaid);

        const paymentStatus = estimatedCost !== null && estimatedCost > 0 && advancePaid >= estimatedCost
          ? "PAID"
          : advancePaid > 0
            ? "PARTIAL"
            : "UNPAID";

        const repair = await prisma.repair.create({
          data: {
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            customerAddress: customer.address,
            repairNumber,
            deviceBrand: device.deviceBrand || "other",
            deviceModel: device.deviceModel,
            imeiNumber: device.imeiNumber || null,
            deviceColor: device.deviceColor || null,
            deviceCondition: sanitizeDeviceCondition(device.deviceCondition),
            conditionNotes: device.conditionNotes || null,
            problemDescription: device.problemDescription || "Inspection required",
            accessoriesReceived: sanitizeAccessoriesReceived(device.accessoriesReceived),
            estimatedCost,
            advancePaid,
            totalPaid: advancePaid,
            paymentStatus,
            technicianId: device.technicianId || null,
            assignedAt: device.technicianId ? new Date() : null,
            assignedById: device.technicianId ? req.user.id : null,
            assignedByName: device.technicianId ? (req.user.name || req.user.role) : null,
            managerUpdatedAt: new Date(),
            managerUpdatedBy: req.user.name || req.user.role,
            createdById: req.user.id,
            branchId: branchId,
            status: device.status || 'RECEIVED',
            expectedCompletionDate: device.expectedCompletionDate ? new Date(device.expectedCompletionDate) : null,
            remarks: device.remarks || null,

            // Courier-In
            receivingMethod: initialReceivingMethod,
            isCourierIn: isCourier,
            courierCompany: isCourier ? (device.courierCompany || null) : null,
            courierTrackingNumber: isCourier ? (device.courierTrackingNumber || null) : null,
            courierDate: device.courierDate ? new Date(device.courierDate) : (isCourier ? new Date() : null),
            courierReceivedDate: device.courierReceivedDate ? new Date(device.courierReceivedDate) : (isCourier ? new Date() : null),
            senderName: isCourier ? (device.senderName || customer.name) : null,
            senderPhone: isCourier ? (device.senderPhone || customer.phone) : null,
            originDistrict: isCourier ? (device.originDistrict || customer.district || null) : null,
            originAddress: isCourier ? (device.originAddress || customer.address || null) : null,
            courierNotes: isCourier ? (device.courierNotes || null) : null,
            courierStatus: initialCourierStatus
          },
          include: {
            customer: true,
            technician: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true } }
          }
        });

        // Handle Optional Battery Replacement Warranty for this device
        let createdWarranty: any = null;
        if (device.hasBatteryWarranty === true || String(device.hasBatteryWarranty) === "true") {
          const period = device.batteryWarrantyPeriod === "1_YEAR" ? "1_YEAR" : "6_MONTHS";
          const bType = device.batteryType || "Original Replacement Battery";
          const registrationDate = new Date();
          const expiryDate = calculateWarrantyExpiryDate(registrationDate, period);
          const warrantyNumber = await generateUniqueWarrantyNumber();

          createdWarranty = await prisma.batteryWarranty.create({
            data: {
              warrantyNumber,
              repairId: repair.id,
              repairNumber: repair.repairNumber,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              customerEmail: customer.email || null,
              customerAddress: customer.address || null,
              deviceBrand: repair.deviceBrand,
              deviceModel: repair.deviceModel,
              imeiNumber: repair.imeiNumber || null,
              batteryType: bType,
              warrantyPeriod: period,
              registrationDate,
              expiryDate,
              status: "ACTIVE",
              claimCount: 0,
              terms: "Warranty covers battery performance, failure to retain charge, or premature degradation according to MTS Lab terms. Accidental physical damage or liquid ingress is excluded.",
              createdById: req.user.id,
              branchId: branchId
            }
          });

          await syncToFirestore("batteryWarranty", createdWarranty);
          broadcastRealtimeEvent({ entity: "batteryWarranty", action: "CREATE", id: createdWarranty.id, data: createdWarranty });
        }

        // Record Initial Log
        await prisma.repairLog.create({
          data: {
            repairId: repair.id,
            status: repair.status,
            message: `Device (${repair.deviceBrand.toUpperCase()} ${repair.deviceModel}) registered in multi-device intake for customer ${customer.name} (${customer.customerId}). Receiving Method: ${initialReceivingMethod}${isCourier ? ` (Courier: ${device.courierCompany || 'Partner'} • Tracking: ${device.courierTrackingNumber || 'N/A'})` : ''}.${createdWarranty ? ` Registered Battery Warranty: ${createdWarranty.warrantyNumber} (${createdWarranty.warrantyPeriod === '1_YEAR' ? '1 Year' : '6 Months'}).` : ''}`
          }
        });

        // Record advance payment if present
        if (advancePaid > 0) {
          await prisma.payment.create({
            data: {
              repairId: repair.id,
              amount: advancePaid,
              method: "CASH",
              reference: `ADV-${repair.repairNumber}`
            }
          });
        }

        // Realtime broadcast & Firebase sync
        broadcastRealtimeEvent({ entity: "repair", action: "CREATE", id: repair.id, data: repair });
        syncToFirestore('repair', repair).catch(() => {});

        createdRepairs.push({
          ...repair,
          batteryWarranty: createdWarranty
        });
      }

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "BATCH_REGISTER_REPAIRS",
          resource: "REPAIR",
          resourceId: customer.id,
          details: `Registered ${createdRepairs.length} devices simultaneously for customer ${customer.name} (${customer.customerId}). Repair Numbers: ${createdRepairs.map(r => r.repairNumber).join(", ")}`
        }
      });

      res.status(201).json({
        success: true,
        customer,
        repairs: createdRepairs,
        totalRegistered: createdRepairs.length,
        message: `Successfully registered ${createdRepairs.length} devices for ${customer.name}.`
      });
    } catch (err: any) {
      console.error("[BATCH CREATE REPAIR ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to process batch repair registration." });
    }
  });

  // ==========================================
  // COURIER HUB & LOGISTICS MANAGEMENT ENDPOINTS
  // ==========================================

  // List all courier shipments with filtering, search, and pagination
  app.get("/api/couriers", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), syncRouteMiddleware(['repair', 'customer']), async (req: any, res) => {
    try {
      const { 
        type = 'ALL', 
        status, 
        search, 
        courierCompany,
        district,
        paymentStatus,
        dateRange = 'ALL', 
        startDate, 
        endDate, 
        sortBy = 'latest',
        page = 1, 
        limit = 50,
        includeArchived = false
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page)) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (!includeArchived || String(includeArchived) !== 'true') {
        where.courierArchived = false;
      }

      // Courier Type / Direction filtering
      const upperType = String(type).toUpperCase();
      if (upperType === 'INCOMING') {
        where.isCourierIn = true;
      } else if (upperType === 'OUTGOING') {
        where.OR = [
          { isCourierOut: true },
          { isReturnCourierDispatched: true },
          { courierStatus: { not: null } }
        ];
      } else {
        where.OR = [
          { isCourierIn: true },
          { isCourierOut: true },
          { isReturnCourierDispatched: true },
          { courierStatus: { not: null } }
        ];
      }

      // Status filtering
      if (status && String(status).trim() && String(status).toUpperCase() !== 'ALL') {
        const targetStatus = String(status).trim();
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { courierInStatus: targetStatus },
            { courierOutStatus: targetStatus },
            { courierStatus: targetStatus },
            { status: targetStatus }
          ]
        });
      }

      // Courier Company filtering
      if (courierCompany && String(courierCompany).trim() && String(courierCompany).toUpperCase() !== 'ALL') {
        const companyStr = String(courierCompany).trim();
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { courierCompany: { contains: companyStr } },
            { returnCourierCompany: { contains: companyStr } }
          ]
        });
      }

      // District filtering
      if (district && String(district).trim() && String(district).toUpperCase() !== 'ALL') {
        const districtStr = String(district).trim();
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { originDistrict: { contains: districtStr } },
            { destinationDistrict: { contains: districtStr } }
          ]
        });
      }

      // Payment Status filtering
      if (paymentStatus && String(paymentStatus).trim() && String(paymentStatus).toUpperCase() !== 'ALL') {
        const pStatus = String(paymentStatus).trim().toUpperCase();
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { courierInPaymentStatus: pStatus },
            { courierOutPaymentStatus: pStatus }
          ]
        });
      }

      // Date Range filtering
      if (dateRange && String(dateRange).toUpperCase() !== 'ALL') {
        const now = new Date();
        let fromDate: Date | null = null;
        let toDate: Date | null = null;

        if (dateRange === 'TODAY') {
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (dateRange === 'YESTERDAY') {
          const yest = new Date(now);
          yest.setDate(yest.getDate() - 1);
          fromDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate());
          toDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
        } else if (dateRange === 'LAST_7_DAYS' || dateRange === 'THIS_WEEK') {
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 7);
          fromDate.setHours(0, 0, 0, 0);
          toDate = new Date(now);
          toDate.setHours(23, 59, 59, 999);
        } else if (dateRange === 'LAST_30_DAYS' || dateRange === 'THIS_MONTH') {
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 30);
          fromDate.setHours(0, 0, 0, 0);
          toDate = new Date(now);
          toDate.setHours(23, 59, 59, 999);
        } else if (dateRange === 'CUSTOM' && startDate) {
          fromDate = new Date(String(startDate));
          toDate = endDate ? new Date(String(endDate)) : new Date();
          toDate.setHours(23, 59, 59, 999);
        }

        if (fromDate) {
          where.AND = where.AND || [];
          where.AND.push({
            OR: [
              { courierDate: { gte: fromDate, lte: toDate || undefined } },
              { courierReceivedDate: { gte: fromDate, lte: toDate || undefined } },
              { returnCourierDispatchDate: { gte: fromDate, lte: toDate || undefined } },
              { createdAt: { gte: fromDate, lte: toDate || undefined } }
            ]
          });
        }
      }

      // Free-text Search
      if (search && String(search).trim()) {
        const searchStr = String(search).trim();
        const searchPhone = normalizePhone(searchStr);
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { repairNumber: { contains: searchStr } },
            { customerName: { contains: searchStr } },
            { customerPhone: { contains: searchStr } },
            ...(searchPhone ? [{ customerPhone: { contains: searchPhone } }] : []),
            { imeiNumber: { contains: searchStr } },
            { senderName: { contains: searchStr } },
            { senderPhone: { contains: searchStr } },
            { senderWhatsapp: { contains: searchStr } },
            { receiverName: { contains: searchStr } },
            { receiverPhone: { contains: searchStr } },
            { receiverWhatsapp: { contains: searchStr } },
            { courierTrackingNumber: { contains: searchStr } },
            { returnCourierTrackingNumber: { contains: searchStr } },
            { courierCompany: { contains: searchStr } },
            { returnCourierCompany: { contains: searchStr } },
            { originDistrict: { contains: searchStr } },
            { destinationDistrict: { contains: searchStr } },
            { deviceBrand: { contains: searchStr } },
            { deviceModel: { contains: searchStr } }
          ]
        });
      }

      // Dynamic Sorting
      let orderBy: any = { updatedAt: 'desc' };
      if (sortBy === 'oldest') {
        orderBy = { updatedAt: 'asc' };
      } else if (sortBy === 'customer') {
        orderBy = { customerName: 'asc' };
      } else if (sortBy === 'district') {
        orderBy = { originDistrict: 'asc' };
      } else if (sortBy === 'status') {
        orderBy = { status: 'asc' };
      } else if (sortBy === 'dispatchDate') {
        orderBy = { returnCourierDispatchDate: 'desc' };
      } else if (sortBy === 'expectedDelivery') {
        orderBy = { courierReceivedDate: 'desc' };
      }

      const total = await prisma.repair.count({ where });

      const shipments = await prisma.repair.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          batteryWarranty: true,
          logs: { orderBy: { createdAt: 'desc' }, take: 10 }
        }
      });

      res.json({
        success: true,
        shipments,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      });
    } catch (err: any) {
      console.error("[GET COURIERS ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve courier shipments." });
    }
  });

  // Dynamic Filters Metadata (Distinct Courier Companies & Districts)
  app.get("/api/couriers/filters-metadata", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const repairs = await prisma.repair.findMany({
        where: {
          courierArchived: false,
          OR: [
            { isCourierIn: true },
            { isCourierOut: true },
            { isReturnCourierDispatched: true },
            { courierStatus: { not: null } }
          ]
        },
        select: {
          courierCompany: true,
          returnCourierCompany: true,
          originDistrict: true,
          destinationDistrict: true
        }
      });

      const companiesSet = new Set<string>();
      const districtsSet = new Set<string>();

      for (const r of repairs) {
        if (r.courierCompany?.trim()) companiesSet.add(r.courierCompany.trim());
        if (r.returnCourierCompany?.trim()) companiesSet.add(r.returnCourierCompany.trim());
        if (r.originDistrict?.trim()) districtsSet.add(r.originDistrict.trim());
        if (r.destinationDistrict?.trim()) districtsSet.add(r.destinationDistrict.trim());
      }

      res.json({
        courierCompanies: Array.from(companiesSet).sort(),
        districts: Array.from(districtsSet).sort()
      });
    } catch (err: any) {
      console.error("[GET COURIER FILTERS METADATA ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve filters metadata." });
    }
  });

  // Customer Autocomplete / Search for Intake Deduplication
  app.get("/api/couriers/search-customers", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { query } = req.query;
      if (!query || String(query).trim().length < 2) {
        return res.json([]);
      }

      const searchStr = String(query).trim();
      const normPhone = normalizePhone(searchStr);

      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { phone: { contains: normPhone || searchStr } },
            { name: { contains: searchStr } },
            { alternativePhone: { contains: normPhone || searchStr } }
          ]
        },
        take: 10,
        orderBy: { updatedAt: 'desc' }
      });

      res.json(customers);
    } catch (err: any) {
      console.error("[SEARCH CUSTOMERS ERROR]", err);
      res.status(500).json({ error: "Failed to search customers." });
    }
  });

  // Check Duplicate AWB / Tracking Number
  app.post("/api/couriers/check-duplicate-awb", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { trackingNumber, excludeRepairId } = req.body;
      if (!trackingNumber || !String(trackingNumber).trim()) {
        return res.json({ exists: false });
      }

      const cleanAwb = String(trackingNumber).trim();
      const duplicate = await prisma.repair.findFirst({
        where: {
          id: excludeRepairId ? { not: excludeRepairId } : undefined,
          courierArchived: false,
          OR: [
            { courierTrackingNumber: cleanAwb },
            { returnCourierTrackingNumber: cleanAwb }
          ]
        },
        select: {
          id: true,
          repairNumber: true,
          customerName: true,
          courierCompany: true,
          returnCourierCompany: true,
          isCourierIn: true,
          isCourierOut: true
        }
      });

      if (duplicate) {
        return res.json({ exists: true, duplicateRepair: duplicate });
      }

      res.json({ exists: false });
    } catch (err: any) {
      console.error("[CHECK DUPLICATE AWB ERROR]", err);
      res.status(500).json({ error: "Failed to check AWB uniqueness." });
    }
  });

  // Bulk Status Update
  app.post("/api/couriers/bulk-status", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { repairIds, status: targetStatus, courierType = 'OUTGOING', notes } = req.body;

      if (!Array.isArray(repairIds) || repairIds.length === 0) {
        return res.status(400).json({ error: "repairIds array is required." });
      }
      if (!targetStatus) {
        return res.status(400).json({ error: "status is required." });
      }

      const updatedRepairs: any[] = [];

      for (const id of repairIds) {
        const repair = await prisma.repair.findUnique({ where: { id } });
        if (!repair) continue;

        const updateData: any = {
          updatedAt: new Date(),
          managerUpdatedAt: new Date(),
          managerUpdatedBy: req.user.name || req.user.role
        };

        if (courierType === 'INCOMING') {
          updateData.courierInStatus = targetStatus;
          if (targetStatus === 'RECEIVED_AT_LAB') {
            updateData.courierReceivedDate = new Date();
            updateData.isCourierIn = true;
          }
        } else {
          updateData.courierOutStatus = targetStatus;
          if (targetStatus === 'DISPATCHED') {
            updateData.isReturnCourierDispatched = true;
            updateData.returnCourierDispatchedAt = new Date();
            updateData.courierStatus = 'COURIER_DISPATCHED';
          } else if (targetStatus === 'DELIVERED') {
            updateData.status = 'DELIVERED';
            updateData.courierStatus = 'DELIVERED';
            updateData.courierOutDeliveredDate = new Date();
          }
        }

        const updated = await prisma.repair.update({
          where: { id },
          data: updateData
        });

        await prisma.repairLog.create({
          data: {
            repairId: id,
            status: updated.status,
            message: `Bulk update: courier status set to "${targetStatus.replace(/_/g, ' ')}" by ${req.user.name || req.user.role}.${notes ? ` Notes: ${notes}` : ''}`
          }
        });

        await syncToFirestore("repair", updated);
        broadcastRealtimeEvent({ entity: "courier", action: "UPDATE", id: updated.id, data: updated });
        broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updated.id, data: updated });

        updatedRepairs.push(updated);
      }

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_BULK_STATUS_UPDATED",
          resource: "COURIER",
          details: `Updated courier status to ${targetStatus} for ${updatedRepairs.length} shipments.`
        }
      });

      res.json({
        success: true,
        message: `Successfully updated status to ${targetStatus.replace(/_/g, ' ')} for ${updatedRepairs.length} shipments.`,
        updatedCount: updatedRepairs.length
      });
    } catch (err: any) {
      console.error("[BULK STATUS ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to process bulk status update." });
    }
  });

  // Bulk Archive
  app.post("/api/couriers/bulk-archive", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { repairIds } = req.body;
      if (!Array.isArray(repairIds) || repairIds.length === 0) {
        return res.status(400).json({ error: "repairIds array is required." });
      }

      await prisma.repair.updateMany({
        where: { id: { in: repairIds } },
        data: {
          courierArchived: true,
          updatedAt: new Date()
        }
      });

      for (const id of repairIds) {
        broadcastRealtimeEvent({ entity: "courier", action: "DELETE", id });
      }

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_BULK_ARCHIVED",
          resource: "COURIER",
          details: `Archived ${repairIds.length} courier shipments.`
        }
      });

      res.json({
        success: true,
        message: `Successfully archived ${repairIds.length} courier shipments.`
      });
    } catch (err: any) {
      console.error("[BULK ARCHIVE ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to process bulk archive." });
    }
  });

  // Courier Hub Overview Statistics
  app.get("/api/couriers/stats", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const allCourierRepairs = await prisma.repair.findMany({
        where: {
          courierArchived: false,
          OR: [
            { isCourierIn: true },
            { isCourierOut: true },
            { isReturnCourierDispatched: true },
            { courierStatus: { not: null } }
          ]
        },
        select: {
          id: true,
          status: true,
          isCourierIn: true,
          courierInStatus: true,
          courierDate: true,
          courierReceivedDate: true,
          courierInCharge: true,
          isCourierOut: true,
          courierOutStatus: true,
          courierStatus: true,
          returnCourierDispatchDate: true,
          isReturnCourierDispatched: true,
          courierOutCharge: true,
          createdAt: true
        }
      });

      let totalShipments = allCourierRepairs.length;
      let incomingTotal = 0;
      let outgoingTotal = 0;
      let incomingToday = 0;
      let outgoingToday = 0;
      let inTransit = 0;
      let receivedAtLab = 0;
      let readyForDispatch = 0;
      let dispatched = 0;
      let delivered = 0;
      let totalCharges = 0;

      for (const r of allCourierRepairs) {
        if (r.isCourierIn) {
          incomingTotal++;
          const cDate = r.courierDate || r.createdAt;
          if (cDate && cDate >= startOfToday && cDate <= endOfToday) {
            incomingToday++;
          }
          if (r.courierInStatus === 'IN_TRANSIT') {
            inTransit++;
          } else if (r.courierInStatus === 'RECEIVED_AT_LAB' || r.courierReceivedDate) {
            receivedAtLab++;
          }
          if (r.courierInCharge && r.courierInCharge > 0) {
            totalCharges += Number(r.courierInCharge);
          }
        }

        if (r.isCourierOut || r.isReturnCourierDispatched || r.courierStatus) {
          outgoingTotal++;
          const dDate = r.returnCourierDispatchDate;
          if (dDate && dDate >= startOfToday && dDate <= endOfToday) {
            outgoingToday++;
          }
          if (r.courierOutStatus === 'DELIVERED' || r.status === 'DELIVERED' || r.courierStatus === 'DELIVERED') {
            delivered++;
          } else if (r.courierOutStatus === 'DISPATCHED' || r.isReturnCourierDispatched || r.courierStatus === 'COURIER_DISPATCHED') {
            dispatched++;
            inTransit++;
          } else if (r.courierOutStatus === 'READY_FOR_DISPATCH' || r.status === 'READY_FOR_PICKUP' || r.status === 'REPAIRED') {
            readyForDispatch++;
          }
          if (r.courierOutCharge && r.courierOutCharge > 0) {
            totalCharges += Number(r.courierOutCharge);
          }
        }
      }

      res.json({
        totalShipments,
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
    } catch (err: any) {
      console.error("[GET COURIER STATS ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve courier statistics." });
    }
  });

  // Eligible Repairs for Outgoing Dispatch (repairs ready/completed but not yet delivered)
  app.get("/api/couriers/eligible-repairs", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { search } = req.query;
      const where: any = {
        status: { in: ['REPAIRED', 'READY_FOR_PICKUP', 'TESTING', 'IN_PROCESS', 'RECEIVED', 'DIAGNOSING'] },
        courierArchived: false
      };

      if (search && String(search).trim()) {
        const searchStr = String(search).trim();
        const searchPhone = normalizePhone(searchStr);
        where.OR = [
          { repairNumber: { contains: searchStr } },
          { customerName: { contains: searchStr } },
          { customerPhone: { contains: searchStr } },
          ...(searchPhone ? [{ customerPhone: { contains: searchPhone } }] : []),
          { deviceBrand: { contains: searchStr } },
          { deviceModel: { contains: searchStr } }
        ];
      }

      const repairs = await prisma.repair.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          customer: true,
          batteryWarranty: true
        }
      });

      res.json(repairs);
    } catch (err: any) {
      console.error("[GET ELIGIBLE REPAIRS ERROR]", err);
      res.status(500).json({ error: "Failed to load eligible repairs." });
    }
  });

  // Get Single Courier Shipment Details
  app.get("/api/couriers/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), syncRouteMiddleware(['repair', 'customer']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const repair = await prisma.repair.findUnique({
        where: { id },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true, email: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          batteryWarranty: true,
          logs: { orderBy: { createdAt: 'desc' } },
          notes: { include: { technician: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }
        }
      });

      if (!repair) {
        return res.status(404).json({ error: "Courier shipment record not found." });
      }

      res.json(repair);
    } catch (err: any) {
      console.error("[GET COURIER DETAILS ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve courier shipment details." });
    }
  });

  // Register Incoming / Receive Courier Shipment
  app.post("/api/couriers/incoming", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const {
        existingRepairId,
        isNewRepair = false,
        customerName,
        customerPhone,
        customerWhatsapp,
        customerAddress,
        customerDistrict,
        customerMunicipality,
        deviceBrand,
        deviceModel,
        imeiNumber,
        deviceCondition,
        problemDescription,
        accessoriesReceived,
        courierCompany,
        courierTrackingNumber,
        senderName,
        senderPhone,
        senderWhatsapp,
        originDistrict,
        originAddress,
        courierInCharge,
        courierInPaymentStatus,
        courierDate,
        courierReceivedDate,
        courierNotes,
        branchId: incomingBranchId
      } = req.body;

      if (!courierCompany || !courierTrackingNumber) {
        return res.status(400).json({ error: "Courier Company and Tracking / AWB Number are required." });
      }

      let branchId = incomingBranchId;
      if (!branchId) {
        const defBranch = await prisma.branch.findFirst();
        branchId = defBranch?.id || "default-branch-001";
      }

      let repair: any = null;

      if (existingRepairId) {
        // Link to existing repair
        const existingRepair = await prisma.repair.findUnique({
          where: { id: existingRepairId },
          include: { customer: true }
        });

        if (!existingRepair) {
          return res.status(404).json({ error: "Existing repair job not found." });
        }

        const receivedAt = courierReceivedDate ? new Date(courierReceivedDate) : new Date();

        repair = await prisma.repair.update({
          where: { id: existingRepairId },
          data: {
            receivingMethod: "COURIER",
            isCourierIn: true,
            courierInStatus: "RECEIVED_AT_LAB",
            courierCompany: courierCompany.trim(),
            courierTrackingNumber: courierTrackingNumber.trim(),
            courierDate: courierDate ? new Date(courierDate) : new Date(),
            courierReceivedDate: receivedAt,
            senderName: senderName ? senderName.trim() : existingRepair.customerName,
            senderPhone: senderPhone ? normalizePhone(senderPhone) : existingRepair.customerPhone,
            senderWhatsapp: senderWhatsapp ? normalizePhone(senderWhatsapp) : null,
            originDistrict: originDistrict ? originDistrict.trim() : (existingRepair.customer?.district || null),
            originAddress: originAddress ? originAddress.trim() : (existingRepair.customerAddress || null),
            courierInCharge: courierInCharge ? Number(courierInCharge) : null,
            courierInPaymentStatus: courierInPaymentStatus || 'UNPAID',
            courierNotes: courierNotes ? courierNotes.trim() : null,
            courierStatus: "RECEIVED_AT_LAB"
          },
          include: {
            customer: true,
            technician: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true } },
            batteryWarranty: true
          }
        });

        await prisma.repairLog.create({
          data: {
            repairId: repair.id,
            status: repair.status,
            message: `Incoming courier package received at MTS Lab via ${courierCompany.trim()} (AWB #${courierTrackingNumber.trim()}) from ${senderName || repair.customerName} in ${originDistrict || 'origin address'}. Logged by ${req.user.name || req.user.role}.`
          }
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "COURIER_INCOMING_LINKED",
            resource: "COURIER",
            resourceId: repair.id,
            details: `Linked inbound courier #${courierTrackingNumber.trim()} (${courierCompany.trim()}) to Repair #${repair.repairNumber}.`
          }
        });
      } else {
        // Create new intake repair for incoming courier
        if (!customerName || !customerPhone) {
          return res.status(400).json({ error: "Customer Name and Phone Number are required for new intake repair." });
        }
        if (!deviceModel) {
          return res.status(400).json({ error: "Device Model is required for new intake repair." });
        }

        const normalizedPhone = normalizePhone(customerPhone);

        const customer = await findOrCreateCustomer({
          name: customerName,
          phone: normalizedPhone || customerPhone,
          address: customerAddress,
          district: customerDistrict,
          municipality: customerMunicipality
        });

        const repairNumber = await generateUniqueRepairNumber();
        const receivedAt = courierReceivedDate ? new Date(courierReceivedDate) : new Date();

        repair = await prisma.repair.create({
          data: {
            repairNumber,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerAddress: customer.address || originAddress || null,
            deviceBrand: (deviceBrand || 'apple').toLowerCase(),
            deviceModel: deviceModel.trim(),
            imeiNumber: imeiNumber ? imeiNumber.trim() : null,
            deviceCondition: deviceCondition || 'Good (Minor Wear)',
            problemDescription: problemDescription?.trim() || 'Courier Intake - Diagnosis & Repair',
            accessoriesReceived: accessoriesReceived || null,
            receivingMethod: "COURIER",
            isCourierIn: true,
            courierInStatus: "RECEIVED_AT_LAB",
            courierCompany: courierCompany.trim(),
            courierTrackingNumber: courierTrackingNumber.trim(),
            courierDate: courierDate ? new Date(courierDate) : new Date(),
            courierReceivedDate: receivedAt,
            senderName: senderName ? senderName.trim() : customer.name,
            senderPhone: senderPhone ? normalizePhone(senderPhone) : customer.phone,
            senderWhatsapp: senderWhatsapp ? normalizePhone(senderWhatsapp) : null,
            originDistrict: originDistrict ? originDistrict.trim() : (customer.district || null),
            originAddress: originAddress ? originAddress.trim() : (customer.address || null),
            courierInCharge: courierInCharge ? Number(courierInCharge) : null,
            courierInPaymentStatus: courierInPaymentStatus || 'UNPAID',
            courierNotes: courierNotes ? courierNotes.trim() : null,
            courierStatus: "RECEIVED_AT_LAB",
            status: "RECEIVED",
            priority: "NORMAL",
            createdById: req.user.id,
            branchId: branchId
          },
          include: {
            customer: true,
            technician: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true } },
            batteryWarranty: true
          }
        });

        await prisma.repairLog.create({
          data: {
            repairId: repair.id,
            status: "RECEIVED",
            message: `New repair #${repair.repairNumber} registered via Incoming Courier from ${courierCompany.trim()} (AWB #${courierTrackingNumber.trim()}) by ${req.user.name || req.user.role}.`
          }
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "COURIER_INCOMING_CREATED",
            resource: "COURIER",
            resourceId: repair.id,
            details: `Created incoming courier shipment #${courierTrackingNumber.trim()} for new Repair #${repair.repairNumber}.`
          }
        });
      }

      await syncToFirestore("repair", repair);
      broadcastRealtimeEvent({ entity: "courier", action: "CREATE", id: repair.id, data: repair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: repair.id, data: repair });

      res.status(201).json({
        success: true,
        message: `Incoming courier #${courierTrackingNumber} successfully recorded for Repair #${repair.repairNumber}.`,
        repair
      });
    } catch (err: any) {
      console.error("[CREATE INCOMING COURIER ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to record incoming courier." });
    }
  });

  // Register Outgoing / Dispatch Courier Shipment
  app.post("/api/couriers/outgoing", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const {
        repairId,
        returnCourierCompany,
        returnCourierTrackingNumber,
        returnCourierDispatchDate,
        destinationDistrict,
        destinationAddress,
        receiverName,
        receiverPhone,
        receiverWhatsapp,
        courierOutCharge,
        courierOutPaymentStatus,
        returnCourierNotes
      } = req.body;

      if (!repairId) {
        return res.status(400).json({ error: "Repair ID is required to create outgoing dispatch." });
      }

      if (!returnCourierCompany || !returnCourierTrackingNumber) {
        return res.status(400).json({ error: "Courier Company and Tracking / AWB Number are required." });
      }

      const repair = await prisma.repair.findUnique({
        where: { id: repairId },
        include: { customer: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found." });
      }

      // Check if already dispatched
      if (repair.isReturnCourierDispatched && repair.returnCourierTrackingNumber === returnCourierTrackingNumber.trim()) {
        return res.status(400).json({ error: `This repair is already dispatched under tracking #${repair.returnCourierTrackingNumber}.` });
      }

      const dispatchDate = returnCourierDispatchDate ? new Date(returnCourierDispatchDate) : new Date();

      const updatedRepair = await prisma.repair.update({
        where: { id: repairId },
        data: {
          isCourierOut: true,
          isReturnCourierDispatched: true,
          returnCourierDispatchedAt: new Date(),
          returnCourierDispatchedById: req.user.id,
          returnCourierDispatchedByName: req.user.name || req.user.role,
          returnCourierCompany: returnCourierCompany.trim(),
          returnCourierTrackingNumber: returnCourierTrackingNumber.trim(),
          returnCourierDispatchDate: dispatchDate,
          destinationDistrict: destinationDistrict ? destinationDistrict.trim() : (repair.customer?.district || null),
          destinationAddress: destinationAddress ? destinationAddress.trim() : (repair.customerAddress || null),
          receiverName: receiverName ? receiverName.trim() : repair.customerName,
          receiverPhone: receiverPhone ? normalizePhone(receiverPhone) : repair.customerPhone,
          receiverWhatsapp: receiverWhatsapp ? normalizePhone(receiverWhatsapp) : null,
          courierOutCharge: courierOutCharge ? Number(courierOutCharge) : null,
          courierOutPaymentStatus: courierOutPaymentStatus || 'UNPAID',
          returnCourierNotes: returnCourierNotes ? returnCourierNotes.trim() : null,
          courierOutStatus: "DISPATCHED",
          courierStatus: "COURIER_DISPATCHED",
          status: repair.status === 'DELIVERED' ? 'DELIVERED' : 'READY_FOR_PICKUP'
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true } },
          batteryWarranty: true,
          logs: { orderBy: { createdAt: "desc" } }
        }
      });

      // Record Repair Log
      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: updatedRepair.status,
          message: `Repaired device dispatched via ${returnCourierCompany.trim()} (AWB #${returnCourierTrackingNumber.trim()}) to ${receiverName || repair.customerName} in ${destinationDistrict || 'destination'}. Dispatched by ${req.user.name || req.user.role}.`
        }
      });

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_DISPATCHED",
          resource: "COURIER",
          resourceId: repair.id,
          details: `Dispatched Repair #${repair.repairNumber} via ${returnCourierCompany.trim()} (Tracking #${returnCourierTrackingNumber.trim()}) to ${receiverName || repair.customerName}.`
        }
      });

      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "courier", action: "CREATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });

      res.status(201).json({
        success: true,
        message: `Repair #${repair.repairNumber} dispatched successfully via ${returnCourierCompany}.`,
        repair: updatedRepair
      });
    } catch (err: any) {
      console.error("[CREATE OUTGOING COURIER ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to dispatch courier return." });
    }
  });

  // Edit Courier Shipment Details
  app.patch("/api/couriers/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        courierCompany,
        courierTrackingNumber,
        courierDate,
        courierReceivedDate,
        courierInPickupDate,
        senderName,
        senderPhone,
        senderWhatsapp,
        originDistrict,
        originAddress,
        courierInCharge,
        courierInPaymentStatus,
        courierNotes,
        returnCourierCompany,
        returnCourierTrackingNumber,
        returnCourierDispatchDate,
        courierOutDeliveredDate,
        destinationDistrict,
        destinationAddress,
        receiverName,
        receiverPhone,
        receiverWhatsapp,
        courierOutCharge,
        courierOutPaymentStatus,
        returnCourierNotes
      } = req.body;

      const repair = await prisma.repair.findUnique({ where: { id } });
      if (!repair) {
        return res.status(404).json({ error: "Courier shipment record not found." });
      }

      const updateData: any = {};

      if (courierCompany !== undefined) updateData.courierCompany = courierCompany ? courierCompany.trim() : null;
      if (courierTrackingNumber !== undefined) updateData.courierTrackingNumber = courierTrackingNumber ? courierTrackingNumber.trim() : null;
      if (courierDate !== undefined) updateData.courierDate = courierDate ? new Date(courierDate) : null;
      if (courierReceivedDate !== undefined) updateData.courierReceivedDate = courierReceivedDate ? new Date(courierReceivedDate) : null;
      if (courierInPickupDate !== undefined) updateData.courierInPickupDate = courierInPickupDate ? new Date(courierInPickupDate) : null;
      if (senderName !== undefined) updateData.senderName = senderName ? senderName.trim() : null;
      if (senderPhone !== undefined) updateData.senderPhone = senderPhone ? normalizePhone(senderPhone) : null;
      if (senderWhatsapp !== undefined) updateData.senderWhatsapp = senderWhatsapp ? normalizePhone(senderWhatsapp) : null;
      if (originDistrict !== undefined) updateData.originDistrict = originDistrict ? originDistrict.trim() : null;
      if (originAddress !== undefined) updateData.originAddress = originAddress ? originAddress.trim() : null;
      if (courierInCharge !== undefined) updateData.courierInCharge = courierInCharge !== null && courierInCharge !== '' ? Number(courierInCharge) : null;
      if (courierInPaymentStatus !== undefined) updateData.courierInPaymentStatus = courierInPaymentStatus;
      if (courierNotes !== undefined) updateData.courierNotes = courierNotes ? courierNotes.trim() : null;

      if (returnCourierCompany !== undefined) updateData.returnCourierCompany = returnCourierCompany ? returnCourierCompany.trim() : null;
      if (returnCourierTrackingNumber !== undefined) updateData.returnCourierTrackingNumber = returnCourierTrackingNumber ? returnCourierTrackingNumber.trim() : null;
      if (returnCourierDispatchDate !== undefined) updateData.returnCourierDispatchDate = returnCourierDispatchDate ? new Date(returnCourierDispatchDate) : null;
      if (courierOutDeliveredDate !== undefined) updateData.courierOutDeliveredDate = courierOutDeliveredDate ? new Date(courierOutDeliveredDate) : null;
      if (destinationDistrict !== undefined) updateData.destinationDistrict = destinationDistrict ? destinationDistrict.trim() : null;
      if (destinationAddress !== undefined) updateData.destinationAddress = destinationAddress ? destinationAddress.trim() : null;
      if (receiverName !== undefined) updateData.receiverName = receiverName ? receiverName.trim() : null;
      if (receiverPhone !== undefined) updateData.receiverPhone = receiverPhone ? normalizePhone(receiverPhone) : null;
      if (receiverWhatsapp !== undefined) updateData.receiverWhatsapp = receiverWhatsapp ? normalizePhone(receiverWhatsapp) : null;
      if (courierOutCharge !== undefined) updateData.courierOutCharge = courierOutCharge !== null && courierOutCharge !== '' ? Number(courierOutCharge) : null;
      if (courierOutPaymentStatus !== undefined) updateData.courierOutPaymentStatus = courierOutPaymentStatus;
      if (returnCourierNotes !== undefined) updateData.returnCourierNotes = returnCourierNotes ? returnCourierNotes.trim() : null;

      updateData.updatedAt = new Date();

      const updatedRepair = await prisma.repair.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true } },
          batteryWarranty: true,
          logs: { orderBy: { createdAt: "desc" } }
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_DETAILS_EDITED",
          resource: "COURIER",
          resourceId: repair.id,
          details: `Updated courier details for Repair #${repair.repairNumber} by ${req.user.name || req.user.role}.`
        }
      });

      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "courier", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });

      res.json({
        success: true,
        message: `Courier details updated for Repair #${repair.repairNumber}.`,
        repair: updatedRepair
      });
    } catch (err: any) {
      console.error("[EDIT COURIER ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to update courier details." });
    }
  });

  // Update Courier Lifecycle Status (with transition validation and history logging)
  app.patch("/api/couriers/:id/status", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { courierType = 'OUTGOING', status: nextStatus, notes } = req.body;

      if (!nextStatus) {
        return res.status(400).json({ error: "Courier status is required." });
      }

      const repair = await prisma.repair.findUnique({ where: { id } });
      if (!repair) {
        return res.status(404).json({ error: "Shipment record not found." });
      }

      const updateData: any = {
        updatedAt: new Date(),
        managerUpdatedAt: new Date(),
        managerUpdatedBy: req.user.name || req.user.role
      };

      let logMessage = '';

      if (courierType === 'INCOMING') {
        const VALID_INCOMING_STATUSES = ['COURIER_REQUESTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED_AT_LAB'];
        if (!VALID_INCOMING_STATUSES.includes(nextStatus)) {
          return res.status(400).json({ error: `Invalid incoming courier status: ${nextStatus}. Allowed: ${VALID_INCOMING_STATUSES.join(', ')}` });
        }
        updateData.courierInStatus = nextStatus;
        if (nextStatus === 'RECEIVED_AT_LAB') {
          updateData.courierReceivedDate = new Date();
          updateData.isCourierIn = true;
          updateData.courierStatus = 'RECEIVED_AT_LAB';
        }
        logMessage = `Inbound courier status transitioned to "${nextStatus.replace(/_/g, ' ')}" by ${req.user.name || req.user.role}.${notes ? ` Note: ${notes}` : ''}`;
      } else {
        // Outgoing courier lifecycle
        const VALID_OUTGOING_STATUSES = ['READY_FOR_DISPATCH', 'COURIER_BOOKED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED'];
        if (!VALID_OUTGOING_STATUSES.includes(nextStatus)) {
          return res.status(400).json({ error: `Invalid outgoing courier status: ${nextStatus}. Allowed: ${VALID_OUTGOING_STATUSES.join(', ')}` });
        }
        updateData.courierOutStatus = nextStatus;
        if (nextStatus === 'DISPATCHED') {
          updateData.isReturnCourierDispatched = true;
          updateData.returnCourierDispatchedAt = new Date();
          updateData.courierStatus = 'COURIER_DISPATCHED';
          if (!repair.returnCourierDispatchDate) {
            updateData.returnCourierDispatchDate = new Date();
          }
        } else if (nextStatus === 'DELIVERED') {
          updateData.status = 'DELIVERED';
          updateData.courierStatus = 'DELIVERED';
          updateData.courierOutDeliveredDate = new Date();
        }
        logMessage = `Outbound courier status transitioned to "${nextStatus.replace(/_/g, ' ')}" by ${req.user.name || req.user.role}.${notes ? ` Note: ${notes}` : ''}`;
      }

      const updatedRepair = await prisma.repair.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true } },
          batteryWarranty: true,
          logs: { orderBy: { createdAt: "desc" } }
        }
      });

      const newLog = await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: updatedRepair.status,
          message: logMessage
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_STATUS_UPDATED",
          resource: "COURIER",
          resourceId: repair.id,
          details: `Updated ${courierType.toLowerCase()} courier status to ${nextStatus} for Repair #${repair.repairNumber}.`
        }
      });

      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "courier", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: newLog.id, data: newLog });

      res.json({
        success: true,
        message: `Courier status updated to ${nextStatus.replace(/_/g, ' ')}.`,
        repair: updatedRepair
      });
    } catch (err: any) {
      console.error("[UPDATE COURIER STATUS ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to update courier status." });
    }
  });

  // Safe Archive / Delete Courier Record (Preserves Repair & Customer Records)
  app.delete("/api/couriers/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Courier record not found." });
      }

      // Soft archive the courier info without deleting customer or repair
      const updatedRepair = await prisma.repair.update({
        where: { id },
        data: {
          courierArchived: true,
          updatedAt: new Date()
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          batteryWarranty: true
        }
      });

      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: repair.status,
          message: `Courier shipment archived by ${req.user.name || req.user.role}. Core repair and customer history remain intact.`
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_ARCHIVED",
          resource: "COURIER",
          resourceId: repair.id,
          details: `Archived courier shipment record for Repair #${repair.repairNumber} (${repair.customerName}).`
        }
      });

      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "courier", action: "DELETE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });

      res.json({
        success: true,
        message: `Courier shipment record for Repair #${repair.repairNumber} has been safely archived.`,
        repair: updatedRepair
      });
    } catch (err: any) {
      console.error("[DELETE COURIER ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to archive courier record." });
    }
  });

  // Legacy Courier Dispatch & Status compatibility endpoints
  app.post("/api/repairs/:id/courier-dispatch", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        returnCourierCompany,
        returnCourierTrackingNumber,
        returnCourierDispatchDate,
        destinationDistrict,
        destinationAddress,
        receiverName,
        receiverPhone,
        receiverWhatsapp,
        courierOutCharge,
        courierOutPaymentStatus,
        returnCourierNotes
      } = req.body;

      if (!returnCourierCompany || !returnCourierTrackingNumber) {
        return res.status(400).json({ error: "Courier Company and Tracking / Consignment Number are required for dispatch." });
      }

      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found." });
      }

      const dispatchDate = returnCourierDispatchDate ? new Date(returnCourierDispatchDate) : new Date();

      const updatedRepair = await prisma.repair.update({
        where: { id },
        data: {
          isCourierOut: true,
          isReturnCourierDispatched: true,
          returnCourierDispatchedAt: new Date(),
          returnCourierDispatchedById: req.user.id,
          returnCourierDispatchedByName: req.user.name || req.user.role,
          returnCourierCompany: returnCourierCompany.trim(),
          returnCourierTrackingNumber: returnCourierTrackingNumber.trim(),
          returnCourierDispatchDate: dispatchDate,
          destinationDistrict: destinationDistrict ? destinationDistrict.trim() : (repair.customer?.district || null),
          destinationAddress: destinationAddress ? destinationAddress.trim() : (repair.customerAddress || null),
          receiverName: receiverName ? receiverName.trim() : repair.customerName,
          receiverPhone: receiverPhone ? normalizePhone(receiverPhone) : repair.customerPhone,
          receiverWhatsapp: receiverWhatsapp ? normalizePhone(receiverWhatsapp) : null,
          courierOutCharge: courierOutCharge ? Number(courierOutCharge) : null,
          courierOutPaymentStatus: courierOutPaymentStatus || 'UNPAID',
          returnCourierNotes: returnCourierNotes ? returnCourierNotes.trim() : null,
          courierOutStatus: "DISPATCHED",
          courierStatus: "COURIER_DISPATCHED",
          status: "READY_FOR_PICKUP"
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { name: true } },
          logs: { orderBy: { createdAt: "desc" } }
        }
      });

      // Record Repair Log
      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: "READY_FOR_PICKUP",
          message: `Repaired device dispatched via ${returnCourierCompany.trim()} (Tracking #${returnCourierTrackingNumber.trim()}) to ${receiverName || repair.customerName} in ${destinationDistrict || 'destination address'}. Dispatched by ${req.user.name || req.user.role}.`
        }
      });

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_DISPATCHED",
          resource: "REPAIR",
          resourceId: repair.id,
          details: `Dispatched Repair #${repair.repairNumber} via ${returnCourierCompany.trim()} (Tracking: ${returnCourierTrackingNumber.trim()}) to ${receiverName || repair.customerName}.`
        }
      });

      // Broadcast Real-time & Firestore Sync
      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "courier", action: "CREATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });

      res.json({
        success: true,
        message: `Repair #${repair.repairNumber} dispatched successfully via ${returnCourierCompany}.`,
        repair: updatedRepair
      });
    } catch (err: any) {
      console.error("[COURIER DISPATCH ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to dispatch courier return." });
    }
  });

  // Update Courier Status (Legacy route)
  app.patch("/api/repairs/:id/courier-status", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { courierStatus, notes } = req.body;

      if (!courierStatus) {
        return res.status(400).json({ error: "courierStatus is required" });
      }

      const repair = await prisma.repair.findUnique({ where: { id } });
      if (!repair) return res.status(404).json({ error: "Repair not found" });

      const isDelivered = courierStatus === "DELIVERED";
      const updateData: any = {
        courierStatus,
        courierOutStatus: courierStatus,
        managerUpdatedAt: new Date(),
        managerUpdatedBy: req.user.name || req.user.role
      };
      if (isDelivered) {
        updateData.status = "DELIVERED";
        updateData.courierOutDeliveredDate = new Date();
      }

      const updatedRepair = await prisma.repair.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { name: true } }
        }
      });

      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: updatedRepair.status,
          message: `Courier status updated to "${courierStatus}" by ${req.user.name || req.user.role}.${notes ? ` Notes: ${notes}` : ''}`
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "COURIER_STATUS_UPDATED",
          resource: "REPAIR",
          resourceId: repair.id,
          details: `Updated courier status to ${courierStatus} for Repair #${repair.repairNumber}`
        }
      });

      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "courier", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });

      res.json({ success: true, repair: updatedRepair });
    } catch (err: any) {
      console.error("[UPDATE COURIER STATUS ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to update courier status" });
    }
  });

  // Re-Problem Reporting for Delivered or Returned Repairs
  app.post("/api/repairs/:id/re-problem", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'MANAGER', 'TECHNICIAN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { problemReason, description } = req.body;

      const repair = await prisma.repair.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!repair) return res.status(404).json({ error: "Repair record not found" });

      const updatedRepair = await prisma.repair.update({
        where: { id },
        data: {
          status: "RE_PROBLEM",
          courierStatus: "UNDER_DIAGNOSIS",
          priority: "HIGH",
          managerUpdatedAt: new Date(),
          managerUpdatedBy: req.user.name || req.user.role,
          remarks: `Re-Problem: ${problemReason || 'Post-delivery issue'}${description ? ` - ${description}` : ''}`
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { name: true } },
          batteryWarranty: true
        }
      });

      await prisma.repairLog.create({
        data: {
          repairId: repair.id,
          status: "RE_PROBLEM",
          message: `Re-Problem Intake registered: ${problemReason || 'Device issue returned'}. Notes: ${description || 'Device re-submitted for priority warranty inspection'}. Handled by ${req.user.name || req.user.role}.`
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "RE_PROBLEM_REPORTED",
          resource: "REPAIR",
          resourceId: repair.id,
          details: `Re-Problem logged for Repair #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}): ${problemReason || 'Issue returned'}`
        }
      });

      await syncToFirestore("repair", updatedRepair);
      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: updatedRepair.id, data: updatedRepair });

      res.json({
        success: true,
        message: `Re-Problem recorded successfully for Repair #${repair.repairNumber}. Status updated to Re-Problem inspection.`,
        repair: updatedRepair
      });
    } catch (err: any) {
      console.error("[RE-PROBLEM REPORT ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to record re-problem." });
    }
  });

  // ==========================================
  // BATTERY WARRANTY MANAGEMENT ENDPOINTS
  // ==========================================

  // List all battery warranties with metrics, search, and filters
  app.get("/api/battery-warranties", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), syncRouteMiddleware(['batteryWarranty', 'batteryWarrantyClaim', 'repair', 'customer']), async (req: any, res) => {
    try {
      const { search, status, period } = req.query;

      // Auto-update expired warranties in database
      const now = new Date();
      await prisma.batteryWarranty.updateMany({
        where: {
          status: 'ACTIVE',
          expiryDate: { lt: now }
        },
        data: {
          status: 'EXPIRED'
        }
      });

      // Build search / filter conditions
      const where: any = {};

      if (period && period !== 'ALL') {
        where.warrantyPeriod = String(period).trim();
      }

      if (status && status !== 'ALL') {
        if (status === 'EXPIRING_SOON') {
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          where.status = 'ACTIVE';
          where.expiryDate = {
            gte: now,
            lte: thirtyDaysFromNow
          };
        } else {
          where.status = String(status).trim();
        }
      }

      if (search && String(search).trim()) {
        const query = String(search).trim();
        where.OR = [
          { customerPhone: { contains: query } },
          { customerName: { contains: query } },
          { repairNumber: { contains: query } },
          { warrantyNumber: { contains: query } },
          { deviceModel: { contains: query } },
          { deviceBrand: { contains: query } }
        ];
      }

      const warranties = await prisma.batteryWarranty.findMany({
        where,
        include: {
          claims: {
            orderBy: { claimDate: 'desc' }
          },
          repair: {
            select: {
              id: true,
              repairNumber: true,
              status: true,
              paymentStatus: true,
              createdAt: true
            }
          },
          customer: {
            select: {
              id: true,
              customerId: true,
              name: true,
              phone: true,
              email: true,
              address: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Compute Live Summary Statistics
      const allWarranties = await prisma.batteryWarranty.findMany({
        select: {
          id: true,
          status: true,
          expiryDate: true,
          claimCount: true
        }
      });

      const thirtyDaysThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      let totalCount = allWarranties.length;
      let activeCount = 0;
      let expiringSoonCount = 0;
      let expiredCount = 0;
      let totalClaimsCount = 0;

      for (const w of allWarranties) {
        totalClaimsCount += w.claimCount || 0;
        const exp = new Date(w.expiryDate);
        if (exp < now || w.status === 'EXPIRED') {
          expiredCount++;
        } else if (w.status === 'ACTIVE') {
          activeCount++;
          if (exp <= thirtyDaysThreshold) {
            expiringSoonCount++;
          }
        }
      }

      // Also get total claims from claim table
      const totalClaimRecords = await prisma.batteryWarrantyClaim.count();
      const finalClaimsCount = Math.max(totalClaimsCount, totalClaimRecords);

      res.json({
        success: true,
        warranties,
        total: warranties.length,
        summary: {
          total: totalCount,
          active: activeCount,
          expiringSoon: expiringSoonCount,
          expired: expiredCount,
          claims: finalClaimsCount
        }
      });
    } catch (err: any) {
      console.error("[GET BATTERY WARRANTIES ERROR]", err);
      res.status(500).json({ error: "Failed to fetch battery warranties." });
    }
  });

  // =========================================================================
  // BATTERY WARRANTY HUB: EXCEL IMPORT & EXPORT ENDPOINTS
  // =========================================================================

  // 1. Export Battery Warranty Data to Excel (.xlsx)
  app.get("/api/battery-warranties/export", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { search, status, period } = req.query;

      const where: any = {};
      if (period && period !== 'ALL') {
        where.warrantyPeriod = String(period).trim();
      }
      if (status && status !== 'ALL') {
        where.status = String(status).trim();
      }
      if (search && String(search).trim()) {
        const query = String(search).trim();
        where.OR = [
          { customerPhone: { contains: query } },
          { customerName: { contains: query } },
          { repairNumber: { contains: query } },
          { warrantyNumber: { contains: query } },
          { deviceModel: { contains: query } },
          { deviceBrand: { contains: query } }
        ];
      }

      const warranties = await prisma.batteryWarranty.findMany({
        where,
        include: {
          claims: true,
          repair: true,
          customer: true,
          createdBy: { select: { id: true, name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatExcelDate = (d: any) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '';
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const formatExcelDateTime = (d: any) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '';
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
      };

      const excelRows = warranties.map(w => {
        const claimStatus = (w.claimCount && w.claimCount > 0)
          ? `CLAIMED (${w.claimCount} Claim${w.claimCount > 1 ? 's' : ''})`
          : 'NO CLAIMS';

        return {
          'Warranty ID': String(w.warrantyNumber || ''),
          'Repair Number': String(w.repairNumber || ''),
          'Customer Name': String(w.customerName || ''),
          'Customer Phone Number': String(w.customerPhone || ''),
          'Customer Email': String(w.customerEmail || ''),
          'Device Brand': String(w.deviceBrand || '').toUpperCase(),
          'Device Model': String(w.deviceModel || ''),
          'IMEI Number': String(w.imeiNumber || ''),
          'Battery Type': String(w.batteryType || 'Original Replacement Battery'),
          'Battery Warranty Period': w.warrantyPeriod === '1_YEAR' ? '1 Year (12 Months)' : '6 Months',
          'Warranty Register Date': formatExcelDate(w.registrationDate),
          'Warranty Expiry Date': formatExcelDate(w.expiryDate),
          'Warranty Status': String(w.status || 'ACTIVE'),
          'Warranty Claim Status': claimStatus,
          'Created/Registered By': String(w.createdBy?.name || 'MTS Staff'),
          'Created Date': formatExcelDateTime(w.createdAt)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      // Set explicit string cell types on Phone Number and IMEI Number to preserve leading zeros
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:P1');
      for (let R = 1; R <= range.e.r; ++R) {
        // Column D is Phone (idx 3), Column H is IMEI (idx 7)
        const phoneCellRef = XLSX.utils.encode_cell({ r: R, c: 3 });
        if (worksheet[phoneCellRef]) {
          worksheet[phoneCellRef].t = 's';
          worksheet[phoneCellRef].v = String(worksheet[phoneCellRef].v);
        }
        const imeiCellRef = XLSX.utils.encode_cell({ r: R, c: 7 });
        if (worksheet[imeiCellRef]) {
          worksheet[imeiCellRef].t = 's';
          worksheet[imeiCellRef].v = String(worksheet[imeiCellRef].v);
        }
      }

      // Column widths for optimal visibility without text clipping
      worksheet['!cols'] = [
        { wch: 16 }, // Warranty ID
        { wch: 16 }, // Repair Number
        { wch: 22 }, // Customer Name
        { wch: 20 }, // Customer Phone Number
        { wch: 24 }, // Customer Email
        { wch: 15 }, // Device Brand
        { wch: 20 }, // Device Model
        { wch: 20 }, // IMEI Number
        { wch: 28 }, // Battery Type
        { wch: 24 }, // Battery Warranty Period
        { wch: 22 }, // Warranty Register Date
        { wch: 22 }, // Warranty Expiry Date
        { wch: 16 }, // Warranty Status
        { wch: 22 }, // Warranty Claim Status
        { wch: 20 }, // Created/Registered By
        { wch: 18 }  // Created Date
      ];

      // Auto-filter and freeze header row
      if (excelRows.length > 0) {
        worksheet['!autofilter'] = { ref: `A1:P${excelRows.length + 1}` };
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Battery Warranties");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "BATTERY_WARRANTY_EXCEL_EXPORTED",
          resource: "WARRANTY",
          details: `Exported ${excelRows.length} battery warranty records to Excel by ${req.user.name} (${req.user.role}).`,
          metadata: JSON.stringify({ recordCount: excelRows.length })
        }
      });

      const filenameDate = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="MTS_Lab_Battery_Warranties_${filenameDate}.xlsx"`);
      return res.send(excelBuffer);
    } catch (err: any) {
      console.error("[EXPORT BATTERY WARRANTIES ERROR]", err);
      res.status(500).json({ error: "Failed to export battery warranties to Excel: " + err.message });
    }
  });

  // 2. Download Clean Excel Template (.xlsx)
  app.get("/api/battery-warranties/import/template", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const templateRows = [
        {
          'Repair Number': '1001',
          'Customer Name': 'Manish Sharma',
          'Customer Phone Number': '9869276668',
          'Customer Email': 'customer@example.com',
          'Device Brand': 'Apple',
          'Device Model': 'iPhone 13',
          'IMEI Number': '354892019283741',
          'Battery Type': 'Original Replacement Battery',
          'Battery Warranty Period': '6 Months',
          'Warranty Register Date': '20/08/2026',
          'Warranty Expiry Date': '20/02/2027',
          'Warranty Status': 'ACTIVE',
          'Terms / Notes': 'Standard MTS Lab Battery Warranty'
        },
        {
          'Repair Number': '1002',
          'Customer Name': 'Sabita Thakur',
          'Customer Phone Number': '015364307',
          'Customer Email': 'sabita@example.com',
          'Device Brand': 'Samsung',
          'Device Model': 'Galaxy S21 Ultra',
          'IMEI Number': '359182736451920',
          'Battery Type': 'High Capacity OEM Battery',
          'Battery Warranty Period': '1 Year',
          'Warranty Register Date': '20/08/2026',
          'Warranty Expiry Date': '20/08/2027',
          'Warranty Status': 'ACTIVE',
          'Terms / Notes': '1-Year Extended Coverage'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateRows);

      // Force text cell type for Phone and IMEI to keep leading zeros in template
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:M3');
      for (let R = 1; R <= range.e.r; ++R) {
        const phoneCell = XLSX.utils.encode_cell({ r: R, c: 2 });
        if (worksheet[phoneCell]) worksheet[phoneCell].t = 's';
        const imeiCell = XLSX.utils.encode_cell({ r: R, c: 6 });
        if (worksheet[imeiCell]) worksheet[imeiCell].t = 's';
      }

      worksheet['!cols'] = [
        { wch: 16 }, // Repair Number
        { wch: 22 }, // Customer Name
        { wch: 22 }, // Customer Phone Number
        { wch: 24 }, // Customer Email
        { wch: 15 }, // Device Brand
        { wch: 20 }, // Device Model
        { wch: 20 }, // IMEI Number
        { wch: 28 }, // Battery Type
        { wch: 24 }, // Battery Warranty Period
        { wch: 22 }, // Warranty Register Date
        { wch: 22 }, // Warranty Expiry Date
        { wch: 16 }, // Warranty Status
        { wch: 35 }  // Terms / Notes
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Warranty Import Template");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="MTS_Lab_Battery_Warranty_Template.xlsx"');
      return res.send(excelBuffer);
    } catch (err: any) {
      console.error("[DOWNLOAD WARRANTY TEMPLATE ERROR]", err);
      res.status(500).json({ error: "Failed to generate Excel template: " + err.message });
    }
  });

  // Helper date parser supporting string dates and Excel serial numbers
  const parseExcelDateValue = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === 'number') {
      // Excel serial date formula (standard 1900 date system)
      const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
      const parts = trimmed.split(/[/.\-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          const d = new Date(trimmed);
          return isNaN(d.getTime()) ? null : d;
        } else {
          // DD/MM/YYYY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const d = new Date(year, month, day);
            return isNaN(d.getTime()) ? null : d;
          }
        }
      }
      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  // Helper to normalize warranty period
  const normalizeWarrantyPeriod = (val: any): '6_MONTHS' | '1_YEAR' => {
    if (!val) return '6_MONTHS';
    const str = String(val).trim().toUpperCase();
    if (str.includes('1') && (str.includes('YEAR') || str.includes('YR') || str.includes('12'))) {
      return '1_YEAR';
    }
    return '6_MONTHS';
  };

  // 3. Import Preview Endpoint (Accepts Excel File or JSON Rows)
  app.post("/api/battery-warranties/import/preview", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), upload.single('file'), async (req: any, res) => {
    try {
      let rawRows: any[] = [];

      if (req.file) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return res.status(400).json({ error: "The uploaded Excel workbook contains no worksheets." });
        }
        const worksheet = workbook.Sheets[sheetName];
        rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      } else if (req.body?.rows && Array.isArray(req.body.rows)) {
        rawRows = req.body.rows;
      } else {
        return res.status(400).json({ error: "Please upload an Excel (.xlsx) file or provide rows for preview." });
      }

      if (rawRows.length === 0) {
        return res.status(400).json({ error: "The Excel file is empty. Please provide data rows to import." });
      }

      // Check for presence of required key columns in sheet
      const firstRow = rawRows[0];
      const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
      const hasCustomer = keys.some(k => k.includes('customer') || k.includes('name'));
      const hasPhone = keys.some(k => k.includes('phone') || k.includes('contact') || k.includes('mobile'));

      if (!hasCustomer || !hasPhone) {
        return res.status(400).json({
          error: "Missing required columns in Excel sheet. The file must contain at least 'Customer Name' and 'Customer Phone Number' columns."
        });
      }

      // Fetch existing DB state for duplicate and relation checks
      const existingWarranties = await prisma.batteryWarranty.findMany({
        select: {
          warrantyNumber: true,
          repairNumber: true,
          customerPhone: true
        }
      });
      const existingWarrantyNumbers = new Set(existingWarranties.map(w => w.warrantyNumber.toUpperCase()));
      const existingRepairWarrantyNumbers = new Set(existingWarranties.map(w => w.repairNumber.toUpperCase()));

      // Fetch all repairs for relation checks
      const existingRepairs = await prisma.repair.findMany({
        select: {
          id: true,
          repairNumber: true,
          customerName: true,
          customerPhone: true,
          deviceBrand: true,
          deviceModel: true
        }
      });
      const repairMap = new Map<string, any>();
      existingRepairs.forEach(r => {
        repairMap.set(r.repairNumber.toUpperCase(), r);
      });

      const processedItems: any[] = [];
      const seenWarrantiesInFile = new Set<string>();
      const seenRepairsInFile = new Set<string>();

      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const rowNumber = i + 2; // Excel header is row 1
        const raw = rawRows[i];

        // Flexible key matching
        const getField = (aliases: string[]) => {
          for (const key of Object.keys(raw)) {
            const cleanKey = key.trim().toLowerCase();
            for (const alias of aliases) {
              if (cleanKey === alias.toLowerCase() || cleanKey.includes(alias.toLowerCase())) {
                return String(raw[key] || '').trim();
              }
            }
          }
          return '';
        };

        const warrantyId = getField(['warranty id', 'warrantynumber', 'warranty_id', 'certificate id']);
        const repairNumber = getField(['repair number', 'repairnumber', 'repair_number', 'job number', 'job #']);
        const customerName = getField(['customer name', 'customername', 'name', 'client name']);
        const customerPhone = getField(['customer phone number', 'customer phone', 'phone number', 'phone', 'mobile']);
        const customerEmail = getField(['customer email', 'email address', 'email']);
        const deviceBrand = getField(['device brand', 'brand', 'make']);
        const deviceModel = getField(['device model', 'model', 'device']);
        const imeiNumber = getField(['imei number', 'imei', 'serial']);
        const batteryType = getField(['battery type', 'battery']) || 'Original Replacement Battery';
        const rawPeriod = getField(['battery warranty period', 'warranty period', 'period', 'duration']);
        const rawRegDate = getField(['warranty register date', 'register date', 'registration date', 'start date']);
        const rawExpDate = getField(['warranty expiry date', 'expiry date', 'expiration date', 'end date']);
        const rawStatus = getField(['warranty status', 'status']) || 'ACTIVE';
        const terms = getField(['terms / notes', 'terms', 'notes', 'remarks']);

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validation 1: Customer Name
        if (!customerName) {
          errors.push("Customer Name is required.");
        }

        // Validation 2: Customer Phone Number
        if (!customerPhone) {
          errors.push("Customer Phone Number is required.");
        } else if (customerPhone.replace(/\D/g, '').length < 7) {
          errors.push(`Invalid phone number '${customerPhone}'. Must have at least 7 digits.`);
        }

        // Validation 3: Device Brand & Model
        if (!deviceBrand && !deviceModel) {
          errors.push("Device Brand and Model are required.");
        }

        // Validation 4: Warranty Period & Dates
        const warrantyPeriod = normalizeWarrantyPeriod(rawPeriod);
        let regDate = rawRegDate ? parseExcelDateValue(rawRegDate) : new Date();
        if (!regDate) {
          errors.push(`Invalid register date '${rawRegDate}'. Use DD/MM/YYYY format.`);
          regDate = new Date();
        }

        let expDate = rawExpDate ? parseExcelDateValue(rawExpDate) : null;
        if (!expDate) {
          // Auto-calculate expiry date from period
          expDate = calculateWarrantyExpiryDate(regDate, warrantyPeriod);
        } else if (expDate <= regDate) {
          errors.push(`Warranty Expiry Date must be after Registration Date.`);
        }

        // Validation 5: Duplicate Protection
        let isDuplicate = false;

        if (warrantyId) {
          const upperWarrantyId = warrantyId.toUpperCase();
          if (existingWarrantyNumbers.has(upperWarrantyId)) {
            isDuplicate = true;
            errors.push(`Duplicate: Warranty ID '${warrantyId}' already exists in database.`);
          }
          if (seenWarrantiesInFile.has(upperWarrantyId)) {
            isDuplicate = true;
            errors.push(`Duplicate: Warranty ID '${warrantyId}' appears multiple times in Excel file.`);
          }
          seenWarrantiesInFile.add(upperWarrantyId);
        }

        if (repairNumber) {
          const upperRepNum = repairNumber.toUpperCase();
          if (existingRepairWarrantyNumbers.has(upperRepNum)) {
            isDuplicate = true;
            errors.push(`Duplicate: A battery warranty is already registered for Repair #${repairNumber}.`);
          }
          if (seenRepairsInFile.has(upperRepNum)) {
            isDuplicate = true;
            errors.push(`Duplicate: Repair #${repairNumber} appears multiple times in Excel file.`);
          }
          seenRepairsInFile.add(upperRepNum);

          // Check if repair exists in MTS repair system
          if (!repairMap.has(upperRepNum)) {
            warnings.push(`Repair #${repairNumber} was not found in system. A linked repair record will be auto-generated.`);
          }
        }

        let status: 'VALID' | 'INVALID' | 'DUPLICATE' = 'VALID';
        if (isDuplicate) {
          status = 'DUPLICATE';
          duplicateCount++;
        } else if (errors.length > 0) {
          status = 'INVALID';
          invalidCount++;
        } else {
          status = 'VALID';
          validCount++;
        }

        processedItems.push({
          rowNumber,
          status,
          errors,
          warnings,
          data: {
            warrantyId: warrantyId || undefined,
            repairNumber: repairNumber || undefined,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim() || undefined,
            deviceBrand: (deviceBrand || 'Smartphone').trim().toUpperCase(),
            deviceModel: (deviceModel || 'Standard Model').trim(),
            imeiNumber: imeiNumber.trim() || undefined,
            batteryType: batteryType.trim(),
            warrantyPeriod,
            registrationDate: regDate.toISOString(),
            expiryDate: expDate.toISOString(),
            status: rawStatus.toUpperCase().includes('EXPIR') ? 'EXPIRED' : 'ACTIVE',
            terms: terms.trim() || undefined
          }
        });
      }

      res.json({
        success: true,
        totalRows: rawRows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
        items: processedItems
      });
    } catch (err: any) {
      console.error("[IMPORT PREVIEW ERROR]", err);
      res.status(500).json({ error: "Failed to preview Excel file: " + err.message });
    }
  });

  // 4. Confirm & Execute Excel Import Endpoint
  app.post("/api/battery-warranties/import/confirm", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No valid warranty records provided to import." });
      }

      const createdWarranties: any[] = [];
      let skippedCount = 0;

      // Get default branch for any new auto-generated records
      const defaultBranch = await prisma.branch.findFirst();
      const branchId = req.user.branchId || defaultBranch?.id || null;

      // Atomic processing for safe database execution
      for (const item of items) {
        const d = item.data || item;

        if (!d.customerName || !d.customerPhone) {
          skippedCount++;
          continue;
        }

        const normPhone = normalizePhone(d.customerPhone);

        // 1. Find or create Customer without creating duplicate customer records
        const customer = await findOrCreateCustomer({
          name: d.customerName.trim(),
          phone: normPhone || d.customerPhone.trim(),
          email: d.customerEmail || null,
          address: null
        });

        // 2. Link to existing repair or generate standard repair record
        let repair: any = null;
        if (d.repairNumber) {
          repair = await prisma.repair.findUnique({
            where: { repairNumber: String(d.repairNumber).trim() }
          });
        }

        if (!repair) {
          const generatedRepairNumber = d.repairNumber ? String(d.repairNumber).trim() : await generateUniqueRepairNumber();
          repair = await prisma.repair.create({
            data: {
              repairNumber: generatedRepairNumber,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              customerEmail: customer.email,
              deviceBrand: d.deviceBrand || 'SMARTPHONE',
              deviceModel: d.deviceModel || 'Model',
              imeiNumber: d.imeiNumber || null,
              problemDescription: "Battery Replacement (Imported from Excel)",
              deviceCondition: "Good",
              status: "DELIVERED",
              estimatedCost: 0,
              advancePaid: 0,
              totalPaid: 0,
              paymentStatus: "PAID",
              createdById: req.user.id,
              branchId: branchId || 'default-branch'
            }
          });
        }

        // Check if warranty already exists for this repair
        const existingForRepair = await prisma.batteryWarranty.findUnique({
          where: { repairId: repair.id }
        });
        if (existingForRepair) {
          skippedCount++;
          continue;
        }

        const warrantyNumber = d.warrantyId && d.warrantyId.startsWith('BW-')
          ? d.warrantyId
          : await generateUniqueWarrantyNumber();

        const regDate = d.registrationDate ? new Date(d.registrationDate) : new Date();
        const expDate = d.expiryDate ? new Date(d.expiryDate) : calculateWarrantyExpiryDate(regDate, d.warrantyPeriod || '6_MONTHS');

        const warranty = await prisma.batteryWarranty.create({
          data: {
            warrantyNumber,
            repairId: repair.id,
            repairNumber: repair.repairNumber,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            deviceBrand: repair.deviceBrand,
            deviceModel: repair.deviceModel,
            imeiNumber: d.imeiNumber || repair.imeiNumber || null,
            batteryType: d.batteryType || 'Original Replacement Battery',
            warrantyPeriod: d.warrantyPeriod || '6_MONTHS',
            registrationDate: regDate,
            expiryDate: expDate,
            status: expDate < new Date() ? 'EXPIRED' : (d.status || 'ACTIVE'),
            claimCount: 0,
            terms: d.terms || "Standard MTS Lab Battery Warranty Terms & Conditions",
            createdById: req.user.id,
            branchId: branchId
          },
          include: {
            claims: true,
            repair: true,
            customer: true
          }
        });

        // Broadcast Real-time & Firestore Sync
        await syncToFirestore("batteryWarranty", warranty);
        broadcastRealtimeEvent({ entity: "batteryWarranty", action: "CREATE", id: warranty.id, data: warranty });

        createdWarranties.push(warranty);
      }

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: "BATTERY_WARRANTY_EXCEL_IMPORTED",
          resource: "WARRANTY",
          details: `Imported ${createdWarranties.length} battery warranty records from Excel by ${req.user.name} (${req.user.role}). Skipped ${skippedCount} duplicate/invalid records.`,
          metadata: JSON.stringify({
            importedCount: createdWarranties.length,
            skippedCount
          })
        }
      });

      res.status(201).json({
        success: true,
        message: `Successfully imported ${createdWarranties.length} battery warranty records.`,
        importedCount: createdWarranties.length,
        skippedCount,
        warranties: createdWarranties
      });
    } catch (err: any) {
      console.error("[CONFIRM WARRANTY IMPORT ERROR]", err);
      res.status(500).json({ error: "Failed to complete Excel warranty import: " + err.message });
    }
  });

  // Get single battery warranty details with full claim history
  app.get("/api/battery-warranties/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), syncRouteMiddleware(['batteryWarranty', 'batteryWarrantyClaim', 'repair', 'customer']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const warranty = await prisma.batteryWarranty.findUnique({
        where: { id },
        include: {
          claims: {
            orderBy: { claimDate: 'desc' }
          },
          repair: true,
          customer: true,
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });

      if (!warranty) {
        return res.status(404).json({ error: "Battery warranty record not found." });
      }

      res.json({
        success: true,
        warranty
      });
    } catch (err: any) {
      console.error("[GET BATTERY WARRANTY ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve battery warranty." });
    }
  });

  // Create Battery Warranty manually for an existing repair job
  app.post("/api/battery-warranties", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    const { repairId, warrantyPeriod, batteryType, terms } = req.body;

    if (!repairId) {
      return res.status(400).json({ error: "Repair ID is required to register a battery warranty." });
    }

    try {
      const repair = await prisma.repair.findUnique({
        where: { id: repairId },
        include: { customer: true }
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair job not found." });
      }

      // Check if warranty already exists for this repair
      const existingWarranty = await prisma.batteryWarranty.findUnique({
        where: { repairId }
      });

      if (existingWarranty) {
        return res.status(400).json({
          error: `A battery warranty already exists for repair #${repair.repairNumber} (${existingWarranty.warrantyNumber}).`,
          existingWarranty
        });
      }

      const period = warrantyPeriod === "1_YEAR" ? "1_YEAR" : "6_MONTHS";
      const bType = batteryType || "Original Replacement Battery";
      const registrationDate = new Date();
      const expiryDate = calculateWarrantyExpiryDate(registrationDate, period);
      const warrantyNumber = await generateUniqueWarrantyNumber();

      const warranty = await prisma.batteryWarranty.create({
        data: {
          warrantyNumber,
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          customerId: repair.customerId || null,
          customerName: repair.customerName,
          customerPhone: repair.customerPhone,
          customerEmail: repair.customerEmail || null,
          customerAddress: repair.customerAddress || null,
          deviceBrand: repair.deviceBrand,
          deviceModel: repair.deviceModel,
          imeiNumber: repair.imeiNumber || null,
          batteryType: bType,
          warrantyPeriod: period,
          registrationDate,
          expiryDate,
          status: "ACTIVE",
          claimCount: 0,
          terms: terms || "Warranty covers battery performance, failure to retain charge, or premature degradation according to MTS Lab terms. Accidental physical damage or liquid ingress is excluded.",
          createdById: req.user.id,
          branchId: repair.branchId || null
        },
        include: {
          claims: true,
          repair: true,
          customer: true
        }
      });

      // Realtime event and Firestore sync
      await syncToFirestore("batteryWarranty", warranty);
      broadcastRealtimeEvent({ entity: "batteryWarranty", action: "CREATE", id: warranty.id, data: warranty });

      // Audit Log
      await recordAuditLog({
        req,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: "BATTERY_WARRANTY_CREATED",
        resource: "WARRANTY",
        resourceId: warranty.id,
        status: "SUCCESS",
        details: `Created ${period === '1_YEAR' ? '1-Year' : '6-Month'} Battery Warranty #${warranty.warrantyNumber} for repair #${repair.repairNumber} (${repair.customerName}).`
      });

      res.status(201).json({
        success: true,
        message: `Battery Warranty #${warranty.warrantyNumber} created successfully.`,
        warranty
      });
    } catch (err: any) {
      console.error("[CREATE BATTERY WARRANTY ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to create battery warranty." });
    }
  });

  // Process a Warranty Claim
  app.post("/api/battery-warranties/:id/claim", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    const { id } = req.params;
    const { issueDescription, actionTaken, notes, replacementRepairId } = req.body;

    if (!issueDescription || !String(issueDescription).trim()) {
      return res.status(400).json({ error: "Please provide a description of the battery problem/issue." });
    }

    try {
      const warranty = await prisma.batteryWarranty.findUnique({
        where: { id },
        include: { repair: true, customer: true, claims: true }
      });

      if (!warranty) {
        return res.status(404).json({ error: "Battery warranty record not found." });
      }

      // Check Expiry Date
      const now = new Date();
      const isExpired = new Date(warranty.expiryDate) < now;

      if (isExpired && warranty.status === 'EXPIRED') {
        const formattedExpiry = new Date(warranty.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        return res.status(400).json({
          error: `Cannot process a standard warranty claim for an EXPIRED warranty. This warranty expired on ${formattedExpiry}.`
        });
      }

      const claimNumber = await generateUniqueClaimNumber();
      const action = actionTaken || "BATTERY_REPLACED";

      // Execute transaction to create claim and update warranty
      const [claim, updatedWarranty] = await prisma.$transaction(async (tx) => {
        const newClaim = await tx.batteryWarrantyClaim.create({
          data: {
            claimNumber,
            warrantyId: warranty.id,
            repairNumber: warranty.repairNumber,
            customerName: warranty.customerName,
            customerPhone: warranty.customerPhone,
            deviceBrand: warranty.deviceBrand,
            deviceModel: warranty.deviceModel,
            claimDate: new Date(),
            issueDescription: String(issueDescription).trim(),
            status: "APPROVED",
            actionTaken: action,
            notes: notes ? String(notes).trim() : null,
            processedById: req.user.id,
            processedByName: req.user.name || req.user.role,
            replacementRepairId: replacementRepairId || null
          }
        });

        const newStatus = action === 'BATTERY_REPLACED' ? 'REPLACED' : 'CLAIMED';

        const upd = await tx.batteryWarranty.update({
          where: { id: warranty.id },
          data: {
            claimCount: { increment: 1 },
            lastClaimDate: new Date(),
            status: newStatus,
            updatedAt: new Date()
          },
          include: {
            claims: { orderBy: { claimDate: 'desc' } },
            repair: true,
            customer: true
          }
        });

        return [newClaim, upd];
      });

      // Sync to Firestore & Realtime event
      await syncToFirestore("batteryWarrantyClaim", claim);
      await syncToFirestore("batteryWarranty", updatedWarranty);
      broadcastRealtimeEvent({ entity: "batteryWarrantyClaim", action: "CREATE", id: claim.id, data: claim });
      broadcastRealtimeEvent({ entity: "batteryWarranty", action: "UPDATE", id: updatedWarranty.id, data: updatedWarranty });

      // Audit Log
      await recordAuditLog({
        req,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: "WARRANTY_CLAIM_PROCESSED",
        resource: "WARRANTY_CLAIM",
        resourceId: claim.id,
        status: "SUCCESS",
        details: `Processed warranty claim #${claim.claimNumber} for warranty #${warranty.warrantyNumber} (${warranty.customerName}). Action: ${action}. Problem: ${issueDescription}`
      });

      res.json({
        success: true,
        message: `Warranty claim #${claim.claimNumber} registered and approved successfully. Total claims on this warranty: ${updatedWarranty.claimCount}.`,
        claim,
        warranty: updatedWarranty
      });
    } catch (err: any) {
      console.error("[PROCESS WARRANTY CLAIM ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to process warranty claim." });
    }
  });

  // Get Claim History for a Warranty
  app.get("/api/battery-warranties/:id/claims", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const claims = await prisma.batteryWarrantyClaim.findMany({
        where: { warrantyId: id },
        orderBy: { claimDate: 'desc' }
      });

      res.json({
        success: true,
        claims
      });
    } catch (err: any) {
      console.error("[GET WARRANTY CLAIMS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch warranty claims." });
    }
  });

  // Send Warranty Certificate to Customer by Email
  app.post("/api/battery-warranties/:id/send-email", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    const { id } = req.params;
    const { email } = req.body;

    try {
      const warranty = await prisma.batteryWarranty.findUnique({
        where: { id },
        include: { customer: true, repair: true }
      });

      if (!warranty) {
        return res.status(404).json({ error: "Battery warranty record not found." });
      }

      const targetEmail = (email || warranty.customerEmail || warranty.customer?.email || '').trim();
      if (!targetEmail || !targetEmail.includes('@')) {
        return res.status(400).json({ error: "A valid customer email address is required to send the warranty certificate." });
      }

      const formattedRegDate = new Date(warranty.registrationDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      const formattedExpDate = new Date(warranty.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #0f172a; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">MTS LAB</h1>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Smartphone Restoration & Battery Care</p>
          </div>
          
          <div style="padding: 28px;">
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
              <span style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Official Battery Warranty Certificate</span>
              <h2 style="margin: 6px 0 0 0; color: #14532d; font-size: 20px; font-weight: 800;">${warranty.warrantyNumber}</h2>
            </div>

            <p style="font-size: 15px; color: #334155; line-height: 1.5; margin: 0 0 16px 0;">
              Dear <strong>${warranty.customerName}</strong>,
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for trusting MTS Lab. Your battery replacement warranty is officially registered in our system. Below are your official warranty details:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Repair Job Number:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right;">#${warranty.repairNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Device / Model:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right;">${warranty.deviceBrand.toUpperCase()} ${warranty.deviceModel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Warranty Duration:</td>
                <td style="padding: 10px 0; color: #15803d; font-weight: 800; text-align: right;">${warranty.warrantyPeriod === '1_YEAR' ? '1 Year (12 Months)' : '6 Months'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Registration Date:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right;">${formattedRegDate}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Warranty Expiry Date:</td>
                <td style="padding: 10px 0; color: #dc2626; font-weight: 800; text-align: right;">${formattedExpDate}</td>
              </tr>
            </table>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.5;">
              <strong style="color: #334155;">Warranty Terms Summary:</strong><br/>
              • Warranty covers battery performance degradation, charging failure, or premature capacity loss.<br/>
              • Physical damage, water ingress, swollen battery, and unauthorized third-party repairs void the warranty.<br/>
              • Please retain this warranty ID and repair number for any future service claims.
            </div>

            <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0;">MTS Lab • Mobile Technology Station</p>
              <p style="margin: 4px 0 0 0;">New Road, Kathmandu, Nepal • Ph/Tel: 986927668, 015364307</p>
            </div>
          </div>
        </div>
      `;

      await sendEmail({
        to: targetEmail,
        subject: `MTS Lab — Official Battery Warranty Certificate #${warranty.warrantyNumber}`,
        html: emailHtml
      });

      res.json({
        success: true,
        message: `Official battery warranty certificate sent successfully to ${targetEmail}.`
      });
    } catch (err: any) {
      console.error("[SEND WARRANTY EMAIL ERROR]", err);
      res.status(500).json({ error: "Failed to send warranty email. Please verify SMTP configuration." });
    }
  });

  app.patch("/api/repairs/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { technicianId, customerPhone, status } = req.body;
      const updateData = { ...req.body };

      let normalizedStatus: string | undefined = undefined;
      if (status) {
        normalizedStatus = normalizeRepairStatus(status);
        if (!VALID_REPAIR_STATUSES.includes(normalizedStatus)) {
          return res.status(400).json({ error: `Invalid repair status: ${status}. Allowed: ${VALID_REPAIR_STATUSES.join(', ')}` });
        }
        updateData.status = normalizedStatus;
      }
      
      if (customerPhone) {
        updateData.customerPhone = normalizePhone(customerPhone);
      }

      if (technicianId === "") {
        updateData.technicianId = null;
      } else if (technicianId) {
        const technician = await prisma.user.findUnique({ where: { id: technicianId } });
        if (!technician || technician.role !== 'TECHNICIAN') {
          return res.status(400).json({ error: "Invalid technician ID" });
        }
      }

      const existingRepair = await prisma.repair.findUnique({ where: { id } });
      if (!existingRepair) {
        return res.status(404).json({ error: "Repair record not found in central database." });
      }

      // Security check: Only SUPER_ADMIN, ADMIN, and RECEPTIONIST can reopen a DELIVERED repair
      if (existingRepair.status === 'DELIVERED' && normalizedStatus && normalizedStatus !== 'DELIVERED') {
        if (!['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(req.user.role)) {
          return res.status(403).json({ error: "Only Super Admin, Admin, or Receptionist can reopen a delivered repair record." });
        }
      }

      if ('estimatedCost' in req.body) {
        if (req.body.estimatedCost === "" || req.body.estimatedCost === null || req.body.estimatedCost === undefined) {
          updateData.estimatedCost = null;
        } else {
          const costVal = Number(req.body.estimatedCost);
          updateData.estimatedCost = !isNaN(costVal) && costVal >= 0 ? costVal : null;
        }
      }

      if ('advancePaid' in req.body) {
        if (req.body.advancePaid === "" || req.body.advancePaid === null || req.body.advancePaid === undefined) {
          updateData.advancePaid = 0;
        } else {
          const advVal = Number(req.body.advancePaid);
          updateData.advancePaid = !isNaN(advVal) && advVal >= 0 ? advVal : 0;
        }
      }

      if ('totalPaid' in req.body) {
        if (req.body.totalPaid === "" || req.body.totalPaid === null || req.body.totalPaid === undefined) {
          updateData.totalPaid = updateData.advancePaid !== undefined ? updateData.advancePaid : (existingRepair.advancePaid || 0);
        } else {
          const totVal = Number(req.body.totalPaid);
          updateData.totalPaid = !isNaN(totVal) && totVal >= 0 ? totVal : 0;
        }
      }

      if (!req.body.paymentStatus && (updateData.estimatedCost !== undefined || updateData.advancePaid !== undefined)) {
        const finalEst = updateData.estimatedCost !== undefined ? updateData.estimatedCost : existingRepair.estimatedCost;
        const finalAdv = updateData.advancePaid !== undefined ? updateData.advancePaid : existingRepair.advancePaid;
        if (finalEst !== null && finalEst !== undefined && finalEst > 0) {
          if (finalAdv >= finalEst) {
            updateData.paymentStatus = 'PAID';
          } else if (finalAdv > 0) {
            updateData.paymentStatus = 'PARTIAL';
          } else {
            updateData.paymentStatus = 'UNPAID';
          }
        }
      }

      if ('deviceCondition' in req.body) {
        updateData.deviceCondition = sanitizeDeviceCondition(req.body.deviceCondition);
      }

      if ('accessoriesReceived' in req.body) {
        updateData.accessoriesReceived = sanitizeAccessoriesReceived(req.body.accessoriesReceived);
      }

      if ('expectedCompletionDate' in req.body) {
        updateData.expectedCompletionDate = req.body.expectedCompletionDate ? new Date(req.body.expectedCompletionDate) : null;
      }

      // Remove non-schema fields to prevent Prisma update errors
      const nonSchemaKeys = [
        'note', 'notes', 'customer', 'technician', 'logs', 'batteryWarranty', 
        'createdBy', 'hasBatteryWarranty', 'batteryWarrantyPeriod', 'batteryType',
        'customCourierCompany', 'senderDispatchDate', 'labReceivedDate'
      ];
      for (const k of nonSchemaKeys) {
        delete updateData[k];
      }

      updateData.updatedAt = new Date();

      // Transactional atomic execution
      const [repair, newLog] = await prisma.$transaction(async (tx) => {
        const updated = await tx.repair.update({
          where: { id },
          data: updateData,
          include: {
            technician: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            logs: { orderBy: { createdAt: 'desc' } },
            notes: { include: { technician: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }
          }
        });

        let logEntry = null;
        if (normalizedStatus && normalizedStatus !== existingRepair.status) {
          const noteText = req.body.note || req.body.remarks || '';
          let logMsg = `Status updated to ${normalizedStatus.replace(/_/g, ' ')} by ${req.user.name || req.user.role}`;
          if (normalizedStatus === 'RE_PROBLEM') {
            logMsg = noteText 
              ? `Reopened as Re-Problem (Warranty): ${noteText} - by ${req.user.name || req.user.role}`
              : `Device reopened for Re-Problem / Warranty service by ${req.user.name || req.user.role}`;
          } else if (noteText) {
            logMsg += ` - ${noteText}`;
          }

          logEntry = await tx.repairLog.create({
            data: {
              repairId: id,
              status: normalizedStatus,
              message: logMsg
            }
          });
        }

        return [updated, logEntry];
      });

      // Explicitly broadcast to all connected devices on the network
      broadcastRealtimeEvent({
        entity: "repair",
        action: "UPDATE",
        id: repair.id,
        data: repair
      });

      if (newLog) {
        broadcastRealtimeEvent({
          entity: "repairLog",
          action: "CREATE",
          id: newLog.id,
          data: newLog
        });
      }

      // If technician was newly assigned in this update, notify the technician
      if (technicianId && technicianId !== existingRepair.technicianId) {
        const isUrgent = repair.priority === 'URGENT';
        await sendSystemNotification({
          userId: technicianId,
          title: isUrgent ? "🚨 Urgent Repair Assigned" : "🔔 New Repair Assigned",
          message: isUrgent
            ? `🚨 URGENT job #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}) assigned to you by ${req.user.name || req.user.role}. Problem: ${repair.problemDescription || 'Immediate action required'}`
            : `Repair #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}) has been assigned to you by ${req.user.name || req.user.role}. Problem: ${repair.problemDescription}`,
          type: isUrgent ? "REPAIR_URGENT" : "REPAIR_ASSIGNED",
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            assignedAt: new Date().toISOString(),
            priority: repair.priority,
            isUrgent,
            problemDescription: repair.problemDescription,
            deviceBrand: repair.deviceBrand,
            deviceModel: repair.deviceModel
          }
        });
      } else if (req.body.priority && ['HIGH', 'URGENT'].includes(String(req.body.priority).toUpperCase()) && repair.technicianId && String(req.body.priority).toUpperCase() !== existingRepair.priority) {
        const upPri = String(req.body.priority).toUpperCase();
        await sendSystemNotification({
          userId: repair.technicianId,
          title: upPri === 'URGENT' ? '🚨 URGENT Repair Marked' : '⚠️ High Priority Repair',
          message: `Job #${repair.repairNumber} (${repair.deviceBrand} ${repair.deviceModel}) marked as ${upPri} priority by ${req.user.name || req.user.role}. Problem: ${repair.problemDescription || 'Please prioritize immediate technical action.'}`,
          type: upPri === 'URGENT' ? 'REPAIR_URGENT' : 'REPAIR_ALERT',
          repairId: repair.id,
          repairNumber: repair.repairNumber,
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            priority: upPri,
            isUrgent: upPri === 'URGENT',
            deviceBrand: repair.deviceBrand,
            deviceModel: repair.deviceModel,
            repairNumber: repair.repairNumber,
            markedAt: new Date().toISOString()
          }
        });
      }

      // Sync to Firestore asynchronously
      syncToFirestore('repair', repair).catch((e) => console.warn("[FIRESTORE ASYNC SYNC]", e?.message));

      // --- Handle Optional Battery Replacement Warranty Update ---
      let updatedWarranty: any = null;
      if (req.body.hasBatteryWarranty === true || String(req.body.hasBatteryWarranty) === "true") {
        const period = req.body.batteryWarrantyPeriod === "1_YEAR" ? "1_YEAR" : "6_MONTHS";
        const bType = req.body.batteryType || "Original Replacement Battery";
        
        const existingWarranty = await prisma.batteryWarranty.findUnique({
          where: { repairId: id }
        });

        if (!existingWarranty) {
          const registrationDate = new Date();
          const expiryDate = calculateWarrantyExpiryDate(registrationDate, period);
          const warrantyNumber = await generateUniqueWarrantyNumber();

          updatedWarranty = await prisma.batteryWarranty.create({
            data: {
              warrantyNumber,
              repairId: repair.id,
              repairNumber: repair.repairNumber,
              customerId: repair.customerId || null,
              customerName: repair.customerName,
              customerPhone: repair.customerPhone,
              customerEmail: repair.customerEmail || null,
              customerAddress: repair.customerAddress || null,
              deviceBrand: repair.deviceBrand,
              deviceModel: repair.deviceModel,
              imeiNumber: repair.imeiNumber || null,
              batteryType: bType,
              warrantyPeriod: period,
              registrationDate,
              expiryDate,
              status: "ACTIVE",
              claimCount: 0,
              terms: "Warranty covers battery performance, failure to retain charge, or premature degradation according to MTS Lab terms. Accidental physical damage or liquid ingress is excluded.",
              createdById: req.user.id,
              branchId: repair.branchId || null
            }
          });

          await syncToFirestore("batteryWarranty", updatedWarranty);
          broadcastRealtimeEvent({ entity: "batteryWarranty", action: "CREATE", id: updatedWarranty.id, data: updatedWarranty });

          await recordAuditLog({
            req,
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            userRole: req.user.role,
            action: "BATTERY_WARRANTY_CREATED",
            resource: "WARRANTY",
            resourceId: updatedWarranty.id,
            status: "SUCCESS",
            details: `Created ${period === '1_YEAR' ? '1-Year' : '6-Month'} Battery Warranty #${updatedWarranty.warrantyNumber} for repair #${repair.repairNumber} (${repair.customerName}) on edit.`
          });
        } else {
          // Warranty already exists: update customer/device details, duration, and ensure status is ACTIVE
          const periodToUse = req.body.batteryWarrantyPeriod ? (req.body.batteryWarrantyPeriod === "1_YEAR" ? "1_YEAR" : "6_MONTHS") : existingWarranty.warrantyPeriod;
          const expiryDate = calculateWarrantyExpiryDate(existingWarranty.registrationDate || new Date(), periodToUse);

          updatedWarranty = await prisma.batteryWarranty.update({
            where: { id: existingWarranty.id },
            data: {
              customerName: repair.customerName,
              customerPhone: repair.customerPhone,
              customerEmail: repair.customerEmail || null,
              customerAddress: repair.customerAddress || null,
              deviceBrand: repair.deviceBrand,
              deviceModel: repair.deviceModel,
              imeiNumber: repair.imeiNumber || null,
              batteryType: bType,
              warrantyPeriod: periodToUse,
              expiryDate,
              status: existingWarranty.status === 'CANCELLED' ? 'ACTIVE' : existingWarranty.status,
              updatedAt: new Date()
            }
          });

          await syncToFirestore("batteryWarranty", updatedWarranty);
          broadcastRealtimeEvent({ entity: "batteryWarranty", action: "UPDATE", id: updatedWarranty.id, data: updatedWarranty });

          await recordAuditLog({
            req,
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            userRole: req.user.role,
            action: "BATTERY_WARRANTY_UPDATED",
            resource: "WARRANTY",
            resourceId: updatedWarranty.id,
            status: "SUCCESS",
            details: `Updated Battery Warranty #${updatedWarranty.warrantyNumber} for repair #${repair.repairNumber} on edit.`
          });
        }
      } else if (req.body.hasBatteryWarranty === false || String(req.body.hasBatteryWarranty) === "false") {
        const existingWarranty = await prisma.batteryWarranty.findUnique({
          where: { repairId: id }
        });

        if (existingWarranty && existingWarranty.status === 'ACTIVE') {
          updatedWarranty = await prisma.batteryWarranty.update({
            where: { id: existingWarranty.id },
            data: {
              status: 'CANCELLED',
              updatedAt: new Date()
            }
          });

          await syncToFirestore("batteryWarranty", updatedWarranty);
          broadcastRealtimeEvent({ entity: "batteryWarranty", action: "UPDATE", id: updatedWarranty.id, data: updatedWarranty });

          await recordAuditLog({
            req,
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            userRole: req.user.role,
            action: "BATTERY_WARRANTY_CANCELLED",
            resource: "WARRANTY",
            resourceId: updatedWarranty.id,
            status: "SUCCESS",
            details: `Cancelled Battery Warranty #${updatedWarranty.warrantyNumber} for repair #${repair.repairNumber} on edit.`
          });
        }
      }

      // Fetch latest composite repair with warranty
      const finalRepair = await prisma.repair.findUnique({
        where: { id: repair.id },
        include: {
          customer: true,
          technician: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          logs: { orderBy: { createdAt: 'desc' } },
          notes: { include: { technician: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
          batteryWarranty: true
        }
      });

      res.json(finalRepair || { ...repair, batteryWarranty: updatedWarranty });
    } catch (err: any) {
      console.error("[REPAIR UPDATE ERROR]", err);
      res.status(500).json({ error: "Unable to save the repair status. Please try again." });
    }
  });

  app.patch("/api/repairs/:id/technician-update", authenticate, authorize(['TECHNICIAN', 'LEAD_TECHNICIAN', 'MANAGER', 'SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, note, partsUsed, expectedCompletionDate } = req.body;

      const existingRepair = await prisma.repair.findUnique({
        where: { id },
        include: { technician: true }
      });

      if (!existingRepair) {
        return res.status(404).json({ error: "Repair record not found in central database." });
      }

      // Check technician assignment permission
      if (['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(req.user.role) && existingRepair.technicianId && existingRepair.technicianId !== req.user.id) {
        return res.status(403).json({ error: "You are only permitted to update repairs assigned to you." });
      }

      const updateData: any = {
        updatedAt: new Date()
      };

      let normalizedStatus: string | undefined = undefined;
      if (status !== undefined) {
        normalizedStatus = normalizeRepairStatus(status);
        if (!VALID_REPAIR_STATUSES.includes(normalizedStatus)) {
          return res.status(400).json({ error: `Invalid repair status: ${status}` });
        }
        updateData.status = normalizedStatus;
      }

      if (partsUsed !== undefined) {
        updateData.partsUsed = partsUsed;
      }

      if (expectedCompletionDate) {
        updateData.expectedCompletionDate = new Date(expectedCompletionDate);
      }

      // If repair was unassigned and technician takes it, auto-assign
      if (!existingRepair.technicianId && ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(req.user.role)) {
        updateData.technicianId = req.user.id;
      }

      // Atomic transactional execution
      const [repair, newLog, newNote] = await prisma.$transaction(async (tx) => {
        const updated = await tx.repair.update({
          where: { id },
          data: updateData,
          include: {
            technician: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            logs: { orderBy: { createdAt: 'desc' } },
            notes: { include: { technician: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }
          }
        });

        let logEntry = null;
        if (normalizedStatus && normalizedStatus !== existingRepair.status) {
          logEntry = await tx.repairLog.create({
            data: {
              repairId: id,
              status: normalizedStatus,
              message: `Operation status updated to ${normalizedStatus.replace(/_/g, ' ')}${note ? ` (${note})` : ''} by specialist ${req.user.name}`
            }
          });
        }

        let noteEntry = null;
        if (note && note.trim()) {
          noteEntry = await tx.technicianNote.create({
            data: {
              repairId: id,
              technicianId: req.user.id,
              note: note.trim()
            }
          });
        }

        return [updated, logEntry, noteEntry];
      });

      // Broadcast real-time changes instantly to all connected dashboards and client sessions
      broadcastRealtimeEvent({
        entity: "repair",
        action: "UPDATE",
        id: repair.id,
        data: repair
      });

      if (newLog) {
        broadcastRealtimeEvent({
          entity: "repairLog",
          action: "CREATE",
          id: newLog.id,
          data: newLog
        });
      }

      if (newNote) {
        broadcastRealtimeEvent({
          entity: "technicianNote",
          action: "CREATE",
          id: newNote.id,
          data: newNote
        });
      }

      // Sync to Firestore asynchronously
      syncToFirestore('repair', repair).catch((e) => console.warn("[FIRESTORE ASYNC SYNC]", e?.message));

      res.json(repair);
    } catch (err: any) {
      console.error("[TECHNICIAN UPDATE ERROR]", err);
      res.status(500).json({ error: "Unable to save the repair status. Please try again." });
    }
  });

  // Dedicated status endpoint supporting PUT / PATCH for universal compatibility
  app.all(["/api/repairs/:id/status"], authenticate, authorize(['TECHNICIAN', 'LEAD_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req: any, res) => {
    if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'POST') {
      return res.status(405).json({ error: "Method not allowed. Use PATCH or PUT." });
    }
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status field is required." });
      }

      const normalizedStatus = normalizeRepairStatus(status);
      if (!VALID_REPAIR_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ error: `Invalid status: ${status}` });
      }

      const existing = await prisma.repair.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Repair not found." });
      }

      // Security check: Only SUPER_ADMIN, ADMIN, and RECEPTIONIST can reopen a DELIVERED repair
      if (existing.status === 'DELIVERED' && normalizedStatus !== 'DELIVERED') {
        if (!['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(req.user.role)) {
          return res.status(403).json({ error: "Only Super Admin, Admin, or Receptionist can reopen a delivered repair record." });
        }
      }

      if (req.user.role === 'TECHNICIAN' && existing.technicianId && existing.technicianId !== req.user.id) {
        return res.status(403).json({ error: "You are only permitted to update repairs assigned to you." });
      }

      const [repair, newLog] = await prisma.$transaction(async (tx) => {
        const updated = await tx.repair.update({
          where: { id },
          data: {
            status: normalizedStatus,
            updatedAt: new Date(),
            ...(existing.technicianId === null && req.user.role === 'TECHNICIAN' ? { technicianId: req.user.id } : {})
          },
          include: {
            technician: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true } },
            logs: { orderBy: { createdAt: 'desc' } }
          }
        });

        let logMsg = `Status updated to ${normalizedStatus.replace(/_/g, ' ')} by ${req.user.name || req.user.role}`;
        if (normalizedStatus === 'RE_PROBLEM') {
          logMsg = note 
            ? `Reopened as Re-Problem (Warranty): ${note} - by ${req.user.name || req.user.role}`
            : `Device reopened for Re-Problem / Warranty service by ${req.user.name || req.user.role}`;
        } else if (note) {
          logMsg += ` - ${note}`;
        }

        const log = await tx.repairLog.create({
          data: {
            repairId: id,
            status: normalizedStatus,
            message: logMsg
          }
        });

        return [updated, log];
      });

      broadcastRealtimeEvent({ entity: "repair", action: "UPDATE", id: repair.id, data: repair });
      broadcastRealtimeEvent({ entity: "repairLog", action: "CREATE", id: newLog.id, data: newLog });
      syncToFirestore('repair', repair).catch(() => {});

      res.json(repair);
    } catch (err: any) {
      console.error("[STATUS UPDATE ERROR]", err);
      res.status(500).json({ error: "Unable to save the repair status. Please try again." });
    }
  });

  app.get("/api/dashboard/stats", authenticate, syncRouteMiddleware(['repair', 'payment', 'product', 'user', 'branch']), async (req: any, res) => {
    const totalRepairs = await prisma.repair.count();
    const pendingRepairs = await prisma.repair.count({ where: { status: 'PENDING' } });
    const completedRepairs = await prisma.repair.count({ where: { status: { in: ['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED'] } } });
    const totalRevenue = await prisma.repair.aggregate({ _sum: { totalPaid: true } });

    res.json({
      totalRepairs,
      pendingRepairs,
      completedRepairs,
      revenue: totalRevenue._sum.totalPaid || 0,
    });
  });

  app.get("/api/staff", authenticate, syncRouteMiddleware(['user', 'branch']), async (req: any, res) => {
    try {
      const staff = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true }
      });
      res.json(staff);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.get("/api/users", authenticate, authorize(['SUPER_ADMIN']), syncRouteMiddleware(['user', 'branch']), async (req: any, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: { 
          id: true, 
          email: true, 
          username: true,
          name: true, 
          role: true, 
          isActive: true, 
          accountStatus: true,
          emailVerified: true,
          firebaseUid: true,
          branchId: true,
          phoneNumber: true,
          department: true,
          address: true,
          profileImage: true,
          profilePhoto: true,
          lastLoginAt: true,
          twoFactorEnabled: true,
          twoFactorType: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    let { email, username, password, name, role, phoneNumber, department, address, profileImage, branchId, twoFactorEnabled } = req.body;
    try {
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and full name are required." });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const normalizedUsername = username ? String(username).trim() : null;

      // Check if user already exists
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            ...(normalizedUsername ? [{ username: normalizedUsername }] : [])
          ]
        }
      });

      if (existing) {
        return res.status(400).json({ error: "A user with this email or username already exists." });
      }

      // Check branch
      if (!branchId) {
        const defaultBranch = await prisma.branch.findFirst();
        branchId = defaultBranch?.id || null;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      let firebaseUid: string | null = null;
      let firebaseAlreadyVerified = false;
      let verificationEmailSent = false;

      // Register or update the same Firebase Auth identity when Admin SDK
      // credentials are available for unified multi-device authentication.
      try {
        const auth = getAdminAuth();
        if (auth) {
          let fbUser;
          try {
            fbUser = await auth.getUserByEmail(normalizedEmail);
            await auth.updateUser(fbUser.uid, { password, displayName: name });
          } catch (getErr: any) {
            if (getErr.code === 'auth/user-not-found') {
              fbUser = await auth.createUser({
                email: normalizedEmail,
                password,
                displayName: name
              });
            }
          }
          if (fbUser) {
            firebaseUid = fbUser.uid;
            firebaseAlreadyVerified = Boolean(fbUser.emailVerified);
          }
        }
      } catch (fbErr) {
        console.warn("[CREATE USER] Firebase Auth registration notice:", fbErr);
      }

      // When Admin SDK credentials are unavailable, use the public Firebase
      // Identity Toolkit API with the supplied password. This sends only an
      // official Firebase verification email; it never fabricates a callback URL.
      if (!firebaseAlreadyVerified) {
        const restVerification = await ensureFirebaseUserAndSendVerification(normalizedEmail, password, name);
        if (restVerification.sent || restVerification.errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
          markFirebaseVerificationAttempt(normalizedEmail);
        }
        if (restVerification.firebaseUid) firebaseUid = firebaseUid || restVerification.firebaseUid;
        verificationEmailSent = restVerification.sent;
      } else {
        verificationEmailSent = true;
      }

      const user = await prisma.user.create({
        data: { 
          email: normalizedEmail, 
          username: normalizedUsername,
          password: hashedPassword, 
          name: name.trim(), 
          role: role || "RECEPTIONIST", 
          phoneNumber: phoneNumber ? phoneNumber.trim() : null, 
          department: department ? department.trim() : null, 
          address: address ? address.trim() : null, 
          profileImage: profileImage || null,
          branchId,
          firebaseUid,
          accountStatus: "ACTIVE",
          emailVerified: firebaseAlreadyVerified,
          twoFactorEnabled: twoFactorEnabled !== undefined ? Boolean(twoFactorEnabled) : true,
          isActive: true
        }
      });

      // Sync user to central Firestore and Firebase RTDB
      await syncUserToFirestore(user);
      await syncToRtdb("user", "CREATE", user);

      // Realtime event broadcast
      broadcastRealtimeEvent({
        entity: "user",
        action: "CREATE",
        id: user.id,
        data: user
      });

      // Centralized Audit Log
      await recordAuditLog({
        req,
        userId: req.user.id,
        action: "USER_CREATED",
        resource: "USER",
        resourceId: user.id,
        status: "SUCCESS",
        details: `Created new staff member: ${user.name} (${user.role}) with email: ${user.email}`
      });

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        username: user.username,
        accountStatus: user.accountStatus,
        isActive: user.isActive,
        twoFactorEnabled: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
        verificationEmailSent,
        message: user.emailVerified
          ? "Staff account created. The email address is already verified."
          : verificationEmailSent
            ? "Staff account created. Verification email sent."
            : "Staff account created, but the verification email could not be sent. Please configure Firebase email delivery and resend the verification email."
      });
    } catch (err: any) {
      console.error("[CREATE USER ERROR]", err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: "Email or username already exists" });
      }
      res.status(400).json({ error: err.message || "Failed to create user" });
    }
  });

  // Dedicated Super Admin 2FA Control Endpoint
  const handleUser2FAToggle = async (req: any, res: any) => {
    const id = String(req.params.id || '').trim();

    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "You are not authorized to change 2FA settings." });
    }

    let targetEnabled: boolean | undefined = undefined;
    if (typeof req.body.twoFactorEnabled === 'boolean') {
      targetEnabled = req.body.twoFactorEnabled;
    } else if (typeof req.body.enabled === 'boolean') {
      targetEnabled = req.body.enabled;
    } else if (req.body.twoFactorEnabled === 'true' || req.body.twoFactorEnabled === '1' || req.body.twoFactorEnabled === 1) {
      targetEnabled = true;
    } else if (req.body.twoFactorEnabled === 'false' || req.body.twoFactorEnabled === '0' || req.body.twoFactorEnabled === 0) {
      targetEnabled = false;
    } else if (req.body.enabled === 'true' || req.body.enabled === '1' || req.body.enabled === 1) {
      targetEnabled = true;
    } else if (req.body.enabled === 'false' || req.body.enabled === '0' || req.body.enabled === 0) {
      targetEnabled = false;
    }

    if (targetEnabled === undefined) {
      return res.status(400).json({ error: "Invalid request. Please provide 'enabled' or 'twoFactorEnabled' as a boolean (true or false)." });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser || existingUser.deletedAt) {
        return res.status(404).json({ error: "User account not found." });
      }

      // Security check: Protect SUPER_ADMIN accounts
      // If someone tries to disable 2FA for a SUPER_ADMIN, require the requester to be the user themselves
      if (existingUser.role === 'SUPER_ADMIN' && !targetEnabled && req.user.id !== existingUser.id) {
        return res.status(403).json({ error: "You are not authorized to change 2FA settings for another Super Administrator." });
      }

      // If disabling 2FA, invalidate any existing unused 2FA OTP codes for this user
      if (!targetEnabled) {
        await prisma.oTPVerification.updateMany({
          where: { userId: id, purpose: "LOGIN_2FA", isUsed: false },
          data: { isUsed: true }
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          twoFactorEnabled: targetEnabled,
          twoFactorType: "EMAIL",
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          phoneNumber: true,
          department: true,
          address: true,
          profileImage: true,
          twoFactorEnabled: true,
          twoFactorType: true,
          accountStatus: true,
          lastLoginAt: true,
          createdAt: true
        }
      });

      // Sync user to central Firestore and RTDB
      await syncUserToFirestore(user);
      await syncToRtdb("user", "UPDATE", user);

      // Realtime event broadcast
      broadcastRealtimeEvent({
        entity: "user",
        action: "UPDATE",
        id: user.id,
        data: user
      });

      // Centralized Audit Log
      await recordAuditLog({
        req,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: targetEnabled ? "2FA_ENABLED" : "2FA_DISABLED",
        resource: "USER",
        resourceId: id,
        status: "SUCCESS",
        details: `${targetEnabled ? "Enabled" : "Disabled"} Two-Factor Authentication (2FA) for staff member: ${existingUser.name} (${existingUser.email})`,
        previousValue: JSON.stringify({ twoFactorEnabled: existingUser.twoFactorEnabled }),
        newValue: JSON.stringify({ twoFactorEnabled: targetEnabled }),
        metadata: JSON.stringify({
          targetUserId: existingUser.id,
          targetUserEmail: existingUser.email,
          targetUserName: existingUser.name,
          targetUserRole: existingUser.role,
          performedByAdmin: req.user.name,
          performedByAdminEmail: req.user.email
        })
      });

      res.json({
        success: true,
        message: targetEnabled ? "Two-factor authentication enabled successfully." : "Two-factor authentication disabled successfully.",
        twoFactorEnabled: targetEnabled,
        user
      });
    } catch (err: any) {
      console.error("[TOGGLE USER 2FA ERROR]", err);
      res.status(500).json({ error: "Unable to update 2FA settings. Please try again." });
    }
  };

  app.patch("/api/users/:id/2fa", authenticate, handleUser2FAToggle);
  app.post("/api/users/:id/2fa", authenticate, handleUser2FAToggle);
  app.patch("/api/users/:id/toggle-2fa", authenticate, handleUser2FAToggle);
  app.post("/api/users/:id/toggle-2fa", authenticate, handleUser2FAToggle);
  app.patch("/api/staff/:id/2fa", authenticate, handleUser2FAToggle);
  app.post("/api/staff/:id/2fa", authenticate, handleUser2FAToggle);

  // Dedicated Super Admin Direct Email Verification Endpoint
  const handleSuperAdminDirectEmailVerify = async (req: any, res: any) => {
    const id = String(req.params.id || '').trim();

    // 1. Authorization: Only SUPER_ADMIN is permitted
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false, 
        error: "Forbidden: Only Super Administrators can manually verify user email addresses." 
      });
    }

    try {
      // 2. Validate Target User
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.deletedAt) {
        return res.status(404).json({ success: false, error: "User account not found." });
      }

      // Check if already verified
      if (targetUser.emailVerified) {
        // Also ensure Firebase Auth and RTDB are synchronized
        const auth = getAdminAuth();
        if (auth && targetUser.firebaseUid) {
          await auth.updateUser(targetUser.firebaseUid, { emailVerified: true }).catch(() => {});
        }
        await syncToRtdb("user", "UPDATE", targetUser).catch(() => {});
        return res.status(200).json({
          success: true,
          alreadyVerified: true,
          message: "This user's email is already verified.",
          user: {
            id: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            role: targetUser.role,
            emailVerified: true
          }
        });
      }

      let firebaseUid: string | null = null;
      let firebaseConfirmed = false;

      // 3. Update Firebase Authentication Email Verification State via Admin SDK
      const auth = getAdminAuth();
      if (auth) {
        try {
          let fbUser = null;
          if (targetUser.firebaseUid) {
            try {
              fbUser = await auth.getUser(targetUser.firebaseUid);
            } catch (uErr) {}
          }
          if (!fbUser && targetUser.email) {
            try {
              fbUser = await auth.getUserByEmail(targetUser.email.toLowerCase().trim());
            } catch (eErr) {}
          }

          if (fbUser) {
            await auth.updateUser(fbUser.uid, { emailVerified: true });
            firebaseUid = fbUser.uid;
            firebaseConfirmed = true;
            console.log(`[FIREBASE AUTH] Successfully updated emailVerified=true for user: ${targetUser.email} (UID: ${fbUser.uid})`);
          } else {
            console.warn(`[FIREBASE AUTH] Target user ${targetUser.email} not found in Firebase Auth during direct verify; local verification will not be changed.`);
          }
        } catch (fbAdminErr: any) {
          console.warn("[FIREBASE AUTH] Admin updateUser error:", fbAdminErr?.message || fbAdminErr);
        }
      }

      if (!firebaseConfirmed || !firebaseUid) {
        return res.status(503).json({
          success: false,
          code: "FIREBASE_USER_NOT_FOUND",
          message: "The matching Firebase Authentication user could not be found. The local account was not marked verified."
        });
      }

      // 4. Update SQLite / Prisma User Record only after Firebase confirms the identity.
      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          emailVerified: true,
          ...(firebaseUid && !targetUser.firebaseUid ? { firebaseUid } : {}),
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          phoneNumber: true,
          department: true,
          address: true,
          profileImage: true,
          twoFactorEnabled: true,
          twoFactorType: true,
          accountStatus: true,
          emailVerified: true,
          firebaseUid: true,
          lastLoginAt: true,
          createdAt: true
        }
      });

      // 5. Synchronize with Central Firestore and Firebase Realtime Database (RTDB)
      await syncUserToFirestore(updatedUser).catch((e) => console.warn("[FIRESTORE VERIFY SYNC ERROR]", e?.message));
      await syncToRtdb("user", "UPDATE", updatedUser).catch((e) => console.warn("[RTDB VERIFY SYNC ERROR]", e?.message));

      // 6. Broadcast Real-Time SSE Event across all connected dashboards
      broadcastRealtimeEvent({
        entity: "user",
        action: "UPDATE",
        id: updatedUser.id,
        data: updatedUser
      });

      // 7. Record Centralized Audit Log
      await recordAuditLog({
        req,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        action: "EMAIL_VERIFIED_BY_SUPER_ADMIN",
        resource: "USER",
        resourceId: updatedUser.id,
        status: "SUCCESS",
        details: `Super Administrator manually verified email for staff member: ${updatedUser.name} (${updatedUser.email})`,
        previousValue: JSON.stringify({ emailVerified: false }),
        newValue: JSON.stringify({ emailVerified: true }),
        metadata: JSON.stringify({
          targetUserId: updatedUser.id,
          targetUserEmail: updatedUser.email,
          targetUserName: updatedUser.name,
          targetUserRole: updatedUser.role,
          performedByAdminId: req.user.id,
          performedByAdminEmail: req.user.email,
          performedByAdminName: req.user.name
        })
      });

      return res.json({
        success: true,
        message: "Email verified successfully.",
        emailVerified: true,
        user: updatedUser
      });
    } catch (err: any) {
      console.error("[SUPER ADMIN DIRECT EMAIL VERIFY ERROR]", err);
      await recordAuditLog({
        req,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: req.user?.name,
        userRole: req.user?.role,
        action: "EMAIL_VERIFIED_BY_SUPER_ADMIN",
        resource: "USER",
        resourceId: id,
        status: "FAILED",
        details: `Failed to manually verify email for user ID ${id}: ${err?.message || "Unknown error"}`
      }).catch(() => {});

      return res.status(500).json({ 
        success: false, 
        error: "Unable to verify this email. Please try again or check the system logs." 
      });
    }
  };

  app.post("/api/users/:id/verify-email", authenticate, authorize(['SUPER_ADMIN']), handleSuperAdminDirectEmailVerify);
  app.patch("/api/users/:id/verify-email", authenticate, authorize(['SUPER_ADMIN']), handleSuperAdminDirectEmailVerify);
  app.post("/api/users/:id/direct-verify-email", authenticate, authorize(['SUPER_ADMIN']), handleSuperAdminDirectEmailVerify);
  app.patch("/api/users/:id/direct-verify-email", authenticate, authorize(['SUPER_ADMIN']), handleSuperAdminDirectEmailVerify);
  app.post("/api/staff/:id/verify-email", authenticate, authorize(['SUPER_ADMIN']), handleSuperAdminDirectEmailVerify);
  app.patch("/api/staff/:id/verify-email", authenticate, authorize(['SUPER_ADMIN']), handleSuperAdminDirectEmailVerify);

  app.patch("/api/users/:id", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;
    let { isActive, role, name, email, username, phoneNumber, department, address, profileImage, password, accountStatus, twoFactorEnabled, enabled } = req.body;
    
    if (twoFactorEnabled === undefined && enabled !== undefined) {
      twoFactorEnabled = enabled;
    }
    
    try {
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) return res.status(404).json({ error: "User account not found." });

      const updateData: any = { isActive, role, name, phoneNumber, department, address, profileImage, accountStatus };
      if (email !== undefined) {
        updateData.email = String(email).toLowerCase().trim();
      }
      if (username !== undefined) {
        updateData.username = username ? String(username).trim() : null;
      }
      if (twoFactorEnabled !== undefined) {
        if (typeof twoFactorEnabled === 'boolean') {
          updateData.twoFactorEnabled = twoFactorEnabled;
        } else if (twoFactorEnabled === 'true' || twoFactorEnabled === '1' || twoFactorEnabled === 1) {
          updateData.twoFactorEnabled = true;
        } else if (twoFactorEnabled === 'false' || twoFactorEnabled === '0' || twoFactorEnabled === 0) {
          updateData.twoFactorEnabled = false;
        }
      }
      
      // If password is provided, hash it
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
        updateData.failedLoginAttempts = 0;
        updateData.lockoutUntil = null;
      }

      // Filter out undefined fields
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const user = await prisma.user.update({
        where: { id },
        data: updateData
      });

      // Update Firebase Auth if password was changed and Firebase Auth exists
      if (password && (user.firebaseUid || user.email)) {
        try {
          const auth = getAdminAuth();
          if (auth) {
            if (user.firebaseUid) {
              await auth.updateUser(user.firebaseUid, { password });
            } else {
              const fbUser = await auth.getUserByEmail(user.email);
              if (fbUser) {
                await auth.updateUser(fbUser.uid, { password });
                await prisma.user.update({ where: { id }, data: { firebaseUid: fbUser.uid } });
              }
            }
          }
        } catch (fbErr) {
          console.warn("[UPDATE USER] Firebase Auth password sync notice:", fbErr);
        }
      }

      // Sync user to central Firestore and Firebase RTDB
      await syncUserToFirestore(user);
      await syncToRtdb("user", "UPDATE", user);

      // Realtime event broadcast
      broadcastRealtimeEvent({
        entity: "user",
        action: "UPDATE",
        id: user.id,
        data: user
      });

      // If password or active state was revoked, terminate active sessions
      if (password || isActive === false || (accountStatus && accountStatus !== 'ACTIVE' && accountStatus !== 'APPROVED')) {
        await prisma.session.deleteMany({ where: { userId: id } });
      }

      // Centralized Audit Log
      const changedFields = Object.keys(updateData).filter(k => k !== 'password' && updateData[k] !== existingUser[k as keyof typeof existingUser]);
      if (changedFields.length > 0 || password) {
        let actionType = "USER_UPDATED";
        if (twoFactorEnabled !== undefined && twoFactorEnabled !== existingUser.twoFactorEnabled) {
          actionType = twoFactorEnabled ? "2FA_ENABLED" : "2FA_DISABLED";
        } else if (role && role !== existingUser.role) actionType = "ROLE_CHANGED";
        else if (isActive === false) actionType = "USER_DISABLED";
        else if (isActive === true && existingUser.isActive === false) actionType = "USER_ENABLED";

        await recordAuditLog({
          req,
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action: actionType,
          resource: "USER",
          resourceId: id,
          status: "SUCCESS",
          previousValue: JSON.stringify({ role: existingUser.role, isActive: existingUser.isActive, accountStatus: existingUser.accountStatus, twoFactorEnabled: existingUser.twoFactorEnabled }),
          newValue: JSON.stringify(updateData),
          details: `Updated staff profile: ${name || existingUser.name}. Changed fields: ${changedFields.join(', ')} ${password ? '(password reset)' : ''}`
        });
      }

      res.json(user);
    } catch (err: any) {
      console.error("[UPDATE USER ERROR]", err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: "Email or username already exists" });
      }
      res.status(400).json({ error: err.message || "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    const { id } = req.params;
    
    if (id === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    try {
      // Soft delete by setting deletedAt
      const user = await prisma.user.update({
        where: { id },
        data: { 
          deletedAt: new Date(),
          isActive: false 
        }
      });

      // Sync user to central Firestore
      await syncUserToFirestore(user);

      // Invalidate user sessions
      await prisma.session.deleteMany({ where: { userId: id } });

      // Centralized Audit Log
      await recordAuditLog({
        req,
        userId: req.user.id,
        action: "USER_DELETED",
        resource: "USER",
        resourceId: id,
        status: "SUCCESS",
        details: `Soft deleted staff member: ${user.name} (${user.email})`
      });

      res.json({ message: "Staff member deleted successfully" });
    } catch (err) {
      console.error("[DELETE USER ERROR]", err);
      res.status(400).json({ error: "Failed to delete staff member" });
    }
  });

  app.patch("/api/profile", authenticate, async (req: any, res: any) => {
    const { name, email, username, phoneNumber, department, address, profileImage } = req.body;
    
    try {
      const updateData: any = { name, email, username, phoneNumber, department, address, profileImage };
      
      // Filter out undefined fields
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
      });

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        username: user.username,
        profileImage: user.profileImage,
        phoneNumber: user.phoneNumber,
        department: user.department,
        address: user.address,
        branchId: user.branchId
      });
    } catch (err: any) {
      console.error("[UPDATE PROFILE ERROR]", err);
      if (err.code === 'P2002') {
        return res.status(400).json({ error: "Email or username already exists" });
      }
      res.status(400).json({ error: "Failed to update profile" });
    }
  });

  // Public Tracking API with higher rate limit for specific search
  const trackingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { error: "Too many tracking attempts. Please wait 15 minutes." }
  });

  app.get("/api/track", trackingLimiter, syncRouteMiddleware(['repair', 'repairLog']), async (req, res) => {
    try {
      const { query, repairNumber, phone } = req.query as any;
      
      let searchRepairNo = repairNumber ? String(repairNumber).replace(/^#+/, '').trim() : "";
      let searchPhone = phone ? String(phone).trim() : "";
      
      if (query && typeof query === 'string' && query.trim()) {
        const q = query.trim().replace(/^#+/, '');
        const normQ = normalizePhone(q);
        // If digits count >= 7 and no letters, treat as phone
        if (normQ && normQ.length >= 7 && !/[a-zA-Z]/.test(q)) {
          searchPhone = normQ;
        } else {
          searchRepairNo = q;
        }
      }

      if (!searchRepairNo && !searchPhone) {
        return res.status(400).json({ error: "Please enter your Repair Number or Phone Number." });
      }

      // Generate phone variations for flexible matching
      const digitsPhone = searchPhone.replace(/\D/g, "");
      const phoneFilters: any[] = [];
      if (searchPhone) {
        phoneFilters.push({ customerPhone: { contains: searchPhone } });
      }
      if (digitsPhone) {
        phoneFilters.push({ customerPhone: { contains: digitsPhone } });
        if (digitsPhone.length >= 10) {
          phoneFilters.push({ customerPhone: { contains: digitsPhone.slice(-10) } });
        }
        if (digitsPhone.length >= 9) {
          phoneFilters.push({ customerPhone: { contains: digitsPhone.slice(-9) } });
        }
        if (digitsPhone.length >= 8) {
          phoneFilters.push({ customerPhone: { contains: digitsPhone.slice(-8) } });
        }
      }

      let repairs: any[] = [];
      let targetPrimaryRepair: any = null;

      if (searchRepairNo && phoneFilters.length > 0) {
        // Direct exact or partial match on repair number with phone validation
        const directMatches = await prisma.repair.findMany({
          where: {
            AND: [
              {
                OR: [
                  { repairNumber: { equals: searchRepairNo } },
                  { repairNumber: { contains: searchRepairNo } },
                  { id: searchRepairNo }
                ]
              },
              {
                OR: phoneFilters
              }
            ]
          },
          include: {
            customer: true,
            logs: { orderBy: { createdAt: "desc" } },
            technician: { select: { name: true } },
            branch: { select: { name: true, phone: true, location: true } }
          },
          orderBy: { createdAt: "desc" }
        });

        if (directMatches.length > 0) {
          targetPrimaryRepair = directMatches[0];
          const matchedPhone = targetPrimaryRepair.customerPhone;
          // Fetch all sibling devices under the customer phone for tab navigation
          repairs = await prisma.repair.findMany({
            where: { customerPhone: matchedPhone },
            include: {
              customer: true,
              logs: { orderBy: { createdAt: "desc" } },
              technician: { select: { name: true } },
              branch: { select: { name: true, phone: true, location: true } }
            },
            orderBy: { createdAt: "desc" }
          });
        }
      } else if (searchRepairNo) {
        // Search by Repair Number only
        const directMatches = await prisma.repair.findMany({
          where: {
            OR: [
              { repairNumber: { equals: searchRepairNo } },
              { repairNumber: { contains: searchRepairNo } },
              { id: searchRepairNo }
            ]
          },
          include: {
            customer: true,
            logs: { orderBy: { createdAt: "desc" } },
            technician: { select: { name: true } },
            branch: { select: { name: true, phone: true, location: true } }
          },
          orderBy: { createdAt: "desc" }
        });

        if (directMatches.length > 0) {
          targetPrimaryRepair = directMatches[0];
          const matchedPhone = targetPrimaryRepair.customerPhone;
          if (matchedPhone) {
            repairs = await prisma.repair.findMany({
              where: { customerPhone: matchedPhone },
              include: {
                customer: true,
                logs: { orderBy: { createdAt: "desc" } },
                technician: { select: { name: true } },
                branch: { select: { name: true, phone: true, location: true } }
              },
              orderBy: { createdAt: "desc" }
            });
          } else {
            repairs = directMatches;
          }
        }
      } else if (phoneFilters.length > 0) {
        // Search by Customer Phone
        repairs = await prisma.repair.findMany({
          where: {
            OR: phoneFilters
          },
          include: {
            customer: true,
            logs: { orderBy: { createdAt: "desc" } },
            technician: { select: { name: true } },
            branch: { select: { name: true, phone: true, location: true } }
          },
          orderBy: { createdAt: "desc" }
        });
      }

      if (!repairs || repairs.length === 0) {
        return res.status(404).json({ 
          error: "No repair records found matching your query. Please double-check your Repair Number or Phone Number." 
        });
      }

      // Identify the primary active repair
      let selectedRepair = targetPrimaryRepair || repairs[0];
      if (searchRepairNo) {
        const found = repairs.find(r => 
          r.repairNumber.toLowerCase() === searchRepairNo.toLowerCase() || 
          r.repairNumber.toLowerCase().includes(searchRepairNo.toLowerCase()) ||
          r.id === searchRepairNo
        );
        if (found) selectedRepair = found;
      }

      const customer = selectedRepair.customer || {
        name: selectedRepair.customerName,
        phone: selectedRepair.customerPhone,
        customerId: ""
      };

      const formatPublicRepair = (r: any) => ({
        id: r.id,
        repairNumber: r.repairNumber,
        customerId: r.customer?.customerId || "",
        customerName: r.customerName,
        deviceBrand: r.deviceBrand,
        deviceModel: r.deviceModel,
        deviceCondition: r.deviceCondition,
        problemDescription: r.problemDescription,
        accessoriesReceived: r.accessoriesReceived,
        status: r.status,
        expectedCompletionDate: r.expectedCompletionDate,
        estimatedCost: r.estimatedCost,
        advancePaid: r.advancePaid,
        totalPaid: r.totalPaid,
        paymentStatus: r.paymentStatus,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        branch: r.branch ? { name: r.branch.name, phone: r.branch.phone, location: r.branch.location } : null,
        receivingMethod: r.receivingMethod || 'WALK_IN',
        isCourierIn: Boolean(r.isCourierIn),
        courierCompany: r.courierCompany || null,
        courierTrackingNumber: r.courierTrackingNumber || null,
        courierReceivedDate: r.courierReceivedDate || null,
        courierStatus: r.courierStatus || null,
        isCourierOut: Boolean(r.isCourierOut),
        isReturnCourierDispatched: Boolean(r.isReturnCourierDispatched),
        returnCourierCompany: r.returnCourierCompany || null,
        returnCourierTrackingNumber: r.returnCourierTrackingNumber || null,
        returnCourierDispatchDate: r.returnCourierDispatchDate || null,
        destinationDistrict: r.destinationDistrict || null,
        logs: (r.logs || []).map((l: any) => {
          let sanitized = l.message || "";
          if (typeof sanitized === 'string') {
            if (/^Status (?:changed|updated) to ([A-Z_]+)/i.test(sanitized)) {
              sanitized = 'Repair progress updated.';
            } else {
              sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '');
              sanitized = sanitized.replace(/\bby\s+([a-zA-Z0-9_.'\s-]+?)\s*\((?:SUPER_ADMIN|SUPER\s*ADMIN|ADMIN|MANAGER|RECEPTIONIST|TECHNICIAN|STAFF)\)/gi, '');
              sanitized = sanitized.replace(/\((?:SUPER_ADMIN|SUPER\s*ADMIN|ADMIN|MANAGER|RECEPTIONIST|TECHNICIAN|STAFF)\)/gi, '');
              sanitized = sanitized.replace(/\bby\s+(?:MTS\s+)?(?:super\s*admin|admin|manager|receptionist|staff|specialist|technician|user)\b/gi, '');
              sanitized = sanitized.replace(/\bby\s+[A-Z][a-zA-Z0-9_.'-]+(?:\s+[A-Z][a-zA-Z0-9_.'-]+)*/g, '');
              sanitized = sanitized.replace(/\b(handled|updated|diagnosed|logged|received|repaired|inspected|completed|verified|transitioned)\s+by\s+[^,\.\n]+/gi, '$1');
              sanitized = sanitized.replace(/\bassigned\s+(?:to|by)\s+[^,\.\n]+/gi, 'Assigned for laboratory service');
              sanitized = sanitized.replace(/\b(?:updated|created|processed|handled|logged|verified)\s+by\s*:\s*[^,\.\n]+/gi, '');
              sanitized = sanitized.replace(/\b(?:technician|specialist|staff|user|engineer)\s*:\s*[^,\.\n]+/gi, '');
              sanitized = sanitized.replace(/\s+/g, ' ').replace(/\s+([,\.;])/g, '$1').replace(/^[\s,;.-]+|[\s,;.-]+$/g, '').trim();
            }
          }
          return {
            status: l.status,
            message: (sanitized || "Repair progress updated.").trim(),
            createdAt: l.createdAt
          };
        })
      });

      const allDevices = repairs.map(formatPublicRepair);
      const primaryRepair = formatPublicRepair(selectedRepair);

      // Backwards compatible response: contains both primary repair direct fields and multi-device objects
      res.json({
        ...primaryRepair,
        primaryRepair,
        devices: allDevices,
        customer: {
          name: customer.name,
          customerId: customer.customerId,
          totalDevices: allDevices.length
        }
      });
    } catch (err: any) {
      console.error("[TRACKING API ERROR]", err);
      res.status(500).json({ error: "Failed to load repair tracking information." });
    }
  });

  // ==========================================
  // INTERNAL INVENTORY MANAGEMENT ENDPOINTS
  // Strictly internal for SUPER_ADMIN, ADMIN, RECEPTIONIST, INVENTORY_MANAGER
  // ==========================================

  // Get All Inventory Items with filtering & searching
  app.get("/api/inventory", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { search, category, brand, stockStatus, status, sortBy, sortOrder } = req.query;
      const where: any = {};

      if (status && status !== 'ALL') {
        where.status = status;
      } else if (!status) {
        where.status = { in: ['ACTIVE', 'INACTIVE'] };
      }

      if (category && category !== 'ALL') {
        where.category = category;
      }

      if (brand && brand !== 'ALL') {
        where.brand = brand;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const q = search.trim();
        where.OR = [
          { name: { contains: q } },
          { brand: { contains: q } },
          { model: { contains: q } },
          { sku: { contains: q } },
          { compatibility: { contains: q } },
          { category: { contains: q } },
          { storageLocation: { contains: q } }
        ];
      }

      let items = await prisma.inventoryItem.findMany({
        where,
        include: {
          transactions: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: sortBy === 'name' ? { name: sortOrder === 'desc' ? 'desc' : 'asc' } :
                 sortBy === 'stock' ? { currentStock: sortOrder === 'asc' ? 'asc' : 'desc' } :
                 sortBy === 'price' ? { purchasePrice: sortOrder === 'asc' ? 'asc' : 'desc' } :
                 { updatedAt: 'desc' }
      });

      // Filter stock status in memory if specified
      if (stockStatus === 'LOW_STOCK') {
        items = items.filter(item => item.currentStock > 0 && item.currentStock <= item.minStockLevel);
      } else if (stockStatus === 'OUT_OF_STOCK') {
        items = items.filter(item => item.currentStock <= 0);
      } else if (stockStatus === 'IN_STOCK') {
        items = items.filter(item => item.currentStock > 0);
      }

      res.json(items);
    } catch (err: any) {
      console.error("[INVENTORY FETCH ERROR]", err);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  // Get Inventory Dashboard Statistics Summary
  app.get("/api/inventory/stats", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: { status: { in: ['ACTIVE', 'INACTIVE'] } }
      });

      const totalProducts = items.length;
      const totalStockUnits = items.reduce((acc, item) => acc + (item.currentStock || 0), 0);
      const lowStockCount = items.filter(item => item.currentStock > 0 && item.currentStock <= item.minStockLevel).length;
      const outOfStockCount = items.filter(item => item.currentStock <= 0).length;

      // Calculate valuation ONLY for items with valid purchasePrice
      const totalValuation = items.reduce((acc, item) => {
        if (item.purchasePrice !== null && item.purchasePrice !== undefined && item.currentStock > 0) {
          return acc + (item.purchasePrice * item.currentStock);
        }
        return acc;
      }, 0);

      const recentTxCount = await prisma.inventoryTransaction.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      });

      res.json({
        totalProducts,
        totalStockUnits,
        lowStockCount,
        outOfStockCount,
        totalValuation,
        recentTxCount
      });
    } catch (err: any) {
      console.error("[INVENTORY STATS ERROR]", err);
      res.status(500).json({ error: "Failed to load inventory statistics" });
    }
  });

  // Categories list & creation
  app.get("/api/inventory/categories", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const categories = await prisma.inventoryCategory.findMany({
        orderBy: { displayOrder: 'asc' }
      });
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch inventory categories" });
    }
  });

  app.post("/api/inventory/categories", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { name, description, icon } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }
      const existing = await prisma.inventoryCategory.findUnique({ where: { name: name.trim() } });
      if (existing) {
        return res.status(400).json({ error: "Category already exists" });
      }

      const count = await prisma.inventoryCategory.count();
      const category = await prisma.inventoryCategory.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null,
          icon: icon || null,
          displayOrder: count + 1
        }
      });
      res.status(201).json(category);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Global Transaction Audit History
  app.get("/api/inventory/transactions/history", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const history = await prisma.inventoryTransaction.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              brand: true,
              model: true,
              sku: true,
              category: true,
              unit: true
            }
          }
        }
      });
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch inventory transaction logs" });
    }
  });

  // Get Single Item Details with complete history
  app.get("/api/inventory/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: req.params.id },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      if (!item) {
        return res.status(404).json({ error: "Inventory part not found" });
      }
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch item details" });
    }
  });

  // Create New Inventory Part / Item (Prices optional!)
  app.post("/api/inventory", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const {
        name,
        brand,
        model,
        sku,
        category,
        subcategory,
        compatibility,
        unit,
        currentStock,
        minStockLevel,
        maxStockLevel,
        purchasePrice,
        sellingPrice,
        supplier,
        storageLocation,
        description,
        notes,
        imageUrl
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Product / Part Name is required." });
      }

      const initialStock = currentStock !== undefined && currentStock !== null && currentStock !== '' ? Math.max(0, parseInt(currentStock)) : 0;
      const minStock = minStockLevel !== undefined && minStockLevel !== null && minStockLevel !== '' ? Math.max(0, parseInt(minStockLevel)) : 5;
      const maxStock = maxStockLevel !== undefined && maxStockLevel !== null && maxStockLevel !== '' ? parseInt(maxStockLevel) : null;

      // Handle prices safely as NULL if empty or not provided
      const parsedPurchase = purchasePrice !== undefined && purchasePrice !== null && String(purchasePrice).trim() !== '' ? parseFloat(purchasePrice) : null;
      const parsedSelling = sellingPrice !== undefined && sellingPrice !== null && String(sellingPrice).trim() !== '' ? parseFloat(sellingPrice) : null;

      if (parsedPurchase !== null && (isNaN(parsedPurchase) || parsedPurchase < 0)) {
        return res.status(400).json({ error: "Purchase Price cannot be negative." });
      }
      if (parsedSelling !== null && (isNaN(parsedSelling) || parsedSelling < 0)) {
        return res.status(400).json({ error: "Selling Price cannot be negative." });
      }

      // Generate clean SKU if missing
      let finalSku = sku ? sku.trim() : null;
      if (!finalSku) {
        const count = await prisma.inventoryItem.count();
        finalSku = `MTS-INV-${(count + 101).toString().padStart(5, '0')}`;
      } else {
        const existingSku = await prisma.inventoryItem.findFirst({ where: { sku: finalSku } });
        if (existingSku) {
          finalSku = `${finalSku}-${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      const [item, transaction] = await prisma.$transaction(async (tx) => {
        const createdItem = await tx.inventoryItem.create({
          data: {
            name: name.trim(),
            brand: brand ? brand.trim() : null,
            model: model ? model.trim() : null,
            sku: finalSku,
            category: category ? category.trim() : "Spare Parts",
            subcategory: subcategory ? subcategory.trim() : null,
            compatibility: compatibility ? compatibility.trim() : null,
            unit: unit || "Piece",
            currentStock: initialStock,
            minStockLevel: minStock,
            maxStockLevel: maxStock,
            purchasePrice: parsedPurchase,
            sellingPrice: parsedSelling,
            supplier: supplier ? supplier.trim() : null,
            storageLocation: storageLocation ? storageLocation.trim() : null,
            description: description ? description.trim() : null,
            notes: notes ? notes.trim() : null,
            imageUrl: imageUrl || null,
            status: "ACTIVE",
            createdById: req.user.id
          }
        });

        let initialTx = null;
        if (initialStock > 0) {
          initialTx = await tx.inventoryTransaction.create({
            data: {
              itemId: createdItem.id,
              type: "STOCK_IN",
              quantity: initialStock,
              previousStock: 0,
              newStock: initialStock,
              reason: "Opening Stock Intake",
              performedById: req.user.id,
              performedByName: req.user.name || "Staff User"
            }
          });
        }

        return [createdItem, initialTx];
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "CREATE",
        id: item.id,
        data: item
      });

      res.status(201).json(item);
    } catch (err: any) {
      console.error("[CREATE INVENTORY ITEM ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to create inventory part" });
    }
  });

  // Edit / Update Inventory Part Details
  app.patch("/api/inventory/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Inventory part not found" });
      }

      const {
        name,
        brand,
        model,
        sku,
        category,
        subcategory,
        compatibility,
        unit,
        minStockLevel,
        maxStockLevel,
        purchasePrice,
        sellingPrice,
        supplier,
        storageLocation,
        description,
        notes,
        imageUrl,
        status
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (brand !== undefined) updateData.brand = brand ? brand.trim() : null;
      if (model !== undefined) updateData.model = model ? model.trim() : null;
      if (sku !== undefined) updateData.sku = sku ? sku.trim() : null;
      if (category !== undefined) updateData.category = category ? category.trim() : existing.category;
      if (subcategory !== undefined) updateData.subcategory = subcategory ? subcategory.trim() : null;
      if (compatibility !== undefined) updateData.compatibility = compatibility ? compatibility.trim() : null;
      if (unit !== undefined) updateData.unit = unit || existing.unit;
      if (minStockLevel !== undefined) updateData.minStockLevel = Math.max(0, parseInt(minStockLevel));
      if (maxStockLevel !== undefined) updateData.maxStockLevel = maxStockLevel ? parseInt(maxStockLevel) : null;
      if (supplier !== undefined) updateData.supplier = supplier ? supplier.trim() : null;
      if (storageLocation !== undefined) updateData.storageLocation = storageLocation ? storageLocation.trim() : null;
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
      if (status !== undefined) updateData.status = status;

      // Handle optional price updates safely
      if (purchasePrice !== undefined) {
        updateData.purchasePrice = purchasePrice !== null && purchasePrice !== '' && !isNaN(parseFloat(purchasePrice)) ? parseFloat(purchasePrice) : null;
      }
      if (sellingPrice !== undefined) {
        updateData.sellingPrice = sellingPrice !== null && sellingPrice !== '' && !isNaN(parseFloat(sellingPrice)) ? parseFloat(sellingPrice) : null;
      }

      const updated = await prisma.inventoryItem.update({
        where: { id },
        data: updateData
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "UPDATE",
        id: updated.id,
        data: updated
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[UPDATE INVENTORY ERROR]", err);
      res.status(500).json({ error: "Failed to update inventory details" });
    }
  });

  // Stock In Operation (Add Stock)
  app.post("/api/inventory/:id/stock-in", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { quantity, reason, notes, supplier } = req.body;

      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: "Stock addition quantity must be a positive number greater than zero." });
      }

      const [updatedItem, transaction] = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id } });
        if (!item) {
          throw new Error("Inventory part not found");
        }

        const prevStock = item.currentStock;
        const newStock = prevStock + qty;

        const updated = await tx.inventoryItem.update({
          where: { id },
          data: {
            currentStock: newStock,
            supplier: supplier ? supplier.trim() : item.supplier,
            updatedAt: new Date()
          }
        });

        const log = await tx.inventoryTransaction.create({
          data: {
            itemId: id,
            type: "STOCK_IN",
            quantity: qty,
            previousStock: prevStock,
            newStock: newStock,
            reason: reason || "New Stock Receipt",
            notes: notes ? notes.trim() : null,
            performedById: req.user.id,
            performedByName: req.user.name || "Staff Member"
          }
        });

        return [updated, log];
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "UPDATE",
        id: updatedItem.id,
        data: updatedItem
      });

      broadcastRealtimeEvent({
        entity: "inventoryTransaction",
        action: "CREATE",
        id: transaction.id,
        data: transaction
      });

      res.json({
        success: true,
        message: `Successfully added +${qty} ${updatedItem.unit}s to stock.`,
        item: updatedItem,
        transaction
      });
    } catch (err: any) {
      console.error("[STOCK IN ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to process stock intake" });
    }
  });

  // Stock Out / Use Stock Operation
  app.post("/api/inventory/:id/stock-out", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { quantity, reason, repairNumber, notes } = req.body;

      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: "Stock consumption quantity must be a positive number greater than zero." });
      }

      const [updatedItem, transaction] = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id } });
        if (!item) {
          throw new Error("Inventory part not found");
        }

        if (item.currentStock < qty) {
          throw new Error(`Insufficient stock. Current available quantity is ${item.currentStock} ${item.unit}(s). Cannot deduct ${qty}.`);
        }

        const prevStock = item.currentStock;
        const newStock = prevStock - qty;

        const updated = await tx.inventoryItem.update({
          where: { id },
          data: {
            currentStock: newStock,
            updatedAt: new Date()
          }
        });

        let targetRepairId = null;
        if (repairNumber && repairNumber.trim()) {
          const repair = await tx.repair.findFirst({
            where: {
              OR: [
                { repairNumber: repairNumber.trim() },
                { id: repairNumber.trim() }
              ]
            }
          });
          if (repair) {
            targetRepairId = repair.id;
            await tx.repairLog.create({
              data: {
                repairId: repair.id,
                status: repair.status,
                message: `Part consumed from inventory: ${item.name} (${qty} ${item.unit}) by ${req.user.name}`
              }
            });
          }
        }

        const log = await tx.inventoryTransaction.create({
          data: {
            itemId: id,
            type: "STOCK_OUT",
            quantity: qty,
            previousStock: prevStock,
            newStock: newStock,
            reason: reason || "Used for Repair",
            repairNumber: repairNumber ? repairNumber.trim() : null,
            repairId: targetRepairId,
            notes: notes ? notes.trim() : null,
            performedById: req.user.id,
            performedByName: req.user.name || "Staff Member"
          }
        });

        return [updated, log];
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "UPDATE",
        id: updatedItem.id,
        data: updatedItem
      });

      broadcastRealtimeEvent({
        entity: "inventoryTransaction",
        action: "CREATE",
        id: transaction.id,
        data: transaction
      });

      res.json({
        success: true,
        message: `Deducted -${qty} ${updatedItem.unit}s from stock. Available remaining: ${updatedItem.currentStock}.`,
        item: updatedItem,
        transaction
      });
    } catch (err: any) {
      console.error("[STOCK OUT ERROR]", err);
      res.status(400).json({ error: err.message || "Failed to consume stock" });
    }
  });

  // Stock Adjustment (Audit Correction)
  app.post("/api/inventory/:id/adjust-stock", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newStock, reason, notes } = req.body;

      const targetStock = parseInt(newStock);
      if (isNaN(targetStock) || targetStock < 0) {
        return res.status(400).json({ error: "Adjusted stock quantity cannot be negative." });
      }

      const [updatedItem, transaction] = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id } });
        if (!item) {
          throw new Error("Inventory part not found");
        }

        const prevStock = item.currentStock;
        const delta = Math.abs(targetStock - prevStock);

        const updated = await tx.inventoryItem.update({
          where: { id },
          data: {
            currentStock: targetStock,
            updatedAt: new Date()
          }
        });

        const log = await tx.inventoryTransaction.create({
          data: {
            itemId: id,
            type: "STOCK_ADJUSTMENT",
            quantity: delta,
            previousStock: prevStock,
            newStock: targetStock,
            reason: reason || "Inventory Stock Count Audit Adjustment",
            notes: notes ? notes.trim() : null,
            performedById: req.user.id,
            performedByName: req.user.name || "Admin User"
          }
        });

        return [updated, log];
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "UPDATE",
        id: updatedItem.id,
        data: updatedItem
      });

      broadcastRealtimeEvent({
        entity: "inventoryTransaction",
        action: "CREATE",
        id: transaction.id,
        data: transaction
      });

      res.json({
        success: true,
        message: `Stock updated to ${updatedItem.currentStock} ${updatedItem.unit}s.`,
        item: updatedItem,
        transaction
      });
    } catch (err: any) {
      console.error("[STOCK ADJUSTMENT ERROR]", err);
      res.status(400).json({ error: err.message || "Failed to adjust stock" });
    }
  });

  // Soft-Delete / Archive Inventory Item
  app.delete("/api/inventory/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Inventory part not found" });
      }

      // Soft delete by updating status to ARCHIVED
      const archived = await prisma.inventoryItem.update({
        where: { id },
        data: { status: "ARCHIVED" }
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "DELETE",
        id: archived.id,
        data: archived
      });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "ARCHIVE",
            resource: "INVENTORY_ITEM",
            resourceId: archived.id,
            details: `Archived inventory item "${archived.name}" (SKU: ${archived.sku || 'N/A'})`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record inventory archive log:", logErr);
      }

      res.json({ success: true, message: `Part "${existing.name}" archived successfully.` });
    } catch (err: any) {
      console.error("[ARCHIVE INVENTORY ERROR]", err);
      res.status(500).json({ error: "Failed to archive inventory part" });
    }
  });

  // Restore Archived Inventory Item
  app.post("/api/inventory/:id/restore", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Inventory part not found" });
      }

      const restored = await prisma.inventoryItem.update({
        where: { id },
        data: { status: "ACTIVE" }
      });

      broadcastRealtimeEvent({
        entity: "inventoryItem",
        action: "UPDATE",
        id: restored.id,
        data: restored
      });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "RESTORE",
            resource: "INVENTORY_ITEM",
            resourceId: restored.id,
            details: `Restored archived inventory item "${restored.name}" to ACTIVE status`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record inventory restore log:", logErr);
      }

      res.json({ success: true, message: `Part "${restored.name}" restored to active inventory.`, item: restored });
    } catch (err: any) {
      console.error("[RESTORE INVENTORY ERROR]", err);
      res.status(500).json({ error: "Failed to restore inventory part" });
    }
  });

  // Helper for persistent custom inventory folders storage
  const customInventoryFoldersFilePath = path.join(process.cwd(), "data", "inventory_folders.json");
  const getCustomInventoryFolders = (): any[] => {
    try {
      if (!fs.existsSync(path.dirname(customInventoryFoldersFilePath))) {
        fs.mkdirSync(path.dirname(customInventoryFoldersFilePath), { recursive: true });
      }
      if (!fs.existsSync(customInventoryFoldersFilePath)) {
        fs.writeFileSync(customInventoryFoldersFilePath, JSON.stringify([]), "utf-8");
        return [];
      }
      const data = fs.readFileSync(customInventoryFoldersFilePath, "utf-8");
      return JSON.parse(data || "[]");
    } catch (e) {
      console.error("[INVENTORY FOLDERS] Read error:", e);
      return [];
    }
  };

  const saveCustomInventoryFolders = (folders: any[]) => {
    try {
      if (!fs.existsSync(path.dirname(customInventoryFoldersFilePath))) {
        fs.mkdirSync(path.dirname(customInventoryFoldersFilePath), { recursive: true });
      }
      fs.writeFileSync(customInventoryFoldersFilePath, JSON.stringify(folders, null, 2), "utf-8");
    } catch (e) {
      console.error("[INVENTORY FOLDERS] Save error:", e);
    }
  };

  // Get Custom Inventory Folders
  app.get("/api/inventory/folders", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const folders = getCustomInventoryFolders();
      res.json(folders);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch custom inventory folders" });
    }
  });

  // Create Custom Inventory Folder
  app.post("/api/inventory/folders", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { brand, model, category, subcategory } = req.body;
      if (!brand || !brand.trim()) {
        return res.status(400).json({ error: "Brand is required" });
      }

      const cleanFolder = {
        id: `inv_fld_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        brand: brand.trim(),
        model: model ? model.trim() : null,
        category: category ? category.trim() : null,
        subcategory: subcategory ? subcategory.trim() : null,
        createdAt: new Date().toISOString()
      };

      const current = getCustomInventoryFolders();
      const exists = current.some(f => 
        f.brand.toLowerCase() === cleanFolder.brand.toLowerCase() &&
        (f.model || '').toLowerCase() === (cleanFolder.model || '').toLowerCase() &&
        (f.category || '').toLowerCase() === (cleanFolder.category || '').toLowerCase() &&
        (f.subcategory || '').toLowerCase() === (cleanFolder.subcategory || '').toLowerCase()
      );

      if (!exists) {
        current.push(cleanFolder);
        saveCustomInventoryFolders(current);
      }

      broadcastRealtimeEvent({ entity: 'inventoryFolder', action: 'CREATE', data: cleanFolder });
      res.status(201).json(cleanFolder);
    } catch (err) {
      console.error("[INVENTORY FOLDERS] Create error:", err);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  // Bulk Archive / Delete Inventory Items
  app.post("/api/inventory/bulk-archive", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Item IDs array is required" });
      }

      const updateResult = await prisma.inventoryItem.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED" }
      });

      // Record Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "BULK_ARCHIVE",
            resource: "INVENTORY_ITEM",
            details: `Bulk archived ${updateResult.count} inventory items (IDs: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''})`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record bulk archive log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'inventoryItem', action: 'UPDATE', data: { archivedIds: ids } });
      res.json({ success: true, count: updateResult.count, ids });
    } catch (err) {
      console.error("[INVENTORY] Bulk archive error:", err);
      res.status(500).json({ error: "Failed to perform bulk archive" });
    }
  });

  // Bulk Permanent Delete (Restricted to SUPER_ADMIN)
  app.post("/api/inventory/bulk-delete", authenticate, authorize(['SUPER_ADMIN']), async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Item IDs array is required" });
      }

      // Delete child transactions and items in cascade transaction
      const deleteResult = await prisma.inventoryItem.deleteMany({
        where: { id: { in: ids } }
      });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "BULK_DELETE",
            resource: "INVENTORY_ITEM",
            details: `Permanently deleted ${deleteResult.count} inventory items`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record bulk delete log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'inventoryItem', action: 'DELETE', data: { deletedIds: ids } });
      res.json({ success: true, count: deleteResult.count, ids });
    } catch (err) {
      console.error("[INVENTORY] Bulk delete error:", err);
      res.status(500).json({ error: "Failed to permanently delete inventory items" });
    }
  });

  // Bulk Status Update (ACTIVE / INACTIVE)
  app.post("/api/inventory/bulk-status", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || !status) {
        return res.status(400).json({ error: "Item IDs array and valid status are required" });
      }

      const updateResult = await prisma.inventoryItem.updateMany({
        where: { id: { in: ids } },
        data: { status }
      });

      broadcastRealtimeEvent({ entity: 'inventoryItem', action: 'UPDATE', data: { updatedIds: ids, status } });
      res.json({ success: true, count: updateResult.count });
    } catch (err) {
      console.error("[INVENTORY] Bulk status update error:", err);
      res.status(500).json({ error: "Failed to update item statuses" });
    }
  });

  // Rename Inventory Folder (Brand, Model, Category, or Subcategory)
  app.post("/api/inventory/rename-folder", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { level, oldName, newName, parentBrand, parentModel, parentCategory } = req.body;
      if (!level || !oldName || !newName || !newName.trim()) {
        return res.status(400).json({ error: "level, oldName, and newName are required" });
      }

      const trimmedNew = newName.trim();
      let affectedCount = 0;

      if (level === 'brand') {
        const resUpd = await prisma.inventoryItem.updateMany({
          where: { brand: oldName },
          data: { brand: trimmedNew }
        });
        affectedCount = resUpd.count;

        // Update custom folders
        const customFolders = getCustomInventoryFolders();
        customFolders.forEach(f => {
          if (f.brand.toLowerCase() === oldName.toLowerCase()) {
            f.brand = trimmedNew;
          }
        });
        saveCustomInventoryFolders(customFolders);
      } else if (level === 'model') {
        const whereClause: any = { model: oldName };
        if (parentBrand) whereClause.brand = parentBrand;
        const resUpd = await prisma.inventoryItem.updateMany({
          where: whereClause,
          data: { model: trimmedNew }
        });
        affectedCount = resUpd.count;

        const customFolders = getCustomInventoryFolders();
        customFolders.forEach(f => {
          if ((!parentBrand || f.brand.toLowerCase() === parentBrand.toLowerCase()) && f.model?.toLowerCase() === oldName.toLowerCase()) {
            f.model = trimmedNew;
          }
        });
        saveCustomInventoryFolders(customFolders);
      } else if (level === 'category') {
        const whereClause: any = { category: oldName };
        if (parentBrand) whereClause.brand = parentBrand;
        if (parentModel) whereClause.model = parentModel;
        const resUpd = await prisma.inventoryItem.updateMany({
          where: whereClause,
          data: { category: trimmedNew }
        });
        affectedCount = resUpd.count;

        const customFolders = getCustomInventoryFolders();
        customFolders.forEach(f => {
          if (
            (!parentBrand || f.brand.toLowerCase() === parentBrand.toLowerCase()) &&
            (!parentModel || f.model?.toLowerCase() === parentModel.toLowerCase()) &&
            f.category?.toLowerCase() === oldName.toLowerCase()
          ) {
            f.category = trimmedNew;
          }
        });
        saveCustomInventoryFolders(customFolders);
      }

      // Record Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "RENAME_FOLDER",
            resource: "INVENTORY_FOLDER",
            details: `Renamed ${level} folder from "${oldName}" to "${trimmedNew}" (${affectedCount} items updated)`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record rename folder log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'inventoryItem', action: 'UPDATE', data: { renamedFolder: { level, oldName, newName: trimmedNew } } });
      res.json({ success: true, affectedCount, level, oldName, newName: trimmedNew });
    } catch (err) {
      console.error("[INVENTORY] Rename folder error:", err);
      res.status(500).json({ error: "Failed to rename folder" });
    }
  });

  // Move Inventory Items or Folder
  app.post("/api/inventory/move", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { itemIds, sourceFolder, targetBrand, targetModel, targetCategory, targetSubcategory } = req.body;
      if (!targetBrand) {
        return res.status(400).json({ error: "Target brand is required" });
      }

      let movedCount = 0;

      if (Array.isArray(itemIds) && itemIds.length > 0) {
        const updateData: any = { brand: targetBrand.trim() };
        if (targetModel !== undefined) updateData.model = targetModel ? targetModel.trim() : null;
        if (targetCategory !== undefined) updateData.category = targetCategory ? targetCategory.trim() : "Spare Parts";
        if (targetSubcategory !== undefined) updateData.subcategory = targetSubcategory ? targetSubcategory.trim() : null;

        const resUpd = await prisma.inventoryItem.updateMany({
          where: { id: { in: itemIds } },
          data: updateData
        });
        movedCount = resUpd.count;
      } else if (sourceFolder) {
        const { brand, model, category } = sourceFolder;
        const whereClause: any = { brand };
        if (model) whereClause.model = model;
        if (category) whereClause.category = category;

        const updateData: any = { brand: targetBrand.trim() };
        if (targetModel !== undefined) updateData.model = targetModel ? targetModel.trim() : null;
        if (targetCategory !== undefined) updateData.category = targetCategory ? targetCategory.trim() : "Spare Parts";

        const resUpd = await prisma.inventoryItem.updateMany({
          where: whereClause,
          data: updateData
        });
        movedCount = resUpd.count;
      } else {
        return res.status(400).json({ error: "Either itemIds or sourceFolder is required" });
      }

      // Record Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "MOVE",
            resource: "INVENTORY_ITEM",
            details: `Moved ${movedCount} items to ${targetBrand}${targetModel ? ` / ${targetModel}` : ''}${targetCategory ? ` / ${targetCategory}` : ''}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record move log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'inventoryItem', action: 'UPDATE', data: { movedCount, targetBrand, targetModel, targetCategory } });
      res.json({ success: true, movedCount });
    } catch (err) {
      console.error("[INVENTORY] Move error:", err);
      res.status(500).json({ error: "Failed to move items" });
    }
  });

  // Cascading Folder Deletion / Archive
  app.post("/api/inventory/delete-folder", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { brand, model, category, permanent } = req.body;
      if (!brand) {
        return res.status(400).json({ error: "Brand is required" });
      }

      const whereClause: any = { brand };
      if (model) whereClause.model = model;
      if (category) whereClause.category = category;

      const items = await prisma.inventoryItem.findMany({
        where: whereClause,
        select: { id: true }
      });
      const ids = items.map(i => i.id);

      if (permanent && req.user.role === 'SUPER_ADMIN') {
        if (ids.length > 0) {
          await prisma.inventoryItem.deleteMany({
            where: { id: { in: ids } }
          });
        }
      } else {
        if (ids.length > 0) {
          await prisma.inventoryItem.updateMany({
            where: { id: { in: ids } },
            data: { status: "ARCHIVED" }
          });
        }
      }

      // Clean up custom folders
      const customFolders = getCustomInventoryFolders();
      const filteredCustomFolders = customFolders.filter(f => {
        if (category) {
          return !(f.brand.toLowerCase() === brand.toLowerCase() && f.model?.toLowerCase() === model?.toLowerCase() && f.category?.toLowerCase() === category.toLowerCase());
        }
        if (model) {
          return !(f.brand.toLowerCase() === brand.toLowerCase() && f.model?.toLowerCase() === model.toLowerCase());
        }
        return !(f.brand.toLowerCase() === brand.toLowerCase());
      });
      saveCustomInventoryFolders(filteredCustomFolders);

      // Record Audit Log
      try {
        const folderDesc = `${brand}${model ? ` / ${model}` : ''}${category ? ` / ${category}` : ''}`;
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: permanent ? "DELETE_FOLDER" : "ARCHIVE_FOLDER",
            resource: "INVENTORY_FOLDER",
            details: `${permanent ? 'Permanently deleted' : 'Archived'} folder "${folderDesc}" containing ${ids.length} items`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record delete folder log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'inventoryItem', action: 'DELETE', data: { deletedFolder: { brand, model, category }, affectedIds: ids } });
      res.json({ success: true, affectedCount: ids.length, ids });
    } catch (err) {
      console.error("[INVENTORY] Delete folder error:", err);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  // Distinct Suppliers and Storage Locations for fast auto-completion
  app.get("/api/inventory/suppliers", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: { supplier: { not: null } },
        select: { supplier: true },
        distinct: ['supplier']
      });
      const suppliers = items.map(i => i.supplier).filter(Boolean);
      res.json(suppliers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/inventory/locations", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: { storageLocation: { not: null } },
        select: { storageLocation: true },
        distinct: ['storageLocation']
      });
      const locations = items.map(i => i.storageLocation).filter(Boolean);
      res.json(locations);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch storage locations" });
    }
  });

  // Product Endpoints
  // Public product list (no auth required for website)
  app.get("/api/public/products", syncRouteMiddleware(['product']), async (req, res) => {
    try {
      const { category, featured, bestSeller } = req.query;
      const where: any = {};
      if (category) where.category = category as string;
      if (featured === 'true') where.isFeatured = true;
      if (bestSeller === 'true') where.isBestSeller = true;

      const products = await prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" }
      });
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Admin product management
  app.get("/api/products", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER']), syncRouteMiddleware(['product']), async (req: any, res) => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(products);
  });

  app.post("/api/products", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const product = await prisma.product.create({ data: req.body });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const product = await prisma.product.update({ 
        where: { id: req.params.id },
        data: req.body 
      });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // ==========================================
  // REPAIR PRICE FINDER & DIRECTORY ENDPOINTS
  // ==========================================

  // Public endpoint for customer Repair Price Finder
  app.get("/api/public/repair-prices", syncRouteMiddleware(['repairPrice']), async (req, res) => {
    try {
      const { search, brand, category } = req.query;
      
      const where: any = {
        status: "ACTIVE"
      };

      if (brand && typeof brand === 'string' && brand.trim() !== '' && brand.toLowerCase() !== 'all') {
        where.brand = { equals: brand.trim() };
      }

      if (category && typeof category === 'string' && category.trim() !== '' && category.toLowerCase() !== 'all') {
        const catTrim = category.trim();
        const catLower = catTrim.toLowerCase();
        if (catLower === 'front glass') {
          where.OR = [
            { category: 'Front Glass' },
            { category: 'Display', serviceName: { contains: 'Glass' } },
            { category: 'Display', problem: { contains: 'Glass' } }
          ];
        } else if (catLower === 'lining') {
          where.OR = [
            { category: 'Lining' },
            { serviceName: { contains: 'Lining' } },
            { serviceName: { contains: 'Line' } },
            { problem: { contains: 'Line' } },
            { problem: { contains: 'Laser' } }
          ];
        } else if (catLower === 'flex change' || catLower === 'flex') {
          where.OR = [
            { category: 'Flex Change' },
            { category: 'Flex' },
            { serviceName: { contains: 'Flex' } },
            { problem: { contains: 'Flex' } }
          ];
        } else if (catLower === 'green / white screen' || catLower === 'green screen' || catLower === 'white screen') {
          where.OR = [
            { category: 'Green / White Screen' },
            { category: 'Green Screen' },
            { category: 'White Screen' },
            { serviceName: { contains: 'Green' } },
            { serviceName: { contains: 'White' } },
            { problem: { contains: 'Green' } },
            { problem: { contains: 'White' } }
          ];
        } else {
          where.category = { equals: catTrim };
        }
      }

      let prices = await prisma.repairPrice.findMany({
        where,
        orderBy: [
          { brand: 'asc' },
          { model: 'asc' },
          { category: 'asc' },
          { price: 'asc' }
        ]
      });

      // Multi-term fuzzy matching for search
      if (search && typeof search === 'string' && search.trim() !== '') {
        const queryTokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
        prices = prices.filter(item => {
          const searchableText = [
            item.brand,
            item.model,
            item.variant || '',
            item.category,
            item.problem || '',
            item.serviceName || '',
            item.description || '',
            item.notes || '',
            item.estimatedTime || ''
          ].join(' ').toLowerCase();

          // Every token in query must match somewhere in the text
          return queryTokens.every(token => searchableText.includes(token));
        });
      }

      res.json(prices);
    } catch (err) {
      console.error("[REPAIR-PRICES-PUBLIC] Fetch error:", err);
      res.status(500).json({ error: "Failed to fetch repair prices" });
    }
  });

  // Admin endpoint: List all repair prices with full management data
  app.get("/api/repair-prices", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), syncRouteMiddleware(['repairPrice']), async (req: any, res) => {
    try {
      const { search, brand, category, status } = req.query;
      const where: any = {};

      if (brand && typeof brand === 'string' && brand.trim() !== '' && brand.toLowerCase() !== 'all') {
        where.brand = brand.trim();
      }

      if (category && typeof category === 'string' && category.trim() !== '' && category.toLowerCase() !== 'all') {
        where.category = category.trim();
      }

      if (status && typeof status === 'string' && status.trim() !== '' && status.toUpperCase() !== 'ALL') {
        where.status = status.toUpperCase();
      }

      let prices = await prisma.repairPrice.findMany({
        where,
        orderBy: [
          { updatedAt: 'desc' },
          { brand: 'asc' },
          { model: 'asc' }
        ]
      });

      if (search && typeof search === 'string' && search.trim() !== '') {
        const queryTokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
        prices = prices.filter(item => {
          const searchableText = [
            item.brand,
            item.model,
            item.variant || '',
            item.category,
            item.problem || '',
            item.serviceName || '',
            item.description || '',
            item.notes || ''
          ].join(' ').toLowerCase();
          return queryTokens.every(token => searchableText.includes(token));
        });
      }

      res.json(prices);
    } catch (err) {
      console.error("[REPAIR-PRICES-ADMIN] Fetch error:", err);
      res.status(500).json({ error: "Failed to fetch repair price directory" });
    }
  });

  // Admin endpoint: Create new repair price entry
  app.post("/api/repair-prices", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const {
        brand,
        model,
        variant,
        category,
        problem,
        serviceName,
        description,
        price,
        priceType,
        status,
        notes,
        estimatedTime
      } = req.body;

      if (!brand || !model || !category || !serviceName) {
        return res.status(400).json({ error: "Missing required fields (brand, model, category, serviceName)" });
      }

      const numericPrice = parseFloat(price) || 0;
      const finalProblem = problem ? problem.trim() : serviceName.trim();
      const finalDescription = description ? description.trim() : (notes ? notes.trim() : null);

      const created = await prisma.repairPrice.create({
        data: {
          brand: brand.trim(),
          model: model.trim(),
          variant: variant ? variant.trim() : null,
          category: category.trim(),
          problem: finalProblem,
          serviceName: serviceName.trim(),
          description: finalDescription,
          price: numericPrice,
          priceType: priceType || 'FIXED',
          status: status || 'ACTIVE',
          notes: notes ? notes.trim() : finalDescription,
          estimatedTime: estimatedTime ? estimatedTime.trim() : null,
          createdBy: req.user.name || req.user.email || req.user.id,
          updatedBy: req.user.name || req.user.email || req.user.id
        }
      });

      // Synchronize to Firestore
      await syncToFirestore('repairPrice', created);

      // Log to Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            resource: "REPAIR_PRICE",
            resourceId: created.id,
            details: `Created repair price for ${created.brand} ${created.model} - ${created.serviceName} (NPR ${created.price})`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record repair price creation log:", logErr);
      }

      res.status(201).json(created);
    } catch (err) {
      console.error("[REPAIR-PRICES] Creation error:", err);
      res.status(500).json({ error: "Failed to create repair price entry" });
    }
  });

  // Admin endpoint: Update repair price entry (Supports both PUT and PATCH)
  const handleUpdateRepairPrice = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const {
        brand,
        model,
        variant,
        category,
        problem,
        serviceName,
        description,
        price,
        priceType,
        status,
        notes,
        estimatedTime
      } = req.body;

      const existing = await prisma.repairPrice.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Repair price record not found" });
      }

      const finalProblem = problem !== undefined ? (problem ? problem.trim() : existing.problem) : undefined;
      const finalDescription = description !== undefined ? (description ? description.trim() : null) : undefined;

      const updated = await prisma.repairPrice.update({
        where: { id },
        data: {
          ...(brand !== undefined && { brand: brand.trim() }),
          ...(model !== undefined && { model: model.trim() }),
          ...(variant !== undefined && { variant: variant ? variant.trim() : null }),
          ...(category !== undefined && { category: category.trim() }),
          ...(finalProblem !== undefined && { problem: finalProblem }),
          ...(serviceName !== undefined && { serviceName: serviceName.trim() }),
          ...(finalDescription !== undefined && { description: finalDescription }),
          ...(price !== undefined && { price: parseFloat(price) || 0 }),
          ...(priceType !== undefined && { priceType }),
          ...(status !== undefined && { status }),
          ...(notes !== undefined && { notes: notes ? notes.trim() : (finalDescription || null) }),
          ...(estimatedTime !== undefined && { estimatedTime: estimatedTime ? estimatedTime.trim() : null }),
          updatedBy: req.user.name || req.user.email || req.user.id
        }
      });

      // Synchronize to Firestore
      await syncToFirestore('repairPrice', updated);

      // Log to Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE",
            resource: "REPAIR_PRICE",
            resourceId: updated.id,
            details: `Updated repair price for ${updated.brand} ${updated.model} - ${updated.serviceName} (NPR ${updated.price})`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record repair price update log:", logErr);
      }

      res.json(updated);
    } catch (err) {
      console.error("[REPAIR-PRICES] Update error:", err);
      res.status(500).json({ error: "Failed to update repair price record" });
    }
  };

  app.put("/api/repair-prices/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleUpdateRepairPrice);
  app.patch("/api/repair-prices/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), handleUpdateRepairPrice);

  // Admin endpoint: Toggle status (ACTIVE / INACTIVE)
  app.patch("/api/repair-prices/:id/toggle-status", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.repairPrice.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Repair price record not found" });
      }

      const nextStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const updated = await prisma.repairPrice.update({
        where: { id },
        data: { 
          status: nextStatus,
          updatedBy: req.user.name || req.user.email || req.user.id
        }
      });

      await syncToFirestore('repairPrice', updated);

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE_STATUS",
            resource: "REPAIR_PRICE",
            resourceId: updated.id,
            details: `Toggled status to ${nextStatus} for ${updated.brand} ${updated.model} - ${updated.serviceName}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Status log warning:", logErr);
      }

      res.json(updated);
    } catch (err) {
      console.error("[REPAIR-PRICES] Toggle status error:", err);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Admin endpoint: Delete repair price record
  app.delete("/api/repair-prices/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.repairPrice.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Repair price record not found" });
      }

      await prisma.repairPrice.delete({ where: { id } });

      if (!firestoreSyncDisabled) {
        try {
          const db = getDb();
          await db.collection("repairPrices").doc(id).delete();
        } catch (fErr) {
          console.warn("[SYNC] Could not delete repair price from Firestore:", fErr);
        }
      }

      // Log to Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            resource: "REPAIR_PRICE",
            resourceId: id,
            details: `Deleted repair price for ${existing.brand} ${existing.model} - ${existing.serviceName} (NPR ${existing.price})`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record repair price deletion log:", logErr);
      }

      res.json({ message: "Repair price deleted successfully", id });
    } catch (err) {
      console.error("[REPAIR-PRICES] Delete error:", err);
      res.status(500).json({ error: "Failed to delete repair price record" });
    }
  });

  // Helper for persistent custom folders storage
  const customFoldersFilePath = path.join(process.cwd(), "data", "repair_folders.json");
  const getCustomFolders = (): any[] => {
    try {
      if (!fs.existsSync(path.dirname(customFoldersFilePath))) {
        fs.mkdirSync(path.dirname(customFoldersFilePath), { recursive: true });
      }
      if (!fs.existsSync(customFoldersFilePath)) {
        fs.writeFileSync(customFoldersFilePath, JSON.stringify([]), "utf-8");
        return [];
      }
      const data = fs.readFileSync(customFoldersFilePath, "utf-8");
      return JSON.parse(data || "[]");
    } catch (e) {
      console.error("[REPAIR FOLDERS] Read error:", e);
      return [];
    }
  };

  const saveCustomFolders = (folders: any[]) => {
    try {
      if (!fs.existsSync(path.dirname(customFoldersFilePath))) {
        fs.mkdirSync(path.dirname(customFoldersFilePath), { recursive: true });
      }
      fs.writeFileSync(customFoldersFilePath, JSON.stringify(folders, null, 2), "utf-8");
    } catch (e) {
      console.error("[REPAIR FOLDERS] Write error:", e);
    }
  };

  // Admin endpoint: Get custom empty folders
  app.get("/api/repair-prices/folders", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const folders = getCustomFolders();
      res.json(folders);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch custom folders" });
    }
  });

  // Admin endpoint: Create custom folder
  app.post("/api/repair-prices/folders", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { name, level, brand, model, category, path: folderPath } = req.body;
      if (!name || !level) {
        return res.status(400).json({ error: "Folder name and level are required" });
      }
      const folders = getCustomFolders();
      const newFolder = {
        id: uuidv4(),
        name: name.trim(),
        level,
        brand: (brand || name).trim(),
        model: model ? model.trim() : null,
        category: category ? category.trim() : null,
        path: folderPath || (level === 'brand' ? name.trim() : level === 'model' ? `${brand.trim()}/${name.trim()}` : `${brand.trim()}/${model.trim()}/${name.trim()}`),
        createdAt: new Date().toISOString(),
        createdBy: req.user.name || req.user.email
      };

      // Check if folder already exists in custom folders
      const existing = folders.find(f => f.path.toLowerCase() === newFolder.path.toLowerCase());
      if (!existing) {
        folders.push(newFolder);
        saveCustomFolders(folders);
      }

      broadcastRealtimeEvent({ entity: 'repairPrice', action: 'CREATE', data: newFolder });
      res.status(201).json(newFolder);
    } catch (err) {
      console.error("[REPAIR FOLDERS] Create error:", err);
      res.status(500).json({ error: "Failed to create custom folder" });
    }
  });

  // Admin endpoint: Bulk delete repair prices
  app.post("/api/repair-prices/bulk-delete", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Array of service IDs is required for bulk deletion" });
      }

      const existingRecords = await prisma.repairPrice.findMany({
        where: { id: { in: ids } }
      });

      if (existingRecords.length === 0) {
        return res.status(404).json({ error: "No matching repair price records found" });
      }

      await prisma.repairPrice.deleteMany({
        where: { id: { in: ids } }
      });

      // Synchronize deletion with Firestore
      if (!firestoreSyncDisabled) {
        try {
          const db = getDb();
          const batch = db.batch();
          for (const id of ids) {
            batch.delete(db.collection("repairPrices").doc(id));
          }
          await batch.commit();
        } catch (fErr) {
          console.warn("[SYNC] Bulk delete from Firestore warning:", fErr);
        }
      }

      // Record Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "BULK_DELETE",
            resource: "REPAIR_PRICE",
            details: `Bulk deleted ${existingRecords.length} repair price records (${existingRecords.map(r => `${r.brand} ${r.model} - ${r.serviceName}`).slice(0, 5).join(', ')}${existingRecords.length > 5 ? ` and ${existingRecords.length - 5} more` : ''})`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record bulk delete log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'repairPrice', action: 'DELETE', data: { deletedIds: ids } });
      res.json({ success: true, count: existingRecords.length, deletedIds: ids });
    } catch (err) {
      console.error("[REPAIR-PRICES] Bulk delete error:", err);
      res.status(500).json({ error: "Failed to perform bulk deletion" });
    }
  });

  // Admin endpoint: Rename folder (Brand, Model, or Category) across all services
  app.post("/api/repair-prices/rename-folder", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { level, oldValue, newValue, brand, model } = req.body;
      if (!level || !oldValue || !newValue || oldValue.trim() === newValue.trim()) {
        return res.status(400).json({ error: "Valid level, oldValue, and newValue are required" });
      }

      const trimmedOld = oldValue.trim();
      const trimmedNew = newValue.trim();
      let whereClause: any = {};
      let updateData: any = {
        updatedBy: req.user.name || req.user.email
      };

      if (level === 'brand') {
        whereClause.brand = trimmedOld;
        updateData.brand = trimmedNew;
      } else if (level === 'model') {
        whereClause.model = trimmedOld;
        if (brand) whereClause.brand = brand.trim();
        updateData.model = trimmedNew;
      } else if (level === 'category') {
        whereClause.category = trimmedOld;
        if (brand) whereClause.brand = brand.trim();
        if (model) whereClause.model = model.trim();
        updateData.category = trimmedNew;
      } else {
        return res.status(400).json({ error: "Invalid level specified (must be brand, model, or category)" });
      }

      // Update matching repair prices in SQLite
      const updateResult = await prisma.repairPrice.updateMany({
        where: whereClause,
        data: updateData
      });

      // Update custom folders registry
      const customFolders = getCustomFolders();
      let customFoldersUpdated = false;
      const updatedCustomFolders = customFolders.map(f => {
        if (level === 'brand' && f.brand.toLowerCase() === trimmedOld.toLowerCase()) {
          customFoldersUpdated = true;
          return {
            ...f,
            brand: trimmedNew,
            name: f.level === 'brand' ? trimmedNew : f.name,
            path: f.path.replace(new RegExp(`^${trimmedOld}`, 'i'), trimmedNew)
          };
        }
        if (level === 'model' && (!brand || f.brand.toLowerCase() === brand.toLowerCase()) && f.model?.toLowerCase() === trimmedOld.toLowerCase()) {
          customFoldersUpdated = true;
          return {
            ...f,
            model: trimmedNew,
            name: f.level === 'model' ? trimmedNew : f.name,
            path: f.path.replace(`/${trimmedOld}`, `/${trimmedNew}`)
          };
        }
        if (level === 'category' && (!brand || f.brand.toLowerCase() === brand.toLowerCase()) && (!model || f.model?.toLowerCase() === model.toLowerCase()) && f.category?.toLowerCase() === trimmedOld.toLowerCase()) {
          customFoldersUpdated = true;
          return {
            ...f,
            category: trimmedNew,
            name: f.level === 'category' ? trimmedNew : f.name,
            path: f.path.replace(`/${trimmedOld}`, `/${trimmedNew}`)
          };
        }
        return f;
      });

      if (customFoldersUpdated) {
        saveCustomFolders(updatedCustomFolders);
      }

      // Synchronize updated records with Firestore
      if (!firestoreSyncDisabled) {
        try {
          const updatedRecords = await prisma.repairPrice.findMany({
            where: level === 'brand' ? { brand: trimmedNew } : level === 'model' ? { model: trimmedNew, ...(brand && { brand: brand.trim() }) } : { category: trimmedNew, ...(brand && { brand: brand.trim() }), ...(model && { model: model.trim() }) }
          });
          for (const item of updatedRecords) {
            await syncToFirestore('repairPrice', item);
          }
        } catch (fErr) {
          console.warn("[SYNC] Rename folder Firestore sync warning:", fErr);
        }
      }

      // Record Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "RENAME_FOLDER",
            resource: "REPAIR_PRICE",
            details: `Renamed ${level} folder from "${trimmedOld}" to "${trimmedNew}" (affected ${updateResult.count} services)`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record rename folder log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'repairPrice', action: 'UPDATE', data: { level, oldValue: trimmedOld, newValue: trimmedNew, count: updateResult.count } });
      res.json({ success: true, updatedCount: updateResult.count, level, oldValue: trimmedOld, newValue: trimmedNew });
    } catch (err) {
      console.error("[REPAIR-PRICES] Rename folder error:", err);
      res.status(500).json({ error: "Failed to rename folder" });
    }
  });

  // Admin endpoint: Move services or folder contents to a new destination
  app.post("/api/repair-prices/move", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { serviceIds, source, destination } = req.body;
      if (!destination || !destination.brand) {
        return res.status(400).json({ error: "Destination brand is required" });
      }

      let count = 0;
      const targetBrand = destination.brand.trim();
      const targetModel = destination.model ? destination.model.trim() : null;
      const targetCategory = destination.category ? destination.category.trim() : null;

      if (Array.isArray(serviceIds) && serviceIds.length > 0) {
        // Moving specific service IDs
        const updateData: any = {
          brand: targetBrand,
          updatedBy: req.user.name || req.user.email
        };
        if (targetModel) updateData.model = targetModel;
        if (targetCategory) updateData.category = targetCategory;

        const result = await prisma.repairPrice.updateMany({
          where: { id: { in: serviceIds } },
          data: updateData
        });
        count = result.count;

        // Sync to Firestore
        if (!firestoreSyncDisabled) {
          const updated = await prisma.repairPrice.findMany({ where: { id: { in: serviceIds } } });
          for (const item of updated) {
            await syncToFirestore('repairPrice', item);
          }
        }
      } else if (source && source.brand) {
        // Moving an entire source folder
        const whereClause: any = { brand: source.brand.trim() };
        if (source.model) whereClause.model = source.model.trim();
        if (source.category) whereClause.category = source.category.trim();

        const updateData: any = {
          brand: targetBrand,
          updatedBy: req.user.name || req.user.email
        };
        if (targetModel) updateData.model = targetModel;
        if (targetCategory) updateData.category = targetCategory;

        const result = await prisma.repairPrice.updateMany({
          where: whereClause,
          data: updateData
        });
        count = result.count;

        if (!firestoreSyncDisabled) {
          const updated = await prisma.repairPrice.findMany({ where: whereClause });
          for (const item of updated) {
            await syncToFirestore('repairPrice', item);
          }
        }
      } else {
        return res.status(400).json({ error: "Either serviceIds or source folder specification is required" });
      }

      // Record Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "MOVE",
            resource: "REPAIR_PRICE",
            details: `Moved ${count} repair services to ${targetBrand}${targetModel ? ` / ${targetModel}` : ''}${targetCategory ? ` / ${targetCategory}` : ''}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record move log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'repairPrice', action: 'UPDATE', data: { destination, count } });
      res.json({ success: true, movedCount: count, destination });
    } catch (err) {
      console.error("[REPAIR-PRICES] Move error:", err);
      res.status(500).json({ error: "Failed to move repair price items" });
    }
  });

  // Admin endpoint: Delete an entire folder and all nested services safely
  app.post("/api/repair-prices/delete-folder", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { brand, model, category } = req.body;
      if (!brand) {
        return res.status(400).json({ error: "Brand is required to delete folder" });
      }

      const whereClause: any = { brand: brand.trim() };
      if (model && model.trim()) whereClause.model = model.trim();
      if (category && category.trim()) whereClause.category = category.trim();

      const existingRecords = await prisma.repairPrice.findMany({
        where: whereClause
      });
      const ids = existingRecords.map(r => r.id);

      if (ids.length > 0) {
        await prisma.repairPrice.deleteMany({
          where: { id: { in: ids } }
        });

        // Delete from Firestore
        if (!firestoreSyncDisabled) {
          try {
            const db = getDb();
            const batch = db.batch();
            for (const id of ids) {
              batch.delete(db.collection("repairPrices").doc(id));
            }
            await batch.commit();
          } catch (fErr) {
            console.warn("[SYNC] Delete folder Firestore warning:", fErr);
          }
        }
      }

      // Also clean up any custom empty folders
      const customFolders = getCustomFolders();
      const filteredCustomFolders = customFolders.filter(f => {
        if (category) {
          return !(f.brand.toLowerCase() === brand.toLowerCase() && f.model?.toLowerCase() === model?.toLowerCase() && f.category?.toLowerCase() === category.toLowerCase());
        }
        if (model) {
          return !(f.brand.toLowerCase() === brand.toLowerCase() && f.model?.toLowerCase() === model.toLowerCase());
        }
        return !(f.brand.toLowerCase() === brand.toLowerCase());
      });
      saveCustomFolders(filteredCustomFolders);

      // Record Audit Log
      try {
        const folderDesc = `${brand}${model ? ` / ${model}` : ''}${category ? ` / ${category}` : ''}`;
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE_FOLDER",
            resource: "REPAIR_PRICE",
            details: `Deleted folder "${folderDesc}" containing ${ids.length} repair services`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Failed to record delete folder log:", logErr);
      }

      broadcastRealtimeEvent({ entity: 'repairPrice', action: 'DELETE', data: { deletedFolder: { brand, model, category }, deletedIds: ids } });
      res.json({ success: true, deletedCount: ids.length, deletedIds: ids });
    } catch (err) {
      console.error("[REPAIR-PRICES] Delete folder error:", err);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  // ==========================================
  // HOME PAGE SLIDESHOW API
  // ==========================================

  // Public endpoint: Fetch active slides for Home page
  app.get("/api/slides", async (req, res) => {
    try {
      const slides = await prisma.homeSlide.findMany({
        where: { status: "ACTIVE" },
        orderBy: { displayOrder: "asc" }
      });
      res.json(slides);
    } catch (err) {
      console.error("[SLIDES ERROR]", err);
      res.status(500).json({ error: "Failed to load slideshow" });
    }
  });

  // Public aliases for slides & slideshows
  app.get(["/api/public/slides", "/api/public/slideshows", "/api/slideshows", "/api/public/home-slides", "/api/slides"], async (req, res) => {
    try {
      const slides = await prisma.homeSlide.findMany({
        where: { status: "ACTIVE" },
        orderBy: { displayOrder: "asc" }
      });
      res.json(slides);
    } catch (err) {
      console.error("[SLIDES ERROR]", err);
      res.status(500).json({ error: "Failed to load slideshow" });
    }
  });

  // Admin endpoint: Get all slides (active & inactive)
  app.get("/api/admin/slides", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const slides = await prisma.homeSlide.findMany({
        orderBy: { displayOrder: "asc" }
      });
      res.json(slides);
    } catch (err) {
      console.error("[ADMIN SLIDES] Fetch error:", err);
      res.status(500).json({ error: "Failed to fetch slides" });
    }
  });

  // Admin endpoint: Create a new slide
  app.post("/api/admin/slides", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { title, description, imageUrl, buttonText, buttonLink, displayOrder, status } = req.body;
      if (!title || !imageUrl) {
        return res.status(400).json({ error: "Slide title and image are required" });
      }

      const created = await prisma.homeSlide.create({
        data: {
          title: title.trim(),
          description: description ? description.trim() : "",
          imageUrl: imageUrl.trim(),
          buttonText: buttonText ? buttonText.trim() : "Check Repair Price",
          buttonLink: buttonLink ? buttonLink.trim() : "/services?focus=search",
          displayOrder: displayOrder ? parseInt(displayOrder) : 1,
          status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          createdBy: req.user.name || req.user.email || req.user.id
        }
      });

      await syncToFirestore("homeSlide", created);
      broadcastRealtimeEvent({ entity: "homeSlide", action: "CREATE", data: created });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "CREATE",
            resource: "HOME_SLIDE",
            resourceId: created.id,
            details: `Created home slide: ${created.title}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Slide log warning:", logErr);
      }

      res.status(201).json(created);
    } catch (err) {
      console.error("[ADMIN SLIDES] Create error:", err);
      res.status(500).json({ error: "Failed to create slide" });
    }
  });

  // Admin endpoint: Update a slide
  app.put("/api/admin/slides/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, description, imageUrl, buttonText, buttonLink, displayOrder, status } = req.body;

      const existing = await prisma.homeSlide.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Slide not found" });

      const updated = await prisma.homeSlide.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(description !== undefined && { description: description.trim() }),
          ...(imageUrl !== undefined && { imageUrl: imageUrl.trim() }),
          ...(buttonText !== undefined && { buttonText: buttonText ? buttonText.trim() : "Check Repair Price" }),
          ...(buttonLink !== undefined && { buttonLink: buttonLink ? buttonLink.trim() : "/services?focus=search" }),
          ...(displayOrder !== undefined && { displayOrder: parseInt(displayOrder) || 1 }),
          ...(status !== undefined && { status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE" }),
          updatedBy: req.user.name || req.user.email || req.user.id
        }
      });

      await syncToFirestore("homeSlide", updated);
      broadcastRealtimeEvent({ entity: "homeSlide", action: "UPDATE", data: updated });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE",
            resource: "HOME_SLIDE",
            resourceId: updated.id,
            details: `Updated home slide: ${updated.title}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Slide log warning:", logErr);
      }

      res.json(updated);
    } catch (err) {
      console.error("[ADMIN SLIDES] Update error:", err);
      res.status(500).json({ error: "Failed to update slide" });
    }
  });

  // Admin endpoint: Toggle status (ACTIVE / INACTIVE)
  app.patch("/api/admin/slides/:id/toggle-status", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.homeSlide.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Slide not found" });

      const nextStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const updated = await prisma.homeSlide.update({
        where: { id },
        data: {
          status: nextStatus,
          updatedBy: req.user.name || req.user.email || req.user.id
        }
      });

      await syncToFirestore("homeSlide", updated);
      broadcastRealtimeEvent({ entity: "homeSlide", action: "UPDATE", data: updated });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "UPDATE_STATUS",
            resource: "HOME_SLIDE",
            resourceId: updated.id,
            details: `Toggled slide status to ${nextStatus}: ${updated.title}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Slide status warning:", logErr);
      }

      res.json(updated);
    } catch (err) {
      console.error("[ADMIN SLIDES] Toggle status error:", err);
      res.status(500).json({ error: "Failed to toggle status" });
    }
  });

  // Admin endpoint: Delete a slide
  app.delete("/api/admin/slides/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.homeSlide.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Slide not found" });

      await prisma.homeSlide.delete({ where: { id } });

      if (!firestoreSyncDisabled) {
        try {
          const db = getDb();
          await db.collection("homeSlides").doc(id).delete();
        } catch (fErr) {
          console.warn("[SYNC] Could not delete slide from Firestore:", fErr);
        }
      }

      broadcastRealtimeEvent({ entity: "homeSlide", action: "DELETE", id, data: { id } });

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            resource: "HOME_SLIDE",
            resourceId: id,
            details: `Deleted home slide: ${existing.title}`
          }
        });
      } catch (logErr) {
        console.warn("[AUDIT] Slide delete log warning:", logErr);
      }

      res.json({ message: "Slide deleted successfully", id });
    } catch (err) {
      console.error("[ADMIN SLIDES] Delete error:", err);
      res.status(500).json({ error: "Failed to delete slide" });
    }
  });

  // Admin endpoint: Upload slide image
  app.post("/api/admin/slides/upload-image", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), upload.single('image'), async (req: any, res) => {
    try {
      const srcTargetDir = path.join(process.cwd(), "src/assets/images");
      const publicTargetDir = path.join(process.cwd(), "public/assets/images");

      [srcTargetDir, publicTargetDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      let filename = "";
      let fileBuffer: Buffer | null = null;

      if (req.file) {
        const ext = (path.extname(req.file.originalname) || ".jpg").toLowerCase();
        const safeName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        filename = `slide_${Date.now()}_${safeName}${ext}`;
        fileBuffer = req.file.buffer;
      } else if (req.body?.base64Image || req.body?.image) {
        const base64Str = String(req.body.base64Image || req.body.image);
        const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+-]+);base64,(.+)$/);
        let ext = ".jpg";
        let rawData = base64Str;
        if (matches && matches.length === 3) {
          ext = `.${matches[1].replace('jpeg', 'jpg').toLowerCase()}`;
          rawData = matches[2];
        } else {
          rawData = base64Str.replace(/^data:image\/\w+;base64,/, "");
        }
        fileBuffer = Buffer.from(rawData, "base64");
        filename = `slide_${Date.now()}${ext}`;
      }

      if (!fileBuffer || fileBuffer.length === 0 || !filename) {
        return res.status(400).json({ error: "No image file or valid image data provided" });
      }

      // Save to both public and src image assets directories
      fs.writeFileSync(path.join(srcTargetDir, filename), fileBuffer);
      fs.writeFileSync(path.join(publicTargetDir, filename), fileBuffer);

      const url = `/assets/images/${filename}`;
      return res.json({ url, filename, size: fileBuffer.length, success: true });
    } catch (err: any) {
      console.error("[UPLOAD SLIDE IMAGE ERROR]", err);
      res.status(500).json({ error: err?.message || "Failed to upload image" });
    }
  });

  // Share and Publish Applet Endpoints
  app.post("/api/share", authenticate, async (req: any, res) => {
    const routeHit = "/api/share";
    console.log(`[ROUTE HIT] ${routeHit}`);
    console.log(`[USER ID] ${req.user?.id || 'unknown'}`);
    console.log(`[REQUEST PAYLOAD]`, req.body);

    const { appletName, description, visibility, sharingTarget, allowFork } = req.body;

    // Validate all incoming request data
    if (!appletName || typeof appletName !== "string" || appletName.trim() === "") {
      console.warn("[VALIDATION FAIL] appletName is missing or invalid");
      return res.status(400).json({
        success: false,
        message: "Applet Name is required and must be a valid string"
      });
    }

    if (visibility && !["PUBLIC", "PRIVATE", "SHARED"].includes(visibility)) {
      console.warn(`[VALIDATION FAIL] Invalid visibility value: ${visibility}`);
      return res.status(400).json({
        success: false,
        message: "Visibility must be either PUBLIC, PRIVATE, or SHARED"
      });
    }

    try {
      // Ensure database transaction safety
      const result = await prisma.$transaction(async (tx) => {
        const shareRecord = await tx.appletShare.create({
          data: {
            userId: req.user.id,
            appletName: appletName.trim(),
            description: description ? description.trim() : null,
            visibility: visibility || "PUBLIC",
            sharingTarget: sharingTarget ? sharingTarget.trim() : null,
            allowFork: allowFork !== undefined ? Boolean(allowFork) : true,
          }
        });
        return shareRecord;
      });

      console.log("[DATABASE RESPONSE - SUCCESS] Created share record:", result);

      // Audit Log logging
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "SHARE_APPLET",
          resource: "APPLET_SHARE",
          resourceId: result.id,
          details: `Applet '${appletName}' shared with visibility ${visibility || "PUBLIC"}`
        }
      });

      return res.status(200).json({
        success: true,
        message: "Applet shared successfully",
        data: result
      });
    } catch (err: any) {
      console.error("[ERROR STACK TRACE]", err);
      return res.status(500).json({
        success: false,
        message: `An internal server error occurred: ${err.message || "Unknown error"}`
      });
    }
  });

  app.get("/api/share/history", authenticate, async (req: any, res) => {
    const routeHit = "/api/share/history";
    console.log(`[ROUTE HIT] ${routeHit}`);
    console.log(`[USER ID] ${req.user?.id || 'unknown'}`);

    try {
      const historyList = await prisma.appletShare.findMany({
        where: req.user.role === "SUPER_ADMIN" ? {} : { userId: req.user.id },
        orderBy: { createdAt: "desc" }
      });

      console.log(`[DATABASE RESPONSE - SUCCESS] Retrieved ${historyList.length} share records`);
      return res.status(200).json({
        success: true,
        data: historyList
      });
    } catch (err: any) {
      console.error("[ERROR STACK TRACE]", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to retrieve share history"
      });
    }
  });

  // ==========================================
  // STAFF ATTENDANCE MANAGEMENT SYSTEM SUITE
  // ==========================================

  // Authoritative Nepal Time & Business Window Helper (Asia/Kathmandu: UTC+5:45)
  function getMTSCurrentTime(inputDate: Date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(inputDate);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;

    const year = map.year;
    const month = map.month;
    const day = map.day;
    const hour = parseInt(map.hour, 10);
    const minute = parseInt(map.minute, 10);
    const second = parseInt(map.second, 10);
    const dateStr = `${year}-${month}-${day}`;
    const totalMinutes = hour * 60 + minute;

    // Manager Daily Attendance Window: 10:00 AM (600) to 10:45 AM (645)
    const isManagerWindowOpen = totalMinutes >= 600 && totalMinutes <= 645;
    const isBeforeManagerWindow = totalMinutes < 600;
    const isAfterManagerWindow = totalMinutes > 645;

    let remainingSeconds = 0;
    if (isManagerWindowOpen) {
      const endMinute = 645;
      remainingSeconds = Math.max(0, (endMinute - totalMinutes) * 60 - second);
    }

    return {
      dateStr,
      year,
      month,
      day,
      hour,
      minute,
      second,
      totalMinutes,
      isManagerWindowOpen,
      isBeforeManagerWindow,
      isAfterManagerWindow,
      remainingSeconds,
      formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      formattedSeconds: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      timezone: 'Asia/Kathmandu'
    };
  }

  // 1. Authoritative Server Time & Attendance Window Status
  app.get("/api/attendance/server-time", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const timeInfo = getMTSCurrentTime();
      res.json({
        success: true,
        ...timeInfo
      });
    } catch (err: any) {
      console.error("[ATTENDANCE SERVER TIME ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve server time." });
    }
  });

  // 2. Staff Daily Attendance Roster & Daily Attendance Board
  app.get("/api/attendance/today", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'ACCOUNTANT']), async (req: any, res) => {
    try {
      const timeInfo = getMTSCurrentTime();
      const targetDate = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)))
        ? String(req.query.date)
        : timeInfo.dateStr;

      // If regular technician or receptionist without manager/admin role, return personal status
      const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user.role);

      // Fetch all eligible active staff members
      const staffMembers = await prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          role: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER'] }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phoneNumber: true,
          profileImage: true,
          department: true,
          branchId: true
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' }
        ]
      });

      // Fetch active attendance records for targetDate
      const dateAttendances = await prisma.attendance.findMany({
        where: {
          date: targetDate,
          isArchived: false
        },
        include: {
          markedBy: { select: { id: true, name: true, role: true, email: true } },
          auditLogs: { orderBy: { createdAt: 'desc' }, take: 5 }
        }
      });

      const attendanceMap = new Map<string, any>();
      for (const att of dateAttendances) {
        attendanceMap.set(att.userId, att);
      }

      const roster = staffMembers.map(staff => {
        const record = attendanceMap.get(staff.id) || null;
        return {
          user: staff,
          attendance: record,
          status: record ? record.status : 'NOT_MARKED',
          requestStatus: record ? record.requestStatus : null,
          isMarked: !!record
        };
      });

      // Filter for regular staff if not manager/admin
      const responseRoster = isManagerOrAdmin 
        ? roster 
        : roster.filter(r => r.user.id === req.user.id);

      // Stats
      let totalStaff = staffMembers.length;
      let presentCount = 0;
      let absentCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;
      let notMarkedCount = 0;

      for (const item of roster) {
        if (item.status === 'PRESENT') presentCount++;
        else if (item.status === 'ABSENT') absentCount++;
        else if (item.status === 'PENDING') pendingCount++;
        else if (item.status === 'REJECTED') rejectedCount++;
        else notMarkedCount++;
      }

      res.json({
        success: true,
        date: targetDate,
        timeInfo,
        stats: {
          totalStaff,
          presentCount,
          absentCount,
          pendingCount,
          rejectedCount,
          notMarkedCount
        },
        roster: responseRoster
      });
    } catch (err: any) {
      console.error("[ATTENDANCE TODAY ERROR]", err);
      res.status(500).json({ error: "Failed to fetch today's attendance roster." });
    }
  });

  // 3. Current User Attendance Summary & History
  app.get("/api/attendance/my", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const timeInfo = getMTSCurrentTime();
      const currentMonthPrefix = `${timeInfo.year}-${timeInfo.month}`;

      const history = await prisma.attendance.findMany({
        where: {
          userId: req.user.id,
          isArchived: false
        },
        include: {
          markedBy: { select: { id: true, name: true, role: true } },
          auditLogs: { orderBy: { createdAt: 'desc' }, take: 3 }
        },
        orderBy: { date: 'desc' }
      });

      const monthRecords = history.filter(h => h.date.startsWith(currentMonthPrefix));
      const presentCount = monthRecords.filter(r => r.status === 'PRESENT').length;
      const absentCount = monthRecords.filter(r => r.status === 'ABSENT').length;
      const pendingCount = monthRecords.filter(r => r.status === 'PENDING').length;
      const rejectedCount = monthRecords.filter(r => r.status === 'REJECTED').length;
      const totalMonthRecords = monthRecords.length;
      const attendanceRate = totalMonthRecords > 0 ? Math.round((presentCount / totalMonthRecords) * 100) : 100;

      res.json({
        success: true,
        currentMonth: `${timeInfo.year}-${timeInfo.month}`,
        stats: {
          totalMonthRecords,
          presentCount,
          absentCount,
          pendingCount,
          rejectedCount,
          attendanceRate
        },
        history
      });
    } catch (err: any) {
      console.error("[ATTENDANCE MY ERROR]", err);
      res.status(500).json({ error: "Failed to fetch attendance history." });
    }
  });

  // 4. Pending Attendance Requests for Staff
  app.get("/api/attendance/pending-requests", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const requests = await prisma.attendance.findMany({
        where: {
          userId: req.user.id,
          requestStatus: 'PENDING',
          isArchived: false
        },
        include: {
          markedBy: { select: { id: true, name: true, role: true, email: true, profileImage: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(requests);
    } catch (err: any) {
      console.error("[ATTENDANCE PENDING REQUESTS ERROR]", err);
      res.status(500).json({ error: "Failed to fetch pending requests." });
    }
  });

  // 5. Mark Attendance Endpoint
  app.post("/api/attendance/mark", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { userId, date, status, notes, reason } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "Staff user ID is required." });
      }

      const targetUser = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null, isActive: true }
      });

      if (!targetUser) {
        return res.status(404).json({ error: "Target staff user not found or inactive." });
      }

      const timeInfo = getMTSCurrentTime();
      const targetDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : timeInfo.dateStr;

      let finalStatus = 'PRESENT';
      let method = 'DIRECT_ADMIN';
      let requestStatus = 'DIRECT';

      // Role and window validation
      if (req.user.role === 'MANAGER') {
        const isSelf = req.user.id === targetUser.id;
        const isAllowedStaff = ['TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST'].includes(targetUser.role);

        if (!isSelf && !isAllowedStaff) {
          return res.status(403).json({ error: "Managers can only take attendance for Technicians, Receptionists, and themselves." });
        }

        // Time window check strictly 10:00 AM - 10:45 AM
        if (!timeInfo.isManagerWindowOpen) {
          if (timeInfo.isBeforeManagerWindow) {
            return res.status(400).json({ error: "Attendance is not available yet. Attendance can be taken from 10:00 AM." });
          } else {
            return res.status(400).json({ error: "The Manager attendance window has closed for today." });
          }
        }

        if (isSelf) {
          finalStatus = 'PRESENT';
          method = 'MANAGER_SELF';
          requestStatus = 'DIRECT';
        } else {
          finalStatus = 'PENDING';
          method = 'MANAGER_REQUEST';
          requestStatus = 'PENDING';
        }
      } else if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
        finalStatus = status || 'PRESENT';
        method = req.user.role === 'SUPER_ADMIN' ? 'DIRECT_SUPER_ADMIN' : 'DIRECT_ADMIN';
        requestStatus = 'DIRECT';
      }

      // Check duplicate attendance for this staff member on targetDate
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          userId: targetUser.id,
          date: targetDate,
          isArchived: false
        }
      });

      if (existingAttendance) {
        return res.status(400).json({ 
          error: `Attendance has already been recorded for ${targetUser.name} on ${targetDate}. Use edit/correction instead.` 
        });
      }

      // Create attendance record atomically with audit log
      const [newAttendance, auditEntry] = await prisma.$transaction(async (tx) => {
        const att = await tx.attendance.create({
          data: {
            userId: targetUser.id,
            date: targetDate,
            status: finalStatus,
            markedById: req.user.id,
            markedByName: req.user.name || req.user.role,
            markedByRole: req.user.role,
            method,
            requestStatus,
            notes: notes ? notes.trim() : null,
            branchId: targetUser.branchId || null
          },
          include: {
            user: { select: { id: true, name: true, role: true, email: true, profileImage: true } },
            markedBy: { select: { id: true, name: true, role: true, email: true } }
          }
        });

        const audit = await tx.attendanceAuditLog.create({
          data: {
            attendanceId: att.id,
            action: 'CREATED',
            performedById: req.user.id,
            performedByName: req.user.name || req.user.role,
            performedByRole: req.user.role,
            previousStatus: null,
            newStatus: finalStatus,
            reason: reason ? reason.trim() : (requestStatus === 'PENDING' ? 'Daily attendance request dispatched' : 'Direct attendance marked'),
            metadata: JSON.stringify({ method, date: targetDate, time: timeInfo.formattedSeconds })
          }
        });

        return [att, audit];
      });

      // Dispatch Notification if requestStatus is PENDING
      if (requestStatus === 'PENDING') {
        await sendSystemNotification({
          userId: targetUser.id,
          title: "📋 Attendance Request",
          message: `Manager has marked your attendance for today (${targetDate}). Status: Pending. Please accept or reject.`,
          type: "ATTENDANCE_REQUEST",
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            attendanceId: newAttendance.id,
            date: targetDate,
            markedBy: req.user.name || req.user.role
          }
        });
      }

      broadcastRealtimeEvent({ entity: "attendance", action: "CREATE", id: newAttendance.id, data: newAttendance });
      syncToFirestore('attendance', newAttendance).catch(() => {});

      const successMsg = requestStatus === 'PENDING'
        ? `Attendance request sent to ${targetUser.name}. Status: Pending approval.`
        : `Attendance marked as ${finalStatus} for ${targetUser.name}.`;

      res.status(201).json({
        success: true,
        message: successMsg,
        attendance: newAttendance
      });
    } catch (err: any) {
      console.error("[ATTENDANCE MARK ERROR]", err);
      if (err?.code === 'P2002') {
        return res.status(400).json({ error: "Attendance has already been recorded for this staff member today." });
      }
      res.status(500).json({ error: "Unable to save attendance. Please try again." });
    }
  });

  // 6. Respond to Attendance Request (Accept / Reject)
  app.post("/api/attendance/:id/respond", authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { action, rejectionReason } = req.body;

      if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: "Action must be either ACCEPT or REJECT." });
      }

      const attendance = await prisma.attendance.findUnique({
        where: { id },
        include: { user: true, markedBy: true }
      });

      if (!attendance) {
        return res.status(404).json({ error: "Attendance request record not found." });
      }

      // Security check: only the target staff user (or super admin) can respond
      const isOwner = attendance.userId === req.user.id;
      const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden: You cannot respond to another staff member's attendance request." });
      }

      if (attendance.requestStatus !== 'PENDING') {
        return res.status(400).json({ error: `Attendance request has already been ${attendance.requestStatus.toLowerCase()}.` });
      }

      const isAccept = action === 'ACCEPT';
      const newStatus = isAccept ? 'PRESENT' : 'REJECTED';
      const newRequestStatus = isAccept ? 'ACCEPTED' : 'REJECTED';
      const cleanReason = !isAccept ? (rejectionReason?.trim() || "Rejected by staff member") : null;

      const [updatedAttendance, audit] = await prisma.$transaction(async (tx) => {
        const updated = await tx.attendance.update({
          where: { id },
          data: {
            status: newStatus,
            requestStatus: newRequestStatus,
            rejectionReason: cleanReason,
            respondedAt: new Date()
          },
          include: {
            user: { select: { id: true, name: true, role: true, email: true, profileImage: true } },
            markedBy: { select: { id: true, name: true, role: true, email: true } },
            auditLogs: { orderBy: { createdAt: 'desc' } }
          }
        });

        const aud = await tx.attendanceAuditLog.create({
          data: {
            attendanceId: id,
            action: isAccept ? 'ACCEPTED' : 'REJECTED',
            performedById: req.user.id,
            performedByName: req.user.name || req.user.role,
            performedByRole: req.user.role,
            previousStatus: attendance.status,
            newStatus,
            reason: cleanReason || 'Employee accepted attendance',
            metadata: JSON.stringify({ respondedAt: new Date().toISOString() })
          }
        });

        return [updated, aud];
      });

      // Send feedback notification to the person who marked it
      if (attendance.markedById && attendance.markedById !== req.user.id) {
        await sendSystemNotification({
          userId: attendance.markedById,
          title: `Attendance Request ${isAccept ? 'Accepted' : 'Rejected'}`,
          message: `${req.user.name || 'Staff member'} has ${isAccept ? 'accepted' : 'rejected'} attendance for ${attendance.date}.${cleanReason ? ` Reason: ${cleanReason}` : ''}`,
          type: "ATTENDANCE_RESPONSE",
          senderId: req.user.id,
          senderName: req.user.name || req.user.role,
          metadata: {
            attendanceId: updatedAttendance.id,
            action: newRequestStatus,
            reason: cleanReason
          }
        });
      }

      broadcastRealtimeEvent({ entity: "attendance", action: "UPDATE", id: updatedAttendance.id, data: updatedAttendance });
      syncToFirestore('attendance', updatedAttendance).catch(() => {});

      res.json({
        success: true,
        message: isAccept ? "Attendance accepted (Present)." : "Attendance request rejected.",
        attendance: updatedAttendance
      });
    } catch (err: any) {
      console.error("[ATTENDANCE RESPOND ERROR]", err);
      res.status(500).json({ error: "Failed to process attendance response." });
    }
  });

  // 7. Attendance History with Date Range & Role Filters
  app.get("/api/attendance/history", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER']), async (req: any, res) => {
    try {
      const { startDate, endDate, role, status, userId, search, range = 'this_month' } = req.query;
      const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user.role);

      const where: any = {
        isArchived: false
      };

      // Normal staff can only view their own attendance
      if (!isManagerOrAdmin) {
        where.userId = req.user.id;
      } else if (userId && userId !== 'ALL') {
        where.userId = String(userId);
      }

      // Date filtering
      const timeInfo = getMTSCurrentTime();
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = String(startDate);
        if (endDate) where.date.lte = String(endDate);
      } else if (range === 'today') {
        where.date = timeInfo.dateStr;
      } else if (range === 'this_month') {
        where.date = {
          gte: `${timeInfo.year}-${timeInfo.month}-01`,
          lte: `${timeInfo.year}-${timeInfo.month}-31`
        };
      }

      // Status filter
      if (status && status !== 'ALL') {
        where.status = String(status);
      }

      // User search or role filter
      if (role && role !== 'ALL') {
        where.user = { role: String(role) };
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();
        where.OR = [
          { user: { name: { contains: q } } },
          { user: { email: { contains: q } } },
          { markedByName: { contains: q } },
          { notes: { contains: q } },
          { rejectionReason: { contains: q } }
        ];
      }

      const records = await prisma.attendance.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: true, email: true, phoneNumber: true, profileImage: true } },
          markedBy: { select: { id: true, name: true, role: true } },
          auditLogs: { orderBy: { createdAt: 'desc' } }
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 500
      });

      res.json(records);
    } catch (err: any) {
      console.error("[ATTENDANCE HISTORY ERROR]", err);
      res.status(500).json({ error: "Failed to fetch attendance history." });
    }
  });

  // 8. Edit / Correction Endpoint with Audit Log
  app.patch("/api/attendance/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, notes, reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: "A valid reason for attendance correction is required." });
      }

      const attendance = await prisma.attendance.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!attendance) {
        return res.status(404).json({ error: "Attendance record not found." });
      }

      const prevStatus = attendance.status;
      const newStatus = status || prevStatus;

      const [updated, audit] = await prisma.$transaction(async (tx) => {
        const att = await tx.attendance.update({
          where: { id },
          data: {
            status: newStatus,
            notes: notes !== undefined ? (notes ? notes.trim() : null) : attendance.notes,
            requestStatus: newStatus === 'PRESENT' ? 'ACCEPTED' : (newStatus === 'REJECTED' ? 'REJECTED' : attendance.requestStatus),
            updatedAt: new Date()
          },
          include: {
            user: { select: { id: true, name: true, role: true, email: true, profileImage: true } },
            markedBy: { select: { id: true, name: true, role: true } },
            auditLogs: { orderBy: { createdAt: 'desc' } }
          }
        });

        const aud = await tx.attendanceAuditLog.create({
          data: {
            attendanceId: id,
            action: 'EDITED',
            performedById: req.user.id,
            performedByName: req.user.name || req.user.role,
            performedByRole: req.user.role,
            previousStatus: prevStatus,
            newStatus,
            reason: reason.trim(),
            metadata: JSON.stringify({ editedAt: new Date().toISOString() })
          }
        });

        return [att, aud];
      });

      broadcastRealtimeEvent({ entity: "attendance", action: "UPDATE", id: updated.id, data: updated });
      syncToFirestore('attendance', updated).catch(() => {});

      res.json({
        success: true,
        message: "Attendance record updated successfully.",
        attendance: updated
      });
    } catch (err: any) {
      console.error("[ATTENDANCE EDIT ERROR]", err);
      res.status(500).json({ error: "Failed to update attendance record." });
    }
  });

  // 9. Soft-Delete / Archive Attendance Record
  app.delete("/api/attendance/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const attendance = await prisma.attendance.findUnique({
        where: { id }
      });

      if (!attendance) {
        return res.status(404).json({ error: "Attendance record not found." });
      }

      const [archived, audit] = await prisma.$transaction(async (tx) => {
        const att = await tx.attendance.update({
          where: { id },
          data: {
            isArchived: true,
            updatedAt: new Date()
          }
        });

        const aud = await tx.attendanceAuditLog.create({
          data: {
            attendanceId: id,
            action: 'ARCHIVED',
            performedById: req.user.id,
            performedByName: req.user.name || req.user.role,
            performedByRole: req.user.role,
            previousStatus: attendance.status,
            newStatus: 'ARCHIVED',
            reason: reason?.trim() || 'Attendance record removed by authorized staff'
          }
        });

        return [att, aud];
      });

      broadcastRealtimeEvent({ entity: "attendance", action: "DELETE", id: archived.id, data: archived });
      res.json({
        success: true,
        message: "Attendance record archived successfully."
      });
    } catch (err: any) {
      console.error("[ATTENDANCE DELETE ERROR]", err);
      res.status(500).json({ error: "Failed to archive attendance record." });
    }
  });

  // 10. Attendance Excel / CSV Export Data Endpoint
  app.get("/api/attendance/export", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { startDate, endDate, role } = req.query;
      const where: any = { isArchived: false };

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = String(startDate);
        if (endDate) where.date.lte = String(endDate);
      }
      if (role && role !== 'ALL') {
        where.user = { role: String(role) };
      }

      const records = await prisma.attendance.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, role: true, department: true } },
          markedBy: { select: { name: true, role: true } }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
      });

      const exportRows = records.map(r => ({
        'Date': r.date,
        'Staff Name': r.user.name,
        'Email': r.user.email,
        'Role': r.user.role,
        'Department': r.user.department || 'Repair Operations',
        'Status': r.status,
        'Request Status': r.requestStatus,
        'Marked By': r.markedByName || r.markedBy?.name || 'System',
        'Marked By Role': r.markedByRole || r.markedBy?.role || 'SYSTEM',
        'Marked Time': new Date(r.markedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit' }),
        'Rejection Reason': r.rejectionReason || '—',
        'Notes': r.notes || '—'
      }));

      res.json({
        success: true,
        count: exportRows.length,
        rows: exportRows
      });
    } catch (err: any) {
      console.error("[ATTENDANCE EXPORT ERROR]", err);
      res.status(500).json({ error: "Failed to export attendance records." });
    }
  });

  // 11. Comprehensive Monthly Attendance Report for Staff (SUPER_ADMIN, ADMIN, MANAGER)
  app.get("/api/attendance/monthly-report", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const timeInfo = getMTSCurrentTime();
      const targetMonth = (req.query.month && /^\d{4}-\d{2}$/.test(String(req.query.month))) 
        ? String(req.query.month) 
        : `${timeInfo.year}-${timeInfo.month}`;
      
      const { role, status, search, userId } = req.query;
      const [yStr, mStr] = targetMonth.split('-');
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);

      // Number of days in this target month (proper handling for leap years and 28/29/30/31 days)
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStartStr = `${targetMonth}-01`;
      const monthEndStr = `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;

      // Calculate elapsed days in month (if current month, elapsed = today's day; if past month, elapsed = daysInMonth; if future month, elapsed = 0)
      let elapsedDays = daysInMonth;
      const currentYearMonth = `${timeInfo.year}-${timeInfo.month}`;
      if (targetMonth === currentYearMonth) {
        elapsedDays = parseInt(timeInfo.day, 10);
      } else if (targetMonth > currentYearMonth) {
        elapsedDays = 0;
      }

      // Build User Query Filters
      const userWhere: any = {
        deletedAt: null,
        isActive: true
      };

      // Role filter
      if (role && role !== 'ALL') {
        userWhere.role = String(role);
      } else {
        userWhere.role = {
          in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER']
        };
      }

      // Managers can only view Technicians, Receptionists, and themselves unless Admin/Super Admin
      if (req.user.role === 'MANAGER') {
        if (role && role !== 'ALL') {
          if (!['TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST'].includes(String(role)) && String(role) !== 'MANAGER') {
            return res.status(403).json({ error: "Managers can only view reports for Technicians, Receptionists, and themselves." });
          }
        } else {
          userWhere.OR = [
            { id: req.user.id },
            { role: { in: ['TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST'] } }
          ];
        }
      }

      if (userId && userId !== 'ALL') {
        userWhere.id = String(userId);
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();
        userWhere.AND = [
          ...(userWhere.AND || []),
          {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phoneNumber: { contains: q } }
            ]
          }
        ];
      }

      // Fetch all eligible staff members
      const staffMembers = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phoneNumber: true,
          profileImage: true,
          department: true,
          branchId: true
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' }
        ]
      });

      // Fetch all attendance records for this month
      const monthAttendances = await prisma.attendance.findMany({
        where: {
          date: {
            gte: monthStartStr,
            lte: monthEndStr
          },
          isArchived: false
        },
        include: {
          markedBy: { select: { id: true, name: true, role: true } }
        },
        orderBy: { date: 'asc' }
      });

      // Group attendance records by userId
      const userRecordsMap = new Map<string, any[]>();
      for (const att of monthAttendances) {
        if (!userRecordsMap.has(att.userId)) {
          userRecordsMap.set(att.userId, []);
        }
        userRecordsMap.get(att.userId)!.push(att);
      }

      // Construct per-staff monthly summary
      const staffReport = staffMembers.map(staff => {
        const userRecords = userRecordsMap.get(staff.id) || [];
        
        let presentDays = 0;
        let absentDays = 0;
        let pendingDays = 0;
        let rejectedDays = 0;
        let lateDays = 0;

        for (const r of userRecords) {
          if (r.status === 'PRESENT') presentDays++;
          else if (r.status === 'ABSENT') absentDays++;
          else if (r.status === 'PENDING') pendingDays++;
          else if (r.status === 'REJECTED') rejectedDays++;
          else if (r.status === 'LATE') {
            lateDays++;
            presentDays++;
          }
        }

        const totalRecordedDays = userRecords.length;
        let attendanceRate: number | null = null;
        if (totalRecordedDays > 0) {
          attendanceRate = Math.round((presentDays / totalRecordedDays) * 1000) / 10;
        }

        let statusTag = 'NO_DATA';
        if (attendanceRate !== null) {
          if (attendanceRate >= 95) statusTag = 'EXCELLENT';
          else if (attendanceRate >= 85) statusTag = 'GOOD';
          else if (attendanceRate >= 75) statusTag = 'AVERAGE';
          else statusTag = 'NEEDS_ATTENTION';
        }

        return {
          user: staff,
          presentDays,
          absentDays,
          pendingDays,
          rejectedDays,
          lateDays,
          totalRecordedDays,
          elapsedDays,
          attendanceRate,
          statusTag,
          records: userRecords
        };
      });

      // Status Filter across staff report
      let filteredReport = staffReport;
      if (status && status !== 'ALL') {
        const targetStatus = String(status).toUpperCase();
        if (targetStatus === 'PRESENT') {
          filteredReport = staffReport.filter(r => r.presentDays > 0);
        } else if (targetStatus === 'ABSENT') {
          filteredReport = staffReport.filter(r => r.absentDays > 0);
        } else if (targetStatus === 'PENDING') {
          filteredReport = staffReport.filter(r => r.pendingDays > 0);
        } else if (targetStatus === 'REJECTED') {
          filteredReport = staffReport.filter(r => r.rejectedDays > 0);
        }
      }

      // Today's Date Roster Stats (for Top Cards)
      const todayStr = timeInfo.dateStr;
      const todayRecords = await prisma.attendance.findMany({
        where: { date: todayStr, isArchived: false }
      });
      let presentToday = 0;
      let absentToday = 0;
      for (const tr of todayRecords) {
        if (tr.status === 'PRESENT' || tr.status === 'LATE') presentToday++;
        else if (tr.status === 'ABSENT') absentToday++;
      }

      // Overall month attendance rate across staff with records
      const staffWithRates = staffReport.filter(s => s.attendanceRate !== null);
      const overallAvgRate = staffWithRates.length > 0
        ? Math.round((staffWithRates.reduce((acc, s) => acc + (s.attendanceRate || 0), 0) / staffWithRates.length) * 10) / 10
        : 100;

      res.json({
        success: true,
        month: targetMonth,
        daysInMonth,
        elapsedDays,
        stats: {
          totalStaff: staffMembers.length,
          presentToday,
          absentToday,
          attendanceRate: overallAvgRate
        },
        report: filteredReport
      });
    } catch (err: any) {
      console.error("[ATTENDANCE MONTHLY REPORT ERROR]", err);
      res.status(500).json({ error: "Failed to generate monthly attendance report." });
    }
  });

  // 12. Individual Staff Detailed Monthly Attendance History
  app.get("/api/attendance/staff/:userId/monthly", authenticate, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const timeInfo = getMTSCurrentTime();
      const targetMonth = (req.query.month && /^\d{4}-\d{2}$/.test(String(req.query.month))) 
        ? String(req.query.month) 
        : `${timeInfo.year}-${timeInfo.month}`;

      const staffUser = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null }
      });

      if (!staffUser) {
        return res.status(404).json({ error: "Staff member not found." });
      }

      // RBAC Security Check:
      const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
      const isManager = req.user.role === 'MANAGER';
      const isSelf = req.user.id === userId;

      if (!isSuperOrAdmin && !isSelf) {
        if (isManager) {
          const isAllowedTeam = ['TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST'].includes(staffUser.role);
          if (!isAllowedTeam) {
            return res.status(403).json({ error: "Forbidden: Managers can only view team member attendance history." });
          }
        } else {
          return res.status(403).json({ error: "Forbidden: You are not authorized to view another staff member's attendance history." });
        }
      }

      const [yStr, mStr] = targetMonth.split('-');
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStartStr = `${targetMonth}-01`;
      const monthEndStr = `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;

      // Fetch attendance records for this user in this month
      const userRecords = await prisma.attendance.findMany({
        where: {
          userId,
          date: {
            gte: monthStartStr,
            lte: monthEndStr
          },
          isArchived: false
        },
        include: {
          markedBy: { select: { id: true, name: true, role: true } },
          auditLogs: { orderBy: { createdAt: 'desc' } }
        },
        orderBy: { date: 'asc' }
      });

      const recordsMap = new Map<string, any>();
      for (const r of userRecords) {
        recordsMap.set(r.date, r);
      }

      const todayStr = timeInfo.dateStr;
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // Generate day-by-day logs for the entire month (1 to daysInMonth)
      let presentCount = 0;
      let absentCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;
      let lateCount = 0;

      const dailyLogs = [];
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dayStr = String(dayNum).padStart(2, '0');
        const dateStr = `${targetMonth}-${dayStr}`;
        const dateObj = new Date(year, month - 1, dayNum);
        const dayOfWeek = dayNames[dateObj.getDay()];
        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;

        const record = recordsMap.get(dateStr) || null;
        let status = record ? record.status : (isFuture ? 'FUTURE' : 'NOT_MARKED');

        if (record) {
          if (record.status === 'PRESENT') presentCount++;
          else if (record.status === 'ABSENT') absentCount++;
          else if (record.status === 'PENDING') pendingCount++;
          else if (record.status === 'REJECTED') rejectedCount++;
          else if (record.status === 'LATE') {
            lateCount++;
            presentCount++;
          }
        }

        dailyLogs.push({
          date: dateStr,
          day: dayStr,
          dayOfWeek,
          isFuture,
          isToday,
          status,
          record: record ? {
            id: record.id,
            status: record.status,
            requestStatus: record.requestStatus,
            markedBy: record.markedByName || record.markedBy?.name || record.markedByRole,
            markedAt: record.markedAt,
            formattedCheckInTime: record.markedAt 
              ? new Date(record.markedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit' })
              : '—',
            notes: record.notes,
            rejectionReason: record.rejectionReason,
            method: record.method,
            auditLogs: record.auditLogs
          } : null
        });
      }

      const totalRecorded = userRecords.length;
      const attendanceRate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 1000) / 10 : null;

      res.json({
        success: true,
        user: {
          id: staffUser.id,
          name: staffUser.name,
          email: staffUser.email,
          role: staffUser.role,
          phoneNumber: staffUser.phoneNumber,
          profileImage: staffUser.profileImage,
          department: staffUser.department
        },
        month: targetMonth,
        daysInMonth,
        stats: {
          totalRecorded,
          presentCount,
          absentCount,
          pendingCount,
          rejectedCount,
          lateCount,
          attendanceRate
        },
        dailyLogs
      });
    } catch (err: any) {
      console.error("[ATTENDANCE STAFF MONTHLY ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve staff monthly attendance." });
    }
  });

  // =========================================================================
  // REPAIR-RELATED DAMAGE MANAGEMENT SYSTEM API (STAFF DAMAGE RECORDS)
  // =========================================================================

  const STANDARD_DAMAGED_COMPONENTS = [
    'Display',
    'Back Glass / Back Panel',
    'Battery',
    'Camera',
    'Charging Port',
    'Speaker',
    'Earpiece',
    'Flex Cable',
    'Connector',
    'IC / Board Component',
    'Other'
  ];

  const STANDARD_DAMAGE_TYPES = [
    { value: 'CRACKED', label: 'Cracked / Shattered' },
    { value: 'TORN_FLEX', label: 'Torn Flex Ribbon' },
    { value: 'SHORT_CIRCUIT', label: 'Short Circuit / Electrical Defect' },
    { value: 'SCRATCHED', label: 'Scratched / Cosmetic Dent' },
    { value: 'BURNT', label: 'Overheated / Burnt Component' },
    { value: 'COMPONENT_LOST', label: 'Lost / Displaced Small Part' },
    { value: 'OTHER', label: 'Other Mishap / Defect' }
  ];

  async function generateUniqueDamageRecordNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `RRD-${currentYear}-`;
    const count = await prisma.repairRelatedDamage.count({
      where: {
        recordNumber: {
          startsWith: prefix
        }
      }
    });

    let nextSeq = count + 1;
    let candidate = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    let exists = await prisma.repairRelatedDamage.findUnique({ where: { recordNumber: candidate } });
    while (exists) {
      nextSeq++;
      candidate = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
      exists = await prisma.repairRelatedDamage.findUnique({ where: { recordNumber: candidate } });
    }
    return candidate;
  }

  // 1. Get Taxonomy / Standard Components and Types
  app.get("/api/repair-damage/components", authenticate, (req: any, res) => {
    res.json({
      components: STANDARD_DAMAGED_COMPONENTS,
      types: STANDARD_DAMAGE_TYPES
    });
  });

  // 2. Damage Overview Metrics (Role-Scoped)
  app.get("/api/repair-damage/overview", authenticate, authorize([
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER'
  ]), async (req: any, res) => {
    try {
      const userRole = req.user.role;
      const userId = req.user.id;
      const { dateStr, year, month } = getMTSCurrentTime();
      const currentMonthPrefix = `${year}-${month}`;

      const where: any = { isArchived: false };

      // Role scoping:
      if (['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
        // Full view of all records
      } else if (userRole === 'MANAGER') {
        // Manager sees Technicians, Receptionists, and their own
        where.OR = [
          { staffRole: { in: ['TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST'] } },
          { staffId: userId },
          { recordedById: userId }
        ];
      } else {
        // Technician / Receptionist / others only see their own records
        where.staffId = userId;
      }

      const allRecords = await prisma.repairRelatedDamage.findMany({
        where,
        orderBy: [{ damageTimestamp: 'desc' }, { createdAt: 'desc' }]
      });

      const totalRecords = allRecords.length;
      const thisMonthRecords = allRecords.filter(r => r.damageDate?.startsWith(currentMonthPrefix)).length;
      const todayRecords = allRecords.filter(r => r.damageDate === dateStr).length;
      const totalEstimatedCost = allRecords.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

      // Component breakdown count
      const componentBreakdown: Record<string, number> = {};
      for (const comp of STANDARD_DAMAGED_COMPONENTS) {
        componentBreakdown[comp] = 0;
      }
      for (const rec of allRecords) {
        const comp = rec.damagedComponent || 'Other';
        componentBreakdown[comp] = (componentBreakdown[comp] || 0) + (rec.quantity || 1);
      }

      // Recent 5 records
      const recentRecords = allRecords.slice(0, 5).map(r => ({
        id: r.id,
        recordNumber: r.recordNumber,
        staffId: r.staffId,
        staffName: r.staffName,
        staffRole: r.staffRole,
        damagedComponent: r.damagedComponent,
        damageType: r.damageType,
        deviceBrand: r.deviceBrand,
        deviceModel: r.deviceModel,
        repairNumber: r.repairNumber,
        repairId: r.repairId,
        damageDate: r.damageDate,
        damageTime: r.damageTime,
        quantity: r.quantity,
        estimatedCost: r.estimatedCost,
        recordedByName: r.recordedByName,
        recordedByRole: r.recordedByRole,
        status: r.status
      }));

      res.json({
        totalRecords,
        thisMonthRecords,
        todayRecords,
        totalEstimatedCost,
        currentMonth: currentMonthPrefix,
        todayDate: dateStr,
        componentBreakdown,
        recentRecords
      });
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE OVERVIEW ERROR]", err);
      res.status(500).json({ error: "Failed to load repair-related damage overview." });
    }
  });

  // 3. List Repair-Related Damage Records (Search, Filters, Pagination)
  app.get("/api/repair-damage", authenticate, authorize([
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER'
  ]), async (req: any, res) => {
    try {
      const userRole = req.user.role;
      const userId = req.user.id;
      const { 
        search, 
        staffId, 
        role, 
        component, 
        damageType,
        date, 
        month, 
        year, 
        startDate, 
        endDate, 
        status, 
        page = '1', 
        limit = '50' 
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * take;

      const where: any = { isArchived: false };

      // Role scoping
      if (['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
        // Can filter by staffId or role if provided
        if (staffId && staffId !== 'ALL') where.staffId = String(staffId);
        if (role && role !== 'ALL') where.staffRole = String(role);
      } else if (userRole === 'MANAGER') {
        if (staffId && staffId !== 'ALL') {
          where.staffId = String(staffId);
        } else if (role && role !== 'ALL') {
          where.staffRole = String(role);
        } else {
          where.OR = [
            { staffRole: { in: ['TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST'] } },
            { staffId: userId },
            { recordedById: userId }
          ];
        }
      } else {
        // Strict technician / receptionist scoping
        where.staffId = userId;
      }

      // Component Filter
      if (component && component !== 'ALL') {
        where.damagedComponent = String(component);
      }

      // Damage Type Filter
      if (damageType && damageType !== 'ALL') {
        where.damageType = String(damageType);
      }

      // Status Filter
      if (status && status !== 'ALL') {
        where.status = String(status);
      }

      // Date / Month / Year / Range Filtering
      if (date) {
        where.damageDate = String(date);
      } else if (month) {
        where.damageDate = { startsWith: String(month) };
      } else if (year) {
        where.damageDate = { startsWith: String(year) };
      } else if (startDate || endDate) {
        where.damageDate = {};
        if (startDate) where.damageDate.gte = String(startDate);
        if (endDate) where.damageDate.lte = String(endDate);
      }

      // Free-text Search
      if (search && String(search).trim()) {
        const q = String(search).trim();
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { recordNumber: { contains: q } },
              { staffName: { contains: q } },
              { damageDescription: { contains: q } },
              { repairNumber: { contains: q } },
              { deviceBrand: { contains: q } },
              { deviceModel: { contains: q } },
              { customerName: { contains: q } },
              { damagedComponent: { contains: q } },
              { notes: { contains: q } }
            ]
          }
        ];
      }

      const [records, total] = await Promise.all([
        prisma.repairRelatedDamage.findMany({
          where,
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                role: true,
                profileImage: true,
                department: true
              }
            },
            recordedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            repair: {
              select: {
                id: true,
                repairNumber: true,
                customerName: true,
                customerPhone: true,
                deviceBrand: true,
                deviceModel: true,
                status: true
              }
            }
          },
          orderBy: [{ damageDate: 'desc' }, { damageTimestamp: 'desc' }, { createdAt: 'desc' }],
          skip,
          take
        }),
        prisma.repairRelatedDamage.count({ where })
      ]);

      res.json({
        records,
        pagination: {
          total,
          page: pageNum,
          limit: take,
          totalPages: Math.ceil(total / take)
        }
      });
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE LIST ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve repair-related damage records." });
    }
  });

  // 4. Get Single Record Details (with Audit Trail)
  app.get("/api/repair-damage/:id", authenticate, authorize([
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER'
  ]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const record = await prisma.repairRelatedDamage.findUnique({
        where: { id },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              role: true,
              phoneNumber: true,
              profileImage: true,
              department: true
            }
          },
          recordedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          repair: {
            select: {
              id: true,
              repairNumber: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              deviceBrand: true,
              deviceModel: true,
              problemDescription: true,
              status: true
            }
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!record || record.isArchived) {
        return res.status(404).json({ error: "Damage record not found or has been archived." });
      }

      // Permissions check
      if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
        if (req.user.role === 'MANAGER') {
          const allowedRoles = ['TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST'];
          if (!allowedRoles.includes(record.staffRole) && record.staffId !== req.user.id && record.recordedById !== req.user.id) {
            return res.status(403).json({ error: "Forbidden: You do not have permission to view this record." });
          }
        } else if (record.staffId !== req.user.id) {
          return res.status(403).json({ error: "Forbidden: You do not have permission to view this record." });
        }
      }

      res.json(record);
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE GET ID ERROR]", err);
      res.status(500).json({ error: "Failed to retrieve damage record." });
    }
  });

  // 5. Create Repair-Related Damage Record (Manager / Admin / Super Admin)
  app.post("/api/repair-damage", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const {
        staffId,
        damagedComponent,
        damageDescription,
        damageType = 'OTHER',
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
        deductInventory = false
      } = req.body;

      if (!staffId) {
        return res.status(400).json({ error: "Staff member is required." });
      }
      if (!damagedComponent || !String(damagedComponent).trim()) {
        return res.status(400).json({ error: "Damaged component is required." });
      }
      if (!damageDescription || !String(damageDescription).trim()) {
        return res.status(400).json({ error: "Damage description is required." });
      }

      // Verify target staff member
      const staffUser = await prisma.user.findUnique({
        where: { id: staffId }
      });
      if (!staffUser) {
        return res.status(404).json({ error: "Selected staff member does not exist." });
      }

      // Manager role check: Manager can record for Technicians, Receptionists, or Assistant
      if (req.user.role === 'MANAGER') {
        const allowedTargets = ['TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST', 'MANAGER'];
        if (!allowedTargets.includes(staffUser.role) && staffUser.id !== req.user.id) {
          return res.status(403).json({ error: "Managers can only file damage reports for Technicians, Receptionists, or Technical Assistants." });
        }
      }

      // Check linked repair if provided
      let linkedRepair: any = null;
      if (repairId) {
        linkedRepair = await prisma.repair.findUnique({ where: { id: repairId } });
      } else if (repairNumber) {
        linkedRepair = await prisma.repair.findUnique({ where: { repairNumber: String(repairNumber).trim() } });
      }

      const effectiveCustomerId = customerId || linkedRepair?.customerId || null;
      const effectiveCustomerName = customerName || linkedRepair?.customerName || null;
      const effectiveDeviceBrand = deviceBrand || linkedRepair?.deviceBrand || null;
      const effectiveDeviceModel = deviceModel || linkedRepair?.deviceModel || null;
      const effectiveRepairNumber = repairNumber || linkedRepair?.repairNumber || null;
      const effectiveRepairId = linkedRepair?.id || repairId || null;

      const serverTime = getMTSCurrentTime();
      const finalDate = damageDate && /^\d{4}-\d{2}-\d{2}$/.test(String(damageDate)) ? String(damageDate) : serverTime.dateStr;
      const finalTime = damageTime && /^\d{2}:\d{2}$/.test(String(damageTime)) ? String(damageTime) : serverTime.formattedTime;
      const recordNumber = await generateUniqueDamageRecordNumber();
      const numQty = Math.max(1, parseInt(String(quantity), 10) || 1);
      const numEstimatedCost = estimatedCost !== undefined && estimatedCost !== null && estimatedCost !== '' 
        ? Math.max(0, parseFloat(String(estimatedCost)) || 0) 
        : null;

      const result = await prisma.$transaction(async (tx) => {
        let createdInventoryTxId: string | null = null;
        let didDeduct = false;

        // Traceable stock deduction if requested
        if (deductInventory && inventoryItemId) {
          const invItem = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
          if (invItem) {
            const prevStock = invItem.currentStock;
            const newStock = prevStock - numQty;

            const invTx = await tx.inventoryTransaction.create({
              data: {
                itemId: invItem.id,
                type: "DAMAGE",
                quantity: numQty,
                previousStock: prevStock,
                newStock: newStock,
                reason: `Staff Damage: ${damagedComponent} (${staffUser.name})`,
                repairNumber: effectiveRepairNumber,
                repairId: effectiveRepairId,
                performedById: req.user.id,
                performedByName: req.user.name,
                notes: `Linked to damage report ${recordNumber}`
              }
            });

            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: { currentStock: newStock }
            });

            createdInventoryTxId = invTx.id;
            didDeduct = true;
          }
        }

        // Create main damage record
        const createdRecord = await tx.repairRelatedDamage.create({
          data: {
            recordNumber,
            staffId: staffUser.id,
            staffName: staffUser.name,
            staffRole: staffUser.role,
            repairId: effectiveRepairId,
            repairNumber: effectiveRepairNumber,
            customerId: effectiveCustomerId,
            customerName: effectiveCustomerName,
            deviceBrand: effectiveDeviceBrand,
            deviceModel: effectiveDeviceModel,
            damagedComponent: String(damagedComponent).trim(),
            damageType: String(damageType).trim(),
            damageDescription: String(damageDescription).trim(),
            damageDate: finalDate,
            damageTime: finalTime,
            quantity: numQty,
            estimatedCost: numEstimatedCost,
            notes: notes ? String(notes).trim() : null,
            inventoryItemId: inventoryItemId || null,
            inventoryDeducted: didDeduct,
            inventoryTxId: createdInventoryTxId,
            recordedById: req.user.id,
            recordedByName: req.user.name,
            recordedByRole: req.user.role,
            branchId: req.user.branchId || staffUser.branchId || null,
            status: "ACTIVE"
          },
          include: {
            staff: { select: { id: true, name: true, email: true, role: true } },
            recordedBy: { select: { id: true, name: true, role: true } },
            repair: { select: { id: true, repairNumber: true, customerName: true, deviceModel: true } }
          }
        });

        // Create initial audit log
        await tx.repairRelatedDamageAudit.create({
          data: {
            damageRecordId: createdRecord.id,
            action: "CREATED",
            performedById: req.user.id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
            newData: JSON.stringify({
              recordNumber: createdRecord.recordNumber,
              staffName: createdRecord.staffName,
              staffRole: createdRecord.staffRole,
              damagedComponent: createdRecord.damagedComponent,
              damageType: createdRecord.damageType,
              damageDate: createdRecord.damageDate,
              repairNumber: createdRecord.repairNumber,
              inventoryDeducted: didDeduct
            }),
            reason: "Initial Damage Incident Report Creation"
          }
        });

        // Notification for the staff member
        await tx.notification.create({
          data: {
            userId: staffUser.id,
            title: `Repair-Related Damage Recorded: ${createdRecord.damagedComponent}`,
            message: `A damage incident report (${recordNumber}) was recorded for ${createdRecord.damagedComponent}${effectiveDeviceModel ? ` on ${effectiveDeviceModel}` : ''} by ${req.user.name}.`,
            type: "GENERAL",
            repairId: effectiveRepairId,
            repairNumber: effectiveRepairNumber,
            senderId: req.user.id,
            senderName: req.user.name,
            metadata: JSON.stringify({ damageRecordId: createdRecord.id, recordNumber })
          }
        });

        return createdRecord;
      });

      broadcastRealtimeEvent({
        entity: "repairRelatedDamage",
        action: "CREATE",
        id: result.id,
        data: result
      });

      res.status(201).json({
        success: true,
        message: "Repair-related damage record created successfully.",
        record: result
      });
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE CREATE ERROR]", err);
      res.status(500).json({ error: "Failed to create repair-related damage record." });
    }
  });

  // 6. Update Repair-Related Damage Record (Admin / Super Admin Only)
  app.patch("/api/repair-damage/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        damagedComponent,
        damageType,
        damageDescription,
        damageDate,
        damageTime,
        quantity,
        estimatedCost,
        notes,
        status,
        deviceBrand,
        deviceModel,
        repairNumber,
        auditReason
      } = req.body;

      const existing = await prisma.repairRelatedDamage.findUnique({
        where: { id }
      });
      if (!existing || existing.isArchived) {
        return res.status(404).json({ error: "Damage record not found." });
      }

      const previousSnapshot = { ...existing };

      const updateData: any = {};
      if (damagedComponent !== undefined) updateData.damagedComponent = String(damagedComponent).trim();
      if (damageType !== undefined) updateData.damageType = String(damageType).trim();
      if (damageDescription !== undefined) updateData.damageDescription = String(damageDescription).trim();
      if (damageDate !== undefined) updateData.damageDate = String(damageDate).trim();
      if (damageTime !== undefined) updateData.damageTime = String(damageTime).trim();
      if (quantity !== undefined) updateData.quantity = Math.max(1, parseInt(String(quantity), 10) || 1);
      if (estimatedCost !== undefined) {
        updateData.estimatedCost = estimatedCost === '' || estimatedCost === null 
          ? null 
          : Math.max(0, parseFloat(String(estimatedCost)) || 0);
      }
      if (notes !== undefined) updateData.notes = String(notes).trim();
      if (status !== undefined) updateData.status = String(status).trim();
      if (deviceBrand !== undefined) updateData.deviceBrand = String(deviceBrand).trim();
      if (deviceModel !== undefined) updateData.deviceModel = String(deviceModel).trim();
      if (repairNumber !== undefined) updateData.repairNumber = String(repairNumber).trim();

      const updated = await prisma.$transaction(async (tx) => {
        const rec = await tx.repairRelatedDamage.update({
          where: { id },
          data: updateData,
          include: {
            staff: { select: { id: true, name: true, role: true } },
            recordedBy: { select: { id: true, name: true, role: true } }
          }
        });

        await tx.repairRelatedDamageAudit.create({
          data: {
            damageRecordId: id,
            action: "UPDATED",
            performedById: req.user.id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
            previousData: JSON.stringify(previousSnapshot),
            newData: JSON.stringify(rec),
            reason: auditReason || "Administrative update to damage record"
          }
        });

        return rec;
      });

      broadcastRealtimeEvent({
        entity: "repairRelatedDamage",
        action: "UPDATE",
        id: updated.id,
        data: updated
      });

      res.json({
        success: true,
        message: "Damage record updated successfully.",
        record: updated
      });
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE UPDATE ERROR]", err);
      res.status(500).json({ error: "Failed to update damage record." });
    }
  });

  // 7. Delete / Archive Repair-Related Damage Record (Admin / Super Admin Only)
  app.delete("/api/repair-damage/:id", authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const existing = await prisma.repairRelatedDamage.findUnique({
        where: { id }
      });
      if (!existing || existing.isArchived) {
        return res.status(404).json({ error: "Damage record not found." });
      }

      await prisma.$transaction(async (tx) => {
        await tx.repairRelatedDamage.update({
          where: { id },
          data: {
            isArchived: true,
            status: "ARCHIVED",
            deletedAt: new Date()
          }
        });

        await tx.repairRelatedDamageAudit.create({
          data: {
            damageRecordId: id,
            action: "ARCHIVED",
            performedById: req.user.id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
            previousData: JSON.stringify(existing),
            reason: reason || "Administrative soft-delete / archival"
          }
        });
      });

      broadcastRealtimeEvent({
        entity: "repairRelatedDamage",
        action: "DELETE",
        id: id
      });

      res.json({
        success: true,
        message: "Damage record safely archived."
      });
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE DELETE ERROR]", err);
      res.status(500).json({ error: "Failed to archive damage record." });
    }
  });

  // 8. Export Repair-Related Damage Records to Excel (.xlsx)
  app.get("/api/repair-damage/export", authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: any, res) => {
    try {
      const { startDate, endDate, role, staffId, component, month, year } = req.query;
      const where: any = { isArchived: false };

      if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
        if (staffId && staffId !== 'ALL') where.staffId = String(staffId);
        if (role && role !== 'ALL') where.staffRole = String(role);
      } else if (req.user.role === 'MANAGER') {
        if (staffId && staffId !== 'ALL') {
          where.staffId = String(staffId);
        } else if (role && role !== 'ALL') {
          where.staffRole = String(role);
        } else {
          where.OR = [
            { staffRole: { in: ['TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT', 'RECEPTIONIST'] } },
            { staffId: req.user.id },
            { recordedById: req.user.id }
          ];
        }
      }

      if (component && component !== 'ALL') where.damagedComponent = String(component);
      if (month) where.damageDate = { startsWith: String(month) };
      else if (year) where.damageDate = { startsWith: String(year) };
      else if (startDate || endDate) {
        where.damageDate = {};
        if (startDate) where.damageDate.gte = String(startDate);
        if (endDate) where.damageDate.lte = String(endDate);
      }

      const records = await prisma.repairRelatedDamage.findMany({
        where,
        include: {
          staff: { select: { name: true, email: true, role: true, department: true } },
          recordedBy: { select: { name: true, role: true } }
        },
        orderBy: [{ damageDate: 'desc' }, { damageTimestamp: 'desc' }]
      });

      const exportRows = records.map(r => ({
        'Record Number': r.recordNumber,
        'Staff Name': r.staffName,
        'Staff Role': r.staffRole,
        'Damaged Component': r.damagedComponent,
        'Damage Type': r.damageType || 'OTHER',
        'Device Brand': r.deviceBrand || '—',
        'Device Model': r.deviceModel || '—',
        'Repair Number': r.repairNumber || '—',
        'Customer Name': r.customerName || '—',
        'Damage Date': r.damageDate,
        'Damage Time': r.damageTime || '—',
        'Quantity': r.quantity,
        'Estimated Cost (NPR)': r.estimatedCost !== null ? r.estimatedCost : '—',
        'Description': r.damageDescription,
        'Inventory Deducted': r.inventoryDeducted ? 'Yes' : 'No',
        'Status': r.status,
        'Recorded By': r.recordedByName,
        'Recorded By Role': r.recordedByRole,
        'Notes': r.notes || '—'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, ws, "Repair Related Damage");

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="MTS_Repair_Related_Damage_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(buffer);
    } catch (err: any) {
      console.error("[REPAIR-DAMAGE EXPORT ERROR]", err);
      res.status(500).json({ error: "Failed to export damage records." });
    }
  });

  // Fallback for missing api routes (so they don't get routed to Vite/index.html)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });

  // Global Error Handler for API router (ensures returning JSON instead of HTML stacktrace)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[SERVER UNHANDLED ERROR]", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: "An unexpected internal server error occurred",
      message: err.message || "Unknown error",
    });
  });

  return app;
}

let cachedApp: express.Express | null = null;
let initPromise: Promise<express.Express> | null = null;

export async function getApp(): Promise<express.Express> {
  if (cachedApp) return cachedApp;
  if (!initPromise) {
    initPromise = createServerApp().then((app) => {
      cachedApp = app;
      return app;
    });
  }
  return initPromise;
}

export async function startServer() {
  const app = await getApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("--------------------------------------------------");
    console.log(`🚀 MTS LAB SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌍 MODE: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💻 LOCALHOST: http://localhost:${PORT}`);
    console.log(`📱 ALL DEVICES (LAN): http://192.168.1.66:${PORT}`);
    console.log("--------------------------------------------------");
  });

  return app;
}

// Auto-start only when executed directly as standalone Node server
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.SERVERLESS && process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
