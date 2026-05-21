alter table public.tarifs_clients
  add column if not exists km_pricing jsonb;

create or replace function public.admin_set_client_km_pricing(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid,
  p_km_pricing jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_client_id is null then
    raise exception 'Client obligatoire';
  end if;

  if p_km_pricing is null or jsonb_typeof(p_km_pricing) <> 'object' then
    raise exception 'Grille km invalide';
  end if;

  update public.tarifs_clients
  set km_pricing = p_km_pricing,
      updated_at = now()
  where entreprise_id = p_client_id
  returning id into v_id;

  if v_id is null then
    insert into public.tarifs_clients (
      entreprise_id,
      nom_client,
      tarif_type,
      km_pricing,
      actif
    ) values (
      p_client_id,
      p_client_id::text,
      'standard',
      p_km_pricing,
      true
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_set_client_km_pricing(uuid, text, uuid, jsonb) from public;
grant execute on function public.admin_set_client_km_pricing(uuid, text, uuid, jsonb) to anon, authenticated;
