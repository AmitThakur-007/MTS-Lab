import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("TESTING MTS LAB ADVANCED TECHNICIAN DASHBOARD WORKFLOW");
  console.log("==================================================");

  // 1. Fetch or create test technician users
  let techA = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
  if (!techA) {
    console.log("No technician found, creating Tech A...");
    techA = await prisma.user.create({
      data: {
        name: "Specialist Alpha",
        email: "tech.alpha@mtslab.local",
        username: "techalpha",
        password: "$2a$10$hashedpasswordforlocaltestonly12345",
        role: "TECHNICIAN",
        isActive: true,
        accountStatus: "APPROVED"
      }
    });
  }

  let techB = await prisma.user.findFirst({ 
    where: { 
      role: 'TECHNICIAN',
      id: { not: techA.id }
    } 
  });
  if (!techB) {
    console.log("Creating Tech B for transfer tests...");
    techB = await prisma.user.create({
      data: {
        name: "Specialist Beta",
        email: "tech.beta@mtslab.local",
        username: "techbeta",
        password: "$2a$10$hashedpasswordforlocaltestonly12345",
        role: "TECHNICIAN",
        isActive: true,
        accountStatus: "APPROVED"
      }
    });
  }

  console.log(`✓ Tech A: ${techA.name} (${techA.id})`);
  console.log(`✓ Tech B: ${techB.name} (${techB.id})`);

  // 2. Fetch or create a test repair assigned to Tech A
  let testRepair = await prisma.repair.findFirst({
    where: { technicianId: techA.id }
  });

  if (!testRepair) {
    let customer = await prisma.customer.findFirst();
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          customerId: "CUS-TEST-001",
          name: "Test Customer",
          phone: "9800000000"
        }
      });
    }
    const branch = await prisma.branch.findFirst() || await prisma.branch.create({ data: { name: "Main Branch", location: "Kathmandu", phone: "9800000000" } });
    const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } }) || techA;

    testRepair = await prisma.repair.create({
      data: {
        repairNumber: `MTS-TEST-${Date.now().toString().slice(-4)}`,
        customerName: "Test Customer",
        customerPhone: "9800000000",
        deviceBrand: "Apple",
        deviceModel: "iPhone 15 Pro",
        problemDescription: "No display after water splash, motherboard diagnostic required",
        deviceCondition: "Scratched frame, intact glass",
        status: "IN_PROCESS",
        technicianId: techA.id,
        branchId: branch.id,
        createdById: admin.id,
        estimatedCost: 1500
      }
    });
    console.log(`✓ Created test repair #${testRepair.repairNumber} assigned to Tech A`);
  } else {
    console.log(`✓ Using existing repair #${testRepair.repairNumber} assigned to Tech A`);
  }

  // 3. Test Priority Alert Creation
  console.log("\n--- Testing Priority Alert ---");
  const alertNotif = await prisma.notification.create({
    data: {
      userId: techA.id,
      title: "🚨 URGENT Repair Alert",
      message: `[Job #${testRepair.repairNumber}] Customer is waiting at counter. Expedite PMIC diagnostic. (from Receptionist)`,
      type: "REPAIR_ALERT",
      repairId: testRepair.id,
      repairNumber: testRepair.repairNumber,
      senderName: "Reception Desk",
      isRead: false
    }
  });
  console.log(`✓ Alert Notification created: ID=${alertNotif.id}, Type=${alertNotif.type}`);

  // 4. Test Multi-Role Note Creation
  console.log("\n--- Testing Communication Notes ---");
  const testNote = await prisma.technicianNote.create({
    data: {
      repairId: testRepair.id,
      technicianId: techA.id,
      authorName: techA.name,
      authorRole: techA.role,
      note: "Ultrasonic cleaning completed. PMIC rail 1.8V verified normal.",
      isInternal: true
    }
  });
  console.log(`✓ Communication note created: ID=${testNote.id}, Author=${testNote.authorName}`);

  // 5. Test Technician-to-Technician Transfer Workflow
  console.log("\n--- Testing Transfer Request Workflow ---");
  const transferReq = await prisma.repairTransferRequest.create({
    data: {
      repairId: testRepair.id,
      repairNumber: testRepair.repairNumber,
      senderTechnicianId: techA.id,
      senderTechnicianName: techA.name,
      targetTechnicianId: techB.id,
      targetTechnicianName: techB.name,
      reason: "Needs Specialist Beta's ultrasonic microscope setup for CPU reballing.",
      status: "PENDING"
    }
  });
  console.log(`✓ Transfer request created: ID=${transferReq.id}, Status=${transferReq.status}`);

  // Test Accept Transfer Action (Atomic Transaction)
  const [updatedTransfer, reassignedRepair] = await prisma.$transaction(async (tx) => {
    const trans = await tx.repairTransferRequest.update({
      where: { id: transferReq.id },
      data: {
        status: "ACCEPTED",
        respondedAt: new Date(),
        responseNote: "Accepted. Microscope workstation ready."
      }
    });

    const rep = await tx.repair.update({
      where: { id: testRepair.id },
      data: {
        technicianId: techB.id
      }
    });

    return [trans, rep];
  });

  console.log(`✓ Transfer ACCEPTED: Status=${updatedTransfer.status}`);
  console.log(`✓ Repair #${reassignedRepair.repairNumber} successfully reassigned to Tech B (${reassignedRepair.technicianId} === ${techB.id})`);

  if (reassignedRepair.technicianId === techB.id) {
    console.log("🎉 ALL TECHNICIAN DASHBOARD BACKEND WORKFLOW TESTS PASSED!");
  } else {
    throw new Error("Repair technicianId was not updated properly upon transfer accept!");
  }
}

main()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
