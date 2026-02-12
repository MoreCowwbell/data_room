# Contributing to OpenVault

Thanks for your interest in contributing! This guide covers the conventions and workflow for contributing to OpenVault.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Copy environment config: `cp .env.local.example .env.local`
5. Set up your Supabase project and run migrations (see [README.md](README.md#database-setup))
6. Start dev server: `npm run dev`

## Branch Naming

Use prefixed branch names:

- `feature/` -- New functionality (e.g., `feature/access-groups`)
- `fix/` -- Bug fixes (e.g., `fix/watermark-overlay`)
- `refactor/` -- Code restructuring (e.g., `refactor/engagement-queries`)

## Commit Messages

- Use imperative mood, under 50 characters for the subject line
- Examples: "Add cookie consent banner", "Fix download max views enforcement"
- Do **not** mix bug fixes and refactors in the same commit

## Pull Requests

- Keep PRs small and focused on a single concern
- Include a clear description of what changed and why
- Reference related issues if applicable
- Ensure `npm run build` passes before submitting
- Ensure `npm run lint` passes before submitting

## Code Conventions

### TypeScript
- Type hints for all function signatures
- Use `path` module or Next.js built-in path handling where applicable
- Use Supabase client from `@/lib/supabase/server` (server) or `@/lib/supabase/client` (client)
- Prefer specific exceptions over generic error handling

### React / Next.js
- Server Components by default; use `'use client'` only when necessary
- Server Actions for mutations (`'use server'`)
- Use shadcn/ui components from `@/components/ui/`
- Follow existing patterns for new pages and components

### Security
- Never expose raw files via public URLs
- Parameterized queries only (no string concatenation for SQL)
- Validate inputs on the server side
- No secrets in code, comments, or commits
- All new tables must have RLS policies

### Styling
- Tailwind CSS 4 utility classes
- Follow existing dark mode patterns (`dark:` variants)
- Use `cn()` helper from `@/lib/utils` for conditional classes

## Project Structure

- `src/app/` -- Next.js App Router pages and API routes
- `src/components/` -- React components (shadcn/ui primitives in `ui/`)
- `src/lib/` -- Shared utilities, Supabase clients, business logic
- `supabase/migrations/` -- SQL migration files (run in order)
- `docs/` -- Project documentation (PRD, alpha scope, API reference)

## Environment Variables

Required variables are documented in `.env.local.example`. Never commit `.env.local` or any file containing secrets.

## Questions?

Open an issue for bugs, feature requests, or questions.
