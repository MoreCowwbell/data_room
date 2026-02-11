import { createClient } from '@/lib/supabase/server'
import { getUserRoomAccess } from '@/lib/room-access'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
    const { docId } = await params
    const { searchParams } = new URL(req.url)
    const roomId = searchParams.get('roomId')
    const download = searchParams.get('download') === '1'

    if (!roomId) {
        return new NextResponse('Missing roomId', { status: 400 })
    }

    const access = await getUserRoomAccess(roomId)
    if (!access) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = await createClient()

    const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('id, storage_path, filename, mime_type')
        .eq('id', docId)
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .single()

    if (docError || !doc) {
        return new NextResponse('Document not found', { status: 404 })
    }

    const { data: fileBlob, error: storageError } = await supabase.storage
        .from('documents')
        .download(doc.storage_path)

    if (storageError || !fileBlob) {
        console.error('Storage download error:', storageError)
        return new NextResponse('Error downloading file', { status: 500 })
    }

    const disposition = download
        ? `attachment; filename="${doc.filename.replace(/"/g, '\\"')}"`
        : 'inline'

    const headers = new Headers()
    headers.set('Content-Type', doc.mime_type)
    headers.set('Content-Length', fileBlob.size.toString())
    headers.set('Content-Disposition', disposition)
    headers.set('Cache-Control', 'private, no-store')

    return new NextResponse(fileBlob, { status: 200, headers })
}
