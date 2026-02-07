import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from './actions'
import { Button } from '@/components/ui/button'
import { CreateRoomForm } from '@/components/CreateRoomForm'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const { data: rooms } = await supabase
        .from('data_rooms')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

    return (
        <div className="flex flex-col min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto w-full">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-gray-500">Welcome, {user.email}</p>
                </div>
                <form action={logout}>
                    <Button variant="outline">Sign Out</Button>
                </form>
            </div>

            <div className="max-w-4xl mx-auto w-full space-y-8">
                <CreateRoomForm />

                <div className="grid gap-4">
                    {rooms?.map((room) => (
                        <Link key={room.id} href={`/dashboard/rooms/${room.id}`}>
                            <Card className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle>{room.name}</CardTitle>
                                    <CardDescription>Created {new Date(room.created_at).toLocaleDateString()}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                    {rooms?.length === 0 && (
                        <p className="text-center text-gray-500 py-8">No data rooms found. Create one to get started.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
