import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "mts-lab-super-secret-key";
const BASE_URL = "http://localhost:3000";

function createToken(user: any) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log("===================================================================");
  console.log("STARTING MTS LAB URGENT REPAIR REAL-TIME SYNC & NOTIFICATION AUDIT");
  console.log("===================================================================");

  // Setup Test Branch & Users
  let branch = await prisma.branch.findFirst({ where: { name: "Test Urgent Branch" } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: "Test Urgent Branch", location: "Kathmandu", phone: "+977-9800000000" }
    });
  }

  const hashedPassword = await bcrypt.hash("Password123!", 10);

  // Clean old fixtures if any
  const oldTestRepairs = await prisma.repair.findMany({ where: { repairNumber: { startsWith: "URG-TEST-" } }, select: { id: true } });
  const oldIds = oldTestRepairs.map(r => r.id);
  if (oldIds.length > 0) {
    await prisma.repairLog.deleteMany({ where: { repairId: { in: oldIds } } });
    await prisma.technicianNote.deleteMany({ where: { repairId: { in: oldIds } } });
    await prisma.payment.deleteMany({ where: { repairId: { in: oldIds } } });
    await prisma.repair.deleteMany({ where: { id: { in: oldIds } } });
  }
  await prisma.notification.deleteMany({ where: { title: { contains: "URGENT" } } });
  await prisma.user.deleteMany({ where: { email: { in: [
    "urgent_mgr@mtslab.com", 
    "urgent_tech_a@mtslab.com", 
    "urgent_tech_b@mtslab.com",
    "urgent_cust@mtslab.com"
  ] } } });

  const managerUser = await prisma.user.create({
    data: {
      email: "urgent_mgr@mtslab.com",
      password: hashedPassword,
      name: "Manager Birendra",
      role: "MANAGER",
      branchId: branch.id,
      accountStatus: "ACTIVE",
      isActive: true,
      emailVerified: true
    }
  });

  const techA = await prisma.user.create({
    data: {
      email: "urgent_tech_a@mtslab.com",
      password: hashedPassword,
      name: "Technician Arjun",
      role: "TECHNICIAN",
      branchId: branch.id,
      accountStatus: "ACTIVE",
      isActive: true,
      emailVerified: true
    }
  });

  const techB = await prisma.user.create({
    data: {
      email: "urgent_tech_b@mtslab.com",
      password: hashedPassword,
      name: "Technician Bikram",
      role: "TECHNICIAN",
      branchId: branch.id,
      accountStatus: "ACTIVE",
      isActive: true,
      emailVerified: true
    }
  });

  const customerUser = await prisma.user.create({
    data: {
      email: "urgent_cust@mtslab.com",
      password: hashedPassword,
      name: "Customer Ramesh",
      role: "CUSTOMER",
      accountStatus: "ACTIVE",
      isActive: true,
      emailVerified: true
    }
  });

  const managerToken = createToken(managerUser);
  const techAToken = createToken(techA);
  const techBToken = createToken(techB);
  const customerToken = createToken(customerUser);

  console.log("✓ Fixtures initialized (Manager, Tech A, Tech B, Customer)");

  // -------------------------------------------------------------
  // TEST GROUP 1: CREATE REPAIR & MANAGER MARKS AS URGENT
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 1] MANAGER MARKS REPAIR AS URGENT ---");

  const repair1 = await prisma.repair.create({
    data: {
      repairNumber: "URG-TEST-1001",
      customerName: "Sita Sharma",
      customerPhone: "9841112233",
      deviceBrand: "Apple",
      deviceModel: "iPhone 15 Pro",
      deviceCondition: "Good",
      problemDescription: "Screen flickering and touch unresponsive",
      estimatedCost: 15000,
      status: "IN_PROCESS",
      priority: "NORMAL",
      branchId: branch.id,
      createdById: managerUser.id,
      technicianId: techA.id
    }
  });

  const markUrgentRes = await fetch(`${BASE_URL}/api/repairs/${repair1.id}/priority`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${managerToken}`
    },
    body: JSON.stringify({ priority: "URGENT" })
  });

  assert(markUrgentRes.status === 200, "1.1 PATCH /api/repairs/:id/priority with URGENT returns HTTP 200");
  const markUrgentData: any = await markUrgentRes.json();
  assert(markUrgentData.success === true && markUrgentData.repair.priority === "URGENT", "1.2 Returned repair object has priority: URGENT");

  // Verify Database State
  const dbRepair1 = await prisma.repair.findUnique({ where: { id: repair1.id } });
  assert(dbRepair1?.priority === "URGENT", "1.3 Database persistence confirmed: repair.priority is authoritative URGENT");

  // Verify RepairLog was created
  const logs1 = await prisma.repairLog.findMany({ where: { repairId: repair1.id } });
  assert(logs1.some(l => l.message.includes("Priority changed to URGENT")), "1.4 RepairLog trail recorded priority update");

  // Verify Targeted Notification Created for Assigned Technician (Tech A)
  const notifsTechA = await prisma.notification.findMany({
    where: { userId: techA.id, repairId: repair1.id }
  });
  assert(notifsTechA.length > 0, "1.5 Assigned Technician A received notification for URGENT mark");
  assert(notifsTechA[0].type === "REPAIR_URGENT", "1.6 Notification type is REPAIR_URGENT");
  assert(notifsTechA[0].title.includes("URGENT"), "1.7 Notification title highlights URGENT alert");

  // Verify Unrelated Technician (Tech B) did NOT receive the alert
  const notifsTechB = await prisma.notification.findMany({
    where: { userId: techB.id, repairId: repair1.id }
  });
  assert(notifsTechB.length === 0, "1.8 Unrelated Technician B did NOT receive unauthorized notification");

  // -------------------------------------------------------------
  // TEST GROUP 2: MANAGER REMOVES URGENT (SETS TO NORMAL)
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 2] MANAGER REMOVES URGENT STATUS (NORMAL) ---");

  const removeUrgentRes = await fetch(`${BASE_URL}/api/repairs/${repair1.id}/priority`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${managerToken}`
    },
    body: JSON.stringify({ priority: "NORMAL" })
  });

  assert(removeUrgentRes.status === 200, "2.1 PATCH /api/repairs/:id/priority with NORMAL returns HTTP 200");
  const removeUrgentData: any = await removeUrgentRes.json();
  assert(removeUrgentData.repair.priority === "NORMAL", "2.2 Returned repair object has priority: NORMAL");

  const dbRepair1Normal = await prisma.repair.findUnique({ where: { id: repair1.id } });
  assert(dbRepair1Normal?.priority === "NORMAL", "2.3 Database state confirmed: repair.priority is back to NORMAL");

  // -------------------------------------------------------------
  // TEST GROUP 3: ASSIGNING AN URGENT REPAIR
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 3] ASSIGNING URGENT REPAIR NOTIFIES NEW TECH AS URGENT ---");

  const repair2 = await prisma.repair.create({
    data: {
      repairNumber: "URG-TEST-1002",
      customerName: "Hari Bahadur",
      customerPhone: "9842223344",
      deviceBrand: "Samsung",
      deviceModel: "Galaxy S24 Ultra",
      deviceCondition: "Excellent",
      problemDescription: "No power, charging port shorted",
      estimatedCost: 8000,
      status: "RECEIVED",
      priority: "URGENT",
      branchId: branch.id,
      createdById: managerUser.id,
      technicianId: null
    }
  });

  const assignRes = await fetch(`${BASE_URL}/api/repairs/${repair2.id}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${managerToken}`
    },
    body: JSON.stringify({ technicianId: techB.id })
  });

  assert(assignRes.status === 200, "3.1 POST /api/repairs/:id/assign returns HTTP 200");
  const assignData: any = await assignRes.json();
  assert(assignData.technicianId === techB.id, "3.2 Technician B assigned to repair");

  const notifsAssignTechB = await prisma.notification.findMany({
    where: { userId: techB.id, repairId: repair2.id }
  });
  assert(notifsAssignTechB.length > 0, "3.3 Newly assigned Technician B received notification");
  assert(notifsAssignTechB[0].type === "REPAIR_URGENT", "3.4 Notification type reflects assigned repair is URGENT");
  assert(notifsAssignTechB[0].title.includes("Urgent Repair Assigned"), "3.5 Notification title clearly warns Urgent Repair Assigned");

  // -------------------------------------------------------------
  // TEST GROUP 4: CREATE REPAIR VIA API WITH PRIORITY URGENT
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 4] CREATE REPAIR WITH URGENT PRIORITY ---");

  const createUrgentRes = await fetch(`${BASE_URL}/api/repairs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${managerToken}`
    },
    body: JSON.stringify({
      customerName: "Kopila Adhikari",
      customerPhone: "9851122334",
      deviceBrand: "OnePlus",
      deviceModel: "12",
      deviceCondition: "New",
      problemDescription: "Urgent motherboard diagnostic",
      estimatedCost: 12000,
      priority: "URGENT",
      technicianId: techA.id
    })
  });

  assert(createUrgentRes.status === 200 || createUrgentRes.status === 201, "4.1 POST /api/repairs with URGENT returns HTTP 200/201");
  const createUrgentData: any = await createUrgentRes.json();
  assert(createUrgentData.priority === "URGENT", "4.2 Created repair has priority: URGENT");

  const notifsCreateTechA = await prisma.notification.findMany({
    where: { userId: techA.id, repairId: createUrgentData.id }
  });
  assert(notifsCreateTechA.length > 0, "4.3 Technician A received immediate intake alert for URGENT job");
  assert(notifsCreateTechA[0].type === "REPAIR_URGENT", "4.4 Intake notification type is REPAIR_URGENT");

  // -------------------------------------------------------------
  // TEST GROUP 5: RBAC SECURITY VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 5] RBAC SECURITY VERIFICATION ---");

  // Technician cannot update priority
  const techAttemptRes = await fetch(`${BASE_URL}/api/repairs/${repair1.id}/priority`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${techAToken}`
    },
    body: JSON.stringify({ priority: "URGENT" })
  });
  assert(techAttemptRes.status === 403, "5.1 Technician blocked from modifying repair priority (HTTP 403 Forbidden)");

  // Customer cannot update priority
  const custAttemptRes = await fetch(`${BASE_URL}/api/repairs/${repair1.id}/priority`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ priority: "URGENT" })
  });
  assert(custAttemptRes.status === 403, "5.2 Customer blocked from modifying repair priority (HTTP 403 Forbidden)");

  // Unauthenticated cannot update priority
  const unauthAttemptRes = await fetch(`${BASE_URL}/api/repairs/${repair1.id}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority: "URGENT" })
  });
  assert(unauthAttemptRes.status === 401, "5.3 Unauthenticated request rejected (HTTP 401 Unauthorized)");

  // Invalid priority value rejected
  const invalidValRes = await fetch(`${BASE_URL}/api/repairs/${repair1.id}/priority`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${managerToken}`
    },
    body: JSON.stringify({ priority: "SUPER_URGENT_INVALID" })
  });
  assert(invalidValRes.status === 400, "5.4 Invalid priority string rejected with HTTP 400");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  console.log("\n--- CLEANUP ---");
  await prisma.notification.deleteMany({ where: { userId: { in: [techA.id, techB.id, managerUser.id] } } });
  await prisma.repairLog.deleteMany({ where: { repairId: { in: [repair1.id, repair2.id, createUrgentData.id] } } });
  await prisma.technicianNote.deleteMany({ where: { repairId: { in: [repair1.id, repair2.id, createUrgentData.id] } } });
  await prisma.payment.deleteMany({ where: { repairId: { in: [repair1.id, repair2.id, createUrgentData.id] } } });
  await prisma.repair.deleteMany({ where: { id: { in: [repair1.id, repair2.id, createUrgentData.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [managerUser.id, techA.id, techB.id, customerUser.id] } } });
  console.log("✓ Test records and users safely cleaned up");

  console.log("\n===================================================================");
  console.log("ALL URGENT REPAIR REAL-TIME SYNC & NOTIFICATION AUDIT TESTS PASSED!");
  console.log("===================================================================");
}

runTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
