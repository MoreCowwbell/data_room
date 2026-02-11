'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createDataRoom } from '@/app/dashboard/room-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'

export function CreateRoomForm() {
    const [template, setTemplate] = useState('empty')

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create New Virtual Data Room</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={createDataRoom} className="space-y-4">
                    <Input
                        name="name"
                        placeholder="e.g. Series A Diligence"
                        required
                    />
                    <input type="hidden" name="template" value={template} />
                    <fieldset className="flex gap-4">
                        <Label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="_template"
                                value="empty"
                                checked={template === 'empty'}
                                onChange={() => setTemplate('empty')}
                                className="accent-primary"
                            />
                            Empty
                        </Label>
                        <Label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="_template"
                                value="fundraising"
                                checked={template === 'fundraising'}
                                onChange={() => setTemplate('fundraising')}
                                className="accent-primary"
                            />
                            Fundraising Template
                        </Label>
                    </fieldset>
                    <Button type="submit">Create</Button>
                </form>
            </CardContent>
        </Card>
    )
}
