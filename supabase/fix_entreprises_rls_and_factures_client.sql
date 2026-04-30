-- ============================================================
-- FIX : entreprises RLS + colonne client_nom dans factures
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Politique lecture sur entreprises pour les utilisateurs authentifiés
DROP POLICY IF EXISTS "auth_read_entreprises" ON public.entreprises;
CREATE POLICY "auth_read_entreprises"
ON public.entreprises
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "service_all_entreprises" ON public.entreprises;
CREATE POLICY "service_all_entreprises"
ON public.entreprises
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Ajouter colonne client_nom dans factures (si pas déjà là)
ALTER TABLE public.factures
    ADD COLUMN IF NOT EXISTS client_nom text;

-- 3. Backfill : remplir client_nom pour les factures existantes
UPDATE public.factures f
SET client_nom = e.nom
FROM public.entreprises e
WHERE f.entreprise_id = e.id
  AND f.client_nom IS NULL;

-- 4. Vérification
SELECT f.numero, f.client_nom, f.entreprise_id, e.nom AS entreprise_nom
FROM public.factures f
LEFT JOIN public.entreprises e ON e.id = f.entreprise_id
ORDER BY f.created_at DESC
LIMIT 10;
