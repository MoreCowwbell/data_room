'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { deleteDataRoom } from '@/app/dashboard/room-actions'
import { Trash2 } from 'lucide-react'

export function DeleteVaultDialog({ roomId, roomName }: { roomId: string; roomName: string }) {
    const [open, setOpen] = useState(false)
    const [confirmation, setConfirmation] = useState('')
    const [isPending, startTransition] = useTransition()

    const canDelete = confirmation === roomName

    function handleDelete() {
        startTransition(async () => {
            await deleteDataRoom(roomId)
        })
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirmation('') }}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Vault
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Delete Vault</DialogTitle>
                    <DialogDescription>
                        This action is permanent and cannot be undone. All documents, folders,
                        shared links, and analytics data will be permanently deleted.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        To confirm, type <span className="font-semibold text-foreground">{roomName}</span> below:
                    </p>
                    <Input
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder={roomName}
                        autoComplete="off"
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="destructive"
                        disabled={!canDelete || isPending}
                        onClick={handleDelete}
                    >
                        {isPending ? 'Deleting...' : 'Permanently Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
