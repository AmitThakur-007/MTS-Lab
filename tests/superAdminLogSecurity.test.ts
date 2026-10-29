import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  assertSuperAdmin,
  deleteSingleLogRecord,
  bulkDeleteLogRecords,
  clearLogCategoryRecords,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../api/_server/services/logDeletionService';
import {
  recordProtectedDeletionAudit,
  getProtectedAuditEvidence,
  isProtectedAuditId,
} from '../api/_server/services/protectedAuditStorage';
import { supabaseAdmin } from '../api/_server/config/supabase';

const projectRoot = process.cwd();

// Mock Users for Testing
const superAdminUser = {
  id: 'usr_super_admin_test_001',
  email: 'superadmin@mtslab.com',
  name: 'Super Admin User',
  role: 'SUPER_ADMIN',
};

const adminUser = {
  id: 'usr_admin_test_002',
  email: 'admin@mtslab.com',
  name: 'Admin User',
  role: 'ADMIN',
};

const managerUser = {
  id: 'usr_manager_test_003',
  email: 'manager@mtslab.com',
  name: 'Manager User',
  role: 'MANAGER',
};

const receptionistUser = {
  id: 'usr_receptionist_test_004',
  email: 'receptionist@mtslab.com',
  name: 'Receptionist User',
  role: 'RECEPTIONIST',
};

const leadTechUser = {
  id: 'usr_lead_tech_test_005',
  email: 'leadtech@mtslab.com',
  name: 'Lead Technician User',
  role: 'LEAD_TECHNICIAN',
};

const techUser = {
  id: 'usr_tech_test_006',
  email: 'tech@mtslab.com',
  name: 'Technician User',
  role: 'TECHNICIAN',
};

const techAssistantUser = {
  id: 'usr_assistant_test_007',
  email: 'assistant@mtslab.com',
  name: 'Technical Assistant User',
  role: 'TECHNICAL_ASSISTANT',
};

const customerUser = {
  id: 'usr_customer_test_008',
  email: 'customer@gmail.com',
  name: 'Customer User',
  role: 'CUSTOMER',
};

test('Test A1: assertSuperAdmin grants permission exclusively to SUPER_ADMIN', () => {
  // Should succeed without throwing
  assert.doesNotThrow(() => assertSuperAdmin(superAdminUser));
  assert.doesNotThrow(() => assertSuperAdmin({ ...superAdminUser, role: 'SUPERADMIN' }));
  assert.doesNotThrow(() => assertSuperAdmin({ ...superAdminUser, role: 'super_admin' }));
});

test('Test B1: assertSuperAdmin rejects all non-Super-Admin roles with HTTP 403', () => {
  const nonSuperRoles = [
    adminUser,
    managerUser,
    receptionistUser,
    leadTechUser,
    techUser,
    techAssistantUser,
    customerUser,
  ];

  for (const nonAdmin of nonSuperRoles) {
    assert.throws(
      () => assertSuperAdmin(nonAdmin),
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Only the authorized Super Admin'));
        return true;
      },
      `Role ${nonAdmin.role} should be denied with 403`
    );
  }
});

test('Test C1: assertSuperAdmin rejects unauthenticated requests with HTTP 401', () => {
  assert.throws(
    () => assertSuperAdmin(undefined),
    (err: any) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 401);
      return true;
    }
  );

  assert.throws(
    () => assertSuperAdmin({} as any),
    (err: any) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 401);
      return true;
    }
  );
});

test('Test A2: Super Admin can delete a log record created by another user or by themselves', async () => {
  // Query real users to satisfy foreign key constraint on User(id)
  const { data: realUsers } = await supabaseAdmin.from('User').select('id, name, email, role').limit(5);
  const realSuperAdmin = realUsers?.find(u => u.role === 'SUPER_ADMIN') || realUsers?.[0];
  const realStaff = realUsers?.find(u => u.role !== 'SUPER_ADMIN') || realUsers?.[1];

  const testSuperAdmin = realSuperAdmin ? {
    id: realSuperAdmin.id,
    email: realSuperAdmin.email,
    name: realSuperAdmin.name,
    role: 'SUPER_ADMIN',
  } : superAdminUser;

  // 1. Create a dummy test log belonging to another user
  const otherLogId = uuidv4();
  const { error: ins1Err } = await supabaseAdmin.from('AuditLog').insert([
    {
      id: otherLogId,
      userId: realStaff?.id || null,
      userName: realStaff?.name || 'Staff Member',
      userEmail: realStaff?.email || 'staff@mtslab.com',
      userRole: realStaff?.role || 'TECHNICIAN',
      action: 'REPAIR_STATUS_CHANGED',
      resource: 'Repair',
      status: 'SUCCESS',
      details: 'Staff test repair status update',
      createdAt: new Date().toISOString(),
    },
  ]);
  assert.equal(ins1Err, null, 'Insert log for other user should succeed');

  // Super Admin deletes technician's log
  const delOtherResult = await deleteSingleLogRecord(otherLogId, testSuperAdmin, {
    reason: 'Super Admin deletion test for other user',
    category: 'Repair',
  });
  assert.ok(delOtherResult.success);
  assert.equal(delOtherResult.deletedCount, 1);

  // Verify record is gone from AuditLog
  const { data: checkDeleted } = await supabaseAdmin.from('AuditLog').select('id').eq('id', otherLogId).maybeSingle();
  assert.equal(checkDeleted, null, 'Record should no longer exist in AuditLog table');

  // 2. Create a dummy test log belonging to Super Admin (own log)
  const ownLogId = uuidv4();
  const { error: ins2Err } = await supabaseAdmin.from('AuditLog').insert([
    {
      id: ownLogId,
      userId: realSuperAdmin?.id || null,
      userName: testSuperAdmin.name,
      userEmail: testSuperAdmin.email,
      userRole: 'SUPER_ADMIN',
      action: 'PASSWORD_CHANGED',
      resource: 'AUTH',
      status: 'SUCCESS',
      details: 'Super Admin password change event',
      createdAt: new Date().toISOString(),
    },
  ]);
  assert.equal(ins2Err, null, 'Insert log for own user should succeed');

  // Super Admin deletes own log
  const delOwnResult = await deleteSingleLogRecord(ownLogId, testSuperAdmin, {
    reason: 'Super Admin deleting own log',
    category: 'AUTH',
  });
  assert.ok(delOwnResult.success);
  assert.equal(delOwnResult.deletedCount, 1);

  // Verify own record is gone
  const { data: checkOwnDeleted } = await supabaseAdmin.from('AuditLog').select('id').eq('id', ownLogId).maybeSingle();
  assert.equal(checkOwnDeleted, null, 'Super Admin own log should be permanently deleted');
});

test('Test B2: Non-Super-Admin roles are rejected when attempting single or bulk log deletion', async () => {
  const dummyLogId = uuidv4();

  // Test Admin, Manager, Receptionist, Technician
  for (const user of [adminUser, managerUser, receptionistUser, techUser, customerUser]) {
    await assert.rejects(
      async () => {
        await deleteSingleLogRecord(dummyLogId, user);
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await bulkDeleteLogRecords([dummyLogId], user);
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await clearLogCategoryRecords(
          { category: 'ALL', confirmPhrase: 'PERMANENTLY_DELETE' },
          user
        );
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  }
});

test('Test D1: Direct API & Object-ID attacks (invalid IDs, missing IDs, oversized bulk)', async () => {
  // Empty ID for single delete
  await assert.rejects(
    async () => {
      await deleteSingleLogRecord('', superAdminUser);
    },
    (err: any) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );

  // Non-existent ID throws 404 NotFound
  await assert.rejects(
    async () => {
      await deleteSingleLogRecord('non_existent_fake_uuid_9999', superAdminUser);
    },
    (err: any) => {
      assert.ok(err instanceof NotFoundError);
      assert.equal(err.statusCode, 404);
      return true;
    }
  );

  // Bulk delete with empty array
  await assert.rejects(
    async () => {
      await bulkDeleteLogRecords([], superAdminUser);
    },
    (err: any) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );

  // Bulk delete with oversized payload (> 500)
  const hugeIdList = Array.from({ length: 501 }, (_, i) => `id_${i}`);
  await assert.rejects(
    async () => {
      await bulkDeleteLogRecords(hugeIdList, superAdminUser);
    },
    (err: any) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('exceeds maximum safety limit'));
      return true;
    }
  );

  // Clear without exact confirmation phrase
  await assert.rejects(
    async () => {
      await clearLogCategoryRecords(
        { category: 'ALL', confirmPhrase: 'WRONG_CONFIRMATION' },
        superAdminUser
      );
    },
    (err: any) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('PERMANENTLY_DELETE'));
      return true;
    }
  );
});

test('Test E1: Deletion records write to separate protected stream and prevent recursive loops', async () => {
  // Check count of AuditLog before recording protected deletion
  const { count: initialAuditLogCount } = await supabaseAdmin
    .from('AuditLog')
    .select('id', { count: 'exact', head: true });

  // Record an action in protected audit storage
  const protectedRecord = await recordProtectedDeletionAudit({
    actorId: superAdminUser.id,
    actorEmail: superAdminUser.email,
    actorName: superAdminUser.name,
    actorRole: 'SUPER_ADMIN',
    action: 'PERMANENT_LOG_DELETION',
    targetCategory: 'TEST_CATEGORY',
    targetCount: 1,
    targetIds: ['test-id-123'],
    reason: 'Compliance evidence preservation test',
  });

  assert.ok(protectedRecord.id);
  assert.equal(protectedRecord.isProtectedEvidence, true);

  // Verify that protected audit storage did NOT insert into ordinary AuditLog
  const { count: afterAuditLogCount } = await supabaseAdmin
    .from('AuditLog')
    .select('id', { count: 'exact', head: true });

  assert.equal(
    afterAuditLogCount,
    initialAuditLogCount,
    'Ordinary AuditLog count must not increase when logging deletion, preventing recursive loops'
  );

  // Verify protected audit evidence is retrieved
  const evidenceList = await getProtectedAuditEvidence(10);
  assert.ok(evidenceList.length > 0);
  const found = evidenceList.find((e) => e.id === protectedRecord.id);
  assert.ok(found, 'Protected deletion record must be in protected audit evidence list');

  // Verify protected audit ID cannot be deleted
  assert.equal(isProtectedAuditId(protectedRecord.id), true);
  await assert.rejects(
    async () => {
      await deleteSingleLogRecord(protectedRecord.id, superAdminUser);
    },
    (err: any) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 403);
      assert.ok(err.message.includes('Protected compliance audit records are immutable'));
      return true;
    }
  );
});

test('Test F1: Backend routes files enforce SUPER_ADMIN authorization', () => {
  const superAdminRoutesPath = path.join(projectRoot, 'api/_server/routes/superAdmin.ts');
  const securityRoutesPath = path.join(projectRoot, 'api/_server/routes/security.ts');

  assert.ok(fs.existsSync(superAdminRoutesPath), 'superAdmin.ts exists');
  assert.ok(fs.existsSync(securityRoutesPath), 'security.ts exists');

  const superAdminContent = fs.readFileSync(superAdminRoutesPath, 'utf-8');
  assert.ok(
    superAdminContent.includes("router.delete('/audit-logs/:id', authenticate, authorize(['SUPER_ADMIN'])"),
    'superAdmin.ts enforces authorize([SUPER_ADMIN]) on DELETE /audit-logs/:id'
  );
  assert.ok(
    superAdminContent.includes("router.post('/audit-logs/bulk-delete', authenticate, authorize(['SUPER_ADMIN'])"),
    'superAdmin.ts enforces authorize([SUPER_ADMIN]) on POST /audit-logs/bulk-delete'
  );
  assert.ok(
    superAdminContent.includes("router.post('/audit-logs/clear', authenticate, authorize(['SUPER_ADMIN'])"),
    'superAdmin.ts enforces authorize([SUPER_ADMIN]) on POST /audit-logs/clear'
  );
  assert.ok(
    superAdminContent.includes("router.get('/protected-audit-evidence', authenticate, authorize(['SUPER_ADMIN'])"),
    'superAdmin.ts enforces authorize([SUPER_ADMIN]) on GET /protected-audit-evidence'
  );

  const securityContent = fs.readFileSync(securityRoutesPath, 'utf-8');
  assert.ok(
    securityContent.includes("router.delete('/activity-timeline/:id', authorize(['SUPER_ADMIN'])"),
    'security.ts enforces authorize([SUPER_ADMIN]) on DELETE /activity-timeline/:id'
  );
  assert.ok(
    securityContent.includes("router.post('/activity-timeline/bulk-delete', authorize(['SUPER_ADMIN'])"),
    'security.ts enforces authorize([SUPER_ADMIN]) on POST /activity-timeline/bulk-delete'
  );
  assert.ok(
    securityContent.includes("router.post('/activity-timeline/clear', authorize(['SUPER_ADMIN'])"),
    'security.ts enforces authorize([SUPER_ADMIN]) on POST /activity-timeline/clear'
  );
});

test('Test F2: Frontend interfaces conditionally render deletion controls strictly for Super Admin', () => {
  const superAdminPagePath = path.join(projectRoot, 'src/pages/dashboard/SuperAdmin.tsx');
  const timelineComponentPath = path.join(projectRoot, 'src/components/security/ActivityTimelineSurveillance.tsx');

  assert.ok(fs.existsSync(superAdminPagePath), 'SuperAdmin.tsx exists');
  assert.ok(fs.existsSync(timelineComponentPath), 'ActivityTimelineSurveillance.tsx exists');

  const superAdminContent = fs.readFileSync(superAdminPagePath, 'utf-8');
  assert.ok(superAdminContent.includes("const isSuperAdmin = user?.role === 'SUPER_ADMIN'"), 'SuperAdmin checks role');
  assert.ok(superAdminContent.includes('{isSuperAdmin && ('), 'SuperAdmin wraps controls in isSuperAdmin condition');
  assert.ok(superAdminContent.includes('isSingleDeleteOpen'), 'SuperAdmin has single delete dialog');
  assert.ok(superAdminContent.includes('isBulkDeleteOpen'), 'SuperAdmin has bulk delete dialog');
  assert.ok(superAdminContent.includes('isClearLogsOpen'), 'SuperAdmin has clear logs dialog');
  assert.ok(superAdminContent.includes('PERMANENTLY_DELETE'), 'SuperAdmin requires PERMANENTLY_DELETE phrase');

  const timelineContent = fs.readFileSync(timelineComponentPath, 'utf-8');
  assert.ok(timelineContent.includes("const isSuperAdmin = user?.role === 'SUPER_ADMIN'"), 'ActivityTimelineSurveillance checks role');
  assert.ok(timelineContent.includes('{isSuperAdmin && ('), 'ActivityTimelineSurveillance wraps controls in isSuperAdmin condition');
  assert.ok(timelineContent.includes('bulk-delete-timeline-btn'), 'ActivityTimelineSurveillance has bulk delete button');
  assert.ok(timelineContent.includes('clear-timeline-btn'), 'ActivityTimelineSurveillance has clear timeline button');
  assert.ok(timelineContent.includes('PERMANENTLY_DELETE'), 'ActivityTimelineSurveillance requires PERMANENTLY_DELETE phrase');
});

test('Test Final: Clean process teardown', () => {
  setTimeout(() => process.exit(0), 100).unref();
});

