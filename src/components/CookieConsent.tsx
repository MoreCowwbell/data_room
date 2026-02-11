'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const CONSENT_KEY = 'cookie_consent'

export function CookieConsent() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const consent = localStorage.getItem(CONSENT_KEY)
        if (!consent) {
            setVisible(true)
        }
    }, [])

    function handleAccept() {
        localStorage.setItem(CONSENT_KEY, 'accepted')
        setVisible(false)
    }

    function handleDecline() {
        localStorage.setItem(CONSENT_KEY, 'declined')
        setVisible(false)
    }

    if (!visible) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    We use essential cookies for authentication and analytics cookies to understand
                    engagement. By continuing, you agree to our{' '}
                    <a href="/privacy" className="underline hover:text-foreground">
                        Privacy Policy
                    </a>
                    .
                </p>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleDecline}>
                        Decline
                    </Button>
                    <Button size="sm" onClick={handleAccept}>
                        Accept
                    </Button>
                </div>
            </div>
        </div>
    )
}
