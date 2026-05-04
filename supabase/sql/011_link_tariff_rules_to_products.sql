alter table public.client_tariff_rules
  add column if not exists produit_id uuid references public.produits_tarif(id) on delete set null;

create index if not exists idx_client_tariff_rules_client_produit
  on public.client_tariff_rules(client_id, produit_id)
  where produit_id is not null;

update public.client_tariff_rules r
set produit_id = p.id,
    updated_at = now()
from public.produits_tarif p
where r.produit_id is null
  and upper(trim(coalesce(r.tariff_code, ''))) = upper(trim(coalesce(p.ref, p.nom, '')));

update public.client_tariff_rules
set is_active = false,
    updated_at = now()
where is_active = true
  and (
    upper(trim(coalesce(tariff_code, ''))) like 'OPT%'
    or name ~* '(montage|assurance|cave|étage|etage|fragile|appel|retrait|nuit)'
  );

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
        and (
          p.id = r.produit_id
          or upper(trim(coalesce(p.ref, p.nom, ''))) = upper(trim(coalesce(r.tariff_code, '')))
        )
    );

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
  )
  select
    p_client_id,
    p.id,
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
  where p.actif = true
    and upper(trim(coalesce(p.ref, ''))) not like 'OPT%'
    and coalesce(p.nom, '') !~* '(montage|assurance|cave|étage|etage|fragile|appel|retrait|nuit)';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_apply_standard_tariffs_to_client(uuid, text, uuid) from public;
grant execute on function public.admin_apply_standard_tariffs_to_client(uuid, text, uuid) to anon, authenticated;

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

  v_code := nullif(coalesce(v_product.ref, v_product.nom), '');
  if v_code is null then
    raise exception 'Code tarif produit obligatoire';
  end if;

  select * into v_rule
  from public.client_tariff_rules r
  where r.client_id = p_client_id
    and (
      r.produit_id = p_product_id
      or upper(trim(coalesce(r.tariff_code, ''))) = upper(trim(v_code))
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
