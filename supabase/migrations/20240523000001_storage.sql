-- Create a private bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Set up access policies for the 'documents' bucket
create policy "Authenticated users can upload documents"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'documents' );

create policy "Authenticated users can read their own documents"
on storage.objects for select
to authenticated
using ( bucket_id = 'documents' and owner = auth.uid() );

-- Note: We will use signed URLs for sharing, so strict RLS is good.
