-- Keep client portal tariff rules aligned with product tiers.
-- A service can have several products with the same tariff code and different
-- weight tiers, so client rules must be keyed by produit_id, not only by code.

update public.client_tariff_rules r
set name = p.nom,
    tariff_code = coalesce(p.ref, p.nom),
    min_weight_kg = coalesce(p.poids_min, 0),
    base_price_chf = coalesce(p.prix, 0),
    price_per_kg_chf = coalesce(p.increment_par_kg, 0),
    priority = coalesce(p.ordre, r.priority),
    updated_at = now()
from public.produits_tarif p
where r.produit_id = p.id
  and r.is_active = true
  and coalesce(p.actif, true) = true;

update public.client_tariff_rules r
set name = p.nom,
    tariff_code = coalesce(p.ref, p.nom),
    min_weight_kg = coalesce(p.poids_min, 0),
    base_price_chf = coalesce(p.prix, 0),
    price_per_kg_chf = coalesce(p.increment_par_kg, 0),
    priority = coalesce(p.ordre, r.priority),
    is_active = true,
    updated_at = now()
from public.produits_tarif p
where r.produit_id = p.id
  and coalesce(p.actif, true) = true
  and exists (
    select 1
    from public.client_tariff_rules active_rule
    where active_rule.client_id = r.client_id
      and active_rule.is_active = true
      and upper(trim(coalesce(active_rule.tariff_code, active_rule.name, ''))) = upper(trim(coalesce(p.ref, p.nom, '')))
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
select distinct
  r.client_id,
  p.id,
  p.nom,
  coalesce(p.ref, p.nom),
  null::text,
  coalesce(p.poids_min, 0),
  null::numeric,
  1,
  null::integer,
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
from public.client_tariff_rules r
join public.produits_tarif p
  on coalesce(p.actif, true) = true
 and upper(trim(coalesce(p.ref, p.nom, ''))) = upper(trim(coalesce(r.tariff_code, r.name, '')))
where r.is_active = true
  and not exists (
    select 1
    from public.client_tariff_rules existing
    where existing.client_id = r.client_id
      and existing.produit_id = p.id
  );
