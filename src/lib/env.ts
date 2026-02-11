/**
 * Environment variable validation.
 * Call validateEnv() at application startup to catch missing configuration early.
 */

const REQUIRED_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
] as const

const RECOMMENDED_VARS = [
    'NEXT_PUBLIC_SITE_URL',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'AI_KEY_ENCRYPTION_SECRET',
] as const

export function validateEnv(): void {
    const missing: string[] = []
    const warnings: string[] = []

    for (const key of REQUIRED_VARS) {
        if (!process.env[key]) {
            missing.push(key)
        }
    }

    for (const key of RECOMMENDED_VARS) {
        if (!process.env[key]) {
            warnings.push(key)
        }
    }

    if (warnings.length > 0) {
        console.warn(
            `[env] Missing recommended env vars: ${warnings.join(', ')}. Some features may not work.`
        )
    }

    if (missing.length > 0) {
        const message = `Missing required environment variables: ${missing.join(', ')}`
        if (process.env.NODE_ENV === 'production') {
            throw new Error(message)
        }
        console.error(`[env] ${message}`)
    }
}
