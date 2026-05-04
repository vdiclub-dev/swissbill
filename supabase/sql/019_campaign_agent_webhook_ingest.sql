alter table public.leads
  add column if not exists external_lead_id text,
  add column if not exists external_form_id text,
  add column if not exists external_ad_id text,
  add column if not exists external_campaign_id text,
  add column if not exists external_payload jsonb not null default '{}'::jsonb;

create unique index if not exists leads_source_external_lead_uidx
  on public.leads(source, external_lead_id)
  where external_lead_id is not null and external_lead_id <> '';

create index if not exists leads_external_form_idx on public.leads(external_form_id);
create index if not exists leads_external_campaign_idx on public.leads(external_campaign_id);

create or replace function public.campaign_agent_ingest_webhook_lead(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_existing_id uuid;
  v_score jsonb;
  v_campaign_id uuid := nullif(p_payload->>'campaign_id', '')::uuid;
  v_external_lead_id text := nullif(trim(coalesce(p_payload->>'external_lead_id', p_payload->>'leadgen_id', p_payload->>'id')), '');
  v_external_form_id text := nullif(trim(coalesce(p_payload->>'external_form_id', p_payload->>'form_id')), '');
  v_external_ad_id text := nullif(trim(coalesce(p_payload->>'external_ad_id', p_payload->>'ad_id')), '');
  v_external_campaign_id text := nullif(trim(coalesce(p_payload->>'external_campaign_id', p_payload->>'meta_campaign_id')), '');
  v_source text := coalesce(nullif(trim(p_payload->>'source'), ''), 'meta_lead_ads');
  v_company text := nullif(trim(coalesce(p_payload->>'company_name', p_payload->>'company', p_payload->>'nom_entreprise')), '');
  v_contact text := nullif(trim(coalesce(p_payload->>'contact_name', p_payload->>'full_name', p_payload->>'name', p_payload->>'nom_contact')), '');
begin
  if v_external_lead_id is not null then
    select id into v_existing_id
    from public.leads
    where source = v_source
      and external_lead_id = v_external_lead_id
    limit 1;

    if v_existing_id is not null then
      return jsonb_build_object('ok', true, 'inserted', false, 'duplicate', true, 'lead_id', v_existing_id);
    end if;
  end if;

  v_score := public.campaign_agent_score_lead_payload(p_payload);

  insert into public.leads (
    campaign_id, source, company_name, contact_name, phone, email, city, canton, sector,
    daily_parcels, delivery_zones, current_carrier, software_used, urgent_need, regular_need,
    message, status, potential_revenue_chf, raw_payload,
    external_lead_id, external_form_id, external_ad_id, external_campaign_id, external_payload
  ) values (
    v_campaign_id,
    v_source,
    coalesce(v_company, 'Entreprise Meta Lead'),
    v_contact,
    nullif(trim(coalesce(p_payload->>'phone', p_payload->>'phone_number', p_payload->>'telephone')), ''),
    lower(nullif(trim(coalesce(p_payload->>'email', p_payload->>'email_address')), '')),
    nullif(trim(coalesce(p_payload->>'city', p_payload->>'ville')), ''),
    upper(nullif(trim(coalesce(p_payload->>'canton', p_payload->>'state')), '')),
    nullif(trim(coalesce(p_payload->>'sector', p_payload->>'secteur')), ''),
    coalesce(nullif(coalesce(p_payload->>'daily_parcels', p_payload->>'nombre_colis_jour'), '')::integer, 0),
    nullif(trim(coalesce(p_payload->>'delivery_zones', p_payload->>'zones_livraison')), ''),
    nullif(trim(coalesce(p_payload->>'current_carrier', p_payload->>'transporteur_actuel')), ''),
    nullif(trim(coalesce(p_payload->>'software_used', p_payload->>'logiciel_utilise')), ''),
    coalesce(nullif(p_payload->>'urgent_need', '')::boolean, false),
    coalesce(nullif(p_payload->>'regular_need', '')::boolean, true),
    nullif(trim(coalesce(p_payload->>'message', p_payload->>'remarks', p_payload->>'commentaire')), ''),
    'new',
    coalesce((v_score->>'potential_revenue_chf')::numeric, 0),
    p_payload,
    v_external_lead_id,
    v_external_form_id,
    v_external_ad_id,
    v_external_campaign_id,
    p_payload
  )
  returning id into v_lead_id;

  insert into public.lead_scores (lead_id, score, classification, score_details)
  values (v_lead_id, (v_score->>'score')::integer, v_score->>'classification', v_score->'details');

  insert into public.lead_followups (lead_id, followup_type, content, due_at)
  values
    (v_lead_id, 'email', 'Bonjour ' || coalesce(v_contact, '') || ', merci pour votre demande via Facebook/Instagram. Colixo peut vous proposer une solution locale pour vos livraisons B2B en Suisse romande. Puis-je vous appeler pour comprendre vos volumes et vos zones ?', now()),
    (v_lead_id, 'sms', 'Bonjour, ici Colixo. Merci pour votre demande. Quel moment vous arrange pour un court appel au sujet de vos livraisons ?', now()),
    (v_lead_id, 'call_script', 'Lead Meta Ads: rappeler rapidement. Valider volume colis/jour, zones, transporteur actuel, urgence, logiciel/fichier utilisé, puis proposer devis ou test Colixo.', now()),
    (v_lead_id, 'linkedin', 'Bonjour, je vous contacte suite à votre demande Colixo. Nous aidons les PME romandes à simplifier leurs livraisons B2B avec un partenaire local.', now()),
    (v_lead_id, 'proposal', 'Proposition courte: audit express du flux livraison, test Colixo 10 jours, grille adaptée au volume et import Excel/CSV si besoin.', now());

  return jsonb_build_object(
    'ok', true,
    'inserted', true,
    'duplicate', false,
    'lead_id', v_lead_id,
    'score', v_score
  );
end;
$$;

revoke all on function public.campaign_agent_ingest_webhook_lead(jsonb) from public;
grant execute on function public.campaign_agent_ingest_webhook_lead(jsonb) to service_role;
