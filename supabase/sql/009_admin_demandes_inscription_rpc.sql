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
