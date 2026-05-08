create or replace function public.admin_list_client_tariff_rules(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid
)
returns setof public.client_tariff_rules
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_client_id is null then
    raise exception 'Client obligatoire';
  end if;

  return query
  select r.*
  from public.client_tariff_rules r
  where r.client_id = p_client_id
    and r.is_active = true
  order by r.priority asc, r.name asc;
end;
$$;

revoke all on function public.admin_list_client_tariff_rules(uuid, text, uuid) from public;
grant execute on function public.admin_list_client_tariff_rules(uuid, text, uuid) to anon, authenticated;

create or replace function public.admin_list_client_price_options(
  p_admin_id uuid,
  p_code text,
  p_client_id uuid
)
returns setof public.prix_speciaux
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  if p_client_id is null then
    raise exception 'Client obligatoire';
  end if;

  return query
  select p.*
  from public.prix_speciaux p
  where p.client_id = p_client_id
  order by p.created_at asc;
end;
$$;

revoke all on function public.admin_list_client_price_options(uuid, text, uuid) from public;
grant execute on function public.admin_list_client_price_options(uuid, text, uuid) to anon, authenticated;
