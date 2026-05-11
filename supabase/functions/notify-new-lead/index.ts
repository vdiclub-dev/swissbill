/**
 * Alerte e-mail quand une nouvelle demande arrive dans public.demandes_inscription.
 * Pour les demandes d'inscription, envoie aussi un accusé de réception au client.
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  admin_id?: string;
  admin_code?: string;
};

function parseSender(value: string): { email: string; name?: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, "");
    return { email: match[2].trim(), ...(name ? { name } : {}) };
  }
  return { email: trimmed };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendBrevoEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  const body: Record<string, unknown> = {
    sender: parseSender(args.from),
    to: [{ email: args.to }],
    subject: args.subject,
    textContent: args.text,
  };
  if (args.html) body.htmlContent = args.html;
  if (args.replyTo && isValidEmail(args.replyTo)) body.replyTo = { email: args.replyTo };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": args.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Brevo ${res.status}: ${errBody}`);
  }
}

function normCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

async function isManualAdminAuthorized(payload: WebhookPayload): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminId = String(payload.admin_id ?? "").trim();
  const adminCode = normCode(payload.admin_code);
  if (!supabaseUrl || !serviceKey || !adminId || !adminCode) return false;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from("utilisateurs")
    .select("role, code_usr, code")
    .eq("id", adminId)
    .maybeSingle();

  if (error || !data || !["admin", "super_admin"].includes(String(data.role))) return false;
  const dbCodes = [data.code_usr, data.code].map(normCode).filter(Boolean);
  return dbCodes.includes(adminCode);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const isManualSignupConfirmation =
    payload.type === "manual_signup_confirmation" &&
    (!payload.table || payload.table === "demandes_inscription");

  const secret = Deno.env.get("WEBHOOK_SECRET")?.trim();
  if (secret) {
    const headerSecret = (req.headers.get("x-webhook-secret") ?? "").trim();
    if (headerSecret !== secret && !isManualSignupConfirmation) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (headerSecret !== secret && isManualSignupConfirmation && !(await isManualAdminAuthorized(payload))) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
  } else if (isManualSignupConfirmation && !(await isManualAdminAuthorized(payload))) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const record = payload.record;
  if (!record || typeof record !== "object") {
    return new Response(JSON.stringify({ ok: true, skipped: "no record" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const brevoKey = Deno.env.get("BREVO_API_KEY")?.trim();
  const to = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  const from = (
    Deno.env.get("NOTIFY_FROM_EMAIL") ?? "info@colixo.ch"
  ).trim();

  if (!brevoKey || !to) {
    console.error("Missing BREVO_API_KEY or NOTIFY_TO_EMAIL");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  let subject: string;
  let text: string;
  let clientConfirmation: { to: string; subject: string; text: string; html: string } | null = null;

  if (payload.table === "quota_alert") {
    const r = record;
    const nom      = String(r.client_nom       ?? "—");
    const abn      = String(r.abonnement_nom   ?? "—");
    const used     = String(r.colis_utilises   ?? "—");
    const quota    = String(r.quota            ?? "—");
    const pct      = String(r.pourcentage      ?? "—");
    const seuil    = Number(r.threshold) >= 100 ? "DÉPASSÉ" : "80%";

    subject = `[Colixo] ⚠️ Quota ${seuil} — ${nom}`;
    text =
      `Alerte consommation abonnement\n\n` +
      `Client    : ${nom}\n` +
      `Abonnement: ${abn}\n` +
      `Utilisé   : ${used} / ${quota} colis (${pct}%)\n` +
      `Seuil     : ${seuil}\n\n` +
      `Consultez le tableau de bord Consommation pour plus de détails.`;
  } else if (payload.table === "quote_requests") {
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

    if (isValidEmail(email)) {
      const displayName = [prenom, nom].filter(Boolean).join(" ").trim() || "Bonjour";
      const companyLine = entreprise && entreprise !== "—" ? `Entreprise : ${entreprise}\n` : "";
      clientConfirmation = {
        to: email,
        subject: "Votre demande d'inscription Colixo a bien été reçue",
        text:
          `Bonjour ${displayName},\n\n` +
          `Nous confirmons la réception de votre demande d'inscription Colixo.\n\n` +
          `${companyLine}` +
          `Notre équipe va la vérifier puis vous transmettre votre code d'accès dès validation.\n\n` +
          `Vous n'avez rien d'autre à faire pour le moment.\n\n` +
          `Cordialement,\n` +
          `L'équipe Colixo\n` +
          `info@colixo.ch\n`,
        html:
          `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:620px;">` +
          `<div style="font-size:22px;font-weight:800;color:#e8311a;margin-bottom:14px;">Colixo</div>` +
          `<p>Bonjour ${escapeHtml(displayName)},</p>` +
          `<p>Nous confirmons la réception de votre demande d'inscription Colixo.</p>` +
          `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:18px 0;">` +
          `${companyLine ? `<div><strong>Entreprise :</strong> ${escapeHtml(entreprise)}</div>` : ""}` +
          `<div><strong>Statut :</strong> en attente de validation</div>` +
          `</div>` +
          `<p>Notre équipe va la vérifier puis vous transmettre votre code d'accès dès validation.</p>` +
          `<p>Vous n'avez rien d'autre à faire pour le moment.</p>` +
          `<p style="margin-top:22px;">Cordialement,<br><strong>L'équipe Colixo</strong><br><a href="mailto:info@colixo.ch" style="color:#e8311a;">info@colixo.ch</a></p>` +
          `</div>`,
      };
    }
  } else {
    return new Response(JSON.stringify({ ok: true, skipped: "wrong table" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const replyTo = String(record.email ?? "").trim() || undefined;
  const errors: string[] = [];
  let adminSent = isManualSignupConfirmation;

  if (!isManualSignupConfirmation) {
    try {
      await sendBrevoEmail({
        apiKey: brevoKey,
        from,
        to,
        subject,
        text,
        replyTo,
      });
      adminSent = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Brevo admin notification error", message);
      errors.push(`admin: ${message}`);
    }
  }

  if (clientConfirmation) {
    try {
      await sendBrevoEmail({
        apiKey: brevoKey,
        from,
        to: clientConfirmation.to,
        subject: clientConfirmation.subject,
        text: clientConfirmation.text,
        html: clientConfirmation.html,
        replyTo: to,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Brevo client confirmation error", message);
      errors.push(`client: ${message}`);
    }
  }

  if (!adminSent) {
    return new Response(JSON.stringify({ ok: false, errors }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isManualSignupConfirmation && errors.some((e) => e.startsWith("client:"))) {
    return new Response(JSON.stringify({ ok: false, errors }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    client_confirmation: !!clientConfirmation && !errors.some((e) => e.startsWith("client:")),
    warnings: errors,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
