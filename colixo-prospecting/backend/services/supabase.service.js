const db = require('../../config/supabase');

// Lève une erreur lisible à partir d'une réponse Supabase
function assertOk(error, context) {
  if (error) {
    const msg = `[Supabase:${context}] ${error.message || JSON.stringify(error)}`;
    const err = new Error(msg);
    err.statusCode = error.code === 'PGRST116' ? 404 : 500;
    throw err;
  }
}

// ── Prospects ───────────────────────────────────────────────

async function getAllProspects({ statut, secteur, search } = {}) {
  let q = db.from('prospects').select('*').order('created_at', { ascending: false });

  if (statut)  q = q.eq('statut', statut);
  if (secteur) q = q.eq('secteur', secteur);
  if (search)  q = q.or(`entreprise.ilike.%${search}%,ville.ilike.%${search}%,secteur.ilike.%${search}%`);

  const { data, error } = await q;
  assertOk(error, 'getAllProspects');
  return data;
}

async function getProspectById(id) {
  const { data, error } = await db.from('prospects').select('*').eq('id', id).single();
  assertOk(error, 'getProspectById');
  return data;
}

async function createProspect(payload) {
  const { data, error } = await db.from('prospects').insert([payload]).select().single();
  assertOk(error, 'createProspect');
  return data;
}

async function updateProspect(id, payload) {
  const { data, error } = await db.from('prospects').update(payload).eq('id', id).select().single();
  assertOk(error, 'updateProspect');
  return data;
}

async function deleteProspect(id) {
  const { error } = await db.from('prospects').delete().eq('id', id);
  assertOk(error, 'deleteProspect');
}

// ── Events ───────────────────────────────────────────────────

async function addEvent(prospect_id, event_type, event_value = null) {
  const { error } = await db.from('prospect_events').insert([{ prospect_id, event_type, event_value }]);
  // Erreur non fatale sur l'événement — on loggue seulement
  if (error) console.warn('[Supabase:addEvent]', error.message);
}

async function getEvents(prospect_id) {
  const { data, error } = await db.from('prospect_events')
    .select('*')
    .eq('prospect_id', prospect_id)
    .order('created_at', { ascending: false });
  assertOk(error, 'getEvents');
  return data;
}

// ── Tasks ────────────────────────────────────────────────────

async function getTasks(prospect_id) {
  const { data, error } = await db.from('prospect_tasks')
    .select('*')
    .eq('prospect_id', prospect_id)
    .order('due_date', { ascending: true });
  assertOk(error, 'getTasks');
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

// ── Replies ──────────────────────────────────────────────────

async function saveReply(payload) {
  const { data, error } = await db.from('replies').insert([payload]).select().single();
  assertOk(error, 'saveReply');
  return data;
}

// ── Stats dashboard ──────────────────────────────────────────

async function getDashboardStats() {
  const { data, error } = await db.from('prospects').select('statut, score_classe, secteur, score');
  assertOk(error, 'getDashboardStats');

  const total     = data.length;
  const chauds    = data.filter(p => p.score >= 70).length;
  const relances  = data.filter(p => p.statut === 'relance_a_faire').length;
  const rdv       = data.filter(p => p.statut === 'rdv' || p.statut === 'opportunite').length;
  const contactes = data.filter(p => !['a_contacter','analyse_en_cours','pret_a_contacter'].includes(p.statut)).length;
  const repondus  = data.filter(p => ['repondu','rdv','opportunite'].includes(p.statut)).length;

  const tauxReponse     = contactes > 0 ? Math.round(repondus / contactes * 100) : 0;
  const tauxConversion  = repondus  > 0 ? Math.round(rdv / repondus * 100) : 0;

  // Répartition par secteur
  const bySecteur = {};
  data.forEach(p => {
    const s = p.secteur || 'Non défini';
    bySecteur[s] = (bySecteur[s] || 0) + 1;
  });

  // Répartition par statut
  const byStatut = {};
  data.forEach(p => {
    byStatut[p.statut] = (byStatut[p.statut] || 0) + 1;
  });

  return { total, chauds, relances, rdv, tauxReponse, tauxConversion, bySecteur, byStatut };
}

module.exports = {
  getAllProspects, getProspectById, createProspect, updateProspect, deleteProspect,
  addEvent, getEvents,
  getTasks, createTask, updateTaskStatus,
  saveReply,
  getDashboardStats
};
