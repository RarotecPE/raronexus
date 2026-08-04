create table if not exists public.global_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  session_key text not null,
  origin text,
  user_agent text,
  ip_address varchar,
  issued_at timestamp with time zone not null default now(),
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists global_sessions_user_id_idx on public.global_sessions(user_id);
create index if not exists global_sessions_session_key_idx on public.global_sessions(session_key);
create index if not exists global_sessions_token_hash_idx on public.global_sessions(token_hash);
create index if not exists global_sessions_revoked_at_idx on public.global_sessions(revoked_at);

alter table public.sso_authorization_codes
add column if not exists global_session_id uuid references public.global_sessions(id) on delete set null;

alter table public.global_sessions enable row level security;

drop policy if exists "global_sessions_admin_select" on public.global_sessions;
create policy "global_sessions_admin_select"
on public.global_sessions for select
to authenticated
using (public.is_admin());
