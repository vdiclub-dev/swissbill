-- Hide tariff rules that no longer point to an active product.
-- These orphaned legacy rules can stay in client_tariff_rules after a tariff
-- has been removed from the admin product list.

update public.client_tariff_rules r
set is_active = false,
    updated_at = now()
where r.is_active = true
  and not exists (
    select 1
    from public.produits_tarif p
    where coalesce(p.actif, true) = true
      and (
        p.id = r.produit_id
        or (
          r.produit_id is null
          and upper(trim(coalesce(p.ref, p.nom, ''))) = upper(trim(coalesce(r.tariff_code, r.name, '')))
        )
      )
  );

create or replace function public.client_list_my_tariff_rules(
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
  if auth.uid() is null then
    raise exception 'Session client obligatoire';
  end if;

  select *
    into v_profile
  from public.utilisateurs u
  where u.id = auth.uid()
    and coalesce(u.actif, true) = true
    and u.role in ('client', 'gestionnaire', 'comptable', 'sous_utilisateur')
  limit 1;

  if v_profile.id is null then
    raise exception 'Accès client refusé';
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
    and exists (
      select 1
      from public.produits_tarif p
      where coalesce(p.actif, true) = true
        and (
          p.id = r.produit_id
          or (
            r.produit_id is null
            and upper(trim(coalesce(p.ref, p.nom, ''))) = upper(trim(coalesce(r.tariff_code, r.name, '')))
          )
        )
    )
  order by r.priority asc, r.name asc;
end;
$$;

revoke all on function public.client_list_my_tariff_rules(uuid) from public;
grant execute on function public.client_list_my_tariff_rules(uuid) to authenticated;

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
    and exists (
      select 1
      from public.produits_tarif p
      where coalesce(p.actif, true) = true
        and (
          p.id = r.produit_id
          or (
            r.produit_id is null
            and upper(trim(coalesce(p.ref, p.nom, ''))) = upper(trim(coalesce(r.tariff_code, r.name, '')))
          )
        )
    )
  order by r.priority asc, r.name asc;
end;
$$;

revoke all on function public.client_list_my_tariff_rules_by_code(uuid, text, uuid) from public;
grant execute on function public.client_list_my_tariff_rules_by_code(uuid, text, uuid) to anon, authenticated;
