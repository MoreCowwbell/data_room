import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRoomAccess } from '@/lib/room-access'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params

    const access = await getUserRoomAccess(roomId)
    if (!access) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: folders } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('name', { ascending: true })

    return NextResponse.json({ folders: folders || [] })
}
