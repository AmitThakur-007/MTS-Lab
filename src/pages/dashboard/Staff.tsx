import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  MoreVertical, 
  Shield, 
  Mail, 
  Calendar,
  Loader2, 
  Trash2, 
  Edit3, 
  UserCheck, 
  UserX, 
  Search, 
  Phone, 
  MapPin, 
  Building2, 
  KeyRound, 
  Filter, 
  AtSign,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  LayoutGrid,
  List,
  RefreshCw,
  X,
  Lock,
  UserCheck2,
  Wrench,
  Fingerprint,
  Power,
  AlertCircle,
  ArrowLeft,
  Briefcase
} from 'lucide-react';
import { validateStrongPassword } from '@/lib/passwordPolicy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/ImageUpload';
import { useRealtimeSync } from '@/services/realtime';
import { syncEntityToRtdb, deleteEntityFromRtdb } from '@/lib/firebase';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import ErrorBoundary from '@/components/ErrorBoundary';

// Safe date formatter that will never throw RangeError on invalid or missing date
const formatSafeDate = (dateVal: any, formatStr: string = 'MMM dd, yyyy', fallback: string = 'N/A'): string => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
};

// Safe name initials extractor
const getSafeInitials = (name: any): string => {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};


const ROLES = [
  { value: 'SUPERADMIN', label: 'Super Admin', description: 'Full system ownership, security logs & administrative controls', color: 'purple' },
  { value: 'ADMIN', label: 'Administrator', description: 'Store operations, staff supervision, and customer tracking', color: 'indigo' },
  { value: 'MANAGER', label: 'Repair Manager', description: 'Repair orchestration, technician workload & assignment management', color: 'blue' },
  { value: 'HEAD_TECHNICIAN', label: 'Head Technician', description: 'Master hardware diagnostics, repair approvals & assignment', color: 'cyan' },
  { value: 'TECHNICIAN', label: 'Technician', description: 'Device repairs, ticket updates, parts usage & testing', color: 'emerald' },
  { value: 'RECEPTIONIST', label: 'Receptionist', description: 'Front desk ticketing, customer intake, and billing', color: 'amber' },
];

const getRoleConfig = (role: string | null | undefined) => {
  const cleanRole = (role || '').toUpperCase().trim();
  switch (cleanRole) {
    case 'SUPERADMIN':
    case 'SUPER_ADMIN':
      return {
        label: 'Super Admin',
        badge: 'bg-purple-100 text-purple-800 border-purple-200',
        dot: 'bg-purple-500',
        icon: ShieldAlert
      };
    case 'ADMIN':
    case 'ADMINISTRATOR':
      return {
        label: 'Admin',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        dot: 'bg-indigo-500',
        icon: Shield
      };
    case 'MANAGER':
      return {
        label: 'Manager',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
        icon: Briefcase
      };
    case 'HEAD_TECHNICIAN':
    case 'LEAD_TECHNICIAN':
      return {
        label: 'Head Tech',
        badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        dot: 'bg-cyan-500',
        icon: Wrench
      };
    case 'TECHNICIAN':
    case 'TECHNICAL_ASSISTANT':
      return {
        label: 'Technician',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: Wrench
      };
    case 'RECEPTIONIST':
    default:
      return {
        label: 'Receptionist',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        icon: Users
      };
  }
};

export function StaffManagementContent() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [viewMode, setViewMode] = useState<'auto' | 'grid' | 'table'>('auto');

  // Dialog states
  const [isOperationsModalOpen, setIsOperationsModalOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [isToggleStatusOpen, setIsToggleStatusOpen] = useState(false);
  const [isToggle2FAOpen, setIsToggle2FAOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [target2FAUser, setTarget2FAUser] = useState<any>(null);
  const [newSelectedRole, setNewSelectedRole] = useState('TECHNICIAN');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'TECHNICIAN',
    phoneNumber: '',
    department: '',
    address: '',
    profileImage: '',
    isActive: true
  });

  const [resetPasswordData, setResetPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });

  // Bulk Selection States
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setFetchError(null);
    try {
      const data = await api.get('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[FETCH STAFF DIRECTORY ERROR]', err);
      const errorMsg = err?.message || 'Unable to load staff information. Please try again.';
      if (!silent) {
        setFetchError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  // Multi-device real-time sync (silent background update - no flickering)
  useRealtimeSync(['user', 'session', 'auditLog', 'sync'], () => {
    fetchUsers(true);
  });

  // Calculate high-level summary counts
  const counts = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u && u.isActive && (u.accountStatus || 'ACTIVE') === 'ACTIVE').length;
    const disabled = total - active;
    const admins = users.filter(u => u && (u.role === 'SUPER_ADMIN' || u.role === 'SUPERADMIN' || u.role === 'ADMIN')).length;
    const technicians = users.filter(u => u && u.role && String(u.role).includes('TECH')).length;
    return { total, active, disabled, admins, technicians };
  }, [users]);

  // Filtered & Searched staff
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (!u) return false;
      const term = searchTerm.toLowerCase().trim();
      const name = String(u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const username = String(u.username || '').toLowerCase();
      const phone = String(u.phoneNumber || '');
      const department = String(u.department || '').toLowerCase();

      const matchesSearch = !term || 
        name.includes(term) ||
        email.includes(term) ||
        username.includes(term) ||
        phone.includes(term) ||
        department.includes(term);

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      const isUserActive = Boolean(u.isActive && (u.accountStatus || 'ACTIVE') === 'ACTIVE');
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'ACTIVE' ? isUserActive :
        !isUserActive;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const selectableUserIds = useMemo(() => {
    return filteredUsers
      .filter(u => u.id !== currentUser?.id && u.email?.toLowerCase() !== 'mtsmobilelab@gmail.com')
      .map(u => u.id);
  }, [filteredUsers, currentUser]);

  const isAllSelected = selectableUserIds.length > 0 && selectableUserIds.every(id => selectedUserIds.includes(id));
  const isSomeSelected = selectedUserIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUserIds);
    }
  };

  const handleToggleUserSelect = (id: string) => {
    if (id === currentUser?.id || users.find(u => u.id === id)?.email?.toLowerCase() === 'mtsmobilelab@gmail.com') {
      toast.warning('Protected account cannot be selected for deletion.');
      return;
    }
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res: any = await api.post('/admin/users/bulk-delete', { userIds: selectedUserIds });
      toast.success(res?.message || `Deactivated ${selectedUserIds.length} user records.`);
      setSelectedUserIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchUsers(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to bulk delete user records');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Role Protection Guard
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SUPERADMIN' || currentUser?.email?.toLowerCase() === 'mtsmobilelab@gmail.com';
  if (currentUser && !isSuperAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-8">
        <Card className="p-8 rounded-3xl border border-amber-200 bg-white shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-sm">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-slate-900">Access Restricted</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
              Staff Management and role clearance administration are restricted to Super Administrators. Your current role is <b>{currentUser?.role?.replace(/_/g, ' ')}</b>.
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => { navigate('/dashboard'); }}
              className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-slate-900/10 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Overview
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Handler helpers
  const handleOpenOperations = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setNewSelectedRole(user.role || 'TECHNICIAN');
    setIsOperationsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'TECHNICIAN',
      phoneNumber: '',
      department: '',
      address: '',
      profileImage: '',
      isActive: true
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenView = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      username: user.username || '',
      password: '',
      role: user.role || 'TECHNICIAN',
      phoneNumber: user.phoneNumber || '',
      department: user.department || '',
      address: user.address || '',
      profileImage: user.profileImage || user.profilePhoto || '',
      isActive: user.isActive ?? true
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenChangeRole = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setNewSelectedRole(user.role || 'TECHNICIAN');
    setIsChangeRoleOpen(true);
  };

  const handleOpenResetPassword = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordOpen(true);
  };

  const handleOpenToggleStatus = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setIsToggleStatusOpen(true);
  };

  const handleOpenDelete = (user: any) => {
    if (!user) return;
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      return toast.error('Please fill in all required fields (Name, Email, Password)');
    }
    const val = validateStrongPassword(formData.password);
    if (!val.valid) {
      return toast.error(val.message || 'Password does not meet security requirements.');
    }
    setSubmitting(true);
    try {
      const created = await api.post('/users', formData);
      if (created && created.id) {
        await syncEntityToRtdb('users', created.id, created).catch(() => {});
      }
      
      // Dispatch email verification link directly to the new staff email
      await api.post('/auth/resend-verification', { email: formData.email.trim().toLowerCase() }).catch(() => {});

      toast.success(`Staff member '${formData.name}' created successfully. Verification email dispatched to ${formData.email}.`);
      setIsAddDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('[ADD STAFF ERROR]', err);
      toast.error(err.message || 'Failed to add staff member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const { password, ...updateData } = formData;
      const updated = await api.patch(`/users/${selectedUser.id}`, updateData);
      if (updated && updated.id) {
        await syncEntityToRtdb('users', updated.id, updated).catch(() => {});
      }
      toast.success(`Staff profile for '${formData.name}' updated`);
      setIsEditDialogOpen(false);
      setSelectedUser((prev: any) => prev ? { ...prev, ...updateData } : null);
      fetchUsers();
    } catch (err: any) {
      console.error('[UPDATE STAFF ERROR]', err);
      toast.error(err.message || 'Failed to update staff member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const updated = await api.patch(`/users/${selectedUser.id}`, { role: newSelectedRole });
      if (updated && updated.id) {
        await syncEntityToRtdb('users', updated.id, updated).catch(() => {});
      }
      toast.success(`Role for ${selectedUser.name || 'Staff Member'} updated to ${newSelectedRole.replace(/_/g, ' ')}`);
      setIsChangeRoleOpen(false);
      setIsOperationsModalOpen(false);
      setSelectedUser((prev: any) => prev ? { ...prev, role: newSelectedRole } : null);
      fetchUsers();
    } catch (err: any) {
      console.error('[CHANGE ROLE ERROR]', err);
      toast.error(err.message || 'Failed to change role. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatusConfirm = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    const newStatus = !selectedUser.isActive;
    try {
      const updated = await api.patch(`/users/${selectedUser.id}`, { 
        isActive: newStatus,
        accountStatus: newStatus ? 'ACTIVE' : 'DISABLED'
      });
      if (updated && updated.id) {
        await syncEntityToRtdb('users', updated.id, updated).catch(() => {});
      }
      toast.success(`Account for ${selectedUser.name || 'Staff Member'} ${newStatus ? 'activated' : 'deactivated'}`);
      setIsToggleStatusOpen(false);
      setIsOperationsModalOpen(false);
      setSelectedUser((prev: any) => prev ? { ...prev, isActive: newStatus, accountStatus: newStatus ? 'ACTIVE' : 'DISABLED' } : null);
      fetchUsers();
    } catch (err: any) {
      console.error('[TOGGLE STATUS ERROR]', err);
      toast.error(err.message || 'Failed to change account status. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };



  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res: any = await api.delete(`/users/${selectedUser.id}`);
      await deleteEntityFromRtdb('users', selectedUser.id).catch(() => {});
      toast.success(res?.message || 'Staff member deleted successfully');
      setIsDeleteDialogOpen(false);
      setIsOperationsModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('[DELETE USER ERROR]', err);
      toast.error(err.message || 'Failed to delete staff member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!resetPasswordData.password) {
      return toast.error('Please enter a new password');
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (resetPasswordData.password.length < 6) {
      return toast.error('Password must be at least 6 characters long');
    }
    setSubmitting(true);
    try {
      await api.patch(`/users/${selectedUser.id}`, { password: resetPasswordData.password });
      toast.success(`Password reset successfully for ${selectedUser.name || 'Staff Member'}`);
      setIsResetPasswordOpen(false);
      setIsOperationsModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      console.error('[RESET PASSWORD ERROR]', err);
      toast.error(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationCooldowns, setVerificationCooldowns] = useState<Record<string, number>>({});
  const [userToDirectVerify, setUserToDirectVerify] = useState<any>(null);
  const [directVerifying, setDirectVerifying] = useState(false);

  useEffect(() => {
    if (!Object.values(verificationCooldowns).some((seconds) => seconds > 0)) return;
    const timer = window.setInterval(() => {
      setVerificationCooldowns((current) => {
        const next: Record<string, number> = {};
        Object.entries(current).forEach(([id, value]) => {
          const seconds = Math.max(0, Number(value) - 1);
          if (seconds > 0) next[id] = seconds;
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verificationCooldowns]);

  const handleCheckUserVerification = async (user: any) => {
    if (!user || checkingVerification) return;
    setCheckingVerification(true);
    try {
      const res: any = await api.post('/auth/verify-email-status', {
        email: user.email,
        firebaseUid: user.firebaseUid
      });
      if (res?.emailVerified) {
        toast.success(`Email status confirmed: ${user.name || 'User'} is verified in database!`);
        if (selectedUser?.id === user.id) {
          setSelectedUser((prev: any) => prev ? { ...prev, emailVerified: true } : null);
        }
      } else {
        toast.info(`Email for ${user.name || 'User'} is not yet verified in Firebase.`);
      }
      fetchUsers();
    } catch (err: any) {
      console.error('[CHECK VERIFICATION ERROR]', err);
      toast.error(err.message || 'Unable to check verification status.');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendUserVerification = async (user: any) => {
    const userKey = String(user?.id || '');
    if (!user || !userKey || resendingVerification || (verificationCooldowns[userKey] || 0) > 0) return;
    setResendingVerification(true);
    try {
      const res: any = await api.post('/auth/resend-verification', {
        email: user.email
      });
      setVerificationCooldowns((current) => ({ ...current, [userKey]: 60 }));
      toast.success(res?.message || `Verification email dispatched to ${user.email}`);
    } catch (err: any) {
      console.error('[RESEND VERIFICATION ERROR]', err);
      const remaining = err?.retryAfter || (err?.status === 429 || err?.code === 429 ? 60 : 0);
      if (remaining > 0) {
        setVerificationCooldowns((current) => ({ ...current, [userKey]: remaining }));
      }
      toast.error(err.message || 'Unable to send verification email.');
    } finally {
      setResendingVerification(false);
    }
  };

  const handleDirectVerifyEmail = async () => {
    if (!userToDirectVerify || directVerifying) return;
    setDirectVerifying(true);
    try {
      const res: any = await api.post(`/admin/staff/${userToDirectVerify.id}/verify-email`, {});
      if (res.success) {
        toast.success(res.message || `Email verified successfully for ${userToDirectVerify.name || 'Staff User'}.`);
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === userToDirectVerify.id ? { ...u, emailVerified: true } : u
          )
        );
        if (selectedUser?.id === userToDirectVerify.id) {
          setSelectedUser((prev: any) => (prev ? { ...prev, emailVerified: true } : null));
        }
        fetchUsers(true);
      } else {
        toast.error(res.error || res.message || 'Unable to verify this email.');
      }
    } catch (err: any) {
      console.error('[DIRECT EMAIL VERIFICATION ERROR]', err);
      toast.error(err.message || 'Unable to verify this email. Please try again.');
    } finally {
      setDirectVerifying(false);
      setUserToDirectVerify(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-bold text-slate-800 text-base">Loading Staff Directory...</p>
          <p className="text-xs text-slate-400">Fetching real-time team records & security permissions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
      {/* Network / Error Notice Banner */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div className="text-xs sm:text-sm font-semibold">
              {fetchError}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => fetchUsers(false)}
            className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/80 rounded-2xl text-indigo-600 shadow-inner">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Staff Management</h1>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 border-slate-200 text-slate-700">
                Administration
              </Badge>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Manage accounts, assign operational roles, and enforce security policies
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
          <DashboardRefreshButton
            onRefresh={() => fetchUsers(false)}
            size="default"
            label="Refresh Directory"
          />
          <Button 
            type="button"
            onClick={handleOpenAdd}
            className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md shadow-slate-900/10 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="mr-2 h-4 w-4 text-indigo-400" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Metric Counters Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900">{counts.total}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Staff</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900">{counts.active}</div>
            <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Active Staff</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900">{counts.disabled}</div>
            <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Deactivated</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900">{counts.admins}</div>
            <div className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Administrators</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name, email, username, phone, or department..." 
              className="h-11 pl-10 pr-9 rounded-xl border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  statusFilter === 'ALL' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  statusFilter === 'ACTIVE' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Active ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DISABLED')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  statusFilter === 'DISABLED' ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Deactivated ({counts.disabled})
              </button>
            </div>

            {/* Role Filter */}
            <div className="w-full sm:w-48 shrink-0">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-xs font-bold">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl">
                  <SelectItem value="ALL">All Roles</SelectItem>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop View Switcher */}
            <div className="hidden md:flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer",
                  viewMode === 'table' || viewMode === 'auto' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer",
                  viewMode === 'grid' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
                title="Card Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Banner */}
      {selectedUserIds.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg border border-indigo-800 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Badge className="bg-indigo-600 text-white font-black px-3 py-1 rounded-xl text-xs">
              Selected: {selectedUserIds.length}
            </Badge>
            <span className="text-xs font-bold text-slate-200">
              {isAllSelected ? 'All eligible staff records selected' : `${selectedUserIds.length} of ${selectableUserIds.length} eligible records selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUserIds([])}
              className="text-slate-300 hover:text-white text-xs font-bold"
            >
              Clear Selection
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl h-9 px-4 gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedUserIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Main Staff Content */}
      {filteredUsers.length === 0 ? (
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Staff Members Found</h3>
            <p className="text-xs text-slate-500">
              {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                ? "Try adjusting your search criteria or clearing filters to view other team members."
                : "No personnel accounts are currently registered in the system."}
            </p>
            {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="mt-2 text-xs font-bold rounded-xl cursor-pointer"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* 1. MOBILE & RESPONSIVE CARDS */}
          <div className={cn(
            "grid gap-3.5 sm:gap-4",
            viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3" : "grid-cols-1 md:hidden"
          )}>
            {filteredUsers.map((u) => {
              const roleConfig = getRoleConfig(u?.role);
              const isUserActive = Boolean(u?.isActive && (u?.accountStatus || 'ACTIVE') === 'ACTIVE');
              const avatarSrc = u?.profileImage || u?.profilePhoto || null;
              const displayName = u?.name || 'Staff Member';
              const rawUsername = u?.username || (u?.name ? u.name.toLowerCase().replace(/\s+/g, '') : 'staff');
              const displayUsername = rawUsername.replace(/^@/, '');

              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-3.5 min-w-0 overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm sm:text-base overflow-hidden shrink-0 border border-slate-800 shadow-xs">
                          {avatarSrc ? (
                            <img 
                              src={avatarSrc} 
                              alt={displayName} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <span>{getSafeInitials(displayName)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight truncate" title={displayName}>
                            {displayName}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-0.5 min-w-0">
                            <AtSign className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate flex-1 min-w-0" title={`@${displayUsername}`}>{displayUsername}</span>
                          </div>
                        </div>
                      </div>

                      {/* Operations Button */}
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleOpenOperations(u)}
                        className="h-8 px-2.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold border-slate-200 gap-1 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
                      >
                        <MoreVertical className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="hidden sm:inline">Actions</span>
                      </Button>
                    </div>

                    {/* Role and Status Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 max-w-[120px] truncate", roleConfig.badge)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 inline-block", roleConfig.dot)} />
                        {roleConfig.label}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider border shrink-0",
                          isUserActive 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}
                      >
                        {isUserActive ? "Active" : "Locked"}
                      </Badge>

                      {Boolean(u?.emailVerified) ? (
                        <Badge variant="outline" className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 shadow-2xs shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span>Verified</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 shrink-0">
                          <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                          <span>Unverified</span>
                        </Badge>
                      )}
                      {u?.department && (
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 min-w-0 max-w-full">
                          <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{u.department}</span>
                        </span>
                      )}
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate flex-1 min-w-0" title={u?.email || 'No email registered'}>
                          {u?.email || 'No email registered'}
                        </span>
                      </div>
                      {u?.phoneNumber && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate flex-1 min-w-0" title={u.phoneNumber}>{u.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Card Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenView(u)}
                      className="h-9 px-2 sm:px-3 text-xs font-bold rounded-xl text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer min-w-0 overflow-hidden"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">View Profile</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(u)}
                      className="h-9 px-2 sm:px-3 text-xs font-bold rounded-xl text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer min-w-0 overflow-hidden"
                    >
                      <Edit3 className="mr-1.5 h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Edit Profile</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. DESKTOP RESPONSIVE TABLE */}
          <div className={cn(
            "bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden",
            viewMode === 'grid' ? "hidden" : "hidden md:block"
          )}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-4 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                        onChange={handleToggleSelectAll}
                        title="Select All Staff Records"
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500 px-6 py-4">
                      Staff Personnel
                    </TableHead>
                    <TableHead className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500 px-6 py-4">
                      Role & Clearance
                    </TableHead>
                    <TableHead className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500 px-6 py-4">
                      Contact & Verification
                    </TableHead>
                    <TableHead className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500 px-6 py-4 text-center">
                      Account Status
                    </TableHead>

                    <TableHead className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500 px-6 py-4 text-right">
                      Operations
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const roleConfig = getRoleConfig(u?.role);
                    const isUserActive = Boolean(u?.isActive && (u?.accountStatus || 'ACTIVE') === 'ACTIVE');
                    const avatarSrc = u?.profileImage || u?.profilePhoto || null;
                    const displayName = u?.name || 'Staff Member';
                    const displayUsername = u?.username || (u?.name ? u.name.toLowerCase().replace(/\s+/g, '') : 'staff');

                    return (
                      <TableRow 
                        key={u.id} 
                        className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-none"
                      >
                        {/* Checkbox */}
                        <TableCell className="py-3.5 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            disabled={u.id === currentUser?.id || u.email?.toLowerCase() === 'mtsmobilelab@gmail.com'}
                            onChange={() => handleToggleUserSelect(u.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                          />
                        </TableCell>
                        {/* Personnel */}
                        <TableCell className="px-4 lg:px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-slate-800 shadow-xs">
                              {avatarSrc ? (
                                <img 
                                  src={avatarSrc} 
                                  alt={displayName} 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <span>{getSafeInitials(displayName)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block text-sm leading-snug">
                                {displayName}
                              </span>
                              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <AtSign className="h-3 w-3" />
                                {displayUsername}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role */}
                        <TableCell className="px-4 lg:px-6 py-3.5">
                          <div className="space-y-1">
                            <Badge variant="outline" className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-lg border whitespace-nowrap", roleConfig.badge)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block shrink-0", roleConfig.dot)} />
                              {roleConfig.label}
                            </Badge>
                            {u?.department && (
                              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 pl-0.5 truncate max-w-[120px] lg:max-w-[160px]">
                                <Building2 className="h-3 w-3 shrink-0" /> {u.department}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Contact & Verification */}
                        <TableCell className="px-4 lg:px-6 py-3.5">
                          <div className="space-y-1 text-xs text-slate-600 font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[130px] lg:max-w-[170px]">{u?.email || 'No email'}</span>
                              </div>
                              {Boolean(u?.emailVerified) ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                  <AlertCircle className="h-2.5 w-2.5 text-amber-600" />
                                  Unverified
                                </Badge>
                              )}
                            </div>
                            {u?.phoneNumber ? (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{u.phoneNumber}</span>
                              </div>
                            ) : (
                              <div className="text-slate-400 text-[11px] italic">No phone added</div>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="px-4 lg:px-6 py-3.5 text-center">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border inline-flex items-center gap-1.5",
                              isUserActive 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", isUserActive ? "bg-emerald-500" : "bg-rose-500")} />
                            {isUserActive ? 'Active' : 'Locked'}
                          </Badge>
                        </TableCell>



                        {/* Operations Action Buttons */}
                        <TableCell className="px-4 lg:px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenView(u)}
                              className="h-8 px-2 lg:px-2.5 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 lg:mr-1 text-indigo-500" /><span className="hidden lg:inline">View</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(u)}
                              className="h-8 px-2 lg:px-2.5 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5 lg:mr-1 text-slate-500" /><span className="hidden lg:inline">Edit</span>
                            </Button>
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleOpenOperations(u)}
                              className="h-8 px-2.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs border-slate-200 gap-1 shadow-2xs cursor-pointer"
                            >
                              <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                              <span className="hidden xl:inline">Operations</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 1. MASTER OPERATIONS ACTION MODAL (HORIZONTAL 2-COLUMN LAYOUT) */}
      {/* ========================================================================= */}
      <Dialog open={isOperationsModalOpen} onOpenChange={setIsOperationsModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-3xl lg:max-w-4xl rounded-3xl p-0 border border-slate-200/90 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
          {/* Header */}
          <DialogHeader className="p-5 sm:p-6 bg-slate-900 text-white shrink-0 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base sm:text-lg overflow-hidden border-2 border-indigo-400/30 shadow-md shrink-0">
                  {selectedUser?.profileImage || selectedUser?.profilePhoto ? (
                    <img 
                      src={selectedUser.profileImage || selectedUser.profilePhoto} 
                      alt={selectedUser?.name || 'Staff Member'} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>{getSafeInitials(selectedUser?.name)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <DialogTitle className="text-base sm:text-lg font-black text-white truncate leading-snug">
                    {selectedUser?.name || 'Staff Operations'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-indigo-200 flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
                    <AtSign className="h-3 w-3 shrink-0" />
                    <span className="truncate">{selectedUser?.username || (selectedUser?.name ? selectedUser.name.toLowerCase().replace(/\s+/g, '') : 'staff')}</span>
                    <span className="text-indigo-400 shrink-0">•</span>
                    <span className="font-semibold text-white truncate flex-1 min-w-0">{selectedUser?.email || 'No email'}</span>
                  </DialogDescription>
                </div>
              </div>

              {/* Status Badges in Header */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg border", getRoleConfig(selectedUser?.role).badge)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block shrink-0", getRoleConfig(selectedUser?.role).dot)} />
                  {getRoleConfig(selectedUser?.role).label}
                </Badge>
                {Boolean(selectedUser?.isActive && (selectedUser?.accountStatus || 'ACTIVE') === 'ACTIVE') ? (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    Locked
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Modal Body with Horizontal 2-Column Grid */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Staff Operation
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Choose an action below to manage this account
              </span>
            </div>

            {/* Responsive 2-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. View Full Profile */}
              <button
                type="button"
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  handleOpenView(selectedUser);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50/80 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    View Full Profile
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    Inspect credentials, timestamps, activity log & repair records
                  </div>
                </div>
              </button>

              {/* 2. Edit Profile & Details */}
              <button
                type="button"
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  handleOpenEdit(selectedUser);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50/80 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Edit Profile & Details
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    Update name, email, phone number, address & department
                  </div>
                </div>
              </button>

              {/* 3. Change Role Clearance */}
              <button
                type="button"
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  handleOpenChangeRole(selectedUser);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50/80 hover:bg-purple-50/60 border border-slate-200/80 hover:border-purple-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-2xs">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                    Change Role Clearance
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    Elevate or reassign system administrative permissions
                  </div>
                </div>
              </button>

              {/* 4. Reset Staff Password */}
              <button
                type="button"
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  handleOpenResetPassword(selectedUser);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50/80 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-2xs">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                    Reset Staff Password
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    Assign a new secure login authentication password
                  </div>
                </div>
              </button>


              {/* 6. Email Verification Status & Live Check */}
              <button
                type="button"
                onClick={() => {
                  handleCheckUserVerification(selectedUser);
                }}
                disabled={checkingVerification}
                className="w-full p-3.5 rounded-2xl bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                  selectedUser?.emailVerified 
                    ? "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white" 
                    : "bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white"
                )}>
                  {checkingVerification ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Email Verification</span>
                    {selectedUser?.emailVerified ? (
                      <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                        <AlertCircle className="h-2.5 w-2.5" /> Unverified
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    {selectedUser?.emailVerified 
                      ? 'Confirmed in Firebase & database — Click to re-check' 
                      : 'Not verified yet — Click to query live status'}
                  </div>
                </div>
              </button>

              {/* 7. Super Admin Direct Verify Email (When Unverified & isSuperAdmin) */}
              {!selectedUser?.emailVerified && isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOperationsModalOpen(false);
                    setUserToDirectVerify(selectedUser);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer shadow-xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 flex-wrap">
                      <span>Verify Email Address</span>
                      <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-extrabold">SUPER ADMIN</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 line-clamp-2 mt-0.5 leading-snug">
                      Directly verify this staff member's email in Firebase Auth & central database
                    </div>
                  </div>
                </button>
              )}

              {/* 8. Resend Verification Link (When Unverified) */}
              {!selectedUser?.emailVerified && (
                <button
                  type="button"
                  onClick={() => {
                    handleResendUserVerification(selectedUser);
                  }}
                  disabled={resendingVerification || (verificationCooldowns[String(selectedUser?.id || '')] || 0) > 0}
                  className="w-full p-3.5 rounded-2xl bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200/90 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-2xs">
                    {resendingVerification ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      {(verificationCooldowns[String(selectedUser?.id || '')] || 0) > 0
                        ? `Available in ${verificationCooldowns[String(selectedUser?.id || '')]}s`
                        : 'Resend Verification Email'}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                      Send a fresh activation email link to {selectedUser?.email}
                    </div>
                  </div>
                </button>
              )}

              {/* 9. Deactivate / Activate Account */}
              <button
                type="button"
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  handleOpenToggleStatus(selectedUser);
                }}
                className="w-full p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/90 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-700 group-hover:text-white transition-colors shadow-2xs">
                  <Power className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900">
                    {selectedUser?.isActive ? 'Deactivate Account' : 'Activate Account'}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    {selectedUser?.isActive ? 'Temporarily suspend system access & login' : 'Restore system login access for this account'}
                  </div>
                </div>
              </button>

              {/* 10. Delete Account */}
              <button
                type="button"
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  handleOpenDelete(selectedUser);
                }}
                className="w-full p-3.5 rounded-2xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 hover:shadow-xs transition-all flex items-start gap-3.5 text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-2xs">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-rose-900">
                    Delete Staff Account
                  </div>
                  <div className="text-[11px] text-rose-600/80 line-clamp-2 mt-0.5 leading-snug">
                    Permanently archive this staff member record and credentials
                  </div>
                </div>
              </button>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline font-medium">
              Actions will update records across local and cloud databases
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOperationsModalOpen(false)}
              className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer h-9 px-5"
            >
              Close Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. VIEW STAFF DETAILS MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-lg rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="p-5 sm:p-6 pb-4 bg-slate-900 text-white shrink-0 overflow-hidden">
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg overflow-hidden border-2 border-indigo-400/30 shadow-md shrink-0">
                {selectedUser?.profileImage || selectedUser?.profilePhoto ? (
                  <img 
                    src={selectedUser.profileImage || selectedUser.profilePhoto} 
                    alt={selectedUser?.name || 'User'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span>{getSafeInitials(selectedUser?.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <DialogTitle className="text-base sm:text-lg font-bold truncate text-white">
                  {selectedUser?.name || 'Staff Profile'}
                </DialogTitle>
                <DialogDescription className="text-xs text-indigo-200 flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
                  <AtSign className="h-3 w-3 shrink-0" />
                  <span className="truncate">{selectedUser?.username || (selectedUser?.name ? selectedUser.name.toLowerCase().replace(/\s+/g, '') : 'staff')}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Overview Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedUser && (
                <>
                  <Badge variant="outline" className={cn("text-xs font-bold px-3 py-1 rounded-xl border", getRoleConfig(selectedUser.role).badge)}>
                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                    {getRoleConfig(selectedUser.role).label}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-bold px-3 py-1 rounded-xl uppercase tracking-wider border",
                      selectedUser.isActive && (selectedUser.accountStatus || 'ACTIVE') === 'ACTIVE'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}
                  >
                    {selectedUser.isActive ? 'Online / Active' : 'Deactivated / Locked'}
                  </Badge>
                </>
              )}
            </div>

            {/* Information Cards */}
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-indigo-600" />
                    Firebase Email Verification Status
                  </div>
                  {selectedUser?.emailVerified ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Unverified
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {selectedUser?.emailVerified
                    ? `Staff member's email (${selectedUser?.email}) is verified in Firebase Authentication and synchronized to central database.`
                    : `Staff member's email has not been verified yet. System login is restricted until the verification link is clicked.`}
                </p>
                <div className="pt-1 flex items-center gap-2 justify-end flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={checkingVerification}
                    onClick={() => handleCheckUserVerification(selectedUser)}
                    className="rounded-xl text-xs font-bold h-8 px-3 border-slate-300 gap-1.5 cursor-pointer"
                  >
                    {checkingVerification ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Check Live Status
                  </Button>
                  {!selectedUser?.emailVerified && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={resendingVerification || (verificationCooldowns[String(selectedUser?.id || '')] || 0) > 0}
                      onClick={() => handleResendUserVerification(selectedUser)}
                      className="rounded-xl text-xs font-bold h-8 px-3 bg-slate-900 text-white hover:bg-slate-800 gap-1.5 cursor-pointer"
                    >
                      {resendingVerification ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                      {(verificationCooldowns[String(selectedUser?.id || '')] || 0) > 0
                        ? `Available in ${verificationCooldowns[String(selectedUser?.id || '')]}s`
                        : 'Resend Verification Email'}
                    </Button>
                  )}
                  {!selectedUser?.emailVerified && isSuperAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setUserToDirectVerify(selectedUser)}
                      className="rounded-xl text-xs font-bold h-8 px-3.5 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Verify Email
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact Details</div>
                <div className="space-y-2 text-xs font-medium text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" /> Work Email
                    </span>
                    <span className="font-semibold text-slate-900">{selectedUser?.email || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone Number
                    </span>
                    <span className="font-semibold text-slate-900">{selectedUser?.phoneNumber || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" /> Address
                    </span>
                    <span className="font-semibold text-slate-900">{selectedUser?.address || 'Kathmandu, Nepal'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Organization & Clearance</div>
                <div className="space-y-2 text-xs font-medium text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" /> Department
                    </span>
                    <span className="font-semibold text-slate-900">{selectedUser?.department || 'General Operations'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" /> Account Created
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatSafeDate(selectedUser?.createdAt, 'MMM dd, yyyy', 'N/A')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> Last Active
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatSafeDate(selectedUser?.lastLoginAt, 'MMM dd, yyyy HH:mm', 'Recently')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsViewDialogOpen(false);
                handleOpenEdit(selectedUser);
              }}
              className="rounded-xl text-xs font-bold border-slate-300 cursor-pointer"
            >
              <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit Profile
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsViewDialogOpen(false)}
              className="rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. ADD STAFF DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-2xl font-black text-white">Add New Staff Member</DialogTitle>
            <DialogDescription className="font-medium text-slate-400 text-xs">
              Create local credentials, define system role clearances, and assign permissions
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
                  <Input 
                    placeholder="e.g. John Sharma" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Username *</Label>
                  <Input 
                    placeholder="e.g. john_tech" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Work Email *</Label>
                  <Input 
                    type="email" 
                    placeholder="john@mtslab.com" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Initial Password *</Label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">System Role *</Label>
                  <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      {ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value} className="text-xs py-2">
                          <div className="font-bold">{r.label}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{r.description}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Phone Number</Label>
                  <Input 
                    placeholder="98XXXXXXXX" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.phoneNumber}
                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Department</Label>
                  <Input 
                    placeholder="e.g. Micro Soldering, Front Desk" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Address</Label>
                  <Input 
                    placeholder="e.g. Kathmandu, Nepal" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold text-slate-700">Profile Photo</Label>
                <ImageUpload 
                  value={formData.profileImage}
                  onChange={(url) => setFormData({...formData, profileImage: url})}
                  onRemove={() => setFormData({...formData, profileImage: ''})}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddDialogOpen(false)}
                className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md cursor-pointer"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4 text-indigo-400" />}
                Create Staff Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. EDIT STAFF DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl rounded-3xl p-0 border border-slate-200 shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-2xl font-black text-white">Edit Staff Profile</DialogTitle>
            <DialogDescription className="font-medium text-slate-400 text-xs">
              Update personnel identifiers, contact markers, and department assignment
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUser} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
                  <Input 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Username *</Label>
                  <Input 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Work Email *</Label>
                  <Input 
                    type="email" 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Phone Number</Label>
                  <Input 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.phoneNumber}
                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Department</Label>
                  <Input 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Home Address</Label>
                  <Input 
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium" 
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold text-slate-700">Profile Photo</Label>
                <ImageUpload 
                  value={formData.profileImage}
                  onChange={(url) => setFormData({...formData, profileImage: url})}
                  onRemove={() => setFormData({...formData, profileImage: ''})}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md cursor-pointer"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. CHANGE ROLE DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1 border border-purple-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Change Staff Role</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modify operational role and permission boundaries for <b>{selectedUser?.name || 'User'}</b>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">Select Target Role</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {ROLES.map(r => {
                const isSelected = newSelectedRole === r.value;
                return (
                  <div
                    key={r.value}
                    onClick={() => setNewSelectedRole(r.value)}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                      isSelected 
                        ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20" 
                        : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/70"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0",
                      isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"
                    )}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{r.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{r.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsChangeRoleOpen(false)}
              className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleChangeRole}
              className="rounded-xl h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
              disabled={submitting || newSelectedRole === selectedUser?.role}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Role Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. RESET PASSWORD DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1 border border-amber-100">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Reset Staff Password</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Assign a new login password for <b>{selectedUser?.name || 'Staff Member'}</b> ({selectedUser?.email || ''})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">New Password</Label>
              <Input 
                type="password" 
                placeholder="••••••••••••" 
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium"
                value={resetPasswordData.password}
                onChange={e => setResetPasswordData({...resetPasswordData, password: e.target.value})}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Confirm New Password</Label>
              <Input 
                type="password" 
                placeholder="••••••••••••" 
                className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium"
                value={resetPasswordData.confirmPassword}
                onChange={e => setResetPasswordData({...resetPasswordData, confirmPassword: e.target.value})}
                required
              />
            </div>

            <DialogFooter className="pt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsResetPasswordOpen(false)}
                className="rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 7. ACTIVATE / DEACTIVATE CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <AlertDialog open={isToggleStatusOpen} onOpenChange={setIsToggleStatusOpen}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white">
          <AlertDialogHeader>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center mb-1 border",
              selectedUser?.isActive ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
            )}>
              {selectedUser?.isActive ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">
              {selectedUser?.isActive ? 'Deactivate Staff Account?' : 'Activate Staff Account?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              {selectedUser?.isActive ? (
                <>
                  Deactivating <b>{selectedUser?.name || 'this user'}</b> will immediately revoke their access, terminate active dashboard sessions, and prevent any new sign-in attempts.
                </>
              ) : (
                <>
                  Activating <b>{selectedUser?.name || 'this user'}</b> will restore their sign-in privileges and dashboard access according to their assigned role.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-3 flex items-center justify-between gap-2">
            <AlertDialogCancel className="rounded-xl text-xs font-bold text-slate-500 border-slate-200 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatusConfirm}
              className={cn(
                "rounded-xl text-xs font-bold px-5 cursor-pointer",
                selectedUser?.isActive 
                  ? "bg-amber-600 hover:bg-amber-700 text-white" 
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {selectedUser?.isActive ? 'Deactivate Account' : 'Activate Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========================================================================= */}
      {/* 8. DELETE STAFF CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1 border border-rose-100">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">
              Permanently Delete Staff Member?
            </AlertDialogTitle>
            <div className="text-xs text-slate-500 leading-relaxed space-y-2">
              <p>
                Are you sure you want to delete the account for <b>{selectedUser?.name || 'this user'}</b> ({selectedUser?.email || ''})?
              </p>
              <p className="text-rose-600 font-semibold">
                This action is irreversible and permanently removes their security credentials, assigned sessions, and access permissions.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-3 flex items-center justify-between gap-2">
            <AlertDialogCancel className="rounded-xl text-xs font-bold text-slate-500 border-slate-200 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="rounded-xl text-xs font-bold px-5 bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/10 cursor-pointer"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete Staff Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* ========================================================================= */}
      {/* 10. SUPER ADMIN DIRECT EMAIL VERIFICATION CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <AlertDialog open={!!userToDirectVerify} onOpenChange={(open) => !open && !directVerifying && setUserToDirectVerify(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-sm sm:max-w-md rounded-3xl border-slate-200 shadow-2xl bg-white p-5 sm:p-6 space-y-4">
          <AlertDialogHeader>
            <div className="flex items-start gap-3 min-w-0 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs shrink-0 mt-0.5">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <AlertDialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Verify Email Address?
                </AlertDialogTitle>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  Target: <span className="font-semibold text-slate-800 truncate">{userToDirectVerify?.name || 'User'}</span>
                  <span className="block truncate text-slate-400">{userToDirectVerify?.email || ''}</span>
                </div>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <p>
              You are about to manually verify this user's email address (<b>{userToDirectVerify?.email}</b>).
            </p>
            <p className="text-slate-500">
              This action directly updates the user's verification status in Firebase Authentication and the central MTS database. This action should only be used when you have confirmed the user's identity.
            </p>
          </div>

          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
            <AlertDialogCancel
              disabled={directVerifying}
              onClick={() => setUserToDirectVerify(null)}
              className="rounded-xl text-xs font-bold text-slate-600 border-slate-200 cursor-pointer w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={directVerifying}
              onClick={(e) => {
                e.preventDefault();
                handleDirectVerifyEmail();
              }}
              className="rounded-xl text-xs font-bold h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 w-full sm:w-auto justify-center"
            >
              {directVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verify Email</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========================================================================= */}
      {/* 9. BULK DELETE CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <AlertDialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl bg-white space-y-4">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1 border border-rose-100 mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-extrabold text-slate-900 text-center">
              Deactivate Selected Users?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 text-center font-medium leading-relaxed">
              You are about to deactivate <strong className="text-slate-900">{selectedUserIds.length} user record(s)</strong>.
              Accounts will be safely disabled while preserving historical repairs, attendance, and audit logs.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="pt-2 flex items-center justify-center gap-3">
            <AlertDialogCancel className="rounded-xl text-xs font-bold text-slate-600 border-slate-200 h-10 px-5 cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteBulkDelete}
              disabled={bulkDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-5 shadow-md shadow-rose-600/30 cursor-pointer"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirm Deactivation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function StaffManagement() {
  return (
    <ErrorBoundary
      fallbackTitle="Something went wrong in Staff Management. Please try again."
      fallbackMessage="An unexpected rendering issue occurred in Staff Management. Click below to reload your staff directory safely."
      showBackHome={true}
    >
      <StaffManagementContent />
    </ErrorBoundary>
  );
}
