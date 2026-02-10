import { createClient } from '@/lib/supabase/server'
import {
    evaluateLinkAvailability,
    fetchLinkById,
    getAccessibleDocumentsForLink,
    getValidVisitorSession,
    getVisitorSessionCookieName
} from '@/lib/link-access'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
    const { docId } = await params
    const supabase = await createClient()

    const { searchParams } = new URL(req.url)
    const linkId = searchParams.get('linkId')

    if (!linkId) {
        return new NextResponse('Unauthorized', { status: 401 })
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

    const availability = evaluateLinkAvailability(link, { enforceMaxViews: false })
    if (!availability.allowed) {
        return new NextResponse(availability.message || 'Link unavailable', { status: 410 })
    }

    const validSession = await getValidVisitorSession(supabase, linkId, sessionToken)
    if (!validSession) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const accessibleDocuments = await getAccessibleDocumentsForLink(supabase, link)
    const requestedDocument = accessibleDocuments.find((document) => document.id === docId)

    if (!requestedDocument) {
        return new NextResponse('Forbidden', { status: 403 })
    }

    const { data: fileBlob, error } = await supabase.storage.from('documents').download(requestedDocument.storage_path)

    if (error || !fileBlob) {
        console.error('Storage download error:', error)
        return new NextResponse('Error downloading file', { status: 500 })
    }

    const headers = new Headers()
    headers.set('Content-Type', requestedDocument.mime_type)
    headers.set('Content-Length', fileBlob.size.toString())

    return new NextResponse(fileBlob, { status: 200, headers })
}
