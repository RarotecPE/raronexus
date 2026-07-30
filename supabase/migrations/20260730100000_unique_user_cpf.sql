alter table public.users
add column if not exists cpf_digits text
generated always as (regexp_replace(cpf, '\D', '', 'g')) stored;

create unique index if not exists users_cpf_digits_unique_idx
on public.users (cpf_digits)
where cpf_digits is not null and cpf_digits <> '';
