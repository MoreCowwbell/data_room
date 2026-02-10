'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { recordUpload } from '@/app/dashboard/rooms/[roomId]/actions'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export function UploadButton({ roomId, folderId }: { roomId: string, folderId: string | null }) {
    const [uploading, setUploading] = useState(false)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        const isPdfMime = file.type === 'application/pdf'
        const isPdfExtension = file.name.toLowerCase().endsWith('.pdf')
        if (!isPdfMime && !isPdfExtension) {
            alert('Alpha currently supports PDF uploads only.')
            e.target.value = ''
            return
        }

        setUploading(true)

        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${roomId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            await recordUpload(roomId, folderId, filePath, file.name, file.type)
        } catch (error) {
            console.error('Upload failed', error)
            alert('Upload failed')
        } finally {
            setUploading(false)
            // Reset input
            e.target.value = ''
        }
    }

    return (
        <div className="relative">
            <input
                type="file"
                onChange={handleFileChange}
                accept="application/pdf,.pdf"
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={uploading}
            />
            <Button disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
        </div>
    )
}
