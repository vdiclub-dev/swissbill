/**
 * COLIXO - Importation de Livraisons (Fichier Principal)
 * 
 * Gère l'ensemble du processus d'importation: upload, parsing, mapping, validation, pricing et création
 */

// État global de l'importation
let importState = {
    file: null,
    fileName: '',
    fileType: '',
    rawRows: [],
    headers: [],
    detectedMapping: {},
    currentMapping: {},
    defaultValues: {},
    mappedRows: [],
    validatedRows: [],
    errorRows: [],
    duplicateRows: [],
    tariffRules: [],
    importBatch: null,
    client: null
};

/**
 * Initialise la page d'importation au chargement
 */
async function initImportPage() {
    // Vérifie l'authentification
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        showNotification('Veuillez vous connecter pour accéder à cette page', 'error');
        window.location.href = '/client/login.html';
        return;
    }

    // Récupère les informations du client
    importState.client = await getCurrentClient();
    if (!importState.client) {
        showNotification('Profil client introuvable', 'error');
        return;
    }

    // Charge les règles tarifaires
    importState.tariffRules = await loadClientTariffRules(importState.client.id);

    // Charge le dernier profil d'import actif
    await loadActiveImportProfile();

    // Attache les écouteurs d'événements
    attachEventListeners();

    console.log('Page d\'import initialisée pour le client:', importState.client.companyName);
}

/**
 * Attache les écouteurs d'événements
 */
function attachEventListeners() {
    // Upload de fichier
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');

    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    if (dropZone) {
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
    }

    // Boutons d'action
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', handleAnalyzeFile);
    }

    const saveMappingBtn = document.getElementById('saveMappingBtn');
    if (saveMappingBtn) {
        saveMappingBtn.addEventListener('click', handleSaveMapping);
    }

    const recalculateBtn = document.getElementById('recalculateBtn');
    if (recalculateBtn) {
        recalculateBtn.addEventListener('click', handleRecalculatePrices);
    }

    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImport);
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }

    const downloadErrorsBtn = document.getElementById('downloadErrorsBtn');
    if (downloadErrorsBtn) {
        downloadErrorsBtn.addEventListener('click', handleDownloadErrors);
    }
}

/**
 * Gère la sélection de fichier via input
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        validateAndLoadFile(file);
    }
}

/**
 * Gère le dragover
 */
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('dragover');
}

/**
 * Gère le dragleave
 */
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragover');
}

/**
 * Gère le drop de fichier
 */
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        validateAndLoadFile(files[0]);
    }
}

/**
 * Valide et charge un fichier
 */
function validateAndLoadFile(file) {
    // Vérifie le type de fichier
    const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const extension = file.name.split('.').pop().toLowerCase();
    const isExcel = ['xlsx', 'xls'].includes(extension);
    const isCsv = extension === 'csv';

    if (!isExcel && !isCsv) {
        showNotification('Format de fichier non supporté. Utilisez CSV, XLS ou XLSX.', 'error');
        return;
    }

    // Vérifie la taille (max 10 MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification('Le fichier est trop volumineux. Maximum 10 MB.', 'error');
        return;
    }

    // Stocke le fichier
    importState.file = file;
    importState.fileName = file.name;
    importState.fileType = extension;

    // Affiche le nom du fichier
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileNameDisplay) {
        fileNameDisplay.textContent = file.name;
    }

    showNotification('Fichier chargé avec succès', 'success');
}

/**
 * Analyse le fichier après clic sur "Analyser"
 */
async function handleAnalyzeFile() {
    if (!importState.file) {
        showNotification('Veuillez sélectionner un fichier d\'abord', 'error');
        return;
    }

    showLoading(true);

    try {
        let rows = [];
        let headers = [];

        if (importState.fileType === 'csv') {
            const result = await parseCsvFile(importState.file);
            rows = result.rows;
            headers = result.headers;
        } else {
            const result = await parseExcelFile(importState.file);
            rows = result.rows;
            headers = result.headers;
        }

        if (rows.length === 0) {
            showNotification('Le fichier ne contient aucune donnée', 'error');
            showLoading(false);
            return;
        }

        // Stocke les données brutes
        importState.rawRows = rows;
        importState.headers = headers;

        // Détecte le mapping automatiquement
        importState.detectedMapping = detectColumnMapping(headers);
        importState.currentMapping = { ...importState.detectedMapping };

        // Applique les valeurs par défaut du profil si existant
        if (importState.client) {
            importState.defaultValues = {
                pickup_name: importState.client.companyName,
                ...importState.defaultValues
            };
        }

        // Affiche la prévisualisation
        renderPreview(rows.slice(0, 10), headers);

        // Affiche l'interface de mapping
        renderMappingInterface(headers, importState.currentMapping);

        // Passe à l'étape suivante
        showStep('mapping-step');

    } catch (err) {
        console.error('Erreur lors de l\'analyse:', err);
        showNotification('Erreur lors de l\'analyse du fichier: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Parse un fichier CSV avec PapaParse
 */
function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.warn('Erreurs CSV:', results.errors);
                }
                resolve({
                    headers: results.meta.fields || [],
                    rows: results.data.map((row, index) => ({
                        ...row,
                        _lineNumber: index + 2  // +2 car header ligne 1
                    }))
                });
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

/**
 * Parse un fichier Excel avec XLSX
 */
function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Prend la première feuille
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convertit en JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,  // Tableau de tableaux
                    defval: ''
                });

                if (jsonData.length < 2) {
                    resolve({ headers: [], rows: [] });
                    return;
                }

                // Première ligne = headers
                const headers = jsonData[0].map(h => String(h).trim()).filter(h => h);

                // Lignes suivantes = données
                const rows = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = {};
                    const rowData = jsonData[i];

                    // Ignore les lignes vides
                    if (rowData.every(cell => !cell)) continue;

                    for (let j = 0; j < headers.length; j++) {
                        row[headers[j]] = rowData[j] !== undefined ? rowData[j] : '';
                    }

                    row._lineNumber = i + 2;  // +2 car header ligne 1
                    rows.push(row);
                }

                resolve({ headers, rows });

            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = function(error) {
            reject(error);
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Affiche la prévisualisation des premières lignes
 */
function renderPreview(rows, headers) {
    const container = document.getElementById('previewTableBody');
    if (!container) return;

    let html = '';

    for (const row of rows) {
        html += '<tr>';
        for (const header of headers.slice(0, 8)) {  // Limite à 8 colonnes pour l'affichage
            html += `<td>${escapeHtml(row[header] || '')}</td>`;
        }
        html += '</tr>';
    }

    container.innerHTML = html;

    const previewCount = document.getElementById('previewCount');
    if (previewCount) {
        previewCount.textContent = `Affichage des ${Math.min(rows.length, 10)} premières lignes sur ${rows.length}`;
    }
}

/**
 * Affiche l'interface de mapping
 */
function renderMappingInterface(headers, mapping) {
    const container = document.getElementById('mappingTableBody');
    if (!container) return;

    const options = getMappingOptions();

    let html = '';

    for (const header of headers) {
        const detectedField = mapping[header] || '';
        const isRequired = Object.values(mapping).filter(f => f === getFieldLabelForValue(detectedField)).length > 0;

        html += `
            <tr>
                <td><strong>${escapeHtml(header)}</strong></td>
                <td>
                    <select class="mapping-select" data-header="${escapeHtml(header)}">
                        ${options.map(opt => 
                            `<option value="${opt.value}" ${opt.value === detectedField ? 'selected' : ''}>
                                ${opt.label}
                            </option>`
                        ).join('')}
                    </select>
                </td>
                <td class="mapping-status">
                    ${detectedField ? '<span class="badge badge-success">Détecté</span>' : '<span class="badge badge-warning">À définir</span>'}
                </td>
            </tr>
        `;
    }

    container.innerHTML = html;

    // Ajoute les écouteurs pour les changements de mapping
    container.querySelectorAll('.mapping-select').forEach(select => {
        select.addEventListener('change', handleMappingChange);
    });

    // Vérifie si tous les champs obligatoires sont mappés
    validateCurrentMapping();
}

/**
 * Gère le changement de mapping
 */
function handleMappingChange(event) {
    const header = event.target.dataset.header;
    const field = event.target.value;

    importState.currentMapping[header] = field || null;

    // Met à jour le statut visuel
    const statusCell = event.target.closest('tr').querySelector('.mapping-status');
    if (statusCell) {
        if (field) {
            statusCell.innerHTML = '<span class="badge badge-success">Mappé</span>';
        } else {
            statusCell.innerHTML = '<span class="badge badge-secondary">Ignoré</span>';
        }
    }

    validateCurrentMapping();
}

/**
 * Valide le mapping actuel
 */
function validateCurrentMapping() {
    const validation = validateMapping(importState.currentMapping);
    const warningEl = document.getElementById('mappingWarning');

    if (!validation.valid) {
        if (warningEl) {
            warningEl.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Champs obligatoires manquants:</strong> 
                    ${validation.missing.map(f => getFieldLabel(f)).join(', ')}
                </div>
            `;
        }
        disableImportButton(true);
    } else {
        if (warningEl) {
            warningEl.innerHTML = '';
        }
        disableImportButton(false);
    }

    return validation.valid;
}

/**
 * Désactive le bouton d'import
 */
function disableImportButton(disabled) {
    const importBtn = document.getElementById('importBtn');
    const saveMappingBtn = document.getElementById('saveMappingBtn');
    
    if (importBtn) {
        importBtn.disabled = disabled;
    }
    if (saveMappingBtn) {
        saveMappingBtn.disabled = disabled;
    }
}

/**
 * Sauvegarde le profil d'import
 */
async function handleSaveMapping() {
    if (!validateCurrentMapping()) {
        showNotification('Veuillez mapper tous les champs obligatoires', 'error');
        return;
    }

    showLoading(true);

    try {
        const profileName = prompt('Nom du profil d\'import:', 'Mon profil ' + new Date().toLocaleDateString());
        if (!profileName) return;

        const profileData = {
            client_id: importState.client.id,
            profile_name: profileName,
            file_type: importState.fileType,
            column_mapping: importState.currentMapping,
            default_values: importState.defaultValues,
            is_active: true
        };

        // Désactive les anciens profils
        await deactivateAllProfiles();

        // Crée le nouveau profil
        const { data, error } = await supabase
            .from('client_import_profiles')
            .insert([profileData])
            .select()
            .single();

        if (error) throw error;

        showNotification('Profil sauvegardé avec succès', 'success');

    } catch (err) {
        console.error('Erreur sauvegarde profil:', err);
        showNotification('Erreur lors de la sauvegarde du profil', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Désactive tous les profils existants
 */
async function deactivateAllProfiles() {
    try {
        await supabase
            .from('client_import_profiles')
            .update({ is_active: false })
            .eq('client_id', importState.client.id)
            .eq('is_active', true);
    } catch (err) {
        console.error('Erreur désactivation profils:', err);
    }
}

/**
 * Charge le profil d'import actif
 */
async function loadActiveImportProfile() {
    try {
        const { data, error } = await supabase
            .from('client_import_profiles')
            .select('*')
            .eq('client_id', importState.client.id)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            console.log('Aucun profil actif trouvé');
            return;
        }

        importState.defaultValues = data.default_values || {};
        
        // Pourrait aussi charger le mapping par défaut si souhaité
        // importState.detectedMapping = data.column_mapping || {};

        console.log('Profil actif chargé:', data.profile_name);

    } catch (err) {
        console.error('Erreur chargement profil:', err);
    }
}

/**
 * Recalcule les prix
 */
async function handleRecalculatePrices() {
    showLoading(true);

    try {
        // Recharge les règles tarifaires
        importState.tariffRules = await loadClientTariffRules(importState.client.id);

        // Recalcule les prix
        importState.mappedRows = calculatePricesForRows(importState.mappedRows, importState.tariffRules);

        // Rafraîchit l'affichage
        renderValidationResults();

        showNotification('Prix recalculés avec succès', 'success');

    } catch (err) {
        console.error('Erreur recalcul prix:', err);
        showNotification('Erreur lors du recalcul des prix', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Valide toutes les lignes
 */
function validateRows() {
    const validRows = [];
    const errorRows = [];
    const seenReferences = new Set();

    for (const row of importState.mappedRows) {
        const errors = [];

        // Vérifie les champs obligatoires
        for (const field of REQUIRED_FIELDS) {
            if (!row[field] || row[field] === null || row[field] === '') {
                errors.push({
                    field: field,
                    message: `Champ obligatoire manquant: ${getFieldLabel(field)}`,
                    value: row[field]
                });
            }
        }

        // Vérifie parcel_count > 0
        if (row.parcel_count && row.parcel_count <= 0) {
            errors.push({
                field: 'parcel_count',
                message: 'Le nombre de colis doit être supérieur à 0',
                value: row.parcel_count
            });
        }

        // Vérifie les doublons dans le fichier
        if (row.external_reference) {
            if (seenReferences.has(row.external_reference)) {
                errors.push({
                    field: 'external_reference',
                    message: 'Doublon dans le fichier',
                    value: row.external_reference
                });
            }
            seenReferences.add(row.external_reference);
        }

        if (errors.length > 0) {
            row.validationErrors = errors;
            errorRows.push(row);
        } else {
            validRows.push(row);
        }
    }

    importState.validatedRows = validRows;
    importState.errorRows = errorRows;

    return { validRows, errorRows };
}

/**
 * Vérifie les doublons en base de données
 */
async function checkDuplicates(references) {
    if (!references || references.length === 0) {
        return [];
    }

    try {
        // Utilise la fonction SQL check_duplicate_references
        const { data, error } = await supabase.rpc('check_duplicate_references', {
            p_client_id: importState.client.id,
            p_references: references
        });

        if (error) {
            console.error('Erreur vérification doublons:', error);
            return [];
        }

        // Retourne les références qui existent déjà
        return data.filter(item => item.exists).map(item => item.reference);

    } catch (err) {
        console.error('Exception vérification doublons:', err);
        return [];
    }
}

/**
 * Gère l'importation finale
 */
async function handleImport() {
    if (!validateCurrentMapping()) {
        showNotification('Mapping incomplet', 'error');
        return;
    }

    showLoading(true);

    try {
        // Étape 1: Applique le mapping à toutes les lignes
        importState.mappedRows = importState.rawRows.map(row => 
            applyMapping(row, importState.currentMapping, importState.defaultValues)
        );

        // Étape 2: Calcule les prix
        importState.mappedRows = calculatePricesForRows(importState.mappedRows, importState.tariffRules);

        // Étape 3: Valide les lignes
        const { validRows, errorRows } = validateRows();

        // Étape 4: Vérifie les doublons en base
        const references = validRows.map(r => r.external_reference).filter(r => r);
        const existingRefs = await checkDuplicates(references);

        // Sépare les doublons des lignes valides
        const finalValidRows = [];
        const duplicateRows = [];

        for (const row of validRows) {
            if (existingRefs.includes(row.external_reference)) {
                row.validationErrors = [{
                    field: 'external_reference',
                    message: 'Cette référence existe déjà en base de données',
                    value: row.external_reference
                }];
                duplicateRows.push(row);
            } else {
                finalValidRows.push(row);
            }
        }

        importState.duplicateRows = duplicateRows;
        importState.errorRows = [...errorRows, ...duplicateRows];
        importState.validatedRows = finalValidRows;

        // Étape 5: Affiche les résultats
        renderValidationResults();

        // Étape 6: Si tout est valide, propose l'import
        if (finalValidRows.length > 0) {
            showStep('preview-step');
        } else {
            showNotification('Aucune ligne valide à importer', 'error');
        }

    } catch (err) {
        console.error('Erreur import:', err);
        showNotification('Erreur lors de l\'importation: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Affiche les résultats de validation
 */
function renderValidationResults() {
    const container = document.getElementById('validationTableBody');
    if (!container) return;

    const allRows = [
        ...importState.validatedRows,
        ...importState.errorRows
    ];

    let html = '';

    for (const row of allRows.slice(0, 100)) {  // Limite à 100 lignes pour performance
        const status = row.validationErrors ? 'error' : 'valid';
        const pricingStatus = row.pricing_status || 'unknown';
        
        let statusBadge = '';
        if (status === 'error') {
            statusBadge = '<span class="badge badge-danger">Erreur</span>';
        } else if (pricingStatus === 'needs_review') {
            statusBadge = '<span class="badge badge-warning">Prix à valider</span>';
        } else {
            statusBadge = '<span class="badge badge-success">Valide</span>';
        }

        html += `
            <tr>
                <td>${statusBadge}</td>
                <td>${escapeHtml(row.external_reference || '')}</td>
                <td>${escapeHtml(row.delivery_name || '')}</td>
                <td>${escapeHtml(row.delivery_city || '')}</td>
                <td>${row.parcel_count || '-'}</td>
                <td>${row.weight_kg ? row.weight_kg + ' kg' : '-'}</td>
                <td>${escapeHtml(row.service_level || '-')}</td>
                <td>${row.total_price_chf ? row.total_price_chf.toFixed(2) + ' CHF' : '-'}</td>
                <td class="error-message">${row.validationErrors ? row.validationErrors.map(e => e.message).join('; ') : ''}</td>
            </tr>
        `;
    }

    container.innerHTML = html;

    // Met à jour les statistiques
    updateImportSummary();
}

/**
 * Met à jour le résumé d'import
 */
function updateImportSummary() {
    const summary = {
        total: importState.rawRows.length,
        valid: importState.validatedRows.length,
        errors: importState.errorRows.length,
        duplicates: importState.duplicateRows.length,
        totalPrice: importState.validatedRows.reduce((sum, row) => sum + (row.total_price_chf || 0), 0)
    };

    const summaryEl = document.getElementById('importSummary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">Total lignes</span>
                    <span class="summary-value">${summary.total}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Lignes valides</span>
                    <span class="summary-value success">${summary.valid}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Erreurs</span>
                    <span class="summary-value error">${summary.errors}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Doublons</span>
                    <span class="summary-value warning">${summary.duplicates}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Prix total estimé</span>
                    <span class="summary-value price">${summary.totalPrice.toFixed(2)} CHF</span>
                </div>
            </div>
        `;
    }
}

/**
 * Crée le lot d'import en base
 */
async function createImportBatch(summary) {
    const batchData = {
        client_id: importState.client.id,
        file_name: importState.fileName,
        file_type: importState.fileType,
        total_rows: summary.total,
        valid_rows: summary.valid,
        error_rows: summary.errors,
        duplicate_rows: summary.duplicates,
        imported_rows: 0,
        total_estimated_price_chf: summary.totalPrice,
        status: 'draft'
    };

    const { data, error } = await supabase
        .from('import_batches')
        .insert([batchData])
        .select()
        .single();

    if (error) throw error;

    return data;
}

/**
 * Insère les commandes valides en base
 */
async function insertOrders(validRows, importBatchId) {
    const ordersToInsert = validRows.map(row => ({
        client_id: importState.client.id,
        external_reference: row.external_reference,
        delivery_name: row.delivery_name,
        delivery_address: row.delivery_address,
        delivery_zip: row.delivery_zip,
        delivery_city: row.delivery_city,
        delivery_phone: row.delivery_phone,
        delivery_email: row.delivery_email,
        delivery_instructions: row.delivery_instructions,
        pickup_name: row.pickup_name,
        pickup_address: row.pickup_address,
        pickup_zip: row.pickup_zip,
        pickup_city: row.pickup_city,
        parcel_count: row.parcel_count,
        weight_kg: row.weight_kg,
        service_level: row.service_level,
        status: 'pending',
        source_system: 'client_import',
        import_batch_id: importBatchId,
        tariff_rule_id: row.tariff_rule_id,
        unit_price_chf: row.unit_price_chf,
        total_price_chf: row.total_price_chf,
        pricing_status: row.pricing_status,
        pricing_details: row.pricing_details,
        raw_import_data: row.raw,
        distance_km: row.distance_km
    }));

    // Insère par lots de 100 pour éviter les limites
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < ordersToInsert.length; i += batchSize) {
        const batch = ordersToInsert.slice(i, i + batchSize);
        
        const { data, error } = await supabase
            .from('orders')
            .insert(batch)
            .select();

        if (error) {
            console.error('Erreur insertion lot:', error);
            throw error;
        }

        insertedCount += data.length;
    }

    return insertedCount;
}

/**
 * Finalise l'importation
 */
async function finalizeImport() {
    showLoading(true);

    try {
        // Crée le lot d'import
        const summary = {
            total: importState.rawRows.length,
            valid: importState.validatedRows.length,
            errors: importState.errorRows.length,
            duplicates: importState.duplicateRows.length,
            totalPrice: importState.validatedRows.reduce((sum, row) => sum + (row.total_price_chf || 0), 0)
        };

        const batch = await createImportBatch(summary);

        // Insère les commandes
        const insertedCount = await insertOrders(importState.validatedRows, batch.id);

        // Met à jour le statut du lot
        await supabase
            .from('import_batches')
            .update({
                status: 'completed',
                imported_rows: insertedCount,
                completed_at: new Date().toISOString()
            })
            .eq('id', batch.id);

        showNotification(`${insertedCount} livraisons importées avec succès!`, 'success');

        // Redirige vers la liste des commandes
        setTimeout(() => {
            window.location.href = '/client/orders.html';
        }, 2000);

    } catch (err) {
        console.error('Erreur finalisation import:', err);
        showNotification('Erreur lors de l\'importation: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Télécharge le rapport d'erreurs
 */
function handleDownloadErrors() {
    const report = generateErrorReport(
        importState.rawRows,
        importState.validatedRows,
        importState.errorRows,
        importState.duplicateRows
    );

    downloadErrorCsv(report.errors, `colixo_erreurs_${importState.fileName.replace(/\.[^.]+$/, '')}.csv`);
}

/**
 * Annule l'import et réinitialise
 */
function handleCancel() {
    if (confirm('Voulez-vous vraiment annuler cet import?')) {
        resetImportState();
        showStep('upload-step');
    }
}

/**
 * Réinitialise l'état d'import
 */
function resetImportState() {
    importState = {
        file: null,
        fileName: '',
        fileType: '',
        rawRows: [],
        headers: [],
        detectedMapping: {},
        currentMapping: {},
        defaultValues: importState.defaultValues,  // Garde les valeurs par défaut
        mappedRows: [],
        validatedRows: [],
        errorRows: [],
        duplicateRows: [],
        tariffRules: importState.tariffRules,
        importBatch: null,
        client: importState.client
    };

    // Nettoie l'UI
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
    }

    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'Aucun fichier sélectionné';
    }

    const previewTableBody = document.getElementById('previewTableBody');
    if (previewTableBody) {
        previewTableBody.innerHTML = '';
    }

    const mappingTableBody = document.getElementById('mappingTableBody');
    if (mappingTableBody) {
        mappingTableBody.innerHTML = '';
    }

    const validationTableBody = document.getElementById('validationTableBody');
    if (validationTableBody) {
        validationTableBody.innerHTML = '';
    }
}

// Utilitaires

/**
 * Affiche une notification
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        alert(message);
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Affiche/masque le loader
 */
function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }

    // Désactive les boutons pendant le chargement
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = show;
    });
}

/**
 * Affiche une étape spécifique
 */
function showStep(stepId) {
    // Cache toutes les étapes
    document.querySelectorAll('.import-step').forEach(step => {
        step.style.display = 'none';
    });

    // Affiche l'étape demandée
    const step = document.getElementById(stepId);
    if (step) {
        step.style.display = 'block';
    }
}

/**
 * Échappe une chaîne HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Récupère le label pour une valeur de champ
 */
function getFieldLabelForValue(value) {
    const labels = {
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
    return labels[value] || value;
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', initImportPage);
