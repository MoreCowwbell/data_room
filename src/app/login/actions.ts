'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail } from '@/lib/utils'
import { headers } from 'next/headers'

export async function login(formData: FormData) {
    const supabase = await createClient()
    const email = (formData.get('email') as string)?.trim().toLowerCase()

    if (!email || !isValidEmail(email)) {
        redirect('/login?error=' + encodeURIComponent('A valid email address is required'))
    }

    // Resolve the current site origin for auth callback links.
    const headersList = await headers()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    const forwardedHost = headersList.get('x-forwarded-host')
    const forwardedProto = headersList.get('x-forwarded-proto') || 'https'
    const host = headersList.get('host')

    const origin =
        siteUrl ||
        (forwardedHost
            ? `${forwardedProto}://${forwardedHost}`
            : host
                ? `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${host}`
                : 'http://localhost:3000')

    const emailRedirectTo = `${origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
            emailRedirectTo,
        },
    })

    if (error) {
        redirect('/login?error=' + error.message)
    }

    revalidatePath('/', 'layout')
    // We don't redirect to dashboard yet, we stay to let them enter OTP
    // Or if magic link, we tell them to check email.
    // For this MVP let's assume OTP flow which is better for "portal" feel sometimes,
    // but DocSend usually does "Enter Email" -> "Check Magic Link" or "Passcode".
    // Let's support OTP token input on the next screen or same screen.

    // Actually, keeping it simple: Magic Link is easiest.
    // But user requested "Receive 6-digit OTP (or Magic Link)".
    // Let's implement Magic Link default as it is simpler to code (no UI for OTP entry needed).

    redirect('/login?message=Check your email for the login link')
}
