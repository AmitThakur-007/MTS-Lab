import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  Plus, 
  Layers, 
  FileText, 
  Loader2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Scan
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  partitionDevicesForBills, 
  downloadServiceSlipPdf, 
  generateVectorSlipPdf,
  printServiceSlipElement, 
  RepairSlipItem, 
  ServiceSlipCustomer 
} from '@/services/serviceSlipService';
import ServiceSlipDocument from './ServiceSlipDocument';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ServiceSlipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repairs: RepairSlipItem[] | any[];
  customer: ServiceSlipCustomer | any;
  onDone?: () => void;
  onNewIntake?: () => void;
}

export const ServiceSlipModal: React.FC<ServiceSlipModalProps> = ({
  open,
  onOpenChange,
  repairs,
  customer,
  onDone,
  onNewIntake
}) => {
  const [activeBillIndex, setActiveBillIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  
  // Responsive zoom and container scaling state
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isAutoFit, setIsAutoFit] = useState(true);

  // Normalize customer and repairs
  const normalizedCustomer: ServiceSlipCustomer = useMemo(() => ({
    id: customer?.id || '',
    customerId: customer?.customerId || '',
    name: customer?.name || customer?.customerName || 'Valued Customer',
    phone: customer?.phone || customer?.customerPhone || '',
    email: customer?.email || customer?.customerEmail || '',
    address: customer?.address || customer?.customerAddress || ''
  }), [customer]);

  const normalizedRepairs: RepairSlipItem[] = useMemo(() => {
    const list = Array.isArray(repairs) ? repairs : [repairs];
    return list.filter(Boolean).map(r => ({
      id: r.id || '',
      repairNumber: r.repairNumber || '',
      deviceBrand: r.deviceBrand || '',
      deviceModel: r.deviceModel || '',
      imeiNumber: r.imeiNumber || null,
      deviceColor: r.deviceColor || null,
      deviceCondition: r.deviceCondition || 'Fair',
      problemDescription: r.problemDescription || 'Inspection & Repair',
      accessoriesReceived: r.accessoriesReceived || null,
      estimatedCost: r.estimatedCost ?? null,
      advancePaid: r.advancePaid ?? null,
      status: r.status || 'RECEIVED',
      receivingMethod: r.receivingMethod || 'WALK_IN',
      courierCompany: r.courierCompany || null,
      courierTrackingNumber: r.courierTrackingNumber || null,
      createdAt: r.createdAt || new Date(),
      registrationDate: r.registrationDate || r.createdAt || new Date()
    }));
  }, [repairs]);

  // Check if any of the target repairs are DELIVERED
  const isDelivered = useMemo(() => {
    return normalizedRepairs.some(r => String(r.status || '').toUpperCase() === 'DELIVERED');
  }, [normalizedRepairs]);

  // Partition devices for bills according to even/odd rules
  const bills = useMemo(() => {
    return partitionDevicesForBills(normalizedRepairs, normalizedCustomer);
  }, [normalizedRepairs, normalizedCustomer]);

  const currentBill = bills[activeBillIndex] || bills[0];

  // Dynamic Fit Scale Calculation based on available viewport and document dimensions (794x520)
  const calculateFitScale = useCallback(() => {
    if (!containerRef.current) {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (winW < 640) return Math.min(0.48, +((winW - 24) / 794).toFixed(2));
      if (winW < 1024) return Math.min(0.92, +((winW - 48) / 794).toFixed(2));
      return 1.0;
    }
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const paddingX = window.innerWidth < 640 ? 12 : 28;
    const paddingY = window.innerWidth < 640 ? 12 : 28;
    const availableW = Math.max(260, containerWidth - paddingX);
    const availableH = Math.max(200, containerHeight - paddingY);
    
    const scaleW = availableW / 794;
    const scaleH = availableH / 520;
    
    // Choose optimal scale to keep complete landscape document visible in view
    // Allow up to 1.15 scale on wide high-res laptop/desktop screens
    const fit = Math.min(1.15, Math.max(0.35, +(Math.min(scaleW, scaleH) * 0.98).toFixed(2)));
    return fit;
  }, []);

  const handleFitToScreen = useCallback(() => {
    const fit = calculateFitScale();
    setZoomScale(fit);
    setIsAutoFit(true);
  }, [calculateFitScale]);

  // Auto-scale on modal open and window resize with ResizeObserver
  useEffect(() => {
    if (!open) return;
    
    // Initial calculate after DOM painted
    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 40);

    const el = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (isAutoFit) {
          handleFitToScreen();
        }
      });
      observer.observe(el);
    }

    const onWindowResize = () => {
      if (isAutoFit) {
        handleFitToScreen();
      }
    };

    window.addEventListener('resize', onWindowResize);
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [open, isAutoFit, handleFitToScreen]);

  // Print Handler
  const handlePrint = () => {
    const el = document.getElementById(`service-slip-view-${activeBillIndex}`) || document.getElementById(`service-slip-batch-${activeBillIndex}`);
    if (!el) {
      toast.error('Could not locate printable slip element.');
      return;
    }
    printServiceSlipElement(el);
  };

  // Download PDF Handler
  const handleDownloadPdf = async () => {
    if (!currentBill) return;
    const el = document.getElementById(`service-slip-view-${activeBillIndex}`) || document.getElementById(`service-slip-batch-${activeBillIndex}`);
    if (!el) {
      toast.error('Could not locate printable slip element.');
      return;
    }

    setDownloading(true);
    try {
      const billRef = currentBill.devices.map(d => d.repairNumber).join('-');
      const fileName = `MTS-Service-Slip-${billRef || 'bill'}.pdf`;
      await downloadServiceSlipPdf(el, fileName, currentBill);
      toast.success(`Downloaded Service Slip (${fileName})`);
    } catch (err: any) {
      console.error('[DOWNLOAD SERVICE SLIP ERROR]', err);
      const fallbackSuccess = generateVectorSlipPdf(currentBill, `MTS-Service-Slip-${currentBill.devices[0]?.repairNumber || 'bill'}.pdf`);
      if (fallbackSuccess) {
        toast.success('Downloaded Service Slip PDF (Standard Format)');
      } else {
        toast.error(err?.message || 'Failed to generate Service Slip PDF');
      }
    } finally {
      setDownloading(false);
    }
  };

  // Download All Bills Handler
  const handleDownloadAll = async () => {
    if (bills.length <= 1) {
      await handleDownloadPdf();
      return;
    }

    setDownloadingAll(true);
    try {
      for (let i = 0; i < bills.length; i++) {
        setActiveBillIndex(i);
        await new Promise(r => setTimeout(r, 120));
        const el = document.getElementById(`service-slip-view-${i}`) || document.getElementById(`service-slip-batch-${i}`);
        if (el) {
          const billRef = bills[i].devices.map(d => d.repairNumber).join('-');
          const fileName = `MTS-Service-Slip-Bill-${i + 1}-${billRef || 'bill'}.pdf`;
          await downloadServiceSlipPdf(el, fileName, bills[i]);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      toast.success(`Downloaded all ${bills.length} Service Slips`);
    } catch (err: any) {
      console.error('[DOWNLOAD ALL ERROR]', err);
      toast.error(err?.message || 'Failed to download all bills');
    } finally {
      setDownloadingAll(false);
    }
  };

  if (isDelivered) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-center space-y-4 bg-slate-900 text-white border border-slate-800 shadow-2xl">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
              SERVICE SLIP EXPIRED
            </Badge>
            <DialogTitle className="text-lg font-black text-white">Service Slip Unavailable</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Service Slip is no longer available because this repair has been delivered. When a repair reaches final delivery, its temporary Service Slip artifact is permanently deleted from storage for security & privacy compliance.
            </DialogDescription>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-10 rounded-xl text-xs cursor-pointer"
            >
              Close Dialog
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!currentBill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-screen sm:w-[92vw] lg:w-[90vw] max-w-none sm:max-w-[92vw] lg:max-w-[1200px] h-[100dvh] sm:h-auto sm:max-h-[85vh] lg:max-h-[90vh] p-0 rounded-none sm:rounded-3xl overflow-hidden border-0 sm:border border-slate-800 shadow-2xl flex flex-col bg-slate-900 text-slate-100"
      >
        
        {/* 1. Fixed Header Bar */}
        <DialogHeader className="px-4 sm:px-6 py-3 bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-sm sm:text-base font-black text-white truncate">
                  Official Service Slip
                </DialogTitle>
                <Badge variant="outline" className="hidden xs:inline-flex bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold py-0 h-4 shrink-0">
                  A4 / A5
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-400 truncate mt-0.5">
                <span className="font-semibold text-slate-200">{normalizedCustomer.name}</span>
                {normalizedCustomer.phone && <span className="text-slate-400"> ({normalizedCustomer.phone})</span>}
                {' '}• <span className="font-medium text-emerald-400">{normalizedRepairs.length} {normalizedRepairs.length === 1 ? 'Device' : 'Devices'}</span>
              </DialogDescription>
            </div>
          </div>

          {/* Quick Zoom & Fit Controls: − Fit + Expand */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setZoomScale(s => Math.max(0.32, +(s - 0.1).toFixed(2)));
                  setIsAutoFit(false);
                }}
                className="h-7 w-7 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="Zoom Out (−)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <button
                type="button"
                onClick={handleFitToScreen}
                className="text-[11px] font-mono font-bold px-2 text-slate-300 hover:text-emerald-400 select-none cursor-pointer transition-colors"
                title="Reset to Fit View"
              >
                {Math.round(zoomScale * 100)}%{isAutoFit ? ' (Fit)' : ''}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setZoomScale(s => Math.min(1.8, +(s + 0.1).toFixed(2)));
                  setIsAutoFit(false);
                }}
                className="h-7 w-7 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (zoomScale === 1 && !isAutoFit) {
                    handleFitToScreen();
                  } else {
                    setZoomScale(1);
                    setIsAutoFit(false);
                  }
                }}
                className={cn(
                  "h-7 w-7 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer",
                  zoomScale === 1 && !isAutoFit ? "bg-slate-700 text-emerald-400 font-bold" : ""
                )}
                title={zoomScale === 1 && !isAutoFit ? "Reset to Fit" : "Expand to 100% Actual Size"}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 2. Multi-Bill Tabs (For 3, 5, 7+ devices) */}
        {bills.length > 1 && (
          <div className="px-4 sm:px-6 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0 mr-3">
              <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-300">Partitioned Bills:</span>
            </div>

            <Tabs value={String(activeBillIndex)} onValueChange={v => setActiveBillIndex(Number(v))} className="w-auto shrink-0">
              <TabsList className="bg-slate-800/90 border border-slate-700 h-8 p-1 rounded-xl">
                {bills.map((bill, idx) => (
                  <TabsTrigger 
                    key={idx} 
                    value={String(idx)}
                    className="rounded-lg text-xs font-bold px-3 py-0.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 cursor-pointer"
                  >
                    Bill {idx + 1} ({bill.devices.length} {bill.devices.length === 1 ? 'Device' : 'Devices'})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* 3. Document Preview Canvas Area (Full Responsive Fit, No Double Scrollbars) */}
        <div 
          ref={containerRef}
          className="flex-1 p-2 sm:p-5 flex flex-col items-center justify-center bg-slate-950/90 min-h-0 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
          {/* Scaled Canvas Wrapper */}
          <div 
            className="relative transition-transform duration-100 ease-out shadow-2xl rounded-sm overflow-hidden border border-slate-700/60 bg-white"
            style={{
              width: `${Math.round(794 * zoomScale)}px`,
              height: `${Math.round(520 * zoomScale)}px`,
              minWidth: `${Math.round(794 * zoomScale)}px`,
              minHeight: `${Math.round(520 * zoomScale)}px`,
              margin: 'auto'
            }}
          >
            <div
              style={{
                width: '794px',
                height: '520px',
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0
              }}
            >
              {/* Active Bill Preview */}
              <div id={`service-slip-view-${activeBillIndex}`}>
                <ServiceSlipDocument data={currentBill} />
              </div>
            </div>
          </div>

          {/* Off-screen staging container for all bills (Used for 100% DPI PDF captures) */}
          <div 
            aria-hidden="true" 
            style={{ 
              position: 'fixed', 
              left: '-9999px', 
              top: '0px', 
              width: '794px', 
              height: '520px', 
              overflow: 'hidden', 
              pointerEvents: 'none', 
              opacity: 0,
              zIndex: -1
            }}
          >
            {bills.map((bill, idx) => (
              <div key={idx} id={`service-slip-batch-${idx}`}>
                <ServiceSlipDocument data={bill} />
              </div>
            ))}
          </div>
        </div>

        {/* 4. Fixed Footer Actions Bar */}
        <DialogFooter className="px-4 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            {onNewIntake && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onNewIntake();
                }}
                className="rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-bold h-10 px-3.5 text-xs cursor-pointer flex-1 sm:flex-initial"
              >
                <Plus className="w-4 h-4 mr-1.5 text-emerald-400" />
                <span>New Intake</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                if (onDone) onDone();
              }}
              className="rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-bold h-10 px-3.5 text-xs cursor-pointer flex-1 sm:flex-initial"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-slate-400" />
              <span>Done</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 justify-end flex-wrap sm:flex-nowrap">
            {bills.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="rounded-xl border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-100 font-bold h-10 px-3.5 text-xs cursor-pointer flex-1 sm:flex-initial"
              >
                {downloadingAll ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-emerald-400" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5 text-emerald-400" />
                )}
                <span>All ({bills.length} Bills)</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-xl border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold h-10 px-4 text-xs cursor-pointer flex-1 sm:flex-initial shadow-xs"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 mr-1.5 text-emerald-400" />
              )}
              <span>Download PDF</span>
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black h-10 px-5 text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex-1 sm:flex-initial"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              <span>Print Slip</span>
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

export default ServiceSlipModal;
