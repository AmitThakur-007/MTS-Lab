import React, { useState, useEffect } from 'react';
import { 
  FileDown, 
  Share2, 
  Copy, 
  ExternalLink, 
  Trash2, 
  Plus, 
  Loader2, 
  CheckCircle, 
  Globe, 
  Lock, 
  Users, 
  Calendar, 
  RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FederationSharingTab() {
  const [form, setForm] = useState({
    appletName: 'MTS Lab System',
    description: 'Advanced Lab & Repair Management suite with diagnostic records, invoicing, and real-time technician workspaces.',
    visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'SHARED',
    sharingTarget: '',
    allowFork: true,
  });

  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/share/history');
      if (res && res.success) {
        setShares(res.data || []);
      }
    } catch (err) {
      console.error('[SHARE HISTORY ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    try {
      const res: any = await api.post('/share/applet', form);
      if (res && res.success) {
        toast.success(res.message || 'Share published successfully!');
        fetchShares();
      } else {
        toast.error(res?.error || 'Failed to create share.');
      }
    } catch (err: any) {
      toast.error('Failed to create share link.');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const fullUrl = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('Share link copied to clipboard!');
  };

  const handleRevoke = async (id: string) => {
    try {
      const res: any = await api.delete(`/share/${id}`);
      if (res && res.success) {
        toast.success('Share link revoked.');
        fetchShares();
      }
    } catch (err) {
      toast.error('Failed to revoke share link.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Create Share Link */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-6 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px] font-bold">
                  MULTI-INSTANCE FEDERATION
                </Badge>
              </div>
              <CardTitle className="text-xl font-black mt-2">Applet Federation &amp; Share Links</CardTitle>
              <CardDescription className="text-slate-400 text-xs font-semibold">
                Generate secure share links and tokens for external multi-branch access or client review.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handlePublish} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Applet / System Title</Label>
                  <Input
                    value={form.appletName}
                    onChange={(e) => setForm({ ...form, appletName: e.target.value })}
                    className="bg-slate-50 rounded-xl h-10 text-xs font-semibold border-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Description &amp; System Scope</Label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full bg-slate-50 rounded-xl p-3 text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { id: 'PUBLIC', label: 'Public Access', icon: Globe, desc: 'Anyone with token link' },
                    { id: 'SHARED', label: 'Restricted Branch', icon: Users, desc: 'Specific branches / users' },
                    { id: 'PRIVATE', label: 'Restricted Token', icon: Lock, desc: 'Token authorization required' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setForm({ ...form, visibility: v.id as any })}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        form.visibility === v.id
                          ? 'bg-blue-50 border-blue-400 text-blue-950 ring-2 ring-blue-400/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <v.icon className={`h-4 w-4 mb-1.5 ${form.visibility === v.id ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div className="font-bold text-xs">{v.label}</div>
                      <div className="text-[10px] text-slate-500">{v.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="allowFork"
                    checked={form.allowFork}
                    onChange={(e) => setForm({ ...form, allowFork: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="allowFork" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Allow downstream branching &amp; template cloning
                  </Label>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={publishing}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-xs cursor-pointer"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Generating Share...
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-1.5" />
                        Create Federation Link
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Active Shares List */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-5 bg-slate-100/80 border-b border-slate-200/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Share2 className="h-4 w-4 text-slate-700" />
                  Active Share Links
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Currently active federation tokens.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchShares}
                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
              {shares.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Share2 className="h-7 w-7 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No Active Share Links</p>
                  <p className="text-[10px] text-slate-400">Create one using the form on the left.</p>
                </div>
              ) : (
                shares.map((s) => (
                  <div key={s.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[160px]">{s.title}</span>
                      <Badge variant="outline" className="text-[9px] font-bold">
                        {s.visibility || 'PUBLIC'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono bg-white p-1.5 rounded-xl border border-slate-200/60">
                      <span className="truncate max-w-[150px]">/share/{s.shareToken?.substring(0, 12)}...</span>
                      <button
                        onClick={() => handleCopyLink(s.shareToken)}
                        className="text-blue-600 hover:text-blue-800 font-bold px-1 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>{s.createdAt ? format(new Date(s.createdAt), 'MMM dd, yyyy') : ''}</span>
                      <button
                        onClick={() => handleRevoke(s.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Revoke
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
