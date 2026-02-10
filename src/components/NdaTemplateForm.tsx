'use client'

import { useState, useTransition } from 'react'
import { saveNdaTemplate } from '@/app/dashboard/rooms/[roomId]/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NdaTemplateFormProps {
    roomId: string
    initialTitle?: string
    initialBody?: string
    version?: number
}

export function NdaTemplateForm({ roomId, initialTitle = '', initialBody = '', version }: NdaTemplateFormProps) {
    const [title, setTitle] = useState(initialTitle)
    const [body, setBody] = useState(initialBody)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

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
                        <Label htmlFor="nda-body">Agreement Text</Label>
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
