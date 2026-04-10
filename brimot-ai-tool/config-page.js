(function () {
  "use strict";

  var tool = window.BrimotTool;
  var form = document.getElementById("configForm");
  var resetBtn = document.getElementById("resetConfig");
  var providerInput = document.getElementById("aiProviderCfg");
  var modelInput = document.getElementById("aiModelCfg");
  var suggestBtn = document.getElementById("btnSuggestPricing");
  var webSearchBtn = document.getElementById("btnWebSearchPricing");
  var applyBtn = document.getElementById("btnApplyPricing");
  var outputEl = document.getElementById("aiPricingOutput");
  var apiKeyInput = document.getElementById("openaiApiKeyCfg");
  var projectInput = document.getElementById("openaiProjectIdCfg");
  var notesInput = document.getElementById("marketNotes");
  var positioningInput = document.getElementById("marketPositioning");
  var marketQueryInput = document.getElementById("marketQuery");
  var marketRegionInput = document.getElementById("marketRegion");
  var catalogRowsEl = document.getElementById("catalogRows");
  var addCatalogRowBtn = document.getElementById("btnAddCatalogRow");
  var saveCatalogBtn = document.getElementById("btnSaveCatalog");
  var resetCatalogBtn = document.getElementById("btnResetCatalog");

  var STORAGE_PROVIDER = "brimot_ai_provider_v1";
  var STORAGE_MODEL = "brimot_ai_model_v1";
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

  function getDefaultModel(provider) {
    return provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini";
  }

  function getApiBase(provider) {
    return provider === "deepseek"
      ? "https://api.deepseek.com/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  }

  providerInput.value = localStorage.getItem(STORAGE_PROVIDER) || "deepseek";
  modelInput.value = localStorage.getItem(STORAGE_MODEL) || getDefaultModel(providerInput.value);
  apiKeyInput.value = localStorage.getItem(STORAGE_OPENAI_KEY) || "";
  projectInput.value = localStorage.getItem(STORAGE_OPENAI_PROJECT) || "";

  providerInput.addEventListener("change", function () {
    var provider = providerInput.value || "deepseek";
    localStorage.setItem(STORAGE_PROVIDER, provider);
    if (!modelInput.value.trim() || modelInput.value === "gpt-4o-mini" || modelInput.value === "deepseek-chat") {
      modelInput.value = getDefaultModel(provider);
    }
  });

  modelInput.addEventListener("change", function () {
    localStorage.setItem(STORAGE_MODEL, modelInput.value.trim());
  });

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

  function extractResponseText(json) {
    if (json && typeof json.output_text === "string" && json.output_text.trim()) {
      return json.output_text;
    }

    var parts = [];
    if (json && Array.isArray(json.output)) {
      json.output.forEach(function (item) {
        if (!item || !Array.isArray(item.content)) {
          return;
        }
        item.content.forEach(function (contentItem) {
          if (contentItem && typeof contentItem.text === "string") {
            parts.push(contentItem.text);
          }
        });
      });
    }

    return parts.join("\n").trim();
  }

  async function callOpenAIWebResearch(apiKey, projectId, marketQuery, marketRegion, positioning, currentConfig) {
    var headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey
    };

    if (projectId) {
      headers["OpenAI-Project"] = projectId;
    }

    var researchPrompt = [
      "Recherche sur le web des prix concurrents pour une entreprise de nettoyage en Suisse.",
      "Zone cible: " + (marketRegion || "Suisse romande"),
      "Requete principale: " + marketQuery,
      "Positionnement voulu: " + positioning,
      "A partir des resultats web, retourne uniquement un JSON valide.",
      "Format attendu:",
      '{"market_notes":"resume exploitable des prix observes",',
      '"sources":[{"title":"...","url":"...","price_signal":"..."}],',
      '"suggested":{"standardHourlyRate":0}}',
      "Dans suggested, inclure uniquement des cles existantes de la grille tarifaire fournie si un ajustement est justifie.",
      "Ne jamais inventer une source URL.",
      "Current config: " + JSON.stringify(currentConfig),
      "Allowed keys: " + JSON.stringify(fields)
    ].join("\n");

    var response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        tools: [
          {
            type: "web_search_preview",
            search_context_size: "medium"
          }
        ],
        input: researchPrompt
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error("Recherche web indisponible: " + errText);
    }

    var json = await response.json();
    var content = extractResponseText(json);

    try {
      return JSON.parse(content);
    } catch (parseErr) {
      var match = String(content).match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Reponse web non lisible");
    }
  }

  async function callAIForPricing(provider, model, apiKey, projectId, marketNotes, positioning, currentConfig) {
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
    if (provider === "openai" && projectId) {
      headers["OpenAI-Project"] = projectId;
    }

    var response = await fetch(getApiBase(provider), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt) }
        ]
      })
    });

    if (!response.ok) {
      var err = await response.text();
      throw new Error("Erreur " + (provider === "deepseek" ? "DeepSeek" : "OpenAI") + ": " + err);
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

  function showPricingOutput(payload) {
    outputEl.style.display = "block";
    outputEl.textContent = JSON.stringify(payload, null, 2);
  }

  function applyAiResult(aiResult) {
    var patch = sanitizePatch((aiResult && aiResult.suggested) || {});
    var keys = Object.keys(patch);
    if (!keys.length) {
      throw new Error("Aucun ajustement exploitable retourne par l IA.");
    }

    aiSuggestedPatch = patch;
    showPricingOutput({
      rationale: aiResult.rationale || aiResult.market_notes || "Ajustement propose.",
      sources: aiResult.sources || [],
      suggested: patch
    });
    applyBtn.disabled = false;
  }

  async function fallbackFromManualNotes(provider, model, apiKey, projectId, currentConfig, webErrorMessage) {
    var manualNotes = notesInput.value.trim();
    if (!manualNotes) {
      showPricingOutput({
        fallback: "manual_notes_required",
        web_error: webErrorMessage,
        message: "La recherche web a echoue. Colle un releve marche puis clique Proposer ajustement IA."
      });
      return;
    }

    var aiResult = await callAIForPricing(
      provider,
      model,
      apiKey,
      projectId,
      manualNotes,
      positioningInput.value,
      currentConfig
    );

    aiResult.rationale =
      "Recherche web indisponible. Ajustement genere depuis les notes manuelles. " +
      "Detail: " + webErrorMessage;
    aiResult.sources = [];
    applyAiResult(aiResult);
  }

  webSearchBtn.addEventListener("click", async function () {
    var provider = providerInput.value || "deepseek";
    var apiKey = apiKeyInput.value.trim();
    var projectId = projectInput.value.trim();
    var marketQuery = marketQueryInput.value.trim();
    var marketRegion = marketRegionInput.value.trim();

    if (!apiKey) {
      alert("Ajoute la cle API pour lancer la recherche web.");
      return;
    }

    if (provider !== "openai") {
      alert("La recherche web automatique est disponible seulement avec OpenAI dans cette version. DeepSeek reste disponible pour l analyse et la proposition tarifaire standard.");
      return;
    }

    if (!marketQuery) {
      alert("Ajoute une requete web concurrence.");
      return;
    }

    webSearchBtn.disabled = true;
    webSearchBtn.textContent = "Recherche web en cours...";
    suggestBtn.disabled = true;
    applyBtn.disabled = true;
    aiSuggestedPatch = null;

    try {
      var model = modelInput.value.trim() || getDefaultModel(provider);
      localStorage.setItem(STORAGE_PROVIDER, provider);
      localStorage.setItem(STORAGE_MODEL, model);
      var currentConfig = tool.loadConfig();
      var webResult = await callOpenAIWebResearch(
        apiKey,
        projectId,
        marketQuery,
        marketRegion,
        positioningInput.value,
        currentConfig
      );

      if (webResult.market_notes) {
        notesInput.value = webResult.market_notes;
      }

      if (webResult.suggested && Object.keys(webResult.suggested).length) {
        applyAiResult(webResult);
      } else {
        var aiResult = await callAIForPricing(
          provider,
          model,
          apiKey,
          projectId,
          notesInput.value.trim(),
          positioningInput.value,
          currentConfig
        );
        aiResult.sources = webResult.sources || [];
        if (!aiResult.rationale && webResult.market_notes) {
          aiResult.rationale = webResult.market_notes;
        }
        applyAiResult(aiResult);
      }
    } catch (error) {
      try {
        await fallbackFromManualNotes(
          provider,
          modelInput.value.trim() || getDefaultModel(provider),
          apiKey,
          projectId,
          tool.loadConfig(),
          error.message || String(error)
        );
      } catch (fallbackError) {
        showPricingOutput({
          error: error.message || String(error),
          fallback_error: fallbackError.message || String(fallbackError)
        });
      }
    } finally {
      webSearchBtn.disabled = false;
      webSearchBtn.textContent = "Recherche web + proposition IA";
      suggestBtn.disabled = false;
    }
  });

  suggestBtn.addEventListener("click", async function () {
    var provider = providerInput.value || "deepseek";
    var model = modelInput.value.trim() || getDefaultModel(provider);
    var apiKey = apiKeyInput.value.trim();
    var projectId = projectInput.value.trim();
    var notes = notesInput.value.trim();

    if (!apiKey) {
      alert("Ajoute la cle API pour proposer un ajustement IA.");
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
      localStorage.setItem(STORAGE_PROVIDER, provider);
      localStorage.setItem(STORAGE_MODEL, model);
      var currentConfig = tool.loadConfig();
      var aiResult = await callAIForPricing(
        provider,
        model,
        apiKey,
        projectId,
        notes,
        positioningInput.value,
        currentConfig
      );

      applyAiResult(aiResult);
    } catch (error) {
      showPricingOutput({ error: error.message || String(error) });
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
