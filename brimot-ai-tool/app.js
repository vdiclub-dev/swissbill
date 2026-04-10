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

    rows.push(line("Base", tool.formatCHF(b.baseAmount), false));
    rows.push(line("Options vitres", tool.formatCHF(b.windowsAmount), false));
    rows.push(line("Options debarras", tool.formatCHF(b.bulkyAmount), false));
    rows.push(line("Deplacement", tool.formatCHF(b.travelAmount), false));
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
      cleaningType: document.getElementById("cleaningType").value,
      urgent: document.getElementById("optUrgent").checked,
      veryDirty: document.getElementById("optVeryDirty").checked,
      windows: document.getElementById("optWindows").checked,
      bulkyWaste: document.getElementById("optBulky").checked,
      travelKm: document.getElementById("travelKm").value
    };

    var estimate = tool.computeEstimate(payload, tool.loadConfig());

    resultType.textContent = estimate.labels.typeLabel;
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
      typeLabel: estimate.labels.typeLabel,
      total: estimate.breakdown.total,
      details: estimate.breakdown
    });
  }

  form.addEventListener("submit", onSubmit);
})();
