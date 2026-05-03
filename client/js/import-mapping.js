(function () {
  "use strict";

  var FIELD_LABELS = {
    external_reference: "Référence client",
    delivery_name: "Nom destinataire",
    delivery_address: "Adresse livraison",
    delivery_zip: "NPA livraison",
    delivery_city: "Ville livraison",
    parcel_count: "Nombre de colis",
    weight_kg: "Poids kg",
    delivery_phone: "Téléphone",
    delivery_email: "Email",
    delivery_instructions: "Instructions",
    requested_delivery_date: "Date souhaitée",
    service_level: "Niveau de service",
    tariff_code: "Code tarif",
    pickup_name: "Nom enlèvement",
    pickup_address: "Adresse enlèvement",
    pickup_zip: "NPA enlèvement",
    pickup_city: "Ville enlèvement",
    distance_km: "Distance km"
  };

  var REQUIRED_FIELDS = [
    "external_reference",
    "delivery_name",
    "delivery_address",
    "delivery_zip",
    "delivery_city",
    "parcel_count"
  ];

  function normalizeHeader(header) {
    return String(header || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[°º]/g, " ")
      .replace(/[_./\\()[\]{}:;,+*"'!?-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getFieldSynonyms() {
    return {
      external_reference: [
        "référence", "ref", "réf", "reference", "référence client", "commande",
        "no commande", "n° commande", "numero commande", "numéro commande",
        "order id", "order number", "shipment id", "tracking reference"
      ],
      delivery_name: [
        "nom", "destinataire", "client final", "customer", "customer name",
        "recipient", "receiver", "livraison nom", "nom destinataire"
      ],
      delivery_address: [
        "adresse", "rue", "adresse livraison", "adresse complète", "address",
        "shipping address", "delivery address", "street", "adresse destinataire"
      ],
      delivery_zip: [
        "npa", "code postal", "cp", "zip", "zipcode", "postal code"
      ],
      delivery_city: [
        "ville", "localité", "locality", "city", "town"
      ],
      parcel_count: [
        "colis", "nb colis", "nombre colis", "nombre de colis", "quantité",
        "quantity", "parcel count", "packages", "package count"
      ],
      weight_kg: [
        "poids", "kg", "poids kg", "weight", "weight kg", "gross weight"
      ],
      delivery_phone: [
        "téléphone", "tel", "mobile", "phone", "contact phone", "téléphone destinataire"
      ],
      delivery_email: [
        "email", "mail", "e-mail", "contact email", "email destinataire"
      ],
      delivery_instructions: [
        "instructions", "remarque", "commentaire", "note", "delivery note",
        "instructions livraison", "remarque livraison"
      ],
      requested_delivery_date: [
        "date", "date livraison", "livraison souhaitée", "requested date",
        "delivery date", "date souhaitée"
      ],
      service_level: [
        "service", "type livraison", "mode", "priorité", "eco", "express",
        "priority", "speed", "type de service"
      ],
      tariff_code: [
        "code tarif", "tarif", "code prix", "code prestation", "prestation",
        "article", "code article", "produit", "code produit", "sku",
        "tariff code", "price code", "product code", "item code"
      ],
      pickup_name: [
        "expéditeur", "site départ", "dépôt", "pickup name", "sender", "nom expéditeur"
      ],
      pickup_address: [
        "adresse enlèvement", "adresse départ", "pickup address", "sender address",
        "adresse expéditeur"
      ],
      pickup_zip: [
        "npa départ", "code postal départ", "pickup zip", "npa expéditeur"
      ],
      pickup_city: [
        "ville départ", "localité départ", "pickup city", "ville expéditeur"
      ],
      distance_km: [
        "km", "kilomètres", "distance", "distance km", "distance_km"
      ]
    };
  }

  function tokenScore(header, synonym) {
    var h = normalizeHeader(header);
    var s = normalizeHeader(synonym);
    if (!h || !s) return 0;
    if (h === s) return 100;
    if (h.indexOf(s) !== -1 || s.indexOf(h) !== -1) return 80;

    var hTokens = h.split(" ");
    var sTokens = s.split(" ");
    var hits = sTokens.filter(function (token) { return hTokens.indexOf(token) !== -1; }).length;
    if (!hits) return 0;
    return Math.round((hits / Math.max(sTokens.length, hTokens.length)) * 70);
  }

  function detectColumnMapping(headers) {
    var synonyms = getFieldSynonyms();
    var used = Object.create(null);
    var mapping = {};

    (headers || []).forEach(function (header) {
      var bestField = "";
      var bestScore = 0;

      Object.keys(synonyms).forEach(function (field) {
        synonyms[field].forEach(function (synonym) {
          var score = tokenScore(header, synonym);
          if (used[field]) score -= 12;
          if (score > bestScore) {
            bestScore = score;
            bestField = field;
          }
        });
      });

      if (bestScore >= 55 && bestField) {
        mapping[header] = bestField;
        used[bestField] = true;
      } else {
        mapping[header] = "";
      }
    });

    return mapping;
  }

  function cleanValue(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function toNumber(value) {
    if (value == null || value === "") return null;
    var n = Number(String(value).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function applyMapping(row, mapping, defaultValues) {
    var out = Object.assign({}, defaultValues || {});
    var raw = {};

    Object.keys(row || {}).forEach(function (header) {
      var field = mapping[header];
      raw[header] = row[header];
      if (!field) return;
      out[field] = cleanValue(row[header]);
    });

    if (out.parcel_count !== undefined) out.parcel_count = parseInt(toNumber(out.parcel_count) || 0, 10);
    if (out.weight_kg !== undefined && out.weight_kg !== "") out.weight_kg = toNumber(out.weight_kg);
    if (out.distance_km !== undefined && out.distance_km !== "") out.distance_km = toNumber(out.distance_km);
    out.raw_import_data = raw;
    return out;
  }

  function validateMapping(mapping) {
    var mapped = Object.keys(mapping || {}).map(function (key) { return mapping[key]; }).filter(Boolean);
    var missing = REQUIRED_FIELDS.filter(function (field) { return mapped.indexOf(field) === -1; });
    return {
      ok: missing.length === 0,
      valid: missing.length === 0,
      missing: missing,
      missingFields: missing
    };
  }

  window.ColixoImportMapping = {
    FIELD_LABELS: FIELD_LABELS,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    normalizeHeader: normalizeHeader,
    detectColumnMapping: detectColumnMapping,
    getFieldSynonyms: getFieldSynonyms,
    applyMapping: applyMapping,
    validateMapping: validateMapping
  };
})();
