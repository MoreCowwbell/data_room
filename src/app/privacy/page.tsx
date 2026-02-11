import Link from 'next/link'

export const metadata = {
    title: 'Privacy Policy — OpenVault',
}

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background text-foreground p-8">
            <div className="mx-auto max-w-3xl space-y-6">
                <Link href="/" className="text-sm text-muted-foreground hover:underline">
                    &larr; Back to home
                </Link>

                <h1 className="text-3xl font-bold">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground">Last updated: February 2026</p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Information We Collect</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong>Account data:</strong> When you create an account, we collect your email address
                        for authentication via magic link. We do not collect passwords.
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong>Documents:</strong> Files you upload are stored encrypted and accessible only
                        to your team and authorized viewers.
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong>Engagement data:</strong> When viewers access shared links, we record page views,
                        time spent, and download events to provide engagement analytics to room owners.
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong>Viewer data:</strong> Viewers who access shared links provide their email address
                        for authentication. Their IP address and user agent are recorded for security and analytics.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
                    <ul className="list-disc pl-6 text-sm leading-relaxed text-muted-foreground space-y-1">
                        <li>To authenticate you via magic link or OTP</li>
                        <li>To provide document hosting and sharing functionality</li>
                        <li>To generate engagement analytics for room owners</li>
                        <li>To enforce NDA acceptance before document access</li>
                        <li>To apply watermarks to documents for security</li>
                        <li>To send notifications about document access events</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Cookies</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        We use essential cookies for authentication and session management.
                        Analytics cookies are used to track document engagement when viewers access shared links.
                        You can manage cookie preferences via the cookie consent banner.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">4. Data Sharing</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        We do not sell your data. Document engagement metrics are shared only with the room
                        owner and their authorized team members. If you enable the AI assistant, your data
                        may be sent to the AI provider you select (Anthropic, OpenAI, or Google) using your
                        own API key.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">5. Data Retention</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Documents and engagement data are retained while your account is active.
                        Soft-deleted documents are retained for 30 days before permanent removal.
                        You may request full data deletion by contacting us.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">6. Security</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        All data is transmitted over HTTPS. Documents are stored with Supabase Storage
                        with Row Level Security policies. Viewer sessions expire after 4 hours.
                        Downloaded PDFs are watermarked with viewer identity for traceability.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">7. Your Rights</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Under GDPR/CCPA, you have the right to access, correct, or delete your personal data.
                        Room owners can delete their vaults and all associated data. Viewers can request
                        removal of their engagement data by contacting the room owner.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">8. Contact</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        For privacy-related questions, please open an issue on our GitHub repository or
                        contact the project maintainers.
                    </p>
                </section>
            </div>
        </div>
    )
}
