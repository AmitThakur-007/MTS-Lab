import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArchiveRestore,
  ArrowLeft,
  DatabaseBackup,
  FileClock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import StaffManagement from './Staff';
import PermanentDeletionHub from '@/components/admin/PermanentDeletionHub';

interface AuditLog {
  id: string;
  action: string;
  resource?: string;
  status?: string;
  userName?: string;
  userRole?: string;
  createdAt?: string;
}

interface BackupRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  createdByName?: string;
  status: string;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export default function SuperAdminSecurityControl() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const loadLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const query = logSearch ? `&search=${encodeURIComponent(logSearch)}` : '';
      const response = await api.get(`/admin/audit-logs?page=1&limit=50${query}`);
      setLogs(Array.isArray(response?.logs) ? response.logs : []);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load security logs.');
    } finally {
      setLogLoading(false);
    }
  }, [logSearch]);

  const loadBackups = useCallback(async () => {
    setBackupLoading(true);
    try {
      const response = await api.get('/admin/backups');
      setBackups(Array.isArray(response?.data) ? response.data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load backups.');
    } finally {
      setBackupLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
    void loadBackups();
  }, [loadLogs, loadBackups]);

  const createBackup = async () => {
    setBackupBusy(true);
    try {
      const response = await api.post('/admin/backups', {});
      toast.success(response?.message || 'System backup created successfully.');
      await loadBackups();
    } catch (error: any) {
      toast.error(error?.message || 'Backup creation failed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const downloadBackup = async (id: string) => {
    try {
      const response = await api.get(`/admin/backups/${id}/download`);
      if (response?.url) window.open(response.url, '_blank', 'noopener,noreferrer');
      else toast.error('Backup download URL was not available.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to download backup.');
    }
  };

  const restoreBackup = async (id: string) => {
    if (!window.confirm('Restore this backup? Current application data will be replaced. A safety backup must exist before restore.')) return;
    const confirmation = window.prompt('Type RESTORE to continue.');
    if (confirmation !== 'RESTORE') return;
    setBackupBusy(true);
    try {
      const response = await api.post(`/admin/backups/${id}/restore`, { confirmation });
      toast.success(response?.message || 'Backup restored successfully.');
      await loadBackups();
    } catch (error: any) {
      toast.error(error?.message || 'Backup restore failed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const deleteBackup = async (id: string) => {
    if (!window.confirm('Permanently delete this backup file? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/backups/${id}`);
      toast.success('Backup deleted.');
      await loadBackups();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to delete backup.');
    }
  };

  const successfulEvents = useMemo(() => logs.filter((log) => log.status !== 'FAILED').length, [logs]);
  const failedEvents = useMemo(() => logs.filter((log) => log.status === 'FAILED').length, [logs]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-3 pb-16 sm:px-5 lg:px-7">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Button variant="ghost" size="icon" className="mt-1 shrink-0 rounded-xl" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Security & System Control</h1>
              <Badge className="bg-rose-50 text-rose-700 border-rose-200">SUPER ADMIN</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Centralized control for staff access, immutable activity records, destructive operations and protected system backups.
            </p>
          </div>
        </div>
        <DashboardRefreshButton onRefresh={async () => { await loadLogs(); await loadBackups(); }} label="Refresh" />
      </header>

      <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-5"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-600" /><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Control Status</p><p className="mt-1 text-xl font-black text-slate-900">Protected</p></CardContent></Card>
        <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-5"><Users className="mb-3 h-5 w-5 text-violet-600" /><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Staff Directory</p><p className="mt-1 text-xl font-black text-slate-900">Managed</p></CardContent></Card>
        <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-5"><Activity className="mb-3 h-5 w-5 text-blue-600" /><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent Events</p><p className="mt-1 text-xl font-black text-slate-900">{logs.length.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{successfulEvents} successful · {failedEvents} failed</p></CardContent></Card>
        <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-5"><DatabaseBackup className="mb-3 h-5 w-5 text-amber-600" /><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Protected Backups</p><p className="mt-1 text-xl font-black text-slate-900">{backups.length.toLocaleString()}</p></CardContent></Card>
      </section>

      <Tabs defaultValue="logs" className="min-w-0 space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-2xl bg-slate-100 p-1.5">
          <TabsTrigger value="logs" className="rounded-xl px-3 py-2 text-xs font-bold"><FileClock className="mr-1.5 h-4 w-4" />Activity & Security Logs</TabsTrigger>
          <TabsTrigger value="staff" className="rounded-xl px-3 py-2 text-xs font-bold"><Users className="mr-1.5 h-4 w-4" />Staff Directory</TabsTrigger>
          <TabsTrigger value="deletion" className="rounded-xl px-3 py-2 text-xs font-bold"><Trash2 className="mr-1.5 h-4 w-4" />Permanent Deletion</TabsTrigger>
          <TabsTrigger value="purge" className="rounded-xl px-3 py-2 text-xs font-bold"><ArchiveRestore className="mr-1.5 h-4 w-4" />System Data Purge</TabsTrigger>
          <TabsTrigger value="backups" className="rounded-xl px-3 py-2 text-xs font-bold"><DatabaseBackup className="mr-1.5 h-4 w-4" />Backup & Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="min-w-0">
          <Card className="min-w-0 overflow-hidden rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 p-5 sm:p-7">
              <CardTitle className="text-xl font-black">Activity & Security Logs</CardTitle>
              <CardDescription>Auditable system activity without the former surveillance dashboard.</CardDescription>
              <div className="pt-2"><Input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadLogs(); }} placeholder="Search audit activity" className="max-w-xl" /></div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Resource</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {logLoading ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Loading security activity…</td></tr> : logs.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No security activity found.</td></tr> : logs.map((log) => <tr key={log.id} className="hover:bg-slate-50/80"><td className="whitespace-nowrap px-5 py-3 text-slate-500">{log.createdAt ? format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm') : '—'}</td><td className="px-5 py-3 font-bold text-slate-900">{log.action}</td><td className="px-5 py-3 text-slate-600">{log.resource || '—'}</td><td className="px-5 py-3 text-slate-600">{log.userName || 'System'} {log.userRole ? `(${log.userRole})` : ''}</td><td className="px-5 py-3"><Badge variant="outline">{log.status || 'SUCCESS'}</Badge></td></tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="min-w-0"><StaffManagement /></TabsContent>
        <TabsContent value="deletion" className="min-w-0"><PermanentDeletionHub /></TabsContent>
        <TabsContent value="purge" className="min-w-0">
          <Card className="rounded-3xl border-amber-200 bg-amber-50/40 shadow-sm"><CardHeader><CardTitle className="font-black">System Data Purge</CardTitle><CardDescription>Use the existing server-authorized permanent deletion workflow. Destructive actions remain protected by Super Admin authorization and audit logging.</CardDescription></CardHeader><CardContent><PermanentDeletionHub /></CardContent></Card>
        </TabsContent>

        <TabsContent value="backups" className="min-w-0">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><CardTitle className="font-black">Backup & Recovery</CardTitle><CardDescription>Encrypted database snapshots stored in a private Supabase Storage bucket.</CardDescription></div><Button disabled={backupBusy} onClick={() => void createBackup()}><DatabaseBackup className="mr-2 h-4 w-4" />{backupBusy ? 'Working…' : 'Create Backup'}</Button></CardHeader>
            <CardContent className="p-5 sm:p-7">
              {backupLoading ? <div className="py-10 text-center text-slate-500">Loading backups…</div> : backups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No system backups have been created.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{backups.map((backup) => <tr key={backup.id}><td className="px-4 py-3 font-semibold">{backup.fileName}<div className="max-w-[360px] truncate text-[10px] font-mono text-slate-400">SHA-256 {backup.checksum}</div></td><td className="px-4 py-3">{formatBytes(backup.sizeBytes)}</td><td className="px-4 py-3 whitespace-nowrap">{format(new Date(backup.createdAt), 'yyyy-MM-dd HH:mm')}</td><td className="px-4 py-3"><Badge variant="outline">{backup.status}</Badge></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void downloadBackup(backup.id)}>Download</Button><Button size="sm" variant="outline" disabled={backupBusy} onClick={() => void restoreBackup(backup.id)}>Restore</Button><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => void deleteBackup(backup.id)}>Delete</Button></div></td></tr>)}</tbody></table></div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
