import { createClient } from '@/lib/supabase/server'
import { fetchLinkById, getAccessibleDocumentsForLink, getValidVisitorSession, getVisitorSessionCookieName } from '@/lib/link-access'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { linkId, docId, page, duration } = await req.json()
    const pageNumber = Number(page)
    const durationSeconds = Number(duration)

    if (!linkId || !docId || !pageNumber || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
        return new NextResponse('Missing fields', { status: 400 })
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(getVisitorSessionCookieName(linkId))?.value

    if (!sessionToken) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const link = await fetchLinkById(supabase, linkId)
    if (!link) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const validSession = await getValidVisitorSession(supabase, link.id, sessionToken)
    if (!validSession) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const accessibleDocuments = await getAccessibleDocumentsForLink(supabase, link)
    const requestedDocument = accessibleDocuments.find((document) => document.id === docId)
    if (!requestedDocument) {
        return new NextResponse('Forbidden', { status: 403 })
    }

    await supabase.from('page_views').insert({
        link_id: link.id,
        document_id: requestedDocument.id,
        visitor_session_token: sessionToken,
        page_number: pageNumber,
        duration_seconds: durationSeconds,
        viewed_at: new Date().toISOString()
    })

    await supabase
        .from('link_access_logs')
        .update({ last_active_at: new Date().toISOString() })
        .eq('link_id', link.id)
        .eq('visitor_session_token', sessionToken)

    return new NextResponse('OK', { status: 200 })
}
