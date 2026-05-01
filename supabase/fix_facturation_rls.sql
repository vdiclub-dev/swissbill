-- ============================================================
-- FIX : RLS tables facturation (factures, facture_lignes,
--       transport_orders_simple update facture_id)
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- factures
DROP POLICY IF EXISTS "anon_all_factures"    ON public.factures;
DROP POLICY IF EXISTS "auth_all_factures"    ON public.factures;
DROP POLICY IF EXISTS "service_all_factures" ON public.factures;

CREATE POLICY "anon_all_factures"    ON public.factures FOR ALL TO anon         USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_factures"    ON public.factures FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_all_factures" ON public.factures FOR ALL TO service_role  USING (true) WITH CHECK (true);

-- facture_lignes
DROP POLICY IF EXISTS "anon_all_facture_lignes"    ON public.facture_lignes;
DROP POLICY IF EXISTS "auth_all_facture_lignes"    ON public.facture_lignes;
DROP POLICY IF EXISTS "service_all_facture_lignes" ON public.facture_lignes;

CREATE POLICY "anon_all_facture_lignes"    ON public.facture_lignes FOR ALL TO anon         USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_facture_lignes"    ON public.facture_lignes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_all_facture_lignes" ON public.facture_lignes FOR ALL TO service_role  USING (true) WITH CHECK (true);

-- Vérification
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('factures','facture_lignes')
ORDER BY tablename, policyname;
