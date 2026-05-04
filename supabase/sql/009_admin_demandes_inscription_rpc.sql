create or replace function public.colixo_assert_code_admin(
  p_admin_id uuid,
  p_code text
)
returns public.utilisateurs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
begin
  select *
    into v_admin
  from public.utilisateurs u
  where u.id = p_admin_id
    and coalesce(u.actif, true) = true
    and u.role in ('admin', 'super_admin')
    and upper(trim(coalesce(p_code, ''))) in (
      upper(trim(coalesce(u.code_usr, ''))),
      upper(trim(coalesce(u.code, ''))),
      upper(trim(coalesce(u.code_acces, ''))),
      upper(trim(coalesce(u.code_connexion, '')))
    )
  limit 1;

  if v_admin.id is null then
    raise exception 'Session admin code invalide ou expirée';
  end if;

  return v_admin;
end;
$$;

revoke all on function public.colixo_assert_code_admin(uuid, text) from public;

create or replace function public.admin_list_demandes_inscription(
  p_admin_id uuid,
  p_code text
)
returns table (
  id uuid,
  created_at timestamptz,
  prenom text,
  nom text,
  email text,
  telephone text,
  entreprise_nom text,
  adresse text,
  message text,
  statut text,
  code_attribue text,
  role_attribue text,
  valide_le timestamptz,
  valide_par text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  return query
  select
    d.id,
    d.created_at,
    d.prenom,
    d.nom,
    d.email,
    d.telephone,
    d.entreprise_nom,
    d.adresse,
    d.message,
    d.statut,
    d.code_attribue,
    d.role_attribue,
    d.valide_le,
    d.valide_par
  from public.demandes_inscription d
  order by d.created_at desc
  limit 500;
end;
$$;

revoke all on function public.admin_list_demandes_inscription(uuid, text) from public;
grant execute on function public.admin_list_demandes_inscription(uuid, text) to anon, authenticated;

create or replace function public.admin_update_demande_inscription(
  p_admin_id uuid,
  p_code text,
  p_demande_id uuid,
  p_statut text,
  p_code_attribue text default null,
  p_role_attribue text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_row public.demandes_inscription;
begin
  v_admin := public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_statut not in ('en_attente', 'valide', 'refuse') then
    raise exception 'Statut demande invalide';
  end if;

  update public.demandes_inscription d
  set statut = p_statut,
      code_attribue = case when p_statut = 'valide' then p_code_attribue else d.code_attribue end,
      role_attribue = case when p_statut = 'valide' then p_role_attribue else d.role_attribue end,
      valide_le = case when p_statut = 'valide' then now() else d.valide_le end,
      valide_par = case when p_statut = 'valide' then coalesce(v_admin.code_usr, v_admin.code, v_admin.id::text) else d.valide_par end
  where d.id = p_demande_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Demande introuvable';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_update_demande_inscription(uuid, text, uuid, text, text, text) from public;
grant execute on function public.admin_update_demande_inscription(uuid, text, uuid, text, text, text) to anon, authenticated;

create or replace function public.admin_edit_demande_inscription(
  p_admin_id uuid,
  p_code text,
  p_demande_id uuid,
  p_prenom text,
  p_nom text,
  p_email text,
  p_telephone text default null,
  p_entreprise_nom text default null,
  p_adresse text default null,
  p_message text default null,
  p_statut text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.demandes_inscription;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if nullif(trim(coalesce(p_prenom, '')), '') is null then
    raise exception 'Prénom obligatoire';
  end if;

  if nullif(trim(coalesce(p_nom, '')), '') is null then
    raise exception 'Nom obligatoire';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Email obligatoire';
  end if;

  if p_statut is not null and p_statut not in ('en_attente', 'valide', 'refuse') then
    raise exception 'Statut demande invalide';
  end if;

  update public.demandes_inscription d
  set prenom = trim(p_prenom),
      nom = trim(p_nom),
      email = trim(p_email),
      telephone = nullif(trim(coalesce(p_telephone, '')), ''),
      entreprise_nom = nullif(trim(coalesce(p_entreprise_nom, '')), ''),
      adresse = nullif(trim(coalesce(p_adresse, '')), ''),
      message = nullif(trim(coalesce(p_message, '')), ''),
      statut = coalesce(p_statut, d.statut)
  where d.id = p_demande_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Demande introuvable';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_edit_demande_inscription(uuid, text, uuid, text, text, text, text, text, text, text, text) from public;
grant execute on function public.admin_edit_demande_inscription(uuid, text, uuid, text, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_delete_demande_inscription(
  p_admin_id uuid,
  p_code text,
  p_demande_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  delete from public.demandes_inscription d
  where d.id = p_demande_id;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Demande introuvable';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_delete_demande_inscription(uuid, text, uuid) from public;
grant execute on function public.admin_delete_demande_inscription(uuid, text, uuid) to anon, authenticated;

create or replace function public.admin_upsert_utilisateur_profile(
  p_admin_id uuid,
  p_code text,
  p_user_id uuid,
  p_email text,
  p_nom text default null,
  p_prenom text default null,
  p_telephone text default null,
  p_user_code text default null,
  p_role text default 'client',
  p_actif boolean default true,
  p_type_contrat text default 'fixe',
  p_taux_travail integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.utilisateurs;
  v_row public.utilisateurs;
begin
  v_admin := public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_user_id is null then
    raise exception 'ID utilisateur obligatoire';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Email obligatoire';
  end if;

  if p_role not in ('client', 'chauffeur', 'magasinier', 'admin', 'super_admin') then
    raise exception 'Rôle utilisateur invalide';
  end if;

  if p_role in ('admin', 'super_admin') and v_admin.role <> 'super_admin' then
    raise exception 'Seul un super admin peut créer ou modifier un administrateur';
  end if;

  if p_taux_travail is not null and (p_taux_travail < 0 or p_taux_travail > 100) then
    raise exception 'Taux de travail invalide';
  end if;

  insert into public.utilisateurs (
    id,
    email,
    nom,
    prenom,
    telephone,
    code,
    code_usr,
    role,
    actif,
    type_contrat,
    taux_travail
  )
  values (
    p_user_id,
    trim(p_email),
    nullif(trim(coalesce(p_nom, '')), ''),
    nullif(trim(coalesce(p_prenom, '')), ''),
    nullif(trim(coalesce(p_telephone, '')), ''),
    nullif(trim(coalesce(p_user_code, '')), ''),
    nullif(trim(coalesce(p_user_code, '')), ''),
    p_role,
    coalesce(p_actif, true),
    coalesce(nullif(trim(coalesce(p_type_contrat, '')), ''), 'fixe'),
    coalesce(p_taux_travail, 100)
  )
  on conflict (id) do update
  set email = excluded.email,
      nom = excluded.nom,
      prenom = excluded.prenom,
      telephone = excluded.telephone,
      code = excluded.code,
      code_usr = excluded.code_usr,
      role = excluded.role,
      actif = excluded.actif,
      type_contrat = excluded.type_contrat,
      taux_travail = excluded.taux_travail
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_upsert_utilisateur_profile(uuid, text, uuid, text, text, text, text, text, text, boolean, text, integer) from public;
grant execute on function public.admin_upsert_utilisateur_profile(uuid, text, uuid, text, text, text, text, text, text, boolean, text, integer) to anon, authenticated;

create or replace function public.admin_apply_standard_tariffs_to_client(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_client_id is null then
    raise exception 'Client obligatoire';
  end if;

  update public.client_tariff_rules r
  set is_active = false,
      updated_at = now()
  where r.client_id = p_client_id
    and exists (
      select 1
      from public.produits_tarif p
      where p.actif = true
        and upper(trim(coalesce(p.ref, p.nom, ''))) = upper(trim(coalesce(r.tariff_code, '')))
    );

  insert into public.client_tariff_rules (
    client_id,
    name,
    tariff_code,
    service_level,
    min_weight_kg,
    max_weight_kg,
    min_parcel_count,
    max_parcel_count,
    base_price_chf,
    price_per_parcel_chf,
    price_per_kg_chf,
    price_per_km_chf,
    included_km,
    extra_km_price_chf,
    fuel_surcharge_percent,
    discount_percent,
    is_active,
    priority
  )
  select
    p_client_id,
    coalesce(p.nom, p.ref, 'Tarif standard'),
    nullif(coalesce(p.ref, p.nom), ''),
    null,
    coalesce(p.poids_min, 0),
    null,
    1,
    null,
    coalesce(p.prix, 0),
    0,
    coalesce(p.increment_par_kg, 0),
    0,
    0,
    0,
    0,
    0,
    true,
    coalesce(p.ordre, 100)
  from public.produits_tarif p
  where p.actif = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_apply_standard_tariffs_to_client(uuid, text, uuid) from public;
grant execute on function public.admin_apply_standard_tariffs_to_client(uuid, text, uuid) to anon, authenticated;
