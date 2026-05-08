function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return "unknown";
}

function getUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function getNextUtcMidnightIso(now) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ));
  return next.toISOString();
}

function getRetryAfterSeconds(now) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ));
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function getStore() {
  if (!globalThis.__brimotDailyLimiter) {
    globalThis.__brimotDailyLimiter = {
      dayKey: "",
      counts: new Map()
    };
  }
  return globalThis.__brimotDailyLimiter;
}

function envKeyForNamespace(namespace) {
  return "BRIMOT_" + String(namespace || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_") + "_DAILY_LIMIT";
}

function resolveDailyLimit(namespace) {
  const nsKey = envKeyForNamespace(namespace);
  const nsRaw = Number(process.env[nsKey]);
  if (Number.isFinite(nsRaw)) {
    const nsLimit = Math.max(0, Math.floor(nsRaw));
    return namespace === "mail" ? Math.min(50, nsLimit) : nsLimit;
  }

  const fallbackRaw = Number(process.env.BRIMOT_DAILY_LIMIT || 100);
  const fallbackLimit = Number.isFinite(fallbackRaw) ? Math.max(0, Math.floor(fallbackRaw)) : 100;
  return namespace === "mail" ? Math.min(50, fallbackLimit) : fallbackLimit;
}

function takeDailyQuota(req, namespace) {
  const limit = resolveDailyLimit(namespace);

  const now = new Date();
  const dayKey = getUtcDayKey(now);
  const store = getStore();

  if (store.dayKey !== dayKey) {
    store.dayKey = dayKey;
    store.counts.clear();
  }

  const ip = getClientIp(req);
  const key = namespace + ":" + ip;
  const used = store.counts.get(key) || 0;

  if (limit > 0 && used >= limit) {
    return {
      allowed: false,
      limit,
      used,
      remaining: 0,
      retryAfterSeconds: getRetryAfterSeconds(now),
      resetAt: getNextUtcMidnightIso(now)
    };
  }

  const nextUsed = used + 1;
  store.counts.set(key, nextUsed);

  return {
    allowed: true,
    limit,
    used: nextUsed,
    remaining: limit > 0 ? Math.max(0, limit - nextUsed) : -1,
    retryAfterSeconds: getRetryAfterSeconds(now),
    resetAt: getNextUtcMidnightIso(now)
  };
}

module.exports = {
  takeDailyQuota
};