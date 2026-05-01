const db = require('../config/supabase');

function assertOk(error, context) {
  if (error) {
    const msg = `[Supabase:${context}] ${error.message || JSON.stringify(error)}`;
    const err = new Error(msg);
    err.statusCode = error.code === 'PGRST116' ? 404 : 500;
    throw err;
  }
}

// ── Normalisation données ────────────────────────────────────

function normalizeUrl(url) {
  if (!url) return null;
  let u = url.trim().replace(/\/$/, '').toLowerCase();
  if (u && !u.match(/^https?:\/\//)) u = 'https://' + u;
  return u || null;
}

const ALLOWED_FIELDS = [
  'entreprise','ville','secteur','site_web','contact_nom','contact_role',
  'linkedin_url','email','telephone','notes','statut',
  'score','score_classe','score_total','score_reasoning',
  'score_pertinence_secteur','score_besoin_logistique','score_compatibilite_geo',
  'score_potentiel_volume','score_probabilite_reponse','score_complexite_op','score_fit_colixo',
  'resume','besoin_detecte','angle_commercial','objections_probables',
  'logistic_signals','confidence_score','analysis_quality',
  'message_connexion','message_connexion_premium','message_1','relance_1',
  'relance_2','email_1','email_relance','script_appel','enriched_at',
];

function sanitize(payload, isCreate = false) {
  const out = {};
  ALLOWED_FIELDS.forEach(k => {
    const v = payload[k];
    if (v !== undefined && v !== '') out[k] = v;
  });

  // Normalisation
  if (out.email)     out.email     = out.email.trim().toLowerCase();
  if (out.site_web)  out.site_web  = normalizeUrl(out.site_web);
  if (out.linkedin_url) out.linkedin_url = normalizeUrl(out.linkedin_url);
  if (out.entreprise) out.entreprise = out.entreprise.trim();

  if (isCreate && !out.statut) out.statut = 'nouveau';

  return out;
}

// ── Déduplication ─────────────────────────────────────────────

async function findDuplicate(payload) {
  const checks = [];

  if (payload.email) {
    checks.push({ field: 'email',    value: payload.email.toLowerCase() });
  }
  if (payload.site_web) {
    checks.push({ field: 'site_web', value: normalizeUrl(payload.site_web) });
  }

  // Correspondance exacte entreprise + ville
  if (payload.entreprise && payload.ville) {
    const { data } = await db.from('prospects')
      .select('id, entreprise, ville, email, statut')
      .ilike('entreprise', payload.entreprise.trim())
      .ilike('ville', payload.ville.trim())
      .limit(1);
    if (data && data.length > 0) {
      return { duplicate: data[0], matchedOn: 'entreprise + ville' };
    }
  }

  for (const { field, value } of checks) {
    if (!value) continue;
    const { data } = await db.from('prospects')
      .select('id, entreprise, ville, email, statut')
      .eq(field, value)
      .limit(1);
    if (data && data.length > 0) {
      return { duplicate: data[0], matchedOn: field };
    }
  }

  return null;
}

// ── Prospects ────────────────────────────────────────────────

async function getAllProspects({ statut, secteur, score_classe, search, sort, page = 0, limit = 100 } = {}) {
  let q = db.from('prospects').select('*', { count: 'exact' });

  if (statut)       q = q.eq('statut', statut);
  if (secteur)      q = q.eq('secteur', secteur);
  if (score_classe) q = q.eq('score_classe', score_classe);
  if (search)       q = q.or(
    `entreprise.ilike.%${search}%,ville.ilike.%${search}%,secteur.ilike.%${search}%,contact_nom.ilike.%${search}%`
  );

  if (sort === 'score')       q = q.order('score', { ascending: false });
  else if (sort === 'activite') q = q.order('updated_at', { ascending: false });
  else                          q = q.order('created_at', { ascending: false });

  const from = page * limit;
  q = q.range(from, from + limit - 1);

  const { data, count, error } = await q;
  assertOk(error, 'getAllProspects');
  return { items: data, total: count, page, limit };
}

async function getProspectById(id) {
  const { data, error } = await db.from('prospects').select('*').eq('id', id).single();
  assertOk(error, 'getProspectById');
  return data;
}

async function createProspect(payload) {
  const clean = sanitize(payload, true);
  const { data, error } = await db.from('prospects').insert([clean]).select().single();
  assertOk(error, 'createProspect');
  return data;
}

async function updateProspect(id, payload) {
  const clean = sanitize(payload, false);
  const { data, error } = await db.from('prospects').update(clean).eq('id', id).select().single();
  assertOk(error, 'updateProspect');
  return data;
}

async function deleteProspect(id) {
  const { error } = await db.from('prospects').delete().eq('id', id);
  assertOk(error, 'deleteProspect');
}

// ── Sauvegarde enrichissement ─────────────────────────────────

async function saveEnrichment(id, enrichment) {
  const fields = {
    resume:                    enrichment.resume,
    besoin_detecte:            enrichment.besoin_detecte,
    angle_commercial:          enrichment.angle_commercial,
    objections_probables:      enrichment.objections_probables,
    score:                     enrichment.score_total,
    score_classe:              enrichment.score_classe,
    score_reasoning:           enrichment.score_reasoning,
    score_pertinence_secteur:  enrichment.score_pertinence_secteur,
    score_besoin_logistique:   enrichment.score_besoin_logistique,
    score_compatibilite_geo:   enrichment.score_compatibilite_geo,
    score_potentiel_volume:    enrichment.score_potentiel_volume,
    score_probabilite_reponse: enrichment.score_probabilite_reponse,
    score_complexite_op:       enrichment.score_complexite_op,
    score_fit_colixo:          enrichment.score_fit_colixo,
    logistic_signals:          enrichment.logistic_signals || [],
    confidence_score:          enrichment.confidence_score,
    analysis_quality:          enrichment.analysis_quality,
    message_connexion:         enrichment.message_connexion,
    message_connexion_premium: enrichment.message_connexion_premium,
    message_1:                 enrichment.message_1,
    email_relance:             enrichment.email_relance,
    script_appel:              enrichment.script_appel,
    enriched_at:               new Date().toISOString(),
    statut:                    'pret_a_contacter',
  };

  const { data, error } = await db.from('prospects').update(fields).eq('id', id).select().single();
  assertOk(error, 'saveEnrichment');
  return data;
}

// ── Events ───────────────────────────────────────────────────

async function addEvent(prospect_id, event_type, event_value = null, event_payload = null) {
  const row = { prospect_id, event_type, event_value };
  if (event_payload) row.event_payload = event_payload;
  const { error } = await db.from('prospect_events').insert([row]);
  if (error) console.warn('[addEvent]', error.message);
}

async function getEvents(prospect_id) {
  const { data, error } = await db.from('prospect_events')
    .select('*')
    .eq('prospect_id', prospect_id)
    .order('created_at', { ascending: false });
  assertOk(error, 'getEvents');
  return data;
}

// ── Tasks ─────────────────────────────────────────────────────

async function getTasks(prospect_id) {
  const { data, error } = await db.from('prospect_tasks')
    .select('*')
    .eq('prospect_id', prospect_id)
    .order('due_date', { ascending: true });
  assertOk(error, 'getTasks');
  return data;
}

async function getAllTasks(filters = {}) {
  let q = db.from('prospect_tasks')
    .select('*, prospects(id, entreprise, ville, statut)')
    .order('due_date', { ascending: true });
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  assertOk(error, 'getAllTasks');
  return data;
}

async function createTask(payload) {
  const { data, error } = await db.from('prospect_tasks').insert([payload]).select().single();
  assertOk(error, 'createTask');
  return data;
}

async function updateTaskStatus(id, status) {
  const { data, error } = await db.from('prospect_tasks').update({ status }).eq('id', id).select().single();
  assertOk(error, 'updateTaskStatus');
  return data;
}

// ── Replies ───────────────────────────────────────────────────

async function saveReply(payload) {
  const { data, error } = await db.from('replies').insert([payload]).select().single();
  assertOk(error, 'saveReply');
  return data;
}

// ── Stats dashboard ───────────────────────────────────────────

async function getDashboardStats() {
  const { data, error } = await db.from('prospects')
    .select('statut, score_classe, secteur, score');
  assertOk(error, 'getDashboardStats');

  const total    = data.length;
  const chauds   = data.filter(p => (p.score || 0) >= 70).length;
  const relances = data.filter(p => ['relance_1_envoyee','relance_2_envoyee'].includes(p.statut)).length;
  const rdv      = data.filter(p => ['rdv_planifie','opportunite','client_gagne'].includes(p.statut)).length;

  const contactes = data.filter(p =>
    !['nouveau','a_qualifier','qualifie','pret_a_contacter'].includes(p.statut)
  ).length;
  const repondus = data.filter(p =>
    ['repondu','rdv_planifie','opportunite','client_gagne'].includes(p.statut)
  ).length;

  const tauxReponse    = contactes > 0 ? Math.round(repondus / contactes * 100) : 0;
  const tauxConversion = repondus  > 0 ? Math.round(rdv / repondus * 100) : 0;

  const bySecteur = {};
  const byStatut  = {};
  const byClasse  = { A: 0, B: 0, C: 0 };

  data.forEach(p => {
    const s = p.secteur || 'Non défini';
    bySecteur[s] = (bySecteur[s] || 0) + 1;
    byStatut[p.statut]  = (byStatut[p.statut]  || 0) + 1;
    if (p.score_classe) byClasse[p.score_classe] = (byClasse[p.score_classe] || 0) + 1;
  });

  return { total, chauds, relances, rdv, tauxReponse, tauxConversion, bySecteur, byStatut, byClasse };
}

module.exports = {
  getAllProspects, getProspectById, createProspect, updateProspect, deleteProspect,
  findDuplicate, saveEnrichment,
  addEvent, getEvents,
  getTasks, getAllTasks, createTask, updateTaskStatus,
  saveReply,
  getDashboardStats,
};
