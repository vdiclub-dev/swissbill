alter table public.client_tariff_rules
  add column if not exists tariff_code text;

alter table public.orders
  add column if not exists tariff_code text;

create index if not exists idx_client_tariff_rules_code
  on public.client_tariff_rules(client_id, tariff_code)
  where is_active = true and tariff_code is not null;

create index if not exists idx_orders_client_tariff_code
  on public.orders(client_id, tariff_code)
  where tariff_code is not null;
