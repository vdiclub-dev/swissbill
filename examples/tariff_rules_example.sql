-- ==================================================
-- COLIXO - EXEMPLE DE GRILLE TARIFAIRE CLIENT
-- ==================================================
-- Exécuter dans l'éditeur SQL de Supabase
-- Remplacer 'VOTRE_CLIENT_ID' par l'UUID réel du client
-- ==================================================

-- ==================================================
-- EXEMPLE 1: Client HGC Cortaillod
-- Grille tarifaire complète avec tranches de poids
-- ==================================================

-- Tranche Eco 48h: 0-2 kg
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',  -- Remplacer par l'UUID du client
    'HGC Eco 0-2kg',
    'eco_48h',
    0,
    2,
    7.50,
    1.00,
    2.0,
    100
);

-- Tranche Eco 48h: 2-10 kg
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'HGC Eco 2-10kg',
    'eco_48h',
    2,
    10,
    9.00,
    1.00,
    2.0,
    100
);

-- Tranche Eco 48h: 10-30 kg
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'HGC Eco 10-30kg',
    'eco_48h',
    10,
    30,
    18.00,
    1.00,
    2.0,
    100
);

-- Tranche Priority 24h: 0-2 kg (Eco + 1 CHF)
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'HGC Priority 0-2kg',
    'priority_24h',
    0,
    2,
    8.50,
    1.00,
    2.0,
    100
);

-- Tranche Priority 24h: 2-10 kg
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'HGC Priority 2-10kg',
    'priority_24h',
    2,
    10,
    10.00,
    1.00,
    2.0,
    100
);

-- Tranche Priority 24h: 10-30 kg
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'HGC Priority 10-30kg',
    'priority_24h',
    10,
    30,
    19.00,
    1.00,
    2.0,
    100
);

-- ==================================================
-- EXEMPLE 2: Client avec tarification kilométrique
-- ==================================================

-- Tarif de base avec kilomètres inclus
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    price_per_km_chf,
    included_km,
    extra_km_price_chf,
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'Tarif Local 0-5km',
    'eco_48h',
    0,
    30,
    12.00,
    0.50,
    0.00,
    5,
    1.50,
    2.0,
    100
);

-- ==================================================
-- EXEMPLE 3: Client avec rabais volume
-- ==================================================

-- Tarif avec rabais de 5%
INSERT INTO client_tariff_rules (
    client_id, 
    name, 
    service_level, 
    min_weight_kg, 
    max_weight_kg, 
    base_price_chf, 
    price_per_parcel_chf, 
    discount_percent,
    fuel_surcharge_percent, 
    priority
) VALUES (
    'VOTRE_CLIENT_ID',
    'Tarif Partenaire -5%',
    'eco_48h',
    0,
    30,
    10.00,
    1.00,
    5.0,
    2.0,
    100
);

-- ==================================================
-- VÉRIFICATION DES RÈGLES CRÉÉES
-- ==================================================

-- Voir toutes les règles d'un client
SELECT 
    name,
    service_level,
    min_weight_kg,
    max_weight_kg,
    base_price_chf,
    price_per_parcel_chf,
    fuel_surcharge_percent,
    discount_percent,
    priority
FROM client_tariff_rules
WHERE client_id = 'VOTRE_CLIENT_ID'
  AND is_active = TRUE
ORDER BY service_level, priority;

-- ==================================================
-- NOTES IMPORTANTES
-- ==================================================
/*
1. priority: Plus le chiffre est bas, plus la règle est prioritaire
   - Utiliser 100 pour les règles standards
   - Utiliser 50 pour les règles prioritaires
   - Utiliser 150 pour les règles par défaut

2. service_level: Doit correspondre aux valeurs du fichier importé
   - eco_48h: Livraison économique 48h
   - priority_24h: Livraison prioritaire 24h
   - express: Livraison express jour même

3. weight ranges: Les plages sont [min, max[ (max exclusif)
   - 0-2 kg signifie: 0 <= weight < 2
   - Adapter les max pour éviter les trous

4. fuel_surcharge_percent: S'applique au subtotal
   - 2.0 = 2%
   - 0 = pas de supplément

5. discount_percent: S'applique après fuel surcharge
   - 5.0 = 5% de rabais
*/
