import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this room (owner or team member)
    const { data: room } = await supabase
        .from('data_rooms')
        .select('id')
        .eq('id', roomId)
        .maybeSingle()

    if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: folders } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('name', { ascending: true })

    return NextResponse.json({ folders: folders || [] })
}
