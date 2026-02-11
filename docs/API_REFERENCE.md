# API Reference

> Extracted from PRD v2.0 Section 10.

---

## Dashboard Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Room list |
| `/dashboard/rooms/[roomId]` | File/folder management |
| `/dashboard/rooms/[roomId]/engagement` | Investor engagement dashboard |
| `/dashboard/rooms/[roomId]/analytics` | Document/page analytics |
| `/dashboard/rooms/[roomId]/links` | Manage shared links |
| `/dashboard/rooms/[roomId]/team` | Team members |
| `/dashboard/rooms/[roomId]/settings` | Room settings, NDA templates |

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/stream/[docId]` | GET | Protected document streaming (validates session + link scope) |
| `/api/download/[docId]` | GET | Watermarked PDF download generation |
| `/api/analytics/beacon` | POST | Client-side page view analytics ingestion |
| `/api/rooms/[roomId]/engagement.csv` | GET | CSV export of engagement data |

---

## Viewer Routes

| Route | Description |
|-------|-------------|
| `/v/[slug]` | Viewer entry (email capture) |
| `/v/[slug]/auth` | Magic link verification callback |
| `/v/[slug]/nda` | NDA acceptance (if required by link) |
| `/v/[slug]/view` | Secure document viewer |

---

## Authentication

### Admin
- Magic link via Supabase Auth
- Session TTL: 7 days rolling
- HTTP-only, secure cookies in production

### Viewer
- Magic link flow: click shared link -> enter email -> receive magic link -> authenticated session
- Session TTL: 24 hours
- Session scoped to specific shared link
- No account creation required

---

## Analytics Events

| Event | Trigger | Data Captured |
|-------|---------|--------------|
| Link opened | Viewer accesses shared link | viewer email, IP, user agent, timestamp |
| Page view | Page becomes visible | document ID, page number, duration (seconds) |
| Download | Viewer downloads PDF | document ID, viewer email, IP, timestamp |
| NDA acceptance | Viewer accepts NDA | template hash, viewer email, IP, timestamp |
| Session start | New viewer session created | link ID, viewer email, IP |

---

## CSV Export Schema

```csv
email,domain,first_viewed,last_viewed,total_time_minutes,sessions,documents_viewed,pages_viewed,furthest_page,downloaded,nda_accepted,nda_accepted_at,link_slug,link_name
```

| Field | Type | Description |
|-------|------|-------------|
| email | string | Viewer's authenticated email |
| domain | string | Domain extracted from email |
| first_viewed | ISO 8601 | First access timestamp |
| last_viewed | ISO 8601 | Most recent access timestamp |
| total_time_minutes | float | Cumulative viewing time |
| sessions | int | Number of separate sessions |
| documents_viewed | string | Comma-separated document names |
| pages_viewed | int | Total pages viewed |
| furthest_page | int | Deepest page reached |
| downloaded | boolean | Whether any download occurred |
| nda_accepted | boolean | Whether NDA was accepted |
| nda_accepted_at | ISO 8601 | NDA acceptance timestamp |
| link_slug | string | Unique link identifier |
| link_name | string | Friendly link name |

---

*See [PRD.md](PRD.md) for full requirements.*
