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

class RealtimeService {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private globalListeners: Set<Listener> = new Set();
  private statusListeners: Set<(status: 'connected' | 'connecting' | 'disconnected') => void> = new Set();
  private currentStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private supabaseConnected = false;
  private sseConnected = false;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 60000;
  private lastActivityTime = Date.now();
  private healthCheckInterval: any = null;
  private supabaseChannel: any = null;
  private isConnecting = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initNetworkListeners();
      this.initSupabaseRealtimeListeners();
      this.connect();
      this.startHealthCheck();
    }
  }

  private updateAggregateStatus() {
    if (this.supabaseConnected || this.sseConnected) {
      this.setStatus('connected');
    } else {
      this.setStatus('connecting');
    }
  }

  private initSupabaseRealtimeListeners() {
    try {
      if (!supabase) return;

      this.supabaseChannel = supabase.channel('mts_app_db_changes', {
        config: {
          broadcast: { self: true },
        },
      });

      // Listen to native postgres table changes if enabled on supabase backend
      const tablesToTrack = ['Repair', 'repair', 'Customer', 'customer', 'TechnicianNote', 'techniciannote', 'RepairLog', 'repairlog', 'Notification', 'notification'];

      tablesToTrack.forEach((tableName) => {
        this.supabaseChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload: any) => {
            const eventType = payload.eventType;
            const actionMap: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
              INSERT: 'CREATE',
              UPDATE: 'UPDATE',
              DELETE: 'DELETE'
            };
            const mappedAction = actionMap[eventType] || 'UPDATE';
            const recordData = payload.new || payload.old || {};
            const recordId = recordData.id || payload.old?.id;

            this.handleIncomingEvent({
              entity: tableName.toLowerCase(),
              action: mappedAction,
              id: recordId,
              data: recordData,
              timestamp: Date.now()
            });
          }
        );
      });

      this.supabaseChannel
        .on('broadcast', { event: '*' }, ({ payload }: { payload: any }) => {
          if (payload && payload.entity) {
            this.handleIncomingEvent(payload);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            this.supabaseConnected = true;
            this.updateAggregateStatus();
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.supabaseConnected = false;
            this.updateAggregateStatus();
          }
        });
    } catch (e) {
      console.warn('[REALTIME] Supabase Realtime listeners initialization error:', e);
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const mtsStorage = localStorage.getItem('mts-auth-storage');
      if (mtsStorage) {
        const parsed = JSON.parse(mtsStorage);
        if (parsed?.state?.token) return parsed.state.token;
      }
      const directToken = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (directToken) return directToken;
    } catch (e) { }
    return null;
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
    } else if (normalized.startsWith('notification')) {
      aliases.push('notification', 'notifications');
    }
    return Array.from(new Set(aliases.map(a => this.normalizeEntity(a))));
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    // Silent connection health monitor — does NOT emit fake data events to listeners
    this.healthCheckInterval = setInterval(() => {
      if (this.currentStatus === 'disconnected' && !this.isConnecting) {
        this.connect();
      }
    }, 30000);
  }

  public getStatus() {
    return this.currentStatus;
  }

  private setStatus(status: 'connected' | 'connecting' | 'disconnected') {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.statusListeners.forEach((listener) => {
        try { listener(status); } catch (e) { }
      });
    }
  }

  public onStatusChange(listener: (status: 'connected' | 'connecting' | 'disconnected') => void) {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => { this.statusListeners.delete(listener); };
  }

  public connect() {
    if (typeof window === 'undefined' || this.isConnecting) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) { }
      this.eventSource = null;
    }

    this.isConnecting = true;
    this.setStatus('connecting');

    try {
      const token = this.getAuthToken();
      const queryParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const url = `/api/events${queryParam}`;

      const es = new EventSource(url, { withCredentials: true });
      this.eventSource = es;
      this.lastActivityTime = Date.now();

      es.addEventListener('connected', () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.sseConnected = true;
        this.updateAggregateStatus();
      });

      es.addEventListener('message', (event) => {
        this.lastActivityTime = Date.now();
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          if (parsed && parsed.entity) {
            this.handleIncomingEvent(parsed);
          }
        } catch (err) { }
      });

      es.onerror = () => {
        this.isConnecting = false;
        this.sseConnected = false;
        this.updateAggregateStatus();
        try { es.close(); } catch (e) { }
        this.eventSource = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      this.isConnecting = false;
      this.sseConnected = false;
      this.updateAggregateStatus();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(1.3, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      this.reconnectAttempts = 0;
      this.connect();
    });

    window.addEventListener('offline', () => {
      this.setStatus('disconnected');
    });
  }

  private handleIncomingEvent(event: RealtimeEvent) {
    if (!event || !event.entity) return;

    const incomingRaw = (event.entity || '').toLowerCase();
    const incomingNormalized = this.normalizeEntity(incomingRaw);

    // Ignore internal heartbeat/focus events from triggering data updates
    if (incomingNormalized === 'heartbeat' || incomingNormalized === 'globalfocus' || incomingNormalized === 'ping') {
      return;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: event }));
    }

    const matchedAliases = this.getEntityAliases(incomingNormalized);
    const notifiedListeners = new Set<Listener>();

    // Notify listeners subscribed to this specific entity or its aliases
    matchedAliases.forEach((alias) => {
      const entitySet = this.listeners.get(alias);
      if (entitySet) {
        entitySet.forEach((listener) => {
          if (!notifiedListeners.has(listener)) {
            notifiedListeners.add(listener);
            try { listener(event); } catch (err) { console.warn('[REALTIME LISTENER ERROR]', err); }
          }
        });
      }
    });

    // Notify wildcard listeners
    const wildcardSet = this.listeners.get('*');
    if (wildcardSet) {
      wildcardSet.forEach((listener) => {
        if (!notifiedListeners.has(listener)) {
          notifiedListeners.add(listener);
          try { listener(event); } catch (err) { console.warn('[REALTIME LISTENER ERROR]', err); }
        }
      });
    }

    // Global listeners
    this.globalListeners.forEach((listener) => {
      if (!notifiedListeners.has(listener)) {
        notifiedListeners.add(listener);
        try { listener(event); } catch (err) { console.warn('[REALTIME LISTENER ERROR]', err); }
      }
    });
  }

  public subscribe(entities: string | string[], callback: Listener): () => void {
    const list = Array.isArray(entities) ? entities : [entities];
    const normalizedList = list.map((e) => this.normalizeEntity(e));

    normalizedList.forEach((entity) => {
      if (!this.listeners.has(entity)) {
        this.listeners.set(entity, new Set());
      }
      this.listeners.get(entity)!.add(callback);
    });

    return () => {
      normalizedList.forEach((entity) => {
        const set = this.listeners.get(entity);
        if (set) {
          set.delete(callback);
          if (set.size === 0) this.listeners.delete(entity);
        }
      });
    };
  }

  public subscribeAll(callback: Listener): () => void {
    this.globalListeners.add(callback);
    return () => { this.globalListeners.delete(callback); };
  }
}

export const realtimeService = new RealtimeService();

export function useRealtimeSync(
  entities: string | string[],
  onEventOrRefetch?: (event: RealtimeEvent) => void,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>(
    realtimeService.getStatus()
  );
  const callbackRef = useRef(onEventOrRefetch);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callbackRef.current = onEventOrRefetch;
  }, [onEventOrRefetch]);

  const entityKey = Array.isArray(entities) ? entities.slice().sort().join(',') : String(entities);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribeStatus = realtimeService.onStatusChange((newStatus) => {
      setConnectionStatus(prev => (prev !== newStatus ? newStatus : prev));
    });

    const unsubscribeEvents = realtimeService.subscribe(entities, (event) => {
      if (!callbackRef.current) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (callbackRef.current) callbackRef.current(event);
      }, 100);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [entityKey, enabled]);

  return { connectionStatus };
}