-- Optional Colixo analytics schema alignment.
-- Run this only if Supabase reports missing columns on orders, clients, drivers or vehicles.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists pickup_address text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists pickup_date timestamptz;
alter table public.orders add column if not exists delivery_date timestamptz;
alter table public.orders add column if not exists status text;
alter table public.orders add column if not exists service_type text;
alter table public.orders add column if not exists price numeric(12,2);
alter table public.orders add column if not exists distance_km numeric(10,2);
alter table public.orders add column if not exists estimated_cost numeric(12,2);
alter table public.orders add column if not exists driver_id uuid;
alter table public.orders add column if not exists client_id uuid;
alter table public.orders add column if not exists vehicle_id uuid;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists pickup_lat numeric(10,7);
alter table public.orders add column if not exists pickup_lng numeric(10,7);
alter table public.orders add column if not exists delivery_lat numeric(10,7);
alter table public.orders add column if not exists delivery_lng numeric(10,7);

alter table public.clients add column if not exists company_name text;
alter table public.clients add column if not exists monthly_volume integer;

alter table public.drivers add column if not exists name text;
alter table public.drivers add column if not exists status text;

alter table public.vehicles add column if not exists model text;
alter table public.vehicles add column if not exists capacity integer;
alter table public.vehicles add column if not exists status text;

create index if not exists idx_orders_created_at on public.orders(created_at);
create index if not exists idx_orders_client_id on public.orders(client_id);
create index if not exists idx_orders_driver_id on public.orders(driver_id);
create index if not exists idx_orders_service_type on public.orders(service_type);

grant select on public.orders to authenticated;
grant select on public.clients to authenticated;
grant select on public.drivers to authenticated;
grant select on public.vehicles to authenticated;

notify pgrst, 'reload schema';
