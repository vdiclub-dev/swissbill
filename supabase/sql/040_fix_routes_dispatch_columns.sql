-- Colixo - Correctif complet table routes pour dispatch national
-- A executer si Supabase affiche une colonne manquante de routes :
-- destination_region_code, origin_region_code, route_date, route_type, zone_code, etc.

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid()
);

alter table public.routes add column if not exists code text;
alter table public.routes add column if not exists name text;
alter table public.routes add column if not exists route_type text default 'local';
alter table public.routes add column if not exists route_date date default current_date;
alter table public.routes add column if not exists origin_region_code text;
alter table public.routes add column if not exists destination_region_code text;
alter table public.routes add column if not exists zone_code text;
alter table public.routes add column if not exists color_hex text;
alter table public.routes add column if not exists vehicle_id uuid;
alter table public.routes add column if not exists partner_id uuid;
alter table public.routes add column if not exists linehaul_id uuid;
alter table public.routes add column if not exists driver_id uuid;
alter table public.routes add column if not exists dispatch_status text default 'draft';
alter table public.routes add column if not exists optimization_mode text default 'regional';
alter table public.routes add column if not exists order_locked boolean not null default false;
alter table public.routes add column if not exists reoptimization_blocked boolean not null default false;
alter table public.routes add column if not exists reoptimization_pending jsonb not null default '{}'::jsonb;
alter table public.routes add column if not exists estimated_gain_min integer;
alter table public.routes add column if not exists base_lat numeric(10,7);
alter table public.routes add column if not exists base_lng numeric(10,7);
alter table public.routes add column if not exists notes text;
alter table public.routes add column if not exists created_at timestamptz not null default now();
alter table public.routes add column if not exists updated_at timestamptz not null default now();

alter table public.route_stops add column if not exists route_id uuid;
alter table public.route_stops add column if not exists order_id uuid;
alter table public.route_stops add column if not exists order_table text default 'transport_orders_simple';
alter table public.route_stops add column if not exists stop_type text default 'delivery';
alter table public.route_stops add column if not exists pickup_id uuid;
alter table public.route_stops add column if not exists stop_number integer;
alter table public.route_stops add column if not exists loading_order integer;
alter table public.route_stops add column if not exists load_group text;
alter table public.route_stops add column if not exists zone_code text;
alter table public.route_stops add column if not exists logistics_zone text;
alter table public.route_stops add column if not exists color_hex text;
alter table public.route_stops add column if not exists service_level text;
alter table public.route_stops add column if not exists status text default 'planned';
alter table public.route_stops add column if not exists address text;
alter table public.route_stops add column if not exists postcode text;
alter table public.route_stops add column if not exists city text;
alter table public.route_stops add column if not exists recipient_name text;
alter table public.route_stops add column if not exists parcel_count integer default 1;
alter table public.route_stops add column if not exists qr_token text;
alter table public.route_stops add column if not exists eta_at timestamptz;
alter table public.route_stops add column if not exists delivered_at timestamptz;
alter table public.route_stops add column if not exists lat numeric(10,7);
alter table public.route_stops add column if not exists lng numeric(10,7);
alter table public.route_stops add column if not exists time_window_start time without time zone;
alter table public.route_stops add column if not exists time_window_end time without time zone;
alter table public.route_stops add column if not exists created_at timestamptz not null default now();

create index if not exists idx_routes_dispatch
  on public.routes(route_date, dispatch_status, origin_region_code, destination_region_code);

create index if not exists idx_route_stops_route_order
  on public.route_stops(route_id, stop_number, loading_order);

alter table public.routes enable row level security;
alter table public.route_stops enable row level security;

grant select, insert, update, delete on public.routes to anon, authenticated;
grant select, insert, update, delete on public.route_stops to anon, authenticated;

drop policy if exists auth_all_routes on public.routes;
create policy auth_all_routes on public.routes
for all to authenticated
using (true)
with check (true);

drop policy if exists anon_all_routes on public.routes;
create policy anon_all_routes on public.routes
for all to anon
using (true)
with check (true);

drop policy if exists service_all_routes on public.routes;
create policy service_all_routes on public.routes
for all to service_role
using (true)
with check (true);

drop policy if exists auth_all_route_stops on public.route_stops;
create policy auth_all_route_stops on public.route_stops
for all to authenticated
using (true)
with check (true);

drop policy if exists anon_all_route_stops on public.route_stops;
create policy anon_all_route_stops on public.route_stops
for all to anon
using (true)
with check (true);

drop policy if exists service_all_route_stops on public.route_stops;
create policy service_all_route_stops on public.route_stops
for all to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
