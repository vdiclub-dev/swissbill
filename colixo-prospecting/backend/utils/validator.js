const VALID_STATUTS = [
  'nouveau','a_qualifier','qualifie','pret_a_contacter',
  'contacte','relance_1_envoyee','relance_2_envoyee','repondu',
  'rdv_planifie','opportunite','client_gagne','perdu','sans_suite',
];

function validateProspect(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['Corps de requête invalide'] };
  }

  const entreprise = (data.entreprise || '').trim();
  if (!entreprise) errors.push('Le champ "entreprise" est requis');
  if (entreprise.length > 200) errors.push('"entreprise" dépasse 200 caractères');

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.push('Format email invalide');
  }

  if (data.score !== undefined && data.score !== null && data.score !== '') {
    const s = Number(data.score);
    if (isNaN(s) || s < 0 || s > 100) errors.push('"score" doit être entre 0 et 100');
  }

  if (data.statut && !VALID_STATUTS.includes(data.statut)) {
    errors.push(`Statut invalide. Valeurs: ${VALID_STATUTS.join(', ')}`);
  }

  return { ok: errors.length === 0, errors };
}

function validateTask(data) {
  const errors = [];
  if (!data?.title?.trim()) errors.push('Le champ "title" est requis');
  if (data.title?.length > 500) errors.push('"title" dépasse 500 caractères');
  if (data.due_date && isNaN(Date.parse(data.due_date))) {
    errors.push('"due_date" invalide (format: YYYY-MM-DD)');
  }
  return { ok: errors.length === 0, errors };
}

function validateReply(data) {
  const errors = [];
  if (!data?.raw_message?.trim()) errors.push('"raw_message" est requis');
  if ((data.raw_message || '').length > 5000) errors.push('"raw_message" dépasse 5000 caractères');
  const VALID_SOURCES = ['email','linkedin','phone','other'];
  if (data.source && !VALID_SOURCES.includes(data.source)) {
    errors.push(`Source invalide. Valeurs: ${VALID_SOURCES.join(', ')}`);
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { validateProspect, validateTask, validateReply, VALID_STATUTS };
