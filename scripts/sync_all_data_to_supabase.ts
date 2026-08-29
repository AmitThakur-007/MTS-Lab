import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncTable(tableName: string, data: any[], idField = 'id') {
  if (!data || data.length === 0) {
    console.log(`- ${tableName}: 0 records to sync`);
    return 0;
  }

  // Sanitize dates and objects for Postgres
  const sanitized = data.map((item) => {
    const row: any = {};
    for (const [k, v] of Object.entries(item)) {
      if (v instanceof Date) {
        row[k] = v.toISOString();
      } else if (v === undefined) {
        row[k] = null;
      } else {
        row[k] = v;
      }
    }
    return row;
  });

  const chunkSize = 50;
  let synced = 0;
  for (let i = 0; i < sanitized.length; i += chunkSize) {
    const chunk = sanitized.slice(i, i + chunkSize);
    const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: idField });
    if (error) {
      console.error(`❌ Error syncing chunk to ${tableName}:`, error.message);
    } else {
      synced += chunk.length;
    }
  }

  console.log(`✅ ${tableName}: ${synced}/${data.length} records successfully synced to Supabase`);
  return synced;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 MTS LAB — FULL DATA SYNCHRONIZATION TO SUPABASE');
  console.log('Target Project:', SUPABASE_URL);
  console.log('====================================================\n');

  try {
    // 1. Branches
    const branches = await prisma.branch.findMany();
    await syncTable('Branch', branches);

    // 2. Users
    const users = await prisma.user.findMany();
    await syncTable('User', users);

    // 3. Customers
    const customers = await prisma.customer.findMany();
    await syncTable('Customer', customers);

    // 4. Repairs
    const repairs = await prisma.repair.findMany();
    await syncTable('Repair', repairs);

    // 5. Repair Logs
    const repairLogs = await prisma.repairLog.findMany();
    await syncTable('RepairLog', repairLogs);

    // 6. Technician Notes
    const notes = await prisma.technicianNote.findMany();
    await syncTable('TechnicianNote', notes);

    // 7. Payments
    const payments = await prisma.payment.findMany();
    await syncTable('Payment', payments);

    // 8. Repair Prices
    const repairPrices = await prisma.repairPrice.findMany();
    await syncTable('RepairPrice', repairPrices);

    // 9. Home Slides
    const slides = await prisma.homeSlide.findMany();
    await syncTable('HomeSlide', slides);

    // 10. Battery Warranties
    const warranties = await prisma.batteryWarranty.findMany();
    await syncTable('BatteryWarranty', warranties);

    // 11. Battery Warranty Claims
    const claims = await prisma.batteryWarrantyClaim.findMany();
    await syncTable('BatteryWarrantyClaim', claims);

    // 12. Attendance
    const attendances = await prisma.attendance.findMany();
    await syncTable('Attendance', attendances);

    // 13. Attendance Audit Logs
    const attAudits = await prisma.attendanceAuditLog.findMany();
    await syncTable('AttendanceAuditLog', attAudits);

    // 14. Repair Related Damage
    const damages = await prisma.repairRelatedDamage.findMany();
    await syncTable('RepairRelatedDamage', damages);

    // 15. Repair Related Damage Audits
    const damageAudits = await prisma.repairRelatedDamageAudit.findMany();
    await syncTable('RepairRelatedDamageAudit', damageAudits);

    // 16. Inventory Items
    const items = await prisma.inventoryItem.findMany();
    await syncTable('InventoryItem', items);

    // 17. Inventory Transactions
    const transactions = await prisma.inventoryTransaction.findMany();
    await syncTable('InventoryTransaction', transactions);

    // 18. Notifications
    const notifications = await prisma.notification.findMany();
    await syncTable('Notification', notifications);

    // 19. Audit Logs
    const auditLogs = await prisma.auditLog.findMany();
    await syncTable('AuditLog', auditLogs);

    console.log('\n====================================================');
    console.log('🎉 ALL MTS LAB DATA SYNCHRONIZATION COMPLETED!');
    console.log('====================================================');
  } catch (err: any) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
