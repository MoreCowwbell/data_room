'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Download, ExternalLink, FileText } from 'lucide-react'
import dynamic from 'next/dynamic'

const SecureDocumentViewer = dynamic(() => import('@/components/SecureDocumentViewer'), {
    ssr: false,
})

export function DocumentPreviewDialog({
    roomId,
    documentId,
    filename,
    role,
    userEmail,
}: {
    roomId: string
    documentId: string
    filename: string
    role: 'owner' | 'admin'
    userEmail: string
}) {
    const [open, setOpen] = useState(false)
    const previewUrl = `/api/preview/${documentId}?roomId=${roomId}`
    const downloadUrl = `${previewUrl}&download=1`

    return (
        <>
            <button
                type="button"
                className="text-left hover:underline cursor-pointer font-medium"
                onClick={() => setOpen(true)}
            >
                <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    {filename}
                </span>
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between space-y-0">
                        <DialogTitle className="truncate pr-8">{filename}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <a href={downloadUrl} download>
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    New Tab
                                </a>
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto min-h-0">
                        {open && role === 'owner' ? (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border-0"
                                title={filename}
                            />
                        ) : open && role === 'admin' ? (
                            <SecureDocumentViewer
                                docUrl={previewUrl}
                                watermarkText={`${userEmail} | ${new Date().toISOString().split('T')[0]}`}
                            />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
