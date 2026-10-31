import React, { useState, useEffect, useRef } from 'react';
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
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Info,
  ExternalLink,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { validateAndFormatNepalPhone } from '@/lib/nepalPhone';
import { analyzeSmsEncoding, generateRepairCompletedMessage } from '@/lib/smsEncoding';
import { cn } from '@/lib/utils';

interface SendSmsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: any;
  onSuccess?: (record?: any) => void;
}

const ALLOWED_SEND_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'];

export default function SendSmsModal({
  open,
  onOpenChange,
  repair,
  onSuccess,
}: SendSmsModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeSmsRecordId, setActiveSmsRecordId] = useState<string | null>(null);

  // Confirmation flow state
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    channel: 'WINDOWS_PHONE_LINK' | 'SMS_PROTOCOL' | 'WHATSAPP';
    recordId: string;
  } | null>(null);

  // Synchronous lock against rapid multi-clicking
  const isProcessingRef = useRef(false);

  const userRole = (user?.role || '').toUpperCase().trim();
  const canSend = ALLOWED_SEND_ROLES.includes(userRole);
  const isManager = userRole === 'MANAGER';

  const customerName = repair?.customerName || repair?.customer?.name || 'Customer';
  const customerPhoneRaw = repair?.customerPhone || repair?.customer?.phone || '';
  const deviceModel = `${repair?.deviceBrand ? `${repair.deviceBrand} ` : ''}${repair?.deviceModel || 'Device'}`.trim();
  const repairNumber = repair?.repairNumber || repair?.id?.substring(0, 8) || 'MTS-Job';

  // Authoritative phone validation
  const phoneInfo = validateAndFormatNepalPhone(customerPhoneRaw);

  // Default standard message
  const defaultTemplate = generateRepairCompletedMessage({
    customerName,
    deviceModel,
    repairNumber,
  });

  // SMS encoding analysis
  const encodingInfo = analyzeSmsEncoding(message);

  // Fetch status and history from server when modal opens
  useEffect(() => {
    if (!open || !repair?.id) return;

    setMessage(defaultTemplate);
    setCopiedMessage(false);
    setCopiedPhone(false);
    setActiveSmsRecordId(null);
    setPendingConfirmation(null);
    isProcessingRef.current = false;

    let isMounted = true;
    setLoading(true);

    api
      .get(`/sms/repair/${repair.id}`)
      .then((data) => {
        if (isMounted && data) {
          if (data.defaultMessage) {
            setMessage(data.defaultMessage);
          }
          if (Array.isArray(data.history)) {
            setHistory(data.history);
            const activeDraft = data.history.find(
              (h: any) => h.status === 'OPENED' || h.status === 'PREPARED' || h.status === 'INITIATED'
            );
            if (activeDraft) {
              setActiveSmsRecordId(activeDraft.id);
            }
          }
        }
      })
      .catch(() => {
        // Fallback to legacy endpoint if /sms/repair fails
        api
          .get(`/repairs/${repair.id}/sms-status`)
          .then((legacyData) => {
            if (isMounted && legacyData) {
              if (legacyData.defaultMessage) setMessage(legacyData.defaultMessage);
              if (Array.isArray(legacyData.history)) setHistory(legacyData.history);
            }
          })
          .catch((err) => console.warn('[SMS STATUS FETCH WARN]', err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, repair?.id]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessage(true);
      toast.success('Message text copied to clipboard.');
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch (_) {
      toast.error('Could not copy to clipboard.');
    }
  };

  const handleCopyPhone = async () => {
    try {
      const phoneToCopy = phoneInfo.isValid ? phoneInfo.international : customerPhoneRaw;
      await navigator.clipboard.writeText(phoneToCopy);
      setCopiedPhone(true);
      toast.success('Customer phone copied to clipboard.');
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch (_) {
      toast.error('Could not copy phone number.');
    }
  };

  // Launch Windows Phone Link or native SMS protocol
  const handleSendViaPhoneLink = async () => {
    if (isProcessingRef.current || submitting) return;
    if (!phoneInfo.isValid) {
      toast.error(phoneInfo.error || 'Invalid customer phone number.');
      return;
    }

    const cleanMsg = (message || '').trim();
    if (!cleanMsg) {
      toast.error('SMS message content cannot be empty.');
      return;
    }

    if (!encodingInfo.isSingleSegment) {
      toast.error(
        `Message exceeds single-segment limit (${encodingInfo.unitsUsed}/${encodingInfo.maxUnitsSingleSegment} ${encodingInfo.encoding}). Please shorten the message.`
      );
      return;
    }

    isProcessingRef.current = true;
    setSubmitting(true);

    try {
      // 1. Copy message and phone to clipboard automatically for convenient backup
      try {
        await navigator.clipboard.writeText(cleanMsg);
        setCopiedMessage(true);
      } catch (_) {}

      // 2. Open notification attempt on backend
      const res = await api.post('/sms/open', {
        repairId: repair.id,
        smsRecordId: activeSmsRecordId || undefined,
        customMessage: cleanMsg,
        channel: 'WINDOWS_PHONE_LINK',
      });

      const record = res?.record;
      if (record) {
        setActiveSmsRecordId(record.id);
        setHistory((prev) => [record, ...prev.filter((p) => p.id !== record.id)]);
      }

      // 3. Launch protocol: sms:${phone}?body=${encoded}
      // On Windows with Phone Link paired, this automatically triggers Microsoft Phone Link or default SMS app.
      const smsUrl = `sms:${phoneInfo.international}?body=${encodeURIComponent(cleanMsg)}`;
      
      // Also try ms-phone-link if preferred, but standard sms: is universal
      window.location.href = smsUrl;

      // 4. Activate post-send confirmation modal state
      setPendingConfirmation({
        channel: 'WINDOWS_PHONE_LINK',
        recordId: record?.id || activeSmsRecordId || '',
      });

      toast.info('Windows Phone Link / SMS triggered. Please confirm once sent.', { duration: 5000 });
      if (onSuccess) onSuccess(record);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate Windows Phone Link.');
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  // Launch WhatsApp Click-to-Chat
  const handleSendViaWhatsApp = async () => {
    if (isProcessingRef.current || submitting) return;
    if (!phoneInfo.isValid) {
      toast.error(phoneInfo.error || 'Invalid customer phone number.');
      return;
    }

    const cleanMsg = (message || '').trim();
    if (!cleanMsg) {
      toast.error('Message content cannot be empty.');
      return;
    }

    isProcessingRef.current = true;
    setSubmitting(true);

    try {
      try {
        await navigator.clipboard.writeText(cleanMsg);
        setCopiedMessage(true);
      } catch (_) {}

      const res = await api.post('/sms/open', {
        repairId: repair.id,
        smsRecordId: activeSmsRecordId || undefined,
        customMessage: cleanMsg,
        channel: 'WHATSAPP',
      });

      const record = res?.record;
      if (record) {
        setActiveSmsRecordId(record.id);
        setHistory((prev) => [record, ...prev.filter((p) => p.id !== record.id)]);
      }

      // WhatsApp Click-to-Chat URL
      const waUrl = `https://wa.me/${phoneInfo.whatsappPhone}?text=${encodeURIComponent(cleanMsg)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      setPendingConfirmation({
        channel: 'WHATSAPP',
        recordId: record?.id || activeSmsRecordId || '',
      });

      toast.info('WhatsApp opened. Please confirm once message is sent.', { duration: 5000 });
      if (onSuccess) onSuccess(record);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open WhatsApp.');
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  // Staff Confirmation Actions
  const handleConfirmAction = async (confirmedStatus: 'STAFF_CONFIRMED_SENT' | 'FAILED', failureReason?: string) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const recordIdToConfirm = pendingConfirmation?.recordId || activeSmsRecordId;
      const res = await api.post('/sms/confirm', {
        smsRecordId: recordIdToConfirm,
        repairId: repair.id,
        status: confirmedStatus,
        failureReason,
      });

      if (confirmedStatus === 'STAFF_CONFIRMED_SENT') {
        toast.success(
          pendingConfirmation?.channel === 'WHATSAPP'
            ? 'WhatsApp notification confirmed sent.'
            : 'SMS notification confirmed sent.'
        );
      } else {
        toast.error('Notification recorded as failed.');
      }

      if (res?.record) {
        setHistory((prev) => [res.record, ...prev.filter((p) => p.id !== res.record.id)]);
      }
      setPendingConfirmation(null);
      if (onSuccess) onSuccess(res?.record);
      if (confirmedStatus === 'STAFF_CONFIRMED_SENT') {
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm notification.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canSend && !isManager) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              <span>Permission Denied</span>
            </DialogTitle>
            <DialogDescription>
              Sending customer SMS notifications is restricted to Super Admin, Admin, and Receptionist roles.
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

  const isSendDisabled =
    !phoneInfo.isValid ||
    submitting ||
    !message.trim() ||
    !encodingInfo.isSingleSegment ||
    !canSend;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>Customer SMS & Notification Center</span>
                {isManager && (
                  <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/40">
                    Read-Only (Manager)
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Staff-assisted notifications via Windows Phone Link, native SMS protocol, or WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-cyan-600" />
            <p className="text-xs font-semibold text-slate-500">Inspecting repair readiness & customer phone...</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Customer & Device Meta Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Customer</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">{customerName}</span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Repair Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate block">{repairNumber}</span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Device Model</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">{deviceModel}</span>
                </div>
              </div>

              {/* Phone Status Row */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-200">
                    {phoneInfo.isValid ? phoneInfo.displayFormatted : customerPhoneRaw || 'No phone recorded'}
                  </span>
                  {phoneInfo.isValid ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
                      Valid Nepal Mobile
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800">
                      Invalid Phone
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyPhone}
                    className="h-7 text-xs px-2.5 text-slate-600 dark:text-slate-300 hover:text-cyan-600"
                  >
                    {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedPhone ? 'Copied' : 'Copy Phone'}
                  </Button>
                </div>
              </div>

              {!phoneInfo.isValid && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{phoneInfo.error || 'Please update the customer mobile number before sending SMS.'}</span>
                </div>
              )}
            </div>

            {/* Post-Trigger Confirmation Banner (Visible when messaging was opened) */}
            {pendingConfirmation && (
              <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border-2 border-cyan-400 dark:border-cyan-600 shadow-lg space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Did you successfully dispatch this {pendingConfirmation.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}?
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Confirming will mark this notification as <strong>Staff-Confirmed Sent</strong> and log the staff member's timestamp in the audit trail.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={() => handleConfirmAction('STAFF_CONFIRMED_SENT')}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Yes, Confirmed Sent
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                    onClick={() => handleConfirmAction('FAILED', 'Staff reported delivery issue')}
                    disabled={submitting}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Report Failed
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-slate-500"
                    onClick={() => setPendingConfirmation(null)}
                    disabled={submitting}
                  >
                    Dismiss Prompt
                  </Button>
                </div>
              </div>
            )}

            {/* Notification Composer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-message" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Message Content</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-mono",
                    encodingInfo.encoding === 'GSM_7'
                      ? "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/60 dark:border-cyan-800"
                      : "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-800"
                  )}>
                    {encodingInfo.encoding} Encoding
                  </Badge>
                </Label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-slate-500 hover:text-slate-800"
                    onClick={() => setMessage(defaultTemplate)}
                    disabled={!canSend}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset Template
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-cyan-600 hover:text-cyan-700"
                    onClick={handleCopyMessage}
                  >
                    {copiedMessage ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedMessage ? 'Copied' : 'Copy Text'}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Textarea
                  id="sms-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!canSend}
                  rows={3}
                  className={cn(
                    "font-sans text-xs sm:text-sm resize-none pr-4 focus:ring-cyan-500",
                    !encodingInfo.isSingleSegment && "border-rose-400 focus:border-rose-500 focus:ring-rose-500"
                  )}
                  placeholder="Type repair completion message..."
                />
              </div>

              {/* Single-Segment & Character Counter Indicators */}
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono font-bold",
                    !encodingInfo.isSingleSegment ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"
                  )}>
                    {encodingInfo.unitsUsed} / {encodingInfo.maxUnitsSingleSegment} {encodingInfo.encoding === 'GSM_7' ? 'septets' : 'chars'}
                  </span>
                  
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold",
                    encodingInfo.isSingleSegment
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50"
                      : "text-rose-700 bg-rose-50 border-rose-300 dark:text-rose-400 dark:bg-rose-950/50"
                  )}>
                    {encodingInfo.segmentCount} / 1 Segment
                  </Badge>
                </div>

                <span className="text-[11px] text-slate-500">
                  {encodingInfo.isSingleSegment ? `${encodingInfo.remainingUnits} units remaining` : 'Exceeds 1 SMS limit!'}
                </span>
              </div>

              {/* Single-Segment Violation Warning Banner */}
              {!encodingInfo.isSingleSegment && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-bold">Single-Segment Policy Enforced: </span>
                    <span>
                      This message requires {encodingInfo.segmentCount} segments ({encodingInfo.unitsUsed}/{encodingInfo.maxUnitsSingleSegment} {encodingInfo.encoding}).
                      Please trim text so it fits in exactly 1 SMS (max {encodingInfo.maxUnitsSingleSegment} {encodingInfo.encoding === 'GSM_7' ? 'septets' : 'characters'}).
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            {canSend ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <Button
                  type="button"
                  onClick={handleSendViaPhoneLink}
                  disabled={isSendDisabled}
                  className="h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                  <span>Send via Windows Phone Link</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendViaWhatsApp}
                  disabled={!phoneInfo.isValid || submitting || !message.trim()}
                  className="h-11 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Send via WhatsApp</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>Manager accounts have read-only access. Sending notifications is reserved for Super Admin, Admin, and Receptionist.</span>
              </div>
            )}

            {/* Notification History for this Repair */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ticket Notification History ({history.length})</span>
                </h4>
              </div>

              {history.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No previous notification records for this repair ticket.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {history.map((record) => {
                    const isConfirmed = record.status === 'STAFF_CONFIRMED_SENT' || record.status === 'SENT';
                    const isWa = record.channel === 'WHATSAPP';
                    const isFailed = record.status === 'FAILED';

                    return (
                      <div
                        key={record.id}
                        className={cn(
                          "p-2.5 rounded-xl border text-xs space-y-1.5 transition-all",
                          isConfirmed
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
                            : isFailed
                            ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50"
                            : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold",
                                isConfirmed
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                  : isFailed
                                  ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                              )}
                            >
                              {record.status.replace(/_/g, ' ')}
                            </Badge>

                            <Badge variant="outline" className="text-[10px] text-slate-600 dark:text-slate-300">
                              {isWa ? 'WhatsApp' : record.channel?.replace(/_/g, ' ') || 'SMS'}
                            </Badge>
                          </div>

                          <span className="text-[10px] text-slate-400">
                            {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2 italic">
                          "{record.messageContent}"
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>By: {record.senderStaffName} ({record.senderStaffRole})</span>
                          {record.failureReason && (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold truncate max-w-[180px]">
                              Fail: {record.failureReason}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center sm:justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
            <span>MTS Lab Secure Messaging Hub</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
