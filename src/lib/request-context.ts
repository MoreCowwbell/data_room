import { headers } from 'next/headers'

export async function getRequestOrigin(): Promise<string> {
    const headerStore = await headers()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    const forwardedHost = headerStore.get('x-forwarded-host')
    const forwardedProto = headerStore.get('x-forwarded-proto') || 'https'
    const host = headerStore.get('host')

    return (
        siteUrl ||
        (forwardedHost
            ? `${forwardedProto}://${forwardedHost}`
            : host
                ? `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${host}`
                : 'http://localhost:3000')
    )
}

export async function getRequestClientMetadata(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0]?.trim() || null : null
    const userAgent = headerStore.get('user-agent')
    return { ipAddress, userAgent }
}
