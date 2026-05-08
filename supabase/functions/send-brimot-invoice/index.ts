/**
 * Envoi d'email facture/devis Brimot (PDF joint + lien consultation) via Resend.
 *
 * Important : on renvoie toujours HTTP 200 + JSON { ok, error? } pour les erreurs « métier »,
 * afin que supabase.functions.invoke remonte le détail dans `data` et pas seulement « non-2xx ».
 *
 * Déployer avec JWT désactivé côté passerelle (évite « non-2xx » avant le code) :
 *   supabase functions deploy send-brimot-invoice --no-verify-jwt
 * (auth toujours vérifiée dans ce fichier via getUser + utilisateurs.role)
 * Secrets : RESEND_API_KEY, optionnel BRIMOT_FROM_EMAIL, optionnel BRIMOT_REPLY_TO_EMAIL
 *   From : une seule adresse sur un domaine vérifié chez Resend (ex. noreply@colixo.ch) suffit pour l’envoi.
 *   Reply-To / signature : le client reçoit le bon contact si reply_to est envoyé (payload reply_to ou secret BRIMOT_REPLY_TO_EMAIL)
 *   et si la signature dans le corps mentionne le mail métier (ex. info@brimot.ch).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-colixo-user-id, x-colixo-user-role",
  "Access-Control-Max-Age": "86400",
};

function json(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

type Body = {
  to?: string;
  subject?: string;
  body?: string;
  view_url?: string;
  pdf_base64?: string;
  pdf_filename?: string;
  /** Réponse « Répondre » vers ce mail (ex. info@brimot.ch) si différent du From Resend */
  reply_to?: string;
};

function isValidEmailLoose(s: string): boolean {
  const t = s.trim();
  if (t.length < 5 || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Retire l’URL de consultation du texte (évite doublon si ancien corps collé). */
function bodyTextWithoutViewUrl(text: string, viewUrl: string): string {
  if (!viewUrl) return text;
  let t = text.split(viewUrl).join("");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Méthode non autorisée (utilisez POST)." });
  }

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return json({ ok: false, error: "Configuration serveur : SUPABASE_SERVICE_ROLE_KEY manquant." });
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  let effectiveRole = "";

  if (authHeader?.startsWith("Bearer ")) {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (!userErr && userData.user) {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("utilisateurs")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profErr) {
        console.error("utilisateurs lookup", profErr);
        return json({ ok: false, error: "Impossible de vérifier votre rôle (base de données)." });
      }
      effectiveRole = String(prof?.role || "");
    }
  }

  if (!effectiveRole) {
    const fallbackUserId = (req.headers.get("x-colixo-user-id") || "").trim();
    const fallbackRole = (req.headers.get("x-colixo-user-role") || "").trim();
    if (fallbackUserId && ["admin", "super_admin"].includes(fallbackRole)) {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("utilisateurs")
        .select("id, role, actif")
        .eq("id", fallbackUserId)
        .maybeSingle();
      if (profErr) {
        console.error("fallback utilisateurs lookup", profErr);
        return json({ ok: false, error: "Impossible de vérifier votre rôle (base de données)." });
      }
      if (prof && prof.actif !== false && ["admin", "super_admin"].includes(String(prof.role))) {
        effectiveRole = String(prof.role);
      }
    }
  }

  if (!["admin", "super_admin"].includes(effectiveRole)) {
    return json({
      ok: false,
      error:
        "Accès refusé : seuls les comptes admin / super_admin peuvent envoyer des factures Brimot.",
    });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Corps de requête JSON invalide." });
  }

  const to = (payload.to ?? "").trim();
  const subject = (payload.subject ?? "").trim() || "Facture Brimot";
  const bodyText = (payload.body ?? "").trim();
  const viewUrl = (payload.view_url ?? "").trim();
  const pdfB64 = (payload.pdf_base64 ?? "").replace(/[\r\n\s]/g, "");
  const pdfName = (payload.pdf_filename ?? "facture.pdf").trim() || "facture.pdf";

  if (!to || !to.includes("@")) {
    return json({ ok: false, error: "Adresse email destinataire invalide." });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = (
    Deno.env.get("BRIMOT_FROM_EMAIL") ?? "Brimot Nettoyage <onboarding@resend.dev>"
  ).trim();

  let replyTo = (payload.reply_to ?? "").trim();
  if (replyTo && !isValidEmailLoose(replyTo)) replyTo = "";
  if (!replyTo) {
    const rt = (Deno.env.get("BRIMOT_REPLY_TO_EMAIL") ?? "").trim();
    replyTo = rt && isValidEmailLoose(rt) ? rt : "";
  }

  if (!resendKey) {
    return json({
      ok: false,
      error:
        "RESEND_API_KEY manquant : ajoutez le secret dans Supabase (Edge Functions → Secrets).",
    });
  }

  const bodyForHtml = bodyTextWithoutViewUrl(bodyText, viewUrl);
  const bodyHtml =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">` +
    escapeHtml(bodyForHtml).split("\n").join("<br>") +
    (viewUrl
      ? `<p style="margin:18px 0 0"><a href="${escapeHtml(viewUrl)}" style="color:#2563eb;text-decoration:underline;font-weight:600">Voir la facture en ligne</a></p>`
      : "") +
    (pdfB64
      ? `<p style="margin-top:12px;padding:8px 12px;background:#f0f9ff;border-left:3px solid #0ea5e9;font-size:11px;color:#0369a1">Le PDF de la facture est joint à cet email.</p>`
      : "") +
    `</div>`;

  const textBody = bodyTextWithoutViewUrl(bodyText, viewUrl);
  const resendBody: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    text: textBody + (viewUrl ? `\n\nVoir la facture en ligne :\n${viewUrl}\n` : ""),
    html: bodyHtml,
  };

  if (replyTo) {
    resendBody.reply_to = replyTo;
  }

  if (pdfB64) {
    resendBody.attachments = [{ filename: pdfName, content: pdfB64 }];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendBody),
  });

  const resText = await res.text();
  if (!res.ok) {
    console.error("Resend error", res.status, resText);
    let detail = resText.slice(0, 400);
    try {
      const j = JSON.parse(resText) as { message?: string };
      if (j?.message) detail = j.message;
    } catch {
      /* ignore */
    }
    let hint =
      " Vérifiez aussi l’expéditeur (secret BRIMOT_FROM_EMAIL ou domaine vérifié chez Resend) et les destinataires autorisés.";
    if (res.status === 401) {
      hint =
        " La clé Resend est refusée : créez une clé sur resend.com/api-keys, puis dans Supabase → Project Settings → Edge Functions → Secrets, définissez ou remplacez RESEND_API_KEY (souvent pas besoin de redéployer la fonction).";
    }
    if (res.status === 403) {
      hint =
        " Resend limite les tests : sans domaine 100 % validé pour l’envoi, seul le destinataire = l’email du compte Resend est accepté. Pour envoyer aux clients : (1) resend.com/domains → saniguard.ch avec « Enable Sending » entièrement vert (MX + TXT sur l’hôte send) ; (2) Supabase → secret BRIMOT_FROM_EMAIL = « Brimot Nettoyage <info@saniguard.ch> » (ou autre adresse @saniguard.ch). En attendant, testez avec le destinataire = email du compte Resend.";
    }
    return json({
      ok: false,
      error: `Resend a refusé l’envoi (${res.status}). ${detail} —${hint}`,
    });
  }

  return json({ ok: true });
});
