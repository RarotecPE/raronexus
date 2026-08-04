create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null,
  token_hash text not null unique,
  is_admin boolean not null default false,
  status varchar(20) not null default 'pending',
  invited_by uuid references public.users(id) on delete set null,
  avatar_url text,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_user_id uuid references public.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_invites_status_check check (status in ('pending', 'consumed', 'canceled'))
);

create unique index if not exists user_invites_pending_email_unique_idx
on public.user_invites (lower(email))
where status = 'pending' and consumed_at is null;

create index if not exists user_invites_email_idx on public.user_invites (lower(email));
create index if not exists user_invites_status_idx on public.user_invites (status);
create index if not exists user_invites_expires_at_idx on public.user_invites (expires_at);

drop trigger if exists user_invites_touch_updated_at on public.user_invites;
create trigger user_invites_touch_updated_at
before update on public.user_invites
for each row execute function public.touch_updated_at();

alter table public.user_invites enable row level security;

drop policy if exists "user_invites_admin_all" on public.user_invites;
create policy "user_invites_admin_all"
on public.user_invites for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
