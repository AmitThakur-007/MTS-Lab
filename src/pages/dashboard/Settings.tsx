import React, { useState, useEffect, Component, ErrorInfo } from 'react';
import { 
  Shield, 
  Lock, 
  Clock, 
  Monitor, 
  Smartphone, 
  Laptop,
  Tablet,
  Globe,
  LogOut, 
  CircleCheck as CheckCircle2, 
  AlertCircle,
  Key,
  ShieldAlert,
  History,
  User as UserIcon,
  BadgeCheck,
  Mail,
  Edit2,
  Phone,
  Building2,
  MapPin,
  AtSign,
  Save,
  Loader2,
  ChevronRight,
  Trash2,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { ImageUpload } from '@/components/ImageUpload';
import { Label } from '@/components/ui/label';
import { useRealtimeSync } from '@/services/realtime';
import { normalizeRole, getRoleDisplayName } from '@/lib/rbac';
import { format, isValid } from 'date-fns';

function safeFormatDate(dateVal: any, formatStr: string = 'MMM dd, yyyy · hh:mm a'): string {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (!isValid(d)) return '—';
    return format(d, formatStr);
  } catch {
    return '—';
  }
}

// Error boundary specifically for Settings page
interface SettingsErrorBoundaryProps {
  children: React.ReactNode;
}
interface SettingsErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SettingsErrorBoundary extends Component<SettingsErrorBoundaryProps, SettingsErrorBoundaryState> {
  constructor(props: SettingsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SettingsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SETTINGS ERROR BOUNDARY CAUGHT ERROR]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Settings Unavailable</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
              An unexpected error occurred while loading your profile and security credentials.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button 
              onClick={this.handleRetry} 
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs h-10 px-5 gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/dashboard'} 
              className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs h-10 px-5"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SettingsContent() {
  const { user, logout, updateUser } = useAuthStore();
  const [activities, setActivities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canonicalRole = normalizeRole(user?.role) || 'RECEPTIONIST';
  const isSuperAdmin = canonicalRole === 'SUPERADMIN';

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
    phoneNumber: user?.phoneNumber || '',
    department: user?.department || '',
    address: user?.address || '',
    profileImage: user?.profileImage || ''
  });

  // Sync profile form if user store updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        username: user.username || '',
        phoneNumber: user.phoneNumber || '',
        department: user.department || '',
        address: user.address || '',
        profileImage: user.profileImage || ''
      });
    }
  }, [user]);

  // Password change state
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    code: ''
  });
  const [pwdStep, setPwdStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [pwdTicket, setPwdTicket] = useState('');
  const [pwdEmailMasked, setPwdEmailMasked] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Super Admin Email Change state
  const [emailChangeStep, setEmailChangeStep] = useState<'IDLE' | 'STEP1_OTP' | 'STEP2_NEW_EMAIL' | 'STEP3_CONFIRM_OTP'>('IDLE');
  const [emailChangeCurrentPass, setEmailChangeCurrentPass] = useState('');
  const [emailChangeCurrentOtp, setEmailChangeCurrentOtp] = useState('');
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState('');
  const [emailChangeNewOtp, setEmailChangeNewOtp] = useState('');
  const [emailChangeCurrentTicket, setEmailChangeCurrentTicket] = useState('');
  const [emailChangeNewTicket, setEmailChangeNewTicket] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  // Super Admin 2FA Configuration State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(user?.twoFactorEnabled === true);
  const [twoFactorLoading, setTwoFactorLoading] = useState<boolean>(false);
  const [showDisable2faModal, setShowDisable2faModal] = useState<boolean>(false);
  const [showEnable2faModal, setShowEnable2faModal] = useState<boolean>(false);
  const [enableOtpCode, setEnableOtpCode] = useState<string>('');

  useEffect(() => {
    if (user) {
      setTwoFactorEnabled(user.twoFactorEnabled === true);
    }
  }, [user?.twoFactorEnabled]);

  const fetchData = async () => {
    try {
      const [actData, sessData, twoFaData] = await Promise.all([
        api.get('/auth/activity').catch(() => []),
        api.get('/auth/sessions').catch(() => []),
        isSuperAdmin ? api.get('/admin/security/2fa').catch(() => null) : Promise.resolve(null)
      ]);
      setActivities(Array.isArray(actData) ? actData : []);
      setSessions(Array.isArray(sessData) ? sessData : []);
      if (twoFaData && typeof twoFaData.twoFactorEnabled === 'boolean') {
        setTwoFactorEnabled(twoFaData.twoFactorEnabled);
        updateUser({ twoFactorEnabled: twoFaData.twoFactorEnabled });
      }
    } catch (err) {
      console.warn('[SETTINGS LOAD NOTICE]', err);
      setActivities([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Multi-device real-time sync for sessions and security activity
  useRealtimeSync(['session', 'user', 'sync'], () => {
    fetchData();
  });

  const handleToggle2FA = async (targetState: boolean) => {
    if (!targetState) {
      setShowDisable2faModal(true);
      return;
    }
    // When enabling 2FA: Dispatch verification OTP first
    setTwoFactorLoading(true);
    try {
      const res: any = await api.post('/admin/security/2fa/request-otp', {});
      setEnableOtpCode('');
      setShowEnable2faModal(true);
      toast.success(res?.message || 'A 6-digit verification code has been dispatched to your email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleConfirmEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enableOtpCode || enableOtpCode.trim().length !== 6) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }
    setTwoFactorLoading(true);
    try {
      const res: any = await api.post('/admin/security/2fa/verify-and-enable', { code: enableOtpCode.trim() });
      setTwoFactorEnabled(true);
      updateUser({ twoFactorEnabled: true, securitySetupCompleted: true });
      setShowEnable2faModal(false);
      setEnableOtpCode('');
      toast.success('Two-factor authentication is now enabled for Super Admin. 2FA will be required on your next login.');
    } catch (err: any) {
      toast.error(err.message || 'Incorrect or expired verification code. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const execute2faDisable = async () => {
    setTwoFactorLoading(true);
    setShowDisable2faModal(false);
    try {
      const res: any = await api.patch('/admin/security/2fa', { enabled: false });
      setTwoFactorEnabled(false);
      updateUser({ twoFactorEnabled: false, securitySetupCompleted: true });
      toast.success('Two-factor authentication is now disabled for Super Admin. You can now log in directly without OTP.');
    } catch (err: any) {
      setTwoFactorEnabled(user?.twoFactorEnabled === true);
      toast.error(err.message || 'Unable to update 2FA setting. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updatedUser = await api.patch('/profile', profileForm);
      updateUser(updatedUser);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: Request Password Change OTP
  const handleRequestPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    if (passForm.newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters long');
    }

    setPwdLoading(true);
    try {
      const res: any = await api.post('/auth/password-change/request', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      });
      setPwdTicket(res.pwdTicket || 'ticket_issued');
      setPwdEmailMasked(res.emailMasked || user?.email || 'registered email');
      setPwdStep('OTP');
      toast.success('Verification code dispatched to your registered email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate password change');
    } finally {
      setPwdLoading(false);
    }
  };

  // Step 2: Confirm Password Change OTP
  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passForm.code || passForm.code.trim().length !== 6) {
      return toast.error('Please enter the 6-digit verification code');
    }

    setPwdLoading(true);
    try {
      await api.post('/auth/password-change/confirm', {
        pwdTicket,
        code: passForm.code.trim()
      });
      toast.success('Password updated successfully! Logging out for security...');
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired verification code');
    } finally {
      setPwdLoading(false);
    }
  };

  // Super Admin Email Change: Step 1 Request
  const handleEmailChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailChangeCurrentPass) {
      return toast.error('Current password is required');
    }

    setEmailChangeLoading(true);
    try {
      const res: any = await api.post('/admin/change-email/request', {
        currentPassword: emailChangeCurrentPass
      });
      setEmailChangeCurrentTicket(res.currentTicket || 'em_ticket');
      setEmailChangeStep('STEP1_OTP');
      toast.success(`Step 1: Verification code sent to ${res.emailMasked || user?.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify current password');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  // Super Admin Email Change: Step 2 Verify Current OTP & Send Code to New Email
  const handleEmailChangeVerifyCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailChangeCurrentOtp || emailChangeCurrentOtp.trim().length !== 6) {
      return toast.error('Please enter the 6-digit code sent to your current email');
    }
    if (!emailChangeNewEmail || !emailChangeNewEmail.includes('@')) {
      return toast.error('Please enter a valid new email address');
    }

    setEmailChangeLoading(true);
    try {
      const res: any = await api.post('/admin/change-email/verify-current', {
        currentTicket: emailChangeCurrentTicket,
        code: emailChangeCurrentOtp.trim(),
        newEmail: emailChangeNewEmail.trim()
      });
      setEmailChangeNewTicket(res.newEmailTicket || 'emnew_ticket');
      setEmailChangeStep('STEP3_CONFIRM_OTP');
      toast.success(`Step 2: Verification code sent to ${res.newEmail || emailChangeNewEmail}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify current email code');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  // Super Admin Email Change: Step 3 Confirm New Email OTP & Finalize
  const handleEmailChangeConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailChangeNewOtp || emailChangeNewOtp.trim().length !== 6) {
      return toast.error('Please enter the 6-digit code sent to the new email');
    }

    setEmailChangeLoading(true);
    try {
      const res: any = await api.post('/admin/change-email/confirm', {
        newEmailTicket: emailChangeNewTicket,
        code: emailChangeNewOtp.trim()
      });
      toast.success(res.message || 'Super Admin email changed successfully! Logging out...');
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm new email code');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      toast.success('Session terminated successfully');
      setSessions(prev => (Array.isArray(prev) ? prev.filter(s => s.id !== sessionId) : []));
    } catch (err: any) {
      toast.error(err.message || 'Failed to terminate session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await api.delete('/auth/sessions-revoke-other');
      toast.success('All other sessions terminated successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to terminate other sessions');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await api.post('/auth/logout-all', {});
      toast.success('Successfully logged out from all devices');
      logout();
    } catch (err: any) {
      toast.error(err.message || 'Failed to logout from all devices');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-xs font-bold text-slate-400">Loading personal vault & security...</p>
      </div>
    );
  }

  const roleTitle = getRoleDisplayName(canonicalRole);
  const handleName = user?.username || (user?.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'staff');

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Personal Vault & Security</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Manage your profile and security credentials</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-100/70 p-1.5 rounded-2xl h-auto flex flex-wrap sm:inline-flex border border-slate-200/60">
          <TabsTrigger value="profile" className="rounded-xl py-2.5 px-5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            <UserIcon className="h-4 w-4 mr-2" /> Identity
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl py-2.5 px-5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Lock className="h-4 w-4 mr-2" /> Security
          </TabsTrigger>
          <TabsTrigger value="sessions" className="rounded-xl py-2.5 px-5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Monitor className="h-4 w-4 mr-2" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl py-2.5 px-5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
            <History className="h-4 w-4 mr-2" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* 1. IDENTITY TAB */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="rounded-[32px] sm:rounded-[40px] border border-slate-200/80 shadow-sm overflow-hidden bg-white">
            {/* Profile Banner */}
            <div className="h-36 sm:h-48 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 relative">
              <div className="absolute -bottom-10 sm:-bottom-12 left-6 sm:left-10">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[28px] sm:rounded-[32px] bg-white p-1.5 shadow-xl">
                  <div className="w-full h-full rounded-[22px] sm:rounded-[26px] bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden font-black text-3xl">
                    {user?.profileImage ? (
                      <img src={user.profileImage} className="w-full h-full object-cover" alt={user?.name || 'Staff'} />
                    ) : (
                      user?.name?.charAt(0)?.toUpperCase() || <UserIcon className="h-10 w-10 sm:h-12 sm:w-12" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-16 sm:pt-20 pb-8 px-6 sm:px-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{user?.name || 'Staff Member'}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge className="bg-indigo-600 text-white font-bold px-3 py-0.5 rounded-full text-[10px] tracking-wider">
                      {roleTitle}
                    </Badge>
                    <span className="text-slate-400 font-medium flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" /> {user?.address || 'Location Not Set'}
                    </span>
                  </div>
                </div>

                {!isEditing ? (
                  <Button 
                    onClick={() => setIsEditing(true)}
                    className="rounded-2xl h-11 sm:h-12 px-6 font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs sm:text-sm"
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Update Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                      className="rounded-2xl h-11 sm:h-12 px-5 font-bold border-slate-200 text-xs sm:text-sm"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleProfileUpdate}
                      className="rounded-2xl h-11 sm:h-12 px-6 font-bold bg-slate-900 text-white text-xs sm:text-sm"
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save</>}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <CardContent className="px-6 sm:px-10 pb-10 pt-2">
              {isEditing ? (
                <form onSubmit={handleProfileUpdate} className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">Full Name</Label>
                        <Input 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                          value={profileForm.name}
                          onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">System Username</Label>
                        <Input 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                          value={profileForm.username}
                          onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">Email Address</Label>
                        <Input 
                          type="email"
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                          value={profileForm.email}
                          onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">Phone Number</Label>
                        <Input 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                          placeholder="e.g. 98XXXXXXXX"
                          value={profileForm.phoneNumber}
                          onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">Department / Unit</Label>
                        <Input 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                          value={profileForm.department}
                          onChange={e => setProfileForm({...profileForm, department: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">Location / Address</Label>
                        <Input 
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                          value={profileForm.address}
                          onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs text-slate-700">Profile Picture</Label>
                    <ImageUpload 
                      value={profileForm.profileImage}
                      onChange={(url) => setProfileForm({...profileForm, profileImage: url})}
                      onRemove={() => setProfileForm({...profileForm, profileImage: ''})}
                    />
                  </div>
                </form>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-indigo-600 shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Email Address</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{user?.email || '—'}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-emerald-600 shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Phone Number</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">{user?.phoneNumber || 'Unlinked'}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-amber-600 shrink-0">
                      <AtSign className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">System Handle</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">@{handleName}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-rose-600 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Unit / Department</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">{user?.department || 'Operations'}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-slate-700 shrink-0">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Staff ID</p>
                      <p className="font-mono text-xs font-bold text-slate-900 truncate">{user?.id || '—'}</p>
                    </div>
                  </div>

                  <div className="bg-indigo-600 p-6 rounded-2xl text-white flex flex-col justify-between shadow-sm">
                    <Shield className="h-7 w-7 text-indigo-200" />
                    <div>
                      <h4 className="text-base font-bold mb-0.5">Access Clearance</h4>
                      <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">Authorized for {roleTitle}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. SECURITY TAB */}
        <TabsContent value="security" className="space-y-6">
          {/* Super Admin 2FA Security Control (Exclusive to SUPERADMIN) */}
          {isSuperAdmin && (
            <Card className="rounded-[32px] sm:rounded-[40px] border border-slate-200/80 shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-6 sm:p-10 pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-xs ${twoFactorEnabled ? 'bg-emerald-600' : 'bg-slate-900'}`}>
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <CardTitle className="text-xl sm:text-2xl font-bold">SUPERADMIN Two-Factor Authentication</CardTitle>
                        <Badge variant="outline" className={`font-black text-[11px] px-2.5 py-0.5 rounded-full ${twoFactorEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {twoFactorEnabled ? 'Status: Enabled' : 'Status: Disabled'}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                        Protect your Super Admin account with an additional verification code during login.
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 pt-2 space-y-4">
                <div className={`p-5 rounded-2xl border transition-all ${twoFactorEnabled ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950' : 'bg-slate-50 border-slate-200/80 text-slate-800'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 max-w-xl">
                      <p className="font-bold text-xs sm:text-sm flex items-center gap-2">
                        {twoFactorEnabled ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Two-factor authentication is currently enabled.
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 text-slate-500" />
                            Two-factor authentication is currently disabled.
                          </>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {twoFactorEnabled 
                          ? 'Every new Super Admin login attempt will require an email OTP verification code sent via MTS Lab security transport.'
                          : 'Super Administrator can log in directly after entering credentials without an additional 2FA OTP code.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1 sm:pt-0">
                      {twoFactorEnabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={twoFactorLoading}
                          onClick={() => handleToggle2FA(false)}
                          className="h-10 px-4 rounded-xl border-red-200 bg-white hover:bg-red-50 text-red-700 font-bold text-xs gap-2 shadow-xs"
                        >
                          {twoFactorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4 text-red-600" />}
                          Disable 2FA
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled={twoFactorLoading}
                          onClick={() => handleToggle2FA(true)}
                          className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-xs"
                        >
                          {twoFactorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                          Enable 2FA
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[32px] sm:rounded-[40px] border border-slate-200/80 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-6 sm:p-10 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xs">
                  <Key className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold">Password & 2FA Re-Encryption</CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">Password changes require your current password and 2FA email confirmation.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-10 pt-2">
              {pwdStep === 'INPUT' ? (
                <form onSubmit={handleRequestPasswordOtp} className="max-w-md space-y-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs text-slate-700">Current Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Existing password"
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                      value={passForm.currentPassword}
                      onChange={e => setPassForm({...passForm, currentPassword: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs text-slate-700">New Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Minimum 8 characters"
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                      value={passForm.newPassword}
                      onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs text-slate-700">Confirm New Password</Label>
                    <Input 
                      type="password" 
                      placeholder="Re-enter new password"
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                      value={passForm.confirmPassword}
                      onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={pwdLoading}
                    className="h-11 w-full sm:w-auto px-6 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm gap-2"
                  >
                    {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Send Verification Code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordChange} className="max-w-md space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-medium">
                    A 6-digit verification code was dispatched to: <b>{pwdEmailMasked}</b>. Enter it below to confirm your password change.
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs text-slate-700">6-Digit Email Code</Label>
                    <Input 
                      type="text" 
                      maxLength={6}
                      placeholder="000000"
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-center text-lg tracking-widest"
                      value={passForm.code}
                      onChange={e => setPassForm({...passForm, code: e.target.value.replace(/\D/g, '')})}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      disabled={pwdLoading || passForm.code.length !== 6}
                      className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                    >
                      {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Confirm Password Change
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setPwdStep('INPUT')}
                      className="h-11 rounded-xl font-bold px-4 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Super Admin Email Change Section (Exclusive to SUPERADMIN) */}
          {isSuperAdmin && (
            <Card className="rounded-[32px] sm:rounded-[40px] border border-slate-200/80 shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-6 sm:p-10 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xs">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl sm:text-2xl font-bold">Primary Super Admin Email</CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-medium">Current Primary: <span className="font-bold text-slate-800">{user?.email}</span></CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 pt-2">
                {emailChangeStep === 'IDLE' && (
                  <form onSubmit={handleEmailChangeRequest} className="max-w-md space-y-4">
                    <p className="text-xs text-slate-500 font-medium">
                      Changing the primary Super Admin email requires two-step verification on both your current and new email addresses.
                    </p>
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs text-slate-700">Verify Super Admin Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Current password"
                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                        value={emailChangeCurrentPass}
                        onChange={e => setEmailChangeCurrentPass(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={emailChangeLoading || !emailChangeCurrentPass}
                      className="h-11 w-full sm:w-auto px-6 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm gap-2"
                    >
                      {emailChangeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      Begin Step 1 (Verify Current Email)
                    </Button>
                  </form>
                )}

                {emailChangeStep === 'STEP1_OTP' && (
                  <form onSubmit={handleEmailChangeVerifyCurrent} className="max-w-md space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                      Step 1 of 2: Enter the 6-digit code sent to <b>{user?.email}</b> and enter your new email address.
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs text-slate-700">Current Email Code</Label>
                      <Input 
                        type="text" 
                        maxLength={6}
                        placeholder="000000"
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-center text-lg tracking-widest"
                        value={emailChangeCurrentOtp}
                        onChange={e => setEmailChangeCurrentOtp(e.target.value.replace(/\D/g, ''))}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs text-slate-700">New Super Admin Email Address</Label>
                      <Input 
                        type="email" 
                        placeholder="e.g. admin@mtslab.com"
                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                        value={emailChangeNewEmail}
                        onChange={e => setEmailChangeNewEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        disabled={emailChangeLoading || emailChangeCurrentOtp.length !== 6 || !emailChangeNewEmail}
                        className="h-11 flex-1 rounded-xl bg-slate-900 text-white font-bold text-xs"
                      >
                        {emailChangeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                        Continue to Step 2
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setEmailChangeStep('IDLE')}
                        className="h-11 rounded-xl font-bold px-4 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {emailChangeStep === 'STEP3_CONFIRM_OTP' && (
                  <form onSubmit={handleEmailChangeConfirm} className="max-w-md space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                      Step 2 of 2: Enter the 6-digit confirmation code dispatched to <b>{emailChangeNewEmail}</b>.
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs text-slate-700">New Email Confirmation Code</Label>
                      <Input 
                        type="text" 
                        maxLength={6}
                        placeholder="000000"
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-center text-lg tracking-widest"
                        value={emailChangeNewOtp}
                        onChange={e => setEmailChangeNewOtp(e.target.value.replace(/\D/g, ''))}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        disabled={emailChangeLoading || emailChangeNewOtp.length !== 6}
                        className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                      >
                        {emailChangeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Finalize Email Change
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setEmailChangeStep('IDLE')}
                        className="h-11 rounded-xl font-bold px-4 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* Session Termination Card */}
          <Card className="rounded-[32px] sm:rounded-[40px] border border-rose-200 bg-rose-50/20 p-6 sm:p-10 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="p-2.5 bg-rose-600 rounded-xl text-white w-fit shadow-xs">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Total System Isolation</h3>
                <p className="text-slate-500 font-medium text-xs leading-relaxed">
                  Terminate all active sessions and terminals across all devices linked to this staff account.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="rounded-2xl font-bold h-11 px-6 text-xs uppercase tracking-wider shrink-0"
                onClick={handleLogoutAll}
              >
                Terminate All Sessions
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* 3. SESSIONS TAB */}
        <TabsContent value="sessions" className="space-y-6">
          <Card className="rounded-[32px] sm:rounded-[40px] border border-slate-200/80 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-6 sm:p-10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold">Active Access Hubs</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">Authorized terminals and devices currently interfacing with your credentials.</CardDescription>
              </div>
              {sessions.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRevokeOtherSessions}
                  className="rounded-xl font-bold border-rose-200 text-rose-700 hover:bg-rose-50 text-xs h-9"
                >
                  Revoke Other Devices
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6 sm:p-10 pt-2 space-y-3">
              {sessions.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Monitor className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No active session records found</p>
                  <p className="text-xs text-slate-400 font-medium">Your current session is active and secure.</p>
                </div>
              ) : (
                sessions.map((sess) => (
                  <div key={sess.id || Math.random()} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-xs text-indigo-600 shrink-0">
                        {sess.deviceType === 'SMARTPHONE' || sess.userAgent?.includes('Mobile') ? (
                          <Smartphone className="h-5 w-5" />
                        ) : sess.deviceType === 'TABLET' ? (
                          <Tablet className="h-5 w-5" />
                        ) : sess.deviceType === 'LAPTOP' ? (
                          <Laptop className="h-5 w-5" />
                        ) : (
                          <Monitor className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm">
                            {sess.deviceName || (sess.browser ? `${sess.browser} on ${sess.os}` : 'Work Terminal')}
                          </p>
                          {sess.isCurrent && (
                            <Badge className="bg-emerald-500 text-white border-none font-bold text-[9px] px-2 py-0.5 rounded-full">
                              THIS DEVICE
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {sess.ipAddress || 'Internal Network'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {safeFormatDate(sess.lastActiveAt || sess.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!sess.isCurrent && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRevokeSession(sess.id)}
                        className="rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 self-end sm:self-center font-bold text-xs h-8"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> End Session
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. ACTIVITY LOGS TAB */}
        <TabsContent value="activity">
          <Card className="rounded-[32px] sm:rounded-[40px] border border-slate-200/80 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-6 sm:p-10 pb-4">
              <CardTitle className="text-xl sm:text-2xl font-bold">Authentication Activity Matrix</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">Review chronological access attempts, IP addresses, and outcome vectors.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 sm:px-10 py-4">Time-Stamp</th>
                    <th className="px-6 sm:px-10 py-4">Authorization</th>
                    <th className="px-6 sm:px-10 py-4">Terminal</th>
                    <th className="px-6 sm:px-10 py-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {activities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-10 py-8 text-center text-slate-400 font-bold">
                        No recent activity logs recorded.
                      </td>
                    </tr>
                  ) : (
                    activities.map((act) => (
                      <tr key={act.id || Math.random()} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 sm:px-10 py-4 font-mono text-slate-600">
                          {safeFormatDate(act.createdAt)}
                        </td>
                        <td className="px-6 sm:px-10 py-4">
                          {act.status === 'SUCCESS' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] px-2 py-0.5">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Cleared
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px] px-2 py-0.5">
                              <AlertCircle className="h-3 w-3 mr-1" /> Denied
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 sm:px-10 py-4 text-slate-800 font-bold">
                          {act.deviceName || (act.browser ? `${act.browser} on ${act.os}` : 'Device')}
                        </td>
                        <td className="px-6 sm:px-10 py-4">
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                            {act.ipAddress || '127.0.0.1'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Modal for Disabling Super Admin 2FA */}
      {showDisable2faModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Disable Two-Factor Authentication?</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Super Administrator Security</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Disabling 2FA reduces the security protection of the Super Admin account. Are you sure you want to continue?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDisable2faModal(false)}
                className="h-10 px-4 rounded-xl text-xs font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={twoFactorLoading}
                onClick={execute2faDisable}
                className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-2 shadow-xs"
              >
                {twoFactorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Disable 2FA
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* OTP Verification Modal for Enabling Super Admin 2FA */}
      {showEnable2faModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Verify & Enable 2FA</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Super Administrator Security</p>
              </div>
            </div>
            <form onSubmit={handleConfirmEnable2FA} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Enter the 6-digit verification code sent to <b>{user?.email || 'your email'}</b> to verify delivery and activate Two-Factor Authentication.
              </p>
              <div>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={enableOtpCode}
                  onChange={(e) => setEnableOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full h-12 text-center text-xl font-mono font-bold tracking-widest rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all outline-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEnable2faModal(false)}
                  className="h-10 px-4 rounded-xl text-xs font-bold border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorLoading || enableOtpCode.trim().length !== 6}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-xs"
                >
                  {twoFactorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Verify & Enable
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <SettingsErrorBoundary>
      <SettingsContent />
    </SettingsErrorBoundary>
  );
}
