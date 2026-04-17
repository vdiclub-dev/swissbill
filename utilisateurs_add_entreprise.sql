-- Ajouter les colonnes manquantes dans utilisateurs
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS entreprise_nom TEXT,
  ADD COLUMN IF NOT EXISTS telephone      TEXT;
