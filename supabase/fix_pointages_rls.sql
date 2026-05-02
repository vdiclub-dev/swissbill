-- ============================================================
-- FIX : RLS pointages — chauffeurs (anon) peuvent sauvegarder
-- leurs heures quotidiennes
-- Exécuter dans Supabase SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "anon_pointages_select" ON public.pointages;
CREATE POLICY "anon_pointages_select"
ON public.pointages FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_pointages_insert" ON public.pointages;
CREATE POLICY "anon_pointages_insert"
ON public.pointages FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_pointages_update" ON public.pointages;
CREATE POLICY "anon_pointages_update"
ON public.pointages FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Vérification
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'pointages'
ORDER BY cmd, policyname;
