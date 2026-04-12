(function () {
  "use strict";

  var STORAGE_PROSPECTS = "brimot_mail_prospects_v1";
  var STORAGE_SETTINGS = "brimot_mail_settings_v1";
  var STORAGE_SENT_LOG = "brimot_mail_sent_log_v1";
  var STORAGE_CATEGORY_PROFILES = "brimot_mail_category_profiles_v1";
  var CATEGORY_PROFILES_TABLE = "mail_category_profiles";
  var TEMPLATE_ROOT = "/templates";
  var DATA_MODE_SUPABASE = "supabase";
  var DATA_MODE_LOCAL = "local";

  var SUPABASE_FALLBACK_CONFIG = {
    url: "https://iubbsnntcreneakbdkmv.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"
  };

  var DEFAULT_SETTINGS = {
    dailyLimit: 50,
    qualityMin: 70,
    activeBrand: "colixo",
    senderName: "Didier Gysling - Colixo",
    senderPhone: "+41 79 646 74 42",
    senderSignature: "Colixo\nDidier Gysling\nImpasse des Griottes 3, 1462 Yvonand\ninfo@colixo.ch\n+41 79 646 74 42"
  };

  var STATUS_LABELS = {
    new: "Nouveau",
    sent_j0: "Mail initial envoye",
    relance_j3: "Relance J+3 envoyee",
    relance_j7: "Relance J+7 envoyee",
    relance_j14: "Relance J+14 envoyee",
    replied: "A repondu",
    won: "Converti",
    lost: "Perdu",
    stop: "Stop"
  };

  var DEFAULT_CATEGORY_PROFILES = {
    regie: {
      label: "Regie immobiliere",
      subjectPrefix: "Optimiser vos interventions",
      focus: "planification des interventions, communication locataire et suivi terrain",
      cadences: { after1: 2, after2: 5, after3: 10 }
    },
    pme: {
      label: "PME services",
      subjectPrefix: "Gagner du temps operationnel",
      focus: "coordination equipe, suivi des missions et reactivite client",
      cadences: { after1: 3, after2: 6, after3: 12 }
    },
    ecommerce: {
      label: "E-commerce",
      subjectPrefix: "Fluidifier vos livraisons",
      focus: "orchestration des tournees, suivi client et fiabilite des delais",
      cadences: { after1: 1, after2: 3, after3: 7 }
    },
    industrie: {
      label: "Industrie",
      subjectPrefix: "Securiser vos flux logistiques",
      focus: "tracabilite, coordination quai/transport et pilotage des urgences",
      cadences: { after1: 4, after2: 7, after3: 14 }
    },
    sante: {
      label: "Sante",
      subjectPrefix: "Fiabiliser vos operations sensibles",
      focus: "respect des contraintes, priorisation des urgences et visibilite temps reel",
      cadences: { after1: 2, after2: 4, after3: 9 }
    },
    autre: {
      label: "Autre",
      subjectPrefix: "Presentation Colixo",
      focus: "pilotage des operations terrain, suivi client et performance quotidienne",
      cadences: { after1: 3, after2: 4, after3: 7 }
    }
  };

  var CATEGORY_KEYWORDS = {
    regie: ["regie", "immobilier", "immo", "syndic"],
    pme: ["pme", "service", "artisan", "cabinet"],
    ecommerce: ["ecommerce", "e-commerce", "shop", "retail", "boutique"],
    industrie: ["industrie", "usine", "production", "manufacturing"],
    sante: ["sante", "medical", "clinique", "hopital", "pharma"],
    autre: []
  };

  var dataMode = DATA_MODE_LOCAL;
  var stateProspects = [];
  var templateCache = {};

  var kpiQuota = document.getElementById("kpiQuota");
  var kpiDue = document.getElementById("kpiDue");
  var kpiReply = document.getElementById("kpiReply");
  var kpiBase = document.getElementById("kpiBase");
  var campaignMessage = document.getElementById("campaignMessage");
  var prospectRows = document.getElementById("prospectRows");
  var templatePreview = document.getElementById("templatePreview");
  var templatePreviewMeta = document.getElementById("templatePreviewMeta");
  var templatePreviewSubject = document.getElementById("templatePreviewSubject");
  var templatePreviewText = document.getElementById("templatePreviewText");
  var templatePreviewHtml = document.getElementById("templatePreviewHtml");

  var dailyLimitInput = document.getElementById("dailyLimit");
  var qualityMinInput = document.getElementById("qualityMin");
  var activeBrandInput = document.getElementById("activeBrand");
  var senderNameInput = document.getElementById("senderName");
  var senderPhoneInput = document.getElementById("senderPhone");
  var senderSignatureInput = document.getElementById("senderSignature");
  var confirmPreviewInput = document.getElementById("confirmPreview");

  var pName = document.getElementById("pName");
  var pEmail = document.getElementById("pEmail");
  var pCompany = document.getElementById("pCompany");
  var pCompanyOtherWrap = document.getElementById("pCompanyOtherWrap");
  var pCompanyOther = document.getElementById("pCompanyOther");
  var pScore = document.getElementById("pScore");
  var pBrand = document.getElementById("pBrand");
  var pCategory = document.getElementById("pCategory");
  var pNotes = document.getElementById("pNotes");
  var bulkInput = document.getElementById("bulkInput");
  var categoryProfilesJson = document.getElementById("categoryProfilesJson");
  var categoryProfilesFile = document.getElementById("categoryProfilesFile");

  var categoryProfiles = loadCategoryProfilesLocal();

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeCategoryValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeBrandValue(value) {
    var key = String(value || "").trim().toLowerCase();
    if (key === "brimot") return "brimot";
    if (key === "all" || key === "tous" || key === "toutes") return "all";
    return "colixo";
  }

  function getKnownCompanies() {
    var set = {
      "Colixo": true,
      "Brimot": true,
      "Regie ABC": true,
      "PME XYZ": true
    };
    stateProspects.forEach(function (p) {
      var company = String((p && p.company) || "").trim();
      if (company) set[company] = true;
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, "fr", { sensitivity: "base" });
    });
  }

  function refreshCompanyOptions() {
    if (!pCompany) return;
    var selected = pCompany.value;
    var companies = getKnownCompanies();
    var html = "<option value=''>Selectionner une entreprise</option>";
    companies.forEach(function (company) {
      html += "<option value='" + escapeHtml(company) + "'>" + escapeHtml(company) + "</option>";
    });
    html += "<option value='__other__'>Autre (saisie manuelle)</option>";
    pCompany.innerHTML = html;

    var canRestore = selected && (companies.indexOf(selected) >= 0 || selected === "__other__");
    pCompany.value = canRestore ? selected : "";
  }

  function syncCompanyOtherVisibility() {
    if (!pCompanyOtherWrap || !pCompany) return;
    var isOther = pCompany.value === "__other__";
    pCompanyOtherWrap.style.display = isOther ? "block" : "none";
  }

  function getSelectedCompanyValue() {
    if (!pCompany) return "";
    if (pCompany.value === "__other__") {
      return String((pCompanyOther && pCompanyOther.value) || "").trim();
    }
    return String(pCompany.value || "").trim();
  }

  function brandLabel(value) {
    return normalizeBrandValue(value) === "brimot" ? "Brimot" : "Colixo";
  }

  function filterProspectsByBrand(prospects, activeBrand) {
    var brand = normalizeBrandValue(activeBrand);
    if (brand === "all") return prospects.slice();
    return prospects.filter(function (p) {
      return normalizeBrandValue(p.brand) === brand;
    });
  }

  function sanitizeCadences(cadences, fallback) {
    var safe = cadences && typeof cadences === "object" ? cadences : {};
    return {
      after1: Math.max(1, Math.floor(toNumber(safe.after1, fallback.after1))),
      after2: Math.max(1, Math.floor(toNumber(safe.after2, fallback.after2))),
      after3: Math.max(1, Math.floor(toNumber(safe.after3, fallback.after3)))
    };
  }

  function sanitizeCategoryProfiles(input) {
    var safe = deepClone(DEFAULT_CATEGORY_PROFILES);
    Object.keys(input || {}).forEach(function (key) {
      var normalized = normalizeCategoryValue(key);
      if (!normalized) return;
      var entry = input[key] || {};
      var fallback = DEFAULT_CATEGORY_PROFILES[normalized] || DEFAULT_CATEGORY_PROFILES.autre;
      safe[normalized] = {
        label: String(entry.label || fallback.label || normalized),
        subjectPrefix: String(entry.subjectPrefix || fallback.subjectPrefix || "Presentation Colixo"),
        focus: String(entry.focus || fallback.focus || "pilotage des operations terrain"),
        cadences: sanitizeCadences(entry.cadences, fallback.cadences || DEFAULT_CATEGORY_PROFILES.autre.cadences)
      };
    });
    if (!safe.autre) {
      safe.autre = deepClone(DEFAULT_CATEGORY_PROFILES.autre);
    }
    return safe;
  }

  function loadCategoryProfilesLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_CATEGORY_PROFILES);
      if (!raw) return deepClone(DEFAULT_CATEGORY_PROFILES);
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return deepClone(DEFAULT_CATEGORY_PROFILES);
      return sanitizeCategoryProfiles(parsed);
    } catch (error) {
      return deepClone(DEFAULT_CATEGORY_PROFILES);
    }
  }

  function saveCategoryProfilesLocal(nextProfiles) {
    categoryProfiles = sanitizeCategoryProfiles(nextProfiles);
    localStorage.setItem(STORAGE_CATEGORY_PROFILES, JSON.stringify(categoryProfiles));
    return categoryProfiles;
  }

  function mapCategoryProfilesToRows(profiles) {
    var safe = sanitizeCategoryProfiles(profiles);
    return Object.keys(safe).map(function (key) {
      var item = safe[key] || {};
      var cadences = item.cadences || {};
      return {
        key: key,
        label: String(item.label || key),
        subject_prefix: String(item.subjectPrefix || "Presentation Colixo"),
        focus: String(item.focus || "pilotage des operations terrain"),
        cadence_after1: Math.max(1, Math.floor(toNumber(cadences.after1, 3))),
        cadence_after2: Math.max(1, Math.floor(toNumber(cadences.after2, 4))),
        cadence_after3: Math.max(1, Math.floor(toNumber(cadences.after3, 7)))
      };
    });
  }

  function mapRowsToCategoryProfiles(rows) {
    var base = deepClone(DEFAULT_CATEGORY_PROFILES);
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var key = normalizeCategoryValue(row && row.key);
      if (!key) return;
      var fallback = DEFAULT_CATEGORY_PROFILES[key] || DEFAULT_CATEGORY_PROFILES.autre;
      base[key] = {
        label: String((row && row.label) || fallback.label || key),
        subjectPrefix: String((row && row.subject_prefix) || fallback.subjectPrefix || "Presentation Colixo"),
        focus: String((row && row.focus) || fallback.focus || "pilotage des operations terrain"),
        cadences: {
          after1: Math.max(1, Math.floor(toNumber(row && row.cadence_after1, fallback.cadences.after1))),
          after2: Math.max(1, Math.floor(toNumber(row && row.cadence_after2, fallback.cadences.after2))),
          after3: Math.max(1, Math.floor(toNumber(row && row.cadence_after3, fallback.cadences.after3)))
        }
      };
    });
    return sanitizeCategoryProfiles(base);
  }

  function exportCategoryProfilesFile() {
    var payload = JSON.stringify(categoryProfiles, null, 2);
    var blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "colixo-category-profiles.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importCategoryProfilesFromText(rawText) {
    var parsed = JSON.parse(String(rawText || "{}"));
    var mode = await persistCategoryProfiles(parsed);
    setMessage(
      mode === "supabase"
        ? "Profils categories importes et synchronises via Supabase."
        : "Profils categories importes en local.",
      false
    );
    render();
  }

  function resolveCategoryKey(value) {
    var key = normalizeCategoryValue(value);
    if (!key) return "autre";
    if (Object.prototype.hasOwnProperty.call(categoryProfiles, key)) return key;

    var keys = Object.keys(CATEGORY_KEYWORDS);
    for (var i = 0; i < keys.length; i += 1) {
      var candidate = keys[i];
      var words = CATEGORY_KEYWORDS[candidate] || [];
      for (var j = 0; j < words.length; j += 1) {
        if (key.indexOf(words[j]) >= 0) return candidate;
      }
    }
    return "autre";
  }

  function categoryLabel(value) {
    var raw = normalizeCategoryValue(value);
    if (!raw) return categoryProfiles.autre.label;
    var key = resolveCategoryKey(raw);
    if (raw === key) return categoryProfiles[key].label;
    return raw + " (" + categoryProfiles[key].label + ")";
  }

  function getCategoryProfile(value) {
    return categoryProfiles[resolveCategoryKey(value)] || categoryProfiles.autre;
  }

  function getTemplateStepFromStatus(status) {
    if (status === "new") return 1;
    if (status === "sent_j0") return 2;
    if (status === "relance_j3") return 3;
    if (status === "relance_j7") return 4;
    return 4;
  }

  function interpolateTemplate(text, data) {
    var out = String(text || "");
    Object.keys(data || {}).forEach(function (key) {
      var token = "{{" + key + "}}";
      out = out.split(token).join(String(data[key] == null ? "" : data[key]));
    });
    return out;
  }

  async function fetchTemplateJson(path) {
    if (Object.prototype.hasOwnProperty.call(templateCache, path)) {
      return templateCache[path];
    }
    try {
      var response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        templateCache[path] = null;
        return null;
      }
      var json = await response.json();
      templateCache[path] = json && typeof json === "object" ? json : null;
      return templateCache[path];
    } catch (error) {
      templateCache[path] = null;
      return null;
    }
  }

  async function loadTemplateFromFiles(prospect, settings) {
    var profile = getCategoryProfile(prospect.category);
    var categoryKey = resolveCategoryKey(prospect.category);
    var brand = normalizeBrandValue(prospect.brand);
    var step = getTemplateStepFromStatus(prospect.status);
    var name = prospect.name || "Bonjour";
    var company = prospect.company || "";
    var companyPart = company ? " - " + company : "";
    var templateUrl = getClientTemplateUrl(prospect);
    var a4Url = getColixoA4Url(prospect);

    var candidates = [
      TEMPLATE_ROOT + "/" + brand + "/" + categoryKey + "/step-" + step + ".json",
      TEMPLATE_ROOT + "/" + categoryKey + "/step-" + step + ".json"
    ];

    var template = null;
    var templatePath = "";
    for (var i = 0; i < candidates.length; i += 1) {
      template = await fetchTemplateJson(candidates[i]);
      if (template) {
        templatePath = candidates[i];
        break;
      }
    }
    if (!template) return null;

    var data = {
      name: name,
      company: company,
      companyPart: companyPart,
      brand: brandLabel(brand),
      category: categoryLabel(prospect.category),
      focus: profile.focus,
      subjectPrefix: profile.subjectPrefix,
      templateUrl: templateUrl,
      a4Url: a4Url,
      senderName: settings.senderName || "",
      senderPhone: settings.senderPhone || "",
      senderSignature: settings.senderSignature || ""
    };

    var subject = interpolateTemplate(template.subject || "", data).trim();
    var text = interpolateTemplate(template.text || "", data).trim();
    var html = interpolateTemplate(template.html || "", data).trim();

    if (!subject || (!text && !html)) {
      return null;
    }

    return {
      subject: subject,
      text: text,
      html: html,
      _sourceType: "file",
      _sourcePath: templatePath
    };
  }

  function dayKey(date) {
    var d = date || new Date();
    return d.toISOString().slice(0, 10);
  }

  function getSupabaseConfig() {
    if (
      window.SUPABASE_CONFIG &&
      typeof window.SUPABASE_CONFIG.url === "string" &&
      typeof window.SUPABASE_CONFIG.key === "string"
    ) {
      return {
        url: String(window.SUPABASE_CONFIG.url).trim(),
        key: String(window.SUPABASE_CONFIG.key).trim()
      };
    }
    return SUPABASE_FALLBACK_CONFIG;
  }

  function mapDbToProspect(row) {
    return {
      id: row.id,
      name: row.full_name || "",
      email: row.email || "",
      company: row.company || "",
      qualityScore: toNumber(row.quality_score, 70),
      notes: row.notes || "",
      status: row.status || "new",
      nextDueAt: row.next_follow_up_at || null,
      lastSentAt: row.last_contact_at || null,
      lastError: row.last_error || "",
      optOut: Boolean(row.opt_out),
      createdAt: row.created_at || new Date().toISOString(),
      phone: row.phone || "",
      source: row.source || "",
      brand: normalizeBrandValue(row.brand || "colixo"),
      category: normalizeCategoryValue(row.source || "autre")
    };
  }

  function mapProspectToDb(item) {
    return {
      full_name: item.name || null,
      email: item.email,
      company: item.company || null,
      quality_score: Math.min(100, Math.max(0, Math.floor(toNumber(item.qualityScore, 70)))),
      notes: item.notes || null,
      status: item.status || "new",
      next_follow_up_at: item.nextDueAt || null,
      last_contact_at: item.lastSentAt || null,
      last_error: item.lastError || null,
      opt_out: Boolean(item.optOut),
      phone: item.phone || null,
      brand: normalizeBrandValue(item.brand || "colixo"),
      source: normalizeCategoryValue(item.category || item.source || "autre")
    };
  }

  async function supabaseRequest(path, method, payload, options) {
    var cfg = getSupabaseConfig();
    var headers = {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key,
      "Content-Type": "application/json"
    };

    if (method !== "GET") {
      headers.Prefer = (options && options.prefer) || "return=representation";
    }

    var response = await fetch(cfg.url + "/rest/v1/" + path, {
      method: method,
      headers: headers,
      body: payload ? JSON.stringify(payload) : undefined
    });

    var json = await response.json().catch(function () { return []; });
    if (!response.ok) {
      throw new Error((json && (json.message || json.error || json.hint)) || "Erreur Supabase");
    }
    return json;
  }

  async function loadProspectsSupabase() {
    var rows = await supabaseRequest("mail_prospects?select=*&order=created_at.desc", "GET");
    return Array.isArray(rows) ? rows.map(mapDbToProspect) : [];
  }

  async function loadCategoryProfilesSupabase() {
    var rows = await supabaseRequest(CATEGORY_PROFILES_TABLE + "?select=*", "GET");
    return mapRowsToCategoryProfiles(rows);
  }

  async function saveCategoryProfilesSupabase(nextProfiles) {
    var payload = mapCategoryProfilesToRows(nextProfiles);
    var rows = await supabaseRequest(
      CATEGORY_PROFILES_TABLE + "?on_conflict=key",
      "POST",
      payload,
      { prefer: "return=representation,resolution=merge-duplicates" }
    );
    return mapRowsToCategoryProfiles(rows);
  }

  async function persistCategoryProfiles(nextProfiles) {
    if (dataMode === DATA_MODE_SUPABASE) {
      try {
        categoryProfiles = await saveCategoryProfilesSupabase(nextProfiles);
        localStorage.setItem(STORAGE_CATEGORY_PROFILES, JSON.stringify(categoryProfiles));
        return "supabase";
      } catch (error) {
        saveCategoryProfilesLocal(nextProfiles);
        return "local";
      }
    }
    saveCategoryProfilesLocal(nextProfiles);
    return "local";
  }

  async function tryEnableSupabaseMode() {
    try {
      stateProspects = await loadProspectsSupabase();
      dataMode = DATA_MODE_SUPABASE;
      try {
        categoryProfiles = await loadCategoryProfilesSupabase();
        localStorage.setItem(STORAGE_CATEGORY_PROFILES, JSON.stringify(categoryProfiles));
        setMessage("Mode base de donnees actif (Supabase).", false);
      } catch (error) {
        categoryProfiles = loadCategoryProfilesLocal();
        setMessage("Supabase actif. Profils categories en local (table manquante).", true);
      }
    } catch (error) {
      dataMode = DATA_MODE_LOCAL;
      stateProspects = loadProspectsLocal();
      categoryProfiles = loadCategoryProfilesLocal();
      setMessage("Mode local actif. Cree la table mail_prospects pour activer Supabase.", true);
    }
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "p_" + String(Date.now()) + "_" + String(Math.floor(Math.random() * 100000));
  }

  function addDaysIso(startDate, days) {
    var d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  function parseIsoDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_SETTINGS);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw) || {});
    } catch (error) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings) {
    var safe = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    safe.dailyLimit = Math.min(50, Math.max(1, Math.floor(toNumber(safe.dailyLimit, 50))));
    safe.qualityMin = Math.min(100, Math.max(0, Math.floor(toNumber(safe.qualityMin, 70))));
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(safe));
    return safe;
  }

  function loadProspectsLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_PROSPECTS);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveProspectsLocal(prospects) {
    localStorage.setItem(STORAGE_PROSPECTS, JSON.stringify(prospects || []));
  }

  async function createProspect(item) {
    if (dataMode === DATA_MODE_SUPABASE) {
      var inserted = await supabaseRequest("mail_prospects", "POST", mapProspectToDb(item));
      if (Array.isArray(inserted) && inserted.length) {
        stateProspects.unshift(mapDbToProspect(inserted[0]));
      }
      return;
    }

    stateProspects.push(item);
    saveProspectsLocal(stateProspects);
  }

  async function patchProspect(id, patch) {
    var index = stateProspects.findIndex(function (p) { return p.id === id; });
    if (index < 0) return;
    var next = Object.assign({}, stateProspects[index], patch || {});

    if (dataMode === DATA_MODE_SUPABASE) {
      var encodedId = encodeURIComponent(id);
      var updated = await supabaseRequest("mail_prospects?id=eq." + encodedId, "PATCH", mapProspectToDb(next));
      if (Array.isArray(updated) && updated.length) {
        stateProspects[index] = mapDbToProspect(updated[0]);
      } else {
        stateProspects[index] = next;
      }
      return;
    }

    stateProspects[index] = next;
    saveProspectsLocal(stateProspects);
  }

  async function deleteProspect(id) {
    if (dataMode === DATA_MODE_SUPABASE) {
      var encodedId = encodeURIComponent(id);
      await supabaseRequest("mail_prospects?id=eq." + encodedId, "DELETE");
    }
    stateProspects = stateProspects.filter(function (p) { return p.id !== id; });
    if (dataMode === DATA_MODE_LOCAL) {
      saveProspectsLocal(stateProspects);
    }
  }

  function loadSentLog() {
    try {
      var raw = localStorage.getItem(STORAGE_SENT_LOG);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveSentLog(log) {
    localStorage.setItem(STORAGE_SENT_LOG, JSON.stringify(log || {}));
  }

  function getSentToday() {
    var log = loadSentLog();
    return Math.max(0, toNumber(log[dayKey()], 0));
  }

  function incrementSentToday(count) {
    var log = loadSentLog();
    var key = dayKey();
    var current = Math.max(0, toNumber(log[key], 0));
    log[key] = current + Math.max(0, toNumber(count, 0));
    saveSentLog(log);
  }

  function setMessage(text, isError) {
    campaignMessage.textContent = text || "";
    campaignMessage.style.color = isError ? "#b91c1c" : "#0f766e";
  }

  function nextStatusAfterSend(status) {
    if (status === "new") return "sent_j0";
    if (status === "sent_j0") return "relance_j3";
    if (status === "relance_j3") return "relance_j7";
    if (status === "relance_j7") return "relance_j14";
    return "stop";
  }

  function stageNumberFromStatus(status) {
    if (status === "new") return 1;
    if (status === "sent_j0") return 2;
    if (status === "relance_j3") return 3;
    if (status === "relance_j7") return 4;
    return 4;
  }

  function nextDueDateFromNewStatus(newStatus, sentAtIso, prospect) {
    var profile = getCategoryProfile(prospect && prospect.category);
    if (newStatus === "sent_j0") return addDaysIso(sentAtIso, profile.cadences.after1);
    if (newStatus === "relance_j3") return addDaysIso(sentAtIso, profile.cadences.after2);
    if (newStatus === "relance_j7") return addDaysIso(sentAtIso, profile.cadences.after3);
    if (newStatus === "relance_j14") return null;
    return null;
  }

  function stageLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getClientTemplateUrl(prospect) {
    var base = window.location.origin + "/client-template";
    var params = new URLSearchParams();
    params.set("name", prospect.name || "Client");
    params.set("company", prospect.company || "");
    params.set("email", prospect.email || "");
    return base + "?" + params.toString();
  }

  function getColixoA4Url(prospect) {
    var base = window.location.origin + "/colixo-a4";
    var params = new URLSearchParams();
    params.set("name", prospect.name || "Client");
    params.set("company", prospect.company || "");
    return base + "?" + params.toString();
  }

  function isDue(prospect, settings) {
    if (!prospect || prospect.optOut) return false;
    if (prospect.status === "replied" || prospect.status === "won" || prospect.status === "lost" || prospect.status === "stop") {
      return false;
    }
    if (toNumber(prospect.qualityScore, 0) < settings.qualityMin) return false;
    var due = parseIsoDate(prospect.nextDueAt);
    if (!due) return true;
    return due.getTime() <= Date.now();
  }

  function defaultEmailTemplate(prospect, settings) {
    var name = prospect.name || "Bonjour";
    var company = prospect.company ? " - " + prospect.company : "";
    var profile = getCategoryProfile(prospect.category);
    var stage = stageNumberFromStatus(prospect.status);
    var templateUrl = getClientTemplateUrl(prospect);
    var a4Url = getColixoA4Url(prospect);

    function stageIntro() {
      if (stage === 1) {
        return "Je vous contacte pour " + profile.focus + ".";
      }
      if (stage === 2) {
        return "Petit suivi suite a mon premier message sur " + profile.focus + ".";
      }
      if (stage === 3) {
        return "Voici une proposition concrete adaptee a votre activite pour " + profile.focus + ".";
      }
      return "Dernier suivi de ma part, je reste disponible si vous voulez avancer sur " + profile.focus + ".";
    }

    function stageBody() {
      if (stage === 1) {
        return "Je peux vous proposer une demonstration ciblee de 20 minutes selon vos priorites metier.";
      }
      if (stage === 2) {
        return "En general, ce type d'organisation permet de gagner du temps des la premiere semaine.";
      }
      if (stage === 3) {
        return "Si vous me partagez vos contraintes, je vous prepare un scenario operationnel clair en demo.";
      }
      return "Si ce n'est pas le bon timing, je peux revenir plus tard au moment qui vous convient.";
    }

    function htmlBlock(intro, body) {
      return "" +
        "<div style='font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;'>" +
        "<p>Bonjour " + escapeHtml(name) + ",</p>" +
        "<p>" + intro + "</p>" +
        "<p>" + body + "</p>" +
        "<p><a href='" + escapeHtml(templateUrl) + "' style='display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;'>Voir votre page de demande</a></p>" +
        "<p><a href='" + escapeHtml(a4Url) + "' style='display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;margin-left:8px;'>Voir la fiche A4 Colixo</a></p>" +
        "<p style='margin-top:16px;white-space:pre-line;'>" + escapeHtml(settings.senderSignature) + "</p>" +
        "</div>";
    }

    if (prospect.status === "new") {
      return {
        subject: profile.subjectPrefix + company,
        text:
          "Bonjour " + name + ",\n\n" +
          stageIntro() + "\n\n" +
          "Vous pouvez voir la fiche de presentation A4 ici: " + a4Url + "\n\n" +
          "Et votre page de prise de contact ici: " + templateUrl + "\n" +
          "Page client dediee: " + templateUrl + "\n\n" +
          stageBody() + "\n\n" +
          "Bien a vous,\n" + settings.senderSignature,
        html: htmlBlock(
          stageIntro(),
          stageBody()
        )
      };
    }

    if (prospect.status === "sent_j0") {
      return {
        subject: "Re: " + profile.subjectPrefix.toLowerCase() + company,
        text:
          "Bonjour " + name + ",\n\n" +
          stageIntro() + "\n" +
          stageBody() + "\n\n" +
          "Fiche A4 Colixo: " + a4Url + "\n" +
          "Vous pouvez utiliser votre page dediee: " + templateUrl + "\n\n" +
          "Bien a vous,\n" + settings.senderSignature,
        html: htmlBlock(
          stageIntro(),
          stageBody()
        )
      };
    }

    if (prospect.status === "relance_j3") {
      return {
        subject: "Proposition adaptee - " + profile.label + company,
        text:
          "Bonjour " + name + ",\n\n" +
          stageIntro() + "\n\n" +
          stageBody() + "\n\n" +
          "Approche simple:\n" +
          "1) vous consultez la fiche A4: " + a4Url + "\n" +
          "2) vous partagez vos priorites operationnelles\n" +
          "3) je vous presente un scenario adapte en demo\n\n" +
          "Votre page dediee: " + templateUrl + "\n\n" +
          "Bien a vous,\n" + settings.senderSignature
        ,
        html: htmlBlock(
          stageIntro(),
          stageBody() + " 1) vous consultez la fiche A4, 2) vous partagez vos priorites operationnelles, 3) je vous presente un scenario adapte en demo."
        )
      };
    }

    return {
      subject: "Dernier suivi - " + profile.label + company,
      text:
        "Bonjour " + name + ",\n\n" +
        stageIntro() + "\n" +
        stageBody() + "\n" +
        "Fiche A4 Colixo: " + a4Url + "\n" +
        "Votre page dediee reste active: " + templateUrl + "\n\n" +
        "Bien a vous,\n" + settings.senderSignature,
      html: htmlBlock(
        stageIntro(),
        stageBody()
      )
    };
  }

  async function resolveEmailContent(prospect, settings) {
    var fromFile = await loadTemplateFromFiles(prospect, settings);
    if (fromFile) {
      return {
        content: fromFile,
        sourceType: fromFile._sourceType || "file",
        sourcePath: fromFile._sourcePath || ""
      };
    }
    return {
      content: defaultEmailTemplate(prospect, settings),
      sourceType: "fallback",
      sourcePath: ""
    };
  }

  function htmlFromText(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  async function sendOneEmail(prospect, settings) {
    var resolved = await resolveEmailContent(prospect, settings);
    var content = resolved.content;
    var response = await fetch("/api/send-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: prospect.email,
        subject: content.subject,
        text: content.text,
        html: content.html || htmlFromText(content.text)
      })
    });

    var json = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(json.error || "Echec envoi mail");
    }

    return json;
  }

  async function previewProspectTemplate(id) {
    var prospect = stateProspects.find(function (p) { return p.id === id; });
    if (!prospect) return;
    var settings = saveSettings(readSettingsFromForm());
    var resolved = await resolveEmailContent(prospect, settings);
    var content = resolved.content;

    if (!templatePreview || !templatePreviewSubject || !templatePreviewText || !templatePreviewHtml || !templatePreviewMeta) {
      return;
    }

    templatePreviewSubject.textContent = content.subject || "";
    templatePreviewText.textContent = content.text || "";
    templatePreviewHtml.innerHTML = content.html || htmlFromText(content.text || "");
    templatePreviewMeta.textContent =
      "Prospect: " + (prospect.name || prospect.email) +
      " | Marque: " + brandLabel(prospect.brand) +
      " | Categorie: " + categoryLabel(prospect.category) +
      " | Source template: " + (resolved.sourceType === "file" ? (resolved.sourcePath || "fichier") : "fallback interne");
    templatePreview.style.display = "block";
    templatePreview.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function runAutoSend() {
    if (confirmPreviewInput && !confirmPreviewInput.checked) {
      setMessage("Coche la confirmation de previsualisation avant d'envoyer les relances.", true);
      return;
    }

    var settings = saveSettings(readSettingsFromForm());
    var prospects = filterProspectsByBrand(stateProspects.slice(), settings.activeBrand);
    var sentToday = getSentToday();
    var remaining = Math.max(0, settings.dailyLimit - sentToday);

    if (remaining <= 0) {
      setMessage("Quota journalier atteint. Maximum 50/jour.", true);
      render();
      return;
    }

    var due = prospects
      .filter(function (p) { return isDue(p, settings); })
      .sort(function (a, b) {
        var qa = toNumber(a.qualityScore, 0);
        var qb = toNumber(b.qualityScore, 0);
        if (qb !== qa) return qb - qa;
        var da = parseIsoDate(a.nextDueAt);
        var db = parseIsoDate(b.nextDueAt);
        var ta = da ? da.getTime() : 0;
        var tb = db ? db.getTime() : 0;
        return ta - tb;
      })
      .slice(0, remaining);

    if (!due.length) {
      setMessage("Aucun prospect du jour selon les criteres de qualite.", false);
      render();
      return;
    }

    var ok = 0;
    var failed = 0;

    for (var i = 0; i < due.length; i += 1) {
      var p = due[i];
      try {
        await sendOneEmail(p, settings);
        var nowIso = new Date().toISOString();
        var nextStatus = nextStatusAfterSend(p.status || "new");
        var patch = {
          lastSentAt: nowIso,
          status: nextStatus,
          nextDueAt: nextDueDateFromNewStatus(nextStatus, nowIso, p),
          lastError: ""
        };
        if (nextStatus === "stop") {
          patch.nextDueAt = null;
        }
        await patchProspect(p.id, patch);
        ok += 1;
      } catch (error) {
        failed += 1;
        await patchProspect(p.id, {
          lastError: String(error && error.message ? error.message : error)
        });
      }
    }

    if (ok > 0) {
      incrementSentToday(ok);
    }

    if (failed > 0 && ok === 0) {
      setMessage("Echec envoi. Verifie BRIMOT_RESEND_API_KEY et BRIMOT_MAIL_FROM.", true);
    } else if (failed > 0) {
      setMessage("Envoi termine: " + ok + " ok, " + failed + " en echec.", true);
    } else {
      setMessage("Envoi termine: " + ok + " mail(s) envoyes.", false);
    }

    render();
  }

  function readSettingsFromForm() {
    return {
      dailyLimit: toNumber(dailyLimitInput.value, 50),
      qualityMin: toNumber(qualityMinInput.value, 70),
      activeBrand: normalizeBrandValue(activeBrandInput && activeBrandInput.value),
      senderName: String(senderNameInput.value || "").trim(),
      senderPhone: String(senderPhoneInput.value || "").trim(),
      senderSignature: String(senderSignatureInput.value || "").trim()
    };
  }

  function fillSettingsForm(settings) {
    dailyLimitInput.value = settings.dailyLimit;
    qualityMinInput.value = settings.qualityMin;
    if (activeBrandInput) activeBrandInput.value = normalizeBrandValue(settings.activeBrand);
    senderNameInput.value = settings.senderName || "";
    senderPhoneInput.value = settings.senderPhone || "";
    senderSignatureInput.value = settings.senderSignature || "";
  }

  async function addProspect(item) {
    var prospects = stateProspects.slice();
    var email = normalizeEmail(item.email);
    var brand = normalizeBrandValue(item.brand);
    if (!email) {
      setMessage("Email requis.", true);
      return;
    }

    var exists = prospects.some(function (p) {
      return normalizeEmail(p.email) === email && normalizeBrandValue(p.brand) === brand;
    });
    if (exists) {
      setMessage("Email deja present pour " + brandLabel(brand) + ": " + email, true);
      return;
    }

    var prospect = {
      id: uid(),
      name: String(item.name || "").trim(),
      email: email,
      company: String(item.company || "").trim(),
      brand: brand,
      qualityScore: Math.min(100, Math.max(0, Math.floor(toNumber(item.qualityScore, 70)))),
      category: normalizeCategoryValue(item.category || "autre") || "autre",
      notes: String(item.notes || "").trim(),
      status: "new",
      nextDueAt: new Date().toISOString(),
      lastSentAt: null,
      lastError: "",
      optOut: false,
      createdAt: new Date().toISOString()
    };

    try {
      await createProspect(prospect);
      setMessage("Prospect ajoute.", false);
    } catch (error) {
      setMessage("Echec ajout prospect: " + String(error && error.message ? error.message : error), true);
    }
    render();
  }

  async function bulkImport(text) {
    var lines = String(text || "").split(/\r?\n/);
    var added = 0;
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.split(";");
      if (parts.length < 2) continue;
      var item = {
        name: (parts[0] || "").trim(),
        email: (parts[1] || "").trim(),
        company: (parts[2] || "").trim(),
        qualityScore: toNumber(parts[3], 75),
        category: normalizeCategoryValue(parts[4]) || "autre",
        brand: normalizeBrandValue(parts[5] || loadSettings().activeBrand),
        notes: ""
      };
      var before = stateProspects.length;
      await addProspect(item);
      var after = stateProspects.length;
      if (after > before) {
        added += 1;
      }
    }
    setMessage("Import termine: " + added + " ajoute(s).", false);
    render();
  }

  async function updateProspect(id, patch) {
    await patchProspect(id, patch);
    render();
  }

  async function removeProspect(id) {
    await deleteProspect(id);
    render();
  }

  function renderRows() {
    var settings = loadSettings();
    var prospects = filterProspectsByBrand(stateProspects.slice(), settings.activeBrand);

    if (!prospects.length) {
      prospectRows.innerHTML = "<tr><td colspan='9'><div class='empty'>Aucun prospect pour le moment.</div></td></tr>";
      return;
    }

    prospectRows.innerHTML = prospects
      .sort(function (a, b) {
        var qa = toNumber(a.qualityScore, 0);
        var qb = toNumber(b.qualityScore, 0);
        if (qb !== qa) return qb - qa;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      })
      .map(function (p) {
        var due = parseIsoDate(p.nextDueAt);
        var dueLabel = due ? due.toLocaleDateString("fr-CH") : "-";
        var tag = isDue(p, settings) ? "<span class='tag warn'>Due</span>" : "<span class='tag'>Planifie</span>";
        var errTag = p.lastError ? "<div class='note' style='color:#b91c1c;'>" + p.lastError.replace(/</g, "&lt;") + "</div>" : "";
        return "" +
          "<tr data-id='" + p.id + "'>" +
          "<td>" + (p.name || "-") + "</td>" +
          "<td>" + p.email + "</td>" +
          "<td>" + (p.company || "-") + "</td>" +
          "<td>" + brandLabel(p.brand) + "</td>" +
          "<td>" + categoryLabel(p.category) + "</td>" +
          "<td>" + p.qualityScore + "</td>" +
          "<td>" + stageLabel(p.status) + "<br>" + tag + errTag + "</td>" +
          "<td>" + dueLabel + "</td>" +
          "<td>" +
          "<div class='button-row'>" +
          "<button class='btn btn-ghost' type='button' data-action='preview'>Preview</button>" +
          "<button class='btn btn-ghost' type='button' data-action='reply'>A repondu</button>" +
          "<button class='btn btn-ghost' type='button' data-action='won'>Converti</button>" +
          "<button class='btn btn-ghost' type='button' data-action='optout'>Stop</button>" +
          "<button class='btn btn-danger' type='button' data-action='del'>Suppr</button>" +
          "</div>" +
          "</td>" +
          "</tr>";
      })
      .join("");
  }

  function renderKpis() {
    var settings = loadSettings();
    var prospects = filterProspectsByBrand(stateProspects.slice(), settings.activeBrand);
    var sentToday = getSentToday();
    var dueCount = prospects.filter(function (p) { return isDue(p, settings); }).length;
    var replied = prospects.filter(function (p) { return p.status === "replied" || p.status === "won"; }).length;
    var responseRate = prospects.length ? Math.round((replied / prospects.length) * 100) : 0;

    kpiQuota.textContent = String(sentToday) + "/" + String(settings.dailyLimit);
    kpiDue.textContent = String(dueCount);
    kpiReply.textContent = String(responseRate) + "%";
    kpiBase.textContent = String(prospects.length);
  }

  function render() {
    fillSettingsForm(loadSettings());
    refreshCompanyOptions();
    syncCompanyOtherVisibility();
    if (categoryProfilesJson) {
      categoryProfilesJson.value = JSON.stringify(categoryProfiles, null, 2);
    }
    renderKpis();
    renderRows();
  }

  document.getElementById("btnSaveSettings").addEventListener("click", function () {
    var saved = saveSettings(readSettingsFromForm());
    fillSettingsForm(saved);
    if (pBrand) pBrand.value = normalizeBrandValue(saved.activeBrand);
    setMessage("Reglages sauvegardes. Limite appliquee: " + saved.dailyLimit + "/jour.", false);
    render();
  });

  if (activeBrandInput) {
    activeBrandInput.addEventListener("change", function () {
      if (pBrand && normalizeBrandValue(activeBrandInput.value) !== "all") {
        pBrand.value = normalizeBrandValue(activeBrandInput.value);
      }
      render();
    });
  }

  document.getElementById("btnAddProspect").addEventListener("click", async function () {
    await addProspect({
      name: pName.value,
      email: pEmail.value,
      company: getSelectedCompanyValue(),
      brand: pBrand ? pBrand.value : "colixo",
      qualityScore: pScore.value,
      category: pCategory.value,
      notes: pNotes.value
    });
    pName.value = "";
    pEmail.value = "";
    if (pCompany) pCompany.value = "";
    if (pCompanyOther) pCompanyOther.value = "";
    pScore.value = "80";
    if (pBrand) pBrand.value = normalizeBrandValue(loadSettings().activeBrand);
    pCategory.value = "";
    pNotes.value = "";
    syncCompanyOtherVisibility();
  });

  if (pCompany) {
    pCompany.addEventListener("change", function () {
      syncCompanyOtherVisibility();
    });
  }

  document.getElementById("btnBulkImport").addEventListener("click", async function () {
    await bulkImport(bulkInput.value);
    bulkInput.value = "";
  });

  var saveProfilesBtn = document.getElementById("btnSaveCategoryProfiles");
  if (saveProfilesBtn && categoryProfilesJson) {
    saveProfilesBtn.addEventListener("click", async function () {
      try {
        var parsed = JSON.parse(String(categoryProfilesJson.value || "{}"));
        var mode = await persistCategoryProfiles(parsed);
        setMessage(
          mode === "supabase"
            ? "Profils categories sauvegardes sur Supabase."
            : "Profils categories sauvegardes en local.",
          false
        );
        render();
      } catch (error) {
        setMessage("JSON invalide pour profils categories.", true);
      }
    });
  }

  var exportProfilesBtn = document.getElementById("btnExportCategoryProfiles");
  if (exportProfilesBtn) {
    exportProfilesBtn.addEventListener("click", function () {
      exportCategoryProfilesFile();
      setMessage("Export JSON des profils categories termine.", false);
    });
  }

  var importProfilesBtn = document.getElementById("btnImportCategoryProfiles");
  if (importProfilesBtn && categoryProfilesFile) {
    importProfilesBtn.addEventListener("click", function () {
      categoryProfilesFile.click();
    });

    categoryProfilesFile.addEventListener("change", function (event) {
      var file = event.target && event.target.files ? event.target.files[0] : null;
      if (!file) return;
      var reader = new FileReader();
      reader.onload = async function () {
        try {
          await importCategoryProfilesFromText(reader.result);
        } catch (error) {
          setMessage("Import JSON invalide.", true);
        } finally {
          categoryProfilesFile.value = "";
        }
      };
      reader.onerror = function () {
        setMessage("Lecture du fichier impossible.", true);
        categoryProfilesFile.value = "";
      };
      reader.readAsText(file);
    });
  }

  document.getElementById("btnRunAutoSend").addEventListener("click", async function () {
    await runAutoSend();
  });

  prospectRows.addEventListener("click", async function (event) {
    var target = event.target;
    if (!target || !target.getAttribute) return;
    var action = target.getAttribute("data-action");
    if (!action) return;

    var row = target.closest("tr");
    if (!row) return;
    var id = row.getAttribute("data-id");
    if (!id) return;

    if (action === "preview") {
      await previewProspectTemplate(id);
      return;
    }

    if (action === "reply") {
      await updateProspect(id, { status: "replied", nextDueAt: null, lastError: "" });
      return;
    }
    if (action === "won") {
      await updateProspect(id, { status: "won", nextDueAt: null, lastError: "" });
      return;
    }
    if (action === "optout") {
      await updateProspect(id, { status: "stop", optOut: true, nextDueAt: null, lastError: "" });
      return;
    }
    if (action === "del") {
      await removeProspect(id);
    }
  });

  tryEnableSupabaseMode().then(function () {
    render();
    if (pBrand) {
      var active = normalizeBrandValue(loadSettings().activeBrand);
      pBrand.value = active === "all" ? "colixo" : active;
    }
  });
})();
