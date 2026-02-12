'use client'

import { useState, useTransition } from 'react'
import { deleteLink, setLinkActiveState, updateLinkFolders } from '@/app/dashboard/rooms/[roomId]/link-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { FolderPicker } from '@/components/FolderPicker'
import { FolderOpen } from 'lucide-react'

type LinkItem = {
    id: string
    slug: string
    name: string | null
    linkType: 'room' | 'folder' | 'document'
    isActive: boolean
    expiresAt: string | null
    maxViews: number | null
    viewCount: number
    allowedFolders: string[]
    folderNames: string[]
}

interface LinkManagerProps {
    roomId: string
    links: LinkItem[]
}

export function LinkManager({ roomId, links }: LinkManagerProps) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [editingLink, setEditingLink] = useState<LinkItem | null>(null)
    const [editFolders, setEditFolders] = useState<string[]>([])
    const [editSaving, setEditSaving] = useState(false)

    function onToggle(linkId: string, nextState: boolean) {
        setError(null)
        startTransition(async () => {
            try {
                await setLinkActiveState(roomId, linkId, nextState)
            } catch (toggleError) {
                setError(toggleError instanceof Error ? toggleError.message : 'Failed to update link')
            }
        })
    }

    function onDelete(linkId: string) {
        const confirmed = window.confirm('Delete this link permanently?')
        if (!confirmed) return
        setError(null)
        startTransition(async () => {
            try {
                await deleteLink(roomId, linkId)
            } catch (deleteError) {
                setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete link')
            }
        })
    }

    function openEditAccess(link: LinkItem) {
        setEditingLink(link)
        setEditFolders(link.allowedFolders)
    }

    async function saveEditAccess() {
        if (!editingLink) return
        setEditSaving(true)
        setError(null)
        try {
            await updateLinkFolders(roomId, editingLink.id, editFolders)
            setEditingLink(null)
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to update folder access')
        } finally {
            setEditSaving(false)
        }
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Shared Links</CardTitle>
                    <CardDescription>Manage active, revoked, and expired links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    {links.map((link) => (
                        <div key={link.id} className="rounded border p-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">{link.name || link.slug}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {link.linkType} • {link.slug}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {link.linkType === 'room' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isPending}
                                            onClick={() => openEditAccess(link)}
                                        >
                                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                            Edit Access
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isPending}
                                        onClick={() => onToggle(link.id, !link.isActive)}
                                    >
                                        {link.isActive ? 'Revoke' : 'Activate'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={isPending}
                                        onClick={() => onDelete(link.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Views: {link.viewCount}
                                {link.maxViews ? ` / ${link.maxViews}` : ''}
                                {link.expiresAt ? ` • Expires ${new Date(link.expiresAt).toLocaleString()}` : ''}
                                {link.isActive ? '' : ' • Revoked'}
                            </div>
                            {link.linkType === 'room' && (
                                <div className="flex flex-wrap gap-1">
                                    {link.allowedFolders.length === 0 ? (
                                        <Badge variant="secondary" className="text-xs">All folders</Badge>
                                    ) : (
                                        <>
                                            {link.folderNames.map((name, i) => (
                                                <Badge key={link.allowedFolders[i]} variant="outline" className="text-xs">
                                                    {name}
                                                </Badge>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {links.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No links created yet.</p>
                    ) : null}
                </CardContent>
            </Card>

            <Dialog open={!!editingLink} onOpenChange={(val) => { if (!val) setEditingLink(null) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Folder Access</DialogTitle>
                        <DialogDescription>
                            Update which folders are shared through this link. Changes take effect immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <FolderPicker
                            roomId={roomId}
                            selectedIds={editFolders}
                            onChange={setEditFolders}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingLink(null)}>
                            Cancel
                        </Button>
                        <Button onClick={saveEditAccess} disabled={editSaving || editFolders.length === 0}>
                            {editSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
