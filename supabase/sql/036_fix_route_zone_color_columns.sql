-- Fix for databases where public.routes exists without zone_code.
-- Run this after the failed 035_force_zone_color_palette.sql attempt.

alter table public.logistics_zones add column if not exists color_hex text;
alter table public.routes add column if not exists zone_code text;
alter table public.routes add column if not exists color_hex text;
alter table public.route_stops add column if not exists route_id uuid;
alter table public.route_stops add column if not exists load_group text;
alter table public.route_stops add column if not exists zone_code text;
alter table public.route_stops add column if not exists logistics_zone text;
alter table public.route_stops add column if not exists color_hex text;

update public.logistics_zones
set color_hex = case code
  when 'ROM_VD_GE' then '#2563eb'
  when 'ROM_NE_JU_FR' then '#0891b2'
  when 'ROM_VS' then '#f59e0b'
  when 'ALE_ZH_AG' then '#7c3aed'
  when 'ALE_BE_BS_BL_SO' then '#d97706'
  when 'ALE_OST' then '#0ea5e9'
  when 'TIC_MAIN' then '#db2777'
  when 'GRI_MAIN' then '#64748b'
  when 'NAT_INDUSTRIAL' then '#111827'
  else color_hex
end
where code in (
  'ROM_VD_GE',
  'ROM_NE_JU_FR',
  'ROM_VS',
  'ALE_ZH_AG',
  'ALE_BE_BS_BL_SO',
  'ALE_OST',
  'TIC_MAIN',
  'GRI_MAIN',
  'NAT_INDUSTRIAL'
);

update public.routes r
set color_hex = z.color_hex
from public.logistics_zones z
where r.zone_code = z.code
  and (
    r.color_hex is null
    or r.color_hex = ''
    or r.color_hex = '#ff8a00'
  );

update public.route_stops rs
set
  zone_code = coalesce(nullif(rs.zone_code, ''), nullif(rs.load_group, ''), nullif(r.zone_code, '')),
  logistics_zone = coalesce(nullif(rs.logistics_zone, ''), nullif(rs.zone_code, ''), nullif(rs.load_group, ''), nullif(r.zone_code, ''), 'Nationale'),
  color_hex = coalesce(z.color_hex, r.color_hex, rs.color_hex, '#ff8a00')
from public.routes r
left join public.logistics_zones z
  on z.code = coalesce(nullif(rs.zone_code, ''), nullif(rs.load_group, ''), nullif(r.zone_code, ''))
where rs.route_id = r.id
  and (
    rs.color_hex is null
    or rs.color_hex = ''
    or rs.color_hex = '#ff8a00'
  );

notify pgrst, 'reload schema';
