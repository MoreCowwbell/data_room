import type { SupabaseClient } from '@supabase/supabase-js'

type AuditInput = {
    roomId: string
    actorId?: string | null
    actorType?: 'user' | 'viewer' | 'system'
    action: string
    targetType: string
    targetId?: string | null
    metadata?: Record<string, unknown>
}

export async function writeAuditEvent(supabase: SupabaseClient, input: AuditInput): Promise<void> {
    const { error } = await supabase.from('audit_events').insert({
        room_id: input.roomId,
        actor_id: input.actorId || null,
        actor_type: input.actorType || 'user',
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId || null,
        metadata: input.metadata || {},
        created_at: new Date().toISOString(),
    })

    if (error) {
        console.error('Failed to write audit event:', error.message)
        throw new Error(`Audit event write failed: ${error.message}`)
    }
}
