import { PrismaClient } from '@prisma/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function syncAllToFirestore() {
  console.log('================================================================');
  console.log('🔄 MTS LAB — POPULATE & SYNC ALL PRISMA DATA TO CLOUD FIRESTORE');
  console.log('================================================================\n');

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const app = initializeApp(config, 'sync-all-to-firestore-' + Date.now());
  const customDbId = config.firestoreDatabaseId || 'ai-studio-2055fd37-20d3-4977-8216-3cd8cd5f87c9';
  const db = getFirestore(app, customDbId);

  console.log(`Target Firestore Database ID: '${customDbId}'\n`);

  let syncedTotal = 0;

  // 1. Sync Branches
  console.log('🏢 Syncing Branches...');
  const branches = await prisma.branch.findMany();
  for (const b of branches) {
    try {
      await setDoc(doc(db, 'branches', b.id), {
        id: b.id,
        name: b.name,
        location: b.location,
        phone: b.phone || null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString()
      }, { merge: true });
      syncedTotal++;
    } catch (e: any) {
      console.warn(`  ⚠️ Branch ${b.name} notice:`, e.message);
    }
  }
  console.log(`  ✅ Synced ${branches.length} branch(es)`);

  // 2. Sync Users (without sensitive password hashes)
  console.log('👥 Syncing Users...');
  const users = await prisma.user.findMany({ where: { deletedAt: null } });
  for (const u of users) {
    try {
      await setDoc(doc(db, 'users', u.id), {
        id: u.id,
        email: u.email,
        username: u.username || null,
        name: u.name,
        role: u.role,
        accountStatus: u.accountStatus || 'ACTIVE',
        isActive: Boolean(u.isActive),
        emailVerified: Boolean(u.emailVerified),
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        firebaseUid: u.firebaseUid || null,
        phoneNumber: u.phoneNumber || null,
        department: u.department || null,
        address: u.address || null,
        profileImage: u.profileImage || u.profilePhoto || null,
        branchId: u.branchId || null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString()
      }, { merge: true });
      syncedTotal++;
    } catch (e: any) {
      console.warn(`  ⚠️ User ${u.email} notice:`, e.message);
    }
  }
  console.log(`  ✅ Synced ${users.length} user(s)`);

  // 3. Sync Repair Prices
  console.log('🏷️ Syncing Repair Prices...');
  const repairPrices = await prisma.repairPrice.findMany();
  for (const rp of repairPrices) {
    try {
      await setDoc(doc(db, 'repairPrices', rp.id), {
        id: rp.id,
        brand: rp.brand,
        model: rp.model,
        category: rp.category,
        serviceName: rp.serviceName,
        price: Number(rp.price),
        status: rp.status || 'ACTIVE',
        createdAt: rp.createdAt.toISOString(),
        updatedAt: rp.updatedAt.toISOString()
      }, { merge: true });
      syncedTotal++;
    } catch (e: any) {
      console.warn(`  ⚠️ RepairPrice notice:`, e.message);
    }
  }
  console.log(`  ✅ Synced ${repairPrices.length} repair price(s)`);

  // 4. Sync Home Slides
  console.log('🖼️ Syncing Home Slides...');
  const homeSlides = await prisma.homeSlide.findMany();
  for (const s of homeSlides) {
    try {
      await setDoc(doc(db, 'homeSlides', s.id), {
        id: s.id,
        title: s.title,
        description: s.description || null,
        imageUrl: s.imageUrl,
        buttonText: s.buttonText || null,
        buttonLink: s.buttonLink || null,
        displayOrder: Number(s.displayOrder || 0),
        status: s.status || 'ACTIVE',
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString()
      }, { merge: true });
      syncedTotal++;
    } catch (e: any) {
      console.warn(`  ⚠️ HomeSlide notice:`, e.message);
    }
  }
  console.log(`  ✅ Synced ${homeSlides.length} home slide(s)`);

  // 6. Sync Customers
  console.log('🤝 Syncing Customers...');
  const customers = await prisma.customer.findMany();
  for (const c of customers) {
    try {
      await setDoc(doc(db, 'customers', c.id), {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || null,
        address: c.address || null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      }, { merge: true });
      syncedTotal++;
    } catch (e: any) {
      console.warn(`  ⚠️ Customer notice:`, e.message);
    }
  }
  console.log(`  ✅ Synced ${customers.length} customer(s)`);

  // 7. Sync Repairs
  console.log('🔧 Syncing Repairs...');
  const repairs = await prisma.repair.findMany({ take: 200 });
  for (const r of repairs) {
    try {
      await setDoc(doc(db, 'repairs', r.id), {
        id: r.id,
        repairNumber: r.repairNumber,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerEmail: r.customerEmail || null,
        deviceBrand: r.deviceBrand,
        deviceModel: r.deviceModel,
        status: r.status,
        estimatedCost: Number(r.estimatedCost || 0),
        advancePaid: Number(r.advancePaid || 0),
        totalPaid: Number(r.totalPaid || 0),
        paymentStatus: r.paymentStatus || 'UNPAID',
        technicianId: r.technicianId || null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }, { merge: true });
      syncedTotal++;
    } catch (e: any) {
      console.warn(`  ⚠️ Repair notice:`, e.message);
    }
  }
  console.log(`  ✅ Synced ${repairs.length} repair order(s)`);

  console.log('\n================================================================');
  console.log(`🎉 ALL DONE! Total ${syncedTotal} document(s) populated into Cloud Firestore!`);
  console.log('================================================================');
}

syncAllToFirestore()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
