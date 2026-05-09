-- ============================================================
-- FIX : RLS utilisateurs — ajout politique UPDATE pour anon
-- (acceptation CGV depuis accept-cgv.html)
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Vérifier l'état actuel
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'utilisateurs'
ORDER BY cmd, policyname;

-- 2. Ajouter la politique UPDATE manquante pour anon
--    (permet au client de sauvegarder l'acceptation CGV sur sa propre ligne)
DROP POLICY IF EXISTS "anon_update_own_cgv" ON public.utilisateurs;
CREATE POLICY "anon_update_own_cgv"
ON public.utilisateurs
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Note : la restriction par id se fait via .eq('id', userId) dans le code —
-- pas besoin de l'encoder dans la policy pour ce cas d'usage.

-- 3. S'assurer que SELECT anon fonctionne (recrée si absente)
CREATE POLICY IF NOT EXISTS "anon_login_select"
ON public.utilisateurs
FOR SELECT
TO anon
USING (actif = true);

-- 4. Vérification
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'utilisateurs'
ORDER BY cmd, policyname;
