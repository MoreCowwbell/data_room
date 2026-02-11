'use client'

import { useState, useTransition } from 'react'
import { Upload } from 'lucide-react'
import { saveNdaTemplate } from '@/app/dashboard/rooms/[roomId]/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_NDA_TITLE, DEFAULT_NDA_BODY } from '@/lib/nda-defaults'

interface NdaTemplateFormProps {
    roomId: string
    initialTitle?: string
    initialBody?: string
    version?: number
}

export function NdaTemplateForm({ roomId, initialTitle = '', initialBody = '', version }: NdaTemplateFormProps) {
    const isNewTemplate = !initialTitle && !initialBody
    const [title, setTitle] = useState(isNewTemplate ? DEFAULT_NDA_TITLE : initialTitle)
    const [body, setBody] = useState(isNewTemplate ? DEFAULT_NDA_BODY : initialBody)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const isModifiedFromDefault = body !== DEFAULT_NDA_BODY

    function resetToDefault() {
        setTitle(DEFAULT_NDA_TITLE)
        setBody(DEFAULT_NDA_BODY)
        setSuccess(null)
        setError(null)
        setUploadError(null)
    }

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        setUploadError(null)
        const file = event.target.files?.[0]
        if (!file) return

        if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
            setUploadError('Only .txt files are supported. Paste your NDA text directly, or save it as a .txt file first.')
            event.target.value = ''
            return
        }

        if (file.size > 512 * 1024) {
            setUploadError('File is too large. NDA text files should be under 500 KB.')
            event.target.value = ''
            return
        }

        try {
            const text = await file.text()
            const trimmed = text.trim()
            if (!trimmed) {
                setUploadError('The uploaded file is empty.')
                event.target.value = ''
                return
            }
            setBody(trimmed)
            if (title === DEFAULT_NDA_TITLE || !title) {
                const nameWithoutExt = file.name.replace(/\.txt$/i, '').trim()
                if (nameWithoutExt) setTitle(nameWithoutExt)
            }
            setSuccess(null)
        } catch {
            setUploadError('Failed to read the file. Please try again.')
        }

        event.target.value = ''
    }

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setSuccess(null)

        startTransition(async () => {
            try {
                await saveNdaTemplate(roomId, title, body)
                setSuccess('NDA template saved.')
            } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : 'Failed to save NDA template')
            }
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Room NDA Template</CardTitle>
                <CardDescription>
                    Configure the NDA shown when links are created with &quot;Require NDA&quot;.
                    {version ? ` Current version: v${version}.` : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="grid gap-4">
                    {isNewTemplate && !success ? (
                        <p className="text-sm text-muted-foreground">
                            A default Mutual NDA has been pre-filled. Review and customize the text below, then save.
                        </p>
                    ) : null}

                    <div className="grid gap-2">
                        <Label htmlFor="nda-title">Title</Label>
                        <Input
                            id="nda-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Mutual Non-Disclosure Agreement"
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="nda-body">Agreement Text</Label>
                            <div className="flex items-center gap-2">
                                {isModifiedFromDefault ? (
                                    <button
                                        type="button"
                                        onClick={resetToDefault}
                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                    >
                                        Reset to default
                                    </button>
                                ) : null}
                                <label className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                                    <Upload className="h-3 w-3" />
                                    Upload .txt
                                    <input
                                        type="file"
                                        accept=".txt,text/plain"
                                        onChange={handleFileUpload}
                                        className="sr-only"
                                    />
                                </label>
                            </div>
                        </div>
                        {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
                        <textarea
                            id="nda-body"
                            className="min-h-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            required
                        />
                    </div>

                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    {success ? <p className="text-sm text-green-600">{success}</p> : null}
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save NDA Template'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
