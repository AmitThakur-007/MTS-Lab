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

// Curated Genuine MTS Lab Hardware & Accessory Catalog
const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    name: 'Genuine 120Hz AMOLED Screen Assembly (iPhone 13 / 14 Series)',
    category: 'Displays & Screens',
    description: 'Factory calibrated OLED panel with True Tone, 120Hz ProMotion response, and oleophobic coating. Precision tested in our Kathmandu lab.',
    price: 18500,
    discountPrice: 16500,
    stockQuantity: 12,
    imageUrl: '/assets/images/display_replace_1786719191504.jpg',
    isFeatured: true,
    isBestSeller: true
  },
  {
    id: 'prod-2',
    name: 'High-Capacity Certified Replacement Battery (5000mAh Class)',
    category: 'Batteries',
    description: 'Grade-A lithium polymer battery with intelligent protection IC, zero cycle count, and guaranteed 100% health calibration support.',
    price: 3800,
    discountPrice: 3200,
    stockQuantity: 25,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: true,
    isBestSeller: true
  },
  {
    id: 'prod-3',
    name: 'OEM Dynamic Island AMOLED Assembly (iPhone 15 Pro Max)',
    category: 'Displays & Screens',
    description: 'Ultra-bright 2000-nit original display module with ceramic shield glass and pre-installed sensor proximity bracket.',
    price: 34000,
    discountPrice: 31500,
    stockQuantity: 6,
    imageUrl: '/assets/images/display_replace_1786719191504.jpg',
    isFeatured: true,
    isBestSeller: false
  },
  {
    id: 'prod-4',
    name: 'Laser-Cut Rear Glass Housing (Flagship Matte Finish)',
    category: 'Housing & Glass',
    description: 'Precision molded back glass panel designed for seamless laser bonding without internal component disassembly.',
    price: 4500,
    discountPrice: 3800,
    stockQuantity: 18,
    imageUrl: '/assets/images/back_glass_fix_1786719207185.jpg',
    isFeatured: false,
    isBestSeller: true
  },
  {
    id: 'prod-5',
    name: 'Type-C SuperFast Charging Sub-Board Flex with Microphone',
    category: 'Charging & Flex Cables',
    description: 'Original charging dock FPC flex with moisture detection sensor, OTG line support, and gold-plated contacts.',
    price: 2400,
    discountPrice: 1950,
    stockQuantity: 30,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: false,
    isBestSeller: false
  },
  {
    id: 'prod-6',
    name: 'Optical Grade Sapphire Camera Lens Protector & Visor',
    category: 'Camera Modules',
    description: '9H hardness sapphire glass replacement protecting multi-camera OIS gyro modules from scratches and lens flare.',
    price: 1800,
    discountPrice: 1400,
    stockQuantity: 40,
    imageUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
    isFeatured: true,
    isBestSeller: false
  },
  {
    id: 'prod-7',
    name: 'MTS Lab Master IC Micro-Soldering Flux & Solder Wire Pack',
    category: 'Tools & Essentials',
    description: 'High-purity Japanese halogen-free no-clean soldering paste and lead-free micro-wire for precision logic board repairs.',
    price: 2900,
    discountPrice: 2450,
    stockQuantity: 15,
    imageUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    isFeatured: false,
    isBestSeller: true
  },
  {
    id: 'prod-8',
    name: 'Precision OCA Front Glass Lens with Polarizer Film',
    category: 'Housing & Glass',
    description: 'Factory molded replacement outer glass for vacuum lamination machines. Retains original display touch & color gamut.',
    price: 3200,
    discountPrice: 2800,
    stockQuantity: 22,
    imageUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
    isFeatured: false,
    isBestSeller: false
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
        // Use curated genuine defaults
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
    return ['All', ...Array.from(new Set(extracted))];
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
      <section className="relative py-16 md:py-24 flex items-center justify-center overflow-hidden bg-slate-900 text-white pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_50%)]" />
        
        <div className="relative z-10 text-center space-y-4 px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <Badge className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3.5 py-1 rounded-full font-bold text-xs tracking-wider uppercase inline-flex items-center gap-1.5 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Genuine Hardware & Accessories
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
              MTS Lab Store
            </h1>
            <p className="text-slate-350 text-base sm:text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
              Explore lab-tested smartphone replacement parts, genuine display assemblies, batteries, and repair components in Kathmandu.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 flex-1 w-full">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* Sidebar Search & Categories */}
          <aside className="lg:w-72 space-y-8 shrink-0">
            {/* Search Box */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Search Store</h3>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Find parts, screens, batteries..." 
                  className="pl-10 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs focus-visible:ring-slate-950 text-sm font-medium"
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
            <div className="space-y-3">
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
              <div className="flex flex-col gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                      activeCategory === cat 
                        ? 'bg-slate-950 text-white shadow-md shadow-slate-950/10 translate-x-1.5' 
                        : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-100'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-opacity ${activeCategory === cat ? 'opacity-100 text-indigo-400' : 'opacity-0'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Lab Installation Support Promo Card */}
            <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl border border-slate-800">
              <div className="p-3 bg-white/10 w-fit rounded-2xl">
                 <Wrench className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black">Expert Installation</h4>
                <p className="text-xs text-slate-350 leading-relaxed font-medium">
                  Buy genuine components and get high-precision calibrated installation at our Kathmandu laboratory.
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/contact'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-11 border-none shadow-sm cursor-pointer text-xs"
              >
                Contact Lab
              </Button>
            </div>
          </aside>

          {/* Product Catalog Grid */}
          <div className="flex-1 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                  {activeCategory === 'All' ? 'Available Hardware & Accessories' : activeCategory}
                </h2>
                <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
                  Showing {filteredProducts.length} verified item{filteredProducts.length === 1 ? '' : 's'} in inventory.
                </p>
              </div>

              {(searchTerm || activeCategory !== 'All') && (
                <Button 
                  variant="outline" 
                  onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}
                  className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs h-9 px-3 gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Clear Filters
                </Button>
              )}
            </div>

            {/* Loading Skeleton */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-3xl border border-slate-200/80 bg-white p-4 space-y-4 shadow-sm">
                    <div className="h-48 bg-slate-100 rounded-2xl" />
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                      <div className="h-5 bg-slate-100 rounded-full w-4/5" />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <div className="h-6 bg-slate-100 rounded-full w-1/2" />
                      <div className="h-6 bg-slate-100 rounded-full w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-24 sm:py-32 flex flex-col items-center justify-center text-center gap-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs px-4">
                <div className="p-6 bg-slate-100 rounded-full">
                  <Package className="h-12 w-12 text-slate-300" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-xl font-black text-slate-900">No Matching Products</h3>
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">
                    We could not find any products matching &ldquo;{searchTerm || activeCategory}&rdquo;. Try another search or reset your filters.
                  </p>
                </div>
                <Button 
                  onClick={() => { setActiveCategory('All'); setSearchTerm(''); }} 
                  className="bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-xs h-10 px-5 cursor-pointer shadow-sm"
                >
                  View All Products
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => {
                  const effectivePrice = product.discountPrice || product.price || 0;
                  const originalPrice = product.price || 0;
                  const discountPercent = (originalPrice > effectivePrice && originalPrice > 0)
                    ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
                    : 0;

                  return (
                    <Card 
                      key={product.id}
                      className="rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl shadow-slate-200/50 bg-white overflow-hidden group hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between"
                    >
                      <div>
                        {/* Product Image */}
                        <div 
                          className="relative h-52 overflow-hidden bg-slate-100 cursor-pointer"
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsDetailOpen(true);
                          }}
                        >
                          <img 
                            src={product.imageUrl || '/assets/images/phone_repair_lab_1786719222650.jpg'} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                            alt={product.name}
                            onError={(e: any) => {
                              e.target.src = '/assets/images/phone_repair_lab_1786719222650.jpg';
                            }}
                          />
                          <div className="absolute top-3.5 left-3.5 flex flex-col gap-1.5">
                            {product.isFeatured && (
                              <Badge className="bg-white/95 backdrop-blur-md text-indigo-600 border-none font-black text-[9px] px-2.5 py-0.5 rounded-full shadow-sm">
                                FEATURED
                              </Badge>
                            )}
                            {product.isBestSeller && (
                              <Badge className="bg-amber-500 text-white border-none font-black text-[9px] px-2.5 py-0.5 rounded-full shadow-sm">
                                BEST SELLER
                              </Badge>
                            )}
                          </div>

                          {discountPercent > 0 && (
                            <div className="absolute top-3.5 right-3.5">
                              <Badge className="bg-rose-600 text-white border-none font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                                {discountPercent}% OFF
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <CardContent 
                          className="p-5 space-y-3 cursor-pointer" 
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsDetailOpen(true);
                          }}
                        >
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                              {product.category || 'Components'}
                            </p>
                            <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                              {product.name}
                            </h3>
                          </div>
                          
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex flex-col">
                              <span className="text-xl font-black text-slate-950">
                                {formatNPR(effectivePrice)}
                              </span>
                              {discountPercent > 0 && (
                                <span className="text-xs text-slate-400 line-through font-bold">
                                  {formatNPR(originalPrice)}
                                </span>
                              )}
                            </div>
                            <Badge 
                              variant={product.stockQuantity < 5 ? "destructive" : "secondary"} 
                              className="rounded-full px-2.5 font-bold text-[9px]"
                            >
                              {product.stockQuantity > 0 ? `${product.stockQuantity} IN STOCK` : 'OUT OF STOCK'}
                            </Badge>
                          </div>
                        </CardContent>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-5 pt-0 flex gap-2">
                        <Button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsDetailOpen(true);
                          }}
                          className="flex-1 bg-slate-950 hover:bg-slate-850 text-white rounded-xl h-10 text-xs font-bold shadow-xs cursor-pointer"
                        >
                          View Details
                        </Button>
                        <Button 
                          onClick={() => {
                            const msg = `Hello MTS Lab, I would like to inquire about purchasing: ${product.name} (Price: Rs. ${effectivePrice})`;
                            window.open(`https://wa.me/9779869276668?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          variant="outline"
                          className="h-10 w-10 p-0 rounded-xl border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer shrink-0"
                          aria-label="Order on WhatsApp"
                        >
                          <ShoppingCart className="h-4 w-4" />
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
