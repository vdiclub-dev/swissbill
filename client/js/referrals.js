(function () {
  'use strict';

  var CLIENT_ROLES = ['client', 'gestionnaire', 'comptable', 'sous_utilisateur'];
  var DEFAULT_SETTINGS = {
    reward_amount_chf: 100,
    minimum_paid_revenue_chf: 500,
    max_invoice_deduction_percent: 50
  };

  var state = {
    auth: null,
    profile: null,
    clientId: null,
    legacyCode: null,
    isLegacy: false,
    company: null,
    settings: DEFAULT_SETTINGS,
    referrals: [],
    credits: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getDb() {
    var db = window.SUPABASE_CLIENT || window.supabaseClient || null;
    if (!db || typeof db.from !== 'function') {
      throw new Error('Client Supabase introuvable. Verifiez config.js.');
    }
    return db;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toNumber(value) {
    var n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(value) {
    return toNumber(value).toLocaleString('fr-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' CHF';
  }

  function formatDate(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function setStatus(message, type) {
    var box = $('referralStatus');
    if (!box) return;
    box.textContent = message || '';
    box.className = 'status ' + (type || 'info');
    box.hidden = !message;
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return normalizeText(value).toLowerCase();
  }

  function normalizePhone(value) {
    return normalizeText(value).replace(/[^\d+]/g, '');
  }

  function readStoredPortalClient() {
    try {
      var raw = localStorage.getItem('colixo_user');
      if (!raw) return null;
      var user = JSON.parse(raw);
      if (!user || !user.id || CLIENT_ROLES.indexOf(user.role) === -1) return null;
      var code = user.code || user.code_usr || user.code_acces || user.code_connexion || null;
      if (!code) {
        try { code = localStorage.getItem('colixo_access_code'); } catch (error) {}
      }
      return {
        session: null,
        authUser: null,
        profile: user,
        userId: user.id,
        role: user.role,
        isLegacy: true,
        legacyCode: code,
        profileLookup: 'localStorage'
      };
    } catch (error) {
      return null;
    }
  }

  function getClientIdFromProfile(profile, auth) {
    return profile && (profile.entreprise_id || profile.client_id || profile.id) || auth && auth.userId || null;
  }

  async function getCurrentClient() {
    if (typeof window.colixoGetAuthContext !== 'function') {
      throw new Error('Protection de route indisponible. Verifiez js/auth.js.');
    }

    var auth = await window.colixoGetAuthContext({
      roles: CLIENT_ROLES,
      legacyRoles: CLIENT_ROLES
    });

    if (!auth || !auth.profile) {
      auth = readStoredPortalClient();
    }

    if (!auth || !auth.profile) {
      throw new Error('Connectez-vous au portail client pour ouvrir les recommandations.');
    }

    var db = getDb();
    var profile = auth.profile;
    var clientId = getClientIdFromProfile(profile, auth);
    var company = null;

    if (profile.entreprise_id) {
      var companyRes = await db
        .from('entreprises')
        .select('id,nom,ville,email,telephone')
        .eq('id', profile.entreprise_id)
        .maybeSingle();
      if (!companyRes.error) company = companyRes.data || null;
    }

    state.auth = auth;
    state.profile = profile;
    state.clientId = clientId;
    state.company = company;
    state.isLegacy = Boolean(auth.isLegacy || !auth.session);
    state.legacyCode = auth.legacyCode || profile.code || profile.code_usr || (typeof window.colixoGetStoredCode === 'function' ? window.colixoGetStoredCode() : null);

    var name = company && company.nom
      ? company.nom
      : [profile.prenom, profile.nom].filter(Boolean).join(' ') || profile.email || 'Client Colixo';
    if ($('clientName')) $('clientName').textContent = name;

    return { profile: profile, clientId: clientId, company: company };
  }

  function getLegacyRpcPayload(extra) {
    if (!state.profile || !state.profile.id || !state.legacyCode) {
      throw new Error('Session code client incomplete. Reconnectez-vous au portail client.');
    }
    return Object.assign({
      p_user_id: state.profile.id,
      p_code: String(state.legacyCode).trim().toUpperCase()
    }, extra || {});
  }

  function unpackDashboard(data) {
    var payload = data || {};
    state.clientId = payload.client_id || state.clientId;
    state.referrals = Array.isArray(payload.referrals) ? payload.referrals : [];
    state.credits = Array.isArray(payload.credits) ? payload.credits : [];
    state.settings = Object.assign({}, DEFAULT_SETTINGS, payload.settings || {});
    return payload;
  }

  async function loadLegacyDashboard() {
    var db = getDb();
    var res = await db.rpc('client_referral_dashboard_by_code', getLegacyRpcPayload());
    if (res.error) throw res.error;
    return unpackDashboard(res.data || {});
  }

  async function loadReferralSettings() {
    if (state.isLegacy) {
      return state.settings || DEFAULT_SETTINGS;
    }

    var db = getDb();
    var res = await db
      .from('referral_settings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!res.error && res.data) {
      state.settings = Object.assign({}, DEFAULT_SETTINGS, res.data);
    }
    return state.settings;
  }

  function validateReferralForm(formData) {
    var payload = {
      recommended_company_name: normalizeText(formData.get('recommended_company_name')),
      recommended_contact_name: normalizeText(formData.get('recommended_contact_name')),
      recommended_contact_role: normalizeText(formData.get('recommended_contact_role')),
      recommended_email: normalizeEmail(formData.get('recommended_email')),
      recommended_phone: normalizePhone(formData.get('recommended_phone')),
      recommended_city: normalizeText(formData.get('recommended_city')),
      recommended_canton: normalizeText(formData.get('recommended_canton')),
      recommended_sector: normalizeText(formData.get('recommended_sector')),
      estimated_daily_parcels: normalizeText(formData.get('estimated_daily_parcels')),
      message: normalizeText(formData.get('message')),
      consent_confirmed: formData.get('consent_confirmed') === 'on'
    };

    var errors = [];
    if (!payload.recommended_company_name) errors.push('Le nom de l’entreprise est obligatoire.');
    if (!payload.recommended_email && !payload.recommended_phone) errors.push('Ajoutez au minimum un email ou un telephone.');
    if (!payload.recommended_city) errors.push('La ville est obligatoire.');
    if (!payload.consent_confirmed) errors.push('Le consentement professionnel est obligatoire.');
    if (payload.recommended_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.recommended_email)) {
      errors.push('L’email du contact n’est pas valide.');
    }

    if (payload.estimated_daily_parcels) {
      var parcels = Number(payload.estimated_daily_parcels);
      if (!Number.isInteger(parcels) || parcels < 0) {
        errors.push('Le volume estime doit etre un nombre entier positif.');
      } else {
        payload.estimated_daily_parcels = parcels;
      }
    } else {
      payload.estimated_daily_parcels = null;
    }

    return { valid: errors.length === 0, errors: errors, payload: payload };
  }

  async function submitReferral(formData) {
    var validation = validateReferralForm(formData);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    var db = getDb();
    var payload = validation.payload;

    if (state.isLegacy) {
      var rpc = await db.rpc('client_submit_referral_by_code', getLegacyRpcPayload({ p_payload: payload }));
      if (rpc.error) throw rpc.error;
      return rpc.data;
    }

    var insertPayload = Object.assign({}, payload, {
      referrer_client_id: state.clientId,
      referrer_user_id: state.auth && state.auth.userId || state.profile.id,
      status: 'submitted',
      reward_status: 'not_eligible',
      referred_client_revenue_paid_chf: 0
    });

    var res = await db
      .from('referrals')
      .insert(insertPayload)
      .select('id')
      .single();

    if (res.error) {
      if (res.error.code === '23505') {
        throw new Error('Cette entreprise ou cet email a deja ete recommande par votre compte.');
      }
      throw res.error;
    }
    return res.data && res.data.id;
  }

  async function loadReferralHistory(clientId) {
    if (state.isLegacy) {
      await loadLegacyDashboard();
      return state.referrals;
    }

    var db = getDb();
    var res = await db
      .from('referrals')
      .select('*')
      .eq('referrer_client_id', clientId)
      .order('created_at', { ascending: false });

    if (res.error) throw res.error;
    state.referrals = res.data || [];
    return state.referrals;
  }

  async function loadReferralStats(clientId) {
    if (state.isLegacy && (!state.referrals.length && !state.credits.length)) {
      await loadLegacyDashboard();
    }

    if (!state.isLegacy && window.ColixoReferralCredits) {
      state.credits = await window.ColixoReferralCredits.loadClientRewardCredits(clientId);
    }

    var referrals = state.referrals || [];
    var credits = state.credits || [];
    var approvedStatuses = ['approved', 'used'];
    var pendingStatuses = ['submitted', 'contacted', 'qualified', 'converted', 'reward_pending'];
    var totalGained = window.ColixoReferralCredits
      ? window.ColixoReferralCredits.calculateTotalCredits(credits)
      : credits.reduce(function (sum, credit) { return sum + toNumber(credit.amount_chf); }, 0);
    var used = window.ColixoReferralCredits
      ? window.ColixoReferralCredits.calculateUsedCredits(credits)
      : credits.reduce(function (sum, credit) { return sum + toNumber(credit.used_amount_chf); }, 0);
    var available = calculateAvailableCredit(credits);

    return {
      total: referrals.length,
      pending: referrals.filter(function (r) { return pendingStatuses.indexOf(r.status) !== -1; }).length,
      approved: referrals.filter(function (r) { return approvedStatuses.indexOf(r.reward_status) !== -1; }).length,
      totalGained: totalGained,
      used: used,
      available: available
    };
  }

  function calculateAvailableCredit(credits) {
    if (window.ColixoReferralCredits) {
      return window.ColixoReferralCredits.calculateAvailableCredits(credits || []);
    }
    return (credits || []).reduce(function (sum, credit) {
      if (credit.status !== 'available' && credit.status !== 'partially_used') return sum;
      return sum + toNumber(credit.remaining_amount_chf);
    }, 0);
  }

  function renderReferralStats(stats) {
    if ($('statTotal')) $('statTotal').textContent = String(stats.total || 0);
    if ($('statPending')) $('statPending').textContent = String(stats.pending || 0);
    if ($('statApproved')) $('statApproved').textContent = String(stats.approved || 0);
    if ($('statAvailable')) $('statAvailable').textContent = formatMoney(stats.available || 0);
  }

  function renderReferralStatusBadge(status) {
    var labels = {
      submitted: 'Reçue',
      contacted: 'Contacté',
      qualified: 'Qualifié',
      converted: 'Client actif',
      reward_pending: 'Crédit en attente',
      reward_approved: 'Crédit validé',
      reward_used: 'Crédit utilisé',
      rejected: 'Refusé'
    };
    var key = status || 'submitted';
    return '<span class="badge ' + escapeHtml(key) + '">' + escapeHtml(labels[key] || key) + '</span>';
  }

  function renderRewardStatusBadge(status) {
    var labels = {
      not_eligible: 'Non éligible',
      pending: 'En attente',
      approved: 'Validé',
      used: 'Utilisé',
      rejected: 'Refusé'
    };
    var key = status || 'not_eligible';
    return '<span class="badge ' + escapeHtml(key) + '">' + escapeHtml(labels[key] || key) + '</span>';
  }

  function renderReferralHistory(referrals) {
    var body = $('referralHistory');
    if (!body) return;
    var rows = referrals || [];

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">Aucune recommandation pour le moment.</td></tr>';
      return;
    }

    body.innerHTML = rows.map(function (item) {
      var potential = item.reward_amount_chf || state.settings.reward_amount_chf || 100;
      var validated = item.reward_status === 'approved' || item.reward_status === 'used'
        ? item.reward_amount_chf
        : 0;
      return '<tr>' +
        '<td>' + formatDate(item.created_at) + '</td>' +
        '<td><strong>' + escapeHtml(item.recommended_company_name || '-') + '</strong><br><small>' + escapeHtml(item.recommended_email || item.recommended_phone || '') + '</small></td>' +
        '<td>' + escapeHtml(item.recommended_city || '-') + '</td>' +
        '<td>' + escapeHtml(item.estimated_daily_parcels || '-') + '</td>' +
        '<td>' + renderReferralStatusBadge(item.status) + '<div class="reward-badge">' + renderRewardStatusBadge(item.reward_status) + '</div></td>' +
        '<td>' + formatMoney(potential) + '</td>' +
        '<td>' + (validated ? formatMoney(validated) : '-') + '</td>' +
        '<td>' + formatDate(item.reward_approved_at) + '</td>' +
      '</tr>';
    }).join('');
  }

  function showReferralSuccess() {
    setStatus('Recommandation envoyee. Colixo validera le credit seulement apres CHF 500.– factures et payes par le nouveau client.', 'ok');
  }

  function showReferralError(message) {
    setStatus('Erreur : ' + (message || 'recommandation impossible.'), 'err');
  }

  async function refreshDashboard() {
    if (state.isLegacy) {
      await loadLegacyDashboard();
    } else {
      await loadReferralSettings();
      await loadReferralHistory(state.clientId);
    }
    var stats = await loadReferralStats(state.clientId);
    renderReferralStats(stats);
    renderReferralHistory(state.referrals);
  }

  function setSubmitBusy(isBusy) {
    var btn = $('btnSubmitReferral');
    if (!btn) return;
    btn.disabled = Boolean(isBusy);
    btn.innerHTML = isBusy
      ? '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...'
      : '<i class="fas fa-paper-plane"></i> Envoyer la recommandation';
  }

  async function initReferralsPage() {
    try {
      setStatus('Chargement sécurisé du programme de parrainage...', 'info');
      await getCurrentClient();
      if (state.isLegacy) {
        await loadLegacyDashboard();
      } else {
        await loadReferralSettings();
      }
      await refreshDashboard();
      setStatus('Programme de parrainage prêt. Les crédits restent soumis à validation Colixo.', 'ok');
    } catch (error) {
      console.error('[Colixo referrals]', error);
      showReferralError(error.message || error);
    }

    var form = $('referralForm');
    if (form) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          setSubmitBusy(true);
          await submitReferral(new FormData(form));
          form.reset();
          showReferralSuccess();
          await refreshDashboard();
        } catch (error) {
          console.error('[Colixo referrals submit]', error);
          showReferralError(error.message || error);
        } finally {
          setSubmitBusy(false);
        }
      });
    }
  }

  window.ColixoReferrals = {
    initReferralsPage: initReferralsPage,
    getCurrentClient: getCurrentClient,
    loadReferralSettings: loadReferralSettings,
    submitReferral: submitReferral,
    validateReferralForm: validateReferralForm,
    loadReferralStats: loadReferralStats,
    loadReferralHistory: loadReferralHistory,
    renderReferralStats: renderReferralStats,
    renderReferralHistory: renderReferralHistory,
    renderReferralStatusBadge: renderReferralStatusBadge,
    renderRewardStatusBadge: renderRewardStatusBadge,
    calculateAvailableCredit: calculateAvailableCredit,
    showReferralSuccess: showReferralSuccess,
    showReferralError: showReferralError
  };

  window.initReferralsPage = initReferralsPage;
  window.getCurrentClient = getCurrentClient;
  window.loadReferralSettings = loadReferralSettings;
  window.submitReferral = submitReferral;
  window.validateReferralForm = validateReferralForm;
  window.loadReferralStats = loadReferralStats;
  window.loadReferralHistory = loadReferralHistory;
  window.renderReferralStats = renderReferralStats;
  window.renderReferralHistory = renderReferralHistory;
  window.renderReferralStatusBadge = renderReferralStatusBadge;
  window.renderRewardStatusBadge = renderRewardStatusBadge;
  window.calculateAvailableCredit = calculateAvailableCredit;
  window.showReferralSuccess = showReferralSuccess;
  window.showReferralError = showReferralError;

  document.addEventListener('DOMContentLoaded', initReferralsPage);
})();
