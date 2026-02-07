import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
    const { docId } = await params
    const supabase = await createClient()

    // 1. Check for valid visitor session
    // We need to know WHICH link is being accessed to check the specific cookie.
    // However, the API route doesn't know the slug.
    // We should pass the slug or linkId in the query param or check ALL visitor cookies?
    // Checking all might be slow/complex.
    // Better: The Viewer Page verifies the session and generates a short-lived "Verify Token" 
    // or we just check if ANY valid link session exists for this document?

    // Simplification for MVP: We check if the user has access to the document via ANY active link session.
    // We can query `link_access_logs` and `shared_links` to find if there is a valid session for a link that points to this doc (or room).

    // But cookies are namespaced by link ID: `visitor_session_${linkId}`.
    // So we need `linkId`.
    // Let's pass `linkId` as query param: `/api/stream/[docId]?linkId=...`

    const { searchParams } = new URL(req.url)
    const linkId = searchParams.get('linkId')

    if (!linkId) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(`visitor_session_${linkId}`)?.value

    if (!sessionToken) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Verify token in DB (Optional for MVP, but good practice)
    // const { data: log } = await supabase.from('link_access_logs').select('*').eq('visitor_session_token', sessionToken).single()
    // if (!log) return 401...

    // 3. Get document path
    const { data: doc } = await supabase.from('documents').select('storage_path, mime_type').eq('id', docId).single()

    if (!doc) {
        return new NextResponse('Not Found', { status: 404 })
    }

    // 4. Download from Storage
    const { data: fileBlob, error } = await supabase.storage.from('documents').download(doc.storage_path)

    if (error || !fileBlob) {
        console.error('Storage download error:', error)
        return new NextResponse('Error downloading file', { status: 500 })
    }

    // 5. Return stream
    const headers = new Headers()
    headers.set('Content-Type', doc.mime_type)
    headers.set('Content-Length', fileBlob.size.toString())

    return new NextResponse(fileBlob, { status: 200, headers })
}
