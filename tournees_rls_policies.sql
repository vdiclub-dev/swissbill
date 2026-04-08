-- Voir aussi tournees_rpc_affectation.sql (fonction SECURITY DEFINER, recommandé si FK persiste).
-- ============================================================
--  Tournées + affectations — politiques RLS si FK / INSERT échouent
--  L’app Colixo utilise la clé anon : les requêtes passent en rôle anon.
--  Si RLS est activé sans politique pour anon, les INSERT dans tournees
--  peuvent échouer ou l’affectation peut référencer une ligne invisible.
--  Exécutez dans Supabase → SQL Editor (une seule fois, adaptez si besoin).
-- ============================================================

ALTER TABLE public.tournees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournee_affectations ENABLE ROW LEVEL SECURITY;

-- Lecture / écriture pour tout utilisateur authentifié Supabase Auth (JWT)
DROP POLICY IF EXISTS "tournees_authenticated_all" ON public.tournees;
CREATE POLICY "tournees_authenticated_all" ON public.tournees
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tournee_affect_authenticated_all" ON public.tournee_affectations;
CREATE POLICY "tournee_affect_authenticated_all" ON public.tournee_affectations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Clé anon (SPA statique sans session Supabase Auth) : à restreindre en prod si vous ajoutez une auth serveur
DROP POLICY IF EXISTS "tournees_anon_all" ON public.tournees;
CREATE POLICY "tournees_anon_all" ON public.tournees
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tournee_affect_anon_all" ON public.tournee_affectations;
CREATE POLICY "tournee_affect_anon_all" ON public.tournee_affectations
  FOR ALL TO anon
  USING (true) WITH CHECK (true);
