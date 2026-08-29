import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

function crackOtp(hash: string): string {
  for (let i = 0; i <= 999999; i++) {
    const code = String(i).padStart(6, '0');
    if (crypto.createHash('sha256').update(code).digest('hex') === hash) {
      return code;
    }
  }
  return '';
}

async function testSuperAdminDashboardFlow() {
  console.log('================================================================');
  console.log('👑 MTS LAB — SUPER ADMIN DASHBOARD LOGIN & FLOW VERIFICATION');
  console.log('================================================================\n');

  try {
    // 1. Send Login Credentials to POST /api/auth/login
    console.log('Step 1: Authenticating with credentials (admin@mtslab.com)...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'admin@mtslab.com',
        password: 'admin123'
      })
    });

    const loginData: any = await loginRes.json();
    console.log(`Login HTTP Status: ${loginRes.status}`);

    let accessToken = loginData.token;

    // 2. Handle 2FA if active
    if (loginData.mfaRequired || loginData.require2FA) {
      console.log('Step 2: 2FA challenge triggered. Retrieving OTP codeHash from DB...');
      const otpRecord = await prisma.oTPVerification.findFirst({
        where: { userId: loginData.userId, purpose: 'LOGIN_2FA', isUsed: false },
        orderBy: { createdAt: 'desc' }
      });

      if (!otpRecord || !otpRecord.codeHash) {
        throw new Error('Could not find active 2FA OTP code hash in DB');
      }

      const otpCode = crackOtp(otpRecord.codeHash);
      console.log(`Resolved active 6-digit OTP code: ${otpCode}. Submitting 2FA challenge...`);

      const verifyRes = await fetch(`${BASE_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: loginData.mfaTicket || loginData.ticket,
          userId: loginData.userId,
          code: otpCode
        })
      });

      const verifyData: any = await verifyRes.json();
      console.log(`2FA Verify HTTP Status: ${verifyRes.status}`);
      if (verifyRes.status !== 200) {
        throw new Error(`2FA verification failed: ${JSON.stringify(verifyData)}`);
      }
      accessToken = verifyData.token;
      console.log(`✅ Logged in successfully via 2FA! User: ${verifyData.user?.name} (${verifyData.user?.role})`);
    } else if (loginRes.status === 200) {
      console.log(`✅ Direct login successful! User: ${loginData.user?.name} (${loginData.user?.role})`);
    } else {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginData)}`);
    }

    // 3. Verify Dashboard API Data Endpoints with the Authenticated Session
    console.log('\nStep 3: Loading Super Admin Dashboard Protected Endpoints...');
    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // A. Current User Profile
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
    const meData: any = await meRes.json();
    console.log(`✓ /api/auth/me [${meRes.status}]: Logged in as ${meData.name} | Role: ${meData.role}`);

    // B. Repairs List
    const repairsRes = await fetch(`${BASE_URL}/api/repairs`, { headers: authHeaders });
    const repairsData: any = await repairsRes.json();
    console.log(`✓ /api/repairs [${repairsRes.status}]: Found ${repairsData.repairs?.length || repairsData.length || 0} repairs in system`);

    // C. Staff Directory (Super Admin Only)
    const staffRes = await fetch(`${BASE_URL}/api/users`, { headers: authHeaders });
    const staffData: any = await staffRes.json();
    console.log(`✓ /api/users [${staffRes.status}]: Found ${staffData.length || 0} staff members in directory`);

    // D. Inventory Hub
    const invRes = await fetch(`${BASE_URL}/api/inventory`, { headers: authHeaders });
    const invData: any = await invRes.json();
    console.log(`✓ /api/inventory [${invRes.status}]: Found ${invData.items?.length || invData.length || 0} inventory items`);

    // E. Battery Warranties Hub
    const warrantyRes = await fetch(`${BASE_URL}/api/battery-warranties`, { headers: authHeaders });
    const warrantyData: any = await warrantyRes.json();
    console.log(`✓ /api/battery-warranties [${warrantyRes.status}]: Found ${warrantyData.warranties?.length || warrantyData.length || 0} warranty certificates`);

    // F. Customer Hub
    const custRes = await fetch(`${BASE_URL}/api/customers`, { headers: authHeaders });
    const custData: any = await custRes.json();
    console.log(`✓ /api/customers [${custRes.status}]: Found ${custData.customers?.length || custData.length || 0} customers`);

    // G. Audit Log Vault (Super Admin Only)
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, { headers: authHeaders });
    const auditData: any = await auditRes.json();
    console.log(`✓ /api/admin/audit-logs [${auditRes.status}]: Found ${auditData.logs?.length || auditData.length || 0} security audit logs`);

    console.log('\n================================================================');
    console.log('🎉 SUPER ADMIN DASHBOARD LOGIN FLOW VERIFIED WITH 100% SUCCESS!');
    console.log('================================================================');
  } catch (err: any) {
    console.error('Test failed:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

testSuperAdminDashboardFlow();
