// ============================================================
// js/offre-client.js — Calculateur offre commerciale Colixo
// ============================================================

/* ── État ────────────────────────────────────────────────── */
let calcResult = {};

/* ── Callback client-picker ─────────────────────────────── */
function remplirClientOffre(c) {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  set('cEntrepriseId',     c.id);
  set('cEntreprise',       c.nom);
  set('cContactNom',       c.contact_nom);
  set('cContactFonction',  c.contact_fonction);
  set('cEmail',            c.email);
  set('cTelephone',        c.telephone);
  set('cAdresse',          c.adresse);
  set('cVille',            c.ville);
  set('cCanton',           c.canton);
  set('cSiteWeb',          c.site_web);
  set('cSecteur',          c.secteur);
}

async function sauvegarderClientInfo() {
  const nom = val('cEntreprise');
  if (!nom) return;
  const db = window.SUPABASE_CLIENT;
  if (!db) return;
  const code = localStorage.getItem('colixo_access_code') || '';
  if (!code) return;
  const id = val('cEntrepriseId') || null;
  try {
    const { data, error } = await db.rpc('admin_upsert_entreprise', {
      p_code:        code,
      p_id:          id || null,
      p_nom:         nom,
      p_email:       val('cEmail')      || null,
      p_telephone:   val('cTelephone')  || null,
      p_contact_nom: val('cContactNom') || null,
      p_adresse:     val('cAdresse')    || null,
      p_ville:       val('cVille')      || null,
      p_npa:         null,
      p_numero_client: null,
    });
    if (!error && data) {
      const newId = (typeof data === 'object' && data.id) ? data.id : (typeof data === 'string' ? data : null);
      if (newId) { const el = $('cEntrepriseId'); if (el) el.value = newId; }
      toast('Client enregistré ✓', 'ok');
    }
  } catch (_) { /* silencieux */ }
}

async function avancerSection1() {
  const btn = $('btnSection1Next');
  if (btn) btn.disabled = true;
  await sauvegarderClientInfo();
  if (btn) btn.disabled = false;
  nextSection();
}

/* ── Utilitaires ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const val = id => ($( id)?.value ?? '').trim();
const num = id => parseFloat(val(id)) || 0;
const chk = id => $( id)?.checked ?? false;
const esc = s  => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function fCHF(n) {
  return n.toLocaleString('fr-CH', { style:'currency', currency:'CHF', minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fNum(n, dec = 2) {
  return n.toLocaleString('fr-CH', { minimumFractionDigits:dec, maximumFractionDigits:dec });
}

function toast(msg, type = 'ok') {
  const z = $('toastZone');
  const t = document.createElement('div');
  t.className = 'oc-toast oc-toast-' + type;
  t.textContent = msg;
  z.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

/* ── Navigation entre sections ───────────────────────────── */
function goSection(n) {
  document.querySelectorAll('.wizard-section').forEach((s, i) => {
    s.classList.toggle('active', i === n - 1);
  });
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.classList.toggle('active', i === n - 1);
    d.classList.toggle('done',   i < n - 1);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevSection() {
  const cur = activeSectionIdx();
  if (cur > 0) goSection(cur);
}

function nextSection() {
  const cur = activeSectionIdx();
  const total = document.querySelectorAll('.wizard-section').length;
  if (cur < total) goSection(cur + 2);
}

function activeSectionIdx() {
  const sections = [...document.querySelectorAll('.wizard-section')];
  return sections.findIndex(s => s.classList.contains('active'));
}

/* ── État tranches ────────────────────────────────────────── */
let tranches = [];
let _tid = 0;
let _sid = 0;

/* ── État options supplémentaires ────────────────────────── */
let options = [];
let _oid = 0;

/* ── Paramètres de base (partagés par tous les calculs) ──── */
function lireParams() {
  const nbVehicules   = num('cNbVehicules')      || 1;
  const nbChauffeurs  = num('cNbChauffeurs')      || nbVehicules;
  const kmJour        = num('cKmJour');
  const litres100     = num('cLitres100')         || 8;
  const prixCarburant = num('cPrixCarburant')     || 1.90;
  const heuresJour    = num('cHeuresJour');
  const coutHoraire   = num('cCoutHoraire')       || 35;
  const fraisFixes    = num('cFraisFixes');
  const joursParMois  = num('cJoursParMois')      || 22;
  const prepColis     = chk('cPrepCommandes');
  const coutPrep      = num('cCoutPrep')          || 2;
  const colisRenta    = num('cColisRentabilite')  || 80;

  // Coûts journaliers — carburant et chauffeur × nb chauffeurs, frais fixes × véhicules
  const coutCarburant = kmJour * litres100 / 100 * prixCarburant * nbChauffeurs;
  const coutChauffeur = heuresJour * coutHoraire * nbChauffeurs;
  const coutVehicule  = fraisFixes * nbVehicules;
  // Coût logistique par colis (variable)
  const coutPrepColis = prepColis ? coutPrep : 0;

  return { nbVehicules, coutCarburant, coutChauffeur, coutVehicule,
           coutPrepColis, colisRenta, joursParMois };
}

/* ── Prix par colis ──────────────────────────────────────── */
// Tous les coûts répartis sur le seuil de rentabilité.
// Un petit client paie sa part proportionnelle — pas plus cher/colis.
// Le volume réel n'affecte que le montant total de la facture.
function prixColisFor(_colisJour, marge, p) {
  const colisBase   = p.colisRenta * p.nbVehicules;
  const cpVariable  = (p.coutCarburant + p.coutChauffeur) / colisBase;
  const cpVehicule  = p.coutVehicule / colisBase;
  const cpLogistique= p.coutPrepColis;
  return (cpVariable + cpVehicule + cpLogistique) * (1 + marge / 100);
}

/* ── Calcul principal ────────────────────────────────────── */
function calculer() {
  const p            = lireParams();
  const marge        = num('cMarge') || 20;
  const colisJour    = num('cColisJour') || 1;

  // Coût total réel (pour info)
  const coutLogistique = p.coutPrepColis * colisJour;
  const coutTotalJour  = p.coutCarburant + p.coutChauffeur + p.coutVehicule + coutLogistique;
  const coutTotalMois  = coutTotalJour * p.joursParMois;

  // Prix avec la nouvelle formule rentabilité
  const prixParColis   = prixColisFor(colisJour, marge, p);
  const prixClientJour = prixParColis * colisJour;
  const prixClientMois = prixClientJour * p.joursParMois;
  const margeCHFJour   = prixClientJour - (prixClientJour / (1 + marge / 100));

  calcResult = {
    ...p, marge, colisJour,
    coutLogistique, coutTotalJour, coutTotalMois,
    margeCHFJour, prixClientJour, prixClientMois, prixParColis,
  };

  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('rCoutCarburant',  fCHF(p.coutCarburant));
  set('rCoutChauffeur',  fCHF(p.coutChauffeur));
  set('rCoutVehicule',   fCHF(p.coutVehicule));
  set('rCoutLogistique', fCHF(coutLogistique));
  set('rCoutTotalJour',  fCHF(coutTotalJour));
  set('rCoutTotalMois',  fCHF(coutTotalMois));
  set('rMargeChf',       fCHF(margeCHFJour));
  set('rPrixJour',       fCHF(prixClientJour));
  set('rPrixMois',       fCHF(prixClientMois));
  set('rPrixColis',      fCHF(prixParColis));

  // Catégories de poids
  set('rPoidsLegers', fCHF(prixParColis));
  set('rPoidsLourds', fCHF(prixParColis * 1.20));

  renderTranches(p);
}

/* ── Tranches tarifaires ─────────────────────────────────── */
function _defaultSpeeds() {
  return [
    { id: ++_sid, label: 'Standard 48h',    supplement: 0    },
    { id: ++_sid, label: 'Prioritaire 24h', supplement: 2.00 },
    { id: ++_sid, label: 'Express',          supplement: 5.00 },
  ];
}

function ajouterTranche() {
  const colisDefaut = num('cColisJour') || 30;
  tranches.push({ id: ++_tid, label: '', colis: colisDefaut, rabais: 0, speeds: _defaultSpeeds() });
  renderTranches(lireParams());
}

function supprimerTranche(id) {
  tranches = tranches.filter(t => t.id !== id);
  renderTranches(lireParams());
}
window.supprimerTranche = supprimerTranche;

function ajouterSpeed(tid) {
  _syncAllTranchesFromDOM();
  const t = tranches.find(x => x.id === tid);
  if (!t) return;
  t.speeds.push({ id: ++_sid, label: '', supplement: 0 });
  renderTranches(lireParams());
}
window.ajouterSpeed = ajouterSpeed;

function supprimerSpeed(tid, sid) {
  _syncAllTranchesFromDOM();
  const t = tranches.find(x => x.id === tid);
  if (!t) return;
  t.speeds = t.speeds.filter(s => s.id !== sid);
  renderTranches(lireParams());
}
window.supprimerSpeed = supprimerSpeed;

function _syncAllTranchesFromDOM() {
  document.querySelectorAll('.tranche-block').forEach(block => {
    const tid = +block.dataset.tid;
    const t   = tranches.find(x => x.id === tid);
    if (!t) return;
    t.label = block.querySelector('.ti-label')?.value || '';
    t.colis = parseFloat(block.querySelector('.ti-colis')?.value) || t.colis;
    t.rabais = parseFloat(block.querySelector('.ti-rabais')?.value) || 0;
    block.querySelectorAll('.speed-row').forEach(row => {
      const sid = +row.dataset.sid;
      const s   = t.speeds.find(x => x.id === sid);
      if (!s) return;
      s.label      = row.querySelector('.si-label')?.value || '';
      s.supplement = parseFloat(row.querySelector('.si-supp')?.value) || 0;
    });
  });
}

function renderTranches(p) {
  const body = $('tranchesBody');
  if (!body) return;
  if (!tranches.length) {
    body.innerHTML = '<div class="tranches-empty">Aucune tranche — cliquez "+ Ajouter" pour en créer une.</div>';
    return;
  }

  _syncAllTranchesFromDOM();
  const marge = num('cMarge') || 20;

  body.innerHTML = tranches.map(t => {
    const coutBase      = prixColisFor(t.colis, 0, p);
    const basePrice     = prixColisFor(t.colis, marge, p);
    const discountedBase = basePrice * (1 - (t.rabais || 0) / 100);

    const speedsHTML = t.speeds.map(s => {
      const pv     = discountedBase + s.supplement;
      const margeP = pv > 0 ? (pv - coutBase) / pv * 100 : -999;
      const mc     = margeP >= 15 ? 'marge-ok' : margeP >= 0 ? 'marge-warn' : 'marge-loss';
      return `
        <div class="speed-row" data-sid="${s.id}">
          <input class="si-label" type="text" list="dlVitesses" value="${esc(s.label)}" placeholder="Ex : Standard 48h" oninput="recalcTranches()"/>
          <div class="speed-supp-wrap">
            <span>+</span>
            <input class="si-supp" type="number" value="${s.supplement.toFixed(2)}" min="0" step="0.50" title="Supplément CHF/colis" oninput="recalcTranches()"/>
            <span class="speed-supp-unit">CHF</span>
          </div>
          <span class="tranche-val">${fCHF(pv)}</span>
          <span class="tranche-val ${mc}">${fNum(margeP, 1)}%</span>
          <button type="button" class="tranche-del" onclick="supprimerSpeed(${t.id}, ${s.id})" title="Supprimer">✕</button>
        </div>`;
    }).join('');

    return `
    <div class="tranche-block" data-tid="${t.id}">
      <div class="tranche-main">
        <input class="ti-label" type="text" list="dlTranches" value="${esc(t.label)}" placeholder="Ex : Volume standard" oninput="recalcTranches()"/>
        <div class="tranche-colis-wrap">
          <input class="ti-colis" type="number" value="${t.colis}" min="1" title="Colis par jour" oninput="recalcTranches()"/>
          <span class="tranche-colis-unit">col/j</span>
        </div>
        <div class="tranche-rabais-wrap">
          <input class="ti-rabais" type="number" value="${(t.rabais || 0).toFixed(1)}" min="0" max="100" step="0.5" title="Rabais volume %" oninput="recalcTranches()"/>
          <span class="tranche-rabais-unit">% rabais</span>
        </div>
        <span class="tranche-val tranche-cout" title="Coût de revient">${fCHF(coutBase)}</span>
        <button type="button" class="btn-ghost btn-sm tranche-add-speed" onclick="ajouterSpeed(${t.id})">+ Délai</button>
        <button type="button" class="tranche-del" onclick="supprimerTranche(${t.id})" title="Supprimer la tranche">✕</button>
      </div>
      <div class="speeds-body">
        <div class="speed-header-row">
          <span>Délai de livraison</span>
          <span>Supplément</span>
          <span>Prix/colis</span>
          <span>Marge</span>
          <span></span>
        </div>
        ${speedsHTML || '<div class="tranches-empty" style="padding:10px 0;font-size:.8rem;">Aucun délai — cliquez "+ Délai"</div>'}
      </div>
    </div>`;
  }).join('');
}

function recalcTranches() {
  renderTranches(lireParams());
}
window.ajouterTranche = ajouterTranche;
window.recalcTranches = recalcTranches;

/* ── Options supplémentaires ─────────────────────────────── */
function ajouterOption() {
  options.push({ id: ++_oid, label: '', prix: 0, unite: 'CHF/livraison' });
  renderOptions();
}
window.ajouterOption = ajouterOption;

function supprimerOption(id) {
  options = options.filter(o => o.id !== id);
  renderOptions();
}
window.supprimerOption = supprimerOption;

function _syncOptionsFromDOM() {
  document.querySelectorAll('.option-row').forEach(row => {
    const oid = +row.dataset.oid;
    const o   = options.find(x => x.id === oid);
    if (!o) return;
    o.label = row.querySelector('.oi-label')?.value || '';
    o.prix  = parseFloat(row.querySelector('.oi-prix')?.value) || 0;
    o.unite = row.querySelector('.oi-unite')?.value || 'CHF/livraison';
  });
}

function renderOptions() {
  const body = $('optionsBody');
  if (!body) return;
  if (!options.length) {
    body.innerHTML = '<div class="tranches-empty">Aucune option — cliquez "+ Ajouter" pour en créer une.</div>';
    return;
  }
  _syncOptionsFromDOM();
  body.innerHTML = `
    <div class="option-header-row">
      <span>Prestation</span><span>Prix</span><span>Unité</span><span></span>
    </div>
    ${options.map(o => `
    <div class="option-row" data-oid="${o.id}">
      <input class="oi-label" type="text" list="dlOptions" value="${esc(o.label)}" placeholder="Ex : Descente en cave" oninput=""/>
      <div class="option-prix-wrap">
        <input class="oi-prix" type="number" value="${o.prix.toFixed(2)}" min="0" step="0.50"/>
        <span class="option-prix-unit">CHF</span>
      </div>
      <select class="oi-unite">
        <option value="CHF/livraison"${o.unite==='CHF/livraison'?' selected':''}>/ livraison</option>
        <option value="CHF/colis"${o.unite==='CHF/colis'?' selected':''}>/ colis</option>
        <option value="CHF/jour"${o.unite==='CHF/jour'?' selected':''}>/ jour</option>
        <option value="forfait"${o.unite==='forfait'?' selected':''}>forfait</option>
      </select>
      <button type="button" class="tranche-del" onclick="supprimerOption(${o.id})" title="Supprimer">✕</button>
    </div>`).join('')}`;
}
window.renderOptions = renderOptions;

/* ── Helper options pour l'offre ────────────────────────── */
function _buildOptionsHTML() {
  _syncOptionsFromDOM();
  if (!options.length) return '';
  const rows = options.map(function(o) {
    return '<tr><td>' + (esc(o.label) || '—') + '</td>'
      + '<td class="tranche-price">' + fCHF(o.prix) + '</td>'
      + '<td>' + esc(o.unite) + '</td></tr>';
  }).join('');
  return '<div class="offre-section">'
    + '<div class="offre-section-title">6. OPTIONS SUPPLÉMENTAIRES</div>'
    + '<table class="offre-tranche-table">'
    + '<thead><tr><th>Prestation</th><th>Prix unitaire</th><th>Unité</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '<p class="offre-tarif-note">Options facturées en sus du tarif de livraison de base, sur demande explicite lors de la commande.</p>'
    + '</div>';
}

/* ── Helper tarification pour l'offre ───────────────────── */
function _buildTarifHTML() {
  const marge = calcResult.marge || num('cMarge') || 20;
  const sources = tranches.length
    ? tranches.map(t => ({
        label: t.label || (tranches.length > 1 ? (t.colis + ' colis/jour') : ''),
        speeds: t.speeds,
        rabais: t.rabais || 0,
        basePrice: prixColisFor(t.colis, marge, calcResult),
      }))
    : [{ label: '', speeds: [{ label: 'Standard', supplement: 0 }], rabais: 0, basePrice: calcResult.prixParColis || 0 }];

  return sources.map(function(src) {
    const discountedBase = src.basePrice * (1 - src.rabais / 100);
    const rabaisNote = src.rabais > 0 ? ' <span style="color:#cc5500;font-size:.78rem;">(rabais volume −' + fNum(src.rabais, 1) + '%)</span>' : '';
    const subtitle = src.label ? '<div class="offre-tarif-sous-titre">' + esc(src.label) + rabaisNote + '</div>' : '';
    const rows = src.speeds.map(function(s) {
      const pStd = discountedBase + s.supplement;
      const pLrd = pStd * 1.20;
      return '<tr><td><strong>' + (esc(s.label) || '—') + '</strong></td><td>0 – 15 kg</td><td class="tranche-price">' + fCHF(pStd) + '</td></tr>'
           + '<tr class="offre-row-lourd"><td></td><td>15 – 30 kg</td><td class="tranche-price">' + fCHF(pLrd) + '</td></tr>';
    }).join('');
    return subtitle
      + '<table class="offre-tranche-table offre-tarif-simple">'
      + '<thead><tr><th>Catégorie</th><th>Poids du colis</th><th>Prix du colis</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table>';
  }).join('<div style="height:14px;"></div>');
}

/* ── Génération offre ────────────────────────────────────── */
function genererOffre() {
  calculer();

  const entreprise  = val('cEntreprise')    || '(Entreprise)';
  const contact     = val('cContactNom')    || '';
  const fonction    = val('cContactFonction')|| '';
  const email       = val('cEmail')         || '';
  const telephone   = val('cTelephone')     || '';
  const adresse     = val('cAdresse')       || '';
  const ville       = val('cVille')         || '';
  const canton      = val('cCanton')        || '';
  const secteur     = val('cSecteur')       || '';
  const typeService = val('cTypeService')   || '';
  const frequence   = val('cFrequence')     || '';
  const demarrage   = val('cDemarrage')     || '';
  const zoneLiv     = val('cZoneLivraison') || '';
  const delai       = val('cDelai')         || '';
  const colisJour   = val('cColisJour')     || '—';
  const colisHebdo  = val('cColisHebdo')    || '—';
  const kmJourVeh       = num('cKmJour');
  const nbVehOffre      = num('cNbVehicules') || 1;
  const nbRotOffre      = num('cNbChauffeurs') || 1;
  const kmJour          = kmJourVeh ? String(kmJourVeh * nbVehOffre * nbRotOffre) : '—';
  const poidsMoyen  = val('cPoidsMoyen')    || '—';
  const dateOffre   = new Date().toLocaleDateString('fr-CH', { day:'2-digit', month:'long', year:'numeric' });
  const refOffre    = 'COL-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);

  // Prestations sélectionnées
  const prest = [];
  if (chk('cPrepCommandes')) prest.push('Préparation de commandes');
  if (chk('cTri'))           prest.push('Tri des colis');
  if (chk('cEtiquetage'))    prest.push('Étiquetage');
  if (chk('cStockage'))      prest.push('Stockage temporaire');
  if (chk('cScan'))          prest.push('Scan des colis');
  if (chk('cPreuveLiv'))     prest.push('Preuve de livraison');
  if (chk('cSamedi'))        prest.push('Livraison le samedi');
  if (chk('cDimanche'))      prest.push('Livraison le dimanche');
  if (chk('cSoir'))          prest.push('Livraison en soirée');

  const nonPrest = [];
  if (!chk('cPrepCommandes')) nonPrest.push('Préparation de commandes');
  if (!chk('cScan'))          nonPrest.push('Scan/inventaire colis');

  const offreHTML = `
<div class="offre-doc" id="offreDoc">

  <div class="offre-header">
    <div class="offre-logo">
      <img src="../images/colixo-logo-nobg.png" alt="Colixo" class="offre-logo-img"/>
      <div class="offre-logo-sub" style="margin-top:4px;font-size:.78rem;color:#888;">Livraison express · Suisse romande</div>
    </div>
    <div class="offre-ref">
      <div class="offre-ref-num">Réf. ${esc(refOffre)}</div>
      <div class="offre-ref-date">Lausanne, le ${esc(dateOffre)}</div>
      <div class="offre-validity">Valable 30 jours</div>
    </div>
  </div>

  <div class="offre-title-block">
    <div class="offre-title">OFFRE COMMERCIALE</div>
    <div class="offre-subtitle">Solution logistique sur mesure</div>
  </div>

  <div class="offre-parties">
    <div class="offre-partie">
      <div class="offre-partie-lbl">CLIENT</div>
      <div class="offre-partie-nom">${esc(entreprise)}</div>
      ${contact  ? `<div>${esc(contact)}${fonction ? ' — <em>' + esc(fonction) + '</em>' : ''}</div>` : ''}
      ${adresse  ? `<div>${esc(adresse)}</div>` : ''}
      ${ville    ? `<div>${esc(ville)}${canton ? ' (' + esc(canton) + ')' : ''}</div>` : ''}
      ${email    ? `<div>${esc(email)}</div>` : ''}
      ${telephone? `<div>${esc(telephone)}</div>` : ''}
    </div>
    <div class="offre-partie">
      <div class="offre-partie-lbl">PRESTATAIRE</div>
      <div class="offre-partie-nom">Colixo Sàrl</div>
      <div>Impasse des Griottes 3</div>
      <div>1462 Yvonand, Suisse</div>
      <div>info@colixo.ch</div>
      <div>colixo.ch</div>
    </div>
  </div>

  <div class="offre-intro">
    <p>Sur la base des informations transmises, <strong>Colixo</strong> propose une solution de livraison adaptée à votre activité${secteur ? ' dans le secteur <strong>' + esc(secteur) + '</strong>' : ''}, avec une organisation souple, évolutive et pensée pour absorber vos volumes réguliers.</p>
  </div>

  <div class="offre-section">
    <div class="offre-section-title">1. RÉSUMÉ DU BESOIN</div>
    <table class="offre-table">
      <tr><td class="tkey">Type de service</td><td>${esc(typeService) || '—'}</td></tr>
      <tr><td class="tkey">Fréquence</td><td>${esc(frequence) || '—'}</td></tr>
      <tr><td class="tkey">Zone de livraison</td><td>${esc(zoneLiv) || '—'}</td></tr>
      <tr><td class="tkey">Délai demandé</td><td>${esc(delai) || '—'}</td></tr>
      <tr><td class="tkey">Démarrage souhaité</td><td>${demarrage ? new Date(demarrage).toLocaleDateString('fr-CH') : '—'}</td></tr>
      <tr><td class="tkey">Secteur d'activité</td><td>${esc(secteur) || '—'}</td></tr>
    </table>
  </div>

  <div class="offre-section">
    <div class="offre-section-title">2. VOLUMES PRÉVUS</div>
    <table class="offre-table">
      <tr><td class="tkey">Colis par jour</td><td>${esc(colisJour)}</td></tr>
      <tr><td class="tkey">Colis par semaine</td><td>${esc(colisHebdo)}</td></tr>
      <tr><td class="tkey">Kilométrage journalier estimé</td><td>${esc(kmJour)} km</td></tr>
      <tr><td class="tkey">Poids moyen par colis</td><td>${poidsMoyen ? esc(poidsMoyen) + ' kg' : '—'}</td></tr>
      <tr><td class="tkey">Signature requise</td><td>${chk('cSignature') ? 'Oui' : 'Non'}</td></tr>
      <tr><td class="tkey">Colis fragiles</td><td>${chk('cFragile') ? 'Oui' : 'Non'}</td></tr>
    </table>
  </div>

  <div class="offre-section">
    <div class="offre-section-title">3. PRESTATIONS INCLUSES</div>
    <ul class="offre-list">
      <li>✓ Collecte et livraison des colis selon fréquence convenue</li>
      <li>✓ Gestion des tournées et optimisation des itinéraires</li>
      <li>✓ Suivi en temps réel via portail client</li>
      ${prest.map(p => `<li>✓ ${esc(p)}</li>`).join('')}
    </ul>
  </div>

  ${nonPrest.length ? `
  <div class="offre-section">
    <div class="offre-section-title">4. PRESTATIONS NON INCLUSES</div>
    <ul class="offre-list offre-list-excl">
      ${nonPrest.map(p => `<li>✗ ${esc(p)}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="offre-section offre-tarif-section">
    <div class="offre-section-title">5. TARIFICATION PAR CATÉGORIE DE POIDS</div>
    ${_buildTarifHTML()}
    <p class="offre-tarif-note">Prix au colis, hors TVA. Colis 15–30 kg majorés de 20%. Sous réserve de validation opérationnelle.</p>
  </div>

  ${_buildOptionsHTML()}

  <div class="offre-section">
    <div class="offre-section-title">${options.length ? '7.' : '6.'} CONDITIONS COMMERCIALES</div>
    <ul class="offre-list">
      <li>Offre valable <strong>30 jours</strong> à compter de la date d'émission</li>
      <li>Paiement : facturation hebdomadaire (tous les 7 jours), payable à 10 jours net</li>
      <li>Contrat de prestation ajustable en fonction des volumes réels</li>
      <li>Reconduction tacite mensuelle — résiliation avec préavis 30 jours</li>
      <li>Prix révisables annuellement selon indice des prix à la consommation</li>
    </ul>
  </div>

  <div class="offre-parrainage">
    <div class="offre-parrainage-icon">🎁</div>
    <div class="offre-parrainage-body">
      <div class="offre-parrainage-titre">Programme de parrainage Colixo — CHF 100 offerts</div>
      <div class="offre-parrainage-texte">
        Vous connaissez une entreprise qui cherche un partenaire logistique fiable ?
        <strong>Recommandez Colixo</strong> depuis votre portail client — si votre filleul
        atteint <strong>CHF 500 de prestations facturées</strong>, nous créditons
        <strong>CHF 100</strong> directement sur votre prochaine facture.
        Suivez vos recommandations et vos crédits en temps réel sur
        <a href="https://www.colixo.ch/admin/client/portal.html" style="color:#cc5500;">votre portail client Colixo</a>.
      </div>
    </div>
  </div>

  <div class="offre-signatures">
    <div class="offre-sig-block">
      <div class="offre-sig-lbl">Pour Colixo Sàrl</div>
      <div class="offre-sig-line"></div>
      <div class="offre-sig-name">Directeur Commercial</div>
      <div class="offre-sig-date">Date : ________________</div>
    </div>
    <div class="offre-sig-block">
      <div class="offre-sig-lbl">Pour ${esc(entreprise)}</div>
      <div class="offre-sig-line"></div>
      <div class="offre-sig-name">${contact ? esc(contact) : 'Représentant autorisé'}</div>
      <div class="offre-sig-date">Date : ________________</div>
    </div>
  </div>

  <div class="offre-footer">
    Colixo Sàrl · Impasse des Griottes 3, 1462 Yvonand · info@colixo.ch · colixo.ch
  </div>

</div>`;

  $('offreZone').innerHTML = offreHTML;
  $('offreZone').style.display = 'block';
  $('btnActions').style.display = 'flex';

  // Scroll vers l'offre
  $('offreZone').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Sauvegarder dans Supabase si disponible
  sauvegarderOffre();
}

/* ── Sauvegarde Supabase (optionnel) ─────────────────────── */
async function sauvegarderOffre() {
  const db = window.SUPABASE_CLIENT;
  if (!db) return; // Supabase non configuré — silencieux

  const payload = {
    entreprise:         val('cEntreprise'),
    contact_nom:        val('cContactNom'),
    email:              val('cEmail'),
    telephone:          val('cTelephone'),
    secteur:            val('cSecteur'),
    besoin:             val('cTypeService'),
    volume_colis_jour:  num('cColisJour'),
    km_jour:            num('cKmJour'),
    cout_reel_jour:     calcResult.coutTotalJour,
    prix_client_jour:   calcResult.prixClientJour,
    prix_client_mois:   calcResult.prixClientMois,
    prix_par_colis:     calcResult.prixParColis,
    marge_pourcentage:  num('cMarge'),
    statut:             'draft',
    contenu_offre:      $('offreZone')?.innerText?.slice(0, 8000) || '',
    created_at:         new Date().toISOString(),
  };

  try {
    const { error } = await db.from('offres_clients').insert([payload]);
    if (!error) toast('Offre sauvegardée dans Supabase', 'ok');
  } catch (_) { /* silencieux si table absente */ }
}

/* ── Actions ─────────────────────────────────────────────── */
function imprimerOffre() {
  if (!$('offreDoc')) { toast('Générez d\'abord l\'offre', 'warn'); return; }
  window.print();
}

function copierOffre() {
  const doc = $('offreDoc');
  if (!doc) { toast('Générez d\'abord l\'offre', 'warn'); return; }
  navigator.clipboard.writeText(doc.innerText).then(() => toast('Texte de l\'offre copié ✓'));
}

function reinitialiser() {
  if (!confirm('Réinitialiser le formulaire ? Toutes les données seront perdues.')) return;
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
    else el.value = '';
  });
  $('offreZone').innerHTML = '';
  $('offreZone').style.display = 'none';
  $('btnActions').style.display = 'none';
  // Réinitialiser les résultats du calcul
  document.querySelectorAll('[id^="r"]').forEach(el => {
    if (el.classList.contains('result-val')) el.textContent = '—';
  });
  calcResult = {};
  goSection(1);
  toast('Formulaire réinitialisé');
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  goSection(1);

  // Recalcul en temps réel sur les champs de la section calcul
  // Init tranches et options vides
  renderTranches(lireParams());
  renderOptions();

  const calcFields = ['cKmJour','cLitres100','cPrixCarburant','cHeuresJour','cCoutHoraire',
    'cNbVehicules','cNbChauffeurs','cFraisFixes','cMarge','cColisJour','cJoursParMois',
    'cCoutPrep','cColisRentabilite'];
  calcFields.forEach(id => {
    $(id)?.addEventListener('input', calculer);
  });
  $('cPrepCommandes')?.addEventListener('change', calculer);

  // Valeurs par défaut pour le calcul
  const defaults = {
    cLitres100:'8', cPrixCarburant:'1.90', cCoutHoraire:'35',
    cNbVehicules:'1', cMarge:'20', cJoursParMois:'22', cCoutPrep:'2'
  };
  Object.entries(defaults).forEach(([id, v]) => {
    const el = $(id);
    if (el && !el.value) el.value = v;
  });

  calculer();
});

// Exposer globalement
window.goSection          = goSection;
window.prevSection        = prevSection;
window.nextSection        = nextSection;
window.avancerSection1    = avancerSection1;
window.sauvegarderClientInfo = sauvegarderClientInfo;
window.calculer       = calculer;
window.genererOffre   = genererOffre;
window.imprimerOffre  = imprimerOffre;
window.copierOffre    = copierOffre;
window.reinitialiser  = reinitialiser;
