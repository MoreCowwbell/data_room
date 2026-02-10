'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
    function toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark')
        const nextIsDark = !isDark
        document.documentElement.classList.toggle('dark', nextIsDark)
        localStorage.setItem('theme', nextIsDark ? 'dark' : 'light')
    }

    return (
        <Button variant="outline" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
            <Sun className="mr-2 hidden h-4 w-4 dark:inline" />
            <Moon className="mr-2 inline h-4 w-4 dark:hidden" />
            <span className="hidden dark:inline">Light</span>
            <span className="inline dark:hidden">Dark</span>
        </Button>
    )
}
