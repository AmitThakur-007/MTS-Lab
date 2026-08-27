import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkSuperAdmin() {
  console.log("Checking Super Admin users in database...\n");
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'SUPER_ADMIN' },
        { role: 'SUPERADMIN' },
        { email: 'mtsmobilelab@gmail.com' }
      ]
    }
  });

  if (users.length === 0) {
    console.log("No Super Admin found in DB.");
  } else {
    for (const u of users) {
      console.log(`User ID: ${u.id}`);
      console.log(`Email: ${u.email}`);
      console.log(`Username: ${u.username}`);
      console.log(`Name: ${u.name}`);
      console.log(`Role: ${u.role}`);
      console.log(`Status: ${u.accountStatus} (Active: ${u.isActive})`);
      console.log(`Email Verified: ${u.emailVerified}`);
      
      const isMtsLab2026 = await bcrypt.compare('MtsLab@2026', u.password);
      const isAdmin123 = await bcrypt.compare('admin123', u.password);
      const isPassword123 = await bcrypt.compare('Password123!', u.password);
      
      console.log(`Password matches 'MtsLab@2026': ${isMtsLab2026}`);
      console.log(`Password matches 'admin123': ${isAdmin123}`);
      console.log(`Password matches 'Password123!': ${isPassword123}`);
      console.log("--------------------------------------------------");
    }
  }
  await prisma.$disconnect();
}

checkSuperAdmin();
