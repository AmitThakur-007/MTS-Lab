import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Lock, 
  Layers, 
  HardDrive, 
  Sparkles, 
  Calendar 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BackupRestoreTab() {
  // Backup creation state
  const [backupName, setBackupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [recentBackup, setRecentBackup] = useState<any | null>(null);

  // Backup list
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Restore Modal State
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [restorePayload, setRestorePayload] = useState<any | null>(null);
  const [restoreStats, setRestoreStats] = useState<Record<string, number> | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res: any = await api.get('/admin/backup/list');
      if (res && res.success) {
        setBackups(res.backups || []);
      }
    } catch (err) {
      console.error('[BACKUP LIST ERROR]', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res: any = await api.post('/admin/backup/create', {
        name: backupName.trim() || `MTS-Snapshot-${format(new Date(), 'yyyyMMdd-HHmm')}`,
      });

      if (res && res.success && res.snapshotPayload) {
        setRecentBackup(res.snapshotPayload);
        toast.success('Database backup snapshot created successfully!');
        setBackupName('');
        fetchBackups();

        // Trigger automatic JSON file download
        const blob = new Blob([JSON.stringify(res.snapshotPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${res.backup.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('[CREATE BACKUP ERROR]', err);
      toast.error('Failed to create backup snapshot.');
    } finally {
      setCreating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || !json.data || typeof json.data !== 'object') {
          toast.error('Invalid MTS backup format.');
          return;
        }
        setRestorePayload(json);
        setRestoreStats(json.stats || {
          repairs: json.data.repairs?.length || 0,
          customers: json.data.customers?.length || 0,
          inventory: json.data.inventory?.length || 0,
          warranties: json.data.warranties?.length || 0,
          attendance: json.data.attendance?.length || 0,
          damages: json.data.damages?.length || 0,
        });
        setRestorePassword('');
        setRestoreConfirmText('');
        setIsRestoreOpen(true);
      } catch (err) {
        toast.error('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (restoreConfirmText !== 'RESTORE') {
      toast.error('Type RESTORE to confirm.');
      return;
    }
    if (!restorePassword) {
      toast.error('Master password is required.');
      return;
    }

    setRestoring(true);
    try {
      const res: any = await api.post('/admin/backup/restore', {
        backupPayload: restorePayload,
        password: restorePassword,
        confirmText: restoreConfirmText,
      });

      if (res && res.success) {
        toast.success(res.message || 'System data restored successfully!');
        setIsRestoreOpen(false);
        setRestorePayload(null);
      } else {
        toast.error(res?.error || 'Restore failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Restore failed. Check master password.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Create Snapshot & Overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-6 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  DATABASE ENGINE SAFETY
                </Badge>
              </div>
              <CardTitle className="text-xl font-black mt-2">System Backup &amp; Disaster Recovery</CardTitle>
              <CardDescription className="text-slate-400 text-xs font-semibold">
                Generate point-in-time database snapshots or restore clean backups with schema validation.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Snapshot Generator Form */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Backup Snapshot Label (Optional)</Label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <Input
                      placeholder={`e.g. MTS-FullBackup-${format(new Date(), 'yyyy-MM-dd')}`}
                      value={backupName}
                      onChange={(e) => setBackupName(e.target.value)}
                      className="bg-white rounded-xl h-10 text-xs font-semibold"
                    />
                    <Button
                      onClick={handleCreateBackup}
                      disabled={creating}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl h-10 px-5 shrink-0 cursor-pointer"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1.5" />
                          Generate &amp; Download Snapshot
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200/60 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Repairs &amp; Logs</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Customers CRM</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Inventory Parts</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Battery Warranties</span>
                  </div>
                </div>
              </div>

              {/* Restore Section */}
              <div className="p-5 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-700" />
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                        Restore Database from Snapshot
                      </h4>
                      <p className="text-[11px] text-indigo-700">
                        Upload a previously generated <code className="font-bold">.json</code> snapshot to restore system records.
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border-indigo-200 text-indigo-900 hover:bg-indigo-100 rounded-xl text-xs font-bold h-9 px-4 shrink-0 shadow-2xs"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload Snapshot File
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Snapshot History */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-5 bg-slate-100/80 border-b border-slate-200/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-slate-700" />
                  Recent Snapshots
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Point-in-time backups generated in this session.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchBackups}
                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
              {backups.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Database className="h-7 w-7 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No recent snapshots</p>
                  <p className="text-[10px] text-slate-400">Click &ldquo;Generate Snapshot&rdquo; to create a new point-in-time copy.</p>
                </div>
              ) : (
                backups.map((b) => (
                  <div key={b.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[170px]">{b.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {(b.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>By: {b.createdByName || 'Super Admin'}</span>
                      <span>{b.timestamp ? format(new Date(b.timestamp), 'MMM dd, HH:mm') : ''}</span>
                    </div>
                    {b.stats && (
                      <div className="text-[10px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200/50 flex flex-wrap gap-x-2.5 gap-y-0.5 font-semibold">
                        <span>Repairs: <strong className="text-slate-900">{b.stats.repairs || 0}</strong></span>
                        <span>Inventory: <strong className="text-slate-900">{b.stats.inventory || 0}</strong></span>
                        <span>CRM: <strong className="text-slate-900">{b.stats.customers || 0}</strong></span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-2 shadow-2xs">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-slate-900">
              Confirm System Database Restore
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              You are about to restore database tables from the uploaded snapshot.
            </DialogDescription>
          </DialogHeader>

          {restoreStats && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Records in Snapshot Payload:
                </span>
                <div className="grid grid-cols-2 gap-1.5 font-semibold text-slate-700 text-[11px]">
                  <div>Repairs: <strong className="text-slate-900">{restoreStats.repairs || 0}</strong></div>
                  <div>Customers: <strong className="text-slate-900">{restoreStats.customers || 0}</strong></div>
                  <div>Inventory: <strong className="text-slate-900">{restoreStats.inventory || 0}</strong></div>
                  <div>Warranties: <strong className="text-slate-900">{restoreStats.warranties || 0}</strong></div>
                  <div>Attendance: <strong className="text-slate-900">{restoreStats.attendance || 0}</strong></div>
                  <div>Damages: <strong className="text-slate-900">{restoreStats.damages || 0}</strong></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Type <span className="font-black text-amber-600">RESTORE</span> to confirm:
                </Label>
                <Input
                  placeholder="RESTORE"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  className="rounded-xl h-10 text-xs font-bold font-mono tracking-wider border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Super Admin Master Password:
                </Label>
                <Input
                  type="password"
                  placeholder="Enter master password..."
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  className="rounded-xl h-10 text-xs font-semibold border-slate-300"
                />
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsRestoreOpen(false)}
              disabled={restoring}
              className="rounded-xl font-bold text-xs h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteRestore}
              disabled={restoring || restoreConfirmText !== 'RESTORE' || !restorePassword}
              className="rounded-xl font-bold text-xs h-10 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {restoring ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Restoring...
                </>
              ) : (
                'Confirm & Restore'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
