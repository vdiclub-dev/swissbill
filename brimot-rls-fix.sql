-- ============================================================
--  brimot-rls-fix.sql — Politiques RLS pour les tables Brimot
--  Exécutez dans Supabase > SQL Editor
-- ============================================================

-- Activer RLS et autoriser accès complet (anon + authenticated)
ALTER TABLE brimot_factures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brimot_clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brimot_produits  ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "acces_total_brimot_factures" ON brimot_factures;
DROP POLICY IF EXISTS "acces_total_brimot_clients"  ON brimot_clients;
DROP POLICY IF EXISTS "acces_total_brimot_produits" ON brimot_produits;

-- Créer les nouvelles politiques permissives
CREATE POLICY "acces_total_brimot_factures"
  ON brimot_factures FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "acces_total_brimot_clients"
  ON brimot_clients FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "acces_total_brimot_produits"
  ON brimot_produits FOR ALL
  USING (true) WITH CHECK (true);

-- Table brimot_facture_lignes si elle existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'brimot_facture_lignes') THEN
    EXECUTE 'ALTER TABLE brimot_facture_lignes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "acces_total_brimot_lignes" ON brimot_facture_lignes';
    EXECUTE 'CREATE POLICY "acces_total_brimot_lignes" ON brimot_facture_lignes FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Aussi pour utilisateurs (lecture par id pour init())
DROP POLICY IF EXISTS "acces_lecture_utilisateurs" ON utilisateurs;
CREATE POLICY "acces_lecture_utilisateurs"
  ON utilisateurs FOR SELECT
  USING (true);
