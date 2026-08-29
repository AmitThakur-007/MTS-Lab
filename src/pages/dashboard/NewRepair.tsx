import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  User, 
  Smartphone, 
  Plus, 
  Trash2,
  Loader2, 
  AlertCircle, 
  Hash, 
  Banknote, 
  Calendar, 
  ArrowLeft,
  Search,
  CheckCircle2, 
  Phone,
  Mail,
  MapPin,
  Clock,
  BatteryCharging,
  ShieldCheck,
  Package,
  Truck,
  Building2,
  Navigation,
  Compass,
  FileCheck2,
  RotateCcw,
  Check,
  Circle,
  History,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { formatNPR } from '@/lib/format';
import { syncRepairToSupabase as syncRepairToRtdb, syncRepairToSupabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, addMonths, addYears } from 'date-fns';
import ServiceSlipModal from '@/components/repair/ServiceSlipModal';

// Popular Nepal Districts
const NEPAL_DISTRICTS = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Morang", "Sunsari", "Jhapa", "Kaski",
  "Chitwan", "Rupandehi", "Dhanusha", "Parsa", "Makwanpur", "Banke", "Kailali",
  "Kanchanpur", "Nawalparasi", "Mahottari", "Sarlahi", "Siraha", "Bara", "Rautahat",
  "Kavrepalanchok", "Nuwakot", "Dhading", "Sindhupalchok", "Tanahun", "Gorkha",
  "Syangja", "Palpa", "Gulmi", "Baglung", "Dang", "Surkhet", "Bardiya"
];

// Standard Accessories Options
const ACCESSORY_OPTIONS = [
  "No Accessories",
  "SIM Card",
  "SIM Tray",
  "Memory Card",
  "Cover / Case",
  "Charger Adapter",
  "Charging Cable",
  "Original Box",
  "Other"
];

// Standard Device Condition Options
const CONDITION_OPTIONS = [
  "Good (Minor Wear)",
  "Screen Damaged",
  "Back Glass Damaged",
  "Body / Frame Bent",
  "Water / Liquid Damage",
  "Dead / No Power",
  "Logo Stuck / Bootloop",
  "Other Physical Damage"
];

// Known Courier Companies in Nepal
const COURIER_COMPANIES = [
  "Nepal Can Move (NCM)",
  "Sundar Courier",
  "Nepal Post / GPO",
  "Pathao Logistics",
  "Aramex Nepal",
  "DHL Express",
  "FedEx / TNT",
  "Gorkha Express",
  "Gaura Courier",
  "Other Courier"
];

interface DeviceFormItem {
  id: string; // internal temp id
  deviceBrand: string;
  deviceModel: string;
  imeiNumber: string;
  deviceColor: string;
  selectedConditions: string[];
  otherConditionText: string;
  conditionNotes: string;
  problemDescription: string;
  selectedAccessories: string[];
  otherAccessoryText: string;
  estimatedCost: string;
  advancePaid: string;
  expectedCompletionDate: string;
  technicianId: string;
  status: string;
  remarks: string;
  hasBatteryWarranty: boolean;
  batteryWarrantyPeriod: '6_MONTHS' | '1_YEAR';
  batteryType: string;
}

const createInitialDevice = (index = 1): DeviceFormItem => ({
  id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  deviceBrand: 'apple',
  deviceModel: '',
  imeiNumber: '',
  deviceColor: '',
  selectedConditions: ['Good (Minor Wear)'],
  otherConditionText: '',
  conditionNotes: '',
  problemDescription: '',
  selectedAccessories: ['No Accessories'],
  otherAccessoryText: '',
  estimatedCost: '',
  advancePaid: '0',
  expectedCompletionDate: '',
  technicianId: '',
  status: 'RECEIVED',
  remarks: '',
  hasBatteryWarranty: false,
  batteryWarrantyPeriod: '6_MONTHS',
  batteryType: 'Original Replacement Battery'
});

export default function NewRepair() {
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Service Slip Modal State
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [savedSlipRepairs, setSavedSlipRepairs] = useState<any[]>([]);
  const [savedSlipCustomer, setSavedSlipCustomer] = useState<any>(null);

  // Receiving Method state: WALK_IN vs COURIER
  const [receivingMethod, setReceivingMethod] = useState<'WALK_IN' | 'COURIER'>('WALK_IN');

  // Customer state
  const [customer, setCustomer] = useState({
    id: '', // existing DB ID
    customerId: '', // display ID (e.g. CUS-00101)
    name: '',
    phone: '',
    alternativePhone: '',
    email: '',
    district: 'Kathmandu',
    municipality: '',
    address: '',
    landmark: '',
    notes: ''
  });

  // Courier-In Information State
  const [courierIn, setCourierIn] = useState({
    courierCompany: 'Nepal Can Move (NCM)',
    customCourierCompany: '',
    courierTrackingNumber: '',
    courierDate: format(new Date(), 'yyyy-MM-dd'),
    courierReceivedDate: format(new Date(), 'yyyy-MM-dd'),
    senderName: '',
    senderPhone: '',
    originDistrict: 'Kathmandu',
    originAddress: '',
    courierNotes: ''
  });

  // Autocomplete search states
  const [matchedExistingCustomer, setMatchedExistingCustomer] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-device array
  const [devices, setDevices] = useState<DeviceFormItem[]>([createInitialDevice(1)]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const staff = await api.get('/staff');
        setTechnicians(staff.filter((u: any) => u.role === 'TECHNICIAN' || u.role === 'LEAD_TECHNICIAN'));
      } catch (err) {
        console.error('Failed to load technician staff list:', err);
      }
    };
    fetchData();

    // Check if navigating from a warranty replacement
    if (location.state?.fromWarranty) {
      const w = location.state.fromWarranty;
      if (w.customerName) {
        setCustomer(prev => ({
          ...prev,
          id: w.customerId || '',
          customerId: w.customer?.customerId || '',
          name: w.customerName || '',
          phone: w.customerPhone || '',
          email: w.customerEmail || '',
          address: w.customerAddress || '',
          district: w.customer?.district || 'Kathmandu',
          notes: `Warranty replacement for Warranty #${w.warrantyNumber} (Original Job #${w.repairNumber})`
        }));
      }
      if (w.deviceModel) {
        setDevices([
          {
            id: `dev-${Date.now()}`,
            deviceBrand: w.deviceBrand || 'apple',
            deviceModel: w.deviceModel || '',
            imeiNumber: w.imeiNumber || '',
            deviceColor: '',
            selectedConditions: ['Good (Minor Wear)'],
            otherConditionText: '',
            conditionNotes: '',
            problemDescription: `Battery replacement under Warranty #${w.warrantyNumber}`,
            selectedAccessories: ['No Accessories'],
            otherAccessoryText: '',
            estimatedCost: '0',
            advancePaid: '0',
            expectedCompletionDate: '',
            technicianId: '',
            status: 'RECEIVED',
            remarks: `Warranty Replacement: ${w.warrantyNumber}`,
            hasBatteryWarranty: true,
            batteryWarrantyPeriod: w.warrantyPeriod || '6_MONTHS',
            batteryType: w.batteryType || 'Original Replacement Battery'
          }
        ]);
        toast.info(`Pre-filled customer and device details from Warranty #${w.warrantyNumber}`);
      }
    }

    // Check if navigating from CustomerProfile / CustomerHub (New Repair for existing customer)
    if (location.state?.fromCustomer) {
      const fc = location.state.fromCustomer;
      setCustomer({
        id: fc.id || '',
        customerId: fc.customerId || '',
        name: fc.name || '',
        phone: fc.phone || '',
        alternativePhone: fc.alternativePhone || '',
        email: fc.email || '',
        district: fc.district || 'Kathmandu',
        municipality: fc.municipality || '',
        address: fc.address || '',
        landmark: fc.landmark || '',
        notes: fc.notes || ''
      });
      setMatchedExistingCustomer(fc);
      toast.success(`Existing customer linked: ${fc.name} (${fc.customerId})`);
    }
  }, [location.state]);

  // Phone Lookup & Duplicate Protection
  const handleCustomerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomer(prev => ({ ...prev, phone: val }));

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const clean = val.replace(/\D/g, '');
    if (clean.length >= 4) {
      setSearchingCustomer(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const results = await api.get(`/customers/lookup?phone=${encodeURIComponent(val)}`);
          setSearchResults(results || []);
          setShowDropdown(results && results.length > 0);
          if (results && results.length > 0) {
            // Find exact or closest match
            const exact = results.find((c: any) => c.phone.replace(/\D/g, '').endsWith(clean.slice(-10)));
            setMatchedExistingCustomer(exact || results[0]);
          } else {
            setMatchedExistingCustomer(null);
          }
        } catch {
          setSearchResults([]);
          setMatchedExistingCustomer(null);
        } finally {
          setSearchingCustomer(false);
        }
      }, 250);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
      setMatchedExistingCustomer(null);
    }
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomer(prev => ({ ...prev, name: val }));

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.trim().length >= 3 && !customer.id) {
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const results = await api.get(`/customers/lookup?name=${encodeURIComponent(val)}`);
          setSearchResults(results || []);
          setShowDropdown(results && results.length > 0);
        } catch {
          setSearchResults([]);
        }
      }, 300);
    }
  };

  const selectExistingCustomer = (c: any) => {
    setCustomer({
      id: c.id,
      customerId: c.customerId,
      name: c.name,
      phone: c.phone,
      alternativePhone: c.alternativePhone || '',
      email: c.email || '',
      district: c.district || 'Kathmandu',
      municipality: c.municipality || '',
      address: c.address || '',
      landmark: c.landmark || '',
      notes: c.notes || ''
    });
    setMatchedExistingCustomer(null);
    setShowDropdown(false);
    toast.success(`Linked existing customer: ${c.name} (${c.customerId})`);
  };

  const clearSelectedCustomer = () => {
    setCustomer({
      id: '',
      customerId: '',
      name: '',
      phone: '',
      alternativePhone: '',
      email: '',
      district: 'Kathmandu',
      municipality: '',
      address: '',
      landmark: '',
      notes: ''
    });
    setMatchedExistingCustomer(null);
  };

  // Multi-Device Handlers
  const handleDeviceChange = (index: number, field: keyof DeviceFormItem, value: any) => {
    setDevices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleAccessory = (deviceIndex: number, accessory: string) => {
    setDevices(prev =>
      prev.map((dev, idx) => {
        if (idx !== deviceIndex) return dev;
        const currentList = dev.selectedAccessories || [];
        let newAccessories: string[];
        let newOtherText = dev.otherAccessoryText || '';

        if (accessory === "No Accessories") {
          if (currentList.includes("No Accessories") && currentList.length === 1) {
            // Toggle off
            newAccessories = [];
            newOtherText = '';
          } else {
            // Select No Accessories and clear all other accessories
            newAccessories = ["No Accessories"];
            newOtherText = '';
          }
        } else {
          // User clicked a normal accessory
          const withoutNoAcc = currentList.filter(a => a !== "No Accessories");
          if (withoutNoAcc.includes(accessory)) {
            // Toggle off
            newAccessories = withoutNoAcc.filter(a => a !== accessory);
            if (accessory === "Other") {
              newOtherText = '';
            }
          } else {
            // Add this accessory
            newAccessories = [...withoutNoAcc, accessory];
          }
        }

        return {
          ...dev,
          selectedAccessories: newAccessories,
          otherAccessoryText: newOtherText
        };
      })
    );
  };

  const toggleCondition = (deviceIndex: number, condition: string) => {
    setDevices(prev =>
      prev.map((dev, idx) => {
        if (idx !== deviceIndex) return dev;
        const currentList = dev.selectedConditions || [];
        let newConditions: string[];
        let newOtherText = dev.otherConditionText || '';

        if (condition === "Good (Minor Wear)") {
          if (currentList.includes("Good (Minor Wear)") && currentList.length === 1) {
            // Toggle off
            newConditions = [];
            newOtherText = '';
          } else {
            // Select Good (Minor Wear) and clear all defect conditions
            newConditions = ["Good (Minor Wear)"];
            newOtherText = '';
          }
        } else {
          // User clicked a defect condition
          const withoutGood = currentList.filter(c => c !== "Good (Minor Wear)");
          if (withoutGood.includes(condition)) {
            // Toggle off
            newConditions = withoutGood.filter(c => c !== condition);
            if (condition === "Other Physical Damage") {
              newOtherText = '';
            }
          } else {
            // Add this defect condition
            newConditions = [...withoutGood, condition];
          }
        }

        return {
          ...dev,
          selectedConditions: newConditions,
          otherConditionText: newOtherText
        };
      })
    );
  };

  const addAnotherDevice = () => {
    setDevices(prev => [...prev, createInitialDevice(prev.length + 1)]);
    toast.info(`Device #${devices.length + 1} added to intake form.`);
  };

  const removeDevice = (index: number) => {
    if (devices.length <= 1) {
      toast.error("At least one device is required for intake.");
      return;
    }
    setDevices(prev => prev.filter((_, idx) => idx !== index));
    toast.info("Device removed from intake.");
  };

  // Calculations
  const totalEstimatedCost = devices.reduce((sum, d) => sum + (Number(d.estimatedCost) || 0), 0);
  const totalAdvancePaid = devices.reduce((sum, d) => sum + (Number(d.advancePaid) || 0), 0);
  const totalRemaining = Math.max(0, totalEstimatedCost - totalAdvancePaid);

  const calculateWarrantyExpiryPreview = (period: string) => {
    const reg = new Date();
    const exp = period === '1_YEAR' ? addYears(reg, 1) : addMonths(reg, 6);
    return format(exp, 'dd MMMM yyyy');
  };

  const compileAccessoriesString = (d: DeviceFormItem) => {
    let list = [...(d.selectedAccessories || [])];
    // Enforce mutual exclusion: if normal accessories are selected, filter out "No Accessories"
    if (list.includes("No Accessories") && list.length > 1) {
      list = list.filter(a => a !== "No Accessories");
    }
    if (list.length === 0 || (list.length === 1 && list[0] === "No Accessories")) {
      return null;
    }
    if (list.includes("Other") && d.otherAccessoryText.trim()) {
      const idx = list.indexOf("Other");
      list[idx] = `Other (${d.otherAccessoryText.trim()})`;
    }
    return list.join(", ");
  };

  const compileConditionString = (d: DeviceFormItem) => {
    let list = [...(d.selectedConditions || [])];
    // Enforce mutual exclusion: if defect conditions are selected, filter out "Good (Minor Wear)"
    if (list.includes("Good (Minor Wear)") && list.length > 1) {
      list = list.filter(c => c !== "Good (Minor Wear)");
    }
    if (list.length === 0) {
      return "Good (Minor Wear)";
    }
    if (list.includes("Other Physical Damage") && d.otherConditionText.trim()) {
      const idx = list.indexOf("Other Physical Damage");
      list[idx] = `Other (${d.otherConditionText.trim()})`;
    }
    return list.join(", ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.name.trim()) {
      toast.error('Customer Name is required');
      return;
    }
    if (!customer.phone.trim()) {
      toast.error('Customer Phone Number is required');
      return;
    }

    const cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (receivingMethod === 'COURIER') {
      const finalCourierCompany = courierIn.courierCompany === 'Other Courier'
        ? (courierIn.customCourierCompany || 'Courier Service')
        : courierIn.courierCompany;

      if (!finalCourierCompany.trim()) {
        toast.error('Courier Company is required for courier intake');
        return;
      }
      if (!courierIn.courierTrackingNumber.trim()) {
        toast.error('Courier Tracking / Consignment Number is required');
        return;
      }
    }

    for (let i = 0; i < devices.length; i++) {
      const d = devices[i];
      if (!d.deviceModel.trim()) {
        toast.error(`Device #${i + 1}: Device Model is required`);
        return;
      }
      if (!d.problemDescription.trim()) {
        toast.error(`Device #${i + 1}: Problem Description is required`);
        return;
      }
    }

    setLoading(true);
    try {
      const finalCourierCompany = courierIn.courierCompany === 'Other Courier'
        ? (courierIn.customCourierCompany.trim() || 'Courier Service')
        : courierIn.courierCompany;

      let finalRepairs: any[] = [];
      let finalCustomer: any = customer;

      if (devices.length === 1) {
        // Single repair registration
        const dev = devices[0];
        const payload = {
          customerId: customer.id || undefined,
          customerName: customer.name.trim(),
          customerPhone: customer.phone.trim(),
          customerAlternativePhone: customer.alternativePhone.trim() || undefined,
          customerEmail: customer.email.trim() || undefined,
          customerDistrict: customer.district.trim() || undefined,
          customerMunicipality: customer.municipality.trim() || undefined,
          customerAddress: customer.address.trim() || undefined,
          customerLandmark: customer.landmark.trim() || undefined,
          customerNotes: customer.notes.trim() || undefined,
          deviceBrand: dev.deviceBrand,
          deviceModel: dev.deviceModel.trim(),
          imeiNumber: dev.imeiNumber.trim() || undefined,
          deviceColor: dev.deviceColor.trim() || undefined,
          deviceCondition: compileConditionString(dev),
          conditionNotes: dev.conditionNotes.trim() || undefined,
          problemDescription: dev.problemDescription.trim(),
          accessoriesReceived: compileAccessoriesString(dev),
          estimatedCost: dev.estimatedCost === "" ? null : Number(dev.estimatedCost),
          advancePaid: dev.advancePaid === "" ? 0 : Number(dev.advancePaid),
          technicianId: dev.technicianId || null,
          status: dev.status || 'RECEIVED',
          expectedCompletionDate: dev.expectedCompletionDate ? new Date(dev.expectedCompletionDate).toISOString() : null,
          remarks: dev.remarks.trim() || undefined,
          hasBatteryWarranty: dev.hasBatteryWarranty,
          batteryWarrantyPeriod: dev.batteryWarrantyPeriod,
          batteryType: dev.batteryType,

          // Courier-In Fields
          receivingMethod,
          isCourierIn: receivingMethod === 'COURIER',
          courierCompany: receivingMethod === 'COURIER' ? finalCourierCompany : undefined,
          courierTrackingNumber: receivingMethod === 'COURIER' ? courierIn.courierTrackingNumber.trim() : undefined,
          courierDate: receivingMethod === 'COURIER' ? courierIn.courierDate : undefined,
          courierReceivedDate: receivingMethod === 'COURIER' ? courierIn.courierReceivedDate : undefined,
          senderName: receivingMethod === 'COURIER' ? (courierIn.senderName.trim() || customer.name.trim()) : undefined,
          senderPhone: receivingMethod === 'COURIER' ? (courierIn.senderPhone.trim() || customer.phone.trim()) : undefined,
          originDistrict: receivingMethod === 'COURIER' ? (courierIn.originDistrict || customer.district) : undefined,
          originAddress: receivingMethod === 'COURIER' ? (courierIn.originAddress.trim() || customer.address.trim()) : undefined,
          courierNotes: receivingMethod === 'COURIER' ? courierIn.courierNotes.trim() : undefined
        };

        const res = await api.post('/repairs', payload);
        await syncRepairToRtdb(res);
        toast.success(`Repair #${res.repairNumber} registered successfully for ${customer.name}!${res.batteryWarranty ? ` (Battery Warranty: ${res.batteryWarranty.warrantyNumber})` : ''}`);
        finalRepairs = [res];
        finalCustomer = res.customer || customer;
      } else {
        // Multi-device batch registration
        const payload = {
          customer: {
            id: customer.id || undefined,
            name: customer.name.trim(),
            phone: customer.phone.trim(),
            alternativePhone: customer.alternativePhone.trim() || undefined,
            email: customer.email.trim() || undefined,
            district: customer.district.trim() || undefined,
            municipality: customer.municipality.trim() || undefined,
            address: customer.address.trim() || undefined,
            landmark: customer.landmark.trim() || undefined,
            notes: customer.notes.trim() || undefined
          },
          devices: devices.map(dev => ({
            deviceBrand: dev.deviceBrand,
            deviceModel: dev.deviceModel.trim(),
            imeiNumber: dev.imeiNumber.trim() || undefined,
            deviceColor: dev.deviceColor.trim() || undefined,
            deviceCondition: compileConditionString(dev),
            conditionNotes: dev.conditionNotes.trim() || undefined,
            problemDescription: dev.problemDescription.trim(),
            accessoriesReceived: compileAccessoriesString(dev),
            estimatedCost: dev.estimatedCost === "" ? null : Number(dev.estimatedCost),
            advancePaid: dev.advancePaid === "" ? 0 : Number(dev.advancePaid),
            technicianId: dev.technicianId || null,
            status: dev.status || 'RECEIVED',
            expectedCompletionDate: dev.expectedCompletionDate ? new Date(dev.expectedCompletionDate).toISOString() : null,
            remarks: dev.remarks.trim() || undefined,
            hasBatteryWarranty: dev.hasBatteryWarranty,
            batteryWarrantyPeriod: dev.batteryWarrantyPeriod,
            batteryType: dev.batteryType,

            // Courier-In Fields
            receivingMethod,
            isCourierIn: receivingMethod === 'COURIER',
            courierCompany: receivingMethod === 'COURIER' ? finalCourierCompany : undefined,
            courierTrackingNumber: receivingMethod === 'COURIER' ? courierIn.courierTrackingNumber.trim() : undefined,
            courierDate: receivingMethod === 'COURIER' ? courierIn.courierDate : undefined,
            courierReceivedDate: receivingMethod === 'COURIER' ? courierIn.courierReceivedDate : undefined,
            senderName: receivingMethod === 'COURIER' ? (courierIn.senderName.trim() || customer.name.trim()) : undefined,
            senderPhone: receivingMethod === 'COURIER' ? (courierIn.senderPhone.trim() || customer.phone.trim()) : undefined,
            originDistrict: receivingMethod === 'COURIER' ? (courierIn.originDistrict || customer.district) : undefined,
            originAddress: receivingMethod === 'COURIER' ? (courierIn.originAddress.trim() || customer.address.trim()) : undefined,
            courierNotes: receivingMethod === 'COURIER' ? courierIn.courierNotes.trim() : undefined
          }))
        };

        const res = await api.post('/repairs/batch', payload);
        toast.success(`Successfully registered ${res.totalRegistered} devices for ${customer.name}!`);
        finalRepairs = res.repairs || [];
        finalCustomer = res.customer || customer;
      }

      // Automatically launch Service Slip Generation Dialog
      setSavedSlipRepairs(finalRepairs);
      setSavedSlipCustomer(finalCustomer);
      setIsSlipModalOpen(true);

    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Failed to register repair job(s)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-20">
      
      {/* Header and Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-full h-10 w-10 border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-wrap text-xs md:text-sm">
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/repairs">Repairs</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate font-semibold text-slate-800">
                  New Intake & Multi-Device Registration
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              New Repair Intake
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Register walk-in or courier devices under unified customer profiles with unique repair numbers and warranty tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1.5 bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Multi-Device & Courier Active
            </Badge>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* 1. DEVICE RECEIVING METHOD SELECTOR */}
        <Card className="rounded-2xl border-2 border-slate-200/90 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span>Device Receiving Method</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-500">
                  Select whether the customer delivered the device in person or sent it remotely through courier logistics.
                </CardDescription>
              </div>
              <Badge className={cn(
                "px-3 py-1 font-bold text-xs",
                receivingMethod === 'COURIER' ? "bg-amber-600 text-white" : "bg-slate-900 text-white"
              )}>
                {receivingMethod === 'COURIER' ? 'Courier Delivery' : 'Walk-in Customer'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Option 1: Walk-In Customer */}
              <div 
                onClick={() => setReceivingMethod('WALK_IN')}
                className={cn(
                  "cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-4",
                  receivingMethod === 'WALK_IN' 
                    ? "border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/10" 
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div className={cn(
                  "p-3 rounded-xl shrink-0 transition-colors",
                  receivingMethod === 'WALK_IN' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                )}>
                  <User className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">Walk-in Customer</span>
                    {receivingMethod === 'WALK_IN' && (
                      <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5">Selected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Customer visited MTS Lab lab in person to hand over the device at our New Road service counter.
                  </p>
                </div>
              </div>

              {/* Option 2: Courier Customer */}
              <div 
                onClick={() => setReceivingMethod('COURIER')}
                className={cn(
                  "cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-4",
                  receivingMethod === 'COURIER' 
                    ? "border-amber-500 bg-amber-50/40 shadow-sm ring-2 ring-amber-400/20" 
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div className={cn(
                  "p-3 rounded-xl shrink-0 transition-colors",
                  receivingMethod === 'COURIER' ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"
                )}>
                  <Package className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">Courier / Remote District</span>
                    {receivingMethod === 'COURIER' && (
                      <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">Courier Mode</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Customer sent smartphone from another district/city via courier parcel (Sundar, Pathao, Post, etc.).
                  </p>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* 2. COURIER-IN DETAILS SECTION (Visible when Courier is selected) */}
        <AnimatePresence>
          {receivingMethod === 'COURIER' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="rounded-2xl border-2 border-amber-300 shadow-md bg-white overflow-hidden">
                <CardHeader className="bg-amber-50/80 border-b border-amber-200 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-amber-950">Incoming Courier Consignment Details</CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-amber-800">
                        Record the courier partner, consignment tracking number, and sender details for remote accountability.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Courier Company */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">
                        Courier Partner <span className="text-rose-500">*</span>
                      </Label>
                      <Select
                        value={courierIn.courierCompany}
                        onValueChange={(v) => setCourierIn(prev => ({ ...prev, courierCompany: v }))}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 font-semibold text-sm">
                          <SelectValue placeholder="Select Courier" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl">
                          {COURIER_COMPANIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {courierIn.courierCompany === 'Other Courier' && (
                        <Input
                          placeholder="Specify Courier Name"
                          value={courierIn.customCourierCompany}
                          onChange={(e) => setCourierIn(prev => ({ ...prev, customCourierCompany: e.target.value }))}
                          className="h-10 rounded-xl border-slate-200 bg-white text-xs mt-1.5"
                          required
                        />
                      )}
                    </div>

                    {/* Consignment / Tracking Number */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">
                        Consignment / Tracking # <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="e.g. SCN-982341, TRK-10293"
                          value={courierIn.courierTrackingNumber}
                          onChange={(e) => setCourierIn(prev => ({ ...prev, courierTrackingNumber: e.target.value }))}
                          className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 font-mono text-sm font-bold"
                          required
                        />
                      </div>
                    </div>

                    {/* Courier Sent Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Sender Dispatch Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="date"
                          value={courierIn.courierDate}
                          onChange={(e) => setCourierIn(prev => ({ ...prev, courierDate: e.target.value }))}
                          className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Lab Received Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Lab Received Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="date"
                          value={courierIn.courierReceivedDate}
                          onChange={(e) => setCourierIn(prev => ({ ...prev, courierReceivedDate: e.target.value }))}
                          className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Sender Name */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Sender Name (on Package)</Label>
                      <Input
                        placeholder="Leave blank to use customer name"
                        value={courierIn.senderName}
                        onChange={(e) => setCourierIn(prev => ({ ...prev, senderName: e.target.value }))}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs"
                      />
                    </div>

                    {/* Sender Phone */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Sender Phone (on Package)</Label>
                      <Input
                        placeholder="Leave blank to use customer phone"
                        value={courierIn.senderPhone}
                        onChange={(e) => setCourierIn(prev => ({ ...prev, senderPhone: e.target.value }))}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-mono"
                      />
                    </div>

                    {/* Origin District */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Origin District</Label>
                      <Select
                        value={courierIn.originDistrict}
                        onValueChange={(v) => setCourierIn(prev => ({ ...prev, originDistrict: v }))}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold">
                          <SelectValue placeholder="Select Origin District" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl max-h-60">
                          {NEPAL_DISTRICTS.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Courier Notes */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Courier Package Notes</Label>
                      <Input
                        placeholder="e.g. Bubble wrapped, sealed box"
                        value={courierIn.courierNotes}
                        onChange={(e) => setCourierIn(prev => ({ ...prev, courierNotes: e.target.value }))}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs"
                      />
                    </div>

                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. CUSTOMER INFORMATION CARD (Master Entity with Deduplication) */}
        <Card className="rounded-2xl border border-slate-200 shadow-md bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl text-white shadow-sm shrink-0", customer.id ? "bg-emerald-600" : "bg-slate-900")}>
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    Customer Identification
                    {customer.id && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[10px] px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                        {customer.customerId}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-500">
                    {customer.id
                      ? 'Existing customer profile linked — this repair will be added to their history.'
                      : 'Entering phone number searches the database to reuse existing profile and prevent duplicate records.'}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">

            {/* Existing Customer Detected Banner (not yet confirmed) */}
            {matchedExistingCustomer && !customer.id && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-2 flex-wrap">
                      <span>Existing Customer Found:</span>
                      <span className="text-slate-900 font-extrabold">{matchedExistingCustomer.name}</span>
                      <Badge variant="outline" className="bg-white text-blue-800 text-[10px] font-mono">
                        {matchedExistingCustomer.customerId}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-blue-700">
                      Phone: {matchedExistingCustomer.phone} • {matchedExistingCustomer.address || matchedExistingCustomer.district || 'Nepal'} • {matchedExistingCustomer.repairs?.length || matchedExistingCustomer.totalRepairs || 0} previous repairs
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => selectExistingCustomer(matchedExistingCustomer)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Use Existing Customer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMatchedExistingCustomer(null)}
                    className="h-8 px-2.5 text-xs text-slate-600 border-slate-300 cursor-pointer"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Returning Customer Banner — shown when customer is confirmed / pre-filled */}
            {customer.id && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                    {customer.name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-emerald-900">{customer.name}</span>
                      <Badge className="text-[9px] px-1.5 py-0.5 bg-emerald-600 text-white font-bold border-0">
                        Existing Customer
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-emerald-700">{customer.phone}</span>
                      <span className="text-xs font-mono text-emerald-500">{customer.customerId}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/customers/${customer.id}`)}
                    className="h-8 px-3 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    View History
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedCustomer}
                    className="h-8 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                  >
                    Unlink
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Phone Number Input with Auto-search */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs font-bold text-slate-700">
                  Customer Primary Phone <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="customer-phone-input"
                    placeholder="98XXXXXXXX"
                    value={customer.phone}
                    onChange={handleCustomerPhoneChange}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold"
                    required
                  />
                  {searchingCustomer && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Existing Customers Found
                    </div>
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectExistingCustomer(c)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{c.phone} • {c.customerId}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-slate-100">
                          {c.repairs?.length || 0} repairs
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Customer Full Name <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="customer-name-input"
                    placeholder="e.g. Ram Sharma"
                    value={customer.name}
                    onChange={handleCustomerNameChange}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Alternative Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Alternative Phone / WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Optional secondary phone"
                    value={customer.alternativePhone}
                    onChange={(e) => setCustomer(prev => ({ ...prev, alternativePhone: e.target.value }))}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={customer.email}
                    onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>

              {/* District */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  District <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={customer.district}
                  onValueChange={(v) => setCustomer(prev => ({ ...prev, district: v }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 font-semibold text-sm">
                    <SelectValue placeholder="Select District" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl max-h-60">
                    {NEPAL_DISTRICTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Municipality / City */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Municipality / City</Label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="e.g. Kathmandu Metro, Pokhara Ward 5"
                    value={customer.municipality}
                    onChange={(e) => setCustomer(prev => ({ ...prev, municipality: e.target.value }))}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>

              {/* Full Address */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Full Permanent Address <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="e.g. New Road, Kathmandu"
                    value={customer.address}
                    onChange={(e) => setCustomer(prev => ({ ...prev, address: e.target.value }))}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>

              {/* Landmark / Delivery Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Landmark / Delivery Direction</Label>
                <div className="relative">
                  <Compass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="e.g. Opposite Sankata Temple"
                    value={customer.landmark}
                    onChange={(e) => setCustomer(prev => ({ ...prev, landmark: e.target.value }))}
                    className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* 4. DEVICES SECTION (Multi-Device Stack) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: List of Devices */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-slate-800" />
                <h2 className="text-xl font-extrabold text-slate-900">
                  Devices in this Intake ({devices.length})
                </h2>
              </div>

              <Button
                type="button"
                onClick={addAnotherDevice}
                variant="outline"
                className="rounded-xl border-slate-300 text-slate-800 font-bold hover:bg-slate-100 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Another Device</span>
              </Button>
            </div>

            <div className="space-y-6">
              {devices.map((device, idx) => (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="rounded-2xl border border-slate-200 shadow-md bg-white overflow-hidden relative">
                    
                    {/* Device Header */}
                    <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-sm">
                            Device #{idx + 1}: {device.deviceBrand.toUpperCase()} {device.deviceModel || 'Unspecified Model'}
                          </span>
                          {device.problemDescription && (
                            <p className="text-[11px] text-slate-300 truncate max-w-md">
                              Issue: {device.problemDescription}
                            </p>
                          )}
                        </div>
                      </div>

                      {devices.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDevice(idx)}
                          className="text-rose-300 hover:text-rose-100 hover:bg-rose-950/50 h-8 px-2.5 text-xs font-semibold rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <CardContent className="p-6 space-y-6">
                      
                      {/* Brand, Model, IMEI & Color */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Manufacturer Brand</Label>
                          <Select
                            value={device.deviceBrand}
                            onValueChange={(v) => handleDeviceChange(idx, 'deviceBrand', v)}
                          >
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 font-semibold text-sm">
                              <SelectValue placeholder="Brand" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-xl">
                              <SelectItem value="apple">Apple iPhone</SelectItem>
                              <SelectItem value="samsung">Samsung Galaxy</SelectItem>
                              <SelectItem value="xiaomi">Xiaomi / Redmi / Poco</SelectItem>
                              <SelectItem value="oneplus">OnePlus</SelectItem>
                              <SelectItem value="google">Google Pixel</SelectItem>
                              <SelectItem value="nothing">Nothing Phone</SelectItem>
                              <SelectItem value="oppo">Oppo</SelectItem>
                              <SelectItem value="vivo">Vivo</SelectItem>
                              <SelectItem value="realme">Realme</SelectItem>
                              <SelectItem value="other">Other Brand</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">
                            Model Name <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            placeholder="e.g. iPhone 15 Pro Max, S24 Ultra"
                            value={device.deviceModel}
                            onChange={(e) => handleDeviceChange(idx, 'deviceModel', e.target.value)}
                            className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">IMEI / Serial No.</Label>
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="15-digit IMEI"
                              value={device.imeiNumber}
                              onChange={(e) => handleDeviceChange(idx, 'imeiNumber', e.target.value)}
                              className="h-11 pl-9 rounded-xl border-slate-200 bg-slate-50 font-mono text-xs font-bold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Device Color</Label>
                          <Input
                            placeholder="e.g. Titanium Black, Purple"
                            value={device.deviceColor}
                            onChange={(e) => handleDeviceChange(idx, 'deviceColor', e.target.value)}
                            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                          />
                        </div>
                      </div>

                      {/* Device Receiving Condition Multi-Select Checklist */}
                      <div className="space-y-3 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/70">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <Label className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Device Physical Condition Upon Intake</span>
                            <span className="text-rose-500">*</span>
                          </Label>
                          <span className="text-[11px] text-slate-500 font-medium">Select all conditions detected (Good is exclusive)</span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {CONDITION_OPTIONS.map((c) => {
                            const isSelected = device.selectedConditions?.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleCondition(idx, c);
                                }}
                                className={cn(
                                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                                  isSelected 
                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10" 
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-2xs"
                                )}
                              >
                                {isSelected ? (
                                  <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5] pointer-events-none" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 stroke-[2] pointer-events-none" />
                                )}
                                <span className="pointer-events-none">{c}</span>
                              </button>
                            );
                          })}
                        </div>

                        {device.selectedConditions?.includes("Other Physical Damage") && (
                          <Input
                            placeholder="Describe custom damage or physical condition..."
                            value={device.otherConditionText || ''}
                            onChange={(e) => handleDeviceChange(idx, 'otherConditionText', e.target.value)}
                            className="h-10 rounded-xl bg-white border-slate-300 text-xs mt-2"
                          />
                        )}

                        <div className="pt-1">
                          <Input
                            placeholder="Additional Condition Notes (e.g. camera lens glass scratched, speaker grill clogged)"
                            value={device.conditionNotes || ''}
                            onChange={(e) => handleDeviceChange(idx, 'conditionNotes', e.target.value)}
                            className="h-10 rounded-xl bg-white border-slate-200 text-xs placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Accessories Received Multi-Select Checklist */}
                      <div className="space-y-3 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/70">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <Label className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Accessories Received with Device</span>
                          </Label>
                          <span className="text-[11px] text-slate-500 font-medium">Recorded for accountability (No Accessories is exclusive)</span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {ACCESSORY_OPTIONS.map((acc) => {
                            const isSelected = device.selectedAccessories?.includes(acc);
                            return (
                              <button
                                key={acc}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleAccessory(idx, acc);
                                }}
                                className={cn(
                                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                                  isSelected 
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/10" 
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-2xs"
                                )}
                              >
                                {isSelected ? (
                                  <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5] pointer-events-none" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 stroke-[2] pointer-events-none" />
                                )}
                                <span className="pointer-events-none">{acc}</span>
                              </button>
                            );
                          })}
                        </div>

                        {device.selectedAccessories?.includes("Other") && (
                          <Input
                            placeholder="Specify other accessory received (e.g. Stylus pen, MagSafe wallet)..."
                            value={device.otherAccessoryText || ''}
                            onChange={(e) => handleDeviceChange(idx, 'otherAccessoryText', e.target.value)}
                            className="h-10 rounded-xl bg-white border-slate-300 text-xs mt-2"
                          />
                        )}
                      </div>

                      {/* Problem Description & Remarks */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">
                            Problem / Customer Description <span className="text-rose-500">*</span>
                          </Label>
                          <Textarea
                            rows={3}
                            placeholder="e.g. Display cracked, touch not responding on lower half, battery drains in 2 hours."
                            value={device.problemDescription}
                            onChange={(e) => handleDeviceChange(idx, 'problemDescription', e.target.value)}
                            className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Internal Lab Remarks / Instructions</Label>
                          <Textarea
                            rows={3}
                            placeholder="e.g. Customer requested original OLED panel; test front camera after assembly."
                            value={device.remarks}
                            onChange={(e) => handleDeviceChange(idx, 'remarks', e.target.value)}
                            className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium"
                          />
                        </div>
                      </div>

                      {/* Financials & Assignment */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                        
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Estimated Cost (Rs.)</Label>
                          <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              type="number"
                              placeholder="0"
                              value={device.estimatedCost}
                              onChange={(e) => handleDeviceChange(idx, 'estimatedCost', e.target.value)}
                              className="h-11 pl-9 rounded-xl border-slate-200 bg-slate-50 font-bold font-mono text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Advance Deposit (Rs.)</Label>
                          <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                            <Input
                              type="number"
                              placeholder="0"
                              value={device.advancePaid}
                              onChange={(e) => handleDeviceChange(idx, 'advancePaid', e.target.value)}
                              className="h-11 pl-9 rounded-xl border-slate-200 bg-slate-50 font-bold font-mono text-sm text-emerald-700"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Assign Technician</Label>
                          <Select
                            value={device.technicianId}
                            onValueChange={(v) => handleDeviceChange(idx, 'technicianId', v)}
                          >
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium">
                              <SelectValue placeholder="Auto-assign" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {technicians.map((t) => (
                                <SelectItem key={t.id} value={t.id} className="text-xs font-medium">
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Est. Ready Date</Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              type="date"
                              value={device.expectedCompletionDate}
                              onChange={(e) => handleDeviceChange(idx, 'expectedCompletionDate', e.target.value)}
                              className="h-11 pl-9 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium"
                            />
                          </div>
                        </div>

                      </div>

                      {/* Optional Battery Replacement Warranty Section */}
                      <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-xs",
                              device.hasBatteryWarranty ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                            )}>
                              <BatteryCharging className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                <span>Battery Replacement Warranty</span>
                                {device.hasBatteryWarranty && (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-extrabold px-2 py-0.5">
                                    {device.batteryWarrantyPeriod === '1_YEAR' ? '1 Year Warranty' : '6 Months Warranty'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Does this repair service include a warranted battery replacement?
                              </p>
                            </div>
                          </div>

                          {/* Toggle: [ No Warranty ] vs [ Warranty ] */}
                          <div className="flex items-center p-1 bg-slate-200/80 rounded-xl text-xs font-bold shrink-0 self-start sm:self-auto shadow-inner">
                            <button
                              type="button"
                              onClick={() => handleDeviceChange(idx, 'hasBatteryWarranty', false)}
                              className={cn(
                                "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                                !device.hasBatteryWarranty ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                              )}
                            >
                              No Warranty
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeviceChange(idx, 'hasBatteryWarranty', true)}
                              className={cn(
                                "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                                device.hasBatteryWarranty ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Warranty</span>
                            </button>
                          </div>
                        </div>

                        {/* If Warranty is selected */}
                        {device.hasBatteryWarranty && (
                          <div className="pt-3 border-t border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-3.5 animate-in fade-in duration-200">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-slate-700">Warranty Duration</Label>
                              <Select
                                value={device.batteryWarrantyPeriod || '6_MONTHS'}
                                onValueChange={(v) => handleDeviceChange(idx, 'batteryWarrantyPeriod', v)}
                              >
                                <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-xs font-bold shadow-xs">
                                  <SelectValue placeholder="Select Warranty Period" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="6_MONTHS" className="text-xs font-semibold">6 Months Warranty</SelectItem>
                                  <SelectItem value="1_YEAR" className="text-xs font-semibold">1 Year (12 Months) Warranty</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-slate-700">Battery Specification</Label>
                              <Input
                                placeholder="e.g. Original Apple Battery"
                                value={device.batteryType || ''}
                                onChange={(e) => handleDeviceChange(idx, 'batteryType', e.target.value)}
                                className="h-10 rounded-xl border-slate-300 bg-white text-xs font-medium shadow-xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-slate-700">Calculated Expiry Date</Label>
                              <div className="h-10 px-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-900 font-bold text-xs flex items-center justify-between shadow-xs">
                                <span className="truncate">{calculateWarrantyExpiryPreview(device.batteryWarrantyPeriod || '6_MONTHS')}</span>
                                <Badge variant="outline" className="bg-emerald-100/80 text-emerald-800 border-emerald-300 text-[9px] font-bold shrink-0 ml-1.5">
                                  Auto Date
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {/* Bottom Add Another Device Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addAnotherDevice}
                className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-5 h-5 text-blue-600" />
                <span>+ Add Another Device to This Customer Visit</span>
              </Button>
            </div>
          </div>

          {/* Right Column: Financial Summary & Confirmation */}
          <div className="space-y-6 lg:sticky lg:top-24">
            
            <Card className="rounded-2xl border border-slate-200 shadow-lg bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-emerald-400" />
                      <span>Intake Summary</span>
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      {receivingMethod === 'COURIER' ? 'Courier Delivery Intake' : 'Walk-in Customer Visit'}
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-600 text-white text-xs px-2.5 py-1">
                    {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-5">
                
                {/* Customer Snapshot */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>{customer.name || 'Customer Name'}</span>
                    <span className="font-mono text-slate-500">{customer.customerId || 'New Customer'}</span>
                  </div>
                  <div className="text-slate-600 font-mono">{customer.phone || 'Phone Number'}</div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{customer.address || customer.district || 'Location'}</span>
                  </div>
                  {receivingMethod === 'COURIER' && (
                    <div className="pt-1 text-[11px] font-bold text-amber-700 flex items-center gap-1">
                      <Package className="w-3 h-3 text-amber-600" />
                      <span>Via {courierIn.courierCompany || 'Courier'} (Trk: {courierIn.courierTrackingNumber || 'Pending'})</span>
                    </div>
                  )}
                </div>

                {/* Device Breakdown List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Device List</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {devices.map((d, i) => (
                      <div key={d.id} className="text-xs flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-medium text-slate-800 truncate max-w-[140px]">
                          {i + 1}. {d.deviceBrand.toUpperCase()} {d.deviceModel || 'Device'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatNPR(Number(d.estimatedCost) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Financial Totals */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Estimated Cost:</span>
                    <span className="font-mono font-bold text-slate-900">{formatNPR(totalEstimatedCost)}</span>
                  </div>

                  <div className="flex items-center justify-between text-emerald-600">
                    <span>Total Advance Deposit:</span>
                    <span className="font-mono font-bold">{formatNPR(totalAdvancePaid)}</span>
                  </div>

                  <Separator className="bg-slate-100" />

                  <div className="flex items-center justify-between text-base font-extrabold text-slate-900">
                    <span>Est. Balance Due:</span>
                    <span className="font-mono text-blue-600">{formatNPR(totalRemaining)}</span>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-2 space-y-2">
                  <Button
                    id="submit-repair-intake-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Intake...</span>
                      </>
                    ) : (
                      <>
                        <span>Register {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}</span>
                        <Plus className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard/repairs')}
                    className="w-full h-10 rounded-xl text-slate-600 border-slate-200 text-xs font-semibold"
                  >
                    Cancel & Return
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* Note & Policy */}
            <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                All registered devices receive a unique <strong>Repair Number (e.g. MTS-2026-0001)</strong> while being linked directly to this customer's profile.
              </p>
            </div>

          </div>

        </div>

      </form>

      {/* Automatic Service Slip / Bill Modal */}
      <ServiceSlipModal
        open={isSlipModalOpen}
        onOpenChange={setIsSlipModalOpen}
        repairs={savedSlipRepairs}
        customer={savedSlipCustomer}
        onDone={() => navigate('/dashboard/repairs')}
        onNewIntake={() => {
          clearSelectedCustomer();
          setDevices([createInitialDevice(1)]);
        }}
      />
    </div>
  );
}