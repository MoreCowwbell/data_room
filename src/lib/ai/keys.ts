import { createClient } from '@/lib/supabase/server'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import type { AiProvider } from './provider'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
    const secret = process.env.AI_KEY_ENCRYPTION_SECRET
    if (!secret) {
        throw new Error(
            'AI_KEY_ENCRYPTION_SECRET is not set. Cannot encrypt/decrypt API keys.'
        )
    }
    // Derive a 256-bit key from the secret using SHA-256
    return createHash('sha256').update(secret).digest()
}

function encryptKey(apiKey: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    // Format: base64(iv + authTag + ciphertext)
    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

function decryptKey(encryptedB64: string): string {
    const key = getEncryptionKey()
    const data = Buffer.from(encryptedB64, 'base64')
    const iv = data.subarray(0, IV_LENGTH)
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(ciphertext) + decipher.final('utf8')
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
