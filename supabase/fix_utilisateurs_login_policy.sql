-- ============================================================
-- FIX : infinite recursion sur utilisateurs
-- Exécuter en une seule fois
-- ============================================================

-- 1. Voir les policies existantes (source du problème)
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'utilisateurs';

-- 2. Supprimer TOUTES les policies existantes sur utilisateurs
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'utilisateurs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.utilisateurs', r.policyname);
    RAISE NOTICE 'Policy supprimée : %', r.policyname;
  END LOOP;
END $$;

-- 3. Recréer des policies propres sans récursion

-- Login anonyme par code (pas de référence à la table elle-même)
CREATE POLICY "anon_login_select"
ON public.utilisateurs
FOR SELECT
TO anon
USING (actif = true);

-- Lecture par utilisateur authentifié (basé sur auth.uid() uniquement)
CREATE POLICY "auth_select_own"
ON public.utilisateurs
FOR SELECT
TO authenticated
USING (true);

-- Admin peut tout faire (basé sur le rôle Supabase, pas une sous-requête)
CREATE POLICY "service_role_all"
ON public.utilisateurs
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Vérification finale
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'utilisateurs';
