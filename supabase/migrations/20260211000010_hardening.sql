-- S8: Add UPDATE policy for link_access_logs so beacon can update last_active_at.
-- Without this, the analytics beacon's last_active_at updates silently fail.

drop policy if exists "Visitors can update active link access logs" on public.link_access_logs;
create policy "Visitors can update active link access logs"
on public.link_access_logs for update
to anon, authenticated
using (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = link_access_logs.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
    )
)
with check (
    exists (
        select 1
        from public.shared_links sl
        where sl.id = link_access_logs.link_id
          and sl.is_active = true
          and (sl.expires_at is null or sl.expires_at > now())
    )
);

-- S10: Add file_size column to documents table.
-- AI tools reference file_size but the column didn't exist.

alter table public.documents
    add column if not exists file_size bigint;

-- S17: Scope storage upload policy to room ownership.
-- Previously any authenticated user could upload to any room's path.

drop policy if exists "Authenticated users can upload documents" on storage.objects;
create policy "Authenticated users can upload documents"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'documents'
    and exists (
        select 1
        from public.data_rooms dr
        where dr.owner_id = auth.uid()
          and (storage.objects.name like dr.id || '/%')
    )
);
