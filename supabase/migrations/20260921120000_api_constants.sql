insert into storage.buckets (id, name, public, file_size_limit)
values ('constants', 'constants', false, 6291456)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.api_constants (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null unique,
  is_public boolean not null default false,
  current_version integer not null default 1,
  storage_path text not null,
  content_hash varchar(64) not null,
  original_size bigint not null,
  compressed_size bigint not null,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint api_constants_name_check check (
    name ~ '^[a-z0-9][a-z0-9_.-]{1,79}$' and name <> '_content' and name <> 'content'
  ),
  constraint api_constants_version_check check (current_version > 0),
  constraint api_constants_sizes_check check (original_size >= 0 and compressed_size >= 0)
);

create table if not exists public.api_constant_versions (
  id uuid primary key default gen_random_uuid(),
  constant_id uuid not null references public.api_constants(id) on delete cascade,
  version integer not null,
  storage_path text not null,
  content_hash varchar(64) not null,
  original_size bigint not null,
  compressed_size bigint not null,
  created_by uuid references public.users(id) on delete set null,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (constant_id, version),
  constraint api_constant_versions_version_check check (version > 0),
  constraint api_constant_versions_sizes_check check (original_size >= 0 and compressed_size >= 0)
);

create index if not exists api_constants_updated_at_idx
on public.api_constants(updated_at desc);

create index if not exists api_constant_versions_expiration_idx
on public.api_constant_versions(expires_at)
where expires_at is not null;

drop trigger if exists api_constants_touch_updated_at on public.api_constants;
create trigger api_constants_touch_updated_at
before update on public.api_constants
for each row execute function public.touch_updated_at();

alter table public.api_constants enable row level security;
alter table public.api_constant_versions enable row level security;

drop policy if exists "api_constants_admin_all" on public.api_constants;
create policy "api_constants_admin_all"
on public.api_constants for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "api_constant_versions_admin_all" on public.api_constant_versions;
create policy "api_constant_versions_admin_all"
on public.api_constant_versions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "constants_admin_select" on storage.objects;
create policy "constants_admin_select"
on storage.objects for select
to authenticated
using (bucket_id = 'constants' and public.is_admin());

drop policy if exists "constants_admin_insert" on storage.objects;
create policy "constants_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'constants' and public.is_admin());

drop policy if exists "constants_admin_update" on storage.objects;
create policy "constants_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'constants' and public.is_admin())
with check (bucket_id = 'constants' and public.is_admin());

drop policy if exists "constants_admin_delete" on storage.objects;
create policy "constants_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'constants' and public.is_admin());
