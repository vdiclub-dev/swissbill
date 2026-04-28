/**
 * Proxy Google Places Text Search → retourne des prospects formatés.
 * Secret : GOOGLE_PLACES_API_KEY
 * Pagination : jusqu'à 3 pages × 20 = 60 résultats max
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();
  if (!apiKey) return json({ error: "GOOGLE_PLACES_API_KEY manquant" }, 503);

  let body: { keyword?: string; location?: string; limit?: number };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const limit    = Math.min(body.limit ?? 20, 60);
  const keyword  = (body.keyword || "").trim();
  const location = (body.location || "").trim();

  if (!keyword) return json({ error: "keyword requis" }, 400);

  const textQuery = [keyword, location, "Suisse"].filter(Boolean).join(" ");

  // Récupérer jusqu'à 3 pages pour atteindre la limite demandée
  const allPlaces: unknown[] = [];
  const baseParams = new URLSearchParams({ query: textQuery, key: apiKey, language: "fr", region: "ch" });

  const page1 = await fetchPage(baseParams);
  allPlaces.push(...page1.results);

  if (allPlaces.length < limit && page1.next_page_token) {
    await new Promise((r) => setTimeout(r, 2000)); // délai requis par Google
    const page2 = await fetchPage(new URLSearchParams({ pagetoken: page1.next_page_token, key: apiKey }));
    allPlaces.push(...page2.results);

    if (allPlaces.length < limit && page2.next_page_token) {
      await new Promise((r) => setTimeout(r, 2000));
      const page3 = await fetchPage(new URLSearchParams({ pagetoken: page2.next_page_token, key: apiKey }));
      allPlaces.push(...page3.results);
    }
  }

  const places = allPlaces.slice(0, limit) as Record<string, unknown>[];

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

  const prospects = places
    .filter((p) => p.business_status !== "CLOSED_PERMANENTLY")
    .map((p, i) => {
      const nom     = (p.name as string) ?? "";
      const address = (p.formatted_address as string) ?? "";
      const site    = ((details[i]?.website as string) ?? "").replace(/\/$/, "");
      const email   = site ? domainEmail(site) : "";
      const ville   = address ? extractCity(address) : "";
      const types   = (p.types as string[]) ?? [];
      const secteur = types[0]?.replace(/_/g, " ") ?? "";
      const tel     = (details[i]?.formatted_phone_number as string) ?? "";
      return { nom, email, site, secteur, ville, tel, adresse: address };
    })
    .filter((p) => p.nom);

  return json({ prospects, total: allPlaces.length });
});
