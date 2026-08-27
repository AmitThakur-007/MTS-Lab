import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingBag, 
  Zap, 
  ChevronRight, 
  Package, 
  Wrench,
  Smartphone as PhoneIcon,
  ShoppingCart,
  CircleCheck as CheckCircle2,
  X,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  ArrowUpDown,
  PhoneCall
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { api } from '@/services/api';
import { formatNPR } from '@/lib/format';
import { motion } from 'motion/react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  Dialog, 
  DialogContent, 
} from '@/components/ui/dialog';
import RouteErrorBoundary from '@/components/common/RouteErrorBoundary';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  sku?: string | null;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  stockQuantity: number;
  availability?: string;
  imageUrl?: string | null;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  createdAt?: string | Date;
}

const CATEGORIES = [
  'All',
  'Chargers & Power',
  'Audio & Headphones',
  'AirPods & Earbuds',
  'Mobile Covers & Cases',
  'Tempered Glass & Protection',
  'Cables & Adapters',
  'Power Banks & Wireless',
  'Gadgets & Electronics',
  'Others'
];

function ShopContent() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'PRICE_LOW_HIGH' | 'PRICE_HIGH_LOW' | 'NAME_AZ'>('NEWEST');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.get(`/public/products?_t=${Date.now()}`);
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.warn('[SHOP NOTICE] Failed to fetch shop products:', err?.message || err);
      setProducts([]);
      setFetchError('Unable to connect to store server. Please click retry below.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    const safeList = Array.isArray(products) ? products : [];
    const term = searchTerm.toLowerCase().trim();

    const filtered = safeList.filter(p => {
      if (!p) return false;
      const name = String(p.name || '').toLowerCase();
      const desc = String(p.description || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const brand = String(p.brand || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();

      const matchesSearch = !term || 
        name.includes(term) || 
        desc.includes(term) || 
        cat.includes(term) || 
        brand.includes(term) || 
        sku.includes(term);

      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });

    // Sorting
    return filtered.sort((a, b) => {
      const priceA = a.discountPrice || a.price || 0;
      const priceB = b.discountPrice || b.price || 0;

      if (sortBy === 'PRICE_LOW_HIGH') return priceA - priceB;
      if (sortBy === 'PRICE_HIGH_LOW') return priceB - priceA;
      if (sortBy === 'NAME_AZ') return a.name.localeCompare(b.name);
      // Default: NEWEST
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [products, searchTerm, activeCategory, sortBy]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
      <Navbar />

      {/* Header Banner */}
      <section className="relative py-12 md:py-16 flex items-center justify-center overflow-hidden bg-slate-950 text-white pt-24 md:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_50%)]" />
        
        <div className="relative z-10 text-center space-y-3 px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <Badge className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full font-bold text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Genuine Mobile Accessories & Gadgets
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              MTS Lab Store
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm md:text-base font-medium max-w-2xl mx-auto leading-relaxed">
              Explore lab-verified fast chargers, wireless ANC earbuds, armor covers, 9H glass, cables, and smart smartphone accessories in Kathmandu.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-10 flex-1 w-full space-y-6">
        
        {/* Top Controls: Search Bar + Sorting + Category Bar */}
        <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
          
          {/* Search and Sort Row */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search chargers, earbuds, covers, 25W, AirPods..." 
                className="pl-10 pr-9 h-11 rounded-xl bg-slate-50 border border-slate-200 focus-visible:ring-indigo-600 text-xs sm:text-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Sorting Dropdown */}
            <div className="w-full sm:w-56 shrink-0">
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    <SelectValue placeholder="Sort By" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl font-bold text-xs">
                  <SelectItem value="NEWEST">Newest Arrivals</SelectItem>
                  <SelectItem value="PRICE_LOW_HIGH">Price: Low to High</SelectItem>
                  <SelectItem value="PRICE_HIGH_LOW">Price: High to Low</SelectItem>
                  <SelectItem value="NAME_AZ">Name: A to Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category Filter Pills (Horizontal Scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-slate-950 text-white shadow-xs' 
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar Info Header */}
        <div className="flex items-center justify-between gap-4 px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
              {activeCategory === 'All' ? 'Available Products' : activeCategory}
            </h2>
            <p className="text-slate-500 font-medium text-xs mt-0.5">
              Showing {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'} in catalog.
            </p>
          </div>

          {(searchTerm || activeCategory !== 'All') && (
            <Button 
              variant="outline" 
              onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}
              className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs h-8 px-2.5 gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" /> Reset Filters
            </Button>
          )}
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-3 space-y-3 shadow-xs">
                <div className="w-full aspect-square bg-slate-100 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                  <div className="h-4 bg-slate-100 rounded-full w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty Catalog State */
          <div className="py-16 sm:py-24 flex flex-col items-center justify-center text-center gap-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs px-4">
            <div className="p-5 bg-slate-100 rounded-full">
              <Package className="h-10 w-10 text-slate-300" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-lg font-black text-slate-900">No Products Found</h3>
              <p className="text-slate-500 text-xs font-medium">
                We could not find any gadgets matching &ldquo;{searchTerm || activeCategory}&rdquo;. Try another search term or reset your filters.
              </p>
            </div>
            <Button 
              onClick={() => { setActiveCategory('All'); setSearchTerm(''); }} 
              className="bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-xs h-9 px-4 cursor-pointer shadow-xs"
            >
              View All Products
            </Button>
          </div>
        ) : (
          /* SQUARE PRODUCT CARDS ECOMMERCE GRID */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {filteredProducts.map((product) => {
              const effectivePrice = product.discountPrice || product.price || 0;
              const originalPrice = product.price || 0;
              const discountPercent = (originalPrice > effectivePrice && originalPrice > 0)
                ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
                : 0;

              return (
                <Card 
                  key={product.id}
                  className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-lg shadow-slate-200/50 bg-white overflow-hidden group hover:scale-[1.015] transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Square Image Box (1:1 Aspect Ratio) */}
                    <div 
                      className="relative w-full aspect-square bg-slate-50 p-3 overflow-hidden flex items-center justify-center cursor-pointer group-hover:bg-slate-100/70 transition-colors"
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDetailOpen(true);
                      }}
                    >
                      <img 
                        src={product.imageUrl || '/assets/images/phone_repair_lab_1786719222650.jpg'} 
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" 
                        alt={product.name}
                        onError={(e: any) => {
                          e.target.src = '/assets/images/phone_repair_lab_1786719222650.jpg';
                        }}
                      />

                      {/* Floating Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        {product.isFeatured && (
                          <Badge className="bg-indigo-600 text-white border-none font-black text-[8px] sm:text-[9px] px-2 py-0.5 rounded-full shadow-2xs">
                            FEATURED
                          </Badge>
                        )}
                        {product.isBestSeller && (
                          <Badge className="bg-amber-500 text-white border-none font-black text-[8px] sm:text-[9px] px-2 py-0.5 rounded-full shadow-2xs">
                            BEST SELLER
                          </Badge>
                        )}
                      </div>

                      {discountPercent > 0 && (
                        <div className="absolute top-2 right-2 z-10">
                          <Badge className="bg-rose-600 text-white border-none font-black text-[8px] sm:text-[9px] px-2 py-0.5 rounded-full shadow-2xs">
                            {discountPercent}% OFF
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Product Metadata */}
                    <CardContent 
                      className="p-3 sm:p-4 space-y-2 cursor-pointer" 
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDetailOpen(true);
                      }}
                    >
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-600 truncate">
                          {product.category || 'Accessories'}
                        </p>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-col">
                          <span className="text-sm sm:text-base font-black text-slate-950">
                            {formatNPR(effectivePrice)}
                          </span>
                          {discountPercent > 0 && (
                            <span className="text-[10px] sm:text-xs text-slate-400 line-through font-bold">
                              {formatNPR(originalPrice)}
                            </span>
                          )}
                        </div>

                        {/* Stock Availability Pill */}
                        <div className="shrink-0">
                          {product.stockQuantity > 5 ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In Stock
                            </span>
                          ) : product.stockQuantity > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Out of Stock
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-3 sm:p-4 pt-0 flex items-center gap-1.5">
                    <Button 
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDetailOpen(true);
                      }}
                      className="flex-1 bg-slate-950 hover:bg-slate-850 text-white rounded-xl h-8 sm:h-9 text-[11px] font-bold shadow-2xs cursor-pointer"
                    >
                      View Details
                    </Button>
                    <Button 
                      onClick={() => {
                        const msg = `Hello MTS Lab, I would like to order: ${product.name} (Price: Rs. ${effectivePrice})`;
                        window.open(`https://wa.me/9779869276668?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      variant="outline"
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-xl border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer shrink-0"
                      aria-label="Order on WhatsApp"
                    >
                      <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Quality Guarantee Banner */}
      <section className="bg-white py-12 border-t border-slate-200/80 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
               <Zap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-900">Lab-Tested Accessories</h4>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                All chargers, cables, and power banks undergo strict voltage & current testing in our Kathmandu lab.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
               <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-900">Warranty Support</h4>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                Enjoy hassle-free replacement warranty on eligible fast chargers, Bluetooth earbuds, and battery packs.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shrink-0">
               <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-900">Kathmandu & All Nepal Delivery</h4>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                Visit our Newroad lab for instant counter pickup or request fast courier dispatch to all 77 districts of Nepal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-[28px] sm:rounded-[32px] shadow-2xl bg-white">
          {selectedProduct && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Image Container (1:1 Ratio) */}
              <div className="md:w-1/2 bg-slate-50 relative p-6 flex items-center justify-center min-h-[260px] md:min-h-full">
                <img 
                  src={selectedProduct.imageUrl || '/assets/images/phone_repair_lab_1786719222650.jpg'} 
                  className="max-h-[280px] md:max-h-[340px] w-full object-contain"
                  alt={selectedProduct.name}
                  onError={(e: any) => {
                    e.target.src = '/assets/images/phone_repair_lab_1786719222650.jpg';
                  }}
                />
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                  {selectedProduct.isFeatured && (
                    <Badge className="bg-indigo-600 text-white border-none font-black text-[9px] px-3 py-1 rounded-full shadow-md">
                      FEATURED
                    </Badge>
                  )}
                  {selectedProduct.isBestSeller && (
                    <Badge className="bg-amber-500 text-white border-none font-black text-[9px] px-3 py-1 rounded-full shadow-md">
                      BEST SELLER
                    </Badge>
                  )}
                </div>
              </div>

              {/* Product Specifications & Details */}
              <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between bg-white overflow-y-auto space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                       <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50/50 rounded-lg px-2.5 py-0.5">
                        {selectedProduct.category}
                       </Badge>
                       {selectedProduct.stockQuantity > 0 ? (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                           <CheckCircle2 className="h-3 w-3" /> In Stock ({selectedProduct.stockQuantity})
                         </span>
                       ) : (
                         <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                           <X className="h-3 w-3" /> Out of Stock
                         </span>
                       )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-tight">
                      {selectedProduct.name}
                    </h2>
                    {selectedProduct.sku && (
                      <p className="text-[10px] font-mono font-bold text-slate-400">SKU: {selectedProduct.sku}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Description</h3>
                    <p className="text-slate-600 font-medium leading-relaxed text-xs sm:text-sm">
                      {selectedProduct.description || "High-quality genuine mobile accessory verified by MTS Lab. Built for high performance, safety, and durability."}
                    </p>
                  </div>

                  {/* Price Box */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-end justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price (NPR)</p>
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl font-black text-slate-950">
                            {formatNPR(selectedProduct.discountPrice || selectedProduct.price)}
                          </span>
                          {selectedProduct.discountPrice && (
                            <span className="text-xs text-slate-400 line-through font-bold">
                              {formatNPR(selectedProduct.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedProduct.discountPrice && selectedProduct.price > selectedProduct.discountPrice && (
                        <Badge className="bg-indigo-600 text-white border-none font-bold px-2.5 py-1 rounded-lg h-fit text-[10px]">
                          {Math.round(((selectedProduct.price - selectedProduct.discountPrice) / selectedProduct.price) * 100)}% OFF
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Ordering Buttons */}
                <div className="pt-2 flex gap-2.5">
                  <Button 
                    onClick={() => {
                      const msg = `Hello MTS Lab, I would like to order: ${selectedProduct.name} (Price: Rs. ${selectedProduct.discountPrice || selectedProduct.price})`;
                      window.open(`https://wa.me/9779869276668?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="flex-1 h-11 bg-slate-950 hover:bg-slate-850 text-white font-bold rounded-xl text-xs gap-2 shadow-xs cursor-pointer"
                  >
                    <ShoppingCart className="h-4 w-4" /> Order on WhatsApp
                  </Button>
                  <Button 
                    onClick={() => window.location.href = 'tel:9869276668'}
                    variant="outline" 
                    className="h-11 w-11 p-0 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer shrink-0"
                    aria-label="Call MTS Lab Desk"
                  >
                    <PhoneCall className="h-4 w-4 text-slate-900" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

export default function Shop() {
  return (
    <RouteErrorBoundary 
      fallbackTitle="Store Catalog Unavailable" 
      fallbackDescription="A temporary issue occurred while rendering the MTS Lab gadget store. Click below to reload."
      returnUrl="/"
      returnLabel="Return to Homepage"
    >
      <ShopContent />
    </RouteErrorBoundary>
  );
}
