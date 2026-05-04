(function () {
  "use strict";

  function numberOrZero(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeService(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function normalizeCode(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, "").trim();
  }

  async function loadClientTariffRules(clientId) {
    if (!clientId) return [];
    var db = window.SUPABASE_CLIENT;
    var res = await db
      .from("client_tariff_rules")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (res.error) throw res.error;
    if (res.data && res.data.length) return res.data;

    var productsRes = await db
      .from("produits_tarif")
      .select("*")
      .eq("actif", true)
      .order("ordre", { ascending: true })
      .order("nom", { ascending: true });
    if (productsRes.error) throw productsRes.error;

    var pricesRes = await db
      .from("prix_speciaux")
      .select("produit_id,valeur,type_remise,contrainte")
      .eq("client_id", clientId);
    if (pricesRes.error) throw pricesRes.error;

    var overrideMap = {};
    (pricesRes.data || []).forEach(function (row) {
      overrideMap[String(row.produit_id)] = row;
    });

    var productRules = (productsRes.data || []).map(function (p, index) {
      var base = Number(p.prix || 0);
      var ov = overrideMap[String(p.id)];
      if (ov) {
        base = ov.type_remise === "pct" || ov.type_remise === "pourcentage"
          ? base * (1 - Number(ov.valeur || 0) / 100)
          : ov.type_remise === "supp"
            ? base + Number(ov.valeur || 0)
          : Number(ov.valeur || base);
      }
      return {
        id: p.id,
        client_id: clientId,
        name: p.nom || p.ref || "Tarif",
        tariff_code: p.ref || p.nom || "",
        service_level: null,
        min_weight_kg: Number(p.poids_min || 0),
        max_weight_kg: null,
        min_parcel_count: null,
        max_parcel_count: null,
        base_price_chf: Math.round(base * 100) / 100,
        price_per_parcel_chf: 0,
        price_per_kg_chf: Math.round(Number(p.increment_par_kg || 0) * 100) / 100,
        priority: Number(p.ordre || index + 100)
      };
    });
    if (productRules.length) return productRules;

    // Last-resort fallback only if the standard grid is empty.
    return [
      {
        id: 'fallback_standard',
        client_id: clientId,
        name: 'Standard Colixo',
        tariff_code: '',
        service_level: 'eco_48h',
        min_weight_kg: 0,
        max_weight_kg: null,
        min_parcel_count: 1,
        max_parcel_count: null,
        base_price_chf: 5.00,
        price_per_parcel_chf: 4.50,
        price_per_kg_chf: 0.80,
        included_km: 20,
        extra_km_price_chf: 1.20,
        fuel_surcharge_percent: 8.5,
        discount_percent: 0,
        priority: 999
      }
    ];
  }

  async function loadClientSpecialOptions(clientId) {
    if (!clientId) return [];
    var db = window.SUPABASE_CLIENT;
    var res = await db
      .from("prix_speciaux")
      .select("produit_id,valeur,type_remise,contrainte,actif,produits_tarif(id,nom,ref)")
      .eq("client_id", clientId)
      .eq("actif", true);
    if (res.error) throw res.error;

    return (res.data || [])
      .filter(function (row) { return row.contrainte && Number(row.valeur || 0) > 0; })
      .map(function (row) {
        var product = row.produits_tarif || {};
        var label = row.contrainte || product.nom || "Option";
        return {
          code: normalizeCode(label),
          label: label,
          product_name: product.nom || "",
          product_code: product.ref || "",
          amount_chf: Math.round(Number(row.valeur || 0) * 100) / 100,
          type_remise: row.type_remise || "supp"
        };
      });
  }

  function rangeMatches(value, min, max) {
    if (value == null || value === "") return min == null && max == null;
    var n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min != null && min !== "" && n < Number(min)) return false;
    if (max != null && max !== "" && n > Number(max)) return false;
    return true;
  }

  function selectTariffRule(order, rules) {
    var service = normalizeService(order.service_level || "eco_48h");
    var tariffCode = normalizeCode(order.tariff_code || "");
    var parcelCount = Number(order.parcel_count || 1);
    var weight = order.weight_kg == null || order.weight_kg === "" ? null : Number(order.weight_kg);

    return (rules || []).find(function (rule) {
      var ruleCode = normalizeCode(rule.tariff_code || "");
      // Looser code match: allow empty tariff_code
      if (tariffCode && ruleCode && ruleCode !== tariffCode) return false;
      var ruleService = normalizeService(rule.service_level || "");
      // Allow default service if unspecified
      if (ruleService && service && ruleService !== service) return false;
      if (!rangeMatches(weight, rule.min_weight_kg, rule.max_weight_kg)) return false;
      if (!rangeMatches(parcelCount, rule.min_parcel_count, rule.max_parcel_count)) return false;
      return true;
    }) || null;
  }

  function calculateFuelSurcharge(amount, percent) {
    return numberOrZero(amount) * numberOrZero(percent) / 100;
  }

  function calculateOrderPrice(order, rule) {
    if (!rule) {
      return {
        unit_price_chf: null,
        total_price_chf: null,
        pricing_status: "needs_review",
        tariff_rule_id: null
      };
    }

    var parcels = Math.max(1, Number(order.parcel_count || 1));
    var weight = numberOrZero(order.weight_kg);
    var distance = order.distance_km == null || order.distance_km === "" ? null : Number(order.distance_km);
    var base = numberOrZero(rule.base_price_chf);
    var parcelAmount = parcels * numberOrZero(rule.price_per_parcel_chf);
    var weightAmount = weight * numberOrZero(rule.price_per_kg_chf);
    var kmExtra = 0;

    if (distance != null && Number.isFinite(distance)) {
      var includedKm = numberOrZero(rule.included_km);
      kmExtra = Math.max(0, distance - includedKm) * numberOrZero(rule.extra_km_price_chf || rule.price_per_km_chf);
    }

    var service = normalizeService(order.service_level);
    var surcharges = 0;
    if (service.indexOf("urgent") !== -1 || service.indexOf("priority") !== -1) {
      surcharges += numberOrZero(rule.urgent_surcharge_chf);
    }
    if (service.indexOf("night") !== -1 || service.indexOf("nuit") !== -1) {
      surcharges += numberOrZero(rule.night_surcharge_chf);
    }

    var option = null;
    var optionAmount = 0;
    var optionCode = normalizeCode(order.special_option_code || "");
    if (optionCode && Array.isArray(order.special_options)) {
      option = order.special_options.find(function (item) { return normalizeCode(item.code || item.label) === optionCode; }) || null;
      optionAmount = option ? numberOrZero(option.amount_chf) : 0;
    }

    var subtotal = base + parcelAmount + weightAmount + kmExtra + surcharges + numberOrZero(rule.floor_surcharge_chf) + optionAmount;
    var fuel = calculateFuelSurcharge(subtotal, rule.fuel_surcharge_percent);
    var discount = (subtotal + fuel) * numberOrZero(rule.discount_percent) / 100;
    var total = Math.max(0, subtotal + fuel - discount);
    total = Math.round(total * 100) / 100;

    return {
      unit_price_chf: Math.round((total / parcels) * 100) / 100,
      total_price_chf: total,
      pricing_status: "calculated",
      tariff_rule_id: rule.id,
      parts: { base: base, parcelAmount: parcelAmount, weightAmount: weightAmount, kmExtra: kmExtra, surcharges: surcharges, specialOption: optionAmount, fuel: fuel, discount: discount, option: option }
    };
  }

  function buildPricingDetails(order, rule, result) {
    if (!rule) {
      return {
        pricing_status: "needs_review",
        reason: "Aucune règle tarifaire active ne correspond à cette ligne.",
        tariff_code: order.tariff_code || null,
        service_level: order.service_level || null,
        parcel_count: order.parcel_count || null,
        weight_kg: order.weight_kg || null
      };
    }

    return {
      rule_name: rule.name,
      tariff_code: order.tariff_code || null,
      rule_tariff_code: rule.tariff_code || null,
      base_price: numberOrZero(rule.base_price_chf),
      parcel_count: Number(order.parcel_count || 1),
      price_per_parcel: numberOrZero(rule.price_per_parcel_chf),
      weight_kg: order.weight_kg == null ? null : Number(order.weight_kg),
      price_per_kg: numberOrZero(rule.price_per_kg_chf),
      special_option_code: order.special_option_code || null,
      special_option_label: result.parts?.option?.label || null,
      special_option_amount: numberOrZero(result.parts?.specialOption),
      distance_km: order.distance_km == null ? null : Number(order.distance_km),
      included_km: numberOrZero(rule.included_km),
      extra_km_price_chf: numberOrZero(rule.extra_km_price_chf || rule.price_per_km_chf),
      fuel_surcharge_percent: numberOrZero(rule.fuel_surcharge_percent),
      discount_percent: numberOrZero(rule.discount_percent),
      final_total: result.total_price_chf
    };
  }

  window.ColixoPricingEngine = {
    loadClientTariffRules: loadClientTariffRules,
    loadClientSpecialOptions: loadClientSpecialOptions,
    selectTariffRule: selectTariffRule,
    calculateOrderPrice: calculateOrderPrice,
    calculateFuelSurcharge: calculateFuelSurcharge,
    buildPricingDetails: buildPricingDetails
  };
})();
