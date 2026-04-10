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

  fill(tool.loadConfig());
})();
