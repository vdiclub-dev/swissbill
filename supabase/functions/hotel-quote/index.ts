/**
 * Reçoit le formulaire de devis hôtel et envoie 2 emails via Brevo :
 *  1. Notification interne → NOTIFY_TO_EMAIL
 *  2. Confirmation → l'hôtel demandeur
 * Secrets : BREVO_API_KEY, NOTIFY_TO_EMAIL, NOTIFY_FROM_EMAIL
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);

  const brevoKey = Deno.env.get("BREVO_API_KEY")?.trim();
  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "info@colixo.ch";
  const from     = Deno.env.get("NOTIFY_FROM_EMAIL")?.trim() || "info@colixo.ch";

  if (!brevoKey) return json({ error: "BREVO_API_KEY manquant" }, 503);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const prenom       = (body.firstname    || "").trim();
  const nom          = (body.lastname     || "").trim();
  const hotel        = (body.hotel        || "").trim();
  const email        = (body.email        || "").trim();
  const tel          = (body.phone        || "").trim();
  const lieu         = (body.location     || "").trim();
  const categorie    = (body.category     || "").trim();
  const volume       = (body.volume       || "").trim();
  const destinations = (body.destinations || "").trim();
  const message      = (body.message      || "").trim();

  if (!email || !hotel) return json({ error: "email et hotel requis" }, 400);

  const sendBrevo = async (to: string, subject: string, html: string, replyTo?: string) => {
    const payload: Record<string, unknown> = {
      sender: { email: from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };
    if (replyTo) payload.replyTo = { email: replyTo };
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
  };

  // 1. Notification interne
  await sendBrevo(
    notifyTo,
    `[Colixo] Nouvelle demande hôtel — ${hotel}`,
    `<h2 style="font-family:sans-serif;color:#FF6A00;">Nouvelle demande de devis hôtel</h2>
     <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Hôtel</td><td><strong>${hotel}</strong></td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Contact</td><td>${prenom} ${nom}</td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Téléphone</td><td>${tel || "—"}</td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Lieu</td><td>${lieu || "—"}</td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Catégorie</td><td>${categorie || "—"}</td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Volume/mois</td><td>${volume || "—"}</td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#666;">Destinations</td><td>${destinations || "—"}</td></tr>
     </table>
     ${message ? `<p style="font-family:sans-serif;font-size:14px;margin-top:16px;"><strong>Message :</strong><br>${message}</p>` : ""}`,
    email
  );

  // 2. Confirmation au demandeur
  await sendBrevo(
    email,
    `Colixo — Votre demande de devis a bien été reçue`,
    `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
       <h2 style="color:#FF6A00;">Bonjour ${prenom},</h2>
       <p>Nous avons bien reçu votre demande de devis pour <strong>${hotel}</strong>.</p>
       <p>Notre équipe vous répondra dans les 24 heures ouvrées avec une proposition adaptée.</p>
       <p style="margin-top:24px;">Pour toute urgence :</p>
       <p>📞 <a href="tel:+41796467442" style="color:#FF6A00;">+41 79 646 74 42</a><br>
          ✉️ <a href="mailto:info@colixo.ch" style="color:#FF6A00;">info@colixo.ch</a></p>
       <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
       <p style="font-size:12px;color:#999;">Colixo — Impasse des Griottes 3, 1462 Yvonand, Suisse</p>
     </div>`
  );

  return json({ ok: true });
});
