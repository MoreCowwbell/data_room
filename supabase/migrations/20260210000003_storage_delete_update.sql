drop policy if exists "Authenticated users can update their own documents" on storage.objects;
create policy "Authenticated users can update their own documents"
on storage.objects for update
to authenticated
using (bucket_id = 'documents' and owner = auth.uid())
with check (bucket_id = 'documents' and owner = auth.uid());

drop policy if exists "Authenticated users can delete their own documents" on storage.objects;
create policy "Authenticated users can delete their own documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'documents' and owner = auth.uid());
