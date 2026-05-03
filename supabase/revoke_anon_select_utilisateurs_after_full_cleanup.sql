drop policy if exists anon_login_select on public.utilisateurs;
revoke select on public.utilisateurs from anon;
