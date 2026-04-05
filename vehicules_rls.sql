-- ============================================================
--  VÉHICULES — Colonne chauffeur_id + RLS
--  Erreur 42703 "column chauffeur_id does not exist" → exécuter ce script
--  Supabase → SQL Editor → Run
-- ============================================================

-- L’app (Finances, Dispatch, chauffeur) attend chauffeur_id sur vehicules
ALTER TABLE vehicules ADD COLUMN IF NOT EXISTS chauffeur_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL;

ALTER TABLE vehicules ADD COLUMN IF NOT EXISTS actif boolean DEFAULT true;
ALTER TABLE vehicules ADD COLUMN IF NOT EXISTS cout_chauffeur_jour numeric(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_vehicules_chauffeur ON vehicules(chauffeur_id);

-- RLS
ALTER TABLE vehicules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicules_admin_all" ON vehicules;
CREATE POLICY "vehicules_admin_all" ON vehicules
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin')
    )
    WITH CHECK (
        (SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin')
    );

DROP POLICY IF EXISTS "vehicules_chauffeur_read" ON vehicules;
CREATE POLICY "vehicules_chauffeur_read" ON vehicules
    FOR SELECT TO authenticated
    USING (chauffeur_id = auth.uid());
