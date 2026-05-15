-- Colixo - Fallback zone pour ramasses sans NPA exploitable
-- Permet de créer une tournée de ramasse même sans colis livraison dans la même région.

alter table public.pickups add column if not exists origin_region_code text;
alter table public.pickups add column if not exists origin_zone_code text;

update public.pickups
set
  origin_region_code = coalesce(nullif(origin_region_code, ''), 'ROM'),
  origin_zone_code = coalesce(nullif(origin_zone_code, ''), 'PICKUP_MANUAL')
where nullif(origin_zone_code, '') is null;

notify pgrst, 'reload schema';
