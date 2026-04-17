/**
 * Conseil IA pricing Colixo.
 *
 * Entrée attendue :
 * {
 *   order: {...},
 *   client: {...} | null,
 *   business_pricing: { total, dailyRevenue, monthlyRevenue, breakdown },
 *   ai_config: { system_prompt, markup_cap_percent, discount_cap_percent, margin_floor_percent, distance_threshold_km }
 * }
 *
 * Réponse :
 * {
 *   recommended_price: number,
 *   confidence: number,
 *   adjustment_percent: number,
 *   summary: string,
 *   reasons: string[]
 * }
 *
 * Déploiement :
 *   supabase functions deploy colixo-ai-pricing --no-verify-jwt
 *
 * Secrets :
 *   OPENAI_API_KEY
 *   OPENAI_MODEL (optionnel, ex. gpt-5-mini)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

type OrderPayload = {
  client_id?: string | null;
  service_level?: string;
  tariff_family?: string;
  package_type?: string;
  weight_kg?: number;
  distance_km?: number;
  floors?: number;
  extra_stops?: number;
  packages_per_day?: number;
  working_days_per_month?: number;
  margin_target_percent?: number;
  notes_internal?: string;
  notes_customer?: string;
  options?: Record<string, boolean>;
};

type ClientPayload = {
  id?: string;
  company_name?: string;
  tariff_profile?: string;
  ai_sensitivity?: string;
  markup_cap_percent?: number;
  discount_cap_percent?: number;
};

type BusinessPricingPayload = {
  total?: number;
  dailyRevenue?: number;
  monthlyRevenue?: number;
  breakdown?: Array<{ label?: string; amount?: number }>;
};

type AIConfigPayload = {
  system_prompt?: string;
  markup_cap_percent?: number;
  discount_cap_percent?: number;
  margin_floor_percent?: number;
  distance_threshold_km?: number;
};

type RequestBody = {
  order?: OrderPayload;
  client?: ClientPayload | null;
  business_pricing?: BusinessPricingPayload;
  ai_config?: AIConfigPayload;
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Number(num(value).toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncateText(value: unknown, max = 500): string {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Méthode non autorisée (POST requis)." });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Session absente — reconnectez-vous sur Colixo." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: "Secrets Supabase manquants côté Edge Function." });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return json({ ok: false, error: "Session invalide ou expirée." });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("utilisateurs")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("utilisateurs lookup", profileErr);
    return json({ ok: false, error: "Impossible de vérifier le rôle utilisateur." });
  }
  if (!profile || !["admin", "super_admin"].includes(String(profile.role))) {
    return json({ ok: false, error: "Accès refusé — rôle admin requis." });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "Corps JSON invalide." });
  }

  const order = body.order || {};
  const client = body.client || null;
  const businessPricing = body.business_pricing || {};
  const aiConfig = body.ai_config || {};

  const basePrice = round2(num(businessPricing.total));
  if (basePrice <= 0) {
    return json({ ok: false, error: "Le prix métier de base doit être supérieur à 0." });
  }

  const openAiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!openAiKey) {
    return json({
      ok: false,
      error: "OPENAI_API_KEY manquant dans les secrets Supabase.",
    });
  }

  const model = (Deno.env.get("OPENAI_MODEL") || "gpt-5-mini").trim();
  const markupCap = clamp(num(client?.markup_cap_percent, aiConfig.markup_cap_percent ?? 15), 0, 100);
  const discountCap = clamp(num(client?.discount_cap_percent, aiConfig.discount_cap_percent ?? 10), 0, 100);

  const systemPrompt =
    truncateText(
      aiConfig.system_prompt ||
        "Tu es un analyste pricing B2B pour Colixo. Tu dois respecter le prix métier de base et proposer un ajustement commercial raisonnable, jamais arbitraire.",
      3000,
    );

  const promptPayload = {
    business_rules: {
      hard_constraints: [
        "Le calcul métier est la base de vérité.",
        "Le prix conseillé IA ne doit pas descendre de plus de discount_cap_percent sous le prix métier.",
        "Le prix conseillé IA ne doit pas monter de plus de markup_cap_percent au-dessus du prix métier.",
        "Toujours expliquer clairement si tu proposes une hausse, une remise ou un maintien.",
        "Répondre strictement en JSON."
      ],
      markup_cap_percent: markupCap,
      discount_cap_percent: discountCap,
      margin_floor_percent: num(aiConfig.margin_floor_percent, 15),
      distance_threshold_km: num(aiConfig.distance_threshold_km, 30),
    },
    client: client ? {
      company_name: truncateText(client.company_name, 160),
      tariff_profile: truncateText(client.tariff_profile, 60),
      ai_sensitivity: truncateText(client.ai_sensitivity, 60),
      markup_cap_percent: markupCap,
      discount_cap_percent: discountCap,
    } : null,
    order: {
      service_level: truncateText(order.service_level, 40),
      tariff_family: truncateText(order.tariff_family, 40),
      package_type: truncateText(order.package_type, 40),
      weight_kg: num(order.weight_kg),
      distance_km: num(order.distance_km),
      floors: num(order.floors),
      extra_stops: num(order.extra_stops),
      packages_per_day: num(order.packages_per_day),
      working_days_per_month: num(order.working_days_per_month),
      margin_target_percent: num(order.margin_target_percent),
      options: order.options || {},
      notes_internal: truncateText(order.notes_internal, 400),
      notes_customer: truncateText(order.notes_customer, 300),
    },
    business_pricing: {
      total: basePrice,
      daily_revenue: round2(num(businessPricing.dailyRevenue)),
      monthly_revenue: round2(num(businessPricing.monthlyRevenue)),
      breakdown: Array.isArray(businessPricing.breakdown)
        ? businessPricing.breakdown.slice(0, 20).map((item) => ({
            label: truncateText(item?.label, 120),
            amount: round2(num(item?.amount)),
          }))
        : [],
    },
    expected_output: {
      recommended_price: "number, en CHF, arrondi à 2 décimales",
      confidence: "number entre 0 et 1",
      adjustment_percent: "number, négatif si remise, positif si hausse",
      summary: "string courte, directe, utile à un admin",
      reasons: ["3 à 5 raisons concrètes et non génériques"],
    },
  };

  const userPrompt = [
    "Analyse ce devis Colixo et propose un prix conseillé IA.",
    "Le prix métier est la base et ne doit jamais être ignoré.",
    `Le prix métier de référence est ${basePrice.toFixed(2)} CHF.`,
    "Réponds uniquement avec un objet JSON valide contenant : recommended_price, confidence, adjustment_percent, summary, reasons."
  ].join("\n");

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\n${JSON.stringify(promptPayload)}`,
        },
      ],
    }),
  });

  const rawText = await openAiResponse.text();
  if (!openAiResponse.ok) {
    console.error("OpenAI error", openAiResponse.status, rawText);
    return json({
      ok: false,
      error: `OpenAI a refusé la requête (${openAiResponse.status}).`,
      detail: rawText.slice(0, 600),
    });
  }

  let parsedApi: Record<string, unknown> | null = null;
  try {
    parsedApi = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Réponse OpenAI non JSON." });
  }

  const content = String(
    (parsedApi?.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message &&
      ((parsedApi.choices as Array<Record<string, unknown>>)[0].message as Record<string, unknown>).content
      || "",
  );
  const aiJson = extractJsonObject(content);
  if (!aiJson) {
    return json({
      ok: false,
      error: "Impossible d’extraire le JSON du conseil IA.",
      detail: content.slice(0, 800),
    });
  }

  let recommendedPrice = round2(num(aiJson.recommended_price, basePrice));
  const minPrice = round2(basePrice * (1 - discountCap / 100));
  const maxPrice = round2(basePrice * (1 + markupCap / 100));
  recommendedPrice = clamp(recommendedPrice, minPrice, maxPrice);

  const adjustmentPercent =
    aiJson.adjustment_percent == null
      ? round2(((recommendedPrice - basePrice) / basePrice) * 100)
      : round2(num(aiJson.adjustment_percent));

  const confidence = clamp(num(aiJson.confidence, 0.65), 0, 1);
  const summary = truncateText(aiJson.summary, 240) ||
    "Conseil IA calculé à partir du prix métier et du contexte commercial.";
  const reasons = Array.isArray(aiJson.reasons)
    ? aiJson.reasons.map((reason) => truncateText(reason, 180)).filter(Boolean).slice(0, 5)
    : [];

  return json({
    ok: true,
    recommended_price: recommendedPrice,
    confidence,
    adjustment_percent: adjustmentPercent,
    summary,
    reasons: reasons.length ? reasons : [
      "Le modèle recommande de rester proche du calcul métier faute de signal plus fort."
    ],
    model,
  });
});
