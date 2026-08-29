import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeEvent {
  entity: string; // 'repair' | 'user' | 'technicianNote' | 'repairLog' | 'payment' | 'accessRequest' | 'product' | 'repairPrice' | 'homeSlide' | 'session' | 'notification' | 'auditLog';
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

      this.supabaseChannel = supabase.channel('mts_app_realtime', {
        config: {
          broadcast: { self: false }
        }
      });

      this.supabaseChannel
        .on('broadcast', { event: 'db_event' }, ({ payload }: { payload: RealtimeEvent }) => {
          if (payload && payload.entity) {
            this.handleIncomingEvent(payload);
          }
        })
        .on('broadcast', { event: 'repair_sync' }, ({ payload }: { payload: any }) => {
          if (payload?.id) {
            this.handleIncomingEvent({
              entity: 'repair',
              action: 'UPDATE',
              id: payload.id,
              data: payload,
              timestamp: Date.now()
            });
          }
        })
        .on('broadcast', { event: 'repair_delete' }, ({ payload }: { payload: any }) => {
          if (payload?.id) {
            this.handleIncomingEvent({
              entity: 'repair',
              action: 'DELETE',
              id: payload.id,
              timestamp: Date.now()
            });
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            this.supabaseConnected = true;
            this.updateAggregateStatus();
            console.log('[REALTIME] Connected to Supabase Realtime Channel');
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
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        if (parsed?.state?.token) return parsed.state.token;
      }
      const directToken = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (directToken) return directToken;
    } catch (e) {
      // ignore parsing errors
    }
    return null;
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      this.reconnectAttempts = 0;
      this.connect();
    });

    window.addEventListener('offline', () => {
      this.setStatus('disconnected');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const isStale = Date.now() - this.lastActivityTime > 120000;
        if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED || isStale) {
          this.connect();
        }
      }
    });

    window.addEventListener('focus', () => {
      const isStale = Date.now() - this.lastActivityTime > 120000;
      if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED || isStale) {
        this.connect();
      }
    });
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.healthCheckInterval = setInterval(() => {
      if (this.currentStatus === 'connected' && Date.now() - this.lastActivityTime > 90000) {
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
        try {
          listener(status);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  public onStatusChange(listener: (status: 'connected' | 'connecting' | 'disconnected') => void) {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public connect() {
    if (typeof window === 'undefined' || this.isConnecting) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {
        // ignore
      }
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
        this.lastActivityTime = Date.now();
        this.sseConnected = true;
        this.updateAggregateStatus();
      });

      es.addEventListener('ping', () => {
        this.lastActivityTime = Date.now();
      });

      es.addEventListener('message', (event) => {
        this.lastActivityTime = Date.now();
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          // Prevent connection handshake events from triggering component refetches
          if (parsed && parsed.entity && parsed.action !== 'SYNC') {
            this.handleIncomingEvent(parsed);
          }
        } catch (err) {
          // ignore non-JSON keep-alives
        }
      });

      es.onerror = () => {
        this.isConnecting = false;
        this.sseConnected = false;
        this.updateAggregateStatus();
        try {
          es.close();
        } catch (e) {
          // ignore
        }
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

  private handleIncomingEvent(event: RealtimeEvent) {
    // Ignore internal transport events
    if (!event || !event.entity || event.entity === 'sync' || event.entity === 'ping') {
      return;
    }

    const rawEntity = (event.entity || '').toLowerCase();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: event }));
    }

    const targetEntities = new Set<string>();
    targetEntities.add(rawEntity);

    if (['techniciannote', 'repairlog', 'payment'].includes(rawEntity)) {
      targetEntities.add('repair');
    }
    if (['accessrequest', 'approveddevice', 'session'].includes(rawEntity)) {
      targetEntities.add('user');
      targetEntities.add('accessrequest');
    }
    if (['batterywarranty', 'batterywarrantyclaim'].includes(rawEntity)) {
      targetEntities.add('batterywarranty');
      targetEntities.add('batterywarrantyclaim');
    }

    targetEntities.forEach((ent) => {
      const entitySet = this.listeners.get(ent);
      if (entitySet) {
        entitySet.forEach((listener) => {
          try {
            listener(event);
          } catch (err) {
            console.error('[REALTIME LISTENER ERROR]', err);
          }
        });
      }
    });

    this.globalListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[REALTIME GLOBAL ERROR]', err);
      }
    });
  }

  public subscribe(entities: string | string[], callback: Listener): () => void {
    const list = Array.isArray(entities) ? entities : [entities];
    const normalizedList = list.map((e) => e.toLowerCase());

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
          if (set.size === 0) {
            this.listeners.delete(entity);
          }
        }
      });
    };
  }

  public subscribeAll(callback: Listener): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }
}

export const realtimeService = new RealtimeService();

/**
 * Custom React Hook for Real-time Database Synchronization.
 * Debounces incoming entity updates so rapid successive mutations don't trigger cascading refetches.
 */
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

      // Debounce rapid bursts across identical tables
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (callbackRef.current) {
          callbackRef.current(event);
        }
      }, 300);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [entityKey, enabled]);

  return { connectionStatus };
}