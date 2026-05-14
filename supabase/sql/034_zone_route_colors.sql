-- Colixo zone and route color coding.
-- Run after 031_national_dispatch.sql on an existing database.

alter table public.logistics_zones add column if not exists color_hex text;
alter table public.routes add column if not exists color_hex text;
alter table public.route_stops add column if not exists zone_code text;
alter table public.route_stops add column if not exists logistics_zone text;
alter table public.route_stops add column if not exists color_hex text;

comment on column public.logistics_zones.color_hex is 'Stable dispatch color for this logistics zone.';
comment on column public.routes.color_hex is 'Optional route color. Defaults to the logistics zone color.';
comment on column public.route_stops.color_hex is 'Color copied onto the stop for labels, loading lists and driver app.';

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
  else '#ff8a00'
end
where color_hex is null
  or color_hex = ''
  or color_hex !~* '^#[0-9a-f]{6}$';

update public.routes r
set color_hex = coalesce(z.color_hex, '#ff8a00')
from public.logistics_zones z
where r.zone_code = z.code
  and (
    r.color_hex is null
    or r.color_hex = ''
    or r.color_hex !~* '^#[0-9a-f]{6}$'
  );

update public.routes
set color_hex = '#ff8a00'
where color_hex is null
  or color_hex = ''
  or color_hex !~* '^#[0-9a-f]{6}$';

update public.route_stops rs
set
  zone_code = coalesce(nullif(rs.zone_code, ''), nullif(rs.load_group, ''), nullif(r.zone_code, '')),
  logistics_zone = coalesce(nullif(rs.logistics_zone, ''), nullif(rs.zone_code, ''), nullif(rs.load_group, ''), nullif(r.zone_code, ''), 'Nationale'),
  color_hex = coalesce(nullif(rs.color_hex, ''), nullif(r.color_hex, ''), '#ff8a00')
from public.routes r
where rs.route_id = r.id;

update public.route_stops rs
set color_hex = z.color_hex
from public.logistics_zones z
where rs.zone_code = z.code
  and (
    rs.color_hex is null
    or rs.color_hex = ''
    or rs.color_hex !~* '^#[0-9a-f]{6}$'
  );

update public.route_stops
set color_hex = '#ff8a00'
where color_hex is null
  or color_hex = ''
  or color_hex !~* '^#[0-9a-f]{6}$';

notify pgrst, 'reload schema';
