'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLink } from '@/app/dashboard/rooms/[roomId]/link-actions'
import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { Checkbox } from "@/components/ui/checkbox"

type LinkType = 'room' | 'folder' | 'document'

type CreateLinkDialogProps = {
    roomId: string
    linkType: LinkType
    targetId?: string
    targetLabel?: string
}

export function CreateLinkDialog({ roomId, linkType, targetId, targetLabel }: CreateLinkDialogProps) {
    const [open, setOpen] = useState(false)
    const [generatedSlug, setGeneratedSlug] = useState<string | null>(null)
    const [requireEmail, setRequireEmail] = useState(true)
    const [allowDownload, setAllowDownload] = useState(false)
    const [requireNda, setRequireNda] = useState(false)
    const [expiresAt, setExpiresAt] = useState('')
    const [maxViews, setMaxViews] = useState('')
    const [linkName, setLinkName] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const scopeSuffix = `${linkType}-${targetId ?? 'room'}`

    async function handleCreate() {
        setErrorMessage(null)

        const parsedMaxViews = maxViews.trim() ? Number.parseInt(maxViews, 10) : null
        if (parsedMaxViews !== null && (!Number.isInteger(parsedMaxViews) || parsedMaxViews <= 0)) {
            setErrorMessage('Max views must be a positive whole number.')
            return
        }

        try {
            setLoading(true)
            const slug = await createLink({
                roomId,
                linkType,
                targetId: targetId ?? null,
                requireEmail,
                allowDownload,
                requireNda,
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                maxViews: parsedMaxViews,
                name: linkName || null,
            })
            setGeneratedSlug(slug)
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create link')
        } finally {
            setLoading(false)
        }
    }

    function copyToClipboard() {
        const url = `${window.location.origin}/v/${generatedSlug}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const scopeTitle = linkType === 'document'
        ? 'Document'
        : linkType === 'folder'
            ? 'Folder'
            : 'Room'

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) {
                setGeneratedSlug(null)
                setErrorMessage(null)
                setCopied(false)
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share {scopeTitle}</DialogTitle>
                    <DialogDescription>
                        Create a secure link for this {scopeTitle.toLowerCase()}.
                        {targetLabel ? ` ${targetLabel}` : ''}
                    </DialogDescription>
                </DialogHeader>

                {!generatedSlug ? (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor={`link-name-${scopeSuffix}`}>Link Name (Optional)</Label>
                            <Input
                                id={`link-name-${scopeSuffix}`}
                                placeholder={`${scopeTitle} link`}
                                value={linkName}
                                onChange={(event) => setLinkName(event.target.value)}
                                maxLength={120}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id={`email-gate-${scopeSuffix}`} checked={requireEmail} onCheckedChange={(c) => setRequireEmail(!!c)} />
                            <Label htmlFor={`email-gate-${scopeSuffix}`}>Require Email to View</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id={`allow-download-${scopeSuffix}`} checked={allowDownload} onCheckedChange={(c) => setAllowDownload(!!c)} />
                            <Label htmlFor={`allow-download-${scopeSuffix}`}>Allow Download (watermarked endpoint in next sprint)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id={`require-nda-${scopeSuffix}`} checked={requireNda} onCheckedChange={(c) => setRequireNda(!!c)} />
                            <Label htmlFor={`require-nda-${scopeSuffix}`}>Require NDA Before View</Label>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`expires-at-${scopeSuffix}`}>Expires At (Optional)</Label>
                            <Input
                                id={`expires-at-${scopeSuffix}`}
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(event) => setExpiresAt(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`max-views-${scopeSuffix}`}>Max Views (Optional)</Label>
                            <Input
                                id={`max-views-${scopeSuffix}`}
                                type="number"
                                min={1}
                                placeholder="Unlimited"
                                value={maxViews}
                                onChange={(event) => setMaxViews(event.target.value)}
                            />
                        </div>
                        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                    </div>
                ) : (
                    <div className="flex items-center space-x-2 py-4">
                        <div className="grid flex-1 gap-2">
                            <Label htmlFor="link" className="sr-only">
                                Link
                            </Label>
                            <Input
                                id="link"
                                defaultValue={`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${generatedSlug}`}
                                readOnly
                            />
                        </div>
                        <Button size="sm" className="px-3" onClick={copyToClipboard}>
                            <span className="sr-only">Copy</span>
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                )}

                <DialogFooter className="sm:justify-start">
                    {!generatedSlug ? (
                        <Button type="button" onClick={handleCreate} disabled={loading}>
                            {loading ? 'Creating...' : 'Generate Link'}
                        </Button>
                    ) : (
                        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
