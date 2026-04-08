-- ============================================================
--  tournees-fix.sql — Correction table tournees existante
--  Exécutez ce fichier dans Supabase > SQL Editor
-- ============================================================

-- Supprime tout avec CASCADE (enlève aussi les dépendances)
DROP TABLE IF EXISTS tournee_affectations CASCADE;
DROP TABLE IF EXISTS tournee_arrets CASCADE;
DROP TABLE IF EXISTS tournees CASCADE;

-- Recrée proprement
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

CREATE INDEX IF NOT EXISTS idx_ta_date ON tournee_affectations (date);
CREATE INDEX IF NOT EXISTS idx_ta_emp  ON tournee_affectations (employe_id);
