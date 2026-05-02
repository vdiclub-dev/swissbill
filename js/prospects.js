// ============================================================
// js/prospects.js — CRM Prospects Colixo
// Dépendances : config.js (window.SUPABASE_CLIENT)
// ============================================================

/* ── Callback client-picker ─────────────────────────────── */
function remplirClientProspect(c) {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  set('fEntreprise',  c.nom);
  set('fVille2',      c.ville);
  set('fContactNom',  c.contact_nom);
  set('fEmail',       c.email);
  set('fTelephone',   c.telephone);
}
window.remplirClientProspect = remplirClientProspect;

/* ── État global ─────────────────────────────────────────── */
let allProspects   = [];   // données brutes depuis Supabase
let filtered       = [];   // après application des filtres
let detailProspect = null; // prospect ouvert en fiche
let editMode       = false;

const STATUTS = {
  a_contacter:  { label: 'À contacter',   color: '#6b7280' },
  contacte:     { label: 'Contacté',       color: '#3b82f6' },
  interesse:    { label: 'Intéressé',      color: '#f59e0b' },
  devis_envoye: { label: 'Devis envoyé',   color: '#8b5cf6' },
  relance:      { label: 'Relancé',        color: '#ec4899' },
  signe:        { label: 'Signé 🏆',       color: '#22c55e' },
  perdu:        { label: 'Perdu',          color: '#ef4444' },
};

/* ── Utilitaires ─────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(s) { return s ? String(s) : ''; }

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copié';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  });
}

function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  document.getElementById('toastZone').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ── Score & classe ──────────────────────────────────────── */
function calculerScore(d) {
  let s = 0;
  const sec = (d.secteur || '').toLowerCase();
  if (/pharmacie|médical|médecin|clinique|santé/.test(sec))       s += 20;
  else if (/garage|auto|pièce|véhicule|carrosserie/.test(sec))    s += 20;
  else if (/e-commerce|ecommerce|boutique en ligne|web/.test(sec))s += 25;
  else if (/industrie|fournisseur|b2b|manufacture|usine/.test(sec))s += 20;
  else if (/vin|caviste|vignoble|cave|alcool/.test(sec))          s += 15;
  if (d.email)            s += 10;
  if (d.telephone)        s += 10;
  if (d.site_web)         s += 10;
  if (d.besoin_detecte)   s += 15;
  if (d.angle_commercial) s += 10;
  return Math.min(100, s);
}

function classeScore(score) {
  if (score >= 80) return { label: 'Chaud 🔥',       cls: 'hot' };
  if (score >= 60) return { label: 'Intéressant',     cls: 'warm' };
  if (score >= 40) return { label: 'Moyen',           cls: 'neutral' };
  return              { label: 'Faible',              cls: 'cold' };
}

/* ── Génération messages ─────────────────────────────────── */
function genererMessages(d) {
  const entreprise = d.entreprise || 'votre entreprise';
  const contact    = d.contact_nom || 'Madame, Monsieur';
  const ville      = d.ville ? ` à ${d.ville}` : '';
  const secteur    = d.secteur || 'votre secteur';
  const besoin     = d.besoin_detecte ? `\n\nNous avons identifié que ${d.besoin_detecte}.` : '';
  const angle      = d.angle_commercial ? `\n\n${d.angle_commercial}` : '';

  return {
    message_connexion:
`Bonjour ${contact},

Je représente Colixo, service de livraison express B2B en Suisse romande. Votre activité dans le domaine ${secteur}${ville} pourrait bénéficier de notre offre — délais J+1, suivi en temps réel, sans engagement.

Seriez-vous disponible pour un bref échange cette semaine ?

Cordialement,
L'équipe Colixo`,

    message_1:
`Bonjour ${contact},

Merci d'avoir accepté ma connexion. Colixo accompagne des entreprises du secteur ${secteur} avec des livraisons express J+1 fiables en Suisse romande.${besoin}

Auriez-vous 10 minutes cette semaine pour en discuter ?

Cordialement,
L'équipe Colixo`,

    relance_1:
`Bonjour ${contact},

Je me permets de revenir vers vous suite à mon message précédent. Avez-vous eu l'occasion d'y réfléchir ?

Je reste à votre disposition pour un échange de 10 minutes.

Cordialement,
L'équipe Colixo`,

    relance_2:
`Bonjour ${contact},

Je ne voudrais pas vous importuner davantage. Si un besoin logistique devait se présenter, n'hésitez pas à revenir vers nous.

Bonne continuation,
L'équipe Colixo`,

    email_1:
`Objet : Livraison express B2B — Colixo pour ${entreprise}

Bonjour ${contact},

Colixo accompagne des entreprises ${secteur ? 'du secteur ' + secteur : 'B2B'} avec des livraisons express J+1 en Suisse romande.${besoin}${angle}

Seriez-vous disponible 10 minutes cette semaine pour évaluer si notre offre correspond à vos besoins ?

Cordialement,
L'équipe Colixo
info@colixo.ch — colixo.ch`,

    email_relance:
`Objet : Re : Livraison express B2B — Colixo

Bonjour ${contact},

Je me permets de revenir vers vous. Avez-vous eu l'occasion de consulter mon précédent message ?

Nous proposons un essai sur 5 livraisons sans engagement — ce serait l'occasion de constater la fiabilité de notre service.

Cordialement,
L'équipe Colixo`,

    script_appel:
`Introduction :
"Bonjour, je contacte ${entreprise} depuis Colixo, service de livraison express B2B en Suisse romande. Avez-vous quelques minutes ?"

Question 1 : "Quel est votre volume de livraisons mensuel actuellement ?"
Question 2 : "Avez-vous des contraintes de délais ou de créneaux particulières ?"
Question 3 : "Travaillez-vous déjà avec un prestataire logistique ?"

Proposition :
"Nous proposons un essai sur 5 livraisons sans engagement. Cela vous permettrait de constater notre réactivité directement. Cela vous intéresserait-il ?"

Objection prix :
"Je comprends. Le coût d'une livraison non conforme dépasse souvent l'écart tarifaire. Nous pourrions étudier une structure adaptée à votre volume."

Clôture :
"Je vous propose le [date] à [heure] pour un échange de 15 minutes — en vidéo ou par téléphone. Cela vous convient ?"`,
  };
}

/* ── Chargement depuis Supabase ──────────────────────────── */
async function chargerProspects() {
  const db = window.SUPABASE_CLIENT;
  if (!db) { toast('Client Supabase non initialisé', 'error'); return; }

  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('prospectGrid').style.display = 'none';
  document.getElementById('emptyState').style.display   = 'none';

  const { data, error } = await db
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false });

  document.getElementById('loadingState').style.display = 'none';

  if (error) {
    toast('Erreur Supabase : ' + error.message, 'error');
    return;
  }

  allProspects = data || [];
  appliquerFiltres();
  mettreAJourStats();
}

/* ── Filtres ─────────────────────────────────────────────── */
function appliquerFiltres() {
  const q       = (document.getElementById('fSearch').value  || '').toLowerCase();
  const ville   = (document.getElementById('fVille').value   || '').toLowerCase();
  const secteur = (document.getElementById('fSecteur').value || '').toLowerCase();
  const statut  =  document.getElementById('fStatut').value  || '';
  const scoreMin= parseInt(document.getElementById('fScore').value) || 0;

  filtered = allProspects.filter(p => {
    if (scoreMin > 0 && (p.score || 0) < scoreMin) return false;
    if (statut && p.statut !== statut) return false;
    if (ville && !(p.ville || '').toLowerCase().includes(ville)) return false;
    if (secteur && !(p.secteur || '').toLowerCase().includes(secteur)) return false;
    if (q) {
      const blob = [p.entreprise, p.ville, p.secteur, p.contact_nom, p.email, p.notes].join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  renderCartes();
}

/* ── Stats ───────────────────────────────────────────────── */
function mettreAJourStats() {
  const total    = allProspects.length;
  const aContact = allProspects.filter(p => p.statut === 'a_contacter').length;
  const interess = allProspects.filter(p => p.statut === 'interesse').length;
  const signes   = allProspects.filter(p => p.statut === 'signe').length;
  const scores   = allProspects.map(p => p.score || 0).filter(s => s > 0);
  const scoreMoy = scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : 0;

  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statContact').textContent  = aContact;
  document.getElementById('statInteress').textContent = interess;
  document.getElementById('statSignes').textContent   = signes;
  document.getElementById('statScore').textContent    = scoreMoy || '—';
}

/* ── Rendu cartes ────────────────────────────────────────── */
function renderCartes() {
  const grid  = document.getElementById('prospectGrid');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('resultCount');

  count.textContent = filtered.length + ' prospect' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    grid.style.display  = 'none';
    empty.style.display = 'flex';
    return;
  }

  grid.style.display  = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(p => carteHTML(p)).join('');
}

function carteHTML(p) {
  const score  = p.score  || 0;
  const cls    = classeScore(score);
  const statut = STATUTS[p.statut] || STATUTS['a_contacter'];

  const siteLien    = p.site_web    ? `<a href="${esc(p.site_web)}" target="_blank" class="card-action-btn" title="Site web">🌐</a>` : '';
  const linkedinLien= p.linkedin_url? `<a href="${esc(p.linkedin_url)}" target="_blank" class="card-action-btn" title="LinkedIn">💼</a>` : '';
  const emailLien   = p.email       ? `<a href="mailto:${esc(p.email)}" class="card-action-btn" title="Envoyer email">✉️</a>` : '';
  const telLien     = p.telephone   ? `<a href="tel:${esc(p.telephone)}" class="card-action-btn" title="Appeler">📞</a>` : '';

  const statutOptions = Object.entries(STATUTS).map(([k, v]) =>
    `<option value="${k}" ${p.statut === k ? 'selected' : ''}>${v.label}</option>`
  ).join('');

  return `<div class="prospect-card" id="card-${p.id}">
    <div class="card-top">
      <div class="card-score-badge ${cls.cls}">${score}</div>
      <div class="card-meta">
        <div class="card-entreprise">${esc(p.entreprise)}</div>
        <div class="card-sub">${[p.ville, p.secteur].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
      <select class="statut-select" title="Statut" onchange="changerStatut('${p.id}', this.value)" style="border-color:${statut.color};color:${statut.color};">
        ${statutOptions}
      </select>
    </div>

    ${p.contact_nom ? `<div class="card-contact">👤 ${esc(p.contact_nom)}${p.contact_role ? ' <span class="muted">· ' + esc(p.contact_role) + '</span>' : ''}</div>` : ''}
    ${p.email       ? `<div class="card-contact">✉️ <span class="muted">${esc(p.email)}</span></div>` : ''}
    ${p.telephone   ? `<div class="card-contact">📞 <span class="muted">${esc(p.telephone)}</span></div>` : ''}
    ${p.besoin_detecte ? `<div class="card-besoin">💡 ${esc(p.besoin_detecte)}</div>` : ''}

    <div class="card-bottom">
      <div class="card-actions-row">
        ${siteLien}${linkedinLien}${emailLien}${telLien}
      </div>
      <div class="card-btns">
        ${p.message_connexion || p.message_1 ? `<button class="cbtn cbtn-copy" onclick="copierMessage('${p.id}', 'linkedin')">📋 LinkedIn</button>` : ''}
        ${p.email_1 ? `<button class="cbtn cbtn-copy" onclick="copierMessage('${p.id}', 'email')">📋 Email</button>` : ''}
        <button class="cbtn cbtn-detail" onclick="ouvrirDetail('${p.id}')">Fiche →</button>
      </div>
    </div>
  </div>`;
}

/* ── Actions carte ───────────────────────────────────────── */
async function changerStatut(id, statut) {
  const db = window.SUPABASE_CLIENT;
  const { error } = await db.from('prospects').update({ statut, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('Erreur mise à jour statut', 'error'); return; }
  const p = allProspects.find(x => x.id === id);
  if (p) p.statut = statut;
  mettreAJourStats();
  toast('Statut mis à jour');
}

function copierMessage(id, type) {
  const p = allProspects.find(x => x.id === id);
  if (!p) return;
  const txt = type === 'linkedin' ? (p.message_connexion || p.message_1 || '') : (p.email_1 || '');
  const btn = event.target;
  navigator.clipboard.writeText(txt).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copié !';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  });
}

/* ── Fiche détail ────────────────────────────────────────── */
function ouvrirDetail(id) {
  detailProspect = allProspects.find(x => x.id === id);
  if (!detailProspect) return;
  renderDetail(detailProspect);
  document.getElementById('modalDetail').classList.add('open');
}

function fermerDetail() {
  document.getElementById('modalDetail').classList.remove('open');
  detailProspect = null;
}

function renderDetail(p) {
  const score = p.score || 0;
  const cls   = classeScore(score);
  const statut= STATUTS[p.statut] || STATUTS['a_contacter'];

  const html = `
    <div class="detail-hero">
      <div class="detail-score ${cls.cls}">${score}<span>${cls.label}</span></div>
      <div class="detail-title">
        <h2>${esc(p.entreprise)}</h2>
        <div class="detail-sub">${[p.ville, p.secteur].filter(Boolean).map(esc).join(' · ')}</div>
        <span class="statut-pill" style="background:${statut.color}20;color:${statut.color};border:1px solid ${statut.color}40;">${statut.label}</span>
      </div>
    </div>

    <div class="detail-grid">
      ${infoItem('Contact', [p.contact_nom, p.contact_role].filter(Boolean).join(' — '))}
      ${infoItem('Email',   p.email, p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '')}
      ${infoItem('Téléphone', p.telephone, p.telephone ? `<a href="tel:${esc(p.telephone)}">${esc(p.telephone)}</a>` : '')}
      ${infoItem('Site web', p.site_web, p.site_web ? `<a href="${esc(p.site_web)}" target="_blank">${esc(p.site_web)}</a>` : '')}
      ${infoItem('LinkedIn', p.linkedin_url, p.linkedin_url ? `<a href="${esc(p.linkedin_url)}" target="_blank">Ouvrir →</a>` : '')}
      ${infoItem('Créé le', p.created_at ? new Date(p.created_at).toLocaleDateString('fr-CH') : '')}
    </div>

    ${p.resume           ? `<div class="detail-block"><div class="detail-block-lbl">Résumé</div><p>${esc(p.resume)}</p></div>` : ''}
    ${p.besoin_detecte   ? `<div class="detail-block"><div class="detail-block-lbl">💡 Besoin détecté</div><p>${esc(p.besoin_detecte)}</p></div>` : ''}
    ${p.angle_commercial ? `<div class="detail-block"><div class="detail-block-lbl">🎯 Angle commercial</div><p>${esc(p.angle_commercial)}</p></div>` : ''}
    ${p.objections_probables ? `<div class="detail-block"><div class="detail-block-lbl">⚠️ Objections probables</div><p>${esc(p.objections_probables)}</p></div>` : ''}
    ${p.notes            ? `<div class="detail-block"><div class="detail-block-lbl">Notes</div><p>${esc(p.notes)}</p></div>` : ''}

    ${msgBlock('💼 Message LinkedIn (connexion)', p.message_connexion, 'msg_connexion')}
    ${msgBlock('💬 Message LinkedIn (suivi)', p.message_1, 'msg_1')}
    ${msgBlock('🔁 Relance 1', p.relance_1, 'rel_1')}
    ${msgBlock('📧 Email de prospection', p.email_1, 'email_1')}
    ${msgBlock('📞 Script d\'appel', p.script_appel, 'script')}
  `;

  document.getElementById('detailContent').innerHTML = html;
}

function infoItem(label, val, html = '') {
  if (!val && !html) return '';
  return `<div class="detail-info-item"><div class="detail-info-lbl">${label}</div><div class="detail-info-val">${html || esc(val)}</div></div>`;
}

function msgBlock(title, content, id) {
  if (!content) return '';
  return `<div class="detail-block msg-block">
    <div class="detail-block-lbl">${title}
      <button class="cbtn cbtn-copy sm" onclick="copierTexte('${id}')">📋 Copier</button>
    </div>
    <pre id="txt-${id}" class="msg-pre">${esc(content)}</pre>
  </div>`;
}

function copierTexte(id) {
  const el = document.getElementById('txt-' + id);
  if (!el) return;
  const btn = event.target;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  });
}

/* ── Formulaire ajout prospect ───────────────────────────── */
function ouvrirFormAjout() {
  document.getElementById('prospectForm').reset();
  document.getElementById('modalAjout').classList.add('open');
}

function fermerAjout() {
  document.getElementById('modalAjout').classList.remove('open');
}

async function soumettreProspect(e) {
  e.preventDefault();
  const db  = window.SUPABASE_CLIENT;
  const btn = document.getElementById('btnSauvegarder');
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  const get = id => (document.getElementById(id)?.value || '').trim();

  const payload = {
    entreprise:       get('fEntreprise'),
    ville:            get('fVille2'),
    secteur:          get('fSecteur2'),
    site_web:         get('fSiteWeb'),
    contact_nom:      get('fContactNom'),
    contact_role:     get('fContactRole'),
    email:            get('fEmail'),
    telephone:        get('fTelephone'),
    linkedin_url:     get('fLinkedin'),
    besoin_detecte:   get('fBesoin'),
    angle_commercial: get('fAngle'),
    notes:            get('fNotes'),
    statut:           get('fStatut2') || 'a_contacter',
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };

  if (!payload.entreprise) { toast('Le nom d\'entreprise est obligatoire', 'error'); btn.disabled = false; btn.textContent = 'Enregistrer'; return; }

  // Calcul score & messages
  payload.score        = calculerScore(payload);
  payload.score_classe = classeScore(payload.score).cls;
  const msgs           = genererMessages(payload);
  Object.assign(payload, msgs);

  const { data, error } = await db.from('prospects').insert([payload]).select().single();
  btn.disabled    = false;
  btn.textContent = 'Enregistrer';

  if (error) { toast('Erreur : ' + error.message, 'error'); return; }

  allProspects.unshift(data);
  appliquerFiltres();
  mettreAJourStats();
  fermerAjout();
  toast('✅ Prospect ajouté avec succès');
}

/* ── Onglets CRM / Campagnes ─────────────────────────────── */
let activeTab = 'crm';

function switchTab(tab) {
  activeTab = tab;
  const isCrm = tab === 'crm';
  document.getElementById('prospectGrid').style.display  = 'none';
  document.getElementById('emptyState').style.display    = 'none';
  document.getElementById('campagneView').style.display  = isCrm ? 'none' : 'block';
  document.getElementById('btnAjout').style.display      = isCrm ? '' : 'none';
  document.getElementById('btnTabCRM').style.fontWeight      = isCrm ? '700' : '400';
  document.getElementById('btnTabCampagne').style.fontWeight = isCrm ? '400' : '700';
  if (isCrm) { appliquerFiltres(); } else { chargerCampagnes(); }
}

window.actualiser = function() {
  activeTab === 'crm' ? chargerProspects() : chargerCampagnes();
};

async function chargerCampagnes() {
  const db = window.SUPABASE_CLIENT;
  const tbody = document.getElementById('campagneBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">Chargement…</td></tr>';

  const { data, error } = await db
    .from('mail_prospects')
    .select('company,email,notes,email_count,last_subject,last_contact_at,campagne_names,status')
    .eq('brand', 'colixo')
    .order('last_contact_at', { ascending: false });

  if (error) { tbody.innerHTML = `<tr><td colspan="8" style="color:red;padding:20px;">${error.message}</td></tr>`; return; }
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">Aucun contact de campagne</td></tr>'; return; }

  const countBadge = (n) => {
    if (!n) return '<span style="color:#94a3b8;">—</span>';
    const col = n === 1 ? '#1a73e8' : n === 2 ? '#f59e0b' : '#e8311a';
    return `<span style="background:${col};color:#fff;font-size:.72rem;font-weight:700;border-radius:10px;padding:2px 9px;">${n} ✉</span>`;
  };

  // Extraire ville/secteur depuis notes "Secteur: X | Ville: Y | Sujet: Z"
  const parseNotes = (notes) => {
    const s = (notes||'').match(/Secteur:\s*([^|]+)/)?.[1]?.trim() || '';
    const v = (notes||'').match(/Ville:\s*([^|]+)/)?.[1]?.trim() || '';
    return { secteur: s, ville: v };
  };

  tbody.innerHTML = data.map(r => {
    const { secteur, ville } = parseNotes(r.notes);
    const date = r.last_contact_at ? new Date(r.last_contact_at).toLocaleDateString('fr-CH') : '—';
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-weight:600;">${esc(r.company||'')}</td>
      <td style="padding:10px 12px;color:#3b82f6;">${esc(r.email||'')}</td>
      <td style="padding:10px 12px;color:#64748b;">${esc(ville)}</td>
      <td style="padding:10px 12px;color:#64748b;">${esc(secteur)}</td>
      <td style="padding:10px 12px;text-align:center;">${countBadge(r.email_count)}</td>
      <td style="padding:10px 12px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(r.last_subject||'')}">${esc(r.last_subject||'—')}</td>
      <td style="padding:10px 12px;color:#64748b;">${date}</td>
      <td style="padding:10px 12px;color:#64748b;font-size:.78rem;">${esc(r.campagne_names||'—')}</td>
    </tr>`;
  }).join('');
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const tryInit = () => {
    if (window.SUPABASE_CLIENT) {
      chargerProspects();
    } else {
      setTimeout(tryInit, 100);
    }
  };
  tryInit();

  // Filtres live
  ['fSearch','fVille','fSecteur','fStatut','fScore'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', appliquerFiltres);
    document.getElementById(id)?.addEventListener('change', appliquerFiltres);
  });

  // Fermer modals sur clic overlay
  ['modalDetail','modalAjout'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) {
        id === 'modalDetail' ? fermerDetail() : fermerAjout();
      }
    });
  });

  // Formulaire
  document.getElementById('prospectForm')?.addEventListener('submit', soumettreProspect);
});

// Exposer fonctions globales pour les onclick HTML
window.ouvrirFormAjout   = ouvrirFormAjout;
window.fermerAjout       = fermerAjout;
window.fermerDetail      = fermerDetail;
window.ouvrirDetail      = ouvrirDetail;
window.changerStatut     = changerStatut;
window.copierMessage     = copierMessage;
window.copierTexte       = copierTexte;
window.appliquerFiltres  = appliquerFiltres;
window.chargerProspects  = chargerProspects;
window.switchTab         = switchTab;
window.exporterExcel     = exporterExcel;

/* ── Export Excel (CSV UTF-8) ────────────────────────────── */
function exporterExcel() {
  const liste = filtered.length ? filtered : allProspects;
  if (!liste.length) { toast('Aucun prospect à exporter', 'error'); return; }

  const cols = [
    ['Entreprise',       p => p.entreprise || ''],
    ['Ville',            p => p.ville || ''],
    ['Secteur',          p => p.secteur || ''],
    ['Contact',          p => p.contact_nom || ''],
    ['Email',            p => p.email || ''],
    ['Téléphone',        p => p.telephone || ''],
    ['Site web',         p => p.site_web || ''],
    ['Statut',           p => (STATUTS[p.statut] || {}).label || p.statut || ''],
    ['Score',            p => p.score ?? ''],
    ['Besoin détecté',   p => p.besoin_detecte || ''],
    ['Angle commercial', p => p.angle_commercial || ''],
    ['Notes',            p => p.notes || ''],
    ['Dernier contact',  p => p.dernier_contact ? p.dernier_contact.slice(0,10) : ''],
    ['Créé le',          p => p.created_at ? p.created_at.slice(0,10) : ''],
  ];

  const csvEsc = v => '"' + String(v).replace(/"/g, '""') + '"';
  const header = cols.map(([h]) => csvEsc(h)).join(';');
  const rows   = liste.map(p => cols.map(([, fn]) => csvEsc(fn(p))).join(';'));
  const csv    = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM pour Excel

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href     = url;
  a.download = `prospects_colixo_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`${liste.length} prospect(s) exportés`, 'ok');
}
