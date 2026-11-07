import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Wrench, 
  Users, 
  Package, 
  Smartphone, 
  Truck, 
  BatteryCharging, 
  ClipboardList, 
  PlusCircle, 
  LayoutDashboard, 
  Settings, 
  Moon, 
  Sun, 
  LogOut, 
  ArrowRight, 
  Command, 
  UserCheck, 
  BarChart3, 
  Layers, 
  ShieldAlert, 
  ShieldCheck,
  Tag,
  Loader2,
  FileWarning
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppTheme } from '@/context/ThemeContext';
import { api } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Quick Actions' | 'Repairs' | 'Customers';
  title: string;
  subtitle?: string;
  icon: any;
  action: () => void;
  keywords?: string[];
  roles?: string[];
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { user, logout } = useAuthStore();
  const { effectiveTheme, setUserPreference } = useAppTheme();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [asyncResults, setAsyncResults] = useState<CommandItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, 250);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setAsyncResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global keyboard listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const userRole = user?.role || '';
  const isTechnician = ['TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN', 'TECHNICAL_ASSISTANT'].includes(userRole);

  // Static Navigation Items filtered by user role
  const staticNavigationItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-overview',
        category: 'Navigation',
        title: userRole === 'MANAGER' ? 'Manager Hub' : 'Overview Dashboard',
        subtitle: 'Key metrics, technician workload & daily diagnostic summary',
        icon: LayoutDashboard,
        action: () => navigate(isTechnician ? '/technician/overview' : '/dashboard'),
        keywords: ['home', 'stats', 'analytics', 'kpi'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'ACCOUNTANT'],
      },
      {
        id: 'nav-repairs',
        category: 'Navigation',
        title: 'Repair Workorders',
        subtitle: 'Active workshop queue, device diagnoses and status logs',
        icon: isTechnician ? Wrench : ClipboardList,
        action: () => navigate(isTechnician ? '/technician/repairs' : '/dashboard/repairs'),
        keywords: ['repairs', 'workorders', 'devices', 'queue', 'status'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN'],
      },
      {
        id: 'nav-new-repair',
        category: 'Navigation',
        title: 'New Repair Intake',
        subtitle: 'Create customer ticket, intake device details and initial quote',
        icon: PlusCircle,
        action: () => navigate('/dashboard/repairs/new'),
        keywords: ['create', 'new', 'intake', 'ticket', 'device'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        id: 'nav-technician-manager',
        category: 'Navigation',
        title: 'Technician Manager',
        subtitle: 'Workshop repair assignments, bench workload and priority levels',
        icon: Wrench,
        action: () => navigate('/dashboard/technician-manager'),
        keywords: ['assign', 'technicians', 'priority', 'workshop', 'bench'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
      },
      {
        id: 'nav-customer-hub',
        category: 'Navigation',
        title: 'Customer Hub',
        subtitle: 'Customer profiles, repair histories and contact directory',
        icon: Users,
        action: () => navigate('/dashboard/customers'),
        keywords: ['clients', 'profiles', 'phone', 'contact', 'users'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        id: 'nav-sms-center',
        category: 'Navigation',
        title: 'SMS Center',
        subtitle: 'Automated repair notifications, WhatsApp templates and dispatch',
        icon: Smartphone,
        action: () => navigate('/dashboard/sms-center'),
        keywords: ['sms', 'messages', 'whatsapp', 'alerts', 'notifications'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        id: 'nav-sms-reports',
        category: 'Navigation',
        title: 'SMS Reports & Delivery Analytics',
        subtitle: 'Carrier delivery logs, staff confirmations and carrier logs',
        icon: Smartphone,
        action: () => navigate('/dashboard/sms-reports'),
        keywords: ['delivery', 'carrier', 'sms analytics', 'logs'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        id: 'nav-courier',
        category: 'Navigation',
        title: 'Courier & Logistics Hub',
        subtitle: 'Incoming and outgoing parcel dispatches across Nepal',
        icon: Truck,
        action: () => navigate('/dashboard/courier'),
        keywords: ['delivery', 'shipping', 'parcel', 'logistics'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        id: 'nav-battery-warranty',
        category: 'Navigation',
        title: 'Battery Warranty Hub',
        subtitle: 'MTS-certified battery warranties, OTP claims and certificates',
        icon: BatteryCharging,
        action: () => navigate('/dashboard/battery-warranty'),
        keywords: ['battery', 'warranty', 'certificates', 'guarantee'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        id: 'nav-inventory',
        category: 'Navigation',
        title: 'Inventory & Parts Stock',
        subtitle: 'Component stock levels, display units and procurement',
        icon: Package,
        action: () => navigate('/dashboard/inventory'),
        keywords: ['parts', 'stock', 'screens', 'catalog', 'products'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'INVENTORY_MANAGER'],
      },
      {
        id: 'nav-attendance',
        category: 'Navigation',
        title: 'Staff Attendance & Roster',
        subtitle: 'Daily check-in logs, biometric clock and roster verification',
        icon: UserCheck,
        action: () => navigate('/dashboard/attendance'),
        keywords: ['clock in', 'roster', 'check in', 'hr', 'timesheet'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'ACCOUNTANT'],
      },
      {
        id: 'nav-repair-damage',
        category: 'Navigation',
        title: 'Repair-Related Damage QA',
        subtitle: 'Pre-existing condition inspections, QC incident reports',
        icon: FileWarning,
        action: () => navigate('/dashboard/repair-damage'),
        keywords: ['damage', 'qc', 'inspection', 'scratches', 'quality'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN'],
      },
      {
        id: 'nav-prices',
        category: 'Navigation',
        title: 'Services & Repair Prices',
        subtitle: 'Public and workshop repair pricing tariffs by phone model',
        icon: Tag,
        action: () => navigate('/dashboard/repair-prices'),
        keywords: ['pricing', 'rate', 'screen cost', 'battery cost'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'],
      },
      {
        id: 'nav-revenue',
        category: 'Navigation',
        title: 'Revenue & Finance Hub',
        subtitle: 'Daily repair turnover, payment methods and gross profit',
        icon: BarChart3,
        action: () => navigate('/dashboard/revenue'),
        keywords: ['revenue', 'accounting', 'profit', 'sales', 'cash'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'LEAD_TECHNICIAN'],
      },
      {
        id: 'nav-slides',
        category: 'Navigation',
        title: 'Slideshow CMS',
        subtitle: 'Hero homepage visual banners, promotions and announcements',
        icon: Layers,
        action: () => navigate('/dashboard/slides'),
        keywords: ['slides', 'banners', 'carousel', 'cms'],
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        id: 'nav-staff',
        category: 'Navigation',
        title: 'Staff Management',
        subtitle: 'User accounts, role provisioning and system privileges',
        icon: Users,
        action: () => navigate('/dashboard/staff'),
        keywords: ['staff', 'users', 'roles', 'technicians', 'employees'],
        roles: ['SUPER_ADMIN'],
      },
      {
        id: 'nav-security',
        category: 'Navigation',
        title: 'Security & Surveillance',
        subtitle: 'Approved workstation devices, login audit and access approvals',
        icon: ShieldCheck,
        action: () => navigate('/dashboard/security-surveillance'),
        keywords: ['security', 'devices', 'login audit', 'surveillance'],
        roles: ['SUPER_ADMIN'],
      },
      {
        id: 'nav-super-admin',
        category: 'Navigation',
        title: 'Super Admin Audit Console',
        subtitle: 'Comprehensive audit trails, data safety and applet share history',
        icon: ShieldAlert,
        action: () => navigate('/dashboard/super-admin'),
        keywords: ['audit logs', 'database', 'shares', 'system'],
        roles: ['SUPER_ADMIN'],
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Account Settings',
        subtitle: 'Profile information, security credentials and preferences',
        icon: Settings,
        action: () => navigate('/dashboard/settings'),
        keywords: ['profile', 'password', 'theme', 'config'],
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'ACCOUNTANT', 'INVENTORY_MANAGER'],
      },
    ];

    return items.filter((item) => !item.roles || item.roles.includes(userRole));
  }, [userRole, isTechnician, navigate]);

  // Static Quick Actions
  const staticActionItems: CommandItem[] = useMemo(() => {
    return [
      {
        id: 'act-theme',
        category: 'Quick Actions',
        title: `Switch Theme (Currently: ${effectiveTheme.toUpperCase()})`,
        subtitle: 'Toggle between Dark Mode and Light Mode',
        icon: effectiveTheme === 'dark' ? Sun : Moon,
        action: () => setUserPreference(effectiveTheme === 'dark' ? 'light' : 'dark'),
        keywords: ['theme', 'dark', 'light', 'mode'],
      },
      {
        id: 'act-track',
        category: 'Quick Actions',
        title: 'Open Public Repair Tracker',
        subtitle: 'Check customer repair progress on public tracking portal',
        icon: Search,
        action: () => navigate('/track'),
        keywords: ['track', 'portal', 'search device'],
      },
      {
        id: 'act-logout',
        category: 'Quick Actions',
        title: 'Sign Out of MTS Lab',
        subtitle: 'Safely end session on this terminal',
        icon: LogOut,
        action: () => {
          logout();
          navigate('/login');
        },
        keywords: ['logout', 'signout', 'exit'],
      },
    ];
  }, [effectiveTheme, setUserPreference, navigate, logout]);

  // Live Async Search for Repairs & Customers
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || q.length < 2) {
      setAsyncResults([]);
      setIsSearching(false);
      return;
    }

    let isSubscribed = true;
    setIsSearching(true);

    const fetchAsyncData = async () => {
      try {
        const canViewRepairs = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN'].includes(userRole);
        const canViewCustomers = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(userRole);

        const repairPromise = canViewRepairs
          ? api.get(`/repairs?search=${encodeURIComponent(q)}&limit=5`).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const customerPromise = canViewCustomers
          ? api.get(`/customers?search=${encodeURIComponent(q)}&limit=5`).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const [repairsRes, customersRes] = await Promise.all([repairPromise, customerPromise]);

        if (!isSubscribed) return;

        const results: CommandItem[] = [];

        // Map repairs
        const repairList = Array.isArray(repairsRes) ? repairsRes : (repairsRes?.data || repairsRes?.repairs || []);
        repairList.slice(0, 4).forEach((r: any) => {
          results.push({
            id: `repair-${r.id}`,
            category: 'Repairs',
            title: `${r.repairNumber || 'Repair'} — ${r.deviceBrand || ''} ${r.deviceModel || ''}`,
            subtitle: `Customer: ${r.customerName || r.customer?.name || 'Unknown'} · Status: ${r.status || 'Received'}`,
            icon: Wrench,
            action: () => navigate(`/dashboard/repairs/${r.id}`),
          });
        });

        // Map customers
        const customerList = Array.isArray(customersRes) ? customersRes : (customersRes?.data || customersRes?.customers || []);
        customerList.slice(0, 3).forEach((c: any) => {
          results.push({
            id: `customer-${c.id}`,
            category: 'Customers',
            title: `${c.name || 'Customer'} · ${c.phone || ''}`,
            subtitle: `Customer ID: ${c.customerId || c.id?.slice(0, 8)} · ${c.email || 'Pakosadak, Kathmandu'}`,
            icon: Users,
            action: () => navigate(`/dashboard/customers/${c.id}`),
          });
        });

        setAsyncResults(results);
      } catch {
        if (isSubscribed) setAsyncResults([]);
      } finally {
        if (isSubscribed) setIsSearching(false);
      }
    };

    fetchAsyncData();

    return () => {
      isSubscribed = false;
    };
  }, [debouncedQuery, userRole, navigate]);

  // Combine and filter results
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matchesQuery = (item: CommandItem) => {
      if (!q) return true;
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.subtitle?.toLowerCase().includes(q)) return true;
      if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    };

    const navMatches = staticNavigationItems.filter(matchesQuery);
    const actionMatches = staticActionItems.filter(matchesQuery);

    return [...asyncResults, ...navMatches, ...actionMatches];
  }, [query, staticNavigationItems, staticActionItems, asyncResults]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onOpenChange(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search repairs, customers, or modules..."
            className="flex-1 bg-transparent border-0 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm sm:text-base font-medium"
          />
          {isSearching && (
            <Loader2 className="w-4 h-4 text-cyan-500 animate-spin shrink-0" />
          )}
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[10px] font-mono text-slate-500 font-bold">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="p-2 sm:p-3 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40 max-h-[60vh]"
        >
          {filteredItems.length === 0 ? (
            <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
              <Command className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No matching commands, repairs or customers found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === index;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-colors group select-none',
                    isSelected 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                        isSelected
                          ? 'bg-slate-800 text-cyan-400 dark:bg-slate-100 dark:text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {item.title}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.2 rounded-md',
                            isSelected
                              ? 'bg-slate-800 text-slate-300 dark:bg-slate-200 dark:text-slate-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          )}
                        >
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p
                          className={cn(
                            'text-[11px] truncate mt-0.5',
                            isSelected
                              ? 'text-slate-300 dark:text-slate-600'
                              : 'text-slate-500 dark:text-slate-400'
                          )}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={cn(
                      'w-4 h-4 shrink-0 transition-transform',
                      isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'
                    )}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="hidden sm:inline font-sans text-slate-400 text-[10px]">
            MTS LAB Command Center
          </span>
        </div>
      </div>
    </div>
  );
}
