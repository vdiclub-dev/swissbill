function calcTtc(ht, tvaRate) {
  const htNum = Number(ht || 0);
  const rateNum = Number(tvaRate || 0);
  return +(htNum * (1 + rateNum / 100)).toFixed(2);
}

async function getActiveCgvVersion() {
  const { data, error } = await supabase
    .from("cgv_versions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || {
    version_code: window.COLIXO_APP.cgvFallbackVersion,
    title: "Conditions Générales de Transport Colixo",
    content_html: "<p>Version CGV par défaut.</p>"
  };
}

async function createDraftOrder(payload) {
  const user = await requireAuth();
  if (!user) throw new Error("Utilisateur non connecté");

  const tvaRate = Number(payload.tva_rate ?? window.COLIXO_APP.tvaRate);
  const priceHt = Number(payload.price_ht || 0);
  const priceTtc = calcTtc(priceHt, tvaRate);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      client_id: user.id,
      pickup_address: payload.pickup_address,
      delivery_address: payload.delivery_address,
      package_type: payload.package_type,
      package_weight: payload.package_weight,
      declared_value: payload.declared_value || 0,
      service_level: payload.service_level,
      price_ht: priceHt,
      tva_rate: tvaRate,
      price_ttc: priceTtc,
      status: "draft"
    })
    .select("*")
    .single();

  if (error) throw error;

  await addAuditLog(data.id, "ORDER_CREATED", {
    reference: data.reference,
    price_ht: data.price_ht,
    price_ttc: data.price_ttc
  });

  return data;
}

async function getOrderById(orderId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error) throw error;
  return data;
}

async function listMyOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
