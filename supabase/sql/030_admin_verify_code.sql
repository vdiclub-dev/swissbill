create or replace function public.admin_verify_code(
  p_admin_id uuid,
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);
  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.admin_verify_code(uuid, text) from public;
grant execute on function public.admin_verify_code(uuid, text) to anon, authenticated;
