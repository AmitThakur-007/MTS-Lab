import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface ProtectedAuditEvidenceRecord {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole: string;
  action: 'PERMANENT_LOG_DELETION' | 'PERMANENT_LOG_BULK_DELETION' | 'PERMANENT_LOG_CATEGORY_CLEAR';
  targetCategory: string;
  targetCount: number;
  targetIds?: string[];
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isProtectedEvidence: true;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const PROTECTED_AUDIT_FILE = path.join(DATA_DIR, 'protected_audit_evidence.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[PROTECTED AUDIT DIR INIT WARN]', e);
  }
}

let evidenceCache: ProtectedAuditEvidenceRecord[] = [];
let isLoaded = false;

function loadProtectedAuditFile(): ProtectedAuditEvidenceRecord[] {
  try {
    if (fs.existsSync(PROTECTED_AUDIT_FILE)) {
      const content = fs.readFileSync(PROTECTED_AUDIT_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[PROTECTED AUDIT READ ERROR]', err);
  }
  return [];
}

function persistProtectedAuditFile(records: ProtectedAuditEvidenceRecord[]): void {
  try {
    const tempPath = `${PROTECTED_AUDIT_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tempPath, PROTECTED_AUDIT_FILE);
  } catch (err) {
    console.error('[PROTECTED AUDIT WRITE ERROR]', err);
  }
}

function ensureInitialized(): void {
  if (!isLoaded) {
    evidenceCache = loadProtectedAuditFile();
    isLoaded = true;
  }
}

/**
 * Record an immutable audit log deletion event into the protected evidence stream.
 * This stream is maintained independently of ordinary application logs to prevent recursive
 * deletion loops and preserve permanent forensic auditability.
 */
export async function recordProtectedDeletionAudit(data: {
  actorId: string;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole: string;
  action: 'PERMANENT_LOG_DELETION' | 'PERMANENT_LOG_BULK_DELETION' | 'PERMANENT_LOG_CATEGORY_CLEAR';
  targetCategory: string;
  targetCount: number;
  targetIds?: string[];
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ProtectedAuditEvidenceRecord> {
  ensureInitialized();

  const record: ProtectedAuditEvidenceRecord = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    actorId: data.actorId,
    actorEmail: data.actorEmail || null,
    actorName: data.actorName || null,
    actorRole: data.actorRole,
    action: data.action,
    targetCategory: data.targetCategory,
    targetCount: data.targetCount,
    targetIds: data.targetIds || [],
    reason: data.reason || 'Administrative log maintenance',
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    isProtectedEvidence: true,
  };

  evidenceCache.unshift(record);
  persistProtectedAuditFile(evidenceCache);

  return record;
}

/**
 * Query immutable protected audit evidence. Strictly restricted to Super Admin.
 */
export async function getProtectedAuditEvidence(limit: number = 100): Promise<ProtectedAuditEvidenceRecord[]> {
  ensureInitialized();
  return evidenceCache.slice(0, Math.min(limit, 500));
}

/**
 * Checks if a given ID is a protected audit record (cannot be deleted).
 */
export function isProtectedAuditId(id: string): boolean {
  ensureInitialized();
  return evidenceCache.some(r => r.id === id);
}
