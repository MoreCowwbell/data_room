-- Alpha Sprint 1 foundation:
-- - Scoped shared links (room/folder/document)
-- - Link constraints (expiry/max views/download/NDA)
-- - Soft delete fields for folders/documents
-- - Future sprint foundation tables (audit, notifications, team, NDA, downloads, sessions)
-- - Policy updates for scoped document access

-- Shared link scope + constraints
alter table if exists public.shared_links
    add column if not exists link_type text default 'document',
    add column if not exists folder_id uuid references public.folders(id) on delete set null,
    add column if not exists name text,
    add column if not exists require_nda boolean not null default false,
    add column if not exists allow_download boolean not null default false,
    add column if not exists expires_at timestamptz,
    add column if not exists max_views integer;

update public.shared_links
set
    link_type = case
        when document_id is not null then 'document'
        when folder_id is not null then 'folder'
        else 'room'
    end,
    allow_download = coalesce((settings ->> 'allow_download')::boolean, allow_download, false)
where link_type is null
   or link_type not in ('room', 'folder', 'document');

alter table public.shared_links
    alter column link_type set not null;

alter table public.shared_links
    drop constraint if exists shared_links_link_type_check;
alter table public.shared_links
    add constraint shared_links_link_type_check
        check (link_type in ('room', 'folder', 'document'));

alter table public.shared_links
    drop constraint if exists shared_links_max_views_check;
alter table public.shared_links
    add constraint shared_links_max_views_check
        check (max_views is null or max_views > 0);

alter table public.shared_links
    drop constraint if exists shared_links_target_scope_check;
alter table public.shared_links
    add constraint shared_links_target_scope_check check (
        (
            link_type = 'room'
            and room_id is not null
            and folder_id is null
            and document_id is null
        )
        or
        (
            link_type = 'folder'
            and room_id is not null
            and folder_id is not null
            and document_id is null
        )
        or
        (
            link_type = 'document'
            and room_id is not null
            and document_id is not null
            and folder_id is null
        )
    );

create index if not exists idx_shared_links_slug on public.shared_links(slug);
create index if not exists idx_shared_links_room_id on public.shared_links(room_id);
create index if not exists idx_shared_links_document_id on public.shared_links(document_id);
create index if not exists idx_shared_links_folder_id on public.shared_links(folder_id);
create index if not exists idx_shared_links_active_expires on public.shared_links(is_active, expires_at);

-- Soft delete support
alter table if exists public.documents
    add column if not exists deleted_at timestamptz;
alter table if exists public.folders
    add column if not exists deleted_at timestamptz;

create index if not exists idx_documents_room_deleted on public.documents(room_id, deleted_at);
create index if not exists idx_documents_folder_deleted on public.documents(folder_id, deleted_at);
create index if not exists idx_folders_room_deleted on public.folders(room_id, deleted_at);
create index if not exists idx_folders_parent_deleted on public.folders(parent_id, deleted_at);

-- Future sprint foundation tables
create table if not exists public.audit_events (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.data_rooms(id) on delete cascade,
    actor_id uuid references public.profiles(id),
    actor_type text not null default 'user',
    action text not null,
    target_type text not null,
    target_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.data_rooms(id) on delete cascade,
    link_id uuid references public.shared_links(id) on delete set null,
    event_type text not null,
    recipient_email text,
    payload jsonb not null default '{}'::jsonb,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.team_members (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.data_rooms(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    role text not null default 'admin',
    invited_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    unique (room_id, user_id)
);

alter table public.team_members
    drop constraint if exists team_members_role_check;
alter table public.team_members
    add constraint team_members_role_check check (role in ('owner', 'admin'));

create table if not exists public.nda_templates (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.data_rooms(id) on delete cascade not null,
    title text not null,
    body text not null,
    version integer not null default 1,
    template_hash text not null,
    is_active boolean not null default true,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.nda_acceptances (
    id uuid primary key default gen_random_uuid(),
    link_id uuid references public.shared_links(id) on delete cascade not null,
    nda_template_id uuid references public.nda_templates(id) on delete set null,
    viewer_email text not null,
    template_hash text not null,
    accepted_at timestamptz not null default now(),
    ip_address text,
    user_agent text
);

create table if not exists public.download_events (
    id uuid primary key default gen_random_uuid(),
    link_id uuid references public.shared_links(id) on delete cascade not null,
    document_id uuid references public.documents(id) on delete cascade not null,
    viewer_email text,
    visitor_session_token text,
    ip_address text,
    user_agent text,
    downloaded_at timestamptz not null default now()
);

create table if not exists public.viewer_sessions (
    id uuid primary key default gen_random_uuid(),
    link_id uuid references public.shared_links(id) on delete cascade not null,
    viewer_email text not null,
    session_token text not null unique,
    ip_address text,
    user_agent text,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '24 hours'),
    last_seen_at timestamptz not null default now()
);

create table if not exists public.page_views (
    id uuid primary key default gen_random_uuid(),
    link_id uuid references public.shared_links(id) on delete cascade not null,
    document_id uuid references public.documents(id) on delete cascade not null,
    visitor_session_token text not null,
    page_number integer not null check (page_number > 0),
    duration_seconds numeric not null check (duration_seconds >= 0),
    viewed_at timestamptz not null default now()
);

create index if not exists idx_team_members_room on public.team_members(room_id);
create index if not exists idx_audit_events_room_created on public.audit_events(room_id, created_at desc);
create index if not exists idx_notifications_room_created on public.notifications(room_id, created_at desc);
create index if not exists idx_nda_acceptances_link_email on public.nda_acceptances(link_id, viewer_email);
create index if not exists idx_download_events_link_doc on public.download_events(link_id, document_id, downloaded_at desc);
create index if not exists idx_viewer_sessions_link_created on public.viewer_sessions(link_id, created_at desc);
create index if not exists idx_page_views_link_doc_viewed on public.page_views(link_id, document_id, viewed_at desc);

-- Link/document scope helper used by policies and server logic.
create or replace function public.link_allows_document(target_link_id uuid, target_document_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    link_row public.shared_links%rowtype;
    doc_row record;
begin
    select *
    into link_row
    from public.shared_links
    where id = target_link_id;

    if not found then
        return false;
    end if;

    if link_row.is_active is distinct from true then
        return false;
    end if;

    if link_row.expires_at is not null and link_row.expires_at <= now() then
        return false;
    end if;

    select d.id, d.room_id, d.folder_id, d.deleted_at
    into doc_row
    from public.documents d
    where d.id = target_document_id;

    if not found or doc_row.deleted_at is not null then
        return false;
    end if;

    if link_row.link_type = 'document' then
        return link_row.document_id = target_document_id;
    end if;

    if link_row.link_type = 'room' then
        return link_row.room_id = doc_row.room_id;
    end if;

    if link_row.link_type = 'folder' then
        if link_row.room_id is distinct from doc_row.room_id then
            return false;
        end if;

        if doc_row.folder_id is null then
            return false;
        end if;

        return exists (
            with recursive folder_tree as (
                select f.id
                from public.folders f
                where f.id = link_row.folder_id
                  and f.deleted_at is null
                union all
                select f2.id
                from public.folders f2
                join folder_tree ft on f2.parent_id = ft.id
                where f2.deleted_at is null
            )
            select 1
            from folder_tree
            where id = doc_row.folder_id
        );
    end if;

    return false;
end;
$$;

grant execute on function public.link_allows_document(uuid, uuid) to anon, authenticated;

-- Keep denormalized view_count in sync.
create or replace function public.increment_shared_link_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.shared_links
    set view_count = coalesce(view_count, 0) + 1
    where id = new.link_id;

    return new;
end;
$$;

drop trigger if exists trg_increment_shared_link_view_count on public.link_access_logs;
create trigger trg_increment_shared_link_view_count
after insert on public.link_access_logs
for each row
execute function public.increment_shared_link_view_count();

-- RLS enablement for new tables
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.team_members enable row level security;
alter table public.nda_templates enable row level security;
alter table public.nda_acceptances enable row level security;
alter table public.download_events enable row level security;
alter table public.viewer_sessions enable row level security;
alter table public.page_views enable row level security;

-- Shared links
drop policy if exists "Owners can manage room links" on public.shared_links;
create policy "Owners can manage room links"
on public.shared_links for all
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = shared_links.room_id
          and dr.owner_id = auth.uid()
    )
)
with check (
    created_by = auth.uid()
    and exists (
        select 1
        from public.data_rooms dr
        where dr.id = shared_links.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Visitors can read active shared links" on public.shared_links;
create policy "Visitors can read active shared links"
on public.shared_links for select
to anon
using (
    is_active = true
    and (expires_at is null or expires_at > now())
);

-- Documents: owners manage, visitors can only read docs currently reachable by active scoped links.
drop policy if exists "Owners can manage room documents" on public.documents;
create policy "Owners can manage room documents"
on public.documents for all
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = documents.room_id
          and dr.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = documents.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Visitors can read linked documents rows" on public.documents;
create policy "Visitors can read linked documents rows"
on public.documents for select
to anon
using (
    deleted_at is null
    and exists (
        select 1
        from public.shared_links sl
        where public.link_allows_document(sl.id, documents.id)
    )
);

-- Folders
drop policy if exists "Owners can manage room folders" on public.folders;
create policy "Owners can manage room folders"
on public.folders for all
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = folders.room_id
          and dr.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = folders.room_id
          and dr.owner_id = auth.uid()
    )
);

-- Access logs and analytics events
drop policy if exists "Visitors can create access logs for active links" on public.link_access_logs;
create policy "Visitors can create access logs for active links"
on public.link_access_logs for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = link_access_logs.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
          and (sl.max_views is null or coalesce(sl.view_count, 0) < sl.max_views)
    )
);

drop policy if exists "Visitors can read active link access logs" on public.link_access_logs;
create policy "Visitors can read active link access logs"
on public.link_access_logs for select
to anon
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = link_access_logs.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
    )
);

drop policy if exists "Owners can read room access logs" on public.link_access_logs;
create policy "Owners can read room access logs"
on public.link_access_logs for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        join public.data_rooms dr on dr.id = sl.room_id
        where sl.id = link_access_logs.link_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Visitors can insert analytics for active links" on public.document_analytics;
create policy "Visitors can insert analytics for active links"
on public.document_analytics for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.link_access_logs lal
        where lal.id = document_analytics.access_log_id
          and public.link_allows_document(lal.link_id, document_analytics.document_id)
    )
);

drop policy if exists "Owners can read room analytics" on public.document_analytics;
create policy "Owners can read room analytics"
on public.document_analytics for select
to authenticated
using (
    exists (
        select 1
        from public.link_access_logs lal
        join public.shared_links sl on sl.id = lal.link_id
        join public.data_rooms dr on dr.id = sl.room_id
        where lal.id = document_analytics.access_log_id
          and dr.owner_id = auth.uid()
    )
);

-- Page views (new normalized analytics stream)
drop policy if exists "Visitors can insert page views for scoped links" on public.page_views;
create policy "Visitors can insert page views for scoped links"
on public.page_views for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.link_access_logs lal
        where lal.link_id = page_views.link_id
          and lal.visitor_session_token = page_views.visitor_session_token
          and public.link_allows_document(page_views.link_id, page_views.document_id)
    )
);

drop policy if exists "Owners can read page views for their rooms" on public.page_views;
create policy "Owners can read page views for their rooms"
on public.page_views for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        join public.data_rooms dr on dr.id = sl.room_id
        where sl.id = page_views.link_id
          and dr.owner_id = auth.uid()
    )
);

-- Storage policy aligned with scoped links
drop policy if exists "Visitors can read linked documents" on storage.objects;
create policy "Visitors can read linked documents"
on storage.objects for select
to anon, authenticated
using (
    bucket_id = 'documents'
    and (
        owner = auth.uid()
        or exists (
            select 1
            from public.documents d
            where d.storage_path = storage.objects.name
              and d.deleted_at is null
              and exists (
                  select 1
                  from public.shared_links sl
                  where public.link_allows_document(sl.id, d.id)
              )
        )
    )
);

-- Team members
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
using (user_id = auth.uid());

-- Audit and notifications
drop policy if exists "Owners can read room audit events" on public.audit_events;
create policy "Owners can read room audit events"
on public.audit_events for select
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = audit_events.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Owners can write room audit events" on public.audit_events;
create policy "Owners can write room audit events"
on public.audit_events for insert
to authenticated
with check (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = audit_events.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Owners can read room notifications" on public.notifications;
create policy "Owners can read room notifications"
on public.notifications for select
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = notifications.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Owners can write room notifications" on public.notifications;
create policy "Owners can write room notifications"
on public.notifications for insert
to authenticated
with check (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = notifications.room_id
          and dr.owner_id = auth.uid()
    )
);

-- NDA templates / acceptances
drop policy if exists "Owners can manage room NDA templates" on public.nda_templates;
create policy "Owners can manage room NDA templates"
on public.nda_templates for all
to authenticated
using (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = nda_templates.room_id
          and dr.owner_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.data_rooms dr
        where dr.id = nda_templates.room_id
          and dr.owner_id = auth.uid()
    )
);

drop policy if exists "Visitors can write NDA acceptances for active links" on public.nda_acceptances;
create policy "Visitors can write NDA acceptances for active links"
on public.nda_acceptances for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = nda_acceptances.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
    )
);

drop policy if exists "Owners can read NDA acceptances for their rooms" on public.nda_acceptances;
create policy "Owners can read NDA acceptances for their rooms"
on public.nda_acceptances for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        join public.data_rooms dr on dr.id = sl.room_id
        where sl.id = nda_acceptances.link_id
          and dr.owner_id = auth.uid()
    )
);

-- Download events
drop policy if exists "Visitors can insert download events for scoped links" on public.download_events;
create policy "Visitors can insert download events for scoped links"
on public.download_events for insert
to anon, authenticated
with check (
    public.link_allows_document(download_events.link_id, download_events.document_id)
);

drop policy if exists "Owners can read download events for their rooms" on public.download_events;
create policy "Owners can read download events for their rooms"
on public.download_events for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        join public.data_rooms dr on dr.id = sl.room_id
        where sl.id = download_events.link_id
          and dr.owner_id = auth.uid()
    )
);

-- Viewer sessions (prepared for Sprint 2 flow)
drop policy if exists "Visitors can create viewer sessions for active links" on public.viewer_sessions;
create policy "Visitors can create viewer sessions for active links"
on public.viewer_sessions for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = viewer_sessions.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
    )
);

drop policy if exists "Owners can read viewer sessions for their rooms" on public.viewer_sessions;
create policy "Owners can read viewer sessions for their rooms"
on public.viewer_sessions for select
to authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        join public.data_rooms dr on dr.id = sl.room_id
        where sl.id = viewer_sessions.link_id
          and dr.owner_id = auth.uid()
    )
);
