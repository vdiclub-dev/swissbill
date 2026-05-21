alter table public.client_tariff_rules
  add column if not exists price_per_km_chf numeric not null default 0;

create or replace function public.admin_set_client_tariff_km_rate(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid,
  p_product_id uuid,
  p_base_price_chf numeric default 0,
  p_price_per_km_chf numeric default 0
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
  v_base numeric := greatest(coalesce(p_base_price_chf, 0), 0);
  v_km numeric := greatest(coalesce(p_price_per_km_chf, 0), 0);
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_client_id is null then
    raise exception 'Client obligatoire';
  end if;

  select * into v_product
  from public.produits_tarif
  where id = p_product_id;

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

  if v_rule.id is not null then
    update public.client_tariff_rules
    set produit_id = p_product_id,
        name = coalesce(v_product.nom, v_product.ref, 'Tarif standard'),
        tariff_code = v_code,
        min_weight_kg = coalesce(v_product.poids_min, 0),
        base_price_chf = v_base,
        price_per_kg_chf = coalesce(v_product.increment_par_kg, v_rule.price_per_kg_chf, 0),
        price_per_km_chf = v_km,
        is_active = true,
        priority = coalesce(v_product.ordre, v_rule.priority, 100),
        updated_at = now()
    where id = v_rule.id;
  else
    insert into public.client_tariff_rules (
      client_id,
      produit_id,
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
    ) values (
      p_client_id,
      p_product_id,
      coalesce(v_product.nom, v_product.ref, 'Tarif standard'),
      v_code,
      null,
      coalesce(v_product.poids_min, 0),
      null,
      1,
      null,
      v_base,
      0,
      coalesce(v_product.increment_par_kg, 0),
      v_km,
      0,
      0,
      0,
      0,
      true,
      coalesce(v_product.ordre, 100)
    );
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_client_tariff_km_rate(uuid, text, uuid, uuid, numeric, numeric) from public;
grant execute on function public.admin_set_client_tariff_km_rate(uuid, text, uuid, uuid, numeric, numeric) to anon, authenticated;
