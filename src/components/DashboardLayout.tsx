import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PlusCircle, 
  Settings, 
  LogOut, 
  Bell, 
  Menu, 
  X, 
  ClipboardList, 
  Package, 
  HelpCircle, 
  BarChart3, 
  Plus, 
  ShieldAlert, 
  ShieldCheck, 
  Tag, 
  Layers, 
  CheckCheck, 
  BatteryCharging, 
  Briefcase, 
  UserCheck, 
  Truck, 
  FileWarning,
  Wrench,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { format } from 'date-fns';
import { useRealtimeSync } from '@/services/realtime';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  const [pendingAttendanceCount, setPendingAttendanceCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/notifications');
      const list = Array.isArray(data) ? data : (data?.notifications || []);
      const count = typeof data?.unreadCount === 'number' 
        ? data.unreadCount 
        : list.filter((n: any) => !n.isRead && !n.read).length;
      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const fetchPendingAccessCount = async () => {
    if (user?.role !== 'SUPER_ADMIN') return;
    try {
      const data: any = await api.get('/access-requests');
      const list = Array.isArray(data) ? data : (data?.requests || []);
      const count = list.filter((r: any) => r.status === 'PENDING').length;
      setPendingAccessCount(count);
    } catch (err) {
      // silently ignore
    }
  };

  const fetchPendingAttendance = async () => {
    if (!user) return;
    try {
      const data: any = await api.get('/attendance/pending-requests');
      const list = Array.isArray(data) ? data : (data?.pendingRequests || data?.requests || []);
      setPendingAttendanceCount(list.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchPendingAccessCount();
    fetchPendingAttendance();
  }, [user?.role]);

  // Real-time synchronization across devices for notifications, access requests and attendance
  useRealtimeSync(
    ['notification', 'accessRequest', 'repair', 'user', 'attendance'],
    (event) => {
      fetchNotifications();
      fetchPendingAccessCount();
      fetchPendingAttendance();
    }
  );

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read', {});
      setNotifications(prev => (Array.isArray(prev) ? prev.map(n => ({ ...n, isRead: true, read: true })) : []));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (item: any) => {
    if (item.link) {
      navigate(item.link);
    } else if (item.repairId) {
      navigate(`/dashboard/repairs/${item.repairId}`);
    } else if (item.type === 'TRANSFER_REQUEST' && (user?.role === 'TECHNICIAN' || user?.role === 'HEAD_TECHNICIAN' || user?.role === 'LEAD_TECHNICIAN')) {
      navigate('/dashboard');
    }

    const isUnread = !item.isRead && !item.read;
    if (isUnread) {
      try {
        await api.post(`/notifications/${item.id}/read`, {});
        setNotifications(prev => (Array.isArray(prev) ? prev.map(n => n.id === item.id ? { ...n, isRead: true, read: true } : n) : []));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Authoritative role styling & labels
  const getRoleDetails = (role?: string) => {
    const r = (role || '').toUpperCase();
    switch (r) {
      case 'SUPER_ADMIN':
        return {
          label: 'Super Admin',
          workspace: 'Super Admin Workspace',
          badgeClass: 'bg-slate-900 text-white border-slate-700',
          dotClass: 'bg-emerald-400',
          icon: ShieldAlert
        };
      case 'ADMIN':
        return {
          label: 'Admin',
          workspace: 'Administrative Command',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dotClass: 'bg-indigo-500',
          icon: ShieldCheck
        };
      case 'MANAGER':
        return {
          label: 'Manager',
          workspace: 'Operations Control Hub',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
          icon: Briefcase
        };
      case 'HEAD_TECHNICIAN':
        return {
          label: 'Head Technician',
          workspace: 'Master Bench & QA',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
          dotClass: 'bg-blue-500',
          icon: Wrench
        };
      case 'LEAD_TECHNICIAN':
        return {
          label: 'Lead Technician',
          workspace: 'Lead Technician Bench',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
          dotClass: 'bg-blue-500',
          icon: Wrench
        };
      case 'TECHNICIAN':
      case 'TECHNICAL_ASSISTANT':
        return {
          label: 'Technician',
          workspace: 'Diagnostic & Repair Bench',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-500',
          icon: Wrench
        };
      case 'RECEPTIONIST':
        return {
          label: 'Receptionist',
          workspace: 'Front-Desk & Intake Hub',
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
          dotClass: 'bg-teal-500',
          icon: UserCheck
        };
      case 'ACCOUNTANT':
        return {
          label: 'Accountant',
          workspace: 'Finance & Invoicing Hub',
          badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          dotClass: 'bg-cyan-500',
          icon: BarChart3
        };
      case 'INVENTORY_MANAGER':
        return {
          label: 'Inventory Manager',
          workspace: 'Parts Catalog & Stock Hub',
          badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
          dotClass: 'bg-violet-500',
          icon: Package
        };
      default:
        return {
          label: (role || 'Staff').replace(/_/g, ' '),
          workspace: 'MTS Lab Workspace',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
          dotClass: 'bg-emerald-500',
          icon: Briefcase
        };
    }
  };

  const roleInfo = getRoleDetails(user?.role);
  const RoleIcon = roleInfo.icon;

  const navItems = [
    { name: user?.role === 'MANAGER' ? 'Manager Hub' : 'Overview', path: '/dashboard', icon: user?.role === 'MANAGER' ? Briefcase : LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER', 'TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN'] },
    { name: 'Repairs', path: '/dashboard/repairs', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN'] },
    { name: 'New Repair', path: '/dashboard/repairs/new', icon: PlusCircle, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { name: 'Courier Hub', path: '/dashboard/courier', icon: Truck, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { name: 'Battery Warranty Hub', path: '/dashboard/battery-warranty', icon: BatteryCharging, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { name: 'Services & Repair Prices', path: '/dashboard/repair-prices', icon: Tag, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Slideshow CMS', path: '/dashboard/slides', icon: Layers, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Inventory Hub', path: '/dashboard/inventory', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER'] },
    { name: 'Attendance', path: '/dashboard/attendance', icon: UserCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT'] },
    { name: 'Repair-Related Damage', path: '/dashboard/repair-damage', icon: FileWarning, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST'] },
    { name: 'Staff Management', path: '/dashboard/staff', icon: Users, roles: ['SUPER_ADMIN'] },
    { name: 'Security & Surveillance', path: '/dashboard/security-surveillance', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
    { name: 'Revenue Hub', path: '/dashboard/revenue', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'LEAD_TECHNICIAN'] },
    { name: 'Super Admin', path: '/dashboard/super-admin', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'INVENTORY_MANAGER', 'ACCOUNTANT'] },
  ].filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden transition-all duration-300" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/70 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 shadow-2xl md:shadow-none flex flex-col shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Sidebar Logo */}
          <div className="flex items-center justify-between h-16 sm:h-20 px-6 border-b border-slate-100/80 shrink-0">
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-950 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shadow-slate-950/20 shrink-0">
                M
              </div>
              <div className="min-w-0">
                <span className="text-base font-black tracking-tight text-slate-900 block truncate">MTS LAB</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block -mt-0.5 truncate">Repair Systems</span>
              </div>
            </NavLink>
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden rounded-lg h-9 w-9 text-slate-500 hover:bg-slate-100 shrink-0 cursor-pointer" 
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 px-3 sm:px-4 py-3.5 space-y-1 overflow-y-auto">
            <div className="px-3 mb-2">
               <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Management Core</p>
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) => cn(
                  "flex items-center justify-between px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all group min-h-[40px]",
                  isActive 
                    ? "bg-slate-950 text-white shadow-md shadow-slate-950/15 font-extrabold" 
                    : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-950"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </span>
                {item.name === 'Access Requests' && pendingAccessCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black rounded-full bg-rose-500 text-white shadow-xs animate-pulse shrink-0">
                    {pendingAccessCount}
                  </span>
                )}
                {item.name === 'Attendance' && pendingAttendanceCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black rounded-full bg-amber-500 text-white shadow-xs animate-pulse shrink-0">
                    {pendingAttendanceCount}
                  </span>
                )}
                {item.path.includes('new') && (
                  <Plus className="h-4 w-4 opacity-40 shrink-0" />
                )}
              </NavLink>
            ))}
          </nav>

          {/* Sidebar User Profile Bottom Box */}
          <div className="p-3.5 sm:p-4 shrink-0 border-t border-slate-100">
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-2.5 min-w-0">
                <Avatar className="h-9 w-9 border border-white shadow-xs font-bold overflow-hidden rounded-lg shrink-0">
                  {user?.profileImage ? (
                    <AvatarImage src={user.profileImage} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-slate-950 text-white text-[11px] font-black">
                    {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate tracking-tight">{user?.name || 'Staff User'}</p>
                  <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 rounded-md truncate max-w-full inline-flex items-center gap-1", roleInfo.badgeClass)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", roleInfo.dotClass)} />
                    <span className="truncate">{roleInfo.label}</span>
                  </Badge>
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-9 min-h-[36px] rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs gap-2 px-2.5 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Log Out</span>
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white md:m-2 lg:m-3 md:rounded-2xl lg:rounded-3xl md:shadow-md md:shadow-slate-200/50 border-l border-slate-200/40 overflow-hidden relative">
        
        {/* Dynamic Responsive Role-Aware Dashboard Header */}
        <header className="h-16 sm:h-18 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-20 gap-2 sm:gap-4">
          
          {/* Left: Mobile Navigation Toggle + Role / Workspace Breadcrumb */}
          <div className="flex items-center min-w-0 gap-2 sm:gap-3 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden rounded-lg h-9 w-9 text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Mobile Header Brand */}
            <NavLink to="/dashboard" className="md:hidden flex items-center gap-1.5 font-black text-slate-900 tracking-tight text-sm select-none shrink-0">
              <span className="bg-slate-950 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-black">M</span>
              <span className="font-extrabold">MTS<span className="text-slate-500 font-semibold ml-0.5">Lab</span></span>
            </NavLink>

            {/* Role indicator pill on mobile */}
            <div className="md:hidden">
              <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1", roleInfo.badgeClass)}>
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", roleInfo.dotClass)} />
                <span className="truncate max-w-[100px]">{roleInfo.label}</span>
              </Badge>
            </div>

            {/* Desktop Authoritative Role Workspace Context */}
            <div className="hidden md:flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-xl shrink-0">
                <RoleIcon className="w-4 h-4 text-slate-700 shrink-0" />
                <Badge variant="outline" className={cn("text-xs font-black uppercase tracking-wide px-2 py-0.5 rounded-lg border", roleInfo.badgeClass)}>
                  {roleInfo.label}
                </Badge>
              </div>
              
              <span className="text-slate-300 hidden lg:inline">•</span>
              
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium min-w-0">
                <span className="font-bold text-slate-800 truncate">{roleInfo.workspace}</span>
              </div>
            </div>
          </div>

          {/* Right: Notification Bell & User Account Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Notification Bell Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`View notifications (${unreadCount} unread)`}
                className="outline-none relative rounded-xl h-9 w-9 sm:h-10 sm:w-10 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              >
                <Bell className="h-4 w-4 text-slate-700 shrink-0" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white rounded-full border-2 border-white shadow-xs flex items-center justify-center text-[9px] font-black leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              
              <DropdownMenuContent 
                className="w-[calc(100vw-24px)] max-w-sm sm:w-96 rounded-2xl p-0 shadow-2xl border-slate-200 overflow-hidden" 
                align="end"
                sideOffset={8}
              >
                <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-50 border-b border-slate-100">
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                          {unreadCount}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] font-medium text-slate-400">
                      {unreadCount === 0 ? 'No new unread alerts' : `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleMarkAllRead}
                      className="h-7 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>Mark read</span>
                    </Button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {!Array.isArray(notifications) || notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CircleCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                      <p className="text-xs sm:text-sm font-semibold text-slate-700">All caught up!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No notifications recorded in your queue.</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.isRead && !n.read;
                      return (
                        <div 
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            "p-3 sm:p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-2.5 sm:gap-3",
                            isUnread && "bg-indigo-50/40"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0 mt-1.5",
                            isUnread ? "bg-indigo-600" : "bg-transparent"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-xs font-extrabold text-slate-900 truncate">{n.title}</p>
                              {n.createdAt && (
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                  {format(new Date(n.createdAt), 'dd MMM • HH:mm')}
                                </span>
                              )}
                            </div>
                            {n.priority && (
                              <span className={cn(
                                "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md mb-1",
                                n.priority === 'URGENT' && "bg-rose-100 text-rose-700",
                                n.priority === 'HIGH' && "bg-amber-100 text-amber-700",
                                n.priority === 'MEDIUM' && "bg-yellow-100 text-yellow-700",
                                n.priority === 'NORMAL' && "bg-slate-100 text-slate-600"
                              )}>
                                {n.priority === 'URGENT' ? '🔴' : n.priority === 'HIGH' ? '🟠' : n.priority === 'MEDIUM' ? '🟡' : '⚪'} {n.priority}
                              </span>
                            )}
                            <p className="text-xs text-slate-600 font-medium line-clamp-2">{n.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {user?.role === 'SUPER_ADMIN' && (
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <Button 
                      variant="ghost" 
                      onClick={() => navigate('/dashboard/super-admin')}
                      className="w-full h-8 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <span>Super Admin Hub</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop User Account Control Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="User Account Menu"
                className="outline-none flex items-center gap-2 p-1 sm:p-1.5 sm:pr-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="relative">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-white shadow-xs font-bold overflow-hidden rounded-lg shrink-0">
                    {user?.profileImage ? (
                      <AvatarImage src={user.profileImage} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-slate-900 text-white font-extrabold text-[10px] sm:text-xs">
                      {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shrink-0", roleInfo.dotClass)} />
                </div>
                
                {/* Name and Role on Desktop */}
                <div className="hidden sm:flex flex-col items-start text-left min-w-0 max-w-[120px] md:max-w-[150px]">
                  <span className="text-xs font-extrabold text-slate-900 truncate w-full leading-tight">
                    {user?.name || 'Staff User'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate w-full leading-none mt-0.5">
                    {roleInfo.label}
                  </span>
                </div>

                <ChevronDown className="hidden sm:inline h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              </DropdownMenuTrigger>

              <DropdownMenuContent 
                className="w-64 rounded-2xl p-2 shadow-2xl border-slate-200" 
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-2.5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{user?.name || 'Staff User'}</p>
                        <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 rounded-md shrink-0", roleInfo.badgeClass)}>
                          {roleInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-400 truncate" title={user?.email || ''}>
                        {user?.email || 'No email provided'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup className="p-1 space-y-0.5">
                  <DropdownMenuItem 
                    onClick={() => navigate('/dashboard/settings')} 
                    className="rounded-xl h-9 px-2.5 font-bold text-xs gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                  
                  {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT'].includes(user?.role || '') && (
                    <DropdownMenuItem 
                      onClick={() => navigate('/dashboard/attendance')} 
                      className="rounded-xl h-9 px-2.5 font-bold text-xs gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>Attendance Hub</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem 
                    onClick={() => navigate('/#contact')} 
                    className="rounded-xl h-9 px-2.5 font-bold text-xs gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>Help & Support</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="rounded-xl h-9 px-2.5 font-bold text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700 gap-2.5 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span>Log Out System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </header>

        {/* Viewport Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7 xl:p-8 min-w-0 w-full">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
