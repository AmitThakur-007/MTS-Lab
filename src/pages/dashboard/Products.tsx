import { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Loader2,
  Tag,
  Banknote,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { ImageUpload } from '@/components/ImageUpload';

import { toast } from 'sonner';
import { formatNPR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/services/realtime';
import DashboardRefreshButton from '@/components/DashboardRefreshButton';

export default function Products() {
  const { token } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    discountPrice: 0,
    category: '',
    stockQuantity: 0,
    imageUrl: '',
    isFeatured: false,
    isBestSeller: false
  });

  const fetchProducts = async () => {
    try {
      const data = await api.get('/products');
      setProducts(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);

  // Real-time synchronization across all devices
  useRealtimeSync(['product'], () => {
    fetchProducts();
  });

  const handleAddProduct = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/products', {
        ...newProduct,
        price: Number(newProduct.price),
        discountPrice: newProduct.discountPrice ? Number(newProduct.discountPrice) : null,
        stockQuantity: Number(newProduct.stockQuantity)
      });
      setIsAddDialogOpen(false);
      fetchProducts();
      toast.success('Product added successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProduct = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.put(`/products/${editingProduct.id}`, {
        ...editingProduct,
        price: Number(editingProduct.price),
        discountPrice: editingProduct.discountPrice ? Number(editingProduct.discountPrice) : null,
        stockQuantity: Number(editingProduct.stockQuantity)
      });
      setIsEditDialogOpen(false);
      fetchProducts();
      toast.success('Product updated successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
      toast.success('Product deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Product Inventory</h2>
          <p className="text-slate-500 font-medium text-lg">Manage your high-precision spare parts and accessories.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DashboardRefreshButton
            onRefresh={fetchProducts}
            size="default"
            label="Refresh Inventory"
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="h-14 px-8 rounded-2xl bg-black hover:bg-slate-800 text-white font-bold shadow-xl shadow-black/20" />}>
              <Plus className="mr-2 h-6 w-6" /> Add New Product
            </DialogTrigger>
          <DialogContent className="max-w-md rounded-[32px] p-8 border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Add Inventory Item</DialogTitle>
              <DialogDescription className="font-medium">Populate your laboratory with new components.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Product Name</label>
                <Input 
                  placeholder="e.g. iPhone 15 Ultra Display" 
                  className="h-12 rounded-xl bg-slate-50 border-slate-200"
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Description</label>
                <Input 
                  placeholder="e.g. Original replacement screen for iPhone 15 Ultra..." 
                  className="h-12 rounded-xl bg-slate-50 border-slate-200"
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unit Price (Rs.)</label>
                  <Input 
                    type="number"
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 font-mono font-bold"
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Initial Stock</label>
                  <Input 
                    type="number"
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                    value={newProduct.stockQuantity}
                    onChange={e => setNewProduct({...newProduct, stockQuantity: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Category Tag</label>
                <Input 
                  placeholder="e.g. Precision Displays" 
                  className="h-12 rounded-xl bg-slate-50 border-slate-200"
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Product Image</label>
                <ImageUpload 
                  value={newProduct.imageUrl || ''} 
                  onChange={(url) => setNewProduct({...newProduct, imageUrl: url})}
                  onRemove={() => setNewProduct({...newProduct, imageUrl: ''})}
                />
              </div>
              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-3 text-sm font-bold cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={newProduct.isFeatured}
                    onChange={e => setNewProduct({...newProduct, isFeatured: e.target.checked})}
                  />
                  <span className="group-hover:text-indigo-600 transition-colors">Featured Item</span>
                </label>
                <label className="flex items-center gap-3 text-sm font-bold cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-lg border-slate-300 text-orange-600 focus:ring-orange-500"
                    checked={newProduct.isBestSeller}
                    onChange={e => setNewProduct({...newProduct, isBestSeller: e.target.checked})}
                  />
                  <span className="group-hover:text-orange-600 transition-colors">Best Seller</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button disabled={submitting} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2" onClick={handleAddProduct}>
                 {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Finalize Selection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md rounded-[32px] p-8 border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Edit System Asset</DialogTitle>
              <DialogDescription className="font-medium">Modify the parameters of this component.</DialogDescription>
            </DialogHeader>
            {editingProduct && (
              <div className="space-y-5 py-4 overflow-y-auto max-h-[60vh] pr-2">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Product Name</label>
                  <Input 
                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Description</label>
                  <Input 
                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unit Price (Rs.)</label>
                    <Input 
                      type="number"
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 font-mono font-bold"
                      value={editingProduct.price}
                      onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Discount Price (Optional)</label>
                    <Input 
                      type="number"
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 font-mono font-bold"
                      value={editingProduct.discountPrice || 0}
                      onChange={e => setEditingProduct({...editingProduct, discountPrice: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Category Tag</label>
                    <Input 
                      className="h-12 rounded-xl bg-slate-50 border-slate-200"
                      value={editingProduct.category}
                      onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Stock Quantity</label>
                    <Input 
                      type="number"
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                      value={editingProduct.stockQuantity}
                      onChange={e => setEditingProduct({...editingProduct, stockQuantity: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Product Image</label>
                  <ImageUpload 
                    value={editingProduct.imageUrl || ''} 
                    onChange={(url) => setEditingProduct({...editingProduct, imageUrl: url})}
                    onRemove={() => setEditingProduct({...editingProduct, imageUrl: ''})}
                  />
                </div>
                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-3 text-sm font-bold cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={editingProduct.isFeatured}
                      onChange={e => setEditingProduct({...editingProduct, isFeatured: e.target.checked})}
                    />
                    <span className="group-hover:text-indigo-600 transition-colors">Featured Item</span>
                  </label>
                  <label className="flex items-center gap-3 text-sm font-bold cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-orange-600 focus:ring-orange-500"
                      checked={editingProduct.isBestSeller}
                      onChange={e => setEditingProduct({...editingProduct, isBestSeller: e.target.checked})}
                    />
                    <span className="group-hover:text-orange-600 transition-colors">Best Seller</span>
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button disabled={submitting} className="w-full h-14 bg-black hover:bg-slate-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2" onClick={handleEditProduct}>
                 {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update Inventory'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-[40px] border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
        <CardContent className="p-10">
          <div className="relative mb-8 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="Search components..." 
              className="pl-12 h-14 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="rounded-[32px] border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 px-8 py-5">Product Identity</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 px-8 py-5">Classification</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 px-8 py-5">Unit Price</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 px-8 py-5">Availability</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400 px-8 py-5">Strategic Badges</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shadow-sm border border-white">
                          <img src={p.imageUrl || "https://images.unsplash.com/photo-1556656793-062ff98782fe?w=100&h=100&q=80"} className="w-full h-full object-cover" alt="" />
                        </div>
                        <span className="font-bold text-slate-900">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-8">
                      <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 font-bold tracking-tight rounded-lg px-3 py-1">
                        {p.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8">
                      <div className="flex flex-col">
                        <span className="font-black font-mono text-slate-900 text-lg">{formatNPR(p.discountPrice || p.price)}</span>
                        {p.discountPrice && <span className="text-[10px] line-through text-slate-400 font-bold">{formatNPR(p.price)}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-8">
                      <Badge className={cn(
                        "font-bold text-[10px] tracking-widest border-none px-4 py-1.5 rounded-full",
                        p.stockQuantity < 5 
                          ? "bg-rose-100 text-rose-600" 
                          : p.stockQuantity < 20 
                            ? "bg-amber-100 text-amber-600"
                            : "bg-emerald-100 text-emerald-600"
                      )}>
                        {p.stockQuantity} UNITS
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8">
                      <div className="flex gap-2">
                        {p.isFeatured && <Badge className="bg-indigo-600 text-white border-none text-[10px] font-bold px-3 py-1 rounded-lg">FEATURED</Badge>}
                        {p.isBestSeller && <Badge className="bg-emerald-500 text-white border-none text-[10px] font-bold px-3 py-1 rounded-lg">BEST SELLER</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 hover:bg-slate-100 outline-none transition-colors">
                          <MoreVertical className="h-5 w-5 text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl w-48 p-2">
                           <DropdownMenuItem className="rounded-xl font-bold py-3" onClick={() => {
                             setEditingProduct({...p});
                             setIsEditDialogOpen(true);
                           }}>
                             <Edit className="mr-3 h-5 w-5" /> Edit Asset
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleDeleteProduct(p.id)} className="rounded-xl font-bold py-3 text-rose-600">
                             <Trash2 className="mr-3 h-5 w-5" /> Delete Asset
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
