(function () {
  "use strict";

  var STORAGE_CONFIG = "brimot_tool_config_v1";
  var STORAGE_HISTORY = "brimot_tool_history_v1";
  var STORAGE_CATALOG = "brimot_tool_catalog_v1";

  var DEFAULT_CONFIG = {
    standardHourlyRate: 65,
    standardPerM2: 6,
    diogeneHourlyRate: 120,
    diogenePerM2: 26,
    endOfLeasePerM2: 7,
    endOfLeaseDirtyPerM2: 14,
    disinfectionSimplePerM2: 2,
    decontaminationHeavyPerM2: 8,
    windowsPerM2: 3.5,
    windowsStorefrontPerM2: 10,
    travelPerKm: 1.2,
    extremeHourlyRate: 70,
    pestsInterventionFee: 180,
    urgentRate: 0.3,
    weekendRate: 0.25,
    stairsRate: 0.15,
    veryDirtyRate: 0.5,
    diogeneMultiplier: 1.35,
    bulkyWasteFlat: 120,
    bulkyWastePerM2: 1.4,
    standardM2PerHour: 24,
    diogeneM2PerHour: 8,
    endOfLeaseM2PerHour: 6,
    extremeM2PerHour: 3,
    disinfectionM2PerHour: 10,
    recurringM2PerHour: 14,
    recurringOnceRate: 40,
    recurringWeeklyRate: 38,
    recurringBiMonthlyRate: 39,
    recurringMonthlyRate: 40,
    durationBufferRate: 0.3,
    setupTimeHours: 0.75
  };

  var CONFIG_MIN = {
    standardHourlyRate: 5,
    standardPerM2: 0.5,
    diogeneHourlyRate: 50,
    diogenePerM2: 5,
    endOfLeasePerM2: 1,
    endOfLeaseDirtyPerM2: 2,
    disinfectionSimplePerM2: 0.5,
    decontaminationHeavyPerM2: 1,
    windowsPerM2: 0.5,
    windowsStorefrontPerM2: 1,
    travelPerKm: 0.1,
    extremeHourlyRate: 50,
    pestsInterventionFee: 50,
    urgentRate: 0,
    weekendRate: 0,
    stairsRate: 0,
    veryDirtyRate: 0,
    diogeneMultiplier: 1,
    bulkyWasteFlat: 10,
    bulkyWastePerM2: 0.1,
    standardM2PerHour: 3,
    diogeneM2PerHour: 3,
    endOfLeaseM2PerHour: 2,
    extremeM2PerHour: 1,
    disinfectionM2PerHour: 2,
    recurringM2PerHour: 2,
    recurringOnceRate: 5,
    recurringWeeklyRate: 5,
    recurringBiMonthlyRate: 5,
    recurringMonthlyRate: 5,
    durationBufferRate: 0,
    setupTimeHours: 0
  };

  var DEFAULT_SERVICE_CATALOG = [
    { category: "Nettoyages residentiels", name: "Menage recurrent (appartement)", unit: "heure", minPrice: 38, maxPrice: 40 },
    { category: "Nettoyages residentiels", name: "Nettoyage d appartement (regulier ou ponctuel)", unit: "heure", minPrice: 55, maxPrice: 75 },
    { category: "Nettoyages residentiels", name: "Nettoyage de maison", unit: "heure", minPrice: 60, maxPrice: 80 },
    { category: "Nettoyages residentiels", name: "Nettoyage de fin de bail (etat des lieux)", unit: "m2", minPrice: 6, maxPrice: 12 },
    { category: "Nettoyages residentiels", name: "Nettoyage apres demenagement", unit: "m2", minPrice: 5, maxPrice: 10 },
    { category: "Nettoyages residentiels", name: "Nettoyage de printemps (grand menage saisonnier)", unit: "heure", minPrice: 60, maxPrice: 85 },
    { category: "Nettoyages residentiels", name: "Nettoyage apres travaux / renovation", unit: "m2", minPrice: 8, maxPrice: 18 },
    { category: "Nettoyages residentiels", name: "Nettoyage de logements insalubres (type Diogene)", unit: "m2", minPrice: 20, maxPrice: 45 },
    { category: "Nettoyages residentiels", name: "Nettoyage apres sinistre (eau, feu, fumee)", unit: "devis", minPrice: 0, maxPrice: 0 },

    { category: "Nettoyage specialise", name: "Nettoyage extreme (logements tres degrades)", unit: "heure", minPrice: 95, maxPrice: 160 },
    { category: "Nettoyage specialise", name: "Nettoyage apres deces", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Nettoyage specialise", name: "Desinfection complete des lieux", unit: "m2", minPrice: 2, maxPrice: 8 },
    { category: "Nettoyage specialise", name: "Decontamination (virus, bacteries)", unit: "m2", minPrice: 5, maxPrice: 16 },
    { category: "Nettoyage specialise", name: "Nettoyage anti-odeurs (tabac, animaux, moisissures)", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Nettoyage specialise", name: "Traitement des moisissures", unit: "m2", minPrice: 12, maxPrice: 30 },

    { category: "Nettoyage commercial / professionnel", name: "Bureaux", unit: "m2", minPrice: 2.5, maxPrice: 6 },
    { category: "Nettoyage commercial / professionnel", name: "Commerces et magasins", unit: "m2", minPrice: 3, maxPrice: 8 },
    { category: "Nettoyage commercial / professionnel", name: "Cabinets medicaux / dentaires", unit: "m2", minPrice: 4, maxPrice: 10 },
    { category: "Nettoyage commercial / professionnel", name: "Restaurants / cuisines professionnelles", unit: "m2", minPrice: 5, maxPrice: 14 },
    { category: "Nettoyage commercial / professionnel", name: "Entrepots / depots", unit: "m2", minPrice: 2, maxPrice: 5 },
    { category: "Nettoyage commercial / professionnel", name: "Ecoles / creches", unit: "m2", minPrice: 3, maxPrice: 7 },
    { category: "Nettoyage commercial / professionnel", name: "Hotels / Airbnb", unit: "heure", minPrice: 50, maxPrice: 90 },

    { category: "Nettoyage vehicules", name: "Voiture interieure / exterieure", unit: "forfait", minPrice: 60, maxPrice: 180 },
    { category: "Nettoyage vehicules", name: "Nettoyage complet (detailing)", unit: "forfait", minPrice: 180, maxPrice: 450 },
    { category: "Nettoyage vehicules", name: "Camion / utilitaire", unit: "forfait", minPrice: 120, maxPrice: 320 },
    { category: "Nettoyage vehicules", name: "Flotte d entreprise", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Nettoyage vehicules", name: "Nettoyage vapeur interieur", unit: "forfait", minPrice: 90, maxPrice: 220 },

    { category: "Nettoyages techniques", name: "Nettoyage de vitres (immeubles, vitrines)", unit: "m2", minPrice: 3.5, maxPrice: 12 },
    { category: "Nettoyages techniques", name: "Nettoyage de facades", unit: "m2", minPrice: 8, maxPrice: 25 },
    { category: "Nettoyages techniques", name: "Nettoyage de panneaux solaires", unit: "m2", minPrice: 3, maxPrice: 8 },
    { category: "Nettoyages techniques", name: "Nettoyage de toitures", unit: "m2", minPrice: 10, maxPrice: 28 },
    { category: "Nettoyages techniques", name: "Nettoyage de gouttieres", unit: "ml", minPrice: 8, maxPrice: 20 },
    { category: "Nettoyages techniques", name: "Nettoyage haute pression (Karcher)", unit: "m2", minPrice: 4, maxPrice: 12 },

    { category: "Exterieurs", name: "Nettoyage de terrasses", unit: "m2", minPrice: 4, maxPrice: 12 },
    { category: "Exterieurs", name: "Nettoyage de balcons", unit: "m2", minPrice: 4, maxPrice: 12 },
    { category: "Exterieurs", name: "Nettoyage de parkings", unit: "m2", minPrice: 2, maxPrice: 7 },
    { category: "Exterieurs", name: "Nettoyage de cours / allees", unit: "m2", minPrice: 3, maxPrice: 9 },
    { category: "Exterieurs", name: "Nettoyage de jardins (dechets, remise en ordre)", unit: "heure", minPrice: 55, maxPrice: 95 },

    { category: "Hygiene et maintenance", name: "Desinfection sanitaire", unit: "m2", minPrice: 2.5, maxPrice: 8 },
    { category: "Hygiene et maintenance", name: "Deratisation / desinsectisation", unit: "forfait", minPrice: 180, maxPrice: 450 },
    { category: "Hygiene et maintenance", name: "Debarras et evacuation d encombrants", unit: "m2", minPrice: 6, maxPrice: 18 },
    { category: "Hygiene et maintenance", name: "Tri et recyclage", unit: "heure", minPrice: 50, maxPrice: 85 },
    { category: "Hygiene et maintenance", name: "Nettoyage avant location / Airbnb", unit: "heure", minPrice: 55, maxPrice: 95 },

    { category: "Cas tres specifiques", name: "Syndrome de Diogene", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Cas tres specifiques", name: "Logements squattes", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Cas tres specifiques", name: "Locaux abandonnes", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Cas tres specifiques", name: "Interventions apres police / judiciaire", unit: "devis", minPrice: 0, maxPrice: 0 },
    { category: "Cas tres specifiques", name: "Nettoyage post-incendie", unit: "devis", minPrice: 0, maxPrice: 0 }
  ];

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatCHF(value) {
    return new Intl.NumberFormat("fr-CH", {
      style: "currency",
      currency: "CHF",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_CONFIG);
      if (!raw) {
        return Object.assign({}, DEFAULT_CONFIG);
      }
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_CONFIG, parsed || {});
    } catch (error) {
      return Object.assign({}, DEFAULT_CONFIG);
    }
  }

  function saveConfig(config) {
    var merged = Object.assign({}, DEFAULT_CONFIG, config || {});
    Object.keys(merged).forEach(function (key) {
      var val = toNumber(merged[key], DEFAULT_CONFIG[key]);
      var minVal = CONFIG_MIN[key];
      if (minVal !== undefined && val < minVal) {
        val = DEFAULT_CONFIG[key];
      }
      merged[key] = val;
    });
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(merged));
    return merged;
  }

  function resetConfig() {
    localStorage.removeItem(STORAGE_CONFIG);
    return Object.assign({}, DEFAULT_CONFIG);
  }

  function diagnoseConfig() {
    var cfg = loadConfig();
    var issues = [];
    Object.keys(CONFIG_MIN).forEach(function (key) {
      var min = CONFIG_MIN[key];
      if (cfg[key] < min) {
        issues.push(key + " = " + cfg[key] + " (min " + min + ")");
      }
    });
    return { config: cfg, issues: issues };
  }

  function cloneDefaultCatalog() {
    return DEFAULT_SERVICE_CATALOG.map(function (item, index) {
      return {
        id: "svc_" + String(index + 1),
        category: String(item.category || "Autres"),
        name: String(item.name || "Service"),
        unit: String(item.unit || "devis"),
        minPrice: round2(toNumber(item.minPrice, 0)),
        maxPrice: round2(toNumber(item.maxPrice, 0))
      };
    });
  }

  function normalizeCatalogRow(item, index) {
    var minPrice = Math.max(0, round2(toNumber(item && item.minPrice, 0)));
    var maxPrice = Math.max(minPrice, round2(toNumber(item && item.maxPrice, minPrice)));
    var unit = String((item && item.unit) || "devis").trim() || "devis";
    return {
      id: String((item && item.id) || ("svc_" + String(index + 1))),
      category: String((item && item.category) || "Autres").trim() || "Autres",
      name: String((item && item.name) || "Service").trim() || "Service",
      unit: unit,
      minPrice: minPrice,
      maxPrice: maxPrice,
      linkedField: String((item && item.linkedField) || "")
    };
  }

  function loadServiceCatalog() {
    try {
      var raw = localStorage.getItem(STORAGE_CATALOG);
      if (!raw) {
        return cloneDefaultCatalog();
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) {
        return cloneDefaultCatalog();
      }
      return parsed.map(function (item, index) {
        return normalizeCatalogRow(item, index);
      });
    } catch (error) {
      return cloneDefaultCatalog();
    }
  }

  function saveServiceCatalog(catalog) {
    var safe = Array.isArray(catalog) ? catalog : [];
    var normalized = safe
      .map(function (item, index) {
        return normalizeCatalogRow(item, index);
      })
      .filter(function (item) {
        return item.name.length > 0;
      });
    localStorage.setItem(STORAGE_CATALOG, JSON.stringify(normalized));
    return normalized;
  }

  function resetServiceCatalog() {
    var defaults = cloneDefaultCatalog();
    localStorage.setItem(STORAGE_CATALOG, JSON.stringify(defaults));
    return defaults;
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_HISTORY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveHistory(list) {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list || []));
  }

  function addHistory(entry) {
    var current = loadHistory();
    current.unshift(entry);
    if (current.length > 200) {
      current = current.slice(0, 200);
    }
    saveHistory(current);
    return current;
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_HISTORY);
  }

  function getTypeLabel(type) {
    var labels = {
      standard: "Standard",
      recurring: "Menage recurrent",
      end_of_lease: "Fin de bail",
      diogene: "Diogene",
      disinfection_simple: "Desinfection simple",
      decontamination_heavy: "Decontamination lourde",
      windows_storefront: "Vitrines commerciales",
      extreme: "Nettoyage extreme"
    };
    return labels[type] || "Standard";
  }

  function getModeLabel(mode) {
    var labels = {
      auto: "Auto",
      m2: "Calcul au m2",
      hour: "Calcul a l'heure"
    };
    return labels[mode] || labels.auto;
  }

  function getHourlyRateByType(type, config) {
    if (type === "diogene") return config.diogeneHourlyRate;
    if (type === "extreme") return config.extremeHourlyRate;
    return config.standardHourlyRate;
  }

  function getM2RateByType(type, config, veryDirty) {
    // Pour les types factures a l'heure, on derive le taux m2 depuis le taux horaire
    // afin que les modes "heure" et "m2" donnent le meme resultat.
    if (type === "standard") return round2(config.standardHourlyRate / config.standardM2PerHour);
    if (type === "extreme") return round2(config.extremeHourlyRate / config.extremeM2PerHour);
    if (type === "end_of_lease") return veryDirty ? config.endOfLeaseDirtyPerM2 : config.endOfLeasePerM2;
    if (type === "diogene") return round2(config.diogeneHourlyRate * config.diogeneMultiplier / config.diogeneM2PerHour);
    if (type === "disinfection_simple") return config.disinfectionSimplePerM2;
    if (type === "decontamination_heavy") return config.decontaminationHeavyPerM2;
    if (type === "windows_storefront") return config.windowsStorefrontPerM2;
    return round2(config.standardHourlyRate / config.standardM2PerHour);
  }

  function getM2PerHourByType(type, config) {
    if (type === "end_of_lease") return config.endOfLeaseM2PerHour;
    if (type === "diogene") return config.diogeneM2PerHour;
    if (type === "extreme") return config.extremeM2PerHour;
    if (type === "disinfection_simple" || type === "decontamination_heavy") return config.disinfectionM2PerHour;
    if (type === "recurring") return config.recurringM2PerHour;
    return config.standardM2PerHour;
  }

  function roundToQuarter(hours) {
    return Math.ceil(hours * 4) / 4;
  }

  function applyDurationBuffer(hours, config) {
    var setup = Math.max(0, toNumber(config.setupTimeHours, 0));
    var buffer = Math.max(0, toNumber(config.durationBufferRate, 0));
    var adjusted = (Math.max(0, toNumber(hours, 0)) + setup) * (1 + buffer);
    return roundToQuarter(adjusted);
  }

  function getRecurringRate(frequency, config) {
    if (frequency === "weekly") return config.recurringWeeklyRate;
    if (frequency === "bimonthly") return config.recurringBiMonthlyRate;
    if (frequency === "monthly") return config.recurringMonthlyRate;
    return config.recurringOnceRate;
  }

  function estimateBase(type, surfaceM2, config, frequency) {
    if (type === "recurring") {
      var recurringHours = roundToQuarter(surfaceM2 / config.recurringM2PerHour);
      recurringHours = Math.max(0.25, recurringHours);
      var recurringRate = getRecurringRate(frequency, config);
      return {
        amount: round2(recurringHours * recurringRate),
        hours: recurringHours
      };
    }

    if (type === "end_of_lease") {
      return {
        amount: round2(surfaceM2 * config.endOfLeasePerM2),
        hours: round2(surfaceM2 / config.endOfLeaseM2PerHour)
      };
    }

    if (type === "disinfection_simple" || type === "decontamination_heavy") {
      var disinfM2Rate = getM2RateByType(type, config, false);
      return {
        amount: round2(surfaceM2 * disinfM2Rate),
        hours: round2(surfaceM2 / config.disinfectionM2PerHour)
      };
    }

    if (type === "extreme") {
      var extremeHours = Math.max(2, surfaceM2 / config.extremeM2PerHour);
      return {
        amount: round2(extremeHours * config.extremeHourlyRate),
        hours: round2(extremeHours)
      };
    }

    if (type === "diogene") {
      var diogeneHours = Math.max(2, surfaceM2 / config.diogeneM2PerHour);
      var diogeneBase = diogeneHours * config.diogeneHourlyRate * config.diogeneMultiplier;
      return {
        amount: round2(diogeneBase),
        hours: round2(diogeneHours)
      };
    }

    var standardHours = Math.max(1, surfaceM2 / config.standardM2PerHour);
    return {
      amount: round2(standardHours * config.standardHourlyRate),
      hours: round2(standardHours)
    };
  }

  function computeEstimate(input, providedConfig) {
    var config = providedConfig || loadConfig();

    var surfaceM2 = Math.max(0, toNumber(input.surfaceM2, 0));
    var type = input.cleaningType || "standard";
    var calcMode = input.calcMode || "auto";
    var manualHours = Math.max(0, toNumber(input.hours, 0));
    var frequency = input.frequency || "once";
    var urgent = Boolean(input.urgent);
    var veryDirty = Boolean(input.veryDirty);
    var windows = Boolean(input.windows);
    var bulkyWaste = Boolean(input.bulkyWaste);
    var pests = Boolean(input.pests);
    var stairsNoLift = Boolean(input.stairsNoLift);
    var weekend = Boolean(input.weekend);
    var customExtra = Math.max(0, toNumber(input.customExtra, 0));
    var travelKm = Math.max(0, toNumber(input.travelKm, 0));

    var base = estimateBase(type, surfaceM2, config, frequency);

    if (type !== "recurring" && calcMode === "hour") {
      var billedHours = manualHours > 0 ? manualHours : base.hours;
      base = {
        amount: round2(billedHours * getHourlyRateByType(type, config)),
        hours: round2(billedHours),
        unitLabel: "heure"
      };
    } else if (type !== "recurring" && calcMode === "m2") {
      var m2Rate = getM2RateByType(type, config, veryDirty);
      var m2PerHour = getM2PerHourByType(type, config);
      base = {
        amount: round2(surfaceM2 * m2Rate),
        hours: round2(surfaceM2 / m2PerHour),
        unitLabel: "m2"
      };
    } else if (type !== "recurring") {
      base.unitLabel = "auto";
    } else {
      base.unitLabel = "heure";
    }

    var windowsAmount = windows && type !== "windows_storefront" ? round2(surfaceM2 * config.windowsPerM2) : 0;
    var bulkyAmount = bulkyWaste
      ? round2(Math.max(config.bulkyWasteFlat, surfaceM2 * config.bulkyWastePerM2))
      : 0;
    var pestsAmount = pests ? round2(config.pestsInterventionFee) : 0;
    var travelAmount = round2(travelKm * config.travelPerKm);

    // Calcul des heures supplementaires pour les options (vitres, debarras, etc.)
    var optionHours = 0;
    if (windowsAmount > 0) {
      optionHours += round2(windowsAmount / config.standardHourlyRate);
    }
    if (bulkyAmount > 0) {
      optionHours += round2(bulkyAmount / config.standardHourlyRate);
    }
    if (pestsAmount > 0) {
      optionHours += round2(pestsAmount / config.standardHourlyRate);
    }

    // Mise a jour des heures totales avec les options, puis marge de securite
    var totalHoursRaw = round2(base.hours + optionHours);
    var totalHours = applyDurationBuffer(totalHoursRaw, config);

    var subtotal = round2(base.amount + windowsAmount + bulkyAmount + pestsAmount + travelAmount + customExtra);

    var majorationRate = 0;
    var majorations = [];

    if (urgent) {
      majorationRate += config.urgentRate;
      majorations.push({
        key: "urgent",
        label: "Majoration urgence",
        rate: config.urgentRate
      });
    }

    if (veryDirty) {
      majorationRate += config.veryDirtyRate;
      majorations.push({
        key: "very_dirty",
        label: "Majoration tres sale",
        rate: config.veryDirtyRate
      });
    }

    if (weekend) {
      majorationRate += config.weekendRate;
      majorations.push({
        key: "weekend",
        label: "Majoration week-end",
        rate: config.weekendRate
      });
    }

    if (stairsNoLift) {
      majorationRate += config.stairsRate;
      majorations.push({
        key: "stairs",
        label: "Majoration sans ascenseur",
        rate: config.stairsRate
      });
    }

    var majorationAmount = round2(subtotal * majorationRate);
    var total = round2(subtotal + majorationAmount);

    return {
      input: {
        surfaceM2: surfaceM2,
        cleaningType: type,
        calcMode: calcMode,
        frequency: frequency,
        hours: manualHours,
        urgent: urgent,
        veryDirty: veryDirty,
        windows: windows,
        bulkyWaste: bulkyWaste,
        pests: pests,
        stairsNoLift: stairsNoLift,
        weekend: weekend,
        customExtra: customExtra,
        travelKm: travelKm
      },
      breakdown: {
        baseAmount: base.amount,
        baseHours: base.hours,
        rawEstimatedHours: totalHoursRaw,
        estimatedHours: totalHours,
        baseUnit: base.unitLabel || "auto",
        windowsAmount: windowsAmount,
        windowsHours: windowsAmount > 0 ? round2(windowsAmount / config.standardHourlyRate) : 0,
        bulkyAmount: bulkyAmount,
        bulkyHours: bulkyAmount > 0 ? round2(bulkyAmount / config.standardHourlyRate) : 0,
        pestsAmount: pestsAmount,
        pestsHours: pestsAmount > 0 ? round2(pestsAmount / config.standardHourlyRate) : 0,
        travelAmount: travelAmount,
        customExtra: customExtra,
        subtotal: subtotal,
        majorationRate: majorationRate,
        majorationAmount: majorationAmount,
        total: total,
        majorations: majorations
      },
      labels: {
        typeLabel: getTypeLabel(type),
        modeLabel: getModeLabel(calcMode)
      }
    };
  }

  window.BrimotTool = {
    DEFAULT_CONFIG: Object.freeze(Object.assign({}, DEFAULT_CONFIG)),
    DEFAULT_SERVICE_CATALOG: Object.freeze(cloneDefaultCatalog()),
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    resetConfig: resetConfig,
    diagnoseConfig: diagnoseConfig,
    loadServiceCatalog: loadServiceCatalog,
    saveServiceCatalog: saveServiceCatalog,
    resetServiceCatalog: resetServiceCatalog,
    computeEstimate: computeEstimate,
    formatCHF: formatCHF,
    loadHistory: loadHistory,
    addHistory: addHistory,
    clearHistory: clearHistory,
    getTypeLabel: getTypeLabel,
    toNumber: toNumber,
    round2: round2
  };
})();
