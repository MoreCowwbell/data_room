-- Team invite flow + owner/admin policy alignment (Sprint 4)

create table if not exists public.team_invites (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.data_rooms(id) on delete cascade,
    email text not null,
    role text not null default 'admin',
    token_hash text not null,
    invited_by uuid references public.profiles(id),
    expires_at timestamptz not null,
    accepted_at timestamptz,
    accepted_by uuid references public.profiles(id),
    created_at timestamptz not null default now()
);

alter table public.team_invites
    drop constraint if exists team_invites_role_check;
alter table public.team_invites
    add constraint team_invites_role_check check (role in ('admin'));

create unique index if not exists idx_team_invites_token_hash_unique on public.team_invites(token_hash);
create index if not exists idx_team_invites_room_email on public.team_invites(room_id, lower(email));
create index if not exists idx_team_invites_expires on public.team_invites(expires_at);

alter table public.team_invites enable row level security;

create or replace function public.user_can_manage_room(target_room_id uuid, target_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.data_rooms dr
        where dr.id = target_room_id
          and dr.owner_id = target_user_id
    )
    or exists (
        select 1
        from public.team_members tm
        where tm.room_id = target_room_id
          and tm.user_id = target_user_id
          and tm.role in ('owner', 'admin')
    );
$$;

grant execute on function public.user_can_manage_room(uuid, uuid) to authenticated;

drop policy if exists "Owners can manage room folders" on public.folders;
create policy "Owner and admins can manage room folders"
on public.folders for all
to authenticated
using (public.user_can_manage_room(folders.room_id, auth.uid()))
with check (public.user_can_manage_room(folders.room_id, auth.uid()));

drop policy if exists "Owners can manage room documents" on public.documents;
create policy "Owner and admins can manage room documents"
on public.documents for all
to authenticated
using (public.user_can_manage_room(documents.room_id, auth.uid()))
with check (public.user_can_manage_room(documents.room_id, auth.uid()));

drop policy if exists "Owners can manage room links" on public.shared_links;
create policy "Owner and admins can manage room links"
on public.shared_links for all
to authenticated
using (public.user_can_manage_room(shared_links.room_id, auth.uid()))
with check (public.user_can_manage_room(shared_links.room_id, auth.uid()));

drop policy if exists "Owners can read room access logs" on public.link_access_logs;
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

drop policy if exists "Owners can read room analytics" on public.document_analytics;
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

drop policy if exists "Owners can read page views for their rooms" on public.page_views;
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

drop policy if exists "Owners can read download events for their rooms" on public.download_events;
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

drop policy if exists "Owners can read viewer sessions for their rooms" on public.viewer_sessions;
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

drop policy if exists "Owners can read room audit events" on public.audit_events;
create policy "Owner and admins can read room audit events"
on public.audit_events for select
to authenticated
using (public.user_can_manage_room(audit_events.room_id, auth.uid()));

drop policy if exists "Owners can write room audit events" on public.audit_events;
create policy "Owner and admins can write room audit events"
on public.audit_events for insert
to authenticated
with check (public.user_can_manage_room(audit_events.room_id, auth.uid()));

drop policy if exists "Owners can read room notifications" on public.notifications;
create policy "Owner and admins can read room notifications"
on public.notifications for select
to authenticated
using (public.user_can_manage_room(notifications.room_id, auth.uid()));

drop policy if exists "Owners can write room notifications" on public.notifications;
create policy "Owner and admins can write room notifications"
on public.notifications for insert
to authenticated
with check (public.user_can_manage_room(notifications.room_id, auth.uid()));

drop policy if exists "Owners can manage room NDA templates" on public.nda_templates;
create policy "Owner and admins can manage room NDA templates"
on public.nda_templates for all
to authenticated
using (public.user_can_manage_room(nda_templates.room_id, auth.uid()))
with check (public.user_can_manage_room(nda_templates.room_id, auth.uid()));

drop policy if exists "Owners can read NDA acceptances for their rooms" on public.nda_acceptances;
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

drop policy if exists "Owners can manage room members" on public.team_members;
create policy "Owners can manage room members"
on public.team_members for all
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = team_members.room_id
          and dr.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = team_members.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Users can read their own memberships" on public.team_members;
create policy "Users can read their own memberships"
on public.team_members for select
to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.data_rooms dr
        where dr.id = team_members.room_id
          and dr.owner_id = auth.uid()
    )
);

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
    or exists (
        select 1
        from public.team_members tm
        where tm.room_id = data_rooms.id
          and tm.user_id = auth.uid()
          and tm.role in ('owner', 'admin')
    )
);
