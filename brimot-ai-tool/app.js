(function () {
  "use strict";

  var tool = window.BrimotTool;
  var form = document.getElementById("quickQuoteForm");
  var resultCard = document.getElementById("resultCard");
  var resultType = document.getElementById("resultType");
  var resultTotal = document.getElementById("resultTotal");
  var resultHours = document.getElementById("resultHours");
  var resultSurface = document.getElementById("resultSurface");
  var breakdown = document.getElementById("breakdown");
  var cleaningTypeSelect = document.getElementById("cleaningType");
  var calcModeSelect = document.getElementById("calcMode");
  var servicePriceHint = document.getElementById("servicePriceHint");

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function inferEstimateType(item) {
    var text = slugify((item.category || "") + " " + (item.name || ""));

    if (text.indexOf("diogene") !== -1) return "diogene";
    if (text.indexOf("fin_de_bail") !== -1 || text.indexOf("etat_des_lieux") !== -1 || text.indexOf("demenagement") !== -1) return "end_of_lease";
    if (text.indexOf("desinfection") !== -1 || text.indexOf("desinfection_sanitaire") !== -1) return "disinfection_simple";
    if (text.indexOf("decontamination") !== -1 || text.indexOf("virus") !== -1 || text.indexOf("bacteries") !== -1) return "decontamination_heavy";
    if (text.indexOf("vitres") !== -1 || text.indexOf("vitrines") !== -1) return "windows_storefront";
    if (
      text.indexOf("extreme") !== -1 ||
      text.indexOf("apres_deces") !== -1 ||
      text.indexOf("post_incendie") !== -1 ||
      text.indexOf("police") !== -1 ||
      text.indexOf("judiciaire") !== -1 ||
      text.indexOf("squattes") !== -1 ||
      text.indexOf("abandonnes") !== -1 ||
      text.indexOf("sinistre") !== -1
    ) {
      return "extreme";
    }

    return "standard";
  }

  function inferCalcMode(item) {
    var unit = String(item.unit || "").toLowerCase();
    if (unit === "heure") return "hour";
    if (unit === "m2") return "m2";
    return "auto";
  }

  function formatServiceRange(item) {
    var min = Number(item.minPrice) || 0;
    var max = Number(item.maxPrice) || 0;
    var unit = item.unit || "devis";

    if (!min && !max) {
      return "Sur devis";
    }
    if (min === max) {
      return tool.formatCHF(min) + " / " + unit;
    }
    return tool.formatCHF(min) + " a " + tool.formatCHF(max) + " / " + unit;
  }

  function renderServiceOptions() {
    var catalog = tool.loadServiceCatalog();
    var groups = {};

    cleaningTypeSelect.innerHTML = "";

    catalog.forEach(function (item, index) {
      var category = item.category || "Autres";
      if (!groups[category]) {
        var group = document.createElement("optgroup");
        group.label = category;
        groups[category] = group;
        cleaningTypeSelect.appendChild(group);
      }

      var option = document.createElement("option");
      option.value = item.id || ("svc_" + String(index + 1));
      option.textContent = item.name + " - " + formatServiceRange(item);
      option.dataset.estimateType = inferEstimateType(item);
      option.dataset.calcMode = inferCalcMode(item);
      option.dataset.priceHint = formatServiceRange(item);
      option.dataset.serviceLabel = item.name || "Prestation";
      groups[category].appendChild(option);
    });

    if (cleaningTypeSelect.options.length) {
      cleaningTypeSelect.selectedIndex = 0;
      syncSelectedService();
    }
  }

  function syncSelectedService() {
    var selected = cleaningTypeSelect.options[cleaningTypeSelect.selectedIndex];
    if (!selected) {
      servicePriceHint.textContent = "";
      return;
    }

    servicePriceHint.textContent = "Prix indicatif: " + (selected.dataset.priceHint || "Sur devis");
    if (selected.dataset.calcMode) {
      calcModeSelect.value = selected.dataset.calcMode;
    }
  }

  function line(label, value, isTotal) {
    return (
      '<div class="breakdown-item' + (isTotal ? ' total' : '') + '">' +
      '<span>' + label + '</span>' +
      '<strong>' + value + '</strong>' +
      "</div>"
    );
  }

  function renderBreakdown(estimate) {
    var b = estimate.breakdown;
    var rows = [];

    rows.push(line("Base (" + estimate.labels.modeLabel + ")", tool.formatCHF(b.baseAmount), false));
    rows.push(line("Options vitres", tool.formatCHF(b.windowsAmount), false));
    rows.push(line("Options debarras", tool.formatCHF(b.bulkyAmount), false));
    rows.push(line("Nuisibles / cas special", tool.formatCHF(b.pestsAmount || 0), false));
    rows.push(line("Deplacement", tool.formatCHF(b.travelAmount), false));
    rows.push(line("Supplement manuel", tool.formatCHF(b.customExtra || 0), false));
    rows.push(line("Sous-total", tool.formatCHF(b.subtotal), false));

    if (b.majorations.length) {
      b.majorations.forEach(function (maj) {
        rows.push(line(maj.label + " (" + Math.round(maj.rate * 100) + "%)", "incluse", false));
      });
      rows.push(line("Montant majorations", tool.formatCHF(b.majorationAmount), false));
    }

    rows.push(line("Total estime", tool.formatCHF(b.total), true));

    breakdown.innerHTML = rows.join("");
  }

  function onSubmit(event) {
    event.preventDefault();

    var payload = {
      surfaceM2: document.getElementById("surfaceM2").value,
      cleaningType: cleaningTypeSelect.options[cleaningTypeSelect.selectedIndex]
        ? cleaningTypeSelect.options[cleaningTypeSelect.selectedIndex].dataset.estimateType
        : "standard",
      calcMode: calcModeSelect.value,
      hours: document.getElementById("hoursWorked").value,
      urgent: document.getElementById("optUrgent").checked,
      veryDirty: document.getElementById("optVeryDirty").checked,
      weekend: document.getElementById("optWeekend").checked,
      stairsNoLift: document.getElementById("optStairs").checked,
      windows: document.getElementById("optWindows").checked,
      bulkyWaste: document.getElementById("optBulky").checked,
      pests: document.getElementById("optPests").checked,
      customExtra: document.getElementById("customExtra").value,
      travelKm: document.getElementById("travelKm").value
    };

    var estimate = tool.computeEstimate(payload, tool.loadConfig());
    var selected = cleaningTypeSelect.options[cleaningTypeSelect.selectedIndex];

    resultType.textContent = selected && selected.dataset.serviceLabel
      ? selected.dataset.serviceLabel
      : estimate.labels.typeLabel;
    resultTotal.textContent = tool.formatCHF(estimate.breakdown.total);
    resultHours.textContent = estimate.breakdown.estimatedHours + " h";
    resultSurface.textContent = estimate.input.surfaceM2 + " m2";

    renderBreakdown(estimate);
    resultCard.style.display = "block";

    tool.addHistory({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      source: "dashboard",
      createdAt: new Date().toISOString(),
      input: estimate.input,
      typeLabel: selected && selected.dataset.serviceLabel
        ? selected.dataset.serviceLabel
        : estimate.labels.typeLabel,
      total: estimate.breakdown.total,
      details: estimate.breakdown
    });
  }

  cleaningTypeSelect.addEventListener("change", syncSelectedService);

  renderServiceOptions();
  form.addEventListener("submit", onSubmit);
})();
