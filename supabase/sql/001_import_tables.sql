-- ==================================================
-- COLIXO - TABLES D'IMPORTATION ET TARIFICATION
-- ==================================================
-- Exécuter dans l'éditeur SQL de Supabase
-- ==================================================

-- ==================================================
-- 001_IMPORT_TABLES.SQL
-- ==================================================

-- Table des profils d'importation par client
CREATE TABLE IF NOT EXISTS client_import_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    profile_name TEXT NOT NULL,
    file_type TEXT,
    delimiter TEXT,
    has_header BOOLEAN DEFAULT TRUE,
    column_mapping JSONB NOT NULL,
    default_values JSONB DEFAULT '{}'::JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par client
CREATE INDEX IF NOT EXISTS idx_client_import_profiles_client_id 
ON client_import_profiles(client_id);

-- Index pour trouver le profil actif
CREATE INDEX IF NOT EXISTS idx_client_import_profiles_active 
ON client_import_profiles(client_id, is_active) WHERE is_active = TRUE;

-- Table des lots d'importation
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    import_profile_id UUID REFERENCES client_import_profiles(id),
    file_name TEXT,
    file_type TEXT,
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    total_estimated_price_chf NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft',
    error_report JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index pour recherche par client
CREATE INDEX IF NOT EXISTS idx_import_batches_client_id 
ON import_batches(client_id);

-- Index pour statut
CREATE INDEX IF NOT EXISTS idx_import_batches_status 
ON import_batches(status);

-- Table des commandes de transport (orders)
-- Adapter selon votre schéma existant
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    external_reference TEXT NOT NULL,
    delivery_name TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_zip TEXT NOT NULL,
    delivery_city TEXT NOT NULL,
    delivery_phone TEXT,
    delivery_email TEXT,
    delivery_instructions TEXT,
    pickup_name TEXT,
    pickup_address TEXT,
    pickup_zip TEXT,
    pickup_city TEXT,
    parcel_count INTEGER NOT NULL DEFAULT 1,
    weight_kg NUMERIC,
    service_level TEXT,
    status TEXT DEFAULT 'pending',
    source_system TEXT DEFAULT 'client_import',
    import_batch_id UUID REFERENCES import_batches(id),
    tariff_rule_id UUID,
    unit_price_chf NUMERIC,
    total_price_chf NUMERIC,
    pricing_status TEXT DEFAULT 'calculated',
    pricing_details JSONB DEFAULT '{}'::JSONB,
    raw_import_data JSONB DEFAULT '{}'::JSONB,
    distance_km NUMERIC,
    estimated_duration_min NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte unique anti-doublon par client
    CONSTRAINT unique_client_reference UNIQUE (client_id, external_reference)
);

-- Index critiques pour performance
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_external_ref ON orders(external_reference);
CREATE INDEX IF NOT EXISTS idx_orders_client_ref ON orders(client_id, external_reference);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_import_batch ON orders(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_pricing_status ON orders(pricing_status);

-- ==================================================
-- 002_TARIFF_RULES.SQL
-- ==================================================

-- Table des règles tarifaires par client
CREATE TABLE IF NOT EXISTS client_tariff_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    name TEXT NOT NULL,
    service_level TEXT,
    min_weight_kg NUMERIC,
    max_weight_kg NUMERIC,
    min_parcel_count INTEGER,
    max_parcel_count INTEGER,
    base_price_chf NUMERIC NOT NULL DEFAULT 0,
    price_per_parcel_chf NUMERIC DEFAULT 0,
    price_per_kg_chf NUMERIC DEFAULT 0,
    price_per_km_chf NUMERIC DEFAULT 0,
    included_km NUMERIC DEFAULT 0,
    extra_km_price_chf NUMERIC DEFAULT 0,
    night_surcharge_chf NUMERIC DEFAULT 0,
    urgent_surcharge_chf NUMERIC DEFAULT 0,
    floor_surcharge_chf NUMERIC DEFAULT 0,
    fuel_surcharge_percent NUMERIC DEFAULT 0,
    discount_percent NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide des règles actives par client
CREATE INDEX IF NOT EXISTS idx_client_tariff_rules_client_active 
ON client_tariff_rules(client_id, is_active) WHERE is_active = TRUE;

-- Index pour tri par priorité
CREATE INDEX IF NOT EXISTS idx_client_tariff_rules_priority 
ON client_tariff_rules(client_id, priority);

-- ==================================================
-- EXEMPLE DE DONNÉES TARIFAIRES (à adapter)
-- ==================================================

-- Exemple: Grille tarifaire pour un client test
-- À supprimer ou adapter en production
/*
INSERT INTO client_tariff_rules (client_id, name, service_level, min_weight_kg, max_weight_kg, base_price_chf, price_per_parcel_chf, fuel_surcharge_percent, priority)
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'Eco 0-2kg', 'eco_48h', 0, 2, 7.50, 1.00, 2, 100),
    ('00000000-0000-0000-0000-000000000000', 'Eco 2-10kg', 'eco_48h', 2, 10, 9.00, 1.00, 2, 100),
    ('00000000-0000-0000-0000-000000000000', 'Eco 10-30kg', 'eco_48h', 10, 30, 18.00, 1.00, 2, 100),
    ('00000000-0000-0000-0000-000000000000', 'Priority 0-2kg', 'priority_24h', 0, 2, 8.50, 1.00, 2, 100),
    ('00000000-0000-0000-0000-000000000000', 'Priority 2-10kg', 'priority_24h', 2, 10, 10.00, 1.00, 2, 100);
*/

-- ==================================================
-- 003_RLS_IMPORTS.SQL
-- ==================================================

-- Activer RLS sur toutes les tables
ALTER TABLE client_import_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tariff_rules ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- POLICIES CLIENT_IMPORT_PROFILES
-- ==================================================

-- Un client peut lire ses propres profils
CREATE POLICY "Clients can view own import profiles"
ON client_import_profiles FOR SELECT
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut créer ses propres profils
CREATE POLICY "Clients can create own import profiles"
ON client_import_profiles FOR INSERT
WITH CHECK (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut modifier ses propres profils
CREATE POLICY "Clients can update own import profiles"
ON client_import_profiles FOR UPDATE
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut supprimer ses propres profils
CREATE POLICY "Clients can delete own import profiles"
ON client_import_profiles FOR DELETE
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- ==================================================
-- POLICIES IMPORT_BATCHES
-- ==================================================

-- Un client peut lire ses propres lots d'import
CREATE POLICY "Clients can view own import batches"
ON import_batches FOR SELECT
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut créer ses propres lots d'import
CREATE POLICY "Clients can create own import batches"
ON import_batches FOR INSERT
WITH CHECK (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut modifier ses propres lots d'import
CREATE POLICY "Clients can update own import batches"
ON import_batches FOR UPDATE
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- ==================================================
-- POLICIES ORDERS
-- ==================================================

-- Un client peut lire ses propres commandes
CREATE POLICY "Clients can view own orders"
ON orders FOR SELECT
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut créer ses propres commandes
CREATE POLICY "Clients can create own orders"
ON orders FOR INSERT
WITH CHECK (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- Un client peut modifier ses propres commandes (si nécessaire)
CREATE POLICY "Clients can update own orders"
ON orders FOR UPDATE
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- ==================================================
-- POLICIES CLIENT_TARIFF_RULES
-- ==================================================

-- Un client peut lire ses propres règles tarifaires
CREATE POLICY "Clients can view own tariff rules"
ON client_tariff_rules FOR SELECT
USING (
    client_id = (
        SELECT id FROM clients 
        WHERE user_id = auth.uid() 
        LIMIT 1
    )
);

-- SEUL admin Colixo peut créer/modifier les règles tarifaires
-- (à adapter selon votre système de rôles)
CREATE POLICY "Admins can manage tariff rules"
ON client_tariff_rules FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.email LIKE '%@colixo.ch'
    )
);

-- ==================================================
-- FONCTION UTILITAIRE: Vérifier les doublons avant import
-- ==================================================

CREATE OR REPLACE FUNCTION check_duplicate_references(
    p_client_id UUID,
    p_references TEXT[]
)
RETURNS TABLE(reference TEXT, exists BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        unnest(p_references) AS reference,
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.client_id = p_client_id 
            AND o.external_reference = unnest(p_references)
        ) AS exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- TRIGGER: Mise à jour automatique updated_at
-- ==================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables concernées
DROP TRIGGER IF EXISTS update_client_import_profiles_updated_at ON client_import_profiles;
CREATE TRIGGER update_client_import_profiles_updated_at
    BEFORE UPDATE ON client_import_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_tariff_rules_updated_at ON client_tariff_rules;
CREATE TRIGGER update_client_tariff_rules_updated_at
    BEFORE UPDATE ON client_tariff_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================================================
-- FIN DU SCRIPT SQL
-- ==================================================
