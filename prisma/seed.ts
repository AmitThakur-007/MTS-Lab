import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // Check if the database has already been seeded or contains users
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('[SEED] Database already contains users. Skipping seeding to prevent data loss.');
    return;
  }

  // Clear existing data (only if the database is completely empty)
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.technicianNote.deleteMany();
  await prisma.repairLog.deleteMany();
  await prisma.repair.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  // Create Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'MTS Lab Main Branch',
      location: 'Downtown Tech Plaza',
      phone: '+1 234 567 890',
    },
  });

  // Create Users
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.create({
    data: {
      email: 'admin@mtslab.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      branchId: branch.id,
    },
  });

  const techPassword = await bcrypt.hash('tech123', 10);
  const tech = await prisma.user.create({
    data: {
      email: 'tech@mtslab.com',
      password: techPassword,
      name: 'John Technician',
      role: 'TECHNICIAN',
      branchId: branch.id,
    },
  });

  const receptionistPassword = await bcrypt.hash('recep123', 10);
  const recep = await prisma.user.create({
    data: {
      email: 'recep@mtslab.com',
      password: receptionistPassword,
      name: 'Sarah Reception',
      role: 'RECEPTIONIST',
      branchId: branch.id,
    },
  });

  // Create Repair
  const repair = await prisma.repair.create({
    data: {
      repairNumber: 'MTS-10001',
      customerName: 'Aman Gupta',
      customerPhone: '9876543210',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      deviceCondition: 'Cracked screen, no other marks',
      problemDescription: 'Display replacement and general checkup',
      estimatedCost: 250,
      advancePaid: 50,
      paymentStatus: 'PARTIAL',
      status: 'IN_PROCESS',
      branchId: branch.id,
      createdById: recep.id,
      technicianId: tech.id,
    },
  });

  await prisma.repairLog.create({
    data: {
      repairId: repair.id,
      status: 'PENDING',
      message: 'Repair registered at front desk',
    },
  });

  await prisma.repairLog.create({
    data: {
      repairId: repair.id,
      status: 'IN_PROCESS',
      message: 'Initial diagnostics complete, screen replacement started',
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
