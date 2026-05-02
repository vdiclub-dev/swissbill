-- ============================================================
-- FIX : RLS rh_fiches_salaire
-- Exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE public.rh_fiches_salaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_fiches_sal_select" ON public.rh_fiches_salaire;
DROP POLICY IF EXISTS "anon_fiches_sal_insert" ON public.rh_fiches_salaire;
DROP POLICY IF EXISTS "anon_fiches_sal_update" ON public.rh_fiches_salaire;
DROP POLICY IF EXISTS "anon_fiches_sal_delete" ON public.rh_fiches_salaire;

CREATE POLICY "anon_fiches_sal_select" ON public.rh_fiches_salaire FOR SELECT TO anon USING (true);
CREATE POLICY "anon_fiches_sal_insert" ON public.rh_fiches_salaire FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_fiches_sal_update" ON public.rh_fiches_salaire FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_fiches_sal_delete" ON public.rh_fiches_salaire FOR DELETE TO anon USING (true);

-- Vérification
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rh_fiches_salaire'
ORDER BY cmd;
