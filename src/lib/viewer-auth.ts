import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import type { SharedLinkRecord } from '@/lib/link-access'

const VIEWER_AUTH_TOKEN_TTL_MINUTES = 15

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
    return randomBytes(24).toString('base64url')
}

export async function issueViewerAuthToken(
    supabase: SupabaseClient,
    linkId: string,
    viewerEmail: string
): Promise<string> {
    const rawToken = randomBytes(24).toString('base64url')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + VIEWER_AUTH_TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

    await supabase
        .from('viewer_auth_tokens')
        .delete()
        .eq('link_id', linkId)
        .eq('viewer_email', viewerEmail)
        .is('used_at', null)

    const { error } = await supabase.from('viewer_auth_tokens').insert({
        link_id: linkId,
        viewer_email: viewerEmail,
        token_hash: tokenHash,
        expires_at: expiresAt,
    })

    if (error) {
        throw new Error('Failed to create login link')
    }

    return rawToken
}

export async function consumeViewerAuthToken(
    supabase: SupabaseClient,
    linkId: string,
    viewerEmail: string,
    rawToken: string
): Promise<boolean> {
    const tokenHash = hashToken(rawToken)
    const nowIso = new Date().toISOString()

    const { data: tokenRow, error: fetchError } = await supabase
        .from('viewer_auth_tokens')
        .select('id, used_at, expires_at')
        .eq('link_id', linkId)
        .eq('viewer_email', viewerEmail)
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle()

    if (fetchError || !tokenRow) {
        return false
    }

    const { error: markUsedError } = await supabase
        .from('viewer_auth_tokens')
        .update({ used_at: nowIso })
        .eq('id', tokenRow.id)
        .is('used_at', null)

    if (markUsedError) {
        return false
    }

    return true
}

export function hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export async function createViewerSession(
    supabase: SupabaseClient,
    link: SharedLinkRecord,
    viewerEmail: string,
    metadata: { ipAddress: string | null; userAgent: string | null }
): Promise<{ sessionToken: string; isFirstOpen: boolean }> {
    const { count } = await supabase
        .from('link_access_logs')
        .select('id', { head: true, count: 'exact' })
        .eq('link_id', link.id)
        .eq('visitor_email', viewerEmail)

    const sessionToken = generateSessionToken()
    const tokenHash = hashSessionToken(sessionToken)
    const { error: logError } = await supabase.from('link_access_logs').insert({
        link_id: link.id,
        visitor_email: viewerEmail,
        visitor_session_token: tokenHash,
        user_agent: metadata.userAgent,
        ip_address: metadata.ipAddress,
    })

    if (logError) {
        throw new Error('Unable to start viewer session')
    }

    return { sessionToken, isFirstOpen: (count ?? 0) === 0 }
}
