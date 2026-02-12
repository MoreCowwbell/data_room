type SendEmailInput = {
    to: string
    subject: string
    html: string
    text?: string
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'OpenVault <no-reply@example.com>'

    if (!apiKey) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('RESEND_API_KEY is not configured. Email delivery is unavailable.')
        }
        console.warn('[email:noop] RESEND_API_KEY not set — email skipped:', input.subject)
        return
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
        }),
    })

    if (!response.ok) {
        const details = await response.text()
        console.error('Resend error:', details)

        if (process.env.NODE_ENV !== 'production' && response.status === 403) {
            console.warn('[email:dev] Domain not verified — email to', input.to, 'skipped.')
            console.warn('[email:dev] Check the server console for the magic link URL.')
            return
        }

        throw new Error('Failed to send email')
    }
}
