import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { UploadButton } from '@/components/UploadButton'
import { CreateFolderDialog } from '@/components/CreateFolderDialog'
import { CreateLinkDialog } from '@/components/CreateLinkDialog'
import { FolderActions } from '@/components/FolderActions'
import { DocumentActions } from '@/components/DocumentActions'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { NdaTemplateForm } from '@/components/NdaTemplateForm'
import { TeamManager } from '@/components/TeamManager'
import { LinkManager } from '@/components/LinkManager'
import { DeleteVaultDialog } from '@/components/DeleteVaultDialog'
import { AiPanel } from '@/components/AiPanel'
import { getUserRoomAccess } from '@/lib/room-access'
import { Folder, FileText, ChevronRight } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface PageProps {
    params: Promise<{ roomId: string }>
    searchParams: Promise<{ folderId?: string }>
}

export default async function RoomPage({ params, searchParams }: PageProps) {
    const supabase = await createClient()
    const { roomId } = await params
    const { folderId } = await searchParams || {}

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

    // Fetch room to check access
    const { data: room } = await supabase
        .from('data_rooms')
        .select('*')
        .eq('id', roomId)
        .single()

    if (!room) {
        return notFound()
    }

    // Fetch current folder if not root (to show breadcrumbs/name)
    let currentFolder = null
    if (folderId) {
        const { data } = await supabase.from('folders').select('*').eq('id', folderId).is('deleted_at', null).single()
        currentFolder = data
    }

    // Fetch folders
    let foldersQuery = supabase
        .from('folders')
        .select('*')
        .eq('room_id', roomId)
        .is('deleted_at', null)

    if (folderId) {
        foldersQuery = foldersQuery.eq('parent_id', folderId)
    } else {
        foldersQuery = foldersQuery.is('parent_id', null)
    }
    const { data: folders } = await foldersQuery


    // Fetch documents
    let docsQuery = supabase
        .from('documents')
        .select('*')
        .eq('room_id', roomId)
        .is('deleted_at', null)

    if (folderId) {
        docsQuery = docsQuery.eq('folder_id', folderId)
    } else {
        docsQuery = docsQuery.is('folder_id', null)
    }
    const { data: documents } = await docsQuery

    const { data: ndaTemplate } = await supabase
        .from('nda_templates')
        .select('title, body, version')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .maybeSingle()

    const { data: auditEvents } = await supabase
        .from('audit_events')
        .select('id, action, target_type, created_at, metadata')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(20)

    const { data: sharedLinks } = await supabase
        .from('shared_links')
        .select('id, slug, name, link_type, is_active, expires_at, max_views, view_count')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })

    const [{ data: ownerProfile }, { data: members }, { data: invites }] = await Promise.all([
        supabase.from('profiles').select('email').eq('id', room.owner_id).maybeSingle(),
        supabase
            .from('team_members')
            .select('user_id, role')
            .eq('room_id', roomId)
            .neq('user_id', room.owner_id)
            .order('created_at', { ascending: true }),
        supabase
            .from('team_invites')
            .select('id, email, expires_at')
            .eq('room_id', roomId)
            .is('accepted_at', null)
            .order('created_at', { ascending: false }),
    ])

    const memberUserIds = (members ?? []).map((member) => member.user_id)
    const { data: memberProfiles } = memberUserIds.length > 0
        ? await supabase.from('profiles').select('id, email').in('id', memberUserIds)
        : { data: [] as Array<{ id: string; email: string | null }> }
    const memberEmailById = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile.email || 'unknown']))

    return (
        <div className="flex flex-col min-h-screen p-8 bg-background text-foreground">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:underline">Your Vaults</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href={`/dashboard/rooms/${roomId}`} className="hover:underline">{room.name}</Link>
                {currentFolder && (
                    <>
                        <ChevronRight className="w-4 h-4" />
                        <span className="font-medium text-foreground">{currentFolder.name}</span>
                    </>
                )}
            </div>

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">
                    {currentFolder ? currentFolder.name : room.name}
                </h1>
                <div className="flex gap-2">
                    <ThemeToggle />
                    <AiPanel roomId={roomId} />
                    <Button asChild variant="outline">
                        <Link href={`/dashboard/rooms/${roomId}/engagement`}>Engagement</Link>
                    </Button>
                    <CreateLinkDialog roomId={roomId} linkType="room" targetLabel={room.name} />
                    <CreateFolderDialog roomId={roomId} parentId={folderId ?? null} />
                    <UploadButton roomId={roomId} folderId={folderId ?? null} />
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Date Added</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead className="w-[220px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {folders?.map((folder) => (
                            <TableRow key={folder.id} className="hover:bg-muted/60">
                                <TableCell><Folder className="w-5 h-5 text-blue-500" /></TableCell>
                                <TableCell>
                                    <Link href={`/dashboard/rooms/${roomId}?folderId=${folder.id}`} className="block w-full h-full">
                                        {folder.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{new Date(folder.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-end gap-1">
                                        <CreateLinkDialog
                                            roomId={roomId}
                                            linkType="folder"
                                            targetId={folder.id}
                                            targetLabel={folder.name}
                                        />
                                        <FolderActions roomId={roomId} folderId={folder.id} folderName={folder.name} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {documents?.map((doc) => (
                            <TableRow key={doc.id}>
                                <TableCell><FileText className="w-5 h-5 text-muted-foreground" /></TableCell>
                                <TableCell>{doc.filename}</TableCell>
                                <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-end gap-1">
                                        <CreateLinkDialog
                                            roomId={roomId}
                                            linkType="document"
                                            targetId={doc.id}
                                            targetLabel={doc.filename}
                                        />
                                        <DocumentActions roomId={roomId} documentId={doc.id} filename={doc.filename} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {folders?.length === 0 && documents?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                    Empty folder
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-8">
                <LinkManager
                    roomId={roomId}
                    links={(sharedLinks ?? []).map((link) => ({
                        id: link.id,
                        slug: link.slug,
                        name: link.name,
                        linkType: link.link_type,
                        isActive: link.is_active,
                        expiresAt: link.expires_at,
                        maxViews: link.max_views,
                        viewCount: link.view_count ?? 0,
                    }))}
                />
            </div>

            <div className="mt-8">
                <NdaTemplateForm
                    roomId={roomId}
                    initialTitle={ndaTemplate?.title}
                    initialBody={ndaTemplate?.body}
                    version={ndaTemplate?.version}
                />
            </div>

            <div className="mt-8">
                <TeamManager
                    roomId={roomId}
                    currentRole={access.role}
                    ownerEmail={ownerProfile?.email || room.owner_id}
                    members={(members ?? []).map((member) => ({
                        userId: member.user_id,
                        email: memberEmailById.get(member.user_id) || member.user_id,
                        role: member.role,
                    }))}
                    invites={(invites ?? []).map((invite) => ({
                        id: invite.id,
                        email: invite.email,
                        expiresAt: invite.expires_at,
                    }))}
                />
            </div>

            <div className="mt-8 rounded-lg border bg-card p-4">
                <h2 className="font-semibold mb-3">Audit Log</h2>
                <div className="space-y-2">
                    {(auditEvents ?? []).map((event) => (
                        <div key={event.id} className="rounded border p-2 text-sm">
                            <div className="font-medium">{event.action}</div>
                            <div className="text-muted-foreground">
                                {event.target_type} • {new Date(event.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                    {(auditEvents ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No audit events yet.</p>
                    ) : null}
                </div>
            </div>

            {access.role === 'owner' && (
                <div className="mt-8 rounded-lg border border-destructive/50 bg-card p-4">
                    <h2 className="font-semibold mb-1 text-destructive">Danger Zone</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Permanently delete this vault and all of its data. This action cannot be undone.
                    </p>
                    <DeleteVaultDialog roomId={roomId} roomName={room.name} />
                </div>
            )}
        </div>
    )
}
