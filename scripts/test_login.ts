import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      role: true,
      accountStatus: true,
      emailVerified: true,
      isActive: true,
      firebaseUid: true,
      deletedAt: true
    }
  });
  console.log('Total database users:', users.length);
  for (const u of users) {
    console.log(`User: ${u.email} | Role: ${u.role} | Pw format: ${typeof u.password} (len: ${u.password ? u.password.length : 0}) | Verified: ${u.emailVerified} | Status: ${u.accountStatus}`);
  }
}

check().finally(async () => {
  await prisma.$disconnect();
});
