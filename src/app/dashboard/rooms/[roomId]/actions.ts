'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function recordUpload(roomId: string, folderId: string | null, path: string, filename: string, mimeType: string) {
    const supabase = await createClient()
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
    const supabase = await createClient()
    const { error } = await supabase.from('folders').insert({
        room_id: roomId,
        parent_id: parentId,
        name: name
    })

    if (error) {
        throw new Error('Failed to create folder')
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
}
