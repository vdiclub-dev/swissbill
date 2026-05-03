create extension if not exists pgcrypto;

create table if not exists public.client_import_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  profile_name text not null,
  file_type text,
  delimiter text,
  has_header boolean default true,
  column_mapping jsonb not null,
  default_values jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  import_profile_id uuid references public.client_import_profiles(id) on delete set null,
  file_name text,
  file_type text,
  total_rows integer default 0,
  valid_rows integer default 0,
  error_rows integer default 0,
  duplicate_rows integer default 0,
  imported_rows integer default 0,
  total_estimated_price_chf numeric default 0,
  status text default 'draft',
  error_report jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  external_reference text,
  delivery_name text,
  delivery_address text,
  delivery_zip text,
  delivery_city text,
  delivery_phone text,
  delivery_email text,
  delivery_instructions text,
  pickup_name text,
  pickup_address text,
  pickup_zip text,
  pickup_city text,
  parcel_count integer not null default 1,
  weight_kg numeric,
  service_level text,
  tariff_code text,
  status text default 'pending',
  source_system text default 'client_import',
  import_batch_id uuid references public.import_batches(id) on delete set null,
  tariff_rule_id uuid,
  unit_price_chf numeric,
  total_price_chf numeric,
  pricing_status text default 'calculated',
  pricing_details jsonb default '{}'::jsonb,
  raw_import_data jsonb default '{}'::jsonb,
  distance_km numeric,
  estimated_duration_min numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders add column if not exists client_id uuid;
alter table public.orders add column if not exists external_reference text;
alter table public.orders add column if not exists delivery_name text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_zip text;
alter table public.orders add column if not exists delivery_city text;
alter table public.orders add column if not exists delivery_phone text;
alter table public.orders add column if not exists delivery_email text;
alter table public.orders add column if not exists delivery_instructions text;
alter table public.orders add column if not exists pickup_name text;
alter table public.orders add column if not exists pickup_address text;
alter table public.orders add column if not exists pickup_zip text;
alter table public.orders add column if not exists pickup_city text;
alter table public.orders add column if not exists parcel_count integer not null default 1;
alter table public.orders add column if not exists weight_kg numeric;
alter table public.orders add column if not exists service_level text;
alter table public.orders add column if not exists tariff_code text;
alter table public.orders add column if not exists status text default 'pending';
alter table public.orders add column if not exists source_system text default 'client_import';
alter table public.orders add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
alter table public.orders add column if not exists tariff_rule_id uuid;
alter table public.orders add column if not exists unit_price_chf numeric;
alter table public.orders add column if not exists total_price_chf numeric;
alter table public.orders add column if not exists pricing_status text default 'calculated';
alter table public.orders add column if not exists pricing_details jsonb default '{}'::jsonb;
alter table public.orders add column if not exists raw_import_data jsonb default '{}'::jsonb;
alter table public.orders add column if not exists distance_km numeric;
alter table public.orders add column if not exists estimated_duration_min numeric;
alter table public.orders add column if not exists created_at timestamptz default now();
alter table public.orders add column if not exists updated_at timestamptz default now();

create index if not exists idx_client_import_profiles_client_active
  on public.client_import_profiles(client_id, is_active, updated_at desc);

create index if not exists idx_import_batches_client_created
  on public.import_batches(client_id, created_at desc);

create index if not exists idx_orders_import_batch
  on public.orders(import_batch_id);

create unique index if not exists orders_client_external_reference_unique
  on public.orders(client_id, external_reference)
  where external_reference is not null and external_reference <> '';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_import_profiles_updated_at on public.client_import_profiles;
create trigger trg_client_import_profiles_updated_at
before update on public.client_import_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();
