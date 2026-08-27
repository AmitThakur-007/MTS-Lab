import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Package, 
  Tag, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Star, 
  Upload, 
  Loader2,
  Layers,
  ArrowUpDown,
  Filter,
  RefreshCw,
  ExternalLink
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
import { api } from '@/services/api';
import { normalizeRole } from '@/lib/rbac';
import { formatNPR } from '@/lib/format';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';
import { Link } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

export interface ShopProductRecord {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  brand?: string | null;
  model?: string | null;
  sku?: string | null;
  price: number;
  discountPrice?: number | null;
  stockQuantity: number;
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';
  imageUrl?: string | null;
  additionalImages?: string | null;
  status: 'PUBLISHED' | 'DRAFT' | 'HIDDEN' | 'ARCHIVED';
  isFeatured: boolean;
  isBestSeller: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

const CATEGORIES = [
  'Chargers & Power',
  'Audio & Headphones',
  'AirPods & Earbuds',
  'Mobile Covers & Cases',
  'Tempered Glass & Protection',
  'Cables & Adapters',
  'Power Banks & Wireless',
  'Gadgets & Electronics',
  'Tools & Essentials',
  'Others'
];

export function ShopManagementContent() {
  const { user } = useAuthStore();
  const normRole = normalizeRole(user?.role);
  const isSuperAdmin = normRole === 'SUPERADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'SUPERADMIN' || user?.email?.toLowerCase() === 'mtsmobilelab@gmail.com';
  const isAdmin = isSuperAdmin || normRole === 'ADMIN' || user?.role === 'ADMIN';

  // Data States
  const [products, setProducts] = useState<ShopProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ShopProductRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Displays & Screens',
    brand: '',
    model: '',
    sku: '',
    price: '',
    discountPrice: '',
    stockQuantity: '10',
    availability: 'IN_STOCK' as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER',
    imageUrl: '',
    status: 'PUBLISHED' as 'PUBLISHED' | 'DRAFT' | 'HIDDEN',
    isFeatured: false,
    isBestSeller: false,
    displayOrder: '0'
  });

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.get('/admin/products');
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('[SHOP MANAGEMENT FETCH ERROR]', err);
      const msg = err?.message || 'Failed to load shop products';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProducts();
    }
  }, [isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      description: '',
      category: 'Displays & Screens',
      brand: '',
      model: '',
      sku: '',
      price: '',
      discountPrice: '',
      stockQuantity: '10',
      availability: 'IN_STOCK',
      imageUrl: '',
      status: 'PUBLISHED',
      isFeatured: false,
      isBestSeller: false,
      displayOrder: '0'
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: ShopProductRecord) => {
    setActiveProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      category: product.category || 'Displays & Screens',
      brand: product.brand || '',
      model: product.model || '',
      sku: product.sku || '',
      price: String(product.price || 0),
      discountPrice: product.discountPrice ? String(product.discountPrice) : '',
      stockQuantity: String(product.stockQuantity ?? 0),
      availability: product.availability || 'IN_STOCK',
      imageUrl: product.imageUrl || '',
      status: product.status === 'ARCHIVED' ? 'DRAFT' : (product.status || 'PUBLISHED'),
      isFeatured: Boolean(product.isFeatured),
      isBestSeller: Boolean(product.isBestSeller),
      displayOrder: String(product.displayOrder ?? 0)
    });
    setIsEditModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image file size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        toast.success('Product image uploaded successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid non-negative price');
      return;
    }
    const stockNum = parseInt(formData.stockQuantity, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error('Please enter a valid non-negative stock quantity');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        brand: formData.brand.trim() || null,
        model: formData.model.trim() || null,
        sku: formData.sku.trim() || null,
        price: priceNum,
        discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : null,
        stockQuantity: stockNum,
        availability: formData.availability,
        imageUrl: formData.imageUrl || null,
        status: formData.status,
        isFeatured: formData.isFeatured,
        isBestSeller: formData.isBestSeller,
        displayOrder: parseInt(formData.displayOrder, 10) || 0
      };

      if (isEditModalOpen && activeProduct) {
        const updated = await api.put(`/admin/products/${activeProduct.id}`, payload);
        toast.success(`Updated "${updated.name}" successfully!`);
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        setIsEditModalOpen(false);
      } else {
        const created = await api.post('/admin/products', payload);
        toast.success(`Added "${created.name}" to Shop Catalog!`);
        setProducts(prev => [created, ...prev]);
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (product: ShopProductRecord) => {
    try {
      const updated = await api.patch(`/admin/products/${product.id}/toggle-publish`, {});
      toast.success(`Product "${product.name}" is now ${updated.status === 'PUBLISHED' ? 'Published' : 'Draft/Hidden'}.`);
      setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle status');
    }
  };

  const handleDeleteProduct = async () => {
    if (!activeProduct) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/products/${activeProduct.id}`);
      toast.success(`Product "${activeProduct.name}" permanently deleted.`);
      setProducts(prev => prev.filter(p => p.id !== activeProduct.id));
      setIsDeleteModalOpen(false);
      setActiveProduct(null);
      // Re-fetch authoritative list from server DB to verify state
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : [];
    return safeProducts.filter(product => {
      if (!product) return false;
      const term = (searchTerm || '').toLowerCase().trim();
      const name = String(product.name || '').toLowerCase();
      const sku = String(product.sku || '').toLowerCase();
      const category = String(product.category || '').toLowerCase();
      const brand = String(product.brand || '').toLowerCase();

      const matchesSearch = !term ||
        name.includes(term) ||
        sku.includes(term) ||
        category.includes(term) ||
        brand.includes(term);

      const matchesCategory = selectedCategory === 'ALL' || product.category === selectedCategory;
      const matchesStatus = selectedStatus === 'ALL' || product.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedStatus]);

  // Access Security Check
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6 bg-white p-10 rounded-3xl border border-slate-200 shadow-sm mt-8">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Access Denied</h2>
          <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-md mx-auto">
            Shop Management administration is strictly restricted to authorized Super Administrators and Administrators.
          </p>
        </div>
        <div className="pt-2">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-6 text-sm transition-all"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 px-2 sm:px-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-300">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 font-bold uppercase tracking-wider text-[10px]">
                MTS Lab Storefront CMS
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Shop Management
            </h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Add, update, publish, and manage hardware products, batteries, and screens displayed on the public MTS Lab Shop catalog.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-11 px-4 rounded-xl backdrop-blur-md font-bold text-xs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 px-5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by product name, SKU, category, brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl border-slate-200 focus:border-indigo-500 text-sm"
          />
        </div>

        {/* Category & Status Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="HIDDEN">Hidden</option>
          </select>

          <Link
            to="/shop"
            target="_blank"
            className="h-11 px-4 inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            View Public Shop
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {fetchError && !loading ? (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-rose-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Unable to load Shop Management</h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              {fetchError}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              onClick={fetchProducts}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 rounded-xl text-xs gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Request
            </Button>
            <Link
              to="/dashboard"
              className="h-10 px-5 inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Shop Products Catalog...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">No Products Found</h3>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              {searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
                ? 'No shop products match your current search or filter criteria.'
                : 'Your Shop Management catalog is currently empty. Add your first product to display it on the public Shop page!'}
            </p>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 rounded-xl text-xs"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Product
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Product</th>
                  <th className="py-4 px-4">Category & Brand</th>
                  <th className="py-4 px-4">Price</th>
                  <th className="py-4 px-4">Stock & Status</th>
                  <th className="py-4 px-4 text-center">Order</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Product & Image */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{product.name}</span>
                            {product.isFeatured && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] font-bold px-1.5 py-0">
                                Featured
                              </Badge>
                            )}
                            {product.isBestSeller && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[9px] font-bold px-1.5 py-0">
                                Best Seller
                              </Badge>
                            )}
                          </div>
                          {product.sku && (
                            <p className="text-[11px] font-mono text-slate-400">SKU: {product.sku}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category & Brand */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-semibold text-[10px]">
                          {product.category}
                        </Badge>
                        {(product.brand || product.model) && (
                          <p className="text-[11px] text-slate-500">
                            {product.brand} {product.model ? `(${product.model})` : ''}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <div className="font-black text-slate-900 text-sm">
                          {formatNPR(product.discountPrice || product.price)}
                        </div>
                        {product.discountPrice && product.discountPrice < product.price && (
                          <div className="text-[11px] text-slate-400 line-through">
                            {formatNPR(product.price)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Stock & Status */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 border ${
                          product.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : product.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {product.status}
                        </Badge>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          Stock: {product.stockQuantity ?? 0} ({(product.availability || 'IN_STOCK').replace(/_/g, ' ')})
                        </span>
                      </div>
                    </td>

                    {/* Display Order */}
                    <td className="py-4 px-4 text-center font-bold text-slate-600">
                      {product.displayOrder}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleTogglePublish(product)}
                          variant="ghost"
                          size="icon"
                          title={product.status === 'PUBLISHED' ? 'Unpublish / Draft' : 'Publish to Shop'}
                          className="h-8 w-8 text-slate-600 hover:bg-slate-100"
                        >
                          {product.status === 'PUBLISHED' ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                        </Button>

                        <Button
                          onClick={() => openEditModal(product)}
                          variant="ghost"
                          size="icon"
                          title="Edit Product"
                          className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>

                        <Button
                          onClick={() => {
                            setActiveProduct(product);
                            setIsDeleteModalOpen(true);
                          }}
                          variant="ghost"
                          size="icon"
                          title="Archive Product"
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredProducts.map(product => (
              <div key={product.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="font-bold text-slate-900 text-sm leading-snug">
                      {product.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px] font-semibold bg-slate-50">
                        {product.category}
                      </Badge>
                      <Badge className={`text-[9px] font-bold px-1.5 py-0 border ${
                        product.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {product.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-xs">
                  <div>
                    <span className="font-black text-slate-900 text-sm">
                      {formatNPR(product.discountPrice || product.price)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2">Stock: {product.stockQuantity}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleTogglePublish(product)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-slate-700"
                    >
                      {product.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
                    </Button>
                    <Button
                      onClick={() => openEditModal(product)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-indigo-600"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => {
                        setActiveProduct(product);
                        setIsDeleteModalOpen(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 px-2.5 text-xs text-rose-600"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              {isEditModalOpen ? 'Edit Shop Product' : 'Add New Product to Shop'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure product details, pricing, stock, images, and public storefront availability.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-4 pt-2">
            {/* Product Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Product Name *</label>
              <Input
                type="text"
                required
                placeholder="e.g. Genuine 120Hz AMOLED Screen Assembly (iPhone 14)"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            {/* Category & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Brand / Manufacturer</label>
                <Input
                  type="text"
                  placeholder="e.g. Apple, Samsung, MTS Pro"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Model & SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Model Compatibility</label>
                <Input
                  type="text"
                  placeholder="e.g. iPhone 14 Pro Max / Galaxy S23"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">SKU Code</label>
                <Input
                  type="text"
                  placeholder="e.g. MTS-SCR-IP14PM"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {/* Price & Discount Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Regular Price (NPR) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="18500"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="h-10 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Discount Price (NPR optional)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="16500"
                  value={formData.discountPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountPrice: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Stock Quantity & Availability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Stock Quantity *</label>
                <Input
                  type="number"
                  min="0"
                  required
                  placeholder="10"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, stockQuantity: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Availability Status</label>
                <select
                  value={formData.availability}
                  onChange={(e) => setFormData(prev => ({ ...prev, availability: e.target.value as any }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                >
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                  <option value="PRE_ORDER">Pre-Order</option>
                </select>
              </div>
            </div>

            {/* Product Image & Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Product Image URL / Upload</label>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder="https://... or upload below"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="h-10 rounded-xl text-xs flex-1"
                />
                <label className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer border border-slate-200 flex-shrink-0">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              {formData.imageUrl && (
                <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 mt-1">
                  <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Status & Display Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Public Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                >
                  <option value="PUBLISHED">Published (Visible on Shop)</option>
                  <option value="DRAFT">Draft (Internal Only)</option>
                  <option value="HIDDEN">Hidden</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Display Order</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description</label>
              <textarea
                rows={3}
                placeholder="Enter detailed hardware specs, warranty terms, or installation notes..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Badges / Checkboxes */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                Featured Product
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isBestSeller}
                  onChange={(e) => setFormData(prev => ({ ...prev, isBestSeller: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                Best Seller
              </label>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="h-10 px-4 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 rounded-xl text-xs"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isEditModalOpen ? 'Save Changes' : 'Publish Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <Trash2 className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-lg font-black text-slate-900">Delete Product?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              This product <strong className="text-slate-900">"{activeProduct?.name}"</strong> and its associated Shop data will be permanently deleted. This action cannot be undone.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-3 justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              className="h-10 px-4 text-xs font-bold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold h-10 px-5 rounded-xl text-xs"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ShopManagement() {
  return (
    <ErrorBoundary
      fallbackTitle="Something went wrong in Shop Management. Please try again."
      fallbackMessage="An unexpected rendering issue occurred in Shop Management. Click below to reload your shop catalog safely."
      showBackHome={true}
    >
      <ShopManagementContent />
    </ErrorBoundary>
  );
}
