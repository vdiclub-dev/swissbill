-- Code métier libre par utilisateur (réf. interne, badge, etc.)
-- Exécuter dans Supabase → SQL Editor

ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS code text;

COMMENT ON COLUMN public.utilisateurs.code IS 'Code / référence interne optionnelle';
