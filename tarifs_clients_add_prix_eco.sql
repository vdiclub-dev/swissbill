-- Migration: ajoute la colonne prix_eco pour tarifs_clients
-- A executer une seule fois sur la base Supabase.

alter table public.tarifs_clients
  add column if not exists prix_eco numeric(10,2);

-- Colonnes supplementaires utilisees par l'admin Tarification.
alter table public.tarifs_clients
  add column if not exists suppl_express numeric(10,2),
  add column if not exists suppl_urgent numeric(10,2),
  add column if not exists suppl_nuit_chf numeric(10,2),
  add column if not exists suppl_super_urgent numeric(10,2),
  add column if not exists suppl_descente_cave numeric(10,2),
  add column if not exists suppl_recherche_colis_hotel numeric(10,2),
  add column if not exists option_prise_en_charge boolean,
  add column if not exists montant_prise_en_charge numeric(10,2),
  add column if not exists actif boolean;

-- Backfill: si prix_eco est vide, reprendre une valeur existante raisonnable.
update public.tarifs_clients
set prix_eco = coalesce(prix_eco, prix_inf_10kg, prix_inf_2kg, 7.50)
where prix_eco is null;

update public.tarifs_clients
set
  suppl_express = coalesce(suppl_express, 5.00),
  suppl_urgent = coalesce(suppl_urgent, 10.00),
  suppl_nuit_chf = coalesce(suppl_nuit_chf, 25.00),
  suppl_super_urgent = coalesce(suppl_super_urgent, 15.00),
  suppl_descente_cave = coalesce(suppl_descente_cave, 8.00),
  suppl_recherche_colis_hotel = coalesce(suppl_recherche_colis_hotel, 12.00),
  option_prise_en_charge = coalesce(option_prise_en_charge, false),
  actif = coalesce(actif, true)
where
  suppl_express is null
  or suppl_urgent is null
  or suppl_nuit_chf is null
  or suppl_super_urgent is null
  or suppl_descente_cave is null
  or suppl_recherche_colis_hotel is null
  or option_prise_en_charge is null
  or actif is null;

alter table public.tarifs_clients
  alter column prix_eco set default 7.50;

alter table public.tarifs_clients
  alter column suppl_express set default 5.00,
  alter column suppl_urgent set default 10.00,
  alter column suppl_nuit_chf set default 25.00,
  alter column suppl_super_urgent set default 15.00,
  alter column suppl_descente_cave set default 8.00,
  alter column suppl_recherche_colis_hotel set default 12.00,
  alter column option_prise_en_charge set default false,
  alter column actif set default true;

alter table public.tarifs_clients
  alter column prix_eco set not null;

alter table public.tarifs_clients
  alter column suppl_express set not null,
  alter column suppl_urgent set not null,
  alter column suppl_nuit_chf set not null,
  alter column suppl_super_urgent set not null,
  alter column suppl_descente_cave set not null,
  alter column suppl_recherche_colis_hotel set not null,
  alter column option_prise_en_charge set not null,
  alter column actif set not null;

comment on column public.tarifs_clients.prix_eco is 'Tarif ECO (CHF) utilise dans tarification client/devis.';
comment on column public.tarifs_clients.suppl_descente_cave is 'Supplement livraison/descente cave (CHF).';

-- Force le rechargement du cache schema PostgREST (utile si l erreur persiste juste apres migration).
notify pgrst, 'reload schema';

-- Horodatage des modifications de tarifs_clients.
alter table public.tarifs_clients
  add column if not exists updated_at timestamptz;

update public.tarifs_clients
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.tarifs_clients
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.tarifs_clients_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tarifs_clients_set_updated_at on public.tarifs_clients;

create trigger trg_tarifs_clients_set_updated_at
before update on public.tarifs_clients
for each row
execute function public.tarifs_clients_set_updated_at();

notify pgrst, 'reload schema';
