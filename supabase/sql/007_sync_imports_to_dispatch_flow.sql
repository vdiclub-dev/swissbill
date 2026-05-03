alter table public.transport_orders_simple
  add column if not exists source_system text,
  add column if not exists source_order_id uuid,
  add column if not exists import_batch_id uuid;

create unique index if not exists transport_orders_simple_source_order_unique
  on public.transport_orders_simple(source_order_id)
  where source_order_id is not null;

create index if not exists idx_transport_orders_simple_import_batch
  on public.transport_orders_simple(import_batch_id)
  where import_batch_id is not null;

create or replace function public.client_import_insert_orders(
  p_user_id uuid,
  p_code text,
  p_batch_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_inserted integer := 0;
  v_mirrored integer := 0;
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  if not exists (
    select 1
    from public.import_batches b
    where b.id = p_batch_id
      and b.client_id = v_client_id
  ) then
    raise exception 'Lot d’import introuvable pour ce client';
  end if;

  with inserted_orders as (
    insert into public.orders (
      client_id,
      external_reference,
      delivery_name,
      delivery_address,
      delivery_zip,
      delivery_city,
      delivery_phone,
      delivery_email,
      delivery_instructions,
      pickup_name,
      pickup_address,
      pickup_zip,
      pickup_city,
      parcel_count,
      weight_kg,
      service_level,
      tariff_code,
      status,
      source_system,
      import_batch_id,
      tariff_rule_id,
      unit_price_chf,
      total_price_chf,
      pricing_status,
      pricing_details,
      raw_import_data,
      distance_km,
      estimated_duration_min
    )
    select
      v_client_id,
      nullif(o->>'external_reference', ''),
      nullif(o->>'delivery_name', ''),
      nullif(o->>'delivery_address', ''),
      nullif(o->>'delivery_zip', ''),
      nullif(o->>'delivery_city', ''),
      nullif(o->>'delivery_phone', ''),
      nullif(o->>'delivery_email', ''),
      nullif(o->>'delivery_instructions', ''),
      nullif(o->>'pickup_name', ''),
      nullif(o->>'pickup_address', ''),
      nullif(o->>'pickup_zip', ''),
      nullif(o->>'pickup_city', ''),
      coalesce(nullif(o->>'parcel_count', '')::integer, 1),
      nullif(o->>'weight_kg', '')::numeric,
      nullif(o->>'service_level', ''),
      nullif(o->>'tariff_code', ''),
      coalesce(nullif(o->>'status', ''), 'pending'),
      'client_import',
      p_batch_id,
      nullif(o->>'tariff_rule_id', '')::uuid,
      nullif(o->>'unit_price_chf', '')::numeric,
      nullif(o->>'total_price_chf', '')::numeric,
      coalesce(nullif(o->>'pricing_status', ''), 'needs_review'),
      coalesce(o->'pricing_details', '{}'::jsonb),
      coalesce(o->'raw_import_data', '{}'::jsonb),
      nullif(o->>'distance_km', '')::numeric,
      nullif(o->>'estimated_duration_min', '')::numeric
    from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) as x(o)
    on conflict (client_id, external_reference) where external_reference is not null and external_reference <> ''
    do nothing
    returning *
  ),
  mirrored_transports as (
    insert into public.transport_orders_simple (
      source_system,
      source_order_id,
      import_batch_id,
      entreprise_id,
      order_number,
      client_number,
      pickup_address,
      delivery_address,
      pickup_nom,
      pickup_npa,
      pickup_city,
      pickup_street,
      pickup_postal,
      delivery_street,
      delivery_postal,
      delivery_city,
      destinataire_nom,
      destinataire_tel,
      receiver_name,
      weight,
      quantity,
      package_type,
      service_type,
      speed,
      instructions,
      status,
      admin_status,
      priority,
      distance_km,
      duration_min,
      price_chf,
      colis
    )
    select
      'client_import',
      io.id,
      io.import_batch_id,
      io.client_id,
      io.external_reference,
      io.external_reference,
      nullif(trim(concat_ws(', ', io.pickup_address, nullif(trim(concat_ws(' ', io.pickup_zip, io.pickup_city)), ''))), ''),
      nullif(trim(concat_ws(', ', io.delivery_address, nullif(trim(concat_ws(' ', io.delivery_zip, io.delivery_city)), ''))), ''),
      io.pickup_name,
      io.pickup_zip,
      io.pickup_city,
      io.pickup_address,
      io.pickup_zip,
      io.delivery_address,
      io.delivery_zip,
      io.delivery_city,
      io.delivery_name,
      io.delivery_phone,
      io.delivery_name,
      io.weight_kg,
      greatest(coalesce(io.parcel_count, 1), 1),
      'colis',
      coalesce(nullif(io.service_level, ''), 'standard'),
      coalesce(nullif(io.service_level, ''), 'standard'),
      io.delivery_instructions,
      'pending',
      'pending_validation',
      case
        when lower(coalesce(io.service_level, '')) like '%urgent%' then 'urgent'
        when lower(coalesce(io.service_level, '')) like '%express%' then 'urgent'
        else 'normal'
      end,
      io.distance_km,
      io.estimated_duration_min,
      io.total_price_chf,
      jsonb_build_array(jsonb_build_object(
        'reference', io.external_reference,
        'poids_kg', io.weight_kg,
        'code_tarif', io.tariff_code,
        'prix_chf', io.total_price_chf,
        'statut_prix', io.pricing_status
      ))
    from inserted_orders io
    on conflict (source_order_id) where source_order_id is not null
    do nothing
    returning id
  )
  select
    (select count(*) from inserted_orders),
    (select count(*) from mirrored_transports)
  into v_inserted, v_mirrored;

  update public.import_batches
  set imported_rows = v_inserted,
      status = 'completed',
      completed_at = now()
  where id = p_batch_id
    and client_id = v_client_id;

  return jsonb_build_object(
    'imported_rows', v_inserted,
    'dispatch_rows', v_mirrored,
    'batch_id', p_batch_id
  );
end;
$$;

grant execute on function public.client_import_insert_orders(uuid, text, uuid, jsonb) to anon, authenticated;

insert into public.transport_orders_simple (
  source_system,
  source_order_id,
  import_batch_id,
  entreprise_id,
  order_number,
  client_number,
  pickup_address,
  delivery_address,
  pickup_nom,
  pickup_npa,
  pickup_city,
  pickup_street,
  pickup_postal,
  delivery_street,
  delivery_postal,
  delivery_city,
  destinataire_nom,
  destinataire_tel,
  receiver_name,
  weight,
  quantity,
  package_type,
  service_type,
  speed,
  instructions,
  status,
  admin_status,
  priority,
  distance_km,
  duration_min,
  price_chf,
  colis
)
select
  'client_import',
  o.id,
  o.import_batch_id,
  o.client_id,
  o.external_reference,
  o.external_reference,
  nullif(trim(concat_ws(', ', o.pickup_address, nullif(trim(concat_ws(' ', o.pickup_zip, o.pickup_city)), ''))), ''),
  nullif(trim(concat_ws(', ', o.delivery_address, nullif(trim(concat_ws(' ', o.delivery_zip, o.delivery_city)), ''))), ''),
  o.pickup_name,
  o.pickup_zip,
  o.pickup_city,
  o.pickup_address,
  o.pickup_zip,
  o.delivery_address,
  o.delivery_zip,
  o.delivery_city,
  o.delivery_name,
  o.delivery_phone,
  o.delivery_name,
  o.weight_kg,
  greatest(coalesce(o.parcel_count, 1), 1),
  'colis',
  coalesce(nullif(o.service_level, ''), 'standard'),
  coalesce(nullif(o.service_level, ''), 'standard'),
  o.delivery_instructions,
  'pending',
  'pending_validation',
  case
    when lower(coalesce(o.service_level, '')) like '%urgent%' then 'urgent'
    when lower(coalesce(o.service_level, '')) like '%express%' then 'urgent'
    else 'normal'
  end,
  o.distance_km,
  o.estimated_duration_min,
  o.total_price_chf,
  jsonb_build_array(jsonb_build_object(
    'reference', o.external_reference,
    'poids_kg', o.weight_kg,
    'code_tarif', o.tariff_code,
    'prix_chf', o.total_price_chf,
    'statut_prix', o.pricing_status
  ))
from public.orders o
where o.source_system = 'client_import'
  and not exists (
    select 1
    from public.transport_orders_simple tos
    where tos.source_order_id = o.id
  )
on conflict (source_order_id) where source_order_id is not null
do nothing;
