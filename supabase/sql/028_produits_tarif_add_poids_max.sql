-- Migration: ajoute poids_max sur produits_tarif pour definir des tranches claires
-- Ex: poids_min=0, poids_max=15 => tranche "0 – 15 kg"
-- A executer dans l'editeur SQL Supabase.

alter table public.produits_tarif
  add column if not exists poids_max numeric(10,2);

notify pgrst, 'reload schema';
