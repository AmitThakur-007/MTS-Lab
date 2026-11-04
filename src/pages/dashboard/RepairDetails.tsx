import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { useRealtimeSync } from '@/services/realtime';
import { useRepairCache } from '@/store/repairCache';
import RepairRecordDetail from '@/components/repair/RepairRecordDetail';

export default function RepairDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repair, setRepair] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [repairData, staffData, notesData] = await Promise.all([
        api.get(`/repairs/${id}`),
        api.get('/staff'),
        api.get(`/repairs/${id}/notes`).catch(() => [])
      ]);
      setRepair(repairData);
      if (repairData && (repairData.id || repairData.repairNumber)) {
        useRepairCache.getState().updateRepair(repairData.id || repairData.repairNumber, repairData);
      }
      setTechnicians(
        Array.isArray(staffData)
          ? staffData.filter((s: any) => ['TECHNICIAN', 'LEAD_TECHNICIAN'].includes(s.role) && s.isActive !== false)
          : []
      );
      setNotes(Array.isArray(notesData) ? notesData : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load repair details');
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard/repairs');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useRealtimeSync(
    ['repair', 'technicianNote', 'repairLog', 'notification', 'repairTransfer', 'payment', 'user', 'sync'],
    (event) => {
      if (
        !event.id ||
        event.id === id ||
        event.data?.id === id ||
        event.data?.repairId === id ||
        ['user', 'payment', 'technicianNote', 'repairLog', 'repair', 'sync', 'notification', 'repairTransfer'].includes(
          event.entity
        )
      ) {
        fetchData();
      }
    }
  );

  if (loading || !repair) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Opening Repair Vault...</p>
      </div>
    );
  }

  return (
    <RepairRecordDetail
      repair={repair}
      technicians={technicians}
      notes={notes}
      onRefresh={fetchData}
      onUpdateRepair={(updated) => {
        setRepair(updated);
        if (updated && (updated.id || updated.repairNumber)) {
          useRepairCache.getState().updateRepair(updated.id || updated.repairNumber, updated);
        }
      }}
    />
  );
}
