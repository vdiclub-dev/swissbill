-- ============================================================
--  tournees-fix.sql — Correction table tournees existante
--  Si la table a été créée incomplète (sans heure_debut etc.)
--  Exécutez ce fichier dans Supabase > SQL Editor
-- ============================================================

-- Option A : Supprimer et recréer proprement (RECOMMANDÉ si pas encore de données)
DROP TABLE IF EXISTS tournee_affectations;
DROP TABLE IF EXISTS tournees;

CREATE TABLE tournees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          TEXT NOT NULL,
  heure_debut  TEXT NOT NULL,
  heure_fin    TEXT NOT NULL,
  zone         TEXT,
  vehicle      TEXT,
  jours        INTEGER[] DEFAULT '{1,2,3,4,5}',
  couleur      TEXT DEFAULT '#4f8ef7',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournee_affectations (
  id           BIGSERIAL PRIMARY KEY,
  tournee_id   UUID NOT NULL REFERENCES tournees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  employe_id   UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournee_id, date)
);

CREATE INDEX idx_ta_date ON tournee_affectations (date);
CREATE INDEX idx_ta_emp  ON tournee_affectations (employe_id);

-- ──────────────────────────────────────────────────────────
-- Option B : Ajouter les colonnes manquantes (si vous avez déjà des données)
-- Décommentez les lignes ci-dessous au lieu d'utiliser l'option A
-- ──────────────────────────────────────────────────────────
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS heure_debut TEXT;
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS heure_fin   TEXT;
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS zone        TEXT;
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS vehicle     TEXT;
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS jours       INTEGER[] DEFAULT '{1,2,3,4,5}';
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS couleur     TEXT DEFAULT '#4f8ef7';
-- ALTER TABLE tournees ADD COLUMN IF NOT EXISTS notes       TEXT;
