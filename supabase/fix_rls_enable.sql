-- ============================================================
-- FIX : Active RLS sur toutes les tables qui ont des policies
--       mais RLS désactivé (74 issues CRITICAL dans Supabase Advisor)
--
-- ÉTAPE 1 : Exécutez d'abord la requête de diagnostic (section 0)
-- ÉTAPE 2 : Puis exécutez le DO block (section 1)
-- ============================================================

-- ── 0. DIAGNOSTIC : voir exactement quelles tables sont en cause ──
-- Exécutez cette requête seule pour voir la liste complète
SELECT
  t.tablename,
  t.rowsecurity AS rls_active,
  count(p.policyname) AS nb_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = FALSE
GROUP BY t.tablename, t.rowsecurity
HAVING count(p.policyname) > 0
ORDER BY t.tablename;

-- ── 1. FIX AUTOMATIQUE : active RLS sur toutes les tables concernées ──
DO $$
DECLARE
  r RECORD;
  sql TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT t.tablename
    FROM pg_tables t
    INNER JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
    WHERE t.schemaname = 'public'
      AND t.rowsecurity = FALSE
  LOOP
    sql := format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE sql;
    RAISE NOTICE 'RLS activé : %', r.tablename;
  END LOOP;
  RAISE NOTICE 'Terminé.';
END $$;

-- ── 2. Tables explicitement connues (filet de sécurité) ──────────
ALTER TABLE IF EXISTS public.entreprises                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.facture_lignes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.preuves_livraison            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.factures                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.livraisons                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tournees                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tournee_affectations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chauffeurs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chauffeur_depenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.driver_live_positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dispatch_tour_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rh_fiches_salaire            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rh_employe_parametres_salaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employe_absences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.demandes_inscription         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compta_comptes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compta_ecritures             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compta_ecritures_lignes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compta_journal_flux          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compta_solde_ouverture       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brimot_clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brimot_factures              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brimot_lignes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brimot_produits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mail_prospects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prospects                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devis                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devis_lignes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.offres                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.produits                     ENABLE ROW LEVEL SECURITY;

-- ── 3. Vérification : liste les tables encore sans RLS ──────────
SELECT
  schemaname,
  tablename,
  rowsecurity,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename) AS nb_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND rowsecurity = FALSE
ORDER BY tablename;
