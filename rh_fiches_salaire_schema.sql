-- ============================================================
--  FICHES DE SALAIRE (saisie mensuelle, modèle type CH)
--  Exécuter dans : Supabase → SQL Editor
--  Rappel : les taux légaux évoluent ; validez avec votre caisse
--  de compensation / fiduciaire. Ceci est un support de traçabilité.
-- ============================================================

CREATE TABLE IF NOT EXISTS rh_fiches_salaire (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id          uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    annee               integer NOT NULL,
    mois                integer NOT NULL CHECK (mois >= 1 AND mois <= 12),
    employeur_nom       text DEFAULT 'Colixo',
    employeur_adresse   text,
    employe_adresse     text,
    date_bulletin       date,
    iban_versement      text,
    salaire_brut        numeric(12,2) NOT NULL DEFAULT 0,
    cc_avs_ai_apg       numeric(12,2) NOT NULL DEFAULT 0,
    cc_ac               numeric(12,2) NOT NULL DEFAULT 0,
    cc_lpp              numeric(12,2) NOT NULL DEFAULT 0,
    impot_source        numeric(12,2) NOT NULL DEFAULT 0,
    autres_deductions   numeric(12,2) NOT NULL DEFAULT 0,
    allocations_familiales_chf numeric(12,2) NOT NULL DEFAULT 0,
    remboursement_frais_chf     numeric(12,2) NOT NULL DEFAULT 0,
    primes_autres_chf           numeric(12,2) NOT NULL DEFAULT 0,
    net_a_payer         numeric(12,2) NOT NULL DEFAULT 0,
    notes               text,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (employe_id, annee, mois)
);

CREATE INDEX IF NOT EXISTS idx_rh_fs_periode ON rh_fiches_salaire(annee DESC, mois DESC);
CREATE INDEX IF NOT EXISTS idx_rh_fs_employe ON rh_fiches_salaire(employe_id);

COMMENT ON TABLE rh_fiches_salaire IS 'Fiche de salaire mensuelle (saisie). cc_* = parts salariales courantes (indicatif).';

ALTER TABLE rh_fiches_salaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_fiches_salaire_admin" ON rh_fiches_salaire;
CREATE POLICY "rh_fiches_salaire_admin" ON rh_fiches_salaire
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

-- Taux % par employé (une fois par personne) : voir rh_employe_parametres_salaire_schema.sql
-- Si la table existait déjà sans allocations / remboursement / primes : rh_fiches_salaire_add_options.sql
-- Adresses + date bulletin + IBAN : rh_fiches_salaire_add_adresse_iban.sql
-- Lecture par l’employé (app chauffeur) : rh_fiches_salaire_policy_employe_read.sql

DROP POLICY IF EXISTS "rh_fiches_salaire_read_own" ON rh_fiches_salaire;
CREATE POLICY "rh_fiches_salaire_read_own" ON rh_fiches_salaire
    FOR SELECT TO authenticated
    USING (employe_id = auth.uid());
