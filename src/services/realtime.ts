import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeEvent {
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC';
  id?: string;
  data?: any;
  timestamp: number;
}

type Listener = (event: RealtimeEvent) => void;

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Central realtime service.
 *
 * Supabase Realtime is the single browser transport. The previous EventSource
 * connection to /api/events was removed because a persistent SSE connection is
 * not a reliable transport for the deployed serverless architecture and could
 * produce HTML/MIME errors when routing failed. Database changes are delivered
 * directly by Supabase Realtime instead.
 */
class RealtimeService {
  private listeners: Map<string, Set<Listener>> = new Map();
  private globalListeners: Set<Listener> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private currentStatus: ConnectionStatus = 'disconnected';
  private supabaseConnected = false;
  private supabaseChannel: any = null;
  private networkOnline = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.networkOnline = navigator.onLine;
      this.initNetworkListeners();
      this.initSupabaseRealtimeListeners();
    }
  }

  private updateStatus() {
    if (!this.networkOnline) {
      this.setStatus('disconnected');
      return;
    }
    this.setStatus(this.supabaseConnected ? 'connected' : 'connecting');
  }

  private initSupabaseRealtimeListeners() {
    if (!supabase) {
      this.setStatus('disconnected');
      return;
    }

    try {
      this.supabaseChannel = supabase.channel('mts_app_db_changes', {
        config: { broadcast: { self: true } },
      });

      const tablesToTrack = [
        'Repair', 'repair',
        'Customer', 'customer',
        'TechnicianNote', 'techniciannote',
        'RepairLog', 'repairlog',
        'Notification', 'notification',
      ];

      tablesToTrack.forEach((tableName) => {
        this.supabaseChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload: any) => {
            const actionMap: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
              INSERT: 'CREATE',
              UPDATE: 'UPDATE',
              DELETE: 'DELETE',
            };
            const action = actionMap[payload?.eventType];
            if (!action) return;

            const recordData = payload?.new || payload?.old || {};
            this.handleIncomingEvent({
              entity: tableName.toLowerCase(),
              action,
              id: recordData?.id || payload?.old?.id,
              data: recordData,
              timestamp: Date.now(),
            });
          },
        );
      });

      this.supabaseChannel.on(
        'broadcast',
        { event: '*' },
        ({ payload }: { payload: any }) => {
          if (payload?.entity) this.handleIncomingEvent(payload);
        },
      );

      this.supabaseChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.supabaseConnected = true;
          this.updateStatus();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.supabaseConnected = false;
          this.updateStatus();
        }
      });
    } catch (error) {
      this.supabaseConnected = false;
      this.updateStatus();
      console.warn('[REALTIME] Supabase channel initialization failed:', error);
    }
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      this.networkOnline = true;
      this.updateStatus();
      if (this.supabaseChannel) {
        try { this.supabase.realtime.connect(); } catch (_) { /* Supabase handles reconnects. */ }
      }
    });

    window.addEventListener('offline', () => {
      this.networkOnline = false;
      this.supabaseConnected = false;
      this.updateStatus();
    });
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  private setStatus(status: ConnectionStatus) {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => {
      try { listener(status); } catch (_) { /* Listener errors must not break realtime. */ }
    });
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  private normalizeEntity(entity: string): string {
    return (entity || '').toLowerCase().replace(/[-_\s]/g, '');
  }

  private getEntityAliases(normalized: string): string[] {
    const aliases = [normalized];
    if (normalized.startsWith('repairdamage') || normalized.startsWith('repairrelateddamage')) {
      aliases.push('repairdamage', 'repairrelateddamage', 'repair_damage', 'repair-damage', 'damage');
    } else if (normalized.startsWith('repair')) {
      aliases.push('repair', 'repairs', 'repairlog', 'techniciannote');
    } else if (normalized === 'user' || normalized === 'users' || normalized === 'staff') {
      aliases.push('user', 'users', 'staff', 'session');
    } else if (normalized.startsWith('inventory')) {
      aliases.push('inventory', 'inventoryitem', 'inventorytransaction', 'inventoryfolder', 'inventorycategory');
    } else if (normalized.startsWith('attendance')) {
      aliases.push('attendance', 'attendancerecord', 'attendanceauditlog');
    } else if (normalized.startsWith('courier')) {
      aliases.push('courier', 'couriers');
    } else if (normalized.startsWith('battery') || normalized.startsWith('warranty')) {
      aliases.push('batterywarranty', 'warranty', 'battery');
    } else if (normalized.startsWith('customer')) {
      aliases.push('customer', 'customers');
    } else if (normalized.startsWith('homeslide') || normalized.startsWith('slide')) {
      aliases.push('homeslide', 'slide', 'slides');
    } else if (normalized.startsWith('accessrequest')) {
      aliases.push('accessrequest', 'accessrequests');
    }
    return Array.from(new Set(aliases.map((alias) => this.normalizeEntity(alias))));
  }

  private handleIncomingEvent(event: RealtimeEvent) {
    if (!event?.entity) return;

    const normalized = this.normalizeEntity(event.entity);
    if (normalized === 'heartbeat' || normalized === 'globalfocus' || normalized === 'ping') return;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: event }));
    }

    const notified = new Set<Listener>();
    this.getEntityAliases(normalized).forEach((alias) => {
      this.listeners.get(alias)?.forEach((listener) => {
        if (notified.has(listener)) return;
        notified.add(listener);
        try { listener(event); } catch (error) { console.warn('[REALTIME LISTENER ERROR]', error); }
      });
    });

    this.listeners.get('*')?.forEach((listener) => {
      if (notified.has(listener)) return;
      notified.add(listener);
      try { listener(event); } catch (error) { console.warn('[REALTIME LISTENER ERROR]', error); }
    });

    this.globalListeners.forEach((listener) => {
      if (notified.has(listener)) return;
      notified.add(listener);
      try { listener(event); } catch (error) { console.warn('[REALTIME LISTENER ERROR]', error); }
    });
  }

  public subscribe(entities: string | string[], callback: Listener): () => void {
    const list = Array.isArray(entities) ? entities : [entities];
    const normalizedList = list.map((entity) => this.normalizeEntity(entity));

    normalizedList.forEach((entity) => {
      if (!this.listeners.has(entity)) this.listeners.set(entity, new Set());
      this.listeners.get(entity)!.add(callback);
    });

    return () => {
      normalizedList.forEach((entity) => {
        const set = this.listeners.get(entity);
        if (!set) return;
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(entity);
      });
    };
  }

  public subscribeAll(callback: Listener): () => void {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }
}

export const realtimeService = new RealtimeService();

export function useRealtimeSync(
  entities: string | string[],
  onEventOrRefetch?: (event: RealtimeEvent) => void,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(realtimeService.getStatus());
  const callbackRef = useRef(onEventOrRefetch);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entityKey = Array.isArray(entities) ? entities.slice().sort().join(',') : String(entities);

  useEffect(() => {
    callbackRef.current = onEventOrRefetch;
  }, [onEventOrRefetch]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribeStatus = realtimeService.onStatusChange(setConnectionStatus);
    const unsubscribeEvents = realtimeService.subscribe(entities, (event) => {
      if (!callbackRef.current) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => callbackRef.current?.(event), 100);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [entityKey, enabled]);

  return { connectionStatus };
}
