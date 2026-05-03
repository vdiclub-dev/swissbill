begin;

grant select on table public.utilisateurs to anon;

create policy anon_login_select
on public.utilisateurs
for select
to anon
using (coalesce(actif, true) = true);

commit;
