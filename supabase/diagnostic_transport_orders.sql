-- ============================================================
-- DIAGNOSTIC : transport_orders_simple
-- Exécuter dans Supabase SQL Editor pour trouver pourquoi
-- les updates ne persistent pas
-- ============================================================

-- 1. Triggers sur la table
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'transport_orders_simple'
  AND event_object_schema = 'public';

-- 2. Policies RLS actives
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'transport_orders_simple';

-- 3. RLS activé ?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'transport_orders_simple';

-- 4. Test direct : changer le statut d'une commande existante
-- (remplacer <ID> par un vrai ID visible dans l'app)
-- UPDATE public.transport_orders_simple SET status = 'in_transit' WHERE id = '<ID>' RETURNING id, status;
