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

export function CreateLinkDialog({ roomId, documentId }: { roomId: string, documentId: string }) {
    const [open, setOpen] = useState(false)
    const [generatedSlug, setGeneratedSlug] = useState<string | null>(null)
    const [requireEmail, setRequireEmail] = useState(true)
    const [copied, setCopied] = useState(false)

    async function handleCreate() {
        const slug = await createLink(roomId, documentId, { require_email: requireEmail })
        setGeneratedSlug(slug)
    }

    function copyToClipboard() {
        const url = `${window.location.origin}/v/${generatedSlug}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) setGeneratedSlug(null) // Reset on close
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share Document</DialogTitle>
                    <DialogDescription>
                        Create a secure link to share this document.
                    </DialogDescription>
                </DialogHeader>

                {!generatedSlug ? (
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="email_gate" checked={requireEmail} onCheckedChange={(c) => setRequireEmail(!!c)} />
                            <Label htmlFor="email_gate">Require Email to View</Label>
                        </div>
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
                        <Button type="button" onClick={handleCreate}>
                            Generate Link
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
