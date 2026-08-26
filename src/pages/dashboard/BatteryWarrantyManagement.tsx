import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert, 
  BatteryCharging, 
  Search, 
  Filter, 
  Download, 
  Mail, 
  Share2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  History, 
  Phone, 
  Smartphone, 
  FileText, 
  Calendar, 
  ExternalLink,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
  Send,
  MessageCircle,
  Eye,
  Wrench,
  UserCheck,
  Trash2,
  KeyRound,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Upload,
  FileDown,
  FileCheck2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, isFuture, addDays } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { 
  downloadWarrantyCertificatePdf, 
  getWarrantyWhatsAppShareUrl,
  BatteryWarrantyData
} from '@/services/warrantyCertificateService';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function BatteryWarrantyManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUPERADMIN' || user?.email?.toLowerCase() === 'mtsmobilelab@gmail.com';
  const canManageExcel = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '') || isSuperAdmin;

  // Excel Import / Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);

  const [warranties, setWarranties] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
    claims: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');

  // Multi-Selection State for Super Admin Permanent Deletion
  const [selectedWarrantyIds, setSelectedWarrantyIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingWarranties, setDeletingWarranties] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [targetDeleteWarranties, setTargetDeleteWarranties] = useState<any[]>([]);

  // Modals
  const [selectedWarranty, setSelectedWarranty] = useState<any | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Claim Form State
  const [claimIssue, setClaimIssue] = useState('');
  const [claimAction, setClaimAction] = useState('BATTERY_REPLACED');
  const [claimNotes, setClaimNotes] = useState('');
  const [createRepairFromClaim, setCreateRepairFromClaim] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Email Send State
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Standalone Warranty Creation Form State
  const [allRepairs, setAllRepairs] = useState<any[]>([]);
  const [selectedRepairId, setSelectedRepairId] = useState('');
  const [newWarrantyPeriod, setNewWarrantyPeriod] = useState<'6_MONTHS' | '1_YEAR'>('6_MONTHS');
  const [newBatteryType, setNewBatteryType] = useState('Original Replacement Battery');
  const [creatingWarranty, setCreatingWarranty] = useState(false);

  const fetchWarranties = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (periodFilter !== 'ALL') params.append('period', periodFilter);

      const res = await api.get(`/battery-warranties?${params.toString()}`);
      if (res?.warranties) {
        setWarranties(res.warranties);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Error fetching battery warranties:', err);
      toast.error(err.message || 'Failed to load battery warranties');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchEligibleRepairs = async () => {
    try {
      const res = await api.get('/repairs');
      const list = Array.isArray(res) ? res : (res?.repairs || []);
      setAllRepairs(list);
    } catch (err) {
      console.error('Error fetching repairs for warranty creation:', err);
    }
  };

  const realtimeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchWarranties();
  }, [statusFilter, periodFilter]);

  // Real-time synchronization across devices (debounced for smooth, non-flickering updates)
  const realtimeEntities = useMemo(() => ['batteryWarranty', 'batteryWarrantyClaim', 'repair'], []);
  useRealtimeSync(realtimeEntities, () => {
    if (realtimeDebounceTimerRef.current) {
      clearTimeout(realtimeDebounceTimerRef.current);
    }
    realtimeDebounceTimerRef.current = setTimeout(() => {
      fetchWarranties(true);
    }, 250);
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWarranties();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWarranties(true);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    if (!canManageExcel) {
      toast.error("You are not authorized to export warranty data.");
      return;
    }

    setExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (periodFilter !== 'ALL') params.append('period', periodFilter);

      const filename = `MTS_Lab_Battery_Warranties_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      await api.download(`/battery-warranties/export?${params.toString()}`, filename);

      toast.success("Excel warranty records exported successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to export Excel file.");
    } finally {
      setExportingExcel(false);
    }
  };

  // Download Template Handler
  const handleDownloadTemplate = async () => {
    if (!canManageExcel) {
      toast.error("You are not authorized to download template.");
      return;
    }

    setDownloadingTemplate(true);
    try {
      await api.download('/battery-warranties/import/template', 'MTS_Lab_Battery_Warranty_Template.xlsx');
      toast.success("Blank warranty Excel template downloaded.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to download Excel template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // File Select and Generate Preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Please upload a valid Excel (.xlsx) file.");
      return;
    }

    setImportFile(file);
    await handleGeneratePreview(file);
  };

  const handleGeneratePreview = async (file: File) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res: any = await api.post('/battery-warranties/import/preview', formData);
      if (!res || (!res.success && !res.items)) {
        throw new Error(res?.error || 'Failed to analyze Excel file');
      }

      setPreviewData(res);
      toast.info(`Analyzed ${res.totalRows} rows: ${res.validRows} valid, ${res.invalidRows} invalid, ${res.duplicateRows} duplicate.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to analyze Excel file.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm and Execute Import
  const handleExecuteConfirmImport = async () => {
    if (!previewData || !previewData.items || previewData.validRows === 0) {
      toast.error("No valid records available to import.");
      return;
    }

    const validItems = previewData.items.filter((item: any) => item.status === 'VALID');
    if (validItems.length === 0) {
      toast.error("No valid records found for import.");
      return;
    }

    setConfirmingImport(true);
    try {
      const res: any = await api.post('/battery-warranties/import/confirm', {
        items: validItems
      });

      if (res?.success) {
        toast.success(res.message || `Imported ${res.importedCount} battery warranty records successfully!`);
        setIsImportModalOpen(false);
        setImportFile(null);
        setPreviewData(null);
        fetchWarranties();
      } else {
        toast.error(res?.error || "Failed to import records.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Import execution failed.");
    } finally {
      setConfirmingImport(false);
    }
  };

  // Super Admin Selection & 2FA Deletion Handlers
  const handleSelectAllFiltered = () => {
    if (selectedWarrantyIds.length === warranties.length && warranties.length > 0) {
      setSelectedWarrantyIds([]);
    } else {
      setSelectedWarrantyIds(warranties.map(w => w.id));
    }
  };

  const handleToggleSelectWarranty = (id: string) => {
    setSelectedWarrantyIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenDeleteModal = (warrantyToDel?: any) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can permanently delete records.");
      return;
    }
    const targets = warrantyToDel 
      ? [warrantyToDel] 
      : warranties.filter(w => selectedWarrantyIds.includes(w.id));
    
    if (targets.length === 0) {
      toast.error("Please select at least one warranty record to delete.");
      return;
    }

    setTargetDeleteWarranties(targets);
    setTwoFactorCode('');
    setOtpSent(false);
    setIsDeleteModalOpen(true);
    handleRequest2FACode();
  };

  const handleRequest2FACode = async () => {
    setSendingOtp(true);
    try {
      const res: any = await api.post('/battery-warranties/delete-2fa/request', {});
      if (res?.success) {
        setOtpSent(true);
        setMaskedEmail(res.emailMasked || user?.email || '');
        toast.success(res.message || "2FA verification code sent to your registered email.");
      } else {
        toast.error(res?.message || "Failed to send 2FA verification code.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to request 2FA verification code.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleExecutePermanentDelete = async () => {
    if (!twoFactorCode.trim() || twoFactorCode.trim().length < 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setDeletingWarranties(true);
    try {
      const idsToDelete = targetDeleteWarranties.map(w => w.id);
      const res: any = await api.post('/battery-warranties/bulk-delete', {
        ids: idsToDelete,
        code: twoFactorCode.trim()
      });

      if (res?.success) {
        toast.success(res.message || "Battery warranty records permanently deleted.");
        setIsDeleteModalOpen(false);
        setSelectedWarrantyIds(prev => prev.filter(id => !idsToDelete.includes(id)));
        setTargetDeleteWarranties([]);
        setTwoFactorCode('');
        fetchWarranties();
      } else {
        toast.error(res?.error || res?.message || "Failed to delete warranty records.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Deletion failed. Please verify the 2FA code and try again.");
    } finally {
      setDeletingWarranties(false);
    }
  };

  // Open Certificate Details
  const handleOpenCertificate = (warranty: any) => {
    setSelectedWarranty(warranty);
    setEmailInput(warranty.customerEmail || warranty.customer?.email || '');
    setIsCertificateModalOpen(true);
  };

  // Download PDF
  const handleDownloadPdf = (warranty: any) => {
    try {
      downloadWarrantyCertificatePdf(warranty);
      toast.success(`Downloaded warranty certificate #${warranty.warrantyNumber}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate PDF certificate');
    }
  };

  // Send Email
  const handleSendEmail = async () => {
    if (!selectedWarranty) return;
    const targetEmail = (emailInput || selectedWarranty.customerEmail || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      toast.error('Please enter a valid recipient email address');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await api.post(`/battery-warranties/${selectedWarranty.id}/send-email`, {
        email: targetEmail
      });
      toast.success(res.message || `Warranty certificate sent to ${targetEmail}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email certificate');
    } finally {
      setSendingEmail(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = (warranty: any) => {
    const cleanPhone = (warranty.customerPhone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error('No customer phone number available for WhatsApp sharing');
      return;
    }
    const url = getWarrantyWhatsAppShareUrl(warranty);
    window.open(url, '_blank');
  };

  // Open Claim Modal
  const handleOpenClaimModal = (warranty: any) => {
    setSelectedWarranty(warranty);
    setClaimIssue('');
    setClaimAction('BATTERY_REPLACED');
    setClaimNotes('');
    setCreateRepairFromClaim(false);
    setIsClaimModalOpen(true);
  };

  // Submit Claim
  const handleSubmitClaim = async () => {
    if (!selectedWarranty) return;
    if (!claimIssue.trim()) {
      toast.error('Please describe the battery problem / reason for claim');
      return;
    }

    setSubmittingClaim(true);
    try {
      const res = await api.post(`/battery-warranties/${selectedWarranty.id}/claim`, {
        issueDescription: claimIssue.trim(),
        actionTaken: claimAction,
        notes: claimNotes.trim() || undefined
      });

      toast.success(res.message || 'Warranty claim processed and recorded successfully!');
      setIsClaimModalOpen(false);
      fetchWarranties(true);

      // If user opted to create a replacement repair job
      if (createRepairFromClaim) {
        navigate('/dashboard/repairs/new', {
          state: {
            fromWarranty: selectedWarranty,
            claimInfo: res.claim
          }
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process warranty claim');
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Open Claim History Modal
  const handleOpenHistoryModal = (warranty: any) => {
    setSelectedWarranty(warranty);
    setIsHistoryModalOpen(true);
  };

  // Create Standalone Warranty
  const handleCreateStandaloneWarranty = async () => {
    if (!selectedRepairId) {
      toast.error('Please select a repair job to attach the warranty to');
      return;
    }

    setCreatingWarranty(true);
    try {
      const res = await api.post('/battery-warranties', {
        repairId: selectedRepairId,
        warrantyPeriod: newWarrantyPeriod,
        batteryType: newBatteryType
      });

      toast.success(res.message || 'Battery warranty created successfully!');
      setIsCreateModalOpen(false);
      setSelectedRepairId('');
      fetchWarranties(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create battery warranty');
    } finally {
      setCreatingWarranty(false);
    }
  };

  // Quick Action: Create New Repair From Warranty
  const handleCreateNewRepairFromWarranty = (warranty: any) => {
    navigate('/dashboard/repairs/new', {
      state: {
        fromWarranty: warranty
      }
    });
  };

  // Compute status presentation
  const getWarrantyStatusBadge = (warranty: any) => {
    const exp = new Date(warranty.expiryDate);
    const now = new Date();
    const isExp = exp < now || warranty.status === 'EXPIRED';
    const isSoon = !isExp && exp <= addDays(now, 30);

    if (warranty.status === 'REPLACED') {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[11px] px-2.5 py-0.5">
          <RotateCcw className="w-3 h-3 mr-1" /> Replaced
        </Badge>
      );
    }

    if (warranty.status === 'CLAIMED') {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[11px] px-2.5 py-0.5">
          <History className="w-3 h-3 mr-1" /> Claimed ({warranty.claimCount})
        </Badge>
      );
    }

    if (isExp) {
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[11px] px-2.5 py-0.5">
          <AlertTriangle className="w-3 h-3 mr-1" /> Expired
        </Badge>
      );
    }

    if (isSoon) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[11px] px-2.5 py-0.5">
          <Clock className="w-3 h-3 mr-1 text-amber-600" /> Expiring Soon
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[11px] px-2.5 py-0.5">
        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Active
      </Badge>
    );
  };

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-24">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20">
              <BatteryCharging className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Battery Warranty Hub</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                  Internal Lab
                </Badge>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Manage battery replacement certificates, customer expiry dates, and warranty claims
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DashboardRefreshButton
            onRefresh={handleRefresh}
            isRefreshing={refreshing}
            showLastUpdated={false}
            label="Refresh"
            refreshingLabel="Refreshing..."
            size="sm"
          />

          {canManageExcel && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold h-10 px-3.5 shadow-2xs flex items-center gap-1.5 cursor-pointer text-xs"
                title="Download Blank Excel Import Template"
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <FileDown className="w-4 h-4 text-indigo-600" />
                )}
                <span className="hidden sm:inline">Template</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setImportFile(null);
                  setPreviewData(null);
                  setIsImportModalOpen(true);
                }}
                className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold h-10 px-3.5 shadow-2xs flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Import Excel</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold h-10 px-3.5 shadow-2xs flex items-center gap-1.5 cursor-pointer text-xs"
              >
                {exportingExcel ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                )}
                <span>Export Excel</span>
              </Button>
            </>
          )}

          <Button
            onClick={() => {
              fetchEligibleRepairs();
              setIsCreateModalOpen(true);
            }}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 px-4 shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Attach Warranty</span>
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* Total Warranties */}
        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Warranties</p>
              <h3 className="text-2xl font-black text-slate-900">{summary.total}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Active Warranties */}
        <Card className="rounded-2xl border-emerald-100 shadow-xs bg-emerald-50/40 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Active Coverage</p>
              <h3 className="text-2xl font-black text-emerald-900">{summary.active}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Expiring Soon (<30 Days) */}
        <Card className="rounded-2xl border-amber-200 shadow-xs bg-amber-50/50 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Expiring &lt;30 Days</p>
              <h3 className="text-2xl font-black text-amber-950">{summary.expiringSoon}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Expired */}
        <Card className="rounded-2xl border-slate-200 shadow-xs bg-slate-50 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expired</p>
              <h3 className="text-2xl font-black text-slate-700">{summary.expired}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Claims Processed */}
        <Card className="rounded-2xl border-purple-200 shadow-xs bg-purple-50/40 hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Claims Filed</p>
              <h3 className="text-2xl font-black text-purple-950">{summary.claims}</h3>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Filters and Search Bar */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Search Box */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by phone number, customer name, repair # (e.g. 9869276668 or MTS-2026-0001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-24 h-11 rounded-xl border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm font-medium"
              />
              <Button 
                type="submit" 
                size="sm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg bg-slate-900 text-white font-bold text-xs"
              >
                Search
              </Button>
            </form>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 flex-wrap">
              
              {/* Period Filter */}
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-bold text-slate-500 shrink-0">Period:</Label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold w-36">
                    <SelectValue placeholder="All Periods" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Periods</SelectItem>
                    <SelectItem value="6_MONTHS">6 Months</SelectItem>
                    <SelectItem value="1_YEAR">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-bold text-slate-500 shrink-0">Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold w-36">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active Only</SelectItem>
                    <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                    <SelectItem value="EXPIRED">Expired Only</SelectItem>
                    <SelectItem value="CLAIMED">Claimed</SelectItem>
                    <SelectItem value="REPLACED">Replaced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filter Button */}
              {(searchQuery || statusFilter !== 'ALL' || periodFilter !== 'ALL') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setPeriodFilter('ALL');
                  }}
                  className="h-10 px-3 rounded-xl text-slate-500 hover:text-slate-900 text-xs font-semibold"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}

            </div>

          </div>
        </CardContent>
      </Card>

      {/* Super Admin Multi-Selection Banner */}
      {isSuperAdmin && selectedWarrantyIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {selectedWarrantyIds.length}
            </div>
            <div>
              <p className="text-sm font-black text-rose-950 flex items-center gap-2">
                <span>{selectedWarrantyIds.length} Warranty Record{selectedWarrantyIds.length > 1 ? 's' : ''} Selected</span>
                <Badge className="bg-rose-200 text-rose-900 border-rose-300 text-[10px] font-bold">2FA REQUIRED</Badge>
              </p>
              <p className="text-xs text-rose-700 font-semibold">
                Permanent deletion will atomically purge all associated warranty and claim records.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWarrantyIds([])}
              className="rounded-xl border-rose-200 text-rose-800 hover:bg-rose-100 text-xs font-bold"
            >
              Deselect All
            </Button>
            <Button
              size="sm"
              onClick={() => handleOpenDeleteModal()}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Permanently Delete Selected ({selectedWarrantyIds.length})
            </Button>
          </div>
        </motion.div>
      )}

      {/* Main Table / Grid of Warranties */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-900 text-white px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Registered Battery Warranties</span>
              <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs font-semibold">
                {warranties.length} Records
              </Badge>
              {isSuperAdmin && (
                <Badge className="bg-rose-600/30 text-rose-300 border-rose-500/40 text-[10px] font-bold ml-1">
                  SUPER ADMIN CONTROLS ACTIVE
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-0.5">
              Official warranty logs with automatic expiration tracking and claim histories
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold text-slate-500">Loading warranty database records...</p>
            </div>
          ) : warranties.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <BatteryCharging className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Battery Warranties Found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchQuery || statusFilter !== 'ALL' || periodFilter !== 'ALL'
                  ? 'No warranty matches your filter criteria. Try adjusting your search query or filter selection.'
                  : 'No battery replacement warranties registered yet. When a new repair includes battery warranty, it will appear here automatically.'}
              </p>
              <Button
                onClick={() => navigate('/dashboard/repairs/new')}
                size="sm"
                className="mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Intake New Repair with Warranty
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    {isSuperAdmin && (
                      <th className="py-3.5 pl-4 pr-2 w-10">
                        <button
                          type="button"
                          onClick={handleSelectAllFiltered}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer flex items-center"
                          title={selectedWarrantyIds.length === warranties.length ? "Deselect All" : "Select All"}
                        >
                          {selectedWarrantyIds.length === warranties.length && warranties.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className={cn("py-3.5 px-4", !isSuperAdmin && "sm:px-6")}>Warranty ID & Job #</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Device & Model</th>
                    <th className="py-3.5 px-4">Duration & Expiry</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Claims</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {warranties.map((item) => {
                    const exp = new Date(item.expiryDate);
                    const isExp = exp < new Date() || item.status === 'EXPIRED';
                    const daysRemaining = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isSelected = selectedWarrantyIds.includes(item.id);

                    return (
                      <tr 
                        key={item.id} 
                        className={cn(
                          "transition-colors group",
                          isSelected ? "bg-rose-50/60" : "hover:bg-slate-50/60"
                        )}
                      >
                        {isSuperAdmin && (
                          <td className="py-4 pl-4 pr-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectWarranty(item.id)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer flex items-center"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        )}

                        {/* Warranty Number & Repair Number */}
                        <td className={cn("py-4 px-4", !isSuperAdmin && "sm:px-6")}>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 font-mono text-xs flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {item.warrantyNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => item.repairId && navigate(`/dashboard/repairs/${item.repairId}`)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold text-left mt-0.5 hover:underline cursor-pointer inline-flex items-center gap-1"
                            >
                              Job #{item.repairNumber}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs">{item.customerName}</span>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              <span>{item.customerPhone}</span>
                            </div>
                          </div>
                        </td>

                        {/* Device */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-xs">
                              {item.deviceBrand.toUpperCase()} {item.deviceModel}
                            </span>
                            {item.batteryType && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                {item.batteryType}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Duration & Expiry */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold px-1.5 py-0",
                                item.warrantyPeriod === '1_YEAR' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              )}>
                                {item.warrantyPeriod === '1_YEAR' ? '1 Year' : '6 Months'}
                              </Badge>
                              <span className="text-[11px] text-slate-600 font-medium">
                                Exp: {format(exp, 'dd MMM yyyy')}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-semibold",
                              isExp ? "text-rose-600" : daysRemaining <= 30 ? "text-amber-600" : "text-slate-400"
                            )}>
                              {isExp ? 'Expired' : `${daysRemaining} day(s) remaining`}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          {getWarrantyStatusBadge(item)}
                        </td>

                        {/* Claims */}
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <History className="w-3 h-3 text-slate-500" />
                            <span>{item.claimCount || (item.claims ? item.claims.length : 0)} Claim(s)</span>
                          </button>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Certificate / View */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenCertificate(item)}
                              className="h-8 px-2.5 rounded-lg border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                              title="View & Download PDF Certificate"
                            >
                              <FileText className="w-3.5 h-3.5 mr-1 text-slate-600" />
                              Certificate
                            </Button>

                            {/* Process Claim Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenClaimModal(item)}
                              className="h-8 px-2.5 rounded-lg border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold"
                              title="Process Warranty Claim"
                            >
                              <Wrench className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                              Claim
                            </Button>

                            {/* WhatsApp Share Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleShareWhatsApp(item)}
                              className="h-8 w-8 rounded-lg hover:bg-emerald-50 text-emerald-600"
                              title="Share on WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>

                            {/* Create New Repair From Warranty */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCreateNewRepairFromWarranty(item)}
                              className="h-8 w-8 rounded-lg hover:bg-blue-50 text-blue-600"
                              title="Create New Repair with this Customer"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>

                            {/* Super Admin Permanent Delete Button (2FA Protected) */}
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDeleteModal(item)}
                                className="h-8 w-8 rounded-lg hover:bg-rose-100 text-rose-600"
                                title="Permanently Delete Warranty (2FA Required)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================================================== */}
      {/* 1. CERTIFICATE PREVIEW & ACTIONS DIALOG */}
      {/* ==================================================== */}
      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Battery Warranty Certificate
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Official customer-facing document (Prices & costs are excluded).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedWarranty && (
            <div className="space-y-5 py-2">
              
              {/* Certificate Preview Card */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Certificate ID</span>
                    <h3 className="text-base font-black text-slate-900 font-mono">{selectedWarranty.warrantyNumber}</h3>
                  </div>
                  {getWarrantyStatusBadge(selectedWarranty)}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Customer Name</span>
                    <span className="font-bold text-slate-900">{selectedWarranty.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Phone Number</span>
                    <span className="font-bold text-slate-900 font-mono">{selectedWarranty.customerPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Repair Job #</span>
                    <span className="font-bold text-blue-600 font-mono">#{selectedWarranty.repairNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Device / Model</span>
                    <span className="font-bold text-slate-900">{selectedWarranty.deviceBrand.toUpperCase()} {selectedWarranty.deviceModel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Registration Date</span>
                    <span className="font-semibold text-slate-800">{format(new Date(selectedWarranty.registrationDate), 'dd MMM yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Warranty Expiry Date</span>
                    <span className="font-extrabold text-rose-600">{format(new Date(selectedWarranty.expiryDate), 'dd MMM yyyy')}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700">Specification: </span>
                  {selectedWarranty.batteryType || 'Original Replacement Battery'} ({selectedWarranty.warrantyPeriod === '1_YEAR' ? '1 Year Plan' : '6 Months Plan'})
                </div>
              </div>

              {/* Email Send Input */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Send Certificate to Customer Email</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. customer@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 text-xs"
                  />
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !emailInput.trim()}
                    className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shrink-0 flex items-center gap-1.5"
                  >
                    {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Email</span>
                  </Button>
                </div>
              </div>

            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-100 pt-4 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShareWhatsApp(selectedWarranty)}
              className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
              <span>WhatsApp Share</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCertificateModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Close
              </Button>

              <Button
                size="sm"
                onClick={() => handleDownloadPdf(selectedWarranty)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* 2. PROCESS WARRANTY CLAIM DIALOG */}
      {/* ==================================================== */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Process Battery Warranty Claim
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Record claim diagnostics, battery replacement, and lab action taken.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedWarranty && (
            <div className="space-y-4 py-2">
              
              {/* Warranty Summary Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Customer & Device</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedWarranty.customerName} ({selectedWarranty.customerPhone})</div>
                  <div className="text-slate-600">{selectedWarranty.deviceBrand.toUpperCase()} {selectedWarranty.deviceModel} • Job #{selectedWarranty.repairNumber}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Expiry Status</span>
                  <div className="mt-0.5">{getWarrantyStatusBadge(selectedWarranty)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Exp: {format(new Date(selectedWarranty.expiryDate), 'dd MMM yyyy')}</div>
                </div>
              </div>

              {/* Warning if Expired */}
              {isPast(new Date(selectedWarranty.expiryDate)) && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Warning: This warranty expired on {format(new Date(selectedWarranty.expiryDate), 'dd MMM yyyy')}. Normal warranty claims cannot be approved.</span>
                </div>
              )}

              {/* Problem Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Battery Problem / Customer Complaint <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  placeholder="e.g. Battery draining rapidly (drops 100% to 20% in 2 hours), device shutting down under 30% load, battery swollen..."
                  value={claimIssue}
                  onChange={(e) => setClaimIssue(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs min-h-[75px]"
                  required
                />
              </div>

              {/* Action Taken */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Action Taken / Resolution</Label>
                <Select value={claimAction} onValueChange={setClaimAction}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-semibold">
                    <SelectValue placeholder="Select Action" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="BATTERY_REPLACED">Battery Replaced with New Unit</SelectItem>
                    <SelectItem value="DIAGNOSTIC_COMPLETED">Diagnostic Tested (No Defect Found / Calibrated)</SelectItem>
                    <SelectItem value="SERVICED">Connector / Power IC Cleaned & Serviced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Internal Lab Notes</Label>
                <Input
                  placeholder="e.g. Verified with battery analyzer; replacement battery serial: #BAT-99182"
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 text-xs"
                />
              </div>

              {/* Checkbox: Create new repair automatically */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-blue-100 bg-blue-50/50">
                <input
                  type="checkbox"
                  id="createRepairCheck"
                  checked={createRepairFromClaim}
                  onChange={(e) => setCreateRepairFromClaim(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <Label htmlFor="createRepairCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Open New Repair Form automatically with pre-filled customer & device details
                </Label>
              </div>

            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-4 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClaimModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleSubmitClaim}
              disabled={submittingClaim || !claimIssue.trim()}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              {submittingClaim && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Approve & Record Claim</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* 3. CLAIM HISTORY MODAL */}
      {/* ==================================================== */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Warranty Claim History
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Complete chronological claim log for #{selectedWarranty?.warrantyNumber}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedWarranty && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{selectedWarranty.customerName}</span>
                  <div className="text-slate-500 text-[11px]">{selectedWarranty.deviceBrand.toUpperCase()} {selectedWarranty.deviceModel}</div>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold">
                  {selectedWarranty.claims?.length || selectedWarranty.claimCount || 0} Total Claims
                </Badge>
              </div>

              {(!selectedWarranty.claims || selectedWarranty.claims.length === 0) ? (
                <div className="p-10 text-center text-slate-400 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No Claims Filed</p>
                  <p className="text-[11px] text-slate-400">This battery warranty has not had any service or replacement claims.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {selectedWarranty.claims.map((claim: any, idx: number) => (
                    <div key={claim.id || idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-slate-900 font-mono">{claim.claimNumber}</span>
                        <span className="text-[11px] text-slate-500 font-semibold">{format(new Date(claim.claimDate), 'dd MMM yyyy, HH:mm')}</span>
                      </div>

                      <div className="text-xs text-slate-800">
                        <span className="font-bold text-slate-600">Issue: </span>
                        {claim.issueDescription}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-500">
                          Action: <strong className="text-slate-800">{claim.actionTaken?.replace(/_/g, ' ')}</strong>
                        </span>
                        <span className="text-slate-500">
                          Processed By: <strong className="text-slate-800">{claim.processedByName}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* 4. ATTACH STANDALONE WARRANTY MODAL */}
      {/* ==================================================== */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Attach Battery Warranty
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Attach a warranty to an existing registered repair job.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            
            {/* Select Repair */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Select Repair Job</Label>
              <Select value={selectedRepairId} onValueChange={setSelectedRepairId}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-semibold w-full shadow-2xs">
                  <SelectValue placeholder="Choose a repair job..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-72 min-w-[300px] sm:min-w-[380px] max-w-[calc(100vw-2rem)]">
                  {allRepairs.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs py-2 px-3">
                      <div className="flex flex-col gap-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">#{r.repairNumber}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                            {(r.deviceBrand || '').toUpperCase()} {r.deviceModel}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-700 truncate">
                          {r.customerName} {r.customerPhone ? `• ${r.customerPhone}` : ''}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warranty Period */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Warranty Period</Label>
              <Select value={newWarrantyPeriod} onValueChange={(v: any) => setNewWarrantyPeriod(v)}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="6_MONTHS">6 Months Warranty</SelectItem>
                  <SelectItem value="1_YEAR">1 Year (12 Months) Warranty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Battery Spec */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Battery Specification</Label>
              <Input
                placeholder="e.g. Original Apple Battery"
                value={newBatteryType}
                onChange={(e) => setNewBatteryType(e.target.value)}
                className="h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>

          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleCreateStandaloneWarranty}
              disabled={creatingWarranty || !selectedRepairId}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              {creatingWarranty && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Warranty</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* 5. SUPER ADMIN 2FA PERMANENT DELETION DIALOG */}
      {/* ==================================================== */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border-rose-200">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-rose-950 flex items-center gap-1.5">
                  <span>Permanent Deletion (2FA)</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-rose-700 font-semibold">
                  Super Admin authorization + Email 2FA verification required
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            
            {/* Warning Message */}
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-rose-950">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                This action is destructive and irreversible!
              </p>
              <p className="text-[11px] text-rose-800">
                You are about to permanently delete <strong>{targetDeleteWarranties.length}</strong> battery warranty record(s) and all associated claims:
              </p>
              <div className="max-h-24 overflow-y-auto bg-white/70 rounded-xl p-2 border border-rose-100 text-[11px] font-mono space-y-1">
                {targetDeleteWarranties.map((w, idx) => (
                  <div key={w.id || idx} className="text-slate-800 flex justify-between">
                    <span className="font-bold">#{w.warrantyNumber}</span>
                    <span className="text-slate-500">{w.customerName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2FA Section */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Email 2FA Verification</span>
                </div>
                {otpSent && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                    CODE SENT
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                {maskedEmail 
                  ? `Enter the 6-digit verification code sent to your registered email (${maskedEmail}):` 
                  : "A 6-digit security code has been sent to your Super Admin email address."}
              </p>

              <div className="space-y-2">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="0 0 0 0 0 0"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center font-mono text-xl tracking-[0.4em] font-black h-12 bg-slate-800 border-slate-700 text-white rounded-xl focus:border-rose-500"
                />
                
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Code expires in 5 minutes</span>
                  <button
                    type="button"
                    onClick={handleRequest2FACode}
                    disabled={sendingOtp}
                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer disabled:opacity-50"
                  >
                    {sendingOtp ? "Sending Code..." : "Resend 2FA Code"}
                  </button>
                </div>
              </div>
            </div>

          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 flex sm:justify-between items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setTwoFactorCode('');
                setTargetDeleteWarranties([]);
              }}
              disabled={deletingWarranties}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleExecutePermanentDelete}
              disabled={deletingWarranties || twoFactorCode.trim().length < 6}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              {deletingWarranties ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting Records...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Permanent Deletion</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import & Preview Dialog */}
      <Dialog 
        open={isImportModalOpen} 
        onOpenChange={(open) => {
          if (!confirmingImport) {
            setIsImportModalOpen(open);
            if (!open) {
              setImportFile(null);
              setPreviewData(null);
            }
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden border border-slate-200 bg-white shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-black text-slate-900">
                    Import Battery Warranties from Excel
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-medium">
                    Upload an Excel (.xlsx) file to register warranties, link customer accounts, and prevent duplicates.
                  </DialogDescription>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="rounded-xl text-xs font-bold gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Download Template</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* File Upload / Selection Area */}
            {!previewData && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500/70 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer relative group">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileSelect}
                    disabled={previewLoading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center space-y-3 pointer-events-none">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                      {previewLoading ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <Upload className="w-7 h-7" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">
                        {previewLoading ? "Analyzing Excel Worksheet..." : "Click or drag & drop your Excel (.xlsx) file here"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Supports .xlsx files with Customer Name, Phone, Device Brand/Model, and Warranty Period.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-2">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Safety & Data Integrity Rules
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                    <li>Phone numbers and IMEI numbers retain leading zeros safely.</li>
                    <li>Existing customer records and repair jobs are automatically linked without creating duplicates.</li>
                    <li>Warranty expiry dates are auto-calculated (6 Months or 1 Year) if not specified.</li>
                    <li>All rows are validated and shown in a clear preview table before any database changes.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Preview Table & Validation Results */}
            {previewData && (
              <div className="space-y-5">
                {/* Summary Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Rows</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{previewData.totalRows}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Valid Rows</span>
                    <p className="text-xl font-black text-emerald-700 mt-0.5">{previewData.validRows}</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Invalid Rows</span>
                    <p className="text-xl font-black text-rose-700 mt-0.5">{previewData.invalidRows}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Duplicates</span>
                    <p className="text-xl font-black text-amber-700 mt-0.5">{previewData.duplicateRows}</p>
                  </div>
                </div>

                {/* Reset / Pick Different File */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-bold text-slate-700">
                    File: <span className="text-slate-900 font-mono">{importFile?.name}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImportFile(null);
                      setPreviewData(null);
                    }}
                    className="text-xs h-7 text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    Choose Different File
                  </Button>
                </div>

                {/* Table Container */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold z-10">
                      <tr>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Customer & Phone</th>
                        <th className="py-2.5 px-3">Device Info</th>
                        <th className="py-2.5 px-3">Warranty Details</th>
                        <th className="py-2.5 px-3">Validation Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.items.map((item: any) => (
                        <tr 
                          key={item.rowNumber}
                          className={
                            item.status === 'INVALID' 
                              ? 'bg-rose-50/40' 
                              : item.status === 'DUPLICATE' 
                                ? 'bg-amber-50/30' 
                                : 'hover:bg-slate-50/60'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                            #{item.rowNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.status === 'VALID' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-bold">
                                VALID
                              </Badge>
                            )}
                            {item.status === 'INVALID' && (
                              <Badge className="bg-rose-100 text-rose-800 border-none text-[10px] font-bold">
                                INVALID
                              </Badge>
                            )}
                            {item.status === 'DUPLICATE' && (
                              <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold">
                                DUPLICATE
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900">{item.data.customerName || '—'}</p>
                            <p className="font-mono text-slate-500 text-[11px]">{item.data.customerPhone || '—'}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-800">{item.data.deviceBrand} {item.data.deviceModel}</p>
                            {item.data.repairNumber && (
                              <p className="text-slate-400 text-[11px]">Job #{item.data.repairNumber}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-indigo-600">
                              {item.data.warrantyPeriod === '1_YEAR' ? '1 Year' : '6 Months'}
                            </span>
                            <p className="text-slate-400 text-[10px]">
                              {format(new Date(item.data.registrationDate), 'dd/MM/yyyy')} &rarr; {format(new Date(item.data.expiryDate), 'dd/MM/yyyy')}
                            </p>
                          </td>
                          <td className="py-2.5 px-3">
                            {item.errors.length > 0 ? (
                              <div className="space-y-0.5 text-rose-600 font-semibold text-[11px]">
                                {item.errors.map((err: string, eIdx: number) => (
                                  <p key={eIdx}>&bull; {err}</p>
                                ))}
                              </div>
                            ) : item.warnings.length > 0 ? (
                              <div className="space-y-0.5 text-amber-700 text-[11px]">
                                {item.warnings.map((warn: string, wIdx: number) => (
                                  <p key={wIdx}>&bull; {warn}</p>
                                ))}
                              </div>
                            ) : (
                              <span className="text-emerald-600 font-medium text-[11px]">Ready for import</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:justify-between items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setPreviewData(null);
              }}
              disabled={confirmingImport}
              className="rounded-xl font-bold text-xs w-full sm:w-auto cursor-pointer"
            >
              Cancel
            </Button>

            {previewData && (
              <Button
                onClick={handleExecuteConfirmImport}
                disabled={confirmingImport || previewData.validRows === 0}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs w-full sm:w-auto shadow-sm cursor-pointer"
              >
                {confirmingImport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Importing {previewData.validRows} Records...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4 mr-1.5" />
                    <span>Confirm & Import ({previewData.validRows} Valid Records)</span>
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
