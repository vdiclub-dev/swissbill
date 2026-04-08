-- ============================================================
--  Colonnes manquantes : public.tournees
--  Erreur typique : column tournees.heure_debut does not exist
--  Erreur 23502 : null value in column "numero_tournee" → exécuter le bloc numero_tournee ci-dessous
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

-- Numéro d’ordre (l’app Colixo l’envoie ; NOT NULL en base)
-- Si numero_tournee existe déjà en TEXT, ne pas recréer : on remplit puis on caste en INTEGER.
ALTER TABLE public.tournees ADD COLUMN IF NOT EXISTS numero_tournee INTEGER;
UPDATE public.tournees AS t SET numero_tournee = s.n
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY heure_debut NULLS LAST, nom) AS n FROM public.tournees
) AS s
WHERE t.id = s.id
  AND (
    t.numero_tournee IS NULL
    OR NULLIF(btrim(t.numero_tournee::text), '') IS NULL
    OR NOT (btrim(t.numero_tournee::text) ~ '^[0-9]+$')
    OR btrim(t.numero_tournee::text)::integer < 1
  );
-- Passage TEXT / varchar → INTEGER si la colonne n’était pas encore entière
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tournees'
      AND column_name = 'numero_tournee'
      AND data_type NOT IN ('smallint', 'integer', 'bigint')
  ) THEN
    ALTER TABLE public.tournees
      ALTER COLUMN numero_tournee TYPE integer
      USING CASE
        WHEN NULLIF(btrim(numero_tournee::text), '') IS NULL THEN 1
        WHEN btrim(numero_tournee::text) ~ '^[0-9]+$' THEN btrim(numero_tournee::text)::integer
        ELSE 1
      END;
  END IF;
END $$;
ALTER TABLE public.tournees ALTER COLUMN numero_tournee SET DEFAULT 1;
ALTER TABLE public.tournees ALTER COLUMN numero_tournee SET NOT NULL;
