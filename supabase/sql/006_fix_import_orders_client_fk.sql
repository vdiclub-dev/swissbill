alter table public.orders
  drop constraint if exists orders_client_id_fkey;

create or replace function public.client_import_order_client_id(
  p_user_id uuid,
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.client_import_code_client_id(p_user_id, p_code);
end;
$$;

revoke all on function public.client_import_order_client_id(uuid, text) from public;
grant execute on function public.client_import_order_client_id(uuid, text) to anon, authenticated;

create or replace function public.client_import_load_bootstrap(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_profile jsonb;
  v_company jsonb;
  v_import_profile jsonb;
  v_tariffs jsonb;
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  select to_jsonb(u)
    into v_profile
  from public.utilisateurs u
  where u.id = p_user_id;

  select to_jsonb(e)
    into v_company
  from public.entreprises e
  where e.id = v_client_id;

  select to_jsonb(p)
    into v_import_profile
  from public.client_import_profiles p
  where p.client_id = v_client_id
    and p.is_active = true
  order by p.updated_at desc
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.priority asc, r.created_at asc), '[]'::jsonb)
    into v_tariffs
  from public.client_tariff_rules r
  where r.client_id = v_client_id
    and r.is_active = true;

  if jsonb_array_length(coalesce(v_tariffs, '[]'::jsonb)) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'client_id', v_client_id,
      'name', coalesce(p.nom, p.ref, 'Tarif'),
      'tariff_code', coalesce(p.ref, p.nom, ''),
      'service_level', null,
      'min_weight_kg', coalesce(p.poids_min, 0),
      'max_weight_kg', null,
      'min_parcel_count', null,
      'max_parcel_count', null,
      'base_price_chf', case when coalesce(p.prix_par_kg, false) then 0 else round(coalesce(case when ps.type_remise = 'pct' then p.prix * (1 - ps.valeur / 100) else ps.valeur end, p.prix, 0)::numeric, 2) end,
      'price_per_parcel_chf', 0,
      'price_per_kg_chf', case when coalesce(p.prix_par_kg, false) then round(coalesce(case when ps.type_remise = 'pct' then p.prix * (1 - ps.valeur / 100) else ps.valeur end, p.prix, 0)::numeric, 2) else 0 end,
      'priority', coalesce(p.ordre, 100)
    ) order by p.ordre asc, p.nom asc), '[]'::jsonb)
      into v_tariffs
    from public.produits_tarif p
    left join public.prix_speciaux ps
      on ps.produit_id = p.id
     and ps.client_id = v_client_id
     and coalesce(ps.actif, true) = true
    where coalesce(p.actif, true) = true;
  end if;

  return jsonb_build_object(
    'client_id', v_client_id,
    'order_client_id', v_client_id,
    'profile', coalesce(v_profile, '{}'::jsonb),
    'company', v_company,
    'import_profile', v_import_profile,
    'tariff_rules', coalesce(v_tariffs, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.client_import_load_bootstrap(uuid, text) to anon, authenticated;

create or replace function public.client_import_check_duplicates(
  p_user_id uuid,
  p_code text,
  p_refs text[]
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_refs text[];
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  select coalesce(array_agg(o.external_reference), array[]::text[])
    into v_refs
  from public.orders o
  where o.client_id = v_client_id
    and o.external_reference = any(coalesce(p_refs, array[]::text[]));

  return v_refs;
end;
$$;

grant execute on function public.client_import_check_duplicates(uuid, text, text[]) to anon, authenticated;

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
  do nothing;

  get diagnostics v_inserted = row_count;

  update public.import_batches
  set imported_rows = v_inserted,
      status = 'completed',
      completed_at = now()
  where id = p_batch_id
    and client_id = v_client_id;

  return jsonb_build_object('imported_rows', v_inserted, 'batch_id', p_batch_id);
end;
$$;

grant execute on function public.client_import_insert_orders(uuid, text, uuid, jsonb) to anon, authenticated;

drop policy if exists orders_client_select on public.orders;
drop policy if exists orders_client_insert on public.orders;
drop policy if exists orders_client_update on public.orders;

create policy orders_client_select
on public.orders for select to authenticated
using (
  client_id = auth.uid()
  or client_id = (
    select u.entreprise_id
    from public.utilisateurs u
    where u.id = auth.uid()
  )
);

create policy orders_client_insert
on public.orders for insert to authenticated
with check (
  client_id = auth.uid()
  or client_id = (
    select u.entreprise_id
    from public.utilisateurs u
    where u.id = auth.uid()
  )
);

create policy orders_client_update
on public.orders for update to authenticated
using (
  client_id = auth.uid()
  or client_id = (
    select u.entreprise_id
    from public.utilisateurs u
    where u.id = auth.uid()
  )
)
with check (
  client_id = auth.uid()
  or client_id = (
    select u.entreprise_id
    from public.utilisateurs u
    where u.id = auth.uid()
  )
);
