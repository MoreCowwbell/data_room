# Data Room

A secure, open-source Virtual Data Room (VDR) for sharing confidential documents with full control over access, engagement tracking, and NDA enforcement. Built for founders, investors, and deal teams who need to know exactly who viewed what, for how long, and whether they signed the NDA.

<!-- Screenshot placeholder: add a product screenshot here -->
<!-- <img width="1098" alt="Data Room Dashboard" src="..." /> -->

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Database Setup](#-database-setup)
- [Running Locally](#-running-locally)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

## Overview

Data Room lets you upload documents, generate secure sharing links, and track every interaction. Visitors access documents through a canvas-based viewer that prevents downloads and applies dynamic watermarks with their email and IP address. Every page view, session, and download is logged with full attribution.

**Key Capabilities:**
- **Secure Canvas Viewer**: Renders PDFs on canvas to prevent Save As, with right-click disabled
- **Dynamic Watermarking**: Every viewed page is watermarked with visitor email, IP, timestamp, and room name
- **Granular Link Controls**: Per-link expiration, max views, email gating, NDA requirements, and download permissions
- **Page-Level Analytics**: Tracks time spent on each page via Intersection Observer and Beacon API
- **NDA Enforcement**: Customizable per-room NDA templates with version tracking and acceptance proof
- **Team Collaboration**: Invite admins to manage rooms with role-based access control

## Features

### Document Management
- Create isolated data rooms with hierarchical folder structures
- Upload PDFs to private Supabase Storage
- Rename, soft-delete, and organize documents and folders

### Secure Sharing
- Generate unique, slug-based links scoped to a room, folder, or single document
- Optional email gating — require visitors to identify themselves
- Link expiration by date and max view count
- Toggle download permissions per link
- Activate or revoke links without deleting them

### Viewer Security
- Canvas-based PDF rendering prevents browser Save As
- Right-click context menu disabled
- Dynamic watermarks embedded on every page: visitor email, IP address, date, room name, filename
- Watermarked PDF downloads (server-side via `pdf-lib`) when download is permitted

### NDA Enforcement
- Create and version NDA templates per room
- Require NDA acceptance before viewing
- Track acceptances with visitor identity, IP, timestamp, and template hash

### Engagement Analytics
- Per-page time tracking via Intersection Observer + Beacon API
- Visitor session tracking with email, IP, and user agent
- Download event logging
- Engagement dashboard with filters: email, domain, link, document, date range
- CSV export for reporting

### Team Collaboration
- Invite team members as admins via email with expiring tokens
- Owner and admin roles with distinct permissions
- Team member management (invite, remove, view)

### Authentication
- Admin login via Magic Link (Supabase Auth)
- Visitor authentication via email gating with cookie-based sessions
- Viewer magic links for document access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org) 16 (App Router, RSC) |
| Language | [TypeScript](https://www.typescriptlang.org) 5 |
| UI | [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com) 4, [Radix UI](https://www.radix-ui.com), [shadcn/ui](https://ui.shadcn.com) |
| Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage) |
| PDF Rendering | [react-pdf](https://github.com/wojtekmaj/react-pdf) (client), [pdf-lib](https://pdf-lib.js.org) (server watermarking) |
| Icons | [Lucide](https://lucide.dev) |
| Email | [Resend](https://resend.com) |

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- A [Supabase](https://supabase.com) project (free tier works)
- A [Resend](https://resend.com) API key (optional, for email notifications)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/MoreCowwbell/data_room.git
cd data_room
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=notifications@yourdomain.com
```

## Database Setup

Run the SQL migrations **in order** in your [Supabase SQL Editor](https://supabase.com/dashboard):

1. `supabase/migrations/20240523000000_init.sql` — Core schema (profiles, rooms, documents, folders, links, analytics)
2. `supabase/migrations/20240523000001_storage.sql` — Supabase Storage bucket and policies
3. `supabase/migrations/20260210000002_policies.sql` — Row-Level Security policies
4. `supabase/migrations/20260210000003_storage_delete_update.sql` — Storage delete/update policies
5. `supabase/migrations/20260210000004_alpha_scope_foundation.sql` — Scoped links, soft delete, team members, NDA, analytics tables
6. `supabase/migrations/20260210000005_viewer_magic_link_nda.sql` — Viewer auth tokens, profile email column
7. `supabase/migrations/20260210000006_team_roles_policies.sql` — Team invites, role-based policy refinements
8. `supabase/migrations/20260210000007_fix_rls_recursion.sql` — SECURITY DEFINER helpers to fix RLS circular dependencies

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Testing the Flow

1. **Login** — Go to `/login` and enter your email. Check your inbox for the Magic Link.
2. **Create a Room** — From the dashboard, create a new data room (e.g., "Series A").
3. **Upload** — Open the room and upload a PDF document.
4. **Share** — Create a sharing link with your desired settings (email gating, expiration, NDA).
5. **View** — Open the link in an incognito window. Enter a visitor email and view the document. Note the watermark.
6. **Analytics** — Back in the room, check the Engagement tab to see page-level analytics.

## Project Structure

```
data_room/
├── src/
│   ├── app/
│   │   ├── dashboard/              # Admin dashboard & room management
│   │   │   ├── rooms/[roomId]/     # Room detail, engagement analytics
│   │   │   └── team-invite/        # Team invite acceptance
│   │   ├── v/[slug]/               # Visitor-facing routes
│   │   │   ├── view/               # Secure PDF viewer
│   │   │   └── nda/                # NDA acceptance page
│   │   ├── api/
│   │   │   ├── stream/[docId]/     # Protected PDF streaming
│   │   │   ├── download/[docId]/   # Watermarked PDF download
│   │   │   └── analytics/beacon/   # Page view beacon endpoint
│   │   ├── auth/                   # Auth callback handlers
│   │   └── login/                  # Magic link login
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── SecureDocumentViewer.tsx # Canvas PDF viewer + watermarking
│   │   ├── CreateLinkDialog.tsx    # Link generation with full options
│   │   ├── NdaTemplateForm.tsx     # Per-room NDA editor
│   │   ├── TeamManager.tsx         # Team member & invite management
│   │   ├── LinkManager.tsx         # Active/revoked/expired links
│   │   └── UploadButton.tsx        # PDF upload widget
│   └── lib/
│       ├── supabase/               # Client, server, middleware setup
│       ├── link-access.ts          # Link availability & session validation
│       ├── engagement.ts           # Analytics aggregation
│       ├── audit.ts                # Audit event logging
│       └── nda.ts                  # NDA template & acceptance logic
├── supabase/
│   └── migrations/                 # 8 SQL migrations
├── public/
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please keep pull requests small and focused.

## License

This project is licensed under the MIT License.
