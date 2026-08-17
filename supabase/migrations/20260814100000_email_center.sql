create table if not exists public.email_global_settings (
  id boolean primary key default true,
  display_name varchar(120) not null default 'RaroNexus',
  logo_url text,
  primary_color varchar(20) not null default '#0ea5e9',
  footer_text text not null default 'E-mail enviado pelo RaroNexus.',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint email_global_settings_singleton check (id = true)
);

insert into public.email_global_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.application_email_settings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  display_name varchar(120),
  logo_url text,
  primary_color varchar(20),
  footer_text text,
  reply_to_email varchar(255),
  allowed_recipient_domains text[] not null default '{}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(application_id)
);

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

create table if not exists public.application_email_endpoint_permissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  endpoint varchar(80) not null,
  enabled boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(application_id, endpoint)
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  endpoint varchar(80) not null,
  recipient_count integer not null default 0,
  recipient_domains text[] not null default '{}',
  subject text,
  status varchar(20) not null,
  error_code varchar(80),
  error_message text,
  provider_message_id text,
  metadata jsonb not null default '{}',
  created_at timestamp with time zone not null default now(),
  constraint email_delivery_logs_status_check check (status in ('success', 'error'))
);

create index if not exists application_email_settings_application_id_idx
on public.application_email_settings(application_id);

create index if not exists email_endpoints_active_idx
on public.email_endpoints(active);

create index if not exists application_email_endpoint_permissions_application_id_idx
on public.application_email_endpoint_permissions(application_id);

create index if not exists email_delivery_logs_application_id_idx
on public.email_delivery_logs(application_id);

create index if not exists email_delivery_logs_created_at_idx
on public.email_delivery_logs(created_at desc);

drop trigger if exists email_global_settings_touch_updated_at on public.email_global_settings;
create trigger email_global_settings_touch_updated_at
before update on public.email_global_settings
for each row execute function public.touch_updated_at();

drop trigger if exists application_email_settings_touch_updated_at on public.application_email_settings;
create trigger application_email_settings_touch_updated_at
before update on public.application_email_settings
for each row execute function public.touch_updated_at();

drop trigger if exists email_endpoints_touch_updated_at on public.email_endpoints;
create trigger email_endpoints_touch_updated_at
before update on public.email_endpoints
for each row execute function public.touch_updated_at();

drop trigger if exists application_email_endpoint_permissions_touch_updated_at on public.application_email_endpoint_permissions;
create trigger application_email_endpoint_permissions_touch_updated_at
before update on public.application_email_endpoint_permissions
for each row execute function public.touch_updated_at();

alter table public.email_global_settings enable row level security;
alter table public.application_email_settings enable row level security;
alter table public.email_endpoints enable row level security;
alter table public.application_email_endpoint_permissions enable row level security;
alter table public.email_delivery_logs enable row level security;

drop policy if exists "email_global_settings_admin_all" on public.email_global_settings;
create policy "email_global_settings_admin_all"
on public.email_global_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "application_email_settings_admin_all" on public.application_email_settings;
create policy "application_email_settings_admin_all"
on public.application_email_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "email_endpoints_admin_all" on public.email_endpoints;
create policy "email_endpoints_admin_all"
on public.email_endpoints for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "application_email_endpoint_permissions_admin_all" on public.application_email_endpoint_permissions;
create policy "application_email_endpoint_permissions_admin_all"
on public.application_email_endpoint_permissions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "email_delivery_logs_admin_select" on public.email_delivery_logs;
create policy "email_delivery_logs_admin_select"
on public.email_delivery_logs for select
to authenticated
using (public.is_admin());
