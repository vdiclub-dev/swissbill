-- Table dediee: prospects pour campagnes mail Brimot
-- Compatible Supabase / PostgreSQL

create extension if not exists pgcrypto;

create table if not exists public.mail_prospects (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  company text,
  email text not null,
  brand text not null default 'colixo' check (brand in ('colixo','brimot')),
  phone text,
  source text,
  quality_score int not null default 70 check (quality_score between 0 and 100),
  status text not null default 'new' check (
    status in ('new','sent_j0','relance_j3','relance_j7','relance_j14','replied','won','lost','stop')
  ),
  notes text,
  opt_out boolean not null default false,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, email)
);

create index if not exists idx_mail_prospects_status on public.mail_prospects(status);
create index if not exists idx_mail_prospects_quality on public.mail_prospects(quality_score desc);
create index if not exists idx_mail_prospects_follow_up on public.mail_prospects(next_follow_up_at);
create index if not exists idx_mail_prospects_brand on public.mail_prospects(brand);

create or replace function public.touch_mail_prospects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mail_prospects_updated_at on public.mail_prospects;
create trigger trg_mail_prospects_updated_at
before update on public.mail_prospects
for each row execute function public.touch_mail_prospects_updated_at();

-- RLS de base (optionnel mais recommande en production)
alter table public.mail_prospects enable row level security;

-- A adapter selon votre logique d'authentification/roles
-- Politique permissive temporaire pour environnement interne
drop policy if exists "mail_prospects_select_all" on public.mail_prospects;
create policy "mail_prospects_select_all"
  on public.mail_prospects for select
  using (true);

drop policy if exists "mail_prospects_insert_all" on public.mail_prospects;
create policy "mail_prospects_insert_all"
  on public.mail_prospects for insert
  with check (true);

drop policy if exists "mail_prospects_update_all" on public.mail_prospects;
create policy "mail_prospects_update_all"
  on public.mail_prospects for update
  using (true)
  with check (true);

drop policy if exists "mail_prospects_delete_all" on public.mail_prospects;
create policy "mail_prospects_delete_all"
  on public.mail_prospects for delete
  using (true);
