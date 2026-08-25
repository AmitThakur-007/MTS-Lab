import { PrismaClient } from '@prisma/client';
import { formatTimeAgo, formatShortTimeAgo, formatFullDateTime, parseSafeDate } from '../src/lib/timeUtils';

const prisma = new PrismaClient();

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🧪 MTS LAB — TECHNICIAN REPAIR ALERTS & TIME DISPLAY INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: Relative Time & Safe Date Parser Utilities
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Safe Time Parsing & Relative Formatting Utilities ---");

    const now = Date.now();

    // Just now (< 45s)
    const justNowDate = new Date(now - 15 * 1000);
    assert(formatTimeAgo(justNowDate, now) === 'Just now', 'formatTimeAgo formats < 45s as "Just now"');
    assert(formatShortTimeAgo(justNowDate, now) === 'Just now', 'formatShortTimeAgo formats < 45s as "Just now"');

    // 5 minutes ago
    const fiveMinsAgo = new Date(now - 5 * 60 * 1000);
    assert(formatTimeAgo(fiveMinsAgo, now) === '5 minutes ago', 'formatTimeAgo formats 5 mins as "5 minutes ago"');
    assert(formatShortTimeAgo(fiveMinsAgo, now) === '5m ago', 'formatShortTimeAgo formats 5 mins as "5m ago"');

    // 1 hour ago
    const oneHourAgo = new Date(now - 62 * 60 * 1000);
    assert(formatTimeAgo(oneHourAgo, now) === '1 hour ago', 'formatTimeAgo formats 1 hour as "1 hour ago"');
    assert(formatShortTimeAgo(oneHourAgo, now) === '1h ago', 'formatShortTimeAgo formats 1 hour as "1h ago"');

    // 2 hours ago
    const twoHoursAgo = new Date(now - 125 * 60 * 1000);
    assert(formatTimeAgo(twoHoursAgo, now) === '2 hours ago', 'formatTimeAgo formats 2 hours as "2 hours ago"');
    assert(formatShortTimeAgo(twoHoursAgo, now) === '2h ago', 'formatShortTimeAgo formats 2 hours as "2h ago"');

    // 1 day ago
    const oneDayAgo = new Date(now - 25 * 3600 * 1000);
    assert(formatTimeAgo(oneDayAgo, now) === '1 day ago', 'formatTimeAgo formats 1 day as "1 day ago"');
    assert(formatShortTimeAgo(oneDayAgo, now) === '1d ago', 'formatShortTimeAgo formats 1 day as "1d ago"');

    // Firestore timestamp object format { seconds, nanoseconds }
    const firestoreTimestamp = { seconds: Math.floor((now - 10 * 60 * 1000) / 1000), nanoseconds: 0 };
    assert(formatTimeAgo(firestoreTimestamp, now) === '10 minutes ago', 'Handles Firestore timestamp { seconds, nanoseconds }');

    // Missing / invalid dates
    assert(formatTimeAgo(null, now) === 'N/A', 'formatTimeAgo safely handles null');
    assert(formatTimeAgo(undefined, now) === 'N/A', 'formatTimeAgo safely handles undefined');
    assert(formatTimeAgo('invalid-date', now) === 'N/A', 'formatTimeAgo safely handles invalid string');
    assert(formatShortTimeAgo(null, now) === '', 'formatShortTimeAgo safely handles null with empty fallback');

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Database Schema & Authoritative Timestamp Fields
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Database Schema Fields & Repair Lifecycle ---");

    // Fetch or create a test technician & manager
    let testTech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
    if (!testTech) {
      testTech = await prisma.user.create({
        data: {
          email: 'qa.tech.alert@mtslab.com',
          name: 'QA Alert Technician',
          password: 'hashed-qa-password',
          role: 'TECHNICIAN',
          accountStatus: 'ACTIVE',
          isActive: true
        }
      });
    }

    let testManager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
    if (!testManager) {
      testManager = await prisma.user.create({
        data: {
          email: 'qa.manager.alert@mtslab.com',
          name: 'QA Alert Manager',
          password: 'hashed-qa-password',
          role: 'MANAGER',
          accountStatus: 'ACTIVE',
          isActive: true
        }
      });
    }

    let testCustomer = await prisma.customer.findFirst();
    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          customerId: 'CUST-QA-ALERT',
          name: 'QA Alert Customer',
          phone: '9800001122',
          email: 'qa.cust.alert@gmail.com'
        }
      });
    }

    let testBranch = await prisma.branch.findFirst();
    if (!testBranch) {
      testBranch = await prisma.branch.create({
        data: {
          name: "Kathmandu Central Hub",
          location: "New Road, Kathmandu",
          phone: "+977-01-4220000"
        }
      });
    }

    const testRepairNo = `QA-TEST-ALERT-${Date.now()}`;
    const assignTime = new Date();

    const createdRepair = await prisma.repair.create({
      data: {
        repairNumber: testRepairNo,
        customer: { connect: { id: testCustomer.id } },
        customerName: testCustomer.name,
        customerPhone: testCustomer.phone,
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 15 Pro Max',
        deviceCondition: 'Fair',
        estimatedCost: 15000,
        problemDescription: 'Display black screen after drop, urgent client meeting scheduled.',
        priority: 'URGENT',
        status: 'RECEIVED',
        branch: { connect: { id: testBranch.id } },
        createdBy: { connect: { id: testManager.id } },
        technician: { connect: { id: testTech.id } },
        assignedAt: assignTime,
        assignedById: testManager.id,
        assignedByName: testManager.name,
        priorityUpdatedAt: assignTime,
        managerUpdatedAt: assignTime,
        managerUpdatedBy: testManager.name
      }
    });

    assert(!!createdRepair.id, 'Repair record created successfully');
    assert(createdRepair.priority === 'URGENT', 'Priority set to URGENT');
    assert(createdRepair.assignedAt instanceof Date, 'assignedAt is a valid Date instance');
    assert(createdRepair.assignedById === testManager.id, 'assignedById correctly records manager ID');
    assert(createdRepair.assignedByName === testManager.name, 'assignedByName records manager Name');
    assert(createdRepair.managerUpdatedBy === testManager.name, 'managerUpdatedBy records manager Name');

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Priority Updates & Timestamp Stamping
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing 3-Tier Priority Transition & Timestamps ---");

    const priorityUpdateTime = new Date();
    const updatedRepairPriority = await prisma.repair.update({
      where: { id: createdRepair.id },
      data: {
        priority: 'HIGH',
        priorityUpdatedAt: priorityUpdateTime,
        managerUpdatedAt: priorityUpdateTime,
        managerUpdatedBy: 'Admin QA Lead'
      }
    });

    assert(updatedRepairPriority.priority === 'HIGH', 'Priority transitioned from URGENT to HIGH');
    assert(updatedRepairPriority.priorityUpdatedAt?.getTime() === priorityUpdateTime.getTime(), 'priorityUpdatedAt recorded');
    assert(updatedRepairPriority.managerUpdatedBy === 'Admin QA Lead', 'managerUpdatedBy recorded on priority update');

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Notification Creation with Priority-Aware Content
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Notification Delivery & Priority Types ---");

    const urgentNotification = await prisma.notification.create({
      data: {
        userId: testTech.id,
        title: "🚨 High Priority Repair Alert",
        message: `Repair #${createdRepair.repairNumber} (Apple iPhone 15 Pro Max) priority updated to High Priority by QA Manager. Problem: ${createdRepair.problemDescription}`,
        type: "REPAIR_URGENT",
        repairId: createdRepair.id,
        repairNumber: createdRepair.repairNumber,
        isRead: false
      }
    });

    assert(urgentNotification.type === 'REPAIR_URGENT', 'Notification type is REPAIR_URGENT');
    assert(urgentNotification.isRead === false, 'Notification defaults to unread state');
    assert(urgentNotification.title.includes('High Priority'), 'Notification title reflects High Priority');

    // Mark notification as read
    const readNotif = await prisma.notification.update({
      where: { id: urgentNotification.id },
      data: { isRead: true }
    });
    assert(readNotif.isRead === true, 'Notification read state toggled to true');

    // -------------------------------------------------------------------------
    // TEST SECTION 5: Clean Up
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Cleaning Up Test Artifacts ---");
    await prisma.notification.delete({ where: { id: urgentNotification.id } });
    await prisma.repair.delete({ where: { id: createdRepair.id } });
    console.log("  🧹 Test repair and notification removed cleanly.");

  } catch (err: any) {
    console.error("Test execution failed with error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n================================================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
