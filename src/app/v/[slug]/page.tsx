import { createClient } from '@/lib/supabase/server'
import { evaluateLinkAvailability, fetchLinkBySlug, getValidVisitorSession, getVisitorSessionCookieName } from '@/lib/link-access'
import { notFound, redirect } from 'next/navigation'
import { requestViewerMagicLink } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cookies } from 'next/headers'

interface VisitorAuthPageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ message?: string; error?: string }>
}

export default async function VisitorAuthPage({ params, searchParams }: VisitorAuthPageProps) {
    const supabase = await createClient()
    const { slug } = await params
    const { message, error } = await searchParams

    const link = await fetchLinkBySlug(supabase, slug)
    if (!link) {
        return notFound()
    }

    const availability = evaluateLinkAvailability(link, { enforceMaxViews: true })
    if (!availability.allowed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle>Link Unavailable</CardTitle>
                        <CardDescription>{availability.message}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(getVisitorSessionCookieName(link.id))?.value

    if (sessionToken) {
        const validSession = await getValidVisitorSession(supabase, link.id, sessionToken)
        if (validSession) {
            if (link.require_nda) {
                redirect(`/v/${slug}/nda`)
            }
            redirect(`/v/${slug}/view`)
        }
    }

    const bindedAction = requestViewerMagicLink.bind(null, slug)

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle>Secure Document Access</CardTitle>
                    <CardDescription>
                        Enter your email and we will send a secure sign-in link.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={bindedAction} className="grid gap-4">
                        {message ? (
                            <div className="p-3 bg-green-100 border border-green-200 text-green-700 rounded text-sm">
                                {message}
                            </div>
                        ) : null}
                        {error ? (
                            <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded text-sm">
                                {error}
                            </div>
                        ) : null}
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="investor@example.com"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Send Secure Link
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
