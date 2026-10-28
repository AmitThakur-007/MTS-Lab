import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
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
  Search,
  Copy,
  Calendar,
  Clock,
  Sliders,
  ShieldCheck,
  Tag,
  Monitor,
  Tv,
  Tablet,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  X
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeSync } from '@/services/realtime';
import { cn } from '@/lib/utils';

export interface HomeSlideItem {
  id: string;
  title: string;
  category?: string;
  description: string | null;
  imageUrl: string;
  desktopImage?: string | null;
  mobileImage?: string | null;
  buttonText?: string;
  buttonLink?: string;
  primaryButtonText?: string;
  primaryButtonUrl?: string;
  secondaryButtonText?: string | null;
  secondaryButtonUrl?: string | null;
  featureTags?: string[] | null;
  textAlignment?: 'left' | 'center' | 'right';
  contentPosition?: 'left' | 'center' | 'right';
  overlayStrength?: 'subtle' | 'medium' | 'strong' | 'cinematic' | number;
  themeColor?: 'dark' | 'light' | 'auto';
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'SCHEDULED';
  autoRotate?: number;
  publishStartAt?: string | null;
  publishEndAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const PRESET_IMAGES = [
  {
    name: 'Front Glass OCA Repair',
    category: 'Smartphone Screen Restoration',
    desktopUrl: '/assets/images/front_glass_repair_1786719176945.jpg',
    mobileUrl: '/assets/images/front-glass-change.jpg',
  },
  {
    name: 'Original Display Replacement',
    category: 'AMOLED & ProMotion Lab',
    desktopUrl: '/assets/images/display_replace_1786719191504.jpg',
    mobileUrl: '/assets/images/display-replacement.jpg',
  },
  {
    name: 'Laser Back Glass & Frame',
    category: 'Laser Housing & Chassis Fix',
    desktopUrl: '/assets/images/back_glass_fix_1786719207185.jpg',
    mobileUrl: '/assets/images/back-glass-change.jpg',
  },
  {
    name: 'IC Micro-Soldering Lab',
    category: 'Chip-Level Engineering',
    desktopUrl: '/assets/images/phone_repair_lab_1786719222650.jpg',
    mobileUrl: '/assets/images/motherboard-repair.jpg',
  },
  {
    name: 'iPad & Tablet Screen Lab',
    category: 'iPad & Tablet Specialist',
    desktopUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=1600',
    mobileUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=800',
  },
  {
    name: 'Smart TV & Monitor Panel Fix',
    category: 'Smart TV Screen Service',
    desktopUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=1600',
    mobileUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=800',
  }
];

export default function SlideshowManagement() {
  const { user } = useAuthStore();
  const [slides, setSlides] = useState<HomeSlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'SCHEDULED'>('ALL');

  // Modal dialog states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<HomeSlideItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  // Live Preview Device Switcher Viewport: 'mobile' (375px) | 'landscape' (667px) | 'tablet' (768px) | 'desktop' (1200px) | 'tv' (1600px)
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'landscape' | 'tablet' | 'desktop' | 'tv'>('desktop');

  // Comprehensive Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Smartphone Repair',
    description: '',
    imageUrl: '',
    desktopImage: '',
    mobileImage: '',
    primaryButtonText: 'Check Repair Price',
    primaryButtonUrl: '/services?focus=search',
    secondaryButtonText: 'Track Device Status',
    secondaryButtonUrl: '/track',
    featureTagsInput: '24-Point Tested, Original OCA Lamination, 60-Min Express Fix',
    textAlignment: 'left' as 'left' | 'center' | 'right',
    contentPosition: 'left' as 'left' | 'center' | 'right',
    overlayStrength: 'cinematic' as 'subtle' | 'medium' | 'strong' | 'cinematic',
    themeColor: 'dark' as 'dark' | 'light' | 'auto',
    displayOrder: 1,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'SCHEDULED',
    autoRotate: 6000,
    publishStartAt: '',
    publishEndAt: '',
  });

  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

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
  useRealtimeSync(['homeSlide', 'slide', 'slides'], () => {
    fetchSlides();
  });

  const resetForm = () => {
    const nextOrder = slides.length > 0 ? Math.max(...slides.map(s => s.displayOrder)) + 1 : 1;
    setFormData({
      title: '',
      category: 'Smartphone Repair',
      description: '',
      imageUrl: '',
      desktopImage: '',
      mobileImage: '',
      primaryButtonText: 'Check Repair Price',
      primaryButtonUrl: '/services?focus=search',
      secondaryButtonText: 'Track Device Status',
      secondaryButtonUrl: '/track',
      featureTagsInput: '24-Point Tested, Original OCA Lamination, 60-Min Express Fix',
      textAlignment: 'left',
      contentPosition: 'left',
      overlayStrength: 'cinematic',
      themeColor: 'dark',
      displayOrder: nextOrder,
      status: 'ACTIVE',
      autoRotate: 6000,
      publishStartAt: '',
      publishEndAt: '',
    });
    setSelectedSlide(null);
    setIsEditMode(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (slide: HomeSlideItem) => {
    setSelectedSlide(slide);
    setIsEditMode(true);
    setFormData({
      title: slide.title,
      category: slide.category || 'Smartphone Repair',
      description: slide.description || '',
      imageUrl: slide.imageUrl || slide.desktopImage || '',
      desktopImage: slide.desktopImage || slide.imageUrl || '',
      mobileImage: slide.mobileImage || '',
      primaryButtonText: slide.primaryButtonText || slide.buttonText || 'Check Repair Price',
      primaryButtonUrl: slide.primaryButtonUrl || slide.buttonLink || '/services?focus=search',
      secondaryButtonText: slide.secondaryButtonText || '',
      secondaryButtonUrl: slide.secondaryButtonUrl || '',
      featureTagsInput: Array.isArray(slide.featureTags) ? slide.featureTags.join(', ') : '',
      textAlignment: slide.textAlignment || 'left',
      contentPosition: slide.contentPosition || 'left',
      overlayStrength: (slide.overlayStrength as any) || 'cinematic',
      themeColor: slide.themeColor || 'dark',
      displayOrder: slide.displayOrder,
      status: slide.status,
      autoRotate: slide.autoRotate || 6000,
      publishStartAt: slide.publishStartAt ? slide.publishStartAt.slice(0, 16) : '',
      publishEndAt: slide.publishEndAt ? slide.publishEndAt.slice(0, 16) : '',
    });
    setIsEditorOpen(true);
  };

  const handleOpenPreview = (slide: HomeSlideItem) => {
    setSelectedSlide(slide);
    setIsPreviewOpen(true);
  };

  const handleImageFileUpload = async (
    file: File,
    variant: 'desktop' | 'mobile'
  ) => {
    const validExtensions = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif'
    ];
    if (!validExtensions.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
      toast.error('Image format not supported. Please choose JPG, PNG, WebP, or AVIF.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image file too large. Maximum size is 20MB.');
      return;
    }

    const setUploading = variant === 'desktop' ? setUploadingDesktop : setUploadingMobile;

    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);
      uploadFormData.append('file', file);
      uploadFormData.append('variant', variant);

      try {
        const res = await api.post('/admin/slides/upload-image', uploadFormData);
        if (res && res.url) {
          if (variant === 'desktop') {
            setFormData(prev => ({ ...prev, imageUrl: res.url, desktopImage: res.url }));
          } else {
            setFormData(prev => ({ ...prev, mobileImage: res.url }));
          }
          toast.success(`${variant === 'desktop' ? 'Desktop' : 'Mobile'} image uploaded!`);
          setUploading(false);
          return;
        }
      } catch (formErr) {
        console.warn('FormData upload failed, trying Base64 fallback:', formErr);
      }

      // Base64 fallback
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Image = reader.result as string;
          const res = await api.post('/admin/slides/upload-image', {
            base64Image,
            image: base64Image,
            variant
          });
          if (res && res.url) {
            if (variant === 'desktop') {
              setFormData(prev => ({ ...prev, imageUrl: res.url, desktopImage: res.url }));
            } else {
              setFormData(prev => ({ ...prev, mobileImage: res.url }));
            }
            toast.success(`${variant === 'desktop' ? 'Desktop' : 'Mobile'} image uploaded!`);
          } else {
            throw new Error('No URL returned by server');
          }
        } catch (upErr: any) {
          toast.error(upErr?.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploading(false);
      toast.error(err?.message || 'Could not process image.');
    }
  };

  const handleEditorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a slide title');
      return;
    }
    const desktopImg = formData.desktopImage || formData.imageUrl;
    if (!desktopImg.trim()) {
      toast.error('Please provide or upload a desktop slide image');
      return;
    }

    const tags = formData.featureTagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const payload = {
      title: formData.title.trim(),
      category: formData.category.trim(),
      description: formData.description.trim() || null,
      imageUrl: desktopImg.trim(),
      desktopImage: desktopImg.trim(),
      mobileImage: formData.mobileImage.trim() || null,
      primaryButtonText: formData.primaryButtonText.trim(),
      primaryButtonUrl: formData.primaryButtonUrl.trim(),
      buttonText: formData.primaryButtonText.trim(),
      buttonLink: formData.primaryButtonUrl.trim(),
      secondaryButtonText: formData.secondaryButtonText.trim() || null,
      secondaryButtonUrl: formData.secondaryButtonUrl.trim() || null,
      featureTags: tags,
      textAlignment: formData.textAlignment,
      contentPosition: formData.contentPosition,
      overlayStrength: formData.overlayStrength,
      themeColor: formData.themeColor,
      displayOrder: Number(formData.displayOrder) || 1,
      status: formData.status,
      autoRotate: Number(formData.autoRotate) || 6000,
      publishStartAt: formData.publishStartAt ? new Date(formData.publishStartAt).toISOString() : null,
      publishEndAt: formData.publishEndAt ? new Date(formData.publishEndAt).toISOString() : null,
    };

    try {
      setSubmitting(true);
      if (isEditMode && selectedSlide) {
        await api.put(`/admin/slides/${selectedSlide.id}`, payload);
        toast.success(`Slide "${formData.title}" updated successfully!`);
      } else {
        await api.post('/admin/slides', payload);
        toast.success(`New slide "${formData.title}" published!`);
      }

      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: { table: 'HomeSlide' } }));
      setIsEditorOpen(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to save slide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicateSlide = async (slide: HomeSlideItem) => {
    try {
      toast.loading('Duplicating slide...');
      await api.post(`/admin/slides/${slide.id}/duplicate`, {});
      toast.dismiss();
      toast.success(`Cloned slide "${slide.title}" as draft!`);
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: { table: 'HomeSlide' } }));
      fetchSlides();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err?.response?.data?.error || 'Failed to duplicate slide');
    }
  };

  const handleToggleStatus = async (slide: HomeSlideItem) => {
    try {
      const nextStatus = slide.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/admin/slides/${slide.id}/status`, { status: nextStatus });
      toast.success(`Slide "${slide.title}" marked as ${nextStatus === 'ACTIVE' ? 'Active' : 'Inactive'}`);
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: { table: 'HomeSlide' } }));
      fetchSlides();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to change status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSlide) return;
    try {
      setSubmitting(true);
      await api.delete(`/admin/slides/${selectedSlide.id}`);
      toast.success(`Slide "${selectedSlide.title}" deleted.`);
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: { table: 'HomeSlide' } }));
      setIsDeleteOpen(false);
      setSelectedSlide(null);
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
      // Optimistic local update
      const updatedList = sorted.map(s => {
        if (s.id === slide.id) return { ...s, displayOrder: targetOrder };
        if (s.id === targetSlide.id) return { ...s, displayOrder: currentOrder };
        return s;
      }).sort((a, b) => a.displayOrder - b.displayOrder);
      setSlides(updatedList);

      await api.put('/admin/slides/reorder', {
        slides: [
          { id: slide.id, displayOrder: targetOrder },
          { id: targetSlide.id, displayOrder: currentOrder }
        ]
      });
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: { table: 'HomeSlide' } }));
      toast.success('Slide order updated');
      fetchSlides();
    } catch (err) {
      toast.error('Failed to change slide order');
      fetchSlides();
    }
  };

  // Filtered Slides
  const filteredSlides = useMemo(() => {
    return slides.filter(slide => {
      const matchesSearch =
        slide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (slide.description && slide.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (slide.category && slide.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (Array.isArray(slide.featureTags) && slide.featureTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE') return slide.status === 'ACTIVE';
      if (statusFilter === 'INACTIVE') return slide.status === 'INACTIVE' || slide.status === 'DRAFT';
      if (statusFilter === 'SCHEDULED') return slide.status === 'SCHEDULED';
      return true;
    }).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [slides, searchQuery, statusFilter]);

  // Statistics
  const totalCount = slides.length;
  const activeCount = slides.filter(s => s.status === 'ACTIVE').length;
  const inactiveCount = slides.filter(s => s.status === 'INACTIVE' || s.status === 'DRAFT').length;
  const scheduledCount = slides.filter(s => s.status === 'SCHEDULED').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
              Superadmin CMS
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {activeCount} Active / {totalCount} Total Slides
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hero Slideshow Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 max-w-2xl">
            Design, schedule, upload, and organize premium hero banners displayed on the MTS Lab Home Page.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={fetchSlides}
            disabled={loading}
            className="rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm h-10 px-3 sm:px-4 gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="rounded-xl bg-slate-950 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-xs sm:text-sm h-10 px-3.5 sm:px-4 gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Slide</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Total Slides</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 block">{totalCount}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">In CMS library</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Active Live</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-1 block">{activeCount}</span>
          <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">Visible on home</span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Scheduled</span>
          <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300 mt-1 block">{scheduledCount}</span>
          <span className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1 block">Time-gated release</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Draft / Inactive</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-700 dark:text-slate-300 mt-1 block">{inactiveCount}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Hidden from visitors</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by title, category, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-sm"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'ACTIVE', 'INACTIVE', 'SCHEDULED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                statusFilter === status
                  ? "bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : status === 'INACTIVE' ? 'Draft / Inactive' : 'Scheduled'}
            </button>
          ))}
        </div>
      </div>

      {/* Slides Grid / List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            <span>Configured Slides ({filteredSlides.length})</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Drag or use arrows to adjust public order
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Loading slideshow records...</p>
          </div>
        ) : filteredSlides.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <ImageIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">No slides match your criteria</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try clearing the search query or status filter.'
                  : 'Get started by creating your first hero slideshow banner.'}
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="rounded-xl bg-slate-950 text-white font-bold cursor-pointer">
              <Plus className="h-4 w-4 mr-2" /> Add First Slide
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredSlides.map((slide, index) => {
              const desktopImg = slide.desktopImage || slide.imageUrl;
              const hasMobile = Boolean(slide.mobileImage);

              return (
                <motion.div
                  key={slide.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="overflow-hidden border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg transition-all rounded-3xl flex flex-col justify-between h-full bg-white dark:bg-slate-900">
                    {/* Media Thumbnail Header */}
                    <div className="relative h-48 w-full bg-slate-950 overflow-hidden group">
                      <img
                        src={desktopImg}
                        alt={slide.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1200';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white border border-white/20 text-[10px] font-black uppercase tracking-wider">
                          #{slide.displayOrder}
                        </span>

                        <Badge
                          className={cn(
                            "text-[10px] font-black px-2.5 py-0.5 rounded-full border-none",
                            slide.status === 'ACTIVE'
                              ? 'bg-emerald-500 text-white'
                              : slide.status === 'SCHEDULED'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-500 text-white'
                          )}
                        >
                          {slide.status}
                        </Badge>

                        {hasMobile && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[10px] font-bold flex items-center gap-1">
                            <Smartphone className="h-3 w-3" /> Mobile
                          </span>
                        )}
                      </div>

                      {/* Quick Move Up/Down Order */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-xl p-1 border border-white/15">
                        <button
                          onClick={() => handleMoveOrder(slide, 'up')}
                          disabled={index === 0}
                          title="Move Earlier in Carousel"
                          className="p-1 text-white hover:text-amber-400 disabled:opacity-25 transition-colors cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(slide, 'down')}
                          disabled={index === filteredSlides.length - 1}
                          title="Move Later in Carousel"
                          className="p-1 text-white hover:text-amber-400 disabled:opacity-25 transition-colors cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Title & Category Overlay */}
                      <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block line-clamp-1">
                          {slide.category || 'Smartphone Repair'}
                        </span>
                        <h3 className="font-extrabold text-base sm:text-lg leading-tight line-clamp-1 drop-shadow-md mt-0.5">
                          {slide.title}
                        </h3>
                      </div>
                    </div>

                    {/* Content Details */}
                    <CardContent className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        {slide.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {slide.description}
                          </p>
                        )}

                        {/* Feature Tags Preview */}
                        {slide.featureTags && slide.featureTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {slide.featureTags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold flex items-center gap-1"
                              >
                                <Tag className="h-2.5 w-2.5 text-slate-400" />
                                {tag}
                              </span>
                            ))}
                            {slide.featureTags.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-semibold self-center">
                                +{slide.featureTags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Primary Button URL preview */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Primary CTA</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                            {slide.primaryButtonText || slide.buttonText || 'Check Repair Price'} → {slide.primaryButtonUrl || slide.buttonLink || '/services'}
                          </span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {/* Live Preview Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPreview(slide)}
                          className="h-8 px-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          {/* Toggle Active Status */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(slide)}
                            title={slide.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            className="h-8 px-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {slide.status === 'ACTIVE' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-emerald-500" />}
                          </Button>

                          {/* Duplicate Slide */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateSlide(slide)}
                            title="Duplicate Slide"
                            className="h-8 px-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          {/* Edit Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(slide)}
                            className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSlide(slide);
                              setIsDeleteOpen(true);
                            }}
                            title="Delete Slide"
                            className="h-8 px-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CREATE & EDIT SLIDE DIALOG WITH ALL 14 FIELDS & TABBED ARCHITECTURE       */}
      {/* ========================================================================= */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl w-[96vw] max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-7 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-black">
              {isEditMode ? 'Edit Hero Slide' : 'Create New Hero Slide'}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              Configure titles, responsive visuals, CTA links, layout positioning, and auto-rotation settings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditorSubmit} className="space-y-6 pt-3">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid grid-cols-4 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                <TabsTrigger value="content" className="rounded-xl text-xs font-bold">1. Content</TabsTrigger>
                <TabsTrigger value="media" className="rounded-xl text-xs font-bold">2. Images</TabsTrigger>
                <TabsTrigger value="cta" className="rounded-xl text-xs font-bold">3. CTAs</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-xl text-xs font-bold">4. Layout</TabsTrigger>
              </TabsList>

              {/* TAB 1: CONTENT & HEADINGS */}
              <TabsContent value="content" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category / Badge */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Category Kicker / Badge
                    </label>
                    <Input
                      placeholder="e.g. Smartphone Screen Restoration"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="rounded-xl h-11 text-sm border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Publication Status
                    </label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="rounded-xl h-11 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active (Live in Carousel)</SelectItem>
                        <SelectItem value="INACTIVE">Inactive (Hidden)</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled (Time-gated)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Main Slide Heading <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    placeholder="e.g. Front Glass OCA Replacement"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="rounded-xl h-11 text-sm font-semibold border-slate-200 dark:border-slate-700"
                  />
                </div>

                {/* Subtitle / Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Description & Value Proposition
                  </label>
                  <Textarea
                    placeholder="High-precision outer glass replacement preserving your original AMOLED/OLED display..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="rounded-xl min-h-[85px] text-sm border-slate-200 dark:border-slate-700"
                  />
                </div>

                {/* Feature Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Feature Highlights & Badges (Comma-separated)
                  </label>
                  <Input
                    placeholder="24-Point Tested, Original OCA Lamination, 60-Min Express Fix"
                    value={formData.featureTagsInput}
                    onChange={(e) => setFormData({ ...formData, featureTagsInput: e.target.value })}
                    className="rounded-xl h-11 text-sm border-slate-200 dark:border-slate-700"
                  />
                </div>
              </TabsContent>

              {/* TAB 2: IMAGES & RESPONSIVE ASSETS */}
              <TabsContent value="media" className="space-y-5">
                {/* Preset Fast Selection */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Choose from Curated Lab Presets:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category: preset.category,
                            imageUrl: preset.desktopUrl,
                            desktopImage: preset.desktopUrl,
                            mobileImage: preset.mobileUrl,
                          });
                        }}
                        className={cn(
                          "relative h-20 rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer group",
                          formData.desktopImage === preset.desktopUrl
                            ? "border-slate-950 dark:border-white ring-2 ring-slate-950/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
                        )}
                      >
                        <img
                          src={preset.desktopUrl}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/45 group-hover:bg-black/25 transition-colors" />
                        <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white leading-tight truncate">
                          {preset.name}
                        </span>
                        {formData.desktopImage === preset.desktopUrl && (
                          <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white rounded-full p-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Desktop Background Image Upload */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Desktop / Tablet Image URL (Required) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Recommended: 1920×1080 (16:9)</span>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      required
                      placeholder="https://... or /assets/images/..."
                      value={formData.desktopImage || formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, desktopImage: e.target.value, imageUrl: e.target.value })}
                      className="rounded-xl h-11 text-sm border-slate-200 dark:border-slate-700 flex-1"
                    />
                    <label className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer shrink-0">
                      <Upload className={`h-4 w-4 ${uploadingDesktop ? 'animate-bounce' : ''}`} />
                      <span>{uploadingDesktop ? 'Uploading...' : 'Upload'}</span>
                      <input
                        ref={desktopFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileUpload(file, 'desktop');
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Mobile Background Image Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Mobile Variant Image URL (Optional)
                    </label>
                    <span className="text-[10px] text-slate-400">Optimized for vertical screens (&lt;768px)</span>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="https://... or /assets/images/... (fallback to desktop if empty)"
                      value={formData.mobileImage}
                      onChange={(e) => setFormData({ ...formData, mobileImage: e.target.value })}
                      className="rounded-xl h-11 text-sm border-slate-200 dark:border-slate-700 flex-1"
                    />
                    <label className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer shrink-0">
                      <Upload className={`h-4 w-4 ${uploadingMobile ? 'animate-bounce' : ''}`} />
                      <span>{uploadingMobile ? 'Uploading...' : 'Upload'}</span>
                      <input
                        ref={mobileFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileUpload(file, 'mobile');
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Live Preview of Selected Images */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {formData.desktopImage && (
                    <div className="relative h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
                      <img src={formData.desktopImage} alt="Desktop Preview" className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-bold">
                        Desktop Preview
                      </span>
                    </div>
                  )}
                  {formData.mobileImage && (
                    <div className="relative h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
                      <img src={formData.mobileImage} alt="Mobile Preview" className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-bold">
                        Mobile Preview
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 3: CALL TO ACTION BUTTONS */}
              <TabsContent value="cta" className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-emerald-500" /> Primary Call to Action
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Button Label</label>
                      <Input
                        placeholder="Check Repair Price"
                        value={formData.primaryButtonText}
                        onChange={(e) => setFormData({ ...formData, primaryButtonText: e.target.value })}
                        className="rounded-xl h-10 text-sm border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Destination URL</label>
                      <Input
                        placeholder="/services?focus=search"
                        value={formData.primaryButtonUrl}
                        onChange={(e) => setFormData({ ...formData, primaryButtonUrl: e.target.value })}
                        className="rounded-xl h-10 text-sm border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-sky-500" /> Secondary Call to Action (Optional)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Button Label</label>
                      <Input
                        placeholder="Track Repair Status (or leave empty)"
                        value={formData.secondaryButtonText}
                        onChange={(e) => setFormData({ ...formData, secondaryButtonText: e.target.value })}
                        className="rounded-xl h-10 text-sm border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Destination URL</label>
                      <Input
                        placeholder="/track (or leave empty)"
                        value={formData.secondaryButtonUrl}
                        onChange={(e) => setFormData({ ...formData, secondaryButtonUrl: e.target.value })}
                        className="rounded-xl h-10 text-sm border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: LAYOUT, POSITIONING, TIMERS & SCHEDULING */}
              <TabsContent value="settings" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Text Alignment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Text Alignment
                    </label>
                    <Select
                      value={formData.textAlignment}
                      onValueChange={(val: any) => setFormData({ ...formData, textAlignment: val })}
                    >
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left Aligned</SelectItem>
                        <SelectItem value="center">Centered</SelectItem>
                        <SelectItem value="right">Right Aligned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Content Position */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Content Position
                    </label>
                    <Select
                      value={formData.contentPosition}
                      onValueChange={(val: any) => setFormData({ ...formData, contentPosition: val })}
                    >
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left Side</SelectItem>
                        <SelectItem value="center">Center Stage</SelectItem>
                        <SelectItem value="right">Right Side</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Overlay Strength */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Contrast Overlay
                    </label>
                    <Select
                      value={formData.overlayStrength}
                      onValueChange={(val: any) => setFormData({ ...formData, overlayStrength: val })}
                    >
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cinematic">Cinematic (Default)</SelectItem>
                        <SelectItem value="subtle">Subtle (45%)</SelectItem>
                        <SelectItem value="medium">Medium (65%)</SelectItem>
                        <SelectItem value="strong">Strong (85%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Display Order */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Display Order (# Position)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })}
                      className="rounded-xl h-10 text-sm border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  {/* Auto-Rotate Interval */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Slide Duration (Milliseconds)
                    </label>
                    <Select
                      value={String(formData.autoRotate)}
                      onValueChange={(val) => setFormData({ ...formData, autoRotate: parseInt(val) })}
                    >
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4000">4 Seconds (Fast)</SelectItem>
                        <SelectItem value="6000">6 Seconds (Standard)</SelectItem>
                        <SelectItem value="8000">8 Seconds (Relaxed)</SelectItem>
                        <SelectItem value="10000">10 Seconds (Cinematic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Scheduling Start and End Dates */}
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Scheduled Publishing Window (Optional)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Publish Start At</label>
                      <Input
                        type="datetime-local"
                        value={formData.publishStartAt}
                        onChange={(e) => setFormData({ ...formData, publishStartAt: e.target.value })}
                        className="rounded-xl h-10 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Publish End At</label>
                      <Input
                        type="datetime-local"
                        value={formData.publishEndAt}
                        onChange={(e) => setFormData({ ...formData, publishEndAt: e.target.value })}
                        className="rounded-xl h-10 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-slate-950 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950 font-bold px-6 shadow-sm cursor-pointer"
              >
                {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Publish Slide'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* INTERACTIVE MULTI-DEVICE LIVE PREVIEW MODAL                               */}
      {/* ========================================================================= */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-6 bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                  <Monitor className="h-5 w-5 text-indigo-400" />
                  <span>Interactive Slide Preview</span>
                  <Badge className="bg-white/10 text-white font-normal text-[11px] border-none ml-1">
                    {selectedSlide?.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  Test responsive behavior across smartphones, iPads, laptops, and large displays.
                </DialogDescription>
              </div>

              {/* Device Viewport Switcher */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  title="iPhone / Smartphone Portrait (375px)"
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    previewDevice === 'mobile' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile
                </button>
                <button
                  onClick={() => setPreviewDevice('landscape')}
                  title="Mobile Landscape (667px)"
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    previewDevice === 'landscape' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5 rotate-90" /> Wide Phone
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  title="iPad / Tablet (768px)"
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    previewDevice === 'tablet' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Tablet className="h-3.5 w-3.5" /> Tablet
                </button>
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  title="Desktop / Laptop (1200px)"
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    previewDevice === 'desktop' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" /> Laptop
                </button>
                <button
                  onClick={() => setPreviewDevice('tv')}
                  title="Large Screen / 4K TV (1600px)"
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    previewDevice === 'tv' ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Tv className="h-3.5 w-3.5" /> 4K / TV
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Interactive Preview Canvas */}
          {selectedSlide && (
            <div className="py-4 flex justify-center overflow-x-auto">
              <div
                className={cn(
                  "relative rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 border border-white/10 bg-slate-950",
                  previewDevice === 'mobile' && "w-[375px] min-h-[500px]",
                  previewDevice === 'landscape' && "w-[667px] min-h-[420px]",
                  previewDevice === 'tablet' && "w-[768px] min-h-[520px]",
                  previewDevice === 'desktop' && "w-full max-w-[980px] min-h-[540px]",
                  previewDevice === 'tv' && "w-full min-h-[580px]"
                )}
              >
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${
                      previewDevice === 'mobile' && selectedSlide.mobileImage
                        ? selectedSlide.mobileImage
                        : selectedSlide.desktopImage || selectedSlide.imageUrl
                    })`,
                  }}
                />

                {/* Multilayer Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/30 md:bg-gradient-to-r md:from-slate-950 md:via-slate-950/85 md:to-transparent" />
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-center p-6 sm:p-10 z-10 space-y-4">
                  {/* Category Kicker */}
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{selectedSlide.category || 'Smartphone Repair'}</span>
                  </div>

                  {/* Heading */}
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    {selectedSlide.title}
                  </h1>

                  {/* Subtitle */}
                  {selectedSlide.description && (
                    <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
                      {selectedSlide.description}
                    </p>
                  )}

                  {/* Feature Tags */}
                  {selectedSlide.featureTags && selectedSlide.featureTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedSlide.featureTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-[11px] font-medium border border-white/15"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button className="h-10 px-5 rounded-xl bg-white text-slate-950 font-bold text-xs shadow-lg cursor-pointer">
                      {selectedSlide.primaryButtonText || selectedSlide.buttonText || 'Check Repair Price'}
                    </button>
                    {selectedSlide.secondaryButtonText && (
                      <button className="h-10 px-5 rounded-xl border border-white/25 bg-white/10 text-white font-bold text-xs cursor-pointer">
                        {selectedSlide.secondaryButtonText}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              className="rounded-xl border-slate-700 text-white hover:bg-slate-800 cursor-pointer"
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 flex items-center justify-center text-rose-600 mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Delete Hero Slide?
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm">
              Are you sure you want to permanently delete "{selectedSlide?.title}"? This banner will immediately be removed from the public website slideshow.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={submitting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 cursor-pointer"
            >
              {submitting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
