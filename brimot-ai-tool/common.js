(function () {
  "use strict";

  var STORAGE_CONFIG = "brimot_tool_config_v1";
  var STORAGE_HISTORY = "brimot_tool_history_v1";

  var DEFAULT_CONFIG = {
    standardHourlyRate: 65,
    diogeneHourlyRate: 120,
    endOfLeasePerM2: 7,
    windowsPerM2: 3.5,
    travelPerKm: 1.2,
    urgentRate: 0.3,
    veryDirtyRate: 0.5,
    diogeneMultiplier: 1.35,
    bulkyWasteFlat: 120,
    bulkyWastePerM2: 1.4,
    standardM2PerHour: 32,
    diogeneM2PerHour: 12
  };

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
      merged[key] = toNumber(merged[key], DEFAULT_CONFIG[key]);
    });
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(merged));
    return merged;
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
      end_of_lease: "Fin de bail",
      diogene: "Diogene"
    };
    return labels[type] || "Standard";
  }

  function estimateBase(type, surfaceM2, config) {
    if (type === "end_of_lease") {
      return {
        amount: round2(surfaceM2 * config.endOfLeasePerM2),
        hours: round2(surfaceM2 / config.standardM2PerHour)
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
    var urgent = Boolean(input.urgent);
    var veryDirty = Boolean(input.veryDirty);
    var windows = Boolean(input.windows);
    var bulkyWaste = Boolean(input.bulkyWaste);
    var travelKm = Math.max(0, toNumber(input.travelKm, 0));

    var base = estimateBase(type, surfaceM2, config);
    var windowsAmount = windows ? round2(surfaceM2 * config.windowsPerM2) : 0;
    var bulkyAmount = bulkyWaste
      ? round2(Math.max(config.bulkyWasteFlat, surfaceM2 * config.bulkyWastePerM2))
      : 0;
    var travelAmount = round2(travelKm * config.travelPerKm);

    var subtotal = round2(base.amount + windowsAmount + bulkyAmount + travelAmount);

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

    var majorationAmount = round2(subtotal * majorationRate);
    var total = round2(subtotal + majorationAmount);

    return {
      input: {
        surfaceM2: surfaceM2,
        cleaningType: type,
        urgent: urgent,
        veryDirty: veryDirty,
        windows: windows,
        bulkyWaste: bulkyWaste,
        travelKm: travelKm
      },
      breakdown: {
        baseAmount: base.amount,
        estimatedHours: base.hours,
        windowsAmount: windowsAmount,
        bulkyAmount: bulkyAmount,
        travelAmount: travelAmount,
        subtotal: subtotal,
        majorationRate: majorationRate,
        majorationAmount: majorationAmount,
        total: total,
        majorations: majorations
      },
      labels: {
        typeLabel: getTypeLabel(type)
      }
    };
  }

  window.BrimotTool = {
    DEFAULT_CONFIG: Object.freeze(Object.assign({}, DEFAULT_CONFIG)),
    loadConfig: loadConfig,
    saveConfig: saveConfig,
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
