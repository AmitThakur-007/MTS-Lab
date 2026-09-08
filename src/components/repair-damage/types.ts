export interface DamageRecord {
  id: string;
  recordNumber: string;
  staffId: string;
  staffName: string;
  staffRole?: string;
  damagedComponent: string;
  damageType?: string;
  damageDescription: string;
  repairId?: string;
  repairNumber?: string;
  customerId?: string;
  customerName?: string;
  deviceBrand?: string;
  deviceModel?: string;
  damageDate: string;
  damageTime?: string;
  quantity?: number;
  estimatedCost?: number | null;
  notes?: string;
  inventoryItemId?: string;
  inventoryItemName?: string;
  status?: string;
  recordedById?: string;
  recordedByName?: string;
  recordedByRole?: string;
  branchId?: string;
  createdAt?: string;
  updatedAt?: string;
  audits?: Array<{
    id: string;
    action: string;
    performedById: string;
    performedByName: string;
    performedByRole: string;
    reason?: string;
    createdAt: string;
  }>;
}

export interface DamageOverviewStats {
  totalRecords: number;
  thisMonthRecords: number;
  todayRecords: number;
  totalEstimatedCost: number;
  currentMonth?: string;
  todayDate?: string;
  componentBreakdown?: Record<string, number>;
  roleBreakdown?: Record<string, number>;
}

export const STANDARD_COMPONENTS = [
  'Display Panel',
  'OCA Glass',
  'Touch Screen Digitizer',
  'AMOLED Display',
  'LCD Screen',
  'Back Glass / Back Panel',
  'Battery',
  'Camera Module (Rear)',
  'Camera Module (Front)',
  'Camera Lens Glass',
  'Charging Port PCB',
  'Speaker / Earpiece',
  'Flex Cable',
  'Motherboard / PCB',
  'Power IC',
  'Audio IC',
  'Other Component'
];

export const DAMAGE_TYPES = [
  { value: 'CRACKED', label: 'Cracked / Shattered Glass' },
  { value: 'TORN_FLEX', label: 'Torn Flex Ribbon Cable' },
  { value: 'SHORT_CIRCUIT', label: 'Short Circuit / Electrical Burn' },
  { value: 'HEAT_DAMAGE', label: 'Heat Separation Damage' },
  { value: 'PRESSURE_BLEED', label: 'Pressure / OLED Bleed / Line' },
  { value: 'SCRATCHED', label: 'Scratched / Cosmetic Dent' },
  { value: 'COMPONENT_LOST', label: 'Lost / Displaced Small Part' },
  { value: 'OTHER', label: 'Other Handling Mishap' }
];

export function getComponentBadgeColor(comp?: string): string {
  if (!comp) return 'bg-slate-50 text-slate-700 border-slate-200';
  if (comp.includes('Display') || comp.includes('Screen') || comp.includes('OLED')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
  if (comp.includes('Glass') || comp.includes('Housing') || comp.includes('Panel')) {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }
  if (comp.includes('Battery')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (comp.includes('Camera')) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  if (comp.includes('Charging') || comp.includes('Port')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (comp.includes('Speaker') || comp.includes('Audio')) {
    return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  }
  if (comp.includes('Flex') || comp.includes('Connector')) {
    return 'bg-orange-50 text-orange-700 border-orange-200';
  }
  if (comp.includes('IC') || comp.includes('Board') || comp.includes('Motherboard')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}
