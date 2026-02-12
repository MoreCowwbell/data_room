# TODOS — Data Room Alpha

> Items flagged across PRD v2.0, Alpha Execution Plan, and codebase review.
> Status: **Alpha ~98% feature-complete**. Security hardening done. Remaining items are quality, testing, and deployment.

---

## Critical — Blocks Alpha Testing

- [x] **Integrate Resend email provider** — `sendEmail()` in `src/lib/email.ts` now uses Resend API. Falls back to `console.log` in dev when key is missing or domain is unverified.
- [x] **Enforce PDF-only uploads in alpha** — `UploadButton.tsx` validates MIME type client-side and rejects non-PDF files.
- [x] **Remove debug console.log statements** — `src/app/login/actions.ts` no longer logs user emails to console.

---

## Security — Resolved

All critical and most high-severity issues from `HEALTH_CHECK_REPORT.md` have been fixed:

- [x] **S1: AES-256-GCM encryption for AI API keys** — Replaced Base64 encoding with proper AES-256-GCM using `AI_KEY_ENCRYPTION_SECRET` env var.
- [x] **S2: Middleware wiring** — False positive. Next.js 16 uses `proxy.ts` (not `middleware.ts`). Already working correctly.
- [x] **S3: Folders API authorization** — Added `getUserRoomAccess()` check. Previously any authenticated user could list any room's folders.
- [x] **S4: Open redirect in auth callback** — Validates `next` parameter rejects `//`, `://`, and non-`/` prefixes.
- [x] **S5/S11: HTML injection in email templates** — Added `escapeHtml()` utility; applied to all dynamic values in notification and magic link emails.
- [x] **S6: Session token hashing** — SHA-256 hash stored in DB instead of plaintext. Raw token stays only in cookie.
- [x] **S8: RLS UPDATE policy for beacon** — `link_access_logs` now has UPDATE policy so `last_active_at` writes succeed.
- [x] **S9: CSP tightened** — Replaced `unsafe-eval` with `wasm-unsafe-eval`; added `worker-src` directive.
- [x] **S10/S21: file_size column** — Added to `documents` table and populated during upload.
- [x] **S12: Download max views enforcement** — False positive; already enforced.
- [x] **S13: File size limit** — 50MB limit enforced client-side and server-side.
- [x] **S16: NDA body sanitization** — False positive; React JSX auto-escapes string content.
- [x] **S17: Scoped storage upload policy** — Upload policy now checks `data_rooms.owner_id` matches storage path.

---

## High — Required Before Alpha Exit (PRD M1 Checklist)

- [x] **Basic privacy policy page** — `/privacy` route exists at `src/app/privacy/page.tsx`.
- [x] **Cookie consent for analytics** — `CookieConsent.tsx` component implemented with accept/decline.
- [x] **Soft-delete restore UI** — `TrashBin.tsx` component with restore functionality for deleted docs/folders.
- [ ] **Access Groups** — PRD Section 7.3 describes named groups with per-group rules. **Not implemented as designed.** Instead, folder-level permissions use a `permissions.allowed_folders` JSONB column on `shared_links` with `FolderPicker.tsx` UI. Decide if named groups are still needed or if the JSONB approach is sufficient.

---

## Medium — Hardening & Quality

- [x] **Rate limiting on viewer auth** — `src/lib/rate-limit.ts` implements sliding window (5 requests / 15 min). Note: in-memory only; needs Redis for production.
- [x] **Environment variable validation** — `src/lib/env.ts` + `src/instrumentation.ts` validates required/recommended vars at startup.
- [ ] **S7: Replace in-memory rate limiter with Redis** — Current rate limiter resets on every deploy/cold start. Needs Upstash Redis or Vercel KV for production.
- [ ] **Regression / threat test suite** — No test framework is set up (no jest/vitest config). At minimum, create a manual E2E checklist; ideally add automated tests.
- [ ] **Unit tests for permission evaluators** — `link-access.ts`, `room-access.ts`, `viewer-auth.ts` have zero test coverage.
- [ ] **Integration tests for key routes** — Stream auth, link expiry/max views, NDA gating, download enforcement, CSV export. None exist.
- [ ] **Error monitoring (Sentry or equivalent)** — PRD Section 8.4 requires structured error monitoring. Not set up.
- [ ] **Product analytics (PostHog or equivalent)** — PRD Section 8.4 requires product analytics. Not set up.
- [ ] **Email deliverability setup** — SPF/DKIM/DMARC configuration for the sending domain once deployed to production.

---

## Low — Polish & Post-Alpha Prep

- [ ] **Deploy to Vercel** — PRD Section 11 production path. See `docs/DEPLOYMENT.md` for migration plan.
- [ ] **Verify Resend sending domain** — Currently using `onboarding@resend.dev` (sandbox). Need to verify production domain in Resend, add DNS records (DKIM/SPF/CNAME), and update `RESEND_FROM_EMAIL`.
- [ ] **Refactor file-serving routes for Vercel** — `/api/stream/[docId]` and `/api/preview/[docId]` proxy entire files through Node, hitting Vercel's 4.5MB response body limit. Refactor to return Supabase signed URL redirects.
- [ ] **visitor_engagement SQL view** — PRD Section 9 defines a DB view. Current implementation computes in application code (`src/lib/engagement.ts`). Consider creating the DB view for query performance.
- [ ] **Dashboard TTFB performance** — PRD Section 8.2: "<1.5s at p50". Not benchmarked. Room page runs 8+ sequential queries.
- [ ] **Viewer first-page render performance** — PRD Section 8.2: "<2.5s for PDFs <10MB at p50". Not benchmarked.
- [ ] **Manual data deletion pathway** — PRD Section 8.5: "Manual data deletion pathway on request." No admin tool exists.
- [ ] **Add /api/health endpoint** — Needed for load balancer health checks and monitoring.
- [ ] **Clean up dead tables** — `viewer_sessions` (S19) and `document_analytics` (S20) are unused/superseded. Consider dropping or documenting as legacy.

---

## Deferred — Post-Alpha (Confirmed)

These are **intentionally out of scope** for alpha per PRD Section 3:

- Document versioning UI
- Q&A module
- Daily digest notifications
- Advanced team roles (Editor, Analyst)
- Direct CRM integrations (HubSpot, Salesforce)
- Redaction tool
- Enterprise SSO/SCIM
- Native mobile app
- SOC2 compliance
- Office file conversion (PPTX, DOCX, KEY, XLSX viewer)
- NDA upload: PDF/DOCX extraction (requires server-side parsing deps)
- NDA rich text body (markdown/HTML support + renderer)
- NDA template library (multiple pre-built templates to choose from)

---

*Last updated: 2026-02-11*
