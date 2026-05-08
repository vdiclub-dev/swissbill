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

  const quota = takeDailyQuota(req, "ai-web-research");
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

  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Missing server API key",
      hint: "Set BRIMOT_OPENAI_API_KEY"
    });
  }

  const payload = req.body || {};
  const model = String(payload.model || "gpt-4.1-mini");
  const input = String(payload.input || "").trim();
  const projectId = String(payload.projectId || "").trim();

  if (!input) {
    return res.status(400).json({ error: "input is required" });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + OPENAI_API_KEY
  };
  if (projectId) {
    headers["OpenAI-Project"] = projectId;
  }

  try {
    const upstream = await requestJson(
      "https://api.openai.com/v1/responses",
      "POST",
      headers,
      {
        model,
        tools: [{ type: "web_search_preview", search_context_size: "medium" }],
        input
      }
    );
    return res.status(200).json(upstream);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
