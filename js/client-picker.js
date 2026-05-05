// ============================================================
// js/client-picker.js — Sélecteur client partagé (table entreprises)
// ============================================================
// Usage:
//   ouvrirClientPicker(callback)
//   callback reçoit l'objet entreprise sélectionné
// ============================================================

(function () {

  /* ── CSS injecté ─────────────────────────────────────────── */
  const STYLE = `
  #cpOverlay {
    display:none; position:fixed; inset:0; z-index:9000;
    background:rgba(0,0,0,.7); backdrop-filter:blur(4px);
    align-items:center; justify-content:center;
  }
  #cpOverlay.open { display:flex; }
  #cpBox {
    background:#1a1a1a; border:1px solid #333; border-radius:14px;
    width:min(640px,96vw); max-height:86vh; display:flex; flex-direction:column;
    box-shadow:0 24px 64px rgba(0,0,0,.6);
  }
  #cpHead {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 20px; border-bottom:1px solid #2a2a2a; gap:10px;
  }
  #cpHead h3 { margin:0; font-size:1rem; color:#f1f1f1; font-weight:600; flex:1; }
  #cpBtnNew {
    background:#e85d04; color:#fff; border:none; border-radius:7px;
    padding:7px 14px; font-size:.8rem; font-weight:700; cursor:pointer;
    transition:filter .15s; white-space:nowrap;
  }
  #cpBtnNew:hover { filter:brightness(1.1); }
  #cpClose {
    background:none; border:none; color:#888; font-size:1.2rem;
    cursor:pointer; width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center; transition:background .15s;
  }
  #cpClose:hover { background:#333; color:#fff; }
  #cpSearchWrap { padding:12px 20px; border-bottom:1px solid #2a2a2a; }
  #cpSearch {
    width:100%; padding:9px 14px; background:#111; border:1px solid #333;
    border-radius:8px; color:#f1f1f1; font-size:.92rem; outline:none;
    transition:border-color .2s; box-sizing:border-box;
  }
  #cpSearch:focus { border-color:#e85d04; }
  #cpList { overflow-y:auto; flex:1; padding:8px 10px; }
  .cp-item {
    padding:10px 12px; border-radius:8px;
    display:flex; align-items:center; gap:12px;
    transition:background .12s; margin-bottom:2px; cursor:pointer;
  }
  .cp-item:hover { background:#252525; }
  .cp-avatar {
    width:36px; height:36px; border-radius:50%; background:#e85d04;
    display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:.85rem; color:#fff; flex-shrink:0;
  }
  .cp-info { flex:1; min-width:0; }
  .cp-nom { font-size:.92rem; font-weight:600; color:#f1f1f1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cp-sub { font-size:.76rem; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cp-badge { font-size:.7rem; padding:2px 8px; border-radius:20px; background:#2a2a2a; color:#aaa; white-space:nowrap; }
  .cp-edit-btn {
    background:none; border:1px solid #333; border-radius:6px; color:#888;
    font-size:.75rem; padding:4px 10px; cursor:pointer; transition:all .15s; white-space:nowrap;
    flex-shrink:0;
  }
  .cp-edit-btn:hover { border-color:#e85d04; color:#e85d04; background:rgba(232,93,4,.08); }
  #cpEmpty { padding:32px; text-align:center; color:#666; font-size:.9rem; }
  #cpLoader { padding:32px; text-align:center; color:#888; font-size:.9rem; }

  /* ── Formulaire create/edit ──────────────────────────────── */
  #cpFormOverlay {
    display:none; position:fixed; inset:0; z-index:9100;
    background:rgba(0,0,0,.75); backdrop-filter:blur(4px);
    align-items:center; justify-content:center;
  }
  #cpFormOverlay.open { display:flex; }
  #cpFormBox {
    background:#1a1a1a; border:1px solid #333; border-radius:14px;
    width:min(560px,96vw); max-height:90vh; display:flex; flex-direction:column;
    box-shadow:0 24px 64px rgba(0,0,0,.7);
  }
  #cpFormHead {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 20px; border-bottom:1px solid #2a2a2a;
  }
  #cpFormHead h3 { margin:0; font-size:1rem; color:#f1f1f1; font-weight:600; }
  #cpFormClose {
    background:none; border:none; color:#888; font-size:1.2rem;
    cursor:pointer; width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
  }
  #cpFormClose:hover { background:#333; color:#fff; }
  #cpFormBody { overflow-y:auto; padding:20px; }
  .cpf-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .cpf-full { grid-column:1/-1; }
  .cpf-field label { display:block; font-size:.78rem; color:#999; margin-bottom:5px; font-weight:500; }
  .cpf-field input {
    width:100%; padding:9px 12px; background:#111; border:1px solid #333;
    border-radius:7px; color:#f1f1f1; font-size:.88rem; outline:none;
    transition:border-color .2s; box-sizing:border-box;
  }
  .cpf-field input:focus { border-color:#e85d04; }
  #cpFormFoot {
    display:flex; justify-content:flex-end; gap:10px;
    padding:14px 20px; border-top:1px solid #2a2a2a;
  }
  .cpf-btn-cancel {
    background:transparent; color:#999; border:1px solid #333; border-radius:7px;
    padding:9px 18px; font-size:.85rem; cursor:pointer; transition:all .15s;
  }
  .cpf-btn-cancel:hover { border-color:#555; color:#f1f1f1; }
  .cpf-btn-save {
    background:#e85d04; color:#fff; border:none; border-radius:7px;
    padding:9px 20px; font-size:.85rem; font-weight:700; cursor:pointer;
    transition:filter .15s;
  }
  .cpf-btn-save:hover { filter:brightness(1.1); }
  .cpf-saving { opacity:.6; pointer-events:none; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  /* ── DOM liste ───────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'cpOverlay';
  overlay.innerHTML = `
    <div id="cpBox">
      <div id="cpHead">
        <h3>🏢 Clients</h3>
        <button id="cpBtnNew">+ Nouveau client</button>
        <button id="cpClose">✕</button>
      </div>
      <div id="cpSearchWrap">
        <input id="cpSearch" type="text" placeholder="🔍 Rechercher par nom, ville, numéro client…" autocomplete="off"/>
      </div>
      <div id="cpList"><div id="cpLoader">Chargement…</div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  /* ── DOM formulaire ──────────────────────────────────────── */
  const formOverlay = document.createElement('div');
  formOverlay.id = 'cpFormOverlay';
  formOverlay.innerHTML = `
    <div id="cpFormBox">
      <div id="cpFormHead">
        <h3 id="cpFormTitle">Nouveau client</h3>
        <button id="cpFormClose">✕</button>
      </div>
      <div id="cpFormBody">
        <div class="cpf-grid">
          <div class="cpf-field cpf-full">
            <label>Nom de l'entreprise *</label>
            <input id="cpfNom" type="text" placeholder="Ex : Dupont SA"/>
          </div>
          <div class="cpf-field">
            <label>Numéro client <span id="cpfNumeroHint" style="color:#e85d04;font-size:.72rem;font-weight:400;">(auto)</span></label>
            <input id="cpfNumero" type="text" placeholder="Ex : CLI-001"/>
          </div>
          <div class="cpf-field">
            <label>Contact — Nom</label>
            <input id="cpfContactNom" type="text" placeholder="Ex : Jean Dupont"/>
          </div>
          <div class="cpf-field">
            <label>Fonction</label>
            <input id="cpfFonction" type="text" placeholder="Ex : Directeur logistique"/>
          </div>
          <div class="cpf-field">
            <label>Email</label>
            <input id="cpfEmail" type="email" placeholder="jean@exemple.ch"/>
          </div>
          <div class="cpf-field">
            <label>Téléphone</label>
            <input id="cpfTelephone" type="tel" placeholder="+41 XX XXX XX XX"/>
          </div>
          <div class="cpf-field cpf-full">
            <label>Adresse</label>
            <input id="cpfAdresse" type="text" placeholder="Rue de la Paix 1"/>
          </div>
          <div class="cpf-field">
            <label>NPA</label>
            <input id="cpfNpa" type="text" placeholder="1000"/>
          </div>
          <div class="cpf-field">
            <label>Ville</label>
            <input id="cpfVille" type="text" placeholder="Lausanne"/>
          </div>
          <div class="cpf-field">
            <label>Canton</label>
            <input id="cpfCanton" type="text" placeholder="Ex : VD"/>
          </div>
          <div class="cpf-field">
            <label>Site web</label>
            <input id="cpfSiteWeb" type="url" placeholder="https://entreprise.ch"/>
          </div>
          <div class="cpf-field cpf-full">
            <label>Secteur d'activité</label>
            <input id="cpfSecteur" type="text" placeholder="Ex : E-commerce, Pharmacie…"/>
          </div>
        </div>
      </div>
      <div id="cpFormFoot">
        <button class="cpf-btn-cancel" id="cpfBtnCancel">Annuler</button>
        <button class="cpf-btn-save" id="cpfBtnSave">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(formOverlay);

  /* ── État ────────────────────────────────────────────────── */
  let _callback   = null;
  let _allClients = [];
  let _loaded     = false;
  let _searchTimer= null;
  let _editId     = null;  // null = création, id = modification

  /* ── Helpers ─────────────────────────────────────────────── */
  function getDB() { return window.SUPABASE_CLIENT || null; }
  function initials(nom) {
    return (nom || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }
  function gf(id) { return (document.getElementById(id)?.value || '').trim(); }
  function sf(id, v) { const el = document.getElementById(id); if (el) el.value = v || ''; }

  function genererNumeroClient() {
    let max = 0;
    _allClients.forEach(c => {
      const m = /^CLI-(\d+)$/i.exec(c.numero_client || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'CLI-' + String(max + 1).padStart(3, '0');
  }

  /* ── Rendu liste ─────────────────────────────────────────── */
  function renderList(items) {
    const list = document.getElementById('cpList');
    if (!items.length) {
      list.innerHTML = '<div id="cpEmpty">Aucun client. Cliquez "+ Nouveau client" pour en créer un.</div>';
      return;
    }
    list.innerHTML = items.map(c => `
      <div class="cp-item" data-cpid="${c.id}">
        <div class="cp-avatar">${initials(c.nom)}</div>
        <div class="cp-info">
          <div class="cp-nom">${c.nom || '—'}</div>
          <div class="cp-sub">${[c.adresse, c.npa, c.ville].filter(Boolean).join(', ') || (c.email || '')}</div>
        </div>
        ${c.numero_client ? `<span class="cp-badge">${c.numero_client}</span>` : ''}
        <button class="cp-edit-btn" data-cpedit="${c.id}">✏️ Modifier</button>
      </div>
    `).join('');
  }

  /* ── Filtre local ────────────────────────────────────────── */
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
      document.getElementById('cpList').innerHTML = '<div id="cpEmpty">Base de données non disponible.</div>';
      return;
    }
    const { data, error } = await db
      .from('entreprises')
      .select('*')
      .order('nom');
    if (error || !data) {
      document.getElementById('cpList').innerHTML = '<div id="cpEmpty">Erreur de chargement.</div>';
      return;
    }
    _allClients = data;
    renderList(data);
    _loaded = true;
  }

  /* ── Délégation clics sur la liste ──────────────────────── */
  document.getElementById('cpList').addEventListener('click', function (e) {
    // Bouton modifier
    const editBtn = e.target.closest('[data-cpedit]');
    if (editBtn) {
      e.stopPropagation();
      ouvrirForm(editBtn.dataset.cpedit);
      return;
    }
    // Clic sur la ligne → sélection
    const item = e.target.closest('[data-cpid]');
    if (item) {
      const client = _allClients.find(c => String(c.id) === String(item.dataset.cpid));
      if (client && _callback) _callback(client);
      fermerClientPicker();
    }
  });

  /* ── Ouvrir formulaire ───────────────────────────────────── */
  function ouvrirForm(id) {
    _editId = id || null;
    const client = id ? _allClients.find(c => String(c.id) === String(id)) : null;
    document.getElementById('cpFormTitle').textContent = client ? '✏️ Modifier le client' : '➕ Nouveau client';
    sf('cpfNom',        client?.nom);
    sf('cpfContactNom', client?.contact_nom);
    sf('cpfFonction',   client?.contact_fonction);
    sf('cpfEmail',      client?.email);
    sf('cpfTelephone',  client?.telephone);
    sf('cpfAdresse',    client?.adresse);
    sf('cpfNpa',        client?.npa);
    sf('cpfVille',      client?.ville);
    sf('cpfCanton',     client?.canton);
    sf('cpfSiteWeb',    client?.site_web);
    sf('cpfSecteur',    client?.secteur);

    const numEl  = document.getElementById('cpfNumero');
    const hint   = document.getElementById('cpfNumeroHint');
    if (client) {
      numEl.value    = client.numero_client || '';
      numEl.readOnly = false;
      numEl.style.color = '';
      if (hint) hint.style.display = 'none';
    } else {
      numEl.value    = genererNumeroClient();
      numEl.readOnly = true;
      numEl.style.color = '#e85d04';
      if (hint) hint.style.display = '';
    }

    formOverlay.classList.add('open');
    setTimeout(() => document.getElementById('cpfNom').focus(), 80);
  }

  function fermerForm() {
    formOverlay.classList.remove('open');
    _editId = null;
  }

  /* ── Sauvegarder (create ou update) ─────────────────────── */
  async function sauvegarder() {
    const nom = gf('cpfNom');
    if (!nom) { document.getElementById('cpfNom').focus(); return; }

    const db = getDB();
    if (!db) return;

    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      alert('Session email requise. Reconnectez-vous avec votre adresse e-mail et mot de passe pour créer ou modifier un client.');
      return;
    }

    const payload = {
      nom,
      numero_client:    gf('cpfNumero')     || null,
      contact_nom:      gf('cpfContactNom') || null,
      contact_fonction: gf('cpfFonction')   || null,
      email:            gf('cpfEmail')      || null,
      telephone:        gf('cpfTelephone')  || null,
      adresse:          gf('cpfAdresse')    || null,
      npa:              gf('cpfNpa')        || null,
      ville:            gf('cpfVille')      || null,
      canton:           gf('cpfCanton')     || null,
      site_web:         gf('cpfSiteWeb')    || null,
      secteur:          gf('cpfSecteur')    || null,
    };

    const btn = document.getElementById('cpfBtnSave');
    btn.classList.add('cpf-saving');
    btn.textContent = 'Enregistrement…';

    let data, error;
    if (_editId) {
      ({ data, error } = await db.from('entreprises').update(payload).eq('id', _editId).select().single());
    } else {
      ({ data, error } = await db.from('entreprises').insert([payload]).select().single());
    }

    btn.classList.remove('cpf-saving');
    btn.textContent = 'Enregistrer';

    if (error) {
      alert('Erreur : ' + (error.message || 'impossible de sauvegarder'));
      return;
    }

    // Mettre à jour la liste locale
    const wasNew = !_editId;
    if (_editId) {
      const idx = _allClients.findIndex(c => String(c.id) === String(_editId));
      if (idx >= 0) _allClients[idx] = { ..._allClients[idx], ...payload, id: _allClients[idx].id };
    } else {
      _allClients.unshift(data);
    }
    _allClients.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));

    fermerForm();

    // Si création → sélectionner automatiquement le nouveau client
    if (wasNew && data && _callback) {
      _callback(data);
      fermerClientPicker();
    } else {
      renderList(filterLocal(document.getElementById('cpSearch').value));
    }
  }

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

  /* ── Boutons header liste ────────────────────────────────── */
  document.getElementById('cpBtnNew').addEventListener('click', () => ouvrirForm(null));
  document.getElementById('cpClose').addEventListener('click', fermerClientPicker);

  /* ── Boutons formulaire ──────────────────────────────────── */
  document.getElementById('cpFormClose').addEventListener('click', fermerForm);
  document.getElementById('cpfBtnCancel').addEventListener('click', fermerForm);
  document.getElementById('cpfBtnSave').addEventListener('click', sauvegarder);

  /* ── Recherche temps réel ────────────────────────────────── */
  document.getElementById('cpSearch').addEventListener('input', function () {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => renderList(filterLocal(this.value)), 180);
  });

  /* ── Fermer sur clic backdrop ────────────────────────────── */
  overlay.addEventListener('click', e => { if (e.target === overlay) fermerClientPicker(); });
  formOverlay.addEventListener('click', e => { if (e.target === formOverlay) fermerForm(); });

  /* ── Escape ──────────────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (formOverlay.classList.contains('open')) fermerForm();
    else fermerClientPicker();
  });

})();
