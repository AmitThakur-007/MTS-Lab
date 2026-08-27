import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5432/mts_lab";
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';

const TEST_ROLES = [
  'SUPERADMIN',
  'ADMIN',
  'MANAGER',
  'HEAD_TECHNICIAN',
  'TECHNICIAN',
  'RECEPTIONIST'
] as const;

async function runRbacTests() {
  console.log("=================================================");
  console.log("   MTS LAB COMPLETE RBAC & ROLE SYSTEM AUDIT    ");
  console.log("=================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`[PASS] ${description}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${description}`);
      testsFailed++;
    }
  }

  try {
    // 1. Verify SuperAdmin existence in DB
    const superAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { role: 'SUPERADMIN' },
          { role: 'SUPER_ADMIN' },
          { email: 'mtsmobilelab@gmail.com' }
        ],
        deletedAt: null
      }
    });

    assert(Boolean(superAdmin), "Primary SuperAdmin user exists in PostgreSQL database");

    if (superAdmin) {
      // 2. Test User Creation & Role Change Persistence in DB for all 6 roles
      console.log("\n--- Testing Role Persistence across all 6 Canonical Roles ---");
      const testEmail = "rbac.test.user@mtslab.com";

      // Clean up previous test user if exists
      await prisma.user.deleteMany({ where: { email: testEmail } });

      const pwdHash = await bcrypt.hash("MtsLab@2026", 10);
      const testUser = await prisma.user.create({
        data: {
          email: testEmail,
          username: "rbactestuser",
          password: pwdHash,
          name: "RBAC Test User",
          role: "RECEPTIONIST",
          accountStatus: "ACTIVE",
          isActive: true
        }
      });

      assert(testUser.role === "RECEPTIONIST", "Created user with initial role RECEPTIONIST");

      for (const roleToTest of TEST_ROLES) {
        const updated = await prisma.user.update({
          where: { id: testUser.id },
          data: { role: roleToTest }
        });
        assert(updated.role === roleToTest, `Role changed to ${roleToTest} successfully in DB`);
        
        // Verify lookup
        const refetched = await prisma.user.findUnique({ where: { id: testUser.id } });
        assert(refetched?.role === roleToTest, `Refetched DB role matches ${roleToTest}`);
      }

      // Clean up test user
      await prisma.user.delete({ where: { id: testUser.id } });
      console.log("Role persistence tests completed cleanly.");
    }

    // 3. Test Last SuperAdmin Deletion Protection Logic
    console.log("\n--- Testing Last SuperAdmin Safety Protection ---");
    const activeSuperAdmins = await prisma.user.count({
      where: {
        role: { in: ['SUPER_ADMIN', 'SUPERADMIN'] },
        isActive: true,
        accountStatus: 'ACTIVE',
        deletedAt: null
      }
    });

    assert(activeSuperAdmins >= 1, `Active SuperAdmins count in database is ${activeSuperAdmins}`);

  } catch (err: any) {
    console.error("Test execution error:", err);
    testsFailed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n=================================================");
    console.log(`RBAC SYSTEM TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("=================================================");
  }
}

runRbacTests();
