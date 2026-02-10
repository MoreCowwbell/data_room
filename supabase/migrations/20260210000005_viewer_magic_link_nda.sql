-- Viewer magic-link auth + NDA flow foundation (Sprint 2)

alter table if exists public.profiles
    add column if not exists email text;

update public.profiles
set email = lower(full_name)
where email is null
  and full_name like '%@%';

create unique index if not exists idx_profiles_email_unique
    on public.profiles(lower(email))
    where email is not null;

alter table if exists public.data_rooms
    add column if not exists nda_disclaimer_acknowledged_at timestamptz;

create table if not exists public.viewer_auth_tokens (
    id uuid primary key default gen_random_uuid(),
    link_id uuid not null references public.shared_links(id) on delete cascade,
    viewer_email text not null,
    token_hash text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index if not exists idx_viewer_auth_token_hash_unique
    on public.viewer_auth_tokens(token_hash);
create index if not exists idx_viewer_auth_tokens_link_email_created
    on public.viewer_auth_tokens(link_id, viewer_email, created_at desc);
create index if not exists idx_viewer_auth_tokens_expires
    on public.viewer_auth_tokens(expires_at);

alter table public.viewer_auth_tokens enable row level security;

drop policy if exists "Visitors can create auth tokens for active links" on public.viewer_auth_tokens;
create policy "Visitors can create auth tokens for active links"
on public.viewer_auth_tokens for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = viewer_auth_tokens.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
          and (sl.max_views is null or coalesce(sl.view_count, 0) < sl.max_views)
    )
);

drop policy if exists "Visitors can read unexpired auth tokens for active links" on public.viewer_auth_tokens;
create policy "Visitors can read unexpired auth tokens for active links"
on public.viewer_auth_tokens for select
to anon, authenticated
using (
    used_at is null
    and expires_at > now()
    and exists (
        select 1
        from public.shared_links sl
        where sl.id = viewer_auth_tokens.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
    )
);

drop policy if exists "Visitors can consume auth tokens for active links" on public.viewer_auth_tokens;
create policy "Visitors can consume auth tokens for active links"
on public.viewer_auth_tokens for update
to anon, authenticated
using (
    used_at is null
    and expires_at > now()
)
with check (
    used_at is not null
);

-- Ensure one active NDA template per room.
create unique index if not exists idx_nda_templates_one_active_per_room
    on public.nda_templates(room_id)
    where is_active = true;

