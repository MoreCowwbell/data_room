import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createModel } from '@/lib/ai/provider'
import { createRoomTools } from '@/lib/ai/tools'
import { getSystemPrompt } from '@/lib/ai/system-prompt'
import { getApiKey } from '@/lib/ai/keys'
import type { AiProvider } from '@/lib/ai/provider'

export async function POST(request: Request) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { messages, roomId, provider } = body as {
        messages: UIMessage[]
        roomId: string
        provider: AiProvider
    }

    if (!roomId || !provider || !messages) {
        return new Response('Missing required fields', { status: 400 })
    }

    // Verify room access
    const { data: room } = await supabase
        .from('data_rooms')
        .select('id, name, owner_id')
        .eq('id', roomId)
        .single()

    if (!room) {
        return new Response('Room not found', { status: 404 })
    }

    const isOwner = room.owner_id === user.id
    const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!isOwner && !membership) {
        return new Response('Unauthorized', { status: 403 })
    }

    // Verify consent
    const { data: consent } = await supabase
        .from('ai_consent')
        .select('id')
        .eq('user_id', user.id)
        .eq('room_id', roomId)
        .maybeSingle()

    if (!consent) {
        return new Response('AI consent required', { status: 403 })
    }

    // Get API key
    const apiKey = await getApiKey(user.id, roomId, provider)
    if (!apiKey) {
        return new Response(`No ${provider} API key configured`, { status: 400 })
    }

    const model = createModel(provider, apiKey)
    const tools = createRoomTools(supabase, roomId)
    const systemPrompt = getSystemPrompt(room.name)

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(5),
        onFinish: async ({ usage }) => {
            // Log usage (fire-and-forget)
            await supabase.from('ai_usage_logs').insert({
                user_id: user.id,
                room_id: roomId,
                provider,
                model: model.modelId,
                prompt_tokens: usage.inputTokens ?? 0,
                completion_tokens: usage.outputTokens ?? 0,
                total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
            }).then(() => {}, () => {})
        },
    })

    return result.toUIMessageStreamResponse()
}
