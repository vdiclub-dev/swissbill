// ============================================================
// js/offre-client.js — Calculateur offre commerciale Colixo
// ============================================================

/* ── État ────────────────────────────────────────────────── */
let calcResult = {};

/* ── Callback client-picker ─────────────────────────────── */
function remplirClientOffre(c) {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  set('cEntreprise',       c.nom);
  set('cContactNom',       c.contact_nom);
  set('cEmail',            c.email);
  set('cTelephone',        c.telephone);
  set('cAdresse',          c.adresse);
  set('cVille',            c.ville);
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

/* ── État tranches + vitesses ────────────────────────────── */
let tranches = [];
let _tid = 0;
let vitesses = [];
let _vid = 0;

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

  // Coûts fixes journaliers (indépendants du volume client)
  const coutCarburant = kmJour * litres100 / 100 * prixCarburant * nbVehicules;
  const coutChauffeur = heuresJour * coutHoraire * nbChauffeurs;
  const coutVehicule  = fraisFixes * nbVehicules;
  // Coût logistique par colis (variable)
  const coutPrepColis = prepColis ? coutPrep : 0;

  return { nbVehicules, coutCarburant, coutChauffeur, coutVehicule,
           coutPrepColis, colisRenta, joursParMois };
}

/* ── Prix par colis pour un volume donné ─────────────────── */
// Frais fixes véhicule répartis sur le seuil de rentabilité,
// coûts variables (chauffeur, carburant) sur le volume réel du client.
function prixColisFor(colisJour, marge, p) {
  const c = Math.max(colisJour, 1);
  const cpVariable  = (p.coutCarburant + p.coutChauffeur) / c;
  const cpVehicule  = p.coutVehicule / (p.colisRenta * p.nbVehicules);
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

  renderTranches(p);
}

/* ── Tranches tarifaires ─────────────────────────────────── */
function ajouterTranche() {
  const colisDefaut = num('cColisJour') || 30;
  const margeDefaut = num('cMarge')    || 20;
  tranches.push({ id: ++_tid, label: '', colis: colisDefaut, marge: margeDefaut });
  renderTranches(lireParams());
}

function supprimerTranche(id) {
  tranches = tranches.filter(t => t.id !== id);
  renderTranches(lireParams());
}
window.supprimerTranche = supprimerTranche;

function renderTranches(p) {
  const body = $('tranchesBody');
  if (!body) return;
  if (!tranches.length) {
    body.innerHTML = '<div class="tranches-empty">Aucune tranche — cliquez "+ Ajouter" pour en créer une.</div>';
    return;
  }

  // Lire les valeurs actuelles des inputs existants avant de re-rendre
  body.querySelectorAll('.tranche-row').forEach(row => {
    const id = +row.dataset.tid;
    const t  = tranches.find(x => x.id === id);
    if (!t) return;
    t.label = row.querySelector('.ti-label')?.value || '';
    t.colis = parseFloat(row.querySelector('.ti-colis')?.value) || t.colis;
    t.marge = parseFloat(row.querySelector('.ti-marge')?.value) || t.marge;
  });

  body.innerHTML = `
    <div class="tranche-header-row">
      <span>Description</span>
      <span>Colis/jour</span>
      <span>Marge %</span>
      <span>Prix/colis</span>
      <span>Prix/jour</span>
      <span>Prix/mois</span>
      <span></span>
    </div>
    ${tranches.map(t => {
      const ppc  = prixColisFor(t.colis, t.marge, p);
      const ppj  = ppc * t.colis;
      const ppm  = ppj * p.joursParMois;
      return `
      <div class="tranche-row" data-tid="${t.id}">
        <input class="ti-label" type="text" list="dlTranches" value="${esc(t.label)}" placeholder="Ex : Volume standard" title="Description de la tranche" oninput="syncTranche(${t.id})"/>
        <input class="ti-colis" type="number" value="${t.colis}" min="1" title="Colis par jour" oninput="recalcTranches()"/>
        <input class="ti-marge" type="number" value="${t.marge}" min="0" title="Marge en %" oninput="recalcTranches()"/>
        <span class="tranche-val">${fCHF(ppc)}</span>
        <span class="tranche-val">${fCHF(ppj)}</span>
        <span class="tranche-val">${fCHF(ppm)}</span>
        <button type="button" class="tranche-del" onclick="supprimerTranche(${t.id})" title="Supprimer">✕</button>
      </div>`;
    }).join('')}
  `;
}

function syncTranche(id) {
  const row = document.querySelector(`.tranche-row[data-tid="${id}"]`);
  if (!row) return;
  const t = tranches.find(x => x.id === id);
  if (t) t.label = row.querySelector('.ti-label')?.value || '';
}

function recalcTranches() {
  const p = lireParams();
  document.querySelectorAll('.tranche-row').forEach(row => {
    const id    = +row.dataset.tid;
    const t     = tranches.find(x => x.id === id);
    if (!t) return;
    t.colis = parseFloat(row.querySelector('.ti-colis')?.value) || 1;
    t.marge = parseFloat(row.querySelector('.ti-marge')?.value) || 0;
    const ppc = prixColisFor(t.colis, t.marge, p);
    const ppj = ppc * t.colis;
    const ppm = ppj * p.joursParMois;
    const vals = row.querySelectorAll('.tranche-val');
    if (vals[0]) vals[0].textContent = fCHF(ppc);
    if (vals[1]) vals[1].textContent = fCHF(ppj);
    if (vals[2]) vals[2].textContent = fCHF(ppm);
  });
}
window.ajouterTranche  = ajouterTranche;
window.recalcTranches  = recalcTranches;
window.syncTranche     = syncTranche;
window.ajouterVitesse  = ajouterVitesse;

/* ── Niveaux de service (vitesses) ───────────────────────── */
const VITESSES_DEFAUT = [
  { label: 'Standard 48h',    pct: 60, surcharge: 0  },
  { label: 'Prioritaire 24h', pct: 30, surcharge: 15 },
  { label: 'Express',          pct: 10, surcharge: 40 },
];

function ajouterVitesse(label = '', pct = 0, surcharge = 0) {
  vitesses.push({ id: ++_vid, label, pct, surcharge });
  renderVitesses();
}

function supprimerVitesse(id) {
  vitesses = vitesses.filter(v => v.id !== id);
  renderVitesses();
}
window.supprimerVitesse = supprimerVitesse;

function syncVitesse(id) {
  const row = document.querySelector(`.vitesse-row[data-vid="${id}"]`);
  if (!row) return;
  const v = vitesses.find(x => x.id === id);
  if (!v) return;
  v.label     = row.querySelector('.vi-label')?.value    || '';
  v.pct       = parseFloat(row.querySelector('.vi-pct')?.value) || 0;
  v.surcharge = parseFloat(row.querySelector('.vi-surcharge')?.value) || 0;
}
window.syncVitesse = syncVitesse;

function renderVitesses() {
  const body = $('vitessesBody');
  if (!body) return;

  // Sync avant re-render
  body.querySelectorAll('.vitesse-row').forEach(row => {
    const id = +row.dataset.vid;
    const v  = vitesses.find(x => x.id === id);
    if (!v) return;
    v.label     = row.querySelector('.vi-label')?.value || '';
    v.pct       = parseFloat(row.querySelector('.vi-pct')?.value)       || 0;
    v.surcharge = parseFloat(row.querySelector('.vi-surcharge')?.value) || 0;
  });

  if (!vitesses.length) {
    body.innerHTML = '<div class="vitesses-empty">Aucun niveau défini — cliquez "+ Ajouter" pour en créer.</div>';
    return;
  }

  const p          = lireParams();
  const marge      = num('cMarge') || 20;
  const totalColis = num('cColisJour') || 1;
  const totalPct   = vitesses.reduce((s, v) => s + v.pct, 0);

  // Prix de base calculé sur le volume TOTAL — partagé entre tous les colis
  const basePPC = prixColisFor(totalColis, marge, p);

  body.innerHTML = `
    <div class="vitesse-header-row">
      <span>Libellé</span>
      <span>% volume</span>
      <span>Suppl. %</span>
      <span>Colis/jour</span>
      <span>Prix/colis</span>
      <span></span>
    </div>
    ${vitesses.map(v => {
      const colisV = totalColis * v.pct / 100;
      const ppc    = basePPC * (1 + v.surcharge / 100);
      return `
      <div class="vitesse-row" data-vid="${v.id}">
        <input class="vi-label" type="text" list="dlVitesses" value="${esc(v.label)}" placeholder="Ex : Standard 48h" title="Libellé" oninput="syncVitesse(${v.id})"/>
        <div class="vitesse-surcharge-wrap">
          <input class="vi-pct" type="number" value="${v.pct}" min="0" max="100" step="5" title="Part du volume (%)" oninput="syncVitesse(${v.id})"/>
          <span>%</span>
        </div>
        <div class="vitesse-surcharge-wrap">
          <input class="vi-surcharge" type="number" value="${v.surcharge}" min="0" step="5" title="Supplément sur le prix de base (%)" oninput="syncVitesse(${v.id})"/>
          <span>%</span>
        </div>
        <span class="tranche-val">${fNum(colisV, 0)}</span>
        <span class="tranche-val accent">${fCHF(ppc)}</span>
        <button type="button" class="tranche-del" onclick="supprimerVitesse(${v.id})" title="Supprimer">✕</button>
      </div>`;
    }).join('')}
    ${totalPct !== 100 ? `<div class="vitesse-total-warn">⚠ Total volumes : ${totalPct}% (devrait être 100%)</div>` : `<div class="vitesse-total-ok">✓ Total volumes : 100%</div>`}
  `;
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
  const kmJour      = val('cKmJour')        || '—';
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
      <div class="offre-logo-mark">C</div>
      <div>
        <div class="offre-logo-name">COLIXO</div>
        <div class="offre-logo-sub">Livraison express · Suisse romande</div>
      </div>
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
    <div class="offre-section-title">5. TARIFICATION PROPOSÉE</div>
    ${(tranches.length && vitesses.length) ? `
    <!-- Matrice volume × niveau de service -->
    <table class="offre-tranche-table">
      <thead>
        <tr>
          <th>Niveau de service</th>
          <th>% volume</th>
          ${tranches.map(t => `<th>${t.colis} col/j${t.label ? '<br><small>' + esc(t.label) + '</small>' : ''}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${vitesses.map(v => `
          <tr>
            <td><strong>${esc(v.label)}</strong></td>
            <td>${v.pct}%</td>
            ${tranches.map(t => {
              const basePPC = prixColisFor(t.colis, t.marge, calcResult);
              const ppc     = basePPC * (1 + v.surcharge / 100);
              return `<td class="tranche-price">${fCHF(ppc)}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : tranches.length ? `
    <!-- Tranches seules -->
    <table class="offre-tranche-table">
      <thead>
        <tr>
          <th>Volume</th><th>Description</th><th>Prix / colis</th><th>Prix / semaine</th><th>Prix / mois</th>
        </tr>
      </thead>
      <tbody>
        ${tranches.map(t => {
          const ppc = prixColisFor(t.colis, t.marge, calcResult);
          const ppj = ppc * t.colis;
          return `<tr>
            <td><strong>${t.colis} colis/jour</strong></td>
            <td>${esc(t.label) || '—'}</td>
            <td class="tranche-price">${fCHF(ppc)}</td>
            <td>${fCHF(ppj * 5)}</td>
            <td>${fCHF(ppj * calcResult.joursParMois)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ` : vitesses.length ? `
    <!-- Vitesses seules -->
    <table class="offre-tranche-table">
      <thead>
        <tr><th>Niveau de service</th><th>Volume/jour</th><th>Suppl.</th><th>Prix / colis</th><th>Prix / semaine</th><th>Prix / mois</th></tr>
      </thead>
      <tbody>
        ${(() => {
          const basePPC = prixColisFor(calcResult.colisJour, calcResult.marge, calcResult);
          return vitesses.map(v => {
            const colisV = calcResult.colisJour * v.pct / 100;
            const ppc    = basePPC * (1 + v.surcharge / 100);
            const ppj    = ppc * colisV;
            return `<tr>
              <td><strong>${esc(v.label)}</strong></td>
              <td>${fNum(colisV, 0)} colis (${v.pct}%)</td>
              <td>${v.surcharge > 0 ? '+' + v.surcharge + '%' : '—'}</td>
              <td class="tranche-price">${fCHF(ppc)}</td>
              <td>${fCHF(ppj * 5)}</td>
              <td>${fCHF(ppj * calcResult.joursParMois)}</td>
            </tr>`;
          }).join('');
        })()}
      </tbody>
    </table>
    ` : `
    <!-- Prix simple -->
    <div class="offre-tarif-grid">
      <div class="offre-tarif-card primary">
        <div class="offre-tarif-lbl">Prix journalier</div>
        <div class="offre-tarif-val">${fCHF(calcResult.prixClientJour)}</div>
        <div class="offre-tarif-sub">CHF HT / jour ouvrable</div>
      </div>
      <div class="offre-tarif-card">
        <div class="offre-tarif-lbl">Prix mensuel estimé</div>
        <div class="offre-tarif-val">${fCHF(calcResult.prixClientMois)}</div>
        <div class="offre-tarif-sub">CHF HT / mois (${calcResult.joursParMois} jours)</div>
      </div>
      <div class="offre-tarif-card">
        <div class="offre-tarif-lbl">Prix par colis</div>
        <div class="offre-tarif-val">${fCHF(calcResult.prixParColis)}</div>
        <div class="offre-tarif-sub">CHF HT / colis</div>
      </div>
    </div>
    `}
    <p class="offre-tarif-note">Prix indicatifs, hors TVA. Sous réserve de validation opérationnelle.</p>
  </div>

  <div class="offre-section">
    <div class="offre-section-title">6. CONDITIONS COMMERCIALES</div>
    <ul class="offre-list">
      <li>Offre valable <strong>30 jours</strong> à compter de la date d'émission</li>
      <li>Paiement : facturation hebdomadaire (tous les 7 jours), payable à 10 jours net</li>
      <li>Contrat de prestation ajustable en fonction des volumes réels</li>
      <li>Reconduction tacite mensuelle — résiliation avec préavis 30 jours</li>
      <li>Prix révisables annuellement selon indice des prix à la consommation</li>
    </ul>
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
  // Init tranches vide
  renderTranches(lireParams());

  // Init vitesses avec les 3 niveaux par défaut
  VITESSES_DEFAUT.forEach(v => ajouterVitesse(v.label, v.pct, v.surcharge));

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
window.goSection      = goSection;
window.prevSection    = prevSection;
window.nextSection    = nextSection;
window.calculer       = calculer;
window.genererOffre   = genererOffre;
window.imprimerOffre  = imprimerOffre;
window.copierOffre    = copierOffre;
window.reinitialiser  = reinitialiser;
