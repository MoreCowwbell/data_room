import { createClient } from '@/lib/supabase/server'
import {
    encodeViewerEmail,
    evaluateLinkAvailability,
    fetchLinkBySlug,
    getViewerIdentityCookieName,
    getVisitorSessionCookieName,
} from '@/lib/link-access'
import { fetchActiveNdaTemplate, hasViewerAcceptedNda } from '@/lib/nda'
import { getRequestClientMetadata } from '@/lib/request-context'
import { consumeViewerAuthToken, createViewerSession } from '@/lib/viewer-auth'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

interface AuthPageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ token?: string; email?: string }>
}

export default async function ViewerAuthCallbackPage({ params, searchParams }: AuthPageProps) {
    const supabase = await createClient()
    const { slug } = await params
    const { token, email } = await searchParams

    const link = await fetchLinkBySlug(supabase, slug)
    if (!link) {
        return notFound()
    }

    const availability = evaluateLinkAvailability(link, { enforceMaxViews: true })
    if (!availability.allowed) {
        redirect(`/v/${slug}?error=${encodeURIComponent(availability.message || 'Link unavailable')}`)
    }

    const viewerEmail = email?.trim().toLowerCase()
    const rawToken = token?.trim()
    if (!viewerEmail || !rawToken) {
        redirect(`/v/${slug}?error=${encodeURIComponent('Invalid authentication link')}`)
    }

    const tokenValid = await consumeViewerAuthToken(supabase, link.id, viewerEmail, rawToken)
    if (!tokenValid) {
        redirect(`/v/${slug}?error=${encodeURIComponent('Authentication link is expired or already used')}`)
    }

    const metadata = await getRequestClientMetadata()
    const { sessionToken } = await createViewerSession(supabase, link, viewerEmail, metadata)

    const cookieStore = await cookies()
    cookieStore.set(getVisitorSessionCookieName(link.id), sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24,
    })
    cookieStore.set(getViewerIdentityCookieName(link.id), encodeViewerEmail(viewerEmail), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24,
    })

    if (link.require_nda) {
        const template = await fetchActiveNdaTemplate(supabase, link.room_id)
        if (template) {
            const accepted = await hasViewerAcceptedNda(supabase, link.id, viewerEmail, template.template_hash)
            if (!accepted) {
                redirect(`/v/${slug}/nda`)
            }
        }
    }

    redirect(`/v/${slug}/view`)
}
