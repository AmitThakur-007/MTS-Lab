// api/_server/services/realtimeSync.ts
import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

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
 * Broadcast change to Supabase realtime channel
 */
export async function broadcastServerChange(entityName: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
  const entityLower = entityName.toLowerCase();
  const payload = {
    entity: entityLower,
    action,
    id: String(id),
    data,
    timestamp: Date.now(),
  };

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


