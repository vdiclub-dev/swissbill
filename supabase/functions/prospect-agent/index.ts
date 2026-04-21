/**
 * prospect-agent — Génère un email personnalisé avec Claude AI et l'envoie via Resend
 *
 * Déploiement :
 *   supabase functions deploy prospect-agent --no-verify-jwt
 *
 * Secrets :
 *   OPENAI_API_KEY      = clé API OpenAI (déjà utilisée dans colixo-ai-pricing)
 *   RESEND_API_KEY      = clé API Resend
 *   NOTIFY_FROM_EMAIL   = expéditeur ex. "Colixo <info@colixo.ch>"
 *
 * Body attendu :
 * {
 *   prospect: { nom, email, ville, site, secteur, telephone },
 *   template: string,        // template avec {nom}, {ville}, {secteur}
 *   sujet: string,
 *   campagne_id?: string
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const fromEmail = (Deno.env.get("NOTIFY_FROM_EMAIL") ?? "Colixo <info@colixo.ch>").trim();

  if (!openaiKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Secrets manquants (OPENAI_API_KEY, RESEND_API_KEY)" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: { prospect: Record<string,string>; template: string; sujet: string; campagne_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: corsHeaders });
  }

  const { prospect, template, sujet } = body;
  if (!prospect?.email || !template || !sujet) {
    return new Response(JSON.stringify({ error: "Champs manquants: prospect.email, template, sujet" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 1. Générer l'email personnalisé avec Claude
  const baseEmail = template
    .replace(/\{nom\}/g, prospect.nom || "")
    .replace(/\{ville\}/g, prospect.ville || "")
    .replace(/\{secteur\}/g, prospect.secteur || "");

  let emailHtml = "";
  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: "Tu es un commercial de Colixo, service de livraison express en Suisse. Tu rédiges des emails de prospection professionnels et personnalisés en français."
          },
          {
            role: "user",
            content: `Rédige un email de prospection pour cette entreprise :
- Nom : ${prospect.nom || "—"}
- Secteur : ${prospect.secteur || "commerce"}
- Ville : ${prospect.ville || "Suisse"}
- Site : ${prospect.site || "—"}

Base-toi sur ce template mais personnalise selon le secteur et la ville :
---
${baseEmail}
---

Réponds UNIQUEMENT avec le contenu HTML de l'email (balises <p> et <strong> seulement).
Maximum 200 mots. Ton direct, professionnel, proposition de valeur claire.`
          }
        ]
      })
    });
    const aiJson = await aiRes.json();
    emailHtml = aiJson.choices?.[0]?.message?.content || baseEmail;
  } catch (e) {
    console.warn("[prospect-agent] OpenAI error, fallback to template:", e);
    emailHtml = baseEmail.replace(/\n/g, "<br>");
  }

  // Wrapper HTML premium pour l'email
  const fullHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colixo</title></head>
<body style="margin:0;padding:0;background:#0b0b0d;font-family:Inter,Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0d;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:linear-gradient(135deg,#1a1a22,#111116);border-radius:20px 20px 0 0;padding:26px 32px;border:1px solid rgba(255,255,255,.07);border-bottom:none;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><div style="display:inline-block;background:linear-gradient(135deg,#e8311a,#ff6a3d);border-radius:12px;width:42px;height:42px;line-height:42px;text-align:center;font-weight:900;font-size:18px;color:#fff;vertical-align:middle;">C</div>
            <span style="font-size:20px;font-weight:900;letter-spacing:.05em;color:#fff;vertical-align:middle;margin-left:12px;">COLIXO</span></td>
          <td align="right"><span style="background:rgba(232,49,26,.15);border:1px solid rgba(232,49,26,.3);border-radius:999px;padding:7px 14px;font-size:12px;color:#ffb8a8;">🚀 Livraison express</span></td>
        </tr></table>
      </td></tr>

      <tr><td style="height:4px;background:linear-gradient(90deg,#e8311a,#ff6a3d);"></td></tr>

      <tr><td style="background:linear-gradient(180deg,#141418,#1b1b21);padding:32px 32px 24px;border:1px solid rgba(255,255,255,.07);border-top:none;border-bottom:none;">
        <div style="color:#e8e8f0;font-size:15px;line-height:1.75;">${emailHtml}</div>
        <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
          <tr><td style="background:linear-gradient(135deg,#e8311a,#ff6a3d);border-radius:12px;box-shadow:0 10px 28px rgba(232,49,26,.35);">
            <a href="https://colixo.ch" style="display:inline-block;color:#fff;text-decoration:none;padding:14px 28px;font-weight:800;font-size:15px;letter-spacing:.02em;">Découvrir Colixo →</a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="background:#0f0f14;border-radius:0 0 20px 20px;padding:20px 32px;border:1px solid rgba(255,255,255,.07);border-top:1px solid rgba(255,255,255,.05);">
        <p style="margin:0;font-size:12px;color:#5a5a6e;line-height:1.6;">
          Colixo · Impasse des Griottes 3, 1462 Yvonand · Suisse<br>
          <a href="mailto:info@colixo.ch" style="color:#8a8a9e;text-decoration:none;">info@colixo.ch</a> ·
          <a href="https://colixo.ch" style="color:#8a8a9e;text-decoration:none;">colixo.ch</a><br>
          <span style="font-size:11px;color:#3a3a4e;">Pour ne plus recevoir nos e-mails, répondez avec "désabonnement".</span>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  // 2. Envoyer via Resend
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [prospect.email],
      subject: sujet.replace(/\{nom\}/g, prospect.nom || "").replace(/\{ville\}/g, prospect.ville || ""),
      html: fullHtml,
    })
  });

  const sendJson = await sendRes.json();
  if (!sendRes.ok) {
    return new Response(JSON.stringify({ error: "Resend error", detail: sendJson }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true, email_id: sendJson.id, to: prospect.email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
