const https = require("https");
const fs = require("fs");
const path = require("path");

const options = {
  key: fs.readFileSync("localhost+2-key.pem"),
  cert: fs.readFileSync("localhost+2.pem")
};

const OPENAI_API_KEY = process.env.BRIMOT_OPENAI_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.BRIMOT_DEEPSEEK_API_KEY || "";

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function requestJson(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(raw || "Upstream API error"));
        }
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (error) {
          reject(new Error("Upstream JSON parse error"));
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function getProviderConfig(provider) {
  if (provider === "deepseek") {
    return {
      url: "https://api.deepseek.com/chat/completions",
      apiKey: DEEPSEEK_API_KEY
    };
  }
  return {
    url: "https://api.openai.com/v1/chat/completions",
    apiKey: OPENAI_API_KEY
  };
}

function extractMessageContent(json) {
  return json && json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : "{}";
}

async function handleAiProxy(req, res) {
  const payload = await readJsonBody(req);
  const provider = payload.provider === "deepseek" ? "deepseek" : "openai";
  const model = String(payload.model || (provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini"));
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const temperature = Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.2;
  const projectId = String(payload.projectId || "").trim();

  if (!messages.length) {
    return sendJson(res, 400, { error: "messages is required" });
  }

  const providerCfg = getProviderConfig(provider);
  if (!providerCfg.apiKey) {
    return sendJson(res, 500, {
      error: "Missing server API key",
      hint: provider === "deepseek"
        ? "Set BRIMOT_DEEPSEEK_API_KEY"
        : "Set BRIMOT_OPENAI_API_KEY"
    });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + providerCfg.apiKey
  };
  if (provider === "openai" && projectId) {
    headers["OpenAI-Project"] = projectId;
  }

  const upstream = await requestJson(providerCfg.url, "POST", headers, {
    model,
    temperature,
    messages
  });

  return sendJson(res, 200, {
    provider,
    model,
    content: extractMessageContent(upstream),
    raw: upstream
  });
}

async function handleWebResearchProxy(req, res) {
  if (!OPENAI_API_KEY) {
    return sendJson(res, 500, {
      error: "Missing server API key",
      hint: "Set BRIMOT_OPENAI_API_KEY"
    });
  }

  const payload = await readJsonBody(req);
  const model = String(payload.model || "gpt-4.1-mini");
  const input = String(payload.input || "").trim();
  const projectId = String(payload.projectId || "").trim();
  if (!input) {
    return sendJson(res, 400, { error: "input is required" });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + OPENAI_API_KEY
  };
  if (projectId) {
    headers["OpenAI-Project"] = projectId;
  }

  const upstream = await requestJson("https://api.openai.com/v1/responses", "POST", headers, {
    model,
    tools: [
      {
        type: "web_search_preview",
        search_context_size: "medium"
      }
    ],
    input
  });

  return sendJson(res, 200, upstream);
}

const server = https.createServer(options, async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "https://localhost");
  const pathname = url.pathname;

  try {
    if (req.method === "POST" && pathname === "/api/ai-proxy") {
      return await handleAiProxy(req, res);
    }
    if (req.method === "POST" && pathname === "/api/ai-web-research") {
      return await handleWebResearchProxy(req, res);
    }
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }

  let filePath = "." + pathname;
  if (filePath === "./") {
    filePath = "./index.html";
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("File not found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(8443, "0.0.0.0", () => {
  console.log("Serveur HTTPS demarre sur https://0.0.0.0:8443");
  console.log("Proxy IA actif: POST /api/ai-proxy, POST /api/ai-web-research");
  console.log("Variables attendues: BRIMOT_DEEPSEEK_API_KEY, BRIMOT_OPENAI_API_KEY");
});
