-- Colixo - Ramasses recurrentes
-- Tables de configuration des ramasses et taches operationnelles du jour.

create table if not exists public.pickup_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  pickup_address text not null,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  contact_name text,
  contact_phone text,
  frequency_type text not null default 'daily'
    check (frequency_type in ('daily','weekly','custom')),
  days_of_week smallint[] not null default '{}',
  time_window_start time without time zone not null,
  time_window_end time without time zone not null,
  estimated_parcels integer not null default 1 check (estimated_parcels >= 0),
  estimated_weight_kg numeric(10,2) default 0 check (estimated_weight_kg >= 0),
  package_type text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent','express')),
  driver_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pickups (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.pickup_schedules(id) on delete set null,
  client_id uuid,
  pickup_date date not null default current_date,
  pickup_address text not null,
  pickup_postcode text,
  pickup_city text,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  origin_region_code text,
  origin_zone_code text,
  contact_name text,
  contact_phone text,
  time_window_start time without time zone not null,
  time_window_end time without time zone not null,
  estimated_parcels integer not null default 1 check (estimated_parcels >= 0),
  estimated_weight_kg numeric(10,2) default 0 check (estimated_weight_kg >= 0),
  package_type text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent','express')),
  driver_notes text,
  source text not null default 'recurring',
  badge text not null default 'RAMASSE RECURRENTE',
  status text not null default 'pending'
    check (status in ('pending','planned','assigned','picked_up','failed','cancelled')),
  dispatch_status text not null default 'pending',
  assigned_driver_id uuid references public.utilisateurs(id) on delete set null,
  assigned_vehicle_id uuid,
  assigned_route_id uuid references public.routes(id) on delete set null,
  route_stop_id uuid references public.route_stops(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pickup_schedules add column if not exists client_id uuid;
alter table public.pickup_schedules add column if not exists pickup_address text;
alter table public.pickup_schedules add column if not exists pickup_lat numeric(10,7);
alter table public.pickup_schedules add column if not exists pickup_lng numeric(10,7);
alter table public.pickup_schedules add column if not exists contact_name text;
alter table public.pickup_schedules add column if not exists contact_phone text;
alter table public.pickup_schedules add column if not exists frequency_type text not null default 'daily';
alter table public.pickup_schedules add column if not exists days_of_week smallint[] not null default '{}';
alter table public.pickup_schedules add column if not exists time_window_start time without time zone;
alter table public.pickup_schedules add column if not exists time_window_end time without time zone;
alter table public.pickup_schedules add column if not exists estimated_parcels integer not null default 1;
alter table public.pickup_schedules add column if not exists estimated_weight_kg numeric(10,2) default 0;
alter table public.pickup_schedules add column if not exists package_type text;
alter table public.pickup_schedules add column if not exists priority text not null default 'normal';
alter table public.pickup_schedules add column if not exists driver_notes text;
alter table public.pickup_schedules add column if not exists is_active boolean not null default true;
alter table public.pickup_schedules add column if not exists created_at timestamptz not null default now();
alter table public.pickup_schedules add column if not exists updated_at timestamptz not null default now();

alter table public.pickups add column if not exists schedule_id uuid references public.pickup_schedules(id) on delete set null;
alter table public.pickups add column if not exists client_id uuid;
alter table public.pickups add column if not exists pickup_date date not null default current_date;
alter table public.pickups add column if not exists pickup_address text;
alter table public.pickups add column if not exists pickup_postcode text;
alter table public.pickups add column if not exists pickup_city text;
alter table public.pickups add column if not exists pickup_lat numeric(10,7);
alter table public.pickups add column if not exists pickup_lng numeric(10,7);
alter table public.pickups add column if not exists origin_region_code text;
alter table public.pickups add column if not exists origin_zone_code text;
alter table public.pickups add column if not exists contact_name text;
alter table public.pickups add column if not exists contact_phone text;
alter table public.pickups add column if not exists time_window_start time without time zone;
alter table public.pickups add column if not exists time_window_end time without time zone;
alter table public.pickups add column if not exists estimated_parcels integer not null default 1;
alter table public.pickups add column if not exists estimated_weight_kg numeric(10,2) default 0;
alter table public.pickups add column if not exists package_type text;
alter table public.pickups add column if not exists priority text not null default 'normal';
alter table public.pickups add column if not exists driver_notes text;
alter table public.pickups add column if not exists source text not null default 'recurring';
alter table public.pickups add column if not exists badge text not null default 'RAMASSE RECURRENTE';
alter table public.pickups add column if not exists status text not null default 'pending';
alter table public.pickups add column if not exists dispatch_status text not null default 'pending';
alter table public.pickups add column if not exists assigned_driver_id uuid references public.utilisateurs(id) on delete set null;
alter table public.pickups add column if not exists assigned_vehicle_id uuid;
alter table public.pickups add column if not exists assigned_route_id uuid references public.routes(id) on delete set null;
alter table public.pickups add column if not exists route_stop_id uuid references public.route_stops(id) on delete set null;
alter table public.pickups add column if not exists created_at timestamptz not null default now();
alter table public.pickups add column if not exists updated_at timestamptz not null default now();

alter table public.route_stops add column if not exists stop_type text not null default 'delivery';
alter table public.route_stops add column if not exists pickup_id uuid;
alter table public.route_stops add column if not exists time_window_start time without time zone;
alter table public.route_stops add column if not exists time_window_end time without time zone;

create unique index if not exists idx_pickups_schedule_day
  on public.pickups(schedule_id, pickup_date)
  where schedule_id is not null;

create index if not exists idx_pickup_schedules_active
  on public.pickup_schedules(is_active, frequency_type);

create index if not exists idx_pickups_dispatch_day
  on public.pickups(pickup_date, status, dispatch_status);

create index if not exists idx_pickups_route
  on public.pickups(assigned_route_id);

create or replace function public.colixo_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pickup_schedules_touch on public.pickup_schedules;
create trigger trg_pickup_schedules_touch
before update on public.pickup_schedules
for each row execute function public.colixo_touch_updated_at();

drop trigger if exists trg_pickups_touch on public.pickups;
create trigger trg_pickups_touch
before update on public.pickups
for each row execute function public.colixo_touch_updated_at();

alter table public.pickup_schedules enable row level security;
alter table public.pickups enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['pickup_schedules','pickups'] loop
    execute format('drop policy if exists %I on public.%I', 'auth_all_' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'auth_all_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'service_all_' || t, t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', 'service_all_' || t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.pickup_schedules to authenticated;
grant select, insert, update, delete on public.pickups to authenticated;

notify pgrst, 'reload schema';
