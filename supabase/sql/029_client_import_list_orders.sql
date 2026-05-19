create or replace function public.client_import_list_orders(
  p_user_id uuid,
  p_code text,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_orders jsonb;
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_orders
  from (
    select
      o.id,
      o.external_reference,
      o.delivery_name,
      o.delivery_address,
      o.delivery_zip,
      o.delivery_city,
      o.delivery_phone,
      o.delivery_instructions,
      o.pickup_name,
      o.pickup_address,
      o.pickup_zip,
      o.pickup_city,
      o.parcel_count,
      o.weight_kg,
      o.service_level,
      o.tariff_code,
      o.status,
      o.source_system,
      o.import_batch_id,
      o.total_price_chf,
      o.pricing_status,
      o.pricing_details,
      o.created_at
    from public.orders o
    where o.client_id = v_client_id
      and o.source_system = 'client_import'
    order by o.created_at desc
    limit v_limit
  ) x;

  return v_orders;
end;
$$;

revoke all on function public.client_import_list_orders(uuid, text, integer) from public;
grant execute on function public.client_import_list_orders(uuid, text, integer) to anon, authenticated;
