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
window.COLIXO_ASSET_VERSION = '20260462';

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
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"
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
 * Vérifie si le serveur publie une version plus récente que le bundle déjà
 * chargé dans l'onglet, puis déclenche un rechargement unique si nécessaire.
 *
 * But :
 * - limiter les cas où un ancien HTML ou un ancien config.js reste servi
 *   depuis le cache navigateur ou CDN
 * - ne pas entrer dans une boucle de reload grâce à un garde-fou stocké
 *   dans `sessionStorage`
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
