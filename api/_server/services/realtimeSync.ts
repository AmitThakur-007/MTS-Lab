// api/_server/services/realtimeSync.ts
import { supabaseAdmin } from '../config/supabase';

export async function broadcastServerChange(entityName: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
    try {
        const channel = supabaseAdmin.channel('mts_app_db_changes');

        if (channel.state !== 'joined') {
            await new Promise((resolve) => {
                channel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        resolve(true);
                    }
                });
            });
        }

        const entityLower = entityName.toLowerCase();

        await channel.send({
            type: 'broadcast',
            event: action === 'DELETE' ? `${entityLower}_delete` : `${entityLower}_sync`,
            payload: {
                entity: entityLower,
                action,
                id: String(id),
                ...data,
                timestamp: Date.now()
            }
        });

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

        console.log(`[SERVER REALTIME BROADCAST] Sent ${action} for ${entityLower} (${id})`);
    } catch (err) {
        console.warn('[SERVER REALTIME BROADCAST WARNING] Failed to broadcast change:', err);
    }
}