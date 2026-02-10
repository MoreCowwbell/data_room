import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ message?: string; error?: string }>
}) {
    const props = await searchParams
    const message = props.message
    const error = props.error
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <Card className="mx-auto max-w-sm w-full">
                <CardHeader>
                    <CardTitle className="text-2xl">Login</CardTitle>
                    <CardDescription>
                        Enter your email to access the Data Room
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4">
                        {searchParams?.message && (
                            <div className="p-3 bg-green-100 border border-green-200 text-green-700 rounded text-sm text-center">
                                {searchParams.message}
                            </div>
                        )}
                        {searchParams?.error && (
                            <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded text-sm text-center">
                                {searchParams.error}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="m@example.com"
                                required
                            />
                        </div>
                        <Button formAction={login} className="w-full">
                            Send Login Link
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
