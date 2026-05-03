create extension if not exists pgcrypto;

create table if not exists public.client_tariff_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  name text not null,
  service_level text,
  min_weight_kg numeric,
  max_weight_kg numeric,
  min_parcel_count integer,
  max_parcel_count integer,
  base_price_chf numeric not null default 0,
  price_per_parcel_chf numeric default 0,
  price_per_kg_chf numeric default 0,
  price_per_km_chf numeric default 0,
  included_km numeric default 0,
  extra_km_price_chf numeric default 0,
  night_surcharge_chf numeric default 0,
  urgent_surcharge_chf numeric default 0,
  floor_surcharge_chf numeric default 0,
  fuel_surcharge_percent numeric default 0,
  discount_percent numeric default 0,
  is_active boolean default true,
  priority integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_client_tariff_rules_client_active
  on public.client_tariff_rules(client_id, is_active, priority);

drop trigger if exists trg_client_tariff_rules_updated_at on public.client_tariff_rules;
create trigger trg_client_tariff_rules_updated_at
before update on public.client_tariff_rules
for each row execute function public.set_updated_at();
