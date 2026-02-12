# Deployment Guide — Vercel + Supabase Cloud

> Recommended deployment path for OpenVault. Estimated time: 2-3 days (including file route refactor).

---

## Prerequisites

- [Vercel](https://vercel.com) account (Pro plan: $20/month)
- [Supabase](https://supabase.com) project with all 10 migrations applied
- [Resend](https://resend.com) account with verified sending domain
- GitHub repository connected to Vercel
- Custom domain (optional but recommended)

---

## Step 1: Pre-Deployment Fixes

Before deploying, address these blockers:

### 1a. Wire Next.js Middleware

Create `src/middleware.ts`:

```typescript
export { proxy as middleware, config } from './proxy'
```

Without this, Supabase auth sessions never refresh and will expire unexpectedly.

### 1b. Refactor File-Serving Routes

Vercel serverless functions have a **4.5MB response body limit**. The current routes proxy entire file blobs through Node:

- `/api/stream/[docId]` — refactor to return a Supabase signed URL redirect
- `/api/preview/[docId]` — refactor to return a Supabase signed URL redirect
- `/api/download/[docId]` — keep as-is (watermarking requires server-side processing). Add file size check and return error for files exceeding the limit.

### 1c. Fix Critical Security Issues

See `docs/HEALTH_CHECK_REPORT.md` Section 4 for details on issues S1-S5.

---

## Step 2: Vercel Setup

### 2a. Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Next.js — no special build configuration needed
4. Framework preset: **Next.js** (auto-detected)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)

### 2b. Install Supabase Integration (Optional)

1. Go to [vercel.com/integrations/supabase](https://vercel.com/integrations/supabase)
2. Install the integration — auto-syncs Supabase env vars to Vercel

### 2c. Configure Environment Variables

In Vercel project settings > Environment Variables, add:

| Variable | Value | Environments |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Production, Preview |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Production |
| `NEXT_PUBLIC_SITE_URL` | `https://*.vercel.app` (or leave unset) | Preview |
| `RESEND_API_KEY` | Your Resend API key | Production, Preview |
| `RESEND_FROM_EMAIL` | `noreply@yourdomain.com` | Production, Preview |
| `AI_KEY_ENCRYPTION_SECRET` | Random 32+ char secret for AES key encryption | Production, Preview |

### 2d. Deploy

Push to main branch or click "Deploy" in Vercel dashboard.

---

## Step 3: Supabase Configuration

### 3a. Auth Redirect URLs

In Supabase Dashboard > Authentication > URL Configuration:

- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** Add all of these:
  - `https://yourdomain.com/auth/callback`
  - `https://*.vercel.app/auth/callback` (for preview deployments)
  - `http://localhost:3000/auth/callback` (for local development)

### 3b. Email Templates

In Supabase Dashboard > Authentication > Email Templates:

Update the magic link email template to use your brand. The default works but looks generic.

### 3c. Storage

Verify the `documents` bucket exists and is set to **private** (not public).

---

## Step 4: Email Setup (Resend)

### 4a. Verify Sending Domain

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain
3. Add the DNS records Resend provides (DKIM, SPF, CNAME)
4. Wait for verification (usually minutes)

### 4b. Update Environment

Set `RESEND_FROM_EMAIL` to use your verified domain (e.g., `noreply@yourdomain.com`).

### 4c. Supabase SMTP (Optional)

For custom-branded auth emails (magic links sent by Supabase Auth itself):

1. In Supabase Dashboard > Authentication > SMTP Settings
2. Enable custom SMTP
3. Use Resend's SMTP credentials:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: Your Resend API key

---

## Step 5: Custom Domain (Optional)

### 5a. Vercel

1. Vercel project settings > Domains
2. Add your domain
3. Configure DNS (CNAME or A record) as Vercel instructs
4. SSL certificate auto-provisioned

### 5b. Update References

- Update `NEXT_PUBLIC_SITE_URL` env var to your custom domain
- Update Supabase Auth redirect URLs

---

## Post-Deploy Verification Checklist

- [ ] Landing page loads at production URL
- [ ] Admin can log in via magic link
- [ ] Admin can create a room and upload a PDF
- [ ] Admin can create a shared link
- [ ] Viewer can access shared link and enter email
- [ ] Viewer receives magic link email (check spam)
- [ ] Viewer can authenticate and view documents
- [ ] Watermark displays correctly (email + IP + date)
- [ ] NDA gate works when enabled on link
- [ ] Download produces watermarked PDF (when enabled)
- [ ] Engagement dashboard shows viewer activity
- [ ] CSV export downloads correctly
- [ ] Team invite flow works
- [ ] AI panel works (with BYOK API key configured)
- [ ] First-open notification email received by admin
- [ ] Audit log shows events on room page

---

## Cost Summary

| Component | Free Tier | Pro Tier |
|-----------|-----------|----------|
| Vercel | Hobby (personal, limited) | $20/mo (1 seat) |
| Supabase | 500MB DB, 1GB storage, 50K MAUs | $25/mo |
| Resend | 3,000 emails/month | $20/mo (50K emails) |
| **Total** | **$0** (with limits) | **$45-65/mo** |

---

## Scaling Notes

- **Vercel** auto-scales serverless functions. No configuration needed.
- **Supabase Free tier limits:** 500MB database, 1GB file storage, 50K monthly active users. Upgrade to Pro ($25/mo) when you approach these limits.
- **Large PDF watermarking:** Files over ~10MB may hit Vercel's default 60s function timeout (Pro: 300s). Consider Vercel Fluid Compute for extended timeouts.
- **Rate limiting:** Replace in-memory rate limiter with [Upstash Redis](https://upstash.com) or [Vercel KV](https://vercel.com/docs/storage/vercel-kv) for production.

---

*Last updated: 2026-02-11*