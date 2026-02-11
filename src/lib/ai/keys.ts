import { createClient } from '@/lib/supabase/server'
import type { AiProvider } from './provider'

/**
 * Simple key obfuscation using base64 encoding.
 * In production with Cloudflare/AWS, replace with Supabase Vault or AWS KMS.
 */
function encryptKey(apiKey: string): string {
    return Buffer.from(apiKey).toString('base64')
}

function decryptKey(encrypted: string): string {
    return Buffer.from(encrypted, 'base64').toString('utf-8')
}

function getKeyHint(apiKey: string): string {
    return apiKey.slice(-4)
}

export async function saveApiKey(
    userId: string,
    roomId: string,
    provider: AiProvider,
    apiKey: string
): Promise<void> {
    const supabase = await createClient()
    const encrypted = encryptKey(apiKey)
    const hint = getKeyHint(apiKey)

    const { error } = await supabase
        .from('ai_api_keys')
        .upsert(
            {
                user_id: userId,
                room_id: roomId,
                provider,
                encrypted_key: encrypted,
                key_hint: hint,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,room_id,provider' }
        )

    if (error) {
        throw new Error(`Failed to save API key: ${error.message}`)
    }
}

export async function getApiKey(
    userId: string,
    roomId: string,
    provider: AiProvider
): Promise<string | null> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('ai_api_keys')
        .select('encrypted_key')
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .eq('provider', provider)
        .maybeSingle()

    if (!data) return null
    return decryptKey(data.encrypted_key)
}

export async function listApiKeys(
    userId: string,
    roomId: string
): Promise<Array<{ provider: AiProvider; keyHint: string; updatedAt: string }>> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('ai_api_keys')
        .select('provider, key_hint, updated_at')
        .eq('user_id', userId)
        .eq('room_id', roomId)

    return (data ?? []).map((row) => ({
        provider: row.provider as AiProvider,
        keyHint: row.key_hint || '****',
        updatedAt: row.updated_at,
    }))
}

export async function deleteApiKey(
    userId: string,
    roomId: string,
    provider: AiProvider
): Promise<void> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('ai_api_keys')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .eq('provider', provider)

    if (error) {
        throw new Error(`Failed to delete API key: ${error.message}`)
    }
}
