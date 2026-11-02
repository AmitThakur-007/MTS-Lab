// api/_server/services/realtimeSync.ts
import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export interface RealtimeServerEvent {
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  id: string;
  data?: any;
  timestamp: number;
}

const MAX_EVENT_BUFFER = 200;
const recentEventsBuffer: RealtimeServerEvent[] = [];

let serverBroadcastChannel: any = null;
let isChannelSubscribing = false;

function getOrCreateServerChannel() {
  if (!serverBroadcastChannel && supabaseAdmin) {
    try {
      serverBroadcastChannel = supabaseAdmin.channel('mts_app_db_changes');
      if (serverBroadcastChannel && !isChannelSubscribing) {
        isChannelSubscribing = true;
        serverBroadcastChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('[SERVER REALTIME] Connected to broadcast channel mts_app_db_changes');
          }
        });
      }
    } catch (e) {
      console.warn('[SERVER REALTIME] Error initializing channel:', e);
    }
  }
  return serverBroadcastChannel;
}

/**
 * Register an active SSE client connection (no-op in serverless environment to prevent memory leaks)
 */
export function registerSSEClient(_id: string, _res: Response, _user?: { id?: string; role?: string } | null): () => void {
  return () => {};
}

/**
 * Get recent events broadcasted since a given timestamp (for client reconnect / offline recovery)
 */
export function getRecentEvents(sinceTimestamp: number = 0): RealtimeServerEvent[] {
  if (!sinceTimestamp || isNaN(sinceTimestamp)) {
    return recentEventsBuffer.slice(-50);
  }
  return recentEventsBuffer.filter((e) => e.timestamp > sinceTimestamp);
}

/**
 * Broadcast change to Supabase realtime channel and append to in-memory recovery buffer
 */
export async function broadcastServerChange(entityName: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
  const entityLower = entityName.toLowerCase();
  const payload: RealtimeServerEvent = {
    entity: entityLower,
    action,
    id: String(id),
    data,
    timestamp: Date.now(),
  };

  // Add to in-memory sliding buffer for offline/reconnect catching up
  recentEventsBuffer.push(payload);
  if (recentEventsBuffer.length > MAX_EVENT_BUFFER) {
    recentEventsBuffer.shift();
  }

  // Broadcast to Supabase Realtime channel
  try {
    const channel = getOrCreateServerChannel();
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'db_event',
        payload,
      });
    }
  } catch (err) {
    // Non-fatal if Supabase channel is disconnected
  }
}



