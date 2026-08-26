import { api } from './api';
import { RepairTransferRecord, RepairAssignmentHistoryItem } from '@/types/transfer';

export const transferService = {
  /**
   * Direct Assignment (Manager, Head Tech, Admin, Super Admin)
   */
  async directAssignRepair(repairId: string, payload: {
    targetTechnicianId: string;
    targetTechnicianName?: string;
    reason?: string;
  }) {
    return api.post(`/repairs/${repairId}/assign`, payload);
  },

  /**
   * Create a Transfer Request (Technician -> Technician, Technician -> Head Tech)
   * Or Direct Assignment if authorized
   */
  async requestTransfer(repairId: string, payload: {
    targetTechnicianId: string;
    reason: string;
  }) {
    return api.post(`/repairs/${repairId}/transfer`, payload);
  },

  /**
   * Get list of repair transfers (optional filters: pending, recipient, sender)
   */
  async getTransfers(params?: { status?: string; targetTechnicianId?: string; repairId?: string }): Promise<RepairTransferRecord[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.targetTechnicianId) query.set('targetTechnicianId', params.targetTechnicianId);
    if (params?.repairId) query.set('repairId', params.repairId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/repair-transfers${queryString}`);
  },

  /**
   * Accept a pending transfer request
   */
  async acceptTransfer(transferId: string) {
    return api.post(`/repair-transfers/${transferId}/accept`, {});
  },

  /**
   * Reject a pending transfer request
   */
  async rejectTransfer(transferId: string, rejectionReason?: string) {
    return api.post(`/repair-transfers/${transferId}/reject`, { rejectionReason });
  },

  /**
   * Cancel a pending transfer request (by sender)
   */
  async cancelTransfer(transferId: string) {
    return api.post(`/repair-transfers/${transferId}/cancel`, {});
  },

  /**
   * Get chronological assignment and transfer history for a specific repair
   */
  async getRepairTransferHistory(repairId: string): Promise<RepairAssignmentHistoryItem[]> {
    return api.get(`/repairs/${repairId}/transfers`);
  }
};
