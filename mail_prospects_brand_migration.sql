-- Migration: separation des prospects Brimot/Colixo
-- Executez ce script sur une base existante.

alter table public.mail_prospects
  add column if not exists brand text not null default 'colixo';

alter table public.mail_prospects
  drop constraint if exists mail_prospects_email_key;

-- En cas d'ancien index unique, le supprimer si present.
drop index if exists public.mail_prospects_email_key;

alter table public.mail_prospects
  add constraint mail_prospects_brand_email_key unique (brand, email);

alter table public.mail_prospects
  drop constraint if exists mail_prospects_brand_check;

alter table public.mail_prospects
  add constraint mail_prospects_brand_check check (brand in ('colixo','brimot'));

create index if not exists idx_mail_prospects_brand on public.mail_prospects(brand);
