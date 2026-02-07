import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { linkId, docId, page, duration } = await req.json()

    if (!linkId || !docId || !page || !duration) {
        return new NextResponse('Missing fields', { status: 400 })
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(`visitor_session_${linkId}`)?.value

    if (!sessionToken) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get Log ID
    const { data: log } = await supabase
        .from('link_access_logs')
        .select('id')
        .eq('visitor_session_token', sessionToken)
        .eq('link_id', linkId)
        .limit(1)
        .single() // Might be multiple if same user accessed multiple times? Yes.
    // We should probably get the latest one or store logId in cookie? 
    // For MVP, latest is fine or we trust the token is unique enough.

    if (log) {
        await supabase.from('document_analytics').insert({
            access_log_id: log.id,
            document_id: docId,
            page_number: page,
            duration_seconds: duration,
            viewed_at: new Date().toISOString()
        })
    }

    return new NextResponse('OK', { status: 200 })
}
