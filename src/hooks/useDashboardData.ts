import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { useRealtimeSync } from '@/services/realtime';

export interface DashboardStats {
    activeRepairs: number;
    completedRepairs: number;
    totalCustomers: number;
    totalStaff: number;
    totalRevenue: number;
}

export function useDashboardData() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [repairs, setRepairs] = useState<any[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Silent refresh: Updates state directly without destroying existing DOM elements
    const fetchDashboardData = useCallback(async (isSilent = true) => {
        if (!isSilent) setInitialLoading(true);
        setIsSyncing(true);

        try {
            // Parallel execution for fast resolution
            const [statsRes, repairsRes] = await Promise.allSettled([
                api.get('/dashboard/stats'),
                api.get('/repairs?limit=10')
            ]);

            if (statsRes.status === 'fulfilled' && statsRes.value) {
                setStats(statsRes.value as DashboardStats);
            }

            if (repairsRes.status === 'fulfilled' && repairsRes.value) {
                const rawRepairs = Array.isArray(repairsRes.value)
                    ? repairsRes.value
                    : (repairsRes.value as any)?.repairs || [];
                setRepairs(rawRepairs);
            }
        } catch (err) {
            console.error('[SILENT DASHBOARD SYNC ERROR]', err);
        } finally {
            setInitialLoading(false);
            setIsSyncing(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchDashboardData(false);

        // Optional: Background polling every 30 seconds as fallback
        const interval = setInterval(() => {
            fetchDashboardData(true);
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    // Debounced realtime listener to prevent rapid stuttering
    const handleRealtimeSync = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchDashboardData(true);
        }, 400);
    }, [fetchDashboardData]);

    useRealtimeSync(['repair', 'customer', 'user', 'RepairLog'], handleRealtimeSync);

    return {
        stats,
        repairs,
        initialLoading,
        isSyncing,
        refresh: () => fetchDashboardData(true),
    };
}