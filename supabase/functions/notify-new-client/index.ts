/**
 * Alerte e-mail quand un nouveau compte client est créé (table public.utilisateurs, role = client).
 *
 * Déploiement :
 *   supabase functions deploy notify-new-client --no-verify-jwt
 *
 * Secrets (Dashboard → Edge Functions → notify-new-client → Secrets) :
 *   RESEND_API_KEY   = clé API Resend (https://resend.com)
 *   NOTIFY_TO_EMAIL  = ton adresse qui reçoit l’alerte
 *   NOTIFY_FROM_EMAIL = expéditeur (ex. "Colixo <notifications@tondomaine.ch>")
 *                       Sur compte Resend sans domaine : "Colixo <onboarding@resend.dev>"
 *                       (n’envoie alors qu’à l’e-mail du compte Resend)
 *   WEBHOOK_SECRET   = chaîne longue aléatoire (la même que l’en-tête du Database Webhook)
 *
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par l’hébergeur
 * des Edge Functions (pas besoin de les ajouter aux secrets).
 *
 * Webhook Supabase :
 *   Dashboard → Database → Webhooks → Create
 *   Table : utilisateurs | Events : Insert
 *   URL : https://<project-ref>.supabase.co/functions/v1/notify-new-client
 *   HTTP Headers (obligatoire pour l’hébergement Supabase) :
 *     apikey            = <clé anon « public » du projet>  (Settings → API)
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
    const h = (req.headers.get("x-webhook-secret") ?? "").trim();
    if (h !== secret) {
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

  if (payload.table && payload.table !== "utilisateurs") {
    return new Response(JSON.stringify({ ok: true, skipped: "wrong table" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (record.role !== "client") {
    return new Response(JSON.stringify({ ok: true, skipped: "not client role" }), {
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

  const email = String(record.email ?? "—");
  const prenom = String(record.prenom ?? "");
  const nom = String(record.nom ?? "");
  const tel = String(record.telephone ?? "—");
  const uid = String(record.id ?? "—");
  const entIdRaw = record.entreprise_id;
  const entId = entIdRaw != null ? String(entIdRaw) : "—";

  let entrepriseLines = "";
  let entrepriseNom = "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceKey && entIdRaw != null && entIdRaw !== "") {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: ent, error: entErr } = await supabase
        .from("entreprises")
        .select("nom, adresse, npa, ville, telephone, numero_client, email")
        .eq("id", entIdRaw)
        .maybeSingle();

      if (entErr) {
        console.error("entreprises lookup", entErr.message);
      } else if (ent) {
        entrepriseNom = String(ent.nom ?? "").trim();
        const addr = [ent.adresse, [ent.npa, ent.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        entrepriseLines =
          `— Entreprise —\n` +
          `Raison sociale : ${ent.nom ?? "—"}\n` +
          `N° client Colixo : ${ent.numero_client ?? "—"}\n` +
          `Adresse : ${addr || "—"}\n` +
          `Tél. entreprise : ${ent.telephone ?? "—"}\n` +
          `Email société : ${ent.email ?? "—"}\n\n`;
      }
    } catch (e) {
      console.error("entreprises fetch failed", e);
    }
  }

  const subject =
    entrepriseNom !== ""
      ? `[Colixo] Nouveau client : ${entrepriseNom}`
      : `[Colixo] Nouveau client : ${email}`;

  const text =
    `Nouvelle inscription (rôle client).\n\n` +
    (entrepriseLines || `Entreprise (id) : ${entId}\n`) +
    `— Contact —\n` +
    `Email : ${email}\n` +
    `Nom : ${prenom} ${nom}\n` +
    `Téléphone : ${tel}\n` +
    `Utilisateur id : ${uid}\n`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: from },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Brevo error", res.status, errBody);
    return new Response(errBody, { status: 502, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
