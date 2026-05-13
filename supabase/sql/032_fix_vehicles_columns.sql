-- Fix Colixo national dispatch vehicles table when it already existed
-- before the national dispatch schema was added.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid()
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

alter table public.vehicles enable row level security;

drop policy if exists auth_all_vehicles on public.vehicles;
create policy auth_all_vehicles
  on public.vehicles
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists service_all_vehicles on public.vehicles;
create policy service_all_vehicles
  on public.vehicles
  for all
  to service_role
  using (true)
  with check (true);

notify pgrst, 'reload schema';
