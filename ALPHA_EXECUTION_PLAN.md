# Alpha Execution Plan (From PRD v2.0)

## 1. Purpose
Convert `PRD.md` into an implementation sequence that can be executed step-by-step without re-planning every sprint.

## 2. Baseline (Already Complete)
- Admin magic-link auth
- Room/folder/document CRUD basics
- Document-level share links
- Secure viewer + basic watermark overlay
- Basic analytics ingestion
- Dark mode and core dashboard UX

## 3. Alpha Scope Locked From PRD
- Viewer auth via magic link
- Full link scope support: room, folder, document
- Link constraints: expiration, max views, active/revoke
- Engagement dashboard + CSV export
- Burned watermark downloads (default off, opt-in per link)
- NDA gate + acceptance logging
- Immediate first-open email notifications
- Owner/Admin team model
- Audit logging for sensitive actions

## 4. Workstreams and Order

## WS1: Data Model and RLS Foundation
### Deliverables
- New migrations for:
- `shared_links` expansion (`link_type`, `folder_id`, `name`, `require_nda`, `allow_download`, `expires_at`, `max_views`)
- `viewer_sessions`, `page_views` normalization (or migration from existing logs)
- `nda_templates`, `nda_acceptances`
- `download_events`, `audit_events`, `notifications`
- `team_members`
- Soft-delete support for documents and folders (`deleted_at`, restore flow support)
- Link delete strategy: hard delete for links
- RLS policies for all new tables and revised link access rules.

### Exit Criteria
- Migrations apply cleanly on fresh and existing local DB.
- No anonymous read path exists outside intended viewer flow.

## WS2: Sharing Model Upgrade (Room/Folder/Document)
### Deliverables
- Shared link creation UI supports `room|folder|document`.
- Permission evaluation function in server layer:
- validates link active/expiry/max views
- resolves allowed doc set for room/folder scope
- Existing stream route updated to enforce scoped permissions.

### Exit Criteria
- A folder link cannot open docs outside folder subtree.
- Expired/revoked links fail consistently with user-friendly errors.

## WS3: Viewer Magic-Link Auth Flow
### Deliverables
- Replace simple email gate with viewer magic-link verification flow.
- Dedicated routes:
- `/v/[slug]` email submit
- `/v/[slug]/auth` verify callback
- `/v/[slug]/nda` if required
- Session issuance scoped to link and TTL=24h.

### Exit Criteria
- Viewer can only access content after email verification.
- Session reuse across different links is blocked.

## WS4: NDA Gate + Acceptance Logging
### Deliverables
- NDA template UI in room settings.
- NDA acceptance screen and storage with template hash/version.
- Enforcement hook in viewer entry flow.

### Exit Criteria
- `require_nda=true` always forces acceptance before view/download.
- Acceptance audit record is queryable per link/email.

## WS5: Burned Watermark Downloads
### Deliverables
- `/api/download/[docId]` protected endpoint.
- Server-side PDF watermark stamping (email, IP, timestamp, company, doc name).
- Download permission checks (`allow_download`, scope checks).

### Exit Criteria
- Downloaded file is stamped.
- Clean source file is never exposed.

## WS6: Engagement Dashboard + CSV Export
### Deliverables
- New dashboard page for investor engagement table.
- Sorting/filtering/search by email/domain/link/date/document.
- CSV export route with filtered dataset.
- Metrics include first/last view, total time, sessions, docs viewed, pages viewed, downloads, nda status.

### Exit Criteria
- Founder can export usable CSV for CRM import.
- Metrics match raw events for sampled sessions.

## WS7: Notifications and Audit Logs
### Deliverables
- First-open event detection.
- Email notification dispatch via Resend.
- Audit log writes for sensitive actions (links, permissions, deletes, NDA/template changes).

### Exit Criteria
- First open generates one notification event per viewer/link policy and sends to owner + admins.
- Audit feed contains actor, action, target, timestamp.

## WS8: Team Roles (Owner/Admin)
### Deliverables
- Team invite/accept flow.
- Room-level role checks in server actions and route guards.

### Exit Criteria
- Admin can manage room content and sharing.
- Admin cannot transfer ownership/delete room if excluded by policy.

## 5. Sprint Plan (Suggested)

## Sprint 1
- WS1 + WS2
- Result: robust scoped links and policy-safe foundation

## Sprint 2
- WS3 + WS4
- Result: secure viewer auth + NDA gating

## Sprint 3
- WS5 + WS6
- Result: secure downloads + investor engagement dashboard

## Sprint 4
- WS7 + WS8 + hardening
- Result: alpha-complete operational feature set

## 6. Test Strategy Per Sprint
- Unit tests for permission evaluators and helper utilities.
- Integration tests for key routes:
- stream auth
- link expiry/max views
- nda gating
- download enforcement
- CSV export
- Manual E2E checklist with two browsers (founder + investor).

## 7. Definition of Done (Alpha)
- Every PRD alpha acceptance criterion in `PRD.md` section 13 has:
- implementation
- test evidence
- manual validation note
- No critical RLS or auth bypass findings in internal review.
- Cloudflare Tunnel UAT run with external tester completed.

## 8. Deployment Path for Alpha
- Continue local-first development.
- Use Cloudflare Tunnel for external testing.
- Keep Supabase hosted (Auth/DB/Storage) and deploy app to Vercel preview for broader alpha.

## 9. Implementation Backlog (Initial Ticket Breakdown)
- A1: Schema migration pack for link scope + constraints.
- A2: RLS policy pack for scoped view/download.
- A3: Link creation UI upgrade.
- A4: Viewer magic-link auth routes and session issuance.
- A5: NDA template CRUD + acceptance flow.
- A6: PDF watermark download endpoint.
- A7: Engagement dashboard table + filters.
- A8: CSV export API.
- A9: First-open notification event + email sender integration.
- A10: Audit event writer middleware/helpers.
- A11: Team invite/role enforcement.
- A12: Alpha UAT checklist and bugfix pass.

## 10. Locked Alpha Decisions (Confirmed)
1. Notifications provider: Resend.
2. External alpha tunnel: Cloudflare Tunnel.
3. File support in alpha: PDF-only viewer; Office conversion deferred.
4. Soft-delete scope: documents + folders; links use hard delete.
5. First-open alerts: owner + admins.
6. NDA disclaimer: required, shown to founder during setup only.
7. CSV export cap: 10,000 rows per request.

## 11. Planning Notes for Execution
- Enforce PDF-only uploads in alpha with clear validation error messaging.
- Add restore workflow for soft-deleted docs/folders in backlog before alpha exit.
- Keep link delete permanent to reduce access-control ambiguity.
- Include NDA disclaimer acknowledgment state in room settings data model.
- Apply CSV cap at query layer and return a clear "limit reached" signal.

## 12. Next Planning Phase: Sprint 1 Work Package (Ready)
## Goal
Ship data model and permission foundation for full-scope links (room/folder/document) with hard security boundaries.

## Tickets
- S1-01: Migration pack for `shared_links` scope fields and constraints.
- S1-02: Migration pack for soft-delete (`deleted_at`) on documents and folders + recovery indexes.
- S1-03: Migration pack for `audit_events`, `notifications`, and role tables required by future sprints.
- S1-04: RLS policy update for scoped link access evaluation across room/folder/document.
- S1-05: Server permission resolver utility for stream/download eligibility.
- S1-06: Link creation/update UI model update to support `link_type` + constraints.
- S1-07: Stream route enforcement refactor using shared permission resolver.
- S1-08: Regression and threat checks (tampered slug, expired link, max views reached, revoked link).

## Sprint 1 Exit Checks
- Full migration chain applies on existing local DB without manual patching.
- A room link opens all allowed docs; folder link only subtree docs; document link only one doc.
- Expired/revoked/max-view links are blocked with expected error states.
- No direct document stream succeeds without valid scoped viewer authorization.

## 13. Dependencies for Sprint 2
- Stable link scope model from Sprint 1.
- Reusable resolver from S1-05 for viewer magic-link and NDA flow.
- Audit event hooks available for auth and acceptance events.
