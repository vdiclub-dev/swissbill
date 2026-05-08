create or replace function public.colixo_apply_prix_special(
  p_base numeric,
  p_type text,
  p_valeur numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_type in ('pct', 'pourcentage') then coalesce(p_base, 0) * (1 - coalesce(p_valeur, 0) / 100)
    when p_type = 'supp' then coalesce(p_base, 0) + coalesce(p_valeur, 0)
    when p_type in ('fixe', 'fixed') then coalesce(p_valeur, p_base, 0)
    else coalesce(p_valeur, p_base, 0)
  end;
$$;

create or replace function public.client_import_load_bootstrap(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_profile jsonb;
  v_company jsonb;
  v_import_profile jsonb;
  v_tariffs jsonb;
  v_special_options jsonb;
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  select to_jsonb(u)
    into v_profile
  from public.utilisateurs u
  where u.id = p_user_id;

  select to_jsonb(e)
    into v_company
  from public.entreprises e
  where e.id = v_client_id;

  select to_jsonb(p)
    into v_import_profile
  from public.client_import_profiles p
  where p.client_id = v_client_id
    and p.is_active = true
  order by p.updated_at desc
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.priority asc, r.created_at asc), '[]'::jsonb)
    into v_tariffs
  from public.client_tariff_rules r
  where r.client_id = v_client_id
    and r.is_active = true;

  if jsonb_array_length(coalesce(v_tariffs, '[]'::jsonb)) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'client_id', v_client_id,
      'name', coalesce(p.nom, p.ref, 'Tarif'),
      'tariff_code', coalesce(p.ref, p.nom, ''),
      'service_level', null,
      'min_weight_kg', coalesce(p.poids_min, 0),
      'max_weight_kg', null,
      'min_parcel_count', null,
      'max_parcel_count', null,
      'base_price_chf', case when coalesce(p.prix_par_kg, false) then 0 else round(coalesce(p.prix, 0)::numeric, 2) end,
      'price_per_parcel_chf', 0,
      'price_per_kg_chf', round(coalesce(p.increment_par_kg, 0)::numeric, 2),
      'priority', coalesce(p.ordre, 100),
      'pricing_details', jsonb_build_object(
        'contrainte', ps.contrainte,
        'type_prix_special', ps.type_remise,
        'valeur_prix_special', ps.valeur
      )
    ) order by p.ordre asc, p.nom asc), '[]'::jsonb)
      into v_tariffs
    from public.produits_tarif p
    left join public.prix_speciaux ps
      on ps.produit_id = p.id
     and ps.client_id = v_client_id
     and coalesce(ps.actif, true) = true
    where coalesce(p.actif, true) = true;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', upper(regexp_replace(translate(coalesce(ps.contrainte, p.nom, p.ref, 'OPTION'), 'àâäéèêëïîôöùûüç', 'aaaeeeeiioouuuc'), '[^A-Za-z0-9]+', '_', 'g')),
    'label', coalesce(ps.contrainte, p.nom, p.ref, 'Option'),
    'product_name', coalesce(p.nom, ''),
    'product_code', coalesce(p.ref, ''),
    'amount_chf', round(coalesce(ps.valeur, 0)::numeric, 2),
    'type_remise', coalesce(ps.type_remise, 'supp')
  ) order by ps.contrainte asc, p.nom asc), '[]'::jsonb)
    into v_special_options
  from public.prix_speciaux ps
  left join public.produits_tarif p on p.id = ps.produit_id
  where ps.client_id = v_client_id
    and coalesce(ps.actif, true) = true
    and nullif(trim(coalesce(ps.contrainte, '')), '') is not null
    and coalesce(ps.valeur, 0) > 0;

  return jsonb_build_object(
    'client_id', v_client_id,
    'order_client_id', v_client_id,
    'profile', coalesce(v_profile, '{}'::jsonb),
    'company', v_company,
    'import_profile', v_import_profile,
    'tariff_rules', coalesce(v_tariffs, '[]'::jsonb),
    'special_options', coalesce(v_special_options, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.client_import_load_bootstrap(uuid, text) to anon, authenticated;
