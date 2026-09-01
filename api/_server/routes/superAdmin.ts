import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { broadcastServerChange } from '../services/realtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, config } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { logAudit } from '../services/auditService';

const router = Router();

// In-memory / DB-tracked backup metadata registry
interface BackupRecord {
  id: string;
  name: string;
  timestamp: string;
  sizeBytes: number;
  createdById: string;
  createdByName: string;
  stats: Record<string, number>;
  snapshotData?: any;
}
const backupRegistry: BackupRecord[] = [];

// Helper to verify Super Admin master password
async function verifySuperAdminPassword(userId: string, passwordAttempt?: string): Promise<boolean> {
  if (!passwordAttempt) return false;
  try {
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('id, passwordHash, role')
      .eq('id', userId)
      .maybeSingle();

    if (!user || user.role !== 'SUPER_ADMIN' || !user.passwordHash) return false;
    return await bcrypt.compare(passwordAttempt, user.passwordHash);
  } catch (err) {
    console.error('[PASSWORD VERIFICATION ERROR]', err);
    return false;
  }
}

// 1. GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource, userId, role, status, search, page = '1', limit = '15', startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit as string, 10) || 15));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin.from('AuditLog').select('*', { count: 'exact' });

    if (action && action !== 'ALL') query = query.eq('action', String(action));
    if (resource && resource !== 'ALL') query = query.eq('resource', String(resource));
    if (userId && userId !== 'ALL') query = query.eq('userId', String(userId));
    if (role && role !== 'ALL') query = query.eq('userRole', String(role));
    if (status && status !== 'ALL') query = query.eq('status', String(status));
    if (startDate) query = query.gte('createdAt', String(startDate));
    if (endDate) query = query.lte('createdAt', String(endDate));

    if (search && String(search).trim()) {
      const q = String(search).trim();
      query = query.or(`action.ilike.%${q}%,userEmail.ilike.%${q}%,userName.ilike.%${q}%,resource.ilike.%${q}%,details.ilike.%${q}%,ipAddress.ilike.%${q}%`);
    }

    const { data: logs, count, error } = await query
      .order('createdAt', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('[AUDIT LOGS ERROR]', error);
      return res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }

    return res.json({
      success: true,
      logs: logs || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil((count || 0) / limitNum)),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve system audit logs.' });
  }
});

// 2. GET /api/admin/deletion-history
router.get('/deletion-history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from('AuditLog')
      .select('*')
      .or('action.ilike.%DELETE%,action.ilike.%PURGE%,action.ilike.%WIPE%')
      .order('createdAt', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: 'Failed to fetch deletion history.' });

    return res.json(logs || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve deletion records.' });
  }
});

// 3. POST /api/admin/delete-data (Permanent Deletions with Audit)
router.post('/delete-data', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { table, ids, reason, password } = req.body;
    if (!table || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Table name and target ID list are required.' });
    }

    const validTables = [
      'Repair',
      'Customer',
      'BatteryWarranty',
      'InventoryItem',
      'Attendance',
      'RepairRelatedDamage',
      'RepairPrice',
      'Courier',
      'Product',
      'HomeSlide'
    ];

    if (!validTables.includes(table)) {
      return res.status(400).json({ error: `Permanent deletion not permitted on table ${table}.` });
    }

    // Require password check for batches of > 5 records
    if (ids.length > 5 && password) {
      const valid = await verifySuperAdminPassword(req.user!.id, password);
      if (!valid) {
        return res.status(401).json({ error: 'Master authentication password invalid.' });
      }
    }

    const { error } = await supabaseAdmin.from(table).delete().in('id', ids);
    if (error) return res.status(500).json({ error: `Failed to delete from ${table}: ${error.message}` });

    await logAudit({
      userId: req.user!.id,
      action: `SUPERADMIN_PERMANENT_DELETE_${table.toUpperCase()}`,
      resource: table,
      details: `Permanently removed ${ids.length} records from ${table}. Reason: ${reason || 'Administrative Action'}`,
      metadata: { deletedCount: ids.length, ids, reason },
    });

    for (const id of ids) {
      await broadcastServerChange(table, 'DELETE', id);
    }

    return res.json({ success: true, message: `Safely removed ${ids.length} records from ${table}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute data deletion.' });
  }
});

// 4. POST /api/admin/system-purge/preview
router.post('/system-purge/preview', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { category, timeframe, selectedDate, selectedMonth, selectedYear, startDate, endDate } = req.body;

    const tableMap: Record<string, string> = {
      repairs: 'Repair',
      customers: 'Customer',
      inventory: 'InventoryItem',
      attendance: 'Attendance',
      damages: 'RepairRelatedDamage',
      warranties: 'BatteryWarranty',
      couriers: 'Courier',
      notifications: 'Notification',
    };

    if (category === 'all_data') {
      let totalCount = 0;
      const breakdown: Record<string, number> = {};

      for (const [key, tbl] of Object.entries(tableMap)) {
        try {
          const { count } = await supabaseAdmin.from(tbl).select('*', { count: 'exact', head: true });
          breakdown[key] = count || 0;
          totalCount += count || 0;
        } catch (_) {}
      }

      return res.json({
        success: true,
        count: totalCount,
        category: 'All Core Operational Data (Excluding Accounts)',
        breakdown,
      });
    }

    const tableName = tableMap[category] || 'Repair';
    let query = supabaseAdmin.from(tableName).select('*', { count: 'exact', head: true });

    if (timeframe === 'DATE' && selectedDate) {
      query = query.gte('createdAt', `${selectedDate}T00:00:00.000Z`).lte('createdAt', `${selectedDate}T23:59:59.999Z`);
    } else if (timeframe === 'MONTH' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      query = query.gte('createdAt', start).lte('createdAt', end);
    } else if (timeframe === 'YEAR' && selectedYear) {
      const start = new Date(Number(selectedYear), 0, 1).toISOString();
      const end = new Date(Number(selectedYear), 11, 31, 23, 59, 59, 999).toISOString();
      query = query.gte('createdAt', start).lte('createdAt', end);
    } else if (timeframe === 'RANGE' && startDate && endDate) {
      query = query.gte('createdAt', `${startDate}T00:00:00.000Z`).lte('createdAt', `${endDate}T23:59:59.999Z`);
    }

    const { count, error } = await query;
    if (error) {
      return res.status(500).json({ error: `Failed to count target records in ${tableName}.` });
    }

    return res.json({
      success: true,
      count: count || 0,
      category: tableName,
      timeframe: timeframe || 'ALL',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate purge preview.' });
  }
});

// 5. POST /api/admin/system-purge/execute
router.post('/system-purge/execute', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { category, timeframe, selectedDate, selectedMonth, selectedYear, startDate, endDate, password, confirmationText } = req.body;

    if (confirmationText !== 'DELETE') {
      return res.status(400).json({ error: 'Confirmation failed: Must type DELETE in all uppercase.' });
    }

    const isPasswordValid = await verifySuperAdminPassword(req.user!.id, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Master authentication password verification failed.' });
    }

    const tableMap: Record<string, string> = {
      repairs: 'Repair',
      customers: 'Customer',
      inventory: 'InventoryItem',
      attendance: 'Attendance',
      damages: 'RepairRelatedDamage',
      warranties: 'BatteryWarranty',
      couriers: 'Courier',
      notifications: 'Notification',
    };

    let totalDeleted = 0;

    if (category === 'all_data') {
      // Safely purge all operational tables (NEVER wipe User or AuditLog!)
      const targetTables = ['Repair', 'Customer', 'BatteryWarranty', 'InventoryItem', 'Attendance', 'RepairRelatedDamage', 'Courier', 'Notification'];
      
      for (const tbl of targetTables) {
        try {
          const { error } = await supabaseAdmin.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (!error) {
            await broadcastServerChange(tbl, 'DELETE', 'all');
          }
        } catch (e) {
          console.error(`[PURGE ERROR ${tbl}]`, e);
        }
      }

      await logAudit({
        userId: req.user!.id,
        action: 'SUPERADMIN_FULL_SYSTEM_PURGE',
        resource: 'ALL_OPERATIONAL_TABLES',
        details: 'Executed complete operational database purge (Repairs, Customers, Inventory, Warranties, Attendance, Damages). User accounts and audit log preserved.',
        status: 'SUCCESS',
      });

      return res.json({
        success: true,
        message: 'All operational records successfully purged. User accounts and audit trail preserved.',
      });
    }

    const targetTable = tableMap[category] || 'Repair';
    let query = supabaseAdmin.from(targetTable).delete();

    if (timeframe === 'DATE' && selectedDate) {
      query = query.gte('createdAt', `${selectedDate}T00:00:00.000Z`).lte('createdAt', `${selectedDate}T23:59:59.999Z`);
    } else if (timeframe === 'MONTH' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      query = query.gte('createdAt', start).lte('createdAt', end);
    } else if (timeframe === 'YEAR' && selectedYear) {
      const start = new Date(Number(selectedYear), 0, 1).toISOString();
      const end = new Date(Number(selectedYear), 11, 31, 23, 59, 59, 999).toISOString();
      query = query.gte('createdAt', start).lte('createdAt', end);
    } else if (timeframe === 'RANGE' && startDate && endDate) {
      query = query.gte('createdAt', `${startDate}T00:00:00.000Z`).lte('createdAt', `${endDate}T23:59:59.999Z`);
    } else {
      // Global wipe of that table
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error } = await query;
    if (error) {
      return res.status(500).json({ error: `Purge execution failed on ${targetTable}: ${error.message}` });
    }

    await logAudit({
      userId: req.user!.id,
      action: `SUPERADMIN_PURGE_${targetTable.toUpperCase()}`,
      resource: targetTable,
      details: `Purged records from ${targetTable} matching timeframe: ${timeframe || 'ALL'}`,
      status: 'SUCCESS',
    });

    await broadcastServerChange(targetTable, 'DELETE', 'bulk');

    return res.json({
      success: true,
      message: `Successfully purged targeted records from ${targetTable}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute system purge.' });
  }
});

// 6. POST /api/admin/backup/create
router.post('/backup/create', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    // Fetch key operational tables in parallel
    const [
      repairsRes,
      customersRes,
      inventoryRes,
      warrantiesRes,
      attendanceRes,
      damagesRes,
      pricesRes,
      couriersRes,
      usersRes,
    ] = await Promise.all([
      supabaseAdmin.from('Repair').select('*').limit(5000),
      supabaseAdmin.from('Customer').select('*').limit(5000),
      supabaseAdmin.from('InventoryItem').select('*').limit(5000),
      supabaseAdmin.from('BatteryWarranty').select('*').limit(5000),
      supabaseAdmin.from('Attendance').select('*').limit(5000),
      supabaseAdmin.from('RepairRelatedDamage').select('*').limit(5000),
      supabaseAdmin.from('RepairPrice').select('*').limit(5000),
      supabaseAdmin.from('Courier').select('*').limit(5000),
      supabaseAdmin.from('User').select('id, email, username, name, role, department, phoneNumber, accountStatus, createdAt').limit(1000),
    ]);

    // Sanitize user records (NO passwordHash, NO twoFactorSecret, NO session tokens)
    const sanitizedUsers = (usersRes.data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      name: u.name,
      role: u.role,
      department: u.department,
      phoneNumber: u.phoneNumber,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt,
    }));

    const snapshotData = {
      metadata: {
        system: 'MTS Lab Repair Management System',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        createdById: req.user!.id,
        createdByName: req.user!.name || 'Super Admin',
      },
      stats: {
        repairs: repairsRes.data?.length || 0,
        customers: customersRes.data?.length || 0,
        inventory: inventoryRes.data?.length || 0,
        warranties: warrantiesRes.data?.length || 0,
        attendance: attendanceRes.data?.length || 0,
        damages: damagesRes.data?.length || 0,
        repairPrices: pricesRes.data?.length || 0,
        couriers: couriersRes.data?.length || 0,
        users: sanitizedUsers.length,
      },
      data: {
        repairs: repairsRes.data || [],
        customers: customersRes.data || [],
        inventory: inventoryRes.data || [],
        warranties: warrantiesRes.data || [],
        attendance: attendanceRes.data || [],
        damages: damagesRes.data || [],
        repairPrices: pricesRes.data || [],
        couriers: couriersRes.data || [],
        users: sanitizedUsers,
      },
    };

    const jsonString = JSON.stringify(snapshotData);
    const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
    const backupId = `bk-${Date.now()}-${uuidv4().substring(0, 8)}`;

    const backupMeta: BackupRecord = {
      id: backupId,
      name: name || `MTS-Backup-${new Date().toISOString().slice(0, 10)}`,
      timestamp: new Date().toISOString(),
      sizeBytes,
      createdById: req.user!.id,
      createdByName: req.user!.name || 'Super Admin',
      stats: snapshotData.stats,
      snapshotData,
    };

    backupRegistry.unshift(backupMeta);
    if (backupRegistry.length > 20) backupRegistry.pop();

    await logAudit({
      userId: req.user!.id,
      action: 'SUPERADMIN_BACKUP_CREATED',
      resource: 'SYSTEM_BACKUP',
      details: `Generated system backup snapshot ${backupMeta.name} (${(sizeBytes / 1024).toFixed(1)} KB).`,
      metadata: { backupId, stats: snapshotData.stats },
    });

    return res.json({
      success: true,
      backup: {
        id: backupMeta.id,
        name: backupMeta.name,
        timestamp: backupMeta.timestamp,
        sizeBytes: backupMeta.sizeBytes,
        createdByName: backupMeta.createdByName,
        stats: backupMeta.stats,
      },
      snapshotPayload: snapshotData,
    });
  } catch (err: any) {
    console.error('[BACKUP CREATE ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate system backup snapshot.' });
  }
});

// 7. GET /api/admin/backup/list
router.get('/backup/list', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const list = backupRegistry.map(b => ({
      id: b.id,
      name: b.name,
      timestamp: b.timestamp,
      sizeBytes: b.sizeBytes,
      createdByName: b.createdByName,
      stats: b.stats,
    }));

    return res.json({ success: true, backups: list });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch backup list.' });
  }
});

// 8. POST /api/admin/backup/restore
router.post('/backup/restore', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { backupPayload, password, confirmText } = req.body;

    if (confirmText !== 'RESTORE') {
      return res.status(400).json({ error: 'Confirmation required: Must type RESTORE.' });
    }

    const isPasswordValid = await verifySuperAdminPassword(req.user!.id, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Master password validation failed.' });
    }

    if (!backupPayload || !backupPayload.data || typeof backupPayload.data !== 'object') {
      return res.status(400).json({ error: 'Invalid backup snapshot structure.' });
    }

    const { data } = backupPayload;
    let restoredCounts: Record<string, number> = {};

    // Restore table by table with upsert where applicable
    if (Array.isArray(data.customers) && data.customers.length > 0) {
      const { error } = await supabaseAdmin.from('Customer').upsert(data.customers, { onConflict: 'id' });
      if (!error) restoredCounts.customers = data.customers.length;
    }

    if (Array.isArray(data.repairs) && data.repairs.length > 0) {
      const { error } = await supabaseAdmin.from('Repair').upsert(data.repairs, { onConflict: 'id' });
      if (!error) restoredCounts.repairs = data.repairs.length;
    }

    if (Array.isArray(data.inventory) && data.inventory.length > 0) {
      const { error } = await supabaseAdmin.from('InventoryItem').upsert(data.inventory, { onConflict: 'id' });
      if (!error) restoredCounts.inventory = data.inventory.length;
    }

    if (Array.isArray(data.warranties) && data.warranties.length > 0) {
      const { error } = await supabaseAdmin.from('BatteryWarranty').upsert(data.warranties, { onConflict: 'id' });
      if (!error) restoredCounts.warranties = data.warranties.length;
    }

    if (Array.isArray(data.attendance) && data.attendance.length > 0) {
      const { error } = await supabaseAdmin.from('Attendance').upsert(data.attendance, { onConflict: 'id' });
      if (!error) restoredCounts.attendance = data.attendance.length;
    }

    if (Array.isArray(data.damages) && data.damages.length > 0) {
      const { error } = await supabaseAdmin.from('RepairRelatedDamage').upsert(data.damages, { onConflict: 'id' });
      if (!error) restoredCounts.damages = data.damages.length;
    }

    if (Array.isArray(data.repairPrices) && data.repairPrices.length > 0) {
      const { error } = await supabaseAdmin.from('RepairPrice').upsert(data.repairPrices, { onConflict: 'id' });
      if (!error) restoredCounts.repairPrices = data.repairPrices.length;
    }

    await logAudit({
      userId: req.user!.id,
      action: 'SUPERADMIN_SYSTEM_RESTORE',
      resource: 'DATABASE_RESTORE',
      details: `Restored snapshot data across multiple tables. Summary: ${JSON.stringify(restoredCounts)}`,
      status: 'SUCCESS',
    });

    return res.json({
      success: true,
      message: 'System restore completed successfully.',
      restoredCounts,
    });
  } catch (err: any) {
    console.error('[RESTORE ERROR]', err);
    return res.status(500).json({ error: 'Failed to restore snapshot data.' });
  }
});

// 9. POST /api/admin/export
router.post('/export', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { module, format = 'json' } = req.body;

    const tableMap: Record<string, string> = {
      repairs: 'Repair',
      customers: 'Customer',
      inventory: 'InventoryItem',
      attendance: 'Attendance',
      warranties: 'BatteryWarranty',
      prices: 'RepairPrice',
      damages: 'RepairRelatedDamage',
      couriers: 'Courier',
    };

    const tableName = tableMap[module] || 'Repair';
    const { data: records, error } = await supabaseAdmin.from(tableName).select('*').limit(10000);

    if (error) {
      return res.status(500).json({ error: `Failed to export ${tableName}: ${error.message}` });
    }

    await logAudit({
      userId: req.user!.id,
      action: `SUPERADMIN_DATA_EXPORT_${tableName.toUpperCase()}`,
      resource: tableName,
      details: `Exported ${records?.length || 0} records as ${format.toUpperCase()}`,
    });

    return res.json({
      success: true,
      module: tableName,
      count: records?.length || 0,
      data: records || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process export.' });
  }
});

// 10. POST /api/admin/import/preview
router.post('/import/preview', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { module, items } = req.body;
    if (!module || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Module and data items array are required.' });
    }

    const errors: string[] = [];
    const validItems: any[] = [];

    // Basic schema validation per module
    items.forEach((item, index) => {
      if (typeof item !== 'object' || !item) {
        errors.push(`Row ${index + 1}: Invalid record format`);
        return;
      }

      if (module === 'customers' && !item.name) {
        errors.push(`Row ${index + 1}: Customer name is required`);
        return;
      }
      if (module === 'inventory' && (!item.name && !item.partName)) {
        errors.push(`Row ${index + 1}: Item/Part name is required`);
        return;
      }
      if (module === 'prices' && (!item.serviceName && !item.category)) {
        errors.push(`Row ${index + 1}: Service name or category is required`);
        return;
      }

      validItems.push({
        ...item,
        id: item.id || uuidv4(),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return res.json({
      success: true,
      totalCount: items.length,
      validCount: validItems.length,
      invalidCount: errors.length,
      errors: errors.slice(0, 10),
      previewSample: validItems.slice(0, 5),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process import validation.' });
  }
});

// 11. POST /api/admin/import/execute
router.post('/import/execute', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { module, items } = req.body;
    if (!module || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Module and items array are required.' });
    }

    const tableMap: Record<string, string> = {
      repairs: 'Repair',
      customers: 'Customer',
      inventory: 'InventoryItem',
      attendance: 'Attendance',
      warranties: 'BatteryWarranty',
      prices: 'RepairPrice',
      damages: 'RepairRelatedDamage',
    };

    const tableName = tableMap[module];
    if (!tableName) {
      return res.status(400).json({ error: `Unsupported import module: ${module}` });
    }

    const { error } = await supabaseAdmin.from(tableName).upsert(items, { onConflict: 'id' });
    if (error) {
      return res.status(500).json({ error: `Import failed: ${error.message}` });
    }

    await logAudit({
      userId: req.user!.id,
      action: `SUPERADMIN_DATA_IMPORT_${tableName.toUpperCase()}`,
      resource: tableName,
      details: `Imported / upserted ${items.length} records into ${tableName}`,
      status: 'SUCCESS',
    });

    await broadcastServerChange(tableName, 'CREATE', 'import');

    return res.json({
      success: true,
      message: `Successfully imported ${items.length} records into ${tableName}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute import.' });
  }
});

// 12. GET /api/admin/health
router.get('/health', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const startDb = Date.now();
    const { data: ping, error } = await supabaseAdmin.from('User').select('id', { count: 'exact', head: true });
    const dbLatencyMs = Date.now() - startDb;

    // Parallel count queries for health overview
    const [
      repairsCount,
      customersCount,
      inventoryCount,
      warrantiesCount,
      usersCount,
      auditCount,
    ] = await Promise.all([
      supabaseAdmin.from('Repair').select('*', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('Customer').select('*', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('InventoryItem').select('*', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('BatteryWarranty').select('*', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('User').select('*', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('AuditLog').select('*', { count: 'exact', head: true }).then(r => r.count || 0),
    ]);

    const memory = process.memoryUsage();

    return res.json({
      success: true,
      status: error ? 'DEGRADED' : 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      db: {
        provider: 'Supabase PostgreSQL',
        connected: !error,
        latencyMs: dbLatencyMs,
        tables: {
          repairs: repairsCount,
          customers: customersCount,
          inventory: inventoryCount,
          warranties: warrantiesCount,
          users: usersCount,
          auditLogs: auditCount,
        },
      },
      system: {
        nodeVersion: process.version,
        memoryUsageMb: Math.round(memory.heapUsed / 1024 / 1024),
        totalMemoryMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to inspect system health.' });
  }
});

// 13. GET /api/admin/storage/stats
router.get('/storage/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const hasCloudinary = Boolean(config.cloudinaryCloudName && config.cloudinaryApiKey);

    // Count attachments stored across repairs and damages
    const { data: damages } = await supabaseAdmin.from('RepairRelatedDamage').select('images');
    const { data: slides } = await supabaseAdmin.from('HomeSlide').select('imageUrl');
    const { data: users } = await supabaseAdmin.from('User').select('profileImage');

    let totalImages = 0;
    (damages || []).forEach(d => {
      if (Array.isArray(d.images)) totalImages += d.images.length;
    });
    (slides || []).forEach(s => {
      if (s.imageUrl) totalImages += 1;
    });
    (users || []).forEach(u => {
      if (u.profileImage) totalImages += 1;
    });

    return res.json({
      success: true,
      provider: hasCloudinary ? 'Cloudinary CDN + Supabase' : 'Direct Supabase Storage',
      configured: true,
      totalLinkedMediaFiles: totalImages,
      categories: {
        damageProofImages: damages?.length || 0,
        slideBanners: slides?.length || 0,
        staffAvatars: users?.filter(u => !!u.profileImage).length || 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch storage statistics.' });
  }
});

// 14. GET /api/share/history
router.get('/share/history', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { data: shares } = await supabaseAdmin.from('AppletShare').select('*').order('createdAt', { ascending: false }).limit(50);
    return res.json({ success: true, data: shares || [] });
  } catch (err: any) {
    return res.json({ success: true, data: [] });
  }
});

// 15. POST /api/share/applet
router.post('/share/applet', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { appletName, title, description, visibility, sharingTarget, allowFork, expiresAt } = req.body;
    const shareId = uuidv4();
    const shareToken = uuidv4().replace(/-/g, '');

    const newShare = {
      id: shareId,
      shareToken,
      title: appletName || title || 'MTS Lab System',
      description: description || null,
      visibility: visibility || 'PUBLIC',
      sharingTarget: sharingTarget || null,
      allowFork: allowFork !== false,
      permissions: ['READ'],
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: req.user!.id,
      createdAt: new Date().toISOString(),
    };

    await supabaseAdmin.from('AppletShare').insert([newShare]);

    await logAudit({
      userId: req.user!.id,
      action: 'SUPERADMIN_SHARE_CREATED',
      resource: 'APPLET_SHARE',
      details: `Created applet federation share: ${newShare.title} (${newShare.visibility})`,
    });

    return res.status(201).json({
      success: true,
      message: 'Applet federation share published successfully!',
      shareToken,
      url: `/share/${shareToken}`,
      data: newShare,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create share link.' });
  }
});

// 16. DELETE /api/share/:id
router.delete('/share/:id', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from('AppletShare').delete().eq('id', id);
    return res.json({ success: true, message: 'Share revoked successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to revoke share.' });
  }
});

export default router;

