-- Align active client rules with the current product references after tier
-- codes such as ECO_0/ECO_1/ECO_2 are renamed in the catalog.

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
