// api/_server/services/realtimeSync.ts
import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

interface SSEClient {
  id: string;
  res: Response;
  userId?: string | null;
  role?: string | null;
}

const activeSSEClients = new Map<string, SSEClient>();

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
 * Register an active SSE client connection
 */
export function registerSSEClient(id: string, res: Response, user?: { id?: string; role?: string } | null): () => void {
  activeSSEClients.set(id, {
    id,
    res,
    userId: user?.id || null,
    role: user?.role || null,
  });

  return () => {
    activeSSEClients.delete(id);
  };
}

/**
 * Broadcast change to Supabase realtime channel and all connected SSE clients
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

  // 1. Direct SSE broadcast to all active clients
  const sseData = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  activeSSEClients.forEach((client, clientId) => {
    try {
      // If notification, target recipient / role if specified
      if (entityLower === 'notification' && data) {
        const notifUserId = data.userId;
        const notifRole = data.targetRole;

        // Skip if notification is private and client does not match
        if (notifUserId && client.userId && client.userId !== notifUserId) {
          return;
        }
        if (notifRole && client.role && client.role !== notifRole && client.role !== 'SUPER_ADMIN') {
          return;
        }
      }

      client.res.write(sseData);
    } catch (err) {
      activeSSEClients.delete(clientId);
    }
  });

  // 2. Broadcast to Supabase Realtime channel if available
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

