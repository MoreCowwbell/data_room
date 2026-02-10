-- Profiles
drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile"
on profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
on profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
on profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Data rooms
drop policy if exists "Owners can manage their data rooms" on data_rooms;
create policy "Owners can manage their data rooms"
on data_rooms for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Folders
drop policy if exists "Owners can manage room folders" on folders;
create policy "Owners can manage room folders"
on folders for all
to authenticated
using (
  exists (
    select 1
    from data_rooms dr
    where dr.id = folders.room_id
      and dr.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from data_rooms dr
    where dr.id = folders.room_id
      and dr.owner_id = auth.uid()
  )
);

-- Documents
drop policy if exists "Owners can manage room documents" on documents;
create policy "Owners can manage room documents"
on documents for all
to authenticated
using (
  exists (
    select 1
    from data_rooms dr
    where dr.id = documents.room_id
      and dr.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from data_rooms dr
    where dr.id = documents.room_id
      and dr.owner_id = auth.uid()
  )
);

drop policy if exists "Visitors can read linked documents rows" on documents;
create policy "Visitors can read linked documents rows"
on documents for select
to anon
using (
  exists (
    select 1
    from shared_links sl
    where sl.document_id = documents.id
      and sl.is_active = true
  )
);

-- Shared links
drop policy if exists "Owners can manage room links" on shared_links;
create policy "Owners can manage room links"
on shared_links for all
to authenticated
using (
  exists (
    select 1
    from data_rooms dr
    where dr.id = shared_links.room_id
      and dr.owner_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from data_rooms dr
    where dr.id = shared_links.room_id
      and dr.owner_id = auth.uid()
  )
);

drop policy if exists "Visitors can read active shared links" on shared_links;
create policy "Visitors can read active shared links"
on shared_links for select
to anon
using (is_active = true);

-- Access logs
drop policy if exists "Visitors can create access logs for active links" on link_access_logs;
create policy "Visitors can create access logs for active links"
on link_access_logs for insert
to anon, authenticated
with check (
  exists (
    select 1
    from shared_links sl
    where sl.id = link_access_logs.link_id
      and sl.is_active = true
  )
);

drop policy if exists "Owners can read room access logs" on link_access_logs;
create policy "Owners can read room access logs"
on link_access_logs for select
to authenticated
using (
  exists (
    select 1
    from shared_links sl
    join data_rooms dr on dr.id = sl.room_id
    where sl.id = link_access_logs.link_id
      and dr.owner_id = auth.uid()
  )
);

drop policy if exists "Visitors can read active link access logs" on link_access_logs;
create policy "Visitors can read active link access logs"
on link_access_logs for select
to anon
using (
  exists (
    select 1
    from shared_links sl
    where sl.id = link_access_logs.link_id
      and sl.is_active = true
  )
);

-- Document analytics
drop policy if exists "Visitors can insert analytics for active links" on document_analytics;
create policy "Visitors can insert analytics for active links"
on document_analytics for insert
to anon, authenticated
with check (
  exists (
    select 1
    from link_access_logs lal
    join shared_links sl on sl.id = lal.link_id
    where lal.id = document_analytics.access_log_id
      and sl.document_id = document_analytics.document_id
      and sl.is_active = true
  )
);

drop policy if exists "Owners can read room analytics" on document_analytics;
create policy "Owners can read room analytics"
on document_analytics for select
to authenticated
using (
  exists (
    select 1
    from link_access_logs lal
    join shared_links sl on sl.id = lal.link_id
    join data_rooms dr on dr.id = sl.room_id
    where lal.id = document_analytics.access_log_id
      and dr.owner_id = auth.uid()
  )
);

-- Storage access for link-based viewing
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
      join public.shared_links sl on sl.document_id = d.id
      where d.storage_path = storage.objects.name
        and sl.is_active = true
    )
  )
);
