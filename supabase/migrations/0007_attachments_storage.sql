-- Bucket de stockage privé pour les pièces jointes (certificats médicaux, etc.)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Mêmes règles que la table public.attachments : lecture pour tous les
-- connectés, ajout pour admin/manager, suppression pour admin uniquement.
create policy "attachments_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments');

create policy "attachments_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments' and public.is_admin_or_manager(auth.uid())
  );

create policy "attachments_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments' and public.has_role(auth.uid(), 'admin')
  );
