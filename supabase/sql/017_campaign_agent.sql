create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text default 'meta_ads',
  meta_objective text not null default 'lead_generation',
  marketing_angle text,
  audience_target text,
  target_region text default 'Suisse romande',
  budget_daily_chf numeric default 25,
  budget_total_chf numeric default 250,
  test_duration_days integer default 10,
  primary_text text,
  headline text,
  description text,
  call_to_action text default 'Demander un devis',
  visual_idea text,
  form_questions jsonb default '[]'::jsonb,
  metrics jsonb default '{}'::jsonb,
  potential_revenue_chf numeric default 0,
  status text default 'draft',
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint campaigns_status_check check (status in ('draft','active','paused','completed','archived'))
);

create table if not exists public.ad_variants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  variant_type text not null,
  primary_text text not null,
  headline text,
  description text,
  call_to_action text default 'Demander un devis',
  visual_idea text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  source text default 'meta_lead_ads',
  questions jsonb not null default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  source text default 'meta_lead_ads',
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  city text,
  canton text,
  sector text,
  daily_parcels integer,
  delivery_zones text,
  current_carrier text,
  software_used text,
  urgent_need boolean default false,
  regular_need boolean default true,
  message text,
  status text default 'new',
  potential_revenue_chf numeric default 0,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint leads_status_check check (status in ('new','contacted','qualified','quote_sent','negotiation','won','lost','no_response'))
);

create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  score integer not null default 0,
  classification text not null default 'froid',
  score_details jsonb default '{}'::jsonb,
  calculated_at timestamptz default now(),
  constraint lead_scores_score_check check (score between 0 and 100),
  constraint lead_scores_classification_check check (classification in ('chaud','tiede','froid','non_prioritaire'))
);

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  followup_type text not null,
  content text not null,
  status text default 'todo',
  due_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  constraint lead_followups_type_check check (followup_type in ('email','sms','call_script','linkedin','proposal')),
  constraint lead_followups_status_check check (status in ('todo','done','skipped'))
);

create unique index if not exists lead_scores_lead_unique on public.lead_scores(lead_id);
create index if not exists campaigns_status_idx on public.campaigns(status);
create index if not exists campaigns_created_at_idx on public.campaigns(created_at desc);
create index if not exists ad_variants_campaign_idx on public.ad_variants(campaign_id);
create index if not exists lead_forms_campaign_idx on public.lead_forms(campaign_id);
create index if not exists leads_campaign_idx on public.leads(campaign_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists lead_followups_lead_idx on public.lead_followups(lead_id);
create index if not exists lead_followups_status_idx on public.lead_followups(status);

alter table public.campaigns enable row level security;
alter table public.ad_variants enable row level security;
alter table public.lead_forms enable row level security;
alter table public.leads enable row level security;
alter table public.lead_scores enable row level security;
alter table public.lead_followups enable row level security;

create or replace function public.colixo_campaign_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.utilisateurs u
    where u.id = auth.uid()
      and coalesce(u.actif, true) = true
      and u.role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.colixo_campaign_is_admin() from public;
grant execute on function public.colixo_campaign_is_admin() to authenticated;

drop policy if exists campaigns_admin_all on public.campaigns;
create policy campaigns_admin_all on public.campaigns for all to authenticated
using (public.colixo_campaign_is_admin()) with check (public.colixo_campaign_is_admin());

drop policy if exists ad_variants_admin_all on public.ad_variants;
create policy ad_variants_admin_all on public.ad_variants for all to authenticated
using (public.colixo_campaign_is_admin()) with check (public.colixo_campaign_is_admin());

drop policy if exists lead_forms_admin_all on public.lead_forms;
create policy lead_forms_admin_all on public.lead_forms for all to authenticated
using (public.colixo_campaign_is_admin()) with check (public.colixo_campaign_is_admin());

drop policy if exists leads_admin_all on public.leads;
create policy leads_admin_all on public.leads for all to authenticated
using (public.colixo_campaign_is_admin()) with check (public.colixo_campaign_is_admin());

drop policy if exists lead_scores_admin_all on public.lead_scores;
create policy lead_scores_admin_all on public.lead_scores for all to authenticated
using (public.colixo_campaign_is_admin()) with check (public.colixo_campaign_is_admin());

drop policy if exists lead_followups_admin_all on public.lead_followups;
create policy lead_followups_admin_all on public.lead_followups for all to authenticated
using (public.colixo_campaign_is_admin()) with check (public.colixo_campaign_is_admin());

grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.ad_variants to authenticated;
grant select, insert, update, delete on public.lead_forms to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.lead_scores to authenticated;
grant select, insert, update, delete on public.lead_followups to authenticated;

create or replace function public.campaign_agent_score_lead_payload(p_payload jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_score integer := 0;
  v_daily integer := coalesce(nullif(p_payload->>'daily_parcels','')::integer, 0);
  v_canton text := lower(coalesce(p_payload->>'canton',''));
  v_sector text := lower(coalesce(p_payload->>'sector',''));
  v_carrier text := lower(coalesce(p_payload->>'current_carrier',''));
  v_zones text := lower(coalesce(p_payload->>'delivery_zones',''));
  v_regular boolean := coalesce((p_payload->>'regular_need')::boolean, true);
  v_urgent boolean := coalesce((p_payload->>'urgent_need')::boolean, false);
  v_classification text;
  v_details jsonb := '{}'::jsonb;
begin
  if v_daily between 1 and 5 then v_score := v_score + 10; v_details := v_details || jsonb_build_object('volume','1-5 colis/jour +10');
  elsif v_daily between 6 and 10 then v_score := v_score + 20; v_details := v_details || jsonb_build_object('volume','6-10 colis/jour +20');
  elsif v_daily between 11 and 25 then v_score := v_score + 30; v_details := v_details || jsonb_build_object('volume','11-25 colis/jour +30');
  elsif v_daily between 26 and 50 then v_score := v_score + 40; v_details := v_details || jsonb_build_object('volume','26-50 colis/jour +40');
  elsif v_daily > 50 then v_score := v_score + 50; v_details := v_details || jsonb_build_object('volume','50+ colis/jour +50');
  end if;

  if v_canton in ('vd','ge','ne','fr','vs','ju','be') or v_zones ~ '(romandie|vaud|genève|geneve|neuchâtel|neuchatel|fribourg|valais|jura|lausanne)' then
    v_score := v_score + 15; v_details := v_details || jsonb_build_object('zone','Suisse romande +15');
  end if;

  if v_sector ~ '(e-?commerce|garage|grossiste|fournisseur|magasin|pme|industrie|atelier|pièce|piece)' then
    v_score := v_score + 12; v_details := v_details || jsonb_build_object('sector','secteur compatible +12');
  end if;

  if v_regular then v_score := v_score + 10; v_details := v_details || jsonb_build_object('regular','besoin régulier +10'); end if;
  if v_urgent then v_score := v_score + 8; v_details := v_details || jsonb_build_object('urgent','besoin urgent +8'); end if;

  if v_carrier ~ '(poste|post|dpd|dhl|ups|planzer|fedex|transporteur)' then
    v_score := v_score + 5; v_details := v_details || jsonb_build_object('carrier','transporteur actuel identifié +5');
  end if;

  v_score := least(v_score, 100);
  v_classification := case
    when v_score >= 75 then 'chaud'
    when v_score >= 50 then 'tiede'
    when v_score >= 25 then 'froid'
    else 'non_prioritaire'
  end;

  return jsonb_build_object(
    'score', v_score,
    'classification', v_classification,
    'details', v_details,
    'potential_revenue_chf', greatest(v_daily, 0) * 8.5 * 22
  );
end;
$$;

grant execute on function public.campaign_agent_score_lead_payload(jsonb) to anon, authenticated;

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

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
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
    end
  )
    into v_stats
  ;

  return jsonb_build_object('campaigns', v_campaigns, 'leads', v_leads, 'followups', v_followups, 'stats', coalesce(v_stats, '{}'::jsonb));
end;
$$;

create or replace function public.admin_campaign_agent_save_campaign(
  p_admin_id uuid,
  p_code text,
  p_campaign jsonb,
  p_variants jsonb,
  p_form jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_variant jsonb;
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  insert into public.campaigns (
    name, meta_objective, marketing_angle, audience_target, target_region,
    budget_daily_chf, budget_total_chf, test_duration_days,
    primary_text, headline, description, call_to_action, visual_idea,
    form_questions, potential_revenue_chf, status, created_by
  ) values (
    p_campaign->>'name',
    coalesce(p_campaign->>'meta_objective', 'lead_generation'),
    p_campaign->>'marketing_angle',
    p_campaign->>'audience_target',
    coalesce(p_campaign->>'target_region', 'Suisse romande'),
    coalesce(nullif(p_campaign->>'budget_daily_chf','')::numeric, 25),
    coalesce(nullif(p_campaign->>'budget_total_chf','')::numeric, 250),
    coalesce(nullif(p_campaign->>'test_duration_days','')::integer, 10),
    p_campaign->>'primary_text',
    p_campaign->>'headline',
    p_campaign->>'description',
    coalesce(p_campaign->>'call_to_action', 'Demander un devis'),
    p_campaign->>'visual_idea',
    coalesce(p_campaign->'form_questions', '[]'::jsonb),
    coalesce(nullif(p_campaign->>'potential_revenue_chf','')::numeric, 0),
    coalesce(p_campaign->>'status', 'draft'),
    p_admin_id
  )
  returning id into v_campaign_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb))
  loop
    insert into public.ad_variants (
      campaign_id, variant_type, primary_text, headline, description, call_to_action, visual_idea
    ) values (
      v_campaign_id,
      coalesce(v_variant->>'variant_type', 'standard'),
      coalesce(v_variant->>'primary_text', ''),
      v_variant->>'headline',
      v_variant->>'description',
      coalesce(v_variant->>'call_to_action', 'Demander un devis'),
      v_variant->>'visual_idea'
    );
  end loop;

  insert into public.lead_forms (campaign_id, name, source, questions)
  values (
    v_campaign_id,
    coalesce(p_form->>'name', 'Formulaire prospect Colixo'),
    coalesce(p_form->>'source', 'meta_lead_ads'),
    coalesce(p_form->'questions', '[]'::jsonb)
  );

  return v_campaign_id;
end;
$$;

create or replace function public.admin_campaign_agent_save_lead(
  p_admin_id uuid,
  p_code text,
  p_lead jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_score jsonb;
  v_company text := nullif(trim(p_lead->>'company_name'), '');
  v_contact text := nullif(trim(p_lead->>'contact_name'), '');
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);
  v_score := public.campaign_agent_score_lead_payload(p_lead);

  insert into public.leads (
    campaign_id, source, company_name, contact_name, phone, email, city, canton, sector,
    daily_parcels, delivery_zones, current_carrier, software_used, urgent_need, regular_need,
    message, status, potential_revenue_chf, raw_payload
  ) values (
    nullif(p_lead->>'campaign_id','')::uuid,
    coalesce(p_lead->>'source', 'manual'),
    coalesce(v_company, 'Entreprise sans nom'),
    v_contact,
    nullif(trim(p_lead->>'phone'), ''),
    lower(nullif(trim(p_lead->>'email'), '')),
    nullif(trim(p_lead->>'city'), ''),
    upper(nullif(trim(p_lead->>'canton'), '')),
    nullif(trim(p_lead->>'sector'), ''),
    coalesce(nullif(p_lead->>'daily_parcels','')::integer, 0),
    nullif(trim(p_lead->>'delivery_zones'), ''),
    nullif(trim(p_lead->>'current_carrier'), ''),
    nullif(trim(p_lead->>'software_used'), ''),
    coalesce((p_lead->>'urgent_need')::boolean, false),
    coalesce((p_lead->>'regular_need')::boolean, true),
    nullif(trim(p_lead->>'message'), ''),
    coalesce(p_lead->>'status', 'new'),
    coalesce((v_score->>'potential_revenue_chf')::numeric, 0),
    p_lead
  )
  returning id into v_lead_id;

  insert into public.lead_scores (lead_id, score, classification, score_details)
  values (v_lead_id, (v_score->>'score')::integer, v_score->>'classification', v_score->'details');

  insert into public.lead_followups (lead_id, followup_type, content, due_at)
  values
    (v_lead_id, 'email', 'Bonjour ' || coalesce(v_contact, '') || ', merci pour votre intérêt. Colixo peut vous proposer une alternative locale pour vos livraisons B2B en Suisse romande. Puis-je vous appeler pour comprendre vos volumes et vos zones ?', now()),
    (v_lead_id, 'sms', 'Bonjour, ici Colixo. Merci pour votre demande. Nous pouvons regarder ensemble une solution locale pour vos livraisons. Quel moment vous arrange pour un appel ?', now()),
    (v_lead_id, 'call_script', 'Objectif appel: valider volume colis/jour, zones, transporteur actuel, douleur principale, urgence et prochain pas: devis ou test 10 jours.', now()),
    (v_lead_id, 'linkedin', 'Bonjour, je vous contacte suite à votre intérêt pour Colixo. Nous aidons les PME romandes à simplifier leurs livraisons B2B avec un partenaire local.', now()),
    (v_lead_id, 'proposal', 'Proposition courte: test Colixo sur 10 jours, grille adaptée au volume, suivi local et import Excel/CSV si besoin.', now());

  return v_lead_id;
end;
$$;

create or replace function public.admin_campaign_agent_update_lead_status(
  p_admin_id uuid,
  p_code text,
  p_lead_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.colixo_assert_code_admin(p_admin_id, p_code);

  update public.leads
  set status = p_status,
      updated_at = now()
  where id = p_lead_id;
end;
$$;

revoke all on function public.admin_campaign_agent_list(uuid, text) from public;
revoke all on function public.admin_campaign_agent_save_campaign(uuid, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.admin_campaign_agent_save_lead(uuid, text, jsonb) from public;
revoke all on function public.admin_campaign_agent_update_lead_status(uuid, text, uuid, text) from public;

grant execute on function public.admin_campaign_agent_list(uuid, text) to anon, authenticated;
grant execute on function public.admin_campaign_agent_save_campaign(uuid, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.admin_campaign_agent_save_lead(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.admin_campaign_agent_update_lead_status(uuid, text, uuid, text) to anon, authenticated;
