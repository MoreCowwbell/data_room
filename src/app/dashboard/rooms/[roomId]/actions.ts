'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertRoomOwnership(roomId: string) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    const { data: room, error } = await supabase
        .from('data_rooms')
        .select('id')
        .eq('id', roomId)
        .eq('owner_id', user.id)
        .single()

    if (error || !room) {
        throw new Error('Unauthorized')
    }

    return supabase
}

export async function recordUpload(roomId: string, folderId: string | null, path: string, filename: string, mimeType: string) {
    const supabase = await assertRoomOwnership(roomId)
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

    if (error) {
        throw new Error('Failed to rename folder')
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function deleteFolder(roomId: string, folderId: string) {
    const supabase = await assertRoomOwnership(roomId)

    const { data: allFolders, error: foldersError } = await supabase
        .from('folders')
        .select('id, parent_id')
        .eq('room_id', roomId)

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
        .select('id, storage_path')
        .eq('room_id', roomId)
        .in('folder_id', descendantFolderIds)

    if (docsError) {
        throw new Error('Failed to fetch folder documents')
    }

    if (docsInFolders && docsInFolders.length > 0) {
        const storagePaths = docsInFolders.map((doc) => doc.storage_path)
        const { error: removeStorageError } = await supabase.storage.from('documents').remove(storagePaths)
        if (removeStorageError) {
            throw new Error('Failed to delete files from storage')
        }

        const docIds = docsInFolders.map((doc) => doc.id)
        const { error: removeDocsError } = await supabase.from('documents').delete().in('id', docIds)
        if (removeDocsError) {
            throw new Error('Failed to delete folder documents')
        }
    }

    // Delete children first; root last.
    const orderedFolderIds = [...descendantFolderIds].reverse()
    const { error: deleteFoldersError } = await supabase
        .from('folders')
        .delete()
        .eq('room_id', roomId)
        .in('id', orderedFolderIds)

    if (deleteFoldersError) {
        throw new Error('Failed to delete folder')
    }

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

    if (error) {
        throw new Error('Failed to rename file')
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function deleteDocument(roomId: string, documentId: string) {
    const supabase = await assertRoomOwnership(roomId)

    const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('id, storage_path')
        .eq('id', documentId)
        .eq('room_id', roomId)
        .single()

    if (fetchError || !doc) {
        throw new Error('File not found')
    }

    const { error: removeStorageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path])

    if (removeStorageError) {
        throw new Error('Failed to delete file from storage')
    }

    const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('room_id', roomId)

    if (deleteError) {
        throw new Error('Failed to delete file')
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
}
