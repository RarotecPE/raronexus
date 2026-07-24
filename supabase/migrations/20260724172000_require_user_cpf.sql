alter table public.users
add constraint users_cpf_required
check (cpf is not null and cpf <> '')
not valid;
