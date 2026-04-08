// ============================================================
//  config.js — Configuration Supabase pour Colixo
//  ⚠️  Ne jamais committer ce fichier dans un dépôt public !
//  Les pages chargent config.js en <script src="…?v=…"> (compatible Cloudflare).
//  Incrémenter COLIXO_ASSET_VERSION + version.txt (racine) + ?v= dans les HTML lors d’un déploiement important.
// ============================================================
window.COLIXO_ASSET_VERSION = '20260437';

/** Sur pages GitHub Pages (user.github.io/nom-du-repo/), les liens /login/… sans préfixe cassent. */
window.COLIXO_BASE_PATH = (function () {
    if (typeof location !== 'undefined' && /\.github\.io$/i.test(location.hostname)) {
        var parts = location.pathname.split('/').filter(Boolean);
        if (parts.length >= 1) return '/' + parts[0];
    }
    return '';
})();

/** Préfixe les chemins absolus du site (ex. /login/index.html → /repo/login/… sur github.io). */
window.colixoHref = function (path) {
    var p = path == null ? '/' : String(path);
    if (p === '') p = '/';
    if (p.charAt(0) !== '/') p = '/' + p;
    return (window.COLIXO_BASE_PATH || '') + p;
};

/** Corrige les <a href="/…"> après chargement du DOM (déploiement sous /repo/). */
(function colixoPatchAnchorLinks() {
    var base = window.COLIXO_BASE_PATH;
    if (!base || typeof document === 'undefined') return;
    function run() {
        document.querySelectorAll('a[href^="/"]').forEach(function (a) {
            var h = a.getAttribute('href');
            if (!h || h.startsWith('//')) return;
            if (a.getAttribute('data-colixo-base') === '1') return;
            a.setAttribute('href', base + h);
            a.setAttribute('data-colixo-base', '1');
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        setTimeout(run, 0);
    }
})();

window.SUPABASE_CONFIG = {
    url: "https://iubbsnntcreneakbdkmv.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"
};

// Brimot — envoi d'emails : si la facturation est sur un domaine sans PHP (ex. GitHub Pages),
// mettez l'URL absolue de send_mail.php sur l'hébergement qui exécute le PHP (ex. LWS).
// Exemple : window.BRIMOT_SEND_MAIL_URL = 'https://votredomaine.ch/admin/brimot/send_mail.php';
// Sinon : Edge send-brimot-invoice + Resend — secrets Supabase RESEND_API_KEY, BRIMOT_FROM_EMAIL (domaine vérifié Resend).
// Le « Répondre » du client utilise Reply-To = MAIL_BR dans facturation.html ; optionnel BRIMOT_REPLY_TO_EMAIL si pas de payload.
// Facturation Colixo (admin/facturation.html) : Edge send-colixo-facture — COLIXO_FROM_EMAIL optionnel ; optionnel window.COLIXO_FACTURE_REPLY_EMAIL ou secret COLIXO_REPLY_TO_EMAIL.
if (typeof window.BRIMOT_SEND_MAIL_URL === 'undefined') window.BRIMOT_SEND_MAIL_URL = '';

/**
 * OpenRouteService — itinéraires + géocodage secours (page Dispatch).
 * Mettez VOTRE clé (tableau de bord → https://openrouteservice.org/dev/#/home ).
 * Important : ne pas utiliser `if (undefined)` avec une clé par défaut — sinon votre clé peut être ignorée.
 * Laisser '' = le dispatch utilisera la clé de secours intégrée (quota partagé, vite saturé).
 * Même avec votre clé, le plan gratuit ORS a encore des plafonds / jour — voir « Usage » sur le site ORS.
 */
if (typeof window.COLIXO_ORS_KEY === 'undefined') window.COLIXO_ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUxMmJjYzg5NTQ4MGNiYWU2NGFjMzg3ZDFlNjJhY2ZmYWUwNmUxYmM0YzY3NmZmMDI5NjVmOTlhIiwiaCI6Im11cm11cjY0In0=';

/** Stockage session auth : localStorage → sessionStorage → mémoire (Edge « Tracking Prevention », Safari strict, etc.). */
function colixoAuthStorage() {
    var mem = Object.create(null);
    function works(store) {
        try {
            var k = '__colixo_ls__';
            store.setItem(k, '1');
            store.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    }
    if (typeof window !== 'undefined' && window.localStorage && works(window.localStorage)) {
        return { impl: window.localStorage, mode: 'localStorage' };
    }
    if (typeof window !== 'undefined' && window.sessionStorage && works(window.sessionStorage)) {
        return { impl: window.sessionStorage, mode: 'sessionStorage' };
    }
    return {
        impl: {
            getItem: function (key) { return mem[key] != null ? mem[key] : null; },
            setItem: function (key, val) { mem[key] = String(val); },
            removeItem: function (key) { delete mem[key]; }
        },
        mode: 'memory'
    };
}

// Client unique partagé — même storageKey sur toutes les pages
try {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        throw new Error('SDK Supabase non chargé (réseau ou blocage)');
    }
    var _authSt = colixoAuthStorage();
    window.COLIXO_AUTH_STORAGE_MODE = _authSt.mode;
    if (_authSt.mode !== 'localStorage') {
        console.info('[Colixo] Session auth →', _authSt.mode, '(évite Tracking Prevention / stockage bloqué — reconnexion si onglet fermé si mémoire)');
    }
    /** fetch natif (avant tout monkey-patch) — toutes les requêtes REST Supabase sans cache navigateur (Safari / prod). */
    var _colixoNativeFetch = typeof fetch === 'function'
        ? fetch.bind(typeof globalThis !== 'undefined' ? globalThis : window)
        : null;
    window.SUPABASE_CLIENT = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.key,
        {
            global: {
                fetch: function (url, options) {
                    if (!_colixoNativeFetch) return Promise.reject(new Error('fetch indisponible'));
                    var opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
                    opts.cache = 'no-store';
                    return _colixoNativeFetch(url, opts);
                }
            },
            auth: {
                persistSession: true,
                storageKey: 'Colixo-auth',
                storage: _authSt.impl,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );
    console.log('✅ Configuration Supabase chargée');
} catch (e) {
    console.warn('Supabase indisponible :', e && e.message);
    window.COLIXO_SUPABASE_INIT_ERROR = e && (e.message || String(e));
    window.SUPABASE_CLIENT = null;
}

if (typeof console !== 'undefined' && console.info) {
    console.info('[Colixo] build', window.COLIXO_ASSET_VERSION, 'base', window.COLIXO_BASE_PATH === '' ? '(racine)' : window.COLIXO_BASE_PATH);
}

/** GitHub Pages peut servir un vieux config.js en cache : version.txt est toujours relue (no-store) pour forcer un reload si le dépôt est plus récent que le bundle. */
(function colixoCheckServerVersion() {
    var bundle = window.COLIXO_ASSET_VERSION;
    if (!bundle || typeof fetch !== 'function' || typeof location === 'undefined') return;
    if (/^(file:|content:)/i.test(location.protocol)) return;
    var path = (typeof window.colixoHref === 'function') ? window.colixoHref('/version.txt') : ((window.COLIXO_BASE_PATH || '') + '/version.txt');
    var url = path + '?t=' + Date.now();
    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
        .then(function (txt) {
            var server = String(txt || '').trim();
            if (!server || server === bundle) return;
            if (server < bundle) return;
            var key = 'colixo_reload_ok_' + server;
            try {
                if (sessionStorage.getItem(key)) return;
                sessionStorage.setItem(key, '1');
            } catch (e) {}
            console.info('[Colixo] version serveur', server, '> bundle', bundle, '— rechargement');
            location.reload();
        })
        .catch(function () {});
})();

/** Barre fixe Accueil + Déconnexion (toutes les pages qui chargent config.js) */
(function colixoGlobalToolbar() {
    if (typeof document === 'undefined' || window.COLIXO_NO_GLOBAL_TOOLBAR) return;

    function homeHref() {
        if (typeof window.colixoHref === 'function') return window.colixoHref('/index.html');
        var bp = window.COLIXO_BASE_PATH || '';
        return bp + '/index.html';
    }

    function attach() {
        if (document.getElementById('colixo-global-toolbar')) return;
        var home = homeHref();
        var wrap = document.createElement('div');
        wrap.id = 'colixo-global-toolbar';
        wrap.setAttribute('role', 'navigation');
        wrap.setAttribute('aria-label', 'Navigation Colixo');
        wrap.innerHTML =
            '<style>#colixo-global-toolbar{position:fixed;top:12px;right:12px;z-index:99997;display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end;max-width:calc(100vw - 24px);font-family:system-ui,-apple-system,sans-serif;font-size:12px;}' +
            '#colixo-global-toolbar a,#colixo-global-toolbar button{margin:0;padding:7px 11px;border-radius:9px;text-decoration:none;border:1px solid rgba(255,255,255,0.18);background:rgba(15,15,22,0.92);color:#f4f4f5;cursor:pointer;font:inherit;line-height:1.2;box-shadow:0 4px 20px rgba(0,0,0,0.35);}' +
            '#colixo-global-toolbar a:hover,#colixo-global-toolbar button:hover{background:rgba(232,49,26,0.22);border-color:rgba(232,49,26,0.45);color:#fff;}' +
            '#colixo-global-toolbar .cx-out{border-color:rgba(232,49,26,0.4);background:rgba(232,49,26,0.12);}</style>' +
            '<a href="' + home + '">Accueil</a>' +
            '<button type="button" class="cx-out" id="colixo-global-logout">Déconnexion</button>';
        document.body.appendChild(wrap);
        document.getElementById('colixo-global-logout').addEventListener('click', async function () {
            try {
                if (window.SUPABASE_CLIENT && window.SUPABASE_CLIENT.auth) await window.SUPABASE_CLIENT.auth.signOut();
            } catch (e) {}
            try { sessionStorage.removeItem('colixo_user'); } catch (e) {}
            window.location.href = home;
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();
