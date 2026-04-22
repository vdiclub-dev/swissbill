const openai = require('../config/openai');

const MODEL = 'gpt-4o-mini';
const MAX_CONTENT_CHARS = 4000;
const FETCH_TIMEOUT_MS  = 10000;

// ── Web scraping ───────────────────────────────────────────────

async function fetchSiteContent(url) {
  if (!url) return { text: '', quality: 'faible', reason: 'Aucun site fourni' };

  let normalized = url.trim().replace(/\/$/, '');
  if (!normalized.match(/^https?:\/\//)) normalized = 'https://' + normalized;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(normalized, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; ColixoAnalyzer/1.0; contact@colixo.ch)',
        'Accept':          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return { text: '', quality: 'faible', reason: `HTTP ${res.status}` };

    const html = await res.text();
    const text = extractText(html);

    if (text.length < 80)  return { text, quality: 'faible',  reason: 'Contenu trop court' };
    if (text.length < 600) return { text, quality: 'moyenne', reason: 'Contenu limité' };
    return { text, quality: 'forte', reason: 'Contenu suffisant' };

  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Timeout (>10s)' : `Inaccessible: ${err.message}`;
    return { text: '', quality: 'faible', reason };
  }
}

function extractText(html) {
  const metaDesc = (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i) || []
  )[1] || '';
  const title = (html.match(/<title[^>]*>([^<]{1,120})<\/title>/i) || [])[1] || '';

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();

  const prefix = [title, metaDesc].filter(Boolean).join(' | ');
  return (prefix ? `${prefix}\n\n${cleaned}` : cleaned).substring(0, MAX_CONTENT_CHARS);
}

// ── Enrichissement prospect ────────────────────────────────────

async function enrichProspect(prospect) {
  if (!openai) throw new Error('OpenAI non configuré — clé API manquante');

  const { text: siteText, quality: siteQuality, reason: siteReason } =
    await fetchSiteContent(prospect.site_web);

  const siteBlock = siteText
    ? `CONTENU SITE (qualité: ${siteQuality}):\n${siteText}`
    : `SITE WEB: ${siteReason}`;

  const prompt = `Tu es expert en développement commercial B2B pour Colixo — coursier express premium en Suisse (livraison urgente, tournées B2B, documents sensibles, pièces techniques, service 24/7).

PROSPECT:
- Entreprise: ${prospect.entreprise}
- Ville/Région: ${prospect.ville || 'Non précisé'}
- Secteur: ${prospect.secteur || 'Non précisé'}
- Contact: ${prospect.contact_nom ? `${prospect.contact_nom}${prospect.contact_role ? ', ' + prospect.contact_role : ''}` : 'Inconnu'}
- Notes: ${prospect.notes || 'Aucune'}

${siteBlock}

Retourne un JSON valide avec exactement ces champs:
{
  "resume": "2-3 phrases sur l'activité, le marché et le contexte",
  "besoin_detecte": "besoin logistique B2B concret identifié",
  "angle_commercial": "argument principal pour convaincre ce prospect d'utiliser Colixo",
  "objections_probables": "2-3 objections courantes à anticiper",

  "score_pertinence_secteur": <0-20, secteur compatible livraison express?>,
  "score_besoin_logistique": <0-20, signaux de besoin détectés?>,
  "score_compatibilite_geo": <0-10, dans zone couverte Suisse?>,
  "score_potentiel_volume": <0-20, volume probable de livraisons/mois?>,
  "score_probabilite_reponse": <0-15, probabilité de réponse au 1er contact?>,
  "score_complexite_op": <0-10, facilité de mise en place?>,
  "score_fit_colixo": <0-5, fit global avec l'offre?>,
  "score_total": <somme des 7 sous-scores>,
  "score_classe": <"A" si >=70, "B" si >=45, "C" sinon>,
  "score_reasoning": "1 phrase orientée business expliquant le score",

  "logistic_signals": ["signal1", "signal2"],
  "confidence_score": <0-100, confiance dans l'analyse>,
  "analysis_quality": <"forte"|"moyenne"|"faible">,

  "message_connexion": "message LinkedIn direct (max 120 mots, objectif: obtenir 10 min d'échange, ton direct)",
  "message_connexion_premium": "message LinkedIn raffiné (max 120 mots, même objectif, ton premium)",
  "message_1": "email de prospection (max 180 mots, objet inclus en première ligne)",
  "email_relance": "email de relance si pas de réponse (max 140 mots)",
  "script_appel": "guide script téléphonique (max 200 mots, structure: accroche, valeur, question)"
}

Signaux logistiques: livraison, expédition, stock, entrepôt, commandes, e-commerce, distribution, transport, urgence, intervention, multi-sites, tournées, délais, pièces, B2B récurrent, volume, fenêtres horaires.
Messages: courts, humains, crédibles, sans promesses exagérées, axés sur un échange de 10 minutes.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model:           MODEL,
        messages:        [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature:     0.3,
        max_tokens:      3500,
      });

      const raw    = response.choices[0].message.content;
      const parsed = JSON.parse(raw);

      // Recalcul score côté serveur pour cohérence
      const sub = [
        parsed.score_pertinence_secteur,
        parsed.score_besoin_logistique,
        parsed.score_compatibilite_geo,
        parsed.score_potentiel_volume,
        parsed.score_probabilite_reponse,
        parsed.score_complexite_op,
        parsed.score_fit_colixo,
      ].map(v => Math.max(0, Math.min(Number(v) || 0, 100)));

      parsed.score_total   = Math.min(100, sub.reduce((a, b) => a + b, 0));
      parsed.score_classe  = parsed.score_total >= 70 ? 'A' : parsed.score_total >= 45 ? 'B' : 'C';
      parsed.logistic_signals = Array.isArray(parsed.logistic_signals) ? parsed.logistic_signals : [];

      return parsed;

    } catch (err) {
      if (attempt === 1) throw new Error('Analyse IA échouée après 2 tentatives: ' + err.message);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

// ── Analyse réponse prospect ────────────────────────────────────

async function analyzeReply(prospect, source, rawMessage) {
  if (!openai) throw new Error('OpenAI non configuré');

  const prompt = `Expert prospection B2B pour Colixo (coursier express Suisse).

PROSPECT: ${prospect.entreprise} | ${prospect.secteur || ''} | ${prospect.ville || ''}
SOURCE DU MESSAGE: ${source}
MESSAGE REÇU: "${rawMessage}"

Analyse et retourne JSON:
{
  "objection_type": <"interet"|"pas_maintenant"|"refus_poli"|"objection_prix"|"deja_en_place"|"demande_infos"|"demande_appel"|"absence_besoin"|"redirection_contact"|"autre">,
  "sentiment": <"positif"|"neutre"|"negatif">,
  "buying_signal_level": <0-5>,
  "urgency_level": <0-3>,
  "recommended_channel": <"email"|"telephone"|"linkedin"|"aucun">,
  "next_best_action": "action concrète recommandée en 1 phrase",
  "suggested_reply_short": "réponse directe max 100 mots",
  "suggested_reply_sales": "réponse orientée valeur max 150 mots",
  "suggested_reply_meeting": "réponse orientée RDV max 150 mots"
}`;

  const response = await openai.chat.completions.create({
    model:           MODEL,
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature:     0.3,
    max_tokens:      1500,
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = { enrichProspect, analyzeReply };
