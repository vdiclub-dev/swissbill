-- ============================================================
-- COLIXO PROSPECTING — Migration v2
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- Nouveaux champs scoring détaillé
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS score_pertinence_secteur       integer default 0,
  ADD COLUMN IF NOT EXISTS score_besoin_logistique        integer default 0,
  ADD COLUMN IF NOT EXISTS score_compatibilite_geo        integer default 0,
  ADD COLUMN IF NOT EXISTS score_potentiel_volume         integer default 0,
  ADD COLUMN IF NOT EXISTS score_probabilite_reponse      integer default 0,
  ADD COLUMN IF NOT EXISTS score_complexite_op            integer default 0,
  ADD COLUMN IF NOT EXISTS score_fit_colixo               integer default 0,
  ADD COLUMN IF NOT EXISTS score_reasoning                text,
  ADD COLUMN IF NOT EXISTS logistic_signals               jsonb default '[]',
  ADD COLUMN IF NOT EXISTS confidence_score               integer default 0,
  ADD COLUMN IF NOT EXISTS analysis_quality               text,
  ADD COLUMN IF NOT EXISTS message_connexion_premium      text,
  ADD COLUMN IF NOT EXISTS enriched_at                    timestamptz;

-- Mise à jour contrainte statuts (supprimer ancienne si existante)
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_statut_check;
ALTER TABLE prospects
  ADD CONSTRAINT prospects_statut_check CHECK (statut IN (
    'nouveau','a_qualifier','qualifie','pret_a_contacter',
    'contacte','relance_1_envoyee','relance_2_envoyee','repondu',
    'rdv_planifie','opportunite','client_gagne','perdu','sans_suite'
  ));

-- Mettre à jour les anciens statuts si présents
UPDATE prospects SET statut = 'nouveau'          WHERE statut = 'a_contacter';
UPDATE prospects SET statut = 'a_qualifier'      WHERE statut = 'analyse_en_cours';
UPDATE prospects SET statut = 'contacte'         WHERE statut = 'contact_envoye';
UPDATE prospects SET statut = 'contacte'         WHERE statut = 'en_attente';
UPDATE prospects SET statut = 'relance_1_envoyee' WHERE statut = 'relance_a_faire';
UPDATE prospects SET statut = 'rdv_planifie'     WHERE statut = 'rdv';

-- Nouveaux champs analyse réponse
ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS sentiment             text,
  ADD COLUMN IF NOT EXISTS buying_signal_level   integer default 0,
  ADD COLUMN IF NOT EXISTS urgency_level         integer default 0,
  ADD COLUMN IF NOT EXISTS recommended_channel   text,
  ADD COLUMN IF NOT EXISTS next_best_action      text;

-- event_payload pour journal enrichi
ALTER TABLE prospect_events
  ADD COLUMN IF NOT EXISTS event_payload jsonb;

-- Trigger updated_at (recrée proprement)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospects_updated_at ON prospects;
CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index performances
CREATE INDEX IF NOT EXISTS idx_prospects_statut   ON prospects(statut);
CREATE INDEX IF NOT EXISTS idx_prospects_score    ON prospects(score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_classe   ON prospects(score_classe);
CREATE INDEX IF NOT EXISTS idx_prospects_nom      ON prospects(lower(entreprise));
CREATE INDEX IF NOT EXISTS idx_prospects_email    ON prospects(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_prospect    ON prospect_events(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_prospect     ON prospect_tasks(prospect_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due          ON prospect_tasks(due_date) WHERE status = 'pending';

-- RLS désactivé (usage admin uniquement)
ALTER TABLE prospects       DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_tasks  DISABLE ROW LEVEL SECURITY;
ALTER TABLE replies         DISABLE ROW LEVEL SECURITY;

-- Refresh cache PostgREST
NOTIFY pgrst, 'reload schema';
