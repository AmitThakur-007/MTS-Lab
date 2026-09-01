import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Shield, 
  Users, 
  Trash2, 
  Layers, 
  Database, 
  FileDown, 
  Activity, 
  ArrowLeft,
  Server,
  Share2,
  HardDrive,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

// Admin Subcomponents
import AuditLogsTab from '@/components/admin/AuditLogsTab';
import PermanentDeletionHub from '@/components/admin/PermanentDeletionHub';
import StaffManagement from './Staff';
import SystemDataPurgeTab from '@/components/admin/SystemDataPurgeTab';
import BackupRestoreTab from '@/components/admin/BackupRestoreTab';
import ImportExportTab from '@/components/admin/ImportExportTab';
import SystemHealthTab from '@/components/admin/SystemHealthTab';
import FederationSharingTab from '@/components/admin/FederationSharingTab';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('audit-logs');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGlobalRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 pb-12" key={refreshKey}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 lg:p-7 rounded-3xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-2 max-w-2xl">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-fit gap-1.5 font-bold text-slate-500 hover:text-slate-900 rounded-xl px-2.5 h-8 cursor-pointer" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                  Super Admin Console
                </h1>
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-extrabold text-[10px]">
                  SUPER ADMIN PRIVILEGES
                </Badge>
              </div>
              <p className="text-slate-500 font-medium text-xs mt-1 leading-relaxed">
                Core infrastructure, database governance, backup recovery, immutable audit logs &amp; federation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Master Node Active</span>
          </div>
          <DashboardRefreshButton
            onRefresh={async () => {
              handleGlobalRefresh();
            }}
            size="default"
            label="Refresh Console"
          />
        </div>
      </div>

      {/* Main Administrative Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 w-full overflow-x-auto">
          <TabsList className="bg-transparent p-0 flex flex-nowrap sm:flex-wrap gap-1.5 h-auto min-w-max">
            {/* Section 1: Security & Governance */}
            <TabsTrigger 
              value="audit-logs" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <Shield className="h-4 w-4 mr-1.5 text-indigo-600 shrink-0" />
              <span>Activity &amp; Audit Logs</span>
            </TabsTrigger>

            <TabsTrigger 
              value="staff-directory" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <Users className="h-4 w-4 mr-1.5 text-purple-600 shrink-0" />
              <span>Staff Directory</span>
            </TabsTrigger>

            {/* Section 2: Data Management */}
            <TabsTrigger 
              value="permanent-deletion" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <Trash2 className="h-4 w-4 mr-1.5 text-rose-600 shrink-0" />
              <span>Permanent Deletions</span>
            </TabsTrigger>

            <TabsTrigger 
              value="system-purge" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <ShieldAlert className="h-4 w-4 mr-1.5 text-amber-600 shrink-0" />
              <span>System Data Purges</span>
            </TabsTrigger>

            <TabsTrigger 
              value="backup-restore" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <Database className="h-4 w-4 mr-1.5 text-emerald-600 shrink-0" />
              <span>System Backup &amp; Restore</span>
            </TabsTrigger>

            <TabsTrigger 
              value="import-export" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <FileDown className="h-4 w-4 mr-1.5 text-blue-600 shrink-0" />
              <span>Import &amp; Export</span>
            </TabsTrigger>

            {/* Section 3: System Infrastructure */}
            <TabsTrigger 
              value="system-health" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <Activity className="h-4 w-4 mr-1.5 text-teal-600 shrink-0" />
              <span>System Health &amp; Storage</span>
            </TabsTrigger>

            <TabsTrigger 
              value="federation-sharing" 
              className="rounded-xl py-2 px-3 sm:px-4 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
            >
              <Share2 className="h-4 w-4 mr-1.5 text-cyan-600 shrink-0" />
              <span>Federation &amp; Sharing</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Activity & Audit Logs */}
        <TabsContent value="audit-logs" className="space-y-6 outline-none">
          <AuditLogsTab />
        </TabsContent>

        {/* Tab 2: Staff Directory & RBAC Governance */}
        <TabsContent value="staff-directory" className="space-y-6 outline-none">
          <StaffManagement />
        </TabsContent>

        {/* Tab 3: Permanent Deletions */}
        <TabsContent value="permanent-deletion" className="space-y-6 outline-none">
          <PermanentDeletionHub />
        </TabsContent>

        {/* Tab 4: System Data Purge */}
        <TabsContent value="system-purge" className="space-y-6 outline-none">
          <SystemDataPurgeTab />
        </TabsContent>

        {/* Tab 5: System Backup & Restore */}
        <TabsContent value="backup-restore" className="space-y-6 outline-none">
          <BackupRestoreTab />
        </TabsContent>

        {/* Tab 6: Import & Export */}
        <TabsContent value="import-export" className="space-y-6 outline-none">
          <ImportExportTab />
        </TabsContent>

        {/* Tab 7: System Health & Storage */}
        <TabsContent value="system-health" className="space-y-6 outline-none">
          <SystemHealthTab />
        </TabsContent>

        {/* Tab 8: Federation & Sharing */}
        <TabsContent value="federation-sharing" className="space-y-6 outline-none">
          <FederationSharingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
