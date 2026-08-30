// api/_server/services/realtimeSync.ts
import { supabaseAdmin } from '../config/supabase';

export async function broadcastServerChange(entityName: string, action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, data?: any) {
    try {
        const channel = supabaseAdmin.channel('mts_app_db_changes');

        // Ensure channel is joined
        if (channel.state !== 'joined') {
            await channel.subscribe();
        }

        const entityLower = entityName.toLowerCase();

        // Send standard sync/delete broadcast events that your frontend listens to
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

        // Also send a generic db_event for global catchers
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