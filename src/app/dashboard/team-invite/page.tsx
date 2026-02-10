import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { acceptTeamInvite } from './actions'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
}

interface TeamInvitePageProps {
    searchParams: Promise<{ token?: string }>
}

export default async function TeamInvitePage({ searchParams }: TeamInvitePageProps) {
    const { token } = await searchParams
    if (!token) {
        return redirect('/dashboard?invite=invalid')
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const tokenHash = hashToken(token)
    const nowIso = new Date().toISOString()

    const { data: invite } = await supabase
        .from('team_invites')
        .select('id, room_id, email, expires_at, accepted_at')
        .eq('token_hash', tokenHash)
        .is('accepted_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle()

    if (!invite) {
        return redirect('/dashboard?invite=invalid')
    }

    if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return redirect('/dashboard?invite=email-mismatch')
    }

    const boundAccept = acceptTeamInvite.bind(null, token)

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="max-w-lg w-full">
                <CardHeader>
                    <CardTitle>Accept Team Invite</CardTitle>
                    <CardDescription>
                        You were invited as admin collaborator for room ID {invite.room_id}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Signed in as <strong>{user.email}</strong>
                    </p>
                    <form action={boundAccept}>
                        <Button type="submit">Accept Invite</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
