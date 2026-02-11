import { createClient } from '@/lib/supabase/server'
import { getRoomEngagementRows, toCsv } from '@/lib/engagement'
import { getUserRoomAccess } from '@/lib/room-access'
import { NextRequest, NextResponse } from 'next/server'

const CSV_EXPORT_CAP = 10000

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
    const supabase = await createClient()
    const { roomId } = await params

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const access = await getUserRoomAccess(roomId)
    if (!access) {
        return new NextResponse('Not found', { status: 404 })
    }

    if (access.role !== 'owner' && access.role !== 'admin') {
        return new NextResponse('Forbidden', { status: 403 })
    }

    const url = new URL(req.url)
    const filters = {
        search: url.searchParams.get('search') || undefined,
        domain: url.searchParams.get('domain') || undefined,
        linkId: url.searchParams.get('linkId') || undefined,
        documentId: url.searchParams.get('documentId') || undefined,
        from: url.searchParams.get('from') || undefined,
        to: url.searchParams.get('to') || undefined,
    }

    const rows = await getRoomEngagementRows(supabase, roomId, filters)
    const limitedRows = rows.slice(0, CSV_EXPORT_CAP)
    const csv = toCsv(limitedRows)

    const headers = new Headers()
    headers.set('Content-Type', 'text/csv; charset=utf-8')
    headers.set('Content-Disposition', `attachment; filename="engagement-${roomId}.csv"`)
    headers.set('Cache-Control', 'no-store')
    headers.set('X-Export-Limit-Reached', rows.length > CSV_EXPORT_CAP ? 'true' : 'false')

    return new NextResponse(csv, { status: 200, headers })
}
