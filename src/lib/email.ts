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
        console.log('[email:noop]', { to: input.to, subject: input.subject })
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
        throw new Error('Failed to send email')
    }
}
