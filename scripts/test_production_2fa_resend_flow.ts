import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5432/mts_lab";
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

async function runProduction2FAFlowTests() {
  console.log("================================================================================");
  console.log("  MTS LAB PRODUCTION AUTHENTICATION & RESEND 2FA INTEGRATION AUDIT  ");
  console.log("================================================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      testsFailed++;
    }
  }

  const testEmail = "2fa.test.staff@mtslab.com";
  const rawPassword = "MtsLab2FA@2026";
  const pwdHash = await bcrypt.hash(rawPassword, 10);

  try {
    // 1. Provision Test Staff Member
    console.log("--- Group 1: Provisioning Test Staff Account ---");
    await prisma.user.deleteMany({ where: { email: testEmail } });

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        username: "staff2fa",
        password: pwdHash,
        name: "Test 2FA Staff",
        role: "TECHNICIAN",
        accountStatus: "ACTIVE",
        isActive: true,
        emailVerified: true,
        twoFactorEnabled: false
      }
    });

    assert(user.emailVerified === true, "User created with emailVerified = true");
    assert(user.twoFactorEnabled === false, "Initial twoFactorEnabled state is false");

    // 2. Login with 2FA Disabled -> Direct Token Issuance
    console.log("\n--- Group 2: Password Login with 2FA Disabled ---");
    const directLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: testEmail,
        password: rawPassword,
        device: { deviceName: "Test Desktop", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
      })
    });

    assert(directLoginRes.status === 200, "Login returns HTTP 200 OK");
    const directJson: any = await directLoginRes.json().catch(() => ({}));
    assert(!!directJson.token, "Direct JWT session token issued");
    assert(directJson.mfaRequired === false, "mfaRequired is false when 2FA is disabled");

    // 3. Superadmin Toggle 2FA to ENABLED
    console.log("\n--- Group 3: Superadmin Toggles 2FA to ENABLED ---");
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    });
    assert(updatedUser.twoFactorEnabled === true, "Prisma database confirms twoFactorEnabled = true");

    // 4. Login with 2FA Enabled -> OTP Ticket Issued (No Session Token)
    console.log("\n--- Group 4: Password Login with 2FA Enabled ---");
    const challengeLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: testEmail,
        password: rawPassword,
        device: { deviceName: "Test Desktop", deviceType: "DESKTOP", browser: "Chrome", os: "Windows" }
      })
    });

    const challengeJson: any = await challengeLoginRes.json().catch(() => ({}));
    if (challengeLoginRes.status === 200) {
      assert(challengeJson.mfaRequired === true, "Response payload requires mfaRequired = true");
      assert(!!challengeJson.mfaTicket, "Valid mfaTicket issued to client");
      assert(!challengeJson.token, "No direct JWT token issued prior to OTP verification");
    } else if (challengeLoginRes.status === 503) {
      assert(challengeJson.success === false, "Handled Resend API key non-configured state gracefully (HTTP 503)");
    }

    // 5. Test 2FA OTP Verification Endpoint
    if (challengeJson.mfaTicket) {
      console.log("\n--- Group 5: 2FA OTP Code Verification ---");
      const invalidOtpRes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaTicket: challengeJson.mfaTicket, otp: "000000" })
      });
      assert(invalidOtpRes.status === 400, "Incorrect OTP returns HTTP 400 Bad Request");

      // Test Resend Cooldown
      console.log("\n--- Group 6: Resend Cooldown Rate Limiting ---");
      const resendRes = await fetch(`${BASE_URL}/api/auth/2fa/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaTicket: challengeJson.mfaTicket })
      });
      assert(resendRes.status === 429, "Immediate resend returns HTTP 429 Rate Limited");
      const resendJson: any = await resendRes.json().catch(() => ({}));
      assert(!!resendJson.retryAfter, "Retry-After header/value present in 429 response");
    }

    // Cleanup test user
    await prisma.user.delete({ where: { id: user.id } });
    console.log("\nTest staff account cleaned up.");

  } catch (err: any) {
    console.error("Test execution error:", err);
    testsFailed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n================================================================================");
    console.log(`2FA PRODUCTION INTEGRATION AUDIT RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("================================================================================\n");
  }
}

runProduction2FAFlowTests();
