/**
 * Proxy Google Places Text Search → retourne des prospects formatés.
 * Secret : GOOGLE_PLACES_API_KEY
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

function extractCity(address: string): string {
  // Format CH : "Rue des Alpes 1, 1950 Sion, Suisse"
  const parts = address.split(",").map((p) => p.trim());
  // Avant-dernier élément = "NPA Ville", retirer le NPA
  const cityPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return cityPart.replace(/^\d{4}\s+/, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();
  if (!apiKey) return json({ error: "GOOGLE_PLACES_API_KEY manquant" }, 503);

  let body: { keyword?: string; location?: string; limit?: number };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const limit    = Math.min(body.limit ?? 20, 20); // Places API max 20 par requête
  const keyword  = (body.keyword || "").trim();
  const location = (body.location || "").trim();

  if (!keyword) return json({ error: "keyword requis" }, 400);

  // Construire la requête texte : "vigneron Valais Suisse"
  const textQuery = [keyword, location, "Suisse"].filter(Boolean).join(" ");

  const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.displayName",
        "places.formattedAddress",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.businessStatus",
        "places.primaryType",
        "places.types",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "fr",
      regionCode: "CH",
      maxResultCount: limit,
    }),
  });

  if (!placesRes.ok) {
    const err = await placesRes.text();
    return json({ error: "Google Places error", detail: err, prospects: [] }, 502);
  }

  const data = await placesRes.json();
  const places = data.places ?? [];

  const prospects = places
    .filter((p: Record<string, unknown>) => p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p: Record<string, unknown>) => {
      const nom     = (p.displayName as Record<string, string>)?.text ?? "";
      const address = (p.formattedAddress as string) ?? "";
      const site    = (p.websiteUri as string)?.replace(/\/$/, "") ?? "";
      const email   = site ? domainEmail(site) : "";
      const ville   = address ? extractCity(address) : "";
      const tel     = (p.nationalPhoneNumber as string) ?? "";
      const type    = (p.primaryType as string) ?? ((p.types as string[])?.[0] ?? "");
      const secteur = type.replace(/_/g, " ");
      return { nom, email, site, secteur, ville, tel, adresse: address };
    })
    .filter((p: { nom: string }) => p.nom);

  return json({ prospects, total: places.length });
});
