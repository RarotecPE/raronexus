create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome varchar(150) not null,
  email varchar(255) not null unique,
  cpf varchar(14),
  telefone varchar(20),
  avatar_url text,
  ativo boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  nome varchar(100) not null,
  descricao text,
  client_id varchar(100) not null unique,
  client_secret varchar(255) not null,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.user_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  ativo boolean not null default true,
  unique (user_id, application_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  event varchar(100) not null,
  ip_address varchar,
  created_at timestamp with time zone not null default now()
);

create index if not exists users_auth_user_id_idx on public.users(auth_user_id);
create index if not exists users_email_idx on public.users(email);
create index if not exists users_ativo_idx on public.users(ativo);
create index if not exists applications_client_id_idx on public.applications(client_id);
create index if not exists user_applications_user_id_idx on public.user_applications(user_id);
create index if not exists user_applications_application_id_idx on public.user_applications(application_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
before update on public.users
for each row execute function public.touch_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() and ativo = true limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid()
      and ativo = true
      and is_admin = true
  );
$$;

alter table public.users enable row level security;
alter table public.applications enable row level security;
alter table public.user_applications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
on public.users for select
to authenticated
using (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists "users_update_self_or_admin" on public.users;
create policy "users_update_self_or_admin"
on public.users for update
to authenticated
using (auth_user_id = auth.uid() or public.is_admin())
with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists "applications_select_active" on public.applications;
create policy "applications_select_active"
on public.applications for select
to authenticated
using (ativo = true or public.is_admin());

drop policy if exists "applications_admin_all" on public.applications;
create policy "applications_admin_all"
on public.applications for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "user_applications_select_self_or_admin" on public.user_applications;
create policy "user_applications_select_self_or_admin"
on public.user_applications for select
to authenticated
using (user_id = public.current_profile_id() or public.is_admin());

drop policy if exists "user_applications_admin_all" on public.user_applications;
create policy "user_applications_admin_all"
on public.user_applications for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select"
on public.audit_logs for select
to authenticated
using (public.is_admin());
