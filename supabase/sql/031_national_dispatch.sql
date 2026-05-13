-- Colixo national dispatch engine
-- Regions, zones, linehauls, partners, vehicles, routes and route stops.

create table if not exists public.logistics_regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  language_code text default 'fr',
  country_code text default 'CH',
  base_city text,
  base_postcode text,
  base_lat numeric(10,7),
  base_lng numeric(10,7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logistics_zones (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.logistics_regions(id) on delete cascade,
  region_code text not null,
  code text not null unique,
  name text not null,
  zone_type text not null default 'regional',
  service_48h boolean not null default true,
  service_24h boolean not null default false,
  service_express boolean not null default false,
  direct_colixo boolean not null default false,
  default_partner_required boolean not null default false,
  cutoff_time time without time zone default '16:00',
  center_lat numeric(10,7),
  center_lng numeric(10,7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.postal_zones (
  id uuid primary key default gen_random_uuid(),
  postcode_from integer not null,
  postcode_to integer not null,
  postcode text,
  city text,
  region_code text not null,
  zone_code text not null references public.logistics_zones(code) on update cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint postal_zones_range_check check (postcode_from between 1000 and 9999 and postcode_to between postcode_from and 9999)
);

create index if not exists idx_postal_zones_range
  on public.postal_zones(postcode_from, postcode_to)
  where active = true;

create table if not exists public.linehauls (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  origin_region_code text not null,
  destination_region_code text not null,
  departure_time time without time zone,
  arrival_time time without time zone,
  service_levels text[] not null default array['48h'],
  cutoff_time time without time zone default '15:00',
  days_of_week integer[] not null default array[1,2,3,4,5],
  capacity_parcels integer,
  capacity_weight_kg numeric(10,2),
  partner_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_linehauls_lookup
  on public.linehauls(origin_region_code, destination_region_code)
  where active = true;

create table if not exists public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact_name text,
  email text,
  phone text,
  region_code text,
  zone_codes text[] not null default '{}',
  service_levels text[] not null default array['48h'],
  cutoff_time time without time zone default '15:00',
  capacity_parcels integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_partners_zone_codes
  on public.delivery_partners using gin(zone_codes);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  immatriculation text,
  label text,
  vehicle_type text not null default 'van',
  home_region_code text,
  capacity_parcels integer,
  capacity_weight_kg numeric(10,2),
  active boolean not null default true,
  current_lat numeric(10,7),
  current_lng numeric(10,7),
  current_position_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.vehicles add column if not exists id uuid default gen_random_uuid();
alter table public.vehicles add column if not exists code text;
alter table public.vehicles add column if not exists immatriculation text;
alter table public.vehicles add column if not exists label text;
alter table public.vehicles add column if not exists vehicle_type text not null default 'van';
alter table public.vehicles add column if not exists home_region_code text;
alter table public.vehicles add column if not exists capacity_parcels integer;
alter table public.vehicles add column if not exists capacity_weight_kg numeric(10,2);
alter table public.vehicles add column if not exists active boolean not null default true;
alter table public.vehicles add column if not exists current_lat numeric(10,7);
alter table public.vehicles add column if not exists current_lng numeric(10,7);
alter table public.vehicles add column if not exists current_position_at timestamptz;
alter table public.vehicles add column if not exists created_at timestamptz not null default now();

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  route_type text not null default 'local',
  route_date date not null default current_date,
  origin_region_code text,
  destination_region_code text,
  zone_code text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  partner_id uuid references public.delivery_partners(id) on delete set null,
  linehaul_id uuid references public.linehauls(id) on delete set null,
  driver_id uuid references public.utilisateurs(id) on delete set null,
  dispatch_status text not null default 'draft',
  optimization_mode text not null default 'regional',
  order_locked boolean not null default false,
  reoptimization_blocked boolean not null default false,
  reoptimization_pending jsonb not null default '{}'::jsonb,
  estimated_gain_min integer,
  base_lat numeric(10,7),
  base_lng numeric(10,7),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routes_dispatch
  on public.routes(route_date, dispatch_status, origin_region_code, destination_region_code);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  order_id uuid,
  order_table text not null default 'transport_orders_simple',
  stop_number integer,
  loading_order integer,
  load_group text,
  service_level text,
  status text not null default 'planned',
  address text,
  postcode text,
  city text,
  recipient_name text,
  parcel_count integer not null default 1,
  qr_token text,
  eta_at timestamptz,
  delivered_at timestamptz,
  lat numeric(10,7),
  lng numeric(10,7),
  created_at timestamptz not null default now()
);

alter table public.route_stops add column if not exists route_id uuid references public.routes(id) on delete cascade;
alter table public.route_stops add column if not exists order_id uuid;
alter table public.route_stops add column if not exists order_table text not null default 'transport_orders_simple';
alter table public.route_stops add column if not exists stop_number integer;
alter table public.route_stops add column if not exists loading_order integer;
alter table public.route_stops add column if not exists load_group text;
alter table public.route_stops add column if not exists service_level text;
alter table public.route_stops add column if not exists status text not null default 'planned';
alter table public.route_stops add column if not exists address text;
alter table public.route_stops add column if not exists postcode text;
alter table public.route_stops add column if not exists city text;
alter table public.route_stops add column if not exists recipient_name text;
alter table public.route_stops add column if not exists parcel_count integer not null default 1;
alter table public.route_stops add column if not exists qr_token text;
alter table public.route_stops add column if not exists eta_at timestamptz;
alter table public.route_stops add column if not exists delivered_at timestamptz;
alter table public.route_stops add column if not exists lat numeric(10,7);
alter table public.route_stops add column if not exists lng numeric(10,7);
alter table public.route_stops add column if not exists created_at timestamptz not null default now();

create index if not exists idx_route_stops_route_order
  on public.route_stops(route_id, stop_number, loading_order);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'linehauls_partner_fk'
      and conrelid = 'public.linehauls'::regclass
  ) then
    alter table public.linehauls
      add constraint linehauls_partner_fk
      foreign key (partner_id) references public.delivery_partners(id) on delete set null
      not valid;
  end if;
end $$;

alter table public.transport_orders_simple
  add column if not exists pickup_postcode text,
  add column if not exists pickup_city text,
  add column if not exists delivery_postcode text,
  add column if not exists delivery_city text,
  add column if not exists service_level text,
  add column if not exists origin_region_code text,
  add column if not exists destination_region_code text,
  add column if not exists origin_zone_code text,
  add column if not exists destination_zone_code text,
  add column if not exists priority_score integer default 0,
  add column if not exists pickup_date date,
  add column if not exists latest_delivery_date timestamptz,
  add column if not exists assigned_route_id uuid references public.routes(id) on delete set null,
  add column if not exists assigned_linehaul_id uuid references public.linehauls(id) on delete set null,
  add column if not exists assigned_partner_id uuid references public.delivery_partners(id) on delete set null,
  add column if not exists dispatch_status text default 'pending',
  add column if not exists dispatch_decision jsonb default '{}'::jsonb;

alter table public.orders
  add column if not exists origin_region_code text,
  add column if not exists destination_region_code text,
  add column if not exists origin_zone_code text,
  add column if not exists destination_zone_code text,
  add column if not exists priority_score integer default 0,
  add column if not exists pickup_date date,
  add column if not exists latest_delivery_date timestamptz,
  add column if not exists assigned_route_id uuid references public.routes(id) on delete set null,
  add column if not exists assigned_linehaul_id uuid references public.linehauls(id) on delete set null,
  add column if not exists assigned_partner_id uuid references public.delivery_partners(id) on delete set null,
  add column if not exists dispatch_status text default 'pending',
  add column if not exists dispatch_decision jsonb default '{}'::jsonb;

create index if not exists idx_transport_orders_national_dispatch
  on public.transport_orders_simple(dispatch_status, destination_region_code, destination_zone_code, service_level);

insert into public.logistics_regions(code, name, language_code, base_city, base_postcode, base_lat, base_lng)
values
  ('ROM', 'Suisse romande', 'fr', 'Yvonand', '1462', 46.8006, 6.7416),
  ('ALE', 'Suisse alémanique', 'de', 'Zürich', '8000', 47.3769, 8.5417),
  ('TIC', 'Tessin', 'it', 'Bellinzona', '6500', 46.1956, 9.0238),
  ('GRI', 'Grisons', 'de', 'Chur', '7000', 46.8508, 9.5320),
  ('NAT', 'Zones industrielles nationales', 'fr', 'Olten', '4600', 47.3497, 7.9033)
on conflict (code) do update set
  name = excluded.name,
  language_code = excluded.language_code,
  base_city = excluded.base_city,
  base_postcode = excluded.base_postcode,
  base_lat = excluded.base_lat,
  base_lng = excluded.base_lng;

insert into public.logistics_zones(region_code, code, name, zone_type, service_48h, service_24h, direct_colixo, default_partner_required)
values
  ('ROM','ROM_VD_GE','Vaud / Genève','regional',true,true,true,false),
  ('ROM','ROM_NE_JU_FR','Neuchâtel / Jura / Fribourg','regional',true,true,true,false),
  ('ROM','ROM_VS','Valais','mountain',true,false,false,true),
  ('ALE','ALE_ZH_AG','Zurich / Argovie','national',true,true,false,true),
  ('ALE','ALE_BE_BS_BL_SO','Berne / Bâle / Soleure','national',true,true,false,true),
  ('ALE','ALE_OST','Suisse orientale','national',true,false,false,true),
  ('TIC','TIC_MAIN','Tessin','national',true,false,false,true),
  ('GRI','GRI_MAIN','Grisons','mountain',true,false,false,true),
  ('NAT','NAT_INDUSTRIAL','Zones industrielles nationales','industrial',true,true,false,true)
on conflict (code) do update set
  name = excluded.name,
  zone_type = excluded.zone_type,
  service_48h = excluded.service_48h,
  service_24h = excluded.service_24h,
  direct_colixo = excluded.direct_colixo,
  default_partner_required = excluded.default_partner_required;

insert into public.postal_zones(postcode_from, postcode_to, region_code, zone_code)
values
  (1000, 1299, 'ROM', 'ROM_VD_GE'),
  (1300, 1499, 'ROM', 'ROM_VD_GE'),
  (1500, 1999, 'ROM', 'ROM_NE_JU_FR'),
  (2000, 2999, 'ROM', 'ROM_NE_JU_FR'),
  (3000, 3999, 'ALE', 'ALE_BE_BS_BL_SO'),
  (4000, 4999, 'ALE', 'ALE_BE_BS_BL_SO'),
  (5000, 5999, 'ALE', 'ALE_ZH_AG'),
  (6000, 6499, 'ALE', 'ALE_OST'),
  (6500, 6999, 'TIC', 'TIC_MAIN'),
  (7000, 7499, 'GRI', 'GRI_MAIN'),
  (7500, 7999, 'GRI', 'GRI_MAIN'),
  (8000, 8999, 'ALE', 'ALE_ZH_AG'),
  (9000, 9999, 'ALE', 'ALE_OST')
on conflict do nothing;

alter table public.logistics_regions enable row level security;
alter table public.logistics_zones enable row level security;
alter table public.postal_zones enable row level security;
alter table public.linehauls enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.vehicles enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['logistics_regions','logistics_zones','postal_zones','linehauls','delivery_partners','vehicles','routes','route_stops'] loop
    execute format('drop policy if exists %I on public.%I', 'auth_all_' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'auth_all_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'service_all_' || t, t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', 'service_all_' || t, t);
  end loop;
end $$;
