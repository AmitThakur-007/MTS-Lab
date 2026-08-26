import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  Tag, 
  MapPin, 
  Building2, 
  Wrench, 
  Smartphone, 
  Clock, 
  Filter, 
  Grid, 
  List, 
  Loader2, 
  RotateCcw, 
  Check, 
  X, 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  SlidersHorizontal, 
  Boxes, 
  ShieldAlert, 
  Info, 
  Sliders, 
  MoveRight, 
  Archive, 
  RefreshCw, 
  ArrowUpDown, 
  CheckSquare, 
  Square,
  Barcode,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { formatNPR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/services/realtime';
import { syncEntityToRtdb, deleteEntityFromRtdb } from '@/lib/firebase';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { format } from 'date-fns';
import { normalizeRole } from '@/lib/rbac';

const REPAIR_CATEGORIES = [
  'Displays',
  'Batteries',
  'Charging Ports',
  'Cameras',
  'Back Panels',
  'Flex Cables',
  'IC / Chips',
  'Speakers',
  'Microphones',
  'Connectors',
  'Screws',
  'Adhesives',
  'Repair Tools',
  'Cleaning Materials',
  'Spare Parts',
  'Consumables',
  'Accessories',
  'Other'
];

const UNIT_OPTIONS = [
  'Piece',
  'Set',
  'Box',
  'Meter',
  'Gram',
  'Bottle',
  'Roll',
  'Pack'
];

export interface InventoryItemData {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  sku?: string | null;
  category: string;
  subcategory?: string | null;
  compatibility?: string | null;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel?: number | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  supplier?: string | null;
  storageLocation?: string | null;
  description?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  transactions?: any[];
}

export interface CustomInventoryFolder {
  id: string;
  brand: string;
  model?: string | null;
  category?: string | null;
  subcategory?: string | null;
  createdAt?: string;
}

export default function Inventory() {
  const { token, user } = useAuthStore();
  const normRole = normalizeRole(user?.role);
  const isSuperAdmin = normRole === 'SUPERADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'SUPERADMIN' || user?.email?.toLowerCase() === 'mtsmobilelab@gmail.com';
  const isAdmin = isSuperAdmin || normRole === 'ADMIN' || user?.role === 'ADMIN';
  const isManager = normRole === 'MANAGER' || user?.role === 'MANAGER';
  const isReceptionist = normRole === 'RECEPTIONIST' || user?.role === 'RECEPTIONIST';
  const isInventoryManager = normRole === 'MANAGER' || user?.role === 'INVENTORY_MANAGER';
  const isTechnician = normRole === 'TECHNICIAN' || normRole === 'HEAD_TECHNICIAN' || user?.role === 'TECHNICIAN' || user?.role === 'LEAD_TECHNICIAN';

  const canManage = isSuperAdmin || isAdmin || isManager || isReceptionist || isInventoryManager || isTechnician;
  const canDelete = isSuperAdmin || isAdmin;

  // Data states
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [customFolders, setCustomFolders] = useState<CustomInventoryFolder[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValuation: 0,
    recentTxCount: 0
  });
  const [categories, setCategories] = useState<string[]>(REPAIR_CATEGORIES);
  const [suppliersList, setSuppliersList] = useState<string[]>([]);
  const [locationsList, setLocationsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Hierarchy Navigation state
  // null at root -> displays Brand folders
  // brand set, model null -> displays Model folders for that brand
  // brand & model set, category null -> displays Category folders for that model
  // brand, model, category set -> displays individual Inventory Items in that category
  const [navPath, setNavPath] = useState<{
    brand: string | null;
    model: string | null;
    category: string | null;
  }>({
    brand: null,
    model: null,
    category: null
  });

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ARCHIVED'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name' | 'stock' | 'price' | 'sku'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteFolderOpen, setIsDeleteFolderOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Selected Target for Modals
  const [selectedItem, setSelectedItem] = useState<InventoryItemData | null>(null);
  const [itemHistory, setItemHistory] = useState<any[]>([]);
  const [folderToEdit, setFolderToEdit] = useState<{
    level: 'brand' | 'model' | 'category';
    name: string;
    parentBrand?: string | null;
    parentModel?: string | null;
  } | null>(null);

  // Form States
  const [folderFormData, setFolderFormData] = useState({
    brand: '',
    model: '',
    category: ''
  });

  const [itemFormData, setItemFormData] = useState({
    name: '',
    brand: '',
    model: '',
    sku: '',
    category: 'Displays',
    subcategory: '',
    compatibility: '',
    unit: 'Piece',
    currentStock: '0',
    minStockLevel: '5',
    maxStockLevel: '',
    purchasePrice: '',
    sellingPrice: '',
    supplier: '',
    storageLocation: '',
    description: '',
    notes: '',
    imageUrl: '',
    status: 'ACTIVE'
  });

  const [stockInForm, setStockInForm] = useState({
    quantity: '1',
    purchasePrice: '',
    supplier: '',
    reference: '',
    notes: ''
  });

  const [stockOutForm, setStockOutForm] = useState({
    quantity: '1',
    reason: 'Used for Customer Repair',
    repairNumber: '',
    notes: ''
  });

  const [adjustStockForm, setAdjustStockForm] = useState({
    newStock: '0',
    reason: 'Physical Inventory Audit',
    notes: ''
  });

  const [renameFolderName, setRenameFolderName] = useState('');

  const [moveTarget, setMoveTarget] = useState({
    targetBrand: '',
    targetModel: '',
    targetCategory: ''
  });

  // Fetch Inventory Data
  const fetchData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [itemsRes, statsRes, catRes, foldersRes, supRes, locRes] = await Promise.all([
        api.get('/inventory?status=ALL'),
        api.get('/inventory/stats').catch(() => ({})),
        api.get('/inventory/categories').catch(() => []),
        api.get('/inventory/folders').catch(() => []),
        api.get('/inventory/suppliers').catch(() => []),
        api.get('/inventory/locations').catch(() => [])
      ]);

      if (Array.isArray(itemsRes)) {
        setItems(itemsRes);
      }
      if (statsRes && typeof statsRes.totalProducts === 'number') {
        setStats(statsRes);
      }
      if (Array.isArray(catRes) && catRes.length > 0) {
        const catNames = catRes.map((c: any) => c.name);
        setCategories(Array.from(new Set([...REPAIR_CATEGORIES, ...catNames])));
      }
      if (Array.isArray(foldersRes)) {
        setCustomFolders(foldersRes);
      }
      if (Array.isArray(supRes)) {
        setSuppliersList(supRes);
      }
      if (Array.isArray(locRes)) {
        setLocationsList(locRes);
      }
    } catch (err: any) {
      console.error("[INVENTORY FETCH ERROR]", err);
      if (!silent) {
        toast.error(err.message || 'Failed to load inventory data');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [token]);

  // Real-Time Database Synchronization across dashboards (silent background update)
  useRealtimeSync(['inventoryItem', 'inventoryTransaction', 'inventoryFolder', 'repair', 'sync'], () => {
    fetchData(true);
  });

  // ==========================================
  // HIERARCHY COMPUTATION
  // ==========================================

  // All active items (or archived if filter is selected)
  const activeItems = useMemo(() => {
    if (stockFilter === 'ARCHIVED') {
      return items.filter(i => i.status === 'ARCHIVED');
    }
    return items.filter(i => i.status !== 'ARCHIVED');
  }, [items, stockFilter]);

  // 1. Unique Brands (Level 0)
  const brandList = useMemo(() => {
    const brandsMap = new Map<string, { brand: string; modelCount: Set<string>; itemCount: number; totalUnits: number; hasLowStock: boolean }>();

    // Include custom folders
    customFolders.forEach(f => {
      if (f.brand) {
        const b = f.brand.trim();
        if (!brandsMap.has(b)) {
          brandsMap.set(b, { brand: b, modelCount: new Set(), itemCount: 0, totalUnits: 0, hasLowStock: false });
        }
        if (f.model) brandsMap.get(b)!.modelCount.add(f.model.trim());
      }
    });

    // Aggregate from items
    activeItems.forEach(item => {
      const b = (item.brand || 'Other').trim();
      if (!brandsMap.has(b)) {
        brandsMap.set(b, { brand: b, modelCount: new Set(), itemCount: 0, totalUnits: 0, hasLowStock: false });
      }
      const data = brandsMap.get(b)!;
      if (item.model) data.modelCount.add(item.model.trim());
      data.itemCount += 1;
      data.totalUnits += (item.currentStock || 0);
      if (item.currentStock > 0 && item.currentStock <= item.minStockLevel) {
        data.hasLowStock = true;
      }
    });

    return Array.from(brandsMap.values()).map(v => ({
      brand: v.brand,
      modelCount: v.modelCount.size,
      itemCount: v.itemCount,
      totalUnits: v.totalUnits,
      hasLowStock: v.hasLowStock
    })).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [activeItems, customFolders]);

  // 2. Unique Models for selected Brand (Level 1)
  const modelList = useMemo(() => {
    if (!navPath.brand) return [];
    const modelsMap = new Map<string, { model: string; categoryCount: Set<string>; itemCount: number; totalUnits: number; hasLowStock: boolean }>();

    // From custom folders
    customFolders.forEach(f => {
      if (f.brand.toLowerCase() === navPath.brand?.toLowerCase() && f.model) {
        const m = f.model.trim();
        if (!modelsMap.has(m)) {
          modelsMap.set(m, { model: m, categoryCount: new Set(), itemCount: 0, totalUnits: 0, hasLowStock: false });
        }
        if (f.category) modelsMap.get(m)!.categoryCount.add(f.category.trim());
      }
    });

    // From items
    activeItems.forEach(item => {
      if ((item.brand || 'Other').toLowerCase() === navPath.brand?.toLowerCase()) {
        const m = (item.model || 'Universal / All').trim();
        if (!modelsMap.has(m)) {
          modelsMap.set(m, { model: m, categoryCount: new Set(), itemCount: 0, totalUnits: 0, hasLowStock: false });
        }
        const data = modelsMap.get(m)!;
        if (item.category) data.categoryCount.add(item.category.trim());
        data.itemCount += 1;
        data.totalUnits += (item.currentStock || 0);
        if (item.currentStock > 0 && item.currentStock <= item.minStockLevel) {
          data.hasLowStock = true;
        }
      }
    });

    return Array.from(modelsMap.values()).map(v => ({
      model: v.model,
      categoryCount: v.categoryCount.size,
      itemCount: v.itemCount,
      totalUnits: v.totalUnits,
      hasLowStock: v.hasLowStock
    })).sort((a, b) => a.model.localeCompare(b.model));
  }, [activeItems, customFolders, navPath.brand]);

  // 3. Unique Categories for selected Brand & Model (Level 2)
  const categoryList = useMemo(() => {
    if (!navPath.brand || !navPath.model) return [];
    const catsMap = new Map<string, { category: string; itemCount: number; totalUnits: number; hasLowStock: boolean }>();

    // From custom folders
    customFolders.forEach(f => {
      if (
        f.brand.toLowerCase() === navPath.brand?.toLowerCase() &&
        f.model?.toLowerCase() === navPath.model?.toLowerCase() &&
        f.category
      ) {
        const c = f.category.trim();
        if (!catsMap.has(c)) {
          catsMap.set(c, { category: c, itemCount: 0, totalUnits: 0, hasLowStock: false });
        }
      }
    });

    // From items
    activeItems.forEach(item => {
      if (
        (item.brand || 'Other').toLowerCase() === navPath.brand?.toLowerCase() &&
        (item.model || 'Universal / All').toLowerCase() === navPath.model?.toLowerCase()
      ) {
        const c = (item.category || 'Spare Parts').trim();
        if (!catsMap.has(c)) {
          catsMap.set(c, { category: c, itemCount: 0, totalUnits: 0, hasLowStock: false });
        }
        const data = catsMap.get(c)!;
        data.itemCount += 1;
        data.totalUnits += (item.currentStock || 0);
        if (item.currentStock > 0 && item.currentStock <= item.minStockLevel) {
          data.hasLowStock = true;
        }
      }
    });

    return Array.from(catsMap.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [activeItems, customFolders, navPath.brand, navPath.model]);

  // 4. Current Folder Items (Level 3+)
  const currentFolderItems = useMemo(() => {
    if (!navPath.brand || !navPath.model || !navPath.category) return [];
    return activeItems.filter(item => {
      const matchBrand = (item.brand || 'Other').toLowerCase() === navPath.brand?.toLowerCase();
      const matchModel = (item.model || 'Universal / All').toLowerCase() === navPath.model?.toLowerCase();
      const matchCat = (item.category || 'Spare Parts').toLowerCase() === navPath.category?.toLowerCase();
      if (!matchBrand || !matchModel || !matchCat) return false;

      // Stock filter
      if (stockFilter === 'IN_STOCK') return item.currentStock > 0;
      if (stockFilter === 'LOW_STOCK') return item.currentStock > 0 && item.currentStock <= item.minStockLevel;
      if (stockFilter === 'OUT_OF_STOCK') return item.currentStock <= 0;

      return true;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'stock') cmp = (a.currentStock || 0) - (b.currentStock || 0);
      else if (sortBy === 'price') cmp = (a.purchasePrice || 0) - (b.purchasePrice || 0);
      else if (sortBy === 'sku') cmp = (a.sku || '').localeCompare(b.sku || '');
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortOrder === 'desc' ? -cmp : cmp;
    });
  }, [activeItems, navPath, stockFilter, sortBy, sortOrder]);

  // 5. Global Search Results across entire hierarchy
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();

    return activeItems.filter(item => {
      const matchName = item.name?.toLowerCase().includes(q);
      const matchBrand = item.brand?.toLowerCase().includes(q);
      const matchModel = item.model?.toLowerCase().includes(q);
      const matchSku = item.sku?.toLowerCase().includes(q);
      const matchCompat = item.compatibility?.toLowerCase().includes(q);
      const matchCat = item.category?.toLowerCase().includes(q);
      const matchSub = item.subcategory?.toLowerCase().includes(q);
      const matchLoc = item.storageLocation?.toLowerCase().includes(q);
      const matchSup = item.supplier?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      return matchName || matchBrand || matchModel || matchSku || matchCompat || matchCat || matchSub || matchLoc || matchSup || matchDesc;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [activeItems, searchTerm]);

  // ==========================================
  // NAVIGATION HANDLERS
  // ==========================================

  const handleSelectBrand = (brand: string) => {
    setNavPath({ brand, model: null, category: null });
    setSelectedIds([]);
  };

  const handleSelectModel = (model: string) => {
    setNavPath(prev => ({ ...prev, model, category: null }));
    setSelectedIds([]);
  };

  const handleSelectCategory = (category: string) => {
    setNavPath(prev => ({ ...prev, category }));
    setSelectedIds([]);
  };

  const handleGoBack = () => {
    if (navPath.category) {
      setNavPath(prev => ({ ...prev, category: null }));
    } else if (navPath.model) {
      setNavPath(prev => ({ ...prev, model: null }));
    } else if (navPath.brand) {
      setNavPath({ brand: null, model: null, category: null });
    }
    setSelectedIds([]);
  };

  const handleJumpToItemLocation = (item: InventoryItemData) => {
    setNavPath({
      brand: item.brand || 'Other',
      model: item.model || 'Universal / All',
      category: item.category || 'Spare Parts'
    });
    setSearchTerm('');
  };

  // ==========================================
  // SELECTION HANDLERS
  // ==========================================

  const handleToggleSelectId = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllCurrent = () => {
    if (navPath.category) {
      const allIds = currentFolderItems.map(i => i.id);
      setSelectedIds(allIds);
    } else if (searchTerm.trim()) {
      const allIds = searchResults.map(i => i.id);
      setSelectedIds(allIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // ==========================================
  // MODAL OPENERS
  // ==========================================

  const handleOpenNewFolder = () => {
    setFolderFormData({
      brand: navPath.brand || '',
      model: navPath.model || '',
      category: ''
    });
    setIsNewFolderOpen(true);
  };

  const handleOpenAddItem = () => {
    setItemFormData({
      name: '',
      brand: navPath.brand || '',
      model: navPath.model || '',
      sku: '',
      category: navPath.category || 'Displays',
      subcategory: '',
      compatibility: navPath.model ? `${navPath.brand || ''} ${navPath.model}`.trim() : '',
      unit: 'Piece',
      currentStock: '0',
      minStockLevel: '5',
      maxStockLevel: '',
      purchasePrice: '',
      sellingPrice: '',
      supplier: '',
      storageLocation: '',
      description: '',
      notes: '',
      imageUrl: '',
      status: 'ACTIVE'
    });
    setIsAddItemOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItemData) => {
    setSelectedItem(item);
    setItemFormData({
      name: item.name || '',
      brand: item.brand || '',
      model: item.model || '',
      sku: item.sku || '',
      category: item.category || 'Displays',
      subcategory: item.subcategory || '',
      compatibility: item.compatibility || '',
      unit: item.unit || 'Piece',
      currentStock: String(item.currentStock ?? 0),
      minStockLevel: String(item.minStockLevel ?? 5),
      maxStockLevel: item.maxStockLevel ? String(item.maxStockLevel) : '',
      purchasePrice: item.purchasePrice !== null && item.purchasePrice !== undefined ? String(item.purchasePrice) : '',
      sellingPrice: item.sellingPrice !== null && item.sellingPrice !== undefined ? String(item.sellingPrice) : '',
      supplier: item.supplier || '',
      storageLocation: item.storageLocation || '',
      description: item.description || '',
      notes: item.notes || '',
      imageUrl: item.imageUrl || '',
      status: item.status || 'ACTIVE'
    });
    setIsEditItemOpen(true);
  };

  const handleOpenStockIn = (item: InventoryItemData) => {
    setSelectedItem(item);
    setStockInForm({
      quantity: '1',
      purchasePrice: item.purchasePrice ? String(item.purchasePrice) : '',
      supplier: item.supplier || '',
      reference: '',
      notes: ''
    });
    setIsStockInOpen(true);
  };

  const handleOpenStockOut = (item: InventoryItemData) => {
    setSelectedItem(item);
    setStockOutForm({
      quantity: '1',
      reason: 'Used for Customer Repair',
      repairNumber: '',
      notes: ''
    });
    setIsStockOutOpen(true);
  };

  const handleOpenAdjustStock = (item: InventoryItemData) => {
    setSelectedItem(item);
    setAdjustStockForm({
      newStock: String(item.currentStock ?? 0),
      reason: 'Physical Inventory Audit',
      notes: ''
    });
    setIsAdjustStockOpen(true);
  };

  const handleOpenDetails = (item: InventoryItemData) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
  };

  const handleOpenHistory = async (item: InventoryItemData) => {
    setSelectedItem(item);
    setIsHistoryOpen(true);
    try {
      const details = await api.get(`/inventory/${item.id}`);
      if (details && Array.isArray(details.transactions)) {
        setItemHistory(details.transactions);
      }
    } catch {
      setItemHistory(item.transactions || []);
    }
  };

  const handleOpenRenameFolder = (level: 'brand' | 'model' | 'category', name: string) => {
    setFolderToEdit({
      level,
      name,
      parentBrand: navPath.brand,
      parentModel: navPath.model
    });
    setRenameFolderName(name);
    setIsRenameFolderOpen(true);
  };

  const handleOpenDeleteFolder = (level: 'brand' | 'model' | 'category', name: string) => {
    setFolderToEdit({
      level,
      name,
      parentBrand: navPath.brand,
      parentModel: navPath.model
    });
    setIsDeleteFolderOpen(true);
  };

  const handleOpenMoveSelected = () => {
    if (selectedIds.length === 0) return;
    setMoveTarget({
      targetBrand: navPath.brand || '',
      targetModel: navPath.model || '',
      targetCategory: navPath.category || ''
    });
    setIsMoveModalOpen(true);
  };

  // ==========================================
  // FORM SUBMISSION HANDLERS
  // ==========================================

  // Save New Folder
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFormData.brand.trim()) {
      toast.error('Brand name is required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inventory/folders', folderFormData);
      toast.success('✓ Folder created successfully.');
      setIsNewFolderOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create folder');
    } finally {
      setSubmitting(false);
    }
  };

  // Save New Item
  const handleCreateItemSubmit = async (addAnother: boolean = false) => {
    if (!itemFormData.name.trim()) {
      toast.error('Part / Product Name is required.');
      return;
    }
    if (!itemFormData.brand.trim()) {
      toast.error('Brand is required.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post('/inventory', itemFormData);
      if (created && created.id) {
        await syncEntityToRtdb('inventory', created.id, created);
      }
      toast.success(`✓ Part "${created.name}" added to stock.`);
      if (addAnother) {
        setItemFormData(prev => ({
          ...prev,
          name: '',
          sku: '',
          description: '',
          notes: ''
        }));
      } else {
        setIsAddItemOpen(false);
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create inventory item');
    } finally {
      setSubmitting(false);
    }
  };

  // Save Edit Item
  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      const updated = await api.patch(`/inventory/${selectedItem.id}`, itemFormData);
      if (updated && updated.id) {
        await syncEntityToRtdb('inventory', updated.id, updated);
      }
      toast.success(`✓ Part "${updated.name}" updated.`);
      setIsEditItemOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update item specifications');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock In
  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qty = parseInt(stockInForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid stock intake quantity.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/inventory/${selectedItem.id}/stock-in`, stockInForm);
      if (res && res.item) {
        await syncEntityToRtdb('inventory', res.item.id, res.item);
      }
      toast.success(`✓ Added +${qty} ${selectedItem.unit}s to stock.`);
      setIsStockInOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to intake stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock Out
  const handleStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qty = parseInt(stockOutForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid deduction quantity.');
      return;
    }

    if (qty > selectedItem.currentStock) {
      toast.error(`Insufficient stock! Available stock is only ${selectedItem.currentStock} ${selectedItem.unit}(s).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/inventory/${selectedItem.id}/stock-out`, stockOutForm);
      if (res && res.item) {
        await syncEntityToRtdb('inventory', res.item.id, res.item);
      }
      toast.success(`✓ Deducted -${qty} ${selectedItem.unit}s from stock.`);
      setIsStockOutOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to deduct stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock Adjustment
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const targetStock = parseInt(adjustStockForm.newStock);
    if (isNaN(targetStock) || targetStock < 0) {
      toast.error('Please enter a valid non-negative physical stock count.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/inventory/${selectedItem.id}/adjust-stock`, adjustStockForm);
      if (res && res.item) {
        await syncEntityToRtdb('inventory', res.item.id, res.item);
      }
      toast.success(`✓ Physical stock adjusted to ${targetStock} ${selectedItem.unit}s.`);
      setIsAdjustStockOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Rename Folder Submit
  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToEdit || !renameFolderName.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/inventory/rename-folder', {
        level: folderToEdit.level,
        oldName: folderToEdit.name,
        newName: renameFolderName.trim(),
        parentBrand: folderToEdit.parentBrand,
        parentModel: folderToEdit.parentModel
      });

      toast.success(`✓ Renamed ${folderToEdit.level} to "${renameFolderName.trim()}".`);
      
      // Update nav path if we renamed the active folder
      if (folderToEdit.level === 'brand' && navPath.brand === folderToEdit.name) {
        setNavPath(prev => ({ ...prev, brand: renameFolderName.trim() }));
      } else if (folderToEdit.level === 'model' && navPath.model === folderToEdit.name) {
        setNavPath(prev => ({ ...prev, model: renameFolderName.trim() }));
      } else if (folderToEdit.level === 'category' && navPath.category === folderToEdit.name) {
        setNavPath(prev => ({ ...prev, category: renameFolderName.trim() }));
      }

      setIsRenameFolderOpen(false);
      setFolderToEdit(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename folder');
    } finally {
      setSubmitting(false);
    }
  };

  // Move Selected Items Submit
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !moveTarget.targetBrand.trim()) {
      toast.error('Target brand is required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inventory/move', {
        itemIds: selectedIds,
        targetBrand: moveTarget.targetBrand.trim(),
        targetModel: moveTarget.targetModel ? moveTarget.targetModel.trim() : null,
        targetCategory: moveTarget.targetCategory ? moveTarget.targetCategory.trim() : 'Spare Parts'
      });

      toast.success(`✓ Moved ${selectedIds.length} items successfully.`);
      setIsMoveModalOpen(false);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move items');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Archive Folder Submit
  const handleDeleteFolderSubmit = async (permanent: boolean = false) => {
    if (!folderToEdit) return;

    setSubmitting(true);
    try {
      let b = folderToEdit.level === 'brand' ? folderToEdit.name : (folderToEdit.parentBrand || navPath.brand || '');
      let m = folderToEdit.level === 'model' ? folderToEdit.name : (folderToEdit.level === 'category' ? (folderToEdit.parentModel || navPath.model || undefined) : undefined);
      let c = folderToEdit.level === 'category' ? folderToEdit.name : undefined;

      const res = await api.post('/inventory/delete-folder', {
        brand: b,
        model: m,
        category: c,
        permanent: permanent && isSuperAdmin
      });

      toast.success(`✓ ${permanent ? 'Deleted' : 'Archived'} folder and ${res.affectedCount} contained items.`);

      // Reset path back if we deleted the current path
      if (folderToEdit.level === 'brand') {
        setNavPath({ brand: null, model: null, category: null });
      } else if (folderToEdit.level === 'model') {
        setNavPath(prev => ({ ...prev, model: null, category: null }));
      } else if (folderToEdit.level === 'category') {
        setNavPath(prev => ({ ...prev, category: null }));
      }

      setIsDeleteFolderOpen(false);
      setFolderToEdit(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete folder');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Archive Selected Items
  const handleBulkArchiveSubmit = async () => {
    if (selectedIds.length === 0) return;

    setSubmitting(true);
    try {
      await api.post('/inventory/bulk-archive', { ids: selectedIds });
      toast.success(`✓ Archived ${selectedIds.length} items.`);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive selected items');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Status Toggle (ACTIVE / INACTIVE)
  const handleBulkStatusToggle = async (status: 'ACTIVE' | 'INACTIVE') => {
    if (selectedIds.length === 0) return;

    setSubmitting(true);
    try {
      await api.post('/inventory/bulk-status', { ids: selectedIds, status });
      toast.success(`✓ Set status to ${status} for ${selectedIds.length} items.`);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update item status');
    } finally {
      setSubmitting(false);
    }
  };

  // Restore Single Item
  const handleRestoreItem = async (item: InventoryItemData) => {
    try {
      await api.post(`/inventory/${item.id}/restore`, {});
      toast.success(`✓ Restored "${item.name}" to active inventory.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore item');
    }
  };

  // Archive Single Item
  const handleArchiveSingleItem = async (item: InventoryItemData) => {
    if (!window.confirm(`Archive part "${item.name}"? Historical stock transaction records will be safely preserved.`)) {
      return;
    }
    try {
      await api.delete(`/inventory/${item.id}`);
      await deleteEntityFromRtdb('inventory', item.id);
      toast.success(`✓ Part "${item.name}" archived.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive item');
    }
  };

  // ==========================================
  // RENDER SECURITY CHECK
  // ==========================================

  if (!canManage && !isTechnician) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-rose-500" />
        <h2 className="text-2xl font-black text-slate-900">Restricted Access</h2>
        <p className="text-slate-500 max-w-md">Internal Inventory Management is restricted to authorized office personnel and technicians.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <Loader2 className="h-12 w-12 text-slate-400 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Opening Inventory Vault...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg shadow-black/10">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Internal Inventory Hub</h1>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] uppercase">
                  Production
                </Badge>
              </div>
              <p className="text-slate-500 font-medium text-xs md:text-sm">Hierarchical smartphone parts catalog, physical stock tracking & repair consumption</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <DashboardRefreshButton
            onRefresh={fetchData}
            showLastUpdated={false}
            size="sm"
            label="Refresh Stock"
          />

          {canManage && (
            <>
              <Button
                variant="outline"
                onClick={handleOpenNewFolder}
                className="rounded-2xl h-11 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs md:text-sm shadow-xs"
              >
                <FolderPlus className="mr-2 h-4 w-4 text-amber-500" />
                + New Folder
              </Button>

              <Button 
                onClick={handleOpenAddItem}
                className="rounded-2xl h-11 bg-black text-white hover:bg-slate-800 font-bold text-xs md:text-sm shadow-xl shadow-black/10 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                + Add Part / Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4 md:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">Total Parts</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.totalProducts}</span>
              <Badge className="bg-slate-100 text-slate-700 border-none font-bold text-[10px]">Catalog</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4 md:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">Physical Units</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.totalStockUnits}</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]">On Hand</Badge>
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
          className={cn(
            "rounded-3xl border-slate-200/80 bg-white shadow-xs cursor-pointer transition-all hover:scale-[1.02]",
            stockFilter === 'LOW_STOCK' && "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
          )}
        >
          <CardContent className="p-4 md:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-black tracking-wider uppercase text-amber-600">Low Stock Alert</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl md:text-3xl font-black text-amber-600">{stats.lowStockCount}</span>
              <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px] flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Alert
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
          className={cn(
            "rounded-3xl border-slate-200/80 bg-white shadow-xs cursor-pointer transition-all hover:scale-[1.02]",
            stockFilter === 'OUT_OF_STOCK' && "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20"
          )}
        >
          <CardContent className="p-4 md:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-black tracking-wider uppercase text-rose-600">Out of Stock</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl md:text-3xl font-black text-rose-600">{stats.outOfStockCount}</span>
              <Badge className="bg-rose-100 text-rose-800 border-none font-bold text-[10px] flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Empty
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1 rounded-3xl border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4 md:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-black tracking-wider uppercase text-indigo-600">Inventory Valuation</span>
            <div className="mt-2 flex flex-col">
              <span className="text-xl md:text-2xl font-black text-slate-900 truncate">
                {stats.totalValuation > 0 ? formatNPR(stats.totalValuation) : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">Calculated from purchase cost</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breadcrumb Navigation & Action Bar */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-3.5 md:p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 text-xs md:text-sm">
              <button
                onClick={() => { setNavPath({ brand: null, model: null, category: null }); setSearchTerm(''); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold transition-all shrink-0",
                  !navPath.brand && !searchTerm.trim()
                    ? "bg-black text-white shadow-xs" 
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Boxes className="h-4 w-4" />
                <span>All Brands</span>
              </button>

              {navPath.brand && (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  <button
                    onClick={() => setNavPath(prev => ({ ...prev, model: null, category: null }))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold transition-all shrink-0",
                      navPath.brand && !navPath.model
                        ? "bg-black text-white shadow-xs" 
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Folder className="h-3.5 w-3.5 text-amber-500" />
                    <span>{navPath.brand}</span>
                  </button>
                </>
              )}

              {navPath.model && (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  <button
                    onClick={() => setNavPath(prev => ({ ...prev, category: null }))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold transition-all shrink-0",
                      navPath.model && !navPath.category
                        ? "bg-black text-white shadow-xs" 
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{navPath.model}</span>
                  </button>
                </>
              )}

              {navPath.category && (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black bg-black text-white shadow-xs shrink-0">
                    <Layers className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{navPath.category}</span>
                  </span>
                </>
              )}

              {(navPath.brand || navPath.model || navPath.category) && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleGoBack}
                  className="rounded-xl ml-2 text-slate-500 hover:bg-slate-100 font-bold shrink-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Up Level
                </Button>
              )}
            </div>

            {/* View Mode & Sorters */}
            <div className="flex items-center gap-2 justify-end">
              {navPath.category && (
                <>
                  <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                    <SelectTrigger className="h-10 rounded-2xl border-slate-200 w-32 text-xs font-bold bg-slate-50/50">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="updatedAt">Recently Updated</SelectItem>
                      <SelectItem value="name">Part Name</SelectItem>
                      <SelectItem value="stock">Stock Level</SelectItem>
                      <SelectItem value="price">Purchase Cost</SelectItem>
                      <SelectItem value="sku">SKU Code</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="rounded-2xl h-10 w-10 border-slate-200 bg-slate-50/50"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-600" />
                  </Button>
                </>
              )}

              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    viewMode === 'grid' ? "bg-white text-black shadow-xs font-bold" : "text-slate-400 hover:text-slate-600"
                  )}
                  title="Grid View"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    viewMode === 'table' ? "bg-white text-black shadow-xs font-bold" : "text-slate-400 hover:text-slate-600"
                  )}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Universal Search Bar & Quick Stock Status Filters */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Universal Search across part name, brand, model, SKU, compatibility, supplier, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-2xl border-slate-200 bg-slate-50/50 text-sm focus:bg-white"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Stock Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'ALL', label: 'All Items' },
                { id: 'IN_STOCK', label: 'In Stock' },
                { id: 'LOW_STOCK', label: 'Low Stock Alerts' },
                { id: 'OUT_OF_STOCK', label: 'Out of Stock' },
                { id: 'ARCHIVED', label: 'Archived' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStockFilter(tab.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border",
                    stockFilter === tab.id 
                      ? "bg-black text-white border-black shadow-xs" 
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================= */}
      {/* 1. SEARCH RESULTS VIEW (If Search active) */}
      {/* ========================================================= */}
      {searchTerm.trim() ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
              Search Results ({searchResults.length} matches found)
            </h3>
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2">
                <Button size="xs" variant="outline" onClick={handleSelectAllCurrent} className="rounded-xl text-xs font-bold">
                  <CheckSquare className="h-3.5 w-3.5 mr-1" /> Select All
                </Button>
                {selectedIds.length > 0 && (
                  <Button size="xs" variant="ghost" onClick={handleClearSelection} className="rounded-xl text-xs text-rose-500 font-bold">
                    Clear Selection
                  </Button>
                )}
              </div>
            )}
          </div>

          {searchResults.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-2 border-slate-200 bg-white p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <Package className="h-12 w-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-slate-900">No Inventory Parts Found</h3>
                <p className="text-slate-500 text-xs">No parts match "{searchTerm}". Try a different keyword or catalog a new part.</p>
                <Button onClick={handleOpenAddItem} className="rounded-2xl bg-black text-white font-bold text-xs mt-2">
                  <Plus className="mr-2 h-4 w-4" /> Add Part
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {searchResults.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.includes(item.id)}
                  onToggleSelect={() => handleToggleSelectId(item.id)}
                  onOpenStockIn={() => handleOpenStockIn(item)}
                  onOpenStockOut={() => handleOpenStockOut(item)}
                  onOpenAdjust={() => handleOpenAdjustStock(item)}
                  onOpenEdit={() => handleOpenEditItem(item)}
                  onOpenHistory={() => handleOpenHistory(item)}
                  onOpenDetails={() => handleOpenDetails(item)}
                  onArchive={() => handleArchiveSingleItem(item)}
                  onRestore={() => handleRestoreItem(item)}
                  onJumpLocation={() => handleJumpToItemLocation(item)}
                  canManage={canManage}
                  canDelete={canDelete}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* 2. HIERARCHICAL FOLDERS & ITEMS VIEW */
        /* ========================================================= */
        <div className="space-y-6">
          {/* LEVEL 0: BRAND FOLDERS (At Root) */}
          {!navPath.brand && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">Smartphone Brands ({brandList.length})</h3>
                  <p className="text-xs text-slate-500 font-medium">Select a brand folder to explore supported device models and spare parts</p>
                </div>
              </div>

              {brandList.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 bg-white p-12 text-center">
                  <Folder className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-900">No Brand Folders Available</h3>
                  <p className="text-slate-500 text-xs mt-1">Create your first brand folder to organize parts.</p>
                  <Button onClick={handleOpenNewFolder} className="rounded-2xl bg-black text-white font-bold text-xs mt-4">
                    <FolderPlus className="mr-2 h-4 w-4" /> Create Brand Folder
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {brandList.map(b => (
                    <Card
                      key={b.brand}
                      onClick={() => handleSelectBrand(b.brand)}
                      className="rounded-3xl border-slate-200/80 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                            <Folder className="h-6 w-6 fill-amber-400 text-amber-500" />
                          </div>
                          {b.hasLowStock && (
                            <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Low Stock
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4">
                          <h4 className="font-extrabold text-slate-900 text-base group-hover:text-black transition-colors">{b.brand}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span>{b.modelCount} Model{b.modelCount === 1 ? '' : 's'}</span>
                            <span>•</span>
                            <span>{b.itemCount} Part{b.itemCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">Physical Units</span>
                          <span className="font-black text-slate-900">{b.totalUnits} pcs</span>
                        </div>
                      </CardContent>

                      {canManage && (
                        <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleOpenRenameFolder('brand', b.brand)}
                            className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-200"
                            title="Rename Brand"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => handleOpenDeleteFolder('brand', b.brand)}
                              className="rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Brand Folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 1: MODEL FOLDERS (Inside Selected Brand) */}
          {navPath.brand && !navPath.model && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">{navPath.brand} Models ({modelList.length})</h3>
                  <p className="text-xs text-slate-500 font-medium">Select a device model to manage parts & stock</p>
                </div>
              </div>

              {modelList.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 bg-white p-12 text-center">
                  <Smartphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-900">No Models for {navPath.brand}</h3>
                  <p className="text-slate-500 text-xs mt-1">Create a model folder (e.g. Galaxy S23 Ultra, iPhone 14 Pro) to add components.</p>
                  <Button onClick={handleOpenNewFolder} className="rounded-2xl bg-black text-white font-bold text-xs mt-4">
                    <FolderPlus className="mr-2 h-4 w-4" /> Create Model Folder
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {modelList.map(m => (
                    <Card
                      key={m.model}
                      onClick={() => handleSelectModel(m.model)}
                      className="rounded-3xl border-slate-200/80 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <Smartphone className="h-6 w-6" />
                          </div>
                          {m.hasLowStock && (
                            <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Low Stock
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4">
                          <h4 className="font-extrabold text-slate-900 text-base group-hover:text-black transition-colors">{m.model}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span>{m.categoryCount} Categories</span>
                            <span>•</span>
                            <span>{m.itemCount} Parts</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">Available Units</span>
                          <span className="font-black text-slate-900">{m.totalUnits} pcs</span>
                        </div>
                      </CardContent>

                      {canManage && (
                        <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleOpenRenameFolder('model', m.model)}
                            className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-200"
                            title="Rename Model"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => handleOpenDeleteFolder('model', m.model)}
                              className="rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Model Folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 2: CATEGORY FOLDERS (Inside Selected Model) */}
          {navPath.brand && navPath.model && !navPath.category && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">{navPath.brand} {navPath.model} Categories ({categoryList.length})</h3>
                  <p className="text-xs text-slate-500 font-medium">Select a part category to view parts and perform stock operations</p>
                </div>
              </div>

              {categoryList.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 bg-white p-12 text-center">
                  <Layers className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-900">No Categories Found for {navPath.model}</h3>
                  <p className="text-slate-500 text-xs mt-1">Create a category folder or add a new part.</p>
                  <div className="flex justify-center gap-3 mt-4">
                    <Button onClick={handleOpenNewFolder} variant="outline" className="rounded-2xl font-bold text-xs">
                      <FolderPlus className="mr-2 h-4 w-4 text-amber-500" /> Create Category
                    </Button>
                    <Button onClick={handleOpenAddItem} className="rounded-2xl bg-black text-white font-bold text-xs">
                      <Plus className="mr-2 h-4 w-4" /> Add Part
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {categoryList.map(c => (
                    <Card
                      key={c.category}
                      onClick={() => handleSelectCategory(c.category)}
                      className="rounded-3xl border-slate-200/80 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <Layers className="h-6 w-6" />
                          </div>
                          {c.hasLowStock && (
                            <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Low Stock
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4">
                          <h4 className="font-extrabold text-slate-900 text-base group-hover:text-black transition-colors">{c.category}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span>{c.itemCount} Item{c.itemCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">Current Stock</span>
                          <span className="font-black text-slate-900">{c.totalUnits} pcs</span>
                        </div>
                      </CardContent>

                      {canManage && (
                        <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleOpenRenameFolder('category', c.category)}
                            className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-200"
                            title="Rename Category"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => handleOpenDeleteFolder('category', c.category)}
                              className="rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Category Folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 3+: INDIVIDUAL INVENTORY ITEMS (Inside Selected Category) */}
          {navPath.brand && navPath.model && navPath.category && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {navPath.brand} {navPath.model} &bull; {navPath.category} ({currentFolderItems.length})
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Physical spare parts and restoration stock</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="xs" variant="outline" onClick={handleSelectAllCurrent} className="rounded-xl text-xs font-bold">
                    <CheckSquare className="h-3.5 w-3.5 mr-1" /> Select All
                  </Button>
                  {selectedIds.length > 0 && (
                    <Button size="xs" variant="ghost" onClick={handleClearSelection} className="rounded-xl text-xs text-rose-500 font-bold">
                      Clear Selection
                    </Button>
                  )}
                </div>
              </div>

              {currentFolderItems.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 bg-white p-12 text-center">
                  <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-900">No Parts in {navPath.category}</h3>
                  <p className="text-slate-500 text-xs mt-1">Catalog a new spare part for {navPath.brand} {navPath.model}.</p>
                  <Button onClick={handleOpenAddItem} className="rounded-2xl bg-black text-white font-bold text-xs mt-4">
                    <Plus className="mr-2 h-4 w-4" /> Add First Part
                  </Button>
                </Card>
              ) : viewMode === 'table' ? (
                /* Table View */
                <Card className="rounded-3xl border-slate-200/80 bg-white shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow className="border-slate-100">
                          <TableHead className="w-12 text-center py-4"></TableHead>
                          <TableHead className="font-extrabold text-slate-700 text-xs py-4">Part / Product Name</TableHead>
                          <TableHead className="font-extrabold text-slate-700 text-xs py-4">SKU & Specs</TableHead>
                          <TableHead className="font-extrabold text-slate-700 text-xs py-4 text-center">Current Stock</TableHead>
                          <TableHead className="font-extrabold text-slate-700 text-xs py-4 text-right">Purchase Cost</TableHead>
                          <TableHead className="font-extrabold text-slate-700 text-xs py-4 text-right">Selling Price</TableHead>
                          <TableHead className="font-extrabold text-slate-700 text-xs py-4 text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentFolderItems.map(item => {
                          const isLow = item.currentStock > 0 && item.currentStock <= item.minStockLevel;
                          const isOut = item.currentStock <= 0;
                          const isSelected = selectedIds.includes(item.id);

                          return (
                            <TableRow key={item.id} className={cn("border-slate-100 transition-colors", isSelected ? "bg-indigo-50/30" : "hover:bg-slate-50/50")}>
                              <TableCell className="py-4 text-center">
                                <button onClick={() => handleToggleSelectId(item.id)} className="text-slate-400 hover:text-black">
                                  {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4" />}
                                </button>
                              </TableCell>

                              <TableCell className="py-4" onClick={() => handleOpenDetails(item)}>
                                <div className="cursor-pointer">
                                  <span className="font-bold text-slate-900 text-sm block hover:underline">{item.name}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.storageLocation && (
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                        <MapPin className="inline-block h-2.5 w-2.5 mr-0.5" />
                                        {item.storageLocation}
                                      </span>
                                    )}
                                    {item.supplier && (
                                      <span className="text-[10px] text-slate-400">Vendor: {item.supplier}</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="py-4">
                                {item.sku && <span className="text-[11px] font-mono font-bold text-slate-700 block">{item.sku}</span>}
                                {item.compatibility && <span className="text-[10px] text-slate-400 block">{item.compatibility}</span>}
                              </TableCell>

                              <TableCell className="py-4 text-center">
                                <div className="flex flex-col items-center">
                                  <span className={cn(
                                    "font-black text-base",
                                    isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                                  )}>
                                    {item.currentStock} {item.unit || 'pc'}
                                  </span>
                                  {isOut ? (
                                    <Badge className="bg-rose-100 text-rose-800 border-none font-extrabold text-[10px] mt-0.5">OUT OF STOCK</Badge>
                                  ) : isLow ? (
                                    <Badge className="bg-amber-100 text-amber-800 border-none font-extrabold text-[10px] mt-0.5">LOW ({item.minStockLevel})</Badge>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Min: {item.minStockLevel}</span>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="py-4 text-right font-semibold text-xs text-slate-700">
                                {item.purchasePrice !== null && item.purchasePrice !== undefined ? formatNPR(item.purchasePrice) : <span className="text-slate-300 font-normal">N/A</span>}
                              </TableCell>

                              <TableCell className="py-4 text-right font-semibold text-xs text-slate-700">
                                {item.sellingPrice !== null && item.sellingPrice !== undefined ? formatNPR(item.sellingPrice) : <span className="text-slate-300 font-normal">N/A</span>}
                              </TableCell>

                              <TableCell className="py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    size="xs"
                                    onClick={() => handleOpenStockIn(item)}
                                    className="rounded-xl bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold"
                                    title="Stock In (+)"
                                  >
                                    <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> + Stock
                                  </Button>

                                  <Button
                                    size="xs"
                                    onClick={() => handleOpenStockOut(item)}
                                    disabled={item.currentStock <= 0}
                                    className="rounded-xl bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-bold disabled:opacity-40"
                                    title="Stock Out (-)"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> - Use
                                  </Button>

                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() => handleOpenAdjustStock(item)}
                                    className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-100"
                                    title="Physical Stock Adjustment"
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                  </Button>

                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() => handleOpenHistory(item)}
                                    className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-100"
                                    title="Stock Movement Logs"
                                  >
                                    <History className="h-3.5 w-3.5" />
                                  </Button>

                                  {canManage && (
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      onClick={() => handleOpenEditItem(item)}
                                      className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-100"
                                      title="Edit Specs"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}

                                  {canDelete && (
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      onClick={() => handleArchiveSingleItem(item)}
                                      className="rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                      title="Archive Part"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              ) : (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {currentFolderItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      onToggleSelect={() => handleToggleSelectId(item.id)}
                      onOpenStockIn={() => handleOpenStockIn(item)}
                      onOpenStockOut={() => handleOpenStockOut(item)}
                      onOpenAdjust={() => handleOpenAdjustStock(item)}
                      onOpenEdit={() => handleOpenEditItem(item)}
                      onOpenHistory={() => handleOpenHistory(item)}
                      onOpenDetails={() => handleOpenDetails(item)}
                      onArchive={() => handleArchiveSingleItem(item)}
                      onRestore={() => handleRestoreItem(item)}
                      canManage={canManage}
                      canDelete={canDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOATING BATCH SELECTION BAR */}
      {/* ========================================================= */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-black tracking-wider uppercase text-slate-300">
            {selectedIds.length} item{selectedIds.length === 1 ? '' : 's'} selected
          </span>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={handleOpenMoveSelected}
              className="rounded-xl border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs"
            >
              <MoveRight className="h-3.5 w-3.5 mr-1" /> Move
            </Button>

            <Button
              size="xs"
              variant="outline"
              onClick={() => handleBulkStatusToggle('ACTIVE')}
              className="rounded-xl border-slate-700 bg-slate-800 text-emerald-400 hover:bg-slate-700 font-bold text-xs"
            >
              Set Active
            </Button>

            <Button
              size="xs"
              variant="outline"
              onClick={() => handleBulkStatusToggle('INACTIVE')}
              className="rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs"
            >
              Set Inactive
            </Button>

            {canDelete && (
              <Button
                size="xs"
                variant="destructive"
                onClick={handleBulkArchiveSubmit}
                className="rounded-xl font-bold text-xs"
              >
                <Archive className="h-3.5 w-3.5 mr-1" /> Archive Selected
              </Button>
            )}

            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleClearSelection}
              className="rounded-xl text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: NEW FOLDER MODAL */}
      {/* ========================================================= */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-amber-500" /> Create Hierarchy Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Create a new Brand, Model, or Category branch in the inventory directory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFolderSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Brand Name <span className="text-rose-500">*</span></label>
              <Input
                required
                placeholder="e.g. Samsung, Apple, Xiaomi, Relife"
                value={folderFormData.brand}
                onChange={e => setFolderFormData({ ...folderFormData, brand: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Device Model (Optional)</label>
              <Input
                placeholder="e.g. Galaxy S23 Ultra, iPhone 14 Pro"
                value={folderFormData.model}
                onChange={e => setFolderFormData({ ...folderFormData, model: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Category Name (Optional)</label>
              <Select
                value={folderFormData.category}
                onValueChange={val => setFolderFormData({ ...folderFormData, category: val })}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm">
                  <SelectValue placeholder="Select or type custom category" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-56">
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsNewFolderOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-black text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderPlus className="h-4 w-4 mr-2" />}
                Create Folder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 2: ADD NEW INVENTORY PART */}
      {/* ========================================================= */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" /> Catalog New Part
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Folder context auto-applied from {navPath.brand || 'Root'}{navPath.model ? ` > ${navPath.model}` : ''}{navPath.category ? ` > ${navPath.category}` : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">Part / Product Name <span className="text-rose-500">*</span></label>
                <Input
                  required
                  placeholder="e.g. Samsung Galaxy S23 Ultra Dynamic AMOLED 2X Display Combo"
                  value={itemFormData.name}
                  onChange={e => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Brand <span className="text-rose-500">*</span></label>
                <Input
                  required
                  placeholder="e.g. Samsung"
                  value={itemFormData.brand}
                  onChange={e => setItemFormData({ ...itemFormData, brand: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Device Model</label>
                <Input
                  placeholder="e.g. Galaxy S23 Ultra"
                  value={itemFormData.model}
                  onChange={e => setItemFormData({ ...itemFormData, model: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Category <span className="text-rose-500">*</span></label>
                <Select
                  value={itemFormData.category}
                  onValueChange={val => setItemFormData({ ...itemFormData, category: val })}
                >
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-56">
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Part SKU / Barcode</label>
                <Input
                  placeholder="Auto-generated if left blank"
                  value={itemFormData.sku}
                  onChange={e => setItemFormData({ ...itemFormData, sku: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-mono"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">Device Compatibility</label>
                <Input
                  placeholder="e.g. Galaxy S23 Ultra / SM-S918B / SM-S918U"
                  value={itemFormData.compatibility}
                  onChange={e => setItemFormData({ ...itemFormData, compatibility: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Opening Physical Stock</label>
                <Input
                  type="number"
                  min="0"
                  value={itemFormData.currentStock}
                  onChange={e => setItemFormData({ ...itemFormData, currentStock: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-black"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Unit</label>
                <Select
                  value={itemFormData.unit}
                  onValueChange={val => setItemFormData({ ...itemFormData, unit: val })}
                >
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {UNIT_OPTIONS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Low Stock Alert Threshold</label>
                <Input
                  type="number"
                  min="0"
                  value={itemFormData.minStockLevel}
                  onChange={e => setItemFormData({ ...itemFormData, minStockLevel: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Storage Location / Rack</label>
                <Input
                  placeholder="e.g. Rack D-2, Drawer 04"
                  value={itemFormData.storageLocation}
                  onChange={e => setItemFormData({ ...itemFormData, storageLocation: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              {/* Financial Section */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Financial Records (Optional)</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Purchase / Cost Price (NPR)</label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Optional cost"
                      value={itemFormData.purchasePrice}
                      onChange={e => setItemFormData({ ...itemFormData, purchasePrice: e.target.value })}
                      className="h-10 rounded-xl border-slate-200 bg-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Selling Price (NPR)</label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Optional price"
                      value={itemFormData.sellingPrice}
                      onChange={e => setItemFormData({ ...itemFormData, sellingPrice: e.target.value })}
                      className="h-10 rounded-xl border-slate-200 bg-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Vendor / Supplier</label>
                <Input
                  placeholder="e.g. Korea Tech, Shenzhen Apex"
                  value={itemFormData.supplier}
                  onChange={e => setItemFormData({ ...itemFormData, supplier: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description / Specs</label>
                <Input
                  placeholder="Technical notes or specs"
                  value={itemFormData.description}
                  onChange={e => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddItemOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                disabled={submitting} 
                onClick={() => handleCreateItemSubmit(true)} 
                className="h-11 rounded-2xl border-slate-200 font-bold"
              >
                Save & Add Another
              </Button>
              <Button 
                type="button" 
                disabled={submitting} 
                onClick={() => handleCreateItemSubmit(false)} 
                className="h-11 rounded-2xl bg-black text-white hover:bg-slate-800 font-bold px-6"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Save Part
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 3: EDIT INVENTORY PART */}
      {/* ========================================================= */}
      <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-indigo-600" /> Edit Part Specifications
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Note: Stock quantity changes must be recorded via dedicated Stock In, Stock Out, or Stock Adjustment operations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditItemSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">Part Name <span className="text-rose-500">*</span></label>
                <Input
                  required
                  value={itemFormData.name}
                  onChange={e => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Brand</label>
                <Input
                  value={itemFormData.brand}
                  onChange={e => setItemFormData({ ...itemFormData, brand: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Model Number</label>
                <Input
                  value={itemFormData.model}
                  onChange={e => setItemFormData({ ...itemFormData, model: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Category</label>
                <Select
                  value={itemFormData.category}
                  onValueChange={val => setItemFormData({ ...itemFormData, category: val })}
                >
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-56">
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">SKU Code</label>
                <Input
                  value={itemFormData.sku}
                  onChange={e => setItemFormData({ ...itemFormData, sku: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-mono"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">Device Compatibility</label>
                <Input
                  value={itemFormData.compatibility}
                  onChange={e => setItemFormData({ ...itemFormData, compatibility: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Min Alert Threshold</label>
                <Input
                  type="number"
                  value={itemFormData.minStockLevel}
                  onChange={e => setItemFormData({ ...itemFormData, minStockLevel: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Storage Location</label>
                <Input
                  value={itemFormData.storageLocation}
                  onChange={e => setItemFormData({ ...itemFormData, storageLocation: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Purchase / Cost Price (NPR)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Optional"
                  value={itemFormData.purchasePrice}
                  onChange={e => setItemFormData({ ...itemFormData, purchasePrice: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Selling Price (NPR)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Optional"
                  value={itemFormData.sellingPrice}
                  onChange={e => setItemFormData({ ...itemFormData, sellingPrice: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Supplier Vendor</label>
                <Input
                  value={itemFormData.supplier}
                  onChange={e => setItemFormData({ ...itemFormData, supplier: e.target.value })}
                  className="h-11 rounded-2xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Status</label>
                <Select
                  value={itemFormData.status}
                  onValueChange={val => setItemFormData({ ...itemFormData, status: val })}
                >
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                    <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditItemOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-black text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Update Specifications'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 4: ATOMIC STOCK IN (+ ADD STOCK) */}
      {/* ========================================================= */}
      <Dialog open={isStockInOpen} onOpenChange={setIsStockInOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-emerald-600" /> Stock Intake (+1)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Increase physical inventory for <span className="font-bold text-slate-900">{selectedItem?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStockInSubmit} className="space-y-4 py-2">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Current Stock</span>
                <span className="text-2xl font-black text-emerald-900">{selectedItem?.currentStock} {selectedItem?.unit}s</span>
              </div>
              <Badge className="bg-emerald-200 text-emerald-900 font-bold border-none">Physical Stock</Badge>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Addition Quantity (+)</label>
              <Input
                type="number"
                min="1"
                required
                value={stockInForm.quantity}
                onChange={e => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                className="h-12 rounded-2xl border-slate-200 text-lg font-black text-emerald-600"
              />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {['1', '2', '5', '10', '25', '50', '100'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setStockInForm({ ...stockInForm, quantity: num })}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all"
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Vendor / Supplier</label>
              <Input
                placeholder="Supplier name"
                value={stockInForm.supplier}
                onChange={e => setStockInForm({ ...stockInForm, supplier: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Invoice / Shipment Reference</label>
              <Input
                placeholder="e.g. INV-8842, PO-9921"
                value={stockInForm.reference}
                onChange={e => setStockInForm({ ...stockInForm, reference: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm"
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStockInOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownLeft className="h-4 w-4 mr-2" />}
                Confirm Stock Addition
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 5: ATOMIC STOCK OUT (- CONSUME FOR REPAIR) */}
      {/* ========================================================= */}
      <Dialog open={isStockOutOpen} onOpenChange={setIsStockOutOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-indigo-600" /> Deduct Stock / Use in Repair
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Consume stock for <span className="font-bold text-slate-900">{selectedItem?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStockOutSubmit} className="space-y-4 py-2">
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">Available In Stock</span>
                <span className="text-2xl font-black text-indigo-900">{selectedItem?.currentStock} {selectedItem?.unit}s</span>
              </div>
              <Badge className="bg-indigo-200 text-indigo-900 font-bold border-none">On Hand</Badge>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Deduction Quantity (-)</label>
              <Input
                type="number"
                min="1"
                max={selectedItem?.currentStock || 1}
                required
                value={stockOutForm.quantity}
                onChange={e => setStockOutForm({ ...stockOutForm, quantity: e.target.value })}
                className="h-12 rounded-2xl border-slate-200 text-lg font-black text-indigo-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Reason</label>
              <Select
                value={stockOutForm.reason}
                onValueChange={val => setStockOutForm({ ...stockOutForm, reason: val })}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="Used for Customer Repair">Used for Customer Repair</SelectItem>
                  <SelectItem value="Testing & QA Inspection">Testing & QA Inspection</SelectItem>
                  <SelectItem value="Damaged / Defective">Damaged / Defective Part</SelectItem>
                  <SelectItem value="RMA Vendor Return">RMA Vendor Return</SelectItem>
                  <SelectItem value="Internal Branch Transfer">Internal Branch Transfer</SelectItem>
                  <SelectItem value="Other">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Associated Repair Number (Optional)</label>
              <Input
                placeholder="e.g. MTS-2026-0042"
                value={stockOutForm.repairNumber}
                onChange={e => setStockOutForm({ ...stockOutForm, repairNumber: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm font-mono"
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStockOutOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                Confirm Stock Deduction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 6: PHYSICAL STOCK ADJUSTMENT (AUDIT CORRECTION) */}
      {/* ========================================================= */}
      <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-amber-500" /> Physical Stock Count Adjustment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Perform audited physical inventory count correction for <span className="font-bold text-slate-900">{selectedItem?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdjustStockSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current System</span>
                <span className="text-xl font-black text-slate-800">{selectedItem?.currentStock} {selectedItem?.unit}s</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Calculated Delta</span>
                <span className={cn(
                  "text-xl font-black",
                  parseInt(adjustStockForm.newStock) - (selectedItem?.currentStock || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {parseInt(adjustStockForm.newStock) - (selectedItem?.currentStock || 0) > 0 ? '+' : ''}
                  {(parseInt(adjustStockForm.newStock) || 0) - (selectedItem?.currentStock || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Actual Physical Stock Count</label>
              <Input
                type="number"
                min="0"
                required
                value={adjustStockForm.newStock}
                onChange={e => setAdjustStockForm({ ...adjustStockForm, newStock: e.target.value })}
                className="h-12 rounded-2xl border-slate-200 text-lg font-black text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Adjustment Reason <span className="text-rose-500">*</span></label>
              <Select
                value={adjustStockForm.reason}
                onValueChange={val => setAdjustStockForm({ ...adjustStockForm, reason: val })}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="Physical Inventory Audit">Physical Inventory Audit</SelectItem>
                  <SelectItem value="Damaged / Broken Part Discarded">Damaged / Broken Part Discarded</SelectItem>
                  <SelectItem value="Initial System Stock Correction">Initial System Stock Correction</SelectItem>
                  <SelectItem value="Found Stock">Found Additional Stock</SelectItem>
                  <SelectItem value="Other">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Audit Notes</label>
              <Input
                placeholder="Reason details for audit trail"
                value={adjustStockForm.notes}
                onChange={e => setAdjustStockForm({ ...adjustStockForm, notes: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm"
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAdjustStockOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-black text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Save Physical Count'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 7: STOCK MOVEMENT TRANSACTION AUDIT HISTORY */}
      {/* ========================================================= */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" /> Stock Movement Audit Log
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete traceable history of all additions, consumptions, and adjustments for <span className="font-bold text-slate-900">{selectedItem?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {itemHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No stock movement logs recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {itemHistory.map((tx, idx) => (
                  <div key={tx.id || idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
                        tx.type === 'STOCK_IN' ? "bg-emerald-100 text-emerald-700" :
                        tx.type === 'STOCK_OUT' ? "bg-indigo-100 text-indigo-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {tx.type === 'STOCK_IN' ? '+' : '-'}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{tx.reason || tx.type}</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>By: {tx.performedByName || 'Staff'}</span>
                          {tx.repairNumber && (
                            <span className="bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.5 rounded font-bold">
                              Repair #{tx.repairNumber}
                            </span>
                          )}
                          <span>• {format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={cn(
                        "font-black text-sm block",
                        tx.type === 'STOCK_IN' ? "text-emerald-600" :
                        tx.type === 'STOCK_OUT' ? "text-indigo-600" : "text-amber-600"
                      )}>
                        {tx.type === 'STOCK_IN' ? '+' : '-'}{tx.quantity} {selectedItem?.unit || 'pcs'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {tx.previousStock} &rarr; {tx.newStock}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 8: ITEM DETAILS DRAWER / MODAL */}
      {/* ========================================================= */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" /> Part Specifications
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-2">
              <div>
                <h3 className="font-black text-slate-900 text-lg">{selectedItem.name}</h3>
                <p className="text-xs text-slate-500">{selectedItem.brand} {selectedItem.model ? `(${selectedItem.model})` : ''} &bull; {selectedItem.category}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SKU Code</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{selectedItem.sku || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Stock</span>
                  <span className="text-xs font-black text-emerald-600">{selectedItem.currentStock} {selectedItem.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Min Alert</span>
                  <span className="text-xs font-bold text-slate-700">{selectedItem.minStockLevel} {selectedItem.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cost Price</span>
                  <span className="text-xs font-bold text-slate-900">{selectedItem.purchasePrice ? formatNPR(selectedItem.purchasePrice) : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selling Price</span>
                  <span className="text-xs font-bold text-slate-900">{selectedItem.sellingPrice ? formatNPR(selectedItem.sellingPrice) : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Storage Location</span>
                  <span className="text-xs font-bold text-slate-900">{selectedItem.storageLocation || 'N/A'}</span>
                </div>
              </div>

              {selectedItem.compatibility && (
                <div className="p-3 bg-slate-100/60 rounded-2xl border border-slate-200/60 text-xs">
                  <span className="font-bold text-slate-700 block mb-0.5">Device Compatibility:</span>
                  <span className="text-slate-600">{selectedItem.compatibility}</span>
                </div>
              )}

              {selectedItem.description && (
                <div className="p-3 bg-slate-100/60 rounded-2xl border border-slate-200/60 text-xs">
                  <span className="font-bold text-slate-700 block mb-0.5">Description & Specs:</span>
                  <span className="text-slate-600">{selectedItem.description}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="xs" onClick={() => { setIsDetailsOpen(false); handleOpenStockIn(selectedItem); }} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> + Stock In
                </Button>
                <Button size="xs" onClick={() => { setIsDetailsOpen(false); handleOpenStockOut(selectedItem); }} disabled={selectedItem.currentStock <= 0} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> - Use Part
                </Button>
                <Button size="xs" variant="outline" onClick={() => { setIsDetailsOpen(false); handleOpenHistory(selectedItem); }} className="rounded-xl font-bold">
                  <History className="h-3.5 w-3.5 mr-1" /> History
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 9: RENAME FOLDER */}
      {/* ========================================================= */}
      <Dialog open={isRenameFolderOpen} onOpenChange={setIsRenameFolderOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-amber-500" /> Rename {folderToEdit?.level}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Renaming will cascade across all contained inventory items and subfolders.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenameFolderSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">New {folderToEdit?.level} Name</label>
              <Input
                required
                value={renameFolderName}
                onChange={e => setRenameFolderName(e.target.value)}
                className="h-11 rounded-2xl border-slate-200 text-sm font-bold"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRenameFolderOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-black text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 10: MOVE ITEMS MODAL */}
      {/* ========================================================= */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-indigo-600" /> Move {selectedIds.length} Items
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Relocate selected inventory items to a target brand, model, or category.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMoveSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Destination Brand <span className="text-rose-500">*</span></label>
              <Input
                required
                placeholder="e.g. Apple, Samsung, Xiaomi"
                value={moveTarget.targetBrand}
                onChange={e => setMoveTarget({ ...moveTarget, targetBrand: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Destination Model</label>
              <Input
                placeholder="e.g. Galaxy S23 Ultra, iPhone 14 Pro"
                value={moveTarget.targetModel}
                onChange={e => setMoveTarget({ ...moveTarget, targetModel: e.target.value })}
                className="h-11 rounded-2xl border-slate-200 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Destination Category</label>
              <Select
                value={moveTarget.targetCategory}
                onValueChange={val => setMoveTarget({ ...moveTarget, targetCategory: val })}
              >
                <SelectTrigger className="h-11 rounded-2xl border-slate-200 text-sm font-semibold">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-56">
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsMoveModalOpen(false)} className="h-11 rounded-2xl border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="h-11 rounded-2xl bg-black text-white font-bold px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MoveRight className="h-4 w-4 mr-2" />}
                Confirm Move
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 11: CASCADE DELETE FOLDER CONFIRMATION */}
      {/* ========================================================= */}
      <Dialog open={isDeleteFolderOpen} onOpenChange={setIsDeleteFolderOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Archive / Delete {folderToEdit?.level} Folder?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to remove <span className="font-bold text-slate-900">{folderToEdit?.name}</span>? Contained parts will be archived to protect stock history.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-2 text-xs text-rose-800">
            <p className="font-bold">⚠️ Impact Warning:</p>
            <p>All nested items under this folder branch will be archived and hidden from active stock view. Historical repair references will remain intact.</p>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" onClick={() => setIsDeleteFolderOpen(false)} className="h-11 rounded-2xl border-slate-200">
              Cancel
            </Button>
            <Button 
              type="button" 
              disabled={submitting} 
              onClick={() => handleDeleteFolderSubmit(false)} 
              className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-6"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Archive Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: INVENTORY ITEM CARD
// ==========================================

interface ItemCardProps {
  item: InventoryItemData;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenAdjust: () => void;
  onOpenEdit: () => void;
  onOpenHistory: () => void;
  onOpenDetails: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  onJumpLocation?: () => void;
  canManage: boolean;
  canDelete: boolean;
}

function ItemCard({
  item,
  isSelected,
  onToggleSelect,
  onOpenStockIn,
  onOpenStockOut,
  onOpenAdjust,
  onOpenEdit,
  onOpenHistory,
  onOpenDetails,
  onArchive,
  onRestore,
  onJumpLocation,
  canManage,
  canDelete
}: ItemCardProps) {
  const isLow = item.currentStock > 0 && item.currentStock <= item.minStockLevel;
  const isOut = item.currentStock <= 0;
  const isArchived = item.status === 'ARCHIVED';

  return (
    <Card className={cn(
      "rounded-3xl border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative",
      isSelected && "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/10"
    )}>
      <CardContent className="p-5 space-y-3">
        {/* Top Badges & Select Checkbox */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={onToggleSelect} className="text-slate-400 hover:text-black">
              {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4" />}
            </button>
            <Badge className="bg-slate-100 text-slate-700 border-none font-semibold text-[10px]">
              {item.category}
            </Badge>
          </div>

          {isArchived ? (
            <Badge className="bg-slate-200 text-slate-700 border-none font-bold text-[10px]">ARCHIVED</Badge>
          ) : isOut ? (
            <Badge className="bg-rose-100 text-rose-800 border-none font-bold text-[10px]">OUT OF STOCK</Badge>
          ) : isLow ? (
            <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px]">LOW STOCK ({item.minStockLevel})</Badge>
          ) : (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]">IN STOCK</Badge>
          )}
        </div>

        {/* Item Title & Specs */}
        <div onClick={onOpenDetails} className="cursor-pointer">
          <h4 className="font-bold text-slate-900 text-sm line-clamp-2 hover:underline">{item.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{item.brand} {item.model ? `(${item.model})` : ''}</p>
          {item.sku && <span className="text-[10px] text-slate-500 font-mono block mt-1">SKU: {item.sku}</span>}
        </div>

        {/* Breadcrumb Path Preview for Global Search */}
        {onJumpLocation && (
          <div 
            onClick={onJumpLocation}
            className="flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/80 px-2.5 py-1 rounded-xl cursor-pointer transition-colors font-semibold"
          >
            <span>{item.brand || 'Other'}</span>
            <span>&rsaquo;</span>
            <span>{item.model || 'Universal'}</span>
            <span>&rsaquo;</span>
            <span>{item.category}</span>
            <ExternalLink className="h-3 w-3 ml-auto opacity-70" />
          </div>
        )}

        {/* Stock & Cost Row */}
        <div className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quantity</span>
            <span className={cn(
              "text-xl font-black",
              isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
            )}>
              {item.currentStock} <span className="text-xs font-normal text-slate-500">{item.unit || 'pcs'}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Purchase Cost</span>
            <span className="text-xs font-bold text-slate-700">
              {item.purchasePrice !== null && item.purchasePrice !== undefined ? formatNPR(item.purchasePrice) : 'N/A'}
            </span>
          </div>
        </div>

        {item.storageLocation && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3 text-slate-400" />
            <span>{item.storageLocation}</span>
          </div>
        )}
      </CardContent>

      {/* Action Footer */}
      <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-1.5">
        {!isArchived ? (
          <>
            <Button
              size="xs"
              onClick={onOpenStockIn}
              className="flex-1 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
            >
              <ArrowDownLeft className="h-3 w-3 mr-1" /> + Add
            </Button>
            <Button
              size="xs"
              onClick={onOpenStockOut}
              disabled={item.currentStock <= 0}
              className="flex-1 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 disabled:opacity-40"
            >
              <ArrowUpRight className="h-3 w-3 mr-1" /> - Use
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onOpenAdjust}
              className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-200"
              title="Adjust Physical Count"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onOpenHistory}
              className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-200"
              title="View History"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            {canManage && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={onOpenEdit}
                className="rounded-xl text-slate-500 hover:text-black hover:bg-slate-200"
                title="Edit Specs"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={onArchive}
                className="rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                title="Archive Part"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        ) : (
          <Button
            size="xs"
            onClick={onRestore}
            className="w-full rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Restore to Active Stock
          </Button>
        )}
      </div>
    </Card>
  );
}
