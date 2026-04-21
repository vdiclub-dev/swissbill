const openai = require('../../config/openai');

const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 2000;

// Parse la réponse texte en JSON de façon robuste
function parseJsonResponse(text) {
  // Retire les balises markdown si présentes (```json ... ```)
  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Tentative d'extraction JSON dans le texte
    const match = clean.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Réponse IA non parseable en JSON');
  }
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!openai) throw new Error('OpenAI non configuré (clé API manquante)');

  const response = await openai.responses.create({
    model: MODEL,
    max_output_tokens: MAX_TOKENS,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   }
    ]
  });

  const text = response.output_text;
  if (!text) throw new Error('Réponse vide reçue de l\'API OpenAI');
  return text;
}

// ── Enrichissement prospect ───────────────────────────────────

const ENRICH_SYSTEM = `Tu es un expert en prospection B2B en Suisse romande pour Colixo, service de livraison express.
Tu analyses des entreprises et produis un enrichissement commercial structuré.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`;

async function enrichProspect(data) {
  const userPrompt = `
Entreprise : ${data.entreprise || 'non précisé'}
Ville      : ${data.ville || 'non précisé'}
Secteur    : ${data.secteur || 'non précisé'}
Site web   : ${data.site_web || 'non précisé'}
Contact    : ${data.contact_nom || ''} ${data.contact_role ? '(' + data.contact_role + ')' : ''}
Notes      : ${data.notes || 'aucune'}

Produis un JSON avec exactement ces clés :
{
  "resume": "résumé 2-3 phrases de l'entreprise et de son activité",
  "besoin_detecte": "besoins logistiques probables (livraisons, flux, urgences, zones)",
  "angle_commercial": "angle principal pour Colixo (flexibilité, réactivité, tournées, urgences)",
  "objections_probables": "2-3 objections principales anticipées",
  "score": 0 à 100 (pertinence logistique pour Colixo),
  "score_classe": "A" | "B" | "C",
  "message_connexion": "message de connexion LinkedIn — max 300 caractères, direct, sans bullshit",
  "message_1": "premier message LinkedIn après acceptation — max 500 caractères",
  "relance_1": "relance 7 jours après — max 400 caractères",
  "relance_2": "relance 14 jours après — max 400 caractères",
  "email_1": "email de premier contact — sujet + corps HTML simple, professionnel, max 250 mots",
  "email_relance": "email de relance — sujet + corps HTML, max 150 mots",
  "script_appel": "script d'appel téléphonique — introduction + 3 questions + proposition"
}

Contraintes :
- ton professionnel, direct, pas de promesses invérifiables
- focus Colixo : livraison express J+1, réactivité, flexibilité, suivi temps réel
- objectif = obtenir 10 minutes d'échange
- pas de généralités vides
`;

  const text = await callOpenAI(ENRICH_SYSTEM, userPrompt);
  return parseJsonResponse(text);
}

// ── Assistant de réponse ──────────────────────────────────────

const REPLY_SYSTEM = `Tu es un commercial B2B expert en logistique pour Colixo.
Tu analyses les réponses de prospects et génères des réponses adaptées.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`;

async function analyzeReply(prospectData, rawMessage) {
  const userPrompt = `
Prospect : ${prospectData.entreprise} (${prospectData.secteur || 'secteur inconnu'}, ${prospectData.ville || ''})
Score    : ${prospectData.score || 'N/A'}
Réponse reçue : "${rawMessage}"

Produis un JSON avec exactement ces clés :
{
  "objection_type": "none" | "prix" | "pas_de_besoin" | "deja_prestataire" | "trop_tot" | "refus_poli" | "interet",
  "next_best_action": "action concrète recommandée",
  "suggested_reply_short": "réponse courte 2-3 phrases max — ton naturel, humain",
  "suggested_reply_sales": "réponse commerciale structurée avec proposition de valeur — max 200 mots",
  "suggested_reply_meeting": "proposition de rendez-vous — max 150 mots, concrète avec créneaux",
  "suggested_reply_objection_prix": "réponse si objection prix — réfocus sur valeur",
  "suggested_reply_no_need": "réponse si pas de besoin immédiat — garder le lien",
  "suggested_reply_refus": "réponse polie si refus net — laisser une bonne impression"
}
`;

  const text = await callOpenAI(REPLY_SYSTEM, userPrompt);
  return parseJsonResponse(text);
}

module.exports = { enrichProspect, analyzeReply };
