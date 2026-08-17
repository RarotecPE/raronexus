alter table public.email_endpoints
add column if not exists html_template text not null default '{{body}}';

update public.email_endpoints
set html_template = case
  when html_template is null or btrim(html_template) = '' then '{{body}}'
  when position('{{body}}' in html_template) = 0 then html_template || E'\n{{body}}'
  else html_template
end;

alter table public.email_endpoints
drop constraint if exists email_endpoints_html_template_body_check;

alter table public.email_endpoints
add constraint email_endpoints_html_template_body_check
check (position('{{body}}' in html_template) > 0);
