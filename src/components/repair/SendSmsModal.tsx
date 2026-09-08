import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Info,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { formatNepalPhone, isValidNepalPhone } from '@/lib/format';

interface SendSmsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: any;
  onSuccess?: () => void;
}

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST'];

export default function SendSmsModal({
  open,
  onOpenChange,
  repair,
  onSuccess,
}: SendSmsModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [smsStatusData, setSmsStatusData] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const userRole = (user?.role || '').toUpperCase().trim();
  const isAuthorized = ALLOWED_ROLES.includes(userRole);

  const customerName = repair?.customerName || repair?.customer?.name || 'Valued Customer';
  const customerPhoneRaw = repair?.customerPhone || repair?.customer?.phone || '';
  const deviceModel = `${repair?.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair?.deviceModel || 'Device'}`.trim();
  const repairNumber = repair?.repairNumber || repair?.id?.substring(0, 8) || 'MTS-Job';

  // Client-side quick phone normalization
  const normalizedPhoneDigits = formatNepalPhone(customerPhoneRaw);
  const isValidPhone = isValidNepalPhone(normalizedPhoneDigits);
  const internationalPhone = isValidPhone ? `+977${normalizedPhoneDigits}` : '';

  // Default clean message (no staff names, internal IDs, or tech diagnostic notes)
  const defaultTemplate = `Dear ${customerName}, your ${deviceModel} repair (Repair No: ${repairNumber}) has been completed and is ready for pickup at MTS Lab. For assistance, please contact MTS Lab. Thank you.`;

  // Fetch status and history from server when modal opens
  useEffect(() => {
    if (!open || !repair?.id || !isAuthorized) return;

    setMessage(defaultTemplate);
    setCopiedMessage(false);
    setCopiedPhone(false);

    let isMounted = true;
    setLoading(true);

    api
      .get(`/repairs/${repair.id}/sms-status`)
      .then((data) => {
        if (isMounted && data) {
          setSmsStatusData(data);
          if (data.defaultMessage) {
            setMessage(data.defaultMessage);
          }
          if (Array.isArray(data.history)) {
            setHistory(data.history);
          }
        }
      })
      .catch((err) => {
        console.warn('[SMS STATUS FETCH WARN]', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, repair?.id, isAuthorized]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessage(true);
      toast.success('Message copied.');
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch (_) {
      toast.error('Could not copy to clipboard. Please copy manually.');
    }
  };

  const handleCopyPhone = async () => {
    try {
      const phoneToCopy = internationalPhone || normalizedPhoneDigits || customerPhoneRaw;
      await navigator.clipboard.writeText(phoneToCopy);
      setCopiedPhone(true);
      toast.success('Phone number copied.');
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch (_) {
      toast.error('Could not copy phone number.');
    }
  };

  // Open Google Messages for Web with active paired session
  const handleOpenGoogleMessages = async () => {
    if (!isValidPhone) {
      toast.error('Invalid customer phone number. Please update customer phone first.');
      return;
    }

    try {
      // Copy message to clipboard automatically for convenient paste
      try {
        await navigator.clipboard.writeText(message);
        setCopiedMessage(true);
      } catch (_) {}

      // Log the preparation in MTS Lab backend
      setSubmitting(true);
      const res = await api.post(`/repairs/${repair.id}/send-sms`, {
        customMessage: message,
        channel: 'GOOGLE_MESSAGES_WEB',
        action: 'INITIATED',
        notes: 'Opened Google Messages for Web paired session',
      });

      if (res?.record) {
        setHistory((prev) => [res.record, ...prev]);
      }

      // Open official Google Messages for Web
      window.open('https://messages.google.com/web/', '_blank', 'noopener,noreferrer');

      toast.success(
        'Google Messages opened! Message copied to clipboard. Paste into customer conversation.',
        { duration: 5000 }
      );

      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate Google Messages workflow.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open native default SMS app (for Android phone / mobile device users)
  const handleOpenNativeSms = async () => {
    if (!isValidPhone) {
      toast.error('Invalid customer phone number.');
      return;
    }

    try {
      setSubmitting(true);
      const smsUrl = `sms:${internationalPhone}?body=${encodeURIComponent(message)}`;

      const res = await api.post(`/repairs/${repair.id}/send-sms`, {
        customMessage: message,
        channel: 'SMS_PROTOCOL',
        action: 'INITIATED',
        notes: 'Launched native SMS protocol intent',
      });

      if (res?.record) {
        setHistory((prev) => [res.record, ...prev]);
      }

      window.location.href = smsUrl;
      toast.success('Launching SMS application...');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to prepare SMS.');
    } finally {
      setSubmitting(false);
    }
  };

  // Explicit confirmation when staff completes sending in Google Messages
  const handleConfirmSent = async () => {
    if (!isValidPhone) {
      toast.error('Invalid customer phone number.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/repairs/${repair.id}/send-sms`, {
        customMessage: message,
        channel: 'GOOGLE_MESSAGES_WEB',
        action: 'SENT',
        notes: 'Staff confirmed SMS dispatch via Google Messages for Web',
      });

      toast.success('SMS send confirmed and recorded in repair history.');
      if (res?.record) {
        setHistory((prev) => [res.record, ...prev]);
      }
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm SMS send.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              <span>Permission Denied</span>
            </DialogTitle>
            <DialogDescription>
              Sending customer SMS notifications is restricted to Super Admin, Admin, Manager, and Receptionist roles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const charCount = message.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;
  const hasRecentSent = history.some((h) => h.status === 'SENT' || h.status === 'INITIATED');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Send SMS to Customer
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Manual customer notification via Google Messages for Web (paired with Android phone).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
            <p className="text-xs font-semibold text-slate-500">Validating customer phone and repair readiness...</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Customer & Device Meta Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Customer</span>
                  <span className="font-bold text-slate-900 truncate block">{customerName}</span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Repair Number</span>
                  <span className="font-mono font-bold text-slate-900 truncate block">{repairNumber}</span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Device</span>
                  <span className="font-bold text-slate-900 truncate block">{deviceModel}</span>
                </div>
              </div>

              {/* Phone Status Row */}
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {isValidPhone ? `+977 ${normalizedPhoneDigits}` : customerPhoneRaw || 'No phone recorded'}
                  </span>
                </div>

                {isValidPhone ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 text-[10px] py-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Valid Nepal Mobile</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 gap-1 text-[10px] py-0">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>Invalid Phone Format</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Phone Validation Warning Banner */}
            {!isValidPhone && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {!customerPhoneRaw || !customerPhoneRaw.trim()
                      ? 'Customer phone number is missing. Please update the customer information before sending SMS.'
                      : 'Invalid customer phone number. Please update the customer information before sending SMS.'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Nepal mobile numbers must be 10 digits starting with 98, 97, or 96.
                </p>
              </div>
            )}

            {/* Duplicate Send Protection Warning */}
            {hasRecentSent && (
              <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Notice: SMS was already initiated for this repair ticket.</p>
                  <p className="text-[11px] text-amber-700">
                    Last activity: {history[0]?.status} by {history[0]?.senderStaffName || 'Staff'} on{' '}
                    {new Date(history[0]?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                  </p>
                </div>
              </div>
            )}

            {/* Message Preview & Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-message" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Message</span>
                  <span title="Privacy verified"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /></span>
                </Label>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {charCount} chars ({smsSegments} SMS)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyMessage}
                    className="h-6 px-2 text-[10px] text-slate-600 hover:text-slate-900"
                  >
                    {copiedMessage ? <Check className="w-3 h-3 text-emerald-600 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedMessage ? 'Copied' : 'Copy Message'}
                  </Button>
                </div>
              </div>

              <Textarea
                id="sms-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="text-xs font-medium resize-none bg-white border-slate-300 rounded-xl focus:ring-teal-500"
                placeholder="Enter SMS message..."
              />
              <p className="text-[10px] text-slate-400">
                Staff names, technician names, and internal database keys are strictly excluded for customer privacy.
              </p>
            </div>

            {/* Google Messages Setup Help Section */}
            <div className="p-3.5 bg-sky-50/80 border border-sky-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-sky-950">
                  <Smartphone className="w-4 h-4 text-sky-600" />
                  <span>Google Messages Setup</span>
                </div>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 border border-sky-300 px-2 py-0.5 rounded-full">
                  Manual Workflow
                </span>
              </div>
              <ol className="text-[11px] text-sky-900 space-y-1 list-decimal list-inside leading-relaxed">
                <li>Open Google Messages on the Android phone.</li>
                <li>Pair the phone with Google Messages for Web.</li>
                <li>Open Google Messages for Web on the computer.</li>
                <li>Select the customer.</li>
                <li>Review the prepared message.</li>
                <li>Send the SMS manually.</li>
              </ol>
              <div className="pt-1 border-t border-sky-200/60 text-[10px] text-sky-700 leading-normal flex items-start gap-1">
                <Info className="w-3 h-3 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  Google Messages for Web is best used from a supported desktop/tablet browser. Please open Google Messages manually to send this message.
                </span>
              </div>
            </div>

            {/* SMS Send History (if any) */}
            {history.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  Notification Audit History
                </span>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {history.map((h, idx) => (
                    <div
                      key={h.id || idx}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className="font-bold text-slate-800">{h.senderStaffName || 'Staff'}: </span>
                        <span className="text-slate-600">{h.status} via {h.channel === 'GOOGLE_MESSAGES_WEB' ? 'Google Messages' : 'SMS'}</span>
                      </div>
                      <span className="text-slate-400 shrink-0 font-mono">
                        {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPhone}
              disabled={!isValidPhone || submitting}
              className="h-9 text-xs font-bold text-slate-700"
            >
              {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              Copy Phone
            </Button>

            {/* Mobile native SMS intent */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenNativeSms}
              disabled={!isValidPhone || submitting}
              className="h-9 text-xs font-bold text-slate-700 sm:hidden"
              title="Open default SMS app on mobile"
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              SMS App
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-9 text-xs text-slate-500 hover:text-slate-900"
            >
              Cancel
            </Button>

            {/* Primary Action: Open Google Messages for Web */}
            <Button
              type="button"
              size="sm"
              onClick={handleOpenGoogleMessages}
              disabled={!isValidPhone || submitting}
              className="h-9 px-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-xs font-bold gap-1.5 shadow-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              <span>Open Google Messages</span>
            </Button>

            {/* Secondary Action: Confirm Sent in MTS Lab */}
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmSent}
              disabled={!isValidPhone || submitting}
              className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold gap-1.5 shadow-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Confirm Sent</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
