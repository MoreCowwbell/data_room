# OpenVault Application Walkthrough

## Overview
This is a secure Virtual Data Room (VDR) application built with Next.js 15, Supabase, and Tailwind CSS. It features secure document viewing, email gating, and detailed analytics.

## Features Implemented
1.  **Authentication**:
    *   Admin Login via Magic Link / OTP (Supabase Auth).
    *   Visitor Authentication via Email Gating (Cookie-based sessions).
2.  **Document Management**:
    *   Create Vaults.
    *   Create Folders.
    *   Upload Documents (PDF, etc.) to private Supabase Storage.
3.  **Secure Viewer**:
    *   Canvas-based rendering (prevents Save As).
    *   Dynamic Watermarking (Email + IP).
    *   Document Streaming via protected API route.
4.  **Sharing**:
    *   Generate unique, secure links for documents.
    *   Optional Email Gating.
5.  **Analytics**:
    *   Tracks visitor access logs.
    *   Tracks time spent viewing documents (Beacon API).

## Setup Instructions

### 1. Environment Variables
Rename `.env.local.example` to `.env.local` and add your Supabase credentials:
```bash
cp .env.local.example .env.local
```
Update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Database Setup
Run the SQL migrations in your Supabase Dashboard (SQL Editor) to create the schema and policies.
*   Copy content from `supabase/migrations/20240523000000_init.sql`.
*   Copy content from `supabase/migrations/20240523000001_storage.sql`.
*   Copy content from `supabase/migrations/20260210000002_policies.sql`.
*   Copy content from `supabase/migrations/20260210000003_storage_delete_update.sql`.
*   Copy content from `supabase/migrations/20260210000004_alpha_scope_foundation.sql`.
*   Copy content from `supabase/migrations/20260210000005_viewer_magic_link_nda.sql`.
*   Copy content from `supabase/migrations/20260210000006_team_roles_policies.sql`.
*   Copy content from `supabase/migrations/20260210000007_fix_rls_recursion.sql`.

### 3. Run Locally
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

## Testing the Flow
1.  **Login**: Go to `/login`. Use your email. Check console or Supabase for the Magic Link (or enable OTP).
2.  **Dashboard**: Create a "Series A" room.
3.  **Upload**: Open the room, upload a PDF.
4.  **Share**: Click "Share" on the document row. Copy the link.
5.  **Visit**: Open the link in an Incognito window.
    *   Enter a visitor email (e.g., `investor@vc.com`).
    *   View the document. Observe the watermark.
    *   Try to right-click or save.
6.  **Analytics**: Check the `link_access_logs` and `document_analytics` tables in Supabase to see the tracking data.

## Project Structure
*   `src/app`: Next.js App Router pages.
*   `src/components`: Reusable UI components (shadcn/ui) and feature components (`SecureDocumentViewer`).
*   `src/lib`: Utilities (Supabase client).
*   `supabase/migrations`: SQL schemas.
