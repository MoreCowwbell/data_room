import { createClient } from '@/lib/supabase/server'
import {
    decodeViewerEmail,
    evaluateLinkAvailability,
    fetchLinkBySlug,
    getValidVisitorSession,
    getViewerIdentityCookieName,
    getVisitorSessionCookieName,
} from '@/lib/link-access'
import { fetchActiveNdaTemplate, hasViewerAcceptedNda } from '@/lib/nda'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { acceptNda } from '../actions'

interface NdaPageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ error?: string }>
}

export default async function ViewerNdaPage({ params, searchParams }: NdaPageProps) {
    const supabase = await createClient()
    const { slug } = await params
    const { error } = await searchParams

    const link = await fetchLinkBySlug(supabase, slug)
    if (!link) {
        return notFound()
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

    if (!link.require_nda) {
        redirect(`/v/${slug}/view`)
    }

    const template = await fetchActiveNdaTemplate(supabase, link.room_id)
    if (!template) {
        redirect(`/v/${slug}/view`)
    }

    const alreadyAccepted = await hasViewerAcceptedNda(supabase, link.id, viewerEmail, template.template_hash)
    if (alreadyAccepted) {
        redirect(`/v/${slug}/view`)
    }

    const boundAcceptNda = acceptNda.bind(null, slug)

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="max-w-3xl w-full">
                <CardHeader>
                    <CardTitle>{template.title}</CardTitle>
                    <CardDescription>
                        You must accept this NDA before viewing the shared documents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    <div className="max-h-[55vh] overflow-auto rounded border p-4 whitespace-pre-wrap text-sm leading-6">
                        {template.body}
                    </div>
                    <form action={boundAcceptNda}>
                        <Button type="submit">I Agree and Continue</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
