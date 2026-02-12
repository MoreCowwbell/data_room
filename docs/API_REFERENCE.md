# API Reference

> Reflects the actual implemented routes and data flows as of 2026-02-11.

---

## Page Routes (Server Components)

### Dashboard (Authenticated via Supabase Auth)

| Route | Description |
|-------|-------------|
| `/login` | Magic link login |
| `/dashboard` | Room list (owned + team rooms) |
| `/dashboard/rooms/[roomId]` | Room detail: files, folders, links, team, audit log, trash, AI panel |
| `/dashboard/rooms/[roomId]/engagement` | Investor engagement dashboard (sortable, filterable table + CSV export) |
| `/dashboard/rooms/[roomId]/nda` | NDA template management |
| `/dashboard/team-invite` | Accept team invite |
| `/privacy` | Privacy policy |

### Viewer (Cookie-based session auth)

| Route | Description |
|-------|-------------|
| `/v/[slug]` | Entry page — email capture (if `require_email` is set on link) |
| `/v/[slug]/auth` | Magic link verification callback — consumes token, creates session |
| `/v/[slug]/nda` | NDA acceptance gate (if `require_nda` is set on link) |
| `/v/[slug]/view` | Secure document viewer (canvas PDF + watermark overlay + sidebar) |

---

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/stream/[docId]` | GET | Viewer session cookie | Protected PDF streaming — validates session + link scope via `link_allows_document()` |
| `/api/download/[docId]` | GET | Viewer session cookie | Watermarked PDF download — burns viewer email, IP, timestamp into every page via `pdf-lib` |
| `/api/preview/[docId]` | GET | Supabase Auth | Admin document preview/download — verifies room ownership via `getUserRoomAccess()` |
| `/api/analytics/beacon` | POST | Viewer session cookie | Page view analytics ingestion — inserts `page_views` + updates `link_access_logs.last_active_at` |
| `/api/rooms/[roomId]/engagement.csv` | GET | Supabase Auth | CSV export of engagement data — verifies room access |
| `/api/rooms/[roomId]/folders` | GET | Supabase Auth | Room folder listing (used by FolderPicker component) |
| `/api/ai/chat` | POST | Supabase Auth | AI chat streaming — multi-provider (Anthropic, OpenAI, Google) with room-scoped tools |
| `/api/ai/keys` | GET/POST/DELETE | Supabase Auth | AI API key management — per-user, per-room, per-provider CRUD |
| `/api/ai/consent` | GET/POST | Supabase Auth | AI feature consent — must consent before first interaction |
| `/auth/callback` | GET | None (code exchange) | Supabase Auth magic link callback — exchanges code for session |

---

## Server Actions

Most CRUD operations use Next.js Server Actions (`'use server'`) instead of REST API routes:

| File | Actions | Description |
|------|---------|-------------|
| `src/app/dashboard/actions.ts` | `logout` | Sign out |
| `src/app/dashboard/room-actions.ts` | `createDataRoom`, `deleteDataRoom` | Room CRUD (delete includes full cascade cleanup) |
| `src/app/dashboard/rooms/[roomId]/actions.ts` | `createFolder`, `renameFolder`, `deleteFolder`, `recordUpload`, `renameDocument`, `deleteDocument`, `moveDocument`, `restoreFolder`, `restoreDocument`, `saveNdaTemplate`, `deleteNdaTemplate`, `getNdaTemplates` | Folder/document/NDA management |
| `src/app/dashboard/rooms/[roomId]/link-actions.ts` | `createLink`, `setLinkActiveState`, `deleteLink`, `updateLinkFolders` | Shared link management |
| `src/app/dashboard/rooms/[roomId]/team-actions.ts` | `inviteTeamMember`, `revokeTeamInvite`, `removeTeamMember` | Team collaboration |
| `src/app/dashboard/team-invite/actions.ts` | `acceptTeamInvite` | Invite acceptance |
| `src/app/v/[slug]/actions.ts` | `requestViewerMagicLink`, `acceptNda` | Viewer auth + NDA acceptance |

---

## Authentication

### Admin (Supabase Auth)

- Magic link via `signInWithOtp()` (Supabase)
- Session managed via HTTP-only, secure cookies
- Session refresh via middleware (`updateSession()`)
- All dashboard pages verify `supabase.auth.getUser()` and redirect to `/login` if unauthenticated

### Viewer (Custom Magic Link)

1. Visitor clicks shared link → `/v/[slug]`
2. If `require_email` is set: enters email → `requestViewerMagicLink()` called
3. Custom token created: `issueViewerAuthToken()` → SHA-256 hashed, 15-min TTL, single-use
4. Magic link email sent via Resend
5. Visitor clicks link → `/v/[slug]/auth` → token consumed, session cookie set
6. Session cookies: `visitor_session_${linkId}` + `visitor_identity_${linkId}`
7. **Session TTL: 4 hours** (validated via `link_access_logs.started_at` in `link-access.ts`)
8. If NDA required → `/v/[slug]/nda` → accept → redirect to `/v/[slug]/view`
9. If `require_email` is off: bypass steps 2-6, proceed directly

### Rate Limiting

- Magic link requests: 5 per 15 minutes per email (in-memory sliding window)
- Note: In-memory rate limiter resets on deploy; use Redis for production

---

## Analytics Events

| Event | Trigger | Data Captured | Storage |
|-------|---------|---------------|---------|
| Link opened | Viewer accesses shared link | email, IP, user agent, geo, timestamp | `link_access_logs` |
| Page view | Page becomes visible (Intersection Observer) | document ID, page number, duration (seconds) | `page_views` |
| Download | Viewer downloads watermarked PDF | document ID, email, IP, timestamp | `download_events` + `audit_events` |
| NDA acceptance | Viewer accepts NDA | template hash, email, IP, timestamp | `nda_acceptances` + `audit_events` |
| Session heartbeat | Beacon fires periodically | `last_active_at` timestamp | `link_access_logs` (update) |

---

## CSV Export Schema

**Endpoint:** `GET /api/rooms/[roomId]/engagement.csv`

```csv
email,domain,link_name,link_slug,first_view_at,last_view_at,sessions,total_time_seconds,docs_viewed,pages_viewed,downloads,nda_accepted
```

| Field | Type | Description |
|-------|------|-------------|
| email | string | Viewer's authenticated email |
| domain | string | Domain extracted from email (e.g., `sequoia.com`) |
| link_name | string | Friendly link name set by founder |
| link_slug | string | Unique link slug identifier |
| first_view_at | ISO 8601 | First access timestamp |
| last_view_at | ISO 8601 | Most recent access timestamp |
| sessions | int | Number of separate viewing sessions |
| total_time_seconds | int | Cumulative viewing time in seconds |
| docs_viewed | int | Number of distinct documents viewed |
| pages_viewed | int | Total pages viewed across all docs |
| downloads | int | Number of downloads |
| nda_accepted | boolean | Whether NDA was accepted |

---

## Link Scope Validation

Document access is validated server-side via the `link_allows_document(link_id, document_id)` SECURITY DEFINER function:

| Link Type | Scope Rule |
|-----------|------------|
| `document` | Only the linked `document_id` |
| `folder` | All non-deleted documents in the linked folder + all subfolders (recursive) |
| `room` | All non-deleted documents in the room. If `permissions.allowed_folders` is set, restricted to those folders + their subtrees |

---

*See [PRD.md](PRD.md) for full requirements. Last updated: 2026-02-11.*