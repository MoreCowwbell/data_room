import { createClient } from '@/lib/supabase/server'
import {
    decodeViewerEmail,
    evaluateLinkAvailability,
    fetchLinkBySlug,
    getAccessibleDocumentsForLink,
    getValidVisitorSession,
    getViewerIdentityCookieName,
    getVisitorSessionCookieName
} from '@/lib/link-access'
import { fetchActiveNdaTemplate, hasViewerAcceptedNda } from '@/lib/nda'
import { notFound, redirect } from 'next/navigation'
import SecureDocumentViewer from '@/components/SecureDocumentViewer'
import { cookies } from 'next/headers'
import Link from 'next/link'

interface ViewPageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ docId?: string }>
}

export default async function ViewPage({ params, searchParams }: ViewPageProps) {
    const supabase = await createClient()
    const { slug } = await params
    const { docId } = await searchParams

    const link = await fetchLinkBySlug(supabase, slug)
    if (!link) {
        return notFound()
    }

    const availability = evaluateLinkAvailability(link, { enforceMaxViews: false })
    if (!availability.allowed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md w-full rounded-lg border bg-card p-6 shadow-sm">
                    <h1 className="text-xl font-semibold mb-2">Link Unavailable</h1>
                    <p className="text-sm text-muted-foreground">{availability.message}</p>
                </div>
            </div>
        )
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(getVisitorSessionCookieName(link.id))?.value

    if (!sessionToken) {
        return redirect(`/v/${slug}`)
    }

    const validSession = await getValidVisitorSession(supabase, link.id, sessionToken)
    if (!validSession) {
        return redirect(`/v/${slug}`)
    }

    const documents = await getAccessibleDocumentsForLink(supabase, link)
    if (documents.length === 0) {
        return notFound()
    }

    const selectedDocument = documents.find((document) => document.id === docId) ?? documents[0]
    const cookieViewerEmail = decodeViewerEmail(cookieStore.get(getViewerIdentityCookieName(link.id))?.value)
    const visitorEmail = cookieViewerEmail || validSession.visitor_email || 'Viewer'
    const ip = validSession.ip_address || 'Private IP'

    if (link.require_nda && visitorEmail !== 'Viewer') {
        const template = await fetchActiveNdaTemplate(supabase, link.room_id)
        if (template) {
            const accepted = await hasViewerAcceptedNda(supabase, link.id, visitorEmail, template.template_hash)
            if (!accepted) {
                return redirect(`/v/${slug}/nda`)
            }
        }
    }

    const watermarkText = `${visitorEmail} - ${ip} - ${new Date().toISOString().split('T')[0]}`
    const streamUrl = `/api/stream/${selectedDocument.id}?linkId=${link.id}`

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-20">
                <h1 className="font-semibold text-lg max-w-xl truncate">
                    {link.name || selectedDocument.filename}
                </h1>
                <div className="text-sm text-gray-500">
                    Viewing as {visitorEmail}
                </div>
            </header>

            <main className="flex-1 flex gap-4 px-4 py-6">
                {documents.length > 1 ? (
                    <aside className="w-72 shrink-0 rounded-lg border bg-white p-3 h-fit sticky top-24">
                        <h2 className="text-sm font-semibold mb-2">Documents</h2>
                        <div className="space-y-1 max-h-[70vh] overflow-auto">
                            {documents.map((document) => (
                                <Link
                                    key={document.id}
                                    href={`/v/${slug}/view?docId=${document.id}`}
                                    className={`block rounded px-2 py-1 text-sm transition-colors ${document.id === selectedDocument.id
                                        ? 'bg-gray-900 text-white'
                                        : 'hover:bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    <span className="block truncate">{document.filename}</span>
                                </Link>
                            ))}
                        </div>
                    </aside>
                ) : null}

                <div className="flex-1 flex justify-center">
                    <SecureDocumentViewer docUrl={streamUrl} watermarkText={watermarkText} />
                </div>
            </main>
        </div>
    )
}
