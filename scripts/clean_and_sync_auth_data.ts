import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[DATA CLEANUP] Starting MTS Lab user database normalization...');

  const users = await prisma.user.findMany();
  console.log(`[DATA CLEANUP] Found ${users.length} total user records in database.`);

  let updatedCount = 0;

  for (const user of users) {
    let newRole = user.role;
    let newAccountStatus = user.accountStatus || 'ACTIVE';

    // 1. Normalize role strings
    const rawRole = (user.role || '').toUpperCase().trim();
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'OWNER' || rawRole === 'DIRECTOR') {
      newRole = 'SUPERADMIN';
    } else if (rawRole === 'ADMIN') {
      newRole = 'ADMIN';
    } else if (rawRole === 'MANAGER') {
      newRole = 'MANAGER';
    } else if (rawRole === 'HEAD_TECHNICIAN' || rawRole === 'LEAD_TECHNICIAN' || rawRole === 'CHIEF_TECHNICIAN') {
      newRole = 'HEAD_TECHNICIAN';
    } else if (rawRole === 'TECHNICIAN' || rawRole === 'TECHNICAL_ASSISTANT' || rawRole === 'STAFF') {
      newRole = 'TECHNICIAN';
    } else if (rawRole === 'RECEPTIONIST' || rawRole === 'FRONT_DESK') {
      newRole = 'RECEPTIONIST';
    }

    // 2. Fix test account status if named deactivated
    if (user.email === 'deactivated.staff@mtslab.com') {
      newAccountStatus = 'DISABLED';
    }

    if (newRole !== user.role || newAccountStatus !== user.accountStatus) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: newRole,
          accountStatus: newAccountStatus,
        }
      });
      console.log(`[DATA CLEANUP] Updated ${user.email}: role='${newRole}', status='${newAccountStatus}'`);
      updatedCount++;
    }
  }

  console.log(`[DATA CLEANUP] Completed! Updated ${updatedCount} user records.`);
}

main()
  .catch((e) => {
    console.error('[DATA CLEANUP ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
