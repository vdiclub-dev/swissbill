/**
 * Proxy CoreSignal company search → retourne des prospects formatés.
 * Secrets : CORESIGNAL_API_KEY
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

function domainEmail(website: string): string {
  try {
    const url = new URL(website.startsWith("http") ? website : "https://" + website);
    return "info@" + url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);

  const apiKey = Deno.env.get("CORESIGNAL_API_KEY")?.trim();
  if (!apiKey) return json({ error: "CORESIGNAL_API_KEY manquant" }, 503);

  let body: { industry?: string; location?: string; size?: string; limit?: number };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const limit = Math.min(body.limit ?? 20, 50);

  // 1. Recherche → liste d'IDs
  const filters: Record<string, string> = { country: "Switzerland" };
  if (body.industry) filters.industry = body.industry;
  if (body.location) filters.location = body.location;
  if (body.size)     filters.size     = body.size;

  const searchRes = await fetch("https://api.coresignal.com/cdapi/v2/company_base/search/filter", {
    method: "POST",
    headers: { "apikey": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(filters),
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    return json({ error: "CoreSignal search error", detail: err }, 502);
  }

  const ids: number[] = await searchRes.json();
  if (!Array.isArray(ids) || ids.length === 0) return json({ prospects: [] });

  // 2. Récupérer les détails en parallèle pour les N premiers IDs
  const slice = ids.slice(0, limit);

  const results = await Promise.all(
    slice.map(async (id) => {
      try {
        const r = await fetch(`https://api.coresignal.com/cdapi/v2/company_base/collect/${id}`, {
          headers: { "apikey": apiKey },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return null;
        const c = await r.json();
        if (c.deleted || !c.name) return null;

        const website = (c.website || "").trim();
        const email   = website ? domainEmail(website) : "";
        const ville   = (c.headquarters_new_address || c.headquarters_country_parsed || "Suisse").split(",")[0].trim();

        return { nom: c.name, email, site: website, secteur: c.industry || "", ville, taille: c.size || "", employes: c.employees_count || 0 };
      } catch {
        return null;
      }
    })
  );

  const prospects = results.filter(Boolean);
  return json({ prospects, total_ids: ids.length });
});
