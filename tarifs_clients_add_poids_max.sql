-- Migration: ajoute poids_max_kg et colonnes manquantes sur tarifs_clients
-- A executer UNE SEULE FOIS dans l'editeur SQL de Supabase.

alter table public.tarifs_clients
  add column if not exists poids_max_kg    numeric(10,2),
  add column if not exists montant_forfait  numeric(10,2),
  add column if not exists tarif_type       text default 'standard',
  add column if not exists notes            text,
  add column if not exists rabais_volume_pct numeric(5,2) default 0,
  add column if not exists abonnements      jsonb default '[]';

-- Valeur par defaut : 30 kg si pas encore defini
update public.tarifs_clients
set poids_max_kg = 30
where poids_max_kg is null;

alter table public.tarifs_clients
  alter column poids_max_kg set default 30;

-- Backfill tarif_type si vide
update public.tarifs_clients
set tarif_type = 'standard'
where tarif_type is null;

alter table public.tarifs_clients
  alter column tarif_type set not null,
  alter column tarif_type set default 'standard';

notify pgrst, 'reload schema';
