'use server'

import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEvent } from '@/lib/audit'
import { redirect } from 'next/navigation'

function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
}

export async function acceptTeamInvite(rawToken: string) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const tokenHash = hashToken(rawToken)
    const nowIso = new Date().toISOString()

    const { data: invite } = await supabase
        .from('team_invites')
        .select('id, room_id, email, expires_at, accepted_at, role')
        .eq('token_hash', tokenHash)
        .is('accepted_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle()

    if (!invite) {
        redirect('/dashboard?invite=invalid')
    }

    if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
        redirect('/dashboard?invite=email-mismatch')
    }

    await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: user.email, email: user.email }, { onConflict: 'id' })

    await supabase.from('team_members').upsert({
        room_id: invite.room_id,
        user_id: user.id,
        role: invite.role,
        invited_by: null,
    }, {
        onConflict: 'room_id,user_id',
    })

    await supabase
        .from('team_invites')
        .update({ accepted_at: nowIso, accepted_by: user.id })
        .eq('id', invite.id)
        .is('accepted_at', null)

    await writeAuditEvent(supabase, {
        roomId: invite.room_id,
        actorId: user.id,
        action: 'team.invite_accepted',
        targetType: 'team_invite',
        targetId: invite.id,
        metadata: { email: user.email },
    })

    redirect(`/dashboard/rooms/${invite.room_id}`)
}
