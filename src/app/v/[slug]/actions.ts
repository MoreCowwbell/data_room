'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function submitVisitorAuth(slug: string, formData: FormData) {
    const supabase = await createClient()
    const email = formData.get('email') as string

    // Fetch link to check settings
    const { data: link } = await supabase
        .from('shared_links')
        .select('id, settings, is_active')
        .eq('slug', slug)
        .single()

    if (!link || !link.is_active) {
        throw new Error('Link invalid or expired')
    }

    // Record access log
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36)

    await supabase.from('link_access_logs').insert({
        link_id: link.id,
        visitor_email: email,
        visitor_session_token: token,
        user_agent: 'Pending', // We can get this from headers usually
        ip_address: 'Pending'
    })

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set(`visitor_session_${link.id}`, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 // 1 day
    })

    redirect(`/v/${slug}/view`)
}
