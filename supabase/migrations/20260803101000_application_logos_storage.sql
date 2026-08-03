insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "logos_public_select" on storage.objects;
create policy "logos_public_select"
on storage.objects for select
using (bucket_id = 'logos');

drop policy if exists "logos_admin_insert" on storage.objects;
create policy "logos_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'logos' and public.is_admin());

drop policy if exists "logos_admin_update" on storage.objects;
create policy "logos_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'logos' and public.is_admin())
with check (bucket_id = 'logos' and public.is_admin());

drop policy if exists "logos_admin_delete" on storage.objects;
create policy "logos_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'logos' and public.is_admin());
