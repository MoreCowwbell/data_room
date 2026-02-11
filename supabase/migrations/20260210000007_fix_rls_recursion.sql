-- Fix infinite recursion in RLS policies for data_rooms <-> team_members.
--
-- The cycle: data_rooms SELECT policy reads team_members, and
-- team_members SELECT policy reads data_rooms → PostgreSQL error 42P17.
--
-- Solution: SECURITY DEFINER helper functions that bypass RLS for
-- cross-table ownership/membership lookups.
--
-- This migration is idempotent and also repairs the partially-applied
-- state left by a failed run of migration 000006.

-- ──────────────────────────────────────────────
-- 1. SECURITY DEFINER helpers (bypass RLS)
-- ──────────────────────────────────────────────

-- Check if a user owns a room (reads data_rooms without triggering RLS)
create or replace function public.is_room_owner(target_room_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.data_rooms dr
        where dr.id = target_room_id
          and dr.owner_id = target_user_id
    );
$$;

-- Check if a user is a team member with owner/admin role (reads team_members without triggering RLS)
create or replace function public.is_room_member(target_room_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.team_members tm
        where tm.room_id = target_room_id
          and tm.user_id = target_user_id
          and tm.role in ('owner', 'admin')
    );
$$;

-- Upgrade user_can_manage_room to SECURITY DEFINER (used by many policies on
-- folders, documents, shared_links, etc. — those tables also trigger RLS on
-- data_rooms/team_members when evaluating this function without SECURITY DEFINER).
create or replace function public.user_can_manage_room(target_room_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_room_owner(target_room_id, target_user_id)
        or public.is_room_member(target_room_id, target_user_id);
$$;

grant execute on function public.is_room_owner(uuid, uuid) to authenticated;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;
grant execute on function public.user_can_manage_room(uuid, uuid) to authenticated;

-- ──────────────────────────────────────────────
-- 2. Fix data_rooms policies (break the cycle)
-- ──────────────────────────────────────────────

drop policy if exists "Owners can manage their data rooms" on public.data_rooms;
create policy "Owners can manage their data rooms"
on public.data_rooms for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Admins can read rooms they belong to" on public.data_rooms;
create policy "Admins can read rooms they belong to"
on public.data_rooms for select
to authenticated
using (
    owner_id = auth.uid()
    or public.is_room_member(data_rooms.id, auth.uid())
);

-- ──────────────────────────────────────────────
-- 3. Fix team_members policies (break the cycle)
-- ──────────────────────────────────────────────

drop policy if exists "Owners can manage room members" on public.team_members;
create policy "Owners can manage room members"
on public.team_members for all
to authenticated
using (public.is_room_owner(team_members.room_id, auth.uid()))
with check (public.is_room_owner(team_members.room_id, auth.uid()));

drop policy if exists "Users can read their own memberships" on public.team_members;
create policy "Users can read their own memberships"
on public.team_members for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_room_owner(team_members.room_id, auth.uid())
);

-- ──────────────────────────────────────────────
-- 4. Repair policies from partially-applied 000006
--    (drop both old and new names to handle any state)
-- ──────────────────────────────────────────────

-- Folders
drop policy if exists "Owners can manage room folders" on public.folders;
drop policy if exists "Owner and admins can manage room folders" on public.folders;
create policy "Owner and admins can manage room folders"
on public.folders for all
to authenticated
using (public.user_can_manage_room(folders.room_id, auth.uid()))
with check (public.user_can_manage_room(folders.room_id, auth.uid()));

-- Documents
drop policy if exists "Owners can manage room documents" on public.documents;
drop policy if exists "Owner and admins can manage room documents" on public.documents;
create policy "Owner and admins can manage room documents"
on public.documents for all
to authenticated
using (public.user_can_manage_room(documents.room_id, auth.uid()))
with check (public.user_can_manage_room(documents.room_id, auth.uid()));

-- Shared links
drop policy if exists "Owners can manage room links" on public.shared_links;
drop policy if exists "Owner and admins can manage room links" on public.shared_links;
create policy "Owner and admins can manage room links"
on public.shared_links for all
to authenticated
using (public.user_can_manage_room(shared_links.room_id, auth.uid()))
with check (public.user_can_manage_room(shared_links.room_id, auth.uid()));

-- Access logs
drop policy if exists "Owners can read room access logs" on public.link_access_logs;
drop policy if exists "Owner and admins can read room access logs" on public.link_access_logs;
create policy "Owner and admins can read room access logs"
on public.link_access_logs for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = link_access_logs.link_id
          and public.user_can_manage_room(sl.room_id, auth.uid())
    )
);

-- Document analytics
drop policy if exists "Owners can read room analytics" on public.document_analytics;
drop policy if exists "Owner and admins can read room analytics" on public.document_analytics;
create policy "Owner and admins can read room analytics"
on public.document_analytics for select
to authenticated
using (
    exists (
        select 1
        from public.link_access_logs lal
        join public.shared_links sl on sl.id = lal.link_id
        where lal.id = document_analytics.access_log_id
          and public.user_can_manage_room(sl.room_id, auth.uid())
    )
);

-- Page views
drop policy if exists "Owners can read page views for their rooms" on public.page_views;
drop policy if exists "Owner and admins can read page views for their rooms" on public.page_views;
create policy "Owner and admins can read page views for their rooms"
on public.page_views for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = page_views.link_id
          and public.user_can_manage_room(sl.room_id, auth.uid())
    )
);

-- Download events
drop policy if exists "Owners can read download events for their rooms" on public.download_events;
drop policy if exists "Owner and admins can read download events for their rooms" on public.download_events;
create policy "Owner and admins can read download events for their rooms"
on public.download_events for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = download_events.link_id
          and public.user_can_manage_room(sl.room_id, auth.uid())
    )
);

-- Viewer sessions
drop policy if exists "Owners can read viewer sessions for their rooms" on public.viewer_sessions;
drop policy if exists "Owner and admins can read viewer sessions for their rooms" on public.viewer_sessions;
create policy "Owner and admins can read viewer sessions for their rooms"
on public.viewer_sessions for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = viewer_sessions.link_id
          and public.user_can_manage_room(sl.room_id, auth.uid())
    )
);

-- Audit events
drop policy if exists "Owners can read room audit events" on public.audit_events;
drop policy if exists "Owner and admins can read room audit events" on public.audit_events;
create policy "Owner and admins can read room audit events"
on public.audit_events for select
to authenticated
using (public.user_can_manage_room(audit_events.room_id, auth.uid()));

drop policy if exists "Owners can write room audit events" on public.audit_events;
drop policy if exists "Owner and admins can write room audit events" on public.audit_events;
create policy "Owner and admins can write room audit events"
on public.audit_events for insert
to authenticated
with check (public.user_can_manage_room(audit_events.room_id, auth.uid()));

-- Notifications
drop policy if exists "Owners can read room notifications" on public.notifications;
drop policy if exists "Owner and admins can read room notifications" on public.notifications;
create policy "Owner and admins can read room notifications"
on public.notifications for select
to authenticated
using (public.user_can_manage_room(notifications.room_id, auth.uid()));

drop policy if exists "Owners can write room notifications" on public.notifications;
drop policy if exists "Owner and admins can write room notifications" on public.notifications;
create policy "Owner and admins can write room notifications"
on public.notifications for insert
to authenticated
with check (public.user_can_manage_room(notifications.room_id, auth.uid()));

-- NDA templates
drop policy if exists "Owners can manage room NDA templates" on public.nda_templates;
drop policy if exists "Owner and admins can manage room NDA templates" on public.nda_templates;
create policy "Owner and admins can manage room NDA templates"
on public.nda_templates for all
to authenticated
using (public.user_can_manage_room(nda_templates.room_id, auth.uid()))
with check (public.user_can_manage_room(nda_templates.room_id, auth.uid()));

-- NDA acceptances
drop policy if exists "Owners can read NDA acceptances for their rooms" on public.nda_acceptances;
drop policy if exists "Owner and admins can read NDA acceptances for their rooms" on public.nda_acceptances;
create policy "Owner and admins can read NDA acceptances for their rooms"
on public.nda_acceptances for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = nda_acceptances.link_id
          and public.user_can_manage_room(sl.room_id, auth.uid())
    )
);

-- ──────────────────────────────────────────────
-- 5. Team invites policies (from 000006, may not have been applied)
-- ──────────────────────────────────────────────

drop policy if exists "Room managers can create invites" on public.team_invites;
create policy "Room managers can create invites"
on public.team_invites for insert
to authenticated
with check (public.user_can_manage_room(team_invites.room_id, auth.uid()));

drop policy if exists "Room managers can read invites" on public.team_invites;
create policy "Room managers can read invites"
on public.team_invites for select
to authenticated
using (
    public.user_can_manage_room(team_invites.room_id, auth.uid())
    or lower(team_invites.email) = lower(coalesce(auth.jwt()->>'email', ''))
);

drop policy if exists "Room managers can update invites" on public.team_invites;
create policy "Room managers can update invites"
on public.team_invites for update
to authenticated
using (
    public.user_can_manage_room(team_invites.room_id, auth.uid())
    or lower(team_invites.email) = lower(coalesce(auth.jwt()->>'email', ''))
)
with check (
    public.user_can_manage_room(team_invites.room_id, auth.uid())
    or lower(team_invites.email) = lower(coalesce(auth.jwt()->>'email', ''))
);
