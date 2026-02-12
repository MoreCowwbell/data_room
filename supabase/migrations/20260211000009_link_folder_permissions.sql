-- Folder-level access control for shared links (allowlist model)
-- Uses the existing permissions JSONB field: { "allowed_folders": ["uuid", ...] }
-- When allowed_folders is null/empty → full room access (backward compat)
-- When allowed_folders has values → only those folder subtrees are visible

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
        if link_row.room_id is distinct from doc_row.room_id then
            return false;
        end if;

        -- No folder restriction → full room access (backward compat)
        if link_row.permissions is null
           or link_row.permissions->'allowed_folders' is null
           or jsonb_array_length(link_row.permissions->'allowed_folders') = 0 then
            return true;
        end if;

        -- Has allowed_folders → check if document's folder is in an allowed subtree
        if doc_row.folder_id is null then
            return false;  -- root docs excluded when folder filter is active
        end if;

        return exists (
            with recursive folder_tree as (
                select f.id
                from public.folders f
                where f.id::text in (
                    select jsonb_array_elements_text(link_row.permissions->'allowed_folders')
                )
                  and f.room_id = link_row.room_id
                  and f.deleted_at is null
                union all
                select f2.id
                from public.folders f2
                join folder_tree ft on f2.parent_id = ft.id
                where f2.deleted_at is null
            )
            select 1 from folder_tree where id = doc_row.folder_id
        );
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
