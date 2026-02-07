'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createLink(roomId: string, documentId: string, settings: any) {
    const supabase = await createClient()

    // Generate random slug
    const slug = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase.from('shared_links').insert({
        room_id: roomId,
        document_id: documentId,
        slug: slug,
        settings: settings,
        created_by: user.id
    })

    if (error) {
        throw new Error('Failed to create link')
    }

    revalidatePath(`/dashboard/rooms/${roomId}`)
    return slug
}
