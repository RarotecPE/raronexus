create table if not exists public.sso_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.application_roles(id) on delete restrict,
  redirect_uri text not null,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists sso_authorization_codes_application_id_idx
on public.sso_authorization_codes(application_id);

create index if not exists sso_authorization_codes_expires_at_idx
on public.sso_authorization_codes(expires_at);

alter table public.sso_authorization_codes enable row level security;
