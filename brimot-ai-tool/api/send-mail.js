const { takeDailyQuota } = require("./_rate-limit");

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function json(res, status, payload, extraHeaders) {
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach((key) => {
      res.setHeader(key, extraHeaders[key]);
    });
  }
  res.status(status).json(payload);
}

function toHtmlFallback(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const quota = takeDailyQuota(req, "mail");
  const quotaHeaders = {
    "X-RateLimit-Limit": String(quota.limit),
    "X-RateLimit-Remaining": String(quota.remaining),
    "X-RateLimit-Reset": quota.resetAt,
    "Retry-After": String(quota.retryAfterSeconds)
  };

  if (!quota.allowed) {
    return json(res, 429, {
      error: "Quota journalier atteint pour l'envoi mail",
      quota
    }, quotaHeaders);
  }

  const apiKey = process.env.BRIMOT_BREVO_API_KEY;
  const from = process.env.BRIMOT_MAIL_FROM;

  if (!apiKey || !from) {
    return json(res, 503, {
      error: "Service mail non configure (BRIMOT_BREVO_API_KEY ou BRIMOT_MAIL_FROM manquant)"
    }, quotaHeaders);
  }

  const body = req.body || {};
  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  const html = String(body.html || "").trim() || toHtmlFallback(text);

  if (!to || !subject || (!text && !html)) {
    return json(res, 400, {
      error: "Parametres invalides: to, subject, text/html requis"
    }, quotaHeaders);
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender: { email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, response.status, {
        error: (data && data.message) || "Erreur fournisseur mail",
        details: data
      }, quotaHeaders);
    }

    return json(res, 200, {
      ok: true,
      id: data && data.messageId ? data.messageId : null,
      quota
    }, quotaHeaders);
  } catch (error) {
    return json(res, 500, {
      error: "Echec envoi email",
      details: String(error && error.message ? error.message : error)
    }, quotaHeaders);
  }
};
