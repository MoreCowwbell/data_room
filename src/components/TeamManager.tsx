'use client'

import { useState, useTransition } from 'react'
import { inviteTeamMember, removeTeamMember, revokeTeamInvite } from '@/app/dashboard/rooms/[roomId]/team-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type TeamMemberItem = {
    userId: string
    email: string
    role: string
}

type TeamInviteItem = {
    id: string
    email: string
    expiresAt: string
}

interface TeamManagerProps {
    roomId: string
    currentRole: 'owner' | 'admin'
    ownerEmail: string
    members: TeamMemberItem[]
    invites: TeamInviteItem[]
}

export function TeamManager({ roomId, currentRole, ownerEmail, members, invites }: TeamManagerProps) {
    const [inviteEmail, setInviteEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleInvite(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setSuccess(null)

        startTransition(async () => {
            try {
                await inviteTeamMember(roomId, inviteEmail)
                setInviteEmail('')
                setSuccess('Invite sent.')
            } catch (inviteError) {
                setError(inviteError instanceof Error ? inviteError.message : 'Failed to send invite')
            }
        })
    }

    function handleRevoke(inviteId: string) {
        setError(null)
        setSuccess(null)
        startTransition(async () => {
            try {
                await revokeTeamInvite(roomId, inviteId)
                setSuccess('Invite revoked.')
            } catch (revokeError) {
                setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke invite')
            }
        })
    }

    function handleRemove(userId: string) {
        if (currentRole !== 'owner') return
        setError(null)
        setSuccess(null)
        startTransition(async () => {
            try {
                await removeTeamMember(roomId, userId)
                setSuccess('Team member removed.')
            } catch (removeError) {
                setError(removeError instanceof Error ? removeError.message : 'Failed to remove team member')
            }
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Team</CardTitle>
                <CardDescription>Owner and admins can manage room content and sharing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <form onSubmit={handleInvite} className="flex gap-2">
                    <Input
                        type="email"
                        placeholder="teammate@company.com"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        required
                    />
                    <Button type="submit" disabled={isPending}>Invite Admin</Button>
                </form>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {success ? <p className="text-sm text-green-600">{success}</p> : null}

                <div className="space-y-2">
                    <h3 className="font-medium text-sm">Members</h3>
                    <div className="space-y-2">
                        <div className="rounded border p-2 text-sm flex justify-between">
                            <span>{ownerEmail || 'Owner'}</span>
                            <span className="text-muted-foreground">owner</span>
                        </div>
                        {members.map((member) => (
                            <div key={member.userId} className="rounded border p-2 text-sm flex justify-between items-center">
                                <span>{member.email}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{member.role}</span>
                                    {currentRole === 'owner' ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            onClick={() => handleRemove(member.userId)}
                                            disabled={isPending}
                                        >
                                            Remove
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {members.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No admin collaborators yet.</p>
                        ) : null}
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="font-medium text-sm">Pending Invites</h3>
                    <div className="space-y-2">
                        {invites.map((invite) => (
                            <div key={invite.id} className="rounded border p-2 text-sm flex justify-between items-center">
                                <div>
                                    <div>{invite.email}</div>
                                    <div className="text-muted-foreground text-xs">
                                        Expires {new Date(invite.expiresAt).toLocaleString()}
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevoke(invite.id)}
                                    disabled={isPending}
                                >
                                    Revoke
                                </Button>
                            </div>
                        ))}
                        {invites.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No pending invites.</p>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
