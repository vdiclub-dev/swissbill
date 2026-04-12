create extension if not exists pgcrypto;

create or replace function public.colixo_is_admin()
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.utilisateurs u
        where u.id = auth.uid()
          and u.role in ('admin', 'super_admin')
    );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.clients_colixo (
    id uuid primary key default gen_random_uuid(),
    company_name text not null,
    contact_name text,
    email text,
    phone text,
    address text,
    postal_code text,
    city text,
    tariff_profile text not null default 'standard',
    ai_sensitivity text not null default 'balanced',
    markup_cap_percent numeric(6,2) not null default 15,
    discount_cap_percent numeric(6,2) not null default 10,
    notes text,
    is_active boolean not null default true,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint clients_colixo_tariff_profile_check check (tariff_profile in ('standard', 'vinologue')),
    constraint clients_colixo_ai_sensitivity_check check (ai_sensitivity in ('balanced', 'margin_first', 'conversion_first'))
);

alter table public.clients_colixo add column if not exists company_name text;
alter table public.clients_colixo add column if not exists contact_name text;
alter table public.clients_colixo add column if not exists address text;
alter table public.clients_colixo add column if not exists postal_code text;
alter table public.clients_colixo add column if not exists city text;
alter table public.clients_colixo add column if not exists tariff_profile text default 'standard';
alter table public.clients_colixo add column if not exists ai_sensitivity text default 'balanced';
alter table public.clients_colixo add column if not exists markup_cap_percent numeric(6,2) default 15;
alter table public.clients_colixo add column if not exists discount_cap_percent numeric(6,2) default 10;
alter table public.clients_colixo add column if not exists is_active boolean default true;
alter table public.clients_colixo add column if not exists created_by uuid;
alter table public.clients_colixo add column if not exists updated_by uuid;
alter table public.clients_colixo add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.clients_colixo add column if not exists updated_at timestamptz default timezone('utc', now());

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'clients_colixo' and column_name = 'company'
    ) then
        update public.clients_colixo
        set company_name = coalesce(nullif(company_name, ''), nullif(company, ''), nullif(name, ''))
        where company_name is null;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'clients_colixo' and column_name = 'name'
    ) then
        update public.clients_colixo
        set contact_name = coalesce(nullif(contact_name, ''), nullif(name, ''))
        where contact_name is null;
    end if;
end $$;

update public.clients_colixo
set company_name = coalesce(company_name, contact_name, 'Client sans nom')
where company_name is null;

alter table public.clients_colixo alter column company_name set not null;

create index if not exists idx_clients_colixo_company_name on public.clients_colixo (company_name);
create index if not exists idx_clients_colixo_is_active on public.clients_colixo (is_active);

create table if not exists public.colixo_settings (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    settings jsonb not null default '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.colixo_settings add column if not exists settings jsonb default '{}'::jsonb;
alter table public.colixo_settings add column if not exists created_by uuid;
alter table public.colixo_settings add column if not exists updated_by uuid;
alter table public.colixo_settings add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.colixo_settings add column if not exists updated_at timestamptz default timezone('utc', now());

create table if not exists public.colixo_orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    client_id uuid references public.clients_colixo(id) on delete set null,
    status text not null default 'draft',
    service_level text not null default 'eco',
    tariff_family text not null default 'standard',
    package_type text not null default 'parcel',
    weight_kg numeric(10,2) not null default 0,
    distance_km numeric(10,2) not null default 0,
    floors integer not null default 0,
    extra_stops integer not null default 0,
    packages_per_day integer not null default 1,
    working_days_per_month integer not null default 22,
    margin_target_percent numeric(6,2) not null default 18,
    options jsonb not null default '{}'::jsonb,
    notes_internal text,
    notes_customer text,
    base_price numeric(12,2) not null default 0,
    suggested_ai_price numeric(12,2),
    final_price numeric(12,2) not null default 0,
    ai_summary text,
    ai_confidence numeric(5,4),
    price_breakdown jsonb not null default '[]'::jsonb,
    ai_advice jsonb,
    daily_revenue_estimate numeric(12,2) not null default 0,
    monthly_revenue_estimate numeric(12,2) not null default 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint colixo_orders_status_check check (status in ('draft', 'quoted', 'validated', 'lost')),
    constraint colixo_orders_service_level_check check (service_level in ('eco', 'priority', 'express', 'urgent', 'super_urgent')),
    constraint colixo_orders_tariff_family_check check (tariff_family in ('standard', 'vinologue'))
);

alter table public.colixo_orders add column if not exists order_number text;
alter table public.colixo_orders add column if not exists service_level text default 'eco';
alter table public.colixo_orders add column if not exists package_type text default 'parcel';
alter table public.colixo_orders add column if not exists weight_kg numeric(10,2) default 0;
alter table public.colixo_orders add column if not exists distance_km numeric(10,2) default 0;
alter table public.colixo_orders add column if not exists floors integer default 0;
alter table public.colixo_orders add column if not exists extra_stops integer default 0;
alter table public.colixo_orders add column if not exists packages_per_day integer default 1;
alter table public.colixo_orders add column if not exists working_days_per_month integer default 22;
alter table public.colixo_orders add column if not exists margin_target_percent numeric(6,2) default 18;
alter table public.colixo_orders add column if not exists notes_internal text;
alter table public.colixo_orders add column if not exists notes_customer text;
alter table public.colixo_orders add column if not exists base_price numeric(12,2) default 0;
alter table public.colixo_orders add column if not exists suggested_ai_price numeric(12,2);
alter table public.colixo_orders add column if not exists final_price numeric(12,2) default 0;
alter table public.colixo_orders add column if not exists ai_summary text;
alter table public.colixo_orders add column if not exists ai_confidence numeric(5,4);
alter table public.colixo_orders add column if not exists price_breakdown jsonb default '[]'::jsonb;
alter table public.colixo_orders add column if not exists ai_advice jsonb;
alter table public.colixo_orders add column if not exists daily_revenue_estimate numeric(12,2) default 0;
alter table public.colixo_orders add column if not exists monthly_revenue_estimate numeric(12,2) default 0;
alter table public.colixo_orders add column if not exists created_by uuid;
alter table public.colixo_orders add column if not exists updated_by uuid;
alter table public.colixo_orders add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.colixo_orders add column if not exists updated_at timestamptz default timezone('utc', now());

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'shipping_mode'
    ) then
        update public.colixo_orders
        set service_level = case shipping_mode
            when 'prio' then 'priority'
            when 'express' then 'express'
            when 'urgent' then 'urgent'
            when 'super_urgent' then 'super_urgent'
            else coalesce(service_level, 'eco')
        end
        where service_level is null or service_level = 'eco';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'weight'
    ) then
        update public.colixo_orders set weight_kg = coalesce(weight_kg, weight, 0);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'km'
    ) then
        update public.colixo_orders set distance_km = coalesce(distance_km, km, 0);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'floors_after_first'
    ) then
        update public.colixo_orders set floors = coalesce(floors, floors_after_first, 0);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'daily_revenue'
    ) then
        update public.colixo_orders
        set daily_revenue_estimate = coalesce(daily_revenue_estimate, daily_revenue, 0);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'monthly_revenue'
    ) then
        update public.colixo_orders
        set monthly_revenue_estimate = coalesce(monthly_revenue_estimate, monthly_revenue, 0);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'price'
    ) then
        update public.colixo_orders
        set base_price = coalesce(base_price, price, 0),
            final_price = coalesce(final_price, price, 0)
        where base_price = 0 or final_price = 0;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'ai_suggested_price'
    ) then
        update public.colixo_orders
        set suggested_ai_price = coalesce(suggested_ai_price, ai_suggested_price);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_orders' and column_name = 'ai_advice'
    ) then
        update public.colixo_orders
        set ai_summary = coalesce(ai_summary, ''),
            price_breakdown = coalesce(price_breakdown, '[]'::jsonb),
            ai_advice = coalesce(public.colixo_orders.ai_advice, '[]'::jsonb);
    end if;
end $$;

update public.colixo_orders
set order_number = coalesce(order_number, 'DEV-' || to_char(coalesce(created_at, timezone('utc', now())), 'YYYYMMDD') || '-' || substring(id::text, 1, 8))
where order_number is null;

alter table public.colixo_orders alter column order_number set not null;

create index if not exists idx_colixo_orders_client_id on public.colixo_orders (client_id);
create index if not exists idx_colixo_orders_status on public.colixo_orders (status);
create index if not exists idx_colixo_orders_created_at on public.colixo_orders (created_at desc);
create unique index if not exists idx_colixo_orders_order_number on public.colixo_orders (order_number);

create table if not exists public.colixo_ai_pricing_logs (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.colixo_orders(id) on delete set null,
    client_id uuid references public.clients_colixo(id) on delete set null,
    source text not null default 'edge_function',
    recommended_price numeric(12,2),
    confidence numeric(5,4),
    rationale text,
    reasons jsonb not null default '[]'::jsonb,
    prompt_payload jsonb not null default '{}'::jsonb,
    response_payload jsonb,
    created_by uuid,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.colixo_ai_pricing_logs add column if not exists order_id uuid;
alter table public.colixo_ai_pricing_logs add column if not exists client_id uuid;
alter table public.colixo_ai_pricing_logs add column if not exists source text default 'edge_function';
alter table public.colixo_ai_pricing_logs add column if not exists recommended_price numeric(12,2);
alter table public.colixo_ai_pricing_logs add column if not exists confidence numeric(5,4);
alter table public.colixo_ai_pricing_logs add column if not exists rationale text;
alter table public.colixo_ai_pricing_logs add column if not exists reasons jsonb default '[]'::jsonb;
alter table public.colixo_ai_pricing_logs add column if not exists prompt_payload jsonb default '{}'::jsonb;
alter table public.colixo_ai_pricing_logs add column if not exists response_payload jsonb;
alter table public.colixo_ai_pricing_logs add column if not exists created_by uuid;
alter table public.colixo_ai_pricing_logs add column if not exists created_at timestamptz default timezone('utc', now());

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_ai_pricing_logs' and column_name = 'suggested_price'
    ) then
        update public.colixo_ai_pricing_logs
        set recommended_price = coalesce(recommended_price, suggested_price);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_ai_pricing_logs' and column_name = 'factors'
    ) then
        update public.colixo_ai_pricing_logs
        set reasons = coalesce(reasons, to_jsonb(factors));
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'colixo_ai_pricing_logs' and column_name = 'order_payload'
    ) then
        update public.colixo_ai_pricing_logs
        set prompt_payload = coalesce(prompt_payload, order_payload);
    end if;
end $$;

create index if not exists idx_colixo_ai_pricing_logs_order_id on public.colixo_ai_pricing_logs (order_id);
create index if not exists idx_colixo_ai_pricing_logs_client_id on public.colixo_ai_pricing_logs (client_id);
create index if not exists idx_colixo_ai_pricing_logs_created_at on public.colixo_ai_pricing_logs (created_at desc);

drop trigger if exists trg_clients_colixo_updated_at on public.clients_colixo;
create trigger trg_clients_colixo_updated_at
before update on public.clients_colixo
for each row execute function public.set_updated_at();

drop trigger if exists trg_colixo_settings_updated_at on public.colixo_settings;
create trigger trg_colixo_settings_updated_at
before update on public.colixo_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_colixo_orders_updated_at on public.colixo_orders;
create trigger trg_colixo_orders_updated_at
before update on public.colixo_orders
for each row execute function public.set_updated_at();

alter table public.clients_colixo enable row level security;
alter table public.colixo_settings enable row level security;
alter table public.colixo_orders enable row level security;
alter table public.colixo_ai_pricing_logs enable row level security;

drop policy if exists "clients_colixo_admin_select" on public.clients_colixo;
create policy "clients_colixo_admin_select"
on public.clients_colixo
for select
to authenticated
using (public.colixo_is_admin());

drop policy if exists "clients_colixo_admin_insert" on public.clients_colixo;
create policy "clients_colixo_admin_insert"
on public.clients_colixo
for insert
to authenticated
with check (public.colixo_is_admin());

drop policy if exists "clients_colixo_admin_update" on public.clients_colixo;
create policy "clients_colixo_admin_update"
on public.clients_colixo
for update
to authenticated
using (public.colixo_is_admin())
with check (public.colixo_is_admin());

drop policy if exists "clients_colixo_admin_delete" on public.clients_colixo;
create policy "clients_colixo_admin_delete"
on public.clients_colixo
for delete
to authenticated
using (public.colixo_is_admin());

drop policy if exists "colixo_settings_admin_select" on public.colixo_settings;
create policy "colixo_settings_admin_select"
on public.colixo_settings
for select
to authenticated
using (public.colixo_is_admin());

drop policy if exists "colixo_settings_admin_insert" on public.colixo_settings;
create policy "colixo_settings_admin_insert"
on public.colixo_settings
for insert
to authenticated
with check (public.colixo_is_admin());

drop policy if exists "colixo_settings_admin_update" on public.colixo_settings;
create policy "colixo_settings_admin_update"
on public.colixo_settings
for update
to authenticated
using (public.colixo_is_admin())
with check (public.colixo_is_admin());

drop policy if exists "colixo_orders_admin_select" on public.colixo_orders;
create policy "colixo_orders_admin_select"
on public.colixo_orders
for select
to authenticated
using (public.colixo_is_admin());

drop policy if exists "colixo_orders_admin_insert" on public.colixo_orders;
create policy "colixo_orders_admin_insert"
on public.colixo_orders
for insert
to authenticated
with check (public.colixo_is_admin());

drop policy if exists "colixo_orders_admin_update" on public.colixo_orders;
create policy "colixo_orders_admin_update"
on public.colixo_orders
for update
to authenticated
using (public.colixo_is_admin())
with check (public.colixo_is_admin());

drop policy if exists "colixo_orders_admin_delete" on public.colixo_orders;
create policy "colixo_orders_admin_delete"
on public.colixo_orders
for delete
to authenticated
using (public.colixo_is_admin());

drop policy if exists "colixo_ai_pricing_logs_admin_select" on public.colixo_ai_pricing_logs;
create policy "colixo_ai_pricing_logs_admin_select"
on public.colixo_ai_pricing_logs
for select
to authenticated
using (public.colixo_is_admin());

drop policy if exists "colixo_ai_pricing_logs_admin_insert" on public.colixo_ai_pricing_logs;
create policy "colixo_ai_pricing_logs_admin_insert"
on public.colixo_ai_pricing_logs
for insert
to authenticated
with check (public.colixo_is_admin());

insert into public.colixo_settings (name, settings)
values (
    'default',
    '{
      "company": {
        "name": "Colixo Dispatch",
        "email": "contact@colixo.ch",
        "phone": "",
        "website": "www.colixo.ch",
        "address_line1": "Colixo",
        "address_line2": "Suisse"
      },
      "pricing": {
        "standard": {
          "weight_0_2": 8.5,
          "weight_2_10": 11.5,
          "weight_10_30": 20.5,
          "weight_30_plus": 29,
          "distance_rate": 1.5,
          "floor_rate": 1,
          "stop_rate": 3,
          "forfait_0_30": 18,
          "priority_rate": 1,
          "express_rate": 5,
          "urgent_rate": 10,
          "super_urgent_rate": 15,
          "call_before_rate": 2,
          "cod_rate": 4,
          "night_rate": 25,
          "fragile_rate": 6,
          "weekend_rate": 8,
          "wine_handling_rate": 5,
          "combined_discount_percent": 8
        },
        "vinologue": {
          "weight_0_2": 9.5,
          "weight_2_10": 13,
          "weight_10_30": 23.5,
          "weight_30_plus": 32,
          "distance_rate": 1.8,
          "floor_rate": 1.5,
          "stop_rate": 3.5,
          "forfait_0_30": 22,
          "priority_rate": 1.5,
          "express_rate": 6,
          "urgent_rate": 12,
          "super_urgent_rate": 18,
          "call_before_rate": 2,
          "cod_rate": 4,
          "night_rate": 28,
          "fragile_rate": 7,
          "weekend_rate": 10,
          "wine_handling_rate": 8,
          "combined_discount_percent": 6
        }
      },
      "ai": {
        "edge_function": "colixo-ai-pricing",
        "system_prompt": "Tu es un analyste pricing pour Colixo. Tu ne remplaces jamais le calcul métier. Tu proposes un prix conseillé en CHF, un niveau de confiance de 0 à 1 et une explication courte basée sur distance, urgence, marge, profil client et probabilité de conversion.",
        "markup_cap_percent": 15,
        "discount_cap_percent": 10,
        "margin_floor_percent": 15,
        "distance_threshold_km": 30
      }
    }'::jsonb
)
on conflict (name) do nothing;
