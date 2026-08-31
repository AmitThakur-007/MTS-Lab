import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  ExternalLink,
  Layers,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';

export interface HomeSlideItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

const PRESET_IMAGES = [
  {
    name: 'Front Glass OCA Repair',
    url: '/assets/images/front-glass-change.jpg',
    category: 'Front Glass'
  },
  {
    name: 'Original Display Replacement',
    url: '/assets/images/display-replacement.jpg',
    category: 'Display'
  },
  {
    name: 'Laser Back Glass Replacement',
    url: '/assets/images/back-glass-change.jpg',
    category: 'Back Glass'
  },
  {
    name: 'IC Micro-Soldering & Lab',
    url: '/assets/images/motherboard-repair.jpg',
    category: 'Motherboard'
  }
];

export default function SlideshowManagement() {
  const { user } = useAuthStore();
  const [slides, setSlides] = useState<HomeSlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<HomeSlideItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    buttonText: 'Check Repair Price',
    buttonLink: '/services?focus=search',
    displayOrder: 1,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  const fetchSlides = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/slides');
      setSlides(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch slides:', err);
      toast.error(err?.response?.data?.error || 'Failed to load slideshow slides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  // Multi-device real-time sync for slideshow updates
  useRealtimeSync(['homeSlide'], () => {
    fetchSlides();
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      buttonText: 'Check Repair Price',
      buttonLink: '/services?focus=search',
      displayOrder: (slides.length > 0 ? Math.max(...slides.map(s => s.displayOrder)) + 1 : 1),
      status: 'ACTIVE'
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (slide: HomeSlideItem) => {
    setSelectedSlide(slide);
    setFormData({
      title: slide.title,
      description: slide.description || '',
      imageUrl: slide.imageUrl,
      buttonText: slide.buttonText || 'Check Repair Price',
      buttonLink: slide.buttonLink || '/services?focus=search',
      displayOrder: slide.displayOrder,
      status: slide.status
    });
    setIsEditOpen(true);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Supported formats
    const validExtensions = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!validExtensions.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
      toast.error('Image format is not supported. Please choose JPG, PNG, or WebP.');
      return;
    }

    // Size check (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image is too large. Maximum allowed size is 10MB.');
      return;
    }

    try {
      setUploadingImage(true);

      // Preferred fast method: Multipart FormData
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      try {
        const res = await api.post('/admin/slides/upload-image', uploadFormData);
        if (res && res.url) {
          setFormData(prev => ({ ...prev, imageUrl: res.url }));
          toast.success('Slide image uploaded successfully!');
          setUploadingImage(false);
          if (e.target) e.target.value = '';
          return;
        }
      } catch (formErr: any) {
        console.warn('FormData upload failed, trying Base64 fallback:', formErr);
      }

      // Fallback method: Base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Image = reader.result as string;
          const res = await api.post('/admin/slides/upload-image', { base64Image });
          if (res && res.url) {
            setFormData(prev => ({ ...prev, imageUrl: res.url }));
            toast.success('Slide image uploaded successfully!');
          } else {
            throw new Error('No URL returned by server');
          }
        } catch (upErr: any) {
          console.error('[SLIDE IMAGE UPLOAD ERROR]', upErr);
          const msg = upErr?.message || upErr?.error || 'Upload failed. Please try again.';
          toast.error(msg);
        } finally {
          setUploadingImage(false);
          if (e.target) e.target.value = '';
        }
      };
      reader.onerror = () => {
        setUploadingImage(false);
        toast.error('Image file could not be read. Please try another image.');
        if (e.target) e.target.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadingImage(false);
      toast.error(err?.message || 'Could not process image file. Please try again.');
      if (e.target) e.target.value = '';
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a slide title');
      return;
    }
    if (!formData.imageUrl.trim()) {
      toast.error('Please provide or upload a slide image');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/admin/slides', formData);
      toast.success('Hero slide created successfully');
      setIsCreateOpen(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create slide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlide) return;
    if (!formData.title.trim()) {
      toast.error('Please enter a slide title');
      return;
    }
    if (!formData.imageUrl.trim()) {
      toast.error('Please provide or upload a slide image');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/admin/slides/${selectedSlide.id}`, formData);
      toast.success('Hero slide updated successfully');
      setIsEditOpen(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update slide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (slide: HomeSlideItem) => {
    try {
      await api.patch(`/admin/slides/${slide.id}/toggle-status`, {});
      toast.success(`Slide "${slide.title}" is now ${slide.status === 'ACTIVE' ? 'Inactive' : 'Active'}`);
      fetchSlides();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to toggle status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSlide) return;
    try {
      setSubmitting(true);
      await api.delete(`/admin/slides/${selectedSlide.id}`);
      toast.success('Hero slide deleted successfully');
      setIsDeleteOpen(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to delete slide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveOrder = async (slide: HomeSlideItem, direction: 'up' | 'down') => {
    const sorted = [...slides].sort((a, b) => a.displayOrder - b.displayOrder);
    const currentIndex = sorted.findIndex(s => s.id === slide.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetSlide = sorted[targetIndex];
    const currentOrder = slide.displayOrder;
    const targetOrder = targetSlide.displayOrder;

    try {
      await api.put(`/admin/slides/${slide.id}`, { displayOrder: targetOrder });
      await api.put(`/admin/slides/${targetSlide.id}`, { displayOrder: currentOrder });
      toast.success('Slide order updated');
      fetchSlides();
    } catch (err) {
      toast.error('Failed to change slide order');
    }
  };

  const filteredSlides = slides.filter(slide =>
    slide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    slide.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = slides.filter(s => s.status === 'ACTIVE').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              Admin CMS
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {activeCount} Active / {slides.length} Total Slides
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hero Slideshow Management
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 max-w-2xl">
            Customize the smartphone repair banners and calls-to-action displayed on the MTS Lab Home Page.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={fetchSlides}
            disabled={loading}
            className="rounded-xl border-slate-200 hover:bg-slate-100 font-semibold text-xs sm:text-sm h-10 px-3 sm:px-4 gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm h-10 px-3.5 sm:px-4 gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Slide</span>
          </Button>
        </div>
      </div>

      {/* Info Notice & Search Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-base">Live Home Page Integration</h3>
            </div>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Active slides automatically rotate on the homepage. Only authentic smartphone repair visuals (Front Glass, AMOLED Display, Laser Back Glass, IC Soldering) should be uploaded.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open('/', '_blank')}
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold gap-1.5 shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Live Site
          </Button>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex flex-col justify-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Search Slides</span>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by slide title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Slides List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Layers className="h-5 w-5 text-slate-700" />
          Configured Slides ({filteredSlides.length})
        </h2>

        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-600">Loading slideshow records...</p>
          </div>
        ) : filteredSlides.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-4">
            <ImageIcon className="h-12 w-12 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">No slides found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery ? 'No slides match your search query.' : 'Get started by creating your first hero slideshow banner.'}
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="rounded-xl bg-slate-950 text-white font-bold">
              <Plus className="h-4 w-4 mr-2" /> Add First Slide
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredSlides.map((slide, index) => (
              <motion.div
                key={slide.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between h-full bg-white">
                  {/* Image Preview Header */}
                  <div className="relative h-44 sm:h-48 w-full bg-slate-900 overflow-hidden group">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1200';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Badges Overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="bg-black/60 backdrop-blur-md text-white border-white/20 text-[10px] font-bold px-2 py-0.5"
                      >
                        Order: #{slide.displayOrder}
                      </Badge>
                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 ${slide.status === 'ACTIVE'
                          ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white'
                          : 'bg-slate-500/90 text-white'
                          }`}
                      >
                        {slide.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Quick Order Actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-lg p-1 border border-white/10">
                      <button
                        onClick={() => handleMoveOrder(slide, 'up')}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 text-white hover:text-amber-400 disabled:opacity-30 disabled:hover:text-white transition-colors cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveOrder(slide, 'down')}
                        disabled={index === filteredSlides.length - 1}
                        title="Move Down"
                        className="p-1 text-white hover:text-amber-400 disabled:opacity-30 disabled:hover:text-white transition-colors cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Title Overlay in Image */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white font-bold text-base sm:text-lg leading-tight line-clamp-1 drop-shadow-md">
                        {slide.title}
                      </h3>
                      {slide.description && (
                        <p className="text-slate-300 text-xs mt-0.5 line-clamp-1 drop-shadow-sm">
                          {slide.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Content & Metadata */}
                  <CardContent className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Button Text</span>
                        <span className="font-bold text-slate-800 truncate block mt-0.5">
                          {slide.buttonText || 'Check Repair Price'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Destination URL</span>
                        <span className="font-bold text-slate-800 truncate block mt-0.5">
                          {slide.buttonLink || '/services?focus=search'}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(slide)}
                        className={`text-xs font-bold rounded-xl h-8 px-2.5 gap-1.5 cursor-pointer ${slide.status === 'ACTIVE'
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                      >
                        {slide.status === 'ACTIVE' ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Deactivate
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Activate
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(slide)}
                          className="h-8 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-600" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSlide(slide);
                            setIsDeleteOpen(true);
                          }}
                          className="h-8 px-2.5 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE SLIDE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-7 scrollbar-thin scrollbar-thumb-slate-300">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900">Add Hero Slide</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Create a new banner to highlight repair specialities on the MTS Lab home page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-6 pt-4">
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Slide Title <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Front Glass Change"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="rounded-xl h-11 text-sm font-medium border-slate-200"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Description / Subtext
                </label>
                <Textarea
                  placeholder="e.g. Specialized outer glass replacement preserving your original AMOLED / OLED display."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl min-h-[70px] text-sm font-medium border-slate-200"
                />
              </div>

              {/* Image Selection & Upload */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Slide Image <span className="text-red-500">*</span>
                </label>

                {/* Preset Fast Picks */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Pick from MTS Lab Professional Presets:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                        className={`relative h-20 rounded-xl overflow-hidden border-2 text-left transition-all group ${formData.imageUrl === preset.url
                          ? 'border-indigo-600 ring-2 ring-indigo-600/30'
                          : 'border-slate-200 hover:border-slate-400'
                          }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                        <span className="absolute bottom-1 left-1.5 right-1.5 text-[10px] font-bold text-white leading-tight drop-shadow truncate">
                          {preset.category}
                        </span>
                        {formData.imageUrl === preset.url && (
                          <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct URL or File Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Or Paste Image URL:</span>
                    <Input
                      placeholder="https://... or /assets/images/..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="rounded-xl h-10 text-sm border-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Or Upload from Computer:</span>
                    <label className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-700 transition-colors">
                      <Upload className={`h-4 w-4 ${uploadingImage ? 'animate-bounce' : ''}`} />
                      <span>{uploadingImage ? 'Uploading...' : 'Browse Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                </div>

                {/* Selected Image Preview */}
                {formData.imageUrl && (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold">
                      Selected Preview
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons & Order Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Button CTA Text
                  </label>
                  <Input
                    placeholder="Check Repair Price"
                    value={formData.buttonText}
                    onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                    className="rounded-xl h-10 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Button Link
                  </label>
                  <Input
                    placeholder="/services?focus=search"
                    value={formData.buttonLink}
                    onChange={(e) => setFormData({ ...formData, buttonLink: e.target.value })}
                    className="rounded-xl h-10 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Display Sequence
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })}
                    className="rounded-xl h-10 text-sm border-slate-200"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Publication Status
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(val: 'ACTIVE' | 'INACTIVE') => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="rounded-xl h-10 border-slate-200 text-sm font-medium">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active (Live on Home Page)</SelectItem>
                    <SelectItem value="INACTIVE">Inactive (Draft / Hidden)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl font-semibold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingImage}
                className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold shadow-sm"
              >
                {submitting ? 'Saving Slide...' : 'Create Slide'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT SLIDE DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-7 scrollbar-thin scrollbar-thumb-slate-300">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900">Edit Hero Slide</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Update banner details, typography, or visual asset for this slide.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-6 pt-4">
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Slide Title <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Front Glass Change"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="rounded-xl h-11 text-sm font-medium border-slate-200"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Description / Subtext
                </label>
                <Textarea
                  placeholder="e.g. Specialized outer glass replacement preserving your original AMOLED / OLED display."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl min-h-[70px] text-sm font-medium border-slate-200"
                />
              </div>

              {/* Image Selection & Upload */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Slide Image <span className="text-red-500">*</span>
                </label>

                {/* Preset Fast Picks */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Switch to MTS Lab Professional Preset:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                        className={`relative h-20 rounded-xl overflow-hidden border-2 text-left transition-all group ${formData.imageUrl === preset.url
                          ? 'border-indigo-600 ring-2 ring-indigo-600/30'
                          : 'border-slate-200 hover:border-slate-400'
                          }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                        <span className="absolute bottom-1 left-1.5 right-1.5 text-[10px] font-bold text-white leading-tight drop-shadow truncate">
                          {preset.category}
                        </span>
                        {formData.imageUrl === preset.url && (
                          <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct URL or File Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Image URL:</span>
                    <Input
                      placeholder="https://... or /assets/images/..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="rounded-xl h-10 text-sm border-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Upload New File:</span>
                    <label className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-700 transition-colors">
                      <Upload className={`h-4 w-4 ${uploadingImage ? 'animate-bounce' : ''}`} />
                      <span>{uploadingImage ? 'Uploading...' : 'Browse Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                </div>

                {/* Selected Image Preview */}
                {formData.imageUrl && (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold">
                      Current Preview
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons & Order Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Button CTA Text
                  </label>
                  <Input
                    placeholder="Check Repair Price"
                    value={formData.buttonText}
                    onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                    className="rounded-xl h-10 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Button Link
                  </label>
                  <Input
                    placeholder="/services?focus=search"
                    value={formData.buttonLink}
                    onChange={(e) => setFormData({ ...formData, buttonLink: e.target.value })}
                    className="rounded-xl h-10 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Display Sequence
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })}
                    className="rounded-xl h-10 text-sm border-slate-200"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Publication Status
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(val: 'ACTIVE' | 'INACTIVE') => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="rounded-xl h-10 border-slate-200 text-sm font-medium">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active (Live on Home Page)</SelectItem>
                    <SelectItem value="INACTIVE">Inactive (Draft / Hidden)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl font-semibold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingImage}
                className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold shadow-sm"
              >
                {submitting ? 'Saving...' : 'Update Slide'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md w-[92vw] sm:w-full rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">Delete Hero Slide</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-2">
              Are you sure you want to remove <span className="font-semibold text-slate-800">"{selectedSlide?.title}"</span> from the homepage slideshow? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-xl font-semibold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={submitting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {submitting ? 'Deleting...' : 'Delete Slide'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
