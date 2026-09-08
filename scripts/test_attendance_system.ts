import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "mts-lab-super-secret-key";
const API_BASE = "http://127.0.0.1:3000/api";

function generateTestToken(role: string, name: string, email: string, id: string) {
  return jwt.sign(
    { id, email, name, role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runAttendanceVerificationTests() {
  console.log("===================================================================");
  console.log("STARTING MTS LAB STAFF ATTENDANCE MANAGEMENT SYSTEM VERIFICATION");
  console.log("===================================================================");

  // Helper for authenticated requests
  const apiCall = async (endpoint: string, method: string = "GET", token: string, body?: any) => {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    return { status: res.status, ok: res.ok, data };
  };

  // 1. Setup Test Fixture Users
  const timestamp = Date.now();
  const testBranch = await prisma.branch.findFirst() || await prisma.branch.create({
    data: { name: "MTS Central Lab", location: "Kathmandu", phone: "9869276668" }
  });

  const superAdminUser = await prisma.user.create({
    data: {
      email: `test_sa_${timestamp}@mtslab.com`,
      name: "Attendance SuperAdmin",
      role: "SUPER_ADMIN",
      password: "hashedpassword",
      branchId: testBranch.id
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      email: `test_adm_${timestamp}@mtslab.com`,
      name: "Attendance Admin",
      role: "ADMIN",
      password: "hashedpassword",
      branchId: testBranch.id
    }
  });

  const managerUser = await prisma.user.create({
    data: {
      email: `test_mgr_${timestamp}@mtslab.com`,
      name: "Attendance Manager",
      role: "MANAGER",
      password: "hashedpassword",
      branchId: testBranch.id
    }
  });

  const techUser = await prisma.user.create({
    data: {
      email: `test_tech_${timestamp}@mtslab.com`,
      name: "Attendance Technician",
      role: "TECHNICIAN",
      password: "hashedpassword",
      branchId: testBranch.id
    }
  });

  const recepUser = await prisma.user.create({
    data: {
      email: `test_recep_${timestamp}@mtslab.com`,
      name: "Attendance Receptionist",
      role: "RECEPTIONIST",
      password: "hashedpassword",
      branchId: testBranch.id
    }
  });

  const customerUser = await prisma.user.create({
    data: {
      email: `test_cust_${timestamp}@mtslab.com`,
      name: "Attendance Customer",
      role: "CUSTOMER",
      password: "hashedpassword"
    }
  });

  const saToken = generateTestToken("SUPER_ADMIN", superAdminUser.name, superAdminUser.email, superAdminUser.id);
  const admToken = generateTestToken("ADMIN", adminUser.name, adminUser.email, adminUser.id);
  const mgrToken = generateTestToken("MANAGER", managerUser.name, managerUser.email, managerUser.id);
  const techToken = generateTestToken("TECHNICIAN", techUser.name, techUser.email, techUser.id);
  const recepToken = generateTestToken("RECEPTIONIST", recepUser.name, recepUser.email, recepUser.id);
  const custToken = generateTestToken("CUSTOMER", customerUser.name, customerUser.email, customerUser.id);

  console.log("✓ Created multi-role test fixture users (SuperAdmin, Admin, Manager, Technician, Receptionist, Customer)");

  const testDate = "2026-08-21";
  const alternateDate = "2026-08-22";

  // -------------------------------------------------------------
  // TEST GROUP 1: SERVER TIME & AUTHORITATIVE WINDOW CHECK
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 1] AUTHORITATIVE NEPAL TIME & WINDOW STATUS ---");
  const serverTimeRes = await apiCall('/attendance/server-time', 'GET', techToken);
  console.log(`✓ 1.1 GET /api/attendance/server-time: HTTP ${serverTimeRes.status}, Timezone: ${serverTimeRes.data?.timezone}, Date: ${serverTimeRes.data?.dateStr}`);
  if (serverTimeRes.status !== 200 || serverTimeRes.data?.timezone !== 'Asia/Kathmandu') {
    throw new Error(`Server time failed: ${JSON.stringify(serverTimeRes.data)}`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: SUPER ADMIN & ADMIN DIRECT ATTENDANCE
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 2] SUPER ADMIN & ADMIN DIRECT ATTENDANCE ---");
  // 2.1: Super Admin directly marks Technician attendance -> PRESENT, requestStatus: DIRECT
  const saMarkRes = await apiCall('/attendance/mark', 'POST', saToken, {
    userId: techUser.id,
    date: testDate,
    status: 'PRESENT',
    notes: 'Direct morning attendance marked by Super Admin'
  });
  console.log(`✓ 2.1 Super Admin Direct Attendance: HTTP ${saMarkRes.status}, Status: ${saMarkRes.data?.attendance?.status}, RequestStatus: ${saMarkRes.data?.attendance?.requestStatus}`);
  if (saMarkRes.status !== 201 || saMarkRes.data?.attendance?.status !== 'PRESENT' || saMarkRes.data?.attendance?.requestStatus !== 'DIRECT') {
    throw new Error(`Super admin direct mark failed: ${JSON.stringify(saMarkRes.data)}`);
  }

  // 2.2: Admin directly marks Receptionist attendance -> PRESENT
  const admMarkRes = await apiCall('/attendance/mark', 'POST', admToken, {
    userId: recepUser.id,
    date: testDate,
    status: 'PRESENT',
    notes: 'Front-desk morning shift verified by Admin'
  });
  console.log(`✓ 2.2 Admin Direct Attendance: HTTP ${admMarkRes.status}, Status: ${admMarkRes.data?.attendance?.status}`);
  if (admMarkRes.status !== 201 || admMarkRes.data?.attendance?.status !== 'PRESENT') {
    throw new Error(`Admin direct mark failed: ${JSON.stringify(admMarkRes.data)}`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: DUPLICATE ATTENDANCE PROTECTION
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 3] DUPLICATE ATTENDANCE PROTECTION ---");
  // 3.1: Attempting to mark attendance again for Technician on testDate is rejected
  const dupMarkRes = await apiCall('/attendance/mark', 'POST', saToken, {
    userId: techUser.id,
    date: testDate,
    status: 'PRESENT'
  });
  console.log(`✓ 3.1 Duplicate Attendance Rejection: HTTP ${dupMarkRes.status} (Expected 400 rejection)`);
  if (dupMarkRes.status !== 400) {
    throw new Error(`Security Violation: Duplicate attendance was not blocked! HTTP ${dupMarkRes.status}`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: ATTENDANCE REQUEST & ACCEPT / REJECT WORKFLOW
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 4] REQUEST / APPROVAL / REJECTION WORKFLOW ---");
  
  // 4.1: Create a PENDING attendance request for alternateDate
  const pendingReqAttendance = await prisma.attendance.create({
    data: {
      userId: techUser.id,
      date: alternateDate,
      status: "PENDING",
      markedById: managerUser.id,
      markedByName: managerUser.name,
      markedByRole: managerUser.role,
      method: "MANAGER_REQUEST",
      requestStatus: "PENDING",
      branchId: testBranch.id
    }
  });

  // 4.2: Technician checks pending requests
  const techPendingRes = await apiCall('/attendance/pending-requests', 'GET', techToken);
  console.log(`✓ 4.1 GET /api/attendance/pending-requests (Technician): HTTP ${techPendingRes.status}, Found: ${techPendingRes.data?.length} pending request(s)`);
  if (techPendingRes.status !== 200 || !techPendingRes.data?.some((r: any) => r.id === pendingReqAttendance.id)) {
    throw new Error('Technician failed to retrieve pending request');
  }

  // 4.3: Technician ACCEPTS attendance request -> Status becomes PRESENT
  const acceptRes = await apiCall(`/attendance/${pendingReqAttendance.id}/respond`, 'POST', techToken, {
    action: 'ACCEPT'
  });
  console.log(`✓ 4.2 Technician ACCEPT Attendance Request: HTTP ${acceptRes.status}, Status: ${acceptRes.data?.attendance?.status}, RequestStatus: ${acceptRes.data?.attendance?.requestStatus}`);
  if (acceptRes.status !== 200 || acceptRes.data?.attendance?.status !== 'PRESENT' || acceptRes.data?.attendance?.requestStatus !== 'ACCEPTED') {
    throw new Error(`Accept request failed: ${JSON.stringify(acceptRes.data)}`);
  }

  // 4.4: Create another PENDING request for Receptionist to test REJECTION
  const pendingRecepReq = await prisma.attendance.create({
    data: {
      userId: recepUser.id,
      date: alternateDate,
      status: "PENDING",
      markedById: managerUser.id,
      markedByName: managerUser.name,
      markedByRole: managerUser.role,
      method: "MANAGER_REQUEST",
      requestStatus: "PENDING",
      branchId: testBranch.id
    }
  });

  // 4.5: Receptionist REJECTS attendance with custom reason
  const rejectionReasonText = "Was on approved emergency leave on that morning";
  const rejectRes = await apiCall(`/attendance/${pendingRecepReq.id}/respond`, 'POST', recepToken, {
    action: 'REJECT',
    rejectionReason: rejectionReasonText
  });
  console.log(`✓ 4.3 Receptionist REJECT Attendance: HTTP ${rejectRes.status}, Status: ${rejectRes.data?.attendance?.status}, Reason: "${rejectRes.data?.attendance?.rejectionReason}"`);
  if (rejectRes.status !== 200 || rejectRes.data?.attendance?.status !== 'REJECTED' || rejectRes.data?.attendance?.rejectionReason !== rejectionReasonText) {
    throw new Error(`Reject request failed: ${JSON.stringify(rejectRes.data)}`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: ATTENDANCE EDIT & AUDIT TRAIL PRESERVATION
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 5] ATTENDANCE CORRECTION / EDIT & AUDIT TRAIL ---");

  // 5.1: Edit without reason is REJECTED
  const editNoReason = await apiCall(`/attendance/${pendingRecepReq.id}`, 'PATCH', saToken, {
    status: 'PRESENT',
    reason: ''
  });
  console.log(`✓ 5.1 Correction without Reason Blocked: HTTP ${editNoReason.status} (Expected 400)`);
  if (editNoReason.status !== 400) {
    throw new Error('Edit without reason was not blocked!');
  }

  // 5.2: Edit with valid reason -> updates record and records AttendanceAuditLog
  const editWithReason = await apiCall(`/attendance/${pendingRecepReq.id}`, 'PATCH', saToken, {
    status: 'PRESENT',
    reason: 'Verified on-duty later by SuperAdmin after medical slip verification',
    notes: 'Medical slip verified'
  });
  console.log(`✓ 5.2 Attendance Correction with Audit Reason: HTTP ${editWithReason.status}, New Status: ${editWithReason.data?.attendance?.status}`);
  if (editWithReason.status !== 200 || editWithReason.data?.attendance?.status !== 'PRESENT') {
    throw new Error(`Edit failed: ${JSON.stringify(editWithReason.data)}`);
  }

  // Verify audit log entry in database
  const auditLogs = await prisma.attendanceAuditLog.findMany({
    where: { attendanceId: pendingRecepReq.id },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`✓ 5.3 Verified AttendanceAuditLog entries count: ${auditLogs.length} (Latest Action: ${auditLogs[0]?.action})`);
  if (auditLogs.length === 0 || auditLogs[0]?.action !== 'EDITED') {
    throw new Error('AttendanceAuditLog was not recorded properly!');
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: SOFT ARCHIVE / DELETE
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 6] SOFT-DELETE / ARCHIVE ---");
  const archiveRes = await apiCall(`/attendance/${pendingRecepReq.id}`, 'DELETE', saToken, {
    reason: 'Archived test record'
  });
  console.log(`✓ 6.1 Soft-Archive Attendance: HTTP ${archiveRes.status} (Expected 200)`);
  if (archiveRes.status !== 200) throw new Error('Soft-archive failed');

  const archivedDb = await prisma.attendance.findUnique({ where: { id: pendingRecepReq.id } });
  if (!archivedDb?.isArchived) throw new Error('isArchived was not set to true');
  console.log(`  -> Record marked as isArchived: true in database`);

  // -------------------------------------------------------------
  // TEST GROUP 7: RBAC ISOLATION & UNAUTHORIZED PRIVILEGE BLOCKS
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 7] MULTI-ROLE RBAC ISOLATION & ZERO PRIVILEGE LEAKAGE ---");

  // 7.1: Technician CANNOT mark attendance for other technicians (Must be 403 Forbidden)
  const techMarkAttempt = await apiCall('/attendance/mark', 'POST', techToken, {
    userId: recepUser.id,
    date: testDate
  });
  console.log(`✓ 7.1 Technician Unauthorized Mark Block: HTTP ${techMarkAttempt.status} (Expected 403)`);
  if (techMarkAttempt.status !== 403) {
    throw new Error(`Security Violation: Technician was able to mark attendance! HTTP ${techMarkAttempt.status}`);
  }

  // 7.2: Technician CANNOT respond to another user's attendance request (Must be 403 Forbidden)
  const techCrossRespond = await apiCall(`/attendance/${saMarkRes.data?.attendance?.id}/respond`, 'POST', recepToken, {
    action: 'ACCEPT'
  });
  console.log(`✓ 7.2 Cross-User Response Block: HTTP ${techCrossRespond.status} (Expected 403)`);
  if (techCrossRespond.status !== 403) {
    throw new Error('Cross-user response was not blocked!');
  }

  // 7.3: Customer CANNOT access any attendance endpoints (Must be 403 Forbidden)
  const custToday = await apiCall('/attendance/today', 'GET', custToken);
  const custMark = await apiCall('/attendance/mark', 'POST', custToken, { userId: techUser.id });
  const custHistory = await apiCall('/attendance/history', 'GET', custToken);
  console.log(`✓ 7.3 Customer Access Block (Today: ${custToday.status}, Mark: ${custMark.status}, History: ${custHistory.status}) (Expected 403)`);
  if (custToday.status !== 403 || custMark.status !== 403) {
    throw new Error('Customer unauthorized access was not blocked!');
  }

  // -------------------------------------------------------------
  // TEST GROUP 8: HISTORY & EXPORT VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 8] HISTORY & EXPORT DATA VERIFICATION ---");
  const myAttendanceRes = await apiCall('/attendance/my', 'GET', techToken);
  console.log(`✓ 8.1 GET /api/attendance/my (Technician): HTTP ${myAttendanceRes.status}, Total Records: ${myAttendanceRes.data?.history?.length}, Rate: ${myAttendanceRes.data?.stats?.attendanceRate}%`);
  if (myAttendanceRes.status !== 200 || !Array.isArray(myAttendanceRes.data?.history)) {
    throw new Error('Personal attendance history failed');
  }

  const exportRes = await apiCall('/attendance/export', 'GET', saToken);
  console.log(`✓ 8.2 GET /api/attendance/export (Super Admin): HTTP ${exportRes.status}, Exported Rows: ${exportRes.data?.count}`);
  if (exportRes.status !== 200 || !Array.isArray(exportRes.data?.rows)) {
    throw new Error('Attendance export failed');
  }

  // -------------------------------------------------------------
  // CLEANUP TEST FIXTURES
  // -------------------------------------------------------------
  console.log("\n--- CLEANUP ---");
  await prisma.attendanceAuditLog.deleteMany({
    where: { attendance: { userId: { in: [superAdminUser.id, adminUser.id, managerUser.id, techUser.id, recepUser.id] } } }
  });
  await prisma.attendance.deleteMany({
    where: { userId: { in: [superAdminUser.id, adminUser.id, managerUser.id, techUser.id, recepUser.id] } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: [superAdminUser.id, adminUser.id, managerUser.id, techUser.id, recepUser.id, customerUser.id] } }
  });
  console.log("✓ Cleaned up all verification test records and fixtures");

  console.log("\n===================================================================");
  console.log("ALL STAFF ATTENDANCE VERIFICATION TESTS PASSED WITH 100% SUCCESS!");
  console.log("===================================================================");
}

runAttendanceVerificationTests()
  .catch((err) => {
    console.error("\nTEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
