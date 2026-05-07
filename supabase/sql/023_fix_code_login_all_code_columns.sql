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
    coalesce(u.code_usr, u.code, u.code_acces, u.code_connexion) as code_usr,
    u.actif,
    u.entreprise_id,
    u.cgv_version_accepted
  from public.utilisateurs u
  where upper(trim(coalesce(p_code, ''))) in (
      upper(trim(coalesce(u.code_usr, ''))),
      upper(trim(coalesce(u.code, ''))),
      upper(trim(coalesce(u.code_acces, ''))),
      upper(trim(coalesce(u.code_connexion, '')))
    )
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
    and upper(trim(coalesce(p_code, ''))) in (
      upper(trim(coalesce(u.code_usr, ''))),
      upper(trim(coalesce(u.code, ''))),
      upper(trim(coalesce(u.code_acces, ''))),
      upper(trim(coalesce(u.code_connexion, '')))
    )
    and coalesce(u.actif, true) = true
  limit 1;
end;
$$;

revoke all on function public.login_with_code(text) from public;
grant execute on function public.login_with_code(text) to anon, authenticated;

revoke all on function public.get_code_user_profile(uuid, text) from public;
grant execute on function public.get_code_user_profile(uuid, text) to anon, authenticated;
