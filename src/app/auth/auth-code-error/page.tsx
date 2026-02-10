import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AuthCodeErrorPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <Card className="mx-auto max-w-md w-full">
                <CardHeader>
                    <CardTitle>Authentication Failed</CardTitle>
                    <CardDescription>
                        The login link is invalid or has expired. Request a new one and try again.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <Link href="/login">Back to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
