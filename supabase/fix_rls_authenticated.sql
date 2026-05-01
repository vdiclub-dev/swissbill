-- ============================================================
-- FIX : Policies RLS pour le rôle authenticated
-- Les chauffeurs connectés via email/password utilisent ce rôle
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- transport_orders_simple
DROP POLICY IF EXISTS "auth_all_transport_orders_simple" ON public.transport_orders_simple;
CREATE POLICY "auth_all_transport_orders_simple"
ON public.transport_orders_simple FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- deliveries
DROP POLICY IF EXISTS "auth_all_deliveries" ON public.deliveries;
CREATE POLICY "auth_all_deliveries"
ON public.deliveries FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- vehicule_km
DROP POLICY IF EXISTS "auth_all_vehicule_km" ON public.vehicule_km;
CREATE POLICY "auth_all_vehicule_km"
ON public.vehicule_km FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- vehicules
DROP POLICY IF EXISTS "auth_all_vehicules" ON public.vehicules;
CREATE POLICY "auth_all_vehicules"
ON public.vehicules FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- vehicule_frais
DROP POLICY IF EXISTS "auth_all_vehicule_frais" ON public.vehicule_frais;
CREATE POLICY "auth_all_vehicule_frais"
ON public.vehicule_frais FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- utilisateurs
DROP POLICY IF EXISTS "auth_all_utilisateurs" ON public.utilisateurs;
CREATE POLICY "auth_all_utilisateurs"
ON public.utilisateurs FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- pointages
DROP POLICY IF EXISTS "auth_all_pointages" ON public.pointages;
CREATE POLICY "auth_all_pointages"
ON public.pointages FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- chauffeur_depenses
DROP POLICY IF EXISTS "auth_all_chauffeur_depenses" ON public.chauffeur_depenses;
CREATE POLICY "auth_all_chauffeur_depenses"
ON public.chauffeur_depenses FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- driver_live_positions
DROP POLICY IF EXISTS "auth_all_driver_live_positions" ON public.driver_live_positions;
CREATE POLICY "auth_all_driver_live_positions"
ON public.driver_live_positions FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "auth_all_notifications" ON public.notifications;
CREATE POLICY "auth_all_notifications"
ON public.notifications FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- tournees
DROP POLICY IF EXISTS "auth_all_tournees" ON public.tournees;
CREATE POLICY "auth_all_tournees"
ON public.tournees FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Vérification
SELECT tablename, count(*) as nb_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> ARRAY['authenticated']::name[]
GROUP BY tablename
ORDER BY tablename;
