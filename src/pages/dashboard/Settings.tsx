import { useState, useEffect } from 'react';
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
  Trash2
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

export default function Settings() {
  const { user, logout, updateUser } = useAuthStore();
  const [activities, setActivities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const fetchData = async () => {
    try {
      const [actData, sessData] = await Promise.all([
        api.get('/auth/activity'),
        api.get('/auth/sessions')
      ]);
      setActivities(actData);
      setSessions(sessData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Multi-device real-time sync for sessions and security activity
  useRealtimeSync(['session', 'user'], () => {
    fetchData();
  });

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
      setPwdTicket(res.pwdTicket);
      setPwdEmailMasked(res.emailMasked || user?.email || '');
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
      setEmailChangeCurrentTicket(res.currentTicket);
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
      setEmailChangeNewTicket(res.newEmailTicket);
      setEmailChangeStep('STEP3_CONFIRM_OTP');
      toast.success(`Step 2: Verification code sent to ${res.newEmail}`);
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
      setSessions(prev => prev.filter(s => s.id !== sessionId));
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
       <div className="h-full flex items-center justify-center p-20">
         <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
       </div>
     );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-black tracking-tight text-slate-900">Personal Vault</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Manage your profile and security credentials</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl h-auto flex flex-wrap sm:inline-flex border border-slate-100">
          <TabsTrigger value="profile" className="rounded-xl py-3 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50">
            <UserIcon className="h-4 w-4 mr-2" /> Identity
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl py-3 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50">
            <Lock className="h-4 w-4 mr-2" /> Security
          </TabsTrigger>
          <TabsTrigger value="sessions" className="rounded-xl py-3 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50">
            <Monitor className="h-4 w-4 mr-2" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl py-3 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50">
            <History className="h-4 w-4 mr-2" /> Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
             {/* Profile Header */}
             <div className="h-48 bg-slate-100 relative group">
                {user?.profileImage && (
                  <img src={user.profileImage} className="w-full h-full object-cover blur-sm opacity-20" alt="" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                <div className="absolute -bottom-12 left-10">
                   <div className="w-32 h-32 rounded-[32px] bg-white p-1.5 shadow-2xl shadow-slate-300">
                      <div className="w-full h-full rounded-[26px] bg-slate-50 flex items-center justify-center text-slate-300 overflow-hidden">
                         {user?.profileImage ? (
                           <img src={user.profileImage} className="w-full h-full object-cover" alt={user.name} />
                         ) : (
                           <UserIcon className="h-12 w-12" />
                         )}
                      </div>
                   </div>
                </div>
             </div>

             <div className="pt-20 pb-10 px-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                   <div>
                      <h3 className="text-4xl font-black text-slate-900 tracking-tight">{user?.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                         <Badge className="bg-indigo-600 text-white font-black px-4 py-1 rounded-full text-[10px] tracking-widest shadow-lg shadow-indigo-100">
                            {user?.role.replace('_', ' ')}
                         </Badge>
                         <span className="text-slate-400 font-bold flex items-center gap-1.5 text-xs">
                           <MapPin className="h-3 w-3" /> {user?.address || 'Location Not Set'}
                         </span>
                      </div>
                   </div>
                   {!isEditing ? (
                     <Button 
                       onClick={() => setIsEditing(true)}
                       className="rounded-[20px] h-14 px-8 font-black bg-black hover:bg-slate-800 shadow-xl shadow-slate-200"
                     >
                        <Edit2 className="h-5 w-5 mr-3" /> Update Profile
                     </Button>
                   ) : (
                     <div className="flex gap-3">
                       <Button 
                         variant="outline" 
                         onClick={() => setIsEditing(false)}
                         className="rounded-[20px] h-14 px-8 font-bold border-slate-200"
                       >
                          Cancel
                       </Button>
                       <Button 
                         onClick={handleProfileUpdate}
                         className="rounded-[20px] h-14 px-8 font-black bg-black shadow-xl shadow-slate-200"
                         disabled={submitting}
                       >
                          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-3" /> Save Changes</>}
                       </Button>
                     </div>
                   )}
                </div>
             </div>

             <CardContent className="px-10 pb-12 pt-4">
                {isEditing ? (
                  <form onSubmit={handleProfileUpdate} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Full Identity</Label>
                             <Input 
                               className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                               value={profileForm.name}
                               onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">System Username</Label>
                             <Input 
                               className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                               value={profileForm.username}
                               onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Electronic Mail</Label>
                             <Input 
                               type="email"
                               className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                               value={profileForm.email}
                               onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                             />
                          </div>
                       </div>
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Communication Line</Label>
                             <Input 
                               className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                               placeholder="e.g. 98XXXXXXXX"
                               value={profileForm.phoneNumber}
                               onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})}
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Department</Label>
                             <Input 
                               className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                               value={profileForm.department}
                               onChange={e => setProfileForm({...profileForm, department: e.target.value})}
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Coordinates (Address)</Label>
                             <Input 
                               className="h-14 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                               value={profileForm.address}
                               onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                             />
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Appearance Profile</Label>
                      <ImageUpload 
                        value={profileForm.profileImage}
                        onChange={(url) => setProfileForm({...profileForm, profileImage: url})}
                        onRemove={() => setProfileForm({...profileForm, profileImage: ''})}
                      />
                    </div>
                  </form>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100 flex items-start gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-500">
                          <Mail className="h-6 w-6" />
                       </div>
                       <div>
                          <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">Electronic Mail</p>
                          <p className="font-black text-slate-900">{user?.email}</p>
                       </div>
                    </div>
                    <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100 flex items-start gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-500">
                          <Phone className="h-6 w-6" />
                       </div>
                       <div>
                          <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">Communication Line</p>
                          <p className="font-black text-slate-900">{user?.phoneNumber || 'Unlinked'}</p>
                       </div>
                    </div>
                    <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100 flex items-start gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-amber-500">
                          <AtSign className="h-6 w-6" />
                       </div>
                       <div>
                          <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">System Handle</p>
                          <p className="font-black text-slate-900">@{user?.username || user?.name.toLowerCase().replace(' ', '')}</p>
                       </div>
                    </div>
                    <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100 flex items-start gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-rose-500">
                          <Building2 className="h-6 w-6" />
                       </div>
                       <div>
                          <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">Assignment Unit</p>
                          <p className="font-black text-slate-900">{user?.department || 'Operations'}</p>
                       </div>
                    </div>
                    <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100 flex items-start gap-4">
                       <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-600">
                          <BadgeCheck className="h-6 w-6" />
                       </div>
                       <div>
                          <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">Personnel ID</p>
                          <p className="font-mono text-xs font-black text-slate-900 truncate max-w-[120px]">{user?.id}</p>
                       </div>
                    </div>
                    <div className="bg-indigo-600 p-8 rounded-[40px] text-white flex flex-col justify-between shadow-2xl shadow-indigo-200">
                       <Shield className="h-10 w-10 opacity-70" />
                       <div>
                         <h4 className="text-xl font-black mb-2 tracking-tight">Access Clearance</h4>
                         <p className="text-indigo-100/70 text-[10px] font-bold uppercase tracking-widest">Authorized for {user?.role.replace('_', ' ')} operations</p>
                       </div>
                    </div>
                  </div>
                )}
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {/* Password Change Card with Mandatory Email OTP */}
          <Card className="rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="p-10 pb-4">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 bg-black rounded-[24px] flex items-center justify-center text-white shadow-2xl shadow-black/20">
                  <Key className="h-8 w-8 text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black">Re-Encrypt Credentials (2FA)</CardTitle>
                  <CardDescription className="font-bold text-slate-400">Password changes require current password and email OTP confirmation.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              {pwdStep === 'INPUT' ? (
                <form onSubmit={handleRequestPasswordOtp} className="max-w-md space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Current Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Existing password"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={passForm.currentPassword}
                        onChange={e => setPassForm({...passForm, currentPassword: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">New Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Min 8 chars, uppercase, lowercase, numbers"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={passForm.newPassword}
                        onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Confirm New Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Re-enter new password"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={passForm.confirmPassword}
                        onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={pwdLoading}
                    className="h-14 w-full sm:w-auto px-10 rounded-2xl bg-black font-black text-sm transition-all active:scale-95 shadow-xl shadow-slate-200"
                  >
                    {pwdLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    Send Verification Code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordChange} className="max-w-md space-y-6">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold">
                    A 6-digit verification code was dispatched to: <b>{pwdEmailMasked}</b>. Enter it below to authorize this password change.
                  </div>

                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">6-Digit Email Code</Label>
                    <Input 
                      type="text" 
                      maxLength={6}
                      placeholder="000000"
                      className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-center text-xl tracking-widest"
                      value={passForm.code}
                      onChange={e => setPassForm({...passForm, code: e.target.value.replace(/\D/g, '')})}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      type="submit" 
                      disabled={pwdLoading || passForm.code.length !== 6}
                      className="h-14 flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black text-sm transition-all shadow-xl shadow-emerald-200 text-white"
                    >
                      {pwdLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Confirm Password Change
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setPwdStep('INPUT')}
                      className="h-14 rounded-2xl font-bold px-5"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Super Admin Email Change Section (Exclusive to SUPER_ADMIN) */}
          {user?.role === 'SUPER_ADMIN' && (
            <Card className="rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
              <CardHeader className="p-10 pb-4">
                <div className="flex items-center gap-5">
                  <div className="h-16 w-16 bg-slate-900 rounded-[24px] flex items-center justify-center text-amber-400 shadow-2xl shadow-slate-900/20">
                    <Mail className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black">Primary Super Admin Email</CardTitle>
                    <CardDescription className="font-bold text-slate-400">Current Primary: <span className="font-bold text-slate-800">{user.email}</span></CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-10">
                {emailChangeStep === 'IDLE' && (
                  <form onSubmit={handleEmailChangeRequest} className="max-w-md space-y-4">
                    <p className="text-xs text-slate-500 font-medium">
                      Changing the primary Super Admin email requires two-step cryptographic verification on both your current and new email addresses.
                    </p>
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Verify Super Admin Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Current password"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                        value={emailChangeCurrentPass}
                        onChange={e => setEmailChangeCurrentPass(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={emailChangeLoading || !emailChangeCurrentPass}
                      className="h-14 w-full sm:w-auto px-8 rounded-2xl bg-slate-900 text-white font-black text-sm"
                    >
                      {emailChangeLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                      Begin Step 1 (Verify Current Email)
                    </Button>
                  </form>
                )}

                {emailChangeStep === 'STEP1_OTP' && (
                  <form onSubmit={handleEmailChangeVerifyCurrent} className="max-w-md space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                      Step 1 of 2: Enter the 6-digit verification code dispatched to <b>{user.email}</b> and provide your new email address.
                    </div>

                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">Current Email Code</Label>
                      <Input 
                        type="text" 
                        maxLength={6}
                        placeholder="000000"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-center text-xl tracking-widest"
                        value={emailChangeCurrentOtp}
                        onChange={e => setEmailChangeCurrentOtp(e.target.value.replace(/\D/g, ''))}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">New Super Admin Email Address</Label>
                      <Input 
                        type="email" 
                        placeholder="e.g. newadmin@mtslab.com"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-sm"
                        value={emailChangeNewEmail}
                        onChange={e => setEmailChangeNewEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        type="submit" 
                        disabled={emailChangeLoading || emailChangeCurrentOtp.length !== 6 || !emailChangeNewEmail}
                        className="h-14 flex-1 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm"
                      >
                        {emailChangeLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                        Continue to Step 2
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setEmailChangeStep('IDLE')}
                        className="h-14 rounded-2xl font-bold px-5"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {emailChangeStep === 'STEP3_CONFIRM_OTP' && (
                  <form onSubmit={handleEmailChangeConfirm} className="max-w-md space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                      Step 2 of 2: Enter the 6-digit confirmation code dispatched to <b>{emailChangeNewEmail}</b>.
                    </div>

                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-widest text-slate-400 pl-1">New Email Confirmation Code</Label>
                      <Input 
                        type="text" 
                        maxLength={6}
                        placeholder="000000"
                        className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-center text-xl tracking-widest"
                        value={emailChangeNewOtp}
                        onChange={e => setEmailChangeNewOtp(e.target.value.replace(/\D/g, ''))}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        type="submit" 
                        disabled={emailChangeLoading || emailChangeNewOtp.length !== 6}
                        className="h-14 flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-xl shadow-emerald-200"
                      >
                        {emailChangeLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Finalize Super Admin Email Change
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setEmailChangeStep('IDLE')}
                        className="h-14 rounded-2xl font-bold px-5"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[40px] border-none bg-rose-50/10 shadow-2xl shadow-rose-100/50 p-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="p-3 bg-rose-600 rounded-2xl text-white w-fit shadow-xl shadow-rose-200">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Total System Isolation</h3>
                  <CardDescription className="mt-2 text-slate-500 font-bold leading-relaxed">
                    Detected unauthorized pattern? This will instantly terminate all active sessions across all devices linked to this personnel ID.
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="destructive" 
                className="rounded-3xl font-black h-20 px-10 text-lg shadow-2xl shadow-rose-200 uppercase tracking-widest"
                onClick={handleLogoutAll}
              >
                Terminate Cross-Hub Access
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card className="rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="p-10 pb-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black">Active Access Hubs</CardTitle>
                <CardDescription className="font-bold">Terminals currently interfacing with your staff credentials.</CardDescription>
              </div>
              {sessions.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRevokeOtherSessions}
                  className="rounded-xl font-bold border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  Revoke Other Devices
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-10 pb-10 space-y-4">
              {sessions.map((sess) => (
                <div key={sess.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-[28px] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all gap-4">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform shrink-0">
                      {sess.deviceType === 'SMARTPHONE' || sess.userAgent?.includes('Mobile') ? (
                        <Smartphone className="h-6 w-6 text-indigo-500" />
                      ) : sess.deviceType === 'TABLET' ? (
                        <Tablet className="h-6 w-6 text-indigo-500" />
                      ) : sess.deviceType === 'LAPTOP' ? (
                        <Laptop className="h-6 w-6 text-indigo-500" />
                      ) : (
                        <Monitor className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <p className="font-black text-slate-900 text-lg">
                          {sess.deviceName || (sess.browser ? `${sess.browser} on ${sess.os}` : 'Work Terminal')}
                        </p>
                        {sess.isCurrent && (
                          <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] px-3 py-0.5 rounded-full shadow-lg shadow-emerald-100 tracking-wider">
                            THIS DEVICE
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {sess.deviceType && (
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {sess.deviceType}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-slate-400" /> {sess.ipAddress || 'Internal Network'}
                        </span>
                        <span className="text-slate-200">•</span>
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" /> {new Date(sess.lastActiveAt || sess.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 self-end sm:self-center font-bold text-xs"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> End Session
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
            <CardHeader className="p-10">
              <CardTitle className="text-2xl font-black">Authentication Matrix</CardTitle>
              <CardDescription className="font-bold">Review chronological access attempts and outcome vectors.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Time-Stamp</th>
                    <th className="px-10 py-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Authorization Status</th>
                    <th className="px-10 py-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Device / Terminal</th>
                    <th className="px-10 py-6 font-black text-[10px] uppercase tracking-widest text-slate-400">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                           <span className="font-black text-slate-900 text-sm">{new Date(act.createdAt).toLocaleDateString()}</span>
                           <span className="text-[10px] font-bold text-slate-400">{new Date(act.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        {act.status === 'SUCCESS' ? (
                          <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                             <CheckCircle2 className="h-4 w-4" /> Cleared
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-rose-600 font-black text-[10px] uppercase tracking-widest">
                             <AlertCircle className="h-4 w-4" /> Breach/Denied
                          </div>
                        )}
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">
                            {act.deviceName || (act.browser ? `${act.browser} on ${act.os}` : 'Device')}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {act.deviceType || 'DESKTOP'}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
                          {act.ipAddress || 'LOCAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

