import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import type { SharedLinkRecord } from '@/lib/link-access'

async function getRoomRecipientEmails(supabase: SupabaseClient, roomId: string): Promise<string[]> {
    const { data: room } = await supabase
        .from('data_rooms')
        .select('owner_id')
        .eq('id', roomId)
        .maybeSingle()

    if (!room) {
        return []
    }

    const { data: admins } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('room_id', roomId)
        .eq('role', 'admin')

    const userIds = new Set<string>([room.owner_id])
    for (const admin of admins ?? []) {
        userIds.add(admin.user_id)
    }

    const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', [...userIds])

    return [...new Set((profiles ?? []).map((profile) => profile.email?.trim().toLowerCase()).filter(Boolean) as string[])]
}

export async function notifyFirstOpen(
    supabase: SupabaseClient,
    input: {
        link: SharedLinkRecord
        viewerEmail: string
        openedAtIso: string
    }
): Promise<void> {
    const recipients = await getRoomRecipientEmails(supabase, input.link.room_id)
    if (recipients.length === 0) {
        return
    }

    const linkUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/v/${input.link.slug}`
    const subject = `First open: ${input.viewerEmail} viewed ${input.link.name || input.link.slug}`
    const html = `
        <p>A shared link was opened for the first time.</p>
        <ul>
            <li><strong>Viewer:</strong> ${input.viewerEmail}</li>
            <li><strong>Link:</strong> ${input.link.name || input.link.slug}</li>
            <li><strong>Opened at:</strong> ${input.openedAtIso}</li>
        </ul>
        <p><a href="${linkUrl}">Open shared link</a></p>
    `

    for (const recipient of recipients) {
        await supabase.from('notifications').insert({
            room_id: input.link.room_id,
            link_id: input.link.id,
            event_type: 'link.first_open',
            recipient_email: recipient,
            payload: {
                viewer_email: input.viewerEmail,
                opened_at: input.openedAtIso,
                slug: input.link.slug,
            },
            created_at: new Date().toISOString(),
        })

        try {
            await sendEmail({
                to: recipient,
                subject,
                html,
                text: `First open detected.\nViewer: ${input.viewerEmail}\nLink: ${input.link.name || input.link.slug}\nOpened at: ${input.openedAtIso}\n${linkUrl}`,
            })

            await supabase
                .from('notifications')
                .update({ sent_at: new Date().toISOString() })
                .eq('room_id', input.link.room_id)
                .eq('link_id', input.link.id)
                .eq('event_type', 'link.first_open')
                .eq('recipient_email', recipient)
                .is('sent_at', null)
        } catch (error) {
            console.error('Failed to send first-open email:', error)
        }
    }
}
