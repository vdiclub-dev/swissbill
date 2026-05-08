create or replace function public.admin_upsert_tarif_client(
  p_admin_id uuid,
  p_code text,
  p_tarif_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if nullif(p_payload->>'entreprise_id', '') is null then
    raise exception 'Entreprise client obligatoire';
  end if;

  if p_tarif_id is null then
    insert into public.tarifs_clients (
      entreprise_id, nom_client, tarif_type,
      prix_inf_2kg, prix_inf_10kg, prix_inf_30kg, prix_eco,
      poids_max_kg, montant_forfait,
      suppl_express, suppl_urgent, suppl_nuit_chf, suppl_super_urgent,
      suppl_descente_cave, suppl_recherche_colis_hotel,
      actif, option_prise_en_charge, montant_prise_en_charge,
      rabais_volume_pct, notes, abonnements
    ) values (
      (p_payload->>'entreprise_id')::uuid,
      nullif(p_payload->>'nom_client', ''),
      coalesce(nullif(p_payload->>'tarif_type', ''), 'standard'),
      nullif(p_payload->>'prix_inf_2kg', '')::numeric,
      nullif(p_payload->>'prix_inf_10kg', '')::numeric,
      nullif(p_payload->>'prix_inf_30kg', '')::numeric,
      nullif(p_payload->>'prix_eco', '')::numeric,
      nullif(p_payload->>'poids_max_kg', '')::numeric,
      nullif(p_payload->>'montant_forfait', '')::numeric,
      nullif(p_payload->>'suppl_express', '')::numeric,
      nullif(p_payload->>'suppl_urgent', '')::numeric,
      nullif(p_payload->>'suppl_nuit_chf', '')::numeric,
      nullif(p_payload->>'suppl_super_urgent', '')::numeric,
      nullif(p_payload->>'suppl_descente_cave', '')::numeric,
      nullif(p_payload->>'suppl_recherche_colis_hotel', '')::numeric,
      coalesce((p_payload->>'actif')::boolean, true),
      coalesce((p_payload->>'option_prise_en_charge')::boolean, false),
      nullif(p_payload->>'montant_prise_en_charge', '')::numeric,
      nullif(p_payload->>'rabais_volume_pct', '')::numeric,
      nullif(p_payload->>'notes', ''),
      coalesce(p_payload->'abonnements', '[]'::jsonb)
    )
    returning id into v_id;
  else
    update public.tarifs_clients
    set entreprise_id = (p_payload->>'entreprise_id')::uuid,
        nom_client = nullif(p_payload->>'nom_client', ''),
        tarif_type = coalesce(nullif(p_payload->>'tarif_type', ''), 'standard'),
        prix_inf_2kg = nullif(p_payload->>'prix_inf_2kg', '')::numeric,
        prix_inf_10kg = nullif(p_payload->>'prix_inf_10kg', '')::numeric,
        prix_inf_30kg = nullif(p_payload->>'prix_inf_30kg', '')::numeric,
        prix_eco = nullif(p_payload->>'prix_eco', '')::numeric,
        poids_max_kg = nullif(p_payload->>'poids_max_kg', '')::numeric,
        montant_forfait = nullif(p_payload->>'montant_forfait', '')::numeric,
        suppl_express = nullif(p_payload->>'suppl_express', '')::numeric,
        suppl_urgent = nullif(p_payload->>'suppl_urgent', '')::numeric,
        suppl_nuit_chf = nullif(p_payload->>'suppl_nuit_chf', '')::numeric,
        suppl_super_urgent = nullif(p_payload->>'suppl_super_urgent', '')::numeric,
        suppl_descente_cave = nullif(p_payload->>'suppl_descente_cave', '')::numeric,
        suppl_recherche_colis_hotel = nullif(p_payload->>'suppl_recherche_colis_hotel', '')::numeric,
        actif = coalesce((p_payload->>'actif')::boolean, true),
        option_prise_en_charge = coalesce((p_payload->>'option_prise_en_charge')::boolean, false),
        montant_prise_en_charge = nullif(p_payload->>'montant_prise_en_charge', '')::numeric,
        rabais_volume_pct = nullif(p_payload->>'rabais_volume_pct', '')::numeric,
        notes = nullif(p_payload->>'notes', ''),
        abonnements = coalesce(p_payload->'abonnements', abonnements, '[]'::jsonb),
        updated_at = now()
    where id = p_tarif_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Tarif client introuvable';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_tarif_client(uuid, text, uuid, jsonb) from public;
grant execute on function public.admin_upsert_tarif_client(uuid, text, uuid, jsonb) to anon, authenticated;

create or replace function public.admin_set_client_tariff_rule_price(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid,
  p_product_id uuid,
  p_enabled boolean,
  p_base_price_chf numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.produits_tarif;
  v_rule public.client_tariff_rules;
  v_code text;
  v_price numeric;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  select * into v_product from public.produits_tarif where id = p_product_id;
  if v_product.id is null then
    raise exception 'Produit tarifaire introuvable';
  end if;

  v_code := nullif(coalesce(v_product.ref, v_product.nom), '');
  if v_code is null then
    raise exception 'Code tarif produit obligatoire';
  end if;

  v_price := coalesce(p_base_price_chf, v_product.prix, 0);

  select * into v_rule
  from public.client_tariff_rules r
  where r.client_id = p_client_id
    and (r.produit_id = p_product_id or upper(trim(coalesce(r.tariff_code, ''))) = upper(trim(v_code)))
  order by case when r.produit_id = p_product_id then 0 else 1 end, r.created_at desc
  limit 1;

  if coalesce(p_enabled, false) = false then
    update public.client_tariff_rules
    set is_active = false,
        updated_at = now()
    where client_id = p_client_id
      and (produit_id = p_product_id or upper(trim(coalesce(tariff_code, ''))) = upper(trim(v_code)));
    return true;
  end if;

  if v_rule.id is not null then
    update public.client_tariff_rules
    set produit_id = p_product_id,
        name = coalesce(v_product.nom, v_product.ref, 'Tarif standard'),
        tariff_code = v_code,
        min_weight_kg = coalesce(v_product.poids_min, 0),
        max_weight_kg = null,
        min_parcel_count = 1,
        max_parcel_count = null,
        base_price_chf = v_price,
        price_per_parcel_chf = 0,
        price_per_kg_chf = coalesce(v_product.increment_par_kg, 0),
        is_active = true,
        priority = coalesce(v_product.ordre, 100),
        updated_at = now()
    where id = v_rule.id;
  else
    insert into public.client_tariff_rules (
      client_id, produit_id, name, tariff_code, service_level,
      min_weight_kg, max_weight_kg, min_parcel_count, max_parcel_count,
      base_price_chf, price_per_parcel_chf, price_per_kg_chf,
      price_per_km_chf, included_km, extra_km_price_chf,
      fuel_surcharge_percent, discount_percent, is_active, priority
    ) values (
      p_client_id, p_product_id, coalesce(v_product.nom, v_product.ref, 'Tarif standard'), v_code, null,
      coalesce(v_product.poids_min, 0), null, 1, null,
      v_price, 0, coalesce(v_product.increment_par_kg, 0),
      0, 0, 0, 0, 0, true, coalesce(v_product.ordre, 100)
    );
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_client_tariff_rule_price(uuid, text, uuid, uuid, boolean, numeric) from public;
grant execute on function public.admin_set_client_tariff_rule_price(uuid, text, uuid, uuid, boolean, numeric) to anon, authenticated;
