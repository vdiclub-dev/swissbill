-- Ajout colonnes gestion inscription (à exécuter dans Supabase SQL Editor)

ALTER TABLE demandes_inscription
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS code_attribue TEXT,
  ADD COLUMN IF NOT EXISTS role_attribue TEXT,
  ADD COLUMN IF NOT EXISTS valide_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valide_par TEXT;

-- Index pour filtrer par statut
CREATE INDEX IF NOT EXISTS idx_demandes_statut ON demandes_inscription (statut);
