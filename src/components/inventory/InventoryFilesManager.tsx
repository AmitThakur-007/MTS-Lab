import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Edit3, 
  MoveRight, 
  Download, 
  ExternalLink, 
  FileCode, 
  Image as ImageIcon, 
  FileArchive, 
  File, 
  Plus, 
  Search, 
  Loader2, 
  Eye, 
  AlertTriangle,
  Folder,
  Smartphone,
  Layers,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface InventoryFileItem {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  itemId?: string | null;
  url: string;
  description?: string | null;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface InventoryFilesManagerProps {
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  itemId?: string | null;
  itemName?: string | null;
  canManage: boolean;
  canDelete: boolean;
  categoriesList?: string[];
  onFilesCountChange?: (count: number) => void;
  compact?: boolean;
}

export function InventoryFilesManager({
  brand,
  model,
  category,
  itemId,
  itemName,
  canManage,
  canDelete,
  categoriesList = [],
  onFilesCountChange,
  compact = false
}: InventoryFilesManagerProps) {
  const [files, setFiles] = useState<InventoryFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PDF' | 'IMAGE' | 'OTHER'>('ALL');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [selectedFile, setSelectedFile] = useState<InventoryFileItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    targetBrand: brand || '',
    targetModel: model || '',
    targetCategory: category || 'Technical Documentation',
  });
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: '',
    description: ''
  });

  // Move Form State
  const [moveForm, setMoveForm] = useState({
    targetBrand: '',
    targetModel: '',
    targetCategory: ''
  });

  // Fetch Files
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (itemId) {
        params.itemId = itemId;
      } else {
        if (brand) params.brand = brand;
        if (model) params.model = model;
        if (category) params.category = category;
      }

      const res = await api.get('/inventory/files', { params });
      if (Array.isArray(res)) {
        setFiles(res);
        if (onFilesCountChange) {
          onFilesCountChange(res.length);
        }
      }
    } catch (err: any) {
      console.error('[FETCH INVENTORY FILES ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [brand, model, category, itemId]);

  // Filtered files
  const filteredFiles = files.filter(f => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      f.name.toLowerCase().includes(q) || 
      (f.description && f.description.toLowerCase().includes(q)) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (f.model && f.model.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (typeFilter === 'PDF') {
      return f.fileType?.includes('pdf') || f.url?.toLowerCase().endsWith('.pdf');
    }
    if (typeFilter === 'IMAGE') {
      return f.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.url || '');
    }
    if (typeFilter === 'OTHER') {
      const isPdf = f.fileType?.includes('pdf') || f.url?.toLowerCase().endsWith('.pdf');
      const isImg = f.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.url || '');
      return !isPdf && !isImg;
    }
    return true;
  });

  // Format File Size
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return 'Unknown Size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper for File Icon
  const getFileIcon = (file: InventoryFileItem) => {
    const isPdf = file.fileType?.includes('pdf') || file.url?.toLowerCase().endsWith('.pdf');
    const isImg = file.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.url || '');
    const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(file.url || '');

    if (isPdf) return <FileText className="h-5 w-5 text-rose-500" />;
    if (isImg) return <ImageIcon className="h-5 w-5 text-emerald-500" />;
    if (isZip) return <FileArchive className="h-5 w-5 text-amber-500" />;
    return <File className="h-5 w-5 text-indigo-500" />;
  };

  // Open Upload Modal
  const handleOpenUpload = () => {
    setUploadForm({
      name: '',
      description: '',
      targetBrand: brand || '',
      targetModel: model || '',
      targetCategory: category || 'Technical Documentation',
    });
    setSelectedUploadFile(null);
    setIsUploadOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error('File size too large. Maximum file size is 25MB.');
        return;
      }
      setSelectedUploadFile(file);
      if (!uploadForm.name.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadForm(prev => ({ ...prev, name: nameWithoutExt }));
      }
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) {
      toast.error('Please choose a file to upload.');
      return;
    }
    if (!uploadForm.name.trim()) {
      toast.error('Please provide a file title or description.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload file binary via /api/upload
      const formData = new FormData();
      formData.append('file', selectedUploadFile);

      const uploadRes = await api.post('/upload', formData);
      if (!uploadRes || !uploadRes.url) {
        throw new Error('Upload service did not return a valid URL.');
      }

      // 2. Save file metadata in inventory
      await api.post('/inventory/files', {
        name: uploadForm.name.trim(),
        url: uploadRes.url,
        fileType: selectedUploadFile.type || 'application/octet-stream',
        fileSize: selectedUploadFile.size,
        brand: uploadForm.targetBrand || brand || null,
        model: uploadForm.targetModel || model || null,
        category: uploadForm.targetCategory || category || 'Technical Documentation',
        itemId: itemId || null,
        description: uploadForm.description.trim() || null
      });

      toast.success(`✓ File "${uploadForm.name}" uploaded successfully.`);
      setIsUploadOpen(false);
      fetchFiles();
    } catch (err: any) {
      console.error('[FILE UPLOAD FAILED]', err);
      toast.error(err.message || 'Failed to upload inventory file.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (file: InventoryFileItem) => {
    setSelectedFile(file);
    setEditForm({
      name: file.name,
      description: file.description || ''
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setSubmitting(true);
    try {
      await api.patch(`/inventory/files/${selectedFile.id}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null
      });
      toast.success('✓ File information updated.');
      setIsEditOpen(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update file.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Move Modal
  const handleOpenMove = (file: InventoryFileItem) => {
    setSelectedFile(file);
    setMoveForm({
      targetBrand: file.brand || brand || '',
      targetModel: file.model || model || '',
      targetCategory: file.category || category || 'Technical Documentation'
    });
    setIsMoveOpen(true);
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !moveForm.targetBrand.trim()) {
      toast.error('Destination brand is required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/inventory/files/${selectedFile.id}/move`, {
        targetBrand: moveForm.targetBrand.trim(),
        targetModel: moveForm.targetModel ? moveForm.targetModel.trim() : null,
        targetCategory: moveForm.targetCategory ? moveForm.targetCategory.trim() : 'Technical Documentation'
      });
      toast.success(`✓ File moved to ${moveForm.targetBrand}.`);
      setIsMoveOpen(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move file.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (file: InventoryFileItem) => {
    setSelectedFile(file);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedFile) return;

    setSubmitting(true);
    try {
      await api.delete(`/inventory/files/${selectedFile.id}`);
      toast.success(`✓ File "${selectedFile.name}" deleted.`);
      setIsDeleteOpen(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete file.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (file: InventoryFileItem) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Action and Search Header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search files, schematics, boardviews..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-2xl border-slate-200 bg-slate-50/50 text-xs focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {(['ALL', 'PDF', 'IMAGE', 'OTHER'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border",
                  typeFilter === t
                    ? "bg-black text-white border-black"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                {t === 'ALL' ? 'All' : t === 'PDF' ? 'PDFs' : t === 'IMAGE' ? 'Images' : 'Docs'}
              </button>
            ))}
          </div>
        </div>

        {canManage && (
          <Button
            onClick={handleOpenUpload}
            size="sm"
            className="rounded-2xl h-10 bg-black hover:bg-slate-800 text-white font-bold text-xs shadow-xs shrink-0"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload File / Spec
          </Button>
        )}
      </div>

      {/* Files Grid / Empty State */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
          <p className="text-xs font-bold text-slate-400">Loading documents...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-2 border-slate-200 bg-slate-50/40 p-8 text-center">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800">
            {searchQuery ? 'No matching files found' : 'No files or technical schematics uploaded'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery 
              ? 'Try changing your search term or file type filter.' 
              : `Upload service manuals, pinout schematics, boardviews, or datasheets for ${itemName || category || model || brand || 'this inventory folder'}.`}
          </p>
          {canManage && !searchQuery && (
            <Button
              onClick={handleOpenUpload}
              size="sm"
              variant="outline"
              className="rounded-2xl border-slate-200 font-bold text-xs mt-3"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload First File
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map(file => {
            const isImage = file.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.url || '');
            const isPdf = file.fileType?.includes('pdf') || file.url?.toLowerCase().endsWith('.pdf');

            return (
              <Card 
                key={file.id} 
                className="rounded-2xl border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      {getFileIcon(file)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-xs text-slate-900 truncate" title={file.name}>
                        {file.name}
                      </h5>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <span>•</span>
                        <span>{format(new Date(file.createdAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  {file.description && (
                    <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                      {file.description}
                    </p>
                  )}

                  {/* Folder Breadcrumb Tag */}
                  {(file.brand || file.model || file.category) && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate">
                      <Folder className="h-3 w-3 text-amber-500 shrink-0" />
                      <span>{file.brand || 'Root'}</span>
                      {file.model && <><span>&rsaquo;</span><span>{file.model}</span></>}
                      {file.category && <><span>&rsaquo;</span><span>{file.category}</span></>}
                    </div>
                  )}
                </CardContent>

                {/* File Action Toolbar */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleOpenPreview(file)}
                      className="rounded-lg text-slate-600 hover:text-black hover:bg-slate-200"
                      title="Preview / View File"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      download={file.name}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-black hover:bg-slate-200 transition-colors inline-flex items-center justify-center"
                      title="Direct Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleOpenEdit(file)}
                        className="rounded-lg text-slate-500 hover:text-black hover:bg-slate-200"
                        title="Rename / Edit"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleOpenMove(file)}
                        className="rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Move to another folder"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleOpenDelete(file)}
                          className="rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete File"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. UPLOAD FILE MODAL */}
      {/* ========================================================= */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Upload className="h-5 w-5 text-indigo-600" /> Upload Inventory File / Spec Sheet
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Attach technical manuals, schematics, boardviews, or component datasheets.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-3.5 py-2">
            {/* File Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                selectedUploadFile 
                  ? "border-emerald-400 bg-emerald-50/40" 
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.txt,.doc,.docx,.xls,.xlsx,.zip,.rar"
              />
              {selectedUploadFile ? (
                <>
                  <FileText className="h-8 w-8 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">{selectedUploadFile.name}</span>
                  <span className="text-[10px] text-slate-500">{formatFileSize(selectedUploadFile.size)}</span>
                  <span className="text-[10px] text-indigo-600 font-semibold underline">Click to choose another</span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">Click or Drag file here to upload</span>
                  <span className="text-[10px] text-slate-400">Supports PDF, Images, Word, Excel, ZIP (Max 25MB)</span>
                </>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">File Display Title <span className="text-rose-500">*</span></label>
              <Input
                required
                placeholder="e.g. iPhone 14 Pro Motherboard Schematic Rev 2"
                value={uploadForm.name}
                onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Brand</label>
                <Input
                  placeholder="e.g. Apple, Samsung"
                  value={uploadForm.targetBrand}
                  onChange={e => setUploadForm({ ...uploadForm, targetBrand: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Model</label>
                <Input
                  placeholder="e.g. Galaxy S23 Ultra"
                  value={uploadForm.targetModel}
                  onChange={e => setUploadForm({ ...uploadForm, targetModel: e.target.value })}
                  className="h-10 rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Category</label>
              <Input
                placeholder="e.g. Displays, Schematics, Repair Tools"
                value={uploadForm.targetCategory}
                onChange={e => setUploadForm({ ...uploadForm, targetCategory: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description / Technical Notes (Optional)</label>
              <Input
                placeholder="e.g. Pinout voltage values, test points, revision notes"
                value={uploadForm.description}
                onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)} className="rounded-xl h-10 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedUploadFile} className="rounded-xl h-10 bg-black text-white font-bold text-xs px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload & Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 2. EDIT FILE MODAL */}
      {/* ========================================================= */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-amber-500" /> Edit File Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">File Name</label>
              <Input
                required
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description</label>
              <Input
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl h-10 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-xl h-10 bg-black text-white font-bold text-xs px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 3. MOVE FILE MODAL */}
      {/* ========================================================= */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-indigo-600" /> Move File to Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Relocate file <span className="font-bold text-slate-900">{selectedFile?.name}</span> to another branch.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMoveSubmit} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Target Brand <span className="text-rose-500">*</span></label>
              <Input
                required
                placeholder="e.g. Apple, Samsung"
                value={moveForm.targetBrand}
                onChange={e => setMoveForm({ ...moveForm, targetBrand: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Target Model (Optional)</label>
              <Input
                placeholder="e.g. iPhone 14 Pro"
                value={moveForm.targetModel}
                onChange={e => setMoveForm({ ...moveForm, targetModel: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Target Category (Optional)</label>
              <Input
                placeholder="e.g. Technical Documentation"
                value={moveForm.targetCategory}
                onChange={e => setMoveForm({ ...moveForm, targetCategory: e.target.value })}
                className="h-10 rounded-xl border-slate-200 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsMoveOpen(false)} className="rounded-xl h-10 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-xl h-10 bg-black text-white font-bold text-xs px-6">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Confirm Move'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 4. DELETE FILE CONFIRMATION */}
      {/* ========================================================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete File?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to delete <span className="font-bold text-slate-900">{selectedFile?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl h-10 text-xs">
              Cancel
            </Button>
            <Button 
              type="button" 
              disabled={submitting} 
              onClick={handleDeleteSubmit} 
              className="rounded-xl h-10 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-6"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 5. PREVIEW FILE MODAL */}
      {/* ========================================================= */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 truncate">
              {selectedFile?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 flex items-center gap-2">
              <span>{formatFileSize(selectedFile?.fileSize)}</span>
              <span>•</span>
              <span>{selectedFile?.fileType || 'File'}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto my-3 min-h-[300px] flex items-center justify-center bg-slate-100 rounded-2xl p-2">
            {selectedFile?.url && (
              selectedFile.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(selectedFile.url) ? (
                <img 
                  src={selectedFile.url} 
                  alt={selectedFile.name} 
                  className="max-h-[60vh] max-w-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : selectedFile.fileType?.includes('pdf') || selectedFile.url.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={selectedFile.url} 
                  title={selectedFile.name} 
                  className="w-full h-[60vh] rounded-xl border-none"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="h-16 w-16 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-600 font-semibold">Preview not supported for this file format.</p>
                  <a
                    href={selectedFile.url}
                    target="_blank"
                    rel="noreferrer"
                    download={selectedFile.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold"
                  >
                    <Download className="h-4 w-4" /> Download to View
                  </a>
                </div>
              )
            )}
          </div>

          <DialogFooter className="gap-2">
            <a
              href={selectedFile?.url}
              target="_blank"
              rel="noreferrer"
              download={selectedFile?.name}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <Button type="button" onClick={() => setIsPreviewOpen(false)} className="rounded-xl h-10 bg-black text-white font-bold text-xs px-6">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
