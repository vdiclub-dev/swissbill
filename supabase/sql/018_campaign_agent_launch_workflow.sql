alter table public.campaigns
  add column if not exists launch_status text not null default 'draft',
  add column if not exists launch_package jsonb not null default '{}'::jsonb,
  add column if not exists approval_notes text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists exported_at timestamptz,
  add column if not exists launched_at timestamptz;

alter table public.campaigns
  drop constraint if exists campaigns_launch_status_check;

alter table public.campaigns
  add constraint campaigns_launch_status_check
  check (launch_status in ('draft','pending_review','approved','exported','launched','paused','rejected'));

create index if not exists campaigns_launch_status_idx on public.campaigns(launch_status);

create or replace function public.admin_campaign_agent_list(p_admin_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaigns jsonb;
  v_leads jsonb;
  v_followups jsonb;
  v_stats jsonb;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  select coalesce(jsonb_agg(
    to_jsonb(c)
    || jsonb_build_object(
      'ad_variants', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at asc)
        from public.ad_variants a
        where a.campaign_id = c.id
      ), '[]'::jsonb),
      'lead_forms', coalesce((
        select jsonb_agg(to_jsonb(f) order by f.created_at asc)
        from public.lead_forms f
        where f.campaign_id = c.id
      ), '[]'::jsonb)
    )
    order by c.created_at desc
  ), '[]'::jsonb)
    into v_campaigns
  from public.campaigns c;

  select coalesce(jsonb_agg(
    to_jsonb(l) || jsonb_build_object('score', coalesce(s.score, 0), 'classification', coalesce(s.classification, 'non_prioritaire'))
    order by l.created_at desc
  ), '[]'::jsonb)
    into v_leads
  from public.leads l
  left join public.lead_scores s on s.lead_id = l.id;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.due_at asc), '[]'::jsonb)
    into v_followups
  from public.lead_followups f
  where f.status = 'todo';

  select jsonb_build_object(
    'campaigns', (select count(*) from public.campaigns),
    'leads', (select count(*) from public.leads),
    'avg_score', coalesce((select round(avg(score)) from public.lead_scores), 0),
    'hot_leads', coalesce((select count(*) from public.lead_scores where classification = 'chaud'), 0),
    'todo_followups', coalesce((select count(*) from public.lead_followups where status = 'todo'), 0),
    'potential_revenue_chf', coalesce((select sum(potential_revenue_chf) from public.leads), 0),
    'spend_chf', coalesce((select sum(coalesce((metrics->>'spend_chf')::numeric, 0)) from public.campaigns), 0),
    'cpl_chf', case
      when (select count(*) from public.leads) > 0
      then round(coalesce((select sum(coalesce((metrics->>'spend_chf')::numeric, 0)) from public.campaigns), 0) / (select count(*) from public.leads), 2)
      else 0
    end,
    'ready_to_launch', (select count(*) from public.campaigns where launch_status in ('approved','exported'))
  )
    into v_stats;

  return jsonb_build_object('campaigns', v_campaigns, 'leads', v_leads, 'followups', v_followups, 'stats', coalesce(v_stats, '{}'::jsonb));
end;
$$;

create or replace function public.admin_campaign_agent_approve_campaign(
  p_admin_id uuid,
  p_code text,
  p_campaign_id uuid,
  p_launch_package jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  update public.campaigns
  set launch_status = 'approved',
      launch_package = coalesce(p_launch_package, '{}'::jsonb),
      approval_notes = nullif(trim(coalesce(p_notes, '')), ''),
      approved_by = p_admin_id,
      approved_at = now(),
      updated_at = now()
  where id = p_campaign_id
  returning * into v_campaign;

  if not found then
    raise exception 'Campagne introuvable';
  end if;

  return to_jsonb(v_campaign);
end;
$$;

create or replace function public.admin_campaign_agent_mark_campaign_exported(
  p_admin_id uuid,
  p_code text,
  p_campaign_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  update public.campaigns
  set launch_status = case when launch_status = 'launched' then launch_status else 'exported' end,
      exported_at = now(),
      updated_at = now()
  where id = p_campaign_id;

  if not found then
    raise exception 'Campagne introuvable';
  end if;
end;
$$;

create or replace function public.admin_campaign_agent_mark_campaign_launched(
  p_admin_id uuid,
  p_code text,
  p_campaign_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  update public.campaigns
  set launch_status = 'launched',
      status = 'active',
      launched_at = now(),
      updated_at = now()
  where id = p_campaign_id;

  if not found then
    raise exception 'Campagne introuvable';
  end if;
end;
$$;

revoke all on function public.admin_campaign_agent_approve_campaign(uuid, text, uuid, jsonb, text) from public;
revoke all on function public.admin_campaign_agent_mark_campaign_exported(uuid, text, uuid) from public;
revoke all on function public.admin_campaign_agent_mark_campaign_launched(uuid, text, uuid) from public;

grant execute on function public.admin_campaign_agent_approve_campaign(uuid, text, uuid, jsonb, text) to anon, authenticated;
grant execute on function public.admin_campaign_agent_mark_campaign_exported(uuid, text, uuid) to anon, authenticated;
grant execute on function public.admin_campaign_agent_mark_campaign_launched(uuid, text, uuid) to anon, authenticated;
