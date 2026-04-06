-- ============================================================
--  COMPTABILITÉ GÉNÉRALE — Partie double, plan comptable, bilan & CR
--  Multi-entité : Colixo / Brimot
--  Exécuter dans : Supabase → SQL Editor
--
--  Plan suisse PME : le Kontenrahmen KMU officiel est un PDF gratuit
--  (SECO / kmu.admin.ch). Un extrait importable est fourni dans
--  admin/swiss-kmu-kontenplan.json (bouton « Importer extrait KMU »).
-- ============================================================

-- ── Plan comptable (par société) ────────────────────────────
CREATE TABLE IF NOT EXISTS compta_comptes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entite          text NOT NULL CHECK (entite IN ('colixo','brimot')),
    code            text NOT NULL,
    libelle         text NOT NULL,
    classe          text NOT NULL CHECK (classe IN ('actif','passif','capitaux_propres','charge','produit')),
    nature_solde    text NOT NULL CHECK (nature_solde IN ('debit','credit')),
    actif           boolean NOT NULL DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    UNIQUE (entite, code)
);

COMMENT ON TABLE compta_comptes IS 'Plan comptable : nature débit = actif/charges ; nature crédit = passif/capitaux/produits.';
COMMENT ON COLUMN compta_comptes.nature_solde IS 'debit : solde = ouverture + débits - crédits. credit : solde = ouverture + crédits - débits.';

CREATE INDEX IF NOT EXISTS idx_compta_comptes_entite ON compta_comptes(entite);

-- ── Écritures (en-tête) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS compta_ecritures (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entite          text NOT NULL CHECK (entite IN ('colixo','brimot')),
    date_ecriture   date NOT NULL,
    libelle         text NOT NULL,
    piece_ref       text,
    created_at      timestamptz DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compta_ecr_entite_date ON compta_ecritures(entite, date_ecriture DESC);

-- ── Lignes d''écriture ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS compta_ecritures_lignes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ecriture_id     uuid NOT NULL REFERENCES compta_ecritures(id) ON DELETE CASCADE,
    compte_id       uuid NOT NULL REFERENCES compta_comptes(id) ON DELETE RESTRICT,
    libelle         text,
    debit           numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit          numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    CHECK ( (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) )
);

CREATE INDEX IF NOT EXISTS idx_compta_lignes_ecriture ON compta_ecritures_lignes(ecriture_id);
CREATE INDEX IF NOT EXISTS idx_compta_lignes_compte ON compta_ecritures_lignes(compte_id);

-- ── Soldes d''ouverture (1er janvier exercice) ──────────────
CREATE TABLE IF NOT EXISTS compta_solde_ouverture (
    compte_id       uuid NOT NULL REFERENCES compta_comptes(id) ON DELETE CASCADE,
    exercice        integer NOT NULL,
    ouverture_solde numeric(14,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (compte_id, exercice)
);

COMMENT ON COLUMN compta_solde_ouverture.ouverture_solde IS 'Montant positif = côté normal du compte (débit pour nature débit, crédit pour nature crédit).';

-- ── RLS (admin / super_admin) ───────────────────────────────
ALTER TABLE compta_comptes ENABLE ROW LEVEL SECURITY;
ALTER TABLE compta_ecritures ENABLE ROW LEVEL SECURITY;
ALTER TABLE compta_ecritures_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE compta_solde_ouverture ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compta_comptes_admin" ON compta_comptes;
CREATE POLICY "compta_comptes_admin" ON compta_comptes
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

DROP POLICY IF EXISTS "compta_ecritures_admin" ON compta_ecritures;
CREATE POLICY "compta_ecritures_admin" ON compta_ecritures
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

DROP POLICY IF EXISTS "compta_ecritures_lignes_admin" ON compta_ecritures_lignes;
CREATE POLICY "compta_ecritures_lignes_admin" ON compta_ecritures_lignes
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

DROP POLICY IF EXISTS "compta_solde_ouverture_admin" ON compta_solde_ouverture;
CREATE POLICY "compta_solde_ouverture_admin" ON compta_solde_ouverture
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));

-- ── Plan minimal (Colixo + Brimot) — idempotent ───────────────
INSERT INTO compta_comptes (entite, code, libelle, classe, nature_solde)
SELECT e.ent, v.code, v.lib, v.classe, v.nat
FROM (VALUES
    ('colixo'::text), ('brimot'::text)
) AS e(ent)
CROSS JOIN (VALUES
    ('1000','Caisse / petite caisse','actif','debit'),
    ('1100','Banque','actif','debit'),
    ('1200','Créances clients','actif','debit'),
    ('1500','Immobilisations corporelles','actif','debit'),
    ('2000','Dettes fournisseurs','passif','credit'),
    ('2200','TVA due','passif','credit'),
    ('2800','Capital social / apports','capitaux_propres','credit'),
    ('2900','Résultat reporté / bénéfice non affecté','capitaux_propres','credit'),
    ('3200','Ventes de prestations','produit','credit'),
    ('6000','Charges d''exploitation','charge','debit'),
    ('6500','Charges personnel','charge','debit'),
    ('6900','Charges financières','charge','debit')
) AS v(code, lib, classe, nat)
WHERE NOT EXISTS (
    SELECT 1 FROM compta_comptes c WHERE c.entite = e.ent AND c.code = v.code
);
