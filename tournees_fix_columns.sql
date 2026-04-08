-- ============================================================
--  Colonnes manquantes : public.tournees
--  Erreur typique : column tournees.heure_debut does not exist
--  Supabase → SQL Editor → Run (une fois)
-- ============================================================
-- Si la table n’existe pas : exécuter tournees.sql en entier à la place.

ALTER TABLE public.tournees
  ADD COLUMN IF NOT EXISTS nom          TEXT DEFAULT 'Tournée',
  ADD COLUMN IF NOT EXISTS heure_debut  TIME DEFAULT TIME '07:00',
  ADD COLUMN IF NOT EXISTS heure_fin    TIME DEFAULT TIME '18:00',
  ADD COLUMN IF NOT EXISTS zone         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle      TEXT,
  ADD COLUMN IF NOT EXISTS jours        INTEGER[] DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS couleur      TEXT DEFAULT '#4f8ef7',
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();

UPDATE public.tournees SET nom = COALESCE(NULLIF(TRIM(nom), ''), 'Tournée') WHERE nom IS NULL;
UPDATE public.tournees SET heure_debut = COALESCE(heure_debut, TIME '07:00') WHERE heure_debut IS NULL;
UPDATE public.tournees SET heure_fin   = COALESCE(heure_fin, TIME '18:00') WHERE heure_fin IS NULL;

ALTER TABLE public.tournees ALTER COLUMN nom SET NOT NULL;
ALTER TABLE public.tournees ALTER COLUMN heure_debut SET NOT NULL;
ALTER TABLE public.tournees ALTER COLUMN heure_fin SET NOT NULL;
