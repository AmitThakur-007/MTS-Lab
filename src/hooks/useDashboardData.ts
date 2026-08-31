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
    const [loadError, setLoadError] = useState<string | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchDashboardData = useCallback(async (isSilent = true) => {
        if (!isSilent) setInitialLoading(true);
        setIsSyncing(true);
        setLoadError(null);

        try {
            const results = await Promise.allSettled([
                api.get('/dashboard/stats'),
                api.get('/repairs?limit=10')
            ]);

            const [statsRes, repairsRes] = results;
            const failures: string[] = [];

            if (statsRes.status === 'fulfilled' && statsRes.value) {
                setStats(statsRes.value as DashboardStats);
            } else {
                failures.push('dashboard statistics');
            }

            if (repairsRes.status === 'fulfilled' && repairsRes.value) {
                const rawRepairs = Array.isArray(repairsRes.value)
                    ? repairsRes.value
                    : (repairsRes.value as any)?.repairs;

                if (Array.isArray(rawRepairs)) {
                    setRepairs(rawRepairs);
                } else {
                    failures.push('repair data');
                }
            } else {
                failures.push('repair data');
            }

            if (failures.length > 0) {
                setLoadError(`Unable to load ${failures.join(' and ')}. Please try again.`);
                console.error('[DASHBOARD DATA LOAD ERROR]', {
                    failures,
                    stats: statsRes.status === 'rejected' ? statsRes.reason : undefined,
                    repairs: repairsRes.status === 'rejected' ? repairsRes.reason : undefined,
                });
            }
        } catch (err) {
            setLoadError('Unable to load dashboard data. Please try again.');
            console.error('[DASHBOARD DATA LOAD ERROR]', err);
        } finally {
            setInitialLoading(false);
            setIsSyncing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData(false);
    }, [fetchDashboardData]);

    const handleRealtimeSync = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            debounceTimer.current = null;
            void fetchDashboardData(true);
        }, 400);
    }, [fetchDashboardData]);

    useRealtimeSync(['repair', 'customer', 'user', 'RepairLog'], handleRealtimeSync);

    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
        };
    }, []);

    return {
        stats,
        repairs,
        initialLoading,
        isSyncing,
        loadError,
        refresh: () => fetchDashboardData(true),
    };
}
