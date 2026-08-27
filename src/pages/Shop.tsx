import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingBag, 
  Star, 
  Zap, 
  ChevronRight, 
  Package, 
  Wrench,
  Smartphone as PhoneIcon,
  ShoppingCart,
  CircleCheck as CheckCircle2,
  X,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  description?: string;
  price: number;
  discountPrice?: number | null;
  stockQuantity: number;
  imageUrl?: string;
  isFeatured?: boolean;
  isBestSeller?: boolean;
}

// Curated Genuine MTS Lab Accessories & Gadget Catalog
const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    name: 'Anker PowerPort 20W PD USB-C Fast Charger',
    category: 'Chargers & Power',
    description: 'High-speed 20W Power Delivery wall charger for iPhone, iPad, and Android flagship smartphones. Compact design with MultiProtect safety system.',
    price: 2490,
    discountPrice: 1990,
    stockQuantity: 25,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: true,
    isBestSeller: true
  },
  {
    id: 'prod-2',
    name: 'MTS Premium Wireless ANC Earbuds (Active Noise Cancelling)',
    category: 'Audio & Headphones',
    description: 'High-definition spatial audio with 30dB Active Noise Cancellation, Bluetooth 5.3 low latency connection, and 30-hour total playback.',
    price: 4990,
    discountPrice: 3990,
    stockQuantity: 18,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: true,
    isBestSeller: true
  },
  {
    id: 'prod-3',
    name: 'Shockproof Crystal Clear Armor Case (iPhone & Samsung Galaxy)',
    category: 'Mobile Covers & Cases',
    description: 'Military-grade drop protected transparent phone case with anti-yellowing German TPU and raised camera protection bezels.',
    price: 1200,
    discountPrice: 850,
    stockQuantity: 50,
    imageUrl: '/assets/images/back_glass_fix_1786719207185.jpg',
    isFeatured: false,
    isBestSeller: true
  },
  {
    id: 'prod-4',
    name: '9H Hardness Edge-to-Edge Tempered Glass Protector',
    category: 'Tempered Glass & Protection',
    description: 'Shatter-proof 9H tempered glass with oleophobic fingerprint coating and automatic dust-removal alignment tray.',
    price: 890,
    discountPrice: 650,
    stockQuantity: 100,
    imageUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
    isFeatured: true,
    isBestSeller: true
  },
  {
    id: 'prod-5',
    name: 'Braided Nylon 65W Fast Charging USB-C Cable (2m)',
    category: 'Cables & Adapters',
    description: 'Heavy-duty 10,000+ bend tested braided cable supporting 65W Power Delivery and high-speed data transmission.',
    price: 1450,
    discountPrice: 1100,
    stockQuantity: 40,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: false,
    isBestSeller: false
  },
  {
    id: 'prod-6',
    name: '20000mAh Ultra-Slim Fast Charge Power Bank (22.5W PD)',
    category: 'Gadgets & Electronics',
    description: 'Dual USB-A and USB-C bi-directional fast charging battery pack with LED digital battery percentage display.',
    price: 3890,
    discountPrice: 3290,
    stockQuantity: 15,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: true,
    isBestSeller: true
  }
];

function ShopContent() {
  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.get('/public/products');
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
      } else {
        setProducts(DEFAULT_PRODUCTS);
      }
    } catch (err: any) {
      console.warn('[SHOP NOTICE] Using offline / cached default catalog:', err?.message || err);
      setProducts(DEFAULT_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Safely extract unique categories
  const categories = useMemo(() => {
    const safeList = Array.isArray(products) ? products : DEFAULT_PRODUCTS;
    const extracted = safeList
      .map(p => p && typeof p.category === 'string' ? p.category.trim() : null)
      .filter((c): c is string => Boolean(c));
    return ['All', ...Array.from(new Set(['Chargers & Power', 'Audio & Headphones', 'Mobile Covers & Cases', 'Tempered Glass & Protection', 'Cables & Adapters', 'Gadgets & Electronics', ...extracted]))];
  }, [products]);

  // Safely filter products
  const filteredProducts = useMemo(() => {
    const safeList = Array.isArray(products) ? products : DEFAULT_PRODUCTS;
    const term = searchTerm.toLowerCase().trim();

    return safeList.filter(p => {
      if (!p) return false;
      const name = String(p.name || '').toLowerCase();
      const desc = String(p.description || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();

      const matchesSearch = !term || name.includes(term) || desc.includes(term) || cat.includes(term);
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
      <Navbar />

      {/* Hero Banner */}
      <section className="relative py-14 md:py-20 flex items-center justify-center overflow-hidden bg-slate-900 text-white pt-24 md:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_50%)]" />
        
        <div className="relative z-10 text-center space-y-3 px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <Badge className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full font-bold text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Genuine Accessories & Gadgets
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              MTS Lab Accessories Store
            </h1>
            <p className="text-slate-350 text-sm sm:text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              Explore authentic fast chargers, ANC earbuds, armor covers, 9H tempered glass, cables, and premium smartphone gadgets in Kathmandu.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 md:py-14 flex-1 w-full">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          
          {/* Sidebar Search & Categories */}
          <aside className="lg:w-64 space-y-6 shrink-0">
            {/* Search Box */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Search Store</h3>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Chargers, earbuds, covers..." 
                  className="pl-10 h-11 rounded-2xl bg-white border border-slate-200 shadow-xs focus-visible:ring-indigo-600 text-xs sm:text-sm font-medium"
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
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Categories</h3>
                {activeCategory !== 'All' && (
                  <button 
                    onClick={() => setActiveCategory('All')}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 lg:shrink cursor-pointer whitespace-nowrap lg:whitespace-normal ${
                      activeCategory === cat 
                        ? 'bg-slate-950 text-white shadow-md shadow-slate-950/10' 
                        : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-100'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 hidden lg:block transition-opacity ${activeCategory === cat ? 'opacity-100 text-indigo-400' : 'opacity-0'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Lab Support Card */}
            <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-3 shadow-lg border border-slate-800 hidden lg:block">
              <div className="p-2.5 bg-white/10 w-fit rounded-xl">
                 <Wrench className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black">Genuine Quality Assured</h4>
                <p className="text-xs text-slate-350 leading-relaxed font-medium">
                  Tested and verified smartphone accessories with warranty support at our Kathmandu lab.
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/contact'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-9 border-none shadow-xs cursor-pointer text-xs"
              >
                Contact Lab
              </Button>
            </div>
          </aside>

          {/* Product Catalog Grid */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
                  {activeCategory === 'All' ? 'All Accessories & Gadgets' : activeCategory}
                </h2>
                <p className="text-slate-500 font-medium text-xs mt-0.5">
                  Showing {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'} available in stock.
                </p>
              </div>

              {(searchTerm || activeCategory !== 'All') && (
                <Button 
                  variant="outline" 
                  onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}
                  className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs h-8 px-2.5 gap-1 cursor-pointer"
                >
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
            </div>

            {/* Loading Skeleton */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 animate-pulse">
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
              <div className="py-16 sm:py-24 flex flex-col items-center justify-center text-center gap-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs px-4">
                <div className="p-5 bg-slate-100 rounded-full">
                  <Package className="h-10 w-10 text-slate-300" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-lg font-black text-slate-900">No Products Found</h3>
                  <p className="text-slate-500 text-xs font-medium">
                    We could not find any accessories matching &ldquo;{searchTerm || activeCategory}&rdquo;. Try another search or reset your filters.
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
              /* SQUARE PRODUCT CARDS GRID */
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                {filteredProducts.map((product) => {
                  const effectivePrice = product.discountPrice || product.price || 0;
                  const originalPrice = product.price || 0;
                  const discountPercent = (originalPrice > effectivePrice && originalPrice > 0)
                    ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
                    : 0;

                  return (
                    <Card 
                      key={product.id}
                      className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-lg shadow-slate-200/50 bg-white overflow-hidden group hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between"
                    >
                      <div>
                        {/* Square Image Box (1:1 Ratio) */}
                        <div 
                          className="relative w-full aspect-square bg-slate-50 p-2.5 sm:p-3 overflow-hidden flex items-center justify-center cursor-pointer group-hover:bg-slate-100/60 transition-colors"
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

                        {/* Product Info */}
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
                          
                          <div className="flex flex-col pt-0.5">
                            <span className="text-sm sm:text-base font-black text-slate-950">
                              {formatNPR(effectivePrice)}
                            </span>
                            {discountPercent > 0 && (
                              <span className="text-[10px] sm:text-xs text-slate-400 line-through font-bold">
                                {formatNPR(originalPrice)}
                              </span>
                            )}
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
                            const msg = `Hello MTS Lab, I would like to inquire about purchasing: ${product.name} (Price: Rs. ${effectivePrice})`;
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
          </div>
        </div>
      </main>

      {/* Trust & Quality Assurance Section */}
      <section className="bg-white py-16 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div className="flex gap-4 sm:gap-5">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl h-fit border border-indigo-100/50 shrink-0">
               <Zap className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-base text-slate-900">Genuine Components</h4>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                We source tested, high-compatibility displays, batteries, and IC chips directly for flagship and everyday smartphones.
              </p>
            </div>
          </div>
          <div className="flex gap-4 sm:gap-5">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl h-fit border border-emerald-100/50 shrink-0">
               <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-base text-slate-900">Tested & Verified</h4>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                All premium replacement assemblies undergo strict multi-point laboratory testing and True Tone calibration prior to dispatch.
              </p>
            </div>
          </div>
          <div className="flex gap-4 sm:gap-5">
            <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl h-fit border border-purple-100/50 shrink-0">
               <ShoppingBag className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-base text-slate-900">Kathmandu Counter Pickup</h4>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
                Visit our Newroad laboratory for immediate counter pickup or request fast courier dispatch to all 77 districts of Nepal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none rounded-[32px] shadow-2xl bg-white">
          {selectedProduct && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Image Preview */}
              <div className="md:w-1/2 bg-slate-100 relative min-h-[260px] md:min-h-full">
                <img 
                  src={selectedProduct.imageUrl || '/assets/images/phone_repair_lab_1786719222650.jpg'} 
                  className="w-full h-full object-cover"
                  alt={selectedProduct.name}
                  onError={(e: any) => {
                    e.target.src = '/assets/images/phone_repair_lab_1786719222650.jpg';
                  }}
                />
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                  {selectedProduct.isFeatured && (
                    <Badge className="bg-white/95 backdrop-blur-md text-indigo-600 border-none font-black text-[9px] px-3 py-1 rounded-full shadow-md">
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

              {/* Product Info */}
              <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between bg-white overflow-y-auto space-y-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50/50 rounded-lg px-2.5 py-0.5">
                        {selectedProduct.category}
                       </Badge>
                       {selectedProduct.stockQuantity > 0 ? (
                         <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                           <CheckCircle2 className="h-3 w-3" /> In Stock
                         </div>
                       ) : (
                         <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                           <X className="h-3 w-3" /> Out of Stock
                         </div>
                       )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                      {selectedProduct.name}
                    </h2>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Description</h3>
                    <p className="text-slate-600 font-medium leading-relaxed text-xs sm:text-sm">
                      {selectedProduct.description || "High-precision replacement component verified by MTS Lab engineering team. Designed for maximum compatibility and durability."}
                    </p>
                  </div>

                  {/* Price Block */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-end justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (NPR)</p>
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl sm:text-3xl font-black text-slate-950">
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

                    <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/60 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Stock</span>
                        <span className="font-black text-slate-900">{selectedProduct.stockQuantity} Units</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Grade</span>
                        <span className="font-black text-slate-900">Lab Tested / OEM</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Ordering Buttons */}
                <div className="pt-4 flex gap-2.5">
                  <Button 
                    onClick={() => {
                      const msg = `Hello MTS Lab, I would like to order: ${selectedProduct.name} (Price: Rs. ${selectedProduct.discountPrice || selectedProduct.price})`;
                      window.open(`https://wa.me/9779869276668?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="flex-1 h-12 bg-slate-950 hover:bg-slate-850 text-white font-bold rounded-xl text-xs sm:text-sm gap-2 shadow-sm cursor-pointer"
                  >
                    <ShoppingCart className="h-4 w-4" /> Order on WhatsApp
                  </Button>
                  <Button 
                    onClick={() => window.location.href = 'tel:9869276668'}
                    variant="outline" 
                    className="h-12 w-12 p-0 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer shrink-0"
                    aria-label="Call MTS Lab"
                  >
                    <PhoneIcon className="h-4 w-4 text-slate-900" />
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
      fallbackTitle="Experience Store Unavailable" 
      fallbackDescription="A temporary issue occurred while loading the MTS Lab product store. Please retry or return to the homepage."
      returnUrl="/"
      returnLabel="Return to Homepage"
    >
      <ShopContent />
    </RouteErrorBoundary>
  );
}
