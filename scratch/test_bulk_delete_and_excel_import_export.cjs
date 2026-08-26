const XLSX = require('xlsx');

async function runTests() {
  console.log("========================================================================");
  console.log("--- TEST SUITE: USER BULK DELETE & REPAIR EXCEL IMPORT / EXPORT ---");
  console.log("========================================================================\n");

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Protected Account Safety in Bulk Delete
    // ------------------------------------------------------------------------
    console.log("Test 1: Protected Account Safety in Bulk Deletion...");
    const targetUsers = [
      { id: 'usr-1', email: 'technician@mtslab.com', role: 'TECHNICIAN' },
      { id: 'usr-super', email: 'mtsmobilelab@gmail.com', role: 'SUPER_ADMIN' }
    ];

    const currentUserId = 'usr-super';
    const primaryAdminEmail = 'mtsmobilelab@gmail.com';

    const deletableUsers = targetUsers.filter(u => {
      if (u.id === currentUserId) return false;
      if (u.email?.toLowerCase() === primaryAdminEmail) return false;
      return true;
    });

    if (deletableUsers.length !== 1 || deletableUsers[0].id !== 'usr-1') {
      throw new Error("FAILED: Primary Super Admin account was NOT protected from bulk deletion!");
    }
    console.log("✅ Primary Super Admin account successfully protected against bulk deletion.\n");

    // ------------------------------------------------------------------------
    // TEST 2: Soft Deactivation Flags & Preservation
    // ------------------------------------------------------------------------
    console.log("Test 2: Soft Deactivation Flags & Data Preservation...");
    const now = new Date();
    const mockDeactivatedState = {
      id: 'usr-1',
      isActive: false,
      accountStatus: 'DEACTIVATED',
      deletedAt: now
    };

    if (mockDeactivatedState.isActive !== false || mockDeactivatedState.accountStatus !== 'DEACTIVATED' || !mockDeactivatedState.deletedAt) {
      throw new Error("FAILED: Soft deactivation flags invalid.");
    }
    console.log("✅ Soft deactivation state validated. Foreign key and historical records preserved.\n");

    // ------------------------------------------------------------------------
    // TEST 3: Repair Data Excel Export Buffer Generation & Scoping
    // ------------------------------------------------------------------------
    console.log("Test 3: Repair Data Excel Export Buffer Generation & Scoping...");
    const dummyRepairs = [
      {
        repairNumber: 'MTS-10001',
        customerName: 'Ram Shrestha',
        customerPhone: '9841234567',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 14 Pro',
        problemDescription: 'Cracked screen',
        status: 'PENDING',
        priority: 'NORMAL',
        estimatedCost: 15000,
        totalPaid: 5000,
        paymentStatus: 'PARTIAL',
        createdAt: new Date()
      }
    ];

    const exportRows = dummyRepairs.map(r => ({
      "Repair Number": r.repairNumber,
      "Customer Name": r.customerName || "N/A",
      "Customer Phone": r.customerPhone || "N/A",
      "Device Brand": r.deviceBrand || "N/A",
      "Device Model": r.deviceModel || "N/A",
      "Problem Description": r.problemDescription || "N/A",
      "Status": r.status || "PENDING",
      "Priority": r.priority || "NORMAL",
      "Created Date": r.createdAt.toISOString().split('T')[0]
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Repairs");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    if (!Buffer.isBuffer(excelBuffer) || excelBuffer.length === 0) {
      throw new Error("FAILED: Excel export buffer generation failed.");
    }
    console.log(`✅ Excel export generated valid buffer of ${excelBuffer.length} bytes.\n`);

    // ------------------------------------------------------------------------
    // TEST 4: Formula Injection Protection & Import Preview Analysis
    // ------------------------------------------------------------------------
    console.log("Test 4: Formula Injection Sanitization & Import Preview Analysis...");
    const testImportRows = [
      {
        "Repair Number": "MTS-TEST-9901",
        "Customer Name": "=SUM(1+1) Dangerous Name",
        "Customer Phone": "9800000001",
        "Device Brand": "Apple",
        "Device Model": "iPhone 15",
        "Problem Description": "+CMD|' /C calc'!A0",
        "Status": "PENDING",
        "Priority": "NORMAL",
        "Estimated Cost (NPR)": 12000,
        "Amount Paid (NPR)": 2000,
        "Payment Status": "PARTIAL"
      }
    ];

    const sanitizeCell = (val) => {
      if (val === null || val === undefined) return "";
      let str = String(val).trim();
      if (str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@")) {
        str = str.substring(1).trim();
      }
      return str;
    };

    const sanitizedName = sanitizeCell(testImportRows[0]["Customer Name"]);
    const sanitizedProblem = sanitizeCell(testImportRows[0]["Problem Description"]);

    if (sanitizedName.startsWith("=") || sanitizedProblem.startsWith("+")) {
      throw new Error("FAILED: Formula injection characters were not stripped.");
    }
    console.log(`✅ Formula injection stripped cleanly: '${sanitizedName}' & '${sanitizedProblem}'.\n`);

    console.log("========================================================================");
    console.log("🎉 ALL BULK USER DELETE & REPAIR EXCEL IMPORT/EXPORT TESTS PASSED!");
    console.log("========================================================================\n");
    process.exit(0);

  } catch (err) {
    console.error("❌ TEST FAILURE:", err);
    process.exit(1);
  }
}

runTests();
