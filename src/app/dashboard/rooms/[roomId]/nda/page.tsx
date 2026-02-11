import { createClient } from '@/lib/supabase/server'
import { getUserRoomAccess } from '@/lib/room-access'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { NdaTemplateForm } from '@/components/NdaTemplateForm'

interface NdaPageProps {
    params: Promise<{ roomId: string }>
}

export default async function NdaPage({ params }: NdaPageProps) {
    const supabase = await createClient()
    const { roomId } = await params

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const access = await getUserRoomAccess(roomId)
    if (!access) {
        return notFound()
    }

    const [{ data: room }, { data: ndaTemplate }] = await Promise.all([
        supabase
            .from('data_rooms')
            .select('id, name')
            .eq('id', roomId)
            .maybeSingle(),
        supabase
            .from('nda_templates')
            .select('title, body, version')
            .eq('room_id', roomId)
            .eq('is_active', true)
            .maybeSingle(),
    ])

    if (!room) {
        return notFound()
    }

    return (
        <div className="min-h-screen p-8 bg-background text-foreground">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">NDA Template</h1>
                        <p className="text-sm text-muted-foreground">{room.name}</p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href={`/dashboard/rooms/${roomId}`}>Back to Room</Link>
                    </Button>
                </div>

                <NdaTemplateForm
                    roomId={roomId}
                    initialTitle={ndaTemplate?.title}
                    initialBody={ndaTemplate?.body}
                    version={ndaTemplate?.version}
                />
            </div>
        </div>
    )
}
