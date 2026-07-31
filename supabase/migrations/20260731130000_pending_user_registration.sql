alter table public.users
drop constraint if exists users_cpf_required;

alter table public.users
alter column nome drop not null;
