begin;

drop policy if exists anon_login_select on public.utilisateurs;

revoke all privileges on table public.utilisateurs from anon;
revoke all privileges on table public.cgv_acceptations from anon;

revoke all privileges on table public.demandes_inscription from anon;
grant insert on table public.demandes_inscription to anon;

grant select, insert, update, delete on table public.utilisateurs to authenticated;
grant select, insert on table public.cgv_acceptations to authenticated;
grant select, insert, update on table public.demandes_inscription to authenticated;

commit;
