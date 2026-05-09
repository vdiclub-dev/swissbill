-- ============================================================
-- FIX : RLS table vehicules (et tables finances liées)
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- Véhicules
DROP POLICY IF EXISTS "anon_all_vehicules"    ON public.vehicules;
DROP POLICY IF EXISTS "auth_all_vehicules"    ON public.vehicules;
DROP POLICY IF EXISTS "service_all_vehicules" ON public.vehicules;

CREATE POLICY "anon_all_vehicules"
ON public.vehicules FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "service_all_vehicules"
ON public.vehicules FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Frais véhicules
DROP POLICY IF EXISTS "anon_all_vehicule_frais"    ON public.vehicule_frais;
DROP POLICY IF EXISTS "service_all_vehicule_frais" ON public.vehicule_frais;

CREATE POLICY "anon_all_vehicule_frais"
ON public.vehicule_frais FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "service_all_vehicule_frais"
ON public.vehicule_frais FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Km véhicules
DROP POLICY IF EXISTS "anon_all_vehicule_km"    ON public.vehicule_km;
DROP POLICY IF EXISTS "service_all_vehicule_km" ON public.vehicule_km;

CREATE POLICY "anon_all_vehicule_km"
ON public.vehicule_km FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "service_all_vehicule_km"
ON public.vehicule_km FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Vérification
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('vehicules','vehicule_frais','vehicule_km')
ORDER BY tablename, policyname;
