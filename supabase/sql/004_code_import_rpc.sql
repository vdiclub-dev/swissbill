create or replace function public.client_import_code_client_id(
  p_user_id uuid,
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select coalesce(u.entreprise_id, u.id)
    into v_client_id
  from public.utilisateurs u
  where u.id = p_user_id
    and coalesce(u.actif, true) = true
    and u.role in ('client', 'gestionnaire', 'comptable', 'sous_utilisateur')
    and upper(trim(p_code)) in (
      upper(trim(coalesce(u.code_usr, ''))),
      upper(trim(coalesce(u.code, ''))),
      upper(trim(coalesce(u.code_acces, ''))),
      upper(trim(coalesce(u.code_connexion, '')))
    )
  limit 1;

  if v_client_id is null then
    raise exception 'Code client invalide ou session expirée';
  end if;

  return v_client_id;
end;
$$;

revoke all on function public.client_import_code_client_id(uuid, text) from public;

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

  return jsonb_build_object(
    'client_id', v_client_id,
    'profile', coalesce(v_profile, '{}'::jsonb),
    'company', v_company,
    'import_profile', v_import_profile,
    'tariff_rules', coalesce(v_tariffs, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.client_import_load_bootstrap(uuid, text) to anon, authenticated;

create or replace function public.client_import_save_profile(
  p_user_id uuid,
  p_code text,
  p_profile_name text,
  p_file_type text,
  p_delimiter text,
  p_column_mapping jsonb,
  p_default_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_profile public.client_import_profiles;
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  update public.client_import_profiles
  set is_active = false
  where client_id = v_client_id
    and is_active = true;

  insert into public.client_import_profiles (
    client_id,
    profile_name,
    file_type,
    delimiter,
    has_header,
    column_mapping,
    default_values,
    is_active
  )
  values (
    v_client_id,
    coalesce(nullif(trim(p_profile_name), ''), 'Profil import actif'),
    p_file_type,
    p_delimiter,
    true,
    p_column_mapping,
    coalesce(p_default_values, '{}'::jsonb),
    true
  )
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;

grant execute on function public.client_import_save_profile(uuid, text, text, text, text, jsonb, jsonb) to anon, authenticated;

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

create or replace function public.client_import_create_batch(
  p_user_id uuid,
  p_code text,
  p_import_profile_id uuid,
  p_file_name text,
  p_file_type text,
  p_summary jsonb,
  p_errors jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_batch_id uuid;
begin
  v_client_id := public.client_import_code_client_id(p_user_id, p_code);

  insert into public.import_batches (
    client_id,
    import_profile_id,
    file_name,
    file_type,
    total_rows,
    valid_rows,
    error_rows,
    duplicate_rows,
    imported_rows,
    total_estimated_price_chf,
    status,
    error_report
  )
  values (
    v_client_id,
    p_import_profile_id,
    p_file_name,
    p_file_type,
    coalesce((p_summary->>'totalRows')::integer, 0),
    coalesce((p_summary->>'validRows')::integer, 0),
    coalesce((p_summary->>'errorRows')::integer, 0),
    coalesce((p_summary->>'duplicateRows')::integer, 0),
    0,
    coalesce((p_summary->>'totalEstimatedPrice')::numeric, 0),
    'draft',
    coalesce(p_errors, '[]'::jsonb)
  )
  returning id into v_batch_id;

  return v_batch_id;
end;
$$;

grant execute on function public.client_import_create_batch(uuid, text, uuid, text, text, jsonb, jsonb) to anon, authenticated;

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
