/**
 * Colixo — js/devis.js
 * Live price estimation + form validation + print/PDF
 */

const TARIFS = {
  starter:    { base: 28,   km: 0.55, label: 'Starter' },
  pro:        { base: 480,  km: 0.40, label: 'Pro (mensuel)' },
  entreprise: { base: null, km: 0.30, label: 'Entreprise' },
};

const SECTEUR_MULT = {
  hotellerie:  1.0,
  restauration:1.0,
  industrie:   1.1,
  frais:       1.15,
  express:     1.3,
  autre:       1.0,
};

let currentEstimate = null;

function calculerPrix() {
  const secteur  = document.getElementById('secteur')?.value || 'autre';
  const forfait  = document.getElementById('forfait')?.value || 'starter';
  const volume   = parseInt(document.getElementById('volume')?.value) || 0;
  const distance = parseInt(document.getElementById('distance')?.value) || 20;

  const t = TARIFS[forfait];
  const mult = SECTEUR_MULT[secteur] || 1.0;

  let prix = null;
  let detail = '';

  if (forfait === 'entreprise') {
    document.getElementById('estPrix').textContent = 'Sur devis';
    document.getElementById('estDetail').textContent = 'Contactez-nous pour un devis personnalisé grand compte.';
    document.getElementById('estForfait').textContent = 'Entreprise';
    currentEstimate = null;
    return;
  }

  if (forfait === 'pro') {
    const kmCost = volume > 0 ? volume * distance * t.km * mult : 0;
    prix = t.base + kmCost;
    detail = `CHF ${t.base} forfait + ${volume} livraisons × ${distance} km × CHF ${t.km}/km`;
  } else {
    const prixUnit = (t.base + distance * t.km) * mult;
    prix = volume > 0 ? prixUnit * volume : prixUnit;
    detail = volume > 1
      ? `${volume} × CHF ${prixUnit.toFixed(2)} (base + km)`
      : `CHF ${t.base} base + ${distance} km × CHF ${t.km}/km`;
  }

  currentEstimate = { prix, forfait, secteur, volume, distance, mult };

  document.getElementById('estPrix').textContent = `CHF ${Math.round(prix).toLocaleString('fr-CH')}`;
  document.getElementById('estDetail').textContent = detail;
  document.getElementById('estForfait').textContent = t.label;

  const bar = document.getElementById('priceBar');
  const pct = Math.min((prix / 2000) * 100, 100);
  bar.style.width = `${pct}%`;
}

function validerFormulaire() {
  const champs = ['entreprise', 'nom', 'email', 'telephone', 'secteur', 'forfait'];
  let ok = true;
  champs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const grp = el.closest('.form-group');
    if (!el.value.trim()) {
      grp?.classList.add('error');
      ok = false;
    } else {
      grp?.classList.remove('error');
    }
  });
  const email = document.getElementById('email')?.value || '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('email')?.closest('.form-group')?.classList.add('error');
    ok = false;
  }
  return ok;
}

async function envoyerDevis(e) {
  e.preventDefault();
  if (!validerFormulaire()) {
    afficherMessage('Veuillez remplir tous les champs obligatoires.', 'err');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  const payload = {
    entreprise: document.getElementById('entreprise')?.value,
    nom:        document.getElementById('nom')?.value,
    email:      document.getElementById('email')?.value,
    telephone:  document.getElementById('telephone')?.value,
    secteur:    document.getElementById('secteur')?.value,
    forfait:    document.getElementById('forfait')?.value,
    volume:     document.getElementById('volume')?.value,
    distance:   document.getElementById('distance')?.value,
    adresse:    document.getElementById('adresse')?.value,
    message:    document.getElementById('message')?.value,
    estimation: currentEstimate ? `CHF ${Math.round(currentEstimate.prix).toLocaleString('fr-CH')}` : 'Sur devis',
  };

  try {
    const url = window.SUPABASE_URL
      ? `${window.SUPABASE_URL}/functions/v1/devis-request`
      : null;

    if (url) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: window.SUPABASE_ANON_KEY },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Erreur serveur');
    }

    afficherSucces(payload);
  } catch {
    afficherMessage('Erreur lors de l\'envoi. Réessayez ou contactez-nous par email.', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Envoyer ma demande →';
  }
}

function afficherSucces(data) {
  const form = document.getElementById('devisForm');
  const success = document.getElementById('successBlock');
  form.style.display = 'none';
  success.style.display = 'block';
  document.getElementById('successNom').textContent = data.nom;
  document.getElementById('successEmail').textContent = data.email;
  document.getElementById('successEstimation').textContent = data.estimation;
}

function afficherMessage(msg, type) {
  const zone = document.getElementById('toastZone');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  zone.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function imprimerDevis() {
  window.print();
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  calculerPrix();

  ['secteur', 'forfait', 'volume', 'distance'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', calculerPrix);
    document.getElementById(id)?.addEventListener('input', calculerPrix);
  });

  document.getElementById('devisForm')?.addEventListener('submit', envoyerDevis);

  document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(el => {
    el.addEventListener('blur', () => {
      const grp = el.closest('.form-group');
      if (el.value.trim()) grp?.classList.remove('error');
    });
  });
});
