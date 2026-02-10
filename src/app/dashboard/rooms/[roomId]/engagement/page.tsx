import { createClient } from '@/lib/supabase/server'
import { getRoomEngagementRows } from '@/lib/engagement'
import { getUserRoomAccess } from '@/lib/room-access'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface EngagementPageProps {
    params: Promise<{ roomId: string }>
    searchParams: Promise<{
        search?: string
        domain?: string
        linkId?: string
        documentId?: string
        from?: string
        to?: string
    }>
}

export default async function EngagementPage({ params, searchParams }: EngagementPageProps) {
    const supabase = await createClient()
    const { roomId } = await params
    const filters = await searchParams

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const access = await getUserRoomAccess(roomId)
    if (!access) {
        return notFound()
    }

    const [{ data: room }, { data: links }, { data: documents }] = await Promise.all([
        supabase.from('data_rooms').select('id, name').eq('id', roomId).maybeSingle(),
        supabase.from('shared_links').select('id, slug, name').eq('room_id', roomId).order('created_at', { ascending: false }),
        supabase.from('documents').select('id, filename').eq('room_id', roomId).is('deleted_at', null).order('filename', { ascending: true }),
    ])

    if (!room) {
        return notFound()
    }

    const rows = await getRoomEngagementRows(supabase, roomId, filters)
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.domain) query.set('domain', filters.domain)
    if (filters.linkId) query.set('linkId', filters.linkId)
    if (filters.documentId) query.set('documentId', filters.documentId)
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)

    const csvHref = `/api/rooms/${roomId}/engagement.csv${query.toString() ? `?${query.toString()}` : ''}`

    return (
        <div className="min-h-screen p-8 bg-background text-foreground">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Engagement Dashboard</h1>
                        <p className="text-sm text-muted-foreground">{room.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline">
                            <Link href={`/dashboard/rooms/${roomId}`}>Back to Room</Link>
                        </Button>
                        <Button asChild>
                            <a href={csvHref}>Export CSV</a>
                        </Button>
                    </div>
                </div>

                <form className="grid grid-cols-1 md:grid-cols-6 gap-3 border rounded-lg p-4 bg-card">
                    <Input name="search" placeholder="Search email, link, slug" defaultValue={filters.search || ''} />
                    <Input name="domain" placeholder="Domain (e.g. fund.com)" defaultValue={filters.domain || ''} />
                    <select
                        name="linkId"
                        defaultValue={filters.linkId || ''}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                        <option value="">All links</option>
                        {(links ?? []).map((link) => (
                            <option key={link.id} value={link.id}>
                                {link.name || link.slug}
                            </option>
                        ))}
                    </select>
                    <select
                        name="documentId"
                        defaultValue={filters.documentId || ''}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                        <option value="">All documents</option>
                        {(documents ?? []).map((document) => (
                            <option key={document.id} value={document.id}>
                                {document.filename}
                            </option>
                        ))}
                    </select>
                    <Input type="date" name="from" defaultValue={filters.from || ''} />
                    <div className="flex gap-2">
                        <Input type="date" name="to" defaultValue={filters.to || ''} />
                        <Button type="submit" variant="outline">Apply</Button>
                    </div>
                </form>

                <div className="rounded-lg border bg-card overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Link</TableHead>
                                <TableHead>First View</TableHead>
                                <TableHead>Last View</TableHead>
                                <TableHead>Sessions</TableHead>
                                <TableHead>Time (s)</TableHead>
                                <TableHead>Docs</TableHead>
                                <TableHead>Pages</TableHead>
                                <TableHead>Downloads</TableHead>
                                <TableHead>NDA</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={`${row.linkId}-${row.email}`}>
                                    <TableCell>{row.email}</TableCell>
                                    <TableCell>{row.linkName}</TableCell>
                                    <TableCell>{new Date(row.firstViewAt).toLocaleString()}</TableCell>
                                    <TableCell>{new Date(row.lastViewAt).toLocaleString()}</TableCell>
                                    <TableCell>{row.sessions}</TableCell>
                                    <TableCell>{row.totalTimeSeconds.toFixed(1)}</TableCell>
                                    <TableCell>{row.docsViewed}</TableCell>
                                    <TableCell>{row.pagesViewed}</TableCell>
                                    <TableCell>{row.downloads}</TableCell>
                                    <TableCell>{row.ndaAccepted ? 'Accepted' : 'Pending'}</TableCell>
                                </TableRow>
                            ))}
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                                        No engagement data for this filter set.
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
