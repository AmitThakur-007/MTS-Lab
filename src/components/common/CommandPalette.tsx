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
  FileWarning,
  ArrowLeft,
  X
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const hasPushedHistoryRef = useRef(false);
  const isClosingRef = useRef(false);

  // Safe close handler that restores history and page state cleanly
  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (hasPushedHistoryRef.current && window.history.state?.mtsCommandCenter) {
      hasPushedHistoryRef.current = false;
      window.history.back();
    } else {
      onOpenChange(false);
    }
  };

  // Safe item selection handler that replaces transient state and navigates
  const handleSelectItem = (item: CommandItem) => {
    if (hasPushedHistoryRef.current && window.history.state?.mtsCommandCenter) {
      hasPushedHistoryRef.current = false;
      window.history.replaceState({ ...window.history.state, mtsCommandCenter: undefined }, '');
    }
    onOpenChange(false);
    item.action();
  };

  // Backdrop click handler that closes only when clicking the outside backdrop overlay
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Focus input and save previous active element on open; restore focus on close
  useEffect(() => {
    if (open) {
      isClosingRef.current = false;
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setSelectedIndex(0);
      setAsyncResults([]);

      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);

      // Lock body scroll while modal is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [open]);

  // Synchronize browser history & hardware back button handling
  useEffect(() => {
    if (open) {
      window.history.pushState({ ...window.history.state, mtsCommandCenter: true }, '');
      hasPushedHistoryRef.current = true;

      const handlePopState = () => {
        hasPushedHistoryRef.current = false;
        onOpenChange(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [open, onOpenChange]);

  // Global keyboard listener for Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (open) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onOpenChange]);

  // Automatically scroll selected item into view inside list
  useEffect(() => {
    if (listRef.current) {
      const selectedElem = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (selectedElem) {
        selectedElem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

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
        handleSelectItem(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-start sm:pt-14 md:pt-20 sm:px-4 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Quick Search Command Center"
    >
      <div 
        className={cn(
          "w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all",
          // Mobile smartphones: full screen, edge-to-edge, dynamic viewport height
          "h-full max-h-[100dvh] rounded-none border-0",
          // Tablets, iPads, Laptops, Desktops: centered modal with balanced max-width and max-height
          "sm:h-auto sm:max-h-[82vh] sm:max-w-2xl md:max-w-3xl sm:rounded-3xl sm:border sm:border-slate-200 dark:sm:border-slate-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-3 px-3 sm:py-3.5 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 sm:gap-3 bg-slate-50/90 dark:bg-slate-950/60 shrink-0">
          {/* Search Icon Badge */}
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>

          {/* Search Input */}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search repairs, customers, or modules..."
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm sm:text-base font-medium"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label="Search command, repairs, customers, or modules"
          />

          {/* Clear query button */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              title="Clear search text"
              aria-label="Clear search text"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Live async search loading indicator */}
          {isSearching && (
            <Loader2 className="w-4 h-4 text-cyan-500 animate-spin shrink-0" />
          )}

          {/* Visible, Clickable Back / Cancel Button */}
          <button
            type="button"
            onClick={handleClose}
            id="command-palette-back-button"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer select-none",
              "bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600",
              "text-slate-800 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white",
              "border border-slate-300/80 dark:border-slate-700 shadow-2xs hover:shadow-xs",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500"
            )}
            title="Back to dashboard (Esc)"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-300" />
            <span>Back</span>
          </button>

          {/* Optional ESC keyboard badge on larger screens (clickable to close) */}
          <button
            type="button"
            onClick={handleClose}
            className="hidden md:inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer select-none"
            title="Close (Esc)"
            aria-label="Close with Escape key"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="p-2 sm:p-3 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40 flex-1 min-h-0 overscroll-contain"
        >
          {filteredItems.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm flex flex-col items-center justify-center">
              <Command className="w-8 h-8 mb-2 opacity-30 text-slate-400" />
              <p className="font-medium">No matching commands, repairs or customers found.</p>
              {query && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Try searching with a device model, customer name, ticket ID, or module.
                </p>
              )}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === index;

              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-colors group select-none min-h-[44px]',
                    isSelected 
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold shadow-xs' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                  )}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
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

                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {item.title}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0',
                            isSelected
                              ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
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
                      'w-4 h-4 shrink-0 transition-transform ml-1',
                      isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'
                    )}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-2.5 sm:p-3 pb-[max(env(safe-area-inset-bottom,0px),0.625rem)] border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0 select-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline">↑↓ Navigate</span>
            <span className="hidden sm:inline">↵ Select</span>
            <span className="hidden sm:inline">ESC Close</span>
            <span className="sm:hidden">Tap to select</span>
            <span className="sm:hidden text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={handleClose}
              className="sm:hidden font-semibold text-cyan-600 dark:text-cyan-400 underline underline-offset-2 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <span className="hidden xs:inline font-sans text-slate-400 text-[10px] sm:text-[11px]">
            MTS LAB Command Center
          </span>
        </div>
      </div>
    </div>
  );
}
