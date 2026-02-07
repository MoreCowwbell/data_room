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
import { createFolder } from '@/app/dashboard/rooms/[roomId]/actions'
import { useState } from 'react'
import { Plus } from 'lucide-react'

export function CreateFolderDialog({ roomId, parentId }: { roomId: string, parentId: string | null }) {
    const [open, setOpen] = useState(false)

    async function handleSubmit(formData: FormData) {
        await createFolder(roomId, parentId, formData.get('name') as string)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    New Folder
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Folder</DialogTitle>
                    <DialogDescription>
                        Add a new folder to organize your documents.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="e.g. Financials"
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Create Folder</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
