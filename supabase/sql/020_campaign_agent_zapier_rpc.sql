create extension if not exists pgcrypto;

create table if not exists public.campaign_agent_webhook_settings (
  id boolean primary key default true,
  secret_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_agent_webhook_settings_singleton check (id = true)
);

alter table public.campaign_agent_webhook_settings enable row level security;

revoke all on public.campaign_agent_webhook_settings from anon, authenticated;

insert into public.campaign_agent_webhook_settings (id, secret_hash, is_active)
values (
  true,
  'colixo-2026-zapier-rpc-secret-G7mK92pLxQ',
  true
)
on conflict (id) do update
set secret_hash = excluded.secret_hash,
    is_active = true,
    updated_at = now();

create or replace function public.campaign_agent_ingest_zapier_lead(
  p_secret text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  select exists (
    select 1
    from public.campaign_agent_webhook_settings s
    where s.id = true
      and s.is_active = true
      and s.secret_hash = coalesce(p_secret, '')
  )
    into v_allowed;

  if not v_allowed then
    raise exception 'Webhook secret invalide';
  end if;

  return public.campaign_agent_ingest_webhook_lead(coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.campaign_agent_ingest_zapier_lead(text, jsonb) from public;
grant execute on function public.campaign_agent_ingest_zapier_lead(text, jsonb) to anon, authenticated;
