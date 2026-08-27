import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  onRemove: () => void;
  entityType?: string;
  entityId?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, onRemove, entityType = 'GENERAL', entityId, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size too large. Maximum size is 10MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (entityType) formData.append('entityType', entityType);
    if (entityId) formData.append('entityId', entityId);

    setUploading(true);
    try {
      const response = await api.post('/media/upload', formData);
      const url = response.secureUrl || response.url;
      onChange(url);
      toast.success('Image uploaded successfully to Cloudinary');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    // Simulate input change
    const target = { files: [file] } as unknown as HTMLInputElement;
    handleFileChange({ target } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={cn("space-y-4 w-full", className)}>
      <div 
        onClick={() => !value && !uploading && fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "relative min-h-[200px] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 cursor-pointer overflow-hidden",
          value ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <p className="text-sm font-bold text-slate-500">Uploading to Cloud...</p>
          </div>
        ) : value ? (
          <div className="relative w-full h-full group">
            <img 
              src={value} 
              alt="Preview" 
              className="w-full max-h-[300px] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                className="font-bold rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Change Image
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="font-bold rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <X className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <Upload className="h-8 w-8 text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">Click or Drag & Drop</p>
              <p className="text-sm font-medium text-slate-500">JPG, PNG or WEBP (Max 5MB)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
