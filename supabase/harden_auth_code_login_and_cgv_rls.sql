begin;

create or replace function public.login_with_code(p_code text)
returns table (
  id uuid,
  role text,
  nom text,
  prenom text,
  code_usr text,
  actif boolean,
  entreprise_id uuid,
  cgv_version_accepted text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    u.id,
    u.role,
    u.nom,
    u.prenom,
    u.code_usr,
    u.actif,
    u.entreprise_id,
    u.cgv_version_accepted
  from public.utilisateurs u
  where upper(trim(coalesce(u.code_usr, ''))) = upper(trim(coalesce(p_code, '')))
    and coalesce(u.actif, true) = true
  limit 1;
end;
$$;

create or replace function public.get_code_user_profile(p_user_id uuid, p_code text)
returns table (
  id uuid,
  email text,
  nom text,
  prenom text,
  role text,
  entreprise_id uuid,
  cgv_version_accepted text,
  cgv_accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    u.id,
    u.email,
    u.nom,
    u.prenom,
    u.role,
    u.entreprise_id,
    u.cgv_version_accepted,
    u.cgv_accepted_at
  from public.utilisateurs u
  where u.id = p_user_id
    and upper(trim(coalesce(u.code_usr, ''))) = upper(trim(coalesce(p_code, '')))
    and coalesce(u.actif, true) = true
  limit 1;
end;
$$;

create or replace function public.accept_cgv_with_code(
  p_user_id uuid,
  p_code text,
  p_version_code text,
  p_accepted_at timestamptz,
  p_ip text,
  p_user_agent text,
  p_content_hash text,
  p_pdf_path text,
  p_pdf_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  update public.utilisateurs u
  set
    cgv_version_accepted = p_version_code,
    cgv_accepted_at = p_accepted_at,
    cgv_accept_ip = p_ip,
    cgv_accept_user_agent = p_user_agent
  where u.id = p_user_id
    and upper(trim(coalesce(u.code_usr, ''))) = upper(trim(coalesce(p_code, '')))
    and coalesce(u.actif, true) = true
  returning u.id into v_user_id;

  if v_user_id is null then
    return false;
  end if;

  insert into public.cgv_acceptations (
    user_id,
    version_code,
    accepted_at,
    ip,
    user_agent,
    content_hash,
    pdf_path,
    pdf_url
  ) values (
    v_user_id,
    p_version_code,
    p_accepted_at,
    p_ip,
    p_user_agent,
    p_content_hash,
    p_pdf_path,
    p_pdf_url
  );

  return true;
end;
$$;

grant execute on function public.login_with_code(text) to anon, authenticated;
grant execute on function public.get_code_user_profile(uuid, text) to anon, authenticated;
grant execute on function public.accept_cgv_with_code(uuid, text, text, timestamptz, text, text, text, text, text) to anon, authenticated;

drop policy if exists admin_read_demandes on public.demandes_inscription;

drop policy if exists cgv_versions_read on public.cgv_versions;
create policy cgv_versions_read_authenticated
on public.cgv_versions
for select
to authenticated
using (true);

drop policy if exists cgv_accept_all on public.cgv_acceptations;
create policy cgv_acceptations_authenticated_insert_own
on public.cgv_acceptations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy cgv_acceptations_authenticated_select_own
on public.cgv_acceptations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.utilisateurs u
    where u.id = (select auth.uid())
      and u.role in ('admin', 'super_admin')
  )
);

drop policy if exists anon_update_own_cgv on public.utilisateurs;
drop policy if exists anon_all_utilisateurs on public.utilisateurs;
drop policy if exists anon_login_select on public.utilisateurs;
create policy anon_login_select
on public.utilisateurs
for select
to anon
using (coalesce(actif, true) = true);

commit;
