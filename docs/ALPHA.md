# Alpha Scope & Acceptance Criteria

> Consolidated from PRD v2.0 Sections 3, 12, and 13.

---

## Alpha Scope (Locked)

All features below are in scope for alpha release:

- Admin magic-link auth (Supabase Auth)
- Room/folder/document CRUD with soft-delete
- Secure canvas-based PDF viewer with watermark overlay
- Viewer magic-link authentication (no account creation)
- Full link scope support: room, folder, document
- Link constraints: expiration, max views, active/revoke toggle
- Email gating on shared links
- Burned watermark downloads (viewer email + IP + timestamp + company + filename)
- NDA gate with acceptance logging and template versioning
- Investor engagement dashboard with sortable table + filters
- CSV export of engagement data
- Immediate first-open email notifications (owner + admins)
- Owner/Admin team model with invite flow
- Audit logging for sensitive actions
- Basic privacy policy page
- Cookie consent for analytics

---

## Non-Goals (Deferred to Post-Alpha)

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

---

## Acceptance Criteria (Alpha Release Gate)

All items must pass before alpha release:

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

## Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Viewer auth: magic link | One-click from inbox; no code copying |
| 2 | Full sharing scope (room + folder + doc) | Test all features in alpha |
| 3 | Downloads: blocked by default, opt-in per link | Security-first |
| 4 | Download watermark: email + IP + timestamp + company | Strong deterrent |
| 5 | NDA template: short boilerplate (customizable) | Founders can customize |
| 6 | Team roles: Owner + Admin only | Simplicity; add Editor in beta |
| 7 | Notifications: immediate first-open only | Core value prop |
| 8 | CRM integration: CSV export only | Universal |
| 9 | Compliance: basic privacy policy only | Keep simple |
| 10 | Infrastructure: Vercel + Supabase | Fastest path; migrate later if needed |

---

## Deployment Path

1. **Local development** -- Next.js + Supabase project
2. **External testing** -- Cloudflare Tunnel for public URL
3. **Auth config** -- Add tunnel URL to Supabase Auth redirect allowlist
4. **Production** -- Vercel (frontend) + Supabase (backend) initially; Cloudflare + AWS post-alpha

---

*Derived from PRD v2.0. See [PRD.md](PRD.md) for full requirements.*
