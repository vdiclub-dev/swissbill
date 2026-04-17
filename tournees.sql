-- ============================================================
--  tournees.sql — Tables pour la gestion des tournées Colixo
--  Exécutez ce fichier dans Supabase > SQL Editor
-- ============================================================

-- 1. Tournées (définition des routes)
CREATE TABLE IF NOT EXISTS tournees (
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

-- 2. Affectations (employé → tournée → jour)
CREATE TABLE IF NOT EXISTS tournee_affectations (
  id           BIGSERIAL PRIMARY KEY,
  tournee_id   UUID NOT NULL REFERENCES tournees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  employe_id   UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournee_id, date)
);

-- 3. Absences
CREATE TABLE IF NOT EXISTS employe_absences (
  id             BIGSERIAL PRIMARY KEY,
  employe_id     UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  type_absence   TEXT NOT NULL CHECK (type_absence IN ('maladie','vacances','absence','formation')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employe_id, date)
);

-- 4. Taux de travail et type de contrat dans utilisateurs
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS taux_travail  INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS type_contrat  TEXT DEFAULT 'fixe'
    CHECK (type_contrat IN ('fixe','auxiliaire','temps_partiel'));

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_ta_date   ON tournee_affectations (date);
CREATE INDEX IF NOT EXISTS idx_ta_emp    ON tournee_affectations (employe_id);
CREATE INDEX IF NOT EXISTS idx_abs_date  ON employe_absences (date);
CREATE INDEX IF NOT EXISTS idx_abs_emp   ON employe_absences (employe_id);
