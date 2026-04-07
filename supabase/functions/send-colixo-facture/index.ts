/**
 * Envoi d’email facture Colixo (HTML + optionnel PDF) via Resend.
 * Même stack que send-brimot-invoice : RESEND_API_KEY, COLIXO_FROM_EMAIL (sinon BRIMOT_FROM_EMAIL).
 *
 * Déployer : supabase functions deploy send-colixo-facture --no-verify-jwt
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

type Body = {
  to?: string;
  subject?: string;
  body?: string;
  html_full?: string;
  /** Lien « Voir la facture en ligne » (page publique hash, comme Brimot) */
  view_url?: string;
  pdf_base64?: string;
  pdf_filename?: string;
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

function injectColixoEmailBanner(htmlFull: string, viewUrl: string, hasPdf: boolean): string {
  const parts: string[] = [];
  if (viewUrl) {
    parts.push(
      `<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:14px"><a href="${escapeHtml(viewUrl)}" style="color:#e8311a;font-weight:600">Voir la facture en ligne</a></p>`,
    );
  }
  if (hasPdf) {
    parts.push(
      `<p style="margin:0 0 12px;padding:8px 12px;background:#fff7ed;border-left:3px solid #e8311a;font-family:Arial,sans-serif;font-size:12px;color:#9a3412">Le PDF de la facture est joint à cet email.</p>`,
    );
  }
  if (!parts.length) return htmlFull;
  const banner =
    `<div style="max-width:210mm;margin:0 auto;padding:12px 16px;background:#fafafa;border-bottom:1px solid #e5e7eb">${parts.join("")}</div>`;
  if (htmlFull.includes("<body")) {
    return htmlFull.replace(/<body[^>]*>/i, (m) => m + banner);
  }
  return banner + htmlFull;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Méthode non autorisée (utilisez POST)." });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Non authentifié — reconnectez-vous sur Colixo." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return json({ ok: false, error: "Session invalide ou expirée — reconnectez-vous." });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return json({ ok: false, error: "Configuration serveur : SUPABASE_SERVICE_ROLE_KEY manquant." });
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: prof, error: profErr } = await supabaseAdmin
    .from("utilisateurs")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profErr) {
    console.error("utilisateurs lookup", profErr);
    return json({ ok: false, error: "Impossible de vérifier votre rôle (base de données)." });
  }
  if (!prof || !["admin", "super_admin"].includes(String(prof.role))) {
    return json({
      ok: false,
      error: "Accès refusé : seuls les comptes admin / super_admin peuvent envoyer des factures Colixo.",
    });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Corps de requête JSON invalide." });
  }

  const to = (payload.to ?? "").trim();
  const subject = (payload.subject ?? "").trim() || "Facture Colixo";
  const bodyText = (payload.body ?? "").trim();
  const htmlFull = (payload.html_full ?? "").trim();
  const viewUrl = (payload.view_url ?? "").trim();
  const pdfB64 = (payload.pdf_base64 ?? "").replace(/[\r\n\s]/g, "");
  const pdfName = (payload.pdf_filename ?? "facture.pdf").trim() || "facture.pdf";

  if (!to || !to.includes("@")) {
    return json({ ok: false, error: "Adresse email destinataire invalide." });
  }

  if (!htmlFull && !bodyText) {
    return json({ ok: false, error: "Corps du message (body) ou html_full requis." });
  }

  const MAX_HTML = 5_200_000;
  if (htmlFull.length > MAX_HTML) {
    return json({
      ok: false,
      error: "HTML facture trop volumineux pour l’envoi (réduire ou contacter le support).",
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = (
    Deno.env.get("COLIXO_FROM_EMAIL")?.trim() ||
    Deno.env.get("BRIMOT_FROM_EMAIL")?.trim() ||
    "Colixo <onboarding@resend.dev>"
  );

  let replyTo = (payload.reply_to ?? "").trim();
  if (replyTo && !isValidEmailLoose(replyTo)) replyTo = "";
  if (!replyTo) {
    const rt = (Deno.env.get("COLIXO_REPLY_TO_EMAIL") ?? "").trim();
    replyTo = rt && isValidEmailLoose(rt) ? rt : "";
  }

  if (!resendKey) {
    return json({
      ok: false,
      error:
        "RESEND_API_KEY manquant : ajoutez le secret dans Supabase (Edge Functions → Secrets).",
    });
  }

  /** html_full = document facture complet (DOCTYPE…) + bandeau lien / PDF comme Brimot */
  const bodyForText = bodyTextWithoutViewUrl(bodyText, viewUrl);
  let htmlEmail = htmlFull
    ? injectColixoEmailBanner(htmlFull, viewUrl, !!pdfB64)
    : `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">${bodyText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .split("\n")
        .join("<br>")}</div>`;
  if (!htmlFull && (viewUrl || pdfB64)) {
    htmlEmail =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">` +
      escapeHtml(bodyForText).split("\n").join("<br>") +
      (viewUrl
        ? `<p style="margin:18px 0 0"><a href="${escapeHtml(viewUrl)}" style="color:#e8311a;text-decoration:underline;font-weight:600">Voir la facture en ligne</a></p>`
        : "") +
      (pdfB64
        ? `<p style="margin-top:12px;padding:8px 12px;background:#fff7ed;border-left:3px solid #e8311a;font-size:11px;color:#9a3412">Le PDF de la facture est joint à cet email.</p>`
        : "") +
      `</div>`;
  }

  const textCombined =
    bodyForText +
    (viewUrl ? `\n\nVoir la facture en ligne :\n${viewUrl}\n` : "") +
    (pdfB64 ? `\n\n(PDF joint : ${pdfName})\n` : "");

  const resendBody: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    text:
      textCombined ||
      (htmlFull ? "Facture Colixo — ouvrez la version HTML de ce message." : ""),
    html: htmlEmail,
  };

  if (replyTo) resendBody.reply_to = replyTo;
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
      " Vérifiez COLIXO_FROM_EMAIL ou BRIMOT_FROM_EMAIL (domaine vérifié Resend).";
    if (res.status === 401) {
      hint =
        " Clé Resend : vérifiez RESEND_API_KEY dans Supabase → Edge Functions → Secrets.";
    }
    if (res.status === 403) {
      hint =
        " Domaine Resend ou destinataire de test : vérifiez resend.com/domains et l’adresse From.";
    }
    return json({
      ok: false,
      error: `Resend a refusé l’envoi (${res.status}). ${detail} —${hint}`,
    });
  }

  return json({ ok: true });
});
