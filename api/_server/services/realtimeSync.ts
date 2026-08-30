// api/_server/services/realtimeSync.ts
import { supabaseAdmin } from '../config/supabase';

export async function broadcastServerChange(entityName: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
    try {
        const channel = supabaseAdmin.channel('mts_app_db_changes');

        // Non-blocking asynchronous broadcast emission
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const entityLower = entityName.toLowerCase();
                await channel.send({
                    type: 'broadcast',
                    event: 'db_event',
                    payload: {
                        entity: entityLower,
                        action,
                        id: String(id),
                        data,
                        timestamp: Date.now()
                    }
                });
                console.log(`[SERVER REALTIME BROADCAST] Successfully sent ${action} for ${entityLower} (${id})`);
            }
        });
    } catch (err) {
        console.warn('[SERVER REALTIME BROADCAST WARNING] Failed to broadcast change:', err);
    }
}