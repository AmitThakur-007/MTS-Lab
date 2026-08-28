import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      firebaseUid: true,
      isActive: true,
      accountStatus: true,
      emailVerified: true
    }
  });

  console.log(`Found ${users.length} active staff records in SQLite database:\n`);
  users.forEach((u, i) => {
    console.log(`[${i + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | FirebaseUID: ${u.firebaseUid || 'MISSING'}`);
  });
}

main().finally(() => prisma.$disconnect());
