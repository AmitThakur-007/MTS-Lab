export type DeviceCategory = 'ALL' | 'IPHONE' | 'SMARTPHONE' | 'IPAD' | 'TABLET' | 'LAPTOP' | 'TV';
export type WorkloadStatus = 'AVAILABLE' | 'NORMAL' | 'HEAVY' | 'OVERLOADED';
export type PriorityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TransferStatus = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface TechnicianSummary {
  totalTechnicians: number;
  availableTechnicians: number;
  workingTechnicians: number;
  overloadedTechnicians: number;
  totalAssignedRepairs: number;
  unassignedRepairsCount: number;
  pendingRepairsCount: number;
  inProgressRepairsCount: number;
  waitingForPartsCount: number;
  completedRepairsCount: number;
  pendingTransferRequestsCount: number;
  highPriorityRepairsCount: number;
  urgentRepairsCount: number;
}

export interface TechnicianPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string | null;
  department?: string | null;
  profileImage?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  assignedRepairsCount: number;
  activeRepairsCount: number;
  pendingCount: number;
  inProgressCount: number;
  waitingForPartsCount: number;
  completedCount: number;
  highPriorityCount: number;
  urgentCount: number;
  workloadStatus: WorkloadStatus;
  workloadLabel: string;
  workloadBadgeClass: string;
  workloadDotColor: string;
  deviceCategories: {
    IPHONE: number;
    SMARTPHONE: number;
    IPAD: number;
    TABLET: number;
    LAPTOP: number;
    TV: number;
  };
  latestRepair?: {
    id: string;
    repairNumber: string;
    deviceBrand?: string;
    deviceModel?: string;
    status: string;
    priority: string;
    updatedAt: string;
  } | null;
  activeRepairs: Array<{
    id: string;
    repairNumber: string;
    customerName: string;
    customerPhone: string;
    deviceBrand?: string;
    deviceModel?: string;
    category: string;
    problemDescription?: string;
    status: string;
    priority: string;
    assignedAt?: string | null;
    updatedAt: string;
  }>;
}

export interface EnrichedTransferRequest {
  id: string;
  repairId: string;
  repairNumber: string;
  senderTechnicianId: string;
  senderTechnicianName: string;
  targetTechnicianId: string;
  targetTechnicianName: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  respondedAt?: string | null;
  responseNote?: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string;
  deviceBrand: string;
  deviceModel: string;
  deviceCategory: string;
  repairStatus: string;
  priority: string;
}

export interface RepairItem {
  id: string;
  repairNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceCategory: DeviceCategory;
  imeiNumber?: string | null;
  problemDescription?: string | null;
  status: string;
  priority: string;
  priorityUpdatedAt?: string | null;
  technicianId?: string | null;
  technician?: {
    id: string;
    name: string;
    role: string;
    email: string;
  } | null;
  assignedAt?: string | null;
  assignedByName?: string | null;
  estimatedCost?: number | null;
  advancePaid?: number | null;
  totalPaid?: number | null;
  createdAt: string;
  updatedAt: string;
}
