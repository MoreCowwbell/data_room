import { createClient } from '@/lib/supabase/server'
import {
    decodeViewerEmail,
    evaluateLinkAvailability,
    fetchLinkById,
    getAccessibleDocumentsForLink,
    getValidVisitorSession,
    getViewerIdentityCookieName,
    getVisitorSessionCookieName,
} from '@/lib/link-access'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function sanitizeFilename(filename: string): string {
    return filename.replace(/[^\w.\-() ]+/g, '_')
}

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

    if (!link.allow_download) {
        return new NextResponse('Downloads are disabled for this link', { status: 403 })
    }

    const validSession = await getValidVisitorSession(supabase, link.id, sessionToken)
    if (!validSession) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const accessibleDocuments = await getAccessibleDocumentsForLink(supabase, link)
    const document = accessibleDocuments.find((item) => item.id === docId)
    if (!document) {
        return new NextResponse('Forbidden', { status: 403 })
    }

    if (document.mime_type !== 'application/pdf' && !document.filename.toLowerCase().endsWith('.pdf')) {
        return new NextResponse('Only PDF downloads are supported in alpha', { status: 400 })
    }

    const { data: rawFile, error: downloadError } = await supabase.storage.from('documents').download(document.storage_path)
    if (downloadError || !rawFile) {
        return new NextResponse('Error downloading source file', { status: 500 })
    }

    const sourceBytes = await rawFile.arrayBuffer()
    const pdfDoc = await PDFDocument.load(sourceBytes)
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const viewerEmail = decodeViewerEmail(cookieStore.get(getViewerIdentityCookieName(link.id))?.value) || validSession.visitor_email || 'viewer'
    const ip = validSession.ip_address || 'unknown-ip'
    const timestamp = new Date().toISOString()

    const { data: room } = await supabase.from('data_rooms').select('name').eq('id', link.room_id).maybeSingle()
    const roomName = room?.name || 'Data Room'
    const watermarkText = `${viewerEmail} | ${ip} | ${timestamp} | ${roomName} | ${document.filename}`

    for (const page of pdfDoc.getPages()) {
        const { width, height } = page.getSize()
        const lineHeight = 120
        const stepX = 240

        for (let y = -height; y < height * 2; y += lineHeight) {
            for (let x = -width; x < width * 2; x += stepX) {
                page.drawText(watermarkText, {
                    x,
                    y,
                    size: 12,
                    font: helvetica,
                    color: rgb(0.55, 0.55, 0.55),
                    rotate: degrees(-32),
                    opacity: 0.2,
                })
            }
        }
    }

    const stampedBytes = await pdfDoc.save()

    await supabase.from('download_events').insert({
        link_id: link.id,
        document_id: document.id,
        viewer_email: viewerEmail,
        visitor_session_token: sessionToken,
        ip_address: validSession.ip_address,
        user_agent: req.headers.get('user-agent'),
        downloaded_at: new Date().toISOString(),
    })

    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set('Content-Disposition', `attachment; filename="${sanitizeFilename(document.filename)}"`)
    headers.set('Cache-Control', 'no-store')

    const payload = new ArrayBuffer(stampedBytes.byteLength)
    new Uint8Array(payload).set(stampedBytes)

    return new NextResponse(payload, { status: 200, headers })
}
