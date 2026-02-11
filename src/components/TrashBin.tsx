'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { restoreDocument, restoreFolder } from '@/app/dashboard/rooms/[roomId]/actions'

type DeletedItem = {
    id: string
    name: string
    type: 'folder' | 'document'
    deletedAt: string
}

export function TrashBin({ roomId, items }: { roomId: string; items: DeletedItem[] }) {
    const [expanded, setExpanded] = useState(false)
    const [pending, setPending] = useState<string | null>(null)

    if (items.length === 0) return null

    async function handleRestore(item: DeletedItem) {
        setPending(item.id)
        try {
            if (item.type === 'document') {
                await restoreDocument(roomId, item.id)
            } else {
                await restoreFolder(roomId, item.id)
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to restore')
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="rounded-lg border bg-card p-4">
            <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => setExpanded(!expanded)}
            >
                <h2 className="font-semibold flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Trash ({items.length})
                </h2>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
                <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                        Deleted items are kept for 30 days before permanent removal.
                    </p>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between rounded border p-2 text-sm"
                        >
                            <div>
                                <span className="font-medium">{item.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                    {item.type} &middot; deleted {new Date(item.deletedAt).toLocaleDateString()}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestore(item)}
                                disabled={pending === item.id}
                            >
                                {pending === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                )}
                                Restore
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
