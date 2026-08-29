import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ShoppingBag, 
  Star, 
  Zap, 
  Smartphone, 
  Layers,
  ArrowRight,
  ChevronRight,
  Package,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/services/api';
import { formatNPR } from '@/lib/format';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { Smartphone as PhoneIcon, ShoppingCart, CircleCheck as CheckCircle2, X } from 'lucide-react';

export default function Shop() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await api.get('/public/products');
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Experience Store...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      {/* Premium Banner */}
      <section className="relative py-16 md:py-20 flex items-center justify-center overflow-hidden bg-slate-900 text-white pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="relative z-10 text-center space-y-4 px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <Badge className="bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full font-semibold text-xs tracking-wide">
              Official Store
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white">
              MTS Lab Store
            </h1>
            <p className="text-slate-400 text-base sm:text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
              Explore our collection of smartphone accessories, replacement parts, and repair solutions.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-20 flex-1 w-full">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 space-y-10">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Search Store</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Find parts..." 
                  className="pl-10 h-12 rounded-xl bg-white border-none shadow-sm focus-visible:ring-indigo-600"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Categories</h3>
              <div className="flex flex-col gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      activeCategory === cat 
                        ? 'bg-black text-white shadow-xl shadow-black/20 translate-x-2' 
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                    <ChevronRight className={`h-4 w-4 ${activeCategory === cat ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl border border-slate-800">
              <div className="p-3 bg-white/10 w-fit rounded-2xl">
                 <Wrench className="h-6 w-6 text-indigo-400" />
              </div>
              <h4 className="text-lg font-bold">Expert Installation</h4>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Buy genuine components and get high-precision calibrated installation at our Kathmandu laboratory.
              </p>
              <Button 
                onClick={() => window.location.href = '/contact'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-11 border-none shadow-sm cursor-pointer"
              >
                Contact Lab
              </Button>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 space-y-10">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Available Inventory</h2>
                <p className="text-slate-500 font-medium">Showing {filteredProducts.length} items for your device.</p>
              </div>
              <div className="hidden md:flex gap-2">
                 <Button variant="outline" className="rounded-xl font-bold h-10 border-slate-200">Featured First</Button>
                 <Button variant="outline" className="rounded-xl font-bold h-10 border-slate-200">New Arrivals</Button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-40 flex flex-col items-center justify-center text-center gap-6">
                <div className="p-10 bg-slate-100 rounded-full">
                  <Package className="h-16 w-16 text-slate-300" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900">No Items Found</h3>
                  <p className="text-slate-500 max-w-sm">We couldn't find any products matching your current filters.</p>
                </div>
                <Button variant="outline" onClick={() => {setActiveCategory('All'); setSearchTerm('');}} className="rounded-xl font-bold">Clear Filters</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="rounded-3xl border border-slate-200/80 shadow-md hover:shadow-xl shadow-slate-200/50 bg-white overflow-hidden group hover:scale-[1.01] transition-all duration-300">
                      <div className="relative h-60 overflow-hidden bg-slate-100">
                        <img 
                          src={product.imageUrl || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1780'} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          alt={product.name}
                        />
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                          {product.isFeatured && (
                            <Badge className="bg-white/95 backdrop-blur-md text-indigo-600 border-none font-bold text-[10px] px-3 py-1 rounded-full shadow-md">FEATURED</Badge>
                          )}
                          {product.isBestSeller && (
                            <Badge className="bg-amber-500 text-white border-none font-bold text-[10px] px-3 py-1 rounded-full shadow-md">BEST SELLER</Badge>
                          )}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/60 to-transparent">
                           <Button 
                             onClick={() => {
                               setSelectedProduct(product);
                               setIsDetailOpen(true);
                             }}
                             className="w-full bg-slate-950 hover:bg-slate-800 text-white rounded-xl h-10 text-xs font-bold shadow-lg cursor-pointer"
                           >
                             View Details
                           </Button>
                        </div>
                      </div>
                      <CardContent className="p-8 space-y-4" onClick={() => {
                        setSelectedProduct(product);
                        setIsDetailOpen(true);
                      }}>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{product.category}</p>
                          <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{product.name}</h3>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex flex-col">
                            <span className="text-2xl font-black text-slate-900">{formatNPR(product.discountPrice || product.price)}</span>
                            {product.discountPrice && (
                              <span className="text-xs text-slate-400 line-through font-bold">{formatNPR(product.price)}</span>
                            )}
                          </div>
                          <Badge variant={product.stockQuantity < 5 ? "destructive" : "secondary"} className="rounded-full px-3 font-bold text-[10px]">
                            {product.stockQuantity > 0 ? `${product.stockQuantity} IN STOCK` : 'OUT OF STOCK'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Trust Section */}
      <section className="bg-white py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex gap-6">
            <div className="p-4 bg-slate-50 rounded-2xl shrink-0">
               <Zap className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h5 className="font-bold text-lg mb-1">Genuine Parts</h5>
              <p className="text-slate-500 text-sm leading-relaxed">We source directly from manufacturers to ensure 100% compatibility and performance.</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="p-4 bg-slate-50 rounded-2xl shrink-0">
               <Star className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h5 className="font-bold text-lg mb-1">Tested & Verified</h5>
              <p className="text-slate-500 text-sm leading-relaxed">All premium components undergo strict multi-point laboratory testing and quality verification prior to dispatch.</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="p-4 bg-slate-50 rounded-2xl shrink-0">
               <ShoppingBag className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h5 className="font-bold text-lg mb-1">Local Support</h5>
              <p className="text-slate-500 text-sm leading-relaxed">Visit our Nepal branches for immediate pick-up and personalized technical consultation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-[40px] shadow-2xl">
          {selectedProduct && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Image Preview */}
              <div className="md:w-1/2 bg-slate-100 relative min-h-[300px]">
                <img 
                  src={selectedProduct.imageUrl || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1780'} 
                  className="w-full h-full object-cover"
                  alt={selectedProduct.name}
                />
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  {selectedProduct.isFeatured && (
                    <Badge className="bg-white/90 backdrop-blur-md text-indigo-600 border-none font-bold text-[10px] px-4 py-1.5 rounded-full shadow-lg">FEATURED</Badge>
                  )}
                  {selectedProduct.isBestSeller && (
                    <Badge className="bg-amber-500 text-white border-none font-bold text-[10px] px-4 py-1.5 rounded-full shadow-lg">BEST SELLER</Badge>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="md:w-1/2 p-10 flex flex-col justify-between bg-white overflow-y-auto">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50/50 rounded-lg px-3 py-1">
                        {selectedProduct.category}
                       </Badge>
                       {selectedProduct.stockQuantity > 0 ? (
                         <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                           <CheckCircle2 className="h-3 w-3" /> In Stock
                         </div>
                       ) : (
                         <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                           <X className="h-3 w-3" /> Out of Stock
                         </div>
                       )}
                    </div>
                    <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                      {selectedProduct.name}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Description</h3>
                    <p className="text-slate-600 font-medium leading-relaxed text-lg">
                      {selectedProduct.description || "High-precision replacement component verified by MTS Lab engineering team. Designed for maximum compatibility and performance."}
                    </p>
                  </div>

                  <div className="p-8 bg-slate-50 rounded-[32px] space-y-6">
                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Investment</p>
                        <div className="flex items-center gap-3">
                          <span className="text-4xl font-black text-slate-900">{formatNPR(selectedProduct.discountPrice || selectedProduct.price)}</span>
                          {selectedProduct.discountPrice && (
                            <span className="text-lg text-slate-400 line-through font-bold">{formatNPR(selectedProduct.price)}</span>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-indigo-600 text-white border-none font-bold px-4 py-2 rounded-xl h-fit">
                        {Math.round(((selectedProduct.price - (selectedProduct.discountPrice || selectedProduct.price)) / selectedProduct.price) * 100)}% OFF
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Availability</p>
                        <p className="text-lg font-black text-slate-900">{selectedProduct.stockQuantity} Units</p>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quality Grade</p>
                        <p className="text-lg font-black text-slate-900">OEM Grade</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex gap-3">
                  <Button 
                    onClick={() => {
                      const msg = `Hello MTS Lab, I would like to reserve/inquire about: ${selectedProduct.name} (Price: Rs. ${selectedProduct.discountPrice || selectedProduct.price})`;
                      window.open(`https://wa.me/9779869276668?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="flex-1 h-14 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-2xl text-base gap-2.5 shadow-md cursor-pointer"
                  >
                    <ShoppingCart className="h-5 w-5" /> Reserve on WhatsApp
                  </Button>
                  <Button 
                    onClick={() => window.location.href = 'tel:9869276668'}
                    variant="outline" 
                    className="h-14 w-14 p-0 rounded-2xl border-slate-200 hover:bg-slate-50 cursor-pointer"
                    aria-label="Call MTS Lab"
                  >
                    <PhoneIcon className="h-5 w-5 text-slate-900" />
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
