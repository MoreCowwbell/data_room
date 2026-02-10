'use client'

import { useState } from 'react'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteDocument, renameDocument } from '@/app/dashboard/rooms/[roomId]/actions'

export function DocumentActions({
    roomId,
    documentId,
    filename,
}: {
    roomId: string
    documentId: string
    filename: string
}) {
    const [pending, setPending] = useState(false)

    async function handleRename() {
        const nextName = window.prompt('Rename file', filename)
        if (nextName === null) return
        const trimmed = nextName.trim()
        if (!trimmed || trimmed === filename) return

        setPending(true)
        try {
            await renameDocument(roomId, documentId, trimmed)
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to rename file')
        } finally {
            setPending(false)
        }
    }

    async function handleDelete() {
        const confirmed = window.confirm(`Delete file "${filename}"?`)
        if (!confirmed) return

        setPending(true)
        try {
            await deleteDocument(roomId, documentId)
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to delete file')
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
                aria-label="Rename file"
            >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDelete}
                disabled={pending}
                aria-label="Delete file"
            >
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    )
}
