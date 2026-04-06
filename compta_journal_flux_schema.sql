-- ============================================================
--  JOURNAL DES FLUX (entrées / sorties) — multi-entité Colixo / Brimot
--  Exécuter dans : Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS compta_journal_flux (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entite             text NOT NULL CHECK (entite IN ('colixo','brimot')),
    date_mouvement     date NOT NULL,
    sens               text NOT NULL CHECK (sens IN ('entree','sortie')),
    montant_chf        numeric(14,2) NOT NULL CHECK (montant_chf > 0),
    libelle            text NOT NULL,
    categorie          text,
    compte_comptable   text,
    reference_piece    text,
    moyen_paiement     text,
    notes              text,
    created_at         timestamptz DEFAULT now(),
    updated_at         timestamptz DEFAULT now(),
    created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cjf_entite_date ON compta_journal_flux(entite, date_mouvement DESC);
CREATE INDEX IF NOT EXISTS idx_cjf_date ON compta_journal_flux(date_mouvement DESC);

ALTER TABLE compta_journal_flux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compta_journal_flux_admin" ON compta_journal_flux;
CREATE POLICY "compta_journal_flux_admin" ON compta_journal_flux
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

COMMENT ON TABLE compta_journal_flux IS 'Journal de trésorerie / flux (entrées et sorties) par société — saisie manuelle.';
