alter table public.applications
add column if not exists homepage_url text,
add column if not exists redirect_uris text[] not null default '{}',
add column if not exists allowed_origins text[] not null default '{}',
add column if not exists updated_at timestamp with time zone not null default now();

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
before update on public.applications
for each row execute function public.touch_updated_at();

create table if not exists public.application_roles (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  nome varchar(100) not null,
  chave varchar(100) not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (application_id, chave)
);

drop trigger if exists application_roles_touch_updated_at on public.application_roles;
create trigger application_roles_touch_updated_at
before update on public.application_roles
for each row execute function public.touch_updated_at();

alter table public.user_applications
add column if not exists role_id uuid references public.application_roles(id) on delete set null,
add column if not exists updated_at timestamp with time zone not null default now();

drop trigger if exists user_applications_touch_updated_at on public.user_applications;
create trigger user_applications_touch_updated_at
before update on public.user_applications
for each row execute function public.touch_updated_at();

create index if not exists application_roles_application_id_idx on public.application_roles(application_id);
create index if not exists application_roles_chave_idx on public.application_roles(chave);
create index if not exists user_applications_role_id_idx on public.user_applications(role_id);

alter table public.application_roles enable row level security;

drop policy if exists "application_roles_select_active" on public.application_roles;
create policy "application_roles_select_active"
on public.application_roles for select
to authenticated
using (ativo = true or public.is_admin());

drop policy if exists "application_roles_admin_all" on public.application_roles;
create policy "application_roles_admin_all"
on public.application_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
