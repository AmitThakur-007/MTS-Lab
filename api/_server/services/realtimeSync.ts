// api/_server/services/realtimeSync.ts
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

export async function broadcastServerChange(entityName: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
    try {
        const channel = getOrCreateServerChannel();
        if (!channel) return;

        const entityLower = entityName.toLowerCase();
        const payload = {
            entity: entityLower,
            action,
            id: String(id),
            data,
            timestamp: Date.now()
        };

        // Send broadcast directly
        await channel.send({
            type: 'broadcast',
            event: 'db_event',
            payload
        });
        console.log(`[SERVER REALTIME BROADCAST] Sent ${action} for ${entityLower} (${id})`);
    } catch (err) {
        console.warn('[SERVER REALTIME BROADCAST WARNING] Failed to broadcast change:', err);
    }
}
