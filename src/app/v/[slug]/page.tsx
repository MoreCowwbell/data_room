import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { submitVisitorAuth } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cookies } from 'next/headers'

export default async function VisitorAuthPage({ params }: { params: Promise<{ slug: string }> }) {
    const supabase = await createClient()
    const { slug } = await params

    const { data: link } = await supabase
        .from('shared_links')
        .select('*')
        .eq('slug', slug)
        .single()

    if (!link || !link.is_active) {
        return notFound()
    }

    // Check if session exists
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(`visitor_session_${link.id}`)?.value

    if (sessionToken) {
        // Validate token in DB? For MVP assuming cookie presence is enough if signed/httpOnly, 
        // but ideally we check DB.
        // Let's redirect to view
        redirect(`/v/${slug}/view`)
    }

    const bindedAction = submitVisitorAuth.bind(null, slug)

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle>Secure Document Access</CardTitle>
                    <CardDescription>
                        Please enter your email to access this document.
                        The owner has requested identity verification.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={bindedAction} className="grid gap-4">
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
                            Access Document
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
