import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Truck, 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Phone, 
  MessageSquare, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Send, 
  Copy, 
  Check, 
  MoreVertical, 
  ExternalLink, 
  RotateCw, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  BatteryCharging, 
  Smartphone, 
  User, 
  Banknote, 
  Layers, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  Navigation,
  FileText,
  X,
  Share2,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { formatNepalPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const INCOMING_STATUS_OPTIONS = [
  { value: 'COURIER_REQUESTED', label: 'Courier Requested', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'PICKED_UP', label: 'Picked Up by Courier', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'IN_TRANSIT', label: 'In Transit to MTS Lab', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'RECEIVED_AT_LAB', label: 'Received at MTS Lab', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
];

const OUTGOING_STATUS_OPTIONS = [
  { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'COURIER_BOOKED', label: 'Courier Booked', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'DISPATCHED', label: 'Dispatched via Courier', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'IN_TRANSIT', label: 'In Transit to Customer', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'DELIVERED', label: 'Delivered to Customer', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
];

const POPULAR_COURIERS = [
  "Nepal Can Move (NCM)",
  "Sundarban Courier",
  "Nepal Post (EMS)",
  "Gorkha Courier",
  "Pathao Logistics",
  "ShipXpress Nepal",
  "Air Cargo Nepal",
  "NMC Cargo & Logistics",
  "United Logistics",
  "FedEx / DHL Nepal",
  "Local Bus / Transporter",
  "Other Courier"
];

export const NCM_TRACKING_URL = "https://portal.nepalcanmove.com/track/";
export const MTS_OFFICIAL_WEBSITE = "https://www.mobiletechnologystation.com.np/";
export const MTS_OFFICIAL_PHONE = "+977-9869276668";

export const isNepalCanMove = (company: string = '') => {
  const norm = (company || '').toLowerCase();
  return norm.includes('nepal can move') || norm.includes('ncm');
};

export default function CourierManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Shipments & Stats
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalShipments: 0,
    incomingTotal: 0,
    outgoingTotal: 0,
    incomingToday: 0,
    outgoingToday: 0,
    inTransit: 0,
    receivedAtLab: 0,
    readyForDispatch: 0,
    dispatched: 0,
    delivered: 0,
    totalCharges: 0
  });

  // Dynamic Filter Metadata
  const [filtersMetadata, setFiltersMetadata] = useState<{ courierCompanies: string[]; districts: string[] }>({
    courierCompanies: [],
    districts: []
  });

  // Multi-Select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter States
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [courierCompanyFilter, setCourierCompanyFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modals & Drawers
  const [incomingModalOpen, setIncomingModalOpen] = useState(false);
  const [outgoingModalOpen, setOutgoingModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkArchiveModalOpen, setBulkArchiveModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [eligibleRepairs, setEligibleRepairs] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Customer Autocomplete for Intake
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // Duplicate AWB check warning
  const [duplicateAwbWarning, setDuplicateAwbWarning] = useState<any>(null);

  // Incoming Form State
  const [incomingMode, setIncomingMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [incomingForm, setIncomingForm] = useState({
    existingRepairId: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerWhatsapp: '',
    customerDistrict: 'Kathmandu',
    customerMunicipality: '',
    customerAddress: '',
    deviceBrand: 'apple',
    deviceModel: '',
    imeiNumber: '',
    deviceCondition: 'Good (Minor Wear)',
    problemDescription: 'Courier Intake - Diagnostics & Repair',
    accessoriesReceived: '',
    courierCompany: 'Nepal Can Move (NCM)',
    courierTrackingNumber: '',
    senderName: '',
    senderPhone: '',
    senderWhatsapp: '',
    originDistrict: 'Kathmandu',
    originAddress: '',
    courierInCharge: '',
    courierInPaymentStatus: 'UNPAID',
    courierDate: format(new Date(), 'yyyy-MM-dd'),
    courierReceivedDate: format(new Date(), 'yyyy-MM-dd'),
    courierNotes: ''
  });

  // Outgoing Form State
  const [outgoingForm, setOutgoingForm] = useState({
    repairId: '',
    returnCourierCompany: 'Nepal Can Move (NCM)',
    returnCourierTrackingNumber: '',
    returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
    destinationDistrict: '',
    destinationAddress: '',
    receiverName: '',
    receiverPhone: '',
    receiverWhatsapp: '',
    courierOutCharge: '',
    courierOutPaymentStatus: 'UNPAID',
    returnCourierNotes: ''
  });

  // Status Update Form State
  const [statusUpdateForm, setStatusUpdateForm] = useState({
    courierType: 'OUTGOING',
    status: '',
    notes: ''
  });

  // Bulk Status Update Form State
  const [bulkStatusForm, setBulkStatusForm] = useState({
    status: 'IN_TRANSIT',
    courierType: 'OUTGOING',
    notes: ''
  });

  // Dynamic WhatsApp Message State
  const [whatsappTemplateType, setWhatsappTemplateType] = useState<'DISPATCH' | 'RECEIVED' | 'DELIVERED'>('DISPATCH');
  const [customWhatsappText, setCustomWhatsappText] = useState('');

  // Fetch Metadata & Shipments
  const fetchMetadata = async () => {
    try {
      const data = await api.get('/couriers/filters-metadata');
      if (data) setFiltersMetadata(data);
    } catch (err) {
      console.warn("Could not load courier filter metadata:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.set('type', activeTab);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (courierCompanyFilter !== 'ALL') params.set('courierCompany', courierCompanyFilter);
      if (districtFilter !== 'ALL') params.set('district', districtFilter);
      if (paymentStatusFilter !== 'ALL') params.set('paymentStatus', paymentStatusFilter);
      if (dateRangeFilter !== 'ALL') params.set('dateRange', dateRangeFilter);
      if (dateRangeFilter === 'CUSTOM' && customStartDate) {
        params.set('startDate', customStartDate);
        if (customEndDate) params.set('endDate', customEndDate);
      }
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (sortBy) params.set('sortBy', sortBy);

      const [shipmentsRes, statsRes] = await Promise.all([
        api.get(`/couriers?${params.toString()}`),
        api.get('/couriers/stats')
      ]);

      const list = shipmentsRes?.shipments || (Array.isArray(shipmentsRes) ? shipmentsRes : []);
      setShipments(list);
      if (statsRes) setStats(statsRes);
    } catch (err: any) {
      console.error("Failed to load courier hub data:", err);
      toast.error(err?.message || "Failed to load courier shipments.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleRepairs = async () => {
    try {
      const data = await api.get('/couriers/eligible-repairs');
      setEligibleRepairs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load eligible repairs:", err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter, courierCompanyFilter, districtFilter, paymentStatusFilter, dateRangeFilter, customStartDate, customEndDate, sortBy]);

  // Real-time synchronization
  useRealtimeSync(['courier', 'repair', 'repairLog'], () => {
    fetchData();
    fetchMetadata();
  });

  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 350);
  };

  // Customer phone live search debounce during intake
  const customerSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleCustomerPhoneInputChange = (phoneVal: string) => {
    setIncomingForm(prev => ({ ...prev, customerPhone: phoneVal, senderPhone: phoneVal }));
    if (customerSearchTimeoutRef.current) clearTimeout(customerSearchTimeoutRef.current);
    if (phoneVal.trim().length >= 3) {
      setIsSearchingCustomers(true);
      customerSearchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await api.get(`/couriers/search-customers?query=${encodeURIComponent(phoneVal.trim())}`);
          setCustomerSuggestions(Array.isArray(res) ? res : []);
        } catch {
          setCustomerSuggestions([]);
        } finally {
          setIsSearchingCustomers(false);
        }
      }, 300);
    } else {
      setCustomerSuggestions([]);
      setIsSearchingCustomers(false);
    }
  };

  // Select existing customer suggestion
  const handleSelectCustomerSuggestion = (c: any) => {
    setIncomingForm(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.name || prev.customerName,
      customerPhone: c.phone || prev.customerPhone,
      customerWhatsapp: c.alternativePhone || c.phone || prev.customerWhatsapp,
      customerDistrict: c.district || prev.customerDistrict,
      customerMunicipality: c.municipality || prev.customerMunicipality,
      customerAddress: c.address || prev.customerAddress,
      senderName: c.name || prev.senderName,
      senderPhone: c.phone || prev.senderPhone,
      originDistrict: c.district || prev.originDistrict,
      originAddress: c.address || prev.originAddress
    }));
    setCustomerSuggestions([]);
    toast.success(`Loaded customer ${c.name} (${c.phone}). Duplicate avoided!`);
  };

  // Check duplicate AWB
  const checkDuplicateAwb = async (awb: string) => {
    if (!awb.trim()) {
      setDuplicateAwbWarning(null);
      return;
    }
    try {
      const res = await api.post('/couriers/check-duplicate-awb', { trackingNumber: awb.trim() });
      if (res?.exists) {
        setDuplicateAwbWarning(res.duplicateRepair);
      } else {
        setDuplicateAwbWarning(null);
      }
    } catch {
      setDuplicateAwbWarning(null);
    }
  };

  // Interactive KPI Summary Card Click Handler
  const handleCardClick = (targetStatus: string) => {
    if (targetStatus === 'TOTAL') {
      setStatusFilter('ALL');
    } else if (statusFilter === targetStatus) {
      setStatusFilter('ALL');
    } else {
      setStatusFilter(targetStatus);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied "${text}" to clipboard.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Direct Call helper
  const handleDirectCall = (phone: string) => {
    if (!phone) {
      toast.error("No phone number available for this contact.");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    window.open(`tel:${cleanPhone}`, '_self');
  };

  // WhatsApp Message Modal Helper
  const openWhatsAppModal = (shipment: any, type: 'DISPATCH' | 'RECEIVED' | 'DELIVERED' = 'DISPATCH') => {
    setSelectedShipment(shipment);
    setWhatsappTemplateType(type);
    
    const customerName = shipment.receiverName || shipment.customerName || shipment.customer?.name || 'Valued Customer';
    const repairNo = shipment.repairNumber || 'MTS-JOB';
    const trackingNo = shipment.returnCourierTrackingNumber || shipment.courierTrackingNumber || 'Pending';
    const courierPartner = shipment.returnCourierCompany || shipment.courierCompany || 'Courier Logistics';
    const deviceModel = `${(shipment.deviceBrand || '').toUpperCase()} ${shipment.deviceModel || ''}`.trim();

    let msg = '';
    if (type === 'DISPATCH') {
      const isNCM = isNepalCanMove(courierPartner);
      if (isNCM) {
        msg = `Hello ${customerName},\n\nYour repaired device (${deviceModel}) under Repair Job #${repairNo} has been dispatched through Nepal Can Move.\n\n📦 Courier: Nepal Can Move\n🔎 Tracking ID: ${trackingNo}\n\n🚚 Track with Nepal Can Move:\n${NCM_TRACKING_URL}\n\n🔧 Track your repair through MTS Lab:\n${MTS_OFFICIAL_WEBSITE}track?repairNumber=${repairNo}\n\n📞 Support: ${MTS_OFFICIAL_PHONE}\n\nYou can use your tracking ID on the Nepal Can Move tracking page to check the courier status.\n\nThank you for choosing MTS Lab!`;
      } else {
        msg = `Hello ${customerName},\n\nYour repaired device (${deviceModel}) under Repair Job #${repairNo} has been dispatched via ${courierPartner}.\n\n📦 Courier Tracking / AWB No: ${trackingNo}\n\n🔧 Track your live service status anytime on our website:\n${MTS_OFFICIAL_WEBSITE}track?repairNumber=${repairNo}\n\n📞 Support: ${MTS_OFFICIAL_PHONE}\n\nThank you for choosing MTS Lab!`;
      }
    } else if (type === 'RECEIVED') {
      msg = `Hello ${customerName},\n\nWe have safely received your device (${deviceModel}) at MTS Lab via ${courierPartner} (AWB #${trackingNo}).\n\n📋 Repair Ticket: #${repairNo}\nOur micro-engineers will initiate diagnosis and keep you updated.\n\nTrack progress: ${MTS_OFFICIAL_WEBSITE}track?repairNumber=${repairNo}\n\n📞 Support: ${MTS_OFFICIAL_PHONE}\n\n— MTS Lab Repair Management`;
    } else {
      msg = `Hello ${customerName},\n\nYour device (${deviceModel}) for Repair Job #${repairNo} has been delivered successfully.\n\nWe hope you are satisfied with our repair service. If you have any questions or need further assistance, please feel free to contact MTS Lab.\n\nThank you for trusting MTS Lab!`;
    }
    setCustomWhatsappText(msg);
    setWhatsappModalOpen(true);
  };

  const executeSendWhatsApp = () => {
    if (!selectedShipment) return;
    const rawPhone = selectedShipment.receiverWhatsapp || selectedShipment.receiverPhone || selectedShipment.customerPhone || selectedShipment.senderWhatsapp || selectedShipment.senderPhone || '';
    if (!rawPhone) {
      toast.error("No valid phone/WhatsApp number found.");
      return;
    }
    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('977')) {
      cleanPhone = `977${cleanPhone}`;
    }
    const encoded = encodeURIComponent(customWhatsappText);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    setWhatsappModalOpen(false);
    toast.success("WhatsApp message dispatched successfully!");
  };

  // Submit Incoming Courier
  const handleIncomingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingForm.courierCompany || !incomingForm.courierTrackingNumber.trim()) {
      toast.error("Courier Company and Tracking Number are required.");
      return;
    }

    try {
      const payload: any = {
        courierCompany: incomingForm.courierCompany.trim(),
        courierTrackingNumber: incomingForm.courierTrackingNumber.trim(),
        originDistrict: incomingForm.originDistrict.trim() || 'Kathmandu',
        originAddress: incomingForm.originAddress.trim() || null,
        senderName: incomingForm.senderName.trim() || incomingForm.customerName.trim(),
        senderPhone: incomingForm.senderPhone.trim() || incomingForm.customerPhone.trim(),
        senderWhatsapp: incomingForm.senderWhatsapp.trim() || null,
        courierInCharge: incomingForm.courierInCharge ? Number(incomingForm.courierInCharge) : null,
        courierInPaymentStatus: incomingForm.courierInPaymentStatus,
        courierDate: incomingForm.courierDate ? new Date(incomingForm.courierDate).toISOString() : new Date().toISOString(),
        courierReceivedDate: incomingForm.courierReceivedDate ? new Date(incomingForm.courierReceivedDate).toISOString() : new Date().toISOString(),
        courierNotes: incomingForm.courierNotes.trim() || null
      };

      if (incomingMode === 'EXISTING') {
        if (!incomingForm.existingRepairId) {
          toast.error("Please select an existing repair to link.");
          return;
        }
        payload.existingRepairId = incomingForm.existingRepairId;
      } else {
        if (!incomingForm.customerName.trim() || !incomingForm.customerPhone.trim()) {
          toast.error("Customer Name and Phone Number are required.");
          return;
        }
        if (!incomingForm.deviceModel.trim()) {
          toast.error("Device Model is required.");
          return;
        }
        payload.isNewRepair = true;
        payload.customerName = incomingForm.customerName.trim();
        payload.customerPhone = formatNepalPhone(incomingForm.customerPhone);
        payload.customerWhatsapp = incomingForm.customerWhatsapp.trim() || null;
        payload.customerDistrict = incomingForm.customerDistrict;
        payload.customerMunicipality = incomingForm.customerMunicipality.trim() || null;
        payload.customerAddress = incomingForm.customerAddress.trim() || null;
        payload.deviceBrand = incomingForm.deviceBrand;
        payload.deviceModel = incomingForm.deviceModel.trim();
        payload.imeiNumber = incomingForm.imeiNumber.trim() || null;
        payload.deviceCondition = incomingForm.deviceCondition;
        payload.problemDescription = incomingForm.problemDescription.trim() || 'Courier Intake';
        payload.accessoriesReceived = incomingForm.accessoriesReceived.trim() || null;
      }

      const res: any = await api.post('/couriers/incoming', payload);
      toast.success(res?.message || "Inbound courier shipment registered successfully.");
      setIncomingModalOpen(false);
      fetchData();
      fetchMetadata();
    } catch (err: any) {
      console.error("[INCOMING COURIER ERROR]", err);
      toast.error(err?.message || "Failed to register inbound courier shipment.");
    }
  };

  // Submit Outgoing Courier
  const handleOutgoingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outgoingForm.repairId) {
      toast.error("Please select a repair to dispatch.");
      return;
    }
    if (!outgoingForm.returnCourierCompany || !outgoingForm.returnCourierCompany.trim()) {
      toast.error("Courier Partner is required.");
      return;
    }
    if (!outgoingForm.returnCourierTrackingNumber.trim()) {
      if (isNepalCanMove(outgoingForm.returnCourierCompany)) {
        toast.error("Please enter the Nepal Can Move tracking ID before dispatching.");
      } else {
        toast.error("Courier Tracking / AWB Number is required before dispatching.");
      }
      return;
    }

    try {
      const payload = {
        repairId: outgoingForm.repairId,
        returnCourierCompany: outgoingForm.returnCourierCompany.trim(),
        returnCourierTrackingNumber: outgoingForm.returnCourierTrackingNumber.trim(),
        returnCourierDispatchDate: outgoingForm.returnCourierDispatchDate ? new Date(outgoingForm.returnCourierDispatchDate).toISOString() : new Date().toISOString(),
        destinationDistrict: outgoingForm.destinationDistrict.trim() || null,
        destinationAddress: outgoingForm.destinationAddress.trim() || null,
        receiverName: outgoingForm.receiverName.trim() || null,
        receiverPhone: outgoingForm.receiverPhone.trim() ? formatNepalPhone(outgoingForm.receiverPhone) : null,
        receiverWhatsapp: outgoingForm.receiverWhatsapp.trim() || null,
        courierOutCharge: outgoingForm.courierOutCharge ? Number(outgoingForm.courierOutCharge) : null,
        courierOutPaymentStatus: outgoingForm.courierOutPaymentStatus,
        returnCourierNotes: outgoingForm.returnCourierNotes.trim() || null
      };

      const res: any = await api.post('/couriers/outgoing', payload);
      toast.success(res?.message || "Outbound courier dispatch created successfully.");
      setOutgoingModalOpen(false);
      fetchData();
      fetchMetadata();
    } catch (err: any) {
      console.error("[OUTGOING COURIER ERROR]", err);
      toast.error(err?.message || "Failed to dispatch courier return.");
    }
  };

  // Handle Select Eligible Repair
  const handleSelectEligibleRepair = (repairId: string) => {
    const rep = eligibleRepairs.find(r => r.id === repairId);
    if (!rep) return;
    setOutgoingForm(prev => ({
      ...prev,
      repairId: rep.id,
      receiverName: rep.customerName || rep.customer?.name || '',
      receiverPhone: rep.customerPhone || rep.customer?.phone || '',
      receiverWhatsapp: rep.customerPhone || '',
      destinationDistrict: rep.customer?.district || 'Kathmandu',
      destinationAddress: rep.customerAddress || rep.customer?.address || ''
    }));
  };

  // Status Update Submit
  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !statusUpdateForm.status) return;

    try {
      const res: any = await api.patch(`/couriers/${selectedShipment.id}/status`, {
        courierType: statusUpdateForm.courierType,
        status: statusUpdateForm.status,
        notes: statusUpdateForm.notes.trim() || null
      });

      toast.success(res?.message || "Courier status updated successfully.");
      setStatusModalOpen(false);
      if (detailsModalOpen && selectedShipment) {
        setSelectedShipment(res.repair || { ...selectedShipment, ...res });
      }
      fetchData();
    } catch (err: any) {
      console.error("[UPDATE STATUS ERROR]", err);
      toast.error(err?.message || "Failed to update shipment status.");
    }
  };

  // Bulk Status Update Submit
  const handleBulkStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    try {
      const res: any = await api.post('/couriers/bulk-status', {
        repairIds: selectedIds,
        status: bulkStatusForm.status,
        courierType: bulkStatusForm.courierType,
        notes: bulkStatusForm.notes.trim() || null
      });

      toast.success(res?.message || `Updated ${selectedIds.length} shipments.`);
      setBulkStatusModalOpen(false);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      console.error("[BULK STATUS ERROR]", err);
      toast.error(err?.message || "Failed to perform bulk status update.");
    }
  };

  // Bulk Archive Submit
  const handleBulkArchiveSubmit = async () => {
    if (selectedIds.length === 0) return;

    try {
      const res: any = await api.post('/couriers/bulk-archive', {
        repairIds: selectedIds
      });

      toast.success(res?.message || `Archived ${selectedIds.length} shipments.`);
      setBulkArchiveModalOpen(false);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      console.error("[BULK ARCHIVE ERROR]", err);
      toast.error(err?.message || "Failed to archive selected shipments.");
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0 
      ? shipments.filter(s => selectedIds.includes(s.id))
      : shipments;

    if (listToExport.length === 0) {
      toast.error("No shipments available to export.");
      return;
    }

    const headers = [
      "Repair Number",
      "Direction",
      "Customer Name",
      "Phone",
      "District",
      "Device",
      "Courier Partner",
      "AWB Tracking Number",
      "Status",
      "Courier Charge (NPR)",
      "Payment Status",
      "Created Date"
    ];

    const rows = listToExport.map(s => {
      const isOut = s.isCourierOut || s.isReturnCourierDispatched || s.courierStatus === 'COURIER_DISPATCHED' || s.courierOutStatus;
      return [
        `"${s.repairNumber || ''}"`,
        isOut ? "OUTBOUND" : "INBOUND",
        `"${(isOut ? s.receiverName || s.customerName : s.senderName || s.customerName) || ''}"`,
        `"${(isOut ? s.receiverPhone || s.customerPhone : s.senderPhone || s.customerPhone) || ''}"`,
        `"${(isOut ? s.destinationDistrict : s.originDistrict) || ''}"`,
        `"${(s.deviceBrand || '').toUpperCase()} ${s.deviceModel || ''}"`,
        `"${(isOut ? s.returnCourierCompany : s.courierCompany) || ''}"`,
        `"${(isOut ? s.returnCourierTrackingNumber : s.courierTrackingNumber) || ''}"`,
        `"${(isOut ? s.courierOutStatus || s.status : s.courierInStatus || s.status) || ''}"`,
        isOut ? (s.courierOutCharge || 0) : (s.courierInCharge || 0),
        isOut ? (s.courierOutPaymentStatus || 'UNPAID') : (s.courierInPaymentStatus || 'UNPAID'),
        `"${s.createdAt ? format(new Date(s.createdAt), 'yyyy-MM-dd') : ''}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MTS_Courier_Shipments_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${listToExport.length} shipment records to CSV.`);
  };

  // Multi-select helpers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === shipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(shipments.map(s => s.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Safe Archive Single Shipment
  const handleDeleteSubmit = async () => {
    if (!selectedShipment) return;
    try {
      const res: any = await api.delete(`/couriers/${selectedShipment.id}`);
      toast.success(res?.message || "Courier shipment record archived successfully.");
      setDeleteModalOpen(false);
      setDetailsModalOpen(false);
      fetchData();
      fetchMetadata();
    } catch (err: any) {
      console.error("[DELETE COURIER ERROR]", err);
      toast.error(err?.message || "Failed to archive courier record.");
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setActiveTab('ALL');
    setStatusFilter('ALL');
    setCourierCompanyFilter('ALL');
    setDistrictFilter('ALL');
    setPaymentStatusFilter('ALL');
    setDateRangeFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
    setSortBy('latest');
    fetchData();
    toast.success("Filters reset to default view.");
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 pb-12 animate-in fade-in duration-200">
      
      {/* 1. Header (Compact, High Density) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center shadow-xs">
            <Truck className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Courier Hub</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Live Logistics OS
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">Inbound & Outbound Device Consignments Connected to Core Repairs</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setIncomingForm({
                existingRepairId: '',
                customerId: '',
                customerName: '',
                customerPhone: '',
                customerWhatsapp: '',
                customerDistrict: 'Kathmandu',
                customerMunicipality: '',
                customerAddress: '',
                deviceBrand: 'apple',
                deviceModel: '',
                imeiNumber: '',
                deviceCondition: 'Good (Minor Wear)',
                problemDescription: 'Courier Intake - Diagnostics & Repair',
                accessoriesReceived: '',
                courierCompany: 'Nepal Can Move (NCM)',
                courierTrackingNumber: '',
                senderName: '',
                senderPhone: '',
                senderWhatsapp: '',
                originDistrict: 'Kathmandu',
                originAddress: '',
                courierInCharge: '',
                courierInPaymentStatus: 'UNPAID',
                courierDate: format(new Date(), 'yyyy-MM-dd'),
                courierReceivedDate: format(new Date(), 'yyyy-MM-dd'),
                courierNotes: ''
              });
              setCustomerSuggestions([]);
              setDuplicateAwbWarning(null);
              setIncomingModalOpen(true);
            }}
            className="rounded-xl h-9 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1.5"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Receive Courier</span>
          </Button>

          <Button
            onClick={() => {
              fetchEligibleRepairs();
              setOutgoingForm({
                repairId: '',
                returnCourierCompany: 'Nepal Can Move (NCM)',
                returnCourierTrackingNumber: '',
                returnCourierDispatchDate: format(new Date(), 'yyyy-MM-dd'),
                destinationDistrict: '',
                destinationAddress: '',
                receiverName: '',
                receiverPhone: '',
                receiverWhatsapp: '',
                courierOutCharge: '',
                courierOutPaymentStatus: 'UNPAID',
                returnCourierNotes: ''
              });
              setOutgoingModalOpen(true);
            }}
            className="rounded-xl h-9 px-3 text-xs font-bold bg-slate-950 hover:bg-black text-white shadow-xs cursor-pointer gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 stroke-[3]" />
            <span>+ Send Courier</span>
          </Button>
        </div>
      </div>

      {/* 2. Interactive KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        
        {/* Total Shipments */}
        <button
          onClick={() => handleCardClick('TOTAL')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs relative overflow-hidden",
            statusFilter === 'ALL' 
              ? "border-slate-900 ring-2 ring-slate-900/10 bg-slate-50/70" 
              : "border-slate-200 hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900">{stats.totalShipments}</span>
            <span className="text-[10px] font-semibold text-slate-400">All</span>
          </div>
        </button>

        {/* In Transit */}
        <button
          onClick={() => handleCardClick('IN_TRANSIT')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs relative overflow-hidden",
            statusFilter === 'IN_TRANSIT' 
              ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50" 
              : "border-slate-200 hover:border-indigo-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">In Transit</span>
            <Truck className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-indigo-800">{stats.inTransit}</span>
            <span className="text-[10px] font-semibold text-indigo-600">Active</span>
          </div>
        </button>

        {/* Received at Lab */}
        <button
          onClick={() => handleCardClick('RECEIVED_AT_LAB')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs relative overflow-hidden",
            statusFilter === 'RECEIVED_AT_LAB' 
              ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/50" 
              : "border-slate-200 hover:border-emerald-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Received</span>
            <Package className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-800">{stats.receivedAtLab}</span>
            <span className="text-[10px] font-semibold text-emerald-600">Inbound</span>
          </div>
        </button>

        {/* Ready to Dispatch */}
        <button
          onClick={() => handleCardClick('READY_FOR_DISPATCH')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs relative overflow-hidden",
            statusFilter === 'READY_FOR_DISPATCH' 
              ? "border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/50" 
              : "border-slate-200 hover:border-amber-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Ready</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-800">{stats.readyForDispatch}</span>
            <span className="text-[10px] font-semibold text-amber-600">Repaired</span>
          </div>
        </button>

        {/* Dispatched */}
        <button
          onClick={() => handleCardClick('DISPATCHED')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs relative overflow-hidden",
            statusFilter === 'DISPATCHED' 
              ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50" 
              : "border-slate-200 hover:border-blue-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Dispatched</span>
            <Send className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-blue-800">{stats.dispatched}</span>
            <span className="text-[10px] font-semibold text-blue-600">En Route</span>
          </div>
        </button>

        {/* Delivered */}
        <button
          onClick={() => handleCardClick('DELIVERED')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs relative overflow-hidden",
            statusFilter === 'DELIVERED' 
              ? "border-slate-900 ring-2 ring-slate-900/10 bg-slate-100" 
              : "border-slate-200 hover:border-slate-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900">{stats.delivered}</span>
            <span className="text-[10px] font-semibold text-emerald-600 font-bold">100%</span>
          </div>
        </button>

      </div>

      {/* 3. Main Filter & Control Toolbar */}
      <Card className="rounded-2xl border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        
        {/* Top Control Line */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Direction Tabs */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/60 shrink-0">
            <button
              onClick={() => setActiveTab('ALL')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'ALL' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              All ({stats.totalShipments})
            </button>
            <button
              onClick={() => setActiveTab('INCOMING')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                activeTab === 'INCOMING' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <ArrowDownLeft className="w-3 h-3 stroke-[3]" />
              <span>Inbound ({stats.incomingTotal})</span>
            </button>
            <button
              onClick={() => setActiveTab('OUTGOING')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                activeTab === 'OUTGOING' ? "bg-slate-950 text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <ArrowUpRight className="w-3 h-3 text-indigo-400 stroke-[3]" />
              <span>Outbound ({stats.outgoingTotal})</span>
            </button>
          </div>

          {/* Quick Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-3xl justify-start lg:justify-end">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search AWB, repair #, customer, phone, IMEI, district..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="h-9 pl-8 pr-7 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    fetchData();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Select */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 w-[140px] rounded-xl bg-slate-50 border-slate-200 text-xs font-bold">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="COURIER_REQUESTED">Courier Requested</SelectItem>
                <SelectItem value="PICKUP_SCHEDULED">Pickup Scheduled</SelectItem>
                <SelectItem value="PICKED_UP">Picked Up</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="RECEIVED_AT_LAB">Received at Lab</SelectItem>
                <SelectItem value="READY_FOR_DISPATCH">Ready for Dispatch</SelectItem>
                <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
              </SelectContent>
            </Select>

            {/* Advanced Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={cn(
                "h-9 rounded-xl border-slate-200 text-xs font-bold cursor-pointer gap-1.5",
                (showAdvancedFilters || courierCompanyFilter !== 'ALL' || districtFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || dateRangeFilter !== 'ALL')
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>

            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 rounded-xl border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer gap-1.5"
              title="Export filtered shipments to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-100 shrink-0 cursor-pointer"
              title="Refresh Data"
            >
              <RotateCw className={cn("w-3.5 h-3.5 text-slate-700", loading && "animate-spin")} />
            </Button>

          </div>

        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 animate-in slide-in-from-top-2 duration-150">
            
            {/* Courier Company Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Courier Partner</label>
              <Select value={courierCompanyFilter} onValueChange={(v) => setCourierCompanyFilter(v)}>
                <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Companies</SelectItem>
                  {filtersMetadata.courierCompanies.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* District Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">District</label>
              <Select value={districtFilter} onValueChange={(v) => setDistrictFilter(v)}>
                <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Districts</SelectItem>
                  {filtersMetadata.districts.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Status</label>
              <Select value={paymentStatusFilter} onValueChange={(v) => setPaymentStatusFilter(v)}>
                <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="All Payment" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Payment Status</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="UNPAID">UNPAID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Date Range</label>
              <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v)}>
                <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Time</SelectItem>
                  <SelectItem value="TODAY">Today</SelectItem>
                  <SelectItem value="YESTERDAY">Yesterday</SelectItem>
                  <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                  <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                  <SelectItem value="CUSTOM">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                <SelectTrigger className="h-8 rounded-lg bg-slate-50 border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="latest">Latest Updated First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="customer">Customer Name (A-Z)</SelectItem>
                  <SelectItem value="district">District</SelectItem>
                  <SelectItem value="status">Status Milestone</SelectItem>
                  <SelectItem value="dispatchDate">Dispatch Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Pickers */}
            {dateRangeFilter === 'CUSTOM' && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-5 flex flex-wrap items-center gap-2 pt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">From:</span>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 rounded-lg bg-white border-slate-200 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">To:</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 rounded-lg bg-white border-slate-200 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Clear Filters Button */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-5 flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 text-[11px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                Reset All Filters
              </Button>
            </div>

          </div>
        )}

      </Card>

      {/* 4. Bulk Action Bar (Visible when items selected) */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-30 flex items-center justify-between gap-3 p-3 bg-slate-950 text-white rounded-2xl shadow-xl border border-slate-800 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold pl-2">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <span>{selectedIds.length} shipment{selectedIds.length > 1 ? 's' : ''} selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setBulkStatusModalOpen(true)}
              className="h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer gap-1.5"
            >
              <RotateCw className="w-3 h-3" />
              <span>Update Status</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setBulkArchiveModalOpen(true)}
              className="h-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              <span>Archive</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="h-8 rounded-xl border-slate-700 bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer gap-1.5"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="h-8 rounded-xl text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 5. Main Shipments Content: High-Density Table (Desktop) / Cards (Mobile & Tablet) */}
      <Card className="rounded-2xl border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RotateCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-bold">Synchronizing shipment records...</p>
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <Truck className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No shipments found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try changing your search query or filter settings.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="rounded-xl h-8 text-xs font-bold border-slate-200 cursor-pointer mt-2"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop / Laptop High-Density Table View */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === shipments.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Repair Job</th>
                    <th className="py-2.5 px-3">Customer & Contact</th>
                    <th className="py-2.5 px-3">District</th>
                    <th className="py-2.5 px-3">Courier & AWB</th>
                    <th className="py-2.5 px-3">Milestone</th>
                    <th className="py-2.5 px-3">Charge</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {shipments.map((shipment) => {
                    const isOutbound = shipment.isCourierOut || shipment.isReturnCourierDispatched || shipment.courierStatus === 'COURIER_DISPATCHED' || shipment.courierOutStatus;
                    const trackingNo = isOutbound ? shipment.returnCourierTrackingNumber : shipment.courierTrackingNumber;
                    const courierName = isOutbound ? shipment.returnCourierCompany : shipment.courierCompany;
                    const contactName = isOutbound ? (shipment.receiverName || shipment.customerName) : (shipment.senderName || shipment.customerName);
                    const contactPhone = isOutbound ? (shipment.receiverPhone || shipment.customerPhone) : (shipment.senderPhone || shipment.customerPhone);
                    const district = isOutbound ? (shipment.destinationDistrict || shipment.customer?.district || 'Nepal') : (shipment.originDistrict || shipment.customer?.district || 'Nepal');
                    const currentStatusStr = isOutbound ? (shipment.courierOutStatus || shipment.courierStatus || 'DISPATCHED') : (shipment.courierInStatus || 'RECEIVED_AT_LAB');
                    const charge = isOutbound ? shipment.courierOutCharge : shipment.courierInCharge;
                    const paymentStatus = isOutbound ? shipment.courierOutPaymentStatus : shipment.courierInPaymentStatus;
                    const isSelected = selectedIds.includes(shipment.id);

                    return (
                      <tr 
                        key={shipment.id} 
                        className={cn(
                          "hover:bg-slate-50 transition-colors group",
                          isSelected && "bg-indigo-50/40"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(shipment.id)}
                            className="rounded border-slate-300 cursor-pointer"
                          />
                        </td>

                        {/* Direction Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isOutbound ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-900 text-white">
                              <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400 stroke-[3]" />
                              <span>OUT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <ArrowDownLeft className="w-2.5 h-2.5 stroke-[3]" />
                              <span>IN</span>
                            </span>
                          )}
                        </td>

                        {/* Repair Job */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-black text-slate-900 text-xs">
                                #{shipment.repairNumber}
                              </span>
                              <button
                                onClick={() => copyToClipboard(shipment.repairNumber, `rep-${shipment.id}`)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Copy Repair Number"
                              >
                                {copiedId === `rep-${shipment.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 block truncate max-w-[130px]">
                              {(shipment.deviceBrand || '').toUpperCase()} {shipment.deviceModel}
                            </span>
                          </div>
                        </td>

                        {/* Customer & Phone (with Direct Call & WhatsApp) */}
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5 min-w-[150px]">
                            <span className="font-bold text-slate-900 block truncate text-xs">{contactName}</span>
                            <div className="flex items-center gap-1 pt-0.5">
                              {contactPhone && (
                                <>
                                  <button
                                    onClick={() => handleDirectCall(contactPhone)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                                    title="Direct Telephone Call"
                                  >
                                    <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>{contactPhone}</span>
                                  </button>
                                  <button
                                    onClick={() => openWhatsAppModal(shipment, isOutbound ? 'DISPATCH' : 'RECEIVED')}
                                    className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                                    title="Send WhatsApp Message"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* District */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-600 text-xs">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[100px]">{district}</span>
                          </div>
                        </td>

                        {/* Courier Partner & AWB */}
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5 min-w-[140px]">
                            <strong className="font-bold text-slate-900 block text-xs truncate">
                              {courierName || 'Pending'}
                            </strong>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                {trackingNo || 'No AWB'}
                              </span>
                              {trackingNo && (
                                <button
                                  onClick={() => copyToClipboard(trackingNo, `awb-${shipment.id}`)}
                                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Copy AWB Tracking Number"
                                >
                                  {copiedId === `awb-${shipment.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Milestone */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-md border",
                            currentStatusStr === 'DELIVERED' ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                            currentStatusStr === 'DISPATCHED' || currentStatusStr === 'IN_TRANSIT' ? "bg-purple-50 text-purple-800 border-purple-300" :
                            currentStatusStr === 'RECEIVED_AT_LAB' ? "bg-blue-50 text-blue-800 border-blue-300" :
                            "bg-amber-50 text-amber-800 border-amber-300"
                          )}>
                            {currentStatusStr.replace(/_/g, ' ')}
                          </Badge>
                        </td>

                        {/* Charges & Payment */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="space-y-0.5 text-[11px]">
                            <span className="font-mono font-bold text-slate-900 block">
                              {charge ? `Rs. ${charge}` : '—'}
                            </span>
                            <span className={cn(
                              "text-[9px] font-extrabold uppercase",
                              paymentStatus === 'PAID' ? "text-emerald-600" : "text-amber-600"
                            )}>
                              {paymentStatus || 'UNPAID'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedShipment(shipment);
                                setDetailsModalOpen(true);
                              }}
                              className="h-7 px-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 mr-1" /> View
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer outline-none">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1 shadow-xl border-slate-200">
                                
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedShipment(shipment);
                                    setStatusUpdateForm({
                                      courierType: isOutbound ? 'OUTGOING' : 'INCOMING',
                                      status: currentStatusStr,
                                      notes: ''
                                    });
                                    setStatusModalOpen(true);
                                  }}
                                  className="text-xs font-bold py-1.5 cursor-pointer gap-2"
                                >
                                  <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Update Milestone</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                  onClick={() => openWhatsAppModal(shipment, isOutbound ? 'DISPATCH' : 'RECEIVED')}
                                  className="text-xs font-bold py-1.5 cursor-pointer gap-2 text-emerald-700 focus:bg-emerald-50"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Send WhatsApp Update</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedShipment(shipment);
                                    setPrintModalOpen(true);
                                  }}
                                  className="text-xs font-bold py-1.5 cursor-pointer gap-2"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                                  <span>Print Waybill Label</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                  onClick={() => navigate(`/dashboard/repairs/${shipment.id}`)}
                                  className="text-xs font-bold py-1.5 cursor-pointer gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                                  <span>View Core Repair Job</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                  onClick={() => window.open(`/track?repairNumber=${shipment.repairNumber}`, '_blank')}
                                  className="text-xs font-bold py-1.5 cursor-pointer gap-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Customer Track Link</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedShipment(shipment);
                                    setDeleteModalOpen(true);
                                  }}
                                  className="text-xs font-bold py-1.5 cursor-pointer gap-2 text-rose-600 focus:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Archive Record</span>
                                </DropdownMenuItem>

                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tablet & Smartphone Cards View (< 1024px) */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shipments.map((shipment) => {
                const isOutbound = shipment.isCourierOut || shipment.isReturnCourierDispatched || shipment.courierStatus === 'COURIER_DISPATCHED' || shipment.courierOutStatus;
                const trackingNo = isOutbound ? shipment.returnCourierTrackingNumber : shipment.courierTrackingNumber;
                const courierName = isOutbound ? shipment.returnCourierCompany : shipment.courierCompany;
                const contactName = isOutbound ? (shipment.receiverName || shipment.customerName) : (shipment.senderName || shipment.customerName);
                const contactPhone = isOutbound ? (shipment.receiverPhone || shipment.customerPhone) : (shipment.senderPhone || shipment.customerPhone);
                const district = isOutbound ? (shipment.destinationDistrict || shipment.customer?.district || 'Nepal') : (shipment.originDistrict || shipment.customer?.district || 'Nepal');
                const currentStatusStr = isOutbound ? (shipment.courierOutStatus || shipment.courierStatus || 'DISPATCHED') : (shipment.courierInStatus || 'RECEIVED_AT_LAB');
                const isSelected = selectedIds.includes(shipment.id);

                return (
                  <div 
                    key={shipment.id} 
                    className={cn(
                      "p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 transition-all",
                      isSelected && "border-indigo-400 bg-indigo-50/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(shipment.id)}
                          className="rounded border-slate-300 cursor-pointer mr-1"
                        />
                        {isOutbound ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-900 text-white">
                            <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400" /> OUT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <ArrowDownLeft className="w-2.5 h-2.5" /> IN
                          </span>
                        )}
                        <span className="font-mono font-black text-slate-900 text-xs">#{shipment.repairNumber}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-extrabold px-2 py-0.5">
                        {currentStatusStr.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{contactName}</span>
                        <span className="text-slate-500 font-semibold text-[11px] truncate max-w-[120px]">
                          {(shipment.deviceBrand || '').toUpperCase()} {shipment.deviceModel}
                        </span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{district}</span>
                      </div>
                      <div className="font-mono font-bold text-indigo-700 text-[11px] bg-indigo-50/80 p-1.5 rounded-lg flex items-center justify-between">
                        <span>{courierName}</span>
                        <span>AWB: {trackingNo || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                      {contactPhone && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDirectCall(contactPhone)}
                            className="flex-1 h-8 rounded-lg text-xs font-bold text-slate-800 border-slate-200 cursor-pointer gap-1"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" /> Call
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openWhatsAppModal(shipment, isOutbound ? 'DISPATCH' : 'RECEIVED')}
                            className="flex-1 h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedShipment(shipment);
                          setDetailsModalOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </Card>

      {/* MODAL 1: Receive Inbound Courier Modal (HORIZONTAL 2-COLUMN LAYOUT ON LAPTOPS/TABLETS) */}
      <Dialog open={incomingModalOpen} onOpenChange={setIncomingModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-5 lg:p-6 space-y-3.5">
          <DialogHeader className="pb-2 border-b border-slate-100 space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 leading-none">
                    Receive Inbound Courier Shipment
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-medium mt-1">
                    Intake customer package from across Nepal and link directly to repair workflow.
                  </DialogDescription>
                </div>
              </div>

              {/* Mode Switcher in Header */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/60 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIncomingMode('NEW')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    incomingMode === 'NEW' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  + New Intake Ticket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fetchEligibleRepairs();
                    setIncomingMode('EXISTING');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    incomingMode === 'EXISTING' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Link Existing Ticket
                </button>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleIncomingSubmit} className="space-y-3.5">
            
            {/* 2-Column Horizontal Grid for Laptop/Tablet/Desktop, 1-Col for Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
              
              {/* Left Column: Customer & Device Intake */}
              <div className="space-y-3 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Customer & Device Details</span>
                  </div>
                  {incomingForm.customerId && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ Existing Customer
                    </span>
                  )}
                </div>

                {incomingMode === 'EXISTING' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Select Existing Repair Ticket *</Label>
                    <Select
                      value={incomingForm.existingRepairId}
                      onValueChange={(v) => {
                        const rep = eligibleRepairs.find(r => r.id === v);
                        setIncomingForm(prev => ({
                          ...prev,
                          existingRepairId: v,
                          customerName: rep?.customerName || '',
                          customerPhone: rep?.customerPhone || '',
                          senderName: rep?.customerName || '',
                          senderPhone: rep?.customerPhone || '',
                          originDistrict: rep?.customer?.district || 'Kathmandu',
                          originAddress: rep?.customerAddress || ''
                        }));
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-bold w-full shadow-2xs">
                        <SelectValue placeholder="Search & Select Repair Job" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl max-h-72 min-w-[300px] sm:min-w-[420px] max-w-[calc(100vw-2rem)]">
                        {eligibleRepairs.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs py-2 px-3">
                            <div className="flex flex-col gap-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">#{r.repairNumber}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                  {(r.deviceBrand || '').toUpperCase()} {r.deviceModel}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                                  {r.status?.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-700 truncate">
                                {r.customerName} {r.customerPhone ? `• ${r.customerPhone}` : ''}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Customer Phone with Autocomplete Search */}
                    <div className="space-y-1 relative">
                      <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Customer Phone *</span>
                        {isSearchingCustomers && <span className="text-[10px] text-indigo-600 animate-pulse">Searching...</span>}
                      </Label>
                      <Input
                        required
                        placeholder="98XXXXXXXX"
                        value={incomingForm.customerPhone}
                        onChange={(e) => handleCustomerPhoneInputChange(e.target.value)}
                        className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                      />
                      {customerSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {customerSuggestions.map(c => (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => handleSelectCustomerSuggestion(c)}
                              className="w-full text-left p-2 hover:bg-indigo-50 text-xs cursor-pointer block"
                            >
                              <div className="font-bold text-slate-900">{c.name} ({c.phone})</div>
                              <div className="text-[10px] text-slate-500">{c.district || 'Nepal'} {c.address ? `• ${c.address}` : ''}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Customer Name */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">Customer Name *</Label>
                      <Input
                        required
                        placeholder="e.g. Aarav Sharma"
                        value={incomingForm.customerName}
                        onChange={(e) => setIncomingForm({ ...incomingForm, customerName: e.target.value, senderName: e.target.value })}
                        className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                      />
                    </div>

                    {/* Device Brand */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">Device Brand *</Label>
                      <Select
                        value={incomingForm.deviceBrand}
                        onValueChange={(v) => setIncomingForm({ ...incomingForm, deviceBrand: v })}
                      >
                        <SelectTrigger className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="apple">Apple (iPhone / iPad)</SelectItem>
                          <SelectItem value="samsung">Samsung</SelectItem>
                          <SelectItem value="xiaomi">Xiaomi / Redmi</SelectItem>
                          <SelectItem value="oneplus">OnePlus</SelectItem>
                          <SelectItem value="google">Google Pixel</SelectItem>
                          <SelectItem value="vivo">Vivo</SelectItem>
                          <SelectItem value="oppo">Oppo</SelectItem>
                          <SelectItem value="realme">Realme</SelectItem>
                          <SelectItem value="other">Other Brand</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Device Model */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">Device Model *</Label>
                      <Input
                        required
                        placeholder="e.g. 14 Pro Max / S23 Ultra"
                        value={incomingForm.deviceModel}
                        onChange={(e) => setIncomingForm({ ...incomingForm, deviceModel: e.target.value })}
                        className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                      />
                    </div>

                    {/* Origin District */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">Origin District *</Label>
                      <Input
                        required
                        placeholder="e.g. Kaski, Pokhara"
                        value={incomingForm.customerDistrict}
                        onChange={(e) => setIncomingForm({ ...incomingForm, customerDistrict: e.target.value, originDistrict: e.target.value })}
                        className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                      />
                    </div>

                    {/* Physical Condition */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">Physical Condition</Label>
                      <Input
                        placeholder="e.g. Good (Minor scratches)"
                        value={incomingForm.deviceCondition}
                        onChange={(e) => setIncomingForm({ ...incomingForm, deviceCondition: e.target.value })}
                        className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                      />
                    </div>

                    {/* Problem Description (Full Width Span) */}
                    <div className="space-y-1 col-span-1 sm:col-span-2">
                      <Label className="text-[11px] font-bold text-slate-700">Reported Problem Description *</Label>
                      <Input
                        required
                        placeholder="e.g. Green line on OLED screen (laser repair), battery drain"
                        value={incomingForm.problemDescription}
                        onChange={(e) => setIncomingForm({ ...incomingForm, problemDescription: e.target.value })}
                        className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Courier Waybill Logistics */}
              <div className="space-y-3 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Courier Waybill Logistics</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  
                  {/* Courier Partner with Chips (Full Width) */}
                  <div className="space-y-1.5 col-span-1 sm:col-span-2">
                    <Label className="text-[11px] font-bold text-slate-700">Courier Partner *</Label>
                    <Input
                      required
                      list="courier-companies-in-list"
                      placeholder="Select or enter courier partner"
                      value={incomingForm.courierCompany}
                      onChange={(e) => setIncomingForm({ ...incomingForm, courierCompany: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-bold text-slate-900"
                    />
                    <datalist id="courier-companies-in-list">
                      {POPULAR_COURIERS.map(c => <option key={c} value={c} />)}
                    </datalist>

                    {/* Quick Courier Selection Chips */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIncomingForm({ ...incomingForm, courierCompany: 'Nepal Can Move (NCM)' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          incomingForm.courierCompany === 'Nepal Can Move (NCM)'
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                            : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        )}
                      >
                        ⚡ Nepal Can Move (NCM)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncomingForm({ ...incomingForm, courierCompany: 'Sundarban Courier' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          incomingForm.courierCompany === 'Sundarban Courier'
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        Sundarban
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncomingForm({ ...incomingForm, courierCompany: 'Gorkha Courier' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          incomingForm.courierCompany === 'Gorkha Courier'
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        Gorkha
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncomingForm({ ...incomingForm, courierCompany: 'Nepal Post (EMS)' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          incomingForm.courierCompany === 'Nepal Post (EMS)'
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        Nepal Post
                      </button>
                    </div>
                  </div>

                  {/* Tracking / AWB */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Tracking / AWB Number *</Label>
                    <Input
                      required
                      placeholder="e.g. NCM-99482 / SND-102"
                      value={incomingForm.courierTrackingNumber}
                      onChange={(e) => {
                        setIncomingForm({ ...incomingForm, courierTrackingNumber: e.target.value });
                        checkDuplicateAwb(e.target.value);
                      }}
                      className="h-8.5 rounded-lg bg-white border-slate-200 font-mono font-bold text-xs text-indigo-700"
                    />
                  </div>

                  {/* Delivery Charge */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Delivery Charge (NPR)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={incomingForm.courierInCharge}
                      onChange={(e) => setIncomingForm({ ...incomingForm, courierInCharge: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 font-mono font-bold text-xs"
                    />
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Payment Status</Label>
                    <Select
                      value={incomingForm.courierInPaymentStatus}
                      onValueChange={(v) => setIncomingForm({ ...incomingForm, courierInPaymentStatus: v })}
                    >
                      <SelectTrigger className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="UNPAID">UNPAID (To Pay on Delivery)</SelectItem>
                        <SelectItem value="PAID">PAID by Sender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Received Date */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Received at Lab Date</Label>
                    <Input
                      type="date"
                      value={incomingForm.courierReceivedDate}
                      onChange={(e) => setIncomingForm({ ...incomingForm, courierReceivedDate: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                  {/* Duplicate AWB Warning Alert */}
                  {duplicateAwbWarning && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2 col-span-1 sm:col-span-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Duplicate AWB Detected: </span>
                        <span>Assigned to Repair #{duplicateAwbWarning.repairNumber} ({duplicateAwbWarning.customerName}).</span>
                      </div>
                    </div>
                  )}

                  {/* Logistics Handling Remarks (Full Width) */}
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <Label className="text-[11px] font-bold text-slate-700">Logistics Notes / Remarks</Label>
                    <Input
                      placeholder="e.g. Arrived securely sealed with bubble wrap"
                      value={incomingForm.courierNotes}
                      onChange={(e) => setIncomingForm({ ...incomingForm, courierNotes: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <DialogFooter className="pt-2 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIncomingModalOpen(false)} 
                className="rounded-xl h-9 text-xs font-bold border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-5 gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Record Inbound Package</span>
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Send Outbound Courier Dispatch Modal (HORIZONTAL 2-COLUMN LAYOUT ON LAPTOPS/TABLETS) */}
      <Dialog open={outgoingModalOpen} onOpenChange={setOutgoingModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-5 lg:p-6 space-y-3.5">
          <DialogHeader className="pb-2 border-b border-slate-100 space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 leading-none">
                  Send Outbound Courier Dispatch
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium mt-1">
                  Dispatch repaired devices back to customers across Nepal via courier partners.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleOutgoingSubmit} className="space-y-3.5">
            
            {/* 2-Column Horizontal Grid for Laptop/Tablet/Desktop, 1-Col for Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
              
              {/* Left Column: Repair Job & Recipient Delivery Address */}
              <div className="space-y-3 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Repair & Recipient</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-700">Select Completed / Ready Repair Job *</Label>
                    <Select
                      value={outgoingForm.repairId}
                      onValueChange={handleSelectEligibleRepair}
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-bold w-full shadow-2xs">
                        <SelectValue placeholder="Choose a repair job for return dispatch" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl max-h-72 min-w-[300px] sm:min-w-[420px] max-w-[calc(100vw-2rem)]">
                        {eligibleRepairs.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs py-2 px-3">
                            <div className="flex flex-col gap-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">#{r.repairNumber}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                  {(r.deviceBrand || '').toUpperCase()} {r.deviceModel}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                                  {r.status?.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-700 truncate">
                                {r.customerName} {r.customerPhone ? `• ${r.customerPhone}` : ''}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Receiver Name *</Label>
                    <Input
                      required
                      placeholder="Customer Name"
                      value={outgoingForm.receiverName}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, receiverName: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Receiver Phone *</Label>
                    <Input
                      required
                      placeholder="98XXXXXXXX"
                      value={outgoingForm.receiverPhone}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, receiverPhone: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Destination District *</Label>
                    <Input
                      required
                      placeholder="e.g. Mahottari, Bardibas"
                      value={outgoingForm.destinationDistrict}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, destinationDistrict: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Full Delivery Address</Label>
                    <Input
                      placeholder="Street, Ward, Landmark"
                      value={outgoingForm.destinationAddress}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, destinationAddress: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                </div>
              </div>

              {/* Right Column: Courier Partner & Consignment AWB */}
              <div className="space-y-3 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Courier Partner & Consignment AWB</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  
                  {/* Courier Partner with Chips (Full Width) */}
                  <div className="space-y-1.5 col-span-1 sm:col-span-2">
                    <Label className="text-[11px] font-bold text-slate-700">Courier Partner *</Label>
                    <Input
                      required
                      list="courier-companies-out-list"
                      placeholder="Select or enter courier company"
                      value={outgoingForm.returnCourierCompany}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, returnCourierCompany: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-bold text-slate-900"
                    />
                    <datalist id="courier-companies-out-list">
                      {POPULAR_COURIERS.map(c => <option key={c} value={c} />)}
                    </datalist>

                    {/* Quick Courier Selection Chips */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setOutgoingForm({ ...outgoingForm, returnCourierCompany: 'Nepal Can Move (NCM)' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          outgoingForm.returnCourierCompany === 'Nepal Can Move (NCM)'
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                            : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        )}
                      >
                        ⚡ Nepal Can Move (NCM)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutgoingForm({ ...outgoingForm, returnCourierCompany: 'Sundarban Courier' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          outgoingForm.returnCourierCompany === 'Sundarban Courier'
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        Sundarban
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutgoingForm({ ...outgoingForm, returnCourierCompany: 'Gorkha Courier' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          outgoingForm.returnCourierCompany === 'Gorkha Courier'
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        Gorkha
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutgoingForm({ ...outgoingForm, returnCourierCompany: 'Nepal Post (EMS)' })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                          outgoingForm.returnCourierCompany === 'Nepal Post (EMS)'
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        Nepal Post
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Tracking / AWB Number *</Label>
                    <Input
                      required
                      placeholder="e.g. NCM-99201 / GKH-551"
                      value={outgoingForm.returnCourierTrackingNumber}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, returnCourierTrackingNumber: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 font-mono font-bold text-xs text-indigo-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Courier Charge (NPR)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={outgoingForm.courierOutCharge}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, courierOutCharge: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 font-mono font-bold text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Payment Status</Label>
                    <Select
                      value={outgoingForm.courierOutPaymentStatus}
                      onValueChange={(v) => setOutgoingForm({ ...outgoingForm, courierOutPaymentStatus: v })}
                    >
                      <SelectTrigger className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="UNPAID">UNPAID (Customer to Pay on Delivery)</SelectItem>
                        <SelectItem value="PAID">PAID by MTS Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Dispatch Date</Label>
                    <Input
                      type="date"
                      value={outgoingForm.returnCourierDispatchDate}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, returnCourierDispatchDate: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <Label className="text-[11px] font-bold text-slate-700">Dispatch Notes / Remarks</Label>
                    <Input
                      placeholder="e.g. Packed with shockproof bubble foam and warranty card"
                      value={outgoingForm.returnCourierNotes}
                      onChange={(e) => setOutgoingForm({ ...outgoingForm, returnCourierNotes: e.target.value })}
                      className="h-8.5 rounded-lg bg-white border-slate-200 text-xs font-medium"
                    />
                  </div>

                  {isNepalCanMove(outgoingForm.returnCourierCompany) && (
                    <div className="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-800">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Nepal Can Move Direct Tracking Activated</span>
                      </div>
                      <p className="text-[10px] text-emerald-700 leading-relaxed">
                        Official tracking link (<span className="font-mono">{NCM_TRACKING_URL}</span>) and tracking ID will be dynamically embedded in the customer's WhatsApp dispatch message alongside MTS Lab Repair Tracking.
                      </p>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <DialogFooter className="pt-2 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOutgoingModalOpen(false)} 
                className="rounded-xl h-9 text-xs font-bold border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl h-9 text-xs font-bold bg-slate-950 hover:bg-black text-white cursor-pointer px-5 gap-1.5 shadow-xs"
              >
                <Send className="w-4 h-4 text-indigo-400" />
                <span>Confirm & Dispatch Shipment</span>
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Shipment Details Drawer / Modal */}
      {selectedShipment && (
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 space-y-4">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <DialogTitle className="text-base font-black text-slate-900">
                    Shipment #{selectedShipment.repairNumber}
                  </DialogTitle>
                </div>
                <Badge variant="outline" className="text-xs font-black">
                  {(selectedShipment.courierOutStatus || selectedShipment.courierInStatus || selectedShipment.courierStatus || selectedShipment.status).replace(/_/g, ' ')}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Logistics timeline, consignment information, and direct actions.
              </DialogDescription>
            </DialogHeader>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-100 pb-3">
              {(selectedShipment.receiverPhone || selectedShipment.customerPhone || selectedShipment.senderPhone) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDirectCall(selectedShipment.receiverPhone || selectedShipment.customerPhone || selectedShipment.senderPhone)}
                    className="rounded-xl h-8 text-xs font-bold border-slate-200 gap-1.5 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call Contact
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openWhatsAppModal(selectedShipment, selectedShipment.isCourierOut ? 'DISPATCH' : 'RECEIVED')}
                    className="rounded-xl h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </Button>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatusUpdateForm({
                    courierType: selectedShipment.isCourierOut ? 'OUTGOING' : 'INCOMING',
                    status: selectedShipment.courierOutStatus || selectedShipment.courierInStatus || selectedShipment.status,
                    notes: ''
                  });
                  setStatusModalOpen(true);
                }}
                className="rounded-xl h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" /> Update Status
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setPrintModalOpen(true)}
                className="rounded-xl h-8 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Waybill
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(`/track?repairNumber=${selectedShipment.repairNumber}`, '_blank')}
                className="rounded-xl h-8 text-xs font-bold text-blue-600 hover:bg-blue-50 gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Customer Track Link
              </Button>
            </div>

            {/* Waybill Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedShipment.isCourierIn && (
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5 text-xs">
                  <div className="font-extrabold text-amber-900 uppercase text-[10px] flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3" /> Inbound Logistics
                  </div>
                  <div><span className="text-slate-500">Partner: </span><strong>{selectedShipment.courierCompany || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">AWB: </span><strong className="font-mono">{selectedShipment.courierTrackingNumber || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">Origin: </span><span>{selectedShipment.originDistrict || 'N/A'}</span></div>
                  <div><span className="text-slate-500">Charge: </span><span>{selectedShipment.courierInCharge ? `Rs. ${selectedShipment.courierInCharge} (${selectedShipment.courierInPaymentStatus})` : '—'}</span></div>
                </div>
              )}

              {(selectedShipment.isCourierOut || selectedShipment.isReturnCourierDispatched) && (
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5 text-xs">
                  <div className="font-extrabold text-blue-900 uppercase text-[10px] flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Outbound Dispatch
                  </div>
                  <div><span className="text-slate-500">Partner: </span><strong>{selectedShipment.returnCourierCompany || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">AWB: </span><strong className="font-mono text-indigo-700">{selectedShipment.returnCourierTrackingNumber || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">Destination: </span><span>{selectedShipment.destinationDistrict || 'N/A'}</span></div>
                  <div><span className="text-slate-500">Charge: </span><span>{selectedShipment.courierOutCharge ? `Rs. ${selectedShipment.courierOutCharge} (${selectedShipment.courierOutPaymentStatus})` : '—'}</span></div>
                </div>
              )}
            </div>

            {/* Customer & Device Report */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-extrabold text-slate-900 uppercase text-[10px] flex items-center justify-between">
                <span>Device & Customer Information</span>
                {selectedShipment.batteryWarranty && selectedShipment.batteryWarranty.status !== 'CANCELLED' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <BatteryCharging className="w-3 h-3" /> Battery Warranty Active
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div><span className="text-slate-500">Customer: </span><strong className="text-slate-900">{selectedShipment.customerName}</strong></div>
                <div><span className="text-slate-500">Phone: </span><strong className="text-slate-900">{selectedShipment.customerPhone}</strong></div>
                <div><span className="text-slate-500">Device: </span><strong className="text-slate-900">{(selectedShipment.deviceBrand || '').toUpperCase()} {selectedShipment.deviceModel}</strong></div>
                <div><span className="text-slate-500">Condition: </span><span>{selectedShipment.deviceCondition || 'Normal Intake'}</span></div>
                <div className="col-span-2"><span className="text-slate-500">Problem: </span><span>{selectedShipment.problemDescription}</span></div>
              </div>
            </div>

            {/* Tracking Actions */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[10px] uppercase text-slate-300 tracking-wider">
                  Live Consignment & Repair Tracking
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-bold">
                  Status: {selectedShipment.courierStatus?.replace(/_/g, ' ') || 'ACTIVE'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* If Nepal Can Move: External Tracking Button */}
                {isNepalCanMove(selectedShipment.returnCourierCompany || selectedShipment.courierCompany) && (
                  <a
                    href={NCM_TRACKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Track on Nepal Can Move</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                )}

                {/* MTS Repair Tracking Option */}
                {selectedShipment.repairNumber && (
                  <a
                    href={`/track?repairNumber=${selectedShipment.repairNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Track Repair on MTS Lab</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                )}

                <Button
                  size="sm"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    openWhatsAppModal(selectedShipment, selectedShipment.isCourierOut ? 'DISPATCH' : 'RECEIVED');
                  }}
                  className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs gap-1.5 cursor-pointer ml-auto"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Send WhatsApp</span>
                </Button>
              </div>
            </div>

            {/* Audit History Logs */}
            <div className="space-y-1.5">
              <div className="text-xs font-black text-slate-900 uppercase tracking-wider">Activity History</div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
                {selectedShipment.logs && selectedShipment.logs.length > 0 ? (
                  selectedShipment.logs.map((log: any) => (
                    <div key={log.id} className="pt-1.5 text-xs space-y-0.5">
                      <p className="text-slate-800 font-medium">{log.message}</p>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        {log.createdAt ? format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm') : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No activity logs recorded yet.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 4: Print Waybill Label Modal */}
      {selectedShipment && (
        <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <span>Courier Dispatch Waybill Slip</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Printable consignment label for device packaging.
              </DialogDescription>
            </DialogHeader>

            {/* Printable Area */}
            <div id="printable-waybill" className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-white space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-black text-sm text-slate-900">MTS LAB NEPAL</h3>
                  <p className="text-[10px] text-slate-500">Micro-Soldering & Device Logistics</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                    #{selectedShipment.repairNumber}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Recipient:</span>
                  <strong className="text-slate-900">{selectedShipment.receiverName || selectedShipment.customerName}</strong>
                  <div className="text-slate-700">{selectedShipment.receiverPhone || selectedShipment.customerPhone}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Destination:</span>
                  <strong className="text-slate-900">{selectedShipment.destinationDistrict || selectedShipment.originDistrict || 'Nepal'}</strong>
                  <div className="text-slate-600 truncate">{selectedShipment.destinationAddress || selectedShipment.customerAddress || 'Customer Address'}</div>
                </div>
              </div>

              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Courier Partner & AWB</div>
                <div className="font-bold text-slate-900">{selectedShipment.returnCourierCompany || selectedShipment.courierCompany || 'Courier Partner'}</div>
                <div className="font-mono font-black text-indigo-700 text-sm tracking-wider">
                  {selectedShipment.returnCourierTrackingNumber || selectedShipment.courierTrackingNumber || 'AWB-PENDING'}
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-400 font-bold border-t pt-2">
                ⚠️ FRAGILE ELECTRONIC DEVICE — HANDLE WITH CARE
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPrintModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                className="rounded-xl h-9 text-xs font-bold bg-slate-950 hover:bg-black text-white px-5 gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Waybill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 5: Dynamic WhatsApp Modal */}
      {selectedShipment && (
        <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
          <DialogContent className="w-[94vw] sm:max-w-lg rounded-2xl p-4 sm:p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <span>Send WhatsApp Tracking Message</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Pre-composed dynamic message for {selectedShipment.customerName}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex p-0.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => openWhatsAppModal(selectedShipment, 'DISPATCH')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  whatsappTemplateType === 'DISPATCH' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Dispatched
              </button>
              <button
                type="button"
                onClick={() => openWhatsAppModal(selectedShipment, 'RECEIVED')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  whatsappTemplateType === 'RECEIVED' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Inbound Received
              </button>
              <button
                type="button"
                onClick={() => openWhatsAppModal(selectedShipment, 'DELIVERED')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  whatsappTemplateType === 'DELIVERED' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Delivered
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Message Preview & Edit</Label>
              <Textarea
                rows={6}
                value={customWhatsappText}
                onChange={(e) => setCustomWhatsappText(e.target.value)}
                className="rounded-xl bg-slate-50 border-slate-200 text-xs font-medium leading-relaxed"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <Button variant="outline" onClick={() => setWhatsappModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
                Cancel
              </Button>
              <Button onClick={executeSendWhatsApp} className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 gap-1.5">
                <Send className="w-3.5 h-3.5" /> Open in WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 6: Update Status Milestone Modal */}
      {selectedShipment && (
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-5 space-y-3">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-indigo-600" />
                <span>Update Shipment Milestone</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Transition shipment milestone for Repair #{selectedShipment.repairNumber}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleStatusUpdateSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Next Status Milestone *</Label>
                <Select
                  value={statusUpdateForm.status}
                  onValueChange={(v) => setStatusUpdateForm({ ...statusUpdateForm, status: v })}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="Select Status Milestone" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {statusUpdateForm.courierType === 'INCOMING' ? (
                      INCOMING_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">
                          {opt.label}
                        </SelectItem>
                      ))
                    ) : (
                      OUTGOING_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Status Update Note</Label>
                <Input
                  placeholder="e.g. Package dispatched via express route"
                  value={statusUpdateForm.notes}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, notes: e.target.value })}
                  className="h-9 rounded-xl bg-white border-slate-200 text-xs font-medium"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setStatusModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl h-9 text-xs font-bold bg-slate-950 hover:bg-black text-white px-5">
                  Save Status
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 7: Bulk Status Update Modal */}
      <Dialog open={bulkStatusModalOpen} onOpenChange={setBulkStatusModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-indigo-600" />
              <span>Bulk Update Status ({selectedIds.length} Shipments)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Apply new milestone status across all selected courier shipments.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBulkStatusSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Milestone Status *</Label>
              <Select
                value={bulkStatusForm.status}
                onValueChange={(v) => setBulkStatusForm({ ...bulkStatusForm, status: v })}
              >
                <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="RECEIVED_AT_LAB">Received at Lab</SelectItem>
                  <SelectItem value="READY_FOR_DISPATCH">Ready for Dispatch</SelectItem>
                  <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Remarks / Note</Label>
              <Input
                placeholder="e.g. Batch logistics transit update"
                value={bulkStatusForm.notes}
                onChange={(e) => setBulkStatusForm({ ...bulkStatusForm, notes: e.target.value })}
                className="h-9 rounded-xl bg-white border-slate-200 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBulkStatusModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-5">
                Apply to {selectedIds.length} Shipments
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 8: Bulk Archive Modal */}
      <Dialog open={bulkArchiveModalOpen} onOpenChange={setBulkArchiveModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5 space-y-3">
          <DialogHeader>
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-1">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-black text-slate-900">
              Archive {selectedIds.length} Shipments?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              This will soft-archive the selected courier shipment records. Core repair and customer history will remain 100% intact.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setBulkArchiveModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
              Cancel
            </Button>
            <Button onClick={handleBulkArchiveSubmit} className="rounded-xl h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-5">
              Archive Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 9: Delete Single Confirmation Modal */}
      {selectedShipment && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-5 space-y-3">
            <DialogHeader>
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-1">
                <Trash2 className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-black text-slate-900">
                Archive Shipment Record?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                This will soft-archive the shipment record for <strong>Repair #{selectedShipment.repairNumber}</strong> ({selectedShipment.customerName}).
                <br /><br />
                <span className="text-emerald-700 font-bold">
                  ✓ Core repair and customer records will remain completely intact.
                </span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="rounded-xl h-9 text-xs font-bold border-slate-200">
                Cancel
              </Button>
              <Button onClick={handleDeleteSubmit} className="rounded-xl h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-5">
                Archive Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
