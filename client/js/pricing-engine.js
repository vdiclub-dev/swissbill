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
      .select("produit_id,valeur,type_remise")
      .eq("client_id", clientId);
    if (pricesRes.error) throw pricesRes.error;

    var overrideMap = {};
    (pricesRes.data || []).forEach(function (row) {
      overrideMap[String(row.produit_id)] = row;
    });

    return (productsRes.data || []).map(function (p, index) {
      var base = Number(p.prix || 0);
      var ov = overrideMap[String(p.id)];
      if (ov) {
        base = ov.type_remise === "pourcentage"
          ? base * (1 - Number(ov.valeur || 0) / 100)
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
        base_price_chf: p.prix_par_kg ? 0 : Math.round(base * 100) / 100,
        price_per_parcel_chf: 0,
        price_per_kg_chf: p.prix_par_kg ? Math.round(base * 100) / 100 : 0,
        priority: Number(p.ordre || index + 100)
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
      if (tariffCode && ruleCode && ruleCode !== tariffCode) return false;
      if (tariffCode && !ruleCode) return false;
      var ruleService = normalizeService(rule.service_level || "");
      if (ruleService && ruleService !== service) return false;
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

    var subtotal = base + parcelAmount + weightAmount + kmExtra + surcharges + numberOrZero(rule.floor_surcharge_chf);
    var fuel = calculateFuelSurcharge(subtotal, rule.fuel_surcharge_percent);
    var discount = (subtotal + fuel) * numberOrZero(rule.discount_percent) / 100;
    var total = Math.max(0, subtotal + fuel - discount);
    total = Math.round(total * 100) / 100;

    return {
      unit_price_chf: Math.round((total / parcels) * 100) / 100,
      total_price_chf: total,
      pricing_status: "calculated",
      tariff_rule_id: rule.id,
      parts: { base: base, parcelAmount: parcelAmount, weightAmount: weightAmount, kmExtra: kmExtra, surcharges: surcharges, fuel: fuel, discount: discount }
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
    selectTariffRule: selectTariffRule,
    calculateOrderPrice: calculateOrderPrice,
    calculateFuelSurcharge: calculateFuelSurcharge,
    buildPricingDetails: buildPricingDetails
  };
})();
