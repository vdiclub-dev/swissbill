// ============================================================
// js/client-picker.js — Sélecteur client partagé (table entreprises)
// ============================================================
// Usage:
//   ouvrirClientPicker(callback)
//   callback reçoit l'objet entreprise sélectionné
// ============================================================

(function () {

  /* ── Injection CSS ─────────────────────────────────────── */
  const STYLE = `
  #cpOverlay {
    display:none; position:fixed; inset:0; z-index:9000;
    background:rgba(0,0,0,.65); backdrop-filter:blur(4px);
    align-items:center; justify-content:center;
  }
  #cpOverlay.open { display:flex; }
  #cpBox {
    background:#1a1a1a; border:1px solid #333; border-radius:14px;
    width:min(640px,96vw); max-height:82vh; display:flex; flex-direction:column;
    box-shadow:0 24px 64px rgba(0,0,0,.6);
  }
  #cpHead {
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 22px; border-bottom:1px solid #2a2a2a;
  }
  #cpHead h3 { margin:0; font-size:1.05rem; color:#f1f1f1; font-weight:600; }
  #cpClose {
    background:none; border:none; color:#888; font-size:1.2rem;
    cursor:pointer; width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    transition:background .15s;
  }
  #cpClose:hover { background:#333; color:#fff; }
  #cpSearchWrap { padding:14px 22px; border-bottom:1px solid #2a2a2a; }
  #cpSearch {
    width:100%; padding:10px 14px; background:#111; border:1px solid #333;
    border-radius:8px; color:#f1f1f1; font-size:.95rem; outline:none;
    transition:border-color .2s; box-sizing:border-box;
  }
  #cpSearch:focus { border-color:#e85d04; }
  #cpList { overflow-y:auto; flex:1; padding:10px 12px; }
  .cp-item {
    padding:11px 14px; border-radius:8px; cursor:pointer;
    display:flex; align-items:center; gap:14px;
    transition:background .15s; margin-bottom:3px;
  }
  .cp-item:hover { background:#2a2a2a; }
  .cp-avatar {
    width:38px; height:38px; border-radius:50%; background:#e85d04;
    display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:.9rem; color:#fff; flex-shrink:0;
  }
  .cp-info { flex:1; min-width:0; }
  .cp-nom { font-size:.95rem; font-weight:600; color:#f1f1f1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cp-sub { font-size:.78rem; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cp-badge {
    font-size:.72rem; padding:2px 8px; border-radius:20px;
    background:#2a2a2a; color:#aaa; white-space:nowrap;
  }
  #cpEmpty { padding:32px; text-align:center; color:#666; font-size:.9rem; }
  #cpLoader { padding:32px; text-align:center; color:#888; font-size:.9rem; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  /* ── DOM ─────────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'cpOverlay';
  overlay.innerHTML = `
    <div id="cpBox">
      <div id="cpHead">
        <h3>🏢 Sélectionner un client</h3>
        <button id="cpClose" onclick="fermerClientPicker()">✕</button>
      </div>
      <div id="cpSearchWrap">
        <input id="cpSearch" type="text" placeholder="🔍 Rechercher par nom, ville, numéro client…" autocomplete="off"/>
      </div>
      <div id="cpList">
        <div id="cpLoader">Chargement…</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  /* ── État ────────────────────────────────────────────────── */
  let _callback = null;
  let _allClients = [];
  let _loaded = false;
  let _searchTimer = null;

  /* ── Helpers ─────────────────────────────────────────────── */
  function getDB() {
    return window.SUPABASE_CLIENT || null;
  }

  function initials(nom) {
    return (nom || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  /* ── Rendu liste ─────────────────────────────────────────── */
  function renderList(items) {
    const list = document.getElementById('cpList');
    if (!items.length) {
      list.innerHTML = '<div id="cpEmpty">Aucun client trouvé.</div>';
      return;
    }
    list.innerHTML = items.map(c => `
      <div class="cp-item" onclick="window._cpSelectClient(${c.id})">
        <div class="cp-avatar">${initials(c.nom)}</div>
        <div class="cp-info">
          <div class="cp-nom">${c.nom || '—'}</div>
          <div class="cp-sub">${[c.adresse, c.npa, c.ville].filter(Boolean).join(', ') || (c.email || '')}</div>
        </div>
        ${c.numero_client ? `<div class="cp-badge">${c.numero_client}</div>` : ''}
      </div>
    `).join('');
  }

  /* ── Recherche ───────────────────────────────────────────── */
  function filterLocal(q) {
    if (!q) return _allClients;
    q = q.toLowerCase();
    return _allClients.filter(c =>
      (c.nom || '').toLowerCase().includes(q) ||
      (c.ville || '').toLowerCase().includes(q) ||
      (c.numero_client || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }

  /* ── Chargement Supabase ─────────────────────────────────── */
  async function chargerClients() {
    const db = getDB();
    if (!db) {
      document.getElementById('cpList').innerHTML =
        '<div id="cpEmpty">Base de données non disponible.</div>';
      return;
    }
    const { data, error } = await db
      .from('entreprises')
      .select('id,nom,numero_client,email,telephone,contact_nom,adresse,npa,ville')
      .order('nom');
    if (error || !data) {
      document.getElementById('cpList').innerHTML =
        '<div id="cpEmpty">Erreur de chargement.</div>';
      return;
    }
    _allClients = data;
    renderList(data);
    _loaded = true;
  }

  /* ── Sélection ───────────────────────────────────────────── */
  window._cpSelectClient = function (id) {
    const client = _allClients.find(c => c.id === id);
    if (client && _callback) _callback(client);
    fermerClientPicker();
  };

  /* ── API publique ────────────────────────────────────────── */
  window.ouvrirClientPicker = function (callback) {
    _callback = callback || null;
    overlay.classList.add('open');

    const search = document.getElementById('cpSearch');
    search.value = '';

    if (!_loaded) {
      chargerClients();
    } else {
      renderList(_allClients);
    }

    setTimeout(() => search.focus(), 80);
  };

  window.fermerClientPicker = function () {
    overlay.classList.remove('open');
    _callback = null;
  };

  /* ── Recherche en temps réel ─────────────────────────────── */
  document.getElementById('cpSearch').addEventListener('input', function () {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => renderList(filterLocal(this.value)), 200);
  });

  /* ── Fermer sur clic overlay ─────────────────────────────── */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) fermerClientPicker();
  });

  /* ── Fermer sur Escape ───────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fermerClientPicker();
  });

})();
