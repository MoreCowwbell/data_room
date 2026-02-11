'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { VAULT_TEMPLATES } from '@/lib/vault-templates'

export async function createDataRoom(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string
    const templateId = formData.get('template') as string | null

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check if profile exists, if not create it (lazy init)
    // Ideally this happens on auth webhook (triggers), but for MVP we can check
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single()

    if (!profile) {
        await supabase.from('profiles').insert({ id: user.id, full_name: user.email, email: user.email })
    } else {
        await supabase
            .from('profiles')
            .update({ email: user.email })
            .eq('id', user.id)
            .is('email', null)
    }

    const { data, error } = await supabase
        .from('data_rooms')
        .insert({
            owner_id: user.id,
            name,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating room:', error)
        throw new Error('Failed to create room')
    }

    const roomId = data.id

    // Apply template if selected
    const template = templateId ? VAULT_TEMPLATES[templateId] : null
    if (template) {
        // Create folders
        const folderInserts = template.folders.map((f) => ({
            room_id: roomId,
            parent_id: null,
            name: f.name,
        }))

        const { error: foldersError } = await supabase.from('folders').insert(folderInserts)
        if (foldersError) {
            console.error('Error creating template folders:', foldersError)
        }
    }

    revalidatePath('/dashboard')
    redirect(`/dashboard/rooms/${roomId}`)
}

export async function deleteDataRoom(roomId: string) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    // Verify owner — only the room owner can hard-delete
    const { data: room } = await supabase
        .from('data_rooms')
        .select('id, owner_id')
        .eq('id', roomId)
        .single()

    if (!room || room.owner_id !== user.id) {
        throw new Error('Only the vault owner can delete it')
    }

    // 1. Delete all storage files
    const { data: storageFiles } = await supabase.storage
        .from('documents')
        .list(roomId)

    if (storageFiles && storageFiles.length > 0) {
        const paths = storageFiles.map((f) => `${roomId}/${f.name}`)
        await supabase.storage.from('documents').remove(paths)
    }

    // 2. Get document IDs for analytics cleanup
    const { data: docs } = await supabase
        .from('documents')
        .select('id')
        .eq('room_id', roomId)

    const docIds = (docs ?? []).map((d) => d.id)

    if (docIds.length > 0) {
        await supabase
            .from('document_analytics')
            .delete()
            .in('document_id', docIds)
    }

    // 3. Get shared link IDs for access log cleanup
    const { data: links } = await supabase
        .from('shared_links')
        .select('id')
        .eq('room_id', roomId)

    const linkIds = (links ?? []).map((l) => l.id)

    if (linkIds.length > 0) {
        await supabase
            .from('link_access_logs')
            .delete()
            .in('link_id', linkIds)
    }

    // 4. Delete shared links (cascades: page_views, download_events, viewer_sessions, nda_acceptances, viewer_auth_tokens)
    if (linkIds.length > 0) {
        await supabase
            .from('shared_links')
            .delete()
            .eq('room_id', roomId)
    }

    // 5. Delete documents
    await supabase
        .from('documents')
        .delete()
        .eq('room_id', roomId)

    // 6. Delete folders
    await supabase
        .from('folders')
        .delete()
        .eq('room_id', roomId)

    // 7. Delete the room (cascades: audit_events, notifications, team_members, nda_templates, team_invites)
    const { error: deleteError } = await supabase
        .from('data_rooms')
        .delete()
        .eq('id', roomId)
        .eq('owner_id', user.id)

    if (deleteError) {
        console.error('Error deleting vault:', deleteError)
        throw new Error('Failed to delete vault')
    }

    revalidatePath('/dashboard')
    redirect('/dashboard')
}
