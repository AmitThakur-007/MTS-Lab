/**
 * MTS Lab Repair Management System — Repair Transfer & Reassignment Types
 */

export type TransferType =
  | 'MANAGER_DIRECT_ASSIGNMENT'
  | 'HEAD_TECHNICIAN_DIRECT_ASSIGNMENT'
  | 'ADMIN_DIRECT_ASSIGNMENT'
  | 'TECHNICIAN_TO_TECHNICIAN_REQUEST'
  | 'TECHNICIAN_TO_HEAD_TECHNICIAN_REQUEST';

export type TransferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface RepairTransferRecord {
  id: string;
  repairId: string;
  repairNumber: string;
  customerName?: string;
  deviceBrand?: string;
  deviceModel?: string;

  // Parties
  senderId: string;
  senderName: string;
  senderRole: string;

  targetTechnicianId: string;
  targetTechnicianName: string;
  targetTechnicianRole: string;

  previousTechnicianId?: string | null;
  previousTechnicianName?: string | null;

  transferType: TransferType;
  status: TransferStatus;
  reason?: string;
  rejectionReason?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  respondedAt?: string | null;
}

export interface RepairAssignmentHistoryItem {
  id: string;
  repairId: string;
  repairNumber: string;
  previousAssigneeId?: string | null;
  previousAssigneeName?: string | null;
  newAssigneeId: string;
  newAssigneeName: string;
  newAssigneeRole: string;
  assignedById: string;
  assignedByName: string;
  assignedByRole: string;
  transferType: TransferType;
  reason?: string;
  timestamp: string;
}
