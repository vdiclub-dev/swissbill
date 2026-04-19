/**
 * Alerte e-mail quand une nouvelle demande de devis arrive dans public.quote_requests.
 *
 * Déploiement :
 *   supabase functions deploy notify-new-quote --no-verify-jwt
 *
 * Secrets (Dashboard → Edge Functions → notify-new-quote → Secrets) :
 *   RESEND_API_KEY    = (déjà configuré)
 *   NOTIFY_TO_EMAIL   = (déjà configuré)
 *   NOTIFY_FROM_EMAIL = (déjà configuré)
 *   WEBHOOK_SECRET    = (même valeur que les autres webhooks)
 *
 * Webhook Supabase :
 *   Dashboard → Database → Webhooks → Create
 *   Table : quote_requests | Events : Insert
 *   URL : https://<project-ref>.supabase.co/functions/v1/notify-new-quote
 *   HTTP Headers :
 *     apikey           = <clé anon>
 *     Authorization    = Bearer <clé anon>
 *     x-webhook-secret = <WEBHOOK_SECRET>
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const secret = Deno.env.get("WEBHOOK_SECRET")?.trim();
  if (secret && (req.headers.get("x-webhook-secret") ?? "").trim() !== secret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let payload: WebhookPayload;
  try { payload = (await req.json()) as WebhookPayload; }
  catch { return new Response("Invalid JSON", { status: 400, headers: corsHeaders }); }

  const r = payload.record;
  if (!r) return new Response(JSON.stringify({ ok: true, skipped: "no record" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const to        = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  const from      = (Deno.env.get("NOTIFY_FROM_EMAIL") ?? "Colixo <onboarding@resend.dev>").trim();

  if (!resendKey || !to) {
    console.error("Missing RESEND_API_KEY or NOTIFY_TO_EMAIL");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const company  = String(r.company_name  ?? "—");
  const contact  = String(r.contact_name  ?? "—");
  const email    = String(r.email         ?? "—");
  const phone    = String(r.phone         ?? "—");
  const interest = String(r.interest_type ?? "—");
  const volume   = String(r.monthly_volume ?? "—");
  const message  = String(r.message       ?? "—");
  const service  = String(r.calc_service_label ?? "—");
  const weight   = r.calc_weight_kg  != null ? `${r.calc_weight_kg} kg`  : "—";
  const dist     = r.calc_distance_km != null ? `${r.calc_distance_km} km` : "—";
  const total    = r.calc_total_chf  != null ? `${Number(r.calc_total_chf).toFixed(2)} CHF` : "—";
  const opts     = Array.isArray(r.calc_selected_options) && r.calc_selected_options.length
    ? (r.calc_selected_options as string[]).join(", ")
    : "aucune";

  const subject = `[Colixo] Nouveau devis — ${company}`;

  const text =
    `Nouvelle demande de devis reçue sur colixo.ch\n\n` +
    `── CLIENT ──────────────────────────\n` +
    `Société    : ${company}\n` +
    `Contact    : ${contact}\n` +
    `E-mail     : ${email}\n` +
    `Téléphone  : ${phone}\n` +
    `Offre      : ${interest}\n` +
    `Volume     : ${volume}\n\n` +
    `── CALCULATEUR ─────────────────────\n` +
    `Service    : ${service}\n` +
    `Poids      : ${weight}\n` +
    `Distance   : ${dist}\n` +
    `Options    : ${opts}\n` +
    `Estimation : ${total}\n\n` +
    `── MESSAGE ──────────────────────────\n` +
    `${message}\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: email !== "—" ? email : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error", res.status, err);
    return new Response(err, { status: 502, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
