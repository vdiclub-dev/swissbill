-- Brimot - CRM campagne mail (Supabase/Postgres)
-- V1: prospects, campagnes, envois, relances, interactions

create extension if not exists pgcrypto;

create table if not exists public.mail_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  daily_limit int not null default 50 check (daily_limit between 1 and 50),
  quality_min int not null default 70 check (quality_min between 0 and 100),
  sender_name text,
  sender_email text,
  sender_phone text,
  sender_signature text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mail_prospects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.mail_campaigns(id) on delete cascade,
  full_name text,
  company text,
  email text not null,
  quality_score int not null default 70 check (quality_score between 0 and 100),
  status text not null default 'new' check (status in ('new','sent_j0','relance_j3','relance_j7','relance_j14','replied','won','lost','stop')),
  notes text,
  opt_out boolean not null default false,
  last_sent_at timestamptz,
  next_due_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists idx_mail_prospects_campaign_due
  on public.mail_prospects(campaign_id, next_due_at);

create index if not exists idx_mail_prospects_campaign_status
  on public.mail_prospects(campaign_id, status);

create table if not exists public.mail_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.mail_campaigns(id) on delete cascade,
  prospect_id uuid not null references public.mail_prospects(id) on delete cascade,
  stage text not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text,
  sent_at timestamptz not null default now(),
  success boolean not null default false,
  error_message text
);

create index if not exists idx_mail_sends_campaign_day
  on public.mail_sends(campaign_id, sent_at desc);

create table if not exists public.mail_interactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.mail_campaigns(id) on delete cascade,
  prospect_id uuid not null references public.mail_prospects(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('reply','call','meeting','won','lost','note')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mail_interactions_prospect
  on public.mail_interactions(prospect_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mail_campaigns_updated_at on public.mail_campaigns;
create trigger trg_mail_campaigns_updated_at
before update on public.mail_campaigns
for each row execute function public.touch_updated_at();

drop trigger if exists trg_mail_prospects_updated_at on public.mail_prospects;
create trigger trg_mail_prospects_updated_at
before update on public.mail_prospects
for each row execute function public.touch_updated_at();
