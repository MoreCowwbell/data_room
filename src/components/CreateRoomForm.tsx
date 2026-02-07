'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createDataRoom } from '@/app/dashboard/room-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function CreateRoomForm() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Create New Data Room</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={createDataRoom} className="flex gap-4">
                    <Input
                        name="name"
                        placeholder="e.g. Series A Diligence"
                        required
                        className="flex-1"
                    />
                    <Button type="submit">Create</Button>
                </form>
            </CardContent>
        </Card>
    )
}
