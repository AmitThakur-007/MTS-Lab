import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Smartphone, 
  Users, 
  PlusCircle, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
  Package,
  HelpCircle,
  BarChart3,
  SearchIcon,
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
import { Wifi, Radio } from 'lucide-react';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  const [pendingAttendanceCount, setPendingAttendanceCount] = useState(0);
  const navigate = useNavigate();

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
      const data = await api.get('/access-requests');
      if (Array.isArray(data)) {
        const count = data.filter((r: any) => r.status === 'PENDING').length;
        setPendingAccessCount(count);
      }
    } catch (err) {
      // silently ignore
    }
  };

  const fetchPendingAttendance = async () => {
    if (!user) return;
    try {
      const data = await api.get('/attendance/pending-requests');
      if (Array.isArray(data)) {
        setPendingAttendanceCount(data.length);
      }
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
    } else if (item.type === 'TRANSFER_REQUEST' && user?.role === 'TECHNICIAN') {
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

  const navItems = [
    { name: user?.role === 'MANAGER' ? 'Manager Hub' : 'Overview', path: '/dashboard', icon: user?.role === 'MANAGER' ? Briefcase : LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'INVENTORY_MANAGER', 'TECHNICIAN'] },
    { name: 'Repairs', path: '/dashboard/repairs', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'TECHNICIAN'] },
    { name: 'Customer Hub', path: '/dashboard/customers', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'] },
    { name: 'New Repair', path: '/dashboard/repairs/new', icon: PlusCircle, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { name: 'Courier Hub', path: '/dashboard/courier', icon: Truck, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { name: 'Battery Warranty Hub', path: '/dashboard/battery-warranty', icon: BatteryCharging, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { name: 'Services & Repair Prices', path: '/dashboard/repair-prices', icon: Tag, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Slideshow CMS', path: '/dashboard/slides', icon: Layers, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Inventory Hub', path: '/dashboard/inventory', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER'] },
    { name: 'Attendance', path: '/dashboard/attendance', icon: UserCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT'] },
    { name: 'Repair-Related Damage', path: '/dashboard/repair-damage', icon: FileWarning, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'LEAD_TECHNICIAN', 'RECEPTIONIST'] },
    { name: 'Staff Management', path: '/dashboard/staff', icon: Users, roles: ['SUPER_ADMIN'] },
    { name: 'Access Requests', path: '/dashboard/access-requests', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
    { name: 'Revenue Hub', path: '/dashboard/revenue', icon: BarChart3, roles: ['SUPER_ADMIN', 'ACCOUNTANT'] },
    { name: 'Super Admin', path: '/dashboard/super-admin', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'RECEPTIONIST', 'INVENTORY_MANAGER', 'ACCOUNTANT'] },
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
          <div className="flex items-center justify-between h-20 sm:h-24 px-6 sm:px-8 border-b border-slate-100/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-black/20 shrink-0">
                M
              </div>
              <div className="min-w-0">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 block truncate">MTS LAB</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block -mt-1 truncate">Repair Systems</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden rounded-full h-10 w-10 text-slate-500 hover:bg-slate-100 shrink-0 cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 px-3.5 sm:px-4 py-4 space-y-1 overflow-y-auto">
            <div className="px-3 mb-2">
               <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Management Core</p>
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) => cn(
                  "flex items-center justify-between px-3.5 py-3 text-xs sm:text-sm font-bold rounded-2xl transition-all group min-h-[44px]",
                  isActive 
                    ? "bg-slate-950 text-white shadow-lg shadow-black/15 font-extrabold" 
                    : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-950"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </span>
                {item.name === 'Access Requests' && pendingAccessCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black rounded-full bg-rose-500 text-white shadow-xs animate-pulse">
                    {pendingAccessCount}
                  </span>
                )}
                {item.name === 'Attendance' && pendingAttendanceCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black rounded-full bg-amber-500 text-white shadow-xs animate-pulse">
                    {pendingAttendanceCount}
                  </span>
                )}
                {item.path.includes('new') && (
                  <Plus className="h-4 w-4 opacity-40 shrink-0" />
                )}
              </NavLink>
            ))}
          </nav>

          {/* User Profile Area */}
          <div className="p-4 sm:p-5 shrink-0 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/60 shadow-xs">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10 sm:h-11 sm:h-11 border-2 border-white shadow-md ring-1 ring-slate-100 font-bold overflow-hidden rounded-xl shrink-0">
                  {user?.profileImage ? (
                    <AvatarImage src={user.profileImage} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-slate-950 text-white text-xs font-black">
                    {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate tracking-tight">{user?.name || 'Staff User'}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 truncate">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                    <span className="truncate">{user?.role ? user.role.replace(/_/g, ' ') : 'Staff'}</span>
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-10 sm:h-11 min-h-[44px] rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs gap-2.5 px-3 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Log Out System</span>
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white md:m-2.5 lg:m-4 md:rounded-[36px] lg:rounded-[44px] md:shadow-xl md:shadow-slate-200/40 border-l border-slate-200/40 overflow-hidden relative">
        <header className="h-20 sm:h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 shrink-0 z-20 gap-3">
          <div className="flex items-center flex-1 min-w-0 gap-3">
            <Button variant="ghost" size="icon" className="md:hidden rounded-xl h-10 w-10 text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="max-w-xs sm:max-w-sm lg:max-w-md w-full relative hidden sm:block">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search repairs, customers, serials..." 
                className="w-full bg-slate-50/90 border border-slate-200/70 rounded-xl h-10 pl-10 pr-3.5 text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Global Refresh Button */}
            <DashboardRefreshButton 
              size="sm"
              variant="outline"
              label="Refresh"
              refreshingLabel="Refreshing..."
              onRefresh={async () => {
                await fetchNotifications();
                await fetchPendingAccessCount();
              }}
            />

            {/* Notification Bell Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none relative rounded-xl h-10 w-10 sm:h-11 sm:w-11 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center transition-all cursor-pointer shadow-2xs">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-slate-800" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white rounded-full border-2 border-white shadow-xs flex items-center justify-center text-[9px] font-black">
                    {unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-32px)] max-w-sm sm:w-96 rounded-2xl p-0 shadow-2xl border-slate-200 overflow-hidden" align="end">
                <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">Notifications</h4>
                    <p className="text-[11px] font-bold text-slate-400">{unreadCount} unread alerts</p>
                  </div>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleMarkAllRead}
                      className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:bg-indigo-50 cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark read
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {!Array.isArray(notifications) || notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.isRead && !n.read;
                      return (
                        <div 
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            "p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3",
                            isUnread && "bg-indigo-50/40"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0 mt-1.5",
                            isUnread ? "bg-indigo-600" : "bg-transparent"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-extrabold text-slate-900 truncate">{n.title}</p>
                            <p className="text-xs text-slate-600 font-medium line-clamp-2 mt-0.5">{n.message}</p>
                            <span className="text-[10px] text-slate-400 font-bold block mt-1">
                              {n.createdAt ? format(new Date(n.createdAt), 'dd MMM • HH:mm') : ''}
                            </span>
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
                      onClick={() => navigate('/dashboard/access-requests')}
                      className="w-full h-8 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      View All Access Requests
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="h-8 w-px bg-slate-200/80 mx-0.5 hidden sm:block" />

            {/* Profile Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none cursor-pointer">
                <Avatar className="h-10 w-10 sm:h-11 sm:w-11 border border-slate-200 shadow-xs transform hover:scale-105 transition-transform overflow-hidden rounded-xl">
                  {user?.profileImage ? (
                    <AvatarImage src={user.profileImage} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-slate-100 font-extrabold text-slate-700 text-xs">
                    {user?.name ? user.name[0].toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60 sm:w-64 rounded-2xl p-2 shadow-2xl border-slate-200" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-3">
                    <div className="flex flex-col space-y-0.5">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{user?.name}</p>
                      <p className="text-xs font-medium text-slate-400 truncate">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup className="p-1 space-y-0.5">
                  <DropdownMenuItem onClick={() => navigate('/dashboard/settings')} className="rounded-xl h-10 px-3 font-bold text-xs gap-2 cursor-pointer">
                    <Settings className="h-3.5 w-3.5 text-slate-500" /> Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/#contact')} className="rounded-xl h-10 px-3 font-bold text-xs gap-2 cursor-pointer">
                    <HelpCircle className="h-3.5 w-3.5 text-slate-500" /> Help & Support
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="rounded-xl h-10 px-3 font-bold text-xs text-rose-600 focus:bg-rose-50 gap-2 cursor-pointer">
                  <LogOut className="h-3.5 w-3.5" /> Log Out System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Viewport Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
