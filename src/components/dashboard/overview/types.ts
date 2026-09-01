export interface SystemSummary {
  totalRepairs: number;
  activeRepairs: number;
  completedRepairs: number;
  pendingRepairs: number;
  inProgressRepairs: number;
  readyForPickupRepairs: number;
  deliveredRepairs: number;
  reProblemRepairs: number;
  cannotRepairCount: number;
  unassignedRepairs: number;
  urgentPriorityCount: number;
  highPriorityCount: number;
  totalCustomers: number;
  totalStaff: number;
  totalTechnicians: number;
  totalBranches: number;
}

export interface TodayOperations {
  todayNewRepairs: number;
  todayCompletedRepairs: number;
  todayDeliveredRepairs: number;
  todayPendingRepairs: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalRevenue: number;
  pendingReceivables: number;
}

export interface StaffAttendanceSummary {
  totalStaff: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  notMarkedToday: number;
  pendingRequestsCount: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  status: string;
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: LowStockItem[];
}

export interface WarrantySummary {
  totalWarranties: number;
  activeWarrantiesCount: number;
}

export interface CourierSummary {
  courierInCount: number;
  courierOutCount: number;
  courierPendingCount: number;
}

export interface DamageSummary {
  todayDamagesCount: number;
  thisMonthDamagesCount: number;
  totalDamageCost: number;
}

export interface SystemAlerts {
  urgentRepairsCount: number;
  highPriorityCount: number;
  lowStockCount: number;
  unassignedRepairsCount: number;
  pendingTransfersCount: number;
  pendingAccessRequestsCount: number;
  unreadNotificationsCount: number;
}

export interface ChartIntakePoint {
  date: string;
  day: string;
  shortDate: string;
  count: number;
}

export interface TopBrand {
  brand: string;
  count: number;
}

export interface TechnicianWorkload {
  id: string;
  name: string;
  role: string;
  department: string;
  activeCount: number;
  inProgressCount: number;
  pendingCount: number;
  urgentCount: number;
  completedToday: number;
}

export interface RepairItem {
  id: string;
  repairNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deviceBrand: string;
  deviceModel: string;
  problemDescription?: string;
  status: string;
  priority: string;
  estimatedCost?: number;
  advancePaid?: number;
  totalPaid?: number;
  paymentStatus?: string;
  technicianId?: string;
  isCourierIn?: boolean;
  courierInStatus?: string;
  isCourierOut?: boolean;
  courierOutStatus?: string;
  hasBatteryWarranty?: boolean;
  receivingMethod?: string;
  createdAt: string;
  completedAt?: string;
  deliveredAt?: string;
}

export interface TransferRequestItem {
  id: string;
  repairId: string;
  repairNumber: string;
  senderTechnicianId: string;
  senderTechnicianName: string;
  targetTechnicianId: string;
  targetTechnicianName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface AccessRequestItem {
  id: string;
  userId?: string;
  userEmail: string;
  userName: string;
  requestedRole: string;
  status: string;
  reason?: string;
  createdAt: string;
}

export interface TechnicianCockpitData {
  assignedToMeTotal: number;
  myInProgressCount: number;
  myWaitingPartsCount: number;
  myCompletedTodayCount: number;
  myUrgentCount: number;
  myHighCount: number;
  myReProblemCount: number;
  myActiveRepairs: RepairItem[];
  incomingTransfers: TransferRequestItem[];
  outgoingTransfers: TransferRequestItem[];
  todayAttendance: any | null;
  attendanceRate: number;
}

export interface OverviewData {
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
  serverTime: {
    serverTime: string;
    serverDate: string;
    serverDateNPT: string;
    isWithinWindow: boolean;
    timezone: string;
  };
  systemSummary: SystemSummary;
  todayOperations: TodayOperations;
  staffAttendance: StaffAttendanceSummary;
  inventorySummary: InventorySummary;
  warrantySummary: WarrantySummary;
  courierSummary: CourierSummary;
  damageSummary: DamageSummary;
  alerts: SystemAlerts;
  technicianCockpit: TechnicianCockpitData;
  charts: {
    intakeTrends: ChartIntakePoint[];
    topBrands: TopBrand[];
    statusBreakdown: Record<string, number>;
  };
  queues: {
    urgentQueue: RepairItem[];
    unassignedQueue: RepairItem[];
    readyForPickupQueue: RepairItem[];
    recentRepairs: RepairItem[];
    technicianWorkload: TechnicianWorkload[];
    pendingAccessRequests: AccessRequestItem[];
    pendingTransfers: TransferRequestItem[];
    customerRepairs: RepairItem[];
  };
}
