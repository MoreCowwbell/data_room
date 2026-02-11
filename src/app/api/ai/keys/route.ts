import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveApiKey, listApiKeys, deleteApiKey } from '@/lib/ai/keys'
import type { AiProvider } from '@/lib/ai/provider'

async function getAuthenticatedUser() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user
}

export async function GET(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    if (!roomId) {
        return NextResponse.json({ error: 'roomId required' }, { status: 400 })
    }

    const keys = await listApiKeys(user.id, roomId)
    return NextResponse.json({ keys })
}

export async function POST(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId, provider, apiKey } = (await request.json()) as {
        roomId: string
        provider: AiProvider
        apiKey: string
    }

    if (!roomId || !provider || !apiKey) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['anthropic', 'openai', 'google'].includes(provider)) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    await saveApiKey(user.id, roomId, provider, apiKey)
    return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId, provider } = (await request.json()) as {
        roomId: string
        provider: AiProvider
    }

    if (!roomId || !provider) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await deleteApiKey(user.id, roomId, provider)
    return NextResponse.json({ success: true })
}
