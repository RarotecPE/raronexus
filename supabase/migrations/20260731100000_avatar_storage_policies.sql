-- 20260731100000_avatar_storage_policies.sql
-- Libera upload de avatar no Supabase Storage para o proprio usuario e admins.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_public_select" on storage.objects;
create policy "avatars_public_select"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_self_or_admin" on storage.objects;
create policy "avatars_insert_self_or_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.users
      where users.id::text = (storage.foldername(name))[1]
        and users.auth_user_id = auth.uid()
        and users.ativo = true
    )
  )
);

drop policy if exists "avatars_update_self_or_admin" on storage.objects;
create policy "avatars_update_self_or_admin"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.users
      where users.id::text = (storage.foldername(name))[1]
        and users.auth_user_id = auth.uid()
        and users.ativo = true
    )
  )
)
with check (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.users
      where users.id::text = (storage.foldername(name))[1]
        and users.auth_user_id = auth.uid()
        and users.ativo = true
    )
  )
);

drop policy if exists "avatars_delete_self_or_admin" on storage.objects;
create policy "avatars_delete_self_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.users
      where users.id::text = (storage.foldername(name))[1]
        and users.auth_user_id = auth.uid()
        and users.ativo = true
    )
  )
);
