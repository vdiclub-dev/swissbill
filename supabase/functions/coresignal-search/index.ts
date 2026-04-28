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

  let body: { industry?: string; location?: string; size?: string; limit?: number; keyword?: string; returnLimit?: number };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const limit       = Math.min(body.limit ?? 20, 200);
  const returnLimit = Math.min(body.returnLimit ?? limit, 50);
  const keyword     = body.keyword?.trim() || "";

  let ids: number[] = [];

  if (keyword) {
    // Recherche Elasticsearch sur le nom de l'entreprise + pays
    // Idéal pour les mots-clés français dans les noms : vigneron, cave, domaine…
    const esQuery = {
      query: {
        bool: {
          must: [
            { match: { name: keyword } },
            { term:  { country: "Switzerland" } },
          ],
        },
      },
      size: Math.min(limit * 3, 100),
    };

    const esRes = await fetch("https://api.coresignal.com/cdapi/v1/company/search/es", {
      method: "POST",
      headers: { "apikey": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(esQuery),
    });

    const esRaw = await esRes.text();
    if (!esRes.ok) {
      // ES endpoint indisponible → fallback: filtre sans industrie + post-filtrage texte
      console.log("ES endpoint error, fallback to filter. Status:", esRes.status, esRaw.slice(0, 200));
      const fallbackRes = await fetch("https://api.coresignal.com/cdapi/v2/company_base/search/filter", {
        method: "POST",
        headers: { "apikey": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ country: "Switzerland" }),
      });
      if (!fallbackRes.ok) {
        const err = await fallbackRes.text();
        return json({ error: "CoreSignal error", detail: err, prospects: [], total_ids: 0 }, 502);
      }
      const fallbackIds = await fallbackRes.json();
      ids = Array.isArray(fallbackIds) ? fallbackIds : [];
    } else {
      let esData: unknown;
      try { esData = JSON.parse(esRaw); } catch { esData = null; }
      // L'endpoint ES retourne soit un tableau d'IDs, soit { hits: { hits: [...] } }
      if (Array.isArray(esData)) {
        ids = esData as number[];
      } else if (Array.isArray((esData as Record<string, unknown>)?.hits?.hits)) {
        const hits = ((esData as Record<string, unknown>).hits as Record<string, unknown>).hits as Record<string, unknown>[];
        ids = hits.map((h) => Number((h._source as Record<string, unknown>)?.id ?? h._id)).filter((n) => !isNaN(n));
      } else {
        // Format inattendu — retourner le détail pour diagnostiquer
        return json({ error: "Réponse ES format inconnu", detail: esRaw.slice(0, 400), prospects: [], total_ids: 0 }, 502);
      }
    }

  } else {
    // Recherche filtrée classique (secteur / région)
    const filters: Record<string, string> = { country: "Switzerland" };
    if (body.industry) filters.industry = body.industry;
    if (body.location) filters.location = body.location;
    if (body.size)     filters.size     = body.size;

    const filterRes = await fetch("https://api.coresignal.com/cdapi/v2/company_base/search/filter", {
      method: "POST",
      headers: { "apikey": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(filters),
    });

    if (!filterRes.ok) {
      const err = await filterRes.text();
      return json({ error: "CoreSignal search error", detail: err, prospects: [], total_ids: 0 }, 502);
    }

    const rawIds = await filterRes.json();
    if (!Array.isArray(rawIds)) {
      return json({ error: "Réponse CoreSignal inattendue", detail: JSON.stringify(rawIds).slice(0, 300), prospects: [], total_ids: 0 }, 502);
    }
    ids = rawIds;
  }

  if (ids.length === 0) return json({ prospects: [], total_ids: 0 });

  const fetchSize = Math.min(ids.length, limit);
  const slice = ids.slice(0, fetchSize);
  const kwLower = keyword.toLowerCase();

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

        // Post-filtrage texte sur le mot-clé (nom, description, secteur)
        if (kwLower) {
          const haystack = [c.name, c.description, c.industry, c.tagline, c.specialties]
            .filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(kwLower)) return null;
        }

        const website = (c.website || "").trim();
        const email   = website ? domainEmail(website) : "";
        const ville   = (c.headquarters_new_address || c.headquarters_country_parsed || "Suisse").split(",")[0].trim();

        return { nom: c.name, email, site: website, secteur: c.industry || "", ville, taille: c.size || "", employes: c.employees_count || 0 };
      } catch {
        return null;
      }
    })
  );

  const prospects = results.filter(Boolean).slice(0, returnLimit);
  return json({ prospects, total_ids: ids.length });
});
