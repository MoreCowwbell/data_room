import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from './actions'
import { Button } from '@/components/ui/button'
import { CreateRoomForm } from '@/components/CreateRoomForm'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function DashboardPage() {
    const supabase = await createClient()
    type RoomRow = {
        id: string
        name: string
        created_at: string
    }

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const { data: rooms, error: roomsError } = await supabase
        .from('data_rooms')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

    if (roomsError) {
        console.error('Dashboard rooms query error:', roomsError, '| user.id:', user.id)
    }

    const { data: memberRows, error: memberError } = await supabase
        .from('team_members')
        .select('room_id')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])

    if (memberError) {
        console.error('Dashboard team_members query error:', memberError, '| user.id:', user.id)
    }

    const memberRoomIds = (memberRows ?? []).map((row) => row.room_id)
    const { data: memberRooms } = memberRoomIds.length > 0
        ? await supabase
            .from('data_rooms')
            .select('*')
            .in('id', memberRoomIds)
            .order('created_at', { ascending: false })
        : { data: [] as RoomRow[] }

    const roomMap = new Map<string, RoomRow>()
    for (const room of rooms ?? []) {
        roomMap.set(room.id, room)
    }
    for (const room of memberRooms ?? []) {
        roomMap.set(room.id, room)
    }
    const accessibleRooms = [...roomMap.values()]

    return (
        <div className="flex min-h-screen flex-col bg-background p-8 text-foreground">
            <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto w-full">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome, {user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <form action={logout}>
                        <Button variant="outline">Sign Out</Button>
                    </form>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full space-y-8">
                <CreateRoomForm />

                <div className="grid gap-4">
                    {accessibleRooms.map((room) => (
                        <Link key={room.id} href={`/dashboard/rooms/${room.id}`}>
                            <Card className="cursor-pointer transition-colors hover:bg-muted/40">
                                <CardHeader>
                                    <CardTitle>{room.name}</CardTitle>
                                    <CardDescription>Created {new Date(room.created_at).toLocaleDateString()}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                    {accessibleRooms.length === 0 && (
                        <p className="py-8 text-center text-muted-foreground">No data rooms found. Create one to get started.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
