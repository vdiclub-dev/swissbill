-- ============================================================
--  CHAUFFEUR — Plein (litres + prix/L) sur vehicule_km + frais journaliers
--  Exécuter dans Supabase → SQL Editor
-- ============================================================

ALTER TABLE vehicule_km ADD COLUMN IF NOT EXISTS carburant_litres numeric(10,3);
ALTER TABLE vehicule_km ADD COLUMN IF NOT EXISTS carburant_prix_litre_chf numeric(10,4);
ALTER TABLE vehicule_km ADD COLUMN IF NOT EXISTS carburant_montant_chf numeric(10,2);

-- ── Dépenses saisies par le chauffeur (péage, parking, etc.) ──
CREATE TABLE IF NOT EXISTS chauffeur_depenses (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chauffeur_id  uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    vehicule_id   uuid REFERENCES vehicules(id) ON DELETE SET NULL,
    date          date NOT NULL DEFAULT (CURRENT_DATE),
    categorie     text NOT NULL DEFAULT 'autre',
    libelle       text,
    montant_chf   numeric(10,2) NOT NULL DEFAULT 0,
    notes         text,
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chauffeur_dep_chauffeur_date
    ON chauffeur_depenses(chauffeur_id, date DESC);

ALTER TABLE chauffeur_depenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chauffeur_dep_select" ON chauffeur_depenses;
CREATE POLICY "chauffeur_dep_select" ON chauffeur_depenses
    FOR SELECT TO authenticated
    USING (
        chauffeur_id = auth.uid()
        OR (SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin')
    );

DROP POLICY IF EXISTS "chauffeur_dep_insert" ON chauffeur_depenses;
CREATE POLICY "chauffeur_dep_insert" ON chauffeur_depenses
    FOR INSERT TO authenticated
    WITH CHECK (chauffeur_id = auth.uid());

DROP POLICY IF EXISTS "chauffeur_dep_delete_own" ON chauffeur_depenses;
CREATE POLICY "chauffeur_dep_delete_own" ON chauffeur_depenses
    FOR DELETE TO authenticated
    USING (chauffeur_id = auth.uid());

DROP POLICY IF EXISTS "chauffeur_dep_admin_all" ON chauffeur_depenses;
CREATE POLICY "chauffeur_dep_admin_all" ON chauffeur_depenses
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));
