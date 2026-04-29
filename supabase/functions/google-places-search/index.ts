/**
 * Proxy Google Places Text Search → retourne des prospects formatés.
 * Secret : GOOGLE_PLACES_API_KEY
 * Mode canton : recherche multi-villes + déduplication par place_id
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Villes principales par canton pour couvrir tout le territoire
const CANTON_CITIES: Record<string, string[]> = {
  "vaud":    ["Lausanne","Montreux","Vevey","Nyon","Yverdon-les-Bains","Morges","Aigle","Leysin","Villars-sur-Ollon","Château-d'Oex","Payerne","Orbe"],
  "valais":  ["Sion","Sierre","Martigny","Monthey","Verbier","Zermatt","Saas-Fee","Crans-Montana","Leukerbad","Nendaz"],
  "geneve":  ["Genève","Carouge","Meyrin","Vernier","Lancy","Onex","Thônex"],
  "fribourg":["Fribourg","Bulle","Romont","Châtel-Saint-Denis","Morat"],
  "berne":   ["Berne","Interlaken","Thoune","Biel","Grindelwald","Wengen","Gstaad"],
  "zurich":  ["Zürich","Winterthur","Uster","Küsnacht","Rapperswil"],
  "neuchatel":["Neuchâtel","La Chaux-de-Fonds","Le Locle","Yverdon"],
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
  } catch { return ""; }
}

function extractCity(address: string): string {
  const parts = address.split(",").map((p) => p.trim());
  const cityPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return cityPart.replace(/^\d{4}\s+/, "").trim();
}

async function fetchPage(params: URLSearchParams): Promise<{ results: unknown[]; next_page_token?: string }> {
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  if (!res.ok) return { results: [] };
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return { results: [] };
  return { results: data.results ?? [], next_page_token: data.next_page_token };
}

async function searchCity(keyword: string, city: string, apiKey: string): Promise<unknown[]> {
  const params = new URLSearchParams({
    query: `${keyword} ${city} Suisse`,
    key: apiKey,
    language: "fr",
    region: "ch",
  });
  const p1 = await fetchPage(params);
  const results = [...p1.results];
  if (p1.next_page_token) {
    await new Promise((r) => setTimeout(r, 2000));
    const p2 = await fetchPage(new URLSearchParams({ pagetoken: p1.next_page_token, key: apiKey }));
    results.push(...p2.results);
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();
  if (!apiKey) return json({ error: "GOOGLE_PLACES_API_KEY manquant" }, 503);

  let body: { keyword?: string; location?: string; limit?: number };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const limit    = Math.min(body.limit ?? 20, 300);
  const keyword  = (body.keyword || "").trim();
  const location = (body.location || "").trim();

  if (!keyword) return json({ error: "keyword requis" }, 400);

  // Détecter si la région est un canton connu
  const cantonKey = location.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  const cities = CANTON_CITIES[cantonKey];

  let allPlaces: unknown[] = [];

  if (cities) {
    // Mode canton : recherche par ville en séquentiel (évite rate limit Google)
    for (const city of cities) {
      const results = await searchCity(keyword, city, apiKey);
      allPlaces.push(...results);
      if (allPlaces.length >= limit * 2) break;
    }
  } else {
    // Mode ville/région normal avec pagination
    const textQuery = [keyword, location, "Suisse"].filter(Boolean).join(" ");
    const baseParams = new URLSearchParams({ query: textQuery, key: apiKey, language: "fr", region: "ch" });
    const p1 = await fetchPage(baseParams);
    allPlaces.push(...p1.results);
    if (allPlaces.length < limit && p1.next_page_token) {
      await new Promise((r) => setTimeout(r, 2000));
      const p2 = await fetchPage(new URLSearchParams({ pagetoken: p1.next_page_token, key: apiKey }));
      allPlaces.push(...p2.results);
      if (allPlaces.length < limit && p2.next_page_token) {
        await new Promise((r) => setTimeout(r, 2000));
        const p3 = await fetchPage(new URLSearchParams({ pagetoken: p2.next_page_token, key: apiKey }));
        allPlaces.push(...p3.results);
      }
    }
  }

  // Déduplication par place_id
  const seen = new Set<string>();
  const unique = allPlaces.filter((p) => {
    const id = (p as Record<string, unknown>).place_id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }) as Record<string, unknown>[];

  const places = unique
    .filter((p) => p.business_status !== "CLOSED_PERMANENTLY")
    .slice(0, limit);

  // Récupérer website + téléphone via Place Details en parallèle
  const details = await Promise.all(
    places.map(async (p) => {
      try {
        const dp = new URLSearchParams({
          place_id: p.place_id as string,
          fields: "website,formatted_phone_number",
          key: apiKey,
          language: "fr",
        });
        const dr = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${dp}`,
          { signal: AbortSignal.timeout(6000) });
        if (!dr.ok) return {};
        const dd = await dr.json();
        return dd.result ?? {};
      } catch { return {}; }
    })
  );

  const prospects = places.map((p, i) => {
    const nom     = (p.name as string) ?? "";
    const address = (p.formatted_address as string) ?? "";
    const site    = ((details[i]?.website as string) ?? "").replace(/\/$/, "");
    const email   = site ? domainEmail(site) : "";
    const ville   = address ? extractCity(address) : "";
    const types   = (p.types as string[]) ?? [];
    const secteur = types[0]?.replace(/_/g, " ") ?? "";
    const tel     = (details[i]?.formatted_phone_number as string) ?? "";
    return { nom, email, site, secteur, ville, tel, adresse: address };
  }).filter((p) => p.nom);

  return json({ prospects, total: unique.length });
});
