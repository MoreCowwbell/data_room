'use client'

import { useState } from 'react'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteFolder, renameFolder } from '@/app/dashboard/rooms/[roomId]/actions'

export function FolderActions({
    roomId,
    folderId,
    folderName,
}: {
    roomId: string
    folderId: string
    folderName: string
}) {
    const [pending, setPending] = useState(false)

    async function handleRename() {
        const nextName = window.prompt('Rename folder', folderName)
        if (nextName === null) return
        const trimmed = nextName.trim()
        if (!trimmed || trimmed === folderName) return

        setPending(true)
        try {
            await renameFolder(roomId, folderId, trimmed)
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to rename folder')
        } finally {
            setPending(false)
        }
    }

    async function handleDelete() {
        const confirmed = window.confirm(`Delete folder "${folderName}" and all of its contents?`)
        if (!confirmed) return

        setPending(true)
        try {
            await deleteFolder(roomId, folderId)
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to delete folder')
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRename}
                disabled={pending}
                aria-label="Rename folder"
            >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDelete}
                disabled={pending}
                aria-label="Delete folder"
            >
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    )
}
