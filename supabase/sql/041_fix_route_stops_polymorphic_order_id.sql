-- Colixo - Correctif route_stops.order_id polymorphe
-- La dispatch nationale stocke dans route_stops des stops provenant de plusieurs tables :
-- transport_orders_simple, pickups, et potentiellement orders.
-- order_id ne peut donc pas garder une FK vers une seule table.

alter table public.route_stops
  drop constraint if exists route_stops_order_id_fkey;

do $$
declare
  c record;
  order_attnum smallint;
begin
  select attnum into order_attnum
  from pg_attribute
  where attrelid = 'public.route_stops'::regclass
    and attname = 'order_id'
    and not attisdropped;

  if order_attnum is not null then
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.route_stops'::regclass
        and contype = 'f'
        and order_attnum = any(conkey)
    loop
      execute format('alter table public.route_stops drop constraint if exists %I', c.conname);
    end loop;
  end if;
end $$;

alter table public.route_stops alter column order_id drop not null;
alter table public.route_stops add column if not exists order_table text default 'transport_orders_simple';
alter table public.route_stops add column if not exists pickup_id uuid;
alter table public.route_stops add column if not exists stop_type text default 'delivery';

comment on column public.route_stops.order_id is
  'Polymorphic task id. Use order_table to know whether it points to transport_orders_simple, pickups, or orders. No FK by design.';

notify pgrst, 'reload schema';
