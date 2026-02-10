import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { UploadButton } from '@/components/UploadButton'
import { CreateFolderDialog } from '@/components/CreateFolderDialog'
import { CreateLinkDialog } from '@/components/CreateLinkDialog'
import { FolderActions } from '@/components/FolderActions'
import { DocumentActions } from '@/components/DocumentActions'
import { ThemeToggle } from '@/components/ThemeToggle'
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

    // Fetch room to check access
    const { data: room } = await supabase
        .from('data_rooms')
        .select('*')
        .eq('id', roomId)
        .eq('owner_id', user.id)
        .single()

    if (!room) {
        return notFound()
    }

    // Fetch current folder if not root (to show breadcrumbs/name)
    let currentFolder = null
    if (folderId) {
        const { data } = await supabase.from('folders').select('*').eq('id', folderId).single()
        currentFolder = data
    }

    // Fetch folders
    let foldersQuery = supabase
        .from('folders')
        .select('*')
        .eq('room_id', roomId)

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

    if (folderId) {
        docsQuery = docsQuery.eq('folder_id', folderId)
    } else {
        docsQuery = docsQuery.is('folder_id', null)
    }
    const { data: documents } = await docsQuery

    return (
        <div className="flex flex-col min-h-screen p-8 bg-background text-foreground">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:underline">Dashboard</Link>
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
                                    <FolderActions roomId={roomId} folderId={folder.id} folderName={folder.name} />
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
                                        <CreateLinkDialog roomId={roomId} documentId={doc.id} />
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
        </div>
    )
}
