import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    if (!roomId) {
        return NextResponse.json({ error: 'roomId required' }, { status: 400 })
    }

    const { data: consent } = await supabase
        .from('ai_consent')
        .select('id, consented_at')
        .eq('user_id', user.id)
        .eq('room_id', roomId)
        .maybeSingle()

    return NextResponse.json({ consented: !!consent, consentedAt: consent?.consented_at ?? null })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = (await request.json()) as { roomId: string }
    if (!roomId) {
        return NextResponse.json({ error: 'roomId required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    const { error } = await supabase.from('ai_consent').upsert(
        {
            user_id: user.id,
            room_id: roomId,
            consented_at: new Date().toISOString(),
            ip_address: ip,
        },
        { onConflict: 'user_id,room_id' }
    )

    if (error) {
        return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
