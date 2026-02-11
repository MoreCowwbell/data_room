'use server'

import { requireRoomAccess } from '@/lib/room-access'
import { sendEmail } from '@/lib/email'
import { getRequestOrigin } from '@/lib/request-context'
import { writeAuditEvent } from '@/lib/audit'
import { randomBytes, createHash } from 'crypto'
import { revalidatePath } from 'next/cache'

function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
}

export async function inviteTeamMember(roomId: string, email: string) {
    const { supabase, userId } = await requireRoomAccess(roomId, ['owner', 'admin'])
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
        throw new Error('Email is required')
    }

    const rawToken = randomBytes(24).toString('base64url')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabase
        .from('team_invites')
        .delete()
        .eq('room_id', roomId)
        .eq('email', normalizedEmail)
        .is('accepted_at', null)

    const { error } = await supabase.from('team_invites').insert({
        room_id: roomId,
        email: normalizedEmail,
        role: 'admin',
        token_hash: tokenHash,
        invited_by: userId,
        expires_at: expiresAt,
    })

    if (error) {
        throw new Error('Failed to create invite')
    }

    const origin = await getRequestOrigin()
    const inviteUrl = `${origin}/dashboard/team-invite?token=${encodeURIComponent(rawToken)}`
    await sendEmail({
        to: normalizedEmail,
        subject: 'You have been invited to collaborate on OpenVault',
        html: `<p>You were invited as an admin collaborator.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>This invite expires in 7 days.</p>`,
        text: `You were invited as an admin collaborator.\n${inviteUrl}\n\nThis invite expires in 7 days.`,
    })

    await writeAuditEvent(supabase, {
        roomId,
        actorId: userId,
        action: 'team.invited',
        targetType: 'team_invite',
        metadata: { email: normalizedEmail },
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function revokeTeamInvite(roomId: string, inviteId: string) {
    const { supabase, userId } = await requireRoomAccess(roomId, ['owner', 'admin'])

    const { error } = await supabase
        .from('team_invites')
        .delete()
        .eq('id', inviteId)
        .eq('room_id', roomId)
        .is('accepted_at', null)

    if (error) {
        throw new Error('Failed to revoke invite')
    }

    await writeAuditEvent(supabase, {
        roomId,
        actorId: userId,
        action: 'team.invite_revoked',
        targetType: 'team_invite',
        targetId: inviteId,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}

export async function removeTeamMember(roomId: string, userIdToRemove: string) {
    const access = await requireRoomAccess(roomId, ['owner'])
    const { supabase, userId } = access

    if (userIdToRemove === userId) {
        throw new Error('Owner cannot remove themselves from room')
    }

    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userIdToRemove)

    if (error) {
        throw new Error('Failed to remove team member')
    }

    await writeAuditEvent(supabase, {
        roomId,
        actorId: userId,
        action: 'team.member_removed',
        targetType: 'team_member',
        targetId: userIdToRemove,
    })

    revalidatePath(`/dashboard/rooms/${roomId}`)
}
