-- Colonnes optionnelles (ajouts au net) pour bases déjà créées — Supabase SQL Editor
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS allocations_familiales_chf numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS remboursement_frais_chf numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS primes_autres_chf numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN rh_fiches_salaire.allocations_familiales_chf IS 'Optionnel : ajout au net (ex. AF versées au salarié sur la fiche).';
COMMENT ON COLUMN rh_fiches_salaire.remboursement_frais_chf IS 'Optionnel : remboursement de frais (hors charges sociales sur ce brut).';
COMMENT ON COLUMN rh_fiches_salaire.primes_autres_chf IS 'Optionnel : primes, bonus chauffeur, autres gains ajoutés au net.';
