-- Migration: ajoute la colonne contact_nom sur la table entreprises
-- A executer une seule fois dans le SQL Editor Supabase.

alter table public.entreprises
  add column if not exists contact_nom text;

comment on column public.entreprises.contact_nom is 'Nom du contact principal de l entreprise (ex: Marie Dupont).';

notify pgrst, 'reload schema';
