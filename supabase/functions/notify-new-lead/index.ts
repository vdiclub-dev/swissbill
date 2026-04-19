/**
 * Alerte e-mail quand une nouvelle demande arrive dans public.demandes_inscription.
 *
 * Déploiement :
 *   supabase functions deploy notify-new-lead --no-verify-jwt
 *
 * Secrets (Dashboard → Edge Functions → notify-new-lead → Secrets) :
 *   RESEND_API_KEY    = clé API Resend
 *   NOTIFY_TO_EMAIL   = ton adresse de réception (ex. info@colixo.ch)
 *   NOTIFY_FROM_EMAIL = expéditeur (ex. "Colixo <notifications@tondomaine.ch>")
 *                       ou "Colixo <onboarding@resend.dev>" pour un compte Resend de test
 *   WEBHOOK_SECRET    = chaîne longue aléatoire (la même que celle du Database Webhook)
 *
 * Webhook Supabase :
 *   Dashboard → Database → Webhooks → Create
 *   Table : demandes_inscription | Events : Insert
 *   URL : https://<project-ref>.supabase.co/functions/v1/notify-new-lead
 *   HTTP Headers :
 *     apikey            = <clé anon du projet>
 *     Authorization     = Bearer <même clé anon>
 *     x-webhook-secret  = <WEBHOOK_SECRET>
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const secret = Deno.env.get("WEBHOOK_SECRET")?.trim();
  if (secret) {
    const headerSecret = (req.headers.get("x-webhook-secret") ?? "").trim();
    if (headerSecret !== secret) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const record = payload.record;
  if (!record || typeof record !== "object") {
    return new Response(JSON.stringify({ ok: true, skipped: "no record" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const to = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  const from = (
    Deno.env.get("NOTIFY_FROM_EMAIL") ?? "Colixo <onboarding@resend.dev>"
  ).trim();

  if (!resendKey || !to) {
    console.error("Missing RESEND_API_KEY or NOTIFY_TO_EMAIL");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  let subject: string;
  let text: string;

  if (payload.table === "quote_requests") {
    const company  = String(record.company_name   ?? "—");
    const contact  = String(record.contact_name   ?? "—");
    const email    = String(record.email          ?? "—");
    const phone    = String(record.phone          ?? "—");
    const interest = String(record.interest_type  ?? "—");
    const volume   = String(record.monthly_volume ?? "—");
    const message  = String(record.message        ?? "—");
    const service  = String(record.calc_service_label ?? "—");
    const weight   = record.calc_weight_kg   != null ? `${record.calc_weight_kg} kg`   : "—";
    const dist     = record.calc_distance_km != null ? `${record.calc_distance_km} km` : "—";
    const total    = record.calc_total_chf   != null ? `${Number(record.calc_total_chf).toFixed(2)} CHF` : "—";
    const opts     = Array.isArray(record.calc_selected_options) && record.calc_selected_options.length
      ? (record.calc_selected_options as string[]).join(", ") : "aucune";

    subject = `[Colixo] Nouveau devis — ${company}`;
    text =
      `Nouvelle demande de devis reçue sur colixo.ch\n\n` +
      `── CLIENT ──────────────────────────\n` +
      `Société   : ${company}\n` +
      `Contact   : ${contact}\n` +
      `E-mail    : ${email}\n` +
      `Téléphone : ${phone}\n` +
      `Offre     : ${interest}\n` +
      `Volume    : ${volume}\n\n` +
      `── CALCULATEUR ─────────────────────\n` +
      `Service   : ${service}\n` +
      `Poids     : ${weight}\n` +
      `Distance  : ${dist}\n` +
      `Options   : ${opts}\n` +
      `Estimation: ${total}\n\n` +
      `── MESSAGE ──────────────────────────\n` +
      `${message}\n`;
  } else if (!payload.table || payload.table === "demandes_inscription") {
    const prenom = String(record.prenom ?? "").trim();
    const nom = String(record.nom ?? "").trim();
    const email = String(record.email ?? "—").trim();
    const telephone = String(record.telephone ?? "—").trim();
    const entreprise = String(record.entreprise_nom ?? "—").trim();
    const adresse = String(record.adresse ?? "—").trim();
    const message = String(record.message ?? "—").trim();
    const statut = String(record.statut ?? "en_attente").trim();
    const createdAt = String(record.created_at ?? "—").trim();
    const id = String(record.id ?? "—").trim();

    subject = entreprise && entreprise !== "—"
      ? `[Colixo] Nouvelle demande : ${entreprise}`
      : `[Colixo] Nouvelle demande : ${prenom} ${nom}`.trim();
    text =
      `Nouvelle demande reçue sur le site Colixo.\n\n` +
      `Prénom : ${prenom || "—"}\n` +
      `Nom : ${nom || "—"}\n` +
      `Email : ${email || "—"}\n` +
      `Téléphone : ${telephone || "—"}\n` +
      `Entreprise : ${entreprise || "—"}\n` +
      `Adresse : ${adresse || "—"}\n` +
      `Statut : ${statut || "—"}\n` +
      `Créée le : ${createdAt || "—"}\n` +
      `ID : ${id || "—"}\n\n` +
      `Message :\n${message || "—"}\n`;
  } else {
    return new Response(JSON.stringify({ ok: true, skipped: "wrong table" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const replyTo = String(record.email ?? "").trim() || undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Resend error", res.status, errBody);
    return new Response(errBody, { status: 502, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
