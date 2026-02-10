# Product Requirements: Startup Data Room

## Goal Description
Create a secure, professional, and intuitive Virtual Data Room (VDR) application similar to Docsend+ tailored for startups raising capital. The platform will mimic the core value proposition of DocSend: tracking investor engagement, securing sensitive documents, and streamlining the due diligence process.

## User Roles
1.  **Founder/Admin**: Uploads documents, manages the data room, configures access, views analytics.
2.  **Investor/Viewer**: Receives links, views documents (with permissions), signs NDAs, asks questions.
3.  **Team Member**: Collaborator with restricted admin rights (e.g., can upload but maybe not change security settings).

## Core Features (MVP)

### 1. Document Management & Viewing
*   **Secure Viewer**: Custom PDF/Document viewer that renders content in the browser without requiring download.
*   **File Support**: PDF, PPTX, KEY, DOCX.
*   **Drag-and-Drop Upload**: Easy bulk upload of diligence files.
*   **Folder Structure**: hierarchical organization (e.g., "Financials", "Legal", "Team", "Product").
*   **Version Control**: Ability to update a document without breaking the shared link.

### 2. Security & Access Control (CRITICAL)
*   **Tiered Access / Granular Permissions**:
    *   Ability to restrict access to *specific folders* within a Data Room.
    *   Create "Access Groups" (e.g., "Angel Investors" see Group A, "VCs" see Group A + B).
    *   Hide sensitive folders from specific links/users entirely.
*   **Watermarking (View & Download)**:
    *   **View**: Semi-transparent overlay of viewer's email + IP + Timestamp on the screen.
    *   **Download**: If downloading is enabled, the system *must* generate a new PDF on the fly with the watermark **burned into the pages**.
*   **Screenshot Deterrence**:
    *   Browser/OS limitations prevent blocking screenshots entirely, but we will use **Canvas Rendering** to prevent "Right Click -> Save Image".
    *   Aggressive Watermarking is the primary deterrent for screenshots.
*   **Simple, Controlled Authentication**:
    *   No "create account" friction for investors.
    *   **Flow**: Click Link -> Enter Email -> Receive 6-digit OTP (or Magic Link) -> Access.
    *   Session cookies are HTTP-only and short-lived.

### 3. Analytics (The "DocSend Magic")
*   **Visit Tracking**: Who opened the link and when.
*   **Engagement Metrics**: Time spent per document and *time spent per page*.
*   **Drop-off Analysis**: See where investors stop reading the deck.
*   **Notifications**: Real-time email alerts when a prospect opens a document.

### 4. Diligence Workflow
*   **One-Click NDA**: Optional gate that requires accepting an NDA before viewing specific folders/files.
*   **"Data Room" Construct**: A container for multiple files/folders tailored for a specific round or investor type.

## Future/Advanced Features (Post-MVP)
*   **Q&A Module**: Investors can ask specific questions on specific slides/files.
*   **Team Permissions**: Granular roles for internal team.
*   **CRM Integration**: Salesforce/HubSpot.
*   **Redaction Tool**: In-browser redaction.

---

# Technical Architecture & Stack Selection

## 1. Tech Stack Recommendation
*   **Frontend**: `Next.js` (React) - For SEO, performance, and Vercel integration.
    *   *Styling*: `TailwindCSS` + `Shadcn/UI`.
    *   *State*: `Zustand`.
*   **Backend / Database**: `Supabase` (PostgreSQL).
    *   *Auth*: Supabase Auth (OTP / Magic Link).
    *   *Database*: Postgres with RLS.
    *   *Storage*: Supabase Storage.
    *   *Real-time*: Supabase Realtime.
*   **Document Processing**:
    *   *PDF Rendering*: `react-pdf` (client-side) or `pdf.js` for custom secure viewer.
    *   *Watermarking Engine*: Server-side usage of `pdf-lib` to stamp PDFs before streaming download.
*   **Infrastructure**: Vercel (Frontend) + Supabase (Backend).

## 2. Security Architecture (Deep Dive)
*   **Zero-Trust Storage**: Files in storage buckets are *private* by default.
*   **RLS Policies**: STRICT Row Level Security on all tables.
*   **Secure Viewer Implementation**:
    *   The raw PDF is NEVER directly accessible via a URL.
    *   **Canvas Rendering**: Render pages as images/canvas to prevent easy saving.
*   **Download Security**:
    *   Downloads trigger a serverless function that fetches the original -> applies watermark -> streams result. The original clean file is never exposed to the user.

## 3. Database Schema (Detailed)

```sql
-- Extends Supabase Auth
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table data_rooms (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id) not null,
  name text not null,
  status text default 'active',
  created_at timestamptz default now()
);

create table folders (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  parent_id uuid references folders(id),
  name text not null,
  access_level text default 'standard', -- e.g., 'standard', 'sensitive', 'restricted'
  created_at timestamptz default now()
);

create table documents (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  folder_id uuid references folders(id),
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  page_count int,
  status text default 'processing',
  created_at timestamptz default now()
);

create table shared_links (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id),
  document_id uuid references documents(id),
  slug text unique not null,
  settings jsonb default '{}'::jsonb, 
  -- { "require_email": true, "expiration": "...", "allow_download": false, "watermark_text": "{email} - {ip}" }
  permissions jsonb default '{}'::jsonb,
  -- { "allowed_folders": ["folder_id_1", "folder_id_2"], "access_tier": "all" }
  created_by uuid references profiles(id) not null,
  is_active boolean default true,
  view_count int default 0,
  created_at timestamptz default now()
);

-- Analytics & Logs tables (same as before)
```

## Implementation Phases
1.  **Phase 1 (Core)**: Viewer, Links, Email Gating, Basic Analytics.
2.  **Phase 2 (Organization)**: Folders, Data Rooms, Versioning.
3.  **Phase 3 (Security)**: Watermarked Downloads, Tiered Access logic.
