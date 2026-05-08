/**
 * Reçoit les leads Meta Lead Ads / Make / Zapier et les insère dans le CRM Campaign Agent.
 *
 * Déploiement :
 *   supabase functions deploy campaign-agent-webhook --no-verify-jwt
 *
 * Secrets requis :
 *   CAMPAIGN_AGENT_WEBHOOK_SECRET = chaîne longue partagée avec Make/Zapier/Meta
 *
 * Secrets optionnels :
 *   META_ACCESS_TOKEN = token Page/Lead Ads pour récupérer le détail depuis leadgen_id
 *   META_GRAPH_VERSION = version Graph API, ex. v20.0
 *   META_WEBHOOK_VERIFY_TOKEN = token de vérification webhook Meta
 *
 * URL :
 *   https://<project-ref>.supabase.co/functions/v1/campaign-agent-webhook
 *
 * Headers :
 *   x-webhook-secret = <CAMPAIGN_AGENT_WEBHOOK_SECRET>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Max-Age": "86400",
};

type AnyRecord = Record<string, unknown>;

function json(data: AnyRecord, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function cleanKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function firstString(value: unknown): string {
  if (Array.isArray(value)) return firstString(value[0]);
  if (value == null) return "";
  return String(value).trim();
}

function pick(obj: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const direct = firstString(obj[key]);
    if (direct) return direct;
    const normalized = firstString(obj[cleanKey(key)]);
    if (normalized) return normalized;
  }
  return "";
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const normalized = firstString(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "oui", "yes", "urgent"].includes(normalized);
}

function integerValue(value: unknown): number {
  const normalized = firstString(value).replace(",", ".").match(/\d+/)?.[0] ?? "0";
  return Number.parseInt(normalized, 10) || 0;
}

function normalizeFieldData(payload: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  const fieldData = Array.isArray(payload.field_data)
    ? payload.field_data
    : Array.isArray(payload.fieldData)
      ? payload.fieldData
      : [];

  for (const item of fieldData) {
    const row = asRecord(item);
    const name = firstString(row.name || row.key || row.label);
    if (!name) continue;
    out[cleanKey(name)] = firstString(row.values || row.value);
  }

  return out;
}

function extractLeadgenEvent(payload: AnyRecord): AnyRecord {
  const entry = Array.isArray(payload.entry) ? asRecord(payload.entry[0]) : {};
  const changes = Array.isArray(entry.changes) ? asRecord(entry.changes[0]) : {};
  return asRecord(changes.value);
}

async function fetchMetaLead(leadgenId: string): Promise<AnyRecord> {
  const token = Deno.env.get("META_ACCESS_TOKEN")?.trim();
  if (!token || !leadgenId) return {};

  const version = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v20.0";
  const fields = [
    "created_time",
    "id",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "form_id",
    "field_data",
    "platform",
  ].join(",");

  const url = new URL(`https://graph.facebook.com/${version}/${leadgenId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Meta lead fetch failed", res.status, data);
    return {};
  }
  return asRecord(data);
}

async function buildNormalizedLead(raw: AnyRecord): Promise<AnyRecord> {
  const webhookValue = extractLeadgenEvent(raw);
  const leadgenId = pick(raw, ["leadgen_id", "lead_id", "id"]) || pick(webhookValue, ["leadgen_id", "lead_id", "id"]);
  const metaDetail = await fetchMetaLead(leadgenId);
  const merged = {
    ...raw,
    ...webhookValue,
    ...metaDetail,
    ...normalizeFieldData(raw),
    ...normalizeFieldData(metaDetail),
  };

  const dailyParcels = pick(merged, [
    "daily_parcels",
    "nombre_colis_jour",
    "nombre_de_colis_par_jour",
    "volume_colis",
    "colis_par_jour",
    "combien_de_colis_expediez_vous_par_jour",
  ]);

  return {
    source: "meta_lead_ads",
    external_lead_id: pick(merged, ["leadgen_id", "lead_id", "id"]) || leadgenId,
    external_form_id: pick(merged, ["form_id"]),
    external_ad_id: pick(merged, ["ad_id"]),
    external_campaign_id: pick(merged, ["campaign_id"]),
    campaign_id: pick(merged, ["colixo_campaign_id", "campaign_agent_id"]),
    company_name: pick(merged, ["company_name", "nom_entreprise", "nom_de_l_entreprise", "entreprise", "company"]),
    contact_name: pick(merged, ["contact_name", "full_name", "nom_contact", "nom_du_contact", "name"]),
    phone: pick(merged, ["phone", "phone_number", "telephone", "tel"]),
    email: pick(merged, ["email", "email_address", "e_mail"]),
    city: pick(merged, ["city", "ville", "localite"]),
    canton: pick(merged, ["canton", "state", "region"]),
    sector: pick(merged, ["sector", "secteur", "secteur_activite", "activity_sector"]),
    daily_parcels: integerValue(dailyParcels),
    delivery_zones: pick(merged, ["delivery_zones", "zones_livraison", "zones_de_livraison"]),
    current_carrier: pick(merged, ["current_carrier", "transporteur_actuel"]),
    software_used: pick(merged, ["software_used", "logiciel_utilise", "logiciel"]),
    urgent_need: booleanValue(pick(merged, ["urgent_need", "besoin_urgent"]), false),
    regular_need: booleanValue(pick(merged, ["regular_need", "besoin_regulier"]), true),
    message: pick(merged, ["message", "remarks", "commentaire", "remarque"]),
    meta_campaign_name: pick(merged, ["campaign_name"]),
    meta_ad_name: pick(merged, ["ad_name"]),
    meta_platform: pick(merged, ["platform"]),
    raw_meta_payload: raw,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")?.trim()
      || Deno.env.get("CAMPAIGN_AGENT_WEBHOOK_SECRET")?.trim();

    if (mode === "subscribe" && challenge && expected && token === expected) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return json({ ok: false, error: "Vérification webhook refusée." }, 403);
  }

  if (req.method !== "POST") return json({ ok: false, error: "Méthode non autorisée." }, 405);

  const expectedSecret = Deno.env.get("CAMPAIGN_AGENT_WEBHOOK_SECRET")?.trim()
    || Deno.env.get("WEBHOOK_SECRET")?.trim();
  if (expectedSecret) {
    const headerSecret = (req.headers.get("x-webhook-secret") ?? "").trim();
    if (headerSecret !== expectedSecret) return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Secrets Supabase manquants côté Edge Function." }, 500);
  }

  let raw: AnyRecord;
  try {
    raw = asRecord(await req.json());
  } catch {
    return json({ ok: false, error: "JSON invalide." }, 400);
  }

  const normalized = await buildNormalizedLead(raw);
  if (!normalized.company_name && !normalized.email && !normalized.phone) {
    return json({ ok: false, error: "Lead incomplet : entreprise, email ou téléphone requis.", normalized }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.rpc("campaign_agent_ingest_webhook_lead", {
    p_payload: normalized,
  });

  if (error) {
    console.error("campaign_agent_ingest_webhook_lead failed", error);
    return json({ ok: false, error: error.message, normalized }, 500);
  }

  return json({ ok: true, result: data, normalized });
});
