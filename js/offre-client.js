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

/* ── Calcul automatique ──────────────────────────────────── */
function calculer() {
  const kmJour         = num('cKmJour');
  const litres100      = num('cLitres100') || 8;
  const prixCarburant  = num('cPrixCarburant') || 1.90;
  const heuresJour     = num('cHeuresJour');
  const coutHoraire    = num('cCoutHoraire') || 35;
  const nbVehicules    = num('cNbVehicules') || 1;
  const nbChauffeurs   = num('cNbChauffeurs') || nbVehicules;
  const fraisFixes     = num('cFraisFixes');
  const marge          = num('cMarge') || 20;
  const colisJour      = num('cColisJour') || 1;
  const joursParMois   = num('cJoursParMois') || 22;
  const prepColis      = chk('cPrepCommandes');
  const coutPrep       = num('cCoutPrep') || 2;

  // Calculs de coûts
  const coutCarburant  = kmJour * litres100 / 100 * prixCarburant * nbVehicules;
  const coutChauffeur  = heuresJour * coutHoraire * nbChauffeurs;
  const coutVehicule   = fraisFixes * nbVehicules;
  const coutLogistique = prepColis ? colisJour * coutPrep : 0;
  const coutTotalJour  = coutCarburant + coutChauffeur + coutVehicule + coutLogistique;
  const coutTotalMois  = coutTotalJour * joursParMois;

  // Prix client avec marge
  const margeCHFJour   = coutTotalJour * (marge / 100);
  const prixClientJour = coutTotalJour + margeCHFJour;
  const prixClientMois = prixClientJour * joursParMois;
  const colisTotal     = colisJour || 1;
  const prixParColis   = prixClientJour / colisTotal;

  calcResult = {
    coutCarburant, coutChauffeur, coutVehicule, coutLogistique,
    coutTotalJour, coutTotalMois,
    margeCHFJour, marge,
    prixClientJour, prixClientMois, prixParColis,
    colisJour, kmJour, joursParMois,
  };

  // Afficher résultats
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('rCoutCarburant',  fCHF(coutCarburant));
  set('rCoutChauffeur',  fCHF(coutChauffeur));
  set('rCoutVehicule',   fCHF(coutVehicule));
  set('rCoutLogistique', fCHF(coutLogistique));
  set('rCoutTotalJour',  fCHF(coutTotalJour));
  set('rCoutTotalMois',  fCHF(coutTotalMois));
  set('rMargeChf',       fCHF(margeCHFJour));
  set('rPrixJour',       fCHF(prixClientJour));
  set('rPrixMois',       fCHF(prixClientMois));
  set('rPrixColis',      fCHF(prixParColis));
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
    <p class="offre-tarif-note">Prix indicatifs, hors TVA. Sous réserve de validation opérationnelle. Ajustement possible si le volume réel, les kilomètres ou les contraintes changent.</p>
  </div>

  <div class="offre-section">
    <div class="offre-section-title">6. CONDITIONS COMMERCIALES</div>
    <ul class="offre-list">
      <li>Offre valable <strong>30 jours</strong> à compter de la date d'émission</li>
      <li>Paiement : à 30 jours net, sur facturation mensuelle</li>
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
  const calcFields = ['cKmJour','cLitres100','cPrixCarburant','cHeuresJour','cCoutHoraire',
    'cNbVehicules','cFraisFixes','cMarge','cColisJour','cJoursParMois','cCoutPrep'];
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
