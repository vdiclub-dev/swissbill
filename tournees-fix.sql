-- ============================================================
--  tournees-fix.sql — Correction tables tournées + droits RLS
--  Exécutez dans Supabase > SQL Editor
-- ============================================================

-- 1. Supprime tout avec CASCADE
DROP TABLE IF EXISTS tournee_affectations CASCADE;
DROP TABLE IF EXISTS tournee_arrets CASCADE;
DROP TABLE IF EXISTS tournees CASCADE;

-- 2. Recrée les tables
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

-- 3. Droits RLS — autoriser la clé anon à tout faire sur ces tables
ALTER TABLE tournees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournee_affectations ENABLE ROW LEVEL SECURITY;

-- Politique : accès complet pour anon et authenticated
DROP POLICY IF EXISTS "acces_total_tournees" ON tournees;
CREATE POLICY "acces_total_tournees"
  ON tournees FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acces_total_affectations" ON tournee_affectations;
CREATE POLICY "acces_total_affectations"
  ON tournee_affectations FOR ALL
  USING (true) WITH CHECK (true);

-- Table absences (si pas encore créée)
CREATE TABLE IF NOT EXISTS employe_absences (
  id             BIGSERIAL PRIMARY KEY,
  employe_id     UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  type_absence   TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employe_id, date)
);

ALTER TABLE employe_absences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acces_total_absences" ON employe_absences;
CREATE POLICY "acces_total_absences"
  ON employe_absences FOR ALL
  USING (true) WITH CHECK (true);

-- Colonnes taux/contrat dans utilisateurs
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS taux_travail INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS type_contrat TEXT DEFAULT 'fixe';
