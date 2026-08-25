import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "mts-lab-super-secret-key";
const API_BASE = "http://127.0.0.1:3000/api";

function generateTestToken(role: string, name: string = "Test User", email: string = "test@mtslab.com", id?: string) {
  return jwt.sign(
    {
      id: id || `test-user-${role.toLowerCase()}-${Date.now()}`,
      email,
      name,
      role
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runRolePermissionTests() {
  console.log("===================================================================");
  console.log("STARTING MTS LAB MANAGER ROLE & MULTI-ROLE SECURITY VERIFICATION");
  console.log("===================================================================");

  // Get valid user and branch records from DB for foreign keys
  let dbUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!dbUser) {
    dbUser = await prisma.user.findFirst();
  }
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email: "testadmin@mtslab.com",
        name: "Test Admin",
        role: "SUPER_ADMIN",
        password: "hashedpassword"
      }
    });
  }

  let dbBranch = await prisma.branch.findFirst();
  if (!dbBranch) {
    dbBranch = await prisma.branch.create({
      data: {
        name: "MTS Lab Main Branch",
        location: "Kathmandu",
        phone: "9869276668"
      }
    });
  }

  const creatorId = dbUser.id;
  const branchId = dbBranch.id;

  const managerToken = generateTestToken("MANAGER", "Test Manager", "manager@mtslab.com", creatorId);
  const superAdminToken = generateTestToken("SUPER_ADMIN", "Test Super Admin", "superadmin@mtslab.com", creatorId);
  const receptionistToken = generateTestToken("RECEPTIONIST", "Test Receptionist", "reception@mtslab.com", creatorId);
  const technicianToken = generateTestToken("TECHNICIAN", "Test Technician", "tech@mtslab.com", creatorId);
  const customerToken = generateTestToken("CUSTOMER", "Test Customer", "customer@mtslab.com", creatorId);

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

  // Setup a test repair for warranty tests
  const testRepair = await prisma.repair.create({
    data: {
      repairNumber: `MTS-MGR-TEST-${Date.now()}`,
      customerName: "Manager Test Customer",
      customerPhone: "9800000099",
      deviceBrand: "Apple",
      deviceModel: "iPhone 14 Pro Max",
      problemDescription: "Battery Health degraded to 70%",
      deviceCondition: "Good",
      status: "DELIVERED",
      estimatedCost: 8500,
      totalPaid: 8500,
      paymentStatus: "PAID",
      branchId,
      createdById: creatorId
    }
  });
  console.log(`✓ Created fixture repair: #${testRepair.repairNumber}`);

  let createdWarrantyId = '';
  let createdItemId = '';

  // -------------------------------------------------------------
  // TEST GROUP 1: MANAGER ACCESS TO BATTERY WARRANTY HUB
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 1] MANAGER BATTERY WARRANTY ACCESS ---");

  // 1.1: Manager can view battery warranties list
  const getWarranties = await apiCall('/battery-warranties', 'GET', managerToken);
  console.log(`✓ 1.1 GET /api/battery-warranties (Manager): HTTP ${getWarranties.status} (Expected 200)`);
  if (getWarranties.status !== 200) throw new Error(`Manager cannot view warranties: HTTP ${getWarranties.status}`);

  // 1.2: Manager can register a battery warranty
  const postWarranty = await apiCall('/battery-warranties', 'POST', managerToken, {
    repairId: testRepair.id,
    warrantyPeriod: "1_YEAR",
    batteryType: "High Capacity OEM Battery",
    terms: "1-Year Extended Warranty for Manager Test"
  });
  console.log(`✓ 1.2 POST /api/battery-warranties (Manager): HTTP ${postWarranty.status} (Expected 201)`);
  if (postWarranty.status !== 201 || !postWarranty.data?.warranty) {
    throw new Error(`Manager failed to register warranty: ${JSON.stringify(postWarranty.data)}`);
  }
  createdWarrantyId = postWarranty.data.warranty.id;
  console.log(`  -> Registered Warranty #${postWarranty.data.warranty.warrantyNumber}`);

  // 1.3: Manager can process a warranty claim
  const postClaim = await apiCall(`/battery-warranties/${createdWarrantyId}/claim`, 'POST', managerToken, {
    issueDescription: "Battery draining rapidly below 20%",
    actionTaken: "BATTERY_REPLACED",
    notes: "Approved under standard manager warranty coverage"
  });
  console.log(`✓ 1.3 POST /api/battery-warranties/:id/claim (Manager): HTTP ${postClaim.status} (Expected 200)`);
  if (postClaim.status !== 200 || !postClaim.data?.claim) {
    throw new Error(`Manager failed to process claim: ${JSON.stringify(postClaim.data)}`);
  }
  console.log(`  -> Processed Claim #${postClaim.data.claim.claimNumber}`);

  // 1.4: Manager can view warranty claims history
  const getClaims = await apiCall(`/battery-warranties/${createdWarrantyId}/claims`, 'GET', managerToken);
  console.log(`✓ 1.4 GET /api/battery-warranties/:id/claims (Manager): HTTP ${getClaims.status} (Expected 200)`);
  if (getClaims.status !== 200) throw new Error(`Manager failed to view claims: HTTP ${getClaims.status}`);

  // 1.5: Manager can export warranties to Excel
  const exportWarranties = await fetch(`${API_BASE}/battery-warranties/export`, {
    headers: { 'Authorization': `Bearer ${managerToken}` }
  });
  console.log(`✓ 1.5 GET /api/battery-warranties/export (Manager): HTTP ${exportWarranties.status} (Expected 200)`);
  if (exportWarranties.status !== 200) throw new Error(`Manager failed to export warranties: HTTP ${exportWarranties.status}`);

  // 1.6: Manager CANNOT bypass 2FA permanent deletion (Must be 403 Forbidden)
  const deleteWarrantyAttempt = await apiCall('/battery-warranties/bulk-delete', 'POST', managerToken, {
    ids: [createdWarrantyId],
    code: "123456"
  });
  console.log(`✓ 1.6 POST /api/battery-warranties/bulk-delete (Manager Permanent Delete Block): HTTP ${deleteWarrantyAttempt.status} (Expected 403)`);
  if (deleteWarrantyAttempt.status !== 403) {
    throw new Error(`Security Violation: Manager was not blocked from permanent warranty deletion! HTTP ${deleteWarrantyAttempt.status}`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: MANAGER ACCESS TO INVENTORY HUB & STOCK SAFETY
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 2] MANAGER INVENTORY HUB & ATOMIC STOCK OPERATIONS ---");

  // 2.1: Manager can view inventory items and stats
  const getInventory = await apiCall('/inventory', 'GET', managerToken);
  const getStats = await apiCall('/inventory/stats', 'GET', managerToken);
  console.log(`✓ 2.1 GET /api/inventory & /stats (Manager): HTTP ${getInventory.status}, ${getStats.status} (Expected 200)`);
  if (getInventory.status !== 200 || getStats.status !== 200) throw new Error('Manager inventory fetch failed');

  // 2.2: Manager can create a new inventory item with initial stock = 20
  const postItem = await apiCall('/inventory', 'POST', managerToken, {
    name: "Apple iPhone 14 Pro Max Original Battery Replacement (MGR Test)",
    brand: `AppleMgr_${Date.now()}`,
    model: "iPhone 14 Pro Max",
    category: "Batteries",
    unit: "Piece",
    currentStock: 20,
    minStockLevel: 5,
    purchasePrice: 4200,
    sellingPrice: 7500,
    supplier: "Shenzhen Apex Tech",
    storageLocation: "Bin MGR-01"
  });
  console.log(`✓ 2.2 POST /api/inventory (Manager Create Item): HTTP ${postItem.status} (Expected 201)`);
  if (postItem.status !== 201 || !postItem.data?.id) {
    throw new Error(`Manager item creation failed: ${JSON.stringify(postItem.data)}`);
  }
  createdItemId = postItem.data.id;
  console.log(`  -> Created Item ID: ${createdItemId} (Stock: ${postItem.data.currentStock})`);

  // 2.3: Manager can perform Stock In (+10) -> 20 + 10 = 30
  const stockIn = await apiCall(`/inventory/${createdItemId}/stock-in`, 'POST', managerToken, {
    quantity: 10,
    reason: "New Vendor Shipment Batch #MGR-99",
    supplier: "Shenzhen Apex Tech"
  });
  console.log(`✓ 2.3 POST /api/inventory/:id/stock-in (Manager +10 units): HTTP ${stockIn.status}, New Stock: ${stockIn.data?.item?.currentStock} (Expected 30)`);
  if (stockIn.status !== 200 || stockIn.data?.item?.currentStock !== 30) {
    throw new Error(`Stock in failed or stock mismatch: ${JSON.stringify(stockIn.data)}`);
  }

  // 2.4: Manager can perform Stock Out (-5) -> 30 - 5 = 25 with repair linkage
  const stockOut = await apiCall(`/inventory/${createdItemId}/stock-out`, 'POST', managerToken, {
    quantity: 5,
    reason: "Used for Repair",
    repairNumber: testRepair.repairNumber
  });
  console.log(`✓ 2.4 POST /api/inventory/:id/stock-out (Manager -5 units): HTTP ${stockOut.status}, New Stock: ${stockOut.data?.item?.currentStock} (Expected 25)`);
  if (stockOut.status !== 200 || stockOut.data?.item?.currentStock !== 25) {
    throw new Error(`Stock out failed or stock mismatch: ${JSON.stringify(stockOut.data)}`);
  }

  // 2.5: Negative Stock Protection: Manager attempt to deduct 50 units on 25 stock is REJECTED
  const excessiveStockOut = await apiCall(`/inventory/${createdItemId}/stock-out`, 'POST', managerToken, {
    quantity: 50,
    reason: "Excessive consumption test"
  });
  console.log(`✓ 2.5 Negative Stock Protection (Attempt 50 on 25 stock): HTTP ${excessiveStockOut.status} (Expected 400 rejection)`);
  if (excessiveStockOut.status !== 400) {
    throw new Error(`Security Violation: Insufficient stock was not rejected! Status: ${excessiveStockOut.status}`);
  }

  // 2.6: Manager can perform Physical Stock Adjustment (25 -> 22)
  const adjustStock = await apiCall(`/inventory/${createdItemId}/adjust-stock`, 'POST', managerToken, {
    newStock: 22,
    reason: "Quarterly physical count reconciliation by Manager"
  });
  console.log(`✓ 2.6 POST /api/inventory/:id/adjust-stock (Manager Audit Adjustment): HTTP ${adjustStock.status}, New Stock: ${adjustStock.data?.item?.currentStock} (Expected 22)`);
  if (adjustStock.status !== 200 || adjustStock.data?.item?.currentStock !== 22) {
    throw new Error(`Stock adjustment failed: ${JSON.stringify(adjustStock.data)}`);
  }

  // 2.7: Manager can rename folder and move items
  const renameFolder = await apiCall('/inventory/rename-folder', 'POST', managerToken, {
    level: 'model',
    oldName: 'iPhone 14 Pro Max',
    newName: 'iPhone 14 Pro Max 5G'
  });
  console.log(`✓ 2.7 POST /api/inventory/rename-folder (Manager): HTTP ${renameFolder.status} (Expected 200)`);
  if (renameFolder.status !== 200) throw new Error('Folder rename failed');

  // 2.8: Manager can soft-archive and restore
  const archiveItem = await apiCall(`/inventory/${createdItemId}`, 'DELETE', managerToken);
  console.log(`✓ 2.8 DELETE /api/inventory/:id (Manager Soft Archive): HTTP ${archiveItem.status} (Expected 200)`);
  if (archiveItem.status !== 200) throw new Error('Soft archive failed');

  const restoreItem = await apiCall(`/inventory/${createdItemId}/restore`, 'POST', managerToken);
  console.log(`✓ 2.8.1 POST /api/inventory/:id/restore (Manager Restore): HTTP ${restoreItem.status} (Expected 200)`);
  if (restoreItem.status !== 200) throw new Error('Item restore failed');

  // 2.9: Manager CANNOT hard-delete inventory items permanently (Must be 403 Forbidden)
  const hardDeleteAttempt = await apiCall('/inventory/bulk-delete', 'POST', managerToken, {
    ids: [createdItemId]
  });
  console.log(`✓ 2.9 POST /api/inventory/bulk-delete (Manager Permanent Delete Block): HTTP ${hardDeleteAttempt.status} (Expected 403)`);
  if (hardDeleteAttempt.status !== 403) {
    throw new Error(`Security Violation: Manager was not blocked from hard deletion! HTTP ${hardDeleteAttempt.status}`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: MULTI-ROLE ISOLATION & RBAC INTEGRITY
  // -------------------------------------------------------------
  console.log("\n--- [GROUP 3] MULTI-ROLE RBAC ISOLATION & ZERO PRIVILEGE LEAKAGE ---");

  // 3.1: Technician can consume inventory (stock-out) for repair
  const techStockOut = await apiCall(`/inventory/${createdItemId}/stock-out`, 'POST', technicianToken, {
    quantity: 1,
    reason: "Used for Repair",
    repairNumber: testRepair.repairNumber
  });
  console.log(`✓ 3.1 Technician Inventory Consumption (Stock Out): HTTP ${techStockOut.status} (Expected 200)`);
  if (techStockOut.status !== 200) throw new Error('Technician stock out failed');

  // 3.2: Technician CANNOT adjust stock or rename folders (Must be 403 Forbidden)
  const techAdjust = await apiCall(`/inventory/${createdItemId}/adjust-stock`, 'POST', technicianToken, { newStock: 100 });
  const techRename = await apiCall('/inventory/rename-folder', 'POST', technicianToken, { level: 'brand', oldName: 'x', newName: 'y' });
  console.log(`✓ 3.2 Technician Forbidden Actions (Adjust Stock: ${techAdjust.status}, Rename Folder: ${techRename.status}) (Expected 403)`);
  if (techAdjust.status !== 403 || techRename.status !== 403) {
    throw new Error('Technician unauthorized actions were not blocked!');
  }

  // 3.3: Technician CANNOT manage battery warranties (Must be 403 Forbidden)
  const techWarranty = await apiCall('/battery-warranties', 'GET', technicianToken);
  console.log(`✓ 3.3 Technician Battery Warranty Hub Access: HTTP ${techWarranty.status} (Expected 403)`);
  if (techWarranty.status !== 403) throw new Error('Technician was able to access battery warranties!');

  // 3.4: Receptionist can view warranties and register warranties
  const recepWarranty = await apiCall('/battery-warranties', 'GET', receptionistToken);
  console.log(`✓ 3.4 Receptionist Battery Warranty Access: HTTP ${recepWarranty.status} (Expected 200)`);
  if (recepWarranty.status !== 200) throw new Error('Receptionist warranty access failed');

  // 3.5: Customer is FORBIDDEN from all internal hubs (Must be 403 Forbidden)
  const custWarranties = await apiCall('/battery-warranties', 'GET', customerToken);
  const custInventory = await apiCall('/inventory', 'GET', customerToken);
  console.log(`✓ 3.5 Customer Internal Hubs Access (Warranties: ${custWarranties.status}, Inventory: ${custInventory.status}) (Expected 403)`);
  if (custWarranties.status !== 403 || custInventory.status !== 403) {
    throw new Error('Customer unauthorized access was not blocked!');
  }

  // -------------------------------------------------------------
  // CLEANUP TEST FIXTURES
  // -------------------------------------------------------------
  console.log("\n--- CLEANUP ---");
  await prisma.batteryWarrantyClaim.deleteMany({ where: { warrantyId: createdWarrantyId } });
  await prisma.batteryWarranty.deleteMany({ where: { id: createdWarrantyId } });
  await prisma.inventoryTransaction.deleteMany({ where: { itemId: createdItemId } });
  await prisma.inventoryItem.deleteMany({ where: { id: createdItemId } });
  await prisma.repairLog.deleteMany({ where: { repairId: testRepair.id } });
  await prisma.repair.deleteMany({ where: { id: testRepair.id } });
  console.log("✓ Cleaned up all temporary verification records");

  console.log("\n===================================================================");
  console.log("ALL MANAGER & MULTI-ROLE SECURITY TESTS PASSED WITH 100% SUCCESS!");
  console.log("===================================================================");
}

runRolePermissionTests()
  .catch((err) => {
    console.error("\nTEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
