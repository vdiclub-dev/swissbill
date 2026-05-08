(function () {
  "use strict";

  var PUBLIC_LEAD_SECRET = "colixo-2026-zapier-rpc-secret-G7mK92pLxQ";
  var FORM_ID = "colixo-public-demande-transport-20260505";
  var form;
  var statusBox;
  var submitBtn;

  function $(id) {
    return document.getElementById(id);
  }

  function getDb() {
    return window.SUPABASE_CLIENT || window.supabaseClient || null;
  }

  function setStatus(message, type) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = "form-status " + (type || "ok");
    statusBox.hidden = !message;
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getValue(name) {
    return clean(new FormData(form).get(name));
  }

  function getBool(name) {
    var el = form.elements[name];
    return !!(el && el.checked);
  }

  function hasRecentSubmit() {
    var last = Number(localStorage.getItem("colixo_public_lead_last_submit") || 0);
    return last && Date.now() - last < 20000;
  }

  function rememberSubmit() {
    localStorage.setItem("colixo_public_lead_last_submit", String(Date.now()));
  }

  function buildExternalLeadId() {
    var rand = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint32Array(2);
      window.crypto.getRandomValues(bytes);
      rand = Array.prototype.map.call(bytes, function (n) { return n.toString(36); }).join("");
    } else {
      rand = Math.random().toString(36).slice(2);
    }
    return "site_" + Date.now().toString(36) + "_" + rand;
  }

  function getUtm(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function validate(payload) {
    var errors = [];
    if (getValue("website")) errors.push("Demande bloquée.");
    if (!payload.company_name) errors.push("Le nom de l'entreprise est obligatoire.");
    if (!payload.city) errors.push("La ville est obligatoire.");
    if (!payload.email && !payload.phone) errors.push("Ajoutez au moins un email ou un téléphone.");
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.push("L'email n'est pas valide.");
    if (!getBool("consent")) errors.push("Veuillez accepter d'être recontacté par Colixo.");
    if (hasRecentSubmit()) errors.push("Patientez quelques secondes avant de renvoyer une demande.");
    return errors;
  }

  function buildPayload() {
    return {
      source: "colixo_public_site",
      external_lead_id: buildExternalLeadId(),
      external_form_id: FORM_ID,
      external_campaign_id: getUtm("utm_campaign") || "colixo-public-site",
      external_ad_id: getUtm("utm_content") || "",
      company_name: getValue("company_name"),
      contact_name: getValue("contact_name"),
      email: getValue("email").toLowerCase(),
      phone: getValue("phone"),
      city: getValue("city"),
      canton: getValue("canton"),
      sector: getValue("sector"),
      daily_parcels: Number(getValue("daily_parcels") || 0),
      delivery_zones: getValue("delivery_zones"),
      current_carrier: getValue("current_carrier"),
      software_used: getValue("software_used"),
      regular_need: getBool("regular_need"),
      urgent_need: getBool("urgent_need"),
      message: getValue("message"),
      page_url: window.location.href,
      referrer: document.referrer || "",
      utm_source: getUtm("utm_source"),
      utm_medium: getUtm("utm_medium"),
      utm_campaign: getUtm("utm_campaign")
    };
  }

  async function submitLead(event) {
    event.preventDefault();
    var db = getDb();
    if (!db) {
      setStatus("Connexion Supabase indisponible. Essayez plus tard ou écrivez à info@colixo.ch.", "err");
      return;
    }

    var payload = buildPayload();
    var errors = validate(payload);
    if (errors.length) {
      setStatus(errors.join(" "), "err");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours...";
    setStatus("Transmission de votre demande à Colixo...", "ok");

    var res = await db.rpc("campaign_agent_ingest_zapier_lead", {
      p_secret: PUBLIC_LEAD_SECRET,
      p_payload: payload
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer ma demande";

    if (res.error) {
      setStatus("Envoi impossible : " + res.error.message + ". Vous pouvez écrire à info@colixo.ch.", "err");
      return;
    }

    rememberSubmit();
    form.reset();
    if (form.elements.regular_need) form.elements.regular_need.checked = true;
    setStatus("Merci, votre demande est envoyée. Colixo revient vers vous rapidement.", "ok");
  }

  function init() {
    form = $("publicLeadForm");
    statusBox = $("leadFormStatus");
    submitBtn = $("submitLeadBtn");
    if (!form || !statusBox || !submitBtn) return;
    form.addEventListener("submit", submitLead);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
