import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone,
  Clock,
  CircleCheck as CheckCircle2,
  MessageSquare,
  Wrench,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRightLeft,
  Bell,
  Check,
  X,
  Search,
  Flame,
  ShieldCheck,
  Zap,
  Package,
  Eye,
  Calendar,
  CalendarDays,
  CalendarRange,
  Activity,
  Cpu,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  Filter,
  Layers,
  Truck,
  UserCheck,
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Sparkles,
  TrendingUp,
  AlertCircle,
  FileText,
  ArrowUpRight,
  User,
  Phone,
  Tag,
  List,
  Grid
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useDashboardCache } from '@/store/dashboardCache';
import { useRealtimeSync } from '@/services/realtime';
import { syncRepairToSupabase as syncRepairToRtdb } from '@/lib/supabase';
import { formatTimeAgo, formatShortTimeAgo } from '@/lib/timeUtils';
import { getNepalCalendarInfo, toNepalDateString } from '@/lib/nepalDate';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import UserOverviewCards from '@/components/dashboard/UserOverviewCards';
import { Pagination } from '@/components/common/Pagination';
import { REPAIRS_PER_PAGE } from '@/lib/pagination';
import { detectDeviceCategory } from '@/pages/technician/types';
import {
  TechnicianOverviewSkeleton,
  TechnicianRepairsSkeleton,
  TechnicianTransfersSkeleton
} from '@/pages/technician/TechnicianSkeletons';

export type MainWorkspaceSection = 'OVERVIEW' | 'REPAIRS' | 'COMPLETED' | 'TRANSFERS';

export type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export type StatusFilterTab =
  | 'ACTIVE'
  | 'PENDING'
  | 'IN_PROCESS'
  | 'WAITING_FOR_PARTS'
  | 'TESTING'
  | 'PRIORITY'
  | 'REPAIRED';

/**
 * Strictly authorized technician status flow.
 * Note: Delivered, Ready for Pickup, and Re-Problem (Warranty) are reserved for Managers / Receptionists.
 */
export const TECHNICIAN_ALLOWED_STATUSES = [
  { value: 'PENDING', label: 'Pending', desc: 'Awaiting diagnosis or bench inspection' },
  { value: 'DIAGNOSING', label: 'Diagnosing', desc: 'Inspecting device & identifying faults' },
  { value: 'IN_PROCESS', label: 'In Progress', desc: 'Active hardware or board level repair' },
  { value: 'WAITING_FOR_PARTS', label: 'Waiting for Parts', desc: 'Awaiting replacement components' },
  { value: 'TESTING', label: 'Testing QA', desc: 'Post-repair functional & hardware testing' },
  { value: 'REPAIRED', label: 'Repaired', desc: 'Work complete; ready for handover to reception' },
  { value: 'REPROBLEM_FIXED', label: 'Warranty Fixed', desc: 'Warranty rework completed' },
  { value: 'CANNOT_REPAIR', label: 'Cannot Repair', desc: 'Unfixable or customer refused estimate' }
];

export const statusStyles: Record<string, { label: string; badge: string; bgSoft: string; border: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', bgSoft: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800' },
  RECEIVED: { label: 'Received', badge: 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800', bgSoft: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
  DIAGNOSING: { label: 'Diagnosing', badge: 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800', bgSoft: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  IN_PROCESS: { label: 'In Progress', badge: 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800', bgSoft: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800' },
  WAITING_FOR_PARTS: { label: 'Waiting for Parts', badge: 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800', bgSoft: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
  TESTING: { label: 'Testing QA', badge: 'bg-orange-100 dark:bg-orange-950/70 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-800', bgSoft: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  REPAIRED: { label: 'Repaired', badge: 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-800', bgSoft: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', badge: 'bg-emerald-600 dark:bg-emerald-700 text-white border-transparent', bgSoft: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  DELIVERED: { label: 'Delivered', badge: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700', bgSoft: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800' },
  RE_PROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 font-bold', bgSoft: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-300 dark:border-rose-800' },
  REPROBLEM: { label: 'Re-Problem (Warranty)', badge: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 font-bold', bgSoft: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-300 dark:border-rose-800' },
  REPROBLEM_FIXED: { label: 'Warranty Fixed', badge: 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800', bgSoft: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800' },
  CANNOT_REPAIR: { label: 'Cannot Repair', badge: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800', bgSoft: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800' }
};

export function getPriorityMeta(repair: any) {
  const p = String(repair?.priority || 'NORMAL').toUpperCase().trim();

  switch (p) {
    case 'URGENT':
      return {
        tier: 'URGENT' as const,
        label: 'Urgent',
        badgeClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-400 dark:border-rose-700 font-extrabold shadow-xs',
        cardBorder: 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20 dark:ring-rose-500/30 shadow-sm',
        headerBg: 'bg-rose-50/70 dark:bg-rose-950/30',
        icon: Flame,
        iconColor: 'text-rose-600 dark:text-rose-400',
        tagColor: 'text-rose-700 dark:text-rose-300',
        indicatorText: '🔴 Urgent'
      };
    case 'HIGH':
      return {
        tier: 'HIGH' as const,
        label: 'High',
        badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700 font-bold shadow-xs',
        cardBorder: 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-400/20 dark:ring-amber-400/30 shadow-sm',
        headerBg: 'bg-amber-50/60 dark:bg-amber-950/30',
        icon: Zap,
        iconColor: 'text-amber-600 dark:text-amber-400',
        tagColor: 'text-amber-800 dark:text-amber-300',
        indicatorText: '🟠 High'
      };
    case 'MEDIUM':
      return {
        tier: 'MEDIUM' as const,
        label: 'Medium',
        badgeClass: 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 font-semibold shadow-xs',
        cardBorder: 'border-sky-200 dark:border-sky-800 shadow-xs',
        headerBg: 'bg-sky-50/40 dark:bg-sky-950/20',
        icon: Clock,
        iconColor: 'text-sky-600 dark:text-sky-400',
        tagColor: 'text-sky-700 dark:text-sky-300',
        indicatorText: '🟡 Medium'
      };
    default:
      return {
        tier: 'NORMAL' as const,
        label: 'Normal',
        badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium',
        cardBorder: 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700',
        headerBg: 'bg-transparent',
        icon: ShieldCheck,
        iconColor: 'text-slate-500 dark:text-slate-400',
        tagColor: 'text-slate-600 dark:text-slate-400',
        indicatorText: '⚪ Normal'
      };
  }
}

export default function TechnicianDashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Calendar info in Nepal Timezone
  const nepalCalendar = useMemo(() => getNepalCalendarInfo(new Date()), []);

  // Determine initial workspace section from URL (e.g. /dashboard/repairs -> REPAIRS, /dashboard -> OVERVIEW)
  const isRepairsPath = location.pathname.endsWith('/repairs');
  const sectionParam = searchParams.get('section') as MainWorkspaceSection;
  const initialSection: MainWorkspaceSection = sectionParam || (isRepairsPath ? 'REPAIRS' : 'OVERVIEW');
  const [mainSection, setMainSection] = useState<MainWorkspaceSection>(initialSection);

  // Sync mainSection if URL pathname or params change externally
  useEffect(() => {
    if (isRepairsPath && mainSection !== 'REPAIRS') {
      setMainSection('REPAIRS');
    }
  }, [isRepairsPath]);

  // Date Filter State for active bench
  const initialPreset = (searchParams.get('datePreset') as DatePreset) ||
    (localStorage.getItem('mts_tech_date_preset') as DatePreset) ||
    'ALL';
  const initialStart = searchParams.get('startDate') || localStorage.getItem('mts_tech_start_date') || '';
  const initialEnd = searchParams.get('endDate') || localStorage.getItem('mts_tech_end_date') || '';
  const initialTab = (searchParams.get('tab') as StatusFilterTab) || 'ACTIVE';

  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<string>(initialStart);
  const [customEndDate, setCustomEndDate] = useState<string>(initialEnd);
  const [isCustomExpanded, setIsCustomExpanded] = useState(initialPreset === 'CUSTOM');

  // Status Tabs & Search for active bench
  const [activeTab, setActiveTab] = useState<StatusFilterTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'dueDate' | 'priority' | 'recentlyUpdated'>('newest');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Debounce search input to avoid re-rendering stalls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Authoritative 40-record page state
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, datePreset, customStartDate, customEndDate, debouncedSearch, priorityFilter, onlyOverdueFilter, sortBy]);

  // Core Data
  const [repairs, setRepairs] = useState<any[]>([]);
  const [serverStats, setServerStats] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [transferRequests, setTransferRequests] = useState<{ incoming: any[]; outgoing: any[]; pendingIncomingCount: number }>({
    incoming: [],
    outgoing: [],
    pendingIncomingCount: 0
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Attendance Integration State
  const [attendanceOverview, setAttendanceOverview] = useState<{
    todayRecord: any | null;
    stats: any | null;
    serverTime: any | null;
    loading: boolean;
  }>({
    todayRecord: null,
    stats: null,
    serverTime: null,
    loading: true
  });

  // Dedicated "My Completed Work" State
  const [completedWorkList, setCompletedWorkList] = useState<any[]>([]);
  const [completedWorkTotal, setCompletedWorkTotal] = useState<number>(0);
  const [completedWorkLoading, setCompletedWorkLoading] = useState<boolean>(false);
  const [completedPreset, setCompletedPreset] = useState<DatePreset>('THIS_MONTH');
  const [completedCustomStart, setCompletedCustomStart] = useState<string>('');
  const [completedCustomEnd, setCompletedCustomEnd] = useState<string>('');
  const [completedSearch, setCompletedSearch] = useState<string>('');
  const [completedPage, setCompletedPage] = useState<number>(1);
  const [completedTotalPages, setCompletedTotalPages] = useState<number>(1);

  // Time Ticker for relative timestamps
  const [tickerTime, setTickerTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Expanded Problem Descriptions State
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const toggleDescription = (repairId: string) => {
    setExpandedDescriptions(prev => ({ ...prev, [repairId]: !prev[repairId] }));
  };

  // Modals
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // Submitting States
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [respondingTransferId, setRespondingTransferId] = useState<string | null>(null);

  // Update Status Form
  const [updateForm, setUpdateForm] = useState({
    status: '',
    note: '',
    partsUsed: '',
    expectedCompletionDate: ''
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    targetTechnicianId: '',
    reason: ''
  });

  // Notes
  const [repairNotes, setRepairNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);

  // ============================================================================
  // DATA FETCHING: Active Bench, Attendance, Completed Work, Stats
  // ============================================================================

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params: Record<string, string> = {
        preset: datePreset,
        assignedToMeOnly: 'true',
        technicianId: user?.id || ''
      };

      if (datePreset === 'CUSTOM') {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }

      if (activeTab === 'REPAIRED') {
        params.status = 'REPAIRED,READY_FOR_PICKUP,DELIVERED,REPROBLEM_FIXED';
        params.includeCompleted = 'true';
      } else {
        params.scope = 'active';
      }

      const [repairsData, staffData, transfersData, notifsData, statsData] = await Promise.allSettled([
        api.get('/repairs', { params }),
        api.get('/staff'),
        api.get('/repair-transfers/my-requests'),
        api.get('/notifications'),
        api.get('/repairs/stats', {
          params: {
            preset: datePreset,
            startDate: customStartDate || undefined,
            endDate: customEndDate || undefined,
            technicianId: user?.id
          }
        })
      ]);

      let isolatedRepairs: any[] = [];
      if (repairsData.status === 'fulfilled') {
        const rawList = Array.isArray(repairsData.value) ? repairsData.value : [];
        isolatedRepairs = user?.id
          ? rawList.filter((r: any) => r.technicianId === user.id || r.technician?.id === user.id)
          : rawList;
        setRepairs(isolatedRepairs);
      }

      let parsedStats: any = null;
      if (statsData.status === 'fulfilled' && statsData.value) {
        parsedStats = statsData.value;
        setServerStats(parsedStats);
      }

      if (staffData.status === 'fulfilled') {
        const techStaff = (Array.isArray(staffData.value) ? staffData.value : []).filter(
          (s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.id !== user?.id && s.isActive !== false
        );
        setTechnicians(techStaff);
      }

      let transfersPayload: any = null;
      if (transfersData.status === 'fulfilled' && transfersData.value) {
        transfersPayload = {
          incoming: transfersData.value.incoming || [],
          outgoing: transfersData.value.outgoing || [],
          pendingIncomingCount: transfersData.value.pendingIncomingCount || 0
        };
        setTransferRequests(transfersPayload);
      }

      let notifsList: any[] = [];
      if (notifsData.status === 'fulfilled' && notifsData.value) {
        notifsList = Array.isArray(notifsData.value) ? notifsData.value : (notifsData.value.notifications || []);
        setNotifications(notifsList);
        setUnreadNotificationCount(typeof notifsData.value.unreadCount === 'number' ? notifsData.value.unreadCount : notifsList.filter((n: any) => !n.isRead).length);
      }

      // Save to client-side SWR cache
      if (datePreset === 'ALL' && activeTab === 'ACTIVE') {
        useDashboardCache.getState().setTechnician({
          repairs: isolatedRepairs,
          stats: parsedStats,
          transfers: transfersPayload,
          notifications: notifsList,
        }, user?.id);
      }
    } catch (err: any) {
      console.error("[TECHNICIAN DASHBOARD FETCH ERROR]", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, activeTab, user?.id]);

  // Fetch Attendance Integration
  const fetchMyAttendance = useCallback(async () => {
    try {
      setAttendanceOverview(prev => ({ ...prev, loading: true }));
      const [res, timeRes] = await Promise.allSettled([
        api.get('/attendance/my'),
        api.get('/attendance/server-time')
      ]);

      let attData = null;
      let serverTime = null;

      if (res.status === 'fulfilled' && res.value) {
        attData = res.value;
      }
      if (timeRes.status === 'fulfilled' && timeRes.value) {
        serverTime = timeRes.value;
      }

      setAttendanceOverview({
        todayRecord: attData?.todayRecord || null,
        stats: attData?.stats || null,
        serverTime: serverTime || null,
        loading: false
      });
    } catch (err) {
      console.warn('[FETCH MY ATTENDANCE ERROR]', err);
      setAttendanceOverview(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Fetch Authoritative Completed Work
  const fetchCompletedWork = useCallback(async () => {
    try {
      setCompletedWorkLoading(true);
      const params: any = {
        preset: completedPreset,
        page: completedPage,
        limit: 15,
      };

      if (completedPreset === 'CUSTOM') {
        if (completedCustomStart) params.startDate = completedCustomStart;
        if (completedCustomEnd) params.endDate = completedCustomEnd;
      }

      if (completedSearch.trim()) {
        params.search = completedSearch.trim();
      }

      const res: any = await api.get('/repairs/technician/completed-work', { params });
      if (res && res.success) {
        setCompletedWorkList(res.items || []);
        setCompletedWorkTotal(res.total || 0);
        setCompletedTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.warn('[FETCH COMPLETED WORK WARN]', err);
    } finally {
      setCompletedWorkLoading(false);
    }
  }, [completedPreset, completedCustomStart, completedCustomEnd, completedSearch, completedPage]);

  // Initial Prehydration from Cache & Mount
  useEffect(() => {
    const cached = useDashboardCache.getState().technician;
    const isCachedValid = cached.userId === user?.id && cached.repairs && cached.repairs.length > 0;
    if (isCachedValid && datePreset === 'ALL' && activeTab === 'ACTIVE') {
      setRepairs(cached.repairs);
      if (cached.stats) setServerStats(cached.stats);
      if (cached.transfers) setTransferRequests(cached.transfers);
      if (cached.notifications) setNotifications(cached.notifications);
      setLoading(false);
      // Quiet background revalidation
      if (useDashboardCache.getState().isStale('technician', user?.id, 60 * 1000)) {
        fetchDashboardData(true);
      }
    } else {
      fetchDashboardData(false);
    }

    fetchMyAttendance();
    fetchCompletedWork();
  }, [fetchDashboardData, fetchMyAttendance, fetchCompletedWork, token, user?.id]);

  // Refetch completed work when its tab or filters change
  useEffect(() => {
    if (mainSection === 'COMPLETED' || mainSection === 'OVERVIEW') {
      fetchCompletedWork();
    }
  }, [mainSection, completedPreset, completedCustomStart, completedCustomEnd, completedSearch, completedPage, fetchCompletedWork]);

  // ============================================================================
  // REAL-TIME SYNCHRONIZATION
  // ============================================================================

  useRealtimeSync(
    ['repair', 'technicianNote', 'repairLog', 'notification', 'repairTransfer', 'attendance', 'user', 'sync'],
    (event) => {
      const eventTechId = event?.data?.technicianId || event?.data?.metadata?.technicianId;
      const eventUserId = event?.data?.userId;
      const isDirectlyForMe = (eventTechId && eventTechId === user?.id) || (eventUserId && eventUserId === user?.id);

      // Priority Toast Notification for assigned technician
      if (isDirectlyForMe) {
        const eventPriority = String(event?.data?.priority || event?.data?.metadata?.priority || '').toUpperCase();
        const jobNum = event?.data?.repairNumber || event?.data?.metadata?.repairNumber || 'Ticket';
        const deviceName = `${event?.data?.deviceBrand || ''} ${event?.data?.deviceModel || ''}`.trim() || 'Device';

        if (event?.data?.type === 'REPAIR_URGENT' || eventPriority === 'URGENT') {
          toast.error(`🚨 Urgent Priority Assigned: #${jobNum} (${deviceName})`, {
            description: 'Immediate action required for this job.',
            duration: 9000,
            action: {
              label: "View Job",
              onClick: () => {
                const targetId = event?.data?.repairId || event?.data?.id;
                if (targetId) navigate(`/dashboard/repairs/${targetId}`);
                else fetchDashboardData();
              }
            }
          });
        } else if (eventPriority === 'HIGH' || eventPriority === 'MEDIUM') {
          toast.warning(`⚠️ ${eventPriority} Priority Assigned: #${jobNum} (${deviceName})`, {
            duration: 7000,
            action: {
              label: "View Job",
              onClick: () => {
                const targetId = event?.data?.repairId || event?.data?.id;
                if (targetId) navigate(`/dashboard/repairs/${targetId}`);
                else fetchDashboardData();
              }
            }
          });
        }
      }

      // Refresh relevant datasets
      fetchDashboardData(true);
      if (event.entity === 'attendance') fetchMyAttendance();
      if (['repair', 'repairLog'].includes(event.entity)) fetchCompletedWork();

      if (selectedRepair && isNotesModalOpen && event.entity === 'technicianNote') {
        fetchNotesForRepair(selectedRepair.id);
      }
    }
  );

  const fetchNotesForRepair = async (repairId: string) => {
    setLoadingNotes(true);
    try {
      const notes = await api.get(`/repairs/${repairId}/notes`);
      setRepairNotes(Array.isArray(notes) ? notes : []);
    } catch (err) {
      console.error("[FETCH NOTES ERROR]", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // ============================================================================
  // STATS & FILTERING COMPUTATION
  // ============================================================================

  const urgentRepairs = useMemo(() => {
    return repairs.filter(r => {
      const meta = getPriorityMeta(r);
      return meta.tier === 'URGENT' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
    });
  }, [repairs]);

  const highRepairs = useMemo(() => {
    return repairs.filter(r => {
      const meta = getPriorityMeta(r);
      return meta.tier === 'HIGH' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
    });
  }, [repairs]);

  const mediumRepairs = useMemo(() => {
    return repairs.filter(r => {
      const meta = getPriorityMeta(r);
      return meta.tier === 'MEDIUM' && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
    });
  }, [repairs]);

  // Overdue repairs detection (expectedCompletionDate < now and not completed)
  const overdueRepairs = useMemo(() => {
    const now = Date.now();
    return repairs.filter(r => {
      if (['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status)) return false;
      if (!r.expectedCompletionDate) return false;
      const due = new Date(r.expectedCompletionDate).getTime();
      return !isNaN(due) && due < now;
    });
  }, [repairs]);

  // Comprehensive active stats calculated from real database records
  const stats = useMemo(() => {
    const active = repairs.filter(r => !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    const pending = repairs.filter(r => r.status === 'PENDING');
    const inProgress = repairs.filter(r => r.status === 'IN_PROCESS' || r.status === 'DIAGNOSING');
    const waitingParts = repairs.filter(r => r.status === 'WAITING_FOR_PARTS');
    const testing = repairs.filter(r => r.status === 'TESTING');
    const repaired = repairs.filter(r => ['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'REPROBLEM_FIXED'].includes(r.status));

    const priorityTotal = urgentRepairs.length + highRepairs.length + mediumRepairs.length;

    return {
      activeCount: active.length,
      assignedTotal: active.length + repaired.length,
      pendingCount: pending.length,
      inProgressCount: inProgress.length,
      waitingPartsCount: waitingParts.length,
      testingCount: testing.length,
      repairedCount: repaired.length,
      urgentCount: urgentRepairs.length,
      highCount: highRepairs.length,
      mediumCount: mediumRepairs.length,
      priorityTotal,
      overdueCount: overdueRepairs.length,
      pendingTransfersCount: transferRequests.pendingIncomingCount
    };
  }, [repairs, urgentRepairs, highRepairs, mediumRepairs, overdueRepairs, transferRequests]);

  // Filtered repairs list for the Repairs section
  const filteredRepairs = useMemo(() => {
    let list = user?.id
      ? repairs.filter(r => (r.technicianId === user.id || r.technician?.id === user.id) && r.status !== 'CANCELLED')
      : repairs.filter(r => r.status !== 'CANCELLED');

    // Status / Priority Tab Filter
    if (activeTab === 'ACTIVE') {
      list = list.filter(r => !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status));
    } else if (activeTab === 'PENDING') {
      list = list.filter(r => r.status === 'PENDING');
    } else if (activeTab === 'IN_PROCESS') {
      list = list.filter(r => r.status === 'IN_PROCESS' || r.status === 'DIAGNOSING');
    } else if (activeTab === 'WAITING_FOR_PARTS') {
      list = list.filter(r => r.status === 'WAITING_FOR_PARTS');
    } else if (activeTab === 'TESTING') {
      list = list.filter(r => r.status === 'TESTING');
    } else if (activeTab === 'PRIORITY') {
      list = list.filter(r => ['URGENT', 'HIGH', 'MEDIUM'].includes(getPriorityMeta(r).tier) && r.status !== 'CANCELLED');
    } else if (activeTab === 'REPAIRED') {
      list = list.filter(r => ['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'REPROBLEM_FIXED'].includes(r.status));
    }

    // Priority Dropdown Filter
    if (priorityFilter !== 'ALL') {
      list = list.filter(r => getPriorityMeta(r).tier === priorityFilter);
    }

    // Only Overdue Filter
    if (onlyOverdueFilter) {
      const now = Date.now();
      list = list.filter(r => {
        if (!r.expectedCompletionDate) return false;
        const due = new Date(r.expectedCompletionDate).getTime();
        return !isNaN(due) && due < now && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
      });
    }

    // Debounced Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(r =>
        (r.repairNumber && r.repairNumber.toLowerCase().includes(q)) ||
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.customerPhone && r.customerPhone.toLowerCase().includes(q)) ||
        (r.deviceBrand && r.deviceBrand.toLowerCase().includes(q)) ||
        (r.deviceModel && r.deviceModel.toLowerCase().includes(q)) ||
        (r.imeiNumber && r.imeiNumber.toLowerCase().includes(q)) ||
        (r.problemDescription && r.problemDescription.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
      );
    }

    // Sort order
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'dueDate') {
      list.sort((a, b) => {
        if (!a.expectedCompletionDate) return 1;
        if (!b.expectedCompletionDate) return -1;
        return new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime();
      });
    } else if (sortBy === 'priority') {
      const priorityScore = (r: any) => {
        const tier = getPriorityMeta(r).tier;
        if (tier === 'URGENT') return 4;
        if (tier === 'HIGH') return 3;
        if (tier === 'MEDIUM') return 2;
        return 1;
      };
      list.sort((a, b) => priorityScore(b) - priorityScore(a));
    } else if (sortBy === 'recentlyUpdated') {
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    }

    return list;
  }, [repairs, activeTab, priorityFilter, onlyOverdueFilter, debouncedSearch, sortBy, user?.id]);

  // Global 40-record page bounds calculation
  const totalFilteredCount = filteredRepairs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / REPAIRS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRepairs = useMemo(() => {
    const start = (safeCurrentPage - 1) * REPAIRS_PER_PAGE;
    return filteredRepairs.slice(start, start + REPAIRS_PER_PAGE);
  }, [filteredRepairs, safeCurrentPage]);

  // Priority repairs for Overview section
  const priorityOverviewList = useMemo(() => {
    return repairs.filter(r => {
      const tier = getPriorityMeta(r).tier;
      return (tier === 'URGENT' || tier === 'HIGH') && !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(r.status);
    }).slice(0, 6);
  }, [repairs]);

  // Reset all filters in Repairs view
  const handleResetFilters = () => {
    setActiveTab('ACTIVE');
    setDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setIsCustomExpanded(false);
    setSearchQuery('');
    setPriorityFilter('ALL');
    setOnlyOverdueFilter(false);
    setSortBy('newest');
    setCurrentPage(1);
    toast.info('Filters Reset', { description: 'Showing all active assigned repairs.' });
  };

  // ============================================================================
  // MODAL ACTIONS & SUBMISSIONS
  // ============================================================================

  const handleOpenUpdateModal = (repair: any) => {
    setSelectedRepair(repair);
    const defaultStatus = TECHNICIAN_ALLOWED_STATUSES.some(s => s.value === repair.status)
      ? repair.status
      : 'IN_PROCESS';

    setUpdateForm({
      status: defaultStatus,
      note: '',
      partsUsed: repair.partsUsed || '',
      expectedCompletionDate: repair.expectedCompletionDate ? new Date(repair.expectedCompletionDate).toISOString().split('T')[0] : ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleOpenTransferModal = (repair: any) => {
    setSelectedRepair(repair);
    setTransferForm({
      targetTechnicianId: '',
      reason: ''
    });
    setIsTransferModalOpen(true);
  };

  const handleOpenNotesModal = (repair: any) => {
    setSelectedRepair(repair);
    setNewNoteContent('');
    setIsNotesModalOpen(true);
    fetchNotesForRepair(repair.id);
  };

  const submitStatusUpdate = async () => {
    if (!selectedRepair || submittingUpdate) return;
    setSubmittingUpdate(true);
    try {
      const updated = await api.patch(`/repairs/${selectedRepair.id}/technician-update`, updateForm);
      await syncRepairToRtdb(updated);

      if (updateForm.status === 'REPAIRED') {
        toast.success(`Job #${selectedRepair.repairNumber} Repaired`, {
          description: 'Moved to Completed handover for Reception / Management.'
        });
      } else {
        toast.success(`Job #${selectedRepair.repairNumber} Progress Saved`, {
          description: `Status updated to ${statusStyles[updateForm.status]?.label || updateForm.status}.`
        });
      }

      setIsUpdateModalOpen(false);
      setSelectedRepair(null);
      await fetchDashboardData();
      await fetchCompletedWork();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to update repair status");
    } finally {
      setSubmittingUpdate(false);
    }
  };

  const submitTransferRequest = async () => {
    if (!selectedRepair || submittingTransfer) return;
    if (!transferForm.targetTechnicianId) {
      toast.error("Please select a target technician.");
      return;
    }
    if (!transferForm.reason || transferForm.reason.trim().length < 3) {
      toast.error("Please provide a clear reason for the transfer.");
      return;
    }

    setSubmittingTransfer(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/transfer-request`, {
        targetTechnicianId: transferForm.targetTechnicianId,
        reason: transferForm.reason.trim()
      });
      toast.success("Transfer request dispatched successfully.");
      setIsTransferModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to submit transfer request.");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const submitNote = async () => {
    if (!selectedRepair || !newNoteContent.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await api.post(`/repairs/${selectedRepair.id}/notes`, {
        note: newNoteContent.trim(),
        isInternal: true
      });
      setNewNoteContent('');
      toast.success("Note logged to repair record.");
      fetchNotesForRepair(selectedRepair.id);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to add communication note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRespondTransfer = async (transferId: string, action: 'ACCEPT' | 'REJECT') => {
    setRespondingTransferId(transferId);
    try {
      await api.post(`/repair-transfers/${transferId}/respond`, { action });
      toast.success(action === 'ACCEPT' ? "Transfer accepted into your queue." : "Transfer request declined.");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to respond to transfer request.");
    } finally {
      setRespondingTransferId(null);
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await api.post(`/notifications/${notifId}/read`, {});
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);
      toast.success("All notifications marked as read");
    } catch {
      // silent
    }
  };

  if (loading && repairs.length === 0) {
    if (mainSection === 'REPAIRS') return <TechnicianRepairsSkeleton viewMode={viewMode} />;
    if (mainSection === 'TRANSFERS') return <TechnicianTransfersSkeleton />;
    return <TechnicianOverviewSkeleton />;
  }

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4">

      {/* 1. Header with Technician Branding, Nepal Clock, and Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-7 md:p-8 rounded-[28px] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="space-y-1.5 max-w-2xl min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <Wrench className="h-7 w-7 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Technician Workspace</span>
            </h1>
            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Bench Active
            </Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed break-words">
            Welcome back, <span className="font-bold text-slate-800 dark:text-slate-200">{user?.name}</span>. Diagnostic bench, repair queue, and performance analytics.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Nepal Standard Time (NPT, UTC+5:45):</span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300">{nepalCalendar.formattedTodayNpt}</span>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-start sm:justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsNotificationCenterOpen(true)}
            className="flex-1 sm:flex-initial rounded-2xl border-slate-200 dark:border-slate-700 h-10 sm:h-11 px-3.5 sm:px-4 relative flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs cursor-pointer"
          >
            <Bell className="h-4 w-4 text-slate-700 dark:text-slate-300" />
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Alerts</span>
            {unreadNotificationCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-xs animate-bounce">
                {unreadNotificationCount}
              </span>
            )}
          </Button>

          <DashboardRefreshButton
            onRefresh={() => {
              fetchDashboardData();
              fetchMyAttendance();
              fetchCompletedWork();
            }}
            showLiveBadge={false}
            showLastUpdated={false}
            size="sm"
            label="Refresh"
            variant="outline"
            className="h-10 sm:h-11 rounded-2xl border-slate-200 dark:border-slate-700 font-bold text-xs shrink-0 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
          />
        </div>
      </div>

      {/* 2. Top-Level Workspace Section Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setMainSection('OVERVIEW')}
          className={cn(
            "flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
            mainSection === 'OVERVIEW'
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setMainSection('REPAIRS')}
          className={cn(
            "flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative",
            mainSection === 'REPAIRS'
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Wrench className="h-4 w-4 shrink-0" />
          <span>Repairs Bench</span>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
            mainSection === 'REPAIRS' ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300" : "bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          )}>
            {stats.activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainSection('COMPLETED')}
          className={cn(
            "flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative",
            mainSection === 'COMPLETED'
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>My Completed Work</span>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
            mainSection === 'COMPLETED' ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300" : "bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          )}>
            {serverStats?.userAssigned?.completedTotal ?? stats.repairedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainSection('TRANSFERS')}
          className={cn(
            "flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative",
            mainSection === 'TRANSFERS'
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <ArrowRightLeft className="h-4 w-4 shrink-0" />
          <span>Transfers</span>
          {transferRequests.pendingIncomingCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black">
              {transferRequests.pendingIncomingCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION: OVERVIEW                                                      */}
      {/* ========================================================================= */}
      {mainSection === 'OVERVIEW' && (
        <div className="space-y-6">

          {/* A. 9-Card Executive Dashboard Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Assigned */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/50">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs">
                  <Wrench className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700">
                  Total Assigned
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {serverStats?.userAssigned?.assignedTotal ?? stats.assignedTotal}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Workorders</div>
              </div>
            </div>

            {/* In-Progress Bench */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800/50">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-xs">
                  <Cpu className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                  Bench Active
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {stats.inProgressCount + stats.testingCount}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">In Progress / QA</div>
              </div>
            </div>

            {/* Pending Unstarted */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shadow-xs">
                  <Clock className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                  Unstarted
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {stats.pendingCount}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Intake</div>
              </div>
            </div>

            {/* Priority Tasks */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-rose-50/50 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/50">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-rose-600 dark:bg-rose-500 text-white flex items-center justify-center shadow-xs">
                  <Flame className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-700">
                  {stats.urgentCount} Urgent
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {stats.priorityTotal}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority Queue</div>
              </div>
            </div>

            {/* Overdue Repairs */}
            <div className={cn(
              "p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm transition-all",
              stats.overdueCount > 0
                ? "bg-amber-500/15 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/20"
                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
            )}>
              <div className="flex items-center justify-between">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shadow-xs text-white",
                  stats.overdueCount > 0 ? "bg-amber-600 dark:bg-amber-500" : "bg-slate-600 dark:bg-slate-700"
                )}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-bold border",
                  stats.overdueCount > 0
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 animate-pulse"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                )}>
                  Target Due
                </Badge>
              </div>
              <div>
                <div className={cn(
                  "text-2xl sm:text-3xl font-black",
                  stats.overdueCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-white"
                )}>
                  {stats.overdueCount}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overdue Bench</div>
              </div>
            </div>

            {/* Completed Today */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/50">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700">
                  Today (NPT)
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {serverStats?.userAssigned?.completedToday ?? 0}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Repaired Today</div>
              </div>
            </div>

            {/* Completed This Week */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-teal-50/50 dark:bg-teal-950/30 border-teal-200/80 dark:border-teal-800/50">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shadow-xs">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700">
                  This Week
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {serverStats?.userAssigned?.completedThisWeek ?? 0}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Done This Week</div>
              </div>
            </div>

            {/* Completed This Month */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-cyan-50/50 dark:bg-cyan-950/30 border-cyan-200/80 dark:border-cyan-800/50">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white flex items-center justify-center shadow-xs">
                  <Layers className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700">
                  This Month
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {serverStats?.userAssigned?.completedThisMonth ?? 0}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Done This Month</div>
              </div>
            </div>

            {/* Total Completed Jobs */}
            <div className="p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 shadow-sm bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCheck className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700">
                  Lifetime
                </Badge>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {serverStats?.userAssigned?.completedTotal ?? stats.repairedCount}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed Work</div>
              </div>
            </div>
          </div>

          {/* B. Integrated Attendance Overview Card */}
          <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Attendance Status</span>
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-bold">
                      {format(new Date(), 'MMMM yyyy')}
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    Daily check-in and monthly duty record for {user?.name}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/dashboard/attendance')}
                className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs h-9 cursor-pointer gap-1.5"
              >
                <span>Attendance Hub</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Today's Presence Status */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Today's Status ({nepalCalendar.todayNpt})
                  </span>
                  <div className="flex items-center gap-2">
                    {attendanceOverview.todayRecord?.status === 'PRESENT' ? (
                      <Badge className="bg-emerald-600 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                        ✓ Present (On Duty)
                      </Badge>
                    ) : attendanceOverview.todayRecord?.status === 'LATE' ? (
                      <Badge className="bg-amber-600 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                        Late Arrival
                      </Badge>
                    ) : attendanceOverview.todayRecord?.status === 'PENDING' ? (
                      <Badge className="bg-blue-600 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                        Pending Verification
                      </Badge>
                    ) : attendanceOverview.todayRecord?.status === 'ABSENT' ? (
                      <Badge className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                        Absent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 font-bold text-xs px-2.5 py-1 rounded-xl">
                        Not Yet Marked
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {attendanceOverview.todayRecord?.notes || 'Management daily verification'}
                  </span>
                </div>

                {/* Check-in / Check-out */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Punch In / Out (NPT)
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Check-In:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {attendanceOverview.todayRecord?.checkInTime || '—'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Check-Out:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {attendanceOverview.todayRecord?.checkOutTime || '—'}
                      </strong>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Standard shift: 10:00 AM - 07:00 PM
                  </span>
                </div>

                {/* Days Present this Month */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Present Days (Month)
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {attendanceOverview.stats?.presentCount ?? 0} <span className="text-xs text-slate-400 font-normal">days</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Absent: <b className="text-slate-700 dark:text-slate-300">{attendanceOverview.stats?.absentCount ?? 0}</b> days
                  </span>
                </div>

                {/* Monthly Attendance Rate Score */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Attendance Rate
                  </span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {attendanceOverview.stats?.attendanceRate !== null && attendanceOverview.stats?.attendanceRate !== undefined
                      ? `${attendanceOverview.stats.attendanceRate}%`
                      : '100%'}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Lab operational presence
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* C. Priority & Urgent Work Section */}
          <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <Flame className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Priority & Urgent Work</span>
                    <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                      {priorityOverviewList.length} Flagged
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    High-importance customer repairs requiring immediate technical focus
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMainSection('REPAIRS');
                  setActiveTab('PRIORITY');
                }}
                className="rounded-xl border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs h-9 cursor-pointer"
              >
                <span>View Full Queue</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 pt-4">
              {priorityOverviewList.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 dark:text-emerald-400" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No urgent priority repairs pending</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    All flagged priority repairs on your bench are completed or up to schedule.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {priorityOverviewList.map((repair) => {
                    const priorityMeta = getPriorityMeta(repair);
                    const PriorityIcon = priorityMeta.icon;
                    const statusInfo = statusStyles[repair.status] || {
                      label: repair.status.replace(/_/g, ' '),
                      badge: 'bg-slate-100 text-slate-800 border-slate-300'
                    };

                    return (
                      <div
                        key={repair.id}
                        className={cn(
                          "rounded-2xl border p-4 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-all",
                          priorityMeta.cardBorder
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs bg-slate-950 text-white px-2 py-0.5 rounded-lg">
                              #{repair.repairNumber}
                            </span>
                            <Badge className={cn("text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1", priorityMeta.badgeClass)}>
                              <PriorityIcon className="h-3 w-3" />
                              <span>{priorityMeta.label}</span>
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {repair.deviceBrand} {repair.deviceModel}
                            </h4>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                            {repair.problemDescription || 'Diagnosis required'}
                          </p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Status:</span>
                            <Badge className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md", statusInfo.badge)}>
                              {statusInfo.label}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Due Date:</span>
                            <strong className="text-slate-700 dark:text-slate-300 font-mono">
                              {repair.expectedCompletionDate ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy') : 'Unscheduled'}
                            </strong>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleOpenUpdateModal(repair)}
                              className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 cursor-pointer"
                            >
                              <Wrench className="h-3 w-3 mr-1" /> Update
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenNotesModal(repair)}
                              className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 h-8 px-2.5 cursor-pointer"
                              title="Notes"
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                              className="rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white h-8 px-2 cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* D. My Completed Work Section Preview */}
          <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>My Completed Work</span>
                    <Badge variant="outline" className="text-[10px] bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 font-bold">
                      {completedWorkTotal} Finished Jobs
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    Repairs completed and validated by {user?.name}
                  </p>
                </div>
              </div>

              {/* Completed Work Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {[
                  { key: 'TODAY' as DatePreset, label: 'Today' },
                  { key: 'YESTERDAY' as DatePreset, label: 'Yesterday' },
                  { key: 'THIS_WEEK' as DatePreset, label: 'This Week' },
                  { key: 'THIS_MONTH' as DatePreset, label: 'This Month' },
                  { key: 'ALL' as DatePreset, label: 'All Time' },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setCompletedPreset(p.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                      completedPreset === p.key
                        ? "bg-teal-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 pt-4 space-y-4">
              {completedWorkLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                  <span className="text-xs font-bold">Retrieving completed records...</span>
                </div>
              ) : completedWorkList.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 space-y-2">
                  <Package className="h-8 w-8 mx-auto text-slate-400" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No completed jobs found for this timeframe</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Repairs marked as Repaired will appear here with precise completion logs.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Repair #</th>
                        <th className="py-3 px-4">Device Model</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Problem / Solution</th>
                        <th className="py-3 px-4">Completion Date (NPT)</th>
                        <th className="py-3 px-4">Parts Used</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {completedWorkList.slice(0, 8).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            #{item.repairNumber}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {item.deviceBrand} {item.deviceModel}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                            {item.customerName || 'Customer'}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400" title={item.problemDescription}>
                            {item.problemDescription || 'Repaired'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-teal-700 dark:text-teal-400">
                            {item.completedAt ? format(new Date(item.completedAt), 'dd MMM yyyy, hh:mm a') : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                            {item.partsUsed || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/dashboard/repairs/${item.id}`)}
                              className="h-8 px-2.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold text-xs cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECTION: REPAIRS BENCH                                                 */}
      {/* ========================================================================= */}
      {mainSection === 'REPAIRS' && (
        <div className="space-y-6">

          {/* Date Filter & Preset Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">Date Range Filter</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    {datePreset === 'ALL' && 'Assigned Work (All Active Bench Queue)'}
                    {datePreset === 'TODAY' && `Today (${nepalCalendar.todayNpt})`}
                    {datePreset === 'YESTERDAY' && `Yesterday (${nepalCalendar.yesterdayNpt})`}
                    {datePreset === 'THIS_WEEK' && `This Week (${nepalCalendar.weekStartNpt} to ${nepalCalendar.weekEndNpt})`}
                    {datePreset === 'THIS_MONTH' && 'This Month'}
                    {datePreset === 'CUSTOM' && (customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : 'Custom Date Range')}
                  </span>
                </div>
              </div>

              {/* Preset Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {[
                  { key: 'ALL' as DatePreset, label: 'Assigned Work', icon: Wrench },
                  { key: 'TODAY' as DatePreset, label: 'Today', icon: Calendar },
                  { key: 'YESTERDAY' as DatePreset, label: 'Yesterday', icon: History },
                  { key: 'THIS_WEEK' as DatePreset, label: 'This Week', icon: CalendarDays },
                  { key: 'CUSTOM' as DatePreset, label: 'Custom Date', icon: CalendarRange }
                ].map(preset => {
                  const isSelected = datePreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setDatePreset(preset.key);
                        if (preset.key === 'CUSTOM') {
                          setIsCustomExpanded(true);
                        } else {
                          setIsCustomExpanded(false);
                        }
                      }}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                        isSelected
                          ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30"
                          : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                      )}
                    >
                      <preset.icon className="h-3.5 w-3.5" />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Inputs */}
            {isCustomExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">From Date (YYYY-MM-DD)</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">To Date (YYYY-MM-DD)</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-4">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!customStartDate || !customEndDate) {
                        toast.error('Please choose both start and end dates.');
                        return;
                      }
                      fetchDashboardData();
                      toast.success(`Filter applied from ${customStartDate} to ${customEndDate}`);
                    }}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 cursor-pointer"
                  >
                    Apply Filter
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDatePreset('ALL');
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setIsCustomExpanded(false);
                    }}
                    className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs h-9 px-3 cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Filter Tabs, Multi-Criteria Toolbar, and Search */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
            {/* Status Queue Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {[
                  { key: 'ACTIVE' as StatusFilterTab, label: 'Active Bench', count: stats.activeCount },
                  { key: 'PENDING' as StatusFilterTab, label: 'Pending', count: stats.pendingCount },
                  { key: 'IN_PROCESS' as StatusFilterTab, label: 'In Progress', count: stats.inProgressCount },
                  { key: 'WAITING_FOR_PARTS' as StatusFilterTab, label: 'Waiting for Parts', count: stats.waitingPartsCount },
                  { key: 'TESTING' as StatusFilterTab, label: 'Testing QA', count: stats.testingCount },
                  { key: 'PRIORITY' as StatusFilterTab, label: 'Priority Queue', count: stats.priorityTotal },
                  { key: 'REPAIRED' as StatusFilterTab, label: 'Completed / Repaired', count: stats.repairedCount }
                ].map(tab => {
                  const isSelected = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                        isSelected
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
                        isSelected ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* View Mode & Reset Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('CARDS')}
                    className={cn(
                      "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === 'CARDS'
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="Card Grid View"
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('TABLE')}
                    className={cn(
                      "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === 'TABLE'
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="Compact Table View"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetFilters}
                  className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold h-9"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
              </div>
            </div>

            {/* Search and Secondary Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1">
              {/* Search Bar */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by Repair #, Customer, Phone, Model, IMEI, Fault..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 pr-9 h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:bg-white dark:focus:bg-slate-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Priority Filter */}
              <div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                    <SelectValue placeholder="Priority: All" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="ALL" className="text-xs font-bold">Priority: All</SelectItem>
                    <SelectItem value="URGENT" className="text-xs font-bold text-rose-600">🔴 Urgent Only</SelectItem>
                    <SelectItem value="HIGH" className="text-xs font-bold text-amber-600">🟠 High Only</SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs font-bold text-sky-600">🟡 Medium Only</SelectItem>
                    <SelectItem value="NORMAL" className="text-xs font-bold">⚪ Normal Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger className="h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                    <SelectValue placeholder="Sort Order" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="newest" className="text-xs font-bold">Newest First</SelectItem>
                    <SelectItem value="oldest" className="text-xs font-bold">Oldest First</SelectItem>
                    <SelectItem value="dueDate" className="text-xs font-bold">By Due Date</SelectItem>
                    <SelectItem value="priority" className="text-xs font-bold">By Priority (Highest)</SelectItem>
                    <SelectItem value="recentlyUpdated" className="text-xs font-bold">Recently Updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Overdue Quick Filter Checkbox */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={onlyOverdueFilter}
                  onChange={e => setOnlyOverdueFilter(e.target.checked)}
                  className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className={onlyOverdueFilter ? "font-bold text-amber-600 dark:text-amber-400" : ""}>
                  Show only overdue repairs past expected delivery
                </span>
                {stats.overdueCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300">
                    {stats.overdueCount} Overdue
                  </Badge>
                )}
              </label>

              <span className="font-semibold text-slate-500 dark:text-slate-400">
                Showing {paginatedRepairs.length} of {totalFilteredCount} matching jobs
              </span>
            </div>
          </div>

          {/* Repairs List: Cards vs Table View */}
          {filteredRepairs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 space-y-3 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">No repairs matching this criteria</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {activeTab === 'REPAIRED'
                  ? 'No completed repairs found for the selected filters.'
                  : 'All caught up! There are no active repair jobs waiting in this view.'}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetFilters}
                className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                Reset All Filters
              </Button>
            </div>
          ) : viewMode === 'CARDS' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                <AnimatePresence>
                  {paginatedRepairs.map((repair) => {
                    const statusInfo = statusStyles[repair.status] || {
                      label: repair.status.replace(/_/g, ' '),
                      badge: 'bg-slate-100 text-slate-800 border-slate-300',
                      bgSoft: 'bg-slate-50',
                      border: 'border-slate-200'
                    };

                    const priorityMeta = getPriorityMeta(repair);
                    const PriorityIcon = priorityMeta.icon;
                    const isDescExpanded = !!expandedDescriptions[repair.id];
                    const desc = repair.problemDescription || 'Inspection & diagnosis requested';
                    const isLongDesc = desc.length > 110;

                    // Overdue check
                    const isOverdue = repair.expectedCompletionDate &&
                      new Date(repair.expectedCompletionDate).getTime() < Date.now() &&
                      !['REPAIRED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANNOT_REPAIR', 'CANCELLED'].includes(repair.status);

                    return (
                      <motion.div
                        key={repair.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className={cn(
                          "rounded-3xl border transition-all hover:shadow-xl overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 min-w-0",
                          priorityMeta.cardBorder
                        )}>
                          <CardHeader className={cn("p-4 sm:p-5 pb-3 space-y-2.5", priorityMeta.headerBg)}>
                            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-mono font-black text-xs bg-slate-950 text-white px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                                  #{repair.repairNumber}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-bold px-2.5 py-1 rounded-md border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 shrink-0">
                                  {detectDeviceCategory(repair)}
                                </Badge>
                                <Badge className={cn("text-[10px] uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0", priorityMeta.badgeClass)}>
                                  <PriorityIcon className="h-3 w-3" />
                                  <span>{priorityMeta.label}</span>
                                </Badge>
                                {repair.isCourierIn && (
                                  <Badge variant="outline" className="text-[9px] bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 flex items-center gap-1 font-bold px-2 py-0.5 shrink-0">
                                    <Truck className="h-2.5 w-2.5" />
                                    Courier
                                  </Badge>
                                )}
                                {isOverdue && (
                                  <Badge className="text-[9px] bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-full animate-pulse shrink-0">
                                    Overdue
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <Badge className={cn("text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border whitespace-nowrap inline-flex items-center shrink-0 shadow-2xs", statusInfo.badge)}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                                  <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-tight truncate">
                                  {repair.deviceBrand} {repair.deviceModel}
                                </h3>
                              </div>

                              {/* Customer Fault Issue Description */}
                              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1 mt-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
                                  Customer Fault / Problem:
                                </span>
                                <p className={cn(
                                  "text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed break-words",
                                  !isDescExpanded && isLongDesc && "line-clamp-2"
                                )}>
                                  {desc}
                                </p>

                                {isLongDesc && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDescription(repair.id)}
                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                                  >
                                    {isDescExpanded ? <><span>View Less</span> <ChevronUp className="h-3 w-3" /></> : <><span>View More</span> <ChevronDown className="h-3 w-3" /></>}
                                  </button>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 sm:p-5 pt-0 space-y-3.5">
                            {/* Assigned Timeline Banner */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
                                  <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  <span className="font-bold text-slate-700 dark:text-slate-300">Assigned:</span>
                                </span>
                                <span className="font-bold text-indigo-700 dark:text-indigo-300 text-[11px] sm:text-xs truncate font-mono">
                                  {formatTimeAgo(repair.assignedAt || repair.createdAt, tickerTime)}
                                </span>
                              </div>
                            </div>

                            {/* Customer, Intake, Due date strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Customer</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{repair.customerName || 'Customer'}</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Intake Date</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 block truncate font-mono">
                                  {repair.createdAt ? format(new Date(repair.createdAt), 'dd MMM yyyy') : 'N/A'}
                                </span>
                              </div>
                              <div className="col-span-2 sm:col-span-1 min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Target Due</span>
                                <span className={cn(
                                  "font-bold block truncate font-mono",
                                  isOverdue ? "text-rose-600 dark:text-rose-400" : repair.expectedCompletionDate ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 font-normal"
                                )}>
                                  {repair.expectedCompletionDate ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy') : 'Not scheduled'}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {repair.status !== 'DELIVERED' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenUpdateModal(repair)}
                                  className="flex-1 min-w-[120px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shadow-sm cursor-pointer"
                                >
                                  <Wrench className="h-3.5 w-3.5 mr-1.5" />
                                  Update Status
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenNotesModal(repair)}
                                className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs h-9 px-3 cursor-pointer shrink-0"
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1 text-slate-500" />
                                Notes
                              </Button>

                              {repair.status !== 'REPAIRED' && repair.status !== 'DELIVERED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenTransferModal(repair)}
                                  className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-300 font-bold text-xs h-9 px-3 cursor-pointer shrink-0"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1 text-amber-600" />
                                  Transfer
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                                className="rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 h-9 px-2.5 cursor-pointer shrink-0"
                                title="View Full Ticket"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={safeCurrentPage}
                totalItems={totalFilteredCount}
                pageSize={REPAIRS_PER_PAGE}
                onPageChange={setCurrentPage}
                className="mt-6"
                itemLabel="assigned repair"
                itemsLabel="assigned repairs"
              />
            </div>
          ) : (
            /* Table View */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Repair #</th>
                      <th className="py-3 px-4">Device</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Problem</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Target Due</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {paginatedRepairs.map((repair) => {
                      const priorityMeta = getPriorityMeta(repair);
                      const statusInfo = statusStyles[repair.status] || {
                        label: repair.status.replace(/_/g, ' '),
                        badge: 'bg-slate-100 text-slate-800 border-slate-300'
                      };

                      return (
                        <tr key={repair.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            #{repair.repairNumber}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200 max-w-[180px] truncate" title={`${repair.deviceBrand} ${repair.deviceModel}`}>
                            {repair.deviceBrand} {repair.deviceModel}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={repair.customerName || 'Customer'}>
                            {repair.customerName || 'Customer'}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400" title={repair.problemDescription}>
                            {repair.problemDescription || 'Inspection'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center", priorityMeta.badgeClass)}>
                              {priorityMeta.label}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge className={cn("text-[10px] font-bold px-3 py-1 rounded-full border whitespace-nowrap inline-flex items-center shrink-0 shadow-2xs", statusInfo.badge)}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {repair.expectedCompletionDate ? format(new Date(repair.expectedCompletionDate), 'dd MMM yyyy') : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleOpenUpdateModal(repair)}
                                className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                              >
                                Update
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenNotesModal(repair)}
                                className="h-8 px-2 rounded-lg border-slate-200 dark:border-slate-700"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/dashboard/repairs/${repair.id}`)}
                                className="h-8 px-2 rounded-lg"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <Pagination
                  currentPage={safeCurrentPage}
                  totalItems={totalFilteredCount}
                  pageSize={REPAIRS_PER_PAGE}
                  onPageChange={setCurrentPage}
                  itemLabel="assigned repair"
                  itemsLabel="assigned repairs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECTION: COMPLETED WORK (FULL DEDICATED VIEW)                          */}
      {/* ========================================================================= */}
      {mainSection === 'COMPLETED' && (
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 space-y-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Technician Completed Work Archive</span>
                    <Badge className="bg-teal-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                      {completedWorkTotal} Total
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Verified repairs completed by {user?.name}. Calculated using exact completion timestamps from the lab audit log.
                  </p>
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {[
                  { key: 'ALL' as DatePreset, label: 'All Completed' },
                  { key: 'TODAY' as DatePreset, label: 'Today' },
                  { key: 'YESTERDAY' as DatePreset, label: 'Yesterday' },
                  { key: 'THIS_WEEK' as DatePreset, label: 'This Week' },
                  { key: 'THIS_MONTH' as DatePreset, label: 'This Month' },
                  { key: 'CUSTOM' as DatePreset, label: 'Custom Range' },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setCompletedPreset(p.key);
                      setCompletedPage(1);
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                      completedPreset === p.key
                        ? "bg-teal-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              {/* Custom Date Inputs if CUSTOM selected */}
              {completedPreset === 'CUSTOM' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 space-y-1 w-full sm:w-auto">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Start Date</Label>
                    <Input
                      type="date"
                      value={completedCustomStart}
                      onChange={e => setCompletedCustomStart(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>
                  <div className="flex-1 space-y-1 w-full sm:w-auto">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">End Date</Label>
                    <Input
                      type="date"
                      value={completedCustomEnd}
                      onChange={e => setCompletedCustomEnd(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      setCompletedPage(1);
                      fetchCompletedWork();
                    }}
                    className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold mt-0 sm:mt-5"
                  >
                    Apply Range
                  </Button>
                </div>
              )}

              {/* Search in Completed Work */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Filter completed work by Repair #, Customer, Device, Problem Description..."
                  value={completedSearch}
                  onChange={e => {
                    setCompletedSearch(e.target.value);
                    setCompletedPage(1);
                  }}
                  className="pl-10 h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                />
              </div>

              {/* Completed Work Table */}
              {completedWorkLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  <span className="text-xs font-bold">Querying verified completion logs...</span>
                </div>
              ) : completedWorkList.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/20 space-y-2">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">No completed repairs found</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Try selecting a wider date preset or clearing your search filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-700">
                        <tr>
                          <th className="py-3 px-4">Repair #</th>
                          <th className="py-3 px-4">Device Model</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Problem Fixed</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Completion Timestamp</th>
                          <th className="py-3 px-4">Parts Used</th>
                          <th className="py-3 px-4">Remarks</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {completedWorkList.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              #{item.repairNumber}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                              {item.deviceBrand} {item.deviceModel}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                              {item.customerName || 'Customer'}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400" title={item.problemDescription}>
                              {item.problemDescription || 'Repaired'}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge className="bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800 text-[10px] font-bold">
                                {item.status.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-teal-700 dark:text-teal-400">
                              {item.completedAt ? format(new Date(item.completedAt), 'dd MMM yyyy, hh:mm a') : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                              {item.partsUsed || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                              {item.remarks || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/dashboard/repairs/${item.id}`)}
                                className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> View Ticket
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Completed Work Pagination */}
                  <Pagination
                    currentPage={completedPage}
                    totalItems={completedWorkTotal}
                    pageSize={15}
                    onPageChange={setCompletedPage}
                    itemLabel="completed job"
                    itemsLabel="completed jobs"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SECTION: TRANSFERS QUEUE                                               */}
      {/* ========================================================================= */}
      {mainSection === 'TRANSFERS' && (
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Job Transfer Requests</span>
                    {transferRequests.pendingIncomingCount > 0 && (
                      <Badge className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full">
                        {transferRequests.pendingIncomingCount} Action Required
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Handover requests between technicians for micro-soldering, board rework, or scheduling assistance
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-6">
              {/* Incoming Requests */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Incoming Transfers Awaiting Your Decision</span>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {transferRequests.incoming.length}
                  </Badge>
                </h4>

                {transferRequests.incoming.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 text-slate-400 text-xs">
                    No incoming transfer requests.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {transferRequests.incoming.map((transfer) => {
                      const isPending = transfer.status === 'PENDING';
                      return (
                        <div
                          key={transfer.id}
                          className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 py-0.5 rounded-md">
                                #{transfer.repairNumber}
                              </span>
                              <Badge className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                isPending
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300"
                                  : transfer.status === 'ACCEPTED'
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                              )}>
                                {transfer.status}
                              </Badge>
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-semibold text-slate-400">Transferred from:</span>{' '}
                              <strong className="text-slate-900 dark:text-white">{transfer.senderTechnicianName || 'Technician'}</strong>
                            </div>

                            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                              <b className="text-slate-900 dark:text-white">Reason:</b> {transfer.reason}
                            </p>
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                              <Button
                                size="sm"
                                disabled={respondingTransferId === transfer.id}
                                onClick={() => handleRespondTransfer(transfer.id, 'ACCEPT')}
                                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 cursor-pointer"
                              >
                                {respondingTransferId === transfer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                                Accept Job
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={respondingTransferId === transfer.id}
                                onClick={() => handleRespondTransfer(transfer.id, 'REJECT')}
                                className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 font-bold text-xs h-9 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Outgoing Requests */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Your Outgoing Transfer Requests</span>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {transferRequests.outgoing.length}
                  </Badge>
                </h4>

                {transferRequests.outgoing.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 text-slate-400 text-xs">
                    No outgoing transfer requests logged.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {transferRequests.outgoing.map((transfer) => (
                      <div
                        key={transfer.id}
                        className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 py-0.5 rounded-md">
                            #{transfer.repairNumber}
                          </span>
                          <Badge className="text-[10px] font-bold">
                            {transfer.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400">Target Specialist:</span>{' '}
                          <strong className="text-slate-900 dark:text-white">{transfer.targetTechnicianName || 'Specialist'}</strong>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                          {transfer.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODALS                                                                 */}
      {/* ========================================================================= */}

      {/* A. Update Repair Progress Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
              Update Repair #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Log technical progress, spare parts used, target due date, and updated status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Repair Status</Label>
              <Select value={updateForm.status} onValueChange={(val) => setUpdateForm(prev => ({ ...prev, status: val }))}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {TECHNICIAN_ALLOWED_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs font-bold py-2">
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{s.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Repaired Callout Note */}
            {updateForm.status === 'REPAIRED' && (
              <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-2xl p-3.5 text-xs text-teal-900 dark:text-teal-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Technical Work Complete</span>
                </div>
                <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                  Marking as <strong>Repaired</strong> completes bench diagnostic work. This job will move to your Completed list and hand over to Reception / Management for delivery notification.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Estimated Target Due Date</Label>
              <Input
                type="date"
                value={updateForm.expectedCompletionDate}
                onChange={e => setUpdateForm(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Spare Parts Used</Label>
              <Input
                placeholder="e.g. OLED Display Panel, Battery 4000mAh, PMIC chip"
                value={updateForm.partsUsed}
                onChange={e => setUpdateForm(prev => ({ ...prev, partsUsed: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Technical Progress Remarks</Label>
              <Textarea
                placeholder="Notes on component replacements, soldering, current consumption, testing results..."
                value={updateForm.note}
                onChange={e => setUpdateForm(prev => ({ ...prev, note: e.target.value }))}
                className="min-h-[90px] rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium p-3"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsUpdateModalOpen(false)}
              className="flex-1 rounded-2xl h-11 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              disabled={submittingUpdate}
              onClick={submitStatusUpdate}
              className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-xs font-bold cursor-pointer"
            >
              {submittingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* B. Transfer Modal */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
              Transfer Repair Case
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Request handover of job #{selectedRepair?.repairNumber} to another technician.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Specialist</Label>
              <Select value={transferForm.targetTechnicianId} onValueChange={(val) => setTransferForm(prev => ({ ...prev, targetTechnicianId: val }))}>
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                  <SelectValue placeholder="Select Technician" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-800">
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold py-2">
                      {t.name} ({t.role.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason for Transfer</Label>
              <Textarea
                placeholder="Reason for transferring (e.g. specialized micro-soldering or thermal imaging required)..."
                value={transferForm.reason}
                onChange={e => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                className="min-h-[100px] rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium p-3"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsTransferModalOpen(false)}
              className="flex-1 rounded-2xl h-11 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              disabled={submittingTransfer}
              onClick={submitTransferRequest}
              className="flex-1 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black h-11 text-xs cursor-pointer"
            >
              {submittingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dispatch Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C. Notes Modal */}
      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
              Diagnostic Notes — #{selectedRepair?.repairNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Internal workbench notes, test findings, and technical remarks.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2.5 pr-1">
            {loadingNotes ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading diagnostic notes...</div>
            ) : repairNotes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
                No diagnostic notes logged yet.
              </div>
            ) : (
              repairNotes.map((note: any) => (
                <div key={note.id} className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{note.technician?.name || note.authorName || 'Staff'}</span>
                    <span className="text-[10px] text-slate-400">{formatTimeAgo(note.createdAt, tickerTime)}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{note.note}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Textarea
              placeholder="Type internal diagnostic or repair note..."
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              className="min-h-[80px] rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium p-3"
            />
            <Button
              disabled={submittingNote || !newNoteContent.trim()}
              onClick={submitNote}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-xs font-bold cursor-pointer"
            >
              {submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* D. Notification Center Modal */}
      <Dialog open={isNotificationCenterOpen} onOpenChange={setIsNotificationCenterOpen}>
        <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">Alerts & Priority Feed</DialogTitle>
              {unreadNotificationCount > 0 && (
                <Button size="sm" variant="ghost" onClick={handleMarkAllNotificationsRead} className="rounded-xl text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  Mark all read
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[420px]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
                No notifications recorded.
              </div>
            ) : (
              notifications.map((notif: any) => {
                const isUrgent = notif.type === 'REPAIR_URGENT' || String(notif.title || '').includes('Urgent');
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) handleMarkNotificationRead(notif.id);
                      if (notif.repairId) {
                        setIsNotificationCenterOpen(false);
                        navigate(`/dashboard/repairs/${notif.repairId}`);
                      }
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3",
                      notif.isRead
                        ? "bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700 opacity-80"
                        : "bg-indigo-50/40 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 shadow-xs"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      isUrgent ? "bg-rose-600 text-white" : "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                    )}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-black truncate text-slate-900 dark:text-white">{notif.title}</h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{formatTimeAgo(notif.createdAt, tickerTime)}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium break-words">{notif.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setIsNotificationCenterOpen(false)}
              className="w-full rounded-2xl h-10 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
