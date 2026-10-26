-- Private buckets for receipt and item photos. Files live under a folder
-- named after the household id: <household_id>/<anything>.jpg

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false), ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

create policy household_files_select on storage.objects for select to authenticated
  using (
    bucket_id in ('receipts', 'item-photos')
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy household_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('receipts', 'item-photos')
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy household_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('receipts', 'item-photos')
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
