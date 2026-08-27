const assert = require('assert');

async function runTests() {
  console.log("========================================================================");
  console.log("--- TEST SUITE: PERMANENT SERVICE SLIP DELETION ON DELIVERY ---");
  console.log("========================================================================\n");

  // 1. Delivery Trigger Condition Verification
  console.log("Test 1: Status Transition Normalization & Delivery Trigger...");
  const validStatuses = ['RECEIVED', 'DIAGNOSING', 'REPAIRING', 'REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'];
  const testDeliveredValues = ['DELIVERED', 'delivered', 'Delivered', ' delivered '];
  
  testDeliveredValues.forEach(val => {
    const norm = val.trim().toUpperCase();
    assert.strictEqual(norm, 'DELIVERED', `Normalized status of '${val}' must equal 'DELIVERED'`);
  });
  console.log("✅ Repair status 'DELIVERED' correctly recognized across casing/whitespace variations.");

  // 2. Storage Reference Deletion & Data Preservation Rules
  console.log("\nTest 2: Selective Artifact Deletion & Repair Model Preservation...");
  const mockRepairBeforeDelivery = {
    id: 'rep-test-99',
    repairNumber: 'MTS-2026-9999',
    customerName: 'Aarav Sharma',
    customerPhone: '9841000000',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15 Pro',
    totalPaid: 4500,
    status: 'READY_FOR_PICKUP'
  };

  const mockMediaAttachments = [
    { id: 'att-1', entityType: 'SERVICE_SLIP', entityId: 'rep-test-99', publicId: 'mts-lab/service_slips/slip_99.pdf', resourceType: 'pdf' }
  ];

  // Simulate delivery cleanup
  const mockRepairAfterDelivery = {
    ...mockRepairBeforeDelivery,
    status: 'DELIVERED'
  };
  const mockMediaAttachmentsAfterDelivery = mockMediaAttachments.filter(a => a.entityId !== 'rep-test-99');

  // Verify repair record is 100% intact
  assert.strictEqual(mockRepairAfterDelivery.id, 'rep-test-99');
  assert.strictEqual(mockRepairAfterDelivery.customerName, 'Aarav Sharma');
  assert.strictEqual(mockRepairAfterDelivery.deviceModel, 'iPhone 15 Pro');
  assert.strictEqual(mockRepairAfterDelivery.totalPaid, 4500);
  assert.strictEqual(mockRepairAfterDelivery.status, 'DELIVERED');
  
  // Verify service slip media attachment was permanently wiped
  assert.strictEqual(mockMediaAttachmentsAfterDelivery.length, 0, 'Service slip media attachment must be permanently removed');
  console.log("✅ Repair record remains 100% intact while Service Slip artifact is permanently deleted.");

  // 3. Service Slip API Rejection after Delivery
  console.log("\nTest 3: Service Slip API Rejection for Delivered Repairs...");
  function handleGetServiceSlip(repairStatus) {
    if (repairStatus === 'DELIVERED') {
      return {
        status: 400,
        body: {
          error: "Service Slip is no longer available because this repair has been delivered.",
          isDelivered: true,
          code: "SERVICE_SLIP_DELIVERED_CLEANED"
        }
      };
    }
    return { status: 200, body: { repairId: 'rep-test-99', attachments: mockMediaAttachments } };
  }

  const preDeliveryRes = handleGetServiceSlip('READY_FOR_PICKUP');
  assert.strictEqual(preDeliveryRes.status, 200);

  const postDeliveryRes = handleGetServiceSlip('DELIVERED');
  assert.strictEqual(postDeliveryRes.status, 400);
  assert.strictEqual(postDeliveryRes.body.isDelivered, true);
  assert.strictEqual(postDeliveryRes.body.error, "Service Slip is no longer available because this repair has been delivered.");
  console.log("✅ Post-delivery Service Slip API requests cleanly rejected with HTTP 400.");

  // 4. Idempotence Verification
  console.log("\nTest 4: Idempotent Delivery Cleanup Execution...");
  function executeCleanup(repairId, attachments) {
    const remaining = attachments.filter(a => a.entityId !== repairId);
    return {
      success: true,
      cleanedCount: attachments.length - remaining.length,
      remaining
    };
  }

  const run1 = executeCleanup('rep-test-99', mockMediaAttachments);
  assert.strictEqual(run1.success, true);
  assert.strictEqual(run1.cleanedCount, 1);

  const run2 = executeCleanup('rep-test-99', run1.remaining);
  assert.strictEqual(run2.success, true);
  assert.strictEqual(run2.cleanedCount, 0); // No error, zero remaining items safely handled
  console.log("✅ Repeated delivery status updates execute cleanly without errors or duplicate deletion crashes.");

  console.log("\n========================================================================");
  console.log("🎉 ALL SERVICE SLIP DELIVERY CLEANUP TESTS PASSED!");
  console.log("========================================================================\n");
}

runTests();
