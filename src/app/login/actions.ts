'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()
    const email = formData.get('email') as string

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true, // Allow new users for now (or false if strict)
            // emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
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
