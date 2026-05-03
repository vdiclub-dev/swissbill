/**
 * COLIXO - Moteur de Tarification
 * 
 * Calcule le prix des transports selon les règles tarifaires du client
 */

/**
 * Charge les règles tarifaires d'un client depuis Supabase
 * @param {string} clientId - ID du client
 * @returns {Promise<Array>} - Liste des règles tarifaires actives
 */
async function loadClientTariffRules(clientId) {
    if (!supabase) {
        console.error('Supabase not initialized');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('client_tariff_rules')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .order('priority', { ascending: true });

        if (error) {
            console.error('Error loading tariff rules:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Exception loading tariff rules:', err);
        return [];
    }
}

/**
 * Sélectionne la règle tarifaire appropriée pour une commande
 * @param {Object} order - Commande avec weight_kg, parcel_count, service_level, distance_km
 * @param {Array} rules - Liste des règles tarifaires
 * @returns {Object|null} - Règle sélectionnée ou null si aucune ne correspond
 */
function selectTariffRule(order, rules) {
    if (!rules || rules.length === 0) {
        return null;
    }

    // Trie par priorité (plus basse = plus prioritaire)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
        if (matchesTariffRule(order, rule)) {
            return rule;
        }
    }

    return null;
}

/**
 * Vérifie si une commande correspond à une règle tarifaire
 * @param {Object} order - Commande
 * @param {Object} rule - Règle tarifaire
 * @returns {boolean} - true si la commande correspond
 */
function matchesTariffRule(order, rule) {
    // Vérifie le niveau de service si spécifié dans la règle
    if (rule.service_level && order.service_level !== rule.service_level) {
        return false;
    }

    // Vérifie le poids minimum
    if (rule.min_weight_kg !== null && rule.min_weight_kg !== undefined) {
        if (!order.weight_kg || order.weight_kg < rule.min_weight_kg) {
            return false;
        }
    }

    // Vérifie le poids maximum
    if (rule.max_weight_kg !== null && rule.max_weight_kg !== undefined) {
        if (!order.weight_kg || order.weight_kg >= rule.max_weight_kg) {
            return false;
        }
    }

    // Vérifie le nombre de colis minimum
    if (rule.min_parcel_count !== null && rule.min_parcel_count !== undefined) {
        if (!order.parcel_count || order.parcel_count < rule.min_parcel_count) {
            return false;
        }
    }

    // Vérifie le nombre de colis maximum
    if (rule.max_parcel_count !== null && rule.max_parcel_count !== undefined) {
        if (!order.parcel_count || order.parcel_count > rule.max_parcel_count) {
            return false;
        }
    }

    return true;
}

/**
 * Calcule le prix d'une commande selon une règle tarifaire
 * @param {Object} order - Commande
 * @param {Object} rule - Règle tarifaire
 * @returns {Object} - Détail du calcul { base_price, parcels_cost, weight_cost, km_cost, surcharges, fuel_surcharge, discount, total }
 */
function calculateOrderPrice(order, rule) {
    const result = {
        base_price: parseFloat(rule.base_price_chf) || 0,
        parcels_cost: 0,
        weight_cost: 0,
        km_cost: 0,
        surcharges: {},
        fuel_surcharge: 0,
        discount: 0,
        subtotal: 0,
        total: 0
    };

    // Coût par colis
    if (rule.price_per_parcel_chf && order.parcel_count) {
        result.parcels_cost = parseFloat(rule.price_per_parcel_chf) * order.parcel_count;
    }

    // Coût au kg
    if (rule.price_per_kg_chf && order.weight_kg) {
        result.weight_cost = parseFloat(rule.price_per_kg_chf) * order.weight_kg;
    }

    // Coût kilométrique
    if (order.distance_km && rule.included_km !== undefined && rule.extra_km_price_chf) {
        const includedKm = parseFloat(rule.included_km) || 0;
        const extraKm = Math.max(0, order.distance_km - includedKm);
        
        if (extraKm > 0) {
            result.km_cost = parseFloat(rule.extra_km_price_chf) * extraKm;
        }
    }

    // Surcharges
    if (rule.night_surcharge_chf) {
        result.surcharges.night = parseFloat(rule.night_surcharge_chf);
    }
    
    if (rule.urgent_surcharge_chf) {
        result.surcharges.urgent = parseFloat(rule.urgent_surcharge_chf);
    }
    
    if (rule.floor_surcharge_chf) {
        result.surcharges.floor = parseFloat(rule.floor_surcharge_chf);
    }

    // Calcule le subtotal avant suppléments
    result.subtotal = 
        result.base_price + 
        result.parcels_cost + 
        result.weight_cost + 
        result.km_cost +
        Object.values(result.surcharges).reduce((sum, val) => sum + val, 0);

    // Supplément carburant (pourcentage)
    if (rule.fuel_surcharge_percent) {
        result.fuel_surcharge = calculateFuelSurcharge(result.subtotal, rule.fuel_surcharge_percent);
    }

    // Rabais (pourcentage)
    if (rule.discount_percent) {
        result.discount = calculateDiscount(result.subtotal + result.fuel_surcharge, rule.discount_percent);
    }

    // Total final
    result.total = result.subtotal + result.fuel_surcharge - result.discount;

    return result;
}

/**
 * Calcule le supplément carburant
 * @param {number} amount - Montant de base
 * @param {number} percent - Pourcentage
 * @returns {number} - Montant du supplément
 */
function calculateFuelSurcharge(amount, percent) {
    return parseFloat(((amount * parseFloat(percent)) / 100).toFixed(2));
}

/**
 * Calcule un rabais
 * @param {number} amount - Montant de base
 * @param {number} percent - Pourcentage
 * @returns {number} - Montant du rabais
 */
function calculateDiscount(amount, percent) {
    return parseFloat(((amount * parseFloat(percent)) / 100).toFixed(2));
}

/**
 * Construit l'objet pricing_details à stocker en base
 * @param {Object} order - Commande
 * @param {Object} rule - Règle tarifaire
 * @param {Object} calculation - Résultat du calcul
 * @returns {Object} - Détails sérialisables pour stockage
 */
function buildPricingDetails(order, rule, calculation) {
    return {
        tariff_rule_id: rule.id,
        tariff_rule_name: rule.name,
        service_level: order.service_level || rule.service_level,
        weight_kg: order.weight_kg,
        parcel_count: order.parcel_count,
        distance_km: order.distance_km,
        base_price: calculation.base_price,
        price_per_parcel: rule.price_per_parcel_chf,
        parcels_cost: calculation.parcels_cost,
        price_per_kg: rule.price_per_kg_chf,
        weight_cost: calculation.weight_cost,
        included_km: rule.included_km,
        extra_km: calculation.km_cost > 0 ? order.distance_km - (rule.included_km || 0) : 0,
        km_cost: calculation.km_cost,
        surcharges: calculation.surcharges,
        fuel_surcharge_percent: rule.fuel_surcharge_percent,
        fuel_surcharge_amount: calculation.fuel_surcharge,
        discount_percent: rule.discount_percent,
        discount_amount: calculation.discount,
        subtotal: calculation.subtotal,
        unit_price: calculation.total,
        total_price: calculation.total * (order.parcel_count || 1),
        calculated_at: new Date().toISOString()
    };
}

/**
 * Calcule les prix pour toutes les lignes importées
 * @param {Array} mappedRows - Lignes mappées
 * @param {Array} tariffRules - Règles tarifaires
 * @returns {Array} - Lignes avec prix calculés
 */
function calculatePricesForRows(mappedRows, tariffRules) {
    return mappedRows.map(row => {
        const rule = selectTariffRule(row, tariffRules);
        
        if (!rule) {
            return {
                ...row,
                unit_price_chf: null,
                total_price_chf: null,
                pricing_status: 'needs_review',
                pricing_details: {
                    error: 'Aucune règle tarifaire trouvée',
                    service_level: row.service_level,
                    weight_kg: row.weight_kg,
                    parcel_count: row.parcel_count
                }
            };
        }

        const calculation = calculateOrderPrice(row, rule);
        const pricingDetails = buildPricingDetails(row, rule, calculation);

        return {
            ...row,
            tariff_rule_id: rule.id,
            unit_price_chf: calculation.total,
            total_price_chf: calculation.total * (row.parcel_count || 1),
            pricing_status: 'calculated',
            pricing_details: pricingDetails
        };
    });
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadClientTariffRules,
        selectTariffRule,
        matchesTariffRule,
        calculateOrderPrice,
        calculateFuelSurcharge,
        calculateDiscount,
        buildPricingDetails,
        calculatePricesForRows
    };
}
