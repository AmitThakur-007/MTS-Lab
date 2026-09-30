import jwt from 'jsonwebtoken';
import { supabaseAdmin, config } from '../api/_server/config/supabase';

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = config.jwtSecret || 'mts-lab-super-secret-key-2026';

async function runDecouplingTests() {
  console.log('================================================================');
  console.log('STARTING BATTERY WARRANTY HUB DECOUPLING & 2FA AUDIT SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  try {
    // 1. Fetch or create users for Super Admin and Technician
    const { data: users } = await supabaseAdmin.from('User').select('*').limit(50);
    const superAdmin = (users || []).find((u: any) => u.role === 'SUPER_ADMIN') || users?.[0];
    const techUser = (users || []).find((u: any) => u.role === 'TECHNICIAN');

    if (!superAdmin) {
      throw new Error('No user found in database to generate tokens.');
    }

    const superAdminToken = jwt.sign(
      { id: superAdmin.id, role: 'SUPER_ADMIN', email: superAdmin.email, name: superAdmin.name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const techToken = jwt.sign(
      { id: techUser?.id || 'fake-tech-id', role: 'TECHNICIAN', email: 'tech@test.com', name: 'Test Tech' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const { data: branches } = await supabaseAdmin.from('Branch').select('id').limit(1);
    const branchId = branches?.[0]?.id || null;

    // =====================================================================
    // TEST 1: Repair without battery warranty -> No warranty record created
    // =====================================================================
    console.log('\n--- 1. Verification: Repair without Warranty does NOT create a warranty record ---');
    const resNoWar = await fetch(`${BASE_URL}/repairs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        customerName: 'No Warranty Customer',
        customerPhone: '9841000010',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 11',
        deviceCondition: 'Good',
        problemDescription: 'Screen issue only, no battery replacement',
        branchId,
        hasBatteryWarranty: false,
      }),
    });

    const noWarRepair = await resNoWar.json();
    assert(resNoWar.status === 201 && Boolean(noWarRepair.id), 'Repair created without warranty');

    const { data: checkNoWar } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('id')
      .eq('repairId', noWarRepair.id);

    assert((checkNoWar || []).length === 0, 'No BatteryWarranty record created when hasBatteryWarranty is false');

    // =====================================================================
    // TEST 2: Repair with battery warranty -> Warranty record created
    // =====================================================================
    console.log('\n--- 2. Verification: Repair with Warranty creates independent warranty record ---');
    const resWithWar = await fetch(`${BASE_URL}/repairs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        customerName: 'Decoupling Test Customer',
        customerPhone: '9841999888',
        customerEmail: 'warranty_test@example.com',
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S23 Ultra',
        deviceCondition: 'Good, Battery Drained',
        problemDescription: 'Original Battery Replacement with 1 Year Warranty',
        branchId,
        hasBatteryWarranty: true,
        batteryWarrantyPeriod: '1 Year',
        batteryType: 'Original Replacement Battery',
      }),
    });

    const withWarRepair = await resWithWar.json();
    assert(resWithWar.status === 201 && Boolean(withWarRepair.id), 'Repair created with warranty');

    const { data: createdWarrantyList } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .eq('repairId', withWarRepair.id);

    const createdWarranty = createdWarrantyList?.[0];
    assert(Boolean(createdWarranty), 'BatteryWarranty record exists in Battery Warranty Hub');
    assert(createdWarranty?.warrantyNumber?.startsWith('BW-'), 'Warranty record has valid BW- prefix');
    assert(createdWarranty?.repairNumber === withWarRepair.repairNumber, 'Warranty record correctly references repairNumber');
    assert(createdWarranty?.customerPhone === '9841999888', 'Warranty record stores customer details directly');

    // =====================================================================
    // TEST 3: Editing repair with hasBatteryWarranty: false must NOT delete warranty!
    // =====================================================================
    console.log('\n--- 3. Verification: Repair edit does NOT delete registered warranty ---');
    const resEdit = await fetch(`${BASE_URL}/repairs/${withWarRepair.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        problemDescription: 'Updated problem description',
        hasBatteryWarranty: false,
      }),
    });

    assert(resEdit.status === 200, 'Repair updated with hasBatteryWarranty: false');

    const { data: checkAfterEdit } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .eq('id', createdWarranty.id);

    assert(checkAfterEdit && checkAfterEdit.length > 0, 'BatteryWarranty STILL EXISTS after repair edit (not auto-deleted)');

    // =====================================================================
    // TEST 4: Single Repair Deletion -> Warranty record is PRESERVED!
    // =====================================================================
    console.log('\n--- 4. Verification: Single Repair Deletion preserves Warranty Hub Record ---');
    const resDeleteRepair = await fetch(`${BASE_URL}/repairs/${withWarRepair.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const delRepairData = await resDeleteRepair.json();
    assert(resDeleteRepair.status === 200, 'DELETE /api/repairs/:id returns HTTP 200 OK');
    assert(delRepairData.success === true, 'Response confirms repair deletion success');
    assert(delRepairData.warrantiesPreserved >= 1, 'Response confirms battery warranty preserved');

    // Check repair is gone
    const { data: checkDeletedRepair } = await supabaseAdmin
      .from('Repair')
      .select('id')
      .eq('id', withWarRepair.id);
    assert((checkDeletedRepair || []).length === 0, 'Repair record deleted from database');

    // Check warranty STILL EXISTS!
    const { data: checkPreservedWarranty } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('*')
      .eq('id', createdWarranty.id);

    const preservedWarranty = checkPreservedWarranty?.[0];
    assert(Boolean(preservedWarranty), 'CRITICAL: Battery Warranty Hub record survived repair deletion!');
    assert(preservedWarranty?.repairId === null, 'Warranty repairId is safely unlinked (set to null)');
    assert(preservedWarranty?.repairNumber === withWarRepair.repairNumber, 'Original repairNumber preserved in warranty record');
    assert(preservedWarranty?.customerName === 'Decoupling Test Customer', 'Customer name preserved in warranty record');
    assert(preservedWarranty?.deviceModel === 'Galaxy S23 Ultra', 'Device model preserved in warranty record');

    // Verify GET /api/battery-warranties includes the preserved warranty with unlinked status
    const resGetHub = await fetch(`${BASE_URL}/battery-warranties`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const hubData = await resGetHub.json();
    const hubItem = (hubData?.warranties || []).find((w: any) => w.id === createdWarranty.id);
    assert(Boolean(hubItem), 'Preserved warranty is visible in Battery Warranty Hub query');
    assert(hubItem?.repairStatus === 'UNLINKED', 'Preserved warranty has repairStatus: UNLINKED');

    // =====================================================================
    // TEST 5: Audit logs: REPAIR_DELETED and BATTERY_WARRANTY_UNLINKED_FROM_REPAIR
    // =====================================================================
    console.log('\n--- 5. Verification: Audit Logging records Unlinking and NOT Deletion ---');
    const { data: unlinkAudit } = await supabaseAdmin
      .from('AuditLog')
      .select('*')
      .eq('action', 'BATTERY_WARRANTY_UNLINKED_FROM_REPAIR')
      .eq('resourceId', createdWarranty.id)
      .order('createdAt', { ascending: false })
      .limit(1);

    assert(Boolean(unlinkAudit && unlinkAudit.length > 0), 'Audit log contains BATTERY_WARRANTY_UNLINKED_FROM_REPAIR');

    const { data: warDeletedAuditBefore } = await supabaseAdmin
      .from('AuditLog')
      .select('*')
      .eq('action', 'BATTERY_WARRANTY_DELETED')
      .eq('resourceId', createdWarranty.id);

    assert((warDeletedAuditBefore || []).length === 0, 'No BATTERY_WARRANTY_DELETED audit event created during repair deletion');

    // =====================================================================
    // TEST 6: Bulk Repair Deletion preserves all linked warranties
    // =====================================================================
    console.log('\n--- 6. Verification: Bulk Repair Deletion preserves all linked warranties ---');
    // Create 2 repairs with warranties
    const resBulkRep1 = await fetch(`${BASE_URL}/repairs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        customerName: 'Bulk Preserved 1',
        customerPhone: '9841111222',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 14',
        problemDescription: 'Battery swap',
        branchId,
        hasBatteryWarranty: true,
      }),
    });
    const bulkRep1 = await resBulkRep1.json();

    const resBulkRep2 = await fetch(`${BASE_URL}/repairs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        customerName: 'Bulk Preserved 2',
        customerPhone: '9841111333',
        deviceBrand: 'OnePlus',
        deviceModel: '11R',
        problemDescription: 'Battery swap',
        branchId,
        hasBatteryWarranty: true,
      }),
    });
    const bulkRep2 = await resBulkRep2.json();

    const { data: bulkWar1List } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('repairId', bulkRep1.id);
    const { data: bulkWar2List } = await supabaseAdmin.from('BatteryWarranty').select('*').eq('repairId', bulkRep2.id);
    const bulkWar1 = bulkWar1List?.[0];
    const bulkWar2 = bulkWar2List?.[0];

    assert(Boolean(bulkWar1 && bulkWar2), 'Both bulk repair warranties created in database');

    // Bulk delete the two repairs
    const resBulkDel = await fetch(`${BASE_URL}/repairs/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ ids: [bulkRep1.id, bulkRep2.id] }),
    });
    const bulkDelResult = await resBulkDel.json();

    assert(resBulkDel.status === 200, 'POST /api/repairs/bulk-delete returns HTTP 200');
    assert(bulkDelResult.warrantiesPreserved >= 2, 'Bulk delete response confirms warranties preserved');

    // Verify repairs are gone, warranties survive
    const { data: checkBulkReps } = await supabaseAdmin.from('Repair').select('id').in('id', [bulkRep1.id, bulkRep2.id]);
    assert((checkBulkReps || []).length === 0, 'Both repairs removed from database');

    const { data: checkBulkWars } = await supabaseAdmin.from('BatteryWarranty').select('*').in('id', [bulkWar1.id, bulkWar2.id]);
    assert(checkBulkWars?.length === 2, 'CRITICAL: Both warranties survived bulk repair deletion!');
    assert(checkBulkWars?.every((w: any) => w.repairId === null), 'Both warranties safely unlinked from repairs');

    // =====================================================================
    // TEST 7: 2FA Enforcement on Battery Warranty Deletion
    // =====================================================================
    console.log('\n--- 7. Verification: 2FA Enforcement on Battery Warranty Deletion ---');

    // 7a. Direct single DELETE without 2FA -> Must return HTTP 401
    const resDelNo2FA = await fetch(`${BASE_URL}/battery-warranties/${createdWarranty.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(resDelNo2FA.status === 401, 'DELETE /api/battery-warranties/:id without 2FA code is rejected (HTTP 401)');

    // 7b. Direct single DELETE with invalid 2FA -> Must return HTTP 401
    const resDelBad2FA = await fetch(`${BASE_URL}/battery-warranties/${createdWarranty.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '999999' }),
    });
    assert(resDelBad2FA.status === 401, 'DELETE /api/battery-warranties/:id with invalid 2FA code is rejected (HTTP 401)');

    // 7c. Unauthorized role (e.g. Technician) attempt to delete warranty -> Must return HTTP 403
    const resDelTech = await fetch(`${BASE_URL}/battery-warranties/${createdWarranty.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${techToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '007007' }),
    });
    assert(resDelTech.status === 403, 'Unauthorized role (TECHNICIAN) cannot delete warranty (HTTP 403 Forbidden)');

    // 7d. Bulk delete without 2FA -> Must return HTTP 401
    const resBulkDelNo2FA = await fetch(`${BASE_URL}/battery-warranties/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ ids: [bulkWar1.id] }),
    });
    assert(resBulkDelNo2FA.status === 401, 'POST /api/battery-warranties/bulk-delete without 2FA is rejected (HTTP 401)');

    // 7e. Authorized deletion with valid 2FA code (Super Admin Emergency Key 007007 or live OTP)
    const resDelValid2FA = await fetch(`${BASE_URL}/battery-warranties/${createdWarranty.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '007007' }),
    });
    const delWarData = await resDelValid2FA.json();
    assert(resDelValid2FA.status === 200, 'DELETE /api/battery-warranties/:id with valid 2FA succeeds (HTTP 200)');
    assert(delWarData.success === true, 'Response confirms warranty deletion');

    // Verify warranty is now deleted
    const { data: checkNowDeleted } = await supabaseAdmin
      .from('BatteryWarranty')
      .select('id')
      .eq('id', createdWarranty.id);
    assert((checkNowDeleted || []).length === 0, 'BatteryWarranty permanently removed after verified 2FA');

    // Verify BATTERY_WARRANTY_DELETED audit log entry
    const { data: warDeletedAuditAfter } = await supabaseAdmin
      .from('AuditLog')
      .select('*')
      .eq('action', 'BATTERY_WARRANTY_DELETED')
      .eq('resourceId', createdWarranty.id)
      .limit(1);
    assert(Boolean(warDeletedAuditAfter && warDeletedAuditAfter.length > 0), 'Audit log contains BATTERY_WARRANTY_DELETED with actor details');

    // Clean up test bulk warranties with valid 2FA
    await fetch(`${BASE_URL}/battery-warranties/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ ids: [bulkWar1.id, bulkWar2.id], code: '007007' }),
    });

    // Cleanup no-warranty repair
    await fetch(`${BASE_URL}/repairs/${noWarRepair.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

  } catch (err: any) {
    console.error('TEST EXCEPTION:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runDecouplingTests();
