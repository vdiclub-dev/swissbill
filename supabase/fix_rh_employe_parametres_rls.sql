-- ============================================================
-- FIX : RLS rh_employe_parametres_salaire
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- Activer RLS si pas encore fait
ALTER TABLE public.rh_employe_parametres_salaire ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "anon_emp_params_select" ON public.rh_employe_parametres_salaire;
DROP POLICY IF EXISTS "anon_emp_params_insert" ON public.rh_employe_parametres_salaire;
DROP POLICY IF EXISTS "anon_emp_params_update" ON public.rh_employe_parametres_salaire;
DROP POLICY IF EXISTS "anon_emp_params_delete" ON public.rh_employe_parametres_salaire;

-- Accès complet pour anon (admin connecté par code)
CREATE POLICY "anon_emp_params_select" ON public.rh_employe_parametres_salaire FOR SELECT TO anon USING (true);
CREATE POLICY "anon_emp_params_insert" ON public.rh_employe_parametres_salaire FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_emp_params_update" ON public.rh_employe_parametres_salaire FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_emp_params_delete" ON public.rh_employe_parametres_salaire FOR DELETE TO anon USING (true);

-- Vérification
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rh_employe_parametres_salaire'
ORDER BY cmd;
