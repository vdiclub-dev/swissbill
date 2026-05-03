/**
 * COLIXO - Mapping Intelligent de Colonnes
 * 
 * Gère la détection automatique des colonnes et le mapping vers le format Colixo
 */

// Liste complète des synonymes pour chaque champ Colixo
const FIELD_SYNONYMS = {
    external_reference: [
        'référence', 'ref', 'réf', 'reference', 'référence client',
        'commande', 'no commande', 'n° commande', 'numero commande',
        'numéro commande', 'order id', 'order number', 'shipment id',
        'tracking reference'
    ],
    delivery_name: [
        'nom', 'destinataire', 'client final', 'customer', 'customer name',
        'recipient', 'receiver', 'livraison nom', 'nom destinataire'
    ],
    delivery_address: [
        'adresse', 'rue', 'adresse livraison', 'adresse complète',
        'address', 'shipping address', 'delivery address', 'street',
        'adresse destinataire'
    ],
    delivery_zip: [
        'npa', 'code postal', 'cp', 'zip', 'zipcode', 'postal code'
    ],
    delivery_city: [
        'ville', 'localité', 'locality', 'city', 'town'
    ],
    parcel_count: [
        'colis', 'nb colis', 'nombre colis', 'nombre de colis',
        'quantité', 'quantity', 'parcel count', 'packages', 'package count'
    ],
    weight_kg: [
        'poids', 'kg', 'poids kg', 'weight', 'weight kg', 'gross weight'
    ],
    delivery_phone: [
        'téléphone', 'tel', 'mobile', 'phone', 'contact phone',
        'téléphone destinataire'
    ],
    delivery_email: [
        'email', 'mail', 'e-mail', 'contact email', 'email destinataire'
    ],
    delivery_instructions: [
        'instructions', 'remarque', 'commentaire', 'note', 'delivery note',
        'instructions livraison', 'remarque livraison'
    ],
    requested_delivery_date: [
        'date', 'date livraison', 'livraison souhaitée', 'requested date',
        'delivery date', 'date souhaitée'
    ],
    service_level: [
        'service', 'type livraison', 'mode', 'priorité', 'eco', 'express',
        'priority', 'speed', 'type de service'
    ],
    pickup_name: [
        'expéditeur', 'site départ', 'dépôt', 'pickup name', 'sender',
        'nom expéditeur'
    ],
    pickup_address: [
        'adresse enlèvement', 'adresse départ', 'pickup address',
        'sender address', 'adresse expéditeur'
    ],
    pickup_zip: [
        'npa départ', 'code postal départ', 'pickup zip', 'npa expéditeur'
    ],
    pickup_city: [
        'ville départ', 'localité départ', 'pickup city', 'ville expéditeur'
    ],
    distance_km: [
        'km', 'kilomètres', 'distance', 'distance km', 'distance_km'
    ]
};

// Champs obligatoires pour une commande valide
const REQUIRED_FIELDS = [
    'external_reference',
    'delivery_name',
    'delivery_address',
    'delivery_zip',
    'delivery_city',
    'parcel_count'
];

// Labels affichés dans l'interface
const FIELD_LABELS = {
    external_reference: 'Référence client',
    delivery_name: 'Nom destinataire',
    delivery_address: 'Adresse livraison',
    delivery_zip: 'NPA livraison',
    delivery_city: 'Ville livraison',
    parcel_count: 'Nombre de colis',
    weight_kg: 'Poids kg',
    delivery_phone: 'Téléphone',
    delivery_email: 'Email',
    delivery_instructions: 'Instructions',
    requested_delivery_date: 'Date souhaitée',
    service_level: 'Niveau de service',
    pickup_name: 'Nom expéditeur',
    pickup_address: 'Adresse enlèvement',
    pickup_zip: 'NPA enlèvement',
    pickup_city: 'Ville enlèvement',
    distance_km: 'Distance km'
};

/**
 * Normalise un en-tête de colonne pour la comparaison
 * @param {string} header - En-tête brut
 * @returns {string} - En-tête normalisé (sans accents, minuscules, espaces superflus)
 */
function normalizeHeader(header) {
    if (!header) return '';
    
    return header
        .toLowerCase()
        .normalize('NFD')  // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, '')  // Supprime les accents
        .replace(/[_\-\s]+/g, ' ')  // Remplace tirets et underscores par espaces
        .trim();
}

/**
 * Détecte le mapping des colonnes du fichier client
 * @param {string[]} headers - Liste des en-têtes du fichier
 * @returns {Object} - Mapping détecté { headerClient: champColixo }
 */
function detectColumnMapping(headers) {
    const mapping = {};
    const usedFields = new Set();

    for (const header of headers) {
        const normalized = normalizeHeader(header);
        let bestMatch = null;
        let bestScore = 0;

        // Cherche le meilleur match parmi tous les champs Colixo
        for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
            // Éviter de mapper deux fois le même champ
            if (usedFields.has(field)) continue;

            for (const synonym of synonyms) {
                const normSynonym = normalizeHeader(synonym);
                
                // Match exact
                if (normalized === normSynonym) {
                    bestMatch = field;
                    bestScore = 100;
                    break;
                }
                
                // Match partiel (contient le synonyme)
                if (normalized.includes(normSynonym) || normSynonym.includes(normalized)) {
                    const score = Math.max(
                        normalized.length,
                        normSynonym.length
                    ) / Math.min(
                        normalized.length,
                        normSynonym.length
                    );
                    
                    if (score > bestScore && score < 2) {  // Ratio raisonnable
                        bestMatch = field;
                        bestScore = score;
                    }
                }
            }
            
            if (bestScore === 100) break;
        }

        if (bestMatch) {
            mapping[header] = bestMatch;
            usedFields.add(bestMatch);
        } else {
            // Pas de match trouvé - sera marqué comme "ignore"
            mapping[header] = null;
        }
    }

    return mapping;
}

/**
 * Valide qu'un mapping contient tous les champs obligatoires
 * @param {Object} mapping - Mapping à valider
 * @returns {Object} - { valid: boolean, missing: string[] }
 */
function validateMapping(mapping) {
    const mappedFields = new Set(Object.values(mapping).filter(f => f !== null));
    const missing = [];

    for (const field of REQUIRED_FIELDS) {
        if (!mappedFields.has(field)) {
            missing.push(field);
        }
    }

    return {
        valid: missing.length === 0,
        missing: missing
    };
}

/**
 * Applique le mapping à une ligne de données
 * @param {Object} row - Données brutes de la ligne
 * @param {Object} mapping - Mapping colonnes -> champs Colixo
 * @param {Object} defaultValues - Valeurs par défaut pour les champs manquants
 * @returns {Object} - Données transformées au format Colixo
 */
function applyMapping(row, mapping, defaultValues = {}) {
    const result = {
        raw: row
    };

    // Applique le mapping
    for (const [header, field] of Object.entries(mapping)) {
        if (field && row[header] !== undefined && row[header] !== null) {
            result[field] = parseFieldValue(field, row[header]);
        }
    }

    // Applique les valeurs par défaut pour les champs manquants
    for (const [field, value] of Object.entries(defaultValues)) {
        if (result[field] === undefined || result[field] === null || result[field] === '') {
            result[field] = parseFieldValue(field, value);
        }
    }

    return result;
}

/**
 * Parse une valeur selon le type de champ
 * @param {string} field - Nom du champ
 * @param {any} value - Valeur brute
 * @returns {any} - Valeur typée
 */
function parseFieldValue(field, value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const strValue = String(value).trim();

    // Champs numériques
    if (['parcel_count', 'weight_kg', 'distance_km'].includes(field)) {
        const num = parseFloat(strValue.replace(',', '.'));
        return isNaN(num) ? null : num;
    }

    // Champs entiers
    if (field === 'parcel_count') {
        const int = parseInt(strValue, 10);
        return isNaN(int) ? null : int;
    }

    return strValue;
}

/**
 * Récupère tous les synonymes pour affichage
 * @returns {Object} - FIELD_SYNONYMS
 */
function getFieldSynonyms() {
    return FIELD_SYNONYMS;
}

/**
 * Récupère le label d'un champ
 * @param {string} field - Nom du champ
 * @returns {string} - Label
 */
function getFieldLabel(field) {
    return FIELD_LABELS[field] || field;
}

/**
 * Génère les options pour le menu déroulant de mapping
 * @returns {Array} - Liste des options { value, label }
 */
function getMappingOptions() {
    const options = [
        { value: '', label: 'Ignorer cette colonne' }
    ];

    for (const [field, label] of Object.entries(FIELD_LABELS)) {
        options.push({ value: field, label });
    }

    return options;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeHeader,
        detectColumnMapping,
        validateMapping,
        applyMapping,
        parseFieldValue,
        getFieldSynonyms,
        getFieldLabel,
        getMappingOptions,
        REQUIRED_FIELDS,
        FIELD_LABELS
    };
}
