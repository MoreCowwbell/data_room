'use server'

import { createClient } from '@/lib/supabase/server'
import {
    decodeViewerEmail,
    encodeViewerEmail,
    evaluateLinkAvailability,
    fetchLinkBySlug,
    getValidVisitorSession,
    getViewerIdentityCookieName,
    getVisitorSessionCookieName,
} from '@/lib/link-access'
import { fetchActiveNdaTemplate, hasViewerAcceptedNda } from '@/lib/nda'
import { sendEmail } from '@/lib/email'
import { getRequestClientMetadata, getRequestOrigin } from '@/lib/request-context'
import { issueViewerAuthToken } from '@/lib/viewer-auth'
import { writeAuditEvent } from '@/lib/audit'
import { isRateLimited } from '@/lib/rate-limit'
import { escapeHtml, isValidEmail } from '@/lib/utils'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const MAGIC_LINK_MAX = 5
const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000 // 5 requests per 15 minutes

export async function requestViewerMagicLink(slug: string, formData: FormData) {
    const supabase = await createClient()
    const email = (formData.get('email') as string | null)?.trim().toLowerCase()

    if (!email || !isValidEmail(email)) {
        redirect(`/v/${slug}?error=${encodeURIComponent('A valid email address is required')}`)
    }

    if (isRateLimited(`magic-link:${email}`, MAGIC_LINK_MAX, MAGIC_LINK_WINDOW_MS)) {
        redirect(`/v/${slug}?error=${encodeURIComponent('Too many requests. Please try again later.')}`)
    }

    const link = await fetchLinkBySlug(supabase, slug)
    if (!link) {
        redirect(`/v/${slug}?error=${encodeURIComponent('Invalid link')}`)
    }

    const availability = evaluateLinkAvailability(link, { enforceMaxViews: true })
    if (!availability.allowed) {
        redirect(`/v/${slug}?error=${encodeURIComponent(availability.message || 'Link unavailable')}`)
    }

    const rawToken = await issueViewerAuthToken(supabase, link.id, email)
    const origin = await getRequestOrigin()
    const authUrl = `${origin}/v/${slug}/auth?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`

    if (process.env.NODE_ENV !== 'production') {
        console.log('[dev] Magic link for', email, ':', authUrl)
    }

    await sendEmail({
        to: email,
        subject: 'Your secure OpenVault access link',
        html: `<p>Use the secure link below to access your shared documents.</p><p><a href="${escapeHtml(authUrl)}">${escapeHtml(authUrl)}</a></p><p>This link expires in 15 minutes.</p>`,
        text: `Use this secure link to access your shared documents:\n${authUrl}\n\nThis link expires in 15 minutes.`,
    })

    await writeAuditEvent(supabase, {
        roomId: link.room_id,
        actorType: 'viewer',
        action: 'viewer.magic_link_requested',
        targetType: 'shared_link',
        targetId: link.id,
        metadata: { viewer_email: email },
    })

    redirect(`/v/${slug}?message=${encodeURIComponent('Check your email for a secure sign-in link.')}`)
}

export async function acceptNda(slug: string) {
    const supabase = await createClient()
    const link = await fetchLinkBySlug(supabase, slug)
    if (!link) {
        redirect(`/v/${slug}`)
    }

    const availability = evaluateLinkAvailability(link, { enforceMaxViews: false })
    if (!availability.allowed) {
        redirect(`/v/${slug}?error=${encodeURIComponent(availability.message || 'Link unavailable')}`)
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(getVisitorSessionCookieName(link.id))?.value
    if (!sessionToken) {
        redirect(`/v/${slug}`)
    }

    const session = await getValidVisitorSession(supabase, link.id, sessionToken)
    if (!session) {
        redirect(`/v/${slug}`)
    }

    const viewerEmail = decodeViewerEmail(cookieStore.get(getViewerIdentityCookieName(link.id))?.value) || session.visitor_email
    if (!viewerEmail) {
        redirect(`/v/${slug}`)
    }

    const template = await fetchActiveNdaTemplate(supabase, link.room_id)
    if (!template) {
        redirect(`/v/${slug}/view`)
    }

    const alreadyAccepted = await hasViewerAcceptedNda(supabase, link.id, viewerEmail, template.template_hash)
    if (!alreadyAccepted) {
        const metadata = await getRequestClientMetadata()
        const { error } = await supabase.from('nda_acceptances').insert({
            link_id: link.id,
            nda_template_id: template.id,
            viewer_email: viewerEmail,
            template_hash: template.template_hash,
            accepted_at: new Date().toISOString(),
            ip_address: metadata.ipAddress,
            user_agent: metadata.userAgent,
        })

        if (error) {
            redirect(`/v/${slug}/nda?error=${encodeURIComponent('Failed to record acceptance')}`)
        }

        await writeAuditEvent(supabase, {
            roomId: link.room_id,
            actorType: 'viewer',
            action: 'viewer.nda_accepted',
            targetType: 'shared_link',
            targetId: link.id,
            metadata: { viewer_email: viewerEmail, nda_template_id: template.id },
        })
    }

    cookieStore.set(getViewerIdentityCookieName(link.id), encodeViewerEmail(viewerEmail), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 4,
    })

    redirect(`/v/${slug}/view`)
}
