create or replace function public.admin_set_client_tariff_rule(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid,
  p_product_id uuid,
  p_enabled boolean
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
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  select * into v_product from public.produits_tarif where id = p_product_id;
  if v_product.id is null then
    raise exception 'Produit tarifaire introuvable';
  end if;

  v_code := coalesce(nullif(trim(coalesce(v_product.ref, '')), ''), nullif(trim(coalesce(v_product.nom, '')), ''));
  if v_code is null then
    raise exception 'Code tarif produit obligatoire';
  end if;

  select * into v_rule
  from public.client_tariff_rules r
  where r.client_id = p_client_id
    and (
      r.produit_id = p_product_id
      or upper(trim(coalesce(r.tariff_code, ''))) = upper(trim(v_code))
      or upper(trim(coalesce(r.name, ''))) = upper(trim(v_code))
    )
  order by case when r.produit_id = p_product_id then 0 else 1 end, r.created_at desc
  limit 1;

  if coalesce(p_enabled, false) = false then
    update public.client_tariff_rules
    set is_active = false,
        updated_at = now()
    where client_id = p_client_id
      and (
        produit_id = p_product_id
        or upper(trim(coalesce(tariff_code, ''))) = upper(trim(v_code))
        or upper(trim(coalesce(name, ''))) = upper(trim(v_code))
      );
    return true;
  end if;

  if v_rule.id is not null then
    update public.client_tariff_rules
    set produit_id = p_product_id,
        name = coalesce(v_product.nom, v_product.ref, 'Tarif standard'),
        tariff_code = v_code,
        service_level = null,
        min_weight_kg = coalesce(v_product.poids_min, 0),
        max_weight_kg = null,
        min_parcel_count = 1,
        max_parcel_count = null,
        base_price_chf = coalesce(v_product.prix, 0),
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
      coalesce(v_product.prix, 0), 0, coalesce(v_product.increment_par_kg, 0),
      0, 0, 0, 0, 0, true, coalesce(v_product.ordre, 100)
    );
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_client_tariff_rule(uuid, text, uuid, uuid, boolean) from public;
grant execute on function public.admin_set_client_tariff_rule(uuid, text, uuid, uuid, boolean) to anon, authenticated;

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

  v_code := coalesce(nullif(trim(coalesce(v_product.ref, '')), ''), nullif(trim(coalesce(v_product.nom, '')), ''));
  if v_code is null then
    raise exception 'Code tarif produit obligatoire';
  end if;

  v_price := coalesce(p_base_price_chf, v_product.prix, 0);

  select * into v_rule
  from public.client_tariff_rules r
  where r.client_id = p_client_id
    and (
      r.produit_id = p_product_id
      or upper(trim(coalesce(r.tariff_code, ''))) = upper(trim(v_code))
      or upper(trim(coalesce(r.name, ''))) = upper(trim(v_code))
    )
  order by case when r.produit_id = p_product_id then 0 else 1 end, r.created_at desc
  limit 1;

  if coalesce(p_enabled, false) = false then
    update public.client_tariff_rules
    set is_active = false,
        updated_at = now()
    where client_id = p_client_id
      and (
        produit_id = p_product_id
        or upper(trim(coalesce(tariff_code, ''))) = upper(trim(v_code))
        or upper(trim(coalesce(name, ''))) = upper(trim(v_code))
      );
    return true;
  end if;

  if v_rule.id is not null then
    update public.client_tariff_rules
    set produit_id = p_product_id,
        name = coalesce(v_product.nom, v_product.ref, 'Tarif standard'),
        tariff_code = v_code,
        service_level = null,
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

create or replace function public.admin_set_client_price_option(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid,
  p_product_id uuid,
  p_enabled boolean,
  p_type_remise text default 'supp',
  p_valeur numeric default 0,
  p_contrainte text default 'Option client'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  select id into v_existing
  from public.prix_speciaux
  where client_id = p_client_id
    and produit_id = p_product_id
  order by created_at asc
  limit 1;

  if coalesce(p_enabled, false) = false then
    update public.prix_speciaux
    set actif = false
    where client_id = p_client_id
      and produit_id = p_product_id;
    return true;
  end if;

  if v_existing is not null then
    update public.prix_speciaux
    set type_remise = coalesce(nullif(trim(p_type_remise), ''), 'supp'),
        valeur = coalesce(p_valeur, 0),
        contrainte = nullif(trim(coalesce(p_contrainte, 'Option client')), ''),
        actif = true
    where client_id = p_client_id
      and produit_id = p_product_id;
  else
    insert into public.prix_speciaux (
      client_id, produit_id, type_remise, valeur, contrainte, actif
    ) values (
      p_client_id,
      p_product_id,
      coalesce(nullif(trim(p_type_remise), ''), 'supp'),
      coalesce(p_valeur, 0),
      nullif(trim(coalesce(p_contrainte, 'Option client')), ''),
      true
    );
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_client_price_option(uuid, text, uuid, uuid, boolean, text, numeric, text) from public;
grant execute on function public.admin_set_client_price_option(uuid, text, uuid, uuid, boolean, text, numeric, text) to anon, authenticated;
