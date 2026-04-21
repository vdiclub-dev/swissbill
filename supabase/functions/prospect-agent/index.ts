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

  // Wrapper HTML pour l'email
  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;}
  .wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);}
  .header{background:#e8311a;padding:28px 32px;}
  .header h1{color:#fff;margin:0;font-size:24px;letter-spacing:1px;}
  .header p{color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;}
  .body{padding:32px;}
  .body p{color:#333;line-height:1.7;margin:0 0 16px;}
  .cta{display:inline-block;background:#e8311a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;margin:8px 0 24px;}
  .footer{background:#f9f9f9;padding:20px 32px;font-size:11px;color:#999;border-top:1px solid #eee;}
</style></head>
<body><div class="wrap">
  <div class="header"><h1>COLIXO</h1><p>Livraison express en Suisse</p></div>
  <div class="body">
    ${emailHtml}
    <a href="https://colixo.ch" class="cta">Découvrir Colixo →</a>
  </div>
  <div class="footer">Colixo · Service de livraison express Suisse · <a href="mailto:info@colixo.ch">info@colixo.ch</a><br>
  Pour ne plus recevoir nos emails, répondez avec "désabonnement".</div>
</div></body></html>`;

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
