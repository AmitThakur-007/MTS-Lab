import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../api/_server/config/supabase';

export interface MigrationSummary {
  file: string;
  found: boolean;
  totalInFile: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  currentDbCount: number;
}

export async function migrateLegacyJsonToSupabase(dataDir: string = path.join(process.cwd(), 'data')): Promise<{
  notifications: MigrationSummary;
  attendance: MigrationSummary;
  attendanceAudit: MigrationSummary;
}> {
  console.log(`[DATA MIGRATION] Starting inspection of legacy storage in: ${dataDir}`);

  // 1. Notifications
  const notifFile = path.join(dataDir, 'notifications.json');
  const notifSummary: MigrationSummary = {
    file: notifFile,
    found: fs.existsSync(notifFile),
    totalInFile: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    currentDbCount: 0,
  };

  const { count: initialNotifCount } = await supabaseAdmin
    .from('Notification')
    .select('id', { count: 'exact', head: true });
  notifSummary.currentDbCount = initialNotifCount || 0;

  if (notifSummary.found) {
    try {
      const raw = fs.readFileSync(notifFile, 'utf-8');
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        notifSummary.totalInFile = records.length;

        // Fetch fallback admin user ID for any records lacking valid userId
        const { data: admins } = await supabaseAdmin
          .from('User')
          .select('id')
          .is('deletedAt', null)
          .in('role', ['SUPER_ADMIN', 'ADMIN'])
          .limit(1);
        const fallbackUserId = admins?.[0]?.id || '126a924b-af24-445f-a7b8-a67ba824b15c';

        for (const item of records) {
          if (!item.id || !item.title) {
            notifSummary.skipped++;
            continue;
          }

          const resolvedUserId = item.userId || fallbackUserId;
          const metaObj = {
            ...(typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {}),
            ...(item.link ? { link: item.link } : {}),
            ...(item.targetRole ? { targetRole: item.targetRole } : {}),
            ...(item.senderRole ? { senderRole: item.senderRole } : {}),
          };

          const payload = {
            id: item.id,
            userId: resolvedUserId,
            title: String(item.title).trim(),
            message: String(item.message || '').trim(),
            type: item.type || 'GENERAL',
            repairId: item.repairId || null,
            repairNumber: item.repairNumber || null,
            senderId: item.senderId || null,
            senderName: item.senderName || null,
            priority: item.priority || 'NORMAL',
            metadata: JSON.stringify(metaObj),
            isRead: Boolean(item.isRead),
            readAt: item.readAt || null,
            createdAt: item.createdAt || new Date().toISOString(),
          };

          const { error } = await supabaseAdmin
            .from('Notification')
            .upsert(payload, { onConflict: 'id' });

          if (error) {
            notifSummary.failed++;
            notifSummary.errors.push(`Record ${item.id}: ${error.message}`);
          } else {
            notifSummary.imported++;
          }
        }
      }
    } catch (err: any) {
      notifSummary.errors.push(`File read error: ${err?.message || err}`);
    }
  }

  // 2. Attendance
  const attFile = path.join(dataDir, 'attendance_records.json');
  const attSummary: MigrationSummary = {
    file: attFile,
    found: fs.existsSync(attFile),
    totalInFile: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    currentDbCount: 0,
  };

  const { count: initialAttCount } = await supabaseAdmin
    .from('Attendance')
    .select('id', { count: 'exact', head: true });
  attSummary.currentDbCount = initialAttCount || 0;

  if (attSummary.found) {
    try {
      const raw = fs.readFileSync(attFile, 'utf-8');
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        attSummary.totalInFile = records.length;

        for (const item of records) {
          if (!item.id || !item.userId || !item.date) {
            attSummary.skipped++;
            continue;
          }

          const payload = {
            id: item.id,
            userId: item.userId,
            date: item.date,
            status: item.status || 'PRESENT',
            checkInTime: item.checkInTime || null,
            checkOutTime: item.checkOutTime || null,
            markedById: item.markedById || 'SYSTEM',
            markedByName: item.markedByName || 'System',
            markedByRole: item.markedByRole || 'ADMIN',
            markedAt: item.markedAt || item.createdAt || new Date().toISOString(),
            method: item.method || 'DIRECT_ADMIN',
            requestStatus: item.requestStatus || 'DIRECT',
            respondedAt: item.respondedAt || null,
            rejectionReason: item.rejectionReason || null,
            notes: item.notes || null,
            branchId: item.branchId || null,
            isArchived: Boolean(item.isArchived),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
          };

          const { error } = await supabaseAdmin
            .from('Attendance')
            .upsert(payload, { onConflict: 'id' });

          if (error) {
            attSummary.failed++;
            attSummary.errors.push(`Record ${item.id}: ${error.message}`);
          } else {
            attSummary.imported++;
          }
        }
      }
    } catch (err: any) {
      attSummary.errors.push(`File read error: ${err?.message || err}`);
    }
  }

  // 3. Attendance Audit Logs
  const auditFile = path.join(dataDir, 'attendance_audit_logs.json');
  const auditSummary: MigrationSummary = {
    file: auditFile,
    found: fs.existsSync(auditFile),
    totalInFile: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    currentDbCount: 0,
  };

  const { count: initialAuditCount } = await supabaseAdmin
    .from('AttendanceAuditLog')
    .select('id', { count: 'exact', head: true });
  auditSummary.currentDbCount = initialAuditCount || 0;

  if (auditSummary.found) {
    try {
      const raw = fs.readFileSync(auditFile, 'utf-8');
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        auditSummary.totalInFile = records.length;

        for (const item of records) {
          if (!item.id || !item.attendanceId) {
            auditSummary.skipped++;
            continue;
          }

          const payload = {
            id: item.id,
            attendanceId: item.attendanceId,
            action: item.action || 'UPDATED',
            performedById: item.performedById || 'SYSTEM',
            performedByName: item.performedByName || null,
            performedByRole: item.performedByRole || null,
            previousStatus: item.previousStatus || null,
            newStatus: item.newStatus || null,
            reason: item.reason || null,
            metadata: typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : (item.metadata || null),
            createdAt: item.createdAt || new Date().toISOString(),
          };

          const { error } = await supabaseAdmin
            .from('AttendanceAuditLog')
            .upsert(payload, { onConflict: 'id' });

          if (error) {
            auditSummary.failed++;
            auditSummary.errors.push(`Record ${item.id}: ${error.message}`);
          } else {
            auditSummary.imported++;
          }
        }
      }
    } catch (err: any) {
      auditSummary.errors.push(`File read error: ${err?.message || err}`);
    }
  }

  // Final count verification
  const { count: finalNotifCount } = await supabaseAdmin.from('Notification').select('id', { count: 'exact', head: true });
  notifSummary.currentDbCount = finalNotifCount || notifSummary.currentDbCount;

  const { count: finalAttCount } = await supabaseAdmin.from('Attendance').select('id', { count: 'exact', head: true });
  attSummary.currentDbCount = finalAttCount || attSummary.currentDbCount;

  const { count: finalAuditCount } = await supabaseAdmin.from('AttendanceAuditLog').select('id', { count: 'exact', head: true });
  auditSummary.currentDbCount = finalAuditCount || auditSummary.currentDbCount;

  return {
    notifications: notifSummary,
    attendance: attSummary,
    attendanceAudit: auditSummary,
  };
}

// Standalone execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('migrate-legacy-json')) {
  migrateLegacyJsonToSupabase().then((results) => {
    console.log('\n==========================================');
    console.log('       LEGACY DATA MIGRATION REPORT       ');
    console.log('==========================================');
    console.log('1. Notifications:');
    console.log(`   - File: ${results.notifications.file}`);
    console.log(`   - Found: ${results.notifications.found}`);
    console.log(`   - Total in file: ${results.notifications.totalInFile}`);
    console.log(`   - Imported/Upserted: ${results.notifications.imported}`);
    console.log(`   - Skipped: ${results.notifications.skipped}`);
    console.log(`   - Failed: ${results.notifications.failed}`);
    console.log(`   - Current Supabase Records: ${results.notifications.currentDbCount}`);

    console.log('\n2. Attendance Records:');
    console.log(`   - File: ${results.attendance.file}`);
    console.log(`   - Found: ${results.attendance.found}`);
    console.log(`   - Total in file: ${results.attendance.totalInFile}`);
    console.log(`   - Imported/Upserted: ${results.attendance.imported}`);
    console.log(`   - Skipped: ${results.attendance.skipped}`);
    console.log(`   - Failed: ${results.attendance.failed}`);
    console.log(`   - Current Supabase Records: ${results.attendance.currentDbCount}`);

    console.log('\n3. Attendance Audit Logs:');
    console.log(`   - File: ${results.attendanceAudit.file}`);
    console.log(`   - Found: ${results.attendanceAudit.found}`);
    console.log(`   - Total in file: ${results.attendanceAudit.totalInFile}`);
    console.log(`   - Imported/Upserted: ${results.attendanceAudit.imported}`);
    console.log(`   - Skipped: ${results.attendanceAudit.skipped}`);
    console.log(`   - Failed: ${results.attendanceAudit.failed}`);
    console.log(`   - Current Supabase Records: ${results.attendanceAudit.currentDbCount}`);
    console.log('==========================================\n');
  }).catch((e) => {
    console.error('Migration failed with fatal exception:', e);
    process.exit(1);
  });
}
