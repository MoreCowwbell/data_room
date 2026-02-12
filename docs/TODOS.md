# TODOS — Data Room Alpha

> Items flagged across PRD v2.0, Alpha Execution Plan, and codebase review.
> Status: **Alpha ~95% feature-complete**. Items below are gaps, hardening, and polish.

---

## Critical — Blocks Alpha Testing

- [ ] **Integrate Resend email provider** — `sendEmail()` in `src/lib/email.ts` falls back to `console.log` when `RESEND_API_KEY` is missing. Viewer magic links, first-open notifications, and team invites all depend on real email delivery. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `.env.local`.
- [ ] **Enforce PDF-only uploads in alpha** — Execution plan requires upload validation with clear error messaging. Current `UploadButton` does not reject non-PDF files. Alpha scope is PDF-only viewer; Office conversion is deferred.
- [ ] **Remove debug console.log statements** — `src/app/login/actions.ts:28` logs user emails to console. Clean up before any external testing.

---

## High — Required Before Alpha Exit (PRD M1 Checklist)

- [ ] **Basic privacy policy page** — PRD M1 milestone item. No `/privacy` route exists. Needs simple static page explaining data collection.
- [ ] **Cookie consent for analytics** — PRD Section 8.5: "Cookie consent for analytics." Not implemented; viewer sessions use cookies with no consent banner.
- [ ] **Soft-delete restore UI** — Execution plan: "Add restore workflow for soft-deleted docs/folders in backlog before alpha exit." `deleted_at` columns exist but no UI to recover accidentally deleted items.
- [ ] **Access Groups** — PRD Section 7.3 describes named groups (e.g., "Series A VCs", "Angel Investors") with per-group folder/document rules. `access_groups` and `access_group_rules` tables are in the PRD schema but **not in any migration**, and no UI exists. Decide: build for alpha or defer.

---

## Medium — Hardening & Quality

- [ ] **Regression / threat test suite** — Alpha Execution Plan S1-08: test tampered slugs, expired links, max-views-reached links, revoked links. No test framework is set up (no jest/vitest config). At minimum, create a manual E2E checklist; ideally add automated tests.
- [ ] **Unit tests for permission evaluators** — Execution plan test strategy: "Unit tests for permission evaluators and helper utilities" (`link-access.ts`, `room-access.ts`, `viewer-auth.ts`). No test files exist anywhere in the project.
- [ ] **Integration tests for key routes** — Execution plan: stream auth, link expiry/max views, NDA gating, download enforcement, CSV export. None exist.
- [ ] **Error monitoring (Sentry or equivalent)** — PRD Section 8.4 requires structured error monitoring. Not set up.
- [ ] **Product analytics (PostHog or equivalent)** — PRD Section 8.4 requires product analytics. Not set up (separate from viewer page-view analytics which work).
- [ ] **Email deliverability setup** — PRD Section 14 risk: magic link emails landing in spam. Need SPF/DKIM/DMARC configuration for the sending domain once Resend is live.

---

## Low — Polish & Post-Alpha Prep

- [ ] **Cloudflare Tunnel for external alpha testing** — PRD Section 11 and Execution Plan Section 8: "Use Cloudflare Tunnel for external testing." Not configured. Need to add tunnel URL to Supabase Auth redirect allowlist.
- [ ] **Verify Resend sending domain during Cloudflare migration** — Currently using `onboarding@resend.dev` (sandbox), which only allows sending to the account owner's email. When setting up the Cloudflare domain, verify it in Resend (resend.com/domains), add DNS records (DKIM/SPF/CNAME), and update `RESEND_FROM_EMAIL` to `noreply@yourdomain.com`. Required for magic links, team invites, and notifications to work for external users.
- [ ] **visitor_engagement SQL view** — PRD Section 9 defines a `visitor_engagement` database view for engagement aggregation. Current implementation computes this in application code (`src/lib/engagement.ts`). Consider creating the DB view for consistency and query performance.
- [ ] **Dashboard TTFB performance** — PRD Section 8.2: "<1.5s at p50". Not benchmarked. Dashboard queries may need indexing as data grows.
- [ ] **Viewer first-page render performance** — PRD Section 8.2: "<2.5s for PDFs <10MB at p50". Not benchmarked.
- [ ] **Manual data deletion pathway** — PRD Section 8.5: "Manual data deletion pathway on request." No admin tool or documented process exists.

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

*Last updated: 2026-02-10*