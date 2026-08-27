const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log("=== MTS LAB DATABASE INVENTORY ===");
  
  const tables = {
    users: await prisma.user.count(),
    branches: await prisma.branch.count(),
    customers: await prisma.customer.count(),
    repairs: await prisma.repair.count(),
    repairLogs: await prisma.repairLog.count(),
    technicianNotes: await prisma.technicianNote.count(),
    payments: await prisma.payment.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    inventoryCategories: await prisma.inventoryCategory.count(),
    inventoryTransactions: await prisma.inventoryTransaction.count(),
    batteryWarranties: await prisma.batteryWarranty.count(),
    batteryWarrantyClaims: await prisma.batteryWarrantyClaim.count(),
    attendances: await prisma.attendance.count(),
    attendanceAuditLogs: await prisma.attendanceAuditLog.count(),
    damageRecords: await prisma.repairRelatedDamage.count(),
    damageAudits: await prisma.repairRelatedDamageAudit.count(),
    repairPrices: await prisma.repairPrice.count(),
    homeSlides: await prisma.homeSlide.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
    accessRequests: await prisma.accessRequest.count(),
    approvedDevices: await prisma.approvedDevice.count(),
    sessions: await prisma.session.count()
  };

  console.table(tables);

  // Full data export to JSON backup
  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      counts: tables
    },
    users: await prisma.user.findMany(),
    branches: await prisma.branch.findMany(),
    customers: await prisma.customer.findMany(),
    repairs: await prisma.repair.findMany(),
    repairLogs: await prisma.repairLog.findMany(),
    technicianNotes: await prisma.technicianNote.findMany(),
    payments: await prisma.payment.findMany(),
    inventoryItems: await prisma.inventoryItem.findMany(),
    inventoryCategories: await prisma.inventoryCategory.findMany(),
    inventoryTransactions: await prisma.inventoryTransaction.findMany(),
    batteryWarranties: await prisma.batteryWarranty.findMany(),
    batteryWarrantyClaims: await prisma.batteryWarrantyClaim.findMany(),
    attendances: await prisma.attendance.findMany(),
    attendanceAuditLogs: await prisma.attendanceAuditLog.findMany(),
    damageRecords: await prisma.repairRelatedDamage.findMany(),
    damageAudits: await prisma.repairRelatedDamageAudit.findMany(),
    repairPrices: await prisma.repairPrice.findMany(),
    homeSlides: await prisma.homeSlide.findMany(),
    notifications: await prisma.notification.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
    accessRequests: await prisma.accessRequest.findMany(),
    approvedDevices: await prisma.approvedDevice.findMany(),
    sessions: await prisma.session.findMany()
  };

  const backupPath = path.join(process.cwd(), 'prisma/sqlite_full_export.json');
  fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2));
  console.log(`\nFull database backup exported to: ${backupPath}`);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Error during inventory:", err);
  process.exit(1);
});
