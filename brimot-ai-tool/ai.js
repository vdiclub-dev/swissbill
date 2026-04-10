(function () {
  "use strict";

  var tool = window.BrimotTool;
  var form = document.getElementById("aiForm");
  var apiKeyInput = document.getElementById("openaiApiKey");
  var projectInput = document.getElementById("openaiProjectId");
  var outputCard = document.getElementById("aiOutputCard");
  var outputMeta = document.getElementById("aiOutputMeta");
  var outputMain = document.getElementById("aiOutputMain");
  var outputBreakdown = document.getElementById("aiBreakdown");
  var btnAnalyze = document.getElementById("btnAnalyze");

  var STORAGE_KEY = "brimot_openai_key_v1";
  var STORAGE_PROJECT = "brimot_openai_project_v1";

  apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || "";
  projectInput.value = localStorage.getItem(STORAGE_PROJECT) || "";

  apiKeyInput.addEventListener("change", function () {
    localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim());
  });

  projectInput.addEventListener("change", function () {
    localStorage.setItem(STORAGE_PROJECT, projectInput.value.trim());
  });

  document.getElementById("clearApiKey").addEventListener("click", function () {
    apiKeyInput.value = "";
    projectInput.value = "";
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_PROJECT);
  });

  function markdownEscape(text) {
    return String(text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderEstimate(structured, estimate) {
    outputMeta.innerHTML =
      '<span class="tag">Type detecte: ' + tool.getTypeLabel(structured.cleaning_type) + "</span> " +
      '<span class="tag">Confiance: ' + Math.round((structured.confidence || 0.7) * 100) + "%</span>";

    outputMain.innerHTML =
      '<div class="kpis">' +
      '<div class="kpi"><div class="kpi-label">Total estime</div><div class="kpi-value">' + tool.formatCHF(estimate.breakdown.total) + "</div></div>" +
      '<div class="kpi"><div class="kpi-label">Temps estime</div><div class="kpi-value">' + estimate.breakdown.estimatedHours + " h</div></div>" +
      '<div class="kpi"><div class="kpi-label">Surface utilisee</div><div class="kpi-value">' + estimate.input.surfaceM2 + " m2</div></div>" +
      '<div class="kpi"><div class="kpi-label">Majoration</div><div class="kpi-value">' + tool.formatCHF(estimate.breakdown.majorationAmount) + "</div></div>" +
      "</div>" +
      '<div style="margin-top:10px;" class="note">' + markdownEscape(structured.reasoning || "Analyse standard.") + "</div>";

    var html = "";
    html += '<div class="breakdown-item"><span>Base</span><strong>' + tool.formatCHF(estimate.breakdown.baseAmount) + "</strong></div>";
    html += '<div class="breakdown-item"><span>Vitres</span><strong>' + tool.formatCHF(estimate.breakdown.windowsAmount) + "</strong></div>";
    html += '<div class="breakdown-item"><span>Debarras</span><strong>' + tool.formatCHF(estimate.breakdown.bulkyAmount) + "</strong></div>";
    html += '<div class="breakdown-item"><span>Deplacement</span><strong>' + tool.formatCHF(estimate.breakdown.travelAmount) + "</strong></div>";
    html += '<div class="breakdown-item"><span>Sous-total</span><strong>' + tool.formatCHF(estimate.breakdown.subtotal) + "</strong></div>";
    html += '<div class="breakdown-item"><span>Majorations</span><strong>' + tool.formatCHF(estimate.breakdown.majorationAmount) + "</strong></div>";
    html += '<div class="breakdown-item total"><span>Total final</span><strong>' + tool.formatCHF(estimate.breakdown.total) + "</strong></div>";

    outputBreakdown.innerHTML = html;
    outputCard.style.display = "block";
  }

  async function callOpenAI(description, apiKey, projectId) {
    var body = {
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Tu es un estimateur de devis pour entreprise de nettoyage en Suisse. Retourne uniquement un JSON valide sans texte annexe avec les champs: surface_m2 (number), cleaning_type (standard|end_of_lease|diogene), urgent (boolean), very_dirty (boolean), windows (boolean), bulky_waste (boolean), travel_km (number), confidence (number 0..1), reasoning (string courte)."
        },
        {
          role: "user",
          content: description
        }
      ]
    };

    var headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey
    };

    if (projectId) {
      headers["OpenAI-Project"] = projectId;
    }

    var response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error("OpenAI error: " + errText);
    }

    var json = await response.json();
    var content = json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : "{}";

    try {
      return JSON.parse(content);
    } catch (error) {
      var match = String(content).match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Reponse IA non exploitable");
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var apiKey = apiKeyInput.value.trim();
    var projectId = projectInput.value.trim();
    var description = document.getElementById("siteDescription").value.trim();

    if (!apiKey) {
      alert("Ajoute ta cle OpenAI avant l'analyse.");
      return;
    }

    if (!description) {
      alert("Decris un chantier a analyser.");
      return;
    }

    btnAnalyze.disabled = true;
    btnAnalyze.textContent = "Analyse en cours...";

    try {
      var structured = await callOpenAI(description, apiKey, projectId);

      var payload = {
        surfaceM2: structured.surface_m2 || 60,
        cleaningType: structured.cleaning_type || "standard",
        urgent: Boolean(structured.urgent),
        veryDirty: Boolean(structured.very_dirty),
        windows: Boolean(structured.windows),
        bulkyWaste: Boolean(structured.bulky_waste),
        travelKm: structured.travel_km || 0
      };

      var estimate = tool.computeEstimate(payload, tool.loadConfig());
      renderEstimate(structured, estimate);

      tool.addHistory({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        source: "ai",
        createdAt: new Date().toISOString(),
        rawDescription: description,
        structured: structured,
        input: estimate.input,
        typeLabel: estimate.labels.typeLabel,
        total: estimate.breakdown.total,
        details: estimate.breakdown
      });
    } catch (error) {
      alert(error.message || "Erreur IA");
    } finally {
      btnAnalyze.disabled = false;
      btnAnalyze.textContent = "Analyser";
    }
  });
})();
