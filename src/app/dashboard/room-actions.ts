'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createDataRoom(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string

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
        await supabase.from('profiles').insert({ id: user.id, full_name: user.email })
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

    revalidatePath('/dashboard')
    redirect(`/dashboard/rooms/${data.id}`)
}
