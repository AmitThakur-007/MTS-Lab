import { useEffect, useState, useRef } from 'react';
import { rtdb } from '@/lib/firebase';
import { API_BASE } from './api';
import { 
  ref as rtdbRef, 
  onValue as rtdbOnValue, 
  onChildAdded as rtdbOnChildAdded,
  onChildChanged as rtdbOnChildChanged, 
  onChildRemoved as rtdbOnChildRemoved 
} from 'firebase/database';

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
  private rtdbConnected = false;
  private sseConnected = false;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 6000;
  private lastActivityTime = Date.now();
  private healthCheckInterval: any = null;
  private rtdbUnsubscribers: (() => void)[] = [];
  private initialRtdbLoaded = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initNetworkListeners();
      this.initFirebaseRtdbListeners();
      this.connect();
      this.startHealthCheck();
    }
  }

  private updateAggregateStatus() {
    if (this.rtdbConnected || this.sseConnected) {
      this.setStatus('connected');
    } else {
      this.setStatus('connecting');
    }
  }

  private initFirebaseRtdbListeners() {
    try {
      if (!rtdb) return;

      // 1. Listen to Firebase Realtime Database connection status (/.info/connected)
      const connectedRef = rtdbRef(rtdb, '.info/connected');
      const unsubConnected = rtdbOnValue(connectedRef, (snapshot) => {
        const isConnected = Boolean(snapshot.val());
        this.rtdbConnected = isConnected;
        this.updateAggregateStatus();
        if (isConnected) {
          console.log('[REALTIME] Connected to Firebase RTDB (mts-lab-eb8d2-default-rtdb)');
        }
      });

      // 2. Helper to register entity listeners on RTDB
      const registerEntityListener = (collectionName: string, entityType: string) => {
        const collectionRef = rtdbRef(rtdb, collectionName);
        let initialLoaded = false;

        const unsubChanged = rtdbOnChildChanged(collectionRef, (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            this.handleIncomingEvent({
              entity: entityType,
              action: 'UPDATE',
              id: snapshot.key || val?.id || undefined,
              data: val,
              timestamp: Date.now()
            });
          }
        }, (err) => {
          // Silent permission guard
        });

        const unsubAdded = rtdbOnChildAdded(collectionRef, (snapshot) => {
          if (!initialLoaded) return;
          if (snapshot.exists()) {
            const val = snapshot.val();
            this.handleIncomingEvent({
              entity: entityType,
              action: 'CREATE',
              id: snapshot.key || val?.id || undefined,
              data: val,
              timestamp: Date.now()
            });
          }
        }, (err) => {
          // Silent permission guard
        });

        const unsubRemoved = rtdbOnChildRemoved(collectionRef, (snapshot) => {
          if (snapshot.exists()) {
            this.handleIncomingEvent({
              entity: entityType,
              action: 'DELETE',
              id: snapshot.key || undefined,
              timestamp: Date.now()
            });
          }
        }, (err) => {
          // Silent permission guard
        });

        const unsubInitial = rtdbOnValue(collectionRef, () => {
          initialLoaded = true;
        }, (err) => {
          initialLoaded = true;
        }, { onlyOnce: true });

        this.rtdbUnsubscribers.push(unsubChanged, unsubAdded, unsubRemoved, unsubInitial);
      };

      // Register primary collections on Firebase RTDB
      registerEntityListener('customers', 'customer');
      registerEntityListener('repairs', 'repair');
      registerEntityListener('inventory', 'inventory');
      registerEntityListener('inventoryTransactions', 'inventoryTransaction');
      registerEntityListener('users', 'user');
      registerEntityListener('accessRequests', 'accessRequest');
      registerEntityListener('repairPrices', 'repairPrice');
      registerEntityListener('notifications', 'notification');
      registerEntityListener('batteryWarranties', 'batteryWarranty');
      registerEntityListener('batteryWarrantyClaims', 'batteryWarrantyClaim');
      registerEntityListener('couriers', 'courier');
      registerEntityListener('attendances', 'attendance');
      registerEntityListener('damageRecords', 'damageRecord');

      // 3. Listen to root sync node on RTDB (/syncTimestamp)
      const syncRef = rtdbRef(rtdb, 'syncTimestamp');
      const unsubSync = rtdbOnValue(syncRef, (snapshot) => {
        if (snapshot.exists()) {
          this.handleIncomingEvent({
            entity: 'sync',
            action: 'SYNC',
            timestamp: snapshot.val() || Date.now()
          });
        }
      });

      this.rtdbUnsubscribers.push(
        unsubConnected,
        unsubSync
      );
    } catch (e) {
      console.warn('[REALTIME] Firebase RTDB listeners initialization error:', e);
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Check primary mts-auth-storage
      const mtsStorage = localStorage.getItem('mts-auth-storage');
      if (mtsStorage) {
        const parsed = JSON.parse(mtsStorage);
        if (parsed?.state?.token) return parsed.state.token;
      }
      // 2. Check fallback auth-storage
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        if (parsed?.state?.token) return parsed.state.token;
      }
      // 3. Check direct token keys
      const directToken = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (directToken) return directToken;
    } catch (e) {
      // ignore
    }
    return null;
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[REALTIME] Network restored (online). Re-establishing central stream...');
      this.reconnectAttempts = 0;
      this.connect();
    });

    window.addEventListener('offline', () => {
      console.log('[REALTIME] Network offline');
      this.setStatus('disconnected');
    });

    // Mobile sleep/wake and tab focus listeners
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const isStale = Date.now() - this.lastActivityTime > 30000;
        if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED || isStale) {
          console.log('[REALTIME] App became visible / foreground. Syncing with central database...');
          this.connect();
        }
      }
    });

    window.addEventListener('focus', () => {
      const isStale = Date.now() - this.lastActivityTime > 30000;
      if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED || isStale) {
        this.connect();
      }
    });
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.healthCheckInterval = setInterval(() => {
      // If connected but no activity or ping for 60s, reconnect stream
      if (this.currentStatus === 'connected' && Date.now() - this.lastActivityTime > 60000) {
        console.log('[REALTIME] Heartbeat timeout detected. Reconnecting stream...');
        this.connect();
      }
    }, 20000);
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
    if (typeof window === 'undefined') return;

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

    this.setStatus('connecting');

    try {
      const token = this.getAuthToken();
      const queryParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const url = `${API_BASE}/events${queryParam}`;

      const es = new EventSource(url, { withCredentials: true });
      this.eventSource = es;
      this.lastActivityTime = Date.now();

      es.addEventListener('connected', () => {
        const wasReconnecting = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        this.lastActivityTime = Date.now();
        this.sseConnected = true;
        this.updateAggregateStatus();
        console.log('[REALTIME] Connected to MTS Central Real-Time Event Hub');
        
        // Only broadcast sync if recovering from a dropped connection
        if (wasReconnecting) {
          this.handleIncomingEvent({
            entity: 'sync',
            action: 'SYNC',
            timestamp: Date.now()
          });
        }
      });

      es.addEventListener('ping', () => {
        this.lastActivityTime = Date.now();
      });

      es.addEventListener('message', (event) => {
        this.lastActivityTime = Date.now();
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          this.handleIncomingEvent(parsed);
        } catch (err) {
          console.warn('[REALTIME PARSE ERROR]', err, event.data);
        }
      });

      es.onerror = () => {
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
      console.warn('[REALTIME INIT ERROR]', err);
      this.sseConnected = false;
      this.updateAggregateStatus();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    // If Firebase RTDB is natively connected, SSE is secondary fallback — use longer backoff to avoid spamming serverless
    const delay = this.rtdbConnected 
      ? Math.min(30000 + (this.reconnectAttempts * 5000), 120000)
      : Math.min(1000 * Math.pow(1.4, this.reconnectAttempts), this.maxReconnectDelay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private pendingEventDebounceTimers: Map<string, any> = new Map();

  private handleIncomingEvent(event: RealtimeEvent) {
    const rawEntity = (event.entity || '').toLowerCase();

    // Broadcast on window for any global listener
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mts-realtime-update', { detail: event }));
    }

    // Determine target entity buckets (including relational aliases)
    const targetEntities = new Set<string>();
    targetEntities.add(rawEntity);
    targetEntities.add('*');

    // Cross-entity cascading for relational data consistency:
    // If a repairLog or technicianNote or payment occurs, also notify 'repair' subscribers
    if (['techniciannote', 'repairlog', 'payment'].includes(rawEntity)) {
      targetEntities.add('repair');
    }
    // If accessRequest, approvedDevice or session occurs, also notify 'user' subscribers
    if (['accessrequest', 'approveddevice', 'session'].includes(rawEntity)) {
      targetEntities.add('user');
      targetEntities.add('accessrequest');
    }
    // If batteryWarranty or batteryWarrantyClaim occurs, notify battery warranty subscribers
    if (['batterywarranty', 'batterywarrantyclaim'].includes(rawEntity)) {
      targetEntities.add('batterywarranty');
      targetEntities.add('batterywarrantyclaim');
    }

    targetEntities.forEach((ent) => {
      const timerKey = `ent_${ent}`;
      if (this.pendingEventDebounceTimers.has(timerKey)) {
        clearTimeout(this.pendingEventDebounceTimers.get(timerKey));
      }

      const timer = setTimeout(() => {
        this.pendingEventDebounceTimers.delete(timerKey);
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
      }, 150);

      this.pendingEventDebounceTimers.set(timerKey, timer);
    });

    // Global listeners
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
 * Automatically triggers the callback whenever any matching database entity is created, updated, or deleted.
 * Also provides the live real-time connection status across desktop, tablet, and mobile devices.
 */
export function useRealtimeSync(
  entities: string | string[],
  onEventOrRefetch?: (event: RealtimeEvent) => void,
  options: { enabled?: boolean; pollingFallbackInterval?: number } = {}
) {
  const { enabled = true, pollingFallbackInterval = 25000 } = options;
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>(
    realtimeService.getStatus()
  );
  const callbackRef = useRef(onEventOrRefetch);

  useEffect(() => {
    callbackRef.current = onEventOrRefetch;
  }, [onEventOrRefetch]);

  const entityKey = Array.isArray(entities) ? entities.slice().sort().join(',') : String(entities);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribeStatus = realtimeService.onStatusChange((newStatus) => {
      setConnectionStatus(prev => prev !== newStatus ? newStatus : prev);
    });

    const unsubscribeEvents = realtimeService.subscribe(entities, (event) => {
      if (callbackRef.current) {
        callbackRef.current(event);
      }
    });

    // Background resilience fallback: if disconnected or in sleep state, poll periodically
    let interval: any = null;
    if (pollingFallbackInterval > 0) {
      interval = setInterval(() => {
        if (realtimeService.getStatus() !== 'connected' && callbackRef.current) {
          callbackRef.current({
            entity: 'polling',
            action: 'UPDATE',
            timestamp: Date.now()
          });
        }
      }, pollingFallbackInterval);
    }

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      if (interval) clearInterval(interval);
    };
  }, [entityKey, enabled, pollingFallbackInterval]);

  return { connectionStatus };
}
