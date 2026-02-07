import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { UploadButton } from '@/components/UploadButton'
import { CreateFolderDialog } from '@/components/CreateFolderDialog'
import { CreateLinkDialog } from '@/components/CreateLinkDialog'
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
        <div className="flex flex-col min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Link href="/dashboard" className="hover:underline">Dashboard</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href={`/dashboard/rooms/${roomId}`} className="hover:underline">{room.name}</Link>
                {currentFolder && (
                    <>
                        <ChevronRight className="w-4 h-4" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{currentFolder.name}</span>
                    </>
                )}
            </div>

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">
                    {currentFolder ? currentFolder.name : room.name}
                </h1>
                <div className="flex gap-2">
                    <CreateFolderDialog roomId={roomId} parentId={folderId ?? null} />
                    <UploadButton roomId={roomId} folderId={folderId ?? null} />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Date Added</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {folders?.map((folder) => (
                            <TableRow key={folder.id} className="cursor-pointer hover:bg-gray-50">
                                <TableCell><Folder className="w-5 h-5 text-blue-500" /></TableCell>
                                <TableCell>
                                    <Link href={`/dashboard/rooms/${roomId}?folderId=${folder.id}`} className="block w-full h-full">
                                        {folder.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{new Date(folder.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        ))}
                        {documents?.map((doc) => (
                            <TableRow key={doc.id}>
                                <TableCell><FileText className="w-5 h-5 text-gray-500" /></TableCell>
                                <TableCell>{doc.filename}</TableCell>
                                <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>
                                    <CreateLinkDialog roomId={roomId} documentId={doc.id} />
                                </TableCell>
                            </TableRow>
                        ))}
                        {folders?.length === 0 && documents?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
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
