import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Check, 
  X, 
  Smartphone, 
  Tag, 
  Clock, 
  AlertCircle, 
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowUpDown,
  Layers,
  CheckCircle2,
  HelpCircle,
  Copy,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderTree,
  CornerDownRight,
  ArrowRight,
  FolderCheck,
  CheckSquare,
  Square,
  Move,
  FileEdit,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
  Zap,
  Battery,
  Camera,
  Volume2,
  Mic,
  Cpu,
  Tv,
  ScanLine,
  Cable,
  Droplets,
  Share2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';
import { useRealtimeSync } from '@/services/realtime';
import { syncEntityToSupabase as syncEntityToRtdb, deleteEntityFromSupabase as deleteEntityFromRtdb, syncEntityToSupabase, deleteEntityFromSupabase } from '@/lib/supabase';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

export interface RepairPriceRecord {
  id: string;
  brand: string;
  model: string;
  variant?: string | null;
  category: string;
  problem: string;
  serviceName: string;
  description?: string | null;
  price: number;
  priceType: 'FIXED' | 'STARTING_FROM' | 'ON_INSPECTION' | 'CONTACT_FOR_PRICE';
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
  estimatedTime?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomFolderItem {
  id: string;
  name: string;
  level: 'brand' | 'model' | 'category' | 'subcategory';
  brand: string;
  model?: string | null;
  category?: string | null;
  path: string;
  createdAt?: string;
  createdBy?: string | null;
}

const DEFAULT_POPULAR_BRANDS = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Redmi',
  'OnePlus',
  'Google',
  'Vivo',
  'Oppo',
  'Realme',
  'Nothing',
  'Motorola',
  'Honor',
  'Huawei'
];

const DEFAULT_POPULAR_CATEGORIES = [
  'Display',
  'Front Glass',
  'Lining',
  'Flex Change',
  'Green / White Screen',
  'Battery',
  'Charging',
  'Camera',
  'Speaker',
  'Microphone',
  'Back Glass',
  'Water Damage',
  'Motherboard / IC',
  'Software',
  'Other'
];

// Helper to resolve dynamic category icons & theme styles
function getCategoryVisuals(categoryName: string) {
  const norm = (categoryName || '').toLowerCase();
  if (norm.includes('display') || norm.includes('screen') || norm.includes('oled') || norm.includes('amoled') || norm.includes('lcd')) {
    return { icon: Smartphone, bgClass: 'bg-sky-50', textClass: 'text-sky-700', borderClass: 'border-sky-200' };
  }
  if (norm.includes('front glass') || norm.includes('glass') || norm.includes('oca')) {
    return { icon: Smartphone, bgClass: 'bg-teal-50', textClass: 'text-teal-700', borderClass: 'border-teal-200' };
  }
  if (norm.includes('battery') || norm.includes('drain') || norm.includes('power')) {
    return { icon: Battery, bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200' };
  }
  if (norm.includes('charging') || norm.includes('port') || norm.includes('pin') || norm.includes('type-c')) {
    return { icon: Zap, bgClass: 'bg-indigo-50', textClass: 'text-indigo-700', borderClass: 'border-indigo-200' };
  }
  if (norm.includes('camera') || norm.includes('lens')) {
    return { icon: Camera, bgClass: 'bg-purple-50', textClass: 'text-purple-700', borderClass: 'border-purple-200' };
  }
  if (norm.includes('speaker') || norm.includes('audio') || norm.includes('sound')) {
    return { icon: Volume2, bgClass: 'bg-rose-50', textClass: 'text-rose-700', borderClass: 'border-rose-200' };
  }
  if (norm.includes('micro') || norm.includes('mic') || norm.includes('voice')) {
    return { icon: Mic, bgClass: 'bg-cyan-50', textClass: 'text-cyan-700', borderClass: 'border-cyan-200' };
  }
  if (norm.includes('motherboard') || norm.includes('ic') || norm.includes('cpu') || norm.includes('short')) {
    return { icon: Cpu, bgClass: 'bg-violet-50', textClass: 'text-violet-700', borderClass: 'border-violet-200' };
  }
  if (norm.includes('lining') || norm.includes('laser')) {
    return { icon: ScanLine, bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-200' };
  }
  if (norm.includes('flex')) {
    return { icon: Cable, bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' };
  }
  if (norm.includes('green') || norm.includes('white screen') || norm.includes('wsod')) {
    return { icon: Tv, bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200' };
  }
  if (norm.includes('water') || norm.includes('liquid')) {
    return { icon: Droplets, bgClass: 'bg-blue-50', textClass: 'text-blue-700', borderClass: 'border-blue-200' };
  }
  if (norm.includes('back') || norm.includes('panel') || norm.includes('housing')) {
    return { icon: Layers, bgClass: 'bg-slate-100', textClass: 'text-slate-700', borderClass: 'border-slate-200' };
  }
  return { icon: Folder, bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' };
}

export default function RepairPrices() {
  const { token, user } = useAuthStore();
  const isAdmin = user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'RECEPTIONIST');

  // Main Data States
  const [records, setRecords] = useState<RepairPriceRecord[]>([]);
  const [customFolders, setCustomFolders] = useState<CustomFolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Hierarchy Navigation: currentPath array e.g. [] (root), ['Samsung'], ['Samsung', 'Galaxy S23 Ultra'], ['Samsung', 'Galaxy S23 Ultra', 'Display']
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Search & Filters
  const [globalSearch, setGlobalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'priceAsc' | 'priceDesc' | 'updatedAt'>('name');

  // Multi-Selection State
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedFolderNames, setSelectedFolderNames] = useState<Set<string>>(new Set());

  // Modal Dialog States
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<RepairPriceRecord | null>(null);
  const [isSubmittingService, setIsSubmittingService] = useState(false);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<{ level: 'brand' | 'model' | 'category'; oldName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveTargetInfo, setMoveTargetInfo] = useState<{ brand: string; model: string; category: string }>({ brand: '', model: '', category: '' });
  const [itemsToMove, setItemsToMove] = useState<{ serviceIds?: string[]; folderLevel?: string; folderName?: string } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const [serviceToDelete, setServiceToDelete] = useState<RepairPriceRecord | null>(null);
  const [isDeletingService, setIsDeletingService] = useState(false);

  const [folderToDelete, setFolderToDelete] = useState<{ name: string; level: 'brand' | 'model' | 'category'; brand: string; model?: string; category?: string } | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Service Form State
  const [serviceFormData, setServiceFormData] = useState({
    brand: '',
    model: '',
    variant: '',
    category: '',
    serviceName: '',
    description: '',
    price: '',
    originalPrice: '',
    rating: '',
    ratingCount: '',
    deviceType: 'Smartphone' as 'Smartphone' | 'Tablet' | 'iPad',
    icon: '',
    priceType: 'FIXED' as RepairPriceRecord['priceType'],
    status: 'ACTIVE' as RepairPriceRecord['status'],
    estimatedTime: '1-2 Hours',
    keepContext: true
  });
  const [serviceFormErrors, setServiceFormErrors] = useState<Record<string, string>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  const serviceInputRef = useRef<HTMLInputElement>(null);

  // Fetch all repair prices & custom folders
  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [pricesRes, foldersRes] = await Promise.all([
        fetch('/api/repair-prices', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/repair-prices/folders', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (pricesRes.status === 403 || foldersRes.status === 403) {
        throw new Error('403 Forbidden: Only authorized administrators can manage repair services.');
      }

      if (pricesRes.ok) {
        const pricesData = await pricesRes.json();
        setRecords(Array.isArray(pricesData) ? pricesData : []);
      }
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setCustomFolders(Array.isArray(foldersData) ? foldersData : []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading services catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && isAdmin) {
      fetchData();
    }
  }, [token, isAdmin]);

  // Real-time synchronization
  useRealtimeSync(['repairPrice', 'sync'], () => {
    if (token && isAdmin) {
      fetchData();
    }
  });

  // Clear selections when changing folder path or searching
  useEffect(() => {
    setSelectedServiceIds(new Set());
    setSelectedFolderNames(new Set());
  }, [currentPath, globalSearch]);

  // Derived Hierarchy Breakdown
  const currentBrand = currentPath[0] || '';
  const currentModel = currentPath[1] || '';
  const currentCategory = currentPath[2] || '';
  const currentLevelDepth = currentPath.length; // 0 = Root (Brands), 1 = Brand (Models), 2 = Model (Categories), 3+ = Category (Services/Subfolders)

  // Compute all available brands across records + custom folders
  const allBrands = useMemo(() => {
    const safeRecords = Array.isArray(records) ? records : [];
    const safeCustomFolders = Array.isArray(customFolders) ? customFolders : [];
    const brandSet = new Set<string>();
    safeRecords.forEach(r => { if (r && r.brand) brandSet.add(r.brand); });
    safeCustomFolders.forEach(f => { if (f && f.brand) brandSet.add(f.brand); });
    DEFAULT_POPULAR_BRANDS.forEach(b => brandSet.add(b));
    return Array.from(brandSet).sort();
  }, [records, customFolders]);

  // Compute folders at the CURRENT level
  const currentLevelFolders = useMemo(() => {
    if (globalSearch.trim()) return [];
    const safeRecords = Array.isArray(records) ? records : [];
    const safeCustomFolders = Array.isArray(customFolders) ? customFolders : [];

    if (currentLevelDepth === 0) {
      // LEVEL 0: Brands
      const brandMap = new Map<string, { name: string; modelCount: Set<string>; serviceCount: number; activeCount: number }>();
      
      // Initialize with discovered brands
      allBrands.forEach(brand => {
        brandMap.set(brand, { name: brand, modelCount: new Set(), serviceCount: 0, activeCount: 0 });
      });

      // Accumulate counts from existing records
      safeRecords.forEach(r => {
        if (!r) return;
        const b = r.brand || 'Other';
        if (!brandMap.has(b)) {
          brandMap.set(b, { name: b, modelCount: new Set(), serviceCount: 0, activeCount: 0 });
        }
        const entry = brandMap.get(b)!;
        if (r.model) entry.modelCount.add(r.model);
        entry.serviceCount += 1;
        if (r.status === 'ACTIVE') entry.activeCount += 1;
      });

      // Accumulate from custom folders
      safeCustomFolders.forEach(f => {
        if (f && f.brand && brandMap.has(f.brand)) {
          if (f.model) brandMap.get(f.brand)!.modelCount.add(f.model);
        }
      });

      return Array.from(brandMap.values()).map(b => ({
        name: b.name,
        level: 'brand' as const,
        brand: b.name,
        modelCount: b.modelCount.size,
        serviceCount: b.serviceCount,
        activeCount: b.activeCount
      })).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (currentLevelDepth === 1) {
      // LEVEL 1: Models for currentBrand
      const modelMap = new Map<string, { name: string; categoryCount: Set<string>; serviceCount: number; activeCount: number }>();

      // Populate from records matching this brand
      safeRecords.filter(r => r && r.brand?.toLowerCase() === currentBrand.toLowerCase()).forEach(r => {
        const m = r.model || 'General';
        if (!modelMap.has(m)) {
          modelMap.set(m, { name: m, categoryCount: new Set(), serviceCount: 0, activeCount: 0 });
        }
        const entry = modelMap.get(m)!;
        if (r.category) entry.categoryCount.add(r.category);
        entry.serviceCount += 1;
        if (r.status === 'ACTIVE') entry.activeCount += 1;
      });

      // Populate from custom folders matching this brand
      safeCustomFolders.filter(f => f && f.brand?.toLowerCase() === currentBrand.toLowerCase() && f.model).forEach(f => {
        const m = f.model!;
        if (!modelMap.has(m)) {
          modelMap.set(m, { name: m, categoryCount: new Set(), serviceCount: 0, activeCount: 0 });
        }
        if (f.category) modelMap.get(m)!.categoryCount.add(f.category);
      });

      return Array.from(modelMap.values()).map(m => ({
        name: m.name,
        level: 'model' as const,
        brand: currentBrand,
        model: m.name,
        categoryCount: m.categoryCount.size,
        serviceCount: m.serviceCount,
        activeCount: m.activeCount
      })).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (currentLevelDepth === 2) {
      // LEVEL 2: Categories for currentBrand + currentModel
      const categoryMap = new Map<string, { name: string; serviceCount: number; activeCount: number }>();

      // Populate from records matching brand + model
      safeRecords.filter(r => 
        r &&
        r.brand?.toLowerCase() === currentBrand.toLowerCase() && 
        r.model?.toLowerCase() === currentModel.toLowerCase()
      ).forEach(r => {
        const c = r.category || 'General';
        if (!categoryMap.has(c)) {
          categoryMap.set(c, { name: c, serviceCount: 0, activeCount: 0 });
        }
        const entry = categoryMap.get(c)!;
        entry.serviceCount += 1;
        if (r.status === 'ACTIVE') entry.activeCount += 1;
      });

      // Populate from custom folders
      safeCustomFolders.filter(f => 
        f &&
        f.brand?.toLowerCase() === currentBrand.toLowerCase() && 
        f.model?.toLowerCase() === currentModel.toLowerCase() && 
        f.category
      ).forEach(f => {
        const c = f.category!;
        if (!categoryMap.has(c)) {
          categoryMap.set(c, { name: c, serviceCount: 0, activeCount: 0 });
        }
      });

      return Array.from(categoryMap.values()).map(c => ({
        name: c.name,
        level: 'category' as const,
        brand: currentBrand,
        model: currentModel,
        category: c.name,
        serviceCount: c.serviceCount,
        activeCount: c.activeCount
      })).sort((a, b) => a.name.localeCompare(b.name));
    }

    return [];
  }, [records, customFolders, currentPath, currentLevelDepth, currentBrand, currentModel, allBrands, globalSearch]);

  // Compute services in the CURRENT folder or via Global Search
  const currentLevelServices = useMemo(() => {
    let list = records;

    if (globalSearch.trim()) {
      // Global Search: Search across all fields in the entire database
      const queryTokens = globalSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
      list = list.filter(item => {
        const text = [
          item.brand,
          item.model,
          item.variant || '',
          item.category,
          item.problem || '',
          item.serviceName || '',
          item.description || '',
          item.notes || '',
          item.price.toString()
        ].join(' ').toLowerCase();
        return queryTokens.every(token => text.includes(token));
      });
    } else {
      // In-folder listing: Filter by current navigation path
      if (currentLevelDepth === 0) {
        // At root level, we only show brand folders (no direct services unless searching)
        return [];
      }
      if (currentLevelDepth === 1) {
        // At brand level, show models as folders (or services if any are directly tagged)
        list = list.filter(r => r.brand?.toLowerCase() === currentBrand.toLowerCase());
        // Only return services if user wants to see all brand services or when no model folders
        if (currentLevelFolders.length > 0) return [];
      } else if (currentLevelDepth === 2) {
        // At model level, show categories as folders
        list = list.filter(r => 
          r.brand?.toLowerCase() === currentBrand.toLowerCase() && 
          r.model?.toLowerCase() === currentModel.toLowerCase()
        );
        if (currentLevelFolders.length > 0) return [];
      } else if (currentLevelDepth >= 3) {
        // At category level, show all services for this brand + model + category
        list = list.filter(r => 
          r.brand?.toLowerCase() === currentBrand.toLowerCase() && 
          r.model?.toLowerCase() === currentModel.toLowerCase() && 
          r.category?.toLowerCase() === currentCategory.toLowerCase()
        );
      }
    }

    // Apply Status Filter
    if (statusFilter !== 'ALL') {
      list = list.filter(r => r.status === statusFilter);
    }

    // Apply Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.serviceName || a.problem).localeCompare(b.serviceName || b.problem);
      }
      if (sortBy === 'priceAsc') {
        return a.price - b.price;
      }
      if (sortBy === 'priceDesc') {
        return b.price - a.price;
      }
      if (sortBy === 'updatedAt') {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return list;
  }, [records, globalSearch, currentPath, currentLevelDepth, currentBrand, currentModel, currentCategory, currentLevelFolders.length, statusFilter, sortBy]);

  // Overall Catalog Metrics
  const metrics = useMemo(() => {
    const total = records.length;
    const active = records.filter(r => r.status === 'ACTIVE').length;
    const inactive = total - active;
    const uniqueBrands = new Set(records.map(r => r.brand)).size;
    const uniqueModels = new Set(records.map(r => `${r.brand} ${r.model}`)).size;
    return { total, active, inactive, uniqueBrands, uniqueModels };
  }, [records]);

  // Navigation Handlers
  const handleOpenFolder = (folderName: string) => {
    setCurrentPath(prev => [...prev, folderName]);
    setGlobalSearch('');
  };

  const handleNavigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(prev => prev.slice(0, index + 1));
    }
    setGlobalSearch('');
  };

  const handleNavigateUp = () => {
    setCurrentPath(prev => prev.slice(0, -1));
    setGlobalSearch('');
  };

  // Multi-Selection Handlers
  const toggleSelectService = (id: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectFolder = (name: string) => {
    setSelectedFolderNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allServIds = new Set(currentLevelServices.map(s => s.id));
    const allFoldNames = new Set(currentLevelFolders.map(f => f.name));
    setSelectedServiceIds(allServIds);
    setSelectedFolderNames(allFoldNames);
  };

  const handleClearSelection = () => {
    setSelectedServiceIds(new Set());
    setSelectedFolderNames(new Set());
  };

  const totalSelectedCount = selectedServiceIds.size + selectedFolderNames.size;

  // Open Create Folder Modal
  const openCreateFolderModal = () => {
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  // Submit Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      toast.error('Folder name cannot be empty');
      return;
    }

    try {
      setIsSubmittingFolder(true);
      const level = currentLevelDepth === 0 ? 'brand' : currentLevelDepth === 1 ? 'model' : 'category';
      const payload = {
        name: trimmed,
        level,
        brand: currentLevelDepth === 0 ? trimmed : currentBrand,
        model: currentLevelDepth === 1 ? trimmed : (currentModel || null),
        category: currentLevelDepth === 2 ? trimmed : (currentCategory || null)
      };

      const res = await fetch('/api/repair-prices/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create folder');
      }

      const created = await res.json();
      setCustomFolders(prev => [...prev, created]);
      toast.success(`✓ Folder "${trimmed}" created successfully.`);
      setIsFolderModalOpen(false);
      setNewFolderName('');
    } catch (err: any) {
      toast.error(err.message || 'Error creating folder');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // Open Rename Modal
  const openRenameFolderModal = (folder: { name: string; level: 'brand' | 'model' | 'category' }) => {
    setFolderToRename({ level: folder.level, oldName: folder.name });
    setRenameValue(folder.name);
    setIsRenameModalOpen(true);
  };

  // Submit Rename Folder
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renameValue.trim() || renameValue.trim() === folderToRename.oldName) {
      setIsRenameModalOpen(false);
      return;
    }

    try {
      setIsRenaming(true);
      const res = await fetch('/api/repair-prices/rename-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          level: folderToRename.level,
          oldValue: folderToRename.oldName,
          newValue: renameValue.trim(),
          brand: currentBrand || undefined,
          model: currentModel || undefined
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename folder');
      }

      toast.success(`✓ Renamed to "${renameValue.trim()}".`);
      setIsRenameModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Rename failed');
    } finally {
      setIsRenaming(false);
    }
  };

  // Open Create Service Modal
  const openCreateServiceModal = () => {
    setEditingService(null);
    setServiceFormErrors({});
    const initialBrand = currentBrand || 'Samsung';
    const initialModel = currentModel || '';
    const initialText = `${initialBrand} ${initialModel}`.toLowerCase();
    const initialDeviceType = initialText.includes('ipad') ? 'iPad' : initialText.includes('tab') ? 'Tablet' : 'Smartphone';

    setServiceFormData({
      brand: initialBrand,
      model: initialModel,
      variant: '',
      category: currentCategory || 'Display',
      serviceName: '',
      description: '',
      price: '',
      originalPrice: '',
      rating: '',
      ratingCount: '',
      deviceType: initialDeviceType,
      icon: '',
      priceType: 'FIXED',
      status: 'ACTIVE',
      estimatedTime: '1-2 Hours',
      keepContext: true
    });
    setIsServiceModalOpen(true);
  };

  // Open Edit Service Modal
  const openEditServiceModal = (item: RepairPriceRecord) => {
    setEditingService(item);
    setServiceFormErrors({});
    setServiceFormData({
      brand: item.brand,
      model: item.model,
      variant: item.variant || '',
      category: item.category,
      serviceName: item.serviceName || item.problem,
      description: item.description || item.notes || '',
      price: (item.price > 0 || (item.priceType !== 'ON_INSPECTION' && item.priceType !== 'CONTACT_FOR_PRICE')) ? item.price.toString() : '',
      originalPrice: (item as any).originalPrice ? String((item as any).originalPrice) : '',
      rating: (item as any).rating ? String((item as any).rating) : '',
      ratingCount: (item as any).ratingCount ? String((item as any).ratingCount) : '',
      deviceType: (item as any).deviceType || 'Smartphone',
      icon: (item as any).icon || '',
      priceType: item.priceType || 'FIXED',
      status: item.status || 'ACTIVE',
      estimatedTime: item.estimatedTime || '1-2 Hours',
      keepContext: false
    });
    setIsServiceModalOpen(true);
  };

  // Validate Service Form
  const validateServiceForm = () => {
    const errors: Record<string, string> = {};
    if (!serviceFormData.brand.trim()) errors.brand = 'Brand is required.';
    if (!serviceFormData.model.trim()) errors.model = 'Model is required.';
    if (!serviceFormData.category.trim()) errors.category = 'Category is required.';
    if (!serviceFormData.serviceName.trim()) errors.serviceName = 'Service / Problem name is required.';

    const isPriceRequired = serviceFormData.priceType === 'FIXED' || serviceFormData.priceType === 'STARTING_FROM';
    if (isPriceRequired) {
      if (!serviceFormData.price.trim()) {
        errors.price = 'Please enter a valid price.';
      } else {
        const num = parseFloat(serviceFormData.price);
        if (isNaN(num) || num < 0) {
          errors.price = 'Please enter a positive numeric price.';
        }
      }
    }

    setServiceFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Service Handler
  const handleSaveService = async (addAnother = false) => {
    if (!validateServiceForm()) {
      toast.error('Please resolve the highlighted form errors.');
      return;
    }

    try {
      setIsSubmittingService(true);
      const numericPrice = parseFloat(serviceFormData.price) || 0;
      const originalPriceVal = serviceFormData.originalPrice.trim() ? parseFloat(serviceFormData.originalPrice) : null;
      const ratingVal = serviceFormData.rating.trim() ? parseFloat(serviceFormData.rating) : null;
      const ratingCountVal = serviceFormData.ratingCount.trim() ? parseInt(serviceFormData.ratingCount, 10) : null;

      const payload = {
        brand: serviceFormData.brand.trim(),
        model: serviceFormData.model.trim(),
        variant: serviceFormData.variant.trim() || null,
        category: serviceFormData.category.trim(),
        problem: serviceFormData.serviceName.trim(),
        serviceName: serviceFormData.serviceName.trim(),
        description: serviceFormData.description.trim() || null,
        notes: serviceFormData.description.trim() || null,
        price: numericPrice,
        originalPrice: originalPriceVal,
        rating: ratingVal,
        ratingCount: ratingCountVal,
        deviceType: serviceFormData.deviceType,
        icon: serviceFormData.icon.trim() || null,
        priceType: serviceFormData.priceType,
        status: serviceFormData.status,
        estimatedTime: serviceFormData.estimatedTime?.trim() || null
      };

      const url = editingService ? `/api/repair-prices/${editingService.id}` : '/api/repair-prices';
      const method = editingService ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save service record');
      }

      const savedRecord: RepairPriceRecord = await res.json();
      if (savedRecord && savedRecord.id) {
        await syncEntityToRtdb('repairPrices', savedRecord.id, savedRecord);
      }

      if (editingService) {
        toast.success('✓ Repair service updated successfully.');
        setRecords(prev => prev.map(r => r.id === editingService.id ? savedRecord : r));
        setIsServiceModalOpen(false);
      } else {
        toast.success('✓ Repair service added successfully.');
        setRecords(prev => [savedRecord, ...prev]);

        if (addAnother || serviceFormData.keepContext) {
          setServiceFormData(prev => ({
            ...prev,
            serviceName: '',
            description: '',
            price: '',
            priceType: 'FIXED',
            status: 'ACTIVE'
          }));
          setServiceFormErrors({});
          setTimeout(() => serviceInputRef.current?.focus(), 100);
        } else {
          setIsServiceModalOpen(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setIsSubmittingService(false);
    }
  };

  // Toggle Single Service Status
  const handleToggleServiceStatus = async (item: RepairPriceRecord) => {
    try {
      const res = await fetch(`/api/repair-prices/${item.id}/toggle-status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      const updated = await res.json();
      if (updated && updated.id) {
        await syncEntityToRtdb('repairPrices', updated.id, updated);
      }
      setRecords(prev => prev.map(r => r.id === item.id ? updated : r));
      toast.success(updated.status === 'ACTIVE' ? '✓ Service activated.' : '✓ Service set to inactive.');
    } catch (err: any) {
      toast.error(err.message || 'Could not update status');
    }
  };

  // Single Service Delete
  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      setIsDeletingService(true);
      const res = await fetch(`/api/repair-prices/${serviceToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete service');
      await deleteEntityFromRtdb('repairPrices', serviceToDelete.id);
      toast.success('✓ Repair service deleted.');
      setRecords(prev => prev.filter(r => r.id !== serviceToDelete.id));
      setServiceToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setIsDeletingService(false);
    }
  };

  // Open Delete Folder Modal with Safety Calculation
  const openDeleteFolderModal = (folder: { name: string; level: 'brand' | 'model' | 'category'; brand: string; model?: string; category?: string }) => {
    setFolderToDelete(folder);
  };

  // Calculate affected counts for folder deletion safety warning
  const folderDeleteImpact = useMemo(() => {
    if (!folderToDelete) return { serviceCount: 0, categoryCount: 0, modelCount: 0 };
    const { level, name, brand, model } = folderToDelete;
    
    let matching = records;
    if (level === 'brand') {
      matching = matching.filter(r => r.brand?.toLowerCase() === name.toLowerCase());
      const models = new Set(matching.map(r => r.model)).size;
      const categories = new Set(matching.map(r => r.category)).size;
      return { serviceCount: matching.length, categoryCount: categories, modelCount: models };
    }
    if (level === 'model') {
      matching = matching.filter(r => r.brand?.toLowerCase() === brand.toLowerCase() && r.model?.toLowerCase() === name.toLowerCase());
      const categories = new Set(matching.map(r => r.category)).size;
      return { serviceCount: matching.length, categoryCount: categories, modelCount: 1 };
    }
    if (level === 'category') {
      matching = matching.filter(r => 
        r.brand?.toLowerCase() === brand.toLowerCase() && 
        r.model?.toLowerCase() === (model || '').toLowerCase() && 
        r.category?.toLowerCase() === name.toLowerCase()
      );
      return { serviceCount: matching.length, categoryCount: 1, modelCount: 1 };
    }
    return { serviceCount: 0, categoryCount: 0, modelCount: 0 };
  }, [folderToDelete, records]);

  // Confirm Delete Folder
  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      setIsDeletingFolder(true);
      const res = await fetch('/api/repair-prices/delete-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          brand: folderToDelete.level === 'brand' ? folderToDelete.name : folderToDelete.brand,
          model: folderToDelete.level === 'model' ? folderToDelete.name : folderToDelete.model,
          category: folderToDelete.level === 'category' ? folderToDelete.name : folderToDelete.category
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete folder');
      }

      const result = await res.json();
      toast.success(`✓ Folder and ${result.deletedCount || 0} nested services permanently deleted.`);
      setFolderToDelete(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Folder deletion failed');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Open Move Modal for selected services or single folder
  const openMoveModalForSelection = () => {
    if (selectedServiceIds.size === 0 && selectedFolderNames.size === 0) return;
    setItemsToMove({
      serviceIds: Array.from(selectedServiceIds),
      folderLevel: currentLevelDepth === 0 ? 'brand' : currentLevelDepth === 1 ? 'model' : 'category',
      folderName: Array.from(selectedFolderNames)[0]
    });
    setMoveTargetInfo({
      brand: currentBrand || allBrands[0] || 'Samsung',
      model: currentModel || '',
      category: currentCategory || 'Display'
    });
    setIsMoveModalOpen(true);
  };

  // Confirm Move Items
  const handleExecuteMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTargetInfo.brand) {
      toast.error('Target brand is required');
      return;
    }

    try {
      setIsMoving(true);
      const payload: any = {
        destination: {
          brand: moveTargetInfo.brand.trim(),
          model: moveTargetInfo.model?.trim() || null,
          category: moveTargetInfo.category?.trim() || null
        }
      };

      if (itemsToMove?.serviceIds && itemsToMove.serviceIds.length > 0) {
        payload.serviceIds = itemsToMove.serviceIds;
      } else if (itemsToMove?.folderName) {
        payload.source = {
          brand: currentLevelDepth === 0 ? itemsToMove.folderName : currentBrand,
          model: currentLevelDepth === 1 ? itemsToMove.folderName : (currentModel || null),
          category: currentLevelDepth === 2 ? itemsToMove.folderName : (currentCategory || null)
        };
      }

      const res = await fetch('/api/repair-prices/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to move items');
      }

      toast.success('✓ Items relocated successfully.');
      setIsMoveModalOpen(false);
      handleClearSelection();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Move failed');
    } finally {
      setIsMoving(false);
    }
  };

  // Bulk Delete Confirmation
  const confirmBulkDelete = async () => {
    if (selectedServiceIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      const ids = Array.from(selectedServiceIds);
      const res = await fetch('/api/repair-prices/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Bulk delete failed');
      }

      for (const id of ids) {
        await deleteEntityFromRtdb('repairPrices', id).catch(() => {});
      }

      toast.success(`✓ ${ids.length} repair services deleted.`);
      setIsBulkDeleteModalOpen(false);
      handleClearSelection();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete bulk deletion');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Non-Admin Permission Restriction View
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6 bg-white p-10 rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Access Restricted (403 Forbidden)</h2>
          <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md mx-auto">
            Only <strong>SUPER_ADMIN</strong>, <strong>ADMIN</strong>, and <strong>RECEPTIONIST</strong> roles are authorized to manage device repair services, descriptions, and prices.
          </p>
        </div>
        <div className="pt-2">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-5 text-sm"
          >
            Return to Dashboard Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 px-1 sm:px-2">
      
      {/* ========================================================= */}
      {/* 1. TOP HEADER & MAIN CONTROLS                             */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Services & Repair Prices
            </h1>
            <Badge variant="outline" className="font-extrabold text-xs bg-slate-50 border-slate-200 text-slate-700">
              Hierarchical Manager
            </Badge>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Manage smartphone brands, models, repair categories, and prices in a dynamic file-manager structure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1 sm:pt-0">
          <DashboardRefreshButton
            onRefresh={fetchData}
            size="default"
            label="Refresh"
          />

          <Link
            to="/services"
            target="_blank"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold h-11 px-3.5 text-xs gap-1.5 shadow-2xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Public Finder</span>
          </Link>

          <Button
            onClick={openCreateFolderModal}
            variant="outline"
            className="rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-800 font-bold h-11 px-4 text-xs gap-1.5"
          >
            <FolderPlus className="w-4 h-4 text-amber-600" />
            <span>
              {currentLevelDepth === 0 ? '+ New Brand' : currentLevelDepth === 1 ? '+ New Model' : '+ New Category'}
            </span>
          </Button>

          <Button
            onClick={openCreateServiceModal}
            className="rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold h-11 px-4 shadow-sm text-xs gap-1.5 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Service</span>
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. STATS STRIP                                            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Services</span>
          <div className="text-xl sm:text-2xl font-black text-slate-950 mt-0.5">{metrics.total}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Active (Public)</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">{metrics.active}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inactive</span>
          <div className="text-xl sm:text-2xl font-black text-slate-600 mt-0.5">{metrics.inactive}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Phone Brands</span>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-0.5">{metrics.uniqueBrands}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Distinct Models</span>
          <div className="text-xl sm:text-2xl font-black text-purple-700 mt-0.5">{metrics.uniqueModels}</div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BREADCRUMBS & EXPLORER NAVIGATION BAR                  */}
      {/* ========================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Clickable Breadcrumbs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs font-bold text-slate-600">
          
          {/* Root Button */}
          <button
            onClick={() => handleNavigateBreadcrumb(-1)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              currentPath.length === 0 && !globalSearch
                ? 'bg-slate-900 text-white font-extrabold shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>All Brands</span>
          </button>

          {currentPath.map((segment, idx) => {
            const isLast = idx === currentPath.length - 1 && !globalSearch;
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <button
                  onClick={() => handleNavigateBreadcrumb(idx)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    isLast
                      ? 'bg-slate-950 text-white font-extrabold shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {idx === 0 && <Smartphone className="w-3 h-3 text-slate-400" />}
                  {idx === 1 && <Tag className="w-3 h-3 text-slate-400" />}
                  {idx >= 2 && <Layers className="w-3 h-3 text-slate-400" />}
                  <span>{segment}</span>
                </button>
              </React.Fragment>
            );
          })}

          {globalSearch && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-black">
                <Search className="w-3 h-3" />
                <span>Search: "{globalSearch}"</span>
              </span>
            </>
          )}
        </div>

        {/* Back Button & View Toggle */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {currentPath.length > 0 && !globalSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateUp}
              className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 font-bold text-xs gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Button>
          )}

          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200/60">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Folder Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Compact Table View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 4. SEARCH & FILTER BAR                                    */}
      {/* ========================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Global Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchInputRef}
            placeholder="Search brand, model, service, or category..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters & Selection Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
          >
            <option value="name">Sort by Name</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="updatedAt">Recently Updated</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 font-bold text-xs gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Select All</span>
          </Button>

          {totalSelectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-10 px-3 rounded-xl text-slate-500 font-bold text-xs"
            >
              Clear
            </Button>
          )}

        </div>

      </div>

      {/* ========================================================= */}
      {/* 5. FLOATING MULTI-SELECTION ACTION BAR (WHEN ITEMS CHOSEN) */}
      {/* ========================================================= */}
      {totalSelectedCount > 0 && (
        <div className="sticky top-4 z-30 bg-slate-950 text-white px-5 py-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="font-extrabold text-sm">
              {totalSelectedCount} {totalSelectedCount === 1 ? 'item' : 'items'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={openMoveModalForSelection}
              className="h-9 px-3.5 rounded-xl font-bold text-xs bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 gap-1.5"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Move Selected</span>
            </Button>

            {selectedServiceIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="h-9 px-3.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-sm gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedServiceIds.size})</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearSelection}
              className="h-9 px-2.5 rounded-xl text-slate-300 hover:text-white font-bold text-xs"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. FOLDER EXPLORER CONTENT SECTION                        */}
      {/* ========================================================= */}
      {loading ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold text-sm">Loading services and folders...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* SECTION 6A: SUBFOLDERS GRID/LIST (WHEN AT LEVEL 0, 1, OR 2 AND NOT SEARCHING) */}
          {currentLevelFolders.length > 0 && !globalSearch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {currentLevelDepth === 0 ? 'Phone Brands' : currentLevelDepth === 1 ? 'Device Models' : 'Repair Categories'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {currentLevelFolders.length} {currentLevelFolders.length === 1 ? 'folder' : 'folders'}
                </span>
              </div>

              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" : "space-y-2"}>
                {currentLevelFolders.map((folder) => {
                  const isSelected = selectedFolderNames.has(folder.name);
                  const visuals = getCategoryVisuals(folder.name);
                  const IconComponent = visuals.icon;

                  if (viewMode === 'list') {
                    return (
                      <div
                        key={folder.name}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isSelected ? 'bg-indigo-50/70 border-indigo-300 shadow-xs' : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectFolder(folder.name)}
                            className="w-4 h-4 rounded text-slate-950 cursor-pointer"
                          />
                          <div 
                            onClick={() => handleOpenFolder(folder.name)}
                            className="flex items-center gap-3 cursor-pointer min-w-0"
                          >
                            <div className={`w-9 h-9 rounded-xl ${visuals.bgClass} ${visuals.textClass} flex items-center justify-center shrink-0`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 text-sm truncate">{folder.name}</h4>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {folder.level === 'brand' && `${folder.modelCount || 0} Models • ${folder.serviceCount || 0} Services`}
                                {folder.level === 'model' && `${folder.categoryCount || 0} Categories • ${folder.serviceCount || 0} Services`}
                                {folder.level === 'category' && `${folder.serviceCount || 0} Repair Services`}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRenameFolderModal(folder)}
                            className="h-8 px-2 rounded-lg text-slate-600 hover:text-slate-950 font-bold text-xs"
                            title="Rename Folder"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteFolderModal(folder)}
                            className="h-8 px-2 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenFolder(folder.name)}
                            className="h-8 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1 ml-1"
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  // Grid View Card
                  return (
                    <div
                      key={folder.name}
                      className={`group relative p-5 rounded-3xl border transition-all cursor-pointer select-none flex flex-col justify-between min-h-[140px] ${
                        isSelected 
                          ? 'bg-indigo-50/80 border-indigo-400 shadow-md ring-2 ring-indigo-200' 
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                      onClick={(e) => {
                        // If not clicking checkbox or actions, open folder
                        if ((e.target as HTMLElement).closest('.stop-folder-nav')) return;
                        handleOpenFolder(folder.name);
                      }}
                    >
                      {/* Top row: Icon & Checkbox + Menu */}
                      <div className="flex items-start justify-between gap-2">
                        <div className={`w-11 h-11 rounded-2xl ${visuals.bgClass} ${visuals.textClass} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}>
                          <IconComponent className="w-5 h-5" />
                        </div>

                        <div className="flex items-center gap-1 stop-folder-nav">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectFolder(folder.name)}
                            className="w-4 h-4 rounded text-slate-950 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Middle: Folder Title */}
                      <div className="py-2">
                        <h4 className="font-extrabold text-slate-950 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {folder.name}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium pt-0.5">
                          {folder.level === 'brand' && `${folder.modelCount || 0} Models • ${folder.serviceCount || 0} Services`}
                          {folder.level === 'model' && `${folder.categoryCount || 0} Categories • ${folder.serviceCount || 0} Services`}
                          {folder.level === 'category' && `${folder.serviceCount || 0} Services Listed`}
                        </p>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between text-xs stop-folder-nav">
                        <span className="text-[11px] font-bold text-emerald-600">
                          {folder.activeCount ? `${folder.activeCount} Active` : '0 Active'}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openRenameFolderModal(folder)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                            title="Rename"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteFolderModal(folder)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 6B: SERVICES SECTION (WHEN IN CATEGORY OR SEARCHING) */}
          {(currentLevelServices.length > 0 || globalSearch.trim() || currentLevelDepth >= 2) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {globalSearch.trim() ? `Search Results (${currentLevelServices.length})` : 'Services & Repair Prices'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {currentLevelServices.length} {currentLevelServices.length === 1 ? 'service rate' : 'service rates'}
                </span>
              </div>

              {currentLevelServices.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                  <Tag className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-base">No services found in this location</p>
                    <p className="text-xs text-slate-500">Click "+ New Service" below to add a repair price for this device.</p>
                  </div>
                  <Button onClick={openCreateServiceModal} className="rounded-2xl bg-slate-900 text-white font-bold h-10 px-5 text-xs">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Service to this Folder
                  </Button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  
                  {/* Table View (Desktop & Tablet) */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-200 tracking-wider">
                        <tr>
                          <th className="px-4 py-3.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={currentLevelServices.length > 0 && currentLevelServices.every(s => selectedServiceIds.has(s.id))}
                              onChange={() => {
                                if (currentLevelServices.every(s => selectedServiceIds.has(s.id))) {
                                  setSelectedServiceIds(new Set());
                                } else {
                                  setSelectedServiceIds(new Set(currentLevelServices.map(s => s.id)));
                                }
                              }}
                              className="w-4 h-4 rounded text-slate-950 cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3.5">Device & Hierarchy</th>
                          <th className="px-4 py-3.5">Service / Problem</th>
                          <th className="px-4 py-3.5">Category</th>
                          <th className="px-4 py-3.5">Price (NPR)</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {currentLevelServices.map((item) => {
                          const isSelected = selectedServiceIds.has(item.id);
                          return (
                            <tr 
                              key={item.id} 
                              className={`transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/70'}`}
                            >
                              {/* Checkbox */}
                              <td className="px-4 py-4 align-top text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectService(item.id)}
                                  className="w-4 h-4 rounded text-slate-950 cursor-pointer"
                                />
                              </td>

                              {/* Device & Hierarchy */}
                              <td className="px-4 py-4 align-top">
                                <div className="font-black text-slate-950 text-sm">
                                  {item.brand} {item.model}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                                  {item.variant && (
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                      {item.variant}
                                    </span>
                                  )}
                                  {globalSearch && (
                                    <span className="text-slate-400 flex items-center gap-1">
                                      <CornerDownRight className="w-3 h-3" />
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Service Name & Description */}
                              <td className="px-4 py-4 align-top max-w-xs sm:max-w-sm">
                                <div className="font-bold text-slate-900 text-sm">{item.serviceName || item.problem}</div>
                                {(item.description || item.notes) ? (
                                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                    {item.description || item.notes}
                                  </p>
                                ) : (
                                  <span className="text-xs text-slate-300 italic">No description</span>
                                )}
                                {item.estimatedTime && (
                                  <div className="text-[10px] text-slate-400 font-bold mt-1">
                                    ⏱ {item.estimatedTime}
                                  </div>
                                )}
                              </td>

                              {/* Category */}
                              <td className="px-4 py-4 align-top">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
                                  {item.category}
                                </span>
                              </td>

                              {/* Price */}
                              <td className="px-4 py-4 align-top whitespace-nowrap">
                                <div className="font-black text-slate-950 text-sm sm:text-base">
                                  {item.priceType === 'ON_INSPECTION' ? (
                                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded">
                                      On Inspection
                                    </span>
                                  ) : item.priceType === 'CONTACT_FOR_PRICE' ? (
                                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                      Quote on Request
                                    </span>
                                  ) : (
                                    <span>NPR {item.price.toLocaleString()}</span>
                                  )}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                  {item.priceType.replace(/_/g, ' ')}
                                </div>
                              </td>

                              {/* Status Toggle */}
                              <td className="px-4 py-4 align-top">
                                <button
                                  onClick={() => handleToggleServiceStatus(item)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all ${
                                    item.status === 'ACTIVE'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                                  }`}
                                >
                                  {item.status === 'ACTIVE' ? (
                                    <>
                                      <Eye className="w-3 h-3 text-emerald-600" />
                                      <span>Active</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="w-3 h-3 text-slate-400" />
                                      <span>Inactive</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-4 align-top text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditServiceModal(item)}
                                    className="h-8 px-2.5 rounded-xl text-slate-700 hover:text-slate-950 font-bold text-xs"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setServiceToDelete(item)}
                                    className="h-8 w-8 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                    title="Delete Service"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 7. CREATE / EDIT SERVICE MODAL FORM                       */}
      {/* ========================================================= */}
      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-3xl lg:max-w-4xl bg-white rounded-3xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <DialogTitle className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              {editingService ? 'Edit Repair Service' : 'Add Repair Service'}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs sm:text-sm font-medium">
              {editingService 
                ? 'Update repair service details, rate, and customer visibility.' 
                : 'Add a new repair price item under current folder hierarchy.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveService(false); }} className="space-y-5 pt-3">
            
            {/* ROW 1: BRAND | MODEL | VARIANT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Brand <span className="text-rose-500">*</span></label>
                <input
                  list="brand-suggestions"
                  value={serviceFormData.brand}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, brand: e.target.value })}
                  placeholder="e.g. Samsung, Apple"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:bg-white focus:outline-none"
                />
                <datalist id="brand-suggestions">
                  {allBrands.map(b => <option key={b} value={b} />)}
                </datalist>
                {serviceFormErrors.brand && <p className="text-[11px] text-rose-600 font-medium">{serviceFormErrors.brand}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Model <span className="text-rose-500">*</span></label>
                <Input
                  value={serviceFormData.model}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, model: e.target.value })}
                  placeholder="e.g. Galaxy S23 Ultra, iPhone 14"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
                {serviceFormErrors.model && <p className="text-[11px] text-rose-600 font-medium">{serviceFormErrors.model}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Variant (Optional)</label>
                <Input
                  value={serviceFormData.variant}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, variant: e.target.value })}
                  placeholder="e.g. 5G, Snapdragon"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
              </div>

            </div>

            {/* ROW 2: CATEGORY | SERVICE NAME | ESTIMATED TIME */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Category <span className="text-rose-500">*</span></label>
                <input
                  list="category-suggestions"
                  value={serviceFormData.category}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, category: e.target.value })}
                  placeholder="e.g. Display, Battery"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:bg-white focus:outline-none"
                />
                <datalist id="category-suggestions">
                  {DEFAULT_POPULAR_CATEGORIES.map(c => <option key={c} value={c} />)}
                </datalist>
                {serviceFormErrors.category && <p className="text-[11px] text-rose-600 font-medium">{serviceFormErrors.category}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Service Name <span className="text-rose-500">*</span></label>
                <Input
                  ref={serviceInputRef}
                  value={serviceFormData.serviceName}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, serviceName: e.target.value })}
                  placeholder="e.g. Display Replacement, Glass Change"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
                {serviceFormErrors.serviceName && <p className="text-[11px] text-rose-600 font-medium">{serviceFormErrors.serviceName}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Estimated Turnaround</label>
                <Input
                  value={serviceFormData.estimatedTime}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, estimatedTime: e.target.value })}
                  placeholder="e.g. 1-2 Hours, Same Day"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
              </div>

            </div>

            {/* ROW 3: PRICE | PRICE TYPE | ORIGINAL PRICE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Price (NPR)</label>
                <Input
                  type="number"
                  min="0"
                  disabled={serviceFormData.priceType === 'ON_INSPECTION' || serviceFormData.priceType === 'CONTACT_FOR_PRICE'}
                  value={serviceFormData.price}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, price: e.target.value })}
                  placeholder="e.g. 7000"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
                {serviceFormErrors.price && <p className="text-[11px] text-rose-600 font-medium">{serviceFormErrors.price}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Price Type</label>
                <select
                  value={serviceFormData.priceType}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, priceType: e.target.value as any })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none"
                >
                  <option value="FIXED">Fixed Price</option>
                  <option value="STARTING_FROM">Starting From</option>
                  <option value="ON_INSPECTION">Price on Inspection</option>
                  <option value="CONTACT_FOR_PRICE">Contact for Price</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Original Price (Optional Strikethrough)</label>
                <Input
                  type="number"
                  min="0"
                  value={serviceFormData.originalPrice}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, originalPrice: e.target.value })}
                  placeholder="e.g. 8500 (shows ~~8500~~)"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
              </div>

            </div>

            {/* ROW 3.5: DEVICE TYPE & RATINGS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Hardware Device Form</label>
                <select
                  value={serviceFormData.deviceType}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, deviceType: e.target.value as any })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none"
                >
                  <option value="Smartphone">Smartphone</option>
                  <option value="Tablet">Tablet</option>
                  <option value="iPad">iPad</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Customer Rating (Optional)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={serviceFormData.rating}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, rating: e.target.value })}
                  placeholder="e.g. 4.9"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Review Count (Optional)</label>
                <Input
                  type="number"
                  min="0"
                  value={serviceFormData.ratingCount}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, ratingCount: e.target.value })}
                  placeholder="e.g. 24"
                  className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                />
              </div>
            </div>

            {/* ROW 4: REPAIR DESCRIPTION */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description / Technical Notes</label>
              <textarea
                rows={3}
                value={serviceFormData.description}
                onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                placeholder="High-grade replacement panel retaining touch calibration and True Tone."
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none resize-y min-h-[75px]"
              />
            </div>

            {/* ROW 5: VISIBILITY STATUS */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-xs font-extrabold text-slate-900 block">Visibility Status</span>
                <span className="text-[11px] text-slate-500 font-medium">Active services appear immediately on the public price finder.</span>
              </div>
              <button
                type="button"
                onClick={() => setServiceFormData({ ...serviceFormData, status: serviceFormData.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  serviceFormData.status === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {serviceFormData.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            </div>

            {/* FOOTER ACTIONS */}
            <DialogFooter className="pt-3 flex flex-col sm:flex-row gap-2 justify-between items-center border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsServiceModalOpen(false)}
                className="rounded-xl font-bold text-xs h-11 px-5 w-full sm:w-auto"
                disabled={isSubmittingService}
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {!editingService && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSaveService(true)}
                    disabled={isSubmittingService}
                    className="rounded-xl font-bold text-xs h-11 px-4 bg-slate-100 text-slate-900 border border-slate-200 flex-1 sm:flex-initial"
                  >
                    Save & Add Another
                  </Button>
                )}

                <Button
                  type="submit"
                  disabled={isSubmittingService}
                  className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs h-11 px-6 flex-1 sm:flex-initial"
                >
                  {isSubmittingService ? 'Saving...' : editingService ? 'Save Changes' : 'Save Service'}
                </Button>
              </div>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 8. CREATE FOLDER MODAL                                    */}
      {/* ========================================================= */}
      <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
              <FolderPlus className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-950">
              {currentLevelDepth === 0 ? 'Create New Brand Folder' : currentLevelDepth === 1 ? `New Model in ${currentBrand}` : `New Category in ${currentModel}`}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-medium">
              Add a new folder to organize repair services hierarchically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Folder Name</label>
              <Input
                placeholder={currentLevelDepth === 0 ? 'e.g. Sony, Motorola' : currentLevelDepth === 1 ? 'e.g. Galaxy S25 Ultra, Pixel 9' : 'e.g. Premium Display, Laser Glass'}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFolderModalOpen(false)}
                className="rounded-xl font-bold text-xs h-10 flex-1"
                disabled={isSubmittingFolder}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-slate-950 text-white font-bold text-xs h-10 flex-1"
                disabled={isSubmittingFolder}
              >
                {isSubmittingFolder ? 'Creating...' : 'Create Folder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 9. RENAME FOLDER MODAL                                    */}
      {/* ========================================================= */}
      <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
              <FileEdit className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-950">
              Rename Folder
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-medium">
              Renaming this folder will automatically update all nested repair records.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenameFolder} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">New Folder Name</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 text-xs font-semibold focus:bg-white"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameModalOpen(false)}
                className="rounded-xl font-bold text-xs h-10 flex-1"
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-slate-950 text-white font-bold text-xs h-10 flex-1"
                disabled={isRenaming}
              >
                {isRenaming ? 'Renaming...' : 'Save Name'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 10. MOVE ITEMS MODAL                                      */}
      {/* ========================================================= */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1">
              <Move className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-950">
              Move Items to Destination
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-medium">
              Select destination brand, model, and category.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteMove} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Target Brand <span className="text-rose-500">*</span></label>
              <input
                list="target-brand-suggestions"
                value={moveTargetInfo.brand}
                onChange={(e) => setMoveTargetInfo({ ...moveTargetInfo, brand: e.target.value })}
                placeholder="e.g. Samsung"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none"
              />
              <datalist id="target-brand-suggestions">
                {allBrands.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Target Model</label>
              <Input
                value={moveTargetInfo.model}
                onChange={(e) => setMoveTargetInfo({ ...moveTargetInfo, model: e.target.value })}
                placeholder="e.g. Galaxy S25 Ultra"
                className="h-11 rounded-xl bg-slate-50 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Target Category</label>
              <Input
                value={moveTargetInfo.category}
                onChange={(e) => setMoveTargetInfo({ ...moveTargetInfo, category: e.target.value })}
                placeholder="e.g. Display"
                className="h-11 rounded-xl bg-slate-50 text-xs font-semibold"
              />
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMoveModalOpen(false)}
                className="rounded-xl font-bold text-xs h-10 flex-1"
                disabled={isMoving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-slate-950 text-white font-bold text-xs h-10 flex-1"
                disabled={isMoving}
              >
                {isMoving ? 'Moving...' : 'Confirm Move'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 11. DELETE SINGLE SERVICE MODAL                           */}
      {/* ========================================================= */}
      <Dialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-950">
              Delete Repair Service?
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-xs pt-1">
              Are you sure you want to delete this repair price entry?
            </DialogDescription>
          </DialogHeader>

          {serviceToDelete && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 my-2 space-y-1">
              <div className="font-extrabold text-slate-900 text-sm">
                {serviceToDelete.brand} {serviceToDelete.model}
              </div>
              <div className="text-xs font-bold text-slate-600">
                {serviceToDelete.serviceName || serviceToDelete.problem}
              </div>
              <div className="text-xs font-extrabold text-slate-900 pt-0.5">
                NPR {serviceToDelete.price.toLocaleString()}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setServiceToDelete(null)}
              className="rounded-xl font-bold text-xs h-10 flex-1"
              disabled={isDeletingService}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteService}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 flex-1 shadow-sm"
              disabled={isDeletingService}
            >
              {isDeletingService ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 12. DELETE FOLDER SAFETY WARNING MODAL (CASCADE ALERT)    */}
      {/* ========================================================= */}
      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-950">
              Delete Folder: "{folderToDelete?.name}"?
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-xs leading-relaxed pt-1">
              Deleting this folder will permanently remove all nested categories and service rates inside it.
            </DialogDescription>
          </DialogHeader>

          {folderToDelete && (
            <div className="space-y-3 my-2">
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Impact Summary</span>
                </div>
                <p className="text-xs text-rose-700 font-medium leading-relaxed">
                  This action will permanently delete <strong>{folderDeleteImpact.serviceCount} repair services</strong>
                  {folderDeleteImpact.categoryCount > 0 && ` across ${folderDeleteImpact.categoryCount} categories`}.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFolderToDelete(null)}
              className="rounded-xl font-bold text-xs h-11 flex-1"
              disabled={isDeletingFolder}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteFolder}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs h-11 flex-1 shadow-sm"
              disabled={isDeletingFolder}
            >
              {isDeletingFolder ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 13. BULK DELETE CONFIRMATION MODAL                        */}
      {/* ========================================================= */}
      <Dialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-950">
              Bulk Delete Selected Services?
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-xs pt-1">
              Are you sure you want to permanently delete {selectedServiceIds.size} selected repair service records?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              className="rounded-xl font-bold text-xs h-10 flex-1"
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBulkDelete}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 flex-1 shadow-sm"
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? 'Deleting...' : `Delete ${selectedServiceIds.size} Services`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
