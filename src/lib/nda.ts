import type { SupabaseClient } from '@supabase/supabase-js'

export type NdaTemplateRecord = {
    id: string
    room_id: string
    title: string
    body: string
    version: number
    template_hash: string
}

export async function fetchActiveNdaTemplate(
    supabase: SupabaseClient,
    roomId: string
): Promise<NdaTemplateRecord | null> {
    const { data, error } = await supabase
        .from('nda_templates')
        .select('id, room_id, title, body, version, template_hash')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .maybeSingle()

    if (error || !data) {
        return null
    }

    return data as NdaTemplateRecord
}

export async function hasViewerAcceptedNda(
    supabase: SupabaseClient,
    linkId: string,
    viewerEmail: string,
    templateHash: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from('nda_acceptances')
        .select('id')
        .eq('link_id', linkId)
        .eq('viewer_email', viewerEmail)
        .eq('template_hash', templateHash)
        .limit(1)
        .maybeSingle()

    if (error) {
        return false
    }

    return Boolean(data)
}
