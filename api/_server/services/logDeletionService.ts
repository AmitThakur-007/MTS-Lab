import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedUser } from '../middleware/auth';
import { normalizeRole } from '../middleware/rbac';
import { broadcastServerChange } from './realtimeSync';
import { recordProtectedDeletionAudit, isProtectedAuditId } from './protectedAuditStorage';

export interface DeletionResult {
  success: boolean;
  message: string;
  deletedCount: number;
  deletedIds?: string[];
  category?: string;
}

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Authoritatively verifies that the authenticated requester holds the SUPER_ADMIN role.
 * Non-Super Admins (Admin, Manager, Receptionist, Technician, Customer) are strictly denied.
 */
export function assertSuperAdmin(user?: AuthenticatedUser): void {
  if (!user || !user.id) {
    throw new AuthorizationError('Authentication required to perform administrative deletion.', 401);
  }

  const role = normalizeRole(user.role);
  if (role !== 'SUPER_ADMIN') {
    throw new AuthorizationError(
      `Permission denied: Only the authorized Super Admin can permanently delete security logs and activity records. Current role: ${user.role || 'UNKNOWN'}.`,
      403
    );
  }
}

/**
 * Permanently delete a single security log or activity timeline record.
 * Allowed ONLY for Super Admin. Can delete own records as well as other users' records.
 */
export async function deleteSingleLogRecord(
  logId: string,
  actor: AuthenticatedUser,
  meta: {
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string | null;
    category?: string;
  } = {}
): Promise<DeletionResult> {
  assertSuperAdmin(actor);

  if (!logId || typeof logId !== 'string' || !logId.trim()) {
    throw new ValidationError('A valid log record ID is required for deletion.');
  }

  const cleanId = logId.trim();

  // Safeguard: verify if this is protected compliance evidence
  if (isProtectedAuditId(cleanId)) {
    throw new AuthorizationError(
      'Action prohibited: Protected compliance audit records are immutable and cannot be deleted.',
      403
    );
  }

  // 1. Verify existence and retrieve record details for audit evidence
  const { data: existingRecord, error: fetchErr } = await supabaseAdmin
    .from('AuditLog')
    .select('id, action, resource, userId, userName, userEmail, createdAt')
    .eq('id', cleanId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[LOG DELETION DB FETCH ERROR]', fetchErr);
    throw new Error('Database error occurred while verifying the log record.');
  }

  if (!existingRecord) {
    throw new NotFoundError(`Log record '${cleanId}' was not found or has already been deleted.`);
  }

  // 2. Permanently delete from the database
  const { error: deleteErr } = await supabaseAdmin
    .from('AuditLog')
    .delete()
    .eq('id', cleanId);

  if (deleteErr) {
    console.error('[LOG DELETION DB DELETE ERROR]', deleteErr);
    throw new Error(`Failed to delete log record from database: ${deleteErr.message}`);
  }

  // 3. Record in dedicated protected audit stream (never back into ordinary AuditLog to avoid loops)
  await recordProtectedDeletionAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    actorRole: 'SUPER_ADMIN',
    action: 'PERMANENT_LOG_DELETION',
    targetCategory: meta.category || existingRecord.resource || 'ORDINARY_AUDIT_LOG',
    targetCount: 1,
    targetIds: [cleanId],
    reason: meta.reason || `Single log record (${existingRecord.action}) permanently deleted by Super Admin`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  // 4. Broadcast realtime event so connected dashboards sync immediately
  await broadcastServerChange('AuditLog', 'DELETE', cleanId);

  return {
    success: true,
    message: 'Security log record was permanently deleted.',
    deletedCount: 1,
    deletedIds: [cleanId],
    category: meta.category || existingRecord.resource,
  };
}

/**
 * Permanently delete multiple selected log records in a batch.
 * Allowed ONLY for Super Admin.
 */
export async function bulkDeleteLogRecords(
  logIds: string[],
  actor: AuthenticatedUser,
  meta: {
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string | null;
    category?: string;
  } = {}
): Promise<DeletionResult> {
  assertSuperAdmin(actor);

  if (!Array.isArray(logIds) || logIds.length === 0) {
    throw new ValidationError('A non-empty list of log record IDs is required for bulk deletion.');
  }

  if (logIds.length > 500) {
    throw new ValidationError('Bulk deletion request exceeds maximum safety limit of 500 records per operation.');
  }

  // Clean and deduplicate IDs
  const cleanIds = Array.from(new Set(logIds.map(id => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    throw new ValidationError('No valid record IDs provided.');
  }

  // Filter out any protected compliance IDs
  const targetIds = cleanIds.filter(id => !isProtectedAuditId(id));
  if (targetIds.length === 0) {
    throw new AuthorizationError('Action prohibited: Selected records contain only protected immutable audit evidence.', 403);
  }

  // 1. Verify how many actually exist
  const { data: existingRecords, error: verifyErr } = await supabaseAdmin
    .from('AuditLog')
    .select('id')
    .in('id', targetIds);

  if (verifyErr) {
    console.error('[BULK LOG DELETION VERIFY ERROR]', verifyErr);
    throw new Error('Database error occurred while verifying target records.');
  }

  const existingIds = (existingRecords || []).map(r => r.id);
  if (existingIds.length === 0) {
    return {
      success: true,
      message: 'None of the requested log records were found or they were already deleted.',
      deletedCount: 0,
      deletedIds: [],
    };
  }

  // 2. Permanently delete matching records
  const { error: deleteErr } = await supabaseAdmin
    .from('AuditLog')
    .delete()
    .in('id', existingIds);

  if (deleteErr) {
    console.error('[BULK LOG DELETION EXECUTE ERROR]', deleteErr);
    throw new Error(`Failed to execute bulk deletion: ${deleteErr.message}`);
  }

  // 3. Record in dedicated protected audit stream
  await recordProtectedDeletionAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    actorRole: 'SUPER_ADMIN',
    action: 'PERMANENT_LOG_BULK_DELETION',
    targetCategory: meta.category || 'BULK_SELECTION',
    targetCount: existingIds.length,
    targetIds: existingIds,
    reason: meta.reason || `Bulk deletion of ${existingIds.length} log records executed by Super Admin`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  // 4. Broadcast realtime event for deleted records
  for (const id of existingIds) {
    await broadcastServerChange('AuditLog', 'DELETE', id);
  }

  return {
    success: true,
    message: `Successfully permanently deleted ${existingIds.length} log records.`,
    deletedCount: existingIds.length,
    deletedIds: existingIds,
    category: meta.category,
  };
}

/**
 * Clear all ordinary log records within an authorized category or scope.
 * Requires explicit double-confirmation phrase 'PERMANENTLY_DELETE'.
 * Allowed ONLY for Super Admin.
 */
export async function clearLogCategoryRecords(
  scope: {
    category?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    confirmPhrase: string;
  },
  actor: AuthenticatedUser,
  meta: {
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string | null;
  } = {}
): Promise<DeletionResult> {
  assertSuperAdmin(actor);

  if (!scope.confirmPhrase || scope.confirmPhrase.trim().toUpperCase() !== 'PERMANENTLY_DELETE') {
    throw new ValidationError("Confirmation mismatch: You must provide confirmation phrase 'PERMANENTLY_DELETE' to execute dataset purge.");
  }

  const category = (scope.category || 'ALL').toUpperCase().trim();

  // 1. Build targeted query to determine records to delete
  let query = supabaseAdmin.from('AuditLog').select('id');

  if (category === 'AUTH') {
    query = query.in('action', [
      'LOGIN', 'LOGIN_SUCCESS', 'LOGOUT', '2FA_VERIFY', '2FA_VERIFIED',
      'OTP_VERIFICATION_SUCCESS', 'OTP_VERIFICATION_FAILED', 'OTP_REQUESTED',
      'LOGIN_2FA', 'PASSWORD_RESET', 'FAILED_LOGIN', 'LOGIN_FAILED'
    ]);
  } else if (category === 'SECURITY') {
    query = query.in('action', [
      'FAILED_LOGIN', 'LOGIN_FAILED', 'LOGIN_BLOCKED_DEVICE', 'LOGIN_DISABLED_ACCOUNT',
      'DEVICE_BLOCKED', 'DEVICE_REVOKED', 'DEVICE_UNBLOCKED', 'DEVICE_DELETED',
      'ACCESS_REQUEST_REJECTED', 'ACCESS_REQUEST_APPROVED', 'ACCOUNT_DISABLED',
      'USER_ROLE_CHANGED', 'DATA_PURGED', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'UNAUTHORIZED_USER_MUTATION'
    ]);
  } else if (category === 'DATA_MUTATION') {
    query = query.or('action.ilike.%CREATE%,action.ilike.%UPDATE%,action.ilike.%DELETE%');
  }

  if (scope.userId && scope.userId !== 'ALL') {
    query = query.eq('userId', scope.userId);
  }

  if (scope.startDate) {
    const startIso = scope.startDate.includes('T') ? scope.startDate : `${scope.startDate}T00:00:00.000Z`;
    query = query.gte('createdAt', startIso);
  }

  if (scope.endDate) {
    const endIso = scope.endDate.includes('T') ? scope.endDate : `${scope.endDate}T23:59:59.999Z`;
    query = query.lte('createdAt', endIso);
  }

  // Safe upper limit per purge operation to avoid timeouts
  const { data: matchingRecords, error: fetchErr } = await query.limit(2000);
  if (fetchErr) {
    console.error('[CLEAR LOGS QUERY ERROR]', fetchErr);
    throw new Error('Database error occurred while querying records for purge.');
  }

  const idsToDelete = (matchingRecords || []).map(r => r.id).filter(id => !isProtectedAuditId(id));
  if (idsToDelete.length === 0) {
    return {
      success: true,
      message: `No log records found matching scope '${category}'.`,
      deletedCount: 0,
      deletedIds: [],
      category,
    };
  }

  // 2. Delete in batches of 200 for database reliability
  const BATCH_SIZE = 200;
  let totalDeleted = 0;

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    const { error: batchErr } = await supabaseAdmin
      .from('AuditLog')
      .delete()
      .in('id', batch);

    if (batchErr) {
      console.error('[CLEAR LOGS BATCH DELETE ERROR]', batchErr);
      throw new Error(`Failed during batch deletion: ${batchErr.message}`);
    }
    totalDeleted += batch.length;
  }

  // 3. Record in dedicated protected audit stream
  await recordProtectedDeletionAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    actorRole: 'SUPER_ADMIN',
    action: 'PERMANENT_LOG_CATEGORY_CLEAR',
    targetCategory: category,
    targetCount: totalDeleted,
    targetIds: idsToDelete.slice(0, 50), // Store sample of IDs for evidence
    reason: meta.reason || `Category clear of ${totalDeleted} records in category '${category}' by Super Admin`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  // 4. Broadcast global table update
  await broadcastServerChange('AuditLog', 'DELETE', 'BULK_PURGE');

  return {
    success: true,
    message: `Successfully cleared ${totalDeleted} log records from '${category}' category.`,
    deletedCount: totalDeleted,
    category,
  };
}
