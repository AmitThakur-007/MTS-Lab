import { Router, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';

const router = Router();
const BUCKET = 'system-backups';
const PAGE_SIZE = 1000;

// These are application data tables. Authentication/session secrets that can
// be regenerated are deliberately excluded from backups.
const BACKUP_TABLES = [
  'Branch', 'User', 'Customer', 'Product', 'InventoryCategory', 'InventoryItem',
  'InventoryTransaction', 'Repair', 'RepairLog', 'TechnicianNote', 'Payment',
  'BatteryWarranty', 'BatteryWarrantyClaim', 'Attendance', 'AttendanceAuditLog',
  'AttendanceBroadcast', 'RepairRelatedDamage', 'RepairRelatedDamageAudit',
  'RepairTransferRequest', 'Notification', 'ApprovedDevice', 'AccessRequest',
  'AuditLog', 'LoginActivity', 'AppletShare', 'HomeSlide', 'RepairPriceFolder',
  'RepairPrice'
] as const;

const EPHEMERAL_TABLES = ['Session', 'OTPVerification', 'PasswordResetToken'] as const;

const hasServiceRole = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(key && key.length > 50);
};

const getEncryptionKey = () => {
  const raw = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is not configured.');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;
  if (Buffer.byteLength(raw, 'utf8') === 32) return Buffer.from(raw, 'utf8');
  throw new Error('BACKUP_ENCRYPTION_KEY must represent exactly 32 bytes.');
};

const encrypt = (value: unknown) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('MTSB1'), iv, tag, ciphertext]);
};

const decrypt = (buffer: Buffer) => {
  const key = getEncryptionKey();
  if (buffer.subarray(0, 5).toString() !== 'MTSB1') throw new Error('Unsupported backup format.');
  const iv = buffer.subarray(5, 17);
  const tag = buffer.subarray(17, 33);
  const ciphertext = buffer.subarray(33);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
};

const ensureBucket = async () => {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw listError;
  if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
};

const readTable = async (table: string) => {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
};

const collectCloudinaryUrls = (value: unknown, result = new Set<string>()) => {
  if (typeof value === 'string' && /cloudinary\.com\//i.test(value)) result.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectCloudinaryUrls(item, result));
  else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((item) => collectCloudinaryUrls(item, result));
  return result;
};

router.get('/backups', authenticate, authorize(['SUPER_ADMIN']), async (_req: AuthRequest, res: Response) => {
  if (!hasServiceRole()) return res.status(503).json({ error: 'Backup service is not configured on the server.' });
  try {
    const { data, error } = await supabaseAdmin.from('SystemBackup').select('id,fileName,sizeBytes,checksum,createdByName,status,createdAt,completedAt').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to load backups.' });
    return res.json({ success: true, data: data || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to load backups.' });
  }
});

router.post('/backups', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  if (!hasServiceRole()) return res.status(503).json({ error: 'Backup service requires SUPABASE_SERVICE_ROLE_KEY.' });
  const id = uuidv4();
  try {
    await ensureBucket();
    const snapshot: Record<string, unknown> = { version: 1, generatedAt: new Date().toISOString(), tables: {} };
    for (const table of BACKUP_TABLES) {
      (snapshot.tables as Record<string, unknown>)[table] = await readTable(table);
    }
    // Never persist reusable authentication secrets/tokens in a backup.
    snapshot.excludedTables = [...EPHEMERAL_TABLES];
    snapshot.mediaManifest = Array.from(collectCloudinaryUrls(snapshot.tables));

    const encrypted = encrypt(snapshot);
    const checksum = crypto.createHash('sha256').update(encrypted).digest('hex');
    const fileName = `mts-lab-${new Date().toISOString().replace(/[:.]/g, '-')}-${id}.mtsb`;
    const storagePath = `backups/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, encrypted, {
      contentType: 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: metadataError } = await supabaseAdmin.from('SystemBackup').insert([{
      id,
      fileName,
      storagePath,
      sizeBytes: encrypted.length,
      checksum,
      createdById: req.user!.id,
      createdByName: req.user!.name,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    }]);
    if (metadataError) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      throw metadataError;
    }

    await logAudit({ userId: req.user!.id, action: 'BACKUP_CREATED', resource: 'SystemBackup', resourceId: id, details: { fileName, sizeBytes: encrypted.length, checksum } });
    return res.status(201).json({ success: true, id, message: 'Encrypted system backup created successfully.' });
  } catch (error: any) {
    await supabaseAdmin.from('SystemBackup').upsert([{
      id,
      fileName: `failed-${id}`,
      storagePath: `failed/${id}`,
      sizeBytes: 0,
      checksum: 'FAILED',
      createdById: req.user!.id,
      createdByName: req.user!.name,
      status: 'FAILED',
      errorMessage: error?.message || 'Unknown backup error',
    }], { onConflict: 'id' }).catch(() => undefined);
    await logAudit({ userId: req.user!.id, action: 'BACKUP_FAILED', resource: 'SystemBackup', resourceId: id, status: 'FAILED', details: { message: error?.message || 'Unknown backup error' } });
    return res.status(500).json({ error: error?.message || 'Backup creation failed.' });
  }
});

router.get('/backups/:id/download', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  if (!hasServiceRole()) return res.status(503).json({ error: 'Backup service is not configured on the server.' });
  try {
    const { data: backup, error } = await supabaseAdmin.from('SystemBackup').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !backup || backup.status !== 'COMPLETED') return res.status(404).json({ error: 'Backup not found.' });
    const { data, error: signedError } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(backup.storagePath, 60);
    if (signedError || !data?.signedUrl) return res.status(500).json({ error: 'Unable to create a protected download URL.' });
    await logAudit({ userId: req.user!.id, action: 'BACKUP_DOWNLOADED', resource: 'SystemBackup', resourceId: backup.id });
    return res.json({ success: true, url: data.signedUrl });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Unable to download backup.' });
  }
});

router.delete('/backups/:id', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  if (!hasServiceRole()) return res.status(503).json({ error: 'Backup service is not configured on the server.' });
  try {
    const { data: backup, error } = await supabaseAdmin.from('SystemBackup').select('id,storagePath').eq('id', req.params.id).maybeSingle();
    if (error || !backup) return res.status(404).json({ error: 'Backup not found.' });
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([backup.storagePath]);
    if (removeError) return res.status(500).json({ error: 'Backup file could not be removed.' });
    const { error: deleteError } = await supabaseAdmin.from('SystemBackup').delete().eq('id', backup.id);
    if (deleteError) return res.status(500).json({ error: 'Backup metadata could not be removed.' });
    await logAudit({ userId: req.user!.id, action: 'BACKUP_DELETED', resource: 'SystemBackup', resourceId: backup.id });
    return res.json({ success: true, message: 'Backup deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Unable to delete backup.' });
  }
});

router.post('/backups/:id/restore', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  if (!hasServiceRole()) return res.status(503).json({ error: 'Backup restore requires SUPABASE_SERVICE_ROLE_KEY.' });
  if (req.body?.confirmation !== 'RESTORE') return res.status(400).json({ error: 'Restore confirmation is required.' });
  try {
    // A safety snapshot is mandatory before restore.
    const safety = await fetch(`${req.protocol}://${req.get('host')}/api/admin/backups`, {
      method: 'POST',
      headers: { authorization: req.headers.authorization || '', 'content-type': 'application/json', cookie: req.headers.cookie || '' },
      body: '{}',
    });
    if (!safety.ok) return res.status(409).json({ error: 'Restore blocked because a safety backup could not be created.' });

    const { data: backup, error } = await supabaseAdmin.from('SystemBackup').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !backup || backup.status !== 'COMPLETED') return res.status(404).json({ error: 'Backup not found.' });
    const { data: file, error: downloadError } = await supabaseAdmin.storage.from(BUCKET).download(backup.storagePath);
    if (downloadError || !file) return res.status(500).json({ error: 'Backup file could not be read.' });
    const encrypted = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash('sha256').update(encrypted).digest('hex');
    if (checksum !== backup.checksum) return res.status(409).json({ error: 'Backup integrity check failed.' });
    const snapshot = decrypt(encrypted);
    const { data: restoreResult, error: restoreError } = await supabaseAdmin.rpc('restore_system_backup', { payload: snapshot.tables });
    if (restoreError) return res.status(500).json({ error: `Restore failed: ${restoreError.message}` });
    await logAudit({ userId: req.user!.id, action: 'BACKUP_RESTORED', resource: 'SystemBackup', resourceId: backup.id, details: { restoredTables: restoreResult?.restoredTables || [] } });
    return res.json({ success: true, message: 'Backup restored successfully. Active sessions and temporary authentication tokens were intentionally not restored.' });
  } catch (error: any) {
    await logAudit({ userId: req.user!.id, action: 'BACKUP_RESTORE_FAILED', resource: 'SystemBackup', resourceId: req.params.id, status: 'FAILED', details: { message: error?.message || 'Unknown restore error' } });
    return res.status(500).json({ error: error?.message || 'Backup restore failed.' });
  }
});

export default router;
