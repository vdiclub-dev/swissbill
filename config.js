// ============================================================
//  config.js — Configuration Supabase pour Colixo
//  ⚠️  Ne jamais committer ce fichier dans un dépôt public !
//  Les pages injectent config.js avec ?v=BUILD&cb=timestamp (contourne le cache Cloudflare sur l’URL).
//  Incrémenter COLIXO_ASSET_VERSION + version.txt + le v dans les HTML (ou relancer scripts/apply-config-cache-bust.py).
// ============================================================
window.COLIXO_ASSET_VERSION = '20260462';

/**
 * Préfixe du site (liens /login/…, déploiement sous /dossier/, GitHub Pages, etc.).
 * Doit rester aligné avec le mini-loader inline dans les HTML (même heuristique).
 */
window.COLIXO_BASE_PATH = (function colixoResolveBasePath() {
    if (typeof location === 'undefined') return '';
    var h = location.hostname || '';
    var path = location.pathname || '/';
    if (/\.github\.io$/i.test(h)) {
        var pts = path.split('/').filter(Boolean);
        if (pts.length >= 1) return '/' + pts[0];
    }
    var APP = { admin: 1, login: 1, chauffeur: 1, client: 1, magasinier: 1, 'commandes-client': 1 };
    var segs = path.split('/').filter(Boolean);
    if (segs.length < 1) return '';
    var raw0 = segs[0];
    var s0 = raw0.replace(/\.html?$/i, '').toLowerCase();
    if (segs.length === 1) {
        if (/\.html?$/i.test(raw0)) return '';
        if (APP[s0]) return '';
        return '/' + raw0;
    }
    if (APP[s0]) return '';
    return '/' + segs[0];
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
} catch (e) {
    console.warn('Supabase indisponible :', e && e.message);
    window.COLIXO_SUPABASE_INIT_ERROR = e && (e.message || String(e));
    window.SUPABASE_CLIENT = null;
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
            if (typeof console !== 'undefined' && console.debug) {
                console.debug('[Colixo] version serveur', server, '> bundle', bundle, '— rechargement');
            }
            location.reload();
        })
        .catch(function () {});
})();

