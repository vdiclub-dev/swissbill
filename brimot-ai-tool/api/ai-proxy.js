const https = require("https");
const { takeDailyQuota } = require("./_rate-limit");

function requestJson(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(raw || "Upstream API error"));
        }
        try { resolve(raw ? JSON.parse(raw) : {}); }
        catch (e) { reject(new Error("Upstream JSON parse error")); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const quota = takeDailyQuota(req, "ai-proxy");
  res.setHeader("X-RateLimit-Limit", String(quota.limit));
  res.setHeader("X-RateLimit-Remaining", String(quota.remaining));
  res.setHeader("X-RateLimit-Reset", quota.resetAt);
  if (!quota.allowed) {
    res.setHeader("Retry-After", String(quota.retryAfterSeconds));
    return res.status(429).json({
      error: "Daily request limit reached",
      limit: quota.limit,
      remaining: 0,
      resetAt: quota.resetAt
    });
  }

  const OPENAI_API_KEY = process.env.BRIMOT_OPENAI_API_KEY || "";
  const DEEPSEEK_API_KEY = process.env.BRIMOT_DEEPSEEK_API_KEY || "";

  const payload = req.body || {};
  const provider = payload.provider === "deepseek" ? "deepseek" : "openai";
  const model = String(payload.model || (provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini"));
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const temperature = Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.2;
  const projectId = String(payload.projectId || "").trim();

  if (!messages.length) {
    return res.status(400).json({ error: "messages is required" });
  }

  const apiKey = provider === "deepseek" ? DEEPSEEK_API_KEY : OPENAI_API_KEY;
  const apiUrl = provider === "deepseek"
    ? "https://api.deepseek.com/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing server API key",
      hint: provider === "deepseek" ? "Set BRIMOT_DEEPSEEK_API_KEY" : "Set BRIMOT_OPENAI_API_KEY"
    });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + apiKey
  };
  if (provider === "openai" && projectId) {
    headers["OpenAI-Project"] = projectId;
  }

  try {
    const upstream = await requestJson(apiUrl, "POST", headers, { model, temperature, messages });
    const content =
      upstream &&
      upstream.choices &&
      upstream.choices[0] &&
      upstream.choices[0].message
        ? upstream.choices[0].message.content
        : "{}";
    return res.status(200).json({ provider, model, content, raw: upstream });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
