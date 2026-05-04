(function () {
  'use strict';

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = ['xlsx', 'xls', 'csv'];
  const REQUIRED_FIELDS = (window.ColixoImportMapping && window.ColixoImportMapping.REQUIRED_FIELDS) || [
    'external_reference',
    'delivery_name',
    'delivery_address',
    'delivery_zip',
    'delivery_city',
    'parcel_count'
  ];

  const FIELD_LABELS = (window.ColixoImportMapping && window.ColixoImportMapping.FIELD_LABELS) || {};
  const MAPPING = window.ColixoImportMapping;
  const PRICING = window.ColixoPricingEngine;
  const CSV_REPORT = window.ColixoCsvErrorReport;

  const state = {
    user: null,
    authContext: null,
    isLegacySession: false,
    legacyCode: null,
    profile: null,
    clientId: null,
    orderClientId: null,
    company: null,
    activeProfile: null,
    tariffRules: [],
    file: null,
    fileType: null,
    delimiter: null,
    rawRows: [],
    headers: [],
    mapping: {},
    mappedRows: [],
    duplicateReferences: new Set(),
    errors: [],
    warnings: [],
    pricedRows: [],
    summary: null,
    batchId: null,
    importInProgress: false
  };

  const $ = (id) => document.getElementById(id);

  function getDb() {
    const db = window.SUPABASE_CLIENT || window.supabaseClient || window.supabase;
    if (!db || typeof db.from !== 'function') {
      throw new Error('Client Supabase introuvable. Vérifiez config.js.');
    }
    return db;
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return `${n.toFixed(2)} CHF`;
  }

  function normalizeValue(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function toInteger(value) {
    const n = toNumber(value);
    return n === null ? null : Math.max(0, Math.round(n));
  }

  function setStatus(message, type) {
    const box = $('importStatus');
    if (!box) return;
    box.textContent = message || '';
    box.className = `import-status ${type || 'info'}`;
    box.hidden = !message;
  }

  function setDecisionFeedback(message, type) {
    const box = $('decisionFeedback');
    if (!box) return;
    box.textContent = message || '';
    box.className = `decision-feedback ${type || 'info'}`;
    box.hidden = !message;
  }

  function setImportButtonBusy(isBusy) {
    const button = $('btnImportValidBottom');
    if (!button) return;
    button.disabled = Boolean(isBusy) || !(state.summary && state.summary.validRows > 0);
    button.innerHTML = isBusy
      ? '<i class="fas fa-spinner fa-spin"></i> Import en cours...'
      : '<i class="fas fa-cloud-upload-alt"></i> Étape 7 · Importer maintenant';
  }

  function setStep(step) {
    document.querySelectorAll('[data-step]').forEach((el) => {
      const current = Number(el.getAttribute('data-step'));
      el.classList.toggle('is-active', current === step);
      el.classList.toggle('is-done', current < step);
    });
  }

  function setBusy(isBusy, message) {
    document.body.classList.toggle('import-busy', Boolean(isBusy));
    const overlay = $('busyOverlay');
    if (overlay) {
      overlay.hidden = !isBusy;
      const text = overlay.querySelector('[data-busy-text]');
      if (text) text.textContent = message || 'Traitement en cours...';
    }
  }

  function showSection(id, visible) {
    const el = $(id);
    if (el) el.hidden = !visible;
  }

  function getFileExtension(fileName) {
    return String(fileName || '').split('.').pop().toLowerCase();
  }

  function getDefaultValuesFromForm() {
    return {
      pickup_name: normalizeValue($('defaultPickupName')?.value),
      pickup_address: normalizeValue($('defaultPickupAddress')?.value),
      pickup_zip: normalizeValue($('defaultPickupZip')?.value),
      pickup_city: normalizeValue($('defaultPickupCity')?.value),
      service_level: normalizeValue($('defaultServiceLevel')?.value) || 'eco_48h',
      tariff_code: normalizeValue($('defaultTariffCode')?.value).toUpperCase(),
      status: 'pending',
      billing_client_id: state.clientId || ''
    };
  }

  function fillDefaultValues(defaults) {
    const values = defaults || {};
    if ($('defaultPickupName')) $('defaultPickupName').value = values.pickup_name || state.company?.nom || '';
    if ($('defaultPickupAddress')) $('defaultPickupAddress').value = values.pickup_address || state.company?.adresse || '';
    if ($('defaultPickupZip')) $('defaultPickupZip').value = values.pickup_zip || state.company?.npa || '';
    if ($('defaultPickupCity')) $('defaultPickupCity').value = values.pickup_city || state.company?.ville || '';
    if ($('defaultServiceLevel')) $('defaultServiceLevel').value = values.service_level || 'eco_48h';
    if ($('defaultTariffCode')) $('defaultTariffCode').value = values.tariff_code || '';
  }

  function getStoredPortalClient() {
    try {
      const raw = localStorage.getItem('colixo_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      const allowedRoles = ['client', 'gestionnaire', 'comptable', 'sous_utilisateur'];
      if (!user || !user.id || allowedRoles.indexOf(user.role) === -1) return null;
      let storedCode = user.code || user.code_usr || user.code_acces || user.code_connexion || null;
      if (!storedCode) {
        try { storedCode = localStorage.getItem('colixo_access_code'); } catch (error) {}
      }
      return {
        session: null,
        authUser: null,
        profile: user,
        userId: user.id,
        role: user.role,
        isLegacy: true,
        legacyCode: storedCode,
        profileLookup: 'localStorage'
      };
    } catch (error) {
      return null;
    }
  }

  async function getCurrentClient() {
    if (typeof window.colixoGetAuthContext !== 'function') {
      throw new Error('Protection de route indisponible. Vérifiez js/auth.js.');
    }

    let auth = await window.colixoGetAuthContext({
      roles: ['client', 'gestionnaire', 'comptable', 'sous_utilisateur'],
      legacyRoles: ['client', 'gestionnaire', 'comptable', 'sous_utilisateur']
    });

    if (!auth || !auth.profile) {
      auth = getStoredPortalClient();
    }

    if (!auth || !auth.profile) {
      throw new Error('Connectez-vous au portail client pour ouvrir l’import.');
    }

    const db = getDb();
    const profile = auth.profile;
    const clientId = profile.entreprise_id || profile.client_id || profile.id || auth.userId;
    const orderClientId = profile.id || auth.userId || clientId;
    let company = null;

    if (profile.entreprise_id) {
      const { data, error } = await db
        .from('entreprises')
        .select('id,nom,adresse,npa,ville,email,telephone')
        .eq('id', profile.entreprise_id)
        .maybeSingle();
      if (!error) company = data;
    }

    state.authContext = auth;
    state.user = auth.authUser || auth.user || null;
    state.isLegacySession = Boolean(auth.isLegacy || !auth.session);
    state.legacyCode = auth.legacyCode || profile.code || profile.code_usr || (typeof window.colixoGetStoredCode === 'function' ? window.colixoGetStoredCode() : null);
    state.profile = profile;
    state.clientId = clientId;
    state.orderClientId = orderClientId;
    state.company = company;

    if (state.isLegacySession) {
      await loadLegacyBootstrap();
    }

    const name = state.company?.nom || [state.profile.prenom, state.profile.nom].filter(Boolean).join(' ') || state.profile.email || 'Client';
    if ($('clientName')) $('clientName').textContent = name;
    if ($('clientScope')) $('clientScope').textContent = `Client ID: ${state.clientId}`;
    fillDefaultValues(state.activeProfile?.default_values || {});

    if (state.isLegacySession) {
      setStatus('Mode code client actif: l’import utilise une fonction Supabase sécurisée côté serveur.', 'info');
    }

    return { user: auth.user, profile, clientId, company };
  }

  function getLegacyRpcPayload(extra) {
    if (!state.profile?.id || !state.legacyCode) {
      throw new Error('Session code client incomplète. Déconnectez-vous puis reconnectez-vous une fois avec votre code client pour activer l’import.');
    }
    return Object.assign({
      p_user_id: state.profile.id,
      p_code: state.legacyCode
    }, extra || {});
  }

  async function loadLegacyBootstrap() {
    const db = getDb();
    const { data, error } = await db.rpc('client_import_load_bootstrap', getLegacyRpcPayload());
    if (error) throw error;
    if (!data || !data.client_id) throw new Error('Session code client non reconnue pour l’import.');

    state.clientId = data.client_id;
    state.orderClientId = data.order_client_id || data.client_id;
    state.profile = Object.assign({}, state.profile || {}, data.profile || {});
    state.company = data.company || null;
    state.activeProfile = data.import_profile || null;
    state.tariffRules = data.tariff_rules || [];
    if (state.activeProfile) {
      state.mapping = state.activeProfile.column_mapping || {};
      fillDefaultValues(state.activeProfile.default_values || {});
      if ($('profileName')) $('profileName').value = state.activeProfile.profile_name || 'Profil import actif';
      if ($('profileHint')) $('profileHint').textContent = `Profil actif chargé: ${state.activeProfile.profile_name}`;
    }
    if ($('tariffInfo')) {
      $('tariffInfo').textContent = state.tariffRules.length
        ? `${state.tariffRules.length} règle(s) tarifaire(s) active(s) chargée(s).`
        : 'Aucune règle tarifaire active: les prix seront marqués à valider.';
    }
    renderTariffOptions();
  }

  function renderAuthRequired() {
    const portalUrl = typeof window.colixoHref === 'function' ? window.colixoHref('/admin/client/portal.html') : '/admin/client/portal.html';
    const loginUrl = typeof window.colixoHref === 'function' ? window.colixoHref('/login/index.html?switch=1') : '/login/index.html?switch=1';
    showSection('uploadSection', true);
    showSection('mappingSection', false);
    showSection('previewSection', false);
    showSection('summarySection', false);
    showSection('validatedPreviewSection', false);
    const upload = $('uploadSection');
    if (!upload) return;
    upload.innerHTML = `
      <div class="panel-head">
        <div>
          <h2>Session sécurisée requise</h2>
          <p class="panel-subtitle">Votre portail est ouvert avec un code d’accès. Pour créer des commandes en masse avec RLS Supabase, l’import doit utiliser une session Auth complète.</p>
        </div>
      </div>
      <div class="callout callout-warning">
        La page ne redirige plus automatiquement vers le login. L’accès au portail reste ouvert, mais l’import réel est bloqué tant qu’une session Supabase complète n’est pas disponible.
      </div>
      <div class="toolbar" style="margin-top:18px;">
        <a class="btn" href="${portalUrl}"><i class="fas fa-arrow-left"></i> Retour portail</a>
        <a class="btn btn-primary" href="${loginUrl}"><i class="fas fa-right-to-bracket"></i> Reconnexion</a>
      </div>
    `;
  }

  async function loadActiveImportProfile() {
    if (!state.clientId) return null;
    if (state.isLegacySession) return state.activeProfile || null;
    const db = getDb();
    const { data, error } = await db
      .from('client_import_profiles')
      .select('*')
      .eq('client_id', state.clientId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setStatus(`Impossible de charger le profil actif: ${error.message}`, 'warning');
      return null;
    }

    state.activeProfile = data || null;
    if (data) {
      state.mapping = data.column_mapping || {};
      fillDefaultValues(data.default_values || {});
      if ($('profileName')) $('profileName').value = data.profile_name || 'Profil import actif';
      if ($('profileHint')) $('profileHint').textContent = `Profil actif chargé: ${data.profile_name}`;
    } else if ($('profileHint')) {
      $('profileHint').textContent = 'Aucun profil actif: le mapping intelligent sera proposé au premier fichier.';
    }

    return data || null;
  }

  async function loadClientTariffRules(clientId) {
    if (state.isLegacySession) return state.tariffRules || [];
    if (!PRICING || typeof PRICING.loadClientTariffRules !== 'function') return [];
    try {
      const rules = await PRICING.loadClientTariffRules(clientId);
      state.tariffRules = rules || [];
      if ($('tariffInfo')) {
        $('tariffInfo').textContent = state.tariffRules.length
          ? `${state.tariffRules.length} règle(s) tarifaire(s) active(s) chargée(s).`
          : 'Aucune règle tarifaire active: les prix seront marqués à valider.';
      }
      renderTariffOptions();
      return state.tariffRules;
    } catch (error) {
      state.tariffRules = [];
      if ($('tariffInfo')) $('tariffInfo').textContent = `Tarifs indisponibles: ${error.message}`;
      renderTariffOptions();
      return [];
    }
  }

  function renderTariffOptions() {
    const select = $('defaultTariffCode');
    const panel = $('tariffOptionsPanel');
    const list = $('tariffOptionsList');
    if (!select || !panel || !list) return;

    const current = select.value || (state.activeProfile?.default_values?.tariff_code || '');
    const rules = (state.tariffRules || []).filter((rule) => rule.tariff_code);
    select.innerHTML = '<option value="">Grille standard automatique</option>' + rules.map((rule) => {
      const code = String(rule.tariff_code || '').toUpperCase();
      const label = `${code} · ${rule.name || 'Tarif'}`;
      return `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`;
    }).join('');
    select.value = current && rules.some((rule) => String(rule.tariff_code || '').toUpperCase() === current) ? current : '';

    panel.hidden = !rules.length;
    list.innerHTML = rules.map((rule) => {
      const base = formatMoney(rule.base_price_chf);
      const kg = Number(rule.price_per_kg_chf || 0) > 0 ? ` + ${Number(rule.price_per_kg_chf).toFixed(2)} CHF/kg` : '';
      const min = rule.min_weight_kg != null ? `Dès ${Number(rule.min_weight_kg).toFixed(1)} kg` : 'Tous poids';
      return `
        <div class="tariff-option-card">
          <strong>${escapeHtml(String(rule.tariff_code || '').toUpperCase())} · ${escapeHtml(rule.name || 'Tarif')}</strong>
          <span>${escapeHtml(min)} · ${escapeHtml(base)}${escapeHtml(kg)}</span>
        </div>
      `;
    }).join('');
  }

  async function handleFileUpload(file) {
    if (!file) return;
    resetImportState(false);
    state.file = file;

    const extension = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setStatus('Format refusé. Importez un fichier .xlsx, .xls ou .csv.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus('Fichier trop volumineux. La limite est de 10 MB.', 'error');
      return;
    }

    state.fileType = extension === 'csv' ? 'csv' : 'excel';
    setBusy(true, 'Lecture du fichier...');
    try {
      const result = extension === 'csv' ? await parseCsvFile(file) : await parseExcelFile(file);
      state.headers = result.headers;
      state.rawRows = result.rows;
      state.delimiter = result.delimiter || null;

      if (!state.headers.length || !state.rawRows.length) {
        throw new Error('Le fichier est vide ou ne contient aucune ligne de données.');
      }

      const detected = MAPPING.detectColumnMapping(state.headers);
      state.mapping = mergeProfileMapping(detected, state.activeProfile?.column_mapping || {});
      renderPreview(state.rawRows);
      renderMappingInterface(state.headers, state.mapping);
      setStep(2);
      showSection('mappingSection', true);
      showSection('previewSection', true);
      setStatus(`${state.rawRows.length} ligne(s) détectée(s), ${state.headers.length} colonne(s). Vérifiez le mapping avant de continuer.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible de lire le fichier.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function mergeProfileMapping(detectedMapping, profileMapping) {
    const merged = Object.assign({}, detectedMapping || {});
    const normalizedHeaders = new Set(state.headers.map((header) => MAPPING.normalizeHeader(header)));
    Object.entries(profileMapping || {}).forEach(([header, field]) => {
      const exactHeader = state.headers.find((h) => MAPPING.normalizeHeader(h) === MAPPING.normalizeHeader(header));
      if (exactHeader && normalizedHeaders.has(MAPPING.normalizeHeader(exactHeader))) merged[exactHeader] = field;
    });
    return merged;
  }

  function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target.result, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) throw new Error('Le fichier Excel ne contient aucune feuille.');
          const sheet = workbook.Sheets[firstSheetName];
          const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false });
          if (!matrix.length) throw new Error('La première feuille Excel est vide.');
          const headers = (matrix[0] || []).map((header, index) => normalizeValue(header) || `Colonne ${index + 1}`);
          const rows = matrix.slice(1).map((line) => {
            const row = {};
            headers.forEach((header, index) => {
              row[header] = normalizeValue(line[index]);
            });
            return row;
          }).filter((row) => Object.values(row).some((value) => normalizeValue(value)));
          resolve({ headers, rows });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier Excel.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', ';', '\t'],
        transformHeader: (header) => normalizeValue(header),
        complete: (results) => {
          const headers = (results.meta.fields || []).filter(Boolean);
          if (!headers.length) {
            reject(new Error('Le CSV ne contient pas d’en-tête exploitable.'));
            return;
          }
          const rows = (results.data || []).filter((row) => Object.values(row).some((value) => normalizeValue(value)));
          if (!rows.length) {
            reject(new Error('Le CSV ne contient aucune ligne de données.'));
            return;
          }
          resolve({ headers, rows, delimiter: results.meta.delimiter });
        },
        error: (error) => reject(new Error(error.message || 'Erreur de lecture CSV.'))
      });
    });
  }

  function renderPreview(rows) {
    const head = $('rawPreviewHead');
    const body = $('rawPreviewBody');
    if (!head || !body) return;
    head.innerHTML = `<tr>${state.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    body.innerHTML = rows.slice(0, 10).map((row) => {
      return `<tr>${state.headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>`;
    }).join('');
    if ($('fileMeta')) {
      $('fileMeta').textContent = `${state.file?.name || ''} • ${rows.length} ligne(s) • séparateur ${state.delimiter || 'auto'}`;
    }
  }

  function renderMappingInterface(headers, detectedMapping) {
    const body = $('mappingBody');
    if (!body) return;
    const options = buildFieldOptions();
    body.innerHTML = headers.map((header) => {
      const selected = detectedMapping[header] || '';
      return `
        <tr>
          <td>
            <strong>${escapeHtml(header)}</strong>
            <span class="sample-value">${escapeHtml(sampleForHeader(header))}</span>
          </td>
          <td>${selected ? `<span class="badge badge-info">${escapeHtml(FIELD_LABELS[selected] || selected)}</span>` : '<span class="badge badge-muted">Non détecté</span>'}</td>
          <td>
            <select class="mapping-select" data-header="${escapeAttribute(header)}">
              ${options.map((option) => `<option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
            </select>
          </td>
        </tr>
      `;
    }).join('');

    body.querySelectorAll('.mapping-select').forEach((select) => {
      select.addEventListener('change', () => {
        state.mapping[select.dataset.header] = select.value;
        renderMappingWarnings();
      });
    });
    renderMappingWarnings();
  }

  function buildFieldOptions() {
    const fields = [
      ['', 'Ignorer cette colonne'],
      ['external_reference', 'Référence client'],
      ['delivery_name', 'Nom destinataire'],
      ['delivery_address', 'Adresse livraison'],
      ['delivery_zip', 'NPA livraison'],
      ['delivery_city', 'Ville livraison'],
      ['parcel_count', 'Nombre de colis'],
      ['weight_kg', 'Poids kg'],
      ['delivery_phone', 'Téléphone'],
      ['delivery_email', 'Email'],
      ['delivery_instructions', 'Instructions'],
      ['requested_delivery_date', 'Date souhaitée'],
      ['service_level', 'Niveau de service'],
      ['tariff_code', 'Code tarif'],
      ['pickup_name', 'Nom enlèvement'],
      ['pickup_address', 'Adresse enlèvement'],
      ['pickup_zip', 'NPA enlèvement'],
      ['pickup_city', 'Ville enlèvement'],
      ['distance_km', 'Distance km']
    ];
    return fields.map(([value, label]) => ({ value, label }));
  }

  function renderMappingWarnings() {
    const validation = MAPPING.validateMapping(state.mapping);
    const box = $('mappingWarnings');
    if (!box) return;
    if (validation.valid) {
      box.className = 'callout callout-success';
      box.innerHTML = 'Mapping complet: tous les champs obligatoires sont associés.';
    } else {
      box.className = 'callout callout-warning';
      box.innerHTML = `Champs obligatoires manquants: ${validation.missingFields.map((field) => escapeHtml(FIELD_LABELS[field] || field)).join(', ')}`;
    }
  }

  function sampleForHeader(header) {
    const row = state.rawRows.find((item) => normalizeValue(item[header]));
    const value = row ? normalizeValue(row[header]) : '';
    return value ? `Exemple: ${value.slice(0, 70)}` : 'Aucune valeur exemple';
  }

  async function saveImportProfile() {
    if (!state.clientId) throw new Error('Client introuvable.');
    const validation = MAPPING.validateMapping(state.mapping);
    if (!validation.valid) {
      setStatus(`Impossible de sauvegarder: mapping incomplet (${validation.missingFields.join(', ')}).`, 'error');
      return null;
    }

    const db = getDb();
    const profileName = normalizeValue($('profileName')?.value) || `Profil ${new Date().toLocaleDateString('fr-CH')}`;
    const defaultValues = getDefaultValuesFromForm();

    setBusy(true, 'Sauvegarde du profil...');
    try {
      if (state.isLegacySession) {
        const { data, error } = await db.rpc('client_import_save_profile', getLegacyRpcPayload({
          p_profile_name: profileName,
          p_file_type: state.fileType,
          p_delimiter: state.delimiter,
          p_column_mapping: state.mapping,
          p_default_values: defaultValues
        }));
        if (error) throw error;
        state.activeProfile = data;
        if ($('profileHint')) $('profileHint').textContent = `Profil actif sauvegardé: ${profileName}`;
        setStatus('Profil d’importation sauvegardé.', 'success');
        return data;
      }

      await db.from('client_import_profiles').update({ is_active: false }).eq('client_id', state.clientId).eq('is_active', true);
      const { data, error } = await db
        .from('client_import_profiles')
        .insert([{
          client_id: state.clientId,
          profile_name: profileName,
          file_type: state.fileType,
          delimiter: state.delimiter,
          has_header: true,
          column_mapping: state.mapping,
          default_values: defaultValues,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      state.activeProfile = data;
      if ($('profileHint')) $('profileHint').textContent = `Profil actif sauvegardé: ${profileName}`;
      setStatus('Profil d’importation sauvegardé.', 'success');
      return data;
    } catch (error) {
      setStatus(`Erreur sauvegarde profil: ${error.message}`, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function validateAndPreviewImport() {
    const validation = MAPPING.validateMapping(state.mapping);
    if (!validation.valid) {
      setStatus(`Mapping incomplet: ${validation.missingFields.map((f) => FIELD_LABELS[f] || f).join(', ')}`, 'error');
      return;
    }

    setBusy(true, 'Validation des lignes et détection des doublons...');
    try {
      state.mappedRows = state.rawRows.map((row, index) => {
        const order = MAPPING.applyMapping(row, state.mapping, getDefaultValuesFromForm());
        return normalizeOrder(order, row, index + 2);
      });

      const references = state.mappedRows.map((item) => item.external_reference).filter(Boolean);
      state.duplicateReferences = await checkDuplicates(state.orderClientId || state.clientId, references);
      validateRows(state.mappedRows);
      await calculatePrices(state.mappedRows);
      const summary = buildSummary();
      state.summary = summary;
      renderImportSummary(summary);
      renderValidatedRows();
      showSection('summarySection', true);
      showSection('validatedPreviewSection', true);
      $('validatedPreviewSection')?.classList.add('is-collapsed');
      setStep(6);
      renderNextAction(summary);
      setDecisionFeedback('', 'info');
      $('importNextAction')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setStatus('Étape 6 prête: vérifiez le résumé puis cliquez sur “Étape 7 · Importer maintenant”.', 'success');
    } catch (error) {
      setStatus(`Erreur de validation: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function normalizeOrder(order, rawRow, lineNumber) {
    const normalized = Object.assign({}, order);
    normalized.external_reference = normalizeValue(normalized.external_reference);
    normalized.delivery_name = normalizeValue(normalized.delivery_name);
    normalized.delivery_address = normalizeValue(normalized.delivery_address);
    normalized.delivery_zip = normalizeValue(normalized.delivery_zip);
    normalized.delivery_city = normalizeValue(normalized.delivery_city);
    normalized.delivery_phone = normalizeValue(normalized.delivery_phone);
    normalized.delivery_email = normalizeValue(normalized.delivery_email);
    normalized.delivery_instructions = normalizeValue(normalized.delivery_instructions);
    normalized.tariff_code = normalizeValue(normalized.tariff_code).toUpperCase() || normalizeValue($('defaultTariffCode')?.value).toUpperCase();
    normalized.pickup_name = normalizeValue(normalized.pickup_name);
    normalized.pickup_address = normalizeValue(normalized.pickup_address);
    normalized.pickup_zip = normalizeValue(normalized.pickup_zip);
    normalized.pickup_city = normalizeValue(normalized.pickup_city);
    normalized.service_level = normalizeValue(normalized.service_level) || normalizeValue($('defaultServiceLevel')?.value) || 'eco_48h';
    normalized.parcel_count = toInteger(normalized.parcel_count);
    normalized.weight_kg = toNumber(normalized.weight_kg);
    normalized.distance_km = toNumber(normalized.distance_km);
    normalized.line_number = lineNumber;
    normalized.raw_import_data = rawRow;
    normalized.validation_errors = [];
    normalized.validation_warnings = [];
    normalized.row_status = 'pending';
    return normalized;
  }

  function validateRows(mappedRows) {
    const seen = new Set();
    state.errors = [];
    state.warnings = [];

    mappedRows.forEach((order) => {
      order.validation_errors = [];
      order.validation_warnings = [];

      REQUIRED_FIELDS.forEach((field) => {
        if (!normalizeValue(order[field]) && field !== 'parcel_count') {
          addRowError(order, field, `${FIELD_LABELS[field] || field} manquant`, order[field]);
        }
      });

      if (!Number.isInteger(order.parcel_count) || order.parcel_count < 1) {
        addRowError(order, 'parcel_count', 'Nombre de colis invalide', order.parcel_count);
      }

      const refKey = MAPPING.normalizeHeader(order.external_reference || '');
      if (refKey && seen.has(refKey)) {
        addRowError(order, 'external_reference', 'Doublon dans le fichier importé', order.external_reference);
      }
      if (refKey) seen.add(refKey);

      if (order.external_reference && state.duplicateReferences.has(order.external_reference)) {
        addRowError(order, 'external_reference', 'Référence déjà importée pour ce client', order.external_reference);
      }

      if (!order.delivery_phone) addRowWarning(order, 'delivery_phone', 'Téléphone absent', '');
      if (!order.delivery_email) addRowWarning(order, 'delivery_email', 'Email absent', '');
      if (order.weight_kg === null) addRowWarning(order, 'weight_kg', 'Poids absent', '');
      if (!order.delivery_instructions) addRowWarning(order, 'delivery_instructions', 'Instruction vide', '');
      if (!order.service_level) {
        order.service_level = 'eco_48h';
        addRowWarning(order, 'service_level', 'Service absent, valeur par défaut utilisée', 'eco_48h');
      }

      order.row_status = order.validation_errors.length ? 'error' : 'valid';
    });

    return mappedRows;
  }

  function addRowError(order, field, message, value) {
    const item = {
      line_number: order.line_number,
      reference: order.external_reference || '',
      field,
      message,
      value: value === null || value === undefined ? '' : value
    };
    order.validation_errors.push(item);
    state.errors.push(item);
  }

  function addRowWarning(order, field, message, value) {
    const item = {
      line_number: order.line_number,
      reference: order.external_reference || '',
      field,
      message,
      value: value === null || value === undefined ? '' : value
    };
    order.validation_warnings.push(item);
    state.warnings.push(item);
  }

  async function checkDuplicates(clientId, references) {
    const db = getDb();
    const cleanRefs = Array.from(new Set((references || []).map(normalizeValue).filter(Boolean)));
    const duplicates = new Set();
    if (!cleanRefs.length) return duplicates;

    if (state.isLegacySession) {
      const { data, error } = await db.rpc('client_import_check_duplicates', getLegacyRpcPayload({
        p_refs: cleanRefs
      }));
      if (error) throw error;
      (data || []).forEach((ref) => duplicates.add(ref));
      return duplicates;
    }

    const chunkSize = 100;
    for (let i = 0; i < cleanRefs.length; i += chunkSize) {
      const chunk = cleanRefs.slice(i, i + chunkSize);
      const { data, error } = await db
        .from('orders')
        .select('external_reference')
        .eq('client_id', clientId)
        .in('external_reference', chunk);
      if (error) throw error;
      (data || []).forEach((row) => duplicates.add(row.external_reference));
    }
    return duplicates;
  }

  async function calculatePrices(mappedRows) {
    if (!state.tariffRules.length) await loadClientTariffRules(state.clientId);

    mappedRows.forEach((order) => {
      if (order.validation_errors.length) {
        order.pricing_status = 'not_calculated';
        order.total_price_chf = null;
        order.unit_price_chf = null;
        order.pricing_details = {};
        return;
      }

      const rule = PRICING.selectTariffRule(order, state.tariffRules);
      if (!rule) {
        order.pricing_status = 'needs_review';
        order.tariff_rule_id = null;
        order.unit_price_chf = null;
        order.total_price_chf = null;
        order.pricing_details = { reason: 'Aucune règle tarifaire active ne correspond à cette ligne.' };
        addRowWarning(order, 'pricing', 'Prix à valider: aucune règle tarifaire correspondante', '');
        return;
      }

      const result = PRICING.calculateOrderPrice(order, rule);
      order.pricing_status = 'calculated';
      order.tariff_rule_id = rule.id;
      order.unit_price_chf = result.unit_price_chf;
      order.total_price_chf = result.total_price_chf;
      order.pricing_details = PRICING.buildPricingDetails(order, rule, result);
    });

    state.pricedRows = mappedRows;
    return mappedRows;
  }

  async function createImportBatch(summary) {
    const db = getDb();
    if (state.isLegacySession) {
      const { data, error } = await db.rpc('client_import_create_batch', getLegacyRpcPayload({
        p_import_profile_id: state.activeProfile?.id || null,
        p_file_name: state.file?.name || null,
        p_file_type: state.fileType,
        p_summary: summary,
        p_errors: state.errors
      }));
      if (error) throw error;
      state.batchId = data;
      return { id: data };
    }

    const { data, error } = await db
      .from('import_batches')
      .insert([{
        client_id: state.clientId,
        import_profile_id: state.activeProfile?.id || null,
        file_name: state.file?.name || null,
        file_type: state.fileType,
        total_rows: summary.totalRows,
        valid_rows: summary.validRows,
        error_rows: summary.errorRows,
        duplicate_rows: summary.duplicateRows,
        imported_rows: 0,
        total_estimated_price_chf: summary.totalEstimatedPrice,
        status: 'draft',
        error_report: state.errors
      }])
      .select()
      .single();

    if (error) throw error;
    state.batchId = data.id;
    return data;
  }

  async function insertOrders(validRows, importBatchId) {
    const db = getDb();
    const payload = validRows.map((order) => ({
      client_id: state.orderClientId || state.clientId,
      external_reference: order.external_reference,
      delivery_name: order.delivery_name,
      delivery_address: order.delivery_address,
      delivery_zip: order.delivery_zip,
      delivery_city: order.delivery_city,
      delivery_phone: order.delivery_phone || null,
      delivery_email: order.delivery_email || null,
      delivery_instructions: order.delivery_instructions || null,
      pickup_name: order.pickup_name || null,
      pickup_address: order.pickup_address || null,
      pickup_zip: order.pickup_zip || null,
      pickup_city: order.pickup_city || null,
      parcel_count: order.parcel_count || 1,
      weight_kg: order.weight_kg,
      service_level: order.service_level || null,
      tariff_code: order.tariff_code || null,
      status: 'pending',
      source_system: 'client_import',
      import_batch_id: importBatchId,
      tariff_rule_id: order.tariff_rule_id || null,
      unit_price_chf: order.unit_price_chf,
      total_price_chf: order.total_price_chf,
      pricing_status: order.pricing_status || 'needs_review',
      pricing_details: order.pricing_details || {},
      raw_import_data: order.raw_import_data || {},
      distance_km: order.distance_km,
      estimated_duration_min: order.estimated_duration_min || null
    }));

    if (!payload.length) return [];
    if (state.isLegacySession) {
      const { data, error } = await db.rpc('client_import_insert_orders', getLegacyRpcPayload({
        p_batch_id: importBatchId,
        p_orders: payload
      }));
      if (error) throw error;
      const count = Number(data?.imported_rows || 0);
      return Array.from({ length: count }, (_, index) => ({ id: `${importBatchId}-${index + 1}` }));
    }

    const { data, error } = await db.from('orders').insert(payload).select('id,external_reference,total_price_chf,pricing_status');
    if (error) throw error;
    return data || [];
  }

  async function importValidRows() {
    if (state.importInProgress) return;
    if (!state.summary) {
      setStatus('Validez d’abord le fichier avant importation.', 'error');
      setDecisionFeedback('Étape 7 bloquée: il faut d’abord finir la prévisualisation à l’étape 6.', 'error');
      return;
    }
    const rowsToImport = state.mappedRows.filter((order) => !order.validation_errors.length);
    if (!rowsToImport.length) {
      setStatus('Aucune ligne valide à importer.', 'error');
      setDecisionFeedback('Aucune ligne ne peut être importée pour le moment. Corrigez les erreurs puis cliquez sur “Recalculer / Revalider”.', 'error');
      return;
    }

    state.importInProgress = true;
    setImportButtonBusy(true);
    setDecisionFeedback('Import en cours: création du lot et des transports dans Supabase...', 'info');
    setBusy(true, 'Création des transports...');
    let success = false;
    try {
      const batch = await createImportBatch(state.summary);
      const inserted = await insertOrders(rowsToImport, batch.id);
      const db = getDb();
      if (!state.isLegacySession) {
        await db
          .from('import_batches')
          .update({
            imported_rows: inserted.length,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', batch.id)
          .eq('client_id', state.clientId);
      }

      setStep(7);
      setStatus(`${inserted.length} transport(s) importé(s) avec succès.`, 'success');
      setDecisionFeedback(`${inserted.length} transport(s) importé(s). L’étape 7 est terminée.`, 'success');
      setImportButtonBusy(false);
      if ($('btnImportValidBottom')) $('btnImportValidBottom').disabled = true;
      if ($('importResult')) {
        $('importResult').hidden = false;
        $('importResult').innerHTML = `<strong>Import terminé.</strong> Lot ${escapeHtml(batch.id)} créé avec ${inserted.length} ligne(s).`;
      }
      success = true;
    } catch (error) {
      setStatus(`Import impossible: ${error.message}`, 'error');
      setDecisionFeedback(`Import impossible: ${error.message}`, 'error');
    } finally {
      state.importInProgress = false;
      setBusy(false);
      if (!success) setImportButtonBusy(false);
    }
  }

  function buildSummary() {
    const totalRows = state.mappedRows.length;
    const errorRows = state.mappedRows.filter((row) => row.validation_errors.length).length;
    const validRows = totalRows - errorRows;
    const duplicateRows = state.mappedRows.filter((row) => row.validation_errors.some((e) => /doublon|déjà importée/i.test(e.message))).length;
    const pricedRows = state.mappedRows.filter((row) => row.pricing_status === 'calculated').length;
    const priceReviewRows = state.mappedRows.filter((row) => row.pricing_status === 'needs_review').length;
    const totalEstimatedPrice = state.mappedRows.reduce((sum, row) => sum + (Number(row.total_price_chf) || 0), 0);
    return { totalRows, validRows, errorRows, duplicateRows, pricedRows, priceReviewRows, totalEstimatedPrice };
  }

  function renderImportSummary(summary) {
    const grid = $('summaryGrid');
    if (!grid) return;
    grid.innerHTML = [
      ['Lignes totales', summary.totalRows],
      ['Lignes valides', summary.validRows],
      ['Lignes avec erreurs', summary.errorRows],
      ['Doublons', summary.duplicateRows],
      ['Prix calculés', summary.pricedRows],
      ['Prix à valider', summary.priceReviewRows],
      ['Total estimé', formatMoney(summary.totalEstimatedPrice)]
    ].map(([label, value]) => `
      <div class="summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('');
  }

  function renderNextAction(summary) {
    const box = $('importNextAction');
    if (!box) return;
    box.hidden = false;
    const title = $('importNextTitle');
    const text = $('importNextText');
    const bottomButton = $('btnImportValidBottom');
    const canImport = summary.validRows > 0;
    if (title) title.textContent = canImport ? `${summary.validRows} ligne(s) prête(s) pour l’étape 7` : 'Aucune ligne valide à importer';
    if (text) {
      text.textContent = canImport
        ? `${summary.errorRows} ligne(s) resteront bloquées. Total estimé: ${formatMoney(summary.totalEstimatedPrice)}.`
        : 'Corrigez le mapping ou le fichier, puis relancez la prévisualisation.';
    }
    if (bottomButton) bottomButton.disabled = !canImport;
    setImportButtonBusy(false);
  }

  function renderValidatedRows() {
    const body = $('validatedRowsBody');
    if (!body) return;
    body.innerHTML = state.mappedRows.map((row) => {
      const status = row.validation_errors.length ? 'Erreur' : 'Valide';
      const pricing = row.pricing_status === 'calculated' ? 'Prix calculé' : row.pricing_status === 'needs_review' ? 'Prix à valider' : 'Prix incomplet';
      const message = row.validation_errors.concat(row.validation_warnings).map((item) => item.message).join(' • ');
      return `
        <tr class="${row.validation_errors.length ? 'row-error' : ''}">
          <td><span class="badge ${row.validation_errors.length ? 'badge-error' : 'badge-success'}">${status}</span></td>
          <td>${escapeHtml(row.external_reference)}</td>
          <td>${escapeHtml(row.delivery_name)}</td>
          <td>${escapeHtml(row.delivery_city)}</td>
          <td>${escapeHtml(row.parcel_count)}</td>
          <td>${escapeHtml(row.weight_kg ?? '-')}</td>
          <td>${escapeHtml(row.tariff_code || row.service_level || '-')}</td>
          <td><span class="badge ${row.pricing_status === 'calculated' ? 'badge-success' : 'badge-warning'}">${pricing}</span><br>${escapeHtml(formatMoney(row.total_price_chf))}</td>
          <td>${escapeHtml(message || 'OK')}</td>
        </tr>
      `;
    }).join('');
  }

  function downloadErrorReport() {
    if (!CSV_REPORT) return;
    const errors = state.errors.concat(state.warnings);
    if (!errors.length) {
      setStatus('Aucune erreur ou alerte à télécharger.', 'info');
      return;
    }
    CSV_REPORT.downloadErrorCsv(errors, `rapport-erreurs-import-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function resetImportState(keepFileInput) {
    state.file = null;
    state.fileType = null;
    state.delimiter = null;
    state.rawRows = [];
    state.headers = [];
    state.mapping = {};
    state.mappedRows = [];
    state.duplicateReferences = new Set();
    state.errors = [];
    state.warnings = [];
    state.pricedRows = [];
    state.summary = null;
    state.batchId = null;
    state.importInProgress = false;
    state.orderClientId = state.profile?.id || state.authContext?.userId || state.clientId || null;

    if (!keepFileInput && $('fileInput')) $('fileInput').value = '';
    ['mappingSection', 'previewSection', 'summarySection', 'validatedPreviewSection', 'importResult', 'importNextAction'].forEach((id) => showSection(id, false));
    $('validatedPreviewSection')?.classList.remove('is-collapsed');
    if ($('rawPreviewHead')) $('rawPreviewHead').innerHTML = '';
    if ($('rawPreviewBody')) $('rawPreviewBody').innerHTML = '';
    if ($('mappingBody')) $('mappingBody').innerHTML = '';
    if ($('validatedRowsBody')) $('validatedRowsBody').innerHTML = '';
    if ($('summaryGrid')) $('summaryGrid').innerHTML = '';
    setDecisionFeedback('', 'info');
    setImportButtonBusy(false);
    setStep(1);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  async function initImportPage() {
    setBusy(true, 'Chargement du portail import...');
    try {
      await getCurrentClient();
      await loadActiveImportProfile();
      await loadClientTariffRules(state.clientId);
      bindEvents();
      setStep(1);
      setStatus('Prêt. Déposez un fichier Excel ou CSV pour commencer.', 'info');
    } catch (error) {
      setStatus(error.message, 'error');
      if (!state.isLegacySession) showSection('uploadSection', false);
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    const fileInput = $('fileInput');
    const dropzone = $('dropzone');

    if (fileInput) {
      fileInput.addEventListener('change', (event) => handleFileUpload(event.target.files[0]));
    }

    if (dropzone) {
      dropzone.addEventListener('click', () => fileInput?.click());
      dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
      dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
        handleFileUpload(event.dataTransfer.files[0]);
      });
    }

    $('btnSaveProfile')?.addEventListener('click', saveImportProfile);
    $('btnValidateRows')?.addEventListener('click', validateAndPreviewImport);
    $('btnRecalculate')?.addEventListener('click', validateAndPreviewImport);
    $('btnTogglePreview')?.addEventListener('click', () => {
      const section = $('validatedPreviewSection');
      if (!section) return;
      section.hidden = false;
      section.classList.toggle('is-collapsed');
      if (!section.classList.contains('is-collapsed')) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    $('btnDownloadErrors')?.addEventListener('click', downloadErrorReport);
    $('btnReset')?.addEventListener('click', () => {
      resetImportState();
      setStatus('Import annulé. Vous pouvez déposer un nouveau fichier.', 'info');
    });
  }

  window.ColixoClientImport = {
    initImportPage,
    getCurrentClient,
    handleFileUpload,
    parseExcelFile,
    parseCsvFile,
    renderPreview,
    renderMappingInterface,
    saveImportProfile,
    loadActiveImportProfile,
    validateRows,
    checkDuplicates,
    calculatePrices,
    createImportBatch,
    insertOrders,
    importValidRows,
    renderImportSummary,
    resetImportState
  };

  document.addEventListener('DOMContentLoaded', initImportPage);
})();
