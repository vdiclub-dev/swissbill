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
    adresse     text,           -- Rue et numéro (ex: Route de Berne 14)
    npa         text,           -- Code postal (ex: 1010) — OBLIGATOIRE pour QR
    ville       text,           -- Ville (ex: Lausanne)   — OBLIGATOIRE pour QR
    pays        text DEFAULT 'CH',
    num_tva     text,
    iban        text,
    notes       text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);
-- Migration si la table existe déjà
ALTER TABLE brimot_clients ADD COLUMN IF NOT EXISTS npa  text;
ALTER TABLE brimot_clients ADD COLUMN IF NOT EXISTS pays text DEFAULT 'CH';

-- ── Produits / Services ──────────────────────────────────
CREATE TABLE IF NOT EXISTS brimot_produits (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference   text,
    designation text NOT NULL,
    description text,
    categorie   text,                          -- ex: "Nettoyage récurrent", "Ponctuel"
    prix_ht     numeric(10,2) DEFAULT 0,       -- prix de la 1ère variante (rétrocompat)
    tva_pct     numeric(5,2)  DEFAULT 0,       -- taux de la 1ère variante (rétrocompat)
    unite       text DEFAULT 'h',
    variantes   jsonb DEFAULT '[]'::jsonb,     -- [{ label, prix_ht, tva_pct }, …]
    actif       boolean DEFAULT true,
    created_at  timestamptz DEFAULT now()
);
-- Migration si la table existe déjà
ALTER TABLE brimot_produits ADD COLUMN IF NOT EXISTS categorie text;
ALTER TABLE brimot_produits ADD COLUMN IF NOT EXISTS variantes jsonb DEFAULT '[]'::jsonb;

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
INSERT INTO brimot_produits (reference, designation, categorie, prix_ht, tva_pct, unite, variantes, description) VALUES
    ('NET-REC', 'Nettoyage récurrent', 'Nettoyage récurrent', 0, 0, 'h',
     '[{"label":"30h","prix_ht":1350.00,"tva_pct":0},{"label":"38h","prix_ht":1710.00,"tva_pct":0},{"label":"38h avec TVA","prix_ht":1710.00,"tva_pct":8.1}]'::jsonb,
     'Contrat de nettoyage récurrent — forfait mensuel'),
    ('NET-01', 'Nettoyage bureaux',    'Nettoyage ponctuel',  45.00, 8.1, 'h',
     '[{"label":"Tarif horaire","prix_ht":45.00,"tva_pct":8.1}]'::jsonb,
     'Nettoyage standard des locaux de bureaux'),
    ('NET-02', 'Nettoyage vitrerie',   'Nettoyage ponctuel',   8.50, 8.1, 'm²',
     '[{"label":"Tarif m²","prix_ht":8.50,"tva_pct":8.1}]'::jsonb,
     'Lavage de vitres intérieur/extérieur'),
    ('NET-03', 'Traitement de sol',    'Prestations spéciales', 3.20, 8.1, 'm²',
     '[{"label":"Tarif m²","prix_ht":3.20,"tva_pct":8.1}]'::jsonb,
     'Cristallisation, lustrage, protection'),
    ('NET-04', 'Nettoyage fin de chantier', 'Prestations spéciales', 65.00, 8.1, 'h',
     '[{"label":"Tarif horaire","prix_ht":65.00,"tva_pct":8.1}]'::jsonb,
     'Nettoyage après travaux')
ON CONFLICT DO NOTHING;
