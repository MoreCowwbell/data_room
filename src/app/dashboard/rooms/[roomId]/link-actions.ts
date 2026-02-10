'use server'

import { writeAuditEvent } from '@/lib/audit'
import { requireRoomAccess } from '@/lib/room-access'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

type LinkType = 'room' | 'folder' | 'document'

type CreateLinkInput = {
    roomId: string
    linkType: LinkType
    targetId?: string | null
    requireEmail?: boolean
    allowDownload?: boolean
    requireNda?: boolean
    expiresAt?: string | null
    maxViews?: number | null
    name?: string | null
}

function generateSlug() {
    return randomBytes(12).toString('base64url').toLowerCase()
}

export async function createLink(input: CreateLinkInput) {
    const {
        roomId,
        linkType,
        targetId,
        requireEmail = true,
        allowDownload = false,
        requireNda = false,
        expiresAt = null,
        maxViews = null,
        name = null,
    } = input

    if (!['room', 'folder', 'document'].includes(linkType)) {
        throw new Error('Invalid link type')
    }

    const { supabase, userId } = await requireRoomAccess(roomId, ['owner', 'admin'])

    const { data: room, error: roomError } = await supabase
        .from('data_rooms')
        .select('id')
        .eq('id', roomId)
        .maybeSingle()

    if (roomError || !room) {
        throw new Error('Unauthorized')
    }

    if ((linkType === 'document' || linkType === 'folder') && !targetId) {
        throw new Error('Missing link target')
    }

    if (linkType === 'document') {
        const { data: document } = await supabase
            .from('documents')
            .select('id')
            .eq('id', targetId as string)
            .eq('room_id', roomId)
            .is('deleted_at', null)
            .maybeSingle()

        if (!document) {
            throw new Error('Document not found')
        }
    }

    if (linkType === 'folder') {
        const { data: folder } = await supabase
            .from('folders')
            .select('id')
            .eq('id', targetId as string)
            .eq('room_id', roomId)
            .is('deleted_at', null)
            .maybeSingle()

        if (!folder) {
            throw new Error('Folder not found')
        }
    }

    if (maxViews !== null && maxViews !== undefined && (!Number.isInteger(maxViews) || maxViews <= 0)) {
        throw new Error('Max views must be a positive whole number')
    }

    if (expiresAt) {
        const parsedExpiresAt = Date.parse(expiresAt)
        if (Number.isNaN(parsedExpiresAt) || parsedExpiresAt <= Date.now()) {
            throw new Error('Expiration must be a future date/time')
        }
    }

    let slug = ''
    let insertError: Error | null = null

    for (let attempt = 0; attempt < 5; attempt += 1) {
        slug = generateSlug()
        const { error } = await supabase.from('shared_links').insert({
            room_id: roomId,
            document_id: linkType === 'document' ? targetId : null,
            folder_id: linkType === 'folder' ? targetId : null,
            slug,
            link_type: linkType,
            settings: { require_email: requireEmail },
            created_by: userId,
            allow_download: allowDownload,
            require_nda: requireNda,
            expires_at: expiresAt,
            max_views: maxViews,
            name: name?.trim() || null,
        })

        if (!error) {
            await writeAuditEvent(supabase, {
                roomId,
                actorId: userId,
                action: 'link.created',
                targetType: 'shared_link',
                metadata: {
                    slug,
                    link_type: linkType,
                    target_id: targetId || null,
                    expires_at: expiresAt,
                    max_views: maxViews,
                    allow_download: allowDownload,
                    require_nda: requireNda,
                },
            })
            insertError = null
            break
        }

        if (error.code !== '23505') {
            insertError = new Error('Failed to create link')
            break
        }

        insertError = new Error('Failed to create unique link')
    }

    if (insertError) {
        throw insertError
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
    return slug
}

export async function setLinkActiveState(roomId: string, linkId: string, isActive: boolean) {
    const { supabase, userId } = await requireRoomAccess(roomId, ['owner', 'admin'])

    const { error } = await supabase
        .from('shared_links')
        .update({ is_active: isActive })
        .eq('id', linkId)
        .eq('room_id', roomId)

    if (error) {
        throw new Error('Failed to update link state')
    }

    await writeAuditEvent(supabase, {
        roomId,
        actorId: userId,
        action: isActive ? 'link.activated' : 'link.revoked',
        targetType: 'shared_link',
        targetId: linkId,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function deleteLink(roomId: string, linkId: string) {
    const { supabase, userId } = await requireRoomAccess(roomId, ['owner', 'admin'])

    const { error } = await supabase
        .from('shared_links')
        .delete()
        .eq('id', linkId)
        .eq('room_id', roomId)

    if (error) {
        throw new Error('Failed to delete link')
    }

    await writeAuditEvent(supabase, {
        roomId,
        actorId: userId,
        action: 'link.deleted',
        targetType: 'shared_link',
        targetId: linkId,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}
