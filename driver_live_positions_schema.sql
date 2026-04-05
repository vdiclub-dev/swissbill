-- ============================================================
--  POSITIONS TEMPS RÉEL DES CONDUCTEURS (Colixo)
--  Exécuter dans Supabase → SQL Editor
--  L’app chauffeur envoie la position (GPS) ; la carte admin lit.
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_live_positions (
    driver_id           uuid PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
    lat                 double precision NOT NULL,
    lng                 double precision NOT NULL,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    speed_kmh           double precision,
    session_started_at  timestamptz,
    km_today            numeric(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_driver_live_positions_updated
    ON driver_live_positions (updated_at DESC);

ALTER TABLE driver_live_positions ENABLE ROW LEVEL SECURITY;

-- Chauffeur : une seule ligne, la sienne (upsert)
DROP POLICY IF EXISTS "driver_live_positions_chauffeur_upsert" ON driver_live_positions;
CREATE POLICY "driver_live_positions_chauffeur_upsert" ON driver_live_positions
    FOR INSERT TO authenticated
    WITH CHECK (
        driver_id = auth.uid()
        AND (SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('chauffeur', 'admin', 'super_admin')
    );

DROP POLICY IF EXISTS "driver_live_positions_chauffeur_update" ON driver_live_positions;
CREATE POLICY "driver_live_positions_chauffeur_update" ON driver_live_positions
    FOR UPDATE TO authenticated
    USING (driver_id = auth.uid())
    WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "driver_live_positions_admin_select" ON driver_live_positions;
CREATE POLICY "driver_live_positions_admin_select" ON driver_live_positions
    FOR SELECT TO authenticated
    USING (
        driver_id = auth.uid()
        OR (SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin', 'super_admin')
    );

-- Temps réel (dashboard Colixo) : une fois la table créée, exécuter aussi :
--   ALTER PUBLICATION supabase_realtime ADD TABLE driver_live_positions;
-- Si la ligne existe déjà dans la publication, ignorer l’erreur.

COMMENT ON TABLE driver_live_positions IS 'Dernière position GPS connue par conducteur (app chauffeur, push throttlé).';
