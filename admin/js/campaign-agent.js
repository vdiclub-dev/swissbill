(function () {
  "use strict";

  var state = {
    db: null,
    profile: null,
    adminCode: null,
    campaigns: [],
    leads: [],
    followups: [],
    generated: null,
    scoredLead: null
  };

  var FIELD_IDS = [
    "company_name",
    "contact_name",
    "phone",
    "email",
    "city",
    "canton",
    "sector",
    "daily_parcels",
    "delivery_zones",
    "current_carrier",
    "software_used",
    "urgent_need",
    "regular_need",
    "message"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function getDb() {
    return window.SUPABASE_CLIENT || window.supabaseClient || null;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    var n = Number(value || 0);
    return n.toLocaleString("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " CHF";
  }

  function setStatus(message, type) {
    var box = $("agentStatus");
    if (!box) return;
    box.textContent = message;
    box.className = "status " + (type || "info");
    box.hidden = !message;
  }

  function getWebhookUrl() {
    var base = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || "";
    return base.replace(/\/+$/, "") + "/rest/v1/rpc/campaign_agent_ingest_zapier_lead";
  }

  function rpcPayload(extra) {
    return Object.assign(
      {
        p_admin_id: state.profile && state.profile.id,
        p_code: state.adminCode
      },
      extra || {}
    );
  }

  function labelAngle(angle) {
    var labels = {
      alternative_locale: "alternative locale aux grands transporteurs",
      import_excel: "import Excel / CSV sans double saisie",
      dix_colis: "10 colis par jour sans charge administrative",
      premium: "service premium local",
      rapidite: "réactivité Suisse romande",
      reduction_double_saisie: "moins de double saisie"
    };
    return labels[angle] || angle || "alternative locale";
  }

  function getFormQuestions() {
    return [
      "Nom de l'entreprise",
      "Nom du contact",
      "Téléphone",
      "Email",
      "Ville",
      "Canton",
      "Secteur d'activité",
      "Nombre de colis par jour",
      "Zones de livraison",
      "Transporteur actuel",
      "Logiciel utilisé",
      "Besoin urgent ou non"
    ];
  }

  function generateVariants(campaign, sector, angleText) {
    var base = "Colixo aide les entreprises romandes à livrer leurs colis avec un partenaire local, réactif et joignable.";
    return [
      {
        variant_type: "courte",
        headline: "Livraison locale pour PME",
        primary_text: "Vous expédiez 5 à 50 colis par jour ? Testez Colixo, le transporteur local pour la Suisse romande.",
        description: "Réponse rapide, suivi clair, devis adapté.",
        call_to_action: "Demander un devis",
        visual_idea: "Camionnette Colixo devant une PME romande avec colis prêts à partir."
      },
      {
        variant_type: "longue",
        headline: "Moins de friction dans vos livraisons",
        primary_text: base + " Si vos équipes perdent du temps avec la saisie, les retards ou le manque de suivi, Colixo peut mettre en place un flux simple avec tarifs adaptés, import Excel/CSV et dispatch local.",
        description: "Un test de 10 jours suffit pour comparer.",
        call_to_action: "Être recontacté",
        visual_idea: "Avant/après : fichiers commandes, colis triés, suivi transport."
      },
      {
        variant_type: "premium",
        headline: "Transport B2B avec un vrai suivi",
        primary_text: "Offrez à vos clients une livraison plus maîtrisée. Colixo combine proximité, flexibilité et suivi humain pour les entreprises de Suisse romande.",
        description: "Une alternative locale, fiable et professionnelle.",
        call_to_action: "Demander une offre",
        visual_idea: "Visuel sobre noir/orange avec colis premium et carte Suisse romande."
      },
      {
        variant_type: "pme",
        headline: "PME romandes : simplifiez vos expéditions",
        primary_text: "Vos colis partent tous les jours ? Colixo vous aide à stabiliser vos enlèvements, vos coûts et vos livraisons sans usine à gaz.",
        description: "Pour PME, grossistes et fournisseurs B2B.",
        call_to_action: "Planifier un appel",
        visual_idea: "Équipe PME préparant des commandes avec chauffeur Colixo."
      },
      {
        variant_type: "ecommerce",
        headline: "E-commerce : expédiez localement",
        primary_text: "Votre boutique en ligne grandit ? Colixo prend le relais pour vos livraisons en Suisse romande avec une solution locale et flexible.",
        description: "Idéal dès 5 à 50 colis par jour.",
        call_to_action: "Recevoir une proposition",
        visual_idea: "Table de préparation e-commerce, étiquettes et colis."
      },
      {
        variant_type: "10_colis_jour",
        headline: "10 colis par jour ? C'est le bon moment",
        primary_text: "À partir de 10 colis par jour, chaque minute de double saisie coûte cher. Colixo structure vos enlèvements et vos livraisons.",
        description: "Test rapide, budget clair, suivi local.",
        call_to_action: "Tester Colixo",
        visual_idea: "Pile de 10 colis avec compteur visuel."
      },
      {
        variant_type: "import_excel_csv",
        headline: "Import Excel / CSV pour vos livraisons",
        primary_text: "Déposez votre fichier de commandes, vérifiez le mapping, importez vos livraisons. Colixo réduit la double saisie pour vos équipes.",
        description: "Compatible fichiers clients différents.",
        call_to_action: "Voir la solution",
        visual_idea: "Écran import Excel/CSV avec flèches vers colis Colixo."
      },
      {
        variant_type: "alternative_locale",
        headline: "Une alternative locale aux grands transporteurs",
        primary_text: "Vous cherchez plus de souplesse qu'un grand réseau national ? Colixo accompagne les entreprises romandes avec un service transport local.",
        description: angleText + " pour " + sector + ".",
        call_to_action: campaign.call_to_action,
        visual_idea: "Carte Suisse romande avec points de livraison orange."
      }
    ];
  }

  function buildLaunchPackage(campaign, variants, form) {
    var questions = (form && form.questions) || campaign.form_questions || getFormQuestions();
    var ads = (variants || campaign.ad_variants || []).map(function (variant, index) {
      return {
        name: (campaign.name || "Colixo") + " - " + (variant.variant_type || "variante") + " #" + (index + 1),
        status: "PAUSED_UNTIL_COLIXO_APPROVAL",
        creative: {
          primary_text: variant.primary_text,
          headline: variant.headline,
          description: variant.description,
          call_to_action: variant.call_to_action || campaign.call_to_action,
          visual_brief: variant.visual_idea || campaign.visual_idea
        }
      };
    });

    return {
      automation_mode: "semi_auto_human_approval",
      safety_note: "Ne jamais publier sans validation Colixo. Créer les objets Meta en pause si l'API est connectée.",
      generated_at: new Date().toISOString(),
      campaign: {
        name: campaign.name,
        channel: campaign.channel || "meta_ads",
        objective: campaign.meta_objective || "lead_generation",
        status: "PAUSED_UNTIL_APPROVED",
        daily_budget_chf: Number(campaign.budget_daily_chf || 0),
        total_test_budget_chf: Number(campaign.budget_total_chf || 0),
        test_duration_days: Number(campaign.test_duration_days || 0),
        target_region: campaign.target_region || "Suisse romande",
        marketing_angle: campaign.marketing_angle,
        audience_target: campaign.audience_target
      },
      ad_set: {
        name: "Ad set - " + (campaign.target_region || "Suisse romande") + " - B2B 5-50 colis",
        optimization_goal: "LEAD_GENERATION",
        billing_event: "IMPRESSIONS",
        geo_locations: ["VD", "GE", "NE", "FR", "VS", "JU", "BE"],
        target_profiles: ["PME", "e-commerce", "garages", "grossistes", "fournisseurs B2B", "magasins spécialisés"],
        exclusions: ["Particuliers", "emplois transport", "audience non Suisse romande"]
      },
      ads: ads,
      lead_form: {
        name: (form && form.name) || "Formulaire prospect Colixo",
        source: (form && form.source) || "meta_lead_ads",
        questions: questions,
        privacy_notice: "Les données sont utilisées uniquement pour recontacter l'entreprise dans un cadre professionnel."
      },
      webhook_target: {
        recommended_first_step: "Make ou Zapier",
        future_step: "Supabase Edge Function recevant les Meta Lead Ads webhooks",
        destination_table: "leads"
      },
      approval_checklist: [
        "Budget test validé par Colixo",
        "Texte et promesse commerciale relus",
        "Visuel conforme à la marque Colixo",
        "Formulaire Lead Ads vérifié",
        "Campagne créée en pause dans Meta avant activation",
        "Webhook Make/Zapier testé avec un lead factice"
      ]
    };
  }

  function generateCampaign() {
    var sector = $("campaignSector").value;
    var angle = $("campaignAngle").value;
    var budget = Number($("campaignBudget").value || 25);
    var days = Number($("campaignDays").value || 10);
    var region = $("campaignRegion").value || "Suisse romande";
    var angleText = labelAngle(angle);
    var today = new Date().toISOString().slice(0, 10);
    var questions = getFormQuestions();

    var campaign = {
      name: "Colixo Meta - " + sector + " - " + angleText + " - " + today,
      meta_objective: "lead_generation",
      marketing_angle: angleText,
      audience_target: sector + " en " + region + ", entreprises expédiant 5 à 50 colis par jour, responsables logistique, direction PME, e-commerce et achats.",
      target_region: region,
      budget_daily_chf: budget,
      budget_total_chf: budget * days,
      test_duration_days: days,
      primary_text: "Vous expédiez régulièrement des colis en Suisse romande ? Colixo propose une alternative locale, flexible et professionnelle aux grands transporteurs. Obtenez une proposition adaptée à votre volume.",
      headline: "Transport local B2B en Suisse romande",
      description: "Pour PME, e-commerçants et fournisseurs qui expédient 5 à 50 colis par jour.",
      call_to_action: "Demander un devis",
      visual_idea: "Visuel noir/orange Colixo : colis préparés, chauffeur local, carte Suisse romande et promesse '5 à 50 colis/jour'.",
      form_questions: questions,
      potential_revenue_chf: 10 * 8.5 * 22,
      status: "draft"
    };

    state.generated = {
      campaign: campaign,
      variants: generateVariants(campaign, sector, angleText),
      form: {
        name: "Formulaire Meta Lead Ads - " + sector,
        source: "meta_lead_ads",
        questions: questions
      }
    };
    state.generated.launchPackage = buildLaunchPackage(state.generated.campaign, state.generated.variants, state.generated.form);

    renderGenerated();
    setStatus("Campagne générée. Vous pouvez la sauvegarder dans Supabase.", "ok");
  }

  function renderGenerated() {
    if (!state.generated) return;
    var campaign = state.generated.campaign;
    $("campaignOutput").innerHTML = [
      outputCard("Nom de campagne", campaign.name),
      outputCard("Objectif Meta", campaign.meta_objective),
      outputCard("Angle marketing", campaign.marketing_angle),
      outputCard("Audience cible", campaign.audience_target),
      outputCard("Budget test", money(campaign.budget_daily_chf) + "/jour pendant " + campaign.test_duration_days + " jours (" + money(campaign.budget_total_chf) + ")"),
      outputCard("Texte principal", campaign.primary_text),
      outputCard("Titre", campaign.headline),
      outputCard("Idée visuel", campaign.visual_idea)
    ].join("");

    $("variantsOutput").innerHTML = state.generated.variants
      .map(function (v) {
        return outputCard(v.variant_type + " · " + v.headline, v.primary_text + "\n\nDescription : " + (v.description || "") + "\nCTA : " + (v.call_to_action || ""));
      })
      .join("");

    $("formOutput").innerHTML = outputCard(
      state.generated.form.name,
      state.generated.form.questions.map(function (q, i) { return i + 1 + ". " + q; }).join("\n")
    );

    $("launchOutput").innerHTML = renderLaunchCards(state.generated.launchPackage);
  }

  function outputCard(title, text) {
    return '<div class="output-card"><h3>' + escapeHtml(title) + '</h3><div class="copy">' + escapeHtml(text) + "</div></div>";
  }

  function renderLaunchCards(pkg) {
    return [
      outputCard("Mode sécurisé", pkg.automation_mode + "\n" + pkg.safety_note),
      outputCard("Audience / Ad set", pkg.ad_set.name + "\n" + pkg.ad_set.target_profiles.join(", ") + "\nZones : " + pkg.ad_set.geo_locations.join(", ")),
      outputCard("Webhook recommandé", pkg.webhook_target.recommended_first_step + "\nDestination : table " + pkg.webhook_target.destination_table + "\nFuture étape : " + pkg.webhook_target.future_step),
      outputCard("Checklist avant lancement", pkg.approval_checklist.map(function (item, i) { return i + 1 + ". " + item; }).join("\n"))
    ].join("");
  }

  async function saveGeneratedCampaign() {
    if (!state.generated) {
      setStatus("Générez d'abord une campagne.", "err");
      return;
    }

    setStatus("Sauvegarde de la campagne dans Supabase...", "info");
    var res = await state.db.rpc(
      "admin_campaign_agent_save_campaign",
      rpcPayload({
        p_campaign: state.generated.campaign,
        p_variants: state.generated.variants,
        p_form: state.generated.form
      })
    );
    if (res.error) {
      setStatus("Erreur Supabase : " + res.error.message, "err");
      return;
    }
    state.generated.campaign.id = res.data;
    setStatus("Campagne sauvegardée avec ses annonces et son formulaire. Elle peut maintenant être validée avant export.", "ok");
    await loadDashboard();
  }

  function collectLeadForm() {
    var lead = {};
    FIELD_IDS.forEach(function (id) {
      var el = $("lead_" + id);
      if (!el) return;
      if (el.type === "checkbox") lead[id] = !!el.checked;
      else lead[id] = el.value.trim();
    });
    lead.campaign_id = $("leadCampaign").value || null;
    lead.daily_parcels = Number(lead.daily_parcels || 0);
    lead.source = "manual_campaign_agent";
    return lead;
  }

  function scoreLead(lead) {
    var score = 0;
    var details = [];
    var daily = Number(lead.daily_parcels || 0);
    var canton = String(lead.canton || "").toLowerCase();
    var zones = String(lead.delivery_zones || "").toLowerCase();
    var sector = String(lead.sector || "").toLowerCase();
    var carrier = String(lead.current_carrier || "").toLowerCase();

    if (daily >= 1 && daily <= 5) { score += 10; details.push("Volume 1-5 colis/jour +10"); }
    else if (daily >= 6 && daily <= 10) { score += 20; details.push("Volume 6-10 colis/jour +20"); }
    else if (daily >= 11 && daily <= 25) { score += 30; details.push("Volume 11-25 colis/jour +30"); }
    else if (daily >= 26 && daily <= 50) { score += 40; details.push("Volume 26-50 colis/jour +40"); }
    else if (daily > 50) { score += 50; details.push("Volume 50+ colis/jour +50"); }

    if (/^(vd|ge|ne|fr|vs|ju|be)$/.test(canton) || /(romandie|vaud|genève|geneve|neuchâtel|neuchatel|fribourg|valais|jura|lausanne)/.test(zones)) {
      score += 15; details.push("Zone Suisse romande +15");
    }
    if (/(e-?commerce|garage|grossiste|fournisseur|magasin|pme|industrie|atelier|pièce|piece)/.test(sector)) {
      score += 12; details.push("Secteur compatible +12");
    }
    if (lead.regular_need) { score += 10; details.push("Besoin régulier +10"); }
    if (lead.urgent_need) { score += 8; details.push("Besoin urgent +8"); }
    if (/(poste|post|dpd|dhl|ups|planzer|fedex|transporteur)/.test(carrier)) {
      score += 5; details.push("Transporteur actuel identifié +5");
    }

    score = Math.min(score, 100);
    return {
      score: score,
      classification: score >= 75 ? "chaud" : score >= 50 ? "tiede" : score >= 25 ? "froid" : "non_prioritaire",
      details: details,
      potential_revenue_chf: Math.max(daily, 0) * 8.5 * 22
    };
  }

  function generateFollowups(lead, scored) {
    var company = lead.company_name || "votre entreprise";
    var contact = lead.contact_name || "";
    return {
      email: "Bonjour " + contact + ",\n\nMerci pour votre intérêt pour Colixo. Vu votre volume estimé (" + (lead.daily_parcels || 0) + " colis/jour), nous pouvons regarder une solution locale pour vos livraisons en Suisse romande.\n\nJe vous propose un échange de 10 minutes pour valider vos zones, votre transporteur actuel et un test Colixo adapté.\n\nBien cordialement,\nColixo",
      sms: "Bonjour, ici Colixo. Merci pour votre demande pour " + company + ". On peut regarder une solution locale pour vos livraisons. Quel moment vous arrange pour un appel ?",
      call_script: "1. Confirmer volume colis/jour et zones.\n2. Comprendre transporteur actuel et problème principal.\n3. Valider urgence et logiciel/fichier utilisé.\n4. Proposer test Colixo 10 jours ou devis.\n5. Prochaine action datée.",
      linkedin: "Bonjour " + contact + ", je vous contacte suite à votre intérêt pour Colixo. Nous aidons les PME romandes à simplifier leurs livraisons B2B avec un partenaire local.",
      proposal: "Proposition courte pour " + company + " : test Colixo sur 10 jours, grille adaptée au volume, suivi local, import Excel/CSV si besoin. Potentiel estimé : " + money(scored.potential_revenue_chf) + "/mois."
    };
  }

  function renderLeadScore(lead, scored, followups) {
    $("leadScoreOutput").innerHTML =
      '<div class="score-hero"><strong>' + scored.score + '/100</strong><span class="badge ' + scored.classification + '">' +
      labelClassification(scored.classification) + '</span></div><p class="muted">CA potentiel estimé : <b>' +
      money(scored.potential_revenue_chf) + '/mois</b></p><div class="copy">' + escapeHtml(scored.details.join("\n") || "Aucun signal fort détecté.") + "</div>";

    $("leadFollowupsOutput").innerHTML = Object.keys(followups)
      .map(function (key) { return outputCard(labelFollowup(key), followups[key]); })
      .join("");
  }

  function scoreCurrentLead() {
    var lead = collectLeadForm();
    var errors = validateLead(lead);
    if (errors.length) {
      setStatus(errors.join(" "), "err");
      return null;
    }
    var scored = scoreLead(lead);
    var followups = generateFollowups(lead, scored);
    state.scoredLead = { lead: lead, scored: scored, followups: followups };
    renderLeadScore(lead, scored, followups);
    setStatus("Prospect scoré : " + scored.score + "/100, classification " + labelClassification(scored.classification) + ".", "ok");
    return state.scoredLead;
  }

  function validateLead(lead) {
    var errors = [];
    if (!lead.company_name) errors.push("Le nom de l'entreprise est obligatoire.");
    if (!lead.email && !lead.phone) errors.push("Ajoutez au moins un email ou un téléphone.");
    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.push("L'email du prospect est invalide.");
    return errors;
  }

  async function saveLead() {
    var current = scoreCurrentLead();
    if (!current) return;
    setStatus("Enregistrement du prospect, score et relances...", "info");
    var res = await state.db.rpc("admin_campaign_agent_save_lead", rpcPayload({ p_lead: current.lead }));
    if (res.error) {
      setStatus("Erreur Supabase : " + res.error.message, "err");
      return;
    }
    setStatus("Prospect enregistré dans le CRM Campaign Agent.", "ok");
    await loadDashboard();
  }

  function labelClassification(value) {
    return { chaud: "Chaud", tiede: "Tiède", froid: "Froid", non_prioritaire: "Non prioritaire" }[value] || value;
  }

  function labelStatus(value) {
    return {
      new: "Nouveau",
      contacted: "Contacté",
      qualified: "Qualifié",
      quote_sent: "Devis envoyé",
      negotiation: "Négociation",
      won: "Gagné",
      lost: "Perdu",
      no_response: "Sans réponse"
    }[value] || value;
  }

  function labelFollowup(value) {
    return { email: "Email", sms: "SMS", call_script: "Script d'appel", linkedin: "LinkedIn", proposal: "Proposition courte" }[value] || value;
  }

  async function loadDashboard() {
    var res = await state.db.rpc("admin_campaign_agent_list", rpcPayload());
    if (res.error) {
      setStatus("Lecture bloquée : " + res.error.message, "err");
      return;
    }
    var data = res.data || {};
    state.campaigns = data.campaigns || [];
    state.leads = data.leads || [];
    state.followups = data.followups || [];
    renderStats(data.stats || {});
    renderCampaigns();
    renderLeadCampaignSelect();
    renderLeads();
    renderFollowups();
  }

  function renderStats(stats) {
    $("statCampaigns").textContent = stats.campaigns || 0;
    $("statLeads").textContent = stats.leads || 0;
    $("statAvgScore").textContent = stats.avg_score ? stats.avg_score + "/100" : "0/100";
    $("statHotLeads").textContent = stats.hot_leads || 0;
    $("statCpl").textContent = money(stats.cpl_chf || 0);
    $("statPotential").textContent = money(stats.potential_revenue_chf || 0);
  }

  function renderCampaigns() {
    var box = $("campaignList");
    if (!state.campaigns.length) {
      box.innerHTML = '<div class="empty">Aucune campagne sauvegardée pour le moment.</div>';
      return;
    }
    box.innerHTML = state.campaigns.map(function (c) {
      var launchStatus = c.launch_status || "draft";
      return '<div class="row campaign-row"><div><div class="row-title">' + escapeHtml(c.name) + '</div><div class="row-meta">' +
        escapeHtml(c.marketing_angle || "Angle non défini") + " · " + money(c.budget_total_chf || 0) +
        ' · ' + escapeHtml(c.test_duration_days || 0) + ' jours</div><div class="campaign-actions">' +
        '<button class="btn btn-yellow btn-mini" type="button" onclick="window.campaignAgentApproveCampaign(\'' + escapeHtml(c.id) + '\')">Valider pack</button>' +
        '<button class="btn btn-blue btn-mini" type="button" onclick="window.campaignAgentExportCampaign(\'' + escapeHtml(c.id) + '\')">Exporter JSON</button>' +
        '<button class="btn btn-green btn-mini" type="button" onclick="window.campaignAgentMarkLaunched(\'' + escapeHtml(c.id) + '\')">Marquer lancé</button>' +
        '</div></div><span class="badge ' + escapeHtml(launchStatus) + '">' + escapeHtml(labelLaunchStatus(launchStatus)) + "</span></div>";
    }).join("");
  }

  function findCampaign(campaignId) {
    return state.campaigns.find(function (campaign) { return campaign.id === campaignId; });
  }

  function campaignPackage(campaign) {
    var form = campaign.lead_forms && campaign.lead_forms[0] ? campaign.lead_forms[0] : {
      name: "Formulaire prospect Colixo",
      source: "meta_lead_ads",
      questions: campaign.form_questions || getFormQuestions()
    };
    var variants = campaign.ad_variants || [];
    return buildLaunchPackage(campaign, variants, form);
  }

  async function approveCampaign(campaignId) {
    var campaign = findCampaign(campaignId);
    if (!campaign) {
      setStatus("Campagne introuvable dans la liste chargée.", "err");
      return;
    }
    var pkg = campaignPackage(campaign);
    var res = await state.db.rpc("admin_campaign_agent_approve_campaign", rpcPayload({
      p_campaign_id: campaignId,
      p_launch_package: pkg,
      p_notes: "Validation Colixo depuis Campaign Agent"
    }));
    if (res.error) {
      setStatus("Validation impossible : " + res.error.message, "err");
      return;
    }
    setStatus("Pack validé. La campagne est prête à être exportée ou connectée à Make/Zapier.", "ok");
    await loadDashboard();
  }

  async function exportCampaign(campaignId) {
    var campaign = findCampaign(campaignId);
    if (!campaign) {
      setStatus("Campagne introuvable dans la liste chargée.", "err");
      return;
    }
    var pkg = campaign.launch_package && Object.keys(campaign.launch_package).length ? campaign.launch_package : campaignPackage(campaign);
    downloadJson(pkg, safeFileName(campaign.name || "colixo-campaign") + ".json");
    var res = await state.db.rpc("admin_campaign_agent_mark_campaign_exported", rpcPayload({ p_campaign_id: campaignId }));
    if (res.error) {
      setStatus("JSON téléchargé, mais statut Supabase non mis à jour : " + res.error.message, "err");
      return;
    }
    setStatus("JSON exporté. Il peut être utilisé dans Make/Zapier ou par une future Edge Function Meta.", "ok");
    await loadDashboard();
  }

  async function markCampaignLaunched(campaignId) {
    var res = await state.db.rpc("admin_campaign_agent_mark_campaign_launched", rpcPayload({ p_campaign_id: campaignId }));
    if (res.error) {
      setStatus("Impossible de marquer la campagne comme lancée : " + res.error.message, "err");
      return;
    }
    setStatus("Campagne marquée comme lancée. Les leads entrants pourront être rattachés au CRM.", "ok");
    await loadDashboard();
  }

  function downloadJson(data, fileName) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function safeFileName(value) {
    return String(value || "campaign")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function labelLaunchStatus(value) {
    return {
      draft: "Brouillon",
      pending_review: "À valider",
      approved: "Validée",
      exported: "Exportée",
      launched: "Lancée",
      paused: "Pause",
      rejected: "Refusée"
    }[value] || value;
  }

  function renderLeadCampaignSelect() {
    var select = $("leadCampaign");
    select.innerHTML = '<option value="">Sans campagne liée</option>' + state.campaigns.map(function (c) {
      return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + "</option>";
    }).join("");
  }

  function renderLeads() {
    var tbody = $("leadsTableBody");
    if (!state.leads.length) {
      tbody.innerHTML = '<tr><td colspan="8">Aucun lead pour le moment.</td></tr>';
      return;
    }
    tbody.innerHTML = state.leads.map(function (lead) {
      return '<tr><td><strong>' + escapeHtml(lead.company_name) + '</strong><br><span class="row-meta">' + escapeHtml(lead.contact_name || "") + '</span></td>' +
        '<td>' + escapeHtml([lead.city, lead.canton].filter(Boolean).join(", ")) + '</td>' +
        '<td>' + escapeHtml(lead.sector || "") + '</td>' +
        '<td>' + escapeHtml(lead.daily_parcels || 0) + '</td>' +
        '<td><span class="badge ' + escapeHtml(lead.classification || "non_prioritaire") + '">' + labelClassification(lead.classification || "non_prioritaire") + ' · ' + escapeHtml(lead.score || 0) + '</span></td>' +
        '<td>' + money(lead.potential_revenue_chf || 0) + '</td>' +
        '<td>' + renderStatusSelect(lead) + '</td>' +
        '<td>' + escapeHtml(new Date(lead.created_at).toLocaleDateString("fr-CH")) + '</td></tr>';
    }).join("");
  }

  function renderStatusSelect(lead) {
    var statuses = ["new", "contacted", "qualified", "quote_sent", "negotiation", "won", "lost", "no_response"];
    return '<select class="status-select" onchange="window.campaignAgentUpdateLeadStatus(\'' + escapeHtml(lead.id) + '\', this.value)">' +
      statuses.map(function (s) {
        return '<option value="' + s + '"' + (lead.status === s ? " selected" : "") + ">" + labelStatus(s) + "</option>";
      }).join("") + "</select>";
  }

  function renderFollowups() {
    var box = $("followupList");
    if (!state.followups.length) {
      box.innerHTML = '<div class="empty">Aucune relance à faire.</div>';
      return;
    }
    box.innerHTML = state.followups.slice(0, 8).map(function (f) {
      return '<div class="row"><div><div class="row-title">' + escapeHtml(labelFollowup(f.followup_type)) + '</div><div class="row-meta">' +
        escapeHtml(f.content).slice(0, 160) + '</div></div><span class="badge tiede">À faire</span></div>';
    }).join("");
  }

  async function updateLeadStatus(leadId, status) {
    var res = await state.db.rpc("admin_campaign_agent_update_lead_status", rpcPayload({ p_lead_id: leadId, p_status: status }));
    if (res.error) {
      setStatus("Statut non mis à jour : " + res.error.message, "err");
      await loadDashboard();
      return;
    }
    setStatus("Statut prospect mis à jour.", "ok");
    await loadDashboard();
  }

  function bindTabs() {
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-tab");
        document.querySelectorAll("[data-tab]").forEach(function (b) { b.classList.toggle("active", b === btn); });
        document.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-tab-panel") !== target;
        });
      });
    });
  }

  async function initCampaignAgent() {
    state.db = getDb();
    if (!state.db) {
      setStatus("Client Supabase indisponible. Vérifiez config.js.", "err");
      return;
    }

    var auth = await window.colixoRequireRoute({
      roles: ["admin", "super_admin"],
      legacyRoles: ["admin", "super_admin"],
      redirectTo: "../login/index.html"
    });
    if (!auth) return;

    state.profile = auth.profile;
    state.adminCode = (state.profile && (state.profile.code || state.profile.code_usr || state.profile.code_acces || state.profile.code_connexion)) || (window.colixoGetStoredCode && window.colixoGetStoredCode());
    if (!state.adminCode) {
      setStatus("Code admin introuvable. Reconnectez-vous au dashboard admin.", "err");
      return;
    }

    $("adminName").textContent = [state.profile.prenom, state.profile.nom].filter(Boolean).join(" ") || "Admin";
    $("btnGenerateCampaign").addEventListener("click", generateCampaign);
    $("btnSaveCampaign").addEventListener("click", saveGeneratedCampaign);
    $("btnScoreLead").addEventListener("click", scoreCurrentLead);
    $("btnSaveLead").addEventListener("click", saveLead);
    $("webhookUrl").textContent = getWebhookUrl();
    $("btnCopyWebhook").addEventListener("click", function () {
      navigator.clipboard.writeText(getWebhookUrl()).then(function () {
        setStatus("URL webhook copiée.", "ok");
      }).catch(function () {
        setStatus("Copie impossible : sélectionnez l'URL manuellement.", "err");
      });
    });
    $("btnLogout").addEventListener("click", function () {
      window.colixoLogout({ redirectTo: "../login/index.html?logout=1" });
    });
    bindTabs();
    generateCampaign();
    await loadDashboard();
  }

  window.campaignAgentUpdateLeadStatus = updateLeadStatus;
  window.campaignAgentApproveCampaign = approveCampaign;
  window.campaignAgentExportCampaign = exportCampaign;
  window.campaignAgentMarkLaunched = markCampaignLaunched;
  window.addEventListener("DOMContentLoaded", initCampaignAgent);
})();
