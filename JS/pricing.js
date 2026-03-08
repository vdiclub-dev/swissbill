function getWeightExtra(pricing, weightCategory) {
  if (!pricing || !weightCategory) return 0;

  switch (weightCategory) {
    case "0-2": return Number(pricing.weight_0_2 || 0);
    case "2-10": return Number(pricing.weight_2_10 || 0);
    case "10-30": return Number(pricing.weight_10_30 || 0);
    case "30+": return Number(pricing.weight_30_plus || 0);
    default: return 0;
  }
}

function getPackageBase(pricing, packageType) {
  if (!pricing || !packageType) return 0;

  switch (packageType) {
    case "envelope": return Number(pricing.package_envelope || 0);
    case "carton": return Number(pricing.package_carton || 0);
    case "box": return Number(pricing.package_box || 0);
    case "crate": return Number(pricing.package_crate || 0);
    case "palette": return Number(pricing.package_palette || 0);
    default: return 0;
  }
}

function getSpeedMultiplier(pricing, speed) {
  if (!pricing) return 1;

  switch (speed) {
    case "urgent": return Number(pricing.urgent_multiplier || 1.5);
    case "express": return Number(pricing.express_multiplier || 1.2);
    case "eco":
    default:
      return Number(pricing.eco_multiplier || 1);
  }
}

function calculateTransportPrice({ pricing, km, packageType, weightCategory, volumeM3, palletCount, quantity, speed, fragile, nightDelivery, signatureRequired }) {
  if (!pricing) return 0;

  const mode = pricing.pricing_mode || "mixed";
  const kms = Number(km || 0);
  const qty = Number(quantity || 1);
  const m3 = Number(volumeM3 || 0);
  const palettes = Number(palletCount || 0);

  let total = Number(pricing.base_fee || 0);

  if (mode === "km") {
    total += kms * Number(pricing.price_per_km || 0);
  }

  if (mode === "package") {
    total += getPackageBase(pricing, packageType) * qty;
  }

  if (mode === "mixed") {
    total += kms * Number(pricing.price_per_km || 0);
    total += getPackageBase(pricing, packageType) * qty;
  }

  total += getWeightExtra(pricing, weightCategory) * qty;
  total += m3 * Number(pricing.volume_m3_price || 0);
  total += palettes * Number(pricing.palette_surcharge || 0);

  if (fragile) total += Number(pricing.fragile_surcharge || 0);
  if (nightDelivery) total += Number(pricing.night_surcharge || 0);
  if (signatureRequired) total += Number(pricing.signature_surcharge || 0);

  total = total * getSpeedMultiplier(pricing, speed);

  return Math.round(total * 100) / 100;
}
