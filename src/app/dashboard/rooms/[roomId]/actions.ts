'use server'

import { writeAuditEvent } from '@/lib/audit'
import { requireRoomAccess } from '@/lib/room-access'
import { revalidatePath } from 'next/cache'
import { createHash } from 'crypto'

async function assertRoomOwnership(roomId: string) {
    const { supabase } = await requireRoomAccess(roomId, ['owner', 'admin'])
    return supabase
}

export async function recordUpload(roomId: string, folderId: string | null, path: string, filename: string, mimeType: string) {
    const supabase = await assertRoomOwnership(roomId)

    const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
        throw new Error('Only PDF uploads are supported')
    }

    const { error } = await supabase.from('documents').insert({
        room_id: roomId,
        folder_id: folderId,
        storage_path: path,
        filename: filename,
        mime_type: mimeType,
        status: 'ready' // We assume it's ready for now, or 'processing' if we had a worker
    })

    if (error) {
        throw new Error('Failed to record document')
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function createFolder(roomId: string, parentId: string | null, name: string) {
    const supabase = await assertRoomOwnership(roomId)
    const trimmedName = name.trim()
    if (!trimmedName) {
        throw new Error('Folder name is required')
    }

    const { error } = await supabase.from('folders').insert({
        room_id: roomId,
        parent_id: parentId,
        name: trimmedName
    })

    if (error) {
        throw new Error('Failed to create folder')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'folder.created',
        targetType: 'folder',
        metadata: { parent_id: parentId, name: trimmedName },
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function renameFolder(roomId: string, folderId: string, name: string) {
    const supabase = await assertRoomOwnership(roomId)
    const trimmedName = name.trim()
    if (!trimmedName) {
        throw new Error('Folder name is required')
    }

    const { error } = await supabase
        .from('folders')
        .update({ name: trimmedName })
        .eq('id', folderId)
        .eq('room_id', roomId)
        .is('deleted_at', null)

    if (error) {
        throw new Error('Failed to rename folder')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'folder.renamed',
        targetType: 'folder',
        targetId: folderId,
        metadata: { name: trimmedName },
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function deleteFolder(roomId: string, folderId: string) {
    const supabase = await assertRoomOwnership(roomId)

    const { data: allFolders, error: foldersError } = await supabase
        .from('folders')
        .select('id, parent_id')
        .eq('room_id', roomId)
        .is('deleted_at', null)

    if (foldersError || !allFolders) {
        throw new Error('Failed to fetch folders')
    }

    const rootExists = allFolders.some((folder) => folder.id === folderId)
    if (!rootExists) {
        throw new Error('Folder not found')
    }

    const descendantFolderIds: string[] = []
    const queue: string[] = [folderId]

    while (queue.length > 0) {
        const currentId = queue.shift()!
        descendantFolderIds.push(currentId)
        const children = allFolders
            .filter((folder) => folder.parent_id === currentId)
            .map((folder) => folder.id)
        queue.push(...children)
    }

    const { data: docsInFolders, error: docsError } = await supabase
        .from('documents')
        .select('id')
        .eq('room_id', roomId)
        .in('folder_id', descendantFolderIds)
        .is('deleted_at', null)

    if (docsError) {
        throw new Error('Failed to fetch folder documents')
    }

    if (docsInFolders && docsInFolders.length > 0) {
        const docIds = docsInFolders.map((doc) => doc.id)
        const { error: archiveDocsError } = await supabase
            .from('documents')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', docIds)
            .is('deleted_at', null)

        if (archiveDocsError) {
            throw new Error('Failed to archive folder documents')
        }
    }

    const { error: archiveFoldersError } = await supabase
        .from('folders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .in('id', descendantFolderIds)
        .is('deleted_at', null)

    if (archiveFoldersError) {
        throw new Error('Failed to archive folder')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'folder.deleted',
        targetType: 'folder',
        targetId: folderId,
        metadata: { descendant_count: descendantFolderIds.length },
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function renameDocument(roomId: string, documentId: string, filename: string) {
    const supabase = await assertRoomOwnership(roomId)
    const trimmedFilename = filename.trim()
    if (!trimmedFilename) {
        throw new Error('Filename is required')
    }

    const { error } = await supabase
        .from('documents')
        .update({ filename: trimmedFilename })
        .eq('id', documentId)
        .eq('room_id', roomId)
        .is('deleted_at', null)

    if (error) {
        throw new Error('Failed to rename file')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'document.renamed',
        targetType: 'document',
        targetId: documentId,
        metadata: { filename: trimmedFilename },
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function deleteDocument(roomId: string, documentId: string) {
    const supabase = await assertRoomOwnership(roomId)

    const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .single()

    if (fetchError || !doc) {
        throw new Error('File not found')
    }

    const { error: archiveError } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', documentId)
        .eq('room_id', roomId)
        .is('deleted_at', null)

    if (archiveError) {
        throw new Error('Failed to archive file')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'document.deleted',
        targetType: 'document',
        targetId: documentId,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function saveNdaTemplate(roomId: string, title: string, body: string) {
    const supabase = await assertRoomOwnership(roomId)
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (!trimmedTitle || !trimmedBody) {
        throw new Error('NDA title and content are required')
    }

    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const { data: existingTemplate } = await supabase
        .from('nda_templates')
        .select('id, version')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .maybeSingle()

    if (existingTemplate) {
        const { error: deactivateError } = await supabase
            .from('nda_templates')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', existingTemplate.id)

        if (deactivateError) {
            throw new Error('Failed to update existing NDA template')
        }
    }

    const version = (existingTemplate?.version ?? 0) + 1
    const templateHash = createHash('sha256').update(`${trimmedTitle}\n${trimmedBody}`).digest('hex')

    const { error: createError } = await supabase.from('nda_templates').insert({
        room_id: roomId,
        title: trimmedTitle,
        body: trimmedBody,
        version,
        template_hash: templateHash,
        is_active: true,
        created_by: user.id,
    })

    if (createError) {
        throw new Error('Failed to save NDA template')
    }

    await writeAuditEvent(supabase, {
        roomId,
        actorId: user.id,
        action: 'nda.template_saved',
        targetType: 'nda_template',
        metadata: { version, title: trimmedTitle },
    })

    await supabase
        .from('data_rooms')
        .update({ nda_disclaimer_acknowledged_at: new Date().toISOString() })
        .eq('id', roomId)

    revalidatePath(`/dashboard/rooms/${roomId}`)
    revalidatePath(`/dashboard/rooms/${roomId}/nda`)
}

export async function restoreDocument(roomId: string, documentId: string) {
    const supabase = await assertRoomOwnership(roomId)

    const { error } = await supabase
        .from('documents')
        .update({ deleted_at: null })
        .eq('id', documentId)
        .eq('room_id', roomId)
        .not('deleted_at', 'is', null)

    if (error) {
        throw new Error('Failed to restore document')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'document.restored',
        targetType: 'document',
        targetId: documentId,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function restoreFolder(roomId: string, folderId: string) {
    const supabase = await assertRoomOwnership(roomId)

    const { error } = await supabase
        .from('folders')
        .update({ deleted_at: null })
        .eq('id', folderId)
        .eq('room_id', roomId)
        .not('deleted_at', 'is', null)

    if (error) {
        throw new Error('Failed to restore folder')
    }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditEvent(supabase, {
        roomId,
        actorId: user?.id,
        action: 'folder.restored',
        targetType: 'folder',
        targetId: folderId,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}
