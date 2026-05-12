// ============================================================
// config.js — bootstrap runtime global de Colixo
//
// Ce fichier centralise la configuration partagée chargée par les pages :
// - version de bundle exposée au navigateur
// - résolution du base path selon l'URL courante
// - création du client Supabase global
// - protections contre les effets de cache navigateur / CDN
//
// En exploitation, les pages injectent souvent config.js avec
// ?v=BUILD&cb=timestamp pour casser le cache HTML/CDN.
//
// Lors d'un déploiement important, garder alignés :
// - COLIXO_ASSET_VERSION
// - version.txt
// - version.json
// - les ?v= des scripts dans les HTML
//
// ⚠️ Ce fichier expose une configuration client publique Supabase.
// La clé "anon" est faite pour le navigateur, mais elle reste liée au projet.
// Il ne faut donc pas recopier ce fichier hors du périmètre prévu.
// ============================================================

// Version logique des assets frontend.
//
// Cette valeur sert de repère côté navigateur pour savoir quelle génération
// de HTML/JS/CSS est censée être chargée. Elle est utilisée avec :
// - les `?v=...` dans les balises `<script>`
// - `version.txt`
// - `version.json`
// - `data-colixo-build` sur certaines pages comme `admin/dispatch.html`
//
// Quand une mise en production importante a lieu, cette valeur doit évoluer
// en même temps que les autres marqueurs de version pour éviter les mélanges
// de vieux HTML et de nouveaux assets.
window.COLIXO_ASSET_VERSION = '20260511af';

/**
 * Résout le préfixe d'URL sous lequel le site est servi.
 *
 * Exemples :
 * - production au domaine racine -> ''
 * - déploiement sous sous-dossier -> '/mon-dossier'
 * - GitHub Pages -> '/repo'
 *
 * La logique ci-dessous distingue en pratique trois familles de cas :
 * - un hôte `*.github.io` -> on prend le premier segment comme nom de repo
 * - une page connue de l'application (`/admin`, `/login`, etc.) -> pas de préfixe
 * - un site servi sous un dossier arbitraire -> on garde ce premier segment
 *
 * Cette heuristique doit rester alignée avec le mini-loader inline présent
 * dans certains HTML, sinon différentes pages peuvent calculer des chemins
 * incompatibles entre elles.
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

/**
 * Préfixe un chemin absolu avec `COLIXO_BASE_PATH`.
 *
 * Exemple :
 * - '/login/index.html' devient '/repo/login/index.html' sur github.io
 * - '/login/index.html' reste inchangé sur un déploiement racine
 *
 * @param {string|null|undefined} path
 * @returns {string}
 */
window.colixoHref = function (path) {
    var p = path == null ? '/' : String(path);
    if (p === '') p = '/';
    if (p.charAt(0) !== '/') p = '/' + p;
    return (window.COLIXO_BASE_PATH || '') + p;
};

// Log de démarrage explicite pour vérifier rapidement la build réellement chargée.
if (typeof console !== 'undefined' && console.info) {
    console.info('[Colixo] build', window.COLIXO_ASSET_VERSION, 'base', window.COLIXO_BASE_PATH === '' ? '(racine)' : window.COLIXO_BASE_PATH);
}

/**
 * Réécrit les liens `<a href="/...">` après chargement du DOM lorsque
 * le site est servi sous un préfixe (`/repo`, preview statique, github.io).
 *
 * Chaque lien modifié reçoit `data-colixo-base="1"` pour éviter un double
 * préfixage si la routine est rejouée.
 */
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

/**
 * Configuration publique du client Supabase côté navigateur.
 *
 * `url` :
 * - URL du projet Supabase ciblé par le frontend
 * - toutes les requêtes Auth, REST et Realtime partent de cette base
 *
 * `key` :
 * - clé publique "anon/publishable" utilisable côté navigateur
 * - elle identifie le projet et permet l'accès côté client selon les règles
 *   RLS, les policies Auth et les permissions prévues par Supabase
 * - ce n'est pas une clé secrète admin ; les secrets serveur doivent rester
 *   dans les Edge Functions ou variables d'environnement serveur
 */
window.SUPABASE_CONFIG = {
    // URL canonique du projet Supabase Colixo.
    url: "https://iubbsnntcreneakbdkmv.supabase.co",
    // Clé publique navigateur utilisée pour Auth + API côté client.
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"
};

// ------------------------------------------------------------
// Brimot — stratégie d'envoi d'emails
//
// Deux modes sont supportés :
// 1. URL PHP explicite vers send_mail.php
// 2. Edge Function Supabase + Resend
//
// Si `window.BRIMOT_SEND_MAIL_URL` n'est pas défini avant ce script,
// on le laisse vide pour que le front continue avec le mode par défaut.
// ------------------------------------------------------------
// Brimot — envoi d'emails : si la facturation est sur un domaine statique sans PHP,
// mettez l'URL absolue de send_mail.php sur l'hébergement qui exécute le PHP (ex. LWS).
// Exemple : window.BRIMOT_SEND_MAIL_URL = 'https://votredomaine.ch/admin/brimot/send_mail.php';
// Sinon : Edge send-brimot-invoice + Resend — secrets Supabase RESEND_API_KEY, BRIMOT_FROM_EMAIL (domaine vérifié Resend).
// Le « Répondre » du client utilise Reply-To = MAIL_BR dans facturation.html ; optionnel BRIMOT_REPLY_TO_EMAIL si pas de payload.
// Facturation Colixo (admin/facturation.html) : Edge send-colixo-facture — COLIXO_FROM_EMAIL optionnel ; optionnel window.COLIXO_FACTURE_REPLY_EMAIL ou secret COLIXO_REPLY_TO_EMAIL.
if (typeof window.BRIMOT_SEND_MAIL_URL === 'undefined') window.BRIMOT_SEND_MAIL_URL = '';

/**
 * Sélectionne le backend de stockage d'auth le plus fiable disponible.
 *
 * Ordre de préférence :
 * - localStorage : persistant entre fermetures d'onglets
 * - sessionStorage : persistant tant que l'onglet reste ouvert
 * - mémoire : dernier recours quand le navigateur bloque le stockage
 *
 * Le fallback mémoire évite de casser complètement l'auth dans certains
 * navigateurs ou webviews, avec le compromis d'une session perdue à la
 * fermeture de l'onglet.
 *
 * @returns {{impl: Storage|{getItem:function,setItem:function,removeItem:function}, mode: string}}
 */
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

/**
 * Nettoie les traces d'auth navigateur qui peuvent rester bloquées dans Edge.
 *
 * Edge regroupe souvent cookies, localStorage et sessionStorage sous "cookies
 * et données de site". Supabase persiste surtout dans Web Storage, mais une
 * ancienne clé peut suffire à bloquer getSession/getUser ou à créer un état
 * contradictoire entre compte Auth et login par code.
 */
function colixoClearAuthStorage() {
    var keyPatterns = [
        /^colixo_/i,
        /^Colixo-auth/i,
        /^sb-.*auth-token/i,
        /supabase/i
    ];

    function clearStore(store) {
        if (!store) return;
        var keys = [];
        try {
            for (var i = 0; i < store.length; i++) {
                var key = store.key(i);
                if (keyPatterns.some(function (re) { return re.test(key || ''); })) {
                    keys.push(key);
                }
            }
            keys.forEach(function (key) { store.removeItem(key); });
        } catch (e) {}
    }

    try { clearStore(window.localStorage); } catch (e) {}
    try { clearStore(window.sessionStorage); } catch (e) {}
    try { if ((window.name || '').indexOf('COLIXO_LOGIN:') === 0) window.name = ''; } catch (e) {}

    try {
        document.cookie.split(';').forEach(function (cookie) {
            var name = cookie.split('=')[0].trim();
            if (!name || !keyPatterns.some(function (re) { return re.test(name); })) return;
            document.cookie = name + '=; Max-Age=0; path=/';
            document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname;
            if (location.hostname.indexOf('.') > -1) {
                document.cookie = name + '=; Max-Age=0; path=/; domain=.' + location.hostname.replace(/^www\./, '');
            }
        });
    } catch (e) {}
}

window.colixoClearAuthStorage = colixoClearAuthStorage;

// ------------------------------------------------------------
// Client Supabase partagé
//
// Toutes les pages s'appuient sur le même `storageKey` et la même stratégie
// de stockage afin que la session reste cohérente pendant la navigation.
//
// Le `fetch` natif est encapsulé avec `cache: 'no-store'` pour réduire les
// réponses REST périmées observées dans certains contextes navigateur/CDN.
//
// En sortie, deux variables globales sont particulièrement importantes :
// - `window.SUPABASE_CLIENT` : client partagé à réutiliser dans les pages
// - `window.COLIXO_AUTH_STORAGE_MODE` : backend de stockage réellement choisi
// ------------------------------------------------------------
try {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        throw new Error('SDK Supabase non chargé (réseau ou blocage)');
    }
    var _authSt = colixoAuthStorage();
    window.COLIXO_AUTH_STORAGE_MODE = _authSt.mode;
    if (_authSt.mode !== 'localStorage') {
        console.info('[Colixo] Session auth →', _authSt.mode, '(évite Tracking Prevention / stockage bloqué — reconnexion si onglet fermé si mémoire)');
    }
    /**
     * Référence vers le fetch natif avant tout monkey-patch éventuel.
     *
     * On s'en sert pour forcer `cache: 'no-store'` sur les appels REST
     * Supabase et limiter les effets de cache navigateur en production.
     */
    var _colixoNativeFetch = typeof fetch === 'function'
        ? fetch.bind(typeof globalThis !== 'undefined' ? globalThis : window)
        : null;
    window.SUPABASE_CLIENT = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey,
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
                // On persiste la session quand le backend de stockage le permet.
                persistSession: true,
                // Clé commune à toutes les pages pour partager la même session.
                storageKey: 'Colixo-auth',
                // Backend retenu par `colixoAuthStorage()`.
                storage: _authSt.impl,
                // Laisse Supabase rafraîchir les tokens expirants automatiquement.
                autoRefreshToken: true,
                // Permet à Supabase de récupérer une session lors des retours
                // depuis un lien magique, reset password, ou autre callback Auth.
                detectSessionInUrl: true
            }
        }
    );
} catch (e) {
    console.warn('Supabase indisponible :', e && e.message);
    window.COLIXO_SUPABASE_INIT_ERROR = e && (e.message || String(e));
    window.SUPABASE_CLIENT = null;
}

/**
 * Déconnexion unifiée pour toutes les pages de l'application.
 *
 * On centralise ici le `signOut()` et le nettoyage local afin d'éviter
 * des variantes selon les dashboards. La redirection revient toujours
 * vers l'écran de connexion.
 *
 * @returns {Promise<void>}
 */
window.colixoLogout = async function () {
    try {
        if (window.SUPABASE_CLIENT && window.SUPABASE_CLIENT.auth) {
            await window.SUPABASE_CLIENT.auth.signOut();
        }
    } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[Colixo] logout:', e && e.message ? e.message : e);
        }
    }
    colixoClearAuthStorage();
    var to = (typeof window.colixoHref === 'function')
        ? window.colixoHref('/login/index.html?logout=1')
        : '/login/index.html?logout=1';
    window.location.href = to;
};

/**
 * Ajoute un bouton flottant de déconnexion sur les pages connectées afin
 * de rendre la sortie de session évidente, même quand une petite icône
 * existe déjà ailleurs dans l'interface.
 */
(function colixoInjectEasyLogoutButton() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    var path = String(location.pathname || '/').toLowerCase();
    var isProtectedPage =
        path.indexOf('/admin/') >= 0 ||
        path.indexOf('/client/') >= 0 ||
        path.indexOf('/chauffeur/') >= 0 ||
        path.indexOf('/magasinier/') >= 0 ||
        /\/commandes-client(?:\.html)?$/i.test(path);
    if (!isProtectedPage) return;

    function ensureButton() {
        if (document.getElementById('colixo-easy-logout')) return;
        var btn = document.createElement('button');
        btn.id = 'colixo-easy-logout';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Déconnexion');
        btn.textContent = 'Déconnexion';
        btn.setAttribute(
            'style',
            [
                'position:fixed',
                'right:18px',
                'bottom:18px',
                'z-index:9999',
                'display:inline-flex',
                'align-items:center',
                'gap:8px',
                'padding:12px 16px',
                'border:none',
                'border-radius:999px',
                'background:#e8311a',
                'color:#ffffff',
                'font:600 14px Outfit, Arial, sans-serif',
                'box-shadow:0 14px 34px rgba(232,49,26,0.28)',
                'cursor:pointer'
            ].join(';')
        );
        btn.addEventListener('click', function () { window.colixoLogout(); });

        var icon = document.createElement('span');
        icon.textContent = '↩';
        icon.setAttribute('style', 'font-size:14px;line-height:1;');
        btn.insertBefore(icon, btn.firstChild);

        document.body.appendChild(btn);
    }

    async function run() {
        if (!window.SUPABASE_CLIENT || !window.SUPABASE_CLIENT.auth) return;
        try {
            var result = await window.SUPABASE_CLIENT.auth.getSession();
            if (result && result.data && result.data.session) ensureButton();
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
})();

/**
 * Déconnexion automatique après inactivité sur les pages connectées.
 *
 * Le délai est partagé entre onglets via localStorage afin d'éviter qu'une
 * ancienne page reste connectée indéfiniment pendant qu'une autre continue
 * d'être utilisée.
 */
(function colixoAutoLogoutOnIdle() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    var path = String(location.pathname || '/').toLowerCase();
    var isProtectedPage =
        path.indexOf('/admin/') >= 0 ||
        path.indexOf('/client/') >= 0 ||
        path.indexOf('/chauffeur/') >= 0 ||
        path.indexOf('/magasinier/') >= 0 ||
        /\/commandes-client(?:\.html)?$/i.test(path);
    if (!isProtectedPage) return;

    var IDLE_LIMIT_MS = 30 * 60 * 1000;
    var ACTIVITY_KEY = 'colixo_last_activity_at';
    var CHECK_INTERVAL_MS = 30 * 1000;
    var hasTimedOut = false;

    function now() {
        return Date.now();
    }

    function setActivity(ts) {
        try { localStorage.setItem(ACTIVITY_KEY, String(ts)); } catch (e) {}
    }

    function getActivity() {
        try {
            var raw = localStorage.getItem(ACTIVITY_KEY);
            var val = Number(raw);
            return Number.isFinite(val) ? val : 0;
        } catch (e) {
            return 0;
        }
    }

    async function logoutIfIdle() {
        if (hasTimedOut) return;
        var last = getActivity();
        if (!last) {
            setActivity(now());
            return;
        }
        if (now() - last < IDLE_LIMIT_MS) return;
        hasTimedOut = true;
        try { sessionStorage.setItem('colixo_idle_timeout', '1'); } catch (e) {}
        await window.colixoLogout();
    }

    function touch() {
        if (hasTimedOut) return;
        setActivity(now());
    }

    async function boot() {
        if (!window.SUPABASE_CLIENT || !window.SUPABASE_CLIENT.auth) return;
        try {
            var result = await window.SUPABASE_CLIENT.auth.getSession();
            if (!(result && result.data && result.data.session)) return;
        } catch (e) {
            return;
        }

        await logoutIfIdle();
        if (hasTimedOut) return;
        touch();

        ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (eventName) {
            window.addEventListener(eventName, touch, { passive: true });
        });
        window.addEventListener('focus', function () { logoutIfIdle(); });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') logoutIfIdle();
        });
        window.addEventListener('storage', function (event) {
            if (event.key === ACTIVITY_KEY) logoutIfIdle();
        });
        setInterval(logoutIfIdle, CHECK_INTERVAL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();

/**
 * Vérifie si le serveur publie une version plus récente que le bundle déjà
 * chargé dans l'onglet.
 *
 * But :
 * - diagnostiquer les cas où un ancien HTML ou un ancien config.js reste
 *   servi depuis le cache navigateur ou CDN
 * - éviter les rechargements automatiques visibles qui font clignoter l'onglet
 */
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
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[Colixo] version serveur', server, '> bundle', bundle, '- rechargez la page en force si l’affichage semble ancien.');
            }
        })
        .catch(function () {});
})();
