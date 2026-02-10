import { createClient } from '@/lib/supabase/server'

export type RoomAccess = {
    roomId: string
    role: 'owner' | 'admin'
}

export async function getUserRoomAccess(roomId: string): Promise<RoomAccess | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    const { data: room } = await supabase
        .from('data_rooms')
        .select('id')
        .eq('id', roomId)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (room) {
        return { roomId: room.id, role: 'owner' }
    }

    const { data: membership } = await supabase
        .from('team_members')
        .select('room_id, role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
        .maybeSingle()

    if (!membership) {
        return null
    }

    return {
        roomId: membership.room_id,
        role: membership.role === 'owner' ? 'owner' : 'admin',
    }
}

export async function getUserAccessibleRoomIds(): Promise<string[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return []
    }

    const [{ data: ownedRooms }, { data: memberships }] = await Promise.all([
        supabase
            .from('data_rooms')
            .select('id')
            .eq('owner_id', user.id),
        supabase
            .from('team_members')
            .select('room_id')
            .eq('user_id', user.id)
            .in('role', ['owner', 'admin']),
    ])

    const ids = new Set<string>()
    for (const room of ownedRooms ?? []) ids.add(room.id)
    for (const member of memberships ?? []) ids.add(member.room_id)
    return [...ids]
}

export async function requireRoomAccess(
    roomId: string,
    allowedRoles: Array<'owner' | 'admin'> = ['owner', 'admin']
): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string; role: 'owner' | 'admin' }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const access = await getUserRoomAccess(roomId)
    if (!access || !allowedRoles.includes(access.role)) {
        throw new Error('Unauthorized')
    }

    return { supabase, userId: user.id, role: access.role }
}
