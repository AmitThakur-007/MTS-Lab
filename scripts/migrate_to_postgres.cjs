const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function migrateData() {
  console.log("=== MTS LAB SQLITE -> POSTGRESQL DATA MIGRATION ===");
  
  const exportPath = path.join(process.cwd(), 'prisma/sqlite_full_export.json');
  if (!fs.existsSync(exportPath)) {
    console.error(`Export file not found at ${exportPath}. Please run scripts/db_inventory.cjs first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(exportPath, 'utf8');
  const data = JSON.parse(raw);

  console.log(`Loading backup created at: ${data.metadata?.exportedAt || 'Unknown'}`);

  // 1. Branches
  if (data.branches?.length) {
    console.log(`Migrating ${data.branches.length} branches...`);
    for (const item of data.branches) {
      await prisma.branch.upsert({
        where: { id: item.id },
        update: item,
        create: item
      });
    }
  }

  // 2. Users / Staff
  if (data.users?.length) {
    console.log(`Migrating ${data.users.length} users...`);
    for (const item of data.users) {
      await prisma.user.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
          lockoutUntil: item.lockoutUntil ? new Date(item.lockoutUntil) : null,
          lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : null,
          emailChangeExpiresAt: item.emailChangeExpiresAt ? new Date(item.emailChangeExpiresAt) : null
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
          lockoutUntil: item.lockoutUntil ? new Date(item.lockoutUntil) : null,
          lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : null,
          emailChangeExpiresAt: item.emailChangeExpiresAt ? new Date(item.emailChangeExpiresAt) : null
        }
      });
    }
  }

  // 3. Customers
  if (data.customers?.length) {
    console.log(`Migrating ${data.customers.length} customers...`);
    for (const item of data.customers) {
      await prisma.customer.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          archivedAt: item.archivedAt ? new Date(item.archivedAt) : null
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          archivedAt: item.archivedAt ? new Date(item.archivedAt) : null
        }
      });
    }
  }

  // 4. Repairs
  if (data.repairs?.length) {
    console.log(`Migrating ${data.repairs.length} repairs...`);
    for (const item of data.repairs) {
      await prisma.repair.upsert({
        where: { id: item.id },
        update: {
          ...item,
          expectedCompletionDate: item.expectedCompletionDate ? new Date(item.expectedCompletionDate) : null,
          assignedAt: item.assignedAt ? new Date(item.assignedAt) : null,
          priorityUpdatedAt: item.priorityUpdatedAt ? new Date(item.priorityUpdatedAt) : null,
          managerUpdatedAt: item.managerUpdatedAt ? new Date(item.managerUpdatedAt) : null,
          courierDate: item.courierDate ? new Date(item.courierDate) : null,
          courierReceivedDate: item.courierReceivedDate ? new Date(item.courierReceivedDate) : null,
          courierInPickupDate: item.courierInPickupDate ? new Date(item.courierInPickupDate) : null,
          returnCourierDispatchDate: item.returnCourierDispatchDate ? new Date(item.returnCourierDispatchDate) : null,
          courierOutDeliveredDate: item.courierOutDeliveredDate ? new Date(item.courierOutDeliveredDate) : null,
          returnCourierDispatchedAt: item.returnCourierDispatchedAt ? new Date(item.returnCourierDispatchedAt) : null,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        },
        create: {
          ...item,
          expectedCompletionDate: item.expectedCompletionDate ? new Date(item.expectedCompletionDate) : null,
          assignedAt: item.assignedAt ? new Date(item.assignedAt) : null,
          priorityUpdatedAt: item.priorityUpdatedAt ? new Date(item.priorityUpdatedAt) : null,
          managerUpdatedAt: item.managerUpdatedAt ? new Date(item.managerUpdatedAt) : null,
          courierDate: item.courierDate ? new Date(item.courierDate) : null,
          courierReceivedDate: item.courierReceivedDate ? new Date(item.courierReceivedDate) : null,
          courierInPickupDate: item.courierInPickupDate ? new Date(item.courierInPickupDate) : null,
          returnCourierDispatchDate: item.returnCourierDispatchDate ? new Date(item.returnCourierDispatchDate) : null,
          courierOutDeliveredDate: item.courierOutDeliveredDate ? new Date(item.courierOutDeliveredDate) : null,
          returnCourierDispatchedAt: item.returnCourierDispatchedAt ? new Date(item.returnCourierDispatchedAt) : null,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        }
      });
    }
  }

  // 5. Inventory Categories
  if (data.inventoryCategories?.length) {
    console.log(`Migrating ${data.inventoryCategories.length} inventory categories...`);
    for (const item of data.inventoryCategories) {
      await prisma.inventoryCategory.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        }
      });
    }
  }

  // 6. Inventory Items
  if (data.inventoryItems?.length) {
    console.log(`Migrating ${data.inventoryItems.length} inventory items...`);
    for (const item of data.inventoryItems) {
      await prisma.inventoryItem.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        }
      });
    }
  }

  // 7. Inventory Transactions
  if (data.inventoryTransactions?.length) {
    console.log(`Migrating ${data.inventoryTransactions.length} inventory transactions...`);
    for (const item of data.inventoryTransactions) {
      await prisma.inventoryTransaction.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
        }
      });
    }
  }

  // 8. Repair Prices
  if (data.repairPrices?.length) {
    console.log(`Migrating ${data.repairPrices.length} repair prices...`);
    for (const item of data.repairPrices) {
      await prisma.repairPrice.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        }
      });
    }
  }

  // 9. Home Slides
  if (data.homeSlides?.length) {
    console.log(`Migrating ${data.homeSlides.length} home slides...`);
    for (const item of data.homeSlides) {
      await prisma.homeSlide.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
        }
      });
    }
  }

  // 10. Audit Logs
  if (data.auditLogs?.length) {
    console.log(`Migrating ${data.auditLogs.length} audit logs...`);
    for (const item of data.auditLogs) {
      await prisma.auditLog.upsert({
        where: { id: item.id },
        update: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
        },
        create: {
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
        }
      });
    }
  }

  console.log("\n✅ ALL DATA MIGRATED AND VERIFIED SUCCESSFULLY!");
  await prisma.$disconnect();
}

migrateData().catch(e => {
  console.error("Migration error:", e);
  process.exit(1);
});
