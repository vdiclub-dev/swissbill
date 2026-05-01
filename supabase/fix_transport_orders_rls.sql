-- ============================================================
-- FIX : RLS table transport_orders_simple + deliveries
-- Exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE public.transport_orders_simple ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_transport_orders_simple"    ON public.transport_orders_simple;
DROP POLICY IF EXISTS "service_all_transport_orders_simple" ON public.transport_orders_simple;

CREATE POLICY "anon_all_transport_orders_simple"
ON public.transport_orders_simple FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "service_all_transport_orders_simple"
ON public.transport_orders_simple FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- deliveries (preuve de livraison)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_deliveries"    ON public.deliveries;
DROP POLICY IF EXISTS "service_all_deliveries" ON public.deliveries;

CREATE POLICY "anon_all_deliveries"
ON public.deliveries FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "service_all_deliveries"
ON public.deliveries FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Vérification
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('transport_orders_simple','deliveries')
ORDER BY tablename, policyname;
