import type { SupabaseClient } from '@supabase/supabase-js'

export type LinkType = 'room' | 'folder' | 'document'

export type SharedLinkRecord = {
    id: string
    slug: string
    room_id: string
    folder_id: string | null
    document_id: string | null
    link_type: LinkType
    is_active: boolean
    expires_at: string | null
    max_views: number | null
    view_count: number
    allow_download: boolean
    require_nda: boolean
    name: string | null
    settings: { require_email?: boolean } | null
}

export type AccessibleDocumentRecord = {
    id: string
    room_id: string
    folder_id: string | null
    filename: string
    mime_type: string
    storage_path: string
    created_at: string
}

export type LinkAvailabilityCode = 'inactive' | 'expired' | 'max_views'

export type LinkAvailability = {
    allowed: boolean
    code?: LinkAvailabilityCode
    message?: string
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function parseDate(dateValue: string | null): number | null {
    if (!dateValue) {
        return null
    }

    const millis = Date.parse(dateValue)
    return Number.isNaN(millis) ? null : millis
}

function maxViewsReached(link: SharedLinkRecord): boolean {
    if (link.max_views === null || link.max_views === undefined) {
        return false
    }
    return (link.view_count ?? 0) >= link.max_views
}

export function getVisitorSessionCookieName(linkId: string): string {
    return `visitor_session_${linkId}`
}

export function getViewerIdentityCookieName(linkId: string): string {
    return `visitor_identity_${linkId}`
}

export function encodeViewerEmail(email: string): string {
    return Buffer.from(email, 'utf8').toString('base64url')
}

export function decodeViewerEmail(encoded: string | undefined): string | null {
    if (!encoded) {
        return null
    }
    try {
        const decoded = Buffer.from(encoded, 'base64url').toString('utf8').trim()
        return decoded || null
    } catch {
        return null
    }
}

export function evaluateLinkAvailability(
    link: SharedLinkRecord,
    options?: { enforceMaxViews?: boolean }
): LinkAvailability {
    if (!link.is_active) {
        return {
            allowed: false,
            code: 'inactive',
            message: 'This link has been revoked.',
        }
    }

    const expiresAtMs = parseDate(link.expires_at)
    if (expiresAtMs !== null && expiresAtMs <= Date.now()) {
        return {
            allowed: false,
            code: 'expired',
            message: 'This link has expired.',
        }
    }

    if (options?.enforceMaxViews && maxViewsReached(link)) {
        return {
            allowed: false,
            code: 'max_views',
            message: 'This link has reached its maximum number of views.',
        }
    }

    return { allowed: true }
}

export async function fetchLinkBySlug(
    supabase: SupabaseClient,
    slug: string
): Promise<SharedLinkRecord | null> {
    const { data, error } = await supabase
        .from('shared_links')
        .select('id, slug, room_id, folder_id, document_id, link_type, is_active, expires_at, max_views, view_count, allow_download, require_nda, name, settings')
        .eq('slug', slug)
        .maybeSingle()

    if (error || !data) {
        return null
    }

    return data as SharedLinkRecord
}

export async function fetchLinkById(
    supabase: SupabaseClient,
    linkId: string
): Promise<SharedLinkRecord | null> {
    const { data, error } = await supabase
        .from('shared_links')
        .select('id, slug, room_id, folder_id, document_id, link_type, is_active, expires_at, max_views, view_count, allow_download, require_nda, name, settings')
        .eq('id', linkId)
        .maybeSingle()

    if (error || !data) {
        return null
    }

    return data as SharedLinkRecord
}

async function getFolderSubtreeIds(
    supabase: SupabaseClient,
    roomId: string,
    rootFolderId: string
): Promise<string[]> {
    const { data: folders, error } = await supabase
        .from('folders')
        .select('id, parent_id, deleted_at')
        .eq('room_id', roomId)

    if (error || !folders) {
        return []
    }

    const activeFolders = folders.filter((folder) => !folder.deleted_at)
    const rootFolder = activeFolders.find((folder) => folder.id === rootFolderId)
    if (!rootFolder) {
        return []
    }

    const childrenByParent = new Map<string, string[]>()
    for (const folder of activeFolders) {
        if (!folder.parent_id) {
            continue
        }
        const children = childrenByParent.get(folder.parent_id) ?? []
        children.push(folder.id)
        childrenByParent.set(folder.parent_id, children)
    }

    const subtreeIds: string[] = []
    const queue: string[] = [rootFolderId]
    while (queue.length > 0) {
        const currentId = queue.shift()
        if (!currentId) {
            continue
        }

        subtreeIds.push(currentId)
        const children = childrenByParent.get(currentId) ?? []
        queue.push(...children)
    }

    return subtreeIds
}

export async function getAccessibleDocumentsForLink(
    supabase: SupabaseClient,
    link: SharedLinkRecord
): Promise<AccessibleDocumentRecord[]> {
    if (link.link_type === 'document') {
        if (!link.document_id) {
            return []
        }

        const { data, error } = await supabase
            .from('documents')
            .select('id, room_id, folder_id, filename, mime_type, storage_path, created_at')
            .eq('room_id', link.room_id)
            .eq('id', link.document_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })

        if (error || !data) {
            return []
        }
        return data as AccessibleDocumentRecord[]
    }

    if (link.link_type === 'folder') {
        if (!link.folder_id) {
            return []
        }

        const subtreeIds = await getFolderSubtreeIds(supabase, link.room_id, link.folder_id)
        if (subtreeIds.length === 0) {
            return []
        }

        const { data, error } = await supabase
            .from('documents')
            .select('id, room_id, folder_id, filename, mime_type, storage_path, created_at')
            .eq('room_id', link.room_id)
            .in('folder_id', subtreeIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })

        if (error || !data) {
            return []
        }
        return data as AccessibleDocumentRecord[]
    }

    const { data, error } = await supabase
        .from('documents')
        .select('id, room_id, folder_id, filename, mime_type, storage_path, created_at')
        .eq('room_id', link.room_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

    if (error || !data) {
        return []
    }

    return data as AccessibleDocumentRecord[]
}

export async function getValidVisitorSession(
    supabase: SupabaseClient,
    linkId: string,
    sessionToken: string
): Promise<{ visitor_email: string | null; ip_address: string | null } | null> {
    const { data, error } = await supabase
        .from('link_access_logs')
        .select('visitor_email, ip_address, started_at')
        .eq('link_id', linkId)
        .eq('visitor_session_token', sessionToken)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !data) {
        return null
    }

    const startedAt = parseDate(data.started_at as string | null)
    if (!startedAt) {
        return null
    }

    if (Date.now() - startedAt > SESSION_TTL_MS) {
        return null
    }

    return {
        visitor_email: data.visitor_email,
        ip_address: data.ip_address,
    }
}
