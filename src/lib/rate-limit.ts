/**
 * Simple in-memory sliding window rate limiter.
 * For production, replace with Redis-backed implementation.
 */
const windows = new Map<string, number[]>()

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const timestamps = windows.get(key) ?? []

    // Remove expired entries
    const valid = timestamps.filter((t) => now - t < windowMs)

    if (valid.length >= maxRequests) {
        windows.set(key, valid)
        return true
    }

    valid.push(now)
    windows.set(key, valid)
    return false
}

// Periodic cleanup to prevent memory leaks (runs every 5 min)
if (typeof globalThis !== 'undefined') {
    const CLEANUP_INTERVAL = 5 * 60 * 1000
    const MAX_WINDOW_AGE = 60 * 60 * 1000 // 1 hour

    setInterval(() => {
        const now = Date.now()
        for (const [key, timestamps] of windows.entries()) {
            const valid = timestamps.filter((t) => now - t < MAX_WINDOW_AGE)
            if (valid.length === 0) {
                windows.delete(key)
            } else {
                windows.set(key, valid)
            }
        }
    }, CLEANUP_INTERVAL).unref?.()
}
