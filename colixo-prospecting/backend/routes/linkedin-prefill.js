const router  = require('express').Router();
const { fetchSiteContent, extractWithAI } = require('../services/openai.service');

const FETCH_TIMEOUT_MS = 5000;

// ── parseLinkedInUrl ──────────────────────────────────────────────────────────
// Extrait type + slug depuis une URL LinkedIn

function parseLinkedInUrl(raw) {
  try {
    let url = raw.trim();
    if (!url.match(/^https?:\/\//)) url = 'https://' + url;
    const u    = new URL(url);
    const path = u.pathname.replace(/\/$/, '');

    const personMatch  = path.match(/^\/in\/([^/]+)/);
    const companyMatch = path.match(/^\/company\/([^/]+)/);

    function slugToWords(slug) {
      return slug.split('-')
        .filter(p => p.length > 0)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }

    if (personMatch) {
      return { type: 'person', slug: personMatch[1], name: slugToWords(personMatch[1]) };
    }
    if (companyMatch) {
      return { type: 'company', slug: companyMatch[1], name: slugToWords(companyMatch[1]) };
    }
    return null;
  } catch { return null; }
}

// ── guessWebsite ──────────────────────────────────────────────────────────────
// Tente de deviner l'URL du site depuis le nom d'entreprise

async function guessWebsite(name) {
  if (!name) return null;

  const slug = name.toLowerCase()
    .replace(/\s+(sa|sarl|gmbh|ag|sàrl|srl|ltd|inc|llc|ch)\s*$/i, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const candidates = [
    `https://${slug}.ch`,
    `https://www.${slug}.ch`,
    `https://${slug}.com`,
    `https://www.${slug}.com`,
  ];

  for (const url of candidates) {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res   = await fetch(url, {
        method:  'HEAD',
        signal:  ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ColixoAnalyzer/1.0; contact@colixo.ch)' },
        redirect: 'follow',
      });
      clearTimeout(timer);
      if (res.ok || res.status === 405 || res.status === 403) return url;
    } catch { /* essai suivant */ }
  }
  return null;
}

// ── POST /api/linkedin-prefill ────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { linkedin_url } = req.body;
  if (!linkedin_url) return res.status(400).json({ ok: false, error: 'URL manquante' });

  const parsed = parseLinkedInUrl(linkedin_url);
  if (!parsed) return res.status(400).json({ ok: false, error: 'URL LinkedIn invalide' });

  const result = {
    contact_nom: parsed.type === 'person'  ? parsed.name : null,
    entreprise:  parsed.type === 'company' ? parsed.name : null,
    site_web:    null,
    secteur:     null,
    ville:       null,
    contact_role: null,
  };

  // Deviner le site web depuis le nom (person → dernier mot du slug, company → nom complet)
  const nameForSite = parsed.type === 'company'
    ? parsed.name
    : parsed.slug.split('-').slice(-2).join('-'); // derniers mots souvent = entreprise

  const website = await guessWebsite(nameForSite);

  if (website) {
    result.site_web = website;

    const { text } = await fetchSiteContent(website);

    if (text) {
      const extracted = await extractWithAI(text, parsed);
      if (extracted) {
        if (extracted.entreprise  && !result.entreprise)  result.entreprise  = extracted.entreprise;
        if (extracted.secteur)                             result.secteur     = extracted.secteur;
        if (extracted.ville)                               result.ville       = extracted.ville;
        if (extracted.contact_role)                        result.contact_role = extracted.contact_role;
      }
    }
  }

  res.json({
    ok:     true,
    data:   result,
    source: website ? 'site_web+ia' : 'url_slug',
  });
});

module.exports = router;
