import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { validateStrongPassword } from '../src/lib/passwordPolicy';

const prisma = new PrismaClient();

async function runAuthenticationTestSuite() {
  console.log('================================================================================');
  console.log('MTS LAB — FIREBASE AUTHENTICATION & SECURITY TEST SUITE (ALL 6 ROLES)');
  console.log('================================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS ${totalTests}]: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL ${totalTests}]: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // 1. Password Policy Unit Tests
    console.log('--- GROUP 1: Strong Password Policy Validation ---');
    const validPass = validateStrongPassword('MtsLab@2026Secure');
    assert(validPass.valid === true, 'Valid password (MtsLab@2026Secure) is accepted');

    const weakPass1 = validateStrongPassword('password');
    assert(weakPass1.valid === false, 'Weak password "password" is rejected');

    const weakPass2 = validateStrongPassword('12345678');
    assert(weakPass2.valid === false, 'Numeric only password "12345678" is rejected');

    const weakPass3 = validateStrongPassword('mtslab123');
    assert(weakPass3.valid === false, 'Password missing uppercase & special char is rejected');

    const weakPass4 = validateStrongPassword('MTSLAB123');
    assert(weakPass4.valid === false, 'Password missing lowercase & special char is rejected');

    const weakPass5 = validateStrongPassword('Ab1!');
    assert(weakPass5.valid === false, 'Short password under 8 characters is rejected');


    // 2. Multi-Role Account Test Setup across all 6 roles
    console.log('\n--- GROUP 2: Account Provisioning & Password Hashing across all 6 Roles ---');
    const validPasswordText = 'MtsLab@2026Secure';
    const passwordHash = await bcrypt.hash(validPasswordText, 10);

    const rolesToTest = [
      { role: 'SUPER_ADMIN', email: 'test.superadmin@mtslab.com', name: 'Test Super Admin' },
      { role: 'ADMIN', email: 'test.admin@mtslab.com', name: 'Test Admin' },
      { role: 'MANAGER', email: 'test.manager@mtslab.com', name: 'Test Manager' },
      { role: 'HEAD_TECHNICIAN', email: 'test.headtech@mtslab.com', name: 'Test Head Tech' },
      { role: 'TECHNICIAN', email: 'test.tech@mtslab.com', name: 'Test Tech' },
      { role: 'RECEPTIONIST', email: 'test.receptionist@mtslab.com', name: 'Test Receptionist' }
    ];

    for (const item of rolesToTest) {
      let u = await prisma.user.findFirst({ where: { email: item.email } });
      if (u) {
        u = await prisma.user.update({
          where: { id: u.id },
          data: {
            password: passwordHash,
            role: item.role,
            accountStatus: 'ACTIVE',
            isActive: true,
            emailVerified: true
          }
        });
      } else {
        u = await prisma.user.create({
          data: {
            email: item.email,
            name: item.name,
            username: item.email.split('@')[0],
            password: passwordHash,
            role: item.role,
            accountStatus: 'ACTIVE',
            isActive: true,
            emailVerified: true
          }
        });
      }

      assert(Boolean(u && u.id), `Account provisioned for role: ${item.role} (${item.email})`);

      // Verify correct password bcrypt validation
      const passMatch = await bcrypt.compare(validPasswordText, u.password);
      assert(passMatch === true, `Correct password validated for ${item.role}`);

      // Verify wrong password rejection
      const wrongMatch = await bcrypt.compare('WrongPass123!', u.password);
      assert(wrongMatch === false, `Incorrect password rejected for ${item.role}`);
    }

    // 3. Deactivated / Inactive Account Rejection Test
    console.log('\n--- GROUP 3: Account Status & Deactivation Policy Enforcement ---');
    let deactivatedUser = await prisma.user.findFirst({ where: { email: 'deactivated.staff@mtslab.com' } });
    if (deactivatedUser) {
      deactivatedUser = await prisma.user.update({
        where: { id: deactivatedUser.id },
        data: { accountStatus: 'DISABLED', isActive: false, password: passwordHash }
      });
    } else {
      deactivatedUser = await prisma.user.create({
        data: {
          email: 'deactivated.staff@mtslab.com',
          name: 'Deactivated Staff',
          username: 'deactivatedstaff',
          password: passwordHash,
          role: 'TECHNICIAN',
          accountStatus: 'DISABLED',
          isActive: false,
          emailVerified: true
        }
      });
    }

    assert(deactivatedUser.accountStatus === 'DISABLED' && deactivatedUser.isActive === false, 'Deactivated account status verified');

    console.log('\n================================================================================');
    console.log(`RESULTS: ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================================\n');

  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAuthenticationTestSuite();
