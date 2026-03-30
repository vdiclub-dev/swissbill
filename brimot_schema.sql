-- ============================================================
--  BRIMOT NETTOYAGE — Schéma Supabase
--  Exécuter dans : https://supabase.com/dashboard/project/iubbsnntcreneakbdkmv/sql/new
-- ============================================================

-- ── Clients Brimot ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS brimot_clients (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         text NOT NULL,
    contact     text,
    email       text,
    telephone   text,
    adresse     text,
    ville       text,
    pays        text DEFAULT 'CH',
    num_tva     text,
    iban        text,
    notes       text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- ── Produits / Services ──────────────────────────────────
CREATE TABLE IF NOT EXISTS brimot_produits (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference   text,
    designation text NOT NULL,
    description text,
    prix_ht     numeric(10,2) DEFAULT 0,
    tva_pct     numeric(5,2)  DEFAULT 8.1,
    unite       text DEFAULT 'h',
    actif       boolean DEFAULT true,
    created_at  timestamptz DEFAULT now()
);

-- ── Factures & Devis ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS brimot_factures (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid REFERENCES brimot_clients(id) ON DELETE SET NULL,
    type            text DEFAULT 'facture' CHECK (type IN ('devis','facture')),
    statut          text DEFAULT 'facture' CHECK (statut IN ('devis','facture','payee','rappel','annulee')),
    numero          text UNIQUE,
    objet           text,
    date_facture    date DEFAULT CURRENT_DATE,
    echeance        date,
    conditions      text DEFAULT '30 jours net',
    tva_pct         numeric(5,2) DEFAULT 8.1,
    montant_ht      numeric(12,2) DEFAULT 0,
    montant_tva     numeric(12,2) DEFAULT 0,
    montant_ttc     numeric(12,2) DEFAULT 0,
    notes           text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- ── Lignes de facture ────────────────────────────────────
CREATE TABLE IF NOT EXISTS brimot_lignes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    facture_id  uuid REFERENCES brimot_factures(id) ON DELETE CASCADE,
    position    integer DEFAULT 1,
    designation text,
    qte         numeric(10,3) DEFAULT 1,
    prix_ht     numeric(10,2) DEFAULT 0,
    total_ht    numeric(12,2) DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

-- ── Index ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brimot_factures_client ON brimot_factures(client_id);
CREATE INDEX IF NOT EXISTS idx_brimot_factures_statut ON brimot_factures(statut);
CREATE INDEX IF NOT EXISTS idx_brimot_lignes_facture  ON brimot_lignes(facture_id);

-- ── RLS (Row Level Security) — accès admin uniquement ────
ALTER TABLE brimot_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brimot_produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE brimot_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE brimot_lignes   ENABLE ROW LEVEL SECURITY;

-- Politique : accès pour les rôles admin/super_admin uniquement
CREATE POLICY "brimot_admin_clients"  ON brimot_clients  FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

CREATE POLICY "brimot_admin_produits" ON brimot_produits FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

CREATE POLICY "brimot_admin_factures" ON brimot_factures FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

CREATE POLICY "brimot_admin_lignes"   ON brimot_lignes   FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

-- ── Données de démo (optionnel) ──────────────────────────
INSERT INTO brimot_produits (reference, designation, prix_ht, tva_pct, unite, description) VALUES
    ('NET-01', 'Nettoyage bureaux (heure)', 45.00, 8.1, 'h', 'Nettoyage standard des locaux de bureaux'),
    ('NET-02', 'Nettoyage vitrerie (m²)',   8.50,  8.1, 'm²','Lavage de vitres intérieur/extérieur'),
    ('NET-03', 'Traitement de sol',         3.20,  8.1, 'm²','Cristallisation, lustrage, protection'),
    ('NET-04', 'Nettoyage fin de chantier', 65.00, 8.1, 'h', 'Nettoyage après travaux'),
    ('NET-05', 'Forfait entretien mensuel', 380.00,8.1, 'forfait','Contrat entretien mensuel — 4 passages')
ON CONFLICT DO NOTHING;
