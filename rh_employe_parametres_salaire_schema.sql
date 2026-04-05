-- ============================================================
--  PARAMÈTRES DE SALAIRE PAR EMPLOYÉ (taux % sur le brut, etc.)
--  Exécuter dans : Supabase → SQL Editor (après utilisateurs)
--  Une ligne par employé : les montants mensuels = brut × taux/100
--  (+ montant fixe « autres » si besoin).
-- ============================================================

CREATE TABLE IF NOT EXISTS rh_employe_parametres_salaire (
    employe_id                  uuid PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
    taux_avs_ai_apg_pct         numeric(6,3) NOT NULL DEFAULT 0,
    taux_ac_pct                 numeric(6,3) NOT NULL DEFAULT 0,
    taux_lpp_pct                numeric(6,3) NOT NULL DEFAULT 0,
    taux_impot_source_pct       numeric(6,3) NOT NULL DEFAULT 0,
    taux_autres_pct             numeric(6,3) NOT NULL DEFAULT 0,
    autres_deduction_fixe_chf   numeric(12,2) NOT NULL DEFAULT 0,
    employeur_nom               text DEFAULT 'Colixo',
    employeur_adresse           text,
    employe_adresse             text,
    iban                        text,
    commentaire                 text,
    updated_at                  timestamptz DEFAULT now()
);

COMMENT ON TABLE rh_employe_parametres_salaire IS 'Taux de déduction (% du brut) et libellé employeur par défaut ; saisis une fois par employé.';

ALTER TABLE rh_employe_parametres_salaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_employe_parametres_salaire_admin" ON rh_employe_parametres_salaire;
CREATE POLICY "rh_employe_parametres_salaire_admin" ON rh_employe_parametres_salaire
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));
