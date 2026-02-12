# Product Requirements Document (PRD)

## 1. Document Control
- **Product:** Startup Virtual Data Room (VDR)
- **Version:** v2.0
- **Date:** 2026-02-10
- **Author:** Product + Engineering
- **Status:** Final for Alpha Development

---

## 2. Product Vision

Build a secure, analytics-first Virtual Data Room for startup fundraising that combines:
- Strong document security controls
- Low-friction investor access via magic link authentication
- Actionable engagement intelligence for founders
- Full sharing flexibility (room, folder, and document level)

**Primary benchmark:** DocSend-style sharing + analytics, with structured diligence workflows and investor engagement tracking.

---

## 3. Goals and Non-Goals

### Goals
- Let founders create and share data rooms quickly with confidence in access control
- Track investor engagement at file and page granularity
- Provide a centralized investor engagement database with sorting, filtering, and CSV export
- Support alpha testing quickly (localhost + tunnel), then production deployment
- Test all core VDR features in alpha (full sharing scope, analytics, NDA gating)

### Non-Goals (for MVP/Alpha)
- Full e-sign legal suite (DocuSign parity)
- Complex BI/report builder
- Native mobile app
- Enterprise SSO/SCIM
- Direct CRM integrations (HubSpot, Salesforce—CSV export covers this need)

---

## 4. Current State (As Implemented)

> Updated 2026-02-11. Most alpha features are now implemented.

### Implemented
- Admin login with Supabase auth (magic link flow)
- Data room creation (with fundraising template)
- Folder creation with unlimited nesting
- File upload to private Supabase storage (PDF only in alpha)
- Folder/file rename, soft-delete, and restore (TrashBin UI)
- Share links — all three scopes: room-level, folder-level, document-level
- Optional email gate for viewers with magic link authentication
- Secure canvas-based viewer with dynamic watermark overlay
- Visitor/page-duration analytics beacon (Intersection Observer + Beacon API)
- Investor engagement dashboard (sortable, filterable table + CSV export)
- Link constraints: expiration, max views, active/revoke toggle
- Download controls with burned watermark (viewer email + IP + timestamp via pdf-lib)
- NDA gate with acceptance logging and hash-versioned templates
- Immediate first-open email notification (to owner + admins via Resend)
- Team member roles (Owner/Admin) with email invite flow
- Audit logging for sensitive actions
- Folder-level permissions on room links (allowed_folders JSONB + FolderPicker UI)
- AI assistant panel (multi-provider: Anthropic, OpenAI, Google — BYOK)
- Privacy policy page + cookie consent banner
- Dark mode toggle
- Environment validation at startup

### Remaining for Alpha Exit
- Zero automated tests (no test framework configured)
- Error monitoring (Sentry) not set up
- Production deployment (target: Vercel + Supabase Cloud)
- Email deliverability setup (SPF/DKIM/DMARC for production domain)

### Deferred to Post-Alpha
- Document versioning UI
- Q&A module
- Daily digest notifications
- Advanced team roles (Editor, Analyst)
- Direct CRM integrations
- Access groups (replaced by JSONB folder permissions for alpha)
- Analytics visualizations (charts, heat maps, high-intent signals)

---

## 5. Users and Roles

| Role | Description | Alpha Scope |
|------|-------------|-------------|
| **Founder/Owner** | Full room, security, and analytics management | ✓ |
| **Admin** | Delegated management rights, cannot transfer ownership | ✓ |
| **Editor** | Can upload/organize, cannot change security settings | Deferred |
| **Investor/Viewer** | External recipient with controlled access via magic link | ✓ |

---

## 6. Key User Stories

### Founder Stories
- As a founder, I can create rooms, folders, and upload files in minutes.
- As a founder, I can share an entire room, specific folders, or individual documents with different investor segments.
- As a founder, I can see exactly who viewed what, how long they spent, and where they dropped off.
- As a founder, I can view all investor engagement in a sortable database and export to CSV for my pipeline tracking.
- As a founder, I can require investors to accept an NDA before accessing sensitive materials.
- As a founder, I can revoke access instantly and audit historical access.
- As a founder, I receive an immediate email alert when an investor first opens my data room.

### Investor Stories
- As an investor, I can access shared materials with minimal friction (magic link, no account creation).
- As an investor, I understand what I have permission to view and download.
- As an investor, I can accept an NDA electronically if required.

---

## 7. Functional Requirements

### 7.1 Authentication and Session Management

**Admin Authentication**
- Magic link via Supabase Auth
- Session TTL: 7 days rolling (configurable)
- HTTP-only, secure cookies in production

**Viewer Authentication**
- **Magic link flow** (primary method):
  1. Viewer clicks shared link
  2. Enters email address
  3. Receives magic link email
  4. Clicks link → authenticated session created
- Session TTL: 4 hours (short-lived for security; configured in `link-access.ts`)
- Session scoped to specific shared link
- No account creation required

### 7.2 Data Room Management

- **Room CRUD:** create, read, update, archive, delete
- **Folder hierarchy:** unlimited nesting depth
- **File CRUD:** upload, rename, move, delete with metadata tracking
- **Bulk upload:** drag-and-drop with progress indicators and retry on failure
- **Soft-delete:** recoverable deletes for accidental removal (30-day retention)
- **Supported formats:** PDF only (alpha scope). PPTX, DOCX, KEY, XLSX deferred to post-alpha.

### 7.3 Sharing and Access Control

**Link Types (All in Alpha)**

| Link Type | Scope | Use Case |
|-----------|-------|----------|
| Room-level | Entire data room | Full diligence access for lead investors |
| Folder-level | Specific folder + subfolders | Segment access (e.g., "Financials" only) |
| Document-level | Single document | Pitch deck distribution |

**Link Settings**

| Setting | Description | Default |
|---------|-------------|---------|
| Require email | Viewer must authenticate via magic link | ✓ On |
| Expiration | Auto-expire after datetime | Off |
| Max views | Disable after N unique viewers | Off |
| Allow download | Enable watermarked PDF download | **Off** |
| Require NDA | Must accept NDA before viewing | Off |
| Active toggle | Instantly enable/disable link | On |

**Folder-Level Permissions (Alpha Implementation)**
- Room-type links can restrict access to specific folders via `permissions.allowed_folders` JSONB
- `FolderPicker.tsx` UI for selecting which folders a link grants access to
- `link_allows_document()` DB function enforces folder subtree access recursively

> **Note:** The original PRD designed `access_groups` and `access_group_rules` tables for named investor segments. These were not implemented. Instead, per-link folder permissions provide equivalent granularity. Named groups may be revisited post-alpha if needed for multi-link bulk management.

### 7.4 Secure Viewer

**Core Security**
- Raw files never exposed via public URL
- All document access through protected API route (`/api/stream/[docId]`)
- Server validates viewer session + link permissions before streaming

**Watermark Overlay (View)**
- Semi-transparent overlay on every page
- Includes:
  - Viewer email address
  - IP address
  - Timestamp (UTC)
  - Company/room name
- Rendered via canvas to deter right-click save

**Screenshot Deterrence**
- Canvas-based rendering (no native image elements)
- Aggressive watermarking as primary deterrent
- Note: Browser/OS cannot fully prevent screenshots—watermark is the enforcement mechanism

### 7.5 Downloads

**Default Behavior:** Downloads blocked

**When Enabled:**
- Server-side watermark generation (burned into PDF pages)
- Watermark includes:
  - Viewer email (primary identifier)
  - IP address
  - Download timestamp
  - Document name
  - Company name
- Generated file is ephemeral (not stored permanently)
- Original clean file never exposed to viewer

**Watermark Placement:**
- Diagonal across each page
- Semi-transparent but clearly legible
- Cannot be easily cropped or removed

### 7.6 Investor Engagement Dashboard

**Purpose:** Centralized view of all investor/viewer activity across the data room, enabling founders to track engagement and prioritize follow-ups.

**Location:** Tab within the data room management interface (e.g., "Engagement" or "Visitors")

**Dashboard Features**

| Feature | Description |
|---------|-------------|
| Visitor database | Table of all viewers with engagement metrics |
| Sortable columns | Sort by any metric (time spent, last visit, etc.) |
| Filterable | Filter by link, folder, document, date range |
| Search | Search by email or domain |
| CSV export | One-click export of filtered/full dataset |

**Data Fields Captured Per Visitor**

| Field | Description |
|-------|-------------|
| Email | Viewer's authenticated email |
| Domain | Extracted from email (e.g., `sequoia.com`) |
| First viewed | Timestamp of first access |
| Last viewed | Timestamp of most recent access |
| Total time | Cumulative time spent (minutes) |
| Sessions | Number of separate viewing sessions |
| Documents viewed | List of documents accessed |
| Pages viewed | Total pages viewed across all docs |
| Furthest page | Deepest page reached (for drop-off analysis) |
| Downloaded | Yes/No — did they download any file |
| NDA accepted | Yes/No + timestamp if applicable |
| Link used | Which shared link they accessed |
| Access group | Group assignment if applicable |

**Engagement Signals**

Surface high-intent indicators:
- Time spent > threshold (e.g., >5 minutes)
- Multiple sessions (return visitors)
- Viewed sensitive folders (if applicable)
- Downloaded materials

**CSV Export Format**

```
email,domain,first_viewed,last_viewed,total_time_minutes,sessions,documents_viewed,pages_viewed,downloaded,nda_accepted,link_slug
partner@sequoia.com,sequoia.com,2026-02-08T14:32:00Z,2026-02-10T09:15:00Z,12.5,3,"Pitch Deck, Financials Q4",28,No,Yes,series-a-main
analyst@a]6z.com,a]6z.com,2026-02-09T10:00:00Z,2026-02-09T10:45:00Z,8.2,1,"Pitch Deck",15,No,Yes,series-a-main
```

### 7.7 Analytics (Detailed)

**Event Capture**
- Link opened (with viewer identity)
- Document opened
- Page view with duration
- Session start/end
- Download event
- NDA acceptance

**Dashboard Views**

| View | Description |
|------|-------------|
| Overview | Total views, unique viewers, avg time spent |
| By document | Engagement metrics per document |
| By page | Time spent per page (drop-off analysis) |
| By investor | Individual engagement profiles |
| Timeline | Activity over last 7/30 days |
| Top engaged | Ranked list by total time or sessions |

### 7.8 Notifications

**Alpha Scope: Immediate Alerts Only**

| Trigger | Notification |
|---------|--------------|
| First link open | Email to founder: "[Investor email] just opened your data room" |

**Content includes:**
- Investor email
- Link/room accessed
- Timestamp
- Quick link to engagement dashboard

**Deferred:** Daily digest, threshold-based alerts (e.g., "high engagement detected")

### 7.9 NDA Workflow

**Flow**
1. Founder enables "Require NDA" on a link
2. Viewer authenticates via magic link
3. Before viewing, viewer sees NDA acceptance screen
4. Viewer clicks "I Accept"
5. Acceptance recorded → viewer proceeds to content
6. If declined, access blocked

**Acceptance Record**
- Viewer email
- IP address
- Timestamp
- NDA template version (hash)
- Link ID

**NDA Template Management**
- Founders can use default boilerplate or paste custom text
- Templates versioned (hash stored)
- Acceptance tied to specific template version

### 7.10 Team Collaboration (Alpha Scope)

**Roles**

| Role | Permissions |
|------|-------------|
| Owner | Full control, can transfer ownership, delete room |
| Admin | Manage content, sharing, analytics; cannot delete room or transfer ownership |

**Invite Flow**
1. Owner invites via email
2. Invitee receives magic link
3. Accepts → added to room with assigned role

**Deferred:** Editor role, granular permission toggles

### 7.11 Audit Logging

**Logged Events**
- Room created/deleted/archived
- Document uploaded/deleted
- Link created/modified/revoked
- Permissions changed
- NDA template updated
- Team member added/removed
- Access group modified

**Log Fields**
- Actor (user ID + email)
- Action type
- Target (room/doc/link ID)
- Timestamp
- IP address
- Payload (before/after state for changes)

---

## 8. Non-Functional Requirements

### 8.1 Security
- Row Level Security (RLS) on all tables
- Private storage buckets (no public URLs)
- Least-privilege policies for anon/authenticated roles
- HTTP-only, secure cookies
- Audit log for all sensitive actions

### 8.2 Performance
- Dashboard TTFB: <1.5s at p50
- Viewer first-page render: <2.5s for PDFs <10MB at p50
- Analytics writes: async where possible to avoid blocking UI

### 8.3 Reliability
- User-friendly error messages for all actions
- Retry logic for uploads and processing
- Soft-delete with recovery window

### 8.4 Observability
- Structured logs for auth, share, view, download events
- Error monitoring (Sentry or equivalent)
- Product analytics (PostHog or equivalent)

### 8.5 Compliance (Keep Simple)
- Basic privacy policy explaining data collection
- Cookie consent for analytics
- Manual data deletion pathway on request
- No SOC2 for alpha

---

## 9. Data Model

> **Note (2026-02-11):** The schema below was the original design. The actual implementation has diverged in several areas:
> - `access_groups` and `access_group_rules` tables were **not created**. Folder permissions use `permissions.allowed_folders` JSONB on `shared_links` instead.
> - `viewer_sessions` table exists but is **not used** by application code. Visitor sessions are tracked via `link_access_logs`.
> - `page_views` uses `link_id` + `visitor_session_token` columns (not `session_id`).
> - `download_events` uses `link_id` + `visitor_session_token` columns (not `session_id`).
> - `notifications` uses `link_id`, `event_type`, `recipient_email` (not `recipient_id`, `type`).
> - `audit_events` includes `actor_type` column not shown below.
> - AI tables added in migration 9: `ai_api_keys`, `ai_consent`, `ai_usage_logs`, `document_text_cache`.
> - `shared_links` does not reference `access_group_id`; instead has `permissions jsonb`.
>
> See `supabase/migrations/` for the authoritative schema.

### Core Tables

```sql
-- User profiles (extends Supabase Auth)
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Data rooms
create table data_rooms (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id) not null,
  name text not null,
  description text,
  status text default 'active', -- active, archived, deleted
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Folders
create table folders (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  parent_id uuid references folders(id),
  name text not null,
  position int default 0,
  created_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  folder_id uuid references folders(id),
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  file_size bigint,
  page_count int,
  status text default 'processing', -- processing, ready, error
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  deleted_at timestamptz -- soft delete
);

-- Shared links
create table shared_links (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id),
  folder_id uuid references folders(id),
  document_id uuid references documents(id),
  slug text unique not null,
  name text, -- friendly name for founder reference
  link_type text not null, -- 'room', 'folder', 'document'
  is_active boolean default true,
  require_email boolean default true,
  require_nda boolean default false,
  allow_download boolean default false,
  expires_at timestamptz,
  max_views int,
  view_count int default 0,
  access_group_id uuid references access_groups(id),
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

-- Access groups
create table access_groups (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  name text not null,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Access group rules (what folders/docs the group can see)
create table access_group_rules (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references access_groups(id) not null,
  folder_id uuid references folders(id),
  document_id uuid references documents(id),
  created_at timestamptz default now()
);

-- Team members
create table team_members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  user_id uuid references profiles(id) not null,
  role text not null, -- 'owner', 'admin'
  invited_by uuid references profiles(id),
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  unique(room_id, user_id)
);

-- NDA templates
create table nda_templates (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  title text not null,
  body text not null,
  version_hash text not null, -- hash of body for version tracking
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- NDA acceptances
create table nda_acceptances (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references shared_links(id) not null,
  template_id uuid references nda_templates(id) not null,
  visitor_email text not null,
  ip_address text,
  user_agent text,
  accepted_at timestamptz default now()
);

-- Viewer sessions
create table viewer_sessions (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references shared_links(id) not null,
  visitor_email text not null,
  ip_address text,
  user_agent text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  total_duration_seconds int
);

-- Page view analytics
create table page_views (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references viewer_sessions(id) not null,
  document_id uuid references documents(id) not null,
  page_number int not null,
  duration_seconds int,
  viewed_at timestamptz default now()
);

-- Download events
create table download_events (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references viewer_sessions(id) not null,
  document_id uuid references documents(id) not null,
  visitor_email text not null,
  ip_address text,
  downloaded_at timestamptz default now()
);

-- Audit log
create table audit_events (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id),
  actor_id uuid references profiles(id),
  actor_email text,
  event_type text not null,
  target_type text, -- 'room', 'folder', 'document', 'link', 'team_member'
  target_id uuid,
  payload jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- Notifications (for tracking sent notifications)
create table notifications (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  recipient_id uuid references profiles(id) not null,
  type text not null, -- 'first_open', 'high_engagement', 'digest'
  payload jsonb,
  sent_at timestamptz,
  status text default 'pending' -- 'pending', 'sent', 'failed'
);
```

### Engagement Dashboard View (SQL View)

```sql
create view visitor_engagement as
select
  vs.visitor_email,
  split_part(vs.visitor_email, '@', 2) as domain,
  sl.room_id,
  sl.id as link_id,
  sl.slug as link_slug,
  sl.name as link_name,
  min(vs.started_at) as first_viewed,
  max(coalesce(vs.ended_at, vs.started_at)) as last_viewed,
  sum(vs.total_duration_seconds) / 60.0 as total_time_minutes,
  count(distinct vs.id) as sessions,
  count(distinct pv.document_id) as documents_viewed,
  count(pv.id) as pages_viewed,
  max(pv.page_number) as furthest_page,
  exists(select 1 from download_events de where de.visitor_email = vs.visitor_email and de.session_id = vs.id) as downloaded,
  exists(select 1 from nda_acceptances na where na.visitor_email = vs.visitor_email and na.link_id = sl.id) as nda_accepted,
  (select accepted_at from nda_acceptances na where na.visitor_email = vs.visitor_email and na.link_id = sl.id limit 1) as nda_accepted_at
from viewer_sessions vs
join shared_links sl on vs.link_id = sl.id
left join page_views pv on pv.session_id = vs.id
group by vs.visitor_email, sl.room_id, sl.id, sl.slug, sl.name;
```

---

## 10. API / Route Surface

> **Note (2026-02-11):** The original design listed REST API routes for CRUD operations (`/api/rooms`, `/api/folders`, `/api/documents`, `/api/links`). In the implementation, these use **Next.js Server Actions** instead. See [API_REFERENCE.md](API_REFERENCE.md) for the accurate, up-to-date route listing.

### Dashboard Routes
- `/dashboard` — room list (owned + team rooms)
- `/dashboard/rooms/[roomId]` — room detail (files, folders, links, team, audit, trash, AI)
- `/dashboard/rooms/[roomId]/engagement` — investor engagement dashboard
- `/dashboard/rooms/[roomId]/nda` — NDA template management
- `/dashboard/team-invite` — accept team invite

### API Routes
- `/api/stream/[docId]` — protected document streaming (viewer session auth)
- `/api/download/[docId]` — watermarked download generation (viewer session auth)
- `/api/preview/[docId]` — admin document preview (Supabase Auth)
- `/api/analytics/beacon` — client-side analytics ingestion (viewer session auth)
- `/api/rooms/[roomId]/engagement.csv` — CSV export (Supabase Auth)
- `/api/rooms/[roomId]/folders` — folder listing for FolderPicker (Supabase Auth)
- `/api/ai/chat` — AI chat streaming (Supabase Auth)
- `/api/ai/keys` — AI API key management (Supabase Auth)
- `/api/ai/consent` — AI consent (Supabase Auth)

### Viewer Routes
- `/v/[slug]` — viewer entry (email capture)
- `/v/[slug]/auth` — magic link verification callback
- `/v/[slug]/nda` — NDA acceptance (if required)
- `/v/[slug]/view` — secure document viewer

---

## 11. Deployment Strategy

### Alpha (Current Phase)
- **Local development:** Next.js + Supabase project
- **External testing:** ngrok or Cloudflare Tunnel for public URL
- **Auth config:** Add tunnel URL to Supabase Auth redirect allowlist

### Production (Post-Alpha)
- **Frontend:** Vercel
- **Backend:** Supabase (Auth, Database, Storage)
- **Document processing:** Supabase Edge Functions or Vercel Serverless
- **Email:** Resend or Postmark for magic links and notifications

### Migration Triggers (Move to AWS When)
- Enterprise customer requires dedicated infrastructure
- SOC2 compliance with specific network controls
- Processing >10K PDFs/month requiring cost optimization
- Custom domain requirements per customer

---

## 12. Milestones

### M1: Alpha Release (Current Target)
- [x] Magic link authentication for viewers
- [x] Room-level and folder-level sharing
- [x] Link constraints (expiration, max views, revoke)
- [x] Investor engagement dashboard with sortable table
- [x] CSV export of engagement data
- [x] Burned watermark downloads (when enabled)
- [x] NDA gate with acceptance logging
- [x] Immediate first-open notifications
- [x] Audit logging for sensitive actions
- [x] Basic privacy policy page

### M2: Beta Enhancements
- [ ] Daily digest notifications
- [ ] High-engagement threshold alerts
- [ ] Editor team role
- [ ] Document versioning UI
- [ ] Enhanced analytics visualizations (charts, trends)

### M3: Post-Beta
- [ ] Q&A module
- [ ] Direct CRM integrations (HubSpot, Salesforce)
- [ ] Advanced team roles and permissions
- [ ] Redaction tool
- [ ] SOC2 preparation (if required)

---

## 13. Acceptance Criteria (Alpha Release Gate)

- [ ] Founder can create room, folders, upload documents
- [ ] Founder can create room-level, folder-level, and document-level links
- [ ] Viewer authenticates via magic link with no account creation
- [ ] Viewer cannot access resources outside their link permissions
- [ ] Viewer cannot access expired or revoked links
- [ ] Watermark displays correctly on all viewed pages
- [ ] Downloads (when enabled) have burned watermarks with viewer email
- [ ] NDA gate blocks access until accepted; acceptance is logged
- [ ] Engagement dashboard shows all visitors with accurate metrics
- [ ] CSV export includes all engagement fields
- [ ] Founder receives email notification on first link open
- [ ] Audit log captures all sensitive actions
- [ ] Direct URL access to documents is blocked without valid session

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS policy bugs expose data | Critical | Comprehensive policy test suite; staging validation |
| PDF watermarking latency | Medium | Async processing; cache generated files briefly |
| Magic link emails land in spam | Medium | Use reputable email provider; SPF/DKIM/DMARC setup |
| Viewer session hijacking | High | Short-lived tokens; IP binding optional; server-side validation |
| Large file upload failures | Medium | Chunked upload with retry; progress feedback |

---

## 15. Decisions Log

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Viewer auth method | Magic link | One-click from inbox; no code copying; stays in flow |
| 2 | Sharing scope for alpha | Full (room + folder + document) | Test all features in alpha |
| 3 | Download default | Blocked; opt-in per link | Security-first; matches founder expectations |
| 4 | Download watermark | Viewer email + IP + timestamp + company | Strong deterrent against unauthorized sharing |
| 5 | NDA template | Short boilerplate (customizable) | Founders can customize; not legal advice |
| 6 | Team roles in alpha | Owner + Admin only | Simplicity; add Editor in beta |
| 7 | Notifications in alpha | Immediate first-open only | Core value prop; digest adds noise too early |
| 8 | CRM integration | CSV export only | Universal; no integration maintenance |
| 9 | Compliance scope | Basic privacy policy only | Keep simple; no SOC2 for alpha |
| 10 | Production infrastructure | Vercel + Supabase | Fastest path; migrate to AWS if needed later |

---

## 16. Appendix A: Default NDA Boilerplate

The following template is provided as a starting point. Founders should customize bracketed fields and consult legal counsel before use.

---

> **MUTUAL NON-DISCLOSURE AGREEMENT**
>
> This Agreement is entered into as of the date of electronic acceptance below.
>
> **Parties:**
> - **"Discloser":** [COMPANY NAME], a [STATE] corporation
> - **"Recipient":** The individual accepting this agreement via the data room portal
>
> ---
>
> **1. Confidential Information**
>
> "Confidential Information" means all non-public information disclosed by either party in connection with evaluating a potential business relationship, including but not limited to: business plans, financial statements and projections, customer and partner information, technical specifications, product roadmaps, pricing, and any other proprietary data.
>
> **2. Obligations of Recipient**
>
> Recipient agrees to:
> - (a) Hold all Confidential Information in strict confidence
> - (b) Use Confidential Information solely for the purpose of evaluating a potential investment or business relationship
> - (c) Not disclose Confidential Information to any third party without prior written consent from Discloser
> - (d) Protect Confidential Information using at least the same degree of care used to protect Recipient's own confidential information, but no less than reasonable care
>
> **3. Exclusions**
>
> This Agreement does not apply to information that:
> - (a) Is or becomes publicly available through no fault of Recipient
> - (b) Was rightfully known to Recipient prior to disclosure
> - (c) Is independently developed by Recipient without use of Confidential Information
> - (d) Is rightfully obtained from a third party without restriction
> - (e) Is disclosed pursuant to a legal requirement, provided Recipient gives Discloser prompt notice to allow Discloser to seek protective measures
>
> **4. Term**
>
> The confidentiality obligations under this Agreement shall survive for a period of two (2) years from the date of disclosure.
>
> **5. No Obligation**
>
> This Agreement does not obligate either party to proceed with any transaction or business relationship. Neither party acquires any intellectual property rights under this Agreement.
>
> **6. Return of Materials**
>
> Upon request by Discloser, Recipient shall promptly return or destroy all Confidential Information and any copies thereof.
>
> **7. Governing Law**
>
> This Agreement shall be governed by and construed in accordance with the laws of the State of [STATE], without regard to its conflicts of law principles.
>
> **8. Entire Agreement**
>
> This Agreement constitutes the entire agreement between the parties concerning the subject matter hereof and supersedes all prior agreements and understandings.
>
> ---
>
> **ELECTRONIC ACCEPTANCE**
>
> By clicking "I Accept," you acknowledge that you have read, understand, and agree to be bound by the terms of this Mutual Non-Disclosure Agreement.
>
> **Acceptance Record (auto-captured):**
> - Email: [viewer email]
> - IP Address: [viewer IP]
> - Timestamp: [UTC timestamp]
> - Agreement Version: [template hash]

---

**⚠️ DISCLAIMER:** This is a template document provided for convenience. It does not constitute legal advice. Consult with qualified legal counsel before using this or any NDA in your business dealings.

---

## 17. Appendix B: Watermark Specification

### View Watermark (Overlay)
- **Position:** Diagonal across page, repeating pattern
- **Opacity:** 15-20% (visible but not obstructing content)
- **Content:**
  ```
  [viewer-email@domain.com]
  [IP: xxx.xxx.xxx.xxx]
  [2026-02-10 14:32 UTC]
  [COMPANY NAME] - Confidential
  ```
- **Font:** Sans-serif, gray color
- **Rendering:** Canvas-based (not DOM text)

### Download Watermark (Burned)
- **Position:** Diagonal across each page
- **Opacity:** 25-30% (more prominent than view watermark)
- **Content:** Same as view watermark
- **Implementation:** Server-side PDF manipulation via `pdf-lib`
- **Persistence:** Permanently embedded in PDF pages; cannot be removed without degrading document

---

## 18. Appendix C: CSV Export Schema

> Updated 2026-02-11 to match actual `toCsv()` output in `src/lib/engagement.ts`.

```csv
email,domain,link_name,link_slug,first_view_at,last_view_at,sessions,total_time_seconds,docs_viewed,pages_viewed,downloads,nda_accepted
```

**Field Definitions:**

| Field | Type | Description |
|-------|------|-------------|
| email | string | Viewer's authenticated email |
| domain | string | Domain extracted from email |
| link_name | string | Friendly link name |
| link_slug | string | Unique link slug identifier |
| first_view_at | ISO 8601 | First access timestamp |
| last_view_at | ISO 8601 | Most recent access timestamp |
| sessions | int | Number of separate sessions |
| total_time_seconds | int | Cumulative viewing time in seconds |
| docs_viewed | int | Number of distinct documents viewed |
| pages_viewed | int | Total pages viewed |
| downloads | int | Number of downloads |
| nda_accepted | boolean | Whether NDA was accepted |

---

*End of PRD v2.0*