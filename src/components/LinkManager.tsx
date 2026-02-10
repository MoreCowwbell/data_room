'use client'

import { useState, useTransition } from 'react'
import { deleteLink, setLinkActiveState } from '@/app/dashboard/rooms/[roomId]/link-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type LinkItem = {
    id: string
    slug: string
    name: string | null
    linkType: 'room' | 'folder' | 'document'
    isActive: boolean
    expiresAt: string | null
    maxViews: number | null
    viewCount: number
}

interface LinkManagerProps {
    roomId: string
    links: LinkItem[]
}

export function LinkManager({ roomId, links }: LinkManagerProps) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

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

    return (
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
                    </div>
                ))}
                {links.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No links created yet.</p>
                ) : null}
            </CardContent>
        </Card>
    )
}
