/**
 * COLIXO - Génération de Rapport d'Erreurs CSV
 * 
 * Génère et télécharge un fichier CSV avec les erreurs d'importation
 */

/**
 * Génère le contenu CSV pour le rapport d'erreurs
 * @param {Array} errors - Liste des erreurs { line, reference, field, message, value }
 * @returns {string} - Contenu CSV
 */
function generateErrorCsv(errors) {
    if (!errors || errors.length === 0) {
        return 'Numéro de ligne,Référence,Champ concerné,Message erreur,Valeur reçue\n';
    }

    const headers = ['Numéro de ligne', 'Référence', 'Champ concerné', 'Message erreur', 'Valeur reçue'];
    const csvRows = [headers.join(';')];

    for (const error of errors) {
        const row = [
            escapeCsvValue(error.line || ''),
            escapeCsvValue(error.reference || ''),
            escapeCsvValue(error.field || ''),
            escapeCsvValue(error.message || ''),
            escapeCsvValue(error.value || '')
        ];
        csvRows.push(row.join(';'));
    }

    return csvRows.join('\n');
}

/**
 * Échappe une valeur pour le format CSV
 * @param {any} value - Valeur à échapper
 * @returns {string} - Valeur échappée
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const strValue = String(value);
    
    // Si la valeur contient des guillemets, points-virgules ou sauts de ligne, l'entourer de guillemets
    if (strValue.includes('"') || strValue.includes(';') || strValue.includes('\n') || strValue.includes('\r')) {
        return '"' + strValue.replace(/"/g, '""') + '"';
    }

    return strValue;
}

/**
 * Télécharge le fichier CSV d'erreurs
 * @param {Array} errors - Liste des erreurs
 * @param {string} fileName - Nom du fichier (optionnel)
 */
function downloadErrorCsv(errors, fileName = null) {
    const csvContent = generateErrorCsv(errors);
    
    // Crée un Blob avec encodage UTF-8 et BOM pour Excel
    const bom = '\uFEFF';  // Byte Order Mark pour Excel
    const blob = new Blob([bom + csvContent], { 
        type: 'text/csv;charset=utf-8;' 
    });

    // Génère le nom de fichier
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const safeFileName = fileName || `colixo_erreurs_import_${timestamp}.csv`;

    // Crée un lien de téléchargement temporaire
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', safeFileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Libère l'URL objet
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Génère un rapport d'erreurs complet avec statistiques
 * @param {Array} allRows - Toutes les lignes importées
 * @param {Array} validRows - Lignes valides
 * @param {Array} errorRows - Lignes avec erreurs
 * @param {Array} duplicateRows - Lignes en doublon
 * @returns {Object} - Rapport complet
 */
function generateErrorReport(allRows, validRows, errorRows, duplicateRows) {
    const errors = [];

    // Ajoute les erreurs de validation
    for (const row of errorRows) {
        if (row.validationErrors) {
            for (const error of row.validationErrors) {
                errors.push({
                    line: row._lineNumber,
                    reference: row.external_reference || row.raw?.external_reference || '',
                    field: error.field || 'multiple',
                    message: error.message,
                    value: error.value || ''
                });
            }
        }
    }

    // Ajoute les doublons
    for (const row of duplicateRows) {
        errors.push({
            line: row._lineNumber,
            reference: row.external_reference || row.raw?.external_reference || '',
            field: 'external_reference',
            message: 'Doublon - Cette référence existe déjà',
            value: row.external_reference || row.raw?.external_reference || ''
        });
    }

    return {
        totalRows: allRows.length,
        validRows: validRows.length,
        errorRows: errorRows.length,
        duplicateRows: duplicateRows.length,
        errors: errors,
        csvContent: generateErrorCsv(errors)
    };
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateErrorCsv,
        downloadErrorCsv,
        escapeCsvValue,
        generateErrorReport
    };
}
