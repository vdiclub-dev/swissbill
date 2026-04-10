(function () {
  "use strict";

  var tool = window.BrimotTool;
  var form = document.getElementById("configForm");
  var resetBtn = document.getElementById("resetConfig");
  var suggestBtn = document.getElementById("btnSuggestPricing");
  var applyBtn = document.getElementById("btnApplyPricing");
  var outputEl = document.getElementById("aiPricingOutput");
  var apiKeyInput = document.getElementById("openaiApiKeyCfg");
  var projectInput = document.getElementById("openaiProjectIdCfg");
  var notesInput = document.getElementById("marketNotes");
  var positioningInput = document.getElementById("marketPositioning");
  var catalogRowsEl = document.getElementById("catalogRows");
  var addCatalogRowBtn = document.getElementById("btnAddCatalogRow");
  var saveCatalogBtn = document.getElementById("btnSaveCatalog");
  var resetCatalogBtn = document.getElementById("btnResetCatalog");

  var STORAGE_OPENAI_KEY = "brimot_openai_key_v1";
  var STORAGE_OPENAI_PROJECT = "brimot_openai_project_v1";

  var aiSuggestedPatch = null;

  var fields = [
    "standardHourlyRate",
    "standardPerM2",
    "diogeneHourlyRate",
    "diogenePerM2",
    "endOfLeasePerM2",
    "endOfLeaseDirtyPerM2",
    "disinfectionSimplePerM2",
    "decontaminationHeavyPerM2",
    "windowsPerM2",
    "windowsStorefrontPerM2",
    "travelPerKm",
    "extremeHourlyRate",
    "pestsInterventionFee",
    "urgentRate",
    "weekendRate",
    "stairsRate",
    "veryDirtyRate",
    "diogeneMultiplier",
    "bulkyWasteFlat",
    "bulkyWastePerM2",
    "standardM2PerHour",
    "diogeneM2PerHour"
  ];

  apiKeyInput.value = localStorage.getItem(STORAGE_OPENAI_KEY) || "";
  projectInput.value = localStorage.getItem(STORAGE_OPENAI_PROJECT) || "";

  apiKeyInput.addEventListener("change", function () {
    localStorage.setItem(STORAGE_OPENAI_KEY, apiKeyInput.value.trim());
  });

  projectInput.addEventListener("change", function () {
    localStorage.setItem(STORAGE_OPENAI_PROJECT, projectInput.value.trim());
  });

  function fill(config) {
    fields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.value = config[id];
      }
    });
  }

  function read() {
    var values = {};
    fields.forEach(function (id) {
      values[id] = tool.toNumber(document.getElementById(id).value, tool.DEFAULT_CONFIG[id]);
    });
    return values;
  }

  function createCatalogRow(item) {
    var row = document.createElement("tr");
    row.innerHTML = [
      '<td><input class="input" type="text" data-col="category" placeholder="Categorie"></td>',
      '<td><input class="input" type="text" data-col="name" placeholder="Prestation"></td>',
      '<td>',
      '  <select class="select" data-col="unit">',
      '    <option value="heure">heure</option>',
      '    <option value="m2">m2</option>',
      '    <option value="forfait">forfait</option>',
      '    <option value="devis">devis</option>',
      '    <option value="km">km</option>',
      '    <option value="ml">ml</option>',
      '  </select>',
      '</td>',
      '<td><input class="input" type="number" data-col="minPrice" min="0" step="0.1"></td>',
      '<td><input class="input" type="number" data-col="maxPrice" min="0" step="0.1"></td>',
      '<td class="catalog-row-remove"><button class="btn btn-ghost" type="button" data-action="remove">Supprimer</button></td>'
    ].join("");

    row.querySelector('[data-col="category"]').value = item.category || "";
    row.querySelector('[data-col="name"]').value = item.name || "";
    row.querySelector('[data-col="unit"]').value = item.unit || "devis";
    row.querySelector('[data-col="minPrice"]').value = tool.toNumber(item.minPrice, 0);
    row.querySelector('[data-col="maxPrice"]').value = tool.toNumber(item.maxPrice, 0);
    return row;
  }

  function renderCatalog(catalog) {
    catalogRowsEl.innerHTML = "";
    (catalog || []).forEach(function (item) {
      catalogRowsEl.appendChild(createCatalogRow(item));
    });
  }

  function readCatalogRows() {
    var rows = Array.prototype.slice.call(catalogRowsEl.querySelectorAll("tr"));
    return rows
      .map(function (row, index) {
        var category = row.querySelector('[data-col="category"]').value.trim();
        var name = row.querySelector('[data-col="name"]').value.trim();
        var unit = row.querySelector('[data-col="unit"]').value;
        var minPrice = Math.max(0, tool.toNumber(row.querySelector('[data-col="minPrice"]').value, 0));
        var maxPrice = Math.max(minPrice, tool.toNumber(row.querySelector('[data-col="maxPrice"]').value, minPrice));

        return {
          id: "svc_" + String(index + 1),
          category: category || "Autres",
          name: name,
          unit: unit,
          minPrice: tool.round2(minPrice),
          maxPrice: tool.round2(maxPrice)
        };
      })
      .filter(function (row) {
        return row.name.length > 0;
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var current = tool.loadConfig();
    var patch = read();
    var saved = tool.saveConfig(Object.assign({}, current, patch));
    fill(saved);
    alert("Configuration sauvegardee.");
  });

  resetBtn.addEventListener("click", function () {
    if (!confirm("Reinitialiser les tarifs par defaut ?")) {
      return;
    }
    var saved = tool.saveConfig(tool.DEFAULT_CONFIG);
    fill(saved);
  });

  function sanitizePatch(patch) {
    var cleaned = {};
    fields.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        cleaned[key] = tool.toNumber(patch[key], tool.DEFAULT_CONFIG[key]);
      }
    });
    return cleaned;
  }

  async function callOpenAIForPricing(apiKey, projectId, marketNotes, positioning, currentConfig) {
    var systemPrompt = [
      "Tu es un analyste pricing SaaS pour une entreprise de nettoyage en Suisse.",
      "Tu dois proposer un ajustement de tarifs en fonction du marche fourni.",
      "Retourne uniquement du JSON valide, sans texte autour.",
      "Le JSON doit contenir: { rationale: string, suggested: object }.",
      "Dans suggested, inclure uniquement des cles existantes de la grille tarifaire fournie.",
      "Conserver des valeurs realistes, positives, et arrondies (2 decimales max)."
    ].join(" ");

    var userPrompt = {
      positioning: positioning,
      market_notes: marketNotes,
      current_config: currentConfig,
      allowed_keys: fields
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
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt) }
        ]
      })
    });

    if (!response.ok) {
      var err = await response.text();
      throw new Error("Erreur OpenAI: " + err);
    }

    var json = await response.json();
    var content = json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : "{}";

    try {
      return JSON.parse(content);
    } catch (parseErr) {
      var match = String(content).match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Reponse IA non lisible");
    }
  }

  suggestBtn.addEventListener("click", async function () {
    var apiKey = apiKeyInput.value.trim();
    var projectId = projectInput.value.trim();
    var notes = notesInput.value.trim();

    if (!apiKey) {
      alert("Ajoute la cle OpenAI pour proposer un ajustement IA.");
      return;
    }
    if (!notes) {
      alert("Colle un releve marche avant l'analyse.");
      return;
    }

    suggestBtn.disabled = true;
    suggestBtn.textContent = "Analyse IA en cours...";
    applyBtn.disabled = true;
    aiSuggestedPatch = null;

    try {
      var currentConfig = tool.loadConfig();
      var aiResult = await callOpenAIForPricing(
        apiKey,
        projectId,
        notes,
        positioningInput.value,
        currentConfig
      );

      var patch = sanitizePatch((aiResult && aiResult.suggested) || {});
      var keys = Object.keys(patch);
      if (!keys.length) {
        throw new Error("Aucun ajustement exploitable retourne par l'IA.");
      }

      aiSuggestedPatch = patch;
      outputEl.style.display = "block";
      outputEl.textContent = JSON.stringify({
        rationale: aiResult.rationale || "Ajustement propose.",
        suggested: patch
      }, null, 2);
      applyBtn.disabled = false;
    } catch (error) {
      outputEl.style.display = "block";
      outputEl.textContent = "Erreur: " + (error.message || String(error));
    } finally {
      suggestBtn.disabled = false;
      suggestBtn.textContent = "Proposer ajustement IA";
    }
  });

  applyBtn.addEventListener("click", function () {
    if (!aiSuggestedPatch) {
      alert("Aucune proposition IA a appliquer.");
      return;
    }

    var merged = Object.assign({}, tool.loadConfig(), aiSuggestedPatch);
    var saved = tool.saveConfig(merged);
    fill(saved);
    alert("Proposition IA appliquee aux tarifs.");
  });

  catalogRowsEl.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || target.getAttribute("data-action") !== "remove") {
      return;
    }
    var tr = target.closest("tr");
    if (tr) {
      tr.remove();
    }
  });

  addCatalogRowBtn.addEventListener("click", function () {
    catalogRowsEl.appendChild(createCatalogRow({
      category: "Autres",
      name: "",
      unit: "devis",
      minPrice: 0,
      maxPrice: 0
    }));
  });

  saveCatalogBtn.addEventListener("click", function () {
    var rows = readCatalogRows();
    if (!rows.length) {
      alert("Ajoute au moins une prestation avant de sauvegarder.");
      return;
    }
    var saved = tool.saveServiceCatalog(rows);
    renderCatalog(saved);
    alert("Catalogue sauvegarde.");
  });

  resetCatalogBtn.addEventListener("click", function () {
    if (!confirm("Recharger la liste de prestations par defaut ?")) {
      return;
    }
    var defaults = tool.resetServiceCatalog();
    renderCatalog(defaults);
  });

  fill(tool.loadConfig());
  renderCatalog(tool.loadServiceCatalog());
})();
