/* ============================================================
   COLIXO PROSPECTING SYSTEM — Frontend SPA
   ============================================================ */

// ── Configuration ─────────────────────────────────────────────
const API_BASE = 'https://swissbill.onrender.com/api';

// Mode démo : true = pas besoin de backend, données fictives
// Sera basculé automatiquement à true si le backend ne répond pas
let DEMO_MODE = false;

// Timeout des appels API (ms) — 60s pour absorber le cold start Render (~50s)
const API_TIMEOUT = 60000;

// ── State ─────────────────────────────────────────────────────
const state = {
  currentView: 'dashboard',
  currentProspectId: null,
  prospects: [],
  stats: null
};

// ── Demo data ──────────────────────────────────────────────────
const DEMO_PROSPECTS = [
  {
    id: 'demo-1', entreprise: 'Medi-Supply SA', ville: 'Lausanne',
    secteur: 'Médical / Pharmacie', site_web: 'https://medi-supply.ch',
    contact_nom: 'Sandra Morel', contact_role: 'Responsable logistique',
    linkedin_url: '', email: 'smorel@medi-supply.ch', telephone: '+41 21 555 01 20',
    notes: 'Livraisons urgentes de matériel médical. Actuellement avec DPD.',
    resume: 'Distributeur régional de consommables médicaux en Suisse romande. Gère environ 200 livraisons/mois vers cliniques et cabinets médicaux.',
    besoin_detecte: 'Livraisons express pour matériel médical urgent, traçabilité stricte, fiabilité J+1 impérative. Fenêtres de livraison contraintes (heures ouverture cliniques).',
    angle_commercial: 'Fiabilité et réactivité sur les urgences médicales. Colixo peut proposer des créneaux dédiés et un suivi temps réel avec confirmation de livraison.',
    objections_probables: '1. Contrat en cours avec DPD. 2. Prix potentiellement plus élevé. 3. Capacité à couvrir tout le canton de Vaud.',
    score: 88, score_classe: 'A',
    message_connexion: 'Bonjour,\n\nJe représente Colixo, service de livraison express en Suisse romande. Nous accompagnons plusieurs acteurs du secteur médical avec des livraisons J+1 et un suivi en temps réel. Seriez-vous disponible pour un bref échange cette semaine ?\n\nCordialement',
    email_1: 'Objet: Livraison express médicale — Colixo pour Medi-Supply\n\nBonjour Madame,\n\nNous accompagnons plusieurs distributeurs médicaux en Suisse romande avec des livraisons J+1 garanties et un suivi en temps réel. Seriez-vous disponible 10 minutes cette semaine pour évaluer si notre offre correspond à vos besoins ?\n\nCordialement,\nL\'équipe Colixo',
    script_appel: 'Introduction: "Bonjour, je vous contacte de chez Colixo, nous sommes spécialisés dans la livraison express en Suisse romande. Avez-vous quelques minutes ?"\nQuestion 1: "Quel est votre volume de livraisons mensuel actuellement ?"\nQuestion 2: "Avez-vous des contraintes particulières sur les délais ou les horaires de livraison ?"\nProposition: "Nous pourrions vous proposer un essai sur 5 livraisons, sans engagement."',
    statut: 'pret_a_contacter', score_pertinence_secteur:18,score_besoin_logistique:17,score_compatibilite_geo:9,score_potentiel_volume:16,score_probabilite_reponse:13,score_complexite_op:8,score_fit_colixo:5, analysis_quality:'forte', logistic_signals:['livraison','urgence','cliniques','traçabilité'], created_at: '2026-04-10T09:15:00Z', updated_at: '2026-04-18T14:30:00Z'
  },
  {
    id: 'demo-2', entreprise: 'TechParts Romandie', ville: 'Genève',
    secteur: 'Industrie / Pièces détachées', site_web: 'https://techparts.ch',
    contact_nom: 'Marc Favre', contact_role: 'Directeur opérations',
    linkedin_url: 'https://linkedin.com/in/marcfavre-techparts',
    email: 'marc.favre@techparts.ch', telephone: '+41 22 888 44 00',
    notes: 'Pièces de remplacement pour machines industrielles. Urgences fréquentes.',
    resume: 'Distributeur de pièces détachées industrielles couvrant la Suisse romande et le nord de la France. 150+ références en stock.',
    besoin_detecte: 'Livraisons urgentes de pièces critiques (machines en panne = arrêt production). Fenêtres très courtes, besoin de priorisation possible.',
    angle_commercial: 'Proposition de valeur claire : chaque heure d\'arrêt machine coûte cher. Colixo peut livrer en urgence avant 12h ou en soirée.',
    objections_probables: '1. Ont peut-être déjà une solution interne. 2. Volume insuffisant pour négocier. 3. Couverture géographique.',
    score: 82, score_classe: 'A',
    message_connexion: 'Bonjour,\n\nJe représente Colixo, service de livraison express en Suisse romande. Nous accompagnons des distributeurs de pièces industrielles avec des livraisons urgentes en dehors des heures ouvrées. Seriez-vous disponible pour un bref échange ?\n\nCordialement',
    email_1: 'Objet: Livraisons urgentes pièces détachées — Colixo\n\nBonjour Monsieur,\n\nColixo accompagne des distributeurs industriels avec des livraisons express, y compris en soirée et le samedi. Seriez-vous disponible 10 minutes cette semaine pour évaluer si notre offre répond à vos contraintes ?\n\nCordialement,\nL\'équipe Colixo',
    script_appel: 'Introduction: "Bonjour, je vous contacte de chez Colixo, service de livraison express industrielle en Suisse romande. Avez-vous quelques minutes ?"\nQuestion 1: "Quelle est votre fréquence de livraisons urgentes par mois ?"\nQuestion 2: "Faites-vous appel à un prestataire dédié ou traitez-vous ces urgences au cas par cas ?"\nProposition: "Nous proposons un tarif dédié pour les urgences industrielles avec une prise en charge en 2h."',
    statut: 'contacte', analysis_quality:'forte', logistic_signals:['urgence','pièces','industrie','B2B'], created_at: '2026-04-08T11:00:00Z', updated_at: '2026-04-17T10:00:00Z'
  },
  {
    id: 'demo-3', entreprise: 'Bio Marché Vevey', ville: 'Vevey',
    secteur: 'Alimentation / Bio', site_web: 'https://biomarche-vevey.ch',
    contact_nom: 'Claire Tissot', contact_role: 'Gérante',
    linkedin_url: '', email: '', telephone: '+41 21 922 33 44',
    notes: 'Épicerie bio avec livraisons à domicile locale. Pas de site e-com pour l\'instant.',
    resume: 'Épicerie bio indépendante à Vevey avec service de livraison à domicile artisanal. Gère actuellement les livraisons avec un vélo-cargo.',
    besoin_detecte: 'Volume faible actuellement, mais potentiel si croissance. Besoin de fiabilité pour des commandes programmées.',
    angle_commercial: 'Croissance du panier moyen, extension zone de livraison, gain de temps pour la gérante.',
    objections_probables: '1. Volume trop faible. 2. Budget serré. 3. Relation locale privilégiée.',
    score: 42, score_classe: 'C',
    message_connexion: '', email_1: '', script_appel: '',
    statut: 'nouveau', created_at: '2026-04-15T16:00:00Z', updated_at: '2026-04-15T16:00:00Z'
  },
  {
    id: 'demo-4', entreprise: 'Horlogerie Bouvet & Fils', ville: 'La Chaux-de-Fonds',
    secteur: 'Horlogerie / Luxe', site_web: 'https://bouvet-horlogerie.ch',
    contact_nom: 'Pierre Bouvet', contact_role: 'Associé',
    linkedin_url: 'https://linkedin.com/in/pierrebouvet',
    email: 'p.bouvet@bouvet-horlogerie.ch', telephone: '+41 32 910 55 00',
    notes: 'Sous-traitant pour grandes maisons. Envois vers ateliers et retailers.',
    resume: 'Manufacture horlogère familiale, sous-traitant pour plusieurs grandes maisons suisses. Envois réguliers de pièces et montres finies en Suisse et Europe.',
    besoin_detecte: 'Livraisons sécurisées de produits haute valeur, confidentialité, emballages spéciaux, assurance élevée.',
    angle_commercial: 'Sécurité, discrétion, traçabilité complète. Colixo peut proposer des livraisons avec remise en main propre et photo de confirmation.',
    objections_probables: '1. Nécessite assurance haute valeur. 2. Prestataire historique (probablement DHL ou FedEx). 3. Exigences de sécurité très élevées.',
    score: 74, score_classe: 'B',
    message_connexion: 'Bonjour,\n\nJe représente Colixo, service de livraison express en Suisse romande. Nous proposons des livraisons sécurisées avec traçabilité complète et remise en main propre, adaptées aux exigences du secteur horloger. Seriez-vous disponible pour un bref échange ?\n\nCordialement',
    email_1: 'Objet: Livraisons sécurisées horlogerie — Colixo\n\nBonjour Monsieur,\n\nNous accompagnons des acteurs du secteur horloger avec des livraisons à haute valeur ajoutée : traçabilité complète, remise en main propre et confirmation photo. Seriez-vous disponible 10 minutes cette semaine pour en discuter ?\n\nCordialement,\nL\'équipe Colixo',
    script_appel: 'Introduction: "Colixo, spécialisé dans les livraisons sécurisées en Suisse romande."\nQuestion 1: "Combien d\'envois réalisez-vous par mois vers des ateliers ou retailers ?"\nQuestion 2: "Avez-vous des exigences d\'assurance particulières ?"\nProposition: "Livraisons assurées jusqu\'à CHF 50\'000, avec traçabilité complète."',
    statut: 'repondu', created_at: '2026-04-05T08:00:00Z', updated_at: '2026-04-20T09:00:00Z'
  },
  {
    id: 'demo-5', entreprise: 'FreshBox Suisse', ville: 'Lausanne',
    secteur: 'E-commerce / Alimentaire', site_web: 'https://freshbox.ch',
    contact_nom: 'Aurélie Schneider', contact_role: 'CEO',
    linkedin_url: 'https://linkedin.com/in/aurelieschneider',
    email: 'aurelie@freshbox.ch', telephone: '+41 78 444 55 66',
    notes: 'Box repas en abonnement. Livraisons hebdomadaires. En forte croissance.',
    resume: 'Startup e-commerce de box repas en abonnement hebdomadaire. 800 abonnés actifs, objectif 2000 d\'ici fin 2026. Livraisons le jeudi et vendredi.',
    besoin_detecte: 'Fiabilité absolue sur J+1 jeudi/vendredi, gestion des retours, volume croissant, tarifs scalables.',
    angle_commercial: 'Partenaire de croissance : Colixo peut absorber la montée en volume et garantir les créneaux critiques du jeudi-vendredi.',
    objections_probables: '1. Déjà avec un prestataire. 2. Tarif au volume. 3. Contraintes de fraîcheur.',
    score: 91, score_classe: 'A',
    message_connexion: 'Bonjour,\n\nJe représente Colixo, service de livraison express en Suisse romande. Nous accompagnons des e-commerçants en croissance avec des livraisons J+1 fiables et des tarifs adaptés au volume. Seriez-vous disponible pour un échange cette semaine ?\n\nCordialement',
    email_1: 'Objet: Partenaire logistique pour FreshBox — Colixo\n\nBonjour Madame,\n\nColixo accompagne des acteurs de la box alimentaire en croissance avec des livraisons J+1 fiables et des tarifs progressifs selon le volume. Seriez-vous disponible 10 minutes cette semaine pour évaluer si notre offre correspond à vos besoins ?\n\nCordialement,\nL\'équipe Colixo',
    script_appel: 'Introduction: "Colixo, partenaire logistique pour les e-commerçants en croissance."\nQuestion 1: "Votre volume de livraisons actuelles par semaine ?"\nQuestion 2: "Avez-vous des incidents récents avec votre prestataire actuel ?"\nProposition: "Garantie de livraison J+1 avec pénalités contractuelles."',
    statut: 'rdv_planifie', analysis_quality:'forte', logistic_signals:['e-commerce','abonnement','volume','croissance','livraison hebdomadaire'], created_at: '2026-04-02T10:00:00Z', updated_at: '2026-04-21T08:00:00Z'
  },
  {
    id: 'demo-6', entreprise: 'Clinique Beaumont', ville: 'Nyon',
    secteur: 'Médical / Clinique', site_web: 'https://clinique-beaumont.ch',
    contact_nom: 'Dr. Luc Martin', contact_role: 'Directeur administratif',
    linkedin_url: '', email: 'lmartin@clinique-beaumont.ch', telephone: '+41 22 365 00 10',
    notes: 'Clinique privée. Approvisionnement en consommables et médicaments.',
    resume: 'Clinique privée de 80 lits à Nyon. Gère ses propres approvisionnements en consommables médicaux et médicaments non urgents.',
    besoin_detecte: 'Livraisons programmées de consommables, réactivité sur les réapprovisionnements d\'urgence.',
    angle_commercial: 'Fiabilité et créneaux dédiés en matinée. Colixo peut être le partenaire préférentiel pour les urgences.',
    objections_probables: '1. Appels d\'offres obligatoires. 2. Contrats cadres existants.',
    score: 67, score_classe: 'B',
    message_connexion: 'Bonjour,\n\nJe représente Colixo, service de livraison express en Suisse romande. Nous livrons du matériel médical avec réactivité et traçabilité. Seriez-vous disponible pour un bref échange ?\n\nCordialement',
    email_1: '', script_appel: '',
    statut: 'contacte', created_at: '2026-04-12T14:00:00Z', updated_at: '2026-04-19T11:00:00Z'
  }
];

const DEMO_STATS = {
  total: 6, chauds: 3, relances: 0, rdv: 2,
  tauxReponse: 67, tauxConversion: 40,
  bySecteur: {
    'Médical / Pharmacie': 1, 'Industrie / Pièces détachées': 1,
    'Alimentation / Bio': 1, 'Horlogerie / Luxe': 1,
    'E-commerce / Alimentaire': 1, 'Médical / Clinique': 1
  },
  byStatut: {
    'a_contacter': 1, 'pret_a_contacter': 1, 'contact_envoye': 1,
    'repondu': 1, 'en_attente': 1, 'rdv': 1
  }
};

// ── API layer ──────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Le serveur ne répond pas (timeout)');
    throw new Error('Impossible de joindre le serveur');
  }
}

async function apiFetch(path, options = {}) {
  if (DEMO_MODE) return null;
  try {
    const res = await fetchWithTimeout(API_BASE + path, options);
    let json;
    try { json = await res.json(); } catch { throw new Error('Réponse invalide du serveur'); }

    // Doublon détecté (409)
    if (res.status === 409 && json.duplicate) {
      const dup = json.duplicate;
      const err = new Error(`Doublon: "${dup.entreprise}" existe déjà (${dup.statut ? statutLabel(dup.statut) : ''}) — vérifié sur ${json.matchedOn}`);
      err.isDuplicate = true;
      err.duplicate   = dup;
      throw err;
    }

    if (!json.ok) throw new Error(json.error || (json.errors && json.errors.join(', ')) || 'Erreur serveur');
    return json.data;
  } catch (err) {
    if (!DEMO_MODE && (err.message.includes('timeout') || err.message.includes('joindre') || err.message.includes('fetch'))) {
      DEMO_MODE = true;
      document.getElementById('demoBanner').style.display = 'block';
      document.getElementById('demoBanner').innerHTML = '<strong>⚠️ Backend inaccessible</strong> Mode démo activé.';
      toast('Backend inaccessible — mode démo activé', 'warning', 5000);
      return null;
    }
    throw err;
  }
}

const api = {
  async get(path) {
    if (DEMO_MODE) return demoGet(path);
    const data = await apiFetch(path);
    if (DEMO_MODE) return demoGet(path); // re-check après éventuel basculement
    return data;
  },

  async post(path, body) {
    if (DEMO_MODE) return demoPost(path, body);
    const data = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (DEMO_MODE) return demoPost(path, body);
    return data;
  },

  async put(path, body) {
    if (DEMO_MODE) return demoPost(path, body, 'put');
    const data = await apiFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (DEMO_MODE) return demoPost(path, body);
    return data;
  },

  async patch(path, body) {
    if (DEMO_MODE) return demoPatch(path, body);
    const data = await apiFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (DEMO_MODE) return demoPatch(path, body);
    return data;
  },

  async delete(path) {
    if (DEMO_MODE) return demoDelete(path);
    const data = await apiFetch(path, { method: 'DELETE' });
    if (DEMO_MODE) return demoDelete(path);
    return data;
  }
};

// ── Demo handlers ──────────────────────────────────────────────
function demoGet(path) {
  if (path === '/prospects/stats') return DEMO_STATS;
  if (path === '/prospects' || path.startsWith('/prospects?')) return [...DEMO_PROSPECTS];
  const m = path.match(/\/prospects\/([^/]+)$/);
  if (m) {
    const p = DEMO_PROSPECTS.find(x => x.id === m[1]);
    if (!p) throw new Error('Prospect introuvable');
    return p;
  }
  if (path.includes('/events')) return generateDemoEvents(path);
  if (path.includes('/tasks')) return generateDemoTasks(path);
  return [];
}

function demoPost(path, body) {
  if (path.includes('/reply-assistant')) return generateDemoReply(body.raw_message);
  if (path.includes('/enrich-prospect') || path.includes('/enrich')) return generateDemoEnrichment(body);
  if (path.includes('/tasks')) {
    const task = { id: 'task-' + Date.now(), ...body, status: 'pending', created_at: new Date().toISOString() };
    return task;
  }
  // Création prospect
  const prospect = { id: 'p-' + Date.now(), ...body, score: 0, score_classe: 'C', statut: 'a_contacter', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  DEMO_PROSPECTS.unshift(prospect);
  DEMO_STATS.total++;
  return prospect;
}

function demoPatch(path, body) {
  const m = path.match(/\/prospects\/([^/]+)\/status/);
  if (m) {
    const p = DEMO_PROSPECTS.find(x => x.id === m[1]);
    if (p) { p.statut = body.statut; p.updated_at = new Date().toISOString(); return p; }
  }
  return body;
}

function demoDelete(path) {
  const m = path.match(/\/prospects\/([^/]+)$/);
  if (m) {
    const idx = DEMO_PROSPECTS.findIndex(x => x.id === m[1]);
    if (idx >= 0) { DEMO_PROSPECTS.splice(idx, 1); DEMO_STATS.total = Math.max(0, DEMO_STATS.total - 1); }
  }
  return true;
}

function generateDemoEvents(path) {
  return [
    { id: 'e1', event_type: 'created', event_value: 'Prospect créé', created_at: '2026-04-10T09:15:00Z' },
    { id: 'e2', event_type: 'enriched', event_value: 'Score: 88 — Classe: A', created_at: '2026-04-10T09:16:00Z' },
    { id: 'e3', event_type: 'status_changed', event_value: 'Statut → pret_a_contacter', created_at: '2026-04-10T09:16:00Z' },
    { id: 'e4', event_type: 'message_generated', event_value: 'Email et LinkedIn générés', created_at: '2026-04-11T10:00:00Z' }
  ];
}

function generateDemoTasks(path) {
  return [
    { id: 't1', title: 'Envoyer email de premier contact', due_date: '2026-04-23', status: 'pending', created_at: '2026-04-18T09:00:00Z' },
    { id: 't2', title: 'Relancer dans 7 jours si pas de réponse', due_date: '2026-04-30', status: 'pending', created_at: '2026-04-18T09:01:00Z' }
  ];
}

function generateDemoReply(rawMessage) {
  const hasPositive = /intéress|disponible|rappel|réunion|oui|volontiers|pourquoi pas/i.test(rawMessage || '');
  return {
    objection_type: hasPositive ? 'interet' : 'pas_de_besoin',
    next_best_action: hasPositive ? 'Proposer un créneau de rendez-vous cette semaine' : 'Relancer dans 30 jours avec une approche différente',
    suggested_reply_short: hasPositive
      ? 'Merci pour votre retour. Je vous propose le jeudi 24 avril à 10h ou le vendredi à 14h — quel créneau vous convient le mieux ?'
      : 'Je vous remercie pour votre réponse. Je me permettrai de revenir vers vous dans quelques semaines si votre situation évolue.',
    suggested_reply_sales: hasPositive
      ? 'Bonjour,\n\nMerci pour votre retour. Colixo accompagne des entreprises comme la vôtre avec des livraisons J+1 fiables et un portail de suivi en temps réel.\n\nJe vous propose un échange de 15 minutes pour mieux comprendre vos besoins.\n\nJeudi 24/04 à 10h ou vendredi 25/04 à 14h ?\n\nCordialement'
      : 'Bonjour,\n\nJe comprends que le moment n\'est peut-être pas opportun. Nous accompagnons régulièrement des entreprises dont les besoins logistiques évoluent.\n\nN\'hésitez pas à revenir vers nous si votre situation change.\n\nCordialement',
    suggested_reply_meeting: 'Bonjour,\n\nSuite à votre message, je vous propose les créneaux suivants :\n- Jeudi 24 avril à 10h00\n- Vendredi 25 avril à 14h30\n\nL\'échange dure 15 minutes maximum, en vidéo ou par téléphone selon votre préférence.\n\nCordialement',
    suggested_reply_objection_prix: 'Bonjour,\n\nJe comprends votre attention au coût. Ce que nos clients constatent, c\'est que le coût d\'une livraison non conforme (retour client, gestion SAV) dépasse souvent l\'écart tarifaire. Nous pourrions examiner ensemble une structure adaptée à votre volume.\n\nCordialement',
    suggested_reply_no_need: 'Bonjour,\n\nJe vous remercie pour votre réponse. Les besoins évoluent et si un pic de volume ou un changement de prestataire devait se présenter, nous restons à votre disposition.\n\nCordialement',
    suggested_reply_refus: 'Bonjour,\n\nJe vous remercie pour votre transparence. N\'hésitez pas à revenir vers nous si votre situation devait évoluer — nous resterons disponibles.\n\nBonne continuation.'
  };
}

function generateDemoEnrichment(data) {
  return {
    resume: `${data.entreprise || 'L\'entreprise'} est active dans le secteur ${data.secteur || 'commercial'} à ${data.ville || 'Suisse'}. Structure B2B avec des flux logistiques réguliers.`,
    besoin_detecte: 'Livraisons B2B régulières, besoin de réactivité et de suivi. Potentiel pour des tournées hebdomadaires.',
    angle_commercial: 'Mettre en avant la réactivité Colixo et le portail de suivi. Proposer un essai sur 5 livraisons.',
    objections_probables: '1. Prestataire existant. 2. Budget. 3. Volume insuffisant pour négocier.',
    score: Math.floor(Math.random() * 30) + 55,
    score_classe: 'B',
    message_connexion: `Bonjour,\n\nJe représente Colixo, service de livraison express B2B en Suisse romande. Votre activité dans le secteur ${data.secteur || 'logistique'} pourrait bénéficier de notre offre. Seriez-vous disponible pour un bref échange cette semaine ?\n\nCordialement`,
    message_1: `Bonjour,\n\nMerci d'avoir accepté ma connexion. Colixo accompagne des entreprises ${data.secteur ? 'du secteur ' + data.secteur : 'B2B'} avec des livraisons J+1 fiables en Suisse romande. Auriez-vous 10 minutes cette semaine pour en discuter ?\n\nCordialement`,
    relance_1: 'Bonjour,\n\nJe me permets de revenir vers vous suite à mon message de la semaine dernière. Avez-vous eu l\'occasion d\'y réfléchir ?\n\nCordialement',
    relance_2: 'Bonjour,\n\nJe ne voudrais pas vous importuner davantage. Si un besoin logistique devait se présenter à terme, n\'hésitez pas à revenir vers nous.\n\nBonne continuation,\nL\'équipe Colixo',
    email_1: `Objet: Livraison express B2B — Colixo pour ${data.entreprise || 'votre entreprise'}\n\nBonjour,\n\nColixo accompagne des entreprises ${data.secteur ? 'du secteur ' + data.secteur : 'B2B'} avec des livraisons express J+1 en Suisse romande. Seriez-vous disponible 10 minutes cette semaine pour évaluer si notre offre correspond à vos besoins ?\n\nCordialement,\nL'équipe Colixo`,
    email_relance: `Objet: Re: Livraison express B2B — Colixo\n\nBonjour,\n\nJe me permets de revenir vers vous suite à mon précédent message. Avez-vous eu l'occasion d'y réfléchir ? Je reste à votre disposition.\n\nCordialement,\nL'équipe Colixo`,
    script_appel: `Introduction: "Bonjour, je vous contacte de chez Colixo, service de livraison express en Suisse romande. Avez-vous quelques minutes ?"\nQuestion 1: "Quel est votre volume de livraisons mensuel actuellement ?"\nQuestion 2: "Avez-vous des contraintes de délais particulières à respecter ?"\nProposition: "Nous pourrions vous proposer un essai sur 5 livraisons, sans engagement."`
  };
}

function generateDemoAgenda() {
  const today = new Date();
  const d = (offset, h = 0) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    dt.setHours(h, 0, 0, 0);
    return dt.toISOString().split('T')[0];
  };
  return [
    { id: 'ag-1', title: 'Envoyer email de premier contact', due_date: d(-2), status: 'pending', prospects: { id: 'demo-1', entreprise: 'Medi-Supply SA', ville: 'Lausanne', statut: 'pret_a_contacter' } },
    { id: 'ag-2', title: 'Relancer dans 7 jours si pas de réponse', due_date: d(0), status: 'pending', prospects: { id: 'demo-2', entreprise: 'TechParts Romandie', ville: 'Genève', statut: 'contacte' } },
    { id: 'ag-3', title: 'Appel téléphonique — valider besoin', due_date: d(0), status: 'pending', prospects: { id: 'demo-4', entreprise: 'Horlogerie Bouvet & Fils', ville: 'La Chaux-de-Fonds', statut: 'repondu' } },
    { id: 'ag-4', title: 'Préparer offre commerciale', due_date: d(2), status: 'pending', prospects: { id: 'demo-5', entreprise: 'FreshBox Suisse', ville: 'Lausanne', statut: 'repondu' } },
    { id: 'ag-5', title: 'Relancer suite au 1er email', due_date: d(4), status: 'pending', prospects: { id: 'demo-1', entreprise: 'Medi-Supply SA', ville: 'Lausanne', statut: 'pret_a_contacter' } },
    { id: 'ag-6', title: 'Marquer rendez-vous confirmation', due_date: d(7), status: 'pending', prospects: { id: 'demo-5', entreprise: 'FreshBox Suisse', ville: 'Lausanne', statut: 'repondu' } },
    { id: 'ag-7', title: 'Email de suivi post-appel', due_date: d(9), status: 'done', prospects: { id: 'demo-4', entreprise: 'Horlogerie Bouvet & Fils', ville: 'La Chaux-de-Fonds', statut: 'repondu' } },
    { id: 'ag-8', title: 'Envoyer message LinkedIn', due_date: d(12), status: 'pending', prospects: { id: 'demo-2', entreprise: 'TechParts Romandie', ville: 'Genève', statut: 'contacte' } },
  ];
}

// ── Router ─────────────────────────────────────────────────────
async function navigate(view, id = null) {
  state.currentView = view;
  state.currentProspectId = id;
  updateNav(view);
  closeSidebar();

  const titles = {
    dashboard: 'Dashboard', prospects: 'Prospects', add: 'Nouveau prospect',
    edit: 'Modifier prospect', detail: 'Fiche prospect', pipeline: 'Pipeline CRM', agenda: 'Agenda'
  };
  document.getElementById('topbarTitle').textContent = titles[view] || view;

  const topbarRight = document.getElementById('topbarRight');
  topbarRight.innerHTML = '';

  try {
    switch (view) {
      case 'dashboard': await renderDashboard(); break;
      case 'prospects': await renderProspects(); break;
      case 'detail':    await renderDetail(id); break;
      case 'pipeline':  await renderPipeline(); break;
      case 'agenda':    await renderAgenda(); break;
      default: document.getElementById('content').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Page introuvable</div></div>';
    }
  } catch (err) {
    hideLoader();
    document.getElementById('content').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Erreur de chargement</div><div class="empty-state-desc">${escHtml(err.message)}</div></div>`;
    console.error(err);
  }
}

function updateNav(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
}

// ── Dashboard ──────────────────────────────────────────────────
async function renderDashboard() {
  showLoader('Chargement du dashboard...');
  const [stats, prospects] = await Promise.all([
    api.get('/prospects/stats'),
    api.get('/prospects')
  ]);
  state.stats = stats;
  state.prospects = prospects;
  updateNavCount(prospects.length);
  hideLoader();

  const topProspects = [...prospects]
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const recentProspects = [...prospects]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  // Charger les tâches en arrière-plan pour le widget dashboard
  api.get('/agenda?status=pending').then(tasks => {
    const today = new Date().toISOString().split('T')[0];
    const sorted = (Array.isArray(tasks) ? tasks : [])
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      .slice(0, 6);
    const el = document.getElementById('dashTasksBody');
    if (!el) return;
    if (!sorted.length) {
      el.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-state-desc">Aucune tâche en attente.</div></div>';
      return;
    }
    el.innerHTML = `<table><tbody>${sorted.map(t => {
      const p = t.prospects || {};
      const isLate = t.due_date && t.due_date < today;
      return `<tr onclick="navigate('agenda')" style="cursor:pointer;">
        <td style="padding:9px 14px;">
          <div class="td-main">${escHtml(t.title)}</div>
          ${p.entreprise ? `<div class="td-sub">${escHtml(p.entreprise)}</div>` : ''}
        </td>
        <td style="padding:9px 14px;text-align:right;white-space:nowrap;">
          <span style="font-size:12px;color:${isLate ? 'var(--danger)' : 'var(--muted)'};">${fmtDate(t.due_date)}</span>
          ${isLate ? '<span class="atask-badge badge-danger" style="margin-left:6px;">En retard</span>' : ''}
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }).catch(() => {
    // Widget optionnel, on ignore les erreurs silencieusement
  });

  document.getElementById('content').innerHTML = `
    <div class="section-title">Vue générale</div>

    <div class="kpi-grid">
      <div class="kpi-card" style="--kpi-color:#e8311a">
        <div class="kpi-icon">🏢</div>
        <div class="kpi-label">Total prospects</div>
        <div class="kpi-value">${stats.total}</div>
        <div class="kpi-sub">dans la base</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#22c55e">
        <div class="kpi-icon">🔥</div>
        <div class="kpi-label">Prospects chauds</div>
        <div class="kpi-value">${stats.chauds}</div>
        <div class="kpi-sub">score ≥ 70</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#3b82f6">
        <div class="kpi-icon">📅</div>
        <div class="kpi-label">Rendez-vous</div>
        <div class="kpi-value">${stats.rdv}</div>
        <div class="kpi-sub">confirmés ou en cours</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#f59e0b">
        <div class="kpi-icon">📊</div>
        <div class="kpi-label">Taux de réponse</div>
        <div class="kpi-value">${stats.tauxReponse}%</div>
        <div class="kpi-sub">conversion RDV: ${stats.tauxConversion}%</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
      <div class="card">
        <div class="card-header"><div class="card-title">📈 Répartition par statut</div></div>
        <div class="card-body">
          <div class="chart-bars">
            ${Object.entries(stats.byStatut).map(([k, v]) => `
              <div class="chart-row">
                <div class="chart-label">${statutLabel(k)}</div>
                <div class="chart-bar-wrap"><div class="chart-bar" style="width:${Math.round(v/Math.max(...Object.values(stats.byStatut))*100)}%"></div></div>
                <div class="chart-count">${v}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🏭 Par secteur</div></div>
        <div class="card-body">
          <div class="chart-bars">
            ${Object.entries(stats.bySecteur).map(([k, v]) => `
              <div class="chart-row">
                <div class="chart-label">${escHtml(k)}</div>
                <div class="chart-bar-wrap"><div class="chart-bar" style="width:${Math.round(v/Math.max(...Object.values(stats.bySecteur))*100)}%"></div></div>
                <div class="chart-count">${v}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="dash-agenda-widget card">
      <div class="card-header">
        <div class="card-title">📅 Prochaines tâches</div>
        <button class="btn btn-sm btn-primary" onclick="navigate('agenda')">Voir l'agenda</button>
      </div>
      <div class="card-body" id="dashTasksBody" style="padding:0;">
        <div class="empty-state" style="padding:20px;"><div class="empty-state-desc">Chargement…</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏆 Top prospects par score</div>
          <button class="btn btn-sm btn-ghost" onclick="navigate('prospects')">Voir tous</button>
        </div>
        <div class="card-body" style="padding:0;">
          ${topProspects.length ? `
            <table>
              <tbody>
                ${topProspects.map(p => `
                  <tr onclick="navigate('detail','${p.id}')" style="cursor:pointer;">
                    <td style="padding:10px 14px;">
                      <div class="td-main">${escHtml(p.entreprise)}</div>
                      <div class="td-sub">${escHtml(p.secteur || '')} · ${escHtml(p.ville || '')}</div>
                    </td>
                    <td style="padding:10px 14px;text-align:right;">
                      <span class="badge badge-${(p.score_classe||'c').toLowerCase()}">${p.score_classe || 'C'}</span>
                      <div style="font-size:11px;color:var(--muted);margin-top:2px;">${p.score}/100</div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>` : '<div class="empty-state" style="padding:24px;"><div class="empty-state-desc">Aucun prospect scoré</div></div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">🕐 Ajouts récents</div>
          <button class="btn btn-sm btn-primary" onclick="openModalProspect()">+ Nouveau</button>
        </div>
        <div class="card-body" style="padding:0;">
          <table>
            <tbody>
              ${recentProspects.map(p => `
                <tr onclick="navigate('detail','${p.id}')" style="cursor:pointer;">
                  <td style="padding:10px 14px;">
                    <div class="td-main">${escHtml(p.entreprise)}</div>
                    <div class="td-sub">${escHtml(p.ville || '')} · ${fmtDate(p.created_at)}</div>
                  </td>
                  <td style="padding:10px 14px;text-align:right;">
                    <span class="statut-badge s-${p.statut}">${statutLabel(p.statut)}</span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ── Prospects list ─────────────────────────────────────────────
async function renderProspects(filters = {}) {
  showLoader('Chargement des prospects...');
  let params = '';
  if (filters.statut)  params += `?statut=${filters.statut}`;
  if (filters.search)  params += `${params ? '&' : '?'}search=${encodeURIComponent(filters.search)}`;
  if (filters.secteur) params += `${params ? '&' : '?'}secteur=${encodeURIComponent(filters.secteur)}`;

  const prospects = await api.get('/prospects' + params);
  state.prospects = prospects;
  updateNavCount(prospects.length);
  hideLoader();

  document.getElementById('topbarRight').innerHTML = `
    <button class="btn btn-sm btn-primary" onclick="openModalProspect()">+ Nouveau prospect</button>
  `;

  const secteurs = [...new Set(prospects.map(p => p.secteur).filter(Boolean))].sort();

  document.getElementById('content').innerHTML = `
    <div class="filter-bar">
      <input type="text" class="search-input" id="searchInput" placeholder="🔍 Rechercher..." value="${escHtml(filters.search || '')}" oninput="debounceSearch()"/>
      <select class="select-filter" id="filtreStatut" onchange="applyFilters()">
        <option value="">Tous statuts</option>
        ${['nouveau','a_qualifier','qualifie','pret_a_contacter','contacte','relance_1_envoyee','relance_2_envoyee','repondu','rdv_planifie','opportunite','client_gagne','perdu','sans_suite'].map(s =>
          `<option value="${s}" ${filters.statut===s?'selected':''}>${statutLabel(s)}</option>`).join('')}
      </select>
      <select class="select-filter" id="filtreClasse" onchange="applyFilters()">
        <option value="">Toutes classes</option>
        <option value="A" ${filters.score_classe==='A'?'selected':''}>⭐ Classe A (≥70)</option>
        <option value="B" ${filters.score_classe==='B'?'selected':''}>Classe B (≥45)</option>
        <option value="C" ${filters.score_classe==='C'?'selected':''}>Classe C (&lt;45)</option>
      </select>
      <select class="select-filter" id="filtreSecteur" onchange="applyFilters()">
        <option value="">Tous secteurs</option>
        ${secteurs.map(s => `<option value="${s}" ${filters.secteur===s?'selected':''}>${escHtml(s)}</option>`).join('')}
      </select>
      <select class="select-filter" id="filtreSort" onchange="applyFilters()">
        <option value="" ${!filters.sort?'selected':''}>Tri: Date ajout</option>
        <option value="score" ${filters.sort==='score'?'selected':''}>Tri: Score</option>
        <option value="activite" ${filters.sort==='activite'?'selected':''}>Tri: Activité récente</option>
      </select>
      <span style="font-size:12px;color:var(--muted);margin-left:auto;">${prospects.length} prospect${prospects.length > 1 ? 's' : ''}</span>
    </div>

    ${prospects.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <div class="empty-state-title">Aucun prospect</div>
        <div class="empty-state-desc">Commencez par ajouter un prospect ou modifier vos filtres.</div>
        <div style="margin-top:16px;"><button class="btn btn-primary" onclick="openModalProspect()">+ Ajouter un prospect</button></div>
      </div>` : `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Secteur / Ville</th>
              <th>Contact</th>
              <th>Score</th>
              <th>Statut</th>
              <th style="width:120px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${prospects.map(p => `
              <tr onclick="navigate('detail','${p.id}')">
                <td>
                  <div class="td-main">${escHtml(p.entreprise)}</div>
                  ${p.site_web ? `<div class="td-sub">${escHtml(p.site_web.replace(/^https?:\/\//,''))}</div>` : ''}
                </td>
                <td>
                  <div>${escHtml(p.secteur || '—')}</div>
                  <div class="td-sub">${escHtml(p.ville || '—')}</div>
                </td>
                <td>
                  <div>${escHtml(p.contact_nom || '—')}</div>
                  ${p.email ? `<div class="td-sub">${escHtml(p.email)}</div>` : ''}
                </td>
                <td>
                  ${p.score > 0 ? `
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="badge badge-${(p.score_classe||'c').toLowerCase()}">${p.score_classe}</span>
                      <span style="font-size:12px;color:var(--muted);">${p.score}</span>
                    </div>
                    <div class="score-bar" style="margin-top:4px;"><div class="score-fill" style="width:${p.score}%"></div></div>
                  ` : '<span style="color:var(--muted);font-size:12px;">—</span>'}
                </td>
                <td><span class="statut-badge s-${p.statut}">${statutLabel(p.statut)}</span></td>
                <td onclick="event.stopPropagation()">
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-xs btn-ghost" onclick="openModalProspect('${p.id}')" title="Modifier">✏️</button>
                    <button class="btn btn-xs btn-danger" onclick="confirmDelete('${p.id}','${escHtml(p.entreprise)}')" title="Supprimer">🗑️</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
}

let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyFilters, 350);
}

function applyFilters() {
  renderProspects({
    search:       document.getElementById('searchInput')?.value  || '',
    statut:       document.getElementById('filtreStatut')?.value || '',
    score_classe: document.getElementById('filtreClasse')?.value || '',
    secteur:      document.getElementById('filtreSecteur')?.value|| '',
    sort:         document.getElementById('filtreSort')?.value   || '',
  });
}

// ── Prospect detail ────────────────────────────────────────────
async function renderDetail(id) {
  showLoader('Chargement de la fiche...');
  const [p, events, tasks] = await Promise.all([
    api.get(`/prospects/${id}`),
    api.get(`/prospects/${id}/events`),
    api.get(`/prospects/${id}/tasks`)
  ]);
  hideLoader();

  document.getElementById('topbarTitle').textContent = p.entreprise;
  document.getElementById('topbarRight').innerHTML = `
    <button class="btn btn-sm btn-ghost" onclick="navigate('prospects')">← Retour</button>
    <button class="btn btn-sm btn-secondary" onclick="openModalProspect('${p.id}')">✏️ Modifier</button>
    <button class="btn btn-sm btn-primary" id="btnEnrich" onclick="enrichProspect('${p.id}')">🤖 Analyser</button>
  `;

  document.getElementById('content').innerHTML = `
    <!-- En-tête prospect -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <h2 style="font-size:22px;font-weight:900;margin-bottom:4px;">${escHtml(p.entreprise)}</h2>
            <div style="color:var(--muted);font-size:13px;display:flex;gap:12px;flex-wrap:wrap;">
              ${p.secteur ? `<span>🏭 ${escHtml(p.secteur)}</span>` : ''}
              ${p.ville   ? `<span>📍 ${escHtml(p.ville)}</span>` : ''}
              ${p.site_web ? `<span>🌐 <a href="${escHtml(p.site_web)}" target="_blank" style="color:var(--accent2);">${escHtml(p.site_web.replace(/^https?:\/\//,''))}</a></span>` : ''}
            </div>
            ${p.contact_nom ? `<div style="margin-top:8px;font-size:13px;"><strong>${escHtml(p.contact_nom)}</strong>${p.contact_role ? ` — ${escHtml(p.contact_role)}` : ''}</div>` : ''}
            <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted);">
              ${p.email     ? `<span>✉️ <a href="mailto:${escHtml(p.email)}" style="color:var(--muted2);">${escHtml(p.email)}</a></span>` : ''}
              ${p.telephone ? `<span>📞 ${escHtml(p.telephone)}</span>` : ''}
              ${p.linkedin_url ? `<span>💼 <a href="${escHtml(p.linkedin_url)}" target="_blank" style="color:var(--accent2);">LinkedIn (manuel)</a></span>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <span class="statut-badge s-${p.statut}" style="font-size:12px;">${statutLabel(p.statut)}</span>
            <select style="background:var(--bg2);border:1px solid var(--border2);color:var(--text);padding:6px 10px;border-radius:8px;font:inherit;font-size:12px;cursor:pointer;" onchange="changeStatut('${p.id}',this.value)">
              ${['nouveau','a_qualifier','qualifie','pret_a_contacter','contacte','relance_1_envoyee','relance_2_envoyee','repondu','rdv_planifie','opportunite','client_gagne','perdu','sans_suite'].map(s =>
                `<option value="${s}" ${p.statut===s?'selected':''}>${statutLabel(s)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Onglets -->
    <div class="tabs" id="detailTabs">
      <button class="tab-btn active" onclick="switchTab('enrichissement')">🔍 Enrichissement</button>
      <button class="tab-btn" onclick="switchTab('messages')">💬 Messages</button>
      <button class="tab-btn" onclick="switchTab('reponse')">📨 Réponses IA</button>
      <button class="tab-btn" onclick="switchTab('taches')">📌 Tâches</button>
      <button class="tab-btn" onclick="switchTab('journal')">📋 Journal</button>
    </div>

    <!-- Enrichissement -->
    <div class="tab-pane active" id="tab-enrichissement">
      ${p.score > 0 ? `
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-start;">
          <div class="score-display" style="flex:0 0 auto;">
            <div class="score-circle" style="--pct:${p.score}">
              <div class="score-circle-inner" style="color:${p.score>=70?'var(--success)':p.score>=40?'var(--warning)':'var(--danger)'};">${p.score}</div>
            </div>
            <div class="score-meta">
              <strong>Classe ${p.score_classe}</strong>
              <span>${p.score >= 70 ? 'Priorité haute' : p.score >= 40 ? 'Priorité moyenne' : 'Faible priorité'}</span>
              ${p.analysis_quality ? `<span style="font-size:10px;color:var(--muted);">Analyse: ${p.analysis_quality}</span>` : ''}
            </div>
          </div>
          <div style="flex:1;min-width:220px;">
            ${p.score_reasoning ? `<div style="font-size:13px;color:var(--muted2);font-style:italic;margin-bottom:10px;">"${escHtml(p.score_reasoning)}"</div>` : ''}
            ${[
              ['Pertinence secteur',       p.score_pertinence_secteur,  20],
              ['Besoin logistique',        p.score_besoin_logistique,   20],
              ['Compatibilité géo',        p.score_compatibilite_geo,   10],
              ['Potentiel volume',         p.score_potentiel_volume,    20],
              ['Probabilité réponse',      p.score_probabilite_reponse, 15],
              ['Complexité opérationnelle',p.score_complexite_op,       10],
              ['Fit Colixo',               p.score_fit_colixo,           5],
            ].filter(([,v]) => v != null).map(([label, val, max]) => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12px;">
                <span style="width:160px;color:var(--muted);">${label}</span>
                <div style="flex:1;height:5px;background:var(--border2);border-radius:3px;">
                  <div style="height:100%;width:${Math.round((val/max)*100)}%;background:var(--accent);border-radius:3px;"></div>
                </div>
                <span style="width:40px;text-align:right;color:var(--text);">${val}/${max}</span>
              </div>`).join('')}
          </div>
        </div>
        ${p.logistic_signals && (Array.isArray(p.logistic_signals) ? p.logistic_signals : JSON.parse(p.logistic_signals || '[]')).length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px;">Signaux logistiques détectés</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(Array.isArray(p.logistic_signals) ? p.logistic_signals : JSON.parse(p.logistic_signals)).map(s =>
              `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(232,49,26,.1);border:1px solid rgba(232,49,26,.2);color:var(--accent);">${escHtml(s)}</span>`
            ).join('')}
          </div>
        </div>` : ''}
        <div class="info-grid" style="margin-bottom:16px;">
          ${infoBlock('Résumé', p.resume)}
          ${infoBlock('Besoin détecté', p.besoin_detecte)}
          ${infoBlock('Angle commercial', p.angle_commercial)}
          ${infoBlock('Objections probables', p.objections_probables)}
        </div>
        ${p.enriched_at ? `<div style="font-size:11px;color:var(--muted);text-align:right;">Dernière analyse: ${fmtDateTime(p.enriched_at)}</div>` : ''}
      ` : `
        <div class="empty-state" style="padding:36px;">
          <div class="empty-state-icon">🤖</div>
          <div class="empty-state-title">Aucune analyse disponible</div>
          <div class="empty-state-desc">Cliquez sur "Analyser" pour lancer l'enrichissement IA (scraping site web + analyse OpenAI).</div>
          <div style="margin-top:16px;"><button class="btn btn-primary" onclick="enrichProspect('${p.id}')">🤖 Lancer l'analyse</button></div>
        </div>`}
    </div>

    <!-- Messages -->
    <div class="tab-pane" id="tab-messages">
      ${p.message_connexion ? `
        ${msgBlock('💼 Message LinkedIn — Direct', p.message_connexion, 'linkedin-warning')}
        ${p.message_connexion_premium ? msgBlock('💼 Message LinkedIn — Premium', p.message_connexion_premium, 'linkedin-warning') : ''}
        ${msgBlock('✉️ Email de premier contact', p.message_1)}
        ${msgBlock('✉️ Email de relance', p.email_relance)}
        ${msgBlock('📞 Script d\'appel', p.script_appel)}
        <div style="padding:12px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;font-size:12px;color:#f59e0b;margin-top:8px;">
          ⚠️ <strong>Rappel :</strong> Les messages LinkedIn sont à envoyer manuellement. Aucune automatisation LinkedIn n'est réalisée.
        </div>
      ` : `
        <div class="empty-state" style="padding:36px;">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">Aucun message généré</div>
          <div class="empty-state-desc">Lancez l'analyse IA pour générer automatiquement LinkedIn, email et script d'appel.</div>
          <div style="margin-top:16px;"><button class="btn btn-primary" onclick="enrichProspect('${p.id}')">🤖 Générer les messages</button></div>
        </div>`}
    </div>

    <!-- Réponse assistant -->
    <div class="tab-pane" id="tab-reponse">
      <div style="margin-bottom:16px;">
        <p style="color:var(--muted);font-size:13px;margin-bottom:12px;">Collez ici la réponse reçue du prospect. L'IA analyse le type d'objection et génère plusieurs formulations de réponse.</p>
        <button class="btn btn-primary" onclick="openReplyModal('${p.id}')">💬 Analyser une réponse</button>
      </div>
    </div>

    <!-- Tâches -->
    <div class="tab-pane" id="tab-taches">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:13px;color:var(--muted);">${tasks.filter(t=>t.status==='pending').length} tâche${tasks.filter(t=>t.status==='pending').length>1?'s':''} en attente</span>
        <button class="btn btn-sm btn-primary" onclick="openTaskModal('${p.id}')">+ Ajouter</button>
      </div>
      <div id="tasksList">
        ${renderTasks(tasks, p.id)}
      </div>
    </div>

    <!-- Journal -->
    <div class="tab-pane" id="tab-journal">
      ${events.length ? `
        <div style="padding:4px 0;">
          ${events.map(e => `
            <div class="event-item">
              <div class="event-dot"></div>
              <div class="event-body">
                <div class="event-type">${eventTypeLabel(e.event_type)}</div>
                ${e.event_value ? `<div class="event-value">${escHtml(e.event_value)}</div>` : ''}
                <div class="event-date">${fmtDateTime(e.created_at)}</div>
              </div>
            </div>`).join('')}
        </div>` : `<div class="empty-state" style="padding:24px;"><div class="empty-state-desc">Aucun événement enregistré</div></div>`}
    </div>
  `;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  event.target.classList.add('active');
}

function renderTasks(tasks, prospectId) {
  if (!tasks.length) return '<div class="empty-state" style="padding:24px;"><div class="empty-state-desc">Aucune tâche</div></div>';
  return tasks.map(t => `
    <div class="task-item ${t.status === 'done' ? 'task-done' : ''}">
      <button class="task-check ${t.status === 'done' ? 'done' : ''}" onclick="toggleTask('${t.id}','${prospectId}','${t.status}')" title="${t.status === 'done' ? 'Marquer en attente' : 'Marquer comme fait'}">
        ${t.status === 'done' ? '✓' : ''}
      </button>
      <div>
        <div class="task-title">${escHtml(t.title)}</div>
        ${t.due_date ? `<div class="task-due">📅 ${fmtDate(t.due_date)} ${isPast(t.due_date) && t.status === 'pending' ? '<span style="color:var(--danger);">— En retard</span>' : ''}</div>` : ''}
      </div>
    </div>`).join('');
}

// ── Pipeline ───────────────────────────────────────────────────
async function renderPipeline() {
  showLoader('Chargement du pipeline...');
  const prospects = await api.get('/prospects');
  state.prospects = prospects;
  hideLoader();

  const STAGES = [
    { key: 'nouveau',           label: 'Nouveau' },
    { key: 'qualifie',          label: 'Qualifié' },
    { key: 'pret_a_contacter',  label: 'Prêt à contacter' },
    { key: 'contacte',          label: 'Contacté' },
    { key: 'relance_1_envoyee', label: 'Relance 1' },
    { key: 'repondu',           label: 'Répondu' },
    { key: 'rdv_planifie',      label: '📅 RDV' },
    { key: 'opportunite',       label: '🏆 Opportunité' },
  ];

  const grouped = {};
  STAGES.forEach(s => { grouped[s.key] = []; });
  prospects.forEach(p => { if (grouped[p.statut] !== undefined) grouped[p.statut].push(p); });

  document.getElementById('content').innerHTML = `
    <div style="margin-bottom:16px;color:var(--muted);font-size:13px;">Vue pipeline — ${prospects.length} prospects · Cliquez sur une carte pour ouvrir la fiche</div>
    <div class="pipeline-grid">
      ${STAGES.map(s => `
        <div class="pipeline-col">
          <div class="pipeline-col-header">
            ${s.label}
            <span class="pipeline-count">${grouped[s.key].length}</span>
          </div>
          <div class="pipeline-cards">
            ${grouped[s.key].length === 0 ? '<div style="font-size:11px;color:var(--muted);padding:8px;text-align:center;">—</div>' :
              grouped[s.key].map(p => `
                <div class="pipeline-card" onclick="navigate('detail','${p.id}')">
                  <div class="pipeline-card-name">${escHtml(p.entreprise)}</div>
                  <div class="pipeline-card-meta">
                    ${p.secteur ? escHtml(p.secteur) + ' · ' : ''}${escHtml(p.ville || '—')}
                    ${p.score > 0 ? ` · <span class="badge badge-${(p.score_classe||'c').toLowerCase()}" style="font-size:10px;">${p.score}</span>` : ''}
                  </div>
                </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>
  `;
}

// ── Enrich ─────────────────────────────────────────────────────
async function enrichProspect(id) {
  if (DEMO_MODE) {
    showLoader('🤖 Analyse IA en cours... (mode démo)');
    await delay(1800);
    const p = DEMO_PROSPECTS.find(x => x.id === id);
    if (p) {
      const enriched = generateDemoEnrichment(p);
      Object.assign(p, enriched, { statut: 'pret_a_contacter', updated_at: new Date().toISOString() });
    }
    hideLoader();
    toast('✅ Analyse terminée — Score généré', 'success');
    await renderDetail(id);
    return;
  }

  showLoader('🤖 Analyse IA en cours...');
  try {
    await api.post(`/enrich-prospect/${id}`, {});
    hideLoader();
    toast('✅ Enrichissement terminé', 'success');
    await renderDetail(id);
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

// ── Prospect form ──────────────────────────────────────────────
// ── LinkedIn auto-prefill ─────────────────────────────────────────────────────

async function linkedinPrefill(url) {
  if (!url || !url.includes('linkedin.com/')) return;

  const spinner = document.getElementById('linkedinPrefillSpinner');
  const hint    = document.getElementById('linkedinPrefillHint');
  const form    = document.getElementById('prospectForm');

  if (spinner) spinner.style.display = 'inline';
  if (hint)    hint.textContent = '⏳ Analyse en cours…';

  try {
    const res  = await fetch(API_BASE + '/linkedin-prefill', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ linkedin_url: url }),
    });
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || 'Erreur');

    const d = json.data;
    const fields = ['entreprise','ville','secteur','site_web','contact_nom','contact_role'];
    let filled = 0;

    fields.forEach(f => {
      if (!d[f]) return;
      const el = form.querySelector(`[name=${f}]`);
      if (el && !el.value) { el.value = d[f]; filled++; }
    });

    if (hint) hint.textContent = filled > 0
      ? `✅ ${filled} champ${filled > 1 ? 's' : ''} rempli${filled > 1 ? 's' : ''} automatiquement — vérifiez et complétez`
      : '⚠️ Aucune donnée trouvée — remplissez manuellement';

  } catch (err) {
    if (hint) hint.textContent = '⚠️ Auto-remplissage indisponible — ' + err.message;
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function openModalProspect(id = null) {
  const form = document.getElementById('prospectForm');
  form.reset();
  form.querySelector('[name=id]').value = '';

  const hint = document.getElementById('linkedinPrefillHint');
  if (hint) hint.textContent = '✨ Collez une URL LinkedIn — le formulaire se remplit automatiquement';

  if (id) {
    const p = state.prospects.find(x => x.id === id) || DEMO_PROSPECTS.find(x => x.id === id);
    if (p) {
      document.getElementById('modalProspectTitle').textContent = 'Modifier — ' + p.entreprise;
      ['entreprise','ville','secteur','site_web','contact_nom','contact_role','linkedin_url','email','telephone','notes'].forEach(f => {
        const el = form.querySelector(`[name=${f}]`);
        if (el) el.value = p[f] || '';
      });
      form.querySelector('[name=id]').value = p.id;
    }
  } else {
    document.getElementById('modalProspectTitle').textContent = 'Nouveau prospect';
  }

  document.getElementById('modalProspect').classList.add('open');

  // Attacher l'écouteur paste/blur sur le champ LinkedIn
  const linkedinInput = document.getElementById('linkedinUrlInput');
  if (linkedinInput && !linkedinInput._prefillBound) {
    linkedinInput._prefillBound = true;
    linkedinInput.addEventListener('paste', e => {
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      if (pasted && pasted.includes('linkedin.com/')) {
        setTimeout(() => linkedinPrefill(pasted), 50);
      }
    });
    linkedinInput.addEventListener('blur', () => {
      linkedinPrefill(linkedinInput.value);
    });
  }
}

async function submitProspect(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('prospectForm');
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id;
  delete data.id;

  if (!data.entreprise.trim()) {
    toast('Le nom de l\'entreprise est requis', 'error');
    return;
  }

  showLoader('Sauvegarde...');
  try {
    if (id) {
      await api.put(`/prospects/${id}`, data);
      toast('✅ Prospect mis à jour', 'success');
    } else {
      await api.post('/prospects', data);
      toast('✅ Prospect ajouté', 'success');
    }
    closeModal('modalProspect');
    hideLoader();
    if (state.currentView === 'detail' && id) await renderDetail(id);
    else await renderProspects();
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

// ── Status change ──────────────────────────────────────────────
async function changeStatut(id, statut) {
  showLoader('Mise à jour...');
  try {
    await api.patch(`/prospects/${id}/status`, { statut });
    const p = state.prospects.find(x => x.id === id);
    if (p) p.statut = statut;
    const dp = DEMO_PROSPECTS.find(x => x.id === id);
    if (dp) dp.statut = statut;
    hideLoader();
    toast('✅ Statut mis à jour', 'success');
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

// ── Delete ─────────────────────────────────────────────────────
function confirmDelete(id, name) {
  if (!confirm(`Supprimer "${name}" définitivement ?`)) return;
  deleteProspect(id, name);
}

async function deleteProspect(id, name) {
  showLoader('Suppression...');
  try {
    await api.delete(`/prospects/${id}`);
    hideLoader();
    toast(`🗑️ ${name} supprimé`, 'warning');
    await renderProspects();
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

// ── Agenda ────────────────────────────────────────────────────
let _agendaYear  = new Date().getFullYear();
let _agendaMonth = new Date().getMonth(); // 0-based
let _agendaTasks = [];

async function renderAgenda() {
  showLoader('Chargement de l\'agenda…');
  try {
    const raw = await api.get('/agenda');
    _agendaTasks = Array.isArray(raw) ? raw : [];
  } catch {
    _agendaTasks = DEMO_MODE ? generateDemoAgenda() : [];
  }
  hideLoader();
  _agendaYear  = new Date().getFullYear();
  _agendaMonth = new Date().getMonth();
  _renderAgendaView();
  // Badge nav
  const pending = _agendaTasks.filter(t => t.status === 'pending').length;
  const badge = document.getElementById('nav-tasks-count');
  if (badge) { badge.textContent = pending; badge.classList.toggle('nav-badge-hidden', !pending); }
}

function _renderAgendaView() {
  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const year     = _agendaYear;
  const month    = _agendaMonth;

  const firstDay   = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0);
  const startDow   = (firstDay.getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = lastDay.getDate();

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // Tâches du mois groupées par jour
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const byDay = {};
  _agendaTasks.forEach(t => {
    if (!t.due_date || !t.due_date.startsWith(monthStr)) return;
    const day = t.due_date.split('-')[2];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  });

  // Tâches en retard (avant ce mois, pending)
  const overdue = _agendaTasks.filter(t =>
    t.status === 'pending' && t.due_date && t.due_date < monthStr + '-01'
  );

  // Tâches du mois sélectionné pour la liste
  const monthTasks = _agendaTasks.filter(t => t.due_date && t.due_date.startsWith(monthStr));
  monthTasks.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  // Calendrier HTML
  let calCells = '';
  let cellIdx = 0;
  // Cellules vides avant le 1er
  for (let i = 0; i < startDow; i++) {
    calCells += `<div class="cal-cell cal-empty"></div>`;
    cellIdx++;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const tasks  = byDay[String(d).padStart(2, '0')] || [];
    const isToday = dayStr === todayStr;
    const pending = tasks.filter(t => t.status === 'pending');
    const hasDone = tasks.some(t => t.status === 'done');
    const isOverdue = pending.length > 0 && dayStr < todayStr;

    let dots = '';
    if (pending.length > 0) dots += `<span class="cal-dot ${isOverdue ? 'dot-danger' : 'dot-pending'}"></span>`;
    if (hasDone)            dots += `<span class="cal-dot dot-done"></span>`;

    calCells += `
      <div class="cal-cell ${isToday ? 'cal-today' : ''} ${tasks.length ? 'cal-has-tasks' : ''}"
           onclick="agendaJumpToDay('${dayStr}')">
        <span class="cal-day-num">${d}</span>
        ${pending.length ? `<span class="cal-task-count">${pending.length}</span>` : ''}
        <div class="cal-dots">${dots}</div>
      </div>`;
    cellIdx++;
  }
  // Compléter dernière ligne
  while (cellIdx % 7 !== 0) {
    calCells += `<div class="cal-cell cal-empty"></div>`;
    cellIdx++;
  }

  const overdueHTML = overdue.length ? `
    <div class="agenda-section">
      <div class="agenda-section-title danger-title">⚠️ En retard — ${overdue.length} tâche${overdue.length > 1 ? 's' : ''}</div>
      ${overdue.map(t => agendaTaskRow(t, true)).join('')}
    </div>` : '';

  const listHTML = monthTasks.length
    ? Object.entries(
        monthTasks.reduce((acc, t) => {
          if (!acc[t.due_date]) acc[t.due_date] = [];
          acc[t.due_date].push(t);
          return acc;
        }, {})
      ).map(([date, tasks]) => {
        const isPast = date < todayStr;
        const isToday = date === todayStr;
        const label = isToday ? 'Aujourd\'hui' : fmtDate(date);
        return `
          <div class="agenda-section" id="day-${date}">
            <div class="agenda-section-title ${isPast && tasks.some(t => t.status === 'pending') ? 'danger-title' : isToday ? 'today-title' : ''}">${label}</div>
            ${tasks.map(t => agendaTaskRow(t, isPast && t.status === 'pending')).join('')}
          </div>`;
      }).join('')
    : '<div class="empty-state" style="padding:24px;"><div class="empty-state-desc">Aucune tâche ce mois-ci.</div></div>';

  document.getElementById('content').innerHTML = `
    <div class="agenda-wrap">

      <div class="agenda-cal-col">
        <div class="cal-header">
          <button class="cal-nav-btn" onclick="agendaChangeMonth(-1)">&#8249;</button>
          <span class="cal-month-label">${MONTHS_FR[month]} ${year}</span>
          <button class="cal-nav-btn" onclick="agendaChangeMonth(1)">&#8250;</button>
        </div>
        <div class="cal-grid">
          ${DAYS_FR.map(d => `<div class="cal-dow">${d}</div>`).join('')}
          ${calCells}
        </div>

        <div class="agenda-legend">
          <span class="leg-item"><span class="cal-dot dot-pending"></span> À faire</span>
          <span class="leg-item"><span class="cal-dot dot-danger"></span> En retard</span>
          <span class="leg-item"><span class="cal-dot dot-done"></span> Terminé</span>
        </div>

        <div class="agenda-mini-stats">
          <div class="mini-stat">
            <strong>${_agendaTasks.filter(t => t.status === 'pending' && t.due_date >= todayStr).length}</strong>
            <span>À venir</span>
          </div>
          <div class="mini-stat danger-stat">
            <strong>${_agendaTasks.filter(t => t.status === 'pending' && t.due_date < todayStr).length}</strong>
            <span>En retard</span>
          </div>
          <div class="mini-stat ok-stat">
            <strong>${_agendaTasks.filter(t => t.status === 'done').length}</strong>
            <span>Terminées</span>
          </div>
        </div>
      </div>

      <div class="agenda-list-col">
        <div class="agenda-list-header">
          <span class="agenda-list-title">Tâches — ${MONTHS_FR[month]} ${year}</span>
          <div class="agenda-filters">
            <button class="btn btn-sm ${_agendaFilter === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="agendaSetFilter('all')">Toutes</button>
            <button class="btn btn-sm ${_agendaFilter === 'pending' ? 'btn-primary' : 'btn-ghost'}" onclick="agendaSetFilter('pending')">À faire</button>
            <button class="btn btn-sm ${_agendaFilter === 'done' ? 'btn-primary' : 'btn-ghost'}" onclick="agendaSetFilter('done')">Terminées</button>
          </div>
        </div>
        ${overdueHTML}
        <div id="agendaListBody">${listHTML}</div>
      </div>

    </div>`;
}

function agendaTaskRow(t, isLate) {
  const prospect = t.prospects || {};
  const statusClass = t.status === 'done' ? 'atask-done' : isLate ? 'atask-late' : '';
  return `
    <div class="agenda-task-row ${statusClass}" id="atask-${t.id}">
      <button class="task-check ${t.status === 'done' ? 'done' : ''}"
              onclick="agendaToggle('${t.id}','${t.status}')"
              title="${t.status === 'done' ? 'Marquer en attente' : 'Marquer comme terminé'}">
        ${t.status === 'done' ? '✓' : ''}
      </button>
      <div class="atask-body">
        <div class="atask-title">${escHtml(t.title)}</div>
        ${prospect.entreprise ? `<div class="atask-prospect" onclick="navigate('detail','${prospect.id}')">${escHtml(prospect.entreprise)}${prospect.ville ? ' — ' + escHtml(prospect.ville) : ''}</div>` : ''}
      </div>
      ${isLate ? '<span class="atask-badge badge-danger">En retard</span>' : ''}
      ${t.status === 'done' ? '<span class="atask-badge badge-done">Terminé</span>' : ''}
    </div>`;
}

let _agendaFilter = 'all';

function agendaSetFilter(filter) {
  _agendaFilter = filter;
  _renderAgendaView();
}

function agendaChangeMonth(delta) {
  _agendaMonth += delta;
  if (_agendaMonth < 0)  { _agendaMonth = 11; _agendaYear--; }
  if (_agendaMonth > 11) { _agendaMonth = 0;  _agendaYear++; }
  _renderAgendaView();
}

function agendaJumpToDay(dayStr) {
  const el = document.getElementById('day-' + dayStr);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function agendaToggle(taskId, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'pending' : 'done';
  try {
    await api.patch('/agenda/' + taskId, { status: newStatus });
    const t = _agendaTasks.find(x => x.id === taskId);
    if (t) t.status = newStatus;
    _renderAgendaView();
    // Mettre à jour badge nav
    const pending = _agendaTasks.filter(t => t.status === 'pending').length;
    const badge = document.getElementById('nav-tasks-count');
    if (badge) { badge.textContent = pending; badge.classList.toggle('nav-badge-hidden', !pending); }
  } catch (err) {
    toast('❌ ' + err.message, 'error');
  }
}

// ── Tasks ──────────────────────────────────────────────────────
let _taskProspectId = null;

function openTaskModal(prospectId) {
  _taskProspectId = prospectId;
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskTemplate').value = '';
  // Défaut : dans 3 jours
  const d = new Date(); d.setDate(d.getDate() + 3);
  document.getElementById('taskDue').value = d.toISOString().split('T')[0];
  document.getElementById('modalTask').classList.add('open');
}

function fillTaskTemplate() {
  const val = document.getElementById('taskTemplate').value;
  if (val) {
    document.getElementById('taskTitle').value = val;
    // Calcul de la date selon le type
    const d = new Date();
    if (val.includes('3 jours')) d.setDate(d.getDate() + 3);
    else if (val.includes('7 jours')) d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    document.getElementById('taskDue').value = d.toISOString().split('T')[0];
  }
}

async function submitTask() {
  const title   = document.getElementById('taskTitle').value.trim();
  const due_date = document.getElementById('taskDue').value;
  if (!title) { toast('Le titre de la tâche est requis', 'error'); return; }

  showLoader('Création...');
  try {
    await api.post(`/prospects/${_taskProspectId}/tasks`, { title, due_date, status: 'pending' });
    closeModal('modalTask');
    hideLoader();
    toast('✅ Tâche créée', 'success');
    // Rafraîchir la liste des tâches
    const tasks = await api.get(`/prospects/${_taskProspectId}/tasks`);
    const el = document.getElementById('tasksList');
    if (el) el.innerHTML = renderTasks(tasks, _taskProspectId);
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

async function toggleTask(taskId, prospectId, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'pending' : 'done';
  showLoader('Mise à jour...');
  try {
    if (!DEMO_MODE) {
      await api.patch(`/prospects/${prospectId}/tasks/${taskId}`, { status: newStatus });
    }
    hideLoader();
    const tasks = await api.get(`/prospects/${prospectId}/tasks`);
    // Update demo data
    tasks.forEach(t => { if (t.id === taskId) t.status = newStatus; });
    const el = document.getElementById('tasksList');
    if (el) el.innerHTML = renderTasks(tasks, prospectId);
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

// ── Reply assistant ────────────────────────────────────────────
let _replyProspectId = null;

function openReplyModal(prospectId) {
  _replyProspectId = prospectId;
  document.getElementById('replyText').value = '';
  document.getElementById('replyResults').innerHTML = '';
  document.getElementById('modalReply').classList.add('open');
}

async function analyzeReply() {
  const raw = document.getElementById('replyText').value.trim();
  if (!raw) { toast('Collez d\'abord la réponse du prospect', 'error'); return; }

  showLoader('🤖 Analyse de la réponse...');
  try {
    const result = await api.post(`/prospects/${_replyProspectId}/reply-assistant`, {
      raw_message: raw,
      source: document.getElementById('replySource').value
    });
    hideLoader();

    document.getElementById('replyResults').innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <span class="badge badge-accent">Type : ${escHtml(result.objection_type || 'N/A')}</span>
          <span style="font-size:12px;color:var(--muted2);padding:4px 10px;background:var(--panel2);border-radius:999px;">➡️ ${escHtml(result.next_best_action || '')}</span>
        </div>
      </div>
      ${replyCard('Réponse courte', result.suggested_reply_short)}
      ${replyCard('Réponse commerciale', result.suggested_reply_sales)}
      ${replyCard('Proposition de RDV', result.suggested_reply_meeting)}
      ${result.objection_type === 'prix' ? replyCard('Objection prix', result.suggested_reply_objection_prix) : ''}
      ${result.objection_type === 'pas_de_besoin' ? replyCard('Pas de besoin immédiat', result.suggested_reply_no_need) : ''}
      ${result.objection_type === 'refus_poli' || result.objection_type === 'perdu' ? replyCard('Refus poli', result.suggested_reply_refus) : ''}
    `;
    document.getElementById('btnAnalyzeReply').textContent = '🔄 Réanalyser';
  } catch (err) {
    hideLoader();
    toast('❌ ' + err.message, 'error');
  }
}

function replyCard(label, text) {
  if (!text) return '';
  return `
    <div class="reply-card">
      <div class="reply-card-label">
        ${escHtml(label)}
        <button class="btn btn-xs btn-ghost" onclick="copyText(${JSON.stringify(text)})">📋 Copier</button>
      </div>
      <div class="reply-card-body">${escHtml(text)}</div>
    </div>`;
}

// ── Export ─────────────────────────────────────────────────────
async function exportData(format) {
  if (DEMO_MODE) {
    if (format === 'json') {
      downloadFile('prospects-demo.json', JSON.stringify(DEMO_PROSPECTS, null, 2), 'application/json');
    } else {
      const cols = ['id','entreprise','ville','secteur','email','telephone','score','score_classe','statut'];
      const rows = DEMO_PROSPECTS.map(p => cols.map(c => `"${(p[c] || '').toString().replace(/"/g, '""')}"`).join(';'));
      downloadFile('prospects-demo.csv', '\uFEFF' + [cols.join(';'), ...rows].join('\n'), 'text/csv');
    }
    toast('✅ Export téléchargé (données démo)', 'success');
    return;
  }
  window.location.href = `${API_BASE}/export/${format}`;
}

function downloadFile(filename, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Modal helpers ──────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

// ── Sidebar mobile ─────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}

// ── Toast ──────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span> <span>${escHtml(message)}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

// ── Loader ─────────────────────────────────────────────────────
function showLoader(text = 'Chargement...') {
  document.getElementById('loaderText').textContent = text;
  document.getElementById('loader').classList.add('on');
}
function hideLoader() {
  document.getElementById('loader').classList.remove('on');
}

// ── Utils ──────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
}

function fmtDateTime(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

function isPast(dateStr) {
  return dateStr && new Date(dateStr) < new Date();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copié dans le presse-papier', 'success'));
}

function updateNavCount(n) {
  const el = document.getElementById('nav-count');
  if (el) el.textContent = n;
}

function infoBlock(label, value) {
  if (!value) return '';
  return `<div class="info-block"><div class="info-block-label">${label}</div><div class="info-block-value">${escHtml(value)}</div></div>`;
}

function msgBlock(title, content, special) {
  if (!content) return '';
  const isLinkedin = special === 'linkedin-warning';
  return `
    <div class="msg-block">
      <div class="msg-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
        <span class="msg-header-title">${title}</span>
        <div style="display:flex;gap:8px;">
          ${isLinkedin ? '<span style="font-size:10px;color:#f59e0b;background:rgba(245,158,11,.1);padding:2px 7px;border-radius:4px;">Manuel uniquement</span>' : ''}
          <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();copyText(${JSON.stringify(content)})">📋</button>
        </div>
      </div>
      <div class="msg-body">${escHtml(content)}</div>
    </div>`;
}

function statutLabel(s) {
  const labels = {
    nouveau:            'Nouveau',
    a_qualifier:        'À qualifier',
    qualifie:           'Qualifié',
    pret_a_contacter:   'Prêt à contacter',
    contacte:           'Contacté',
    relance_1_envoyee:  'Relance 1',
    relance_2_envoyee:  'Relance 2',
    repondu:            'Répondu',
    rdv_planifie:       'RDV planifié',
    opportunite:        'Opportunité',
    client_gagne:       '🏆 Client gagné',
    perdu:              'Perdu',
    sans_suite:         'Sans suite',
    // legacy
    a_contacter: 'À contacter', analyse_en_cours: 'En analyse',
    contact_envoye: 'Contacté', en_attente: 'En attente',
    relance_a_faire: 'Relance', rdv: 'RDV',
  };
  return labels[s] || s;
}

function eventTypeLabel(t) {
  const labels = {
    created: 'Prospect créé', updated: 'Fiche mise à jour',
    enriched: 'Enrichissement IA', enrichment_started: 'Analyse lancée',
    status_changed: 'Statut modifié', message_generated: 'Messages générés',
    task_created: 'Tâche créée', reply_analyzed: 'Réponse analysée'
  };
  return labels[t] || t;
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled rejection:', e.reason);
  });

  if (DEMO_MODE) {
    document.getElementById('demoBanner').style.display = 'block';
    await navigate('dashboard');
    return;
  }

  // Réveil du serveur Render (peut prendre 50s sur plan gratuit)
  const banner = document.getElementById('demoBanner');
  banner.style.display = 'block';
  banner.innerHTML = '⏳ Démarrage du serveur en cours (plan gratuit Render, ~30-50s)...';

  try {
    const res = await fetch(API_BASE.replace('/api', '/health'), { signal: AbortSignal.timeout(65000) });
    if (!res.ok) throw new Error();
    banner.style.display = 'none';
    await navigate('dashboard');
  } catch {
    DEMO_MODE = true;
    banner.innerHTML = '<strong>⚠️ Backend inaccessible</strong> Mode démo activé. <button onclick="location.reload()" style="margin-left:8px;padding:2px 8px;border:1px solid currentColor;border-radius:4px;cursor:pointer;background:transparent;color:inherit;font-size:12px;">Réessayer</button>';
    await navigate('dashboard');
  }
}

init();
