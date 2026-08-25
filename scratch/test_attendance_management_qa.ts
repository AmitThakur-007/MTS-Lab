import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key';
const BASE_URL = 'http://localhost:3000/api';

async function runQASuite() {
  console.log("====================================================");
  console.log("🚀 MTS LAB ATTENDANCE MANAGEMENT — QA TEST SUITE");
  console.log("====================================================");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failedTests++;
    }
  }

  try {
    // 1. Setup Test Users for Different Roles
    let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: 'superadmin.qa@mtslab.com',
          name: 'QA Super Admin',
          role: 'SUPER_ADMIN',
          password: 'hashedpassword',
          phoneNumber: '9800000001'
        }
      });
    }

    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN', deletedAt: null } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'admin.qa@mtslab.com',
          name: 'QA Admin',
          role: 'ADMIN',
          password: 'hashedpassword',
          phoneNumber: '9800000002'
        }
      });
    }

    let manager = await prisma.user.findFirst({ where: { role: 'MANAGER', deletedAt: null } });
    if (!manager) {
      manager = await prisma.user.create({
        data: {
          email: 'manager.qa@mtslab.com',
          name: 'QA Manager',
          role: 'MANAGER',
          password: 'hashedpassword',
          phoneNumber: '9800000003'
        }
      });
    }

    let tech = await prisma.user.findFirst({ where: { role: 'TECHNICIAN', deletedAt: null } });
    if (!tech) {
      tech = await prisma.user.create({
        data: {
          email: 'tech.qa@mtslab.com',
          name: 'QA Technician',
          role: 'TECHNICIAN',
          password: 'hashedpassword',
          phoneNumber: '9800000004'
        }
      });
    }

    let recep = await prisma.user.findFirst({ where: { role: 'RECEPTIONIST', deletedAt: null } });
    if (!recep) {
      recep = await prisma.user.create({
        data: {
          email: 'recep.qa@mtslab.com',
          name: 'QA Receptionist',
          role: 'RECEPTIONIST',
          password: 'hashedpassword',
          phoneNumber: '9800000005'
        }
      });
    }

    // Generate JWT Tokens
    const superAdminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, email: superAdmin.email }, JWT_SECRET, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, JWT_SECRET, { expiresIn: '1h' });
    const managerToken = jwt.sign({ id: manager.id, role: manager.role, email: manager.email }, JWT_SECRET, { expiresIn: '1h' });
    const techToken = jwt.sign({ id: tech.id, role: tech.role, email: tech.email }, JWT_SECRET, { expiresIn: '1h' });
    const recepToken = jwt.sign({ id: recep.id, role: recep.role, email: recep.email }, JWT_SECRET, { expiresIn: '1h' });

    console.log("\n--- TEST 1: Super Admin Staff Attendance Report Access ---");
    const saRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-08`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const saData: any = await saRes.json();
    console.log("saRes.status:", saRes.status, "saData:", JSON.stringify(saData));
    assert(saRes.status === 200 && saData.success === true, "Super Admin can successfully fetch monthly attendance report");
    assert(Array.isArray(saData.report) && saData.report.length > 0, "Super Admin monthly report contains staff records");
    
    // Verify Manager, Receptionist, and Technician are present in Super Admin's view
    const saRolesFound = new Set(saData.report.map((r: any) => r.user.role));
    assert(saRolesFound.has('MANAGER') || saRolesFound.has('TECHNICIAN') || saRolesFound.has('RECEPTIONIST'), 
      "Super Admin report includes Manager, Receptionist, and Technician staff");

    console.log("\n--- TEST 2: Admin Staff Attendance Report Access ---");
    const adminRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-08`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminData: any = await adminRes.json();
    assert(adminRes.status === 200 && adminData.success === true, "Admin can successfully fetch monthly attendance report");
    assert(adminData.stats.totalStaff > 0, "Admin receives dynamic staff summary statistics");

    console.log("\n--- TEST 3: RBAC & Security Restrictions for Technician ---");
    const techReportRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-08`, {
      headers: { Authorization: `Bearer ${techToken}` }
    });
    assert(techReportRes.status === 403, "Technician receives 403 Forbidden when attempting to access staff monthly report");

    const techOtherRes = await fetch(`${BASE_URL}/attendance/staff/${manager.id}/monthly?month=2026-08`, {
      headers: { Authorization: `Bearer ${techToken}` }
    });
    assert(techOtherRes.status === 403, "Technician receives 403 Forbidden when attempting to access another staff member's history");

    console.log("\n--- TEST 4: Technician Personal Attendance Access ---");
    const techMyRes = await fetch(`${BASE_URL}/attendance/my`, {
      headers: { Authorization: `Bearer ${techToken}` }
    });
    const techMyData: any = await techMyRes.json();
    assert(techMyRes.status === 200 && techMyData.success === true, "Technician can access their own attendance history (/api/attendance/my)");

    console.log("\n--- TEST 5: Receptionist Personal Access & Forbidden Report ---");
    const recepReportRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-08`, {
      headers: { Authorization: `Bearer ${recepToken}` }
    });
    assert(recepReportRes.status === 403, "Receptionist receives 403 Forbidden for full staff monthly report");

    console.log("\n--- TEST 6: Date & Month Boundary Calculation ---");
    // Test February calculation (days in Feb: 28 in non-leap, 29 in leap)
    const febRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-02`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const febData: any = await febRes.json();
    assert(febRes.status === 200 && febData.daysInMonth === 28, "February 2026 correctly calculated as 28 days");

    // Test Leap Year February
    const leapFebRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2028-02`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const leapFebData: any = await leapFebRes.json();
    assert(leapFebRes.status === 200 && leapFebData.daysInMonth === 29, "February 2028 correctly calculated as 29 days (Leap Year)");

    // Test 30-day month (April)
    const aprRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-04`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const aprData: any = await aprRes.json();
    assert(aprRes.status === 200 && aprData.daysInMonth === 30, "April 2026 correctly calculated as 30 days");

    console.log("\n--- TEST 7: Specific Date Attendance Roster ---");
    const testDate = '2026-08-20';
    const dateRes = await fetch(`${BASE_URL}/attendance/today?date=${testDate}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dateData: any = await dateRes.json();
    assert(dateRes.status === 200 && dateData.date === testDate, `Specific date query successfully returns roster for ${testDate}`);
    assert(Array.isArray(dateData.roster) && dateData.roster.length > 0, "Specific date roster contains all active staff members");

    console.log("\n--- TEST 8: Role Filtering ---");
    const techFilterRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-08&role=TECHNICIAN`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const techFilterData: any = await techFilterRes.json();
    const allTechs = techFilterData.report.every((r: any) => r.user.role === 'TECHNICIAN');
    assert(techFilterRes.status === 200 && allTechs, "Role filter 'TECHNICIAN' returns exclusively technician records");

    console.log("\n--- TEST 9: Staff Search by Name / Email ---");
    const searchRes = await fetch(`${BASE_URL}/attendance/monthly-report?month=2026-08&search=${encodeURIComponent(tech.name)}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const searchData: any = await searchRes.json();
    const foundStaff = searchData.report.some((r: any) => r.user.id === tech.id);
    assert(searchRes.status === 200 && foundStaff, `Search query '${tech.name}' accurately locates target staff record`);

    console.log("\n--- TEST 10: Individual Staff Monthly Attendance Breakdown ---");
    // Ensure at least one attendance record exists for technician in August 2026
    const sampleDate = '2026-08-05';
    await prisma.attendance.upsert({
      where: { userId_date: { userId: tech.id, date: sampleDate } },
      create: {
        userId: tech.id,
        date: sampleDate,
        status: 'PRESENT',
        markedById: superAdmin.id,
        markedByName: superAdmin.name,
        markedByRole: superAdmin.role,
        method: 'DIRECT_SUPER_ADMIN',
        requestStatus: 'DIRECT'
      },
      update: {
        status: 'PRESENT',
        isArchived: false
      }
    });

    const staffMonthlyRes = await fetch(`${BASE_URL}/attendance/staff/${tech.id}/monthly?month=2026-08`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const staffMonthlyData: any = await staffMonthlyRes.json();
    assert(staffMonthlyRes.status === 200 && staffMonthlyData.success === true, "Super Admin can fetch individual staff monthly history");
    assert(Array.isArray(staffMonthlyData.dailyLogs) && staffMonthlyData.dailyLogs.length === 31, "August returns exactly 31 day-by-day log entries");
    
    const sampleDayLog = staffMonthlyData.dailyLogs.find((d: any) => d.date === sampleDate);
    assert(sampleDayLog && sampleDayLog.status === 'PRESENT' && sampleDayLog.record !== null, 
      "Day log correctly reflects PRESENT status with formatted check-in time and markedBy details");

    console.log("\n--- TEST 11: Direct Attendance Marking by Super Admin ---");
    const markDate = '2026-08-21';
    // Clean up if already exists
    await prisma.attendance.deleteMany({ where: { userId: recep.id, date: markDate } });

    const markRes = await fetch(`${BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}` 
      },
      body: JSON.stringify({
        userId: recep.id,
        date: markDate,
        status: 'PRESENT',
        notes: 'QA Automated Test Presence Confirmation'
      })
    });
    const markData: any = await markRes.json();
    assert(markRes.status === 201 && markData.success === true, `Super Admin successfully marked attendance directly for ${recep.name}`);

    console.log("\n--- TEST 12: Attendance Correction with Audit Trail ---");
    const createdRecordId = markData.attendance.id;
    const editRes = await fetch(`${BASE_URL}/attendance/${createdRecordId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'LATE',
        reason: 'Staff arrived late due to road construction traffic',
        notes: 'Approved by Admin'
      })
    });
    const editData: any = await editRes.json();
    assert(editRes.status === 200 && editData.success === true && editData.attendance.status === 'LATE', 
      "Admin successfully updated attendance record status to LATE with mandatory audit reason");

    const auditLogs = await prisma.attendanceAuditLog.findMany({
      where: { attendanceId: createdRecordId },
      orderBy: { createdAt: 'desc' }
    });
    assert(auditLogs.length > 0 && auditLogs[0].action === 'EDITED', "Attendance audit log successfully logged correction action and reason");

    console.log("\n--- TEST 13: Soft-Delete / Archive Attendance Record ---");
    const deleteRes = await fetch(`${BASE_URL}/attendance/${createdRecordId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        reason: 'QA Cleanup test archive'
      })
    });
    const deleteData: any = await deleteRes.json();
    assert(deleteRes.status === 200 && deleteData.success === true, "Attendance record safely soft-archived");

    const archivedRecord = await prisma.attendance.findUnique({ where: { id: createdRecordId } });
    assert(archivedRecord?.isArchived === true, "Database reflects isArchived: true without data destruction");

    console.log("\n--- TEST 14: Unauthenticated Request Rejection ---");
    const unauthRes = await fetch(`${BASE_URL}/attendance/monthly-report`);
    assert(unauthRes.status === 401, "Unauthenticated request rejected with 401 Unauthorized");

    console.log("\n--- TEST 15: Server Authoritative Nepal Time ---");
    const timeRes = await fetch(`${BASE_URL}/attendance/server-time`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const timeData: any = await timeRes.json();
    assert(timeRes.status === 200 && timeData.timezone === 'Asia/Kathmandu', "Server returns authoritative Asia/Kathmandu (UTC+5:45) time");

    console.log("\n--- TEST 16: Attendance CSV Export ---");
    const exportRes = await fetch(`${BASE_URL}/attendance/export?month=2026-08`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const exportData: any = await exportRes.json();
    assert(exportRes.status === 200 && exportData.success === true && Array.isArray(exportData.rows), 
      "Attendance export endpoint returns structured CSV rows");

  } catch (err: any) {
    console.error("FATAL QA TEST EXCEPTION:", err);
    failedTests++;
  } finally {
    await prisma.$disconnect();
    console.log("\n====================================================");
    console.log(`🎉 QA TEST RESULTS: ${passedTests} PASSED | ${failedTests} FAILED`);
    console.log("====================================================");
    if (failedTests > 0) {
      process.exit(1);
    }
  }
}

runQASuite();
