-- ============================================================
--  Télémétrie carte conducteurs (vitesse, session, km/jour)
--  À exécuter dans Supabase si la table existe déjà sans ces colonnes.
-- ============================================================

ALTER TABLE driver_live_positions ADD COLUMN IF NOT EXISTS speed_kmh double precision;
ALTER TABLE driver_live_positions ADD COLUMN IF NOT EXISTS session_started_at timestamptz;
ALTER TABLE driver_live_positions ADD COLUMN IF NOT EXISTS km_today numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN driver_live_positions.speed_kmh IS 'Vitesse instantanée (GPS), km/h';
COMMENT ON COLUMN driver_live_positions.session_started_at IS 'Première connexion app / GPS ce jour (Europe/Zurich), côté chauffeur';
COMMENT ON COLUMN driver_live_positions.km_today IS 'Km parcourus estimés ce jour (entre points GPS, app chauffeur)';
