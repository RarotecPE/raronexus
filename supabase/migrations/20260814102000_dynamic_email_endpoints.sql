create table if not exists public.email_endpoints (
  id uuid primary key default gen_random_uuid(),
  key varchar(80) not null unique,
  name varchar(120) not null,
  description text,
  active boolean not null default true,
  default_subject varchar(160),
  default_title varchar(140),
  default_message text,
  default_action_label varchar(60),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint email_endpoints_key_check check (key ~ '^[a-z0-9_.-]+$')
);

insert into public.email_endpoints (key, name, description, active)
values
  ('send', 'Envio padrão', 'Endpoint genérico para envio de e-mails estruturados.', true),
  ('test', 'Teste de envio', 'Endpoint para validar a configuração SMTP da plataforma.', true)
on conflict (key) do nothing;

alter table public.application_email_endpoint_permissions
drop constraint if exists application_email_endpoint_check;

alter table public.application_email_endpoint_permissions
alter column endpoint type varchar(80);

alter table public.email_delivery_logs
alter column endpoint type varchar(80);

create index if not exists email_endpoints_active_idx
on public.email_endpoints(active);

drop trigger if exists email_endpoints_touch_updated_at on public.email_endpoints;
create trigger email_endpoints_touch_updated_at
before update on public.email_endpoints
for each row execute function public.touch_updated_at();

alter table public.email_endpoints enable row level security;

drop policy if exists "email_endpoints_admin_all" on public.email_endpoints;
create policy "email_endpoints_admin_all"
on public.email_endpoints for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
