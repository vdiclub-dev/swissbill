create or replace function public.client_list_my_tariff_rules_by_code(
  p_user_id uuid,
  p_code text,
  p_client_id uuid
)
returns setof public.client_tariff_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.utilisateurs;
  v_scope uuid;
begin
  select *
    into v_profile
  from public.utilisateurs u
  where u.id = p_user_id
    and coalesce(u.actif, true) = true
    and u.role in ('client', 'gestionnaire', 'comptable', 'sous_utilisateur')
    and upper(trim(coalesce(p_code, ''))) in (
      upper(trim(coalesce(u.code_usr, ''))),
      upper(trim(coalesce(u.code, ''))),
      upper(trim(coalesce(u.code_acces, ''))),
      upper(trim(coalesce(u.code_connexion, '')))
    )
  limit 1;

  if v_profile.id is null then
    raise exception 'Session client code invalide ou expirée';
  end if;

  v_scope := coalesce(v_profile.entreprise_id, v_profile.id);

  if p_client_id is not null and p_client_id <> v_scope then
    raise exception 'Accès tarif client refusé';
  end if;

  return query
  select r.*
  from public.client_tariff_rules r
  where r.client_id = v_scope
    and r.is_active = true
  order by r.priority asc, r.name asc;
end;
$$;

revoke all on function public.client_list_my_tariff_rules_by_code(uuid, text, uuid) from public;
grant execute on function public.client_list_my_tariff_rules_by_code(uuid, text, uuid) to anon, authenticated;
