(function () {
  "use strict";

  var tool = window.BrimotTool;
  var STORAGE_KEY = "brimot_vehicle_sim_v1";

  var fields = [
    "daysPerMonth",
    "monthsPerYear",
    "referenceYear",
    "grossSalary",
    "extraSocialRate",
    "avsRate",
    "unemploymentRate",
    "lppRate",
    "vacationRate",
    "kmPerDay",
    "leasingMonthly",
    "vehicleInsuranceYearly",
    "companyInsuranceYearly",
    "taxYearly",
    "vignetteYearly",
    "maintenanceCost",
    "maintenanceKm",
    "tiresCost",
    "tiresKm",
    "dieselPrice",
    "consumptionPer100",
    "parcelsPerDay",
    "pricePerParcel",
    "targetMarginRate",
    "otherDailyCosts"
  ];

  var defaults = {
    daysPerMonth: 22,
    monthsPerYear: 12,
    referenceYear: 2026,
    grossSalary: 5000,
    extraSocialRate: 0,
    avsRate: 5.5,
    unemploymentRate: 1.15,
    lppRate: 10,
    vacationRate: 10.5,
    kmPerDay: 180,
    leasingMonthly: 850,
    vehicleInsuranceYearly: 2400,
    companyInsuranceYearly: 1200,
    taxYearly: 900,
    vignetteYearly: 40,
    maintenanceCost: 1800,
    maintenanceKm: 30000,
    tiresCost: 1200,
    tiresKm: 30000,
    dieselPrice: 1.95,
    consumptionPer100: 10,
    parcelsPerDay: 85,
    pricePerParcel: 4.5,
    targetMarginRate: 15,
    otherDailyCosts: 0
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(Number(value) || 0);
  }

  function formatKm(value) {
    return formatNumber(value, 0) + " km";
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, defaults);
      return Object.assign({}, defaults, JSON.parse(raw) || {});
    } catch (error) {
      return Object.assign({}, defaults);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function fillForm(state) {
    fields.forEach(function (field) {
      var el = byId(field);
      if (el) el.value = state[field];
    });
  }

  function readForm() {
    var values = {};
    fields.forEach(function (field) {
      values[field] = tool.toNumber(byId(field).value, defaults[field]);
    });
    values.daysPerMonth = Math.max(1, values.daysPerMonth);
    values.monthsPerYear = Math.min(12, Math.max(1, values.monthsPerYear));
    values.maintenanceKm = Math.max(1, values.maintenanceKm);
    values.tiresKm = Math.max(1, values.tiresKm);
    values.targetMarginRate = Math.min(95, Math.max(0, values.targetMarginRate));
    return values;
  }

  function compute(state) {
    var totalSocialRate = state.extraSocialRate + state.avsRate + state.unemploymentRate + state.lppRate + state.vacationRate;
    var chargedSalaryMonthly = state.grossSalary * (1 + (totalSocialRate / 100));
    var daysPerYear = state.daysPerMonth * state.monthsPerYear;
    var annualFixedCosts =
      (state.leasingMonthly * state.monthsPerYear) +
      state.vehicleInsuranceYearly +
      state.companyInsuranceYearly +
      state.taxYearly +
      state.vignetteYearly;

    var salaryDailyCost = chargedSalaryMonthly / state.daysPerMonth;
    var fixedVehicleDailyCost = annualFixedCosts / daysPerYear;
    var fixedDailyCost = fixedVehicleDailyCost + salaryDailyCost;
    var dieselPerKm = state.dieselPrice * (state.consumptionPer100 / 100);
    var maintenancePerKm = state.maintenanceCost / state.maintenanceKm;
    var tiresPerKm = state.tiresCost / state.tiresKm;
    var variablePerKm = dieselPerKm + maintenancePerKm + tiresPerKm;
    var costPerDay = fixedDailyCost + (variablePerKm * state.kmPerDay) + state.otherDailyCosts;
    var costPerKm = state.kmPerDay > 0 ? costPerDay / state.kmPerDay : 0;
    var costPerParcel = state.parcelsPerDay > 0 ? costPerDay / state.parcelsPerDay : 0;
    var revenuePerDay = state.parcelsPerDay * state.pricePerParcel;
    var profitPerDay = revenuePerDay - costPerDay;
    var revenuePerYear = revenuePerDay * daysPerYear;
    var profitPerYear = profitPerDay * daysPerYear;
    var breakEvenPricePerParcel = state.parcelsPerDay > 0 ? costPerDay / state.parcelsPerDay : 0;
    var targetRevenuePerDay = costPerDay / (1 - (state.targetMarginRate / 100));
    var targetPricePerParcel = state.parcelsPerDay > 0 ? targetRevenuePerDay / state.parcelsPerDay : 0;

    return {
      totalSocialRate: totalSocialRate,
      chargedSalaryMonthly: chargedSalaryMonthly,
      daysPerYear: daysPerYear,
      annualFixedCosts: annualFixedCosts,
      salaryDailyCost: salaryDailyCost,
      fixedVehicleDailyCost: fixedVehicleDailyCost,
      fixedDailyCost: fixedDailyCost,
      dieselPerKm: dieselPerKm,
      maintenancePerKm: maintenancePerKm,
      tiresPerKm: tiresPerKm,
      variablePerKm: variablePerKm,
      costPerDay: costPerDay,
      costPerKm: costPerKm,
      costPerParcel: costPerParcel,
      revenuePerDay: revenuePerDay,
      revenuePerYear: revenuePerYear,
      profitPerDay: profitPerDay,
      profitPerYear: profitPerYear,
      breakEvenPricePerParcel: breakEvenPricePerParcel,
      targetRevenuePerDay: targetRevenuePerDay,
      targetPricePerParcel: targetPricePerParcel
    };
  }

  function renderBreakdown(state, result) {
    var rows = [
      ["Salaire chargé / mois", tool.formatCHF(result.chargedSalaryMonthly)],
      ["Salaire + charges / jour", tool.formatCHF(result.salaryDailyCost)],
      ["Frais fixes annuels véhicule", tool.formatCHF(result.annualFixedCosts)],
      ["Frais fixes véhicule / jour", tool.formatCHF(result.fixedVehicleDailyCost)],
      ["Diesel / km", tool.formatCHF(result.dieselPerKm)],
      ["Entretien / km", tool.formatCHF(result.maintenancePerKm)],
      ["Pneus / km", tool.formatCHF(result.tiresPerKm)],
      ["Coût variable / km", tool.formatCHF(result.variablePerKm)],
      ["Autres frais / jour", tool.formatCHF(state.otherDailyCosts)],
      ["Km exploités / année", formatKm(state.kmPerDay * result.daysPerYear)]
    ];

    byId("vehicleBreakdown").innerHTML = rows.map(function (row) {
      return '<div class="breakdown-item"><span>' + row[0] + '</span><strong>' + row[1] + '</strong></div>';
    }).join("");
  }

  function renderInsights(state, result) {
    var badge = byId("profitBadge");
    var insight = byId("simInsight");
    var profitable = result.profitPerDay >= 0;
    var missingPerDay = Math.max(0, result.targetRevenuePerDay - result.revenuePerDay);
    var extraParcelsNeeded = state.pricePerParcel > 0 ? Math.ceil(missingPerDay / state.pricePerParcel) : 0;

    badge.textContent = profitable ? "Rentable" : "Sous le seuil";
    badge.className = profitable ? "tag profit-tag" : "tag loss-tag";

    if (profitable) {
      insight.className = "insight-box insight-good";
      insight.innerHTML = [
        "<strong>Le véhicule couvre actuellement ses coûts.</strong>",
        "Résultat journalier estimé: " + tool.formatCHF(result.profitPerDay) + ".",
        "Pour viser " + formatNumber(state.targetMarginRate, 0) + "% de marge, il faut atteindre " + tool.formatCHF(result.targetRevenuePerDay) + " par jour, soit environ " + tool.formatCHF(result.targetPricePerParcel) + " par colis."
      ].join(" ");
      return;
    }

    insight.className = "insight-box insight-warn";
    insight.innerHTML = [
      "<strong>Le véhicule n'est pas encore rentable.</strong>",
      "Il manque " + tool.formatCHF(Math.abs(result.profitPerDay)) + " par jour pour atteindre le seuil de rentabilité.",
      state.pricePerParcel > 0
        ? "Au prix actuel, cela représente environ " + extraParcelsNeeded + " colis supplémentaires par jour."
        : "Renseignez un prix moyen par colis pour estimer le volume supplémentaire nécessaire."
    ].join(" ");
  }

  function render(state, result) {
    byId("costPerKm").textContent = tool.formatCHF(result.costPerKm);
    byId("costPerDay").textContent = tool.formatCHF(result.costPerDay);
    byId("costPerParcel").textContent = state.parcelsPerDay > 0 ? tool.formatCHF(result.costPerParcel) : "-";
    byId("revenuePerDay").textContent = tool.formatCHF(result.revenuePerDay);
    byId("profitPerDay").textContent = tool.formatCHF(result.profitPerDay);
    byId("profitPerYear").textContent = tool.formatCHF(result.profitPerYear);
    byId("breakEvenText").textContent = tool.formatCHF(result.costPerDay) + " / jour";
    byId("breakEvenParcelText").textContent = state.parcelsPerDay > 0
      ? "Prix minimum rentable: " + tool.formatCHF(result.breakEvenPricePerParcel) + " par colis"
      : "Ajoutez un nombre de colis / jour pour calculer le prix minimum par colis.";
    byId("targetRevenueText").textContent = tool.formatCHF(result.targetRevenuePerDay) + " / jour";
    byId("targetParcelText").textContent = state.parcelsPerDay > 0
      ? "Prix conseillé à " + formatNumber(state.targetMarginRate, 0) + "% de marge: " + tool.formatCHF(result.targetPricePerParcel) + " par colis"
      : "Ajoutez un nombre de colis / jour pour calculer le prix conseillé par colis.";

    renderBreakdown(state, result);
    renderInsights(state, result);
  }

  function refresh() {
    var state = readForm();
    saveState(state);
    render(state, compute(state));
  }

  fillForm(loadState());
  refresh();

  fields.forEach(function (field) {
    var el = byId(field);
    if (!el) return;
    el.addEventListener("input", refresh);
    el.addEventListener("change", refresh);
  });
})();
