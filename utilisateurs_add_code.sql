-- Code métier libre par utilisateur (réf. interne, badge, etc.)
-- Exécuter dans Supabase → SQL Editor

ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS code text;

COMMENT ON COLUMN public.utilisateurs.code IS 'Code / référence interne optionnelle';

-- Optionnel : si des profils ont déjà `code` mais pas `code_usr` (connexion / badge)
-- UPDATE public.utilisateurs SET code_usr = code WHERE code IS NOT NULL AND (code_usr IS NULL OR trim(code_usr) = '');
